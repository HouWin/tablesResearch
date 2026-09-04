/**
 * 已编辑单元格标记（cellDirtyMark.ts）
 *
 * 单元格被修改后打上视觉标记：浅橙底 + 左侧色条。
 * 与 cellHistory 联动；clearTracks 时一并清除。
 *
 * 注意：标记通过 setValue 写入样式，会进入 Univer 撤销栈。
 * 写入后必须 discard 掉这些撤销项，否则「回撤」会先撤标记、值不变。
 */
import { BorderStyleTypes, IUndoRedoService, VerticalAlign } from '@univerjs/core';

export const DIRTY_CELL_BG = '#FFF7E6';
export const DIRTY_CELL_BORDER = '#FA8C16';

type DirtyBackup = {
  v: unknown;
  s: Record<string, unknown> | null;
};

const dirtyKeys = new Set<string>();
const dirtyBackup = new Map<string, DirtyBackup>();

/** 由 setupCellHistory 注入，用于丢弃脏标记产生的撤销项 */
let dirtyMarkUniverAPI: any = null;

export const bindDirtyMarkHost = (univerAPI: any): void => {
  dirtyMarkUniverAPI = univerAPI;
};

const cellKey = (row: number, column: number) => `${row}:${column}`;

const getUniverInjector = (univerAPI: any) =>
  univerAPI?.__getInjector?.() ||
  univerAPI?.getGlobalContext?.()?.injector ||
  univerAPI?._injector;

const resolveUnitId = (worksheet: any): string | null => {
  try {
    return (
      worksheet?.getWorkbook?.()?.getUnitId?.() ||
      worksheet?.getWorkbook?.()?.getId?.() ||
      dirtyMarkUniverAPI?.getActiveWorkbook?.()?.getId?.() ||
      dirtyMarkUniverAPI?.getActiveWorkbook?.()?.getUnitId?.() ||
      null
    );
  } catch {
    return null;
  }
};

const getUndoStackLength = (unitId: string): number => {
  try {
    const injector = getUniverInjector(dirtyMarkUniverAPI);
    if (!injector || !unitId) {
      return 0;
    }
    const undoService = injector.get(IUndoRedoService) as {
      _undoStacks?: Map<string, unknown[]>;
    };
    return undoService._undoStacks?.get(unitId)?.length ?? 0;
  } catch {
    return 0;
  }
};

/** 丢弃脏标记写入产生的撤销项（不执行 undo，只弹栈） */
const discardUndoEntriesAfter = (unitId: string | null, beforeLength: number) => {
  if (!unitId) {
    return;
  }
  try {
    const injector = getUniverInjector(dirtyMarkUniverAPI);
    if (!injector) {
      return;
    }
    const undoService = injector.get(IUndoRedoService) as {
      _undoStacks?: Map<string, unknown[]>;
      _updateStatus?: () => void;
    };
    const stack = undoService._undoStacks?.get(unitId);
    if (!stack?.length || stack.length <= beforeLength) {
      return;
    }
    stack.length = beforeLength;
    undoService._updateStatus?.();
  } catch (error) {
    console.warn('[ETable] discard dirty-mark undo failed', error);
  }
};

/**
 * 执行会触发 setValue 的写入，但不保留到 Univer 撤销栈。
 * 用于脏标记 / 值回撤，避免「回撤」撤到样式或其它操作。
 */
export const runSheetWriteWithoutUndo = (
  worksheet: any,
  write: () => void,
): void => {
  const unitId = resolveUnitId(worksheet);
  const before = unitId ? getUndoStackLength(unitId) : 0;
  write();
  discardUndoEntriesAfter(unitId, before);
};

const withSilentUndo = runSheetWriteWithoutUndo;

const readCellPayload = (worksheet: any, row: number, column: number) => {
  try {
    const range = worksheet?.getRange?.(row, column);
    const raw =
      typeof range?.getCellData === 'function' ? range.getCellData() : null;
    if (raw && typeof raw === 'object') {
      return {
        range,
        v: (raw as { v?: unknown }).v ?? null,
        s:
          (raw as { s?: unknown }).s &&
          typeof (raw as { s?: unknown }).s === 'object'
            ? ({ ...(raw as { s: Record<string, unknown> }).s } as Record<
                string,
                unknown
              >)
            : null,
      };
    }
    return {
      range,
      v: typeof range?.getValue === 'function' ? range.getValue() : null,
      s: null,
    };
  } catch {
    return { range: null, v: null, s: null };
  }
};

const buildDirtyStyle = (prev: Record<string, unknown> | null) => {
  const base = { ...(prev || {}) };
  const prevBd =
    base.bd && typeof base.bd === 'object'
      ? ({ ...(base.bd as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  return {
    ...base,
    vt: (base.vt as number | undefined) ?? VerticalAlign.MIDDLE,
    bg: { rgb: DIRTY_CELL_BG },
    bd: {
      ...prevBd,
      l: {
        s: BorderStyleTypes.THICK,
        cl: { rgb: DIRTY_CELL_BORDER },
      },
    },
  };
};

/** 标记单元格为已修改 */
export const markDirtyCell = (
  worksheet: any,
  row: number,
  column: number,
): void => {
  if (!worksheet || typeof row !== 'number' || typeof column !== 'number') {
    return;
  }
  const key = cellKey(row, column);
  const { range, v, s } = readCellPayload(worksheet, row, column);
  if (!range?.setValue) {
    return;
  }
  if (!dirtyBackup.has(key)) {
    dirtyBackup.set(key, { v, s });
  }
  dirtyKeys.add(key);
  withSilentUndo(worksheet, () => {
    try {
      range.setValue({
        v,
        s: buildDirtyStyle(s),
      });
    } catch (error) {
      console.warn('[ETable] markDirtyCell failed', { row, column, error });
    }
  });
};

/** 清除单个单元格修改标记（尽量恢复标记前样式） */
export const clearDirtyCell = (
  worksheet: any,
  row: number,
  column: number,
): void => {
  const key = cellKey(row, column);
  if (!dirtyKeys.has(key)) {
    return;
  }
  const backup = dirtyBackup.get(key);
  dirtyKeys.delete(key);
  dirtyBackup.delete(key);
  withSilentUndo(worksheet, () => {
    try {
      const range = worksheet?.getRange?.(row, column);
      if (!range?.setValue) {
        return;
      }
      const current = readCellPayload(worksheet, row, column);
      range.setValue({
        v: current.v,
        s: backup?.s ?? undefined,
      });
    } catch (error) {
      console.warn('[ETable] clearDirtyCell failed', { row, column, error });
    }
  });
};

/** 清除全部修改标记 */
export const clearAllDirtyMarks = (worksheet: any): void => {
  const keys = [...dirtyKeys];
  const unitId = resolveUnitId(worksheet);
  const before = unitId ? getUndoStackLength(unitId) : 0;
  keys.forEach((key) => {
    const [rowText, colText] = key.split(':');
    const row = Number(rowText);
    const column = Number(colText);
    if (!Number.isFinite(row) || !Number.isFinite(column)) {
      return;
    }
    const backup = dirtyBackup.get(key);
    dirtyKeys.delete(key);
    dirtyBackup.delete(key);
    try {
      const range = worksheet?.getRange?.(row, column);
      if (!range?.setValue) {
        return;
      }
      const current = readCellPayload(worksheet, row, column);
      range.setValue({
        v: current.v,
        s: backup?.s ?? undefined,
      });
    } catch (error) {
      console.warn('[ETable] clearDirtyCell failed', { row, column, error });
    }
  });
  dirtyKeys.clear();
  dirtyBackup.clear();
  discardUndoEntriesAfter(unitId, before);
};

export const isDirtyCell = (row: number, column: number): boolean =>
  dirtyKeys.has(cellKey(row, column));

export const getDirtyCellCount = (): number => dirtyKeys.size;
