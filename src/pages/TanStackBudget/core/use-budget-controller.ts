import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUSINESS_DIMENSION_CODES,
  type CellAttachment,
} from '../../SpreadJSDemo/spreadsheet/model';
import {
  isAcceptedAttachment,
  MAX_ATTACHMENTS_PER_CELL,
  MAX_ATTACHMENT_SIZE,
} from '../../SpreadJSDemo/spreadsheet/attachments';
import { isBusinessCellDimension } from '../../SpreadJSDemo/spreadsheet/business-cell-coordinate';
import type { BusinessCellChangePayload } from '../../SpreadJSDemo/spreadsheet/business-cell-change';
import { COLUMNS, cellAddress, cellKey, rawValue } from './columns';
import { parseTsv, serializeRows, shiftFormula } from './clipboard';
import { initialQuery, useBudgetData } from './use-budget-data';
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
  autoFit: () => void;
};
export type Panel =
  | 'comment'
  | 'history'
  | 'attachment'
  | 'lineage'
  | 'aggregate'
  | 'help'
  | null;
export type EditState = { position: CellPosition; draft: string };
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
  const [range, setRange] = useState<CellRange>(START_RANGE);
  const [editing, setEditing] = useState<EditState | null>(null);
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
  const visibleColumns = COLUMNS.map((_, index) => index).filter(
    (col) => !hidden.has(col) && !(collapsedColumns && col > 3),
  );
  const visibleColumnsKey = visibleColumns.join(',');
  const [undo, setUndo] = useState<Transaction[]>([]);
  const [redo, setRedo] = useState<Transaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [comments, setComments] = useState(new Map<string, string>());
  const [attachments, setAttachments] = useState(
    new Map<string, CellAttachment[]>(),
  );
  const attachmentRef = useRef(attachments);
  attachmentRef.current = attachments;
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchRequest = useRef<AbortController>();
  const searchedText = useRef('');
  const [pendingMatch, setPendingMatch] = useState<SearchMatch | null>(null);
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
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      searchRequest.current?.abort();
      attachmentRef.current.forEach((files) =>
        files.forEach((file) => URL.revokeObjectURL(file.objectUrl)),
      );
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
    [],
  );
  const changeQuery = (query: BudgetQuery) => {
    if (busyRef.current || preparingRef.current) return;
    queryRef.current = query;
    setEditing(null);
    data.setQuery(query);
    setRange(START_RANGE);
  };
  const changeMode = () => {
    if (busyRef.current || preparingRef.current) return;
    searchRequest.current?.abort();
    setSearchResult(null);
    setSearchText('');
    setSearchBusy(false);
    setPendingMatch(null);
    setUndo([]);
    setRedo([]);
    setPanel(null);
    internalClipboard.current = null;
    changeQuery(
      initialQuery(data.query.mode === 'regular' ? 'stress' : 'regular'),
    );
  };
  useEffect(() => {
    if (!data.manifest || !pendingMatch) return;
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
        gridRef.current?.focus();
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
    pendingMatch,
    data.gateway,
    data.readRow,
    select,
    notify,
  ]);

  const reveal = (match: SearchMatch) => {
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
    setPendingMatch(match);
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
    if (!searchText.trim() || busyRef.current || preparingRef.current) return;
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
      if (result.match) reveal(result.match);
      else notify('没有找到匹配的单元格。');
    } catch (error) {
      if (!isAbort(error))
        notify(error instanceof Error ? error.message : '搜索失败。', true);
    } finally {
      if (!controller.signal.aborted) setSearchBusy(false);
    }
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
    if (!data.manifest || data.loading) {
      setStatistics(EMPTY_STATS);
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
    transactions.at(-1)?.id,
    statsRetry,
  ]);

  const recordTransaction = async (transaction: Transaction) => {
    if (!transaction.patches.length) return;
    setTransactions((current) => [...current, transaction].slice(-100));
    for (const patch of transaction.patches) {
      if (process.env.NODE_ENV !== 'production')
        console.info('[TanStack Budget][单元格修改]', patch.payload);
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
    }
    setSearchResult(null);
    searchedText.current = '';
  };
  const commit = async (writes: CellWrite[], source = '单元格编辑') => {
    if (busyRef.current || !data.manifest) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const transaction = await data.gateway.write(
        data.manifest.id,
        writes,
        source,
      );
      if (transaction.patches.length) {
        setUndo((current) => [...current, transaction].slice(-100));
        setRedo([]);
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
      notify(
        error instanceof Error ? error.message : '修改失败，请重试。',
        true,
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const replay = async (direction: 'undo' | 'redo') => {
    if (busyRef.current || preparingRef.current) return;
    const stack = direction === 'undo' ? undo : redo;
    const transaction = stack.at(-1);
    if (!transaction) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const replayed = await data.gateway.replay(
        data.query.mode,
        transaction,
        direction,
      );
      if (direction === 'undo') {
        setUndo((current) => current.slice(0, -1));
        setRedo((current) => [...current, transaction]);
      } else {
        setRedo((current) => current.slice(0, -1));
        setUndo((current) => [...current, transaction]);
      }
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
      busyRef.current ||
      preparingRef.current ||
      !COLUMNS[position.col]?.editable
    ) {
      if (position.col < 2) notify('组织和科目名称由层级维护。');
      return;
    }
    try {
      const query = data.query;
      const row = await data.readRow(position.row);
      if (queryRef.current !== query) return;
      select(position);
      setEditing({
        position,
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
  const finishEdit = async () => {
    if (!editing) return true;
    try {
      const query = data.query;
      const row = await data.readRow(editing.position.row);
      if (queryRef.current !== query) return false;
      const ok = await commit([
        {
          recordId: row.sourceNodes[0].id,
          col: editing.position.col,
          input: editing.draft,
          expected: rawValue(row, editing.position.col),
        },
      ]);
      if (ok) setEditing(null);
      return ok;
    } catch (error) {
      if (!isAbort(error))
        notify(
          error instanceof Error ? error.message : '无法保存，请重试。',
          true,
        );
      return false;
    }
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
    if (!beginPreparation()) return;
    try {
      const content = text ?? (await navigator.clipboard.readText());
      const matrix = parseTsv(content);
      const box = bounds(range);
      const start = visibleColumns.indexOf(box.left);
      const width = Math.max(...matrix.map((row) => row.length));
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
  const saveComment = (text: string) => {
    if (!selectedKey) return;
    setComments((current) => {
      const next = new Map(current);
      if (text.trim()) next.set(selectedKey, text.trim());
      else next.delete(selectedKey);
      return next;
    });
    notify(text.trim() ? '批注已保存。' : '批注已删除。');
  };
  const addAttachments = (files: File[]) => {
    if (!selectedKey) return;
    const previous = attachments.get(selectedKey) ?? [];
    const accepted: CellAttachment[] = [];
    const signatures = new Set(
      previous.map((file) => `${file.name}/${file.size}/${file.lastModified}`),
    );
    const rejected: string[] = [];
    for (const file of files) {
      const signature = `${file.name}/${file.size}/${file.lastModified}`;
      if (
        !isAcceptedAttachment(file) ||
        file.size > MAX_ATTACHMENT_SIZE ||
        previous.length + accepted.length >= MAX_ATTACHMENTS_PER_CELL ||
        signatures.has(signature)
      ) {
        rejected.push(file.name);
        continue;
      }
      signatures.add(signature);
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mimeType: file.type,
        objectUrl: URL.createObjectURL(file),
        lastModified: file.lastModified,
        createdAt: Date.now(),
      });
    }
    setAttachments((current) =>
      new Map(current).set(selectedKey, [...previous, ...accepted]),
    );
    notify(
      rejected.length
        ? `已添加 ${accepted.length} 个附件；${rejected.length} 个因类型、大小、数量限制或重复被跳过。`
        : `已添加 ${accepted.length} 个附件。`,
      Boolean(rejected.length),
    );
  };
  const removeAttachment = (id: string) => {
    const files = attachments.get(selectedKey) ?? [];
    const removed = files.find((file) => file.id === id);
    if (removed) URL.revokeObjectURL(removed.objectUrl);
    setAttachments((current) =>
      new Map(current).set(
        selectedKey,
        files.filter((file) => file.id !== id),
      ),
    );
  };
  const setColumnVisible = (col: number, visible: boolean) => {
    if (col < 3) return;
    setHidden((current) => {
      const next = new Set(current);
      if (visible) next.delete(col);
      else next.add(col);
      return next;
    });
    if (!visible && (range.focus.col === col || range.anchor.col === col))
      select({ row: range.focus.row, col: 2 });
  };
  const toggleColumns = () => {
    if (!collapsedColumns && range.focus.col > 3)
      select({ row: range.focus.row, col: 3 });
    setCollapsedColumns((current) => !current);
  };
  const selectedHistory = selectedRow
    ? transactions
        .flatMap((transaction) =>
          transaction.patches
            .filter(
              (patch) =>
                patch.recordId === selectedRow.sourceNodes[0].id &&
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
    : [];
  return {
    data,
    gridRef,
    range,
    setRange,
    select,
    editing,
    setEditing,
    startEdit,
    finishEdit,
    busy: busy || preparing,
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
    undo,
    redo,
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
    searchText,
    setSearchText,
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
