import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ListTable,
  data,
  type ListTableConstructorOptions,
} from '@visactor/vtable';
import {
  COLUMNS,
  cellAddress,
  columnLabel,
  rawValue,
} from '../TanStackBudget/core/columns';
import {
  bounds,
  toggleExpanded,
  type CellPosition,
  type CellRange,
} from '../TanStackBudget/core/types';
import type {
  BudgetController,
  GridHandle,
} from '../TanStackBudget/core/use-budget-controller';
import {
  createColumns,
  HEADER_ROWS,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
  organizationLabel,
  toBusinessPosition,
  toTableCell,
  type OrganizationBlock,
} from './grid-model';
import { handleGridKey } from './grid-keyboard';
import { GridEditor } from './grid-editor';
import { GridContextMenu } from './grid-context-menu';

type Rect = { left: number; top: number; width: number; height: number };
type Drag = {
  source: CellRange;
  last: CellPosition;
  x: number;
  y: number;
  move: boolean;
};
const sameRange = (a: CellRange, b: CellRange) =>
  a.anchor.row === b.anchor.row &&
  a.anchor.col === b.anchor.col &&
  a.focus.row === b.focus.row &&
  a.focus.col === b.focus.col;

/** Canvas renderer for the shared budget business controller. No full records array is created. */
export const VTableBudgetGrid = forwardRef<
  GridHandle,
  { controller: BudgetController }
>(function VTableBudgetGrid({ controller: c }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ListTable>();
  const projectionId = useRef<string>();
  const latest = useRef(c);
  latest.current = c;
  const widths = useRef(new Map<number, number>());
  const blocks = useRef(new Map<number, OrganizationBlock>());
  const syncing = useRef(false);
  const viewport = useRef({ first: 0, last: 15 });
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [initializationError, setInitializationError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const closeContext = useCallback(() => setContext(null), []);
  const drag = useRef<Drag | null>(null);
  const shiftAnchor = useRef<CellPosition | null>(null);
  const pointerSelecting = useRef(false);
  const visibleKey = c.visibleColumns.join(',');
  const hasManifest = Boolean(c.data.manifest);
  const focus = () => root.current?.focus({ preventScroll: true });

  const captureBlock = (index: number) => {
    const row = latest.current.data.rowAt(index);
    if (row) {
      const {
        blockStart,
        productRowSpan,
        productLabel,
        productDepth,
        productExpanded,
        productIsGroup,
        productId,
        productAncestorIds,
      } = row;
      const block = {
        blockStart,
        productRowSpan,
        productLabel,
        productDepth,
        productExpanded,
        productIsGroup,
        productId,
        productAncestorIds,
      };
      blocks.current.set(blockStart, block);
      return block;
    }
    for (const block of blocks.current.values())
      if (
        index >= block.blockStart &&
        index < block.blockStart + block.productRowSpan
      )
        return block;
    return undefined;
  };
  const loadViewport = useCallback(() => {
    const table = instance.current;
    const current = latest.current;
    const manifest = current.data.manifest;
    if (!table || !manifest || current.data.loading || current.data.error)
      return;
    const visible = table.getBodyVisibleRowRange();
    const first = Math.max(0, visible.rowStart - HEADER_ROWS);
    const last = Math.min(manifest.totalRows - 1, visible.rowEnd - HEADER_ROWS);
    viewport.current = { first, last };
    if (current.data.pageError) return;
    const pageSize = manifest.pageSize;
    const offsets = new Set([
      Math.floor(first / pageSize) * pageSize,
      Math.floor(last / pageSize) * pageSize,
      (Math.floor(last / pageSize) + 1) * pageSize,
    ]);
    offsets.forEach((offset) => {
      if (offset < manifest.totalRows)
        void current.data.ensurePage(offset).catch(() => {});
    });
  }, []);
  const autoFitColumn = (col: number) => {
    const table = instance.current;
    if (!table) return;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = '13px Arial';
    let width = ctx.measureText(columnLabel(col)).width + 44;
    for (
      let row = viewport.current.first;
      row <= viewport.current.last;
      row++
    ) {
      const record = latest.current.data.rowAt(row);
      if (record)
        width = Math.max(
          width,
          ctx.measureText(String(rawValue(record, col))).width +
            (col < 2 ? 80 : 36),
        );
    }
    const next = Math.min(440, Math.max(92, Math.ceil(width)));
    widths.current.set(col, next);
    const tableCol = latest.current.visibleColumns.indexOf(col) + 1;
    if (tableCol > 0) table.setColWidth(tableCol, next);
    table.render();
    setLayoutVersion((value) => value + 1);
  };
  useImperativeHandle(ref, () => ({
    focus,
    scrollToCell: (position) => {
      const table = instance.current;
      if (!table) return;
      const at = toTableCell(position, latest.current.visibleColumns);
      const rect = table.getCellRelativeRect(at.col, at.row);
      const width = host.current?.clientWidth ?? 0;
      const height = host.current?.clientHeight ?? 0;
      // VTable.scrollToCell always aligns to the top-left. Keep already visible cells still.
      if (at.col >= table.frozenColCount) {
        if (rect.left < table.getFrozenColsWidth())
          table.scrollLeft += rect.left - table.getFrozenColsWidth();
        else if (rect.right > width - 12)
          table.scrollLeft += rect.right - width + 12;
      }
      if (rect.top < table.getFrozenRowsHeight())
        table.scrollTop += rect.top - table.getFrozenRowsHeight();
      else if (rect.bottom > height - 12)
        table.scrollTop += rect.bottom - height + 12;
      table.render();
      void latest.current.data.ensurePage(position.row).catch(() => {});
      loadViewport();
      setLayoutVersion((value) => value + 1);
    },
    autoFit: () => latest.current.visibleColumns.forEach(autoFitColumn),
  }));

  useLayoutEffect(() => {
    if (!host.current || !c.data.manifest) return;
    let table: ListTable | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let disposed = false;
    blocks.current.clear();
    const schedule = () => {
      if (frame || disposed) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        loadViewport();
        setLayoutVersion((value) => value + 1);
      });
    };
    const source = new data.CachedDataSource({
      length: c.data.manifest.totalRows,
      // Synchronous cache reads avoid a second unbounded Promise/record cache in VTable.
      // Missing rows are filled exclusively by the deduplicated viewport page loader.
      get: (index: number) => latest.current.data.rowAt(index),
    });
    try {
      const options: ListTableConstructorOptions = {
        columns: createColumns(
          () => latest.current,
          widths.current,
          captureBlock,
        ),
        dataSource: source,
        widthMode: 'standard',
        heightMode: 'standard',
        defaultRowHeight: ROW_HEIGHT,
        defaultHeaderRowHeight: HEADER_HEIGHT,
        frozenColCount: 4,
        frozenRowCount: HEADER_ROWS,
        autoWrapText: false,
        rowSeriesNumber: {
          width: ROW_NUMBER_WIDTH,
          title: '#',
          format: (_col, row) => (row ?? HEADER_ROWS) - HEADER_ROWS + 1,
          style: {
            color: '#8b9daa',
            fontSize: 11,
            textAlign: 'center',
            padding: [0, 4],
            bgColor: '#f7f9fc',
          },
          headerStyle: { bgColor: '#e4eef7' },
        },
        customMergeCell: (col, row) => {
          if (col !== 1 || row < HEADER_ROWS) return;
          const block = captureBlock(row - HEADER_ROWS);
          if (!block || block.productRowSpan <= 1) return;
          return {
            text: organizationLabel(block),
            range: {
              start: { col, row: block.blockStart + HEADER_ROWS },
              end: {
                col,
                row: block.blockStart + block.productRowSpan - 1 + HEADER_ROWS,
              },
            },
            style: {
              bgColor: '#f7fafc',
              color: '#344f62',
              fontWeight: 600,
              textAlign: 'left',
              textBaseline: 'top',
              textStick: 'vertical',
              padding: [10, 12, 0, 12 + block.productDepth * 14],
              cursor: block.productIsGroup ? 'pointer' : 'default',
            },
          };
        },
        select: {
          disableHeaderSelect: true,
          highlightMode: 'cell',
          // Controller navigation handles scrolling. Selecting a huge range must
          // not render both endpoints and restore the viewport on every update.
          makeSelectCellVisible: false,
        },
        keyboardOptions: {
          copySelected: false,
          cutSelected: false,
          pasteValueToCell: false,
          selectAllOnCtrlA: false,
          moveFocusCellOnTab: false,
          moveFocusCellOnEnter: false,
          moveSelectedCellOnArrowKeys: false,
          editCellOnEnter: false,
        },
        eventOptions: {
          preventDefaultContextMenu: true,
          contextmenuReturnAllSelectedCells: false,
        },
        resize: {
          columnResizeMode: 'header',
          rowResizeMode: 'all',
          disableDblclickAutoResizeColWidth: true,
        },
        dragOrder: { dragHeaderMode: 'none' },
        theme: {
          defaultStyle: {
            fontFamily: 'Arial, PingFang SC, Microsoft YaHei, sans-serif',
          },
          bodyStyle: {
            fontSize: 12,
            borderColor: '#e6edf2',
            borderLineWidth: 1,
          },
          headerStyle: {
            fontSize: 12,
            borderColor: '#d9e4ec',
            borderLineWidth: 1,
          },
          selectionStyle: {
            cellBgColor: 'rgba(41,147,158,0.10)',
            cellBorderColor: '#268a94',
            cellBorderLineWidth: 2,
          },
          underlayBackgroundColor: '#fff',
          scrollStyle: {
            visible: 'scrolling',
            width: 10,
            barToSide: true,
            scrollSliderColor: '#b6c7d3',
            scrollRailColor: '#f3f6f9',
          },
          frameStyle: { borderLineWidth: 0 },
        },
      };
      table = new ListTable(host.current, options);
      instance.current = table;
      projectionId.current = c.data.manifest.id;
      setInitializationError('');
      const position = (col: number, row: number) =>
        toBusinessPosition(
          col,
          row,
          latest.current.visibleColumns,
          latest.current.data.manifest?.totalRows ?? 0,
        );
      table.on('selected_cell', (args) => {
        if (
          syncing.current ||
          latest.current.data.loading ||
          latest.current.data.error ||
          latest.current.editing ||
          drag.current
        )
          return;
        const selected = args.ranges.at(-1);
        if (!selected) return;
        const anchor =
          shiftAnchor.current ??
          position(selected.start.col, selected.start.row);
        const end = position(selected.end.col, selected.end.row);
        if (anchor && end) {
          const next = { anchor, focus: end };
          if (!sameRange(next, latest.current.range))
            latest.current.setRange(next);
          void latest.current.data.ensurePage(end.row).catch(() => {});
        }
      });
      table.on('click_cell', ({ col, row, targetIcon }) => {
        if (
          latest.current.busy ||
          latest.current.data.loading ||
          latest.current.data.error ||
          targetIcon
        )
          return;
        const current = latest.current;
        if (row < HEADER_ROWS) {
          if (col === 0)
            current.setRange({
              anchor: { row: 0, col: current.visibleColumns[0] },
              focus: {
                row: current.data.manifest!.totalRows - 1,
                col: current.visibleColumns.at(-1)!,
              },
            });
          else if (row === 1 && current.visibleColumns[col - 1] >= 3)
            current.toggleColumns();
          else
            current.setRange({
              anchor: { row: 0, col: current.visibleColumns[col - 1] },
              focus: {
                row: current.data.manifest!.totalRows - 1,
                col: current.visibleColumns[col - 1],
              },
            });
          focus();
          return;
        }
        if (col === 0) {
          current.setRange({
            anchor: { row: row - HEADER_ROWS, col: current.visibleColumns[0] },
            focus: {
              row: row - HEADER_ROWS,
              col: current.visibleColumns.at(-1)!,
            },
          });
          focus();
          return;
        }
        const point = position(col, row);
        if (!point) return;
        if (current.editing) {
          void current.finishEdit().then((ok) => {
            if (ok) current.select(point);
          });
          return;
        }
        if (point.col === 0) {
          const block = captureBlock(point.row);
          if (block?.productIsGroup)
            current.changeQuery(
              {
                ...current.data.query,
                organizations: toggleExpanded(
                  current.data.query.organizations,
                  block.productId,
                ),
              },
              { viewport: viewport.current, selection: point },
            );
        } else if (point.col === 1) {
          const record = current.data.rowAt(point.row);
          if (record?.regionIsGroup)
            current.changeQuery(
              {
                ...current.data.query,
                subjects: toggleExpanded(
                  current.data.query.subjects,
                  record.regionRootId,
                ),
              },
              { viewport: viewport.current, selection: point },
            );
        }
        focus();
      });
      table.on('dblclick_cell', ({ col, row }) => {
        const point = position(col, row);
        if (point) void latest.current.startEdit(point);
      });
      table.on('icon_click', ({ col, row, name }) => {
        const point = position(col, row);
        if (!point) return;
        latest.current.select(point);
        if (name === 'budget-comment') latest.current.setPanel('comment');
        if (name === 'budget-attachment') latest.current.setPanel('attachment');
      });
      table.on('contextmenu_cell', ({ col, row, event }) => {
        const point = position(col, row);
        if (!point || !event || !('clientX' in event)) return;
        const box = bounds(latest.current.range);
        if (
          point.row < box.top ||
          point.row > box.bottom ||
          point.col < box.left ||
          point.col > box.right
        )
          latest.current.select(point);
        setContext({ x: event.clientX, y: event.clientY });
      });
      table.on('resize_column_end', () => {
        latest.current.visibleColumns.forEach((col, index) =>
          widths.current.set(col, table!.getColWidth(index + 1)),
        );
        schedule();
      });
      table.on('resize_row_end', schedule);
      table.on('scroll', schedule);
      observer = new ResizeObserver(([entry]) => {
        if (!table || disposed) return;
        const frozen =
          entry.contentRect.width >= 760
            ? 4
            : entry.contentRect.width >= 560
            ? 2
            : 1;
        table.setFrozenColCount(frozen);
        table.resize();
        latest.current.gridRef.current?.scrollToCell(
          latest.current.range.focus,
        );
        schedule();
      });
      observer.observe(host.current);
      schedule();
    } catch (error) {
      setInitializationError(
        error instanceof Error ? error.message : '表格初始化失败',
      );
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      table?.release();
      if (instance.current === table) instance.current = undefined;
    };
  }, [hasManifest, attempt, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    const manifest = c.data.manifest;
    if (!table || !manifest || projectionId.current === manifest.id) return;
    const top = c.data.preserveScroll ? table.scrollTop : 0;
    const left = c.data.preserveScroll ? table.scrollLeft : 0;
    blocks.current.clear();
    // A merged organization's first record may be outside the loaded page.
    // Seed its metadata before VTable asks for the merge's offscreen origin.
    captureBlock(c.data.preserveScroll ? viewport.current.first : 0);
    // Swap only the source, on the existing canvas, before the browser paints.
    // The data hook has already loaded the new visible pages at this point.
    syncing.current = true;
    table.dataSource = new data.CachedDataSource({
      length: manifest.totalRows,
      get: (index: number) => latest.current.data.rowAt(index),
    });
    projectionId.current = manifest.id;
    table.scrollTop = top;
    table.scrollLeft = left;
    table.render();
    syncing.current = false;
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [c.data.manifest?.id, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    table.updateColumns(
      createColumns(() => latest.current, widths.current, captureBlock),
    );
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [visibleKey, c.collapsedColumns, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    // Refresh only the viewport; never walk all 101,100 records after an edit or a page response.
    table.renderWithRecreateCells();
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [c.data.version, c.comments, c.attachments, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    if (pointerSelecting.current && !drag.current) return;
    syncing.current = true;
    let start = toTableCell(c.range.anchor, c.visibleColumns);
    let end = toTableCell(c.range.focus, c.visibleColumns);
    if (Math.abs(end.row - start.row) > 200) {
      // VTable 1.26.7 expands merges by walking every selected cell, including
      // unloaded rows. Draw only the visible slice; the controller keeps the
      // complete business range for copy, writes, keyboard and server statistics.
      const visible = table.getBodyVisibleRowRange();
      const top = Math.max(Math.min(start.row, end.row), visible.rowStart);
      const bottom = Math.min(Math.max(start.row, end.row), visible.rowEnd);
      if (top > bottom) {
        table.clearSelected();
        syncing.current = false;
        return;
      }
      start = { col: start.col, row: start.row <= end.row ? top : bottom };
      end = {
        col: end.col,
        row: c.range.anchor.row <= c.range.focus.row ? bottom : top,
      };
    }
    table.selectCells([
      {
        start,
        end,
      },
    ]);
    syncing.current = false;
  }, [c.range, visibleKey, c.data.manifest?.id, layoutVersion]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element).closest('input,button,textarea')) return;
      handleGridKey(
        event,
        latest.current,
        Math.max(
          1,
          Math.floor(
            (element.clientHeight - HEADER_ROWS * HEADER_HEIGHT) / ROW_HEIGHT,
          ),
        ),
      );
    };
    element.addEventListener('keydown', key, true);
    const wheel = (event: WheelEvent) => {
      if (!latest.current.editing) return;
      // Commit before scrolling an editor offscreen. Invalid input remains focused.
      event.preventDefault();
      event.stopPropagation();
      root.current?.querySelector<HTMLInputElement>('.vt-editor')?.blur();
    };
    element.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => {
      element.removeEventListener('keydown', key, true);
      element.removeEventListener('wheel', wheel, true);
    };
  }, []);

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
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', cancel);
    return () => {
      cancel();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', cancel);
    };
  }, [loadViewport]);

  const cellRect = (point: CellPosition): Rect | null => {
    const table = instance.current;
    if (!table) return null;
    const at = toTableCell(point, c.visibleColumns);
    if (at.col < 1) return null;
    const rect = table.getCellRelativeRect(at.col, at.row);
    if (
      rect.bottom <= HEADER_ROWS * HEADER_HEIGHT ||
      rect.top >= (host.current?.clientHeight ?? 0)
    )
      return null;
    if (
      at.col >= table.frozenColCount &&
      rect.right <= table.getFrozenColsWidth()
    )
      return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };
  const editorRect = c.editing ? cellRect(c.editing.position) : null;
  const editorOffscreen = Boolean(c.editing && !editorRect);
  useLayoutEffect(() => {
    if (editorOffscreen && c.editing)
      c.gridRef.current?.scrollToCell(c.editing.position);
  }, [editorOffscreen, c.editing?.position, layoutVersion]);
  const selection = bounds(c.range);
  const fillRect = cellRect({ row: selection.bottom, col: selection.right });
  return (
    <div
      className="tb-grid-wrap vt-grid-wrap"
      data-layout-version={layoutVersion}
    >
      {c.data.pageError ? (
        <div className="tb-inline-error" role="alert">
          {c.data.pageError}
          <button
            onClick={() => {
              c.data.retryPages();
              requestAnimationFrame(loadViewport);
            }}
          >
            重试当前页
          </button>
        </div>
      ) : null}
      <div
        ref={root}
        className="vt-grid"
        role="grid"
        tabIndex={0}
        aria-label="费用预算表"
        aria-rowcount={(c.data.manifest?.totalRows ?? 0) + HEADER_ROWS}
        aria-colcount={COLUMNS.length}
        aria-multiselectable="true"
        aria-busy={c.busy || c.data.loading}
        aria-activedescendant="vtable-active-cell"
        aria-describedby="vtable-grid-help"
        onPaste={(event) => {
          if (!c.editing && !c.busy && !c.data.loading && !c.data.error) {
            event.preventDefault();
            event.stopPropagation();
            void c.paste(event.clipboardData.getData('text/plain'));
          }
        }}
        onCompositionEnd={(event) => {
          if (!c.editing && event.data)
            void c.startEdit(c.range.focus, event.data);
        }}
        onDoubleClickCapture={(event) => {
          const table = instance.current;
          const rect = host.current?.getBoundingClientRect();
          if (
            !table ||
            !rect ||
            event.clientY - rect.top > HEADER_ROWS * HEADER_HEIGHT
          )
            return;
          const x = event.clientX - rect.left;
          for (let col = 1; col < table.colCount; col++) {
            const cell = table.getCellRelativeRect(col, HEADER_ROWS - 1);
            if (Math.abs(x - cell.right) <= 6) {
              event.preventDefault();
              event.stopPropagation();
              autoFitColumn(c.visibleColumns[col - 1]);
              return;
            }
          }
        }}
        onPointerDownCapture={(event) => {
          pointerSelecting.current =
            event.button === 0 &&
            Boolean((event.target as Element).closest('.vt-host'));
          if ((event.target as Element).closest('.vt-host'))
            shiftAnchor.current =
              event.button === 0 && event.shiftKey ? c.range.anchor : null;
          if (!event.altKey || event.button !== 0 || c.busy || c.editing)
            return;
          const table = instance.current;
          const rect = host.current?.getBoundingClientRect();
          if (!table || !rect) return;
          const hit = table.getCellAtRelativePosition(
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
          const point = toBusinessPosition(
            hit.col,
            hit.row,
            c.visibleColumns,
            c.data.manifest?.totalRows ?? 0,
          );
          if (
            !point ||
            point.row < selection.top ||
            point.row > selection.bottom ||
            point.col < selection.left ||
            point.col > selection.right
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          drag.current = {
            source: c.range,
            last: point,
            x: event.clientX,
            y: event.clientY,
            move: true,
          };
        }}
      >
        <div ref={host} className="vt-host" aria-hidden="true" />
        <span id="vtable-grid-help" className="vt-sr-only">
          方向键移动，Shift 扩选，Enter 或 F2 编辑，Ctrl 或 Command 加 F
          搜索。组织与科目展开按钮位于单元格中，也可使用上方层级控制。
        </span>
        <span className="vt-sr-only" role="row">
          <span
            id="vtable-active-cell"
            role="gridcell"
            aria-rowindex={c.range.focus.row + HEADER_ROWS + 1}
            aria-colindex={c.range.focus.col + 1}
            aria-readonly={!COLUMNS[c.range.focus.col].editable}
          >
            {c.selectedAddress} {columnLabel(c.range.focus.col)}{' '}
            {c.selectedRow
              ? String(rawValue(c.selectedRow, c.range.focus.col))
              : '加载中'}
          </span>
        </span>
        {c.editing && editorRect ? (
          <GridEditor
            key={cellAddress(c.editing.position.row, c.editing.position.col)}
            controller={c}
            style={editorRect}
          />
        ) : null}
        {!c.editing &&
        !c.busy &&
        fillRect &&
        COLUMNS[selection.right]?.editable ? (
          <button
            className="vt-fill-handle"
            aria-label="拖拽填充选区"
            title="拖动填充；Alt + 拖动选区移动数据"
            style={{
              left: fillRect.left + fillRect.width - 5,
              top: fillRect.top + fillRect.height - 5,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              drag.current = {
                source: c.range,
                last: { row: selection.bottom, col: selection.right },
                x: event.clientX,
                y: event.clientY,
                move: false,
              };
            }}
          />
        ) : null}
      </div>
      {initializationError ? (
        <div className="vt-initialization-error" role="alert">
          <p>表格初始化失败：{initializationError}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            重新初始化
          </button>
        </div>
      ) : null}
      {context ? (
        <GridContextMenu
          controller={c}
          position={context}
          close={closeContext}
        />
      ) : null}
    </div>
  );
});
