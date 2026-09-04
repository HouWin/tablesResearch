/**
 * 按行维 / 列维 / rowId 定位单元格（对接后端回写）。
 */
import type {
  ETableCell,
  ETableCellLocator,
  ETableColumn,
  ETableDimensionCellLocator,
  ETableDimensionMatch,
  ETablePrimitive,
  ETableRow,
} from './types';

const toPrimitive = (value: ETablePrimitive | ETableCell | undefined): ETablePrimitive => {
  if (value === undefined) {
    return undefined;
  }
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return (value as ETableCell).value;
  }
  return value as ETablePrimitive;
};

const stripMatchValue = (value: ETablePrimitive | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/^[▼▶]\s*/, '').trim();
};

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

const matchDimensionConstraint = (
  row: ETableRow,
  match: ETableDimensionMatch,
): boolean => {
  const context = row.dimensionContext;
  const field = match.field;

  if (match.id !== undefined && match.id !== null && String(match.id) !== '') {
    const idText = String(match.id);
    if (row.id === idText) {
      return true;
    }
    if (context) {
      if (field) {
        const byField = context[`${field}Id`];
        if (byField !== undefined && String(byField) === idText) {
          return true;
        }
      } else {
        const hit = Object.entries(context).some(
          ([key, value]) => key.endsWith('Id') && String(value) === idText,
        );
        if (hit) {
          return true;
        }
      }
    }
    return false;
  }

  if (match.value !== undefined && match.value !== null && match.value !== '') {
    const want = stripMatchValue(match.value);
    if (!want) {
      return true;
    }
    if (context && field) {
      const raw = context[field];
      if (raw !== undefined && stripMatchValue(raw) === want) {
        return true;
      }
    }
    if (field && row.data?.[field] !== undefined) {
      return stripMatchValue(toPrimitive(row.data[field])) === want;
    }
    return false;
  }

  return true;
};

const resolveLeafFieldFromDimensions = (
  locator: ETableDimensionCellLocator,
  leafColumns: ETableColumn[],
): string | null => {
  const tryField = (candidate: string | undefined | null): string | null => {
    if (!candidate) {
      return null;
    }
    if (leafColumns.some((col) => col.id === candidate)) {
      return candidate;
    }
    // 拼接 id：year/m1 → 取最后一段 m1
    const parts = candidate.split(/[/|]/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && leafColumns.some((col) => col.id === last)) {
      return last;
    }
    return null;
  };

  const fromField = tryField(locator.field ?? locator.columnId);
  if (fromField) {
    return fromField;
  }

  const dims = locator.columnDimensions;
  if (!dims?.length) {
    return null;
  }
  for (let i = dims.length - 1; i >= 0; i -= 1) {
    const hit = tryField(dims[i].id || dims[i].field);
    if (hit) {
      return hit;
    }
  }
  return null;
};

const rowMatchesDimensions = (
  row: ETableRow,
  locator: ETableDimensionCellLocator,
): boolean => {
  if (locator.rowId) {
    if (row.id === locator.rowId) {
      return true;
    }
    // 拼接 rowId：…/hj-sales-office → 末段与 row.id 匹配
    const parts = String(locator.rowId).split(/[/|]/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && row.id === last) {
      return true;
    }
    // 整段路径与 dimensionContext *Id 拼接一致
    const context = row.dimensionContext;
    if (context) {
      const idParts = Object.entries(context)
        .filter(([key]) => key.endsWith('Id'))
        .map(([, value]) => String(value));
      // 顺序不保证，改为：locator 的每一段都能在 context/row.id 中找到
      const haystack = new Set([row.id, ...idParts]);
      if (parts.length && parts.every((p) => haystack.has(p))) {
        return true;
      }
    }
    return false;
  }
  const dims = locator.rowDimensions;
  if (!dims?.length) {
    return false;
  }
  return dims.every((item) => matchDimensionConstraint(row, item));
};

/**
 * 按 rowId / 行列维度定位到 { dataRow, field }。
 * 与 onCellChange 回传的 rowDimensions / columnDimensions / rowId 对齐。
 */
export const resolveDimensionCellLocator = (
  locator: ETableDimensionCellLocator,
  rows: ETableRow[],
  leafColumns: ETableColumn[],
  headerDepth: number,
): {
  dataRow: number;
  field: string;
  sheetRow: number;
  column: number;
  cell: string;
  rowId?: string;
} | null => {
  const field = resolveLeafFieldFromDimensions(locator, leafColumns);
  if (!field) {
    return null;
  }
  if (!locator.rowId && !locator.rowDimensions?.length) {
    return null;
  }

  const dataRow = rows.findIndex((row) => rowMatchesDimensions(row, locator));
  if (dataRow < 0) {
    return null;
  }

  const column = leafColumns.findIndex((item) => item.id === field);
  if (column < 0) {
    return null;
  }
  const sheetRow = headerDepth + dataRow;

  return {
    dataRow,
    field,
    sheetRow,
    column,
    cell: `${columnName(column)}${sheetRow + 1}`,
    rowId: rows[dataRow]?.id,
  };
};

export const isDimensionCellLocator = (
  locator: ETableCellLocator,
): locator is ETableDimensionCellLocator => {
  if (!locator || typeof locator !== 'object') {
    return false;
  }
  if ('dataRow' in locator || 'sheetRow' in locator) {
    return false;
  }
  return (
    'rowId' in locator ||
    'rowDimensions' in locator ||
    'columnDimensions' in locator ||
    'columnId' in locator
  );
};
