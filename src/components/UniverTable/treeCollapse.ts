import type { ETableRowGroup, ETableTreeToggleBinding } from './types';

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
      // 部分版本无 unhideRow，回退 showRows / setRowHidden
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

export interface ETableTreeCollapseApi {
  dispose: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** 下钻：展开当前数据行对应的行组 */
  drillDown: (dataRow?: number) => boolean;
  /** 上钻：折叠覆盖当前数据行的行组 */
  drillUp: (dataRow?: number) => boolean;
  /** 面包屑：当前行所属分组路径 */
  getBreadcrumb: (dataRow: number) => string[];
}

/**
 * 树形 UI：用隐藏行实现折叠，折叠箭头只在单元格内（▶/▼），不使用左侧大纲栏。
 */
export const setupTreeCellCollapse = (
  univerAPI: any,
  worksheet: any,
  rowGroups: ETableRowGroup[],
  toggles: ETableTreeToggleBinding[],
  dataStartRow: number,
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

  const groupMap = new Map(
    collectGroups(rowGroups).map((group) => [group.id, group]),
  );

  const collapsedState = new Map(
    toggles.map((toggle) => [toggle.groupId, Boolean(toggle.collapsed)]),
  );

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

  const applyCollapsed = (groupId: string, collapsed: boolean) => {
    const toggle = toggles.find((item) => item.groupId === groupId);
    const group = groupMap.get(groupId);
    if (!toggle || !group) {
      return;
    }
    collapsedState.set(groupId, collapsed);
    setRowsCollapsed(worksheet, dataStartRow, group, collapsed);
    writeLabel(toggle, collapsed);
  };

  // 初始化默认折叠
  toggles.forEach((toggle) => {
    const group = groupMap.get(toggle.groupId);
    if (!group || !toggle.collapsed) {
      return;
    }
    setRowsCollapsed(worksheet, dataStartRow, group, true);
  });

  const toggleGroup = (groupId: string) => {
    const next = !collapsedState.get(groupId);
    applyCollapsed(groupId, next);

    // 展开父组后，重新应用内部仍折叠的子组
    if (!next) {
      const group = groupMap.get(groupId);
      if (!group) {
        return;
      }
      const groupStart = group.startRow;
      const groupEnd = group.startRow + group.count;
      toggles.forEach((item) => {
        if (item.groupId === groupId || !collapsedState.get(item.groupId)) {
          return;
        }
        const nested = groupMap.get(item.groupId);
        if (!nested) {
          return;
        }
        if (nested.startRow >= groupStart && nested.startRow + nested.count <= groupEnd) {
          setRowsCollapsed(worksheet, dataStartRow, nested, true);
        }
      });
    }
  };

  const expandAll = () => {
    // 先展开外层，再按初始状态收起 Region 等仍标记 collapsed 的组
    toggles.forEach((toggle) => applyCollapsed(toggle.groupId, false));
  };

  const collapseAll = () => {
    toggles.forEach((toggle) => applyCollapsed(toggle.groupId, true));
  };

  const groupsCovering = (dataRow: number) =>
    toggles
      .map((toggle) => {
        const group = groupMap.get(toggle.groupId);
        if (!group) {
          return null;
        }
        const start = group.startRow;
        const end = group.startRow + group.count;
        // 父行本身（toggle.row）或子行区间
        if (toggle.row === dataRow || (dataRow >= start && dataRow < end)) {
          return { toggle, group, span: group.count };
        }
        return null;
      })
      .filter(Boolean) as Array<{
      toggle: ETableTreeToggleBinding;
      group: ETableRowGroup;
      span: number;
    }>;

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
    // 优先展开当前行上的 toggle，其次展开覆盖该行且仍折叠的最内层组
    const onRow = toggles.find((item) => item.row === row);
    if (onRow && collapsedState.get(onRow.groupId)) {
      applyCollapsed(onRow.groupId, false);
      return true;
    }
    const covering = groupsCovering(row)
      .filter((item) => collapsedState.get(item.toggle.groupId))
      .sort((a, b) => a.span - b.span);
    if (!covering.length) {
      return false;
    }
    applyCollapsed(covering[0].toggle.groupId, false);
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
      // 当前行自身有 toggle 且已展开时折叠它
      const onRow = toggles.find((item) => item.row === row);
      if (onRow && !collapsedState.get(onRow.groupId)) {
        applyCollapsed(onRow.groupId, true);
        return true;
      }
      return false;
    }
    applyCollapsed(covering[0].toggle.groupId, true);
    return true;
  };

  const getBreadcrumb = (dataRow: number) => {
    return groupsCovering(dataRow)
      .sort((a, b) => b.span - a.span)
      .map((item) => {
        const text = item.toggle.expandedText || item.toggle.collapsedText || item.toggle.groupId;
        return text.replace(/^[▼▶]\s*/, '').trim();
      });
  };

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
      const hit = toggles.find(
        (item) => item.row === dataRow && item.column === column,
      );
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
