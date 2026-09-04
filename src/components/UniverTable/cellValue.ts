import { readSheetDataRow } from './exportData';
import type {
  ETableCell,
  ETableCellLocator,
  ETableCellValuePatch,
  ETableColumn,
  ETableGetCellValueOptions,
  ETableGetCellValueResult,
  ETableGetRowValueOptions,
  ETableGetRowValueResult,
  ETablePrimitive,
  ETableRow,
  ETableRowLocator,
  ETableSetCellValueOptions,
  ETableSetCellValueResult,
  ETableSetCellValuesResult,
  ETableSetRowValueResult,
} from './types';
import {
  isDimensionCellLocator,
  resolveDimensionCellLocator,
} from './dimensionLocate';

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

const cellAddress = (row: number, column: number) => `${columnName(column)}${row + 1}`;

const parseA1 = (cell: string) => {
  const match = /^([A-Za-z]+)(\d+)$/.exec(cell.trim());
  if (!match) {
    return null;
  }
  const letters = match[1].toUpperCase();
  let column = 0;
  for (let i = 0; i < letters.length; i += 1) {
    column = column * 26 + (letters.charCodeAt(i) - 64);
  }
  return {
    sheetRow: Number(match[2]) - 1,
    column: column - 1,
  };
};

export const resolveCellLocator = (
  locator: ETableCellLocator,
  leafColumns: ETableColumn[],
  headerDepth: number,
) => {
  if (typeof locator === 'string') {
    const parsed = parseA1(locator);
    if (!parsed) {
      return null;
    }
    const field = leafColumns[parsed.column]?.id;
    if (!field) {
      return null;
    }
    return {
      sheetRow: parsed.sheetRow,
      column: parsed.column,
      dataRow: parsed.sheetRow - headerDepth,
      field,
      cell: locator.toUpperCase(),
    };
  }

  // { dataRow, field } — 注意维度定位也可能带 field，需同时有 dataRow
  if (
    locator &&
    typeof locator === 'object' &&
    'dataRow' in locator &&
    'field' in locator &&
    typeof (locator as { dataRow?: unknown }).dataRow === 'number'
  ) {
    const dataRowLocator = locator as { dataRow: number; field: string };
    const column = leafColumns.findIndex((item) => item.id === dataRowLocator.field);
    if (column < 0) {
      return null;
    }
    const sheetRow = headerDepth + dataRowLocator.dataRow;
    return {
      sheetRow,
      column,
      dataRow: dataRowLocator.dataRow,
      field: dataRowLocator.field,
      cell: cellAddress(sheetRow, column),
    };
  }

  if (
    locator &&
    typeof locator === 'object' &&
    'sheetRow' in locator &&
    'column' in locator &&
    typeof (locator as { sheetRow?: unknown }).sheetRow === 'number' &&
    typeof (locator as { column?: unknown }).column === 'number'
  ) {
    const sheetLocator = locator as { sheetRow: number; column: number };
    const field = leafColumns[sheetLocator.column]?.id;
    if (!field) {
      return null;
    }
    return {
      sheetRow: sheetLocator.sheetRow,
      column: sheetLocator.column,
      dataRow: sheetLocator.sheetRow - headerDepth,
      field,
      cell: cellAddress(sheetLocator.sheetRow, sheetLocator.column),
    };
  }

  return null;
};

const normalizeInputValue = (
  value: ETablePrimitive | ETableCell,
): ETablePrimitive | ETableCell => {
  if (value !== null && typeof value === 'object' && ('value' in value || 'formula' in value)) {
    return value;
  }
  return value as ETablePrimitive;
};

const toSheetPayload = (value: ETablePrimitive | ETableCell) => {
  if (value !== null && typeof value === 'object') {
    const cell = value as ETableCell;
    if (cell.formula) {
      return { f: cell.formula, v: cell.value ?? null, s: cell.style };
    }
    if (cell.style) {
      return { v: cell.value ?? null, s: cell.style };
    }
    return cell.value ?? null;
  }
  return value;
};

const readSheetDisplayValue = (worksheet: any, sheetRow: number, column: number): string => {
  try {
    const range = worksheet?.getRange?.(sheetRow, column);
    const raw = range?.getValue?.() ?? range?.getCellData?.()?.v;
    if (raw === null || raw === undefined) {
      return '';
    }
    if (typeof raw === 'object') {
      const obj = raw as { v?: unknown; value?: unknown };
      return String(obj.v ?? obj.value ?? '');
    }
    return String(raw);
  } catch {
    return '';
  }
};

const findProjectedDataRow = (
  logicalRow: number,
  getLogicalDataRow: (projectedDataRow: number) => number | null,
  getProjectedDataRow: ((logicalRow: number) => number | null) | undefined,
  treeViewportWindowSize: number,
) => {
  if (getProjectedDataRow) {
    return getProjectedDataRow(logicalRow);
  }
  for (let projected = 0; projected < treeViewportWindowSize; projected += 1) {
    if (getLogicalDataRow(projected) === logicalRow) {
      return projected;
    }
  }
  return null;
};

const resolveSheetRowForDataRow = (
  dataRow: number,
  headerDepth: number,
  useTreeViewport: boolean,
  getLogicalDataRow: ((projectedDataRow: number) => number | null) | undefined,
  getProjectedDataRow: ((logicalRow: number) => number | null) | undefined,
  treeViewportWindowSize: number,
) => {
  if (useTreeViewport && getLogicalDataRow) {
    const projected = findProjectedDataRow(
      dataRow,
      getLogicalDataRow,
      getProjectedDataRow,
      treeViewportWindowSize,
    );
    if (projected === null) {
      return null;
    }
    return headerDepth + projected;
  }
  return headerDepth + dataRow;
};

const readSheetCellPrimitive = (
  worksheet: any,
  sheetRow: number,
  column: number,
): ETablePrimitive => {
  try {
    const range = worksheet?.getRange?.(sheetRow, column);
    const raw = range?.getValue?.() ?? range?.getCellData?.()?.v;
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw === 'object') {
      const obj = raw as { v?: unknown; value?: unknown };
      const value = (obj.v ?? obj.value) as ETablePrimitive;
      if (typeof value === 'string') {
        return value.replace(/^[▶▼]\s*/, '').trim();
      }
      return value ?? null;
    }
    if (typeof raw === 'string') {
      return raw.replace(/^[▶▼]\s*/, '').trim();
    }
    return raw as ETablePrimitive;
  } catch {
    return null;
  }
};

const readMemoryCellValue = (
  row: ETableRow,
  field: string,
): ETablePrimitive | ETableCell | null => {
  const cell = row.data?.[field];
  if (cell === undefined) {
    return null;
  }
  return cell as ETablePrimitive | ETableCell;
};

const toDisplayValue = (value: ETablePrimitive | ETableCell | null): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'value' in value) {
    return String((value as ETableCell).value ?? '');
  }
  return String(value);
};

export const getCellValueFromTable = (params: {
  locator: ETableCellLocator;
  leafColumns: ETableColumn[];
  columns?: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  rows: ETableRow[];
  useTreeViewport: boolean;
  getLogicalDataRow?: (projectedDataRow: number) => number | null;
  getProjectedDataRow?: (logicalRow: number) => number | null;
  treeViewportWindowSize?: number;
  options?: ETableGetCellValueOptions;
}): ETableGetCellValueResult => {
  const {
    locator,
    leafColumns,
    columns,
    headerDepth,
    worksheet,
    rows,
    useTreeViewport,
    getLogicalDataRow,
    getProjectedDataRow,
    treeViewportWindowSize = 300,
    options,
  } = params;
  const preferWorksheet = options?.preferWorksheet !== false;

  let effectiveLocator: ETableCellLocator = locator;
  if (isDimensionCellLocator(locator)) {
    const byDim = resolveDimensionCellLocator(
      locator,
      rows,
      leafColumns,
      headerDepth,
      columns,
    );
    if (!byDim) {
      return { success: false, value: null, displayValue: '', source: 'memory' };
    }
    effectiveLocator = { dataRow: byDim.dataRow, field: byDim.field };
  }

  const target = resolveCellLocator(effectiveLocator, leafColumns, headerDepth);
  if (!target || target.dataRow < 0 || target.dataRow >= rows.length) {
    return { success: false, value: null, displayValue: '', source: 'memory' };
  }

  const memoryValue = readMemoryCellValue(rows[target.dataRow], target.field);
  const sheetRow = preferWorksheet
    ? resolveSheetRowForDataRow(
      target.dataRow,
      headerDepth,
      useTreeViewport,
      getLogicalDataRow,
      getProjectedDataRow,
      treeViewportWindowSize,
    )
    : null;

  if (preferWorksheet && worksheet && sheetRow !== null) {
    const sheetValue = readSheetCellPrimitive(worksheet, sheetRow, target.column);
    const displayValue = readSheetDisplayValue(worksheet, sheetRow, target.column);
    return {
      success: true,
      value: sheetValue,
      displayValue,
      source: 'worksheet',
      cell: cellAddress(sheetRow, target.column),
      sheetRow,
      column: target.column,
      dataRow: target.dataRow,
      field: target.field,
    };
  }

  return {
    success: true,
    value: memoryValue,
    displayValue: toDisplayValue(memoryValue),
    source: 'memory',
    cell: target.cell,
    sheetRow: target.sheetRow,
    column: target.column,
    dataRow: target.dataRow,
    field: target.field,
  };
};

export const getRowValueFromTable = (params: {
  locator: ETableRowLocator;
  leafColumns: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  rows: ETableRow[];
  useTreeViewport: boolean;
  getLogicalDataRow?: (projectedDataRow: number) => number | null;
  getProjectedDataRow?: (logicalRow: number) => number | null;
  treeViewportWindowSize?: number;
  options?: ETableGetRowValueOptions;
}): ETableGetRowValueResult => {
  const {
    locator,
    leafColumns,
    headerDepth,
    worksheet,
    rows,
    useTreeViewport,
    getLogicalDataRow,
    getProjectedDataRow,
    treeViewportWindowSize = 300,
    options,
  } = params;
  const preferWorksheet = options?.preferWorksheet !== false;
  const fieldSet = options?.fields?.length ? new Set(options.fields) : null;
  const columns = fieldSet
    ? leafColumns.filter((column) => fieldSet.has(column.id))
    : leafColumns;

  const target = resolveRowLocator(locator, headerDepth, rows.length);
  if (!target) {
    return { success: false, dataRow: -1, data: {}, source: 'memory' };
  }

  const { dataRow } = target;
  const sheetRow = preferWorksheet
    ? resolveSheetRowForDataRow(
      dataRow,
      headerDepth,
      useTreeViewport,
      getLogicalDataRow,
      getProjectedDataRow,
      treeViewportWindowSize,
    )
    : null;

  if (preferWorksheet && worksheet && sheetRow !== null) {
    const sheetData = readSheetDataRow(worksheet, sheetRow, leafColumns);
    const data: Record<string, ETablePrimitive | ETableCell> = {};
    columns.forEach((column) => {
      data[column.id] = sheetData[column.id] ?? null;
    });
    return {
      success: true,
      dataRow,
      id: rows[dataRow].id,
      data,
      source: 'worksheet',
    };
  }

  const data: Record<string, ETablePrimitive | ETableCell> = {};
  columns.forEach((column) => {
    data[column.id] = readMemoryCellValue(rows[dataRow], column.id);
  });
  return {
    success: true,
    dataRow,
    id: rows[dataRow].id,
    data,
    source: 'memory',
  };
};

export const setCellValueOnTable = (params: {
  locator: ETableCellLocator;
  value: ETablePrimitive | ETableCell;
  leafColumns: ETableColumn[];
  columns?: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  rows: ETableRow[];
  useTreeViewport: boolean;
  getLogicalDataRow?: (projectedDataRow: number) => number | null;
  getProjectedDataRow?: (logicalRow: number) => number | null;
  treeViewportWindowSize?: number;
  recordChange?: (row: number, column: number, from: string, to: string) => void;
  options?: ETableSetCellValueOptions;
}): ETableSetCellValueResult => {
  const {
    locator,
    value,
    leafColumns,
    columns,
    headerDepth,
    worksheet,
    rows,
    useTreeViewport,
    getLogicalDataRow,
    getProjectedDataRow,
    treeViewportWindowSize = 300,
    recordChange,
    options,
  } = params;

  const syncMemory = options?.syncMemory !== false;
  const shouldRecord = options?.recordChange === true;

  let effectiveLocator: ETableCellLocator = locator;
  if (isDimensionCellLocator(locator)) {
    const byDim = resolveDimensionCellLocator(
      locator,
      rows,
      leafColumns,
      headerDepth,
      columns,
    );
    if (!byDim) {
      return { success: false, appliedToSheet: false };
    }
    effectiveLocator = { dataRow: byDim.dataRow, field: byDim.field };
  }

  const target = resolveCellLocator(effectiveLocator, leafColumns, headerDepth);
  if (!target) {
    return { success: false, appliedToSheet: false };
  }

  if (target.dataRow < 0 || target.dataRow >= rows.length) {
    return { success: false, appliedToSheet: false, ...target };
  }

  const normalized = normalizeInputValue(value);
  const payload = toSheetPayload(normalized);

  if (syncMemory) {
    rows[target.dataRow].data[target.field] = normalized;
  }

  let appliedToSheet = false;
  let writeSheetRow = target.sheetRow;
  let writeColumn = target.column;

  if (useTreeViewport && getLogicalDataRow) {
    const projected = findProjectedDataRow(
      target.dataRow,
      getLogicalDataRow,
      getProjectedDataRow,
      treeViewportWindowSize,
    );
    if (projected === null) {
      return { success: true, appliedToSheet: false, ...target };
    }
    writeSheetRow = headerDepth + projected;
  }

  if (worksheet) {
    try {
      const from = shouldRecord
        ? readSheetDisplayValue(worksheet, writeSheetRow, writeColumn)
        : '';
      worksheet.getRange(writeSheetRow, writeColumn)?.setValue(payload);
      appliedToSheet = true;
      if (shouldRecord && recordChange) {
        const to = readSheetDisplayValue(worksheet, writeSheetRow, writeColumn);
        recordChange(writeSheetRow, writeColumn, from, to);
      }
    } catch (error) {
      console.warn('[ETable] setCellValue failed', error);
      return { success: syncMemory, appliedToSheet: false, ...target };
    }
  }

  return { success: true, appliedToSheet, ...target };
};

/** 将批量 patch 归一成 ETableCellLocator */
export const resolvePatchToLocator = (
  patch: ETableCellValuePatch,
): ETableCellLocator | null => {
  if (patch.locator !== undefined) {
    return patch.locator;
  }
  if (patch.cell) {
    return patch.cell;
  }
  if (typeof patch.dataRow === 'number' && patch.field) {
    return { dataRow: patch.dataRow, field: patch.field };
  }
  if (
    patch.rowId ||
    patch.columnId ||
    patch.field ||
    patch.rowDimensions?.length ||
    patch.columnDimensions?.length
  ) {
    return {
      rowId: patch.rowId,
      columnId: patch.columnId,
      field: patch.field,
      rowDimensions: patch.rowDimensions,
      columnDimensions: patch.columnDimensions,
    };
  }
  return null;
};

/**
 * 批量按维度 / 定位更新多个单元格。
 */
export const setCellValuesOnTable = (params: {
  patches: ETableCellValuePatch[];
  leafColumns: ETableColumn[];
  columns?: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  rows: ETableRow[];
  useTreeViewport: boolean;
  getLogicalDataRow?: (projectedDataRow: number) => number | null;
  getProjectedDataRow?: (logicalRow: number) => number | null;
  treeViewportWindowSize?: number;
  recordChange?: (row: number, column: number, from: string, to: string) => void;
  options?: ETableSetCellValueOptions;
}): ETableSetCellValuesResult => {
  const { patches, options, ...rest } = params;
  const results: Array<ETableSetCellValueResult & { index: number }> = [];
  let successCount = 0;

  patches.forEach((patch, index) => {
    const locator = resolvePatchToLocator(patch);
    if (!locator) {
      results.push({ index, success: false, appliedToSheet: false });
      return;
    }
    const result = setCellValueOnTable({
      ...rest,
      locator,
      value: patch.value,
      options,
    });
    if (result.success) {
      successCount += 1;
    }
    results.push({ index, ...result });
  });

  const total = patches.length;
  const failedCount = total - successCount;
  return {
    success: failedCount === 0 && total > 0,
    total,
    successCount,
    failedCount,
    results,
  };
};

export const resolveRowLocator = (
  locator: ETableRowLocator,
  headerDepth: number,
  rowCount: number,
): { dataRow: number; sheetRow: number } | null => {
  let dataRow: number;
  if (typeof locator === 'number') {
    dataRow = locator;
  } else if ('dataRow' in locator) {
    dataRow = locator.dataRow;
  } else {
    dataRow = locator.sheetRow - headerDepth;
  }
  if (dataRow < 0 || dataRow >= rowCount) {
    return null;
  }
  return { dataRow, sheetRow: headerDepth + dataRow };
};

const buildRowSheetValues = (
  row: ETableRow,
  leafColumns: ETableColumn[],
) =>
  leafColumns.map((column) => {
    const cell = row.data?.[column.id];
    if (cell === undefined || cell === null) {
      return null;
    }
    return toSheetPayload(normalizeInputValue(cell));
  });

export const setRowValueOnTable = (params: {
  locator: ETableRowLocator;
  data: Record<string, ETablePrimitive | ETableCell>;
  leafColumns: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  rows: ETableRow[];
  useTreeViewport: boolean;
  getLogicalDataRow?: (projectedDataRow: number) => number | null;
  getProjectedDataRow?: (logicalRow: number) => number | null;
  treeViewportWindowSize?: number;
  recordChange?: (row: number, column: number, from: string, to: string) => void;
  options?: ETableSetCellValueOptions;
}): ETableSetRowValueResult => {
  const {
    locator,
    data,
    leafColumns,
    headerDepth,
    worksheet,
    rows,
    useTreeViewport,
    getLogicalDataRow,
    getProjectedDataRow,
    treeViewportWindowSize = 300,
    recordChange,
    options,
  } = params;

  const syncMemory = options?.syncMemory !== false;
  const shouldRecord = options?.recordChange === true;
  const updatedFields = Object.keys(data);

  if (!updatedFields.length) {
    return { success: false, appliedToSheet: false, dataRow: -1, updatedFields: [] };
  }

  const target = resolveRowLocator(locator, headerDepth, rows.length);
  if (!target) {
    return { success: false, appliedToSheet: false, dataRow: -1, updatedFields };
  }

  const { dataRow } = target;
  let writeSheetRow = target.sheetRow;

  if (syncMemory) {
    updatedFields.forEach((field) => {
      rows[dataRow].data[field] = normalizeInputValue(data[field]);
    });
  }

  if (useTreeViewport && getLogicalDataRow) {
    const projected = findProjectedDataRow(
      dataRow,
      getLogicalDataRow,
      getProjectedDataRow,
      treeViewportWindowSize,
    );
    if (projected === null) {
      return { success: true, appliedToSheet: false, dataRow, updatedFields };
    }
    writeSheetRow = headerDepth + projected;
  }

  if (!worksheet) {
    return { success: syncMemory, appliedToSheet: false, dataRow, updatedFields };
  }

  try {
    const values = buildRowSheetValues(rows[dataRow], leafColumns);
    const changeSnapshots: Array<{ column: number; from: string }> = [];

    if (shouldRecord && recordChange) {
      updatedFields.forEach((field) => {
        const column = leafColumns.findIndex((item) => item.id === field);
        if (column < 0) {
          return;
        }
        changeSnapshots.push({
          column,
          from: readSheetDisplayValue(worksheet, writeSheetRow, column),
        });
      });
    }

    worksheet
      .getRange(writeSheetRow, 0, 1, leafColumns.length)
      ?.setValues([values]);

    if (shouldRecord && recordChange) {
      changeSnapshots.forEach(({ column, from }) => {
        const to = readSheetDisplayValue(worksheet, writeSheetRow, column);
        recordChange(writeSheetRow, column, from, to);
      });
    }
  } catch (error) {
    console.warn('[ETable] setRowValue failed', error);
    return { success: syncMemory, appliedToSheet: false, dataRow, updatedFields };
  }

  return { success: true, appliedToSheet: true, dataRow, updatedFields };
};
