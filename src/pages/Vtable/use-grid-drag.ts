import {
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { ListTable } from '@visactor/vtable';
import {
  bounds,
  type CellRange,
  type CellPosition,
} from '../TanStackBudget/core/types';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';
import {
  HEADER_ROWS,
  HEADER_HEIGHT,
  ROW_NUMBER_WIDTH,
  toBusinessPosition,
} from './grid-model';

type Drag = {
  source: CellRange;
  last: CellPosition;
  x: number;
  y: number;
  move: boolean;
};

/** Owns fill/move gestures, edge scrolling and cancellation. */
export function useGridDrag({
  instance,
  host,
  latest,
  pointerSelecting,
  loadViewport,
}: {
  instance: MutableRefObject<ListTable | undefined>;
  host: RefObject<HTMLDivElement>;
  latest: MutableRefObject<BudgetController>;
  pointerSelecting: MutableRefObject<boolean>;
  loadViewport: () => void;
}) {
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const state = drag.current;
      const table = instance.current;
      const rect = host.current?.getBoundingClientRect();
      if (!state || !table || !rect) return;
      if (state.y > rect.bottom - 24) table.scrollTop += 20;
      if (state.y < rect.top + HEADER_ROWS * HEADER_HEIGHT + 20)
        table.scrollTop -= 20;
      if (state.x > rect.right - 24) table.scrollLeft += 20;
      if (state.x < rect.left + ROW_NUMBER_WIDTH + 12) table.scrollLeft -= 20;
      const hit = table.getCellAtRelativePosition(
        Math.max(
          ROW_NUMBER_WIDTH + 2,
          Math.min(rect.width - 12, state.x - rect.left),
        ),
        Math.max(
          HEADER_ROWS * HEADER_HEIGHT + 2,
          Math.min(rect.height - 12, state.y - rect.top),
        ),
      );
      const point = toBusinessPosition(
        hit.col,
        hit.row,
        latest.current.visibleColumns,
        latest.current.data.manifest?.totalRows ?? 0,
      );
      if (
        point &&
        (point.row !== state.last.row || point.col !== state.last.col)
      ) {
        state.last = point;
        if (!state.move)
          latest.current.setRange({
            anchor: state.source.anchor,
            focus: point,
          });
      }
      loadViewport();
      frame = requestAnimationFrame(update);
    };
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const stop = () => {
      pointerSelecting.current = false;
      cancelAnimationFrame(frame);
      frame = 0;
      const state = drag.current;
      drag.current = null;
      if (!state) return;
      const current = latest.current;
      const box = bounds(state.source);
      if (!state.move)
        void current.fill(state.source, {
          anchor: { row: box.top, col: box.left },
          focus: state.last,
        });
      else {
        const width = current.visibleColumns.filter(
          (col) => col >= box.left && col <= box.right,
        ).length;
        const col =
          current.visibleColumns[
            current.visibleColumns.indexOf(state.last.col) + width - 1
          ];
        const row = state.last.row + box.bottom - box.top;
        if (col === undefined || row >= (current.data.manifest?.totalRows ?? 0))
          current.notify('移动位置超出表格范围。', true);
        else
          void current.fill(
            state.source,
            { anchor: state.last, focus: { row, col } },
            true,
          );
      }
    };
    const cancel = () => {
      pointerSelecting.current = false;
      cancelAnimationFrame(frame);
      frame = 0;
      if (drag.current) latest.current.setRange(drag.current.source);
      drag.current = null;
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key, true);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', cancel);
    return () => {
      cancel();
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', cancel);
    };
  }, [loadViewport]);

  return drag;
}
