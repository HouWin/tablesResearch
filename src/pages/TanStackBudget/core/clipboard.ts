import { COLUMNS, formattedValue, rawValue } from './columns';
import type { BudgetRow } from './types';

/** Excel TSV supports tabs, quotes and newlines inside quoted fields. */
export function parseTsv(text: string, maxCells = Infinity): string[][] {
  if (text.length > 8 * 1024 * 1024)
    throw new Error('粘贴内容过大，请分批粘贴。');
  const result: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let cells = 0;
  const append = () => {
    if (++cells > maxCells)
      throw new Error(
        `粘贴内容超过单次 ${maxCells.toLocaleString()} 个单元格限制，请分批粘贴。`,
      );
    row.push(value);
    value = '';
  };
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"' && (quoted || value === '')) {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && (char === '\t' || char === '\n')) {
      append();
      if (char === '\n') {
        result.push(row);
        row = [];
      }
    } else value += char;
  }
  if (value !== '' || row.length || !result.length) {
    append();
    result.push(row);
  }
  return result;
}
const quote = (value: unknown) =>
  /[\t\n\r"]/.test(String(value))
    ? `"${String(value).replace(/"/g, '""')}"`
    : String(value);
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
export function serializeRows(rows: BudgetRow[], columns: number[]) {
  return {
    text: rows
      .map((row) => columns.map((col) => quote(rawValue(row, col))).join('\t'))
      .join('\r\n'),
    html: `<table>${rows
      .map(
        (row) =>
          `<tr>${columns
            .map(
              (col) =>
                `<td style="${
                  col >= 3 ? 'mso-number-format:0.00;' : ''
                }background:${
                  col <= 2
                    ? '#eaf1fa'
                    : row.regionDepth === 0
                    ? '#fff4d5'
                    : '#ffffff'
                }">${escapeHtml(
                  formattedValue(rawValue(row, col), COLUMNS[col]),
                )}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('')}</table>`,
  };
}
/** Only shift references outside quoted strings; preserve absolute row/column markers. */
export function shiftFormula(formula: string, rows: number, cols: number) {
  return formula
    .split(/("(?:[^"]|"")*")/g)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(
            /(?<![\w.])(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)\b(?!\s*\()/gi,
            (
              _,
              absoluteCol: string,
              letters: string,
              absoluteRow: string,
              digits: string,
            ) => {
              let col =
                [...letters.toUpperCase()].reduce(
                  (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
                  0,
                ) + (absoluteCol ? 0 : cols);
              const row = Number(digits) + (absoluteRow ? 0 : rows);
              if (col < 1 || row < 1) return '#REF!';
              let name = '';
              while (col) {
                col -= 1;
                name = String.fromCharCode(65 + (col % 26)) + name;
                col = Math.floor(col / 26);
              }
              return `${absoluteCol}${name}${absoluteRow}${row}`;
            },
          ),
    )
    .join('');
}
