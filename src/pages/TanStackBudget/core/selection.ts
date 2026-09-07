import { COLUMNS } from './columns';
import type { CellRange } from './types';

export function visibleBudgetColumns(
  hidden: ReadonlySet<number>,
  collapsed: boolean,
) {
  return COLUMNS.map((_, index) => index).filter(
    (col) => !hidden.has(col) && !(collapsed && col > 3),
  );
}

/** Keep both endpoints addressable after hiding columns, including reverse selections. */
export function visibleRange(
  range: CellRange,
  visible: readonly number[],
): CellRange {
  const column = (col: number) =>
    visible.includes(col)
      ? col
      : [...visible].reverse().find((value) => value < col) ?? visible[0];
  return {
    anchor: { ...range.anchor, col: column(range.anchor.col) },
    focus: { ...range.focus, col: column(range.focus.col) },
  };
}
