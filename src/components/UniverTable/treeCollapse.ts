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

/**
 * 树形 UI：用隐藏行实现折叠，折叠箭头只在单元格内（▶/▼），不使用左侧大纲栏。
 */
export const setupTreeCellCollapse = (
  univerAPI: any,
  worksheet: any,
  rowGroups: ETableRowGroup[],
  toggles: ETableTreeToggleBinding[],
  dataStartRow: number,
): (() => void) => {
  if (!univerAPI || !worksheet || !toggles.length) {
    return () => {};
  }

  const groupMap = new Map(
    collectGroups(rowGroups).map((group) => [group.id, group]),
  );

  const collapsedState = new Map(
    toggles.map((toggle) => [toggle.groupId, Boolean(toggle.collapsed)]),
  );

  // 初始化默认折叠
  toggles.forEach((toggle) => {
    const group = groupMap.get(toggle.groupId);
    if (!group || !toggle.collapsed) {
      return;
    }
    setRowsCollapsed(worksheet, dataStartRow, group, true);
  });

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

  const toggleGroup = (groupId: string) => {
    const toggle = toggles.find((item) => item.groupId === groupId);
    const group = groupMap.get(groupId);
    if (!toggle || !group) {
      return;
    }
    const next = !collapsedState.get(groupId);
    collapsedState.set(groupId, next);
    setRowsCollapsed(worksheet, dataStartRow, group, next);
    writeLabel(toggle, next);

    // 展开父组后，重新应用内部仍折叠的子组
    if (!next) {
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

  return () => {
    try {
      disposable?.dispose?.();
    } catch {
      // ignore
    }
  };
};
