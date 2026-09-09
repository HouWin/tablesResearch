import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import { BUSINESS_DIMENSION_CODES } from '../../SpreadJSDemo/spreadsheet/model';
import { isBusinessCellDimension } from '../../SpreadJSDemo/spreadsheet/business-cell-coordinate';
import type { BusinessCellChangePayload } from '../../SpreadJSDemo/spreadsheet/business-cell-change';
import { COLUMNS, cellAddress, cellKey, rawValue } from './columns';
import { parseTsv, serializeRows, shiftFormula } from './clipboard';
import { visibleBudgetColumns, visibleRange } from './selection';
import { useTransactionHistory } from './use-transaction-history';
import { useCellAnnotations } from './use-cell-annotations';
import {
  initialQuery,
  useBudgetData,
  type QueryViewport,
} from './use-budget-data';
import {
  bounds,
  isExpanded,
  type BudgetGateway,
  type BudgetQuery,
  type BudgetRow,
  type CellPosition,
  type CellRange,
  type CellWrite,
  type SearchMatch,
  type SearchResult,
  type Statistics,
  type Transaction,
} from './types';

export type GridHandle = {
  scrollToCell: (position: CellPosition) => void;
  focus: () => void;
  autoFit: () => void | Promise<void>;
};
export type Panel =
  | 'comment'
  | 'history'
  | 'attachment'
  | 'lineage'
  | 'aggregate'
  | 'help'
  | null;
export type EditState = {
  position: CellPosition;
  draft: string;
  recordId: string;
  expected: string | number;
};
type Options = {
  gateway?: BudgetGateway;
  onBusinessCellChange?: (
    payload: BusinessCellChangePayload,
  ) => void | Promise<void>;
};
const START_RANGE: CellRange = {
  anchor: { row: 0, col: 3 },
  focus: { row: 0, col: 3 },
};
const EMPTY_STATS: Statistics = {
  cells: 0,
  numeric: 0,
  sum: 0,
  average: 0,
  min: 0,
  max: 0,
  ignored: 0,
};
const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';
export function useBudgetController(options: Options = {}) {
  const data = useBudgetData(options.gateway);
  const [range, updateRange] = useState<CellRange>(START_RANGE);
  const rangeRef = useRef(START_RANGE);
  const editRequest = useRef(0);
  const setRange = useCallback((next: SetStateAction<CellRange>) => {
    const previous = rangeRef.current;
    const value = typeof next === 'function' ? next(previous) : next;
    if (
      previous.anchor.row === value.anchor.row &&
      previous.anchor.col === value.anchor.col &&
      previous.focus.row === value.focus.row &&
      previous.focus.col === value.focus.col
    )
      return;
    editRequest.current += 1;
    rangeRef.current = value;
    updateRange(value);
  }, []);
  const [editing, updateEditing] = useState<EditState | null>(null);
  const editingRef = useRef<EditState | null>(null);
  const finishingEdit = useRef<Promise<boolean> | null>(null);
  const [editError, setEditError] = useState('');
  const setEditing = useCallback((next: SetStateAction<EditState | null>) => {
    const value = typeof next === 'function' ? next(editingRef.current) : next;
    editingRef.current = value;
    updateEditing(value);
    setEditError('');
  }, []);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const queryRef = useRef(data.query);
  queryRef.current = data.query;
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const gridRef = useRef<GridHandle>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState(false);
  const visibleColumns = visibleBudgetColumns(hidden, collapsedColumns);
  const visibleColumnsKey = visibleColumns.join(',');
  const history = useTransactionHistory();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [panel, updatePanel] = useState<Panel>(null);
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchRequest = useRef<AbortController>();
  const searchedText = useRef('');
  const [pendingMatch, setPendingMatch] = useState<
    (SearchMatch & { focusGrid: boolean }) | null
  >(null);
  const [statistics, setStatistics] = useState<Statistics>(EMPTY_STATS);
  const [statisticsBusy, setStatisticsBusy] = useState(false);
  const [statisticsError, setStatisticsError] = useState('');
  const [statsRetry, setStatsRetry] = useState(0);
  const callbackRef = useRef(options.onBusinessCellChange);
  callbackRef.current = options.onBusinessCellChange;
  const selectedRow = data.rowAt(range.focus.row);
  const selectedKey = selectedRow ? cellKey(selectedRow, range.focus.col) : '';
  const notify = useCallback((message: string, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), error ? 7000 : 3500);
  }, []);
  const {
    comments,
    attachments,
    saveComment,
    addAttachments,
    removeAttachment,
  } = useCellAnnotations(selectedKey, notify);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      searchRequest.current?.abort();
    },
    [],
  );
  const select = useCallback(
    (position: CellPosition, extend = false, scroll = false) => {
      setRange((current) => ({
        anchor: extend ? current.anchor : position,
        focus: position,
      }));
      if (scroll) gridRef.current?.scrollToCell(position);
    },
    [setRange],
  );
  const changeQuery = (
    query: BudgetQuery,
    view?: { viewport: QueryViewport; selection: CellPosition },
  ) => {
    if (editingRef.current) {
      void finishEdit().then((ok) => {
        if (ok) changeQuery(query, view);
      });
      return;
    }
    if (busyRef.current || preparingRef.current || data.loading) return;
    queryRef.current = query;
    setEditing(null);
    data.setQuery(query, view?.viewport);
    setRange(
      visibleRange(
        view ? { anchor: view.selection, focus: view.selection } : START_RANGE,
        visibleColumns,
      ),
    );
  };
  const changeMode = () => {
    if (editingRef.current) {
      void finishEdit().then((ok) => {
        if (ok) changeMode();
      });
      return;
    }
    if (busyRef.current || preparingRef.current) return;
    searchRequest.current?.abort();
    setSearchResult(null);
    setSearchText('');
    setSearchBusy(false);
    setPendingMatch(null);
    history.clear();
    setPanel(null);
    internalClipboard.current = null;
    changeQuery(
      initialQuery(data.query.mode === 'regular' ? 'stress' : 'regular'),
    );
  };
  useEffect(() => {
    if (!data.manifest || data.loading || data.error || !pendingMatch) return;
    const controller = new AbortController();
    const manifest = data.manifest;
    data.gateway
      .position(manifest.id, pendingMatch.recordId, controller.signal)
      .then(async (row) => {
        if (row < 0) throw new Error('未能定位到该记录。');
        await data.readRow(row);
        if (controller.signal.aborted) return;
        const position = { row, col: pendingMatch.column };
        select(position, false, true);
        setPendingMatch(null);
        if (pendingMatch.focusGrid) gridRef.current?.focus();
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbort(error)) {
          notify(error.message, true);
          setPendingMatch(null);
        }
      });
    return () => controller.abort();
  }, [
    data.manifest?.id,
    data.loading,
    data.error,
    pendingMatch,
    data.gateway,
    data.readRow,
    select,
    notify,
  ]);

  const reveal = (match: SearchMatch, focusGrid = true) => {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(match.column);
      return next;
    });
    if (match.column > 3) setCollapsedColumns(false);
    const expand = (state: BudgetQuery['organizations'], ids: string[]) => {
      const values = new Set(state.ids);
      ids.forEach((id) => (state.all ? values.delete(id) : values.add(id)));
      return { ...state, ids: [...values] };
    };
    setPendingMatch({ ...match, focusGrid });
    changeQuery({
      ...data.query,
      drillPath: [],
      organizations: expand(data.query.organizations, [
        ...match.ancestors,
        match.organizationId,
      ]),
      subjects: expand(data.query.subjects, [match.subjectKey]),
    });
  };
  const search = async (direction = 1) => {
    if (editingRef.current && !(await finishEdit())) return;
    if (
      !searchText.trim() ||
      busyRef.current ||
      preparingRef.current ||
      data.loading ||
      data.error
    )
      return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchBusy(true);
    try {
      const index =
        searchedText.current === searchText && searchResult
          ? searchResult.index + direction
          : direction < 0
          ? -1
          : 0;
      const result = await data.gateway.search(
        data.query.mode,
        searchText,
        index,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      searchedText.current = searchText;
      setSearchResult(result);
      if (result.match) reveal(result.match, false);
      else notify('没有找到匹配的单元格。');
    } catch (error) {
      if (!isAbort(error))
        notify(error instanceof Error ? error.message : '搜索失败。', true);
    } finally {
      if (!controller.signal.aborted) setSearchBusy(false);
    }
  };
  const updateSearchText = (text: string) => {
    searchRequest.current?.abort();
    setSearchBusy(false);
    setSearchResult(null);
    setPendingMatch(null);
    searchedText.current = '';
    setSearchText(text);
  };
  const locate = async (text: string) => {
    const query = data.query;
    let dimension: unknown;
    try {
      dimension = JSON.parse(text);
    } catch {
      throw new Error('JSON 格式不正确，请检查引号与逗号。');
    }
    if (!isBusinessCellDimension(dimension))
      throw new Error('请提供完整的 row 与 column 业务维度。');
    const result = await data.gateway.locate(data.query.mode, dimension);
    if (queryRef.current !== query)
      throw new Error('数据视图已改变，请重新定位。');
    if (!result) throw new Error('当前数据集中不存在该业务单元格。');
    reveal(result);
  };
  useEffect(() => {
    if (!data.manifest || data.loading || data.error) {
      setStatisticsBusy(false);
      return;
    }
    const controller = new AbortController();
    setStatisticsBusy(true);
    setStatisticsError('');
    const timer = setTimeout(() => {
      data.gateway
        .statistics(
          data.manifest!.id,
          range,
          visibleColumnsKey.split(',').map(Number),
          controller.signal,
        )
        .then((result) => {
          if (!controller.signal.aborted) setStatistics(result);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setStatisticsError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setStatisticsBusy(false);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    data.manifest?.id,
    range,
    visibleColumnsKey,
    data.gateway,
    data.loading,
    data.error,
    transactions.at(-1)?.id,
    statsRetry,
  ]);

  const recordTransaction = async (transaction: Transaction) => {
    if (!transaction.patches.length) return;
    setTransactions((current) => [...current, transaction].slice(-100));
    let sliceStart = performance.now();
    for (const patch of transaction.patches) {
      try {
        await callbackRef.current?.(patch.payload);
      } catch (error) {
        notify(
          `修改已写入演示服务，但外部保存回调失败：${
            error instanceof Error ? error.message : String(error)
          }`,
          true,
        );
      }
      if (performance.now() - sliceStart > 8) {
        // Timers also progress in background tabs; rAF can suspend a saved transaction.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        sliceStart = performance.now();
      }
    }
    setSearchResult(null);
    searchedText.current = '';
  };
  const commit = async (writes: CellWrite[], source = '单元格编辑') => {
    if (busyRef.current || data.loading || data.error || !data.manifest)
      return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const transaction = await data.gateway.write(
        data.manifest.id,
        writes,
        source,
      );
      if (transaction.patches.length) {
        history.record(transaction);
        await recordTransaction(transaction);
        // A refresh failure must not be reported as a rejected write or invite a duplicate save.
        try {
          await data.invalidate(range.focus.row);
        } catch {
          notify('修改已保存，但当前页刷新失败，请点击“重试当前页”。', true);
        }
      }
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '修改失败，请重试。';
      if (editingRef.current) setEditError(message);
      notify(message, true);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const replay = async (direction: 'undo' | 'redo') => {
    if (editingRef.current && !(await finishEdit())) return;
    if (busyRef.current || preparingRef.current) return;
    const transaction = history.peek(direction);
    if (!transaction) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const replayed = await data.gateway.replay(
        data.query.mode,
        transaction,
        direction,
      );
      history.acceptReplay(direction, transaction);
      await recordTransaction(replayed);
      try {
        await data.invalidate(range.focus.row);
        notify(direction === 'undo' ? '已撤销上一次操作' : '已重做上一次操作');
      } catch {
        notify('历史操作已保存，但当前页刷新失败，请点击“重试当前页”。', true);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败。', true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const startEdit = async (position: CellPosition, replacement?: string) => {
    if (
      editingRef.current?.position.row === position.row &&
      editingRef.current.position.col === position.col
    )
      return;
    if (editingRef.current && !(await finishEdit())) return;
    if (
      busyRef.current ||
      preparingRef.current ||
      data.loading ||
      data.error ||
      !COLUMNS[position.col]?.editable
    ) {
      if (position.col < 2) notify('组织和科目名称由层级维护。');
      return;
    }
    try {
      const request = ++editRequest.current;
      const query = data.query;
      const row =
        data.rowAt(position.row) ?? (await data.readRow(position.row));
      if (
        queryRef.current !== query ||
        request !== editRequest.current ||
        busyRef.current ||
        preparingRef.current
      )
        return;
      select(position);
      setEditing({
        position,
        recordId: row.sourceNodes[0].id,
        expected: rawValue(row, position.col),
        draft:
          replacement ??
          row.formulas[COLUMNS[position.col].id] ??
          String(rawValue(row, position.col)),
      });
    } catch (error) {
      if (!isAbort(error))
        notify(error instanceof Error ? error.message : '无法编辑。', true);
    }
  };
  const finishEdit = (): Promise<boolean> => {
    if (finishingEdit.current) return finishingEdit.current;
    const edit = editingRef.current;
    if (!edit) return Promise.resolve(true);
    // Blur, Enter and a toolbar action can request the same save in one turn.
    // Submit once, with the value captured when editing began for conflict checks.
    const pending = commit([
      {
        recordId: edit.recordId,
        col: edit.position.col,
        input: edit.draft,
        expected: edit.expected,
      },
    ])
      .then((ok) => {
        if (ok && editingRef.current === edit) setEditing(null);
        return ok;
      })
      .finally(() => {
        finishingEdit.current = null;
      });
    finishingEdit.current = pending;
    return pending;
  };
  const panelRequest = useRef(0);
  const setPanel = (next: Panel) => {
    const request = ++panelRequest.current;
    if (!editingRef.current) {
      updatePanel(next);
      return;
    }
    void finishEdit().then((ok) => {
      if (request !== panelRequest.current) return;
      if (ok) updatePanel(next);
      else gridRef.current?.focus();
    });
  };
  // Keep a paged clipboard/fill operation on one projection until its atomic write completes.
  const beginPreparation = () => {
    if (busyRef.current || preparingRef.current || data.loading) return false;
    preparingRef.current = true;
    setPreparing(true);
    searchRequest.current?.abort();
    setSearchBusy(false);
    setPendingMatch(null);
    return true;
  };
  const endPreparation = () => {
    preparingRef.current = false;
    setPreparing(false);
  };
  const selectedRows = async (selectedRange = range, limit = 200_000) => {
    if (!data.manifest) throw new Error('请等待数据加载完成。');
    const box = bounds(selectedRange);
    const columns = visibleColumns.filter(
      (col) => col >= box.left && col <= box.right,
    );
    if ((box.bottom - box.top + 1) * columns.length > limit)
      throw new Error(
        `请将单次操作控制在 ${limit.toLocaleString()} 个单元格以内。`,
      );
    const rows: BudgetRow[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await data.gateway.range(
        data.manifest.id,
        selectedRange,
        columns,
        offset,
      );
      rows.push(...page.rows);
      offset = page.nextOffset;
    }
    return { rows, columns };
  };
  const internalClipboard = useRef<{
    rows: BudgetRow[];
    columns: number[];
    cut: boolean;
    text: string;
  } | null>(null);
  const copy = async (cut = false) => {
    if (editingRef.current && !(await finishEdit())) return;
    if (!beginPreparation()) return;
    try {
      const selection = await selectedRows();
      if (cut && selection.columns.some((col) => !COLUMNS[col].editable))
        throw new Error('选区包含只读列，不能剪切。');
      const content = serializeRows(selection.rows, selection.columns);
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([content.text], { type: 'text/plain' }),
            'text/html': new Blob([content.html], { type: 'text/html' }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(content.text);
      else {
        const input = document.createElement('textarea');
        input.value = content.text;
        document.body.append(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (!ok) throw new Error('浏览器未允许访问剪贴板。');
      }
      internalClipboard.current = {
        ...selection,
        cut,
        text: content.text.replace(/\r\n/g, '\n'),
      };
      notify(
        cut
          ? '已剪切，粘贴成功后清空源单元格。'
          : '已复制，可直接粘贴到 Excel。',
      );
      gridRef.current?.focus();
    } catch (error) {
      notify(error instanceof Error ? error.message : '复制失败。', true);
    } finally {
      endPreparation();
    }
  };
  const paste = async (text?: string) => {
    if (editingRef.current && !(await finishEdit())) return;
    if (!beginPreparation()) return;
    try {
      const content = text ?? (await navigator.clipboard.readText());
      const matrix = parseTsv(content, 20_000);
      const box = bounds(range);
      const start = visibleColumns.indexOf(box.left);
      const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
      const height = matrix.length;
      if (
        width * height > 20_000 ||
        start < 0 ||
        start + width > visibleColumns.length ||
        box.top + height > (data.manifest?.totalRows ?? 0)
      )
        throw new Error('粘贴内容超出当前表格，或超过单次 2 万个单元格限制。');
      const targetColumns = visibleColumns.slice(start, start + width);
      if (targetColumns.some((col) => !COLUMNS[col].editable))
        throw new Error('粘贴区域包含只读的组织或科目列，未修改任何单元格。');
      const targetRange = {
        anchor: { row: box.top, col: targetColumns[0] },
        focus: { row: box.top + height - 1, col: targetColumns.at(-1)! },
      };
      const { rows } = await selectedRows(targetRange, 20_000);
      const internal =
        internalClipboard.current?.text === content.replace(/\r\n/g, '\n')
          ? internalClipboard.current
          : null;
      const writes: CellWrite[] = [];
      rows.forEach((row, r) =>
        targetColumns.forEach((col, c) => {
          const source = internal?.rows[r];
          const sourceCol = internal?.columns[c];
          const formula =
            source && sourceCol !== undefined
              ? source.formulas[COLUMNS[sourceCol].id]
              : '';
          writes.push({
            recordId: row.sourceNodes[0].id,
            col,
            input: formula
              ? shiftFormula(
                  formula,
                  row.index - source!.index,
                  col - sourceCol!,
                )
              : matrix[r]?.[c] ?? '',
            expected: rawValue(row, col),
          });
        }),
      );
      if (internal?.cut) {
        const keys = new Set(
          writes.map((write) => `${write.recordId}/${write.col}`),
        );
        internal.rows.forEach((row) =>
          internal.columns.forEach((col) => {
            if (!keys.has(`${row.sourceNodes[0].id}/${col}`))
              writes.push({
                recordId: row.sourceNodes[0].id,
                col,
                input: col >= 3 ? 0 : '',
                expected: rawValue(row, col),
              });
          }),
        );
      }
      if (await commit(writes, internal?.cut ? '剪切粘贴' : '粘贴')) {
        setRange(targetRange);
        if (internal?.cut) internalClipboard.current = null;
        notify(`已粘贴 ${height} 行 × ${width} 列。`);
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : '粘贴失败，请使用 Ctrl/⌘ + V。',
        true,
      );
    } finally {
      endPreparation();
    }
  };
  const clear = async () => {
    if (editingRef.current && !(await finishEdit())) return;
    if (!beginPreparation()) return;
    try {
      const { rows, columns } = await selectedRows(range, 20_000);
      if (columns.some((col) => !COLUMNS[col].editable))
        throw new Error('选区包含只读列，未清空任何数据。');
      await commit(
        rows.flatMap((row) =>
          columns.map((col) => ({
            recordId: row.sourceNodes[0].id,
            col,
            input: col >= 3 ? 0 : '',
            expected: rawValue(row, col),
          })),
        ),
        '清空单元格',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : '清空失败。', true);
    } finally {
      endPreparation();
    }
  };
  const fill = async (
    sourceRange: CellRange,
    targetRange: CellRange,
    move = false,
  ) => {
    if (editingRef.current && !(await finishEdit())) return;
    if (!beginPreparation()) return;
    try {
      const source = await selectedRows(sourceRange, 20_000);
      const target = await selectedRows(targetRange, 20_000);
      if (
        target.columns.some((col) => !COLUMNS[col].editable) ||
        (move && source.columns.some((col) => !COLUMNS[col].editable))
      )
        throw new Error('目标区域包含只读列。');
      const writes = target.rows.flatMap((row, r) =>
        target.columns.map((col, c) => {
          const sourceRow = source.rows[r % source.rows.length];
          const sourceCol = source.columns[c % source.columns.length];
          const formula = sourceRow.formulas[COLUMNS[sourceCol].id];
          return {
            recordId: row.sourceNodes[0].id,
            col,
            input: formula
              ? shiftFormula(
                  formula,
                  row.index - sourceRow.index,
                  col - sourceCol,
                )
              : rawValue(sourceRow, sourceCol),
            expected: rawValue(row, col),
          };
        }),
      );
      if (move) {
        const keys = new Set(
          writes.map((write) => `${write.recordId}/${write.col}`),
        );
        source.rows.forEach((row) =>
          source.columns.forEach((col) => {
            if (!keys.has(`${row.sourceNodes[0].id}/${col}`))
              writes.push({
                recordId: row.sourceNodes[0].id,
                col,
                input: col >= 3 ? 0 : '',
                expected: rawValue(row, col),
              });
          }),
        );
      }
      if (await commit(writes, move ? '拖放移动' : '拖拽填充')) {
        setRange(targetRange);
        notify(move ? '已移动选区。' : '已填充所选区域。');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : '填充失败。', true);
    } finally {
      endPreparation();
    }
  };
  const setColumnVisible = (col: number, visible: boolean) => {
    if (col < 3) return;
    if (editingRef.current) {
      void finishEdit().then((ok) => {
        if (ok) setColumnVisible(col, visible);
      });
      return;
    }
    const next = new Set(hidden);
    if (visible) next.delete(col);
    else next.add(col);
    setHidden(next);
    setRange((current) =>
      visibleRange(current, visibleBudgetColumns(next, collapsedColumns)),
    );
  };
  const toggleColumns = () => {
    if (editingRef.current) {
      void finishEdit().then((ok) => {
        if (ok) toggleColumns();
      });
      return;
    }
    setRange((current) =>
      visibleRange(current, visibleBudgetColumns(hidden, !collapsedColumns)),
    );
    setCollapsedColumns((current) => !current);
  };
  const selectedRecordId = selectedRow?.sourceNodes[0].id;
  const selectedHistory = useMemo(
    () =>
      panel === 'history' && selectedRecordId
        ? transactions
            .flatMap((transaction) =>
              transaction.patches
                .filter(
                  (patch) =>
                    patch.recordId === selectedRecordId &&
                    patch.col === range.focus.col,
                )
                .map((patch) => ({
                  ...patch,
                  source: transaction.source,
                  createdAt: transaction.createdAt,
                  id: transaction.id,
                })),
            )
            .reverse()
        : [],
    [panel, selectedRecordId, range.focus.col, transactions],
  );
  return {
    data,
    gridRef,
    range,
    setRange,
    select,
    editing,
    editError,
    setEditing,
    startEdit,
    finishEdit,
    busy: busy || preparing,
    saving: busy,
    toast,
    notify,
    hidden,
    visibleColumns,
    setColumnVisible,
    collapsedColumns,
    toggleColumns,
    showAllColumns: () => {
      setHidden(new Set());
      setCollapsedColumns(false);
    },
    selectedRow,
    selectedKey,
    changeQuery,
    changeMode,
    undo: history.undo,
    redo: history.redo,
    replay,
    copy,
    paste,
    clear,
    fill,
    panel,
    setPanel,
    comments,
    saveComment,
    attachments,
    addAttachments,
    removeAttachment,
    selectedHistory,
    lastSavedAt: transactions.at(-1)?.createdAt,
    searchText,
    setSearchText: updateSearchText,
    searchResult,
    searchBusy,
    search,
    locate,
    statistics,
    statisticsBusy,
    statisticsError,
    retryStatistics: () => setStatsRetry((value) => value + 1),
    selectedAddress: cellAddress(range.focus.row, range.focus.col),
    isExpanded,
    organizationDimension: BUSINESS_DIMENSION_CODES.organization,
  };
}
export type BudgetController = ReturnType<typeof useBudgetController>;
