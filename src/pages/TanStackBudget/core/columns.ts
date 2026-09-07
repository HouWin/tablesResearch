import {
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  COLUMN_HEADER_CELLS,
  columnName,
  type ColumnDefinition,
} from '../../SpreadJSDemo/spreadsheet/model';
import type { BudgetRow } from './types';

export { BUSINESS_COLUMN_DATA, COLUMNS, COLUMN_HEADER_CELLS };
const decimalFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});
export const columnLabel = (col: number) =>
  COLUMNS[col]?.type === 'value'
    ? `${col === 3 ? '全年合计' : `${col - 3}月`} · 金额`
    : COLUMNS[col]?.label ?? '';
export const cellAddress = (row: number, col: number) =>
  `${columnName(col)}${row + 1}`;
export const cellKey = (row: BudgetRow, col: number) =>
  `${col === 0 ? row.productId : row.sourceNodes[0].id}/${COLUMNS[col].id}`;

export function rawValue(row: BudgetRow, col: number): string | number {
  if (col === 0) return row.productLabel;
  if (col === 1) return row.regionLabel;
  return row[COLUMNS[col].field as 'functionalAttribute'] ?? '';
}
export function formattedValue(value: unknown, column: ColumnDefinition) {
  if (value == null) return '';
  if (typeof value !== 'number') return String(value);
  switch (column.format) {
    case 'decimal':
      return decimalFormatter.format(value);
    case 'integer':
      return integerFormatter.format(Math.round(value));
    case 'currency':
      return `¥${integerFormatter.format(Math.round(value))}`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    default:
      return String(value);
  }
}
