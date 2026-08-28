import type { ETableMerge, ETableRowGroup, ETableTreeToggleBinding } from './types';
import { reapplyMergesForRowSpan } from './renderer';
import { VIRTUAL_PAGE_SIZE } from './virtualRender';

const LARGE_TOGGLE_COUNT = 200;
const DEFAULT_TOGGLE_BATCH_SIZE = 60;
const INTERACTIVE_HIDE_BATCH = 40;

/**
 * 收集全部行分组（含嵌套）。
 */
const collectGroups = (groups: ETableRowGroup[]): ETableRowGroup[] => {
  const result: ETableRowGroup[] = [];
  const walk = (list: ETableRowGroup[]) => {
    list.forEach((group) => {
      result.push(group);
      if (group.children?.length) {
        walk(group.children);
      }
    });
  };
  walk(groups);
  return result;
};

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 32 });
      return;
    }
    window.setTimeout(resolve, 0);
  });

/** 合并相邻行区间（sheet 绝对行号） */
const mergeRowRanges = (
  ranges: Array<{ start: number; count: number }>,
): Array<{ start: number; count: number }> => {
  if (!ranges.length) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; count: number }> = [];
  let current = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    const currentEnd = current.start + current.count;
    if (next.start <= currentEnd) {
      const nextEnd = next.start + next.count;
      current = {
        start: current.start,
        count: Math.max(currentEnd, nextEnd) - current.start,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
};

/** 合并相邻 hideRows 区间，减少 API 调用 */
const hideCoalescedRowRanges = (
  worksheet: any,
  ranges: Array<{ start: number; count: number }>,
) => {
  if (!ranges.length) {
    return;
  }
  mergeRowRanges(ranges).forEach(({ start, count }) => {
    try {
      worksheet.hideRows(start, count);
    } catch (error) {
      console.warn('[ETable] coalesced hideRows failed', { start, count, error });
    }
  });
};

const hideRangesInBatches = async (
  worksheet: any,
  ranges: Array<{ start: number; count: number }>,
  options: { useBatch: boolean; batchSize: number },
) => {
  if (!ranges.length) {
    return;
  }
  const merged = mergeRowRanges(ranges);
  if (!options.useBatch || merged.length <= 30) {
    hideCoalescedRowRanges(worksheet, merged);
    return;
  }
  const chunk = Math.max(INTERACTIVE_HIDE_BATCH, options.batchSize);
  for (let offset = 0; offset < merged.length; offset += chunk) {
    hideCoalescedRowRanges(worksheet, merged.slice(offset, offset + chunk));
    if (offset + chunk < merged.length) {
      await yieldToMain();
    }
  }
};

const setRowsCollapsed = (
  worksheet: any,
  dataStartRow: number,
  group: Pick<ETableRowGroup, 'startRow' | 'count'>,
  collapsed: boolean,
  mergeFix?: {
    merges: ETableMerge[];
    anchorRow: number;
    afterReapply?: () => void;
  },
) => {
  if (group.count <= 0) {
    return;
  }
  const start = dataStartRow + group.startRow;
  try {
    if (collapsed) {
      worksheet.hideRows(start, group.count);
    } else {
      if (typeof worksheet.showRows === 'function') {
        worksheet.showRows(start, group.count);
      } else {
        const range = worksheet.getRange(start, 0, group.count, 1);
        worksheet.unhideRow?.(range);
        if (typeof worksheet.unhideRow !== 'function') {
          for (let i = 0; i < group.count; i += 1) {
            worksheet.setRowHidden?.(start + i, false);
          }
        }
      }
      if (mergeFix?.merges?.length) {
        reapplyMergesForRowSpan(
          worksheet,
          mergeFix.merges,
          dataStartRow,
          mergeFix.anchorRow,
          1 + group.count,
        );
        mergeFix.afterReapply?.();
      }
    }
  } catch (error) {
    console.warn('[ETable] toggle tree rows failed', { start, group, collapsed, error });
  }
};

export interface ETableTreeCollapseOptions {
  /** 大数据：分批初始化 Region 折叠，避免主线程长时间阻塞 */
  batchedInit?: boolean;
  /** 每批 hideRows 数量（初始化 / 交互复用） */
  initBatchSize?: number;
  /** 初始化跳过 writeLabel（展平时已写入 ▶/▼） */
  skipInitLabels?: boolean;
  /** 行展开后需重新应用的 merge（hideRows 会破坏 Univer 合并） */
  merges?: ETableMerge[];
  /** 懒虚拟：展开行前先写入对应数据行 */
  ensureDataRows?: (startRow: number, endRow: number) => void;
}

export interface ETableTreeCollapseApi {
  dispose: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  drillDown: (dataRow?: number) => boolean;
  drillUp: (dataRow?: number) => boolean;
  getBreadcrumb: (dataRow: number) => string[];
  /** 初始折叠（分批 hideRows）完成 */
  ready: Promise<void>;
}

const buildRegionIndex = (
  toggles: ETableTreeToggleBinding[],
  categoryToggles: ETableTreeToggleBinding[],
  groupMap: Map<string, ETableRowGroup>,
) => {
  const regionTogglesByCategoryId = new Map<string, ETableTreeToggleBinding[]>();
  const categoryBounds = categoryToggles
    .map((categoryToggle) => {
      const categoryGroup = groupMap.get(categoryToggle.groupId);
      if (!categoryGroup) {
        return null;
      }
      return {
        categoryId: categoryToggle.groupId,
        toggleRow: categoryToggle.row,
        start: categoryGroup.startRow,
        end: categoryGroup.startRow + categoryGroup.count,
      };
    })
    .filter(Boolean) as Array<{
    categoryId: string;
    toggleRow: number;
    start: number;
    end: number;
  }>;

  categoryBounds.forEach((bound) => {
    regionTogglesByCategoryId.set(bound.categoryId, []);
  });

  for (let i = 0; i < toggles.length; i += 1) {
    const toggle = toggles[i];
    if (toggle.kind !== 'region') {
      continue;
    }
    const regionGroup = groupMap.get(toggle.groupId);
    const groupStart = regionGroup?.startRow;
    const groupEnd = regionGroup ? regionGroup.startRow + regionGroup.count : -1;

    for (let j = 0; j < categoryBounds.length; j += 1) {
      const bound = categoryBounds[j];
      if (toggle.groupId === bound.categoryId) {
        continue;
      }
      const onSummaryRow = toggle.row === bound.toggleRow;
      const headerInCategory = toggle.row >= bound.start && toggle.row < bound.end;
      const bodyInCategory =
        groupStart !== undefined &&
        groupStart >= bound.start &&
        groupEnd <= bound.end;
      if (onSummaryRow || headerInCategory || bodyInCategory) {
        regionTogglesByCategoryId.get(bound.categoryId)!.push(toggle);
      }
    }
  }

  return regionTogglesByCategoryId;
};

/**
 * 树形 UI：用隐藏行实现折叠，折叠箭头只在单元格内（▶/▼），不使用左侧大纲栏。
 */
export const setupTreeCellCollapse = (
  univerAPI: any,
  worksheet: any,
  rowGroups: ETableRowGroup[],
  toggles: ETableTreeToggleBinding[],
  dataStartRow: number,
  options?: ETableTreeCollapseOptions,
): ETableTreeCollapseApi => {
  if (!univerAPI || !worksheet || !toggles.length) {
    return {
      dispose: () => {},
      expandAll: () => {},
      collapseAll: () => {},
      drillDown: () => false,
      drillUp: () => false,
      getBreadcrumb: () => [],
      ready: Promise.resolve(),
    };
  }

  const batchSize = options?.initBatchSize ?? DEFAULT_TOGGLE_BATCH_SIZE;
  const useBatchToggle = toggles.length >= LARGE_TOGGLE_COUNT;
  const merges = options?.merges ?? [];
  const ensureDataRows = options?.ensureDataRows;

  const mergeFixForRegion = (anchorRow: number, group: Pick<ETableRowGroup, 'count'>) => {
    if (!merges.length) {
      return undefined;
    }
    return {
      merges,
      anchorRow,
      afterReapply: () => {
        const categoryToggle = togglesByRow.get(anchorRow)?.find(
          (item) => item.kind === 'category',
        );
        if (categoryToggle) {
          writeLabel(
            categoryToggle,
            Boolean(collapsedState.get(categoryToggle.groupId)),
          );
        }
      },
    };
  };

  const toggleGroupRows = (
    group: Pick<ETableRowGroup, 'startRow' | 'count'>,
    collapsed: boolean,
    mergeFix?: {
      merges: ETableMerge[];
      anchorRow: number;
      afterReapply?: () => void;
    },
  ) => {
    if (!collapsed && ensureDataRows) {
      if (useBatchToggle && group.count > 200) {
        const preview = Math.min(group.count, VIRTUAL_PAGE_SIZE);
        ensureDataRows(group.startRow, group.startRow + preview - 1);
      } else {
        ensureDataRows(group.startRow, group.startRow + group.count - 1);
      }
    }
    setRowsCollapsed(worksheet, dataStartRow, group, collapsed, mergeFix);
  };

  const getWorkbook = () => {
    try {
      return univerAPI.getActiveWorkbook?.();
    } catch {
      return null;
    }
  };

  /** merge / hideRows 等程序化操作会扩大选区，树形展开后隐藏蓝框 */
  const hideSelectionBorder = () => {
    getWorkbook()?.transparentSelection?.();
  };

  const showSelectionBorder = () => {
    getWorkbook()?.showSelection?.();
  };

  const hideSelectionBorderAfterTreeAction = () => {
    requestAnimationFrame(() => {
      hideSelectionBorder();
      requestAnimationFrame(hideSelectionBorder);
    });
  };

  const groupMap = new Map(
    collectGroups(rowGroups).map((group) => [group.id, group]),
  );

  const collapsedState = new Map(
    toggles.map((toggle) => [toggle.groupId, Boolean(toggle.collapsed)]),
  );

  const toggleByGroupId = new Map(toggles.map((toggle) => [toggle.groupId, toggle]));
  const toggleByCell = new Map<string, ETableTreeToggleBinding>();
  const togglesByRow = new Map<number, ETableTreeToggleBinding[]>();

  toggles.forEach((toggle) => {
    toggleByCell.set(`${toggle.row}:${toggle.column}`, toggle);
    const rowToggles = togglesByRow.get(toggle.row) ?? [];
    rowToggles.push(toggle);
    togglesByRow.set(toggle.row, rowToggles);
  });

  const categoryToggles = toggles.filter((item) => item.kind === 'category');
  const regionTogglesByCategoryId = buildRegionIndex(toggles, categoryToggles, groupMap);

  /** 品类展开时需隐藏的 Region 明细行（预计算，避免每次 toggle 遍历数百 Region） */
  const categoryRegionHideItems = new Map<
    string,
    Array<{ range: { start: number; count: number }; regionGroupId: string }>
  >();
  categoryToggles.forEach((categoryToggle) => {
    const regions = regionTogglesByCategoryId.get(categoryToggle.groupId) ?? [];
    const items: Array<{
      range: { start: number; count: number };
      regionGroupId: string;
    }> = [];
    regions.forEach((regionToggle) => {
      const regionGroup = groupMap.get(regionToggle.groupId);
      if (!regionGroup?.count) {
        return;
      }
      items.push({
        regionGroupId: regionToggle.groupId,
        range: {
          start: dataStartRow + regionGroup.startRow,
          count: regionGroup.count,
        },
      });
    });
    categoryRegionHideItems.set(categoryToggle.groupId, items);
  });

  const syncCategoryRegionCollapsedState = (categoryGroupId: string, collapsed: boolean) => {
    const regions = regionTogglesByCategoryId.get(categoryGroupId);
    if (!regions) {
      return;
    }
    for (let i = 0; i < regions.length; i += 1) {
      collapsedState.set(regions[i].groupId, collapsed);
    }
  };

  let toggleTaskChain: Promise<void> = Promise.resolve();

  const enqueueToggleTask = (task: () => Promise<void>) => {
    toggleTaskChain = toggleTaskChain.then(task).catch((error) => {
      console.warn('[ETable] batched tree toggle failed', error);
    });
  };

  const writeLabel = (toggle: ETableTreeToggleBinding, collapsed: boolean) => {
    const text = collapsed ? toggle.collapsedText : toggle.expandedText;
    try {
      worksheet.getRange(dataStartRow + toggle.row, toggle.column).setValue({
        v: text,
        s: { bl: 1 },
      });
    } catch (error) {
      console.warn('[ETable] update tree toggle label failed', error);
    }
  };

  const hideCategoryBody = (categoryGroupId: string) => {
    const group = groupMap.get(categoryGroupId);
    if (!group) {
      return;
    }
    setRowsCollapsed(worksheet, dataStartRow, group, true);
  };

  /**
   * 品类展开：整块 unhide 子树 + 批量 hide 仍折叠的 Region 明细。
   */
  const showCategoryBody = async (categoryGroupId: string) => {
    const categoryGroup = groupMap.get(categoryGroupId);
    if (useBatchToggle) {
      await yieldToMain();
    }

    if (categoryGroup?.count) {
      toggleGroupRows(categoryGroup, false);
    }

    const hideItems = categoryRegionHideItems.get(categoryGroupId) ?? [];
    const hideRanges = hideItems
      .filter((item) => collapsedState.get(item.regionGroupId))
      .map((item) => item.range);

    await hideRangesInBatches(worksheet, hideRanges, {
      useBatch: useBatchToggle,
      batchSize: batchSize,
    });

    if (!merges.length) {
      return;
    }

    const expandedItems = hideItems.filter(
      (item) => !collapsedState.get(item.regionGroupId),
    );
    if (!expandedItems.length) {
      return;
    }

    const expandOne = (item: (typeof hideItems)[number]) => {
      const regionGroup = groupMap.get(item.regionGroupId);
      const regionToggle = toggleByGroupId.get(item.regionGroupId);
      if (!regionGroup || !regionToggle) {
        return;
      }
      toggleGroupRows(
        regionGroup,
        false,
        mergeFixForRegion(regionToggle.row, regionGroup),
      );
    };

    if (useBatchToggle && expandedItems.length > 20) {
      for (let offset = 0; offset < expandedItems.length; offset += batchSize) {
        expandedItems.slice(offset, offset + batchSize).forEach(expandOne);
        if (offset + batchSize < expandedItems.length) {
          await yieldToMain();
        }
      }
      return;
    }

    expandedItems.forEach(expandOne);
  };

  const hideRegionToggle = (toggle: ETableTreeToggleBinding) => {
    const group = groupMap.get(toggle.groupId);
    if (!group) {
      return;
    }
    collapsedState.set(toggle.groupId, true);
    setRowsCollapsed(worksheet, dataStartRow, group, true);
  };

  const isRegionDetailHiddenByCategory = (
    toggle: ETableTreeToggleBinding,
    collapsedCategoryRanges: Array<{ start: number; end: number }>,
  ): boolean => {
    const group = groupMap.get(toggle.groupId);
    if (!group) {
      return true;
    }
    const detailStart = group.startRow;
    const detailEnd = group.startRow + group.count;

    for (let i = 0; i < collapsedCategoryRanges.length; i += 1) {
      const range = collapsedCategoryRanges[i];
      if (detailStart >= range.start && detailEnd <= range.end) {
        return true;
      }
    }
    return false;
  };

  const buildCollapsedCategoryRanges = () =>
    categoryToggles
      .filter((categoryToggle) => collapsedState.get(categoryToggle.groupId))
      .map((categoryToggle) => groupMap.get(categoryToggle.groupId))
      .filter((group): group is ETableRowGroup => Boolean(group))
      .map((group) => ({
        start: group.startRow,
        end: group.startRow + group.count,
      }));

  const batchHideRegionToggles = async (regionToggles: ETableTreeToggleBinding[]) => {
    if (!regionToggles.length) {
      return;
    }
    if (!useBatchToggle || regionToggles.length <= 20) {
      regionToggles.forEach((toggle) => hideRegionToggle(toggle));
      return;
    }

    for (let offset = 0; offset < regionToggles.length; offset += batchSize) {
      const batch = regionToggles.slice(offset, offset + batchSize);
      const ranges: Array<{ start: number; count: number }> = [];
      batch.forEach((toggle) => {
        collapsedState.set(toggle.groupId, true);
        const group = groupMap.get(toggle.groupId);
        if (group && group.count > 0) {
          ranges.push({
            start: dataStartRow + group.startRow,
            count: group.count,
          });
        }
      });
      hideCoalescedRowRanges(worksheet, ranges);
      if (offset + batchSize < regionToggles.length) {
        await yieldToMain();
      }
    }
  };

  const applyCollapsed = (
    groupId: string,
    collapsed: boolean,
    applyOptions?: { skipLabel?: boolean; skipNestedRegionReset?: boolean },
  ): void | Promise<void> => {
    const toggle = toggleByGroupId.get(groupId);
    if (!toggle) {
      return;
    }

    collapsedState.set(groupId, collapsed);
    if (!applyOptions?.skipLabel) {
      writeLabel(toggle, collapsed);
    }

    if (toggle.kind === 'category') {
      if (collapsed) {
        syncCategoryRegionCollapsedState(groupId, true);
        const collapseBody = async () => {
          if (useBatchToggle) {
            await yieldToMain();
          }
          hideCategoryBody(groupId);
        };
        if (useBatchToggle) {
          return collapseBody();
        }
        hideCategoryBody(groupId);
      } else {
        return showCategoryBody(groupId);
      }
      return;
    }

    const group = groupMap.get(groupId);
    if (!group) {
      return;
    }
    toggleGroupRows(
      group,
      collapsed,
      !collapsed && toggle.kind === 'region'
        ? mergeFixForRegion(toggle.row, group)
        : undefined,
    );
  };

  const initDefaultCollapse = async () => {
    const skipInitLabels = options?.skipInitLabels ?? false;

    categoryToggles.forEach((toggle) => {
      if (!groupMap.has(toggle.groupId)) {
        return;
      }
      applyCollapsed(toggle.groupId, true, {
        skipLabel: skipInitLabels,
        skipNestedRegionReset: true,
      });
    });

    const collapsedCategoryRanges = buildCollapsedCategoryRanges();
    const regionToggles = toggles.filter(
      (toggle) =>
        toggle.kind === 'region' &&
        toggle.collapsed &&
        groupMap.has(toggle.groupId) &&
        !isRegionDetailHiddenByCategory(toggle, collapsedCategoryRanges),
    );

    await batchHideRegionToggles(regionToggles);
  };

  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  if (options?.batchedInit) {
    void initDefaultCollapse().finally(() => {
      resolveReady();
    });
  } else {
    categoryToggles.forEach((toggle) => {
      if (!groupMap.has(toggle.groupId)) {
        return;
      }
      applyCollapsed(toggle.groupId, true);
    });
    toggles.forEach((toggle) => {
      if (toggle.kind !== 'region' || !toggle.collapsed || !groupMap.get(toggle.groupId)) {
        return;
      }
      applyCollapsed(toggle.groupId, true);
    });
    resolveReady();
  }

  const toggleGroup = (groupId: string) => {
    const toggle = toggleByGroupId.get(groupId);
    if (!toggle) {
      return;
    }

    const next = !collapsedState.get(groupId);

    const runCategoryBody = async () => {
      if (next) {
        syncCategoryRegionCollapsedState(groupId, true);
        if (useBatchToggle) {
          await yieldToMain();
        }
        hideCategoryBody(groupId);
      } else {
        await showCategoryBody(groupId);
      }
    };

    const runToggle = async () => {
      if (toggle.kind === 'category' && useBatchToggle) {
        await runCategoryBody();
      } else {
        const result = applyCollapsed(groupId, next);
        if (result instanceof Promise) {
          await result;
        }
      }
      hideSelectionBorderAfterTreeAction();
    };

    if (useBatchToggle && toggle.kind === 'category') {
      collapsedState.set(groupId, next);
      writeLabel(toggle, next);
      enqueueToggleTask(runToggle);
      return;
    }

    if (useBatchToggle && toggle.kind === 'region') {
      enqueueToggleTask(runToggle);
      return;
    }

    void runToggle();
  };

  const expandAll = () => {
    categoryToggles.forEach((toggle) => {
      applyCollapsed(toggle.groupId, false);
    });

    if (!useBatchToggle) {
      toggles
        .filter((toggle) => toggle.kind === 'region' && collapsedState.get(toggle.groupId))
        .forEach((toggle) => {
          const group = groupMap.get(toggle.groupId);
          if (group) {
            setRowsCollapsed(worksheet, dataStartRow, group, true);
          }
        });
      hideSelectionBorderAfterTreeAction();
      return;
    }

    enqueueToggleTask(async () => {
      const collapsedRegions = toggles.filter(
        (toggle) => toggle.kind === 'region' && collapsedState.get(toggle.groupId),
      );
      await batchHideRegionToggles(collapsedRegions);
      hideSelectionBorderAfterTreeAction();
    });
  };

  const collapseAll = () => {
    categoryToggles.forEach((toggle) => {
      applyCollapsed(toggle.groupId, true, { skipLabel: false });
    });
    hideSelectionBorderAfterTreeAction();
  };

  const groupCoverIntervals = toggles
    .map((toggle) => {
      const group = groupMap.get(toggle.groupId);
      if (!group) {
        return null;
      }
      return {
        start: group.startRow,
        end: group.startRow + group.count,
        toggle,
        group,
        span: group.count,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.start - b!.start) as Array<{
    start: number;
    end: number;
    toggle: ETableTreeToggleBinding;
    group: ETableRowGroup;
    span: number;
  }>;

  const groupsCovering = (dataRow: number) => {
    const rowToggles = togglesByRow.get(dataRow) ?? [];
    const fromRow = rowToggles
      .map((toggle) => {
        const group = groupMap.get(toggle.groupId);
        return group ? { toggle, group, span: group.count } : null;
      })
      .filter(Boolean) as Array<{
      toggle: ETableTreeToggleBinding;
      group: ETableRowGroup;
      span: number;
    }>;

    if (fromRow.length) {
      return fromRow;
    }

    const covering: Array<{
      toggle: ETableTreeToggleBinding;
      group: ETableRowGroup;
      span: number;
    }> = [];
    for (let i = 0; i < groupCoverIntervals.length; i += 1) {
      const item = groupCoverIntervals[i];
      if (item.start > dataRow) {
        break;
      }
      if (dataRow >= item.start && dataRow < item.end) {
        covering.push({
          toggle: item.toggle,
          group: item.group,
          span: item.span,
        });
      }
    }
    return covering;
  };

  const getActiveDataRow = (): number | null => {
    try {
      const selection = worksheet.getSelection?.();
      const range = selection?.getActiveRange?.() || selection?.getRange?.();
      const sheetRow = range?.getRow?.();
      if (typeof sheetRow !== 'number') {
        return null;
      }
      const dataRow = sheetRow - dataStartRow;
      return dataRow >= 0 ? dataRow : null;
    } catch {
      return null;
    }
  };

  const drillDown = (dataRow?: number) => {
    const row = typeof dataRow === 'number' ? dataRow : getActiveDataRow();
    if (row === null || row < 0) {
      return false;
    }

    const onRow = togglesByRow.get(row)?.find((item) => collapsedState.get(item.groupId));
    if (onRow) {
      toggleGroup(onRow.groupId);
      return true;
    }

    const covering = groupsCovering(row)
      .filter((item) => collapsedState.get(item.toggle.groupId))
      .sort((a, b) => a.span - b.span);
    if (!covering.length) {
      return false;
    }
    toggleGroup(covering[0].toggle.groupId);
    return true;
  };

  const drillUp = (dataRow?: number) => {
    const row = typeof dataRow === 'number' ? dataRow : getActiveDataRow();
    if (row === null || row < 0) {
      return false;
    }

    const covering = groupsCovering(row)
      .filter((item) => !collapsedState.get(item.toggle.groupId))
      .sort((a, b) => a.span - b.span);
    if (!covering.length) {
      const onRow = togglesByRow.get(row)?.find((item) => !collapsedState.get(item.groupId));
      if (onRow) {
        toggleGroup(onRow.groupId);
        return true;
      }
      return false;
    }
    toggleGroup(covering[0].toggle.groupId);
    return true;
  };

  const getBreadcrumb = (dataRow: number) =>
    groupsCovering(dataRow)
      .sort((a, b) => b.span - a.span)
      .map((item) => {
        const text =
          item.toggle.expandedText || item.toggle.collapsedText || item.toggle.groupId;
        return text.replace(/^[▼▶]\s*/, '').trim();
      });

  let disposable: { dispose?: () => void } | null = null;
  let rowHeaderDisposable: { dispose?: () => void } | null = null;
  try {
    disposable = univerAPI.addEvent(univerAPI.Event.CellClicked, (params: any) => {
      const row = params?.row ?? params?.location?.row;
      const column = params?.column ?? params?.col ?? params?.location?.col;
      if (typeof row !== 'number' || typeof column !== 'number') {
        return;
      }
      const dataRow = row - dataStartRow;
      if (dataRow < 0) {
        return;
      }
      const hit = toggleByCell.get(`${dataRow}:${column}`);
      if (!hit) {
        return;
      }
      toggleGroup(hit.groupId);
    });
  } catch (error) {
    console.warn('[ETable] bind tree cell collapse failed', error);
  }

  try {
    rowHeaderDisposable = univerAPI.addEvent(univerAPI.Event.RowHeaderClick, () => {
      showSelectionBorder();
    });
  } catch {
    // RowHeaderClick 在部分版本不可用
  }

  return {
    dispose: () => {
      try {
        disposable?.dispose?.();
        rowHeaderDisposable?.dispose?.();
      } catch {
        // ignore
      }
    },
    expandAll,
    collapseAll,
    drillDown,
    drillUp,
    getBreadcrumb,
    ready,
  };
};
