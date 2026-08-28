import type { ETableRowGroup, ETableTreeToggleBinding } from './types';

const LARGE_TOGGLE_COUNT = 200;
const DEFAULT_TOGGLE_BATCH_SIZE = 60;

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
    window.setTimeout(resolve, 0);
  });

const setRowsCollapsed = (
  worksheet: any,
  dataStartRow: number,
  group: Pick<ETableRowGroup, 'startRow' | 'count'>,
  collapsed: boolean,
) => {
  if (group.count <= 0) {
    return;
  }
  const start = dataStartRow + group.startRow;
  try {
    if (collapsed) {
      worksheet.hideRows(start, group.count);
    } else {
      const range = worksheet.getRange(start, 0, group.count, 1);
      worksheet.unhideRow?.(range);
      if (typeof worksheet.unhideRow !== 'function') {
        worksheet.showRows?.(start, group.count);
        for (let i = 0; i < group.count; i += 1) {
          worksheet.setRowHidden?.(start + i, false);
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
}

export interface ETableTreeCollapseApi {
  dispose: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  drillDown: (dataRow?: number) => boolean;
  drillUp: (dataRow?: number) => boolean;
  getBreadcrumb: (dataRow: number) => string[];
}

const buildRegionIndex = (
  toggles: ETableTreeToggleBinding[],
  categoryToggles: ETableTreeToggleBinding[],
  groupMap: Map<string, ETableRowGroup>,
) => {
  const regionTogglesByCategoryId = new Map<string, ETableTreeToggleBinding[]>();

  categoryToggles.forEach((categoryToggle) => {
    const categoryGroup = groupMap.get(categoryToggle.groupId);
    if (!categoryGroup) {
      return;
    }
    const catStart = categoryGroup.startRow;
    const catEnd = categoryGroup.startRow + categoryGroup.count;
    const related: ETableTreeToggleBinding[] = [];

    toggles.forEach((toggle) => {
      if (toggle.kind !== 'region' || toggle.groupId === categoryToggle.groupId) {
        return;
      }
      const regionGroup = groupMap.get(toggle.groupId);
      const onSummaryRow = toggle.row === categoryToggle.row;
      const headerInCategory = toggle.row >= catStart && toggle.row < catEnd;
      const bodyInCategory = Boolean(
        regionGroup &&
          regionGroup.startRow >= catStart &&
          regionGroup.startRow + regionGroup.count <= catEnd,
      );
      if (onSummaryRow || headerInCategory || bodyInCategory) {
        related.push(toggle);
      }
    });

    regionTogglesByCategoryId.set(categoryToggle.groupId, related);
  });

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
    };
  }

  const batchSize = options?.initBatchSize ?? DEFAULT_TOGGLE_BATCH_SIZE;
  const useBatchToggle = toggles.length >= LARGE_TOGGLE_COUNT;

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

  const showDataRow = (dataRow: number) => {
    const sheetRow = dataStartRow + dataRow;
    try {
      worksheet.showRows(sheetRow, 1);
    } catch {
      worksheet.setRowHidden?.(sheetRow, false);
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
   * 品类展开：只显示子项行本身，不 unhide 整块区间（否则会连带露出 Region 城市行）。
   * Region 城市明细仍按各自折叠状态 hide/show。
   */
  const showCategoryBody = (categoryGroupId: string) => {
    const categoryToggle = toggleByGroupId.get(categoryGroupId);
    if (!categoryToggle) {
      return;
    }

    const regions = regionTogglesByCategoryId.get(categoryGroupId) ?? [];
    regions.forEach((regionToggle) => {
      const regionGroup = groupMap.get(regionToggle.groupId);
      const onSummaryRow = regionToggle.row === categoryToggle.row;
      const collapsed = Boolean(collapsedState.get(regionToggle.groupId));

      if (onSummaryRow) {
        if (regionGroup) {
          setRowsCollapsed(worksheet, dataStartRow, regionGroup, collapsed);
        }
        writeLabel(regionToggle, collapsed);
        return;
      }

      showDataRow(regionToggle.row);
      writeLabel(regionToggle, collapsed);
      if (regionGroup) {
        setRowsCollapsed(worksheet, dataStartRow, regionGroup, collapsed);
      }
    });
  };

  const hideRegionToggle = (toggle: ETableTreeToggleBinding) => {
    const group = groupMap.get(toggle.groupId);
    if (!group) {
      return;
    }
    collapsedState.set(toggle.groupId, true);
    setRowsCollapsed(worksheet, dataStartRow, group, true);
  };

  const resetRegionsInCategory = (
    categoryToggle: ETableTreeToggleBinding,
    resetOptions?: { labelsOnly?: boolean },
  ) => {
    const regions = regionTogglesByCategoryId.get(categoryToggle.groupId) ?? [];
    regions.forEach((regionToggle) => {
      collapsedState.set(regionToggle.groupId, true);
      if (resetOptions?.labelsOnly) {
        return;
      }

      const regionGroup = groupMap.get(regionToggle.groupId);
      if (regionGroup) {
        setRowsCollapsed(worksheet, dataStartRow, regionGroup, true);
      }

      // 汇总行 Region 仍可见，必须立刻改回 ▶
      if (regionToggle.row === categoryToggle.row) {
        writeLabel(regionToggle, true);
      }
    });
  };

  const isRegionDetailHiddenByCategory = (toggle: ETableTreeToggleBinding): boolean => {
    const group = groupMap.get(toggle.groupId);
    if (!group) {
      return true;
    }
    const detailStart = group.startRow;
    const detailEnd = group.startRow + group.count;

    for (const categoryToggle of categoryToggles) {
      if (!collapsedState.get(categoryToggle.groupId)) {
        continue;
      }
      const categoryGroup = groupMap.get(categoryToggle.groupId);
      if (!categoryGroup) {
        continue;
      }
      const hiddenStart = categoryGroup.startRow;
      const hiddenEnd = categoryGroup.startRow + categoryGroup.count;
      if (detailStart >= hiddenStart && detailEnd <= hiddenEnd) {
        return true;
      }
    }
    return false;
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
      batch.forEach((toggle) => hideRegionToggle(toggle));
      if (offset + batchSize < regionToggles.length) {
        await yieldToMain();
      }
    }
  };

  const applyCollapsed = (
    groupId: string,
    collapsed: boolean,
    applyOptions?: { skipLabel?: boolean; skipNestedRegionReset?: boolean },
  ) => {
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
        if (applyOptions?.skipNestedRegionReset) {
          resetRegionsInCategory(toggle, { labelsOnly: true });
        } else {
          resetRegionsInCategory(toggle);
        }
        hideCategoryBody(groupId);
      } else {
        showCategoryBody(groupId);
      }
      return;
    }

    const group = groupMap.get(groupId);
    if (!group) {
      return;
    }
    setRowsCollapsed(worksheet, dataStartRow, group, collapsed);
  };

  const initDefaultCollapse = async () => {
    const skipInitLabels = options?.skipInitLabels ?? false;

    categoryToggles
      .filter((toggle) => toggle.collapsed && groupMap.has(toggle.groupId))
      .forEach((toggle) => {
        applyCollapsed(toggle.groupId, true, {
          skipLabel: skipInitLabels,
          skipNestedRegionReset: true,
        });
      });

    const regionToggles = toggles.filter(
      (toggle) =>
        toggle.kind === 'region' &&
        toggle.collapsed &&
        groupMap.has(toggle.groupId) &&
        !isRegionDetailHiddenByCategory(toggle),
    );

    await batchHideRegionToggles(regionToggles);
  };

  if (options?.batchedInit) {
    void initDefaultCollapse();
  } else {
    toggles.forEach((toggle) => {
      if (!toggle.collapsed || !groupMap.get(toggle.groupId)) {
        return;
      }
      applyCollapsed(toggle.groupId, true);
    });
  }

  const toggleGroup = (groupId: string) => {
    const toggle = toggleByGroupId.get(groupId);
    if (!toggle) {
      return;
    }

    const next = !collapsedState.get(groupId);
    applyCollapsed(groupId, next);
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
      applyCollapsed(toggle.groupId, true, { skipNestedRegionReset: true });
    });
  };

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

    return toggles
      .map((toggle) => {
        const group = groupMap.get(toggle.groupId);
        if (!group) {
          return null;
        }
        const start = group.startRow;
        const end = group.startRow + group.count;
        if (dataRow >= start && dataRow < end) {
          return { toggle, group, span: group.count };
        }
        return null;
      })
      .filter(Boolean) as Array<{
      toggle: ETableTreeToggleBinding;
      group: ETableRowGroup;
      span: number;
    }>;
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
  };
};
