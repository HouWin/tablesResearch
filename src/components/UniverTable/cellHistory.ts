import type { ETableCellChangeRecord } from './types';

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

export interface ETableCellHistoryApi {
  dispose: () => void;
  getTracks: () => ETableCellChangeRecord[];
  getCellHistory: (cell: string) => ETableCellChangeRecord[];
  clear: () => void;
}

/**
 * 监听单元格编辑，记录变更历史（数据追踪 / 单元格历史共用）。
 */
export const setupCellHistory = (
  univerAPI: any,
  worksheet: any,
  options?: {
    maxRecords?: number;
    onChange?: (record: ETableCellChangeRecord) => void;
    onSelectionChange?: (cell: string, row: number, column: number) => void;
  },
): ETableCellHistoryApi => {
  const maxRecords = options?.maxRecords ?? 200;
  const tracks: ETableCellChangeRecord[] = [];
  const disposables: Array<{ dispose?: () => void }> = [];
  const editing = new Map<string, string>();

  const push = (
    row: number,
    column: number,
    from: string,
    to: string,
    source: ETableCellChangeRecord['source'] = 'edit',
  ) => {
    if (from === to) {
      return;
    }
    const record: ETableCellChangeRecord = {
      id: `${Date.now()}-${row}-${column}-${Math.random().toString(36).slice(2, 7)}`,
      cell: cellAddress(row, column),
      row,
      column,
      from,
      to,
      time: new Date().toLocaleTimeString(),
      source,
    };
    tracks.unshift(record);
    if (tracks.length > maxRecords) {
      tracks.length = maxRecords;
    }
    options?.onChange?.(record);
  };

  try {
    disposables.push(
      univerAPI.addEvent(univerAPI.Event.SheetEditStarted, (params: any) => {
        const row = params?.row;
        const column = params?.column;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        editing.set(`${row}:${column}`, readCellValue(worksheet, row, column));
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
        if (params?.isConfirm === false) {
          editing.delete(`${row}:${column}`);
          return;
        }
        const key = `${row}:${column}`;
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
        options?.onSelectionChange?.(cellAddress(row, column), row, column);
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
        options?.onSelectionChange?.(cellAddress(row, column), row, column);
      }),
    );
  } catch {
    // ignore
  }

  return {
    dispose: () => {
      disposables.forEach((item) => {
        try {
          item.dispose?.();
        } catch {
          // ignore
        }
      });
    },
    getTracks: () => [...tracks],
    getCellHistory: (cell: string) => tracks.filter((item) => item.cell === cell),
    clear: () => {
      tracks.length = 0;
    },
  };
};
