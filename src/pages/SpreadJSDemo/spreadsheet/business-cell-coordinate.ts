import {
  COLUMNS,
  isHierarchyField,
  type BusinessField,
  type DataMode,
  type ViewRow,
} from './model';

/**
 * 回调和后台定位共用的扁平业务维度。
 * label 仅用于展示，定位只使用其余稳定 ID 与 metricField。
 */
export type BusinessCellDimension = {
  label: string;
  dataset: Exclude<DataMode, 'loading'>;
  recordId: string;
  metricField: BusinessField;
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

export function toBusinessCellDimension(
  row: ViewRow | undefined,
  col: number,
  dataset: Exclude<DataMode, 'loading'>,
): BusinessCellDimension | null {
  const column = COLUMNS[col];
  const sourceNode = row?.sourceNodes.length === 1 ? row.sourceNodes[0] : null;
  if (!row || !column || isHierarchyField(column.field) || !sourceNode)
    return null;
  return {
    label: [row.productLabel, row.regionLabel, column.label].join(' / '),
    dataset,
    recordId: sourceNode.id,
    metricField: column.field,
  };
}

export function isBusinessCellDimension(
  value: unknown,
): value is BusinessCellDimension {
  if (!value || typeof value !== 'object') return false;
  const dimension = value as Partial<BusinessCellDimension>;
  return (
    typeof dimension.label === 'string' &&
    (dimension.dataset === 'regular' || dimension.dataset === 'stress') &&
    typeof dimension.recordId === 'string' &&
    typeof dimension.metricField === 'string' &&
    COLUMNS.some(
      (column) =>
        !isHierarchyField(column.field) &&
        column.field === dimension.metricField,
    )
  );
}

/** 后台把回调中的 dimension 原样传回，即可反向定位。 */
export function resolveBusinessCellDimension(
  rows: readonly ViewRow[],
  dimension: BusinessCellDimension,
): BusinessCellLocation | null {
  if (!isBusinessCellDimension(dimension)) return null;
  const col = COLUMNS.findIndex(
    (column) => column.field === dimension.metricField,
  );
  if (col < 0 || isHierarchyField(COLUMNS[col].field)) return null;
  const row = rows.findIndex(
    (candidate) =>
      candidate.sourceNodes.length === 1 &&
      candidate.sourceNodes[0].id === dimension.recordId,
  );
  if (row < 0) return null;
  const match = rows[row];
  return {
    row,
    col,
    projectionRowId: match.id,
    productId: match.productId,
    productParentId: match.productParentId,
    regionRootId: match.regionRootId,
    regionDepth: match.regionDepth,
  };
}
