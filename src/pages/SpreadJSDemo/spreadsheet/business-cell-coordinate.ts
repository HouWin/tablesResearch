import {
  COLUMNS,
  businessRowDimensionKey,
  getBusinessColumnDimension,
  getBusinessColumnIndex,
  getCellSourceNode,
  getCellSourceRowDimension,
  isValueColumn,
  BUSINESS_DIMENSION_CODES,
  type BusinessColumnDimension,
  type BusinessRowDimension,
  type ViewRow,
} from './model';
import { hasExactDimensionCodes } from './business-dimensions';

/**
 * 前后台共用的业务单元格坐标。
 *
 * row 与 column 都只保存“维度编码 -> 成员编码”。双向定位不依赖复合
 * field、中文名称、树节点角色或 Worksheet 物理行列号。
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
  subjectRootId: string;
  subjectDepth: 0 | 1;
};

type BusinessRowLocation = Omit<BusinessCellLocation, 'col'>;

/**
 * 同一批投影行只建立一次行维索引。常规投影通常只有几十行，压力模式
 * 则在数据载入时预热该索引；之后由后台维度反查物理行无需逐行扫描。
 */
const BUSINESS_ROW_LOCATION_INDEX_CACHE = new WeakMap<
  readonly ViewRow[],
  ReadonlyMap<string, BusinessRowLocation>
>();

export function isBusinessRowDimension(
  value: unknown,
): value is BusinessRowDimension {
  return hasExactDimensionCodes(value, [
    BUSINESS_DIMENSION_CODES.organization,
    BUSINESS_DIMENSION_CODES.subject,
  ]);
}

export function isBusinessColumnDimension(
  value: unknown,
): value is BusinessColumnDimension {
  if (
    !hasExactDimensionCodes(value, [
      BUSINESS_DIMENSION_CODES.dataCategory,
      BUSINESS_DIMENSION_CODES.year,
      BUSINESS_DIMENSION_CODES.period,
      BUSINESS_DIMENSION_CODES.measure,
    ])
  )
    return false;
  const dimension = value as BusinessColumnDimension;
  const col = getBusinessColumnIndex(dimension);
  return col >= 0 && isValueColumn(COLUMNS[col]);
}

/** Worksheet 单元格 -> 后台业务维度。 */
export function toBusinessCellDimension(
  row: ViewRow | undefined,
  col: number,
): BusinessCellDimension | null {
  const column = COLUMNS[col];
  const sourceNode = getCellSourceNode(row, col);
  if (!row || !column || !isValueColumn(column) || !sourceNode) return null;
  const columnDimension = getBusinessColumnDimension(column.field);
  const rowDimension = getCellSourceRowDimension(row, col);
  if (!columnDimension || !rowDimension) return null;
  return {
    row: rowDimension,
    column: { ...columnDimension },
  };
}

export function isBusinessCellDimension(
  value: unknown,
): value is BusinessCellDimension {
  if (!value || typeof value !== 'object') return false;
  const dimension = value as Partial<BusinessCellDimension>;
  if (
    !isBusinessRowDimension(dimension.row) ||
    !isBusinessColumnDimension(dimension.column)
  )
    return false;
  const col = getBusinessColumnIndex(dimension.column);
  return col >= 0 && isValueColumn(COLUMNS[col]);
}

function rowLocation(candidate: ViewRow, row: number): BusinessRowLocation {
  return {
    row,
    projectionRowId: candidate.id,
    productId: candidate.productId,
    productParentId: candidate.productParentId,
    subjectRootId: candidate.regionRootId,
    subjectDepth: candidate.regionDepth,
  };
}

/** 为一批 Worksheet 投影行建立“后台行维 -> 物理行”的稳定索引。 */
export function prepareBusinessCellLocationIndex(rows: readonly ViewRow[]) {
  const cached = BUSINESS_ROW_LOCATION_INDEX_CACHE.get(rows);
  if (cached) return cached;

  const index = new Map<string, BusinessRowLocation>();
  rows.forEach((candidate, row) => {
    // 聚合投影同时对应多条后台记录，不应伪装成可定位、可编辑的业务行。
    if (candidate.sourceNodes.length !== 1) return;
    const key = businessRowDimensionKey(candidate.rowDimension);
    // 同一记录若因投影重复出现，定位到首个可见实例，结果稳定且可预期。
    if (!index.has(key)) index.set(key, rowLocation(candidate, row));
  });
  BUSINESS_ROW_LOCATION_INDEX_CACHE.set(rows, index);
  return index;
}

/** 后台行维、列维 -> 当前投影中的物理单元格。 */
export function resolveBusinessCellDimension(
  rows: readonly ViewRow[],
  dimension: BusinessCellDimension,
): BusinessCellLocation | null {
  if (!isBusinessCellDimension(dimension)) return null;
  const col = getBusinessColumnIndex(dimension.column);
  if (col < 0 || !isValueColumn(COLUMNS[col])) return null;
  const rowLocation = prepareBusinessCellLocationIndex(rows).get(
    businessRowDimensionKey(dimension.row),
  );
  return rowLocation ? { ...rowLocation, col } : null;
}

export function describeBusinessCellDimension(
  dimension: BusinessCellDimension,
) {
  const col = getBusinessColumnIndex(dimension.column);
  const columnLabel = col >= 0 ? COLUMNS[col].label : '未知数值列';
  return [
    dimension.row[BUSINESS_DIMENSION_CODES.organization],
    dimension.row[BUSINESS_DIMENSION_CODES.subject],
    columnLabel,
  ].join(' / ');
}
