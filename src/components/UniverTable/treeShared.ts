import type { ETableRowGroup, ETableTreeToggleBinding } from './types';

/** 收集全部行分组（含嵌套） */
export const collectRowGroups = (groups: ETableRowGroup[]): ETableRowGroup[] => {
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

export type TreeToggleMaps = {
  toggleByGroupId: Map<string, ETableTreeToggleBinding>;
  toggleByCell: Map<string, ETableTreeToggleBinding>;
  togglesByLogicalRow: Map<number, ETableTreeToggleBinding[]>;
};

export const buildToggleMaps = (toggles: ETableTreeToggleBinding[]): TreeToggleMaps => {
  const toggleByGroupId = new Map(toggles.map((toggle) => [toggle.groupId, toggle]));
  const toggleByCell = new Map<string, ETableTreeToggleBinding>();
  const togglesByLogicalRow = new Map<number, ETableTreeToggleBinding[]>();
  toggles.forEach((toggle) => {
    toggleByCell.set(`${toggle.row}:${toggle.column}`, toggle);
    const rowToggles = togglesByLogicalRow.get(toggle.row) ?? [];
    rowToggles.push(toggle);
    togglesByLogicalRow.set(toggle.row, rowToggles);
  });
  return { toggleByGroupId, toggleByCell, togglesByLogicalRow };
};

export type ScrollAnchor = { row: number; column: number };

export const captureScrollAnchor = (
  worksheet: any,
  dataStartRow: number,
): ScrollAnchor | null => {
  try {
    const state = worksheet.getScrollState?.();
    if (!state) {
      return null;
    }
    return {
      row:
        typeof state.sheetViewStartRow === 'number'
          ? state.sheetViewStartRow
          : dataStartRow,
      column:
        typeof state.sheetViewStartColumn === 'number'
          ? state.sheetViewStartColumn
          : 0,
    };
  } catch {
    return null;
  }
};

export const restoreScrollAnchor = (worksheet: any, anchor: ScrollAnchor | null) => {
  if (!anchor) {
    return;
  }
  requestAnimationFrame(() => {
    try {
      worksheet.scrollToCell?.(anchor.row, anchor.column, 0);
    } catch {
      // ignore
    }
  });
};

/** 下一帧再下一帧执行，等待 Univer 完成 hide/show/布局 */
export const scheduleIdleWork = (task: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(task);
  });
};

/** 合并同一帧内多次 merge 重应用请求 */
export const createMergeReapplyScheduler = (run: () => void) => {
  let scheduled = false;
  return () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    scheduleIdleWork(() => {
      scheduled = false;
      run();
    });
  };
};

/** 品类 → Region toggle 索引（treeCollapse / treeViewport 共用） */
export const buildRegionIndex = (
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
