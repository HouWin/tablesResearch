import { bounds } from '../TanStackBudget/core/types';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';

export function moveFocus(
  c: BudgetController,
  rowDelta: number,
  columnDelta: number,
  extend = false,
) {
  const visible = c.visibleColumns;
  let row = c.range.focus.row + rowDelta;
  let column = Math.max(0, visible.indexOf(c.range.focus.col)) + columnDelta;
  if (column >= visible.length) {
    column = 0;
    row += 1;
  }
  if (column < 0) {
    column = visible.length - 1;
    row -= 1;
  }
  c.select(
    {
      row: Math.max(0, Math.min((c.data.manifest?.totalRows ?? 1) - 1, row)),
      col: visible[column],
    },
    extend,
    true,
  );
}

/** Keyboard commands use the same transactions as toolbar and pointer operations. */
export function handleGridKey(
  event: KeyboardEvent,
  c: BudgetController,
  pageRows: number,
) {
  if (
    event.isComposing ||
    c.busy ||
    c.editing ||
    c.data.loading ||
    c.data.error
  )
    return;
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  const box = bounds(c.range);
  const stop = () => {
    event.preventDefault();
    event.stopPropagation();
  };
  if (command) {
    if (['c', 'x', 'z', 'y', 'a', 'd', 'r', 'home', 'end'].includes(key))
      stop();
    if (key === 'c') void c.copy();
    else if (key === 'x') void c.copy(true);
    else if (key === 'z') void c.replay(event.shiftKey ? 'redo' : 'undo');
    else if (key === 'y') void c.replay('redo');
    else if (key === 'a')
      c.setRange({
        anchor: { row: 0, col: c.visibleColumns[0] },
        focus: {
          row: (c.data.manifest?.totalRows ?? 1) - 1,
          col: c.visibleColumns.at(-1)!,
        },
      });
    else if (key === 'd')
      void c.fill(
        {
          anchor: { row: box.top, col: box.left },
          focus: { row: box.top, col: box.right },
        },
        c.range,
      );
    else if (key === 'r')
      void c.fill(
        {
          anchor: { row: box.top, col: box.left },
          focus: { row: box.bottom, col: box.left },
        },
        c.range,
      );
    else if (key === 'home' || key === 'end')
      c.select(
        {
          row: key === 'home' ? 0 : (c.data.manifest?.totalRows ?? 1) - 1,
          col: key === 'home' ? c.visibleColumns[0] : c.visibleColumns.at(-1)!,
        },
        event.shiftKey,
        true,
      );
    return;
  }
  if (
    [
      'ArrowDown',
      'ArrowUp',
      'ArrowLeft',
      'ArrowRight',
      'Tab',
      'Enter',
      'F2',
      'Delete',
      'Backspace',
      'PageDown',
      'PageUp',
      'Home',
      'End',
      'Escape',
    ].includes(event.key)
  )
    stop();
  switch (event.key) {
    case 'ArrowDown':
      moveFocus(c, 1, 0, event.shiftKey);
      break;
    case 'ArrowUp':
      moveFocus(c, -1, 0, event.shiftKey);
      break;
    case 'ArrowLeft':
      moveFocus(c, 0, -1, event.shiftKey);
      break;
    case 'ArrowRight':
      moveFocus(c, 0, 1, event.shiftKey);
      break;
    case 'Tab':
      moveFocus(c, 0, event.shiftKey ? -1 : 1);
      break;
    case 'PageDown':
      moveFocus(c, pageRows, 0, event.shiftKey);
      break;
    case 'PageUp':
      moveFocus(c, -pageRows, 0, event.shiftKey);
      break;
    case 'Home':
      c.select(
        { row: c.range.focus.row, col: c.visibleColumns[0] },
        event.shiftKey,
        true,
      );
      break;
    case 'End':
      c.select(
        { row: c.range.focus.row, col: c.visibleColumns.at(-1)! },
        event.shiftKey,
        true,
      );
      break;
    case 'Enter':
    case 'F2':
      void c.startEdit(c.range.focus);
      break;
    case 'Delete':
    case 'Backspace':
      void c.clear();
      break;
    case 'Escape':
      c.select(c.range.focus);
      break;
    default:
      if (event.key.length === 1 && !event.altKey) {
        stop();
        void c.startEdit(c.range.focus, event.key);
      }
  }
}
