import type { ListTable } from '@visactor/vtable';
import {
  bounds,
  type CellPosition,
  type CellRange,
} from '../TanStackBudget/core/types';
import type { OrganizationBlock } from './grid-model';

/** Scrolling moves the existing overlay; only changed ranges need re-selection. */
export function syncTableSelection(
  table: ListTable,
  range: Parameters<ListTable['selectCells']>[0][number],
) {
  const current = table.getSelectedCellRanges();
  if (
    current.length === 1 &&
    current[0].start.col === range.start.col &&
    current[0].start.row === range.start.row &&
    current[0].end.col === range.end.col &&
    current[0].end.row === range.end.row
  )
    return;
  // In VTable 1.26.7, re-selecting inside a custom merge can retain the old
  // overlay while replacing its tracked component. Explicitly clear it first.
  table.clearSelected();
  table.selectCells([range]);
}

export type GetOrganizationBlock = (
  row: number,
) => OrganizationBlock | undefined;

/** A merged organization's address and business context belong to its first row. */
export function organizationPosition(
  point: CellPosition,
  getBlock: GetOrganizationBlock,
): CellPosition {
  const block = point.col === 0 ? getBlock(point.row) : undefined;
  return block ? { ...point, row: block.blockStart } : point;
}

/** Expand only boundary merges; never scan or fetch an entire large selection. */
export function organizationSelection(
  range: CellRange,
  getBlock: GetOrganizationBlock,
): CellRange {
  const box = bounds(range);
  if (box.left !== 0) return range;
  const first = getBlock(box.top);
  const last = getBlock(box.bottom);
  const top = first?.blockStart ?? box.top;
  const bottom = last ? last.blockStart + last.productRowSpan - 1 : box.bottom;
  if (box.right === 0 && first && first.blockStart === last?.blockStart) {
    // Keep the full selected span while the active address stays at the merge origin.
    return { anchor: { row: bottom, col: 0 }, focus: { row: top, col: 0 } };
  }
  const forward = range.anchor.row <= range.focus.row;
  return {
    anchor: { ...range.anchor, row: forward ? top : bottom },
    focus: { ...range.focus, row: forward ? bottom : top },
  };
}
