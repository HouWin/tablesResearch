/**
 * 禁止编辑指定区域（表头、树形维度列、汇总行、单元格 editable:false 等）。
 *
 * - BeforeSheetEditStart：拦截双击 / 键入进入编辑
 * - BeforeCommandExecute：拦截 Backspace/Delete 触发的 clear-selection-*（不进入编辑态）
 *
 * 不影响程序化 setValue（折叠图标切换仍可用）。
 */

const CLEAR_CONTENT_COMMAND_IDS = new Set([
  'sheet.command.clear-selection-content',
  'sheet.command.clear-selection-all',
]);

type SheetRangeLike = {
  getRow?: () => number;
  getColumn?: () => number;
  getHeight?: () => number;
  getWidth?: () => number;
  getRange?: () => {
    startRow?: number;
    endRow?: number;
    startColumn?: number;
    endColumn?: number;
  };
};

const readRangeBounds = (
  range: SheetRangeLike | null | undefined,
): { startRow: number; endRow: number; startColumn: number; endColumn: number } | null => {
  if (!range) {
    return null;
  }
  try {
    const matrix = range.getRange?.();
    if (
      matrix &&
      typeof matrix.startRow === 'number' &&
      typeof matrix.endRow === 'number' &&
      typeof matrix.startColumn === 'number' &&
      typeof matrix.endColumn === 'number'
    ) {
      return {
        startRow: matrix.startRow,
        endRow: matrix.endRow,
        startColumn: matrix.startColumn,
        endColumn: matrix.endColumn,
      };
    }
  } catch {
    // fall through
  }

  try {
    const startRow = range.getRow?.();
    const startColumn = range.getColumn?.();
    if (typeof startRow !== 'number' || typeof startColumn !== 'number') {
      return null;
    }
    const height = Math.max(1, range.getHeight?.() ?? 1);
    const width = Math.max(1, range.getWidth?.() ?? 1);
    return {
      startRow,
      endRow: startRow + height - 1,
      startColumn,
      endColumn: startColumn + width - 1,
    };
  } catch {
    return null;
  }
};

const collectActiveRanges = (
  univerAPI: any,
  worksheet?: any,
): SheetRangeLike[] => {
  try {
    const sheet =
      worksheet ??
      univerAPI?.getActiveWorkbook?.()?.getActiveSheet?.() ??
      null;
    const selection = sheet?.getSelection?.();
    if (!selection) {
      return [];
    }

    const list =
      typeof selection.getActiveRangeList === 'function'
        ? selection.getActiveRangeList()
        : null;
    if (Array.isArray(list) && list.length) {
      return list;
    }

    const active =
      selection.getActiveRange?.() || selection.getRange?.() || null;
    return active ? [active] : [];
  } catch {
    return [];
  }
};

export const setupReadonlyCells = (
  univerAPI: any,
  options: {
    /** 当前工作表（用于读取选区；可省略，运行时从 activeSheet 取） */
    worksheet?: any;
    /** 表头占用行数（从 0 起） */
    headerRowCount: number;
    /** 不可编辑的列索引（0-based） */
    readonlyColumns: number[];
    /**
     * 不可编辑的数据行索引（相对数据区域，不含表头，0-based）。
     * 用于分组汇总行、总计行等。
     */
    readonlyDataRows?: number[];
    /** 汇总行等行级只读时仍允许编辑的列（如子品类） */
    editableOnReadonlyRowColumns?: number[];
    /** 视口投影等动态行映射场景下的只读判断 */
    isReadonlyDataRow?: (dataRow: number) => boolean;
    /** 单元格级只读（如 ETableCell.editable === false） */
    isReadonlyCell?: (sheetRow: number, column: number) => boolean;
    /** 数据总行数（含表头）；用于判断是否在表内 */
    totalRows?: number;
    totalColumns?: number;
  },
): (() => void) => {
  if (!univerAPI) {
    return () => {};
  }

  const readonlyColSet = new Set(options.readonlyColumns);
  const readonlyDataRowSet = new Set(options.readonlyDataRows ?? []);
  const editableOnReadonlyRowColSet = new Set(options.editableOnReadonlyRowColumns ?? []);
  const resolveReadonlyDataRow = options.isReadonlyDataRow;
  const resolveReadonlyCell = options.isReadonlyCell;
  const headerRowCount = Math.max(0, options.headerRowCount);
  const worksheet = options.worksheet;

  const isReadonly = (row: number, column: number) => {
    if (row < 0 || column < 0) {
      return false;
    }
    if (row < headerRowCount) {
      return true;
    }
    if (resolveReadonlyCell?.(row, column)) {
      return true;
    }
    const dataRow = row - headerRowCount;
    const rowReadonly =
      Boolean(resolveReadonlyDataRow?.(dataRow)) || readonlyDataRowSet.has(dataRow);
    if (rowReadonly) {
      if (editableOnReadonlyRowColSet.has(column)) {
        return false;
      }
      return true;
    }
    return readonlyColSet.has(column);
  };

  const selectionTouchesReadonly = (): boolean => {
    const ranges = collectActiveRanges(univerAPI, worksheet);
    for (let i = 0; i < ranges.length; i += 1) {
      const bounds = readRangeBounds(ranges[i]);
      if (!bounds) {
        continue;
      }
      for (let r = bounds.startRow; r <= bounds.endRow; r += 1) {
        for (let c = bounds.startColumn; c <= bounds.endColumn; c += 1) {
          if (isReadonly(r, c)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const disposables: Array<{ dispose?: () => void }> = [];

  try {
    disposables.push(
      univerAPI.addEvent(
        univerAPI.Event.BeforeSheetEditStart,
        (params: { row?: number; column?: number; cancel?: boolean }) => {
          const row = params?.row;
          const column = params?.column;
          if (typeof row !== 'number' || typeof column !== 'number') {
            return;
          }
          if (isReadonly(row, column)) {
            params.cancel = true;
          }
        },
      ),
    );
  } catch (error) {
    console.warn('[ETable] bind readonly BeforeSheetEditStart failed', error);
  }

  try {
    disposables.push(
      univerAPI.addEvent(
        univerAPI.Event.BeforeCommandExecute,
        (event: { id?: string; cancel?: boolean }) => {
          const commandId = event?.id;
          if (!commandId || !CLEAR_CONTENT_COMMAND_IDS.has(commandId)) {
            return;
          }
          if (selectionTouchesReadonly()) {
            event.cancel = true;
          }
        },
      ),
    );
  } catch (error) {
    console.warn('[ETable] bind readonly BeforeCommandExecute failed', error);
  }

  return () => {
    disposables.forEach((item) => {
      try {
        item?.dispose?.();
      } catch {
        // ignore
      }
    });
  };
};
