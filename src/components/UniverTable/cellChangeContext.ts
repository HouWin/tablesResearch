import type {
  ETableCell,
  ETableCellChangeRecord,
  ETableCellDimensionsResult,
  ETableCellLocator,
  ETableColumn,
  ETableDimensionInfo,
  ETableGroupConfig,
  ETablePrimitive,
  ETableRow,
  ETableTreeConfig,
} from './types';
import { attachBusinessChange } from './businessChange';
import { resolveCellLocator } from './cellValue';
import { buildDimensionIdMap, resolveColumnDimensionPath } from './dimensionPath';

export type { ETableDimensionInfo, ETableDimensionIdMap } from './types';
export {
  buildDimensionIdMap,
  DIMENSION_ID_SEPARATOR,
  joinDimensionPathIds,
  resolveColumnDimensionPath,
} from './dimensionPath';

export interface ETableEnrichCellChangeContext {
  headerDepth: number;
  columns: ETableColumn[];
  leafColumns: ETableColumn[];
  rows: ETableRow[];
  treeConfig?: ETableTreeConfig;
  groupConfig?: ETableGroupConfig;
  getLogicalDataRow?: (dataRow: number) => number | null;
  getRowPath?: (logicalRow: number) => string[];
}

const toPrimitive = (value: ETablePrimitive | ETableCell | undefined): ETablePrimitive => {
  if (value === undefined) {
    return undefined;
  }
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return (value as ETableCell).value;
  }
  return value as ETablePrimitive;
};

const stripTreeLabel = (value: ETablePrimitive | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/^[▼▶]\s*/, '').trim();
};

const getRowDimensionDefs = (
  treeConfig?: ETableTreeConfig,
  groupConfig?: ETableGroupConfig,
): Array<{ field: string; title: string }> => {
  if (treeConfig) {
    const defs = treeConfig.dimensions.map((item) => ({
      field: item.field,
      title: item.title,
    }));
    if (treeConfig.attribute?.field) {
      defs.push({
        field: treeConfig.attribute.field,
        title: treeConfig.attribute.title,
      });
    }
    return defs;
  }
  if (groupConfig) {
    return groupConfig.dimensions.map((item) => ({
      field: item.field,
      title: item.title,
    }));
  }
  return [];
};

const readContextId = (
  context: Record<string, ETablePrimitive>,
  field: string,
): string | undefined => {
  const raw = context[`${field}Id`];
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  return String(raw);
};

const resolveFromDimensionContext = (
  row: ETableRow,
  defs: Array<{ field: string; title: string }>,
  treeConfig?: ETableTreeConfig,
): ETableDimensionInfo[] => {
  const context = row.dimensionContext;
  if (!context) {
    return [];
  }

  const attributeField = treeConfig?.attribute?.field;
  const result: ETableDimensionInfo[] = [];

  defs.forEach((def) => {
    const value = context[def.field];
    if (value !== undefined && value !== null && value !== '') {
      result.push({
        ...def,
        value: stripTreeLabel(value),
        id: readContextId(context, def.field),
      });
    }
  });

  if (attributeField) {
    const detailValue = context[`${attributeField}Detail`];
    if (detailValue !== undefined && detailValue !== null && detailValue !== '') {
      result.push({
        field: `${attributeField}Detail`,
        title: treeConfig?.attribute?.title ?? '明细',
        value: stripTreeLabel(detailValue),
        id: readContextId(context, `${attributeField}Detail`),
      });
    }
  }

  return result;
};

/**
 * 解析行维度。
 *
 * 优先读展平时写入的 `row.dimensionContext`（完整业务层级）；
 * 否则回退到 rowPath + row.data 合并解析。
 */
export const resolveRowDimensions = (
  row: ETableRow | undefined,
  treeConfig?: ETableTreeConfig,
  groupConfig?: ETableGroupConfig,
  rowPath?: string[],
): ETableDimensionInfo[] => {
  const defs = getRowDimensionDefs(treeConfig, groupConfig);
  if (!defs.length || !row) {
    return [];
  }

  const fromContext = resolveFromDimensionContext(row, defs, treeConfig);
  if (fromContext.length) {
    return fromContext;
  }

  const attributeField = treeConfig?.attribute?.field;
  const primaryDimensionField = treeConfig?.dimensions[0]?.field;
  const hasAttributeDetail = Boolean(
    attributeField && rowPath && rowPath.length > defs.length,
  );

  if (groupConfig && rowPath?.length) {
    return defs
      .map((def, index) => {
        const fromPath = rowPath[index];
        const fromData = stripTreeLabel(toPrimitive(row.data[def.field]));
        const value = fromPath || fromData;
        return value ? { ...def, value } : null;
      })
      .filter(Boolean) as ETableDimensionInfo[];
  }

  const result: ETableDimensionInfo[] = [];

  defs.forEach((def, index) => {
    const fromData = stripTreeLabel(toPrimitive(row.data[def.field]));
    let value = '';

    if (hasAttributeDetail && def.field === attributeField) {
      value = rowPath![defs.length - 1] ?? '';
    } else if (def.field !== primaryDimensionField && fromData) {
      value = fromData;
    } else if (fromData) {
      value = fromData;
    } else if (rowPath?.[index]) {
      value = rowPath[index];
    }

    if (value) {
      result.push({ ...def, value });
    }
  });

  if (hasAttributeDetail && attributeField) {
    const detailValue = rowPath![rowPath!.length - 1];
    if (detailValue) {
      result.push({
        field: `${attributeField}Detail`,
        title: `${treeConfig?.attribute?.title ?? '明细'}`,
        value: detailValue,
      });
    }
  }

  return result;
};

/** 按单元格定位解析行列维度（与 onCellChange 中 enrich 逻辑一致）。 */
export const resolveCellDimensions = (
  locator: ETableCellLocator,
  context: ETableEnrichCellChangeContext,
): ETableCellDimensionsResult => {
  const {
    headerDepth,
    columns,
    leafColumns,
    rows,
    treeConfig,
    groupConfig,
    getLogicalDataRow,
    getRowPath,
  } = context;

  const target = resolveCellLocator(locator, leafColumns, headerDepth);
  if (!target || target.dataRow < 0 || target.dataRow >= rows.length) {
    return { success: false };
  }

  const logicalRow = getLogicalDataRow?.(target.dataRow) ?? target.dataRow;
  const row =
    logicalRow >= 0 && logicalRow < rows.length ? rows[logicalRow] : undefined;
  const rowPath = logicalRow >= 0 ? getRowPath?.(logicalRow) ?? [] : [];

  const rowDimensions = resolveRowDimensions(
    row,
    treeConfig,
    groupConfig,
    rowPath.length ? rowPath : undefined,
  );
  const columnDimensions = resolveColumnDimensionPath(columns, target.column);
  const columnId =
    buildDimensionIdMap(columnDimensions) ??
    (target.field ? { [target.field]: target.field } : undefined);
  const rowId =
    buildDimensionIdMap(rowDimensions) ??
    (row?.id ? { id: row.id } : undefined);

  return {
    success: true,
    cell: target.cell,
    field: target.field,
    columnId,
    sheetRow: target.sheetRow,
    column: target.column,
    dataRow: target.dataRow,
    logicalRow: logicalRow >= 0 ? logicalRow : undefined,
    rowDimensions: rowDimensions.length ? rowDimensions : undefined,
    columnDimensions: columnDimensions.length ? columnDimensions : undefined,
    rowPath: rowPath.length ? rowPath : undefined,
    rowId,
  };
};

/** 为单元格变更记录补充 field、行列维度与逻辑行信息。 */
export const enrichCellChangeRecord = (
  record: ETableCellChangeRecord,
  context: ETableEnrichCellChangeContext,
): ETableCellChangeRecord => {
  const {
    headerDepth,
    columns,
    leafColumns,
    rows,
    treeConfig,
    groupConfig,
    getLogicalDataRow,
    getRowPath,
  } = context;

  const dataRow = record.row - headerDepth;
  const leaf = leafColumns[record.column];
  const logicalRow =
    dataRow >= 0 ? (getLogicalDataRow?.(dataRow) ?? dataRow) : null;
  const row =
    logicalRow !== null && logicalRow >= 0 && logicalRow < rows.length
      ? rows[logicalRow]
      : undefined;
  const rowPath =
    logicalRow !== null && logicalRow >= 0 ? getRowPath?.(logicalRow) ?? [] : [];

  const rowDimensions = resolveRowDimensions(
    row,
    treeConfig,
    groupConfig,
    rowPath.length ? rowPath : undefined,
  );
  const columnDimensions = resolveColumnDimensionPath(columns, record.column);
  const columnId =
    buildDimensionIdMap(columnDimensions) ??
    (leaf?.id
      ? { [leaf.dimensionField ?? leaf.id]: leaf.dimensionId ?? leaf.id }
      : undefined);
  const rowId =
    buildDimensionIdMap(rowDimensions) ??
    (row?.id ? { id: row.id } : undefined);

  return attachBusinessChange({
    ...record,
    field: leaf?.id,
    columnId,
    dataRow: dataRow >= 0 ? dataRow : undefined,
    logicalRow: logicalRow !== null && logicalRow >= 0 ? logicalRow : undefined,
    rowDimensions: rowDimensions.length ? rowDimensions : undefined,
    columnDimensions: columnDimensions.length ? columnDimensions : undefined,
    rowPath: rowPath.length ? rowPath : undefined,
    rowId,
  });
};

