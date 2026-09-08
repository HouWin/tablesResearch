import {
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent,
} from 'react';
import type { ListTable } from '@visactor/vtable';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';

export const MIN_ROW_HEIGHT = 24;
export const MAX_ROW_HEIGHT = 320;

/** Row heights are adjusted only through gutter handles, never through merged content. */
export function useRowResize({
  instance,
  controller,
  onLayout,
}: {
  instance: MutableRefObject<ListTable | undefined>;
  controller: BudgetController;
  onLayout: () => void;
}) {
  const latest = useRef({ controller, onLayout });
  latest.current = { controller, onLayout };
  const gesture = useRef<{
    table: ListTable;
    projectionId: string;
    row: number;
    y: number;
    height: number;
    pointerId: number;
  }>();
  const blocked =
    controller.busy ||
    controller.data.loading ||
    Boolean(controller.data.error) ||
    Boolean(controller.editing);
  const resize = (row: number, height: number) => {
    const table = instance.current;
    if (!table || blocked) return;
    table.setRowHeight(
      row,
      Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(height))),
    );
    table.render();
    latest.current.onLayout();
  };
  useEffect(() => {
    const apply = (height: number) => {
      const state = gesture.current;
      if (
        !state ||
        instance.current !== state.table ||
        latest.current.controller.data.manifest?.id !== state.projectionId
      )
        return;
      state.table.setRowHeight(
        state.row,
        Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(height))),
      );
      state.table.render();
      latest.current.onLayout();
    };
    const move = (event: globalThis.PointerEvent) => {
      const state = gesture.current;
      if (state && state.pointerId === event.pointerId)
        apply(state.height + event.clientY - state.y);
    };
    const end = () => {
      gesture.current = undefined;
    };
    const cancel = () => {
      if (gesture.current) apply(gesture.current.height);
      end();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key, true);
    return () => {
      end();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key, true);
    };
  }, [instance, controller.data.manifest?.id, blocked]);
  return {
    blocked,
    resize,
    start: (event: PointerEvent<HTMLDivElement>, row: number) => {
      event.preventDefault();
      event.stopPropagation();
      const table = instance.current;
      const projectionId = controller.data.manifest?.id;
      if (!table || !projectionId || blocked || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        table,
        projectionId,
        row,
        y: event.clientY,
        height: table.getRowHeight(row),
        pointerId: event.pointerId,
      };
    },
  };
}
