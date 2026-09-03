import {
  BUSINESS_ROW_DIMENSION_KEYS,
  COLUMNS,
  businessRowDimensionKey,
  getBusinessColumnDimension,
  getBusinessColumnIndex,
  getCellSourceNode,
  getCellSourceRowDimension,
  isHierarchyField,
  type BusinessColumnDimension,
  type BusinessRowDimension,
  type ViewRow,
} from './model';

/**
 * 前后台共用的业务单元格坐标。
 *
 * row 来自 BUSINESS_DATA 的 children 路径；column 来自
 * BUSINESS_COLUMN_DATA 的 children 路径。两者都不依赖易变的物理行列号。
 */
export type BusinessCellDimension = {
  row: BusinessRowDimension;
  column: BusinessColumnDimension;
};

export type BusinessCellLocation = {
  row: number;
  col: number;
  projectionRowId: string;
  productId: string;
  productParentId: string | null;
  regionRootId: string;
  regionDepth: 0 | 1;
};

export function isBusinessRowDimension(
  value: unknown,
): value is BusinessRowDimension {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (
    !keys.length ||
    keys.some(
      (key) =>
        !BUSINESS_ROW_DIMENSION_KEYS.includes(
          key as keyof BusinessRowDimension,
        ),
    )
  )
    return false;
  if (typeof row.category !== 'string' || !row.category.trim()) return false;
  return keys.every(
    (key) => typeof row[key] === 'string' && Boolean(String(row[key]).trim()),
  );
}

export function businessRowDimensionsEqual(
  left: BusinessRowDimension,
  right: BusinessRowDimension,
) {
  return businessRowDimensionKey(left) === businessRowDimensionKey(right);
}

/** Worksheet 单元格 -> 后台业务维度。 */
export function toBusinessCellDimension(
  row: ViewRow | undefined,
  col: number,
): BusinessCellDimension | null {
  const column = COLUMNS[col];
  const sourceNode = getCellSourceNode(row, col);
  if (!row || !column || isHierarchyField(column.field) || !sourceNode)
    return null;
  const columnDimension = getBusinessColumnDimension(column.field);
  const rowDimension = getCellSourceRowDimension(row, col);
  if (!columnDimension || !rowDimension) return null;
  return {
    row: rowDimension,
    column: [...columnDimension],
  };
}

export function isBusinessCellDimension(
  value: unknown,
): value is BusinessCellDimension {
  if (!value || typeof value !== 'object') return false;
  const dimension = value as Partial<BusinessCellDimension>;
  if (
    !isBusinessRowDimension(dimension.row) ||
    !Array.isArray(dimension.column) ||
    !dimension.column.length ||
    !dimension.column.every(
      (segment) => typeof segment === 'string' && Boolean(segment.trim()),
    )
  )
    return false;
  const col = getBusinessColumnIndex(dimension.column);
  return col >= 0 && !isHierarchyField(COLUMNS[col].field);
}

function matchesCanonicalProjection(
  row: ViewRow,
  dimension: BusinessRowDimension,
) {
  const product = dimension.subcategory ?? dimension.category;
  if (row.productLabel !== product) return false;
  if (dimension.region && row.regionRootLabel !== dimension.region)
    return false;
  if (dimension.detail) return row.regionLabel === dimension.detail;
  return !dimension.region || row.regionDepth === 0;
}

/** 后台行维、列维 -> 当前投影中的物理单元格。 */
export function resolveBusinessCellDimension(
  rows: readonly ViewRow[],
  dimension: BusinessCellDimension,
): BusinessCellLocation | null {
  if (!isBusinessCellDimension(dimension)) return null;
  const col = getBusinessColumnIndex(dimension.column);
  if (col < 0 || isHierarchyField(COLUMNS[col].field)) return null;

  const candidates = rows
    .map((candidate, row) => ({ candidate, row }))
    .filter(({ candidate }) => {
      const candidateDimension = getCellSourceRowDimension(candidate, col);
      return (
        candidateDimension &&
        businessRowDimensionsEqual(candidateDimension, dimension.row)
      );
    });
  const matched =
    candidates.find(({ candidate }) =>
      matchesCanonicalProjection(candidate, dimension.row),
    ) ?? candidates[0];
  if (!matched) return null;

  return {
    row: matched.row,
    col,
    projectionRowId: matched.candidate.id,
    productId: matched.candidate.productId,
    productParentId: matched.candidate.productParentId,
    regionRootId: matched.candidate.regionRootId,
    regionDepth: matched.candidate.regionDepth,
  };
}

export function describeBusinessCellDimension(
  dimension: BusinessCellDimension,
) {
  const col = getBusinessColumnIndex(dimension.column);
  const rowPath = BUSINESS_ROW_DIMENSION_KEYS.flatMap((key) => {
    const value = dimension.row[key];
    return value ? [value] : [];
  });
  const columnLabel = col >= 0 ? COLUMNS[col].label : dimension.column.at(-1);
  return [...rowPath, columnLabel].filter(Boolean).join(' / ');
}
