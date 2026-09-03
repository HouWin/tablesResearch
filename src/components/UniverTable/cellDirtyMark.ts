/**
 * 已编辑单元格标记（cellDirtyMark.ts）
 *
 * 单元格被修改后打上视觉标记：浅橙底 + 左侧色条。
 * 与 cellHistory 联动；clearTracks 时一并清除。
 */
import { BorderStyleTypes, VerticalAlign } from '@univerjs/core';

export const DIRTY_CELL_BG = '#FFF7E6';
export const DIRTY_CELL_BORDER = '#FA8C16';

type DirtyBackup = {
  v: unknown;
  s: Record<string, unknown> | null;
};

const dirtyKeys = new Set<string>();
const dirtyBackup = new Map<string, DirtyBackup>();

const cellKey = (row: number, column: number) => `${row}:${column}`;

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
  try {
    range.setValue({
      v,
      s: buildDirtyStyle(s),
    });
  } catch (error) {
    console.warn('[ETable] markDirtyCell failed', { row, column, error });
  }
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
};

/** 清除全部修改标记 */
export const clearAllDirtyMarks = (worksheet: any): void => {
  const keys = [...dirtyKeys];
  keys.forEach((key) => {
    const [rowText, colText] = key.split(':');
    const row = Number(rowText);
    const column = Number(colText);
    if (Number.isFinite(row) && Number.isFinite(column)) {
      clearDirtyCell(worksheet, row, column);
    }
  });
  dirtyKeys.clear();
  dirtyBackup.clear();
};

export const isDirtyCell = (row: number, column: number): boolean =>
  dirtyKeys.has(cellKey(row, column));

export const getDirtyCellCount = (): number => dirtyKeys.size;
