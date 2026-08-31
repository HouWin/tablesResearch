import { VerticalAlign } from '@univerjs/core';
import { applyColumnTypes } from './columnTypes';
import {
  applyProjectedMerges,
  breakRemovedProjectedMerges,
  breakStaleProjectedMerges,
  buildMergeIndexByAnchorRow,
  planProjectedMerges,
  type PlannedProjectedMerge,
} from './renderer';
import type {
  ETableColumn,
  ETableMerge,
  ETableRow,
  ETableRowGroup,
  ETableTreeToggleBinding,
} from './types';
import type { ETableTreeCollapseApi } from './treeCollapse';

/** 超过该行数且为 treeUI 时启用视口投影（工作表仅保留窗口行数） */
export const TREE_VIEWPORT_THRESHOLD = 5000;
/** 工作表内最多同时投影的数据行数 */
export const TREE_VIEWPORT_WINDOW_SIZE = 300;
/** 滚动接近窗口边缘时推进投影偏移 */
export const TREE_VIEWPORT_SCROLL_EDGE = 48;
/** 每次滚动推进的逻辑可见行数 */
export const TREE_VIEWPORT_SCROLL_STEP = 80;

export type TreeViewportStats = {
  enabled: true;
  totalLogicalRows: number;
  visibleLogicalRows: number;
  windowOffset: number;
  projectedRows: number;
  windowSize: number;
  /** 当前可见区在展开后列表中的序号范围（1-based，含首尾） */
  displayRangeStart: number;
  displayRangeEnd: number;
};

type UniverWorksheet = any;

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

const toRowValues = (row: ETableRow, leafColumns: ETableColumn[]) => {
  const bgStyle = row.style?.bg
    ? {
        bg: {
          rgb: row.style.bg.startsWith('#') ? row.style.bg : `#${row.style.bg}`,
        },
      }
    : null;

  return leafColumns.map((column) => {
    const cell = row.data?.[column.id];
    if (cell !== null && typeof cell === 'object') {
      const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
      if (styledCell.style || bgStyle) {
        return {
          v: styledCell.value ?? null,
          s: {
            ...(bgStyle || {}),
            ...(styledCell.style || {}),
            bg: (styledCell.style as any)?.bg || bgStyle?.bg,
          },
        };
      }
      return styledCell.value ?? null;
    }
    if (bgStyle) {
      return {
        v: cell ?? null,
        s: bgStyle,
      };
    }
    return cell ?? null;
  });
};

const buildHiddenMask = (
  totalRows: number,
  toggles: ETableTreeToggleBinding[],
  groupMap: Map<string, ETableRowGroup>,
  collapsedState: Map<string, boolean>,
): Uint8Array => {
  const hidden = new Uint8Array(totalRows);
  for (let i = 0; i < toggles.length; i += 1) {
    const toggle = toggles[i];
    if (!collapsedState.get(toggle.groupId)) {
      continue;
    }
    const group = groupMap.get(toggle.groupId);
    if (!group?.count) {
      continue;
    }
    if (toggle.kind === 'category') {
      const bodyStart = group.startRow;
      const bodyEnd = group.startRow + group.count;
      for (let row = bodyStart; row < bodyEnd; row += 1) {
        if (row >= 0 && row < totalRows) {
          hidden[row] = 1;
        }
      }
      continue;
    }
    const start = group.startRow;
    const end = start + group.count;
    for (let row = start; row < end; row += 1) {
      if (row >= 0 && row < totalRows) {
        hidden[row] = 1;
      }
    }
  }
  return hidden;
};

const computeVisibleLogicalRows = (hidden: Uint8Array): number[] => {
  const visible: number[] = [];
  for (let i = 0; i < hidden.length; i += 1) {
    if (!hidden[i]) {
      visible.push(i);
    }
  }
  return visible;
};

export interface ETableTreeViewportOptions {
  defaultRowHeight?: number;
  windowSize?: number;
  merges?: ETableMerge[];
  skipMerges?: boolean;
  onProjected?: (stats: TreeViewportStats) => void;
}

export type ETableTreeViewportApi = ETableTreeCollapseApi & {
  getStats: () => TreeViewportStats;
  /** 投影行（0-based 数据区）→ 逻辑行 */
  getLogicalDataRow: (projectedDataRow: number) => number | null;
};

/**
 * 树形大数据视口投影：全量数据在内存，工作表只写入当前可见窗口。
 * 折叠通过可见行过滤实现，不再 hideRows 全表行。
 */
export const setupTreeViewport = (
  univerAPI: any,
  worksheet: UniverWorksheet,
  rows: ETableRow[],
  rowGroups: ETableRowGroup[],
  toggles: ETableTreeToggleBinding[],
  leafColumns: ETableColumn[],
  dataStartRow: number,
  options?: ETableTreeViewportOptions,
): ETableTreeViewportApi => {
  const emptyApi: ETableTreeViewportApi = {
    dispose: () => {},
    expandAll: () => {},
    collapseAll: () => {},
    drillDown: () => false,
    drillUp: () => false,
    getBreadcrumb: () => [],
    getStats: () => ({
      enabled: true,
      totalLogicalRows: 0,
      visibleLogicalRows: 0,
      windowOffset: 0,
      projectedRows: 0,
      windowSize: TREE_VIEWPORT_WINDOW_SIZE,
      displayRangeStart: 0,
      displayRangeEnd: 0,
    }),
    getLogicalDataRow: () => null,
    ready: Promise.resolve(),
  };

  if (!univerAPI || !worksheet || !rows.length || !toggles.length || !leafColumns.length) {
    return emptyApi;
  }

  const defaultRowHeight = options?.defaultRowHeight ?? 30;
  const windowSize = options?.windowSize ?? TREE_VIEWPORT_WINDOW_SIZE;
  const sheetMerges = options?.merges ?? [];
  const mergesByAnchorRow = sheetMerges.length
    ? buildMergeIndexByAnchorRow(sheetMerges)
    : new Map<number, ETableMerge[]>();
  let lastProjectedMerges: PlannedProjectedMerge[] = [];

  const groupMap = new Map(
    collectGroups(rowGroups).map((group) => [group.id, group]),
  );
  const collapsedState = new Map(
    toggles.map((toggle) => [toggle.groupId, Boolean(toggle.collapsed)]),
  );
  const toggleByGroupId = new Map(toggles.map((toggle) => [toggle.groupId, toggle]));
  const toggleByCell = new Map<string, ETableTreeToggleBinding>();
  const togglesByLogicalRow = new Map<number, ETableTreeToggleBinding[]>();
  const categoryToggles = toggles.filter((item) => item.kind === 'category');

  toggles.forEach((toggle) => {
    toggleByCell.set(`${toggle.row}:${toggle.column}`, toggle);
    const rowToggles = togglesByLogicalRow.get(toggle.row) ?? [];
    rowToggles.push(toggle);
    togglesByLogicalRow.set(toggle.row, rowToggles);
  });

  let visibleLogicalRows: number[] = [];
  let projectedToLogical: number[] = [];
  /** 投影行 → 单元格 toggle（避免逻辑行号映射误差导致无法展开） */
  let projectedToggleByCell = new Map<string, ETableTreeToggleBinding>();
  let windowOffset = 0;
  let lastProjectedCount = 0;
  let scrollAdjustLock = false;
  let scrollRaf = 0;
  let disposed = false;
  let columnTypesApplied = false;

  const getStats = (): TreeViewportStats => ({
    enabled: true,
    totalLogicalRows: rows.length,
    visibleLogicalRows: visibleLogicalRows.length,
    windowOffset,
    projectedRows: projectedToLogical.length,
    windowSize,
    displayRangeStart: visibleLogicalRows.length
      ? windowOffset + 1
      : 0,
    displayRangeEnd: visibleLogicalRows.length
      ? windowOffset + projectedToLogical.length
      : 0,
  });

  const getLogicalDataRow = (projectedDataRow: number): number | null => {
    if (projectedDataRow < 0 || projectedDataRow >= projectedToLogical.length) {
      return null;
    }
    return projectedToLogical[projectedDataRow];
  };

  const syncCategoryRegionCollapsedState = (categoryGroupId: string, collapsed: boolean) => {
    const categoryToggle = toggleByGroupId.get(categoryGroupId);
    const categoryGroup = groupMap.get(categoryGroupId);
    if (!categoryToggle || !categoryGroup) {
      return;
    }
    const bodyStart = categoryGroup.startRow;
    const bodyEnd = categoryGroup.startRow + categoryGroup.count;
    toggles.forEach((toggle) => {
      if (toggle.kind !== 'region') {
        return;
      }
      if (toggle.row === categoryToggle.row) {
        collapsedState.set(toggle.groupId, collapsed);
        return;
      }
      if (toggle.row >= bodyStart && toggle.row < bodyEnd) {
        collapsedState.set(toggle.groupId, collapsed);
      }
    });
  };

  const recomputeVisible = () => {
    const hidden = buildHiddenMask(rows.length, toggles, groupMap, collapsedState);
    visibleLogicalRows = computeVisibleLogicalRows(hidden);
    const maxOffset = Math.max(0, visibleLogicalRows.length - windowSize);
    if (windowOffset > maxOffset) {
      windowOffset = maxOffset;
    }
  };

  const ensureLogicalRowInWindow = (logicalRow: number) => {
    const index = visibleLogicalRows.indexOf(logicalRow);
    if (index < 0) {
      return;
    }
    if (index < windowOffset) {
      windowOffset = index;
      return;
    }
    if (index >= windowOffset + windowSize) {
      windowOffset = Math.max(0, index - windowSize + 1);
    }
  };

  const collectMergesForSlice = (slice: number[]) => {
    if (!mergesByAnchorRow.size || !slice.length) {
      return [] as ETableMerge[];
    }
    const relevant: ETableMerge[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < slice.length; i += 1) {
      const anchored = mergesByAnchorRow.get(slice[i]);
      if (!anchored?.length) {
        continue;
      }
      anchored.forEach((merge) => {
        const key = `${merge.row}:${merge.column}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        relevant.push(merge);
      });
    }
    return relevant;
  };

  const clearTrailingRows = (fromProjectedRow: number, toProjectedRow: number) => {
    if (fromProjectedRow >= toProjectedRow) {
      return;
    }
    const count = toProjectedRow - fromProjectedRow;
    const emptyRow = leafColumns.map(() => '');
    const matrix = Array.from({ length: count }, () => [...emptyRow]);
    try {
      worksheet
        .getRange(dataStartRow + fromProjectedRow, 0, count, leafColumns.length)
        .setValues(matrix);
    } catch {
      // ignore
    }
  };

  const patchToggleLabels = (
    logicalRow: number,
    values: ReturnType<typeof toRowValues>,
  ) => {
    const rowToggles = togglesByLogicalRow.get(logicalRow);
    if (!rowToggles?.length) {
      return values;
    }
    const next = [...values];
    rowToggles.forEach((toggle) => {
      const collapsed = Boolean(collapsedState.get(toggle.groupId));
      const text = collapsed ? toggle.collapsedText : toggle.expandedText;
      next[toggle.column] = { v: text, s: { bl: 1 } };
    });
    return next;
  };

  const rebuildProjectedToggleIndex = () => {
    projectedToggleByCell = new Map();
    for (let projectedIndex = 0; projectedIndex < projectedToLogical.length; projectedIndex += 1) {
      const logicalRow = projectedToLogical[projectedIndex];
      const rowToggles = togglesByLogicalRow.get(logicalRow);
      if (!rowToggles?.length) {
        continue;
      }
      rowToggles.forEach((toggle) => {
        projectedToggleByCell.set(`${projectedIndex}:${toggle.column}`, toggle);
      });
    }
  };

  const captureScrollAnchor = () => {
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

  const restoreScrollAnchor = (anchor: { row: number; column: number }) => {
    scrollAdjustLock = true;
    try {
      worksheet.scrollToCell?.(anchor.row, anchor.column, 0);
    } catch {
      // ignore
    }
    window.setTimeout(() => {
      scrollAdjustLock = false;
    }, 32);
  };

  const applyRowHeaderLabels = (slice: number[]) => {
    if (typeof worksheet.customizeRowHeader !== 'function') {
      return;
    }
    const rowsCfg: Record<number, string> = {};
    for (let i = 0; i < slice.length; i += 1) {
      // 左侧序号 = 展开后可见列表中的行号（1-based），而非工作表物理行号
      rowsCfg[dataStartRow + i] = String(windowOffset + i + 1);
    }
    try {
      worksheet.customizeRowHeader({ rowsCfg });
    } catch (error) {
      console.warn('[ETable] viewport row header labels failed', error);
    }
  };

  const getViewportDataScrollRow = (edge: 'start' | 'end' = 'end'): number => {
    try {
      const visible = worksheet.getVisibleRange?.();
      if (visible) {
        const row = edge === 'end' ? visible.endRow : visible.startRow;
        if (typeof row === 'number') {
          return Math.max(0, row - dataStartRow);
        }
      }
      const state = worksheet.getScrollState?.();
      if (state && typeof state.sheetViewStartRow === 'number') {
        return Math.max(0, state.sheetViewStartRow - dataStartRow);
      }
    } catch {
      // ignore
    }
    return 0;
  };

  const advanceWindow = (direction: 1 | -1, scrollAnchor?: number) => {
    const maxOffset = Math.max(0, visibleLogicalRows.length - windowSize);
    if (direction > 0 && windowOffset >= maxOffset) {
      return false;
    }
    if (direction < 0 && windowOffset <= 0) {
      return false;
    }
    const step = Math.min(
      TREE_VIEWPORT_SCROLL_STEP,
      direction > 0 ? maxOffset - windowOffset : windowOffset,
    );
    if (step <= 0) {
      return false;
    }
    windowOffset += direction * step;
    reproject({
      scrollRow:
        typeof scrollAnchor === 'number'
          ? scrollAnchor
          : direction > 0
            ? Math.max(0, windowSize - TREE_VIEWPORT_SCROLL_EDGE)
            : TREE_VIEWPORT_SCROLL_EDGE,
      preserveScroll: false,
    });
    return true;
  };

  const writeProjectedRow = (projectedIndex: number, logicalRow: number) => {
    const values = [
      patchToggleLabels(logicalRow, toRowValues(rows[logicalRow], leafColumns)),
    ];
    worksheet
      .getRange(dataStartRow + projectedIndex, 0, 1, leafColumns.length)
      .setValues(values);
  };

  const patchProjectedToggleLabels = (projectedIndex: number, logicalRow: number) => {
    const rowToggles = togglesByLogicalRow.get(logicalRow);
    if (!rowToggles?.length) {
      return;
    }
    rowToggles.forEach((toggle) => {
      const collapsed = Boolean(collapsedState.get(toggle.groupId));
      const text = collapsed ? toggle.collapsedText : toggle.expandedText;
      try {
        worksheet.getRange(dataStartRow + projectedIndex, toggle.column).setValue({
          v: text,
          s: { bl: 1, vt: VerticalAlign.MIDDLE },
        });
      } catch {
        // ignore label patch
      }
    });
  };

  const reproject = (scrollOptions?: {
    scrollRow?: number;
    preserveScroll?: boolean;
  }) => {
    if (disposed) {
      return;
    }

    const shouldPreserveScroll =
      scrollOptions?.preserveScroll ?? scrollOptions?.scrollRow === undefined;
    const scrollAnchor = shouldPreserveScroll ? captureScrollAnchor() : null;

    const prevSlice = projectedToLogical;
    const prevMerges = lastProjectedMerges;
    const slotSize = Math.min(
      windowSize,
      Math.max(visibleLogicalRows.length, 1),
    );
    const slice = visibleLogicalRows.slice(
      windowOffset,
      windowOffset + slotSize,
    );
    const mergesForSlice = collectMergesForSlice(slice);
    const plannedMerges = planProjectedMerges(mergesForSlice, slice);

    breakStaleProjectedMerges(worksheet, dataStartRow, prevMerges, plannedMerges);

    projectedToLogical = slice;
    rebuildProjectedToggleIndex();

    if (slice.length) {
      for (let i = 0; i < slice.length; i += 1) {
        const logicalRow = slice[i];
        if (i < prevSlice.length && prevSlice[i] === logicalRow) {
          patchProjectedToggleLabels(i, logicalRow);
          continue;
        }
        writeProjectedRow(i, logicalRow);
      }

      if (slice.length !== lastProjectedCount) {
        worksheet.setRowHeights(dataStartRow, slice.length, defaultRowHeight);
      }

      if (!columnTypesApplied) {
        applyColumnTypes(univerAPI, worksheet, leafColumns, dataStartRow, slice.length, {
          skipValidation: true,
        });
        columnTypesApplied = true;
      }

      applyRowHeaderLabels(slice);

      if (lastProjectedCount > slice.length) {
        clearTrailingRows(slice.length, lastProjectedCount);
      }

      lastProjectedMerges = mergesForSlice.length
        ? applyProjectedMerges(
            worksheet,
            mergesForSlice,
            dataStartRow,
            slice,
            prevMerges,
          )
        : [];
      if (lastProjectedMerges.length) {
        const patchedLogical = new Set<number>();
        lastProjectedMerges.forEach((merge) => {
          if (patchedLogical.has(merge.logicalRow)) {
            return;
          }
          patchedLogical.add(merge.logicalRow);
          patchProjectedToggleLabels(merge.row, merge.logicalRow);
        });
      }
    } else if (lastProjectedCount > 0) {
      breakRemovedProjectedMerges(worksheet, dataStartRow, prevMerges, []);
      clearTrailingRows(0, lastProjectedCount);
      lastProjectedMerges = [];
    }
    lastProjectedCount = slice.length;

    if (typeof scrollOptions?.scrollRow === 'number') {
      scrollAdjustLock = true;
      try {
        worksheet.scrollToCell?.(
          dataStartRow + Math.max(0, scrollOptions.scrollRow),
          0,
          0,
        );
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        scrollAdjustLock = false;
      }, 32);
    } else if (scrollAnchor) {
      restoreScrollAnchor(scrollAnchor);
    }

    options?.onProjected?.(getStats());
  };

  const refresh = (scrollOptions?: {
    scrollRow?: number;
    preserveScroll?: boolean;
  }) => {
    scrollAdjustLock = true;
    recomputeVisible();
    reproject(scrollOptions);
    window.setTimeout(() => {
      scrollAdjustLock = false;
    }, 64);
  };

  const scheduleScrollAdjust = () => {
    if (disposed || scrollRaf || scrollAdjustLock) {
      return;
    }
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (disposed || visibleLogicalRows.length <= windowSize) {
        return;
      }

      const viewEnd = getViewportDataScrollRow('end');
      const projectedCount = projectedToLogical.length;

      if (viewEnd >= projectedCount - TREE_VIEWPORT_SCROLL_EDGE) {
        advanceWindow(1, Math.max(0, viewEnd - TREE_VIEWPORT_SCROLL_STEP));
        return;
      }

      const viewStart = getViewportDataScrollRow('start');
      if (viewStart <= TREE_VIEWPORT_SCROLL_EDGE) {
        advanceWindow(-1, viewStart + TREE_VIEWPORT_SCROLL_STEP);
      }
    });
  };

  const applyCollapsed = (groupId: string, collapsed: boolean) => {
    const toggle = toggleByGroupId.get(groupId);
    if (!toggle) {
      return;
    }
    collapsedState.set(groupId, collapsed);
    if (toggle.kind === 'category' && collapsed) {
      syncCategoryRegionCollapsedState(groupId, true);
    }
    if (toggle.kind === 'category') {
      ensureLogicalRowInWindow(toggle.row);
    } else if (toggle.kind === 'region') {
      ensureLogicalRowInWindow(toggle.row);
    }
    refresh();
  };

  const toggleGroup = (groupId: string) => {
    const toggle = toggleByGroupId.get(groupId);
    if (!toggle) {
      return;
    }
    applyCollapsed(groupId, !collapsedState.get(groupId));
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

  const groupsCoveringLogical = (logicalRow: number) => {
    const rowToggles = togglesByLogicalRow.get(logicalRow) ?? [];
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
      if (item.start > logicalRow) {
        break;
      }
      if (logicalRow >= item.start && logicalRow < item.end) {
        covering.push({
          toggle: item.toggle,
          group: item.group,
          span: item.span,
        });
      }
    }
    return covering;
  };

  const getActiveLogicalRow = (): number | null => {
    try {
      const selection = worksheet.getSelection?.();
      const range = selection?.getActiveRange?.() || selection?.getRange?.();
      const sheetRow = range?.getRow?.();
      if (typeof sheetRow !== 'number') {
        return null;
      }
      const projectedDataRow = sheetRow - dataStartRow;
      if (projectedDataRow < 0) {
        return null;
      }
      return getLogicalDataRow(projectedDataRow);
    } catch {
      return null;
    }
  };

  const drillDown = (dataRow?: number) => {
    const logicalRow =
      typeof dataRow === 'number'
        ? dataRow
        : getActiveLogicalRow();
    if (logicalRow === null || logicalRow < 0) {
      return false;
    }

    const onRow = togglesByLogicalRow
      .get(logicalRow)
      ?.find((item) => collapsedState.get(item.groupId));
    if (onRow) {
      toggleGroup(onRow.groupId);
      return true;
    }

    const covering = groupsCoveringLogical(logicalRow)
      .filter((item) => collapsedState.get(item.toggle.groupId))
      .sort((a, b) => a.span - b.span);
    if (!covering.length) {
      return false;
    }
    toggleGroup(covering[0].toggle.groupId);
    return true;
  };

  const drillUp = (dataRow?: number) => {
    const logicalRow =
      typeof dataRow === 'number'
        ? dataRow
        : getActiveLogicalRow();
    if (logicalRow === null || logicalRow < 0) {
      return false;
    }

    const covering = groupsCoveringLogical(logicalRow)
      .filter((item) => !collapsedState.get(item.toggle.groupId))
      .sort((a, b) => a.span - b.span);
    if (!covering.length) {
      const onRow = togglesByLogicalRow
        .get(logicalRow)
        ?.find((item) => !collapsedState.get(item.groupId));
      if (onRow) {
        toggleGroup(onRow.groupId);
        return true;
      }
      return false;
    }
    toggleGroup(covering[0].toggle.groupId);
    return true;
  };

  const getBreadcrumb = (logicalRow: number) =>
    groupsCoveringLogical(logicalRow)
      .sort((a, b) => b.span - a.span)
      .map((item) => {
        const text =
          item.toggle.expandedText || item.toggle.collapsedText || item.toggle.groupId;
        return text.replace(/^[▼▶]\s*/, '').trim();
      });

  const expandAll = () => {
    categoryToggles.forEach((toggle) => {
      collapsedState.set(toggle.groupId, false);
    });
    toggles.forEach((toggle) => {
      if (toggle.kind === 'region') {
        collapsedState.set(toggle.groupId, true);
      }
    });
    windowOffset = 0;
    refresh({ scrollRow: 0, preserveScroll: false });
  };

  const collapseAll = () => {
    categoryToggles.forEach((toggle) => {
      collapsedState.set(toggle.groupId, true);
      syncCategoryRegionCollapsedState(toggle.groupId, true);
    });
    windowOffset = 0;
    refresh({ scrollRow: 0, preserveScroll: false });
  };

  const resolveToggleHit = (
    projectedDataRow: number,
    column: number,
  ): ETableTreeToggleBinding | undefined => {
    const direct = projectedToggleByCell.get(`${projectedDataRow}:${column}`);
    if (direct) {
      return direct;
    }
    const logicalRow = getLogicalDataRow(projectedDataRow);
    if (logicalRow === null) {
      return undefined;
    }
    return (
      togglesByLogicalRow.get(logicalRow)?.find((toggle) => toggle.column === column) ??
      toggleByCell.get(`${logicalRow}:${column}`)
    );
  };

  const handleToggleCellActivation = (row: number, column: number) => {
    if (typeof row !== 'number' || typeof column !== 'number') {
      return;
    }
    const projectedDataRow = row - dataStartRow;
    if (projectedDataRow < 0) {
      return;
    }
    const hit = resolveToggleHit(projectedDataRow, column);
    if (!hit) {
      return;
    }
    toggleGroup(hit.groupId);
  };

  let cellDisposable: { dispose?: () => void } | null = null;
  let scrollDisposable: { dispose?: () => void } | null = null;

  recomputeVisible();
  reproject();

  try {
    cellDisposable = univerAPI.addEvent(univerAPI.Event.CellClicked, (params: any) => {
      const row = params?.row ?? params?.location?.row;
      const column = params?.column ?? params?.col ?? params?.location?.col;
      if (typeof row !== 'number' || typeof column !== 'number') {
        return;
      }
      handleToggleCellActivation(row, column);
    });
  } catch (error) {
    console.warn('[ETable] bind viewport tree cell collapse failed', error);
  }

  try {
    if (univerAPI?.Event?.Scroll && typeof univerAPI.addEvent === 'function') {
      scrollDisposable = univerAPI.addEvent(univerAPI.Event.Scroll, () => {
        scheduleScrollAdjust();
      });
    }
  } catch {
    // ignore
  }

  if (import.meta.env.DEV) {
    console.info('[ETable] tree viewport projection enabled', getStats());
  }

  return {
    dispose: () => {
      disposed = true;
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
      }
      try {
        cellDisposable?.dispose?.();
        scrollDisposable?.dispose?.();
      } catch {
        // ignore
      }
    },
    expandAll,
    collapseAll,
    drillDown,
    drillUp,
    getBreadcrumb,
    getStats,
    getLogicalDataRow,
    ready: Promise.resolve(),
  };
};
