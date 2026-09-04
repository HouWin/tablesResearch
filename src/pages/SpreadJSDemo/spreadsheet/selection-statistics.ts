import { MAX_SELECTION_INSPECTION_CELLS } from './constants';
import type { NumericDisplay, SelectionStats } from './model';

export type SelectionRange = {
  row: number;
  col: number;
  rowCount: number;
  colCount: number;
};

export type SelectionStatisticsOptions = {
  range: SelectionRange;
  worksheetRowCount: number;
  worksheetColumnCount: number;
  valueAt: (row: number, col: number) => unknown;
  displayAt: (col: number) => Exclude<NumericDisplay, 'mixed'>;
};

/**
 * 与 SpreadJS 解耦的选区统计器。控制器只负责提供单元格读取函数，方便
 * 常规数据、尚未写入 Worksheet 的压力数据以及后续服务端数据源共用。
 */
export function calculateSelectionStatistics({
  range,
  worksheetRowCount,
  worksheetColumnCount,
  valueAt,
  displayAt,
}: SelectionStatisticsOptions): SelectionStats {
  const startRow = Math.max(range.row, 0);
  const startCol = Math.max(range.col, 0);
  const rowCount = range.row < 0 ? worksheetRowCount : range.rowCount;
  const colCount = range.col < 0 ? worksheetColumnCount : range.colCount;
  const total = Math.max(0, rowCount * colCount);
  const inspectCount = Math.min(total, MAX_SELECTION_INSPECTION_CELLS);
  let numeric = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let numericDisplay: NumericDisplay | null = null;

  for (let offset = 0; offset < inspectCount; offset += 1) {
    const row = startRow + Math.floor(offset / colCount);
    const col = startCol + (offset % colCount);
    const value = valueAt(row, col);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const cellDisplay = displayAt(col);
    numericDisplay =
      numericDisplay === null
        ? cellDisplay
        : numericDisplay === cellDisplay
        ? numericDisplay
        : 'mixed';
    numeric += 1;
    sum += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return {
    cells: total,
    numeric,
    ignored: inspectCount - numeric,
    sum,
    average: numeric ? sum / numeric : 0,
    min: numeric ? min : 0,
    max: numeric ? max : 0,
    truncated: total > MAX_SELECTION_INSPECTION_CELLS,
    numericDisplay: numericDisplay ?? 'number',
  };
}
