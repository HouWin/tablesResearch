import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { ListTable } from '@visactor/vtable';
import { COLUMNS } from '../TanStackBudget/core/columns';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';
import { createColumns, type OrganizationBlock } from './grid-model';
import { contentWidth, fitHeaders, MIN_COLUMN_WIDTH } from './column-sizing';

export const adjustFrozenColumns = (table: ListTable, available: number) => {
  let count = available >= 760 ? 4 : available >= 560 ? 2 : 1;
  count = Math.min(count, table.colCount);
  while (
    count > 1 &&
    Array.from({ length: count }, (_, col) => table.getColWidth(col)).reduce(
      (a, b) => a + b,
      0,
    ) >
      available - 180
  )
    count--;
  table.setFrozenColCount(count);
};

/** Cancellable, paged measurement, independent of the Canvas event lifecycle. */
export function useColumnSizing({
  controller,
  latest,
  instance,
  host,
  widths,
  captureBlock,
  loadViewport,
  onLayout,
}: {
  controller: BudgetController;
  latest: MutableRefObject<BudgetController>;
  instance: MutableRefObject<ListTable | undefined>;
  host: RefObject<HTMLDivElement>;
  widths: MutableRefObject<Map<number, number>>;
  captureBlock: (index: number) => OrganizationBlock | undefined;
  loadViewport: () => void;
  onLayout: () => void;
}) {
  const [sizing, setSizing] = useState(false);
  const sizingRequest = useRef<AbortController>();
  const visibleKey = controller.visibleColumns.join(',');
  const autoFitColumns = async (columns: number[]) => {
    const table = instance.current;
    const current = latest.current;
    const manifest = current.data.manifest;
    if (
      !table ||
      !manifest ||
      current.busy ||
      current.data.loading ||
      current.data.error
    )
      return;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    sizingRequest.current?.abort();
    const request = new AbortController();
    sizingRequest.current = request;
    setSizing(true);
    try {
      await document.fonts.ready;
      const next = new Map(columns.map((col) => [col, MIN_COLUMN_WIDTH]));
      const icons = new Map(
        columns.map((col) => {
          const suffix = `/${COLUMNS[col].id}`;
          return [
            col,
            ([...current.comments.keys()].some((key) => key.endsWith(suffix))
              ? 15
              : 0) +
              ([...current.attachments].some(
                ([key, files]) => key.endsWith(suffix) && files.length,
              )
                ? 17
                : 0),
          ];
        }),
      );
      let offset: number | null = 0;
      let revision: number | undefined;
      while (offset !== null) {
        request.signal.throwIfAborted();
        const page = await current.data.gateway.columnSizes(
          manifest.id,
          columns,
          offset,
          request.signal,
        );
        if (revision !== undefined && revision !== page.revision)
          throw new Error('数据已更新，请重新适配列宽。');
        revision = page.revision;
        let sliceStart = performance.now();
        for (const sample of page.samples) {
          next.set(
            sample.col,
            Math.max(
              next.get(sample.col) ?? MIN_COLUMN_WIDTH,
              contentWidth(ctx, sample, icons.get(sample.col)),
            ),
          );
          if (performance.now() - sliceStart > 8) {
            await new Promise(requestAnimationFrame);
            request.signal.throwIfAborted();
            sliceStart = performance.now();
          }
        }
        offset = page.nextOffset;
        // Each response holds at most 200 display samples, never the full dataset.
        await new Promise(requestAnimationFrame);
      }
      request.signal.throwIfAborted();
      if (
        instance.current !== table ||
        latest.current.data.manifest?.id !== manifest.id
      )
        return;
      fitHeaders(
        ctx,
        next,
        current.visibleColumns,
        (col) => table.getColWidth(current.visibleColumns.indexOf(col) + 1),
        current.collapsedColumns,
      );
      const top = table.scrollTop;
      const left = table.scrollLeft;
      for (const [col, width] of next) widths.current.set(col, width);
      // Apply all measured widths in one layout pass. Resizing each column in
      // turn repeatedly rebuilds merged cells and stalls the final paint.
      table.updateColumns(
        createColumns(() => latest.current, widths.current, captureBlock),
        { clearColWidthCache: true, clearRowHeightCache: false },
      );
      adjustFrozenColumns(table, host.current?.clientWidth ?? 0);
      table.scrollTop = top;
      table.scrollLeft = left;
      table.render();
      loadViewport();
      onLayout();
    } catch (error) {
      if (!request.signal.aborted)
        current.notify(
          error instanceof Error ? error.message : '列宽适配失败，请重试。',
          true,
        );
    } finally {
      if (sizingRequest.current === request) {
        sizingRequest.current = undefined;
        setSizing(false);
      }
    }
  };
  useEffect(
    () => () => sizingRequest.current?.abort(),
    [
      controller.data.manifest?.id,
      controller.data.loading,
      controller.busy,
      controller.editing,
      visibleKey,
      controller.comments,
      controller.attachments,
    ],
  );

  return {
    sizing,
    autoFitColumns,
    cancelSizing: () => sizingRequest.current?.abort(),
  };
}
