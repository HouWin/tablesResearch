/**
 * 单元格编辑历史（cellHistory.ts）
 *
 * 监听 Univer 事件记录变更，供 onCellChange / 右键「查看单元格历史」使用：
 * - SheetEditStarted / SheetEditEnded：普通编辑
 * - BeforeCommandExecute + SheetValueChanged / CommandExecuted：
 *   下拉/日期等数据验证选值（走 set-range-values，不进编辑态）
 * - SelectionChanged / CellClicked：触发 onSelectionChange
 *
 * from/to 为字符串化显示值（含数字格式如 ¥20,000），非原始 number。
 */
import type { ETableCellChangeRecord } from './types';
import {
  bindDirtyMarkHost,
  clearAllDirtyMarks,
  clearDirtyCell,
  markDirtyCell,
  runSheetWriteWithoutUndo,
} from './cellDirtyMark';

const SET_RANGE_VALUES_COMMAND_ID = 'sheet.command.set-range-values';
const SET_RANGE_VALUES_MUTATION_ID = 'sheet.mutation.set-range-values';

const columnName = (column: number): string => {
  let result = '';
  let value = column + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const cellAddress = (row: number, column: number) =>
  `${columnName(column)}${row + 1}`;

const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; value?: unknown };
    if (obj.v !== undefined) {
      return String(obj.v ?? '');
    }
    if (obj.value !== undefined) {
      return String(obj.value ?? '');
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const readCellValue = (worksheet: any, row: number, column: number): string => {
  try {
    const range = worksheet?.getRange?.(row, column);
    const value = range?.getValue?.() ?? range?.getCellData?.()?.v;
    return normalizeValue(value);
  } catch {
    return '';
  }
};

const isSetRangeValuesId = (id: unknown): boolean =>
  id === SET_RANGE_VALUES_COMMAND_ID ||
  id === SET_RANGE_VALUES_MUTATION_ID ||
  (typeof id === 'string' && id.endsWith('set-range-values'));

/**
 * 从 command（range+value）或 mutation（cellValue 矩阵）解析受影响单元格。
 */
const extractCellsFromSetRangeParams = (
  params: any,
): Array<{ row: number; column: number }> => {
  if (!params || typeof params !== 'object') {
    return [];
  }

  const cells: Array<{ row: number; column: number }> = [];

  const range = params.range;
  if (range && typeof range === 'object' && !Array.isArray(range)) {
    const startRow = range.startRow ?? range.row;
    const startColumn = range.startColumn ?? range.column;
    const endRow = range.endRow ?? startRow;
    const endColumn = range.endColumn ?? startColumn;
    if (
      typeof startRow === 'number' &&
      typeof startColumn === 'number' &&
      startRow === endRow &&
      startColumn === endColumn
    ) {
      cells.push({ row: startRow, column: startColumn });
    }
  }

  const cellValue = params.cellValue;
  if (cellValue && typeof cellValue === 'object') {
    Object.keys(cellValue).forEach((rowKey) => {
      const row = Number(rowKey);
      if (!Number.isFinite(row)) {
        return;
      }
      const rowMap = cellValue[rowKey];
      if (!rowMap || typeof rowMap !== 'object') {
        return;
      }
      Object.keys(rowMap).forEach((colKey) => {
        const column = Number(colKey);
        if (!Number.isFinite(column)) {
          return;
        }
        cells.push({ row, column });
      });
    });
  }

  const seen = new Set<string>();
  return cells.filter((cell) => {
    const key = `${cell.row}:${cell.column}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** 折叠图标切换（▼/▶）不算业务值变更 */
const isTreeToggleOnlyChange = (from: string, to: string): boolean => {
  const strip = (value: string) => value.replace(/^[▼▶]\s*/, '').trim();
  if (!from && !to) {
    return false;
  }
  return (
    strip(from) === strip(to) &&
    (/^[▼▶]/.test(from) || /^[▼▶]/.test(to))
  );
};

const resolveEffectedCellCoords = (
  fRange: any,
): Array<{ row: number; column: number }> => {
  try {
    if (typeof fRange?.getRow === 'function') {
      const startRow = fRange.getRow();
      const startColumn = fRange.getColumn();
      const height = fRange.getHeight?.() ?? 1;
      const width = fRange.getWidth?.() ?? 1;
      const cells: Array<{ row: number; column: number }> = [];
      for (let r = 0; r < height; r += 1) {
        for (let c = 0; c < width; c += 1) {
          cells.push({ row: startRow + r, column: startColumn + c });
        }
      }
      return cells;
    }
    const range =
      typeof fRange?.getRange === 'function' ? fRange.getRange() : fRange;
    if (!range) {
      return [];
    }
    const startRow = range.startRow ?? 0;
    const endRow = range.endRow ?? startRow;
    const startColumn = range.startColumn ?? 0;
    const endColumn = range.endColumn ?? startColumn;
    const cells: Array<{ row: number; column: number }> = [];
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        cells.push({ row, column });
      }
    }
    return cells;
  } catch {
    return [];
  }
};

export interface ETableCellHistoryApi {
  dispose: () => void;
  getTracks: () => ETableCellChangeRecord[];
  getCellHistory: (cell: string) => ETableCellChangeRecord[];
  clear: () => void;
  /**
   * 仅回撤最近一次单元格值修改（不走 Univer 全局 undo，避免撤到折叠/样式等操作）。
   */
  undoLastCellEdit: () => boolean;
  /** 回撤后按基线重对脏标记 */
  reconcileDirtyState: () => void;
  /** 程序化写入单元格时记录变更（source: 'api'） */
  recordChange: (
    row: number,
    column: number,
    from: string,
    to: string,
  ) => void;
}

/**
 * 监听单元格编辑，记录变更历史（数据追踪 / 单元格历史共用）。
 */
export const setupCellHistory = (
  univerAPI: any,
  worksheet: any,
  options?: {
    maxRecords?: number;
    /** 编辑后在单元格上打修改标记，默认 true */
    markEditedCells?: boolean;
    /** 只读单元格不记变更、不打修改底色 */
    isReadonlyCell?: (row: number, column: number) => boolean;
    onChange?: (record: ETableCellChangeRecord) => void;
    onSelectionChange?: (cell: string, row: number, column: number) => void;
  },
): ETableCellHistoryApi => {
  const maxRecords = options?.maxRecords ?? 200;
  const markEditedCells = options?.markEditedCells !== false;
  bindDirtyMarkHost(univerAPI);
  const tracks: ETableCellChangeRecord[] = [];
  const tracksByCell = new Map<string, ETableCellChangeRecord[]>();
  const disposables: Array<{ dispose?: () => void }> = [];
  const editing = new Map<string, string>();
  /** 下拉写入前 from 快照 */
  const pendingWriteFrom = new Map<string, string>();
  /** 选中/变更后缓存，供对比 */
  const knownValues = new Map<string, string>();
  /** 值回撤写入中，忽略由此触发的 SheetValueChanged */
  let applyingValueUndo = false;
  let lastPushFingerprint = '';
  let lastPushAt = 0;
  let selectionRaf = 0;
  let pendingSelection: { cell: string; row: number; column: number } | null =
    null;
  let lastNotifiedSelection: { row: number; column: number } | null = null;

  const cellKey = (row: number, column: number) => `${row}:${column}`;

  const rememberValue = (row: number, column: number, value?: string) => {
    knownValues.set(
      cellKey(row, column),
      value ?? readCellValue(worksheet, row, column),
    );
  };

  const notifySelection = (row: number, column: number) => {
    rememberValue(row, column);
    if (!options?.onSelectionChange) {
      return;
    }
    if (
      lastNotifiedSelection &&
      lastNotifiedSelection.row === row &&
      lastNotifiedSelection.column === column
    ) {
      return;
    }
    pendingSelection = { cell: cellAddress(row, column), row, column };
    if (selectionRaf) {
      return;
    }
    selectionRaf = requestAnimationFrame(() => {
      selectionRaf = 0;
      if (pendingSelection) {
        lastNotifiedSelection = {
          row: pendingSelection.row,
          column: pendingSelection.column,
        };
        options.onSelectionChange?.(
          pendingSelection.cell,
          pendingSelection.row,
          pendingSelection.column,
        );
        pendingSelection = null;
      }
    });
  };

  const removeFromCellIndex = (record: ETableCellChangeRecord) => {
    const list = tracksByCell.get(record.cell);
    if (!list) {
      return;
    }
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      list.splice(index, 1);
    }
    if (!list.length) {
      tracksByCell.delete(record.cell);
    }
  };

  const clearCellTracks = (cell: string) => {
    const list = tracksByCell.get(cell);
    if (!list?.length) {
      tracksByCell.delete(cell);
      return;
    }
    const ids = new Set(list.map((item) => item.id));
    for (let index = tracks.length - 1; index >= 0; index -= 1) {
      if (ids.has(tracks[index].id)) {
        tracks.splice(index, 1);
      }
    }
    tracksByCell.delete(cell);
  };

  const push = (
    row: number,
    column: number,
    from: string,
    to: string,
    source: ETableCellChangeRecord['source'] = 'edit',
  ) => {
    if (applyingValueUndo) {
      rememberValue(row, column, to);
      return;
    }
    if (from === to) {
      rememberValue(row, column, to);
      return;
    }
    // 只读格（维度列 / 汇总行 / editable:false）不记变更、不打修改底色
    if (options?.isReadonlyCell?.(row, column)) {
      rememberValue(row, column, to);
      return;
    }
    const fingerprint = `${row}:${column}:${from}=>${to}`;
    const now = Date.now();
    if (fingerprint === lastPushFingerprint && now - lastPushAt < 80) {
      rememberValue(row, column, to);
      return;
    }
    lastPushFingerprint = fingerprint;
    lastPushAt = now;

    const cell = cellAddress(row, column);
    const cellList = tracksByCell.get(cell) ?? [];
    // 最早一条的 from 即编辑前基线；回撤回到基线时清历史与脏标记
    const baseline = cellList.length ? cellList[cellList.length - 1].from : from;
    if (to === baseline) {
      clearCellTracks(cell);
      rememberValue(row, column, to);
      if (markEditedCells) {
        clearDirtyCell(worksheet, row, column);
      }
      options?.onChange?.({
        id: `${Date.now()}-${row}-${column}-undo`,
        cell,
        row,
        column,
        from,
        to,
        time: new Date().toLocaleTimeString(),
        source,
      });
      return;
    }

    const record: ETableCellChangeRecord = {
      id: `${Date.now()}-${row}-${column}-${Math.random().toString(36).slice(2, 7)}`,
      cell,
      row,
      column,
      from,
      to,
      time: new Date().toLocaleTimeString(),
      source,
    };
    tracks.unshift(record);
    const nextList = tracksByCell.get(record.cell) ?? [];
    nextList.unshift(record);
    tracksByCell.set(record.cell, nextList);
    if (tracks.length > maxRecords) {
      const dropped = tracks.pop();
      if (dropped) {
        removeFromCellIndex(dropped);
      }
    }
    rememberValue(row, column, to);
    if (markEditedCells) {
      markDirtyCell(worksheet, row, column);
    }
    options?.onChange?.(record);
  };

  const coerceUndoValue = (text: string): string | number => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) {
      return '';
    }
    const normalized = trimmed
      .replace(/,/g, '')
      .replace(/¥/g, '')
      .replace(/%/g, '')
      .trim();
    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      const num = Number(normalized);
      if (Number.isFinite(num)) {
        return trimmed.includes('%') ? num / 100 : num;
      }
    }
    return trimmed;
  };

  /**
   * 只回撤最近一次单元格值：写回 from，更新历史与脏标记。
   * 不调用 Univer undo，因此不会撤掉折叠/合并等操作。
   */
  const undoLastCellEdit = (): boolean => {
    const latest = tracks[0];
    if (!latest) {
      return false;
    }
    const range = worksheet?.getRange?.(latest.row, latest.column);
    if (!range?.setValue) {
      return false;
    }

    applyingValueUndo = true;
    try {
      const restoreValue = coerceUndoValue(latest.from);
      runSheetWriteWithoutUndo(worksheet, () => {
        try {
          range.setValue(restoreValue);
        } catch (error) {
          console.warn('[ETable] undoLastCellEdit setValue failed', error);
        }
      });

      tracks.shift();
      removeFromCellIndex(latest);
      rememberValue(latest.row, latest.column, latest.from);

      const remaining = tracksByCell.get(latest.cell);
      if (markEditedCells) {
        if (!remaining?.length) {
          clearDirtyCell(worksheet, latest.row, latest.column);
        } else {
          markDirtyCell(worksheet, latest.row, latest.column);
        }
      }
      return true;
    } finally {
      applyingValueUndo = false;
    }
  };

  /** 回撤/外部改值后：按基线重对脏标记（值已还原的清掉，仍脏的重打） */
  const reconcileDirtyState = () => {
    if (!markEditedCells) {
      return;
    }
    const entries = [...tracksByCell.entries()];
    entries.forEach(([cell, list]) => {
      if (!list.length) {
        tracksByCell.delete(cell);
        return;
      }
      const { row, column } = list[0];
      const baseline = list[list.length - 1].from;
      const current = readCellValue(worksheet, row, column);
      if (current === baseline) {
        clearCellTracks(cell);
        clearDirtyCell(worksheet, row, column);
        rememberValue(row, column, current);
        return;
      }
      markDirtyCell(worksheet, row, column);
      rememberValue(row, column, current);
    });
  };

  const captureDropdownWriteFrom = (commandParams: any) => {
    const cells = extractCellsFromSetRangeParams(commandParams);
    // 下拉选值是单格；批量写入（视口/初始化）忽略
    if (cells.length !== 1) {
      return;
    }
    const cell = cells[0];
    const key = cellKey(cell.row, cell.column);
    if (editing.has(key)) {
      return;
    }
    if (!pendingWriteFrom.has(key)) {
      pendingWriteFrom.set(
        key,
        knownValues.get(key) ??
          readCellValue(worksheet, cell.row, cell.column),
      );
    }
  };

  const emitNonEditValueChange = (
    row: number,
    column: number,
    from: string,
  ) => {
    const key = cellKey(row, column);
    if (editing.has(key)) {
      return;
    }
    const to = readCellValue(worksheet, row, column);
    if (isTreeToggleOnlyChange(from, to)) {
      rememberValue(row, column, to);
      return;
    }
    push(row, column, from, to, 'edit');
  };

  const flushDropdownWriteChanges = () => {
    if (!pendingWriteFrom.size) {
      return;
    }
    const entries = [...pendingWriteFrom.entries()];
    pendingWriteFrom.clear();
    entries.forEach(([key, from]) => {
      const [rowText, columnText] = key.split(':');
      const row = Number(rowText);
      const column = Number(columnText);
      if (!Number.isFinite(row) || !Number.isFinite(column)) {
        return;
      }
      emitNonEditValueChange(row, column, from);
    });
  };

  const handleSheetValueChanged = (params: any) => {
    const ranges = params?.effectedRanges;
    if (!Array.isArray(ranges) || !ranges.length) {
      return;
    }
    ranges.forEach((fRange: any) => {
      const coords = resolveEffectedCellCoords(fRange);
      // 批量变更不走这里，避免视口刷新刷屏
      if (coords.length !== 1) {
        coords.forEach((cell) => rememberValue(cell.row, cell.column));
        return;
      }
      const cell = coords[0];
      const key = cellKey(cell.row, cell.column);
      if (editing.has(key)) {
        rememberValue(cell.row, cell.column);
        return;
      }
      const hadPending = pendingWriteFrom.has(key);
      const isActiveSelection =
        lastNotifiedSelection?.row === cell.row &&
        lastNotifiedSelection?.column === cell.column;
      if (!hadPending && !isActiveSelection) {
        rememberValue(cell.row, cell.column);
        return;
      }
      const from =
        pendingWriteFrom.get(key) ?? knownValues.get(key) ?? '';
      pendingWriteFrom.delete(key);
      emitNonEditValueChange(cell.row, cell.column, from);
    });
  };

  try {
    disposables.push(
      univerAPI.addEvent(univerAPI.Event.SheetEditStarted, (params: any) => {
        const row = params?.row;
        const column = params?.column;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        const value = readCellValue(worksheet, row, column);
        editing.set(cellKey(row, column), value);
        rememberValue(row, column, value);
      }),
    );
  } catch (error) {
    console.warn('[ETable] bind SheetEditStarted failed', error);
  }

  try {
    disposables.push(
      univerAPI.addEvent(univerAPI.Event.SheetEditEnded, (params: any) => {
        const row = params?.row;
        const column = params?.column;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        const key = cellKey(row, column);
        if (params?.isConfirm === false) {
          editing.delete(key);
          return;
        }
        const from = editing.get(key) ?? '';
        editing.delete(key);
        const to = readCellValue(worksheet, row, column);
        push(row, column, from, to, 'edit');
      }),
    );
  } catch (error) {
    console.warn('[ETable] bind SheetEditEnded failed', error);
  }

  try {
    if (univerAPI?.Event?.BeforeCommandExecute) {
      disposables.push(
        univerAPI.addEvent(
          univerAPI.Event.BeforeCommandExecute,
          (event: any) => {
            const id = event?.id ?? event?.commandId;
            if (!isSetRangeValuesId(id)) {
              return;
            }
            captureDropdownWriteFrom(event?.params ?? event);
          },
        ),
      );
    }
  } catch (error) {
    console.warn('[ETable] bind BeforeCommandExecute failed', error);
  }

  try {
    if (univerAPI?.Event?.SheetValueChanged) {
      disposables.push(
        univerAPI.addEvent(
          univerAPI.Event.SheetValueChanged,
          handleSheetValueChanged,
        ),
      );
    }
  } catch (error) {
    console.warn('[ETable] bind SheetValueChanged failed', error);
  }

  try {
    if (univerAPI?.Event?.CommandExecuted) {
      disposables.push(
        univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event: any) => {
          const id = event?.id ?? event?.commandId;
          if (!isSetRangeValuesId(id)) {
            return;
          }
          flushDropdownWriteChanges();
        }),
      );
    }
  } catch (error) {
    console.warn('[ETable] bind CommandExecuted failed', error);
  }

  try {
    disposables.push(
      univerAPI.addEvent(univerAPI.Event.SelectionChanged, (params: any) => {
        const selections = params?.selections || params?.selection;
        const first = Array.isArray(selections) ? selections[0] : selections;
        const range = first?.range || first;
        const row =
          range?.startRow ??
          range?.row ??
          first?.startRow ??
          params?.row;
        const column =
          range?.startColumn ??
          range?.column ??
          first?.startColumn ??
          params?.column;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        notifySelection(row, column);
      }),
    );
  } catch {
    // SelectionChanged 在部分版本不可用
  }

  try {
    disposables.push(
      univerAPI.addEvent(univerAPI.Event.CellClicked, (params: any) => {
        const row = params?.row ?? params?.location?.row;
        const column = params?.column ?? params?.col ?? params?.location?.col;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        notifySelection(row, column);
      }),
    );
  } catch {
    // ignore
  }

  return {
    dispose: () => {
      if (selectionRaf) {
        cancelAnimationFrame(selectionRaf);
        selectionRaf = 0;
      }
      pendingWriteFrom.clear();
      knownValues.clear();
      if (markEditedCells) {
        clearAllDirtyMarks(worksheet);
      }
      disposables.forEach((item) => {
        try {
          item.dispose?.();
        } catch {
          // ignore
        }
      });
    },
    getTracks: () => [...tracks],
    getCellHistory: (cell: string) => tracksByCell.get(cell) ?? [],
    clear: () => {
      tracks.length = 0;
      tracksByCell.clear();
      if (markEditedCells) {
        clearAllDirtyMarks(worksheet);
      }
    },
    undoLastCellEdit,
    reconcileDirtyState,
    recordChange: (row, column, from, to) => {
      push(row, column, from, to, 'api');
    },
  };
};
