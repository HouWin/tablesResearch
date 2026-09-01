/**
 * 树形折叠 - hideRows 模式（treeCollapse.ts）
 *
 * 用于 treeUI 且行数 < 5000 的场景：
 * - 单元格内 ▶/▼ 点击切换折叠状态
 * - 通过 hideRows / showRows 隐藏子行（大数据时性能较差）
 * - Region 展开后 reapplyMergesForRowSpan 修复因 hideRows 破坏的合并
 *
 * 行数 ≥ 5000 时由 treeViewport.ts 接管（视口投影，不再全表 hideRows）。
 */
import type { ETableMerge, ETableRowGroup, ETableTreeToggleBinding } from './types';
import { buildMergeIndexByAnchorRow, reapplyMergesForRowSpan } from './renderer';
import { VIRTUAL_PAGE_SIZE } from './virtualRender';

const LARGE_TOGGLE_COUNT = 200;
const DEFAULT_TOGGLE_BATCH_SIZE = 60;
/** 单次 SetRowHidden 命令内 ranges 上限，避免极端场景 mutation 过久阻塞 */
const BULK_ROW_RANGE_CHUNK = 4000;
const SET_ROWS_HIDDEN_CMD = 'sheet.command.set-rows-hidden';
const SET_ROWS_VISIBLE_CMD = 'sheet.command.set-specific-rows-visible';
const ROW_RANGE_TYPE = 1;

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

const getSheetCommandContext = (worksheet: any) => {
  const workbook = worksheet.getWorkbook?.();
  const unitId = workbook?.getUnitId?.() as string | undefined;
  const subUnitId = worksheet.getSheetId?.() as string | undefined;
  const endColumn = Math.max(0, (worksheet.getColumnCount?.() ?? 1) - 1);
  return { unitId, subUnitId, endColumn };
};

const toSheetRowRanges = (
  ranges: Array<{ start: number; count: number }>,
  endColumn: number,
) =>
  ranges.map(({ start, count }) => ({
    startRow: start,
    endRow: start + count - 1,
    startColumn: 0,
    endColumn,
    rangeType: ROW_RANGE_TYPE,
  }));

/**
 * 合并相邻区间后，通过 SetRowHiddenCommand 一次提交多段 hide（避免数百次 hideRows 命令链）。
 */
const hideCoalescedRowRanges = (
  univerAPI: any,
  worksheet: any,
  ranges: Array<{ start: number; count: number }>,
) => {
  if (!ranges.length) {
    return;
  }
  const merged = mergeRowRanges(ranges);
  const ctx = getSheetCommandContext(worksheet);
  if (!ctx.unitId || !ctx.subUnitId || typeof univerAPI?.syncExecuteCommand !== 'function') {
    merged.forEach(({ start, count }) => {
      try {
        worksheet.hideRows(start, count);
      } catch (error) {
        console.warn('[ETable] coalesced hideRows failed', { start, count, error });
      }
    });
    return;
  }

  const sheetRanges = toSheetRowRanges(merged, ctx.endColumn);
  for (let offset = 0; offset < sheetRanges.length; offset += BULK_ROW_RANGE_CHUNK) {
    const chunk = sheetRanges.slice(offset, offset + BULK_ROW_RANGE_CHUNK);
    try {
      univerAPI.syncExecuteCommand(SET_ROWS_HIDDEN_CMD, {
        unitId: ctx.unitId,
        subUnitId: ctx.subUnitId,
        ranges: chunk,
      });
    } catch (error) {
      console.warn('[ETable] bulk hideRows failed', { count: chunk.length, error });
      chunk.forEach((range) => {
        try {
          worksheet.hideRows(range.startRow, range.endRow - range.startRow + 1);
        } catch (innerError) {
          console.warn('[ETable] fallback hideRows failed', { range, innerError });
        }
      });
    }
  }
};

const showCoalescedRowRanges = (
  univerAPI: any,
  worksheet: any,
  ranges: Array<{ start: number; count: number }>,
) => {
  if (!ranges.length) {
    return;
  }
  const merged = mergeRowRanges(ranges);
  const ctx = getSheetCommandContext(worksheet);
  if (!ctx.unitId || !ctx.subUnitId || typeof univerAPI?.syncExecuteCommand !== 'function') {
    merged.forEach(({ start, count }) => {
      try {
        if (typeof worksheet.showRows === 'function') {
          worksheet.showRows(start, count);
        } else {
          const range = worksheet.getRange(start, 0, count, 1);
          worksheet.unhideRow?.(range);
        }
      } catch (error) {
        console.warn('[ETable] coalesced showRows failed', { start, count, error });
      }
    });
    return;
  }

  const sheetRanges = toSheetRowRanges(merged, ctx.endColumn);
  for (let offset = 0; offset < sheetRanges.length; offset += BULK_ROW_RANGE_CHUNK) {
    const chunk = sheetRanges.slice(offset, offset + BULK_ROW_RANGE_CHUNK);
    try {
      univerAPI.syncExecuteCommand(SET_ROWS_VISIBLE_CMD, {
        unitId: ctx.unitId,
        subUnitId: ctx.subUnitId,
        ranges: chunk,
      });
    } catch (error) {
      console.warn('[ETable] bulk showRows failed', { count: chunk.length, error });
      chunk.forEach((range) => {
        try {
          worksheet.showRows?.(range.startRow, range.endRow - range.startRow + 1);
        } catch (innerError) {
          console.warn('[ETable] fallback showRows failed', { range, innerError });
        }
      });
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
  rowOptions?: { deferMergeFix?: boolean },
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
        const runMergeFix = () => {
          reapplyMergesForRowSpan(
            worksheet,
            mergeFix.merges,
            dataStartRow,
            mergeFix.anchorRow,
            1 + group.count,
          );
          mergeFix.afterReapply?.();
        };
        if (rowOptions?.deferMergeFix) {
          requestAnimationFrame(runMergeFix);
        } else {
          runMergeFix();
        }
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
  /** 跳过 Region 展开时的 merge 修复（大数据 lite 无 merge 时） */
  skipMergeFix?: boolean;
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

  categoryBounds.sort((a, b) => a.toggleRow - b.toggleRow);
  categoryBounds.forEach((bound) => {
    regionTogglesByCategoryId.set(bound.categoryId, []);
  });

  const regionToggles = toggles.filter((toggle) => toggle.kind === 'region');
  regionToggles.sort((a, b) => a.row - b.row);

  const resolveCategoryId = (
    toggle: ETableTreeToggleBinding,
    groupStart: number | undefined,
    groupEnd: number,
  ): string | null => {
    if (!categoryBounds.length) {
      return null;
    }
    let lo = 0;
    let hi = categoryBounds.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (categoryBounds[mid].toggleRow <= toggle.row) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (idx < 0) {
      return null;
    }

    const candidates: number[] = [idx];
    if (idx > 0) {
      candidates.unshift(idx - 1);
    }
    if (idx + 1 < categoryBounds.length) {
      candidates.push(idx + 1);
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const bound = categoryBounds[candidates[i]];
      if (toggle.groupId === bound.categoryId) {
        continue;
      }
      const onSummaryRow = toggle.row === bound.toggleRow;
      const headerInCategory = toggle.row >= bound.start && toggle.row < bound.end;
      const bodyInCategory =
        groupStart !== undefined && groupStart >= bound.start && groupEnd <= bound.end;
      if (onSummaryRow || headerInCategory || bodyInCategory) {
        return bound.categoryId;
      }
    }
    return null;
  };

  for (let i = 0; i < regionToggles.length; i += 1) {
    const toggle = regionToggles[i];
    const regionGroup = groupMap.get(toggle.groupId);
    const groupStart = regionGroup?.startRow;
    const groupEnd = regionGroup ? regionGroup.startRow + regionGroup.count : -1;
    const categoryId = resolveCategoryId(toggle, groupStart, groupEnd);
    if (categoryId) {
      regionTogglesByCategoryId.get(categoryId)!.push(toggle);
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
  const skipMergeFix = options?.skipMergeFix ?? !merges.length;
  const mergesByAnchorRow = skipMergeFix ? new Map() : buildMergeIndexByAnchorRow(merges);
  const ensureDataRows = options?.ensureDataRows;

  const mergeFixForRegion = (anchorRow: number, group: Pick<ETableRowGroup, 'count'>) => {
    if (skipMergeFix) {
      return undefined;
    }
    const relevant = mergesByAnchorRow.get(anchorRow);
    if (!relevant?.length) {
      return undefined;
    }
    return {
      merges: relevant,
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
    setRowsCollapsed(worksheet, dataStartRow, group, collapsed, mergeFix, {
      deferMergeFix: useBatchToggle,
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
  /** 品类展开且 Region 全折叠时仅需 show 的汇总行（避免整块 unhide 后再 hide 上千行） */
  const categorySummaryShowRanges = new Map<
    string,
    Array<{ start: number; count: number }>
  >();
  categoryToggles.forEach((categoryToggle) => {
    const regions = regionTogglesByCategoryId.get(categoryToggle.groupId) ?? [];
    const items: Array<{
      regionGroupId: string;
      range: { start: number; count: number };
    }> = [];
    const summaryRows: Array<{ start: number; count: number }> = [];
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
      if (regionToggle.row !== categoryToggle.row) {
        summaryRows.push({ start: dataStartRow + regionToggle.row, count: 1 });
      }
    });
    categoryRegionHideItems.set(categoryToggle.groupId, items);
    categorySummaryShowRanges.set(categoryToggle.groupId, summaryRows);
  });

  const allRegionsCollapsedInCategory = (categoryGroupId: string) => {
    const regions = regionTogglesByCategoryId.get(categoryGroupId);
    if (!regions?.length) {
      return true;
    }
    for (let i = 0; i < regions.length; i += 1) {
      if (!collapsedState.get(regions[i].groupId)) {
        return false;
      }
    }
    return true;
  };

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
    const categoryGroup = groupMap.get(categoryGroupId);
    if (!categoryGroup?.count) {
      return;
    }
    const bodyStart = categoryGroup.startRow;
    const bodyEnd = categoryGroup.startRow + categoryGroup.count;
    if (bodyEnd <= bodyStart) {
      setRowsCollapsed(worksheet, dataStartRow, categoryGroup, true);
      return;
    }
    try {
      worksheet.hideRows(dataStartRow + bodyStart, bodyEnd - bodyStart);
    } catch (error) {
      console.warn('[ETable] hide category body failed', { categoryGroupId, error });
    }
  };

  const showCategoryBodyRange = (categoryGroupId: string) => {
    const categoryGroup = groupMap.get(categoryGroupId);
    if (!categoryGroup?.count) {
      return;
    }
    const bodyStart = categoryGroup.startRow;
    const bodyEnd = categoryGroup.startRow + categoryGroup.count;
    if (bodyEnd <= bodyStart) {
      toggleGroupRows(categoryGroup, false);
      return;
    }
    setRowsCollapsed(
      worksheet,
      dataStartRow,
      { startRow: bodyStart, count: bodyEnd - bodyStart },
      false,
    );
  };

  /**
   * 品类展开：整块 unhide 子树 + 批量 hide 仍折叠的 Region 明细。
   */
  const showCategoryBody = async (categoryGroupId: string) => {

    if (allRegionsCollapsedInCategory(categoryGroupId)) {
      const showRanges = categorySummaryShowRanges.get(categoryGroupId) ?? [];
      if (showRanges.length) {
        showCoalescedRowRanges(univerAPI, worksheet, showRanges);
      } else {
        showCategoryBodyRange(categoryGroupId);
      }
      return;
    }

    const categoryGroup = groupMap.get(categoryGroupId);

    if (categoryGroup?.count) {
      showCategoryBodyRange(categoryGroupId);
    }

    const hideItems = categoryRegionHideItems.get(categoryGroupId) ?? [];
    const hideRanges = hideItems
      .filter((item) => collapsedState.get(item.regionGroupId))
      .map((item) => item.range);

    if (hideRanges.length) {
      hideCoalescedRowRanges(univerAPI, worksheet, hideRanges);
    }

    if (skipMergeFix || !merges.length) {
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
      hideCoalescedRowRanges(univerAPI, worksheet, ranges);
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

    if (useBatchToggle && categoryToggles.length > 0) {
      const categoryRanges: Array<{ start: number; count: number }> = [];
      categoryToggles.forEach((toggle) => {
        if (!groupMap.has(toggle.groupId)) {
          return;
        }
        collapsedState.set(toggle.groupId, true);
        syncCategoryRegionCollapsedState(toggle.groupId, true);
        if (!skipInitLabels) {
          writeLabel(toggle, true);
        }
        const categoryGroup = groupMap.get(toggle.groupId);
        if (!categoryGroup?.count) {
          return;
        }
        categoryRanges.push({
          start: dataStartRow + categoryGroup.startRow,
          count: categoryGroup.count,
        });
      });
      hideCoalescedRowRanges(univerAPI, worksheet, categoryRanges);
      const regionToggles = toggles.filter(
        (item) =>
          item.kind === 'region' &&
          collapsedState.get(item.groupId) &&
          groupMap.has(item.groupId),
      );
      await batchHideRegionToggles(regionToggles);
      return;
    }

    categoryToggles.forEach((toggle) => {
      if (!groupMap.has(toggle.groupId)) {
        return;
      }
      applyCollapsed(toggle.groupId, true, {
        skipLabel: skipInitLabels,
        skipNestedRegionReset: true,
      });
    });

    const regionToggles = toggles.filter(
      (toggle) =>
        toggle.kind === 'region' &&
        toggle.collapsed &&
        groupMap.has(toggle.groupId),
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
    };

    if (useBatchToggle && toggle.kind === 'category') {
      collapsedState.set(groupId, next);
      writeLabel(toggle, next);
      enqueueToggleTask(runToggle);
      return;
    }

    if (useBatchToggle && toggle.kind === 'region') {
      collapsedState.set(groupId, next);
      writeLabel(toggle, next);
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
      return;
    }

    enqueueToggleTask(async () => {
      const collapsedRegions = toggles.filter(
        (toggle) => toggle.kind === 'region' && collapsedState.get(toggle.groupId),
      );
      await batchHideRegionToggles(collapsedRegions);
    });
  };

  const collapseAll = () => {
    categoryToggles.forEach((toggle) => {
      applyCollapsed(toggle.groupId, true, { skipLabel: false });
    });
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
  try {
    disposable = univerAPI.addEvent(univerAPI.Event.CellClicked, (params: any) => {
      const row = params?.row ?? params?.location?.row;
      const column = params?.column ?? params?.col ?? params?.location?.col;
      if (typeof row !== 'number' || typeof column !== 'number') {
        return;
      }
      const dataRow = row - dataStartRow;
      const hit =
        dataRow >= 0 ? toggleByCell.get(`${dataRow}:${column}`) : undefined;
      if (hit) {
        toggleGroup(hit.groupId);
      }
    });
  } catch (error) {
    console.warn('[ETable] bind tree cell collapse failed', error);
  }

  return {
    dispose: () => {
      try {
        disposable?.dispose?.();
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
