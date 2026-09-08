import type { ListTable } from '@visactor/vtable';
import { HEADER_ROWS } from './grid-model';

export type ViewportAnchor = { row: number; top: number };

/** One inert presentation row supplies only the space needed to keep a fold still. */
export function updateViewportSpace(
  table: ListTable,
  totalRows: number,
  scrollTop = table.scrollTop,
) {
  const spacerRow = HEADER_ROWS + totalRows;
  const contentHeight = table.getRowsHeight(0, spacerRow - 1);
  const height =
    scrollTop > 0
      ? Math.max(
          0,
          Math.ceil(scrollTop + table.tableNoFrameHeight - contentHeight),
        )
      : 0;
  if (table.getRowHeight(spacerRow) !== height)
    table.setRowHeight(spacerRow, height);
}

export function restoreViewport(
  table: ListTable,
  totalRows: number,
  scrollTop: number,
  scrollLeft: number,
  anchor?: ViewportAnchor,
) {
  const top = anchor
    ? Math.max(
        0,
        table.getRowsHeight(0, anchor.row + HEADER_ROWS - 1) - anchor.top,
      )
    : scrollTop;
  updateViewportSpace(table, totalRows, top);
  table.scrollTop = top;
  table.scrollLeft = scrollLeft;
}

/** VTable recreations reset row heights and may clamp scrolling before repaint. */
export function withStableViewport(
  table: ListTable,
  totalRows: number,
  refresh: () => void,
) {
  const top = table.scrollTop;
  const left = table.scrollLeft;
  refresh();
  restoreViewport(table, totalRows, top, left);
}
