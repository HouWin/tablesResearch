import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ListTable, data } from '@visactor/vtable';
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
  toBusinessPosition,
  toTableCell,
  type OrganizationBlock,
} from './grid-model';
import { handleGridKey, type GridNavigation } from './grid-keyboard';
import { useGridDrag } from './use-grid-drag';
import { GridEditor } from './grid-editor';
import { GridContextMenu } from './grid-context-menu';
import { createTableOptions } from './grid-options';
import { adjustFrozenColumns, useColumnSizing } from './use-column-sizing';
import {
  organizationPosition,
  organizationSelection,
  syncTableSelection,
} from './grid-selection';
import { MAX_ROW_HEIGHT, MIN_ROW_HEIGHT, useRowResize } from './use-row-resize';
import {
  restoreViewport,
  updateViewportSpace,
  withStableViewport,
  type ViewportAnchor,
} from './grid-viewport';

type Rect = { left: number; top: number; width: number; height: number };
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
  const foldAnchor = useRef<ViewportAnchor>();
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [initializationError, setInitializationError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const closeContext = useCallback(() => setContext(null), []);
  const shiftAnchor = useRef<CellPosition | null>(null);
  const pointerSelecting = useRef(false);
  const keyboardNavigation = useRef<GridNavigation>({});
  const visibleKey = c.visibleColumns.join(',');
  const hasManifest = Boolean(c.data.manifest);
  const focus = () => {
    const editor = latest.current.editing
      ? root.current?.querySelector<HTMLInputElement>('.vt-editor')
      : null;
    (editor ?? root.current)?.focus({ preventScroll: true });
  };

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
    // Release trailing space as the user scrolls up, without moving the viewport.
    updateViewportSpace(table, manifest.totalRows);
    const visible = table.getBodyVisibleRowRange();
    const first = Math.max(
      0,
      Math.min(manifest.totalRows - 1, visible.rowStart - HEADER_ROWS),
    );
    const last = Math.min(manifest.totalRows - 1, visible.rowEnd - HEADER_ROWS);
    viewport.current = { first, last };
    current.data.loadViewport(first, last);
  }, []);
  const drag = useGridDrag({
    instance,
    host,
    latest,
    pointerSelecting,
    loadViewport,
  });
  const { sizing, cancelSizing, autoFitColumns } = useColumnSizing({
    controller: c,
    latest,
    instance,
    host,
    widths,
    captureBlock,
    loadViewport,
    onLayout: () => setLayoutVersion((value) => value + 1),
  });
  const rowResize = useRowResize({
    instance,
    controller: c,
    onLayout: () => {
      loadViewport();
      setLayoutVersion((value) => value + 1);
    },
  });
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
    autoFit: () => autoFitColumns(latest.current.visibleColumns),
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
      // A zero-height presentation row can absorb space removed by a bottom fold.
      // It is excluded from business coordinates, selection, counts and paging.
      length: c.data.manifest.totalRows + 1,
      // Synchronous cache reads avoid a second unbounded Promise/record cache in VTable.
      // Missing rows are filled exclusively by the deduplicated viewport page loader.
      get: (index: number) => latest.current.data.rowAt(index),
    });
    try {
      const options = createTableOptions({
        source,
        getController: () => latest.current,
        widths: widths.current,
        getBlock: captureBlock,
      });
      table = new ListTable(host.current, options);
      updateViewportSpace(table, c.data.manifest.totalRows, 0);
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
          const next = organizationSelection(
            { anchor, focus: end },
            captureBlock,
          );
          if (!sameRange(next, latest.current.range))
            latest.current.setRange(next);
          void latest.current.data.ensurePage(next.focus.row).catch(() => {});
        }
      });
      table.on('click_cell', ({ col, row, targetIcon }) => {
        if (
          latest.current.busy ||
          latest.current.data.loading ||
          latest.current.data.error ||
          row >= HEADER_ROWS + (latest.current.data.manifest?.totalRows ?? 0) ||
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
        const hit = position(col, row);
        if (!hit) return;
        const point = organizationPosition(hit, captureBlock);
        if (current.editing) {
          void current.finishEdit().then((ok) => {
            if (ok) current.select(point);
          });
          return;
        }
        if (point.col === 0) {
          const block = captureBlock(point.row);
          if (block?.productIsGroup) {
            foldAnchor.current = {
              row: point.row,
              top: table!.getCellRelativeRect(col, point.row + HEADER_ROWS).top,
            };
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
          }
        } else if (point.col === 1) {
          const record = current.data.rowAt(point.row);
          if (record?.regionIsGroup) {
            foldAnchor.current = {
              row: point.row,
              top: table!.getCellRelativeRect(col, point.row + HEADER_ROWS).top,
            };
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
        }
        focus();
      });
      table.on('dblclick_cell', ({ col, row }) => {
        const point = position(col, row);
        if (point && point.col > 1) void latest.current.startEdit(point);
      });
      table.on('icon_click', ({ col, row, name }) => {
        const hit = position(col, row);
        if (!hit) return;
        const point = organizationPosition(hit, captureBlock);
        latest.current.select(point);
        if (name === 'budget-comment') latest.current.setPanel('comment');
        if (name === 'budget-attachment') latest.current.setPanel('attachment');
      });
      table.on('contextmenu_cell', ({ col, row, event }) => {
        if (
          latest.current.busy ||
          latest.current.editing ||
          latest.current.data.loading ||
          latest.current.data.error
        )
          return;
        const hit = position(col, row);
        if (!hit || !event || !('clientX' in event)) return;
        // The menu opens on right-pointerdown. Prevent the browser's subsequent
        // default focus action from moving focus back from the menu to Canvas.
        event.preventDefault();
        const point = organizationPosition(hit, captureBlock);
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
        cancelSizing();
        latest.current.visibleColumns.forEach((col, index) =>
          widths.current.set(col, table!.getColWidth(index + 1)),
        );
        adjustFrozenColumns(table!, host.current?.clientWidth ?? 0);
        schedule();
      });
      table.on('resize_row_end', schedule);
      table.on('scroll', schedule);
      observer = new ResizeObserver(([entry]) => {
        if (!table || disposed) return;
        adjustFrozenColumns(table, entry.contentRect.width);
        withStableViewport(table, latest.current.data.manifest!.totalRows, () =>
          table!.resize(),
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
      length: manifest.totalRows + 1,
      get: (index: number) => latest.current.data.rowAt(index),
    });
    projectionId.current = manifest.id;
    restoreViewport(
      table,
      manifest.totalRows,
      top,
      left,
      c.data.preserveScroll ? foldAnchor.current : undefined,
    );
    foldAnchor.current = undefined;
    table.render();
    syncing.current = false;
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [c.data.manifest?.id, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    withStableViewport(table, c.data.manifest!.totalRows, () =>
      table.updateColumns(
        createColumns(() => latest.current, widths.current, captureBlock),
      ),
    );
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [visibleKey, c.collapsedColumns, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    // Refresh only the viewport; never walk all 101,100 records after an edit or a page response.
    withStableViewport(table, c.data.manifest!.totalRows, () =>
      table.renderWithRecreateCells(),
    );
    loadViewport();
    setLayoutVersion((value) => value + 1);
  }, [c.data.version, c.comments, c.attachments, loadViewport]);

  useLayoutEffect(() => {
    const table = instance.current;
    if (!table) return;
    if (pointerSelecting.current && !drag.current) return;
    const selected = organizationSelection(c.range, captureBlock);
    if (!c.data.loading && !sameRange(selected, c.range)) {
      c.setRange(selected);
      return;
    }
    if (
      !c.data.loading &&
      selected.focus.col === 0 &&
      !c.data.rowAt(selected.focus.row)
    )
      void c.data.ensurePage(selected.focus.row).catch(() => {});
    syncing.current = true;
    let start = toTableCell(selected.anchor, c.visibleColumns);
    let end = toTableCell(selected.focus, c.visibleColumns);
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
    syncTableSelection(table, { start, end });
    syncing.current = false;
  }, [c.range, visibleKey, c.data.manifest?.id, c.data.loading, layoutVersion]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const key = (event: KeyboardEvent) => {
      if (
        (event.target as Element).closest(
          'input,button,textarea,[role="separator"]',
        )
      )
        return;
      if (
        (event.key === 'ContextMenu' ||
          (event.shiftKey && event.key === 'F10')) &&
        !latest.current.busy &&
        !latest.current.editing &&
        !latest.current.data.loading &&
        !latest.current.data.error
      ) {
        event.preventDefault();
        event.stopPropagation();
        const table = instance.current;
        const hostRect = host.current?.getBoundingClientRect();
        if (table && hostRect) {
          const at = toTableCell(
            latest.current.range.focus,
            latest.current.visibleColumns,
          );
          const rect = table.getCellRelativeRect(at.col, at.row);
          setContext({
            x: hostRect.left + rect.left,
            y: hostRect.top + rect.bottom,
          });
        }
        return;
      }
      handleGridKey(
        event,
        latest.current,
        Math.max(
          1,
          Math.floor(
            (element.clientHeight - HEADER_ROWS * HEADER_HEIGHT) / ROW_HEIGHT,
          ),
        ),
        captureBlock,
        keyboardNavigation.current,
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
  const rowHandles: { row: number; bottom: number; height: number }[] = [];
  const table = instance.current;
  if (table) {
    const visible = table.getBodyVisibleRowRange();
    for (
      let row = Math.max(HEADER_ROWS, visible.rowStart);
      row <=
      Math.min(
        HEADER_ROWS + (c.data.manifest?.totalRows ?? 0) - 1,
        visible.rowEnd,
      );
      row++
    ) {
      const { bottom } = table.getCellRelativeRect(0, row);
      if (
        bottom > HEADER_ROWS * HEADER_HEIGHT &&
        bottom < (host.current?.clientHeight ?? 0) - 10
      )
        rowHandles.push({ row, bottom, height: table.getRowHeight(row) });
    }
  }
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
      {sizing ? (
        <div className="vt-sizing-status" role="status">
          正在按全部内容适配列宽…
          <button onClick={() => cancelSizing()}>取消适配</button>
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
        onPointerUpCapture={() => {
          pointerSelecting.current = false;
          setLayoutVersion((value) => value + 1);
        }}
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
              void autoFitColumns([c.visibleColumns[col - 1]]);
              return;
            }
          }
        }}
        onPointerDownCapture={(event) => {
          keyboardNavigation.current = {};
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
        {rowHandles.map(({ row, bottom, height }) => (
          <div
            key={row}
            className="vt-row-resizer"
            role="separator"
            aria-label={`调整第 ${row - HEADER_ROWS + 1} 行高度`}
            aria-orientation="horizontal"
            aria-valuemin={MIN_ROW_HEIGHT}
            aria-valuemax={MAX_ROW_HEIGHT}
            aria-valuenow={height}
            aria-disabled={rowResize.blocked}
            tabIndex={rowResize.blocked ? -1 : 0}
            title="拖动调整行高；上下方向键微调；双击恢复默认行高"
            style={{ top: bottom - 3, width: ROW_NUMBER_WIDTH }}
            onPointerDown={(event) => rowResize.start(event, row)}
            onDoubleClick={() => rowResize.resize(row, ROW_HEIGHT)}
            onKeyDown={(event) => {
              if (
                event.key === 'ArrowUp' ||
                event.key === 'ArrowDown' ||
                event.key === 'Home'
              ) {
                event.preventDefault();
                event.stopPropagation();
                rowResize.resize(
                  row,
                  event.key === 'Home'
                    ? ROW_HEIGHT
                    : height + (event.key === 'ArrowUp' ? -4 : 4),
                );
              }
            }}
          />
        ))}
        <span id="vtable-grid-help" className="vt-sr-only">
          方向键移动，Shift 扩选，Enter 或 F2 编辑，Ctrl 或 Command 加 F
          搜索。点击组织合并区域展开或收起；拖动行号分隔线调整行高。
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
        {c.editing && c.editError ? (
          <div id="vtable-edit-error" className="vt-edit-error">
            <strong>{c.editError}</strong>
            <span>请修改后按 Enter 保存，或按 Esc 取消。</span>
          </div>
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
