import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import type { BusinessColumnNode } from '../../SpreadJSDemo/spreadsheet/model';
import {
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  COLUMN_HEADER_CELLS,
  cellAddress,
  cellKey,
  columnLabel,
  formattedValue,
  rawValue,
} from '../core/columns';
import {
  bounds,
  toggleExpanded,
  type BudgetRow,
  type CellPosition,
  type CellRange,
} from '../core/types';
import type {
  BudgetController,
  GridHandle,
} from '../core/use-budget-controller';

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  columnPinningFeature,
});
type Slot = { index: number; data?: BudgetRow };
function adaptColumns(
  nodes: readonly BusinessColumnNode[],
): ColumnDef<typeof features, Slot>[] {
  return nodes.map((node) =>
    node.type === 'colDim'
      ? {
          id: node.id,
          header: node.label,
          columns: adaptColumns(node.children),
        }
      : {
          id: node.id,
          header: node.label,
          size: node.width,
          minSize: 76,
          maxSize: 520,
          accessorFn: (slot: Slot) =>
            slot.data
              ? rawValue(
                  slot.data,
                  COLUMNS.findIndex((col) => col.id === node.id),
                )
              : '',
        },
  );
}
const columnDefinitions = adaptColumns(BUSINESS_COLUMN_DATA);
const HEADER_ROW_HEIGHT = 28;
const HEADER_HEIGHT = 4 * HEADER_ROW_HEIGHT;
const ROW_NUMBER_WIDTH = 48;
type Drag = {
  kind: 'selection' | 'fill' | 'move';
  source: CellRange;
  last: CellPosition;
  x: number;
  y: number;
};

export const BudgetGrid = forwardRef<
  GridHandle,
  { controller: BudgetController }
>(function BudgetGrid({ controller: c }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(c);
  latest.current = c;
  const rowSizes = useRef(new Map<number, number>());
  const [sizing, setSizing] = useState<ColumnSizingState>({});
  const [rowSizeVersion, setRowSizeVersion] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const cleanupResize = useRef<() => void>();
  const cancelBlur = useRef(false);
  const composing = useRef(false);
  const virtualizer = useVirtualizer({
    count: c.data.manifest?.totalRows ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rowSizes.current.get(index) ?? 32,
    overscan: 8,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    getItemKey: (index) => `${c.data.manifest?.id}:${index}`,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const virtualKey = virtualRows
    .map((item) => `${item.index}:${item.size}`)
    .join(',');
  const slots = useMemo(
    () =>
      virtualRows.map((item) => ({
        index: item.index,
        data: c.data.rowAt(item.index),
      })),
    [virtualKey, c.data.version, c.data.manifest?.id],
  );
  const visibility = useMemo(
    () =>
      Object.fromEntries(
        COLUMNS.map((col, index) => [col.id, c.visibleColumns.includes(index)]),
      ),
    [c.visibleColumns.join(',')],
  );
  const table = useTable({
    features,
    columns: columnDefinitions,
    data: slots,
    getRowId: (slot) => String(slot.index),
    state: {
      columnSizing: sizing,
      columnVisibility: visibility,
      columnPinning: {
        start: COLUMNS.slice(0, 3).map((col) => col.id),
        end: [],
      },
    },
    onColumnSizingChange: setSizing,
    columnResizeMode: 'onChange',
  });
  const leaves = table.getVisibleLeafColumns();
  const offsets = new Map<number, number>();
  let totalWidth = ROW_NUMBER_WIDTH;
  leaves.forEach((column) => {
    offsets.set(
      COLUMNS.findIndex((col) => col.id === column.id),
      totalWidth,
    );
    totalWidth += column.getSize();
  });
  const frozenCount = viewportWidth >= 760 ? 3 : viewportWidth >= 560 ? 1 : 0;
  const frozenWidth =
    ROW_NUMBER_WIDTH +
    COLUMNS.slice(0, frozenCount).reduce(
      (width, column) => width + table.getColumn(column.id)!.getSize(),
      0,
    );
  const selection = bounds(c.range);
  const first = virtualRows[0]?.index ?? 0;
  const last = virtualRows.at(-1)?.index ?? 0;
  const firstOnScreen =
    virtualRows.find(
      (item) => item.end > (virtualizer.scrollOffset ?? 0) + HEADER_HEIGHT,
    )?.index ?? first;
  const activeCellRow =
    c.range.focus.col === 0 && c.selectedRow
      ? Math.max(firstOnScreen, c.selectedRow.blockStart)
      : c.range.focus.row;
  const activeCellExists = slots.some(
    (slot) =>
      slot.index === activeCellRow &&
      (c.range.focus.col !== 0 ||
        slot.data?.productId === c.selectedRow?.productId),
  );
  const headerByColumn = new Map(
    table
      .getHeaderGroups()
      .flatMap((group) => group.headers)
      .filter((header) => !header.column.columns.length)
      .map((header) => [header.column.id, header]),
  );

  useEffect(() => {
    rowSizes.current.clear();
    virtualizer.measure();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [c.data.manifest?.id]);
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(entry.contentRect.width),
    );
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const manifest = c.data.manifest;
    if (!manifest) return;
    c.data.loadViewport(first, last);
  }, [first, last, c.data.manifest?.id, c.data.version, c.data.pageError]);
  useEffect(() => {
    if (c.editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [c.editing?.position.row, c.editing?.position.col]);
  useEffect(() => {
    if (!context) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.tb-context-menu'))
        setContext(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContext(null);
        scrollRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [context]);
  useEffect(() => () => cleanupResize.current?.(), []);

  const scrollToCell = useCallback(
    (position: CellPosition) => {
      virtualizer.scrollToIndex(position.row, { align: 'auto' });
      const viewport = scrollRef.current;
      const left = offsets.get(position.col);
      if (!viewport || left === undefined || position.col < frozenCount) return;
      const width = table.getColumn(COLUMNS[position.col].id)!.getSize();
      if (left < viewport.scrollLeft + frozenWidth)
        viewport.scrollLeft = left - frozenWidth;
      else if (left + width > viewport.scrollLeft + viewport.clientWidth)
        viewport.scrollLeft = left + width - viewport.clientWidth;
    },
    [virtualizer, sizing, c.visibleColumns.join(','), frozenWidth],
  );
  const autoFitColumn = (col: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '13px Arial';
    let width = ctx.measureText(columnLabel(col)).width + 44;
    slots.forEach((slot) => {
      if (slot.data)
        width = Math.max(
          width,
          ctx.measureText(
            formattedValue(rawValue(slot.data, col), COLUMNS[col]),
          ).width + (col < 2 ? 56 : 30),
        );
    });
    setSizing((current) => ({
      ...current,
      [COLUMNS[col].id]: Math.min(440, Math.max(92, Math.ceil(width))),
    }));
  };
  useImperativeHandle(ref, () => ({
    scrollToCell,
    focus: () => scrollRef.current?.focus({ preventScroll: true }),
    autoFit: () => COLUMNS.forEach((_, col) => autoFitColumn(col)),
  }));

  const moveFocus = (rowDelta: number, columnDelta: number, extend = false) => {
    const current = latest.current;
    const visible = current.visibleColumns;
    const colIndex = Math.max(0, visible.indexOf(current.range.focus.col));
    let row = current.range.focus.row + rowDelta;
    let column = colIndex + columnDelta;
    if (column >= visible.length) {
      column = 0;
      row += 1;
    } else if (column < 0) {
      column = visible.length - 1;
      row -= 1;
    }
    row = Math.max(
      0,
      Math.min((current.data.manifest?.totalRows ?? 1) - 1, row),
    );
    current.select({ row, col: visible[column] }, extend, true);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      (event.target as Element).closest('input,textarea,select,button') ||
      composing.current ||
      event.nativeEvent.isComposing
    )
      return;
    if (c.busy || c.data.loading) return;
    const command = event.ctrlKey || event.metaKey;
    if (command) {
      const key = event.key.toLowerCase();
      if (['c', 'x', 'z', 'y', 'a', 'd', 'r'].includes(key))
        event.preventDefault();
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
            anchor: { row: selection.top, col: selection.left },
            focus: { row: selection.top, col: selection.right },
          },
          c.range,
        );
      else if (key === 'r')
        void c.fill(
          {
            anchor: { row: selection.top, col: selection.left },
            focus: { row: selection.bottom, col: selection.left },
          },
          c.range,
        );
      else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        c.select(
          {
            row:
              event.key === 'Home' ? 0 : (c.data.manifest?.totalRows ?? 1) - 1,
            col:
              event.key === 'Home'
                ? c.visibleColumns[0]
                : c.visibleColumns.at(-1)!,
          },
          event.shiftKey,
          true,
        );
      }
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
      ].includes(event.key)
    )
      event.preventDefault();
    switch (event.key) {
      case 'ArrowDown':
        moveFocus(1, 0, event.shiftKey);
        break;
      case 'ArrowUp':
        moveFocus(-1, 0, event.shiftKey);
        break;
      case 'ArrowRight':
        moveFocus(0, 1, event.shiftKey);
        break;
      case 'ArrowLeft':
        moveFocus(0, -1, event.shiftKey);
        break;
      case 'Tab':
        moveFocus(0, event.shiftKey ? -1 : 1);
        break;
      case 'PageDown':
        moveFocus(
          Math.max(
            1,
            Math.floor(
              ((scrollRef.current?.clientHeight ?? 400) - HEADER_HEIGHT) / 32,
            ),
          ),
          0,
          event.shiftKey,
        );
        break;
      case 'PageUp':
        moveFocus(
          -Math.max(
            1,
            Math.floor(
              ((scrollRef.current?.clientHeight ?? 400) - HEADER_HEIGHT) / 32,
            ),
          ),
          0,
          event.shiftKey,
        );
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
        setContext(null);
        c.select(c.range.focus);
        break;
      default:
        if (event.key.length === 1 && !event.altKey) {
          event.preventDefault();
          void c.startEdit(c.range.focus, event.key);
        }
    }
  };
  useEffect(() => {
    let frame = 0;
    const locatePointer = (x: number, y: number) => {
      const element = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-row][data-col]');
      if (!element) return null;
      return {
        row: Number(element.dataset.row),
        col: Number(element.dataset.col),
      };
    };
    const update = () => {
      const state = drag.current;
      const viewport = scrollRef.current;
      if (!state || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      if (state.y > rect.bottom - 30) viewport.scrollTop += 16;
      if (state.y < rect.top + HEADER_HEIGHT + 20) viewport.scrollTop -= 16;
      if (state.x > rect.right - 30) viewport.scrollLeft += 16;
      if (state.x < rect.left + 30) viewport.scrollLeft -= 16;
      const position = locatePointer(
        Math.min(rect.right - 10, Math.max(rect.left + 55, state.x)),
        Math.min(
          rect.bottom - 10,
          Math.max(rect.top + HEADER_HEIGHT + 5, state.y),
        ),
      );
      if (
        position &&
        (position.row !== state.last.row || position.col !== state.last.col)
      ) {
        state.last = position;
        if (state.kind !== 'move')
          latest.current.setRange({
            anchor: state.source.anchor,
            focus: position,
          });
      }
      frame = requestAnimationFrame(update);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag.current) return;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const pointerUp = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      const state = drag.current;
      drag.current = null;
      if (!state || state.kind === 'selection') return;
      const box = bounds(state.source);
      if (state.kind === 'fill')
        void latest.current.fill(state.source, {
          anchor: { row: box.top, col: box.left },
          focus: state.last,
        });
      else {
        const current = latest.current;
        const width = current.visibleColumns.filter(
          (col) => col >= box.left && col <= box.right,
        ).length;
        const columnOffset = current.visibleColumns.indexOf(state.last.col);
        const target = {
          anchor: state.last,
          focus: {
            row: state.last.row + box.bottom - box.top,
            col:
              current.visibleColumns[columnOffset + width - 1] ??
              COLUMNS.length,
          },
        };
        if (
          target.focus.row >= (current.data.manifest?.totalRows ?? 0) ||
          target.focus.col >= COLUMNS.length
        )
          current.notify('移动位置超出表格范围。', true);
        else void current.fill(state.source, target, true);
      }
    };
    const pointerCancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (drag.current) latest.current.setRange(drag.current.source);
      drag.current = null;
    };
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', pointerCancel);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
    };
  }, []);
  const startResizeRow = (event: React.PointerEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupResize.current?.();
    const startY = event.clientY;
    const initial = rowSizes.current.get(index) ?? 32;
    const move = (next: PointerEvent) => {
      const size = Math.max(26, Math.min(150, initial + next.clientY - startY));
      rowSizes.current.set(index, size);
      virtualizer.resizeItem(index, size);
      setRowSizeVersion((value) => value + 1);
    };
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    cleanupResize.current = stop;
  };
  const headerCells = COLUMN_HEADER_CELLS.map((cell) => {
    const cols = c.visibleColumns.filter(
      (col) => col >= cell.startCol && col < cell.startCol + cell.colCount,
    );
    if (!cols.length) return null;
    const width = cols.reduce(
      (sum, col) => sum + table.getColumn(COLUMNS[col].id)!.getSize(),
      0,
    );
    const frozen = cell.startCol < frozenCount;
    const style: CSSProperties = {
      left: offsets.get(cols[0]),
      top: cell.row * HEADER_ROW_HEIGHT,
      width,
      height: cell.rowCount * HEADER_ROW_HEIGHT,
    };
    const leaf = cell.kind === 'column' ? headerByColumn.get(cell.id) : null;
    return (
      <div
        role="columnheader"
        aria-colindex={cell.startCol + 1}
        aria-colspan={cols.length}
        aria-rowspan={cell.rowCount}
        key={cell.id}
        className={`tb-header-cell ${frozen ? 'is-frozen' : ''} ${
          cell.kind === 'group' ? 'is-group' : ''
        } ${cell.row < 2 && cell.kind === 'group' ? 'is-top-group' : ''}`}
        style={style}
      >
        {cell.id === 'budget-year-2025' ? (
          <button
            type="button"
            aria-label={
              c.collapsedColumns ? '展开年度月份列' : '收起年度月份列'
            }
            aria-expanded={!c.collapsedColumns}
            title={c.collapsedColumns ? '向右展开月份' : '向左收起月份'}
            onClick={c.toggleColumns}
            disabled={c.busy}
          >
            {c.collapsedColumns ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronLeft size={13} />
            )}
            {cell.label}
          </button>
        ) : (
          cell.label
        )}
        {leaf ? (
          <div
            role="separator"
            tabIndex={0}
            aria-label={`调整${columnLabel(cell.startCol)}列宽`}
            aria-orientation="vertical"
            aria-valuenow={Math.round(width)}
            className="tb-column-resizer"
            onMouseDown={leaf.getResizeHandler()}
            onTouchStart={leaf.getResizeHandler()}
            onDoubleClick={() => autoFitColumn(cell.startCol)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setSizing((current) => ({
                  ...current,
                  [cell.id]: Math.max(
                    76,
                    width + (event.key === 'ArrowRight' ? 10 : -10),
                  ),
                }));
              }
            }}
          />
        ) : null}
      </div>
    );
  });

  return (
    <div className="tb-grid-wrap">
      {c.data.pageError ? (
        <div className="tb-inline-error" role="alert">
          {c.data.pageError}
          <button onClick={c.data.retryPages}>重试当前页</button>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="tb-grid-scroll"
        role="grid"
        tabIndex={0}
        aria-label="费用预算表"
        aria-rowcount={(c.data.manifest?.totalRows ?? 0) + 4}
        aria-colcount={COLUMNS.length}
        aria-multiselectable="true"
        aria-activedescendant={
          activeCellExists
            ? `budget-cell-${activeCellRow}-${c.range.focus.col}`
            : undefined
        }
        onKeyDown={keyDown}
        onPaste={(event) => {
          if (c.editing || c.busy) return;
          event.preventDefault();
          void c.paste(event.clipboardData.getData('text/plain'));
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          if (!c.editing && event.data)
            void c.startEdit(c.range.focus, event.data);
        }}
      >
        <div
          className="tb-grid-header"
          style={{ width: totalWidth, height: HEADER_HEIGHT }}
          role="rowgroup"
        >
          <div className="tb-header-scrolling">
            {headerCells.filter(
              (cell) => cell && !cell.props.className.includes('is-frozen'),
            )}
          </div>
          <div
            className="tb-header-frozen"
            style={{ width: frozenWidth, height: HEADER_HEIGHT }}
          >
            {headerCells.filter(
              (cell) => cell && cell.props.className.includes('is-frozen'),
            )}
            <button
              className="tb-corner"
              aria-label="选择全部单元格"
              onClick={() =>
                c.setRange({
                  anchor: { row: 0, col: 0 },
                  focus: {
                    row: (c.data.manifest?.totalRows ?? 1) - 1,
                    col: c.visibleColumns.at(-1)!,
                  },
                })
              }
              style={{ width: ROW_NUMBER_WIDTH, height: HEADER_HEIGHT }}
            >
              #
            </button>
          </div>
        </div>
        <div
          className="tb-grid-body"
          role="rowgroup"
          style={{ height: virtualizer.getTotalSize(), width: totalWidth }}
          data-row-size-version={rowSizeVersion}
        >
          {table.getRowModel().rows.map((tableRow, slotIndex) => {
            const slot = tableRow.original;
            const row = slot.data;
            const item = virtualRows[slotIndex];
            if (!item) return null;
            return (
              <div
                className={`tb-grid-row ${
                  row?.regionDepth === 0 ? 'is-summary' : ''
                }`}
                role="row"
                key={tableRow.id}
                aria-rowindex={slot.index + 5}
                style={{
                  height: item.size,
                  width: totalWidth,
                  transform: `translateY(${item.start - HEADER_HEIGHT}px)`,
                }}
              >
                <div
                  className="tb-row-number"
                  style={{ width: ROW_NUMBER_WIDTH }}
                  role="rowheader"
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      event.preventDefault();
                      c.setRange({
                        anchor: { row: slot.index, col: c.visibleColumns[0] },
                        focus: {
                          row: slot.index,
                          col: c.visibleColumns.at(-1)!,
                        },
                      });
                      scrollRef.current?.focus();
                    }
                  }}
                >
                  {slot.index + 1}
                  <span
                    className="tb-row-resizer"
                    role="separator"
                    aria-label={`调整第${slot.index + 1}行高度`}
                    aria-orientation="horizontal"
                    onPointerDown={(event) => startResizeRow(event, slot.index)}
                  />
                </div>
                {tableRow.getVisibleCells().map((cell) => {
                  const col = COLUMNS.findIndex(
                    (column) => column.id === cell.column.id,
                  );
                  const active =
                    activeCellRow === slot.index &&
                    c.range.focus.col === col &&
                    activeCellExists;
                  const isSelected =
                    slot.index >= selection.top &&
                    slot.index <= selection.bottom &&
                    col >= selection.left &&
                    col <= selection.right;
                  const edit =
                    c.editing?.position.row === slot.index &&
                    c.editing.position.col === col;
                  const key = row ? cellKey(row, col) : '';
                  const mergedStart = row
                    ? Math.max(firstOnScreen, row.blockStart)
                    : slot.index;
                  const covered =
                    col === 0 && row && slot.index !== mergedStart;
                  const end = row
                    ? Math.min(last, row.blockStart + row.productRowSpan - 1)
                    : slot.index;
                  const mergedHeight =
                    col === 0 && row
                      ? (virtualRows.find((entry) => entry.index === end)
                          ?.end ?? item.end) - item.start
                      : item.size;
                  const style: CSSProperties = {
                    width: cell.column.getSize(),
                    left: col < frozenCount ? offsets.get(col) : undefined,
                    height: covered ? item.size : mergedHeight,
                  };
                  if (covered)
                    return (
                      <div
                        key={cell.id}
                        data-row={slot.index}
                        data-col={col}
                        className={`tb-cell tb-covered ${
                          col < frozenCount ? 'is-frozen' : ''
                        }`}
                        style={style}
                        aria-hidden="true"
                        onPointerDown={(event) => {
                          if (event.button === 0 && !c.busy) {
                            event.preventDefault();
                            c.select({ row: slot.index, col });
                            scrollRef.current?.focus();
                          }
                        }}
                      />
                    );
                  return (
                    <div
                      id={`budget-cell-${slot.index}-${col}`}
                      data-row={slot.index}
                      data-col={col}
                      data-record-id={row?.sourceNodes[0].id}
                      data-value={row ? String(rawValue(row, col)) : undefined}
                      role="gridcell"
                      aria-colindex={col + 1}
                      aria-rowspan={
                        col === 0 ? end - slot.index + 1 : undefined
                      }
                      aria-selected={isSelected}
                      aria-readonly={!COLUMNS[col].editable}
                      aria-label={`${cellAddress(
                        slot.index,
                        col,
                      )} ${columnLabel(col)}${
                        row
                          ? ` ${formattedValue(
                              rawValue(row, col),
                              COLUMNS[col],
                            )}`
                          : ' 加载中'
                      }`}
                      key={cell.id}
                      className={`tb-cell ${
                        col < frozenCount ? 'is-frozen' : ''
                      } ${col >= 3 ? 'is-number' : 'is-dimension'} ${
                        col === 0 ? 'is-organization' : ''
                      } ${col === 3 ? 'is-total' : ''} ${
                        isSelected ? 'is-selected' : ''
                      } ${active ? 'is-active' : ''} ${
                        row ? '' : 'is-loading'
                      }`}
                      style={style}
                      onPointerDown={(event) => {
                        if (
                          event.button !== 0 ||
                          c.busy ||
                          (event.target as Element).closest(
                            'button,input,.tb-fill-handle',
                          )
                        )
                          return;
                        event.preventDefault();
                        if (c.editing) {
                          void c.finishEdit().then((ok) => {
                            if (ok) c.select({ row: slot.index, col });
                          });
                          return;
                        }
                        const position = { row: slot.index, col };
                        if (event.altKey && isSelected)
                          drag.current = {
                            kind: 'move',
                            source: c.range,
                            last: position,
                            x: event.clientX,
                            y: event.clientY,
                          };
                        else {
                          c.select(position, event.shiftKey);
                          drag.current = {
                            kind: 'selection',
                            source: {
                              anchor: event.shiftKey
                                ? c.range.anchor
                                : position,
                              focus: position,
                            },
                            last: position,
                            x: event.clientX,
                            y: event.clientY,
                          };
                        }
                        scrollRef.current?.focus({ preventScroll: true });
                      }}
                      onDoubleClick={() => {
                        if (row) void c.startEdit({ row: slot.index, col });
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (!isSelected) c.select({ row: slot.index, col });
                        setContext({
                          x: Math.min(event.clientX, window.innerWidth - 205),
                          y: Math.min(event.clientY, window.innerHeight - 365),
                        });
                      }}
                    >
                      {edit ? (
                        <input
                          ref={inputRef}
                          className="tb-cell-editor"
                          aria-label={`编辑 ${cellAddress(slot.index, col)}`}
                          value={c.editing!.draft}
                          disabled={c.busy}
                          onChange={(event) =>
                            c.setEditing((current) =>
                              current
                                ? { ...current, draft: event.target.value }
                                : null,
                            )
                          }
                          onCompositionStart={() => {
                            composing.current = true;
                          }}
                          onCompositionEnd={() => {
                            composing.current = false;
                          }}
                          onBlur={() => {
                            if (!cancelBlur.current) void c.finishEdit();
                            cancelBlur.current = false;
                          }}
                          onKeyDown={(event) => {
                            if (
                              composing.current ||
                              event.nativeEvent.isComposing
                            )
                              return;
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              event.stopPropagation();
                              cancelBlur.current = true;
                              c.setEditing(null);
                              scrollRef.current?.focus();
                            }
                            if (event.key === 'Enter' || event.key === 'Tab') {
                              event.preventDefault();
                              event.stopPropagation();
                              cancelBlur.current = true;
                              void c.finishEdit().then((ok) => {
                                if (ok) {
                                  moveFocus(
                                    event.key === 'Enter'
                                      ? event.shiftKey
                                        ? -1
                                        : 1
                                      : 0,
                                    event.key === 'Tab'
                                      ? event.shiftKey
                                        ? -1
                                        : 1
                                      : 0,
                                  );
                                  scrollRef.current?.focus();
                                }
                                cancelBlur.current = false;
                              });
                            }
                          }}
                        />
                      ) : row ? (
                        <>
                          <span
                            className="tb-cell-text"
                            style={{
                              paddingLeft:
                                col < 2
                                  ? (col === 0
                                      ? row.productDepth
                                      : row.regionDepth) * 14
                                  : undefined,
                            }}
                          >
                            {(col === 0 && row.productIsGroup) ||
                            (col === 1 && row.regionIsGroup) ? (
                              <button
                                className="tb-tree-toggle"
                                aria-label={`${
                                  col === 0
                                    ? row.productExpanded
                                      ? '收起组织'
                                      : '展开组织'
                                    : row.regionExpanded
                                    ? '收起科目'
                                    : '展开科目'
                                } ${
                                  col === 0 ? row.productLabel : row.regionLabel
                                }`}
                                aria-expanded={
                                  col === 0
                                    ? row.productExpanded
                                    : row.regionExpanded
                                }
                                disabled={c.busy}
                                onDoubleClick={(event) =>
                                  event.stopPropagation()
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  c.changeQuery(
                                    col === 0
                                      ? {
                                          ...c.data.query,
                                          organizations: toggleExpanded(
                                            c.data.query.organizations,
                                            row.productId,
                                          ),
                                        }
                                      : {
                                          ...c.data.query,
                                          subjects: toggleExpanded(
                                            c.data.query.subjects,
                                            row.regionRootId,
                                          ),
                                        },
                                  );
                                }}
                              >
                                {(
                                  col === 0
                                    ? row.productExpanded
                                    : row.regionExpanded
                                ) ? (
                                  <ChevronDown size={13} />
                                ) : (
                                  <ChevronRight size={13} />
                                )}
                              </button>
                            ) : null}
                            {formattedValue(rawValue(row, col), COLUMNS[col])}
                          </span>
                          {row.formulas[COLUMNS[col].id] ? (
                            <span
                              className="tb-formula-mark"
                              title={row.formulas[COLUMNS[col].id]}
                            >
                              ƒ
                            </span>
                          ) : null}
                          {c.comments.has(key) ? (
                            <button
                              className="tb-cell-badge tb-comment-badge"
                              aria-label={`查看 ${cellAddress(
                                slot.index,
                                col,
                              )} 批注`}
                              title={c.comments.get(key)}
                              onClick={() => {
                                c.select({ row: slot.index, col });
                                c.setPanel('comment');
                              }}
                            >
                              <MessageSquare size={10} />
                            </button>
                          ) : null}
                          {c.attachments.get(key)?.length ? (
                            <button
                              className="tb-cell-badge"
                              aria-label={`查看 ${cellAddress(
                                slot.index,
                                col,
                              )} 附件`}
                              onClick={() => {
                                c.select({ row: slot.index, col });
                                c.setPanel('attachment');
                              }}
                            >
                              <Paperclip size={11} />
                              {c.attachments.get(key)!.length}
                            </button>
                          ) : null}
                          {slot.index === selection.bottom &&
                          col === selection.right &&
                          COLUMNS[col].editable ? (
                            <button
                              className="tb-fill-handle"
                              aria-label="拖拽填充选区"
                              title="拖动填充；Alt + 拖动选区可移动数据"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                drag.current = {
                                  kind: 'fill',
                                  source: c.range,
                                  last: { row: slot.index, col },
                                  x: event.clientX,
                                  y: event.clientY,
                                };
                              }}
                            />
                          ) : null}
                        </>
                      ) : (
                        <span className="tb-skeleton" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {context ? (
        <div
          className="tb-context-menu"
          role="menu"
          aria-label="单元格操作"
          style={{ left: context.x, top: context.y }}
        >
          {[
            ['复制', () => void c.copy()],
            ['剪切', () => void c.copy(true)],
            ['粘贴', () => void c.paste()],
            ['清空', () => void c.clear()],
            ['批注', () => c.setPanel('comment')],
            ['历史', () => c.setPanel('history')],
            ['附件', () => c.setPanel('attachment')],
            ['数据追踪', () => c.setPanel('lineage')],
          ].map(([label, action]) => (
            <button
              key={String(label)}
              role="menuitem"
              disabled={c.busy}
              onClick={() => {
                (action as () => void)();
                setContext(null);
              }}
            >
              {String(label)}
            </button>
          ))}
          <button
            role="menuitem"
            disabled={!c.selectedRow?.productIsGroup || c.busy}
            onClick={() => {
              if (c.selectedRow)
                c.changeQuery({
                  ...c.data.query,
                  drillPath: [
                    ...c.selectedRow.productAncestorIds,
                    c.selectedRow.productId,
                  ],
                });
              setContext(null);
            }}
          >
            下钻到下一级
          </button>
        </div>
      ) : null}
    </div>
  );
});
