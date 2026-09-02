import type { ETableCellChangeRecord, ETableExportData, ETableGetTableDataOptions, ETableColumn, ETablePrimitive, ETableRow } from './types';

const TREE_TOGGLE_PREFIX = /^[▶▼]\s*/;

const readCellPrimitive = (value: unknown): ETablePrimitive => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; value?: unknown };
    if (obj.v !== undefined) {
      return obj.v as ETablePrimitive;
    }
    if (obj.value !== undefined) {
      return obj.value as ETablePrimitive;
    }
    return null;
  }
  return value as ETablePrimitive;
};

const stripTreeToggle = (value: ETablePrimitive): ETablePrimitive => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(TREE_TOGGLE_PREFIX, '').trim();
};

const cloneRows = (rows: ETableRow[]): ETableRow[] =>
  rows.map((row) => ({
    ...row,
    data: { ...row.data },
    style: row.style ? { ...row.style } : undefined,
  }));

/** 从工作表读取一行数据区单元格（sheetRow 为绝对行号，含表头偏移） */
export const readSheetDataRow = (
  worksheet: any,
  sheetRow: number,
  leafColumns: ETableColumn[],
): Record<string, ETablePrimitive> => {
  const data: Record<string, ETablePrimitive> = {};
  leafColumns.forEach((column, columnIndex) => {
    try {
      const range = worksheet.getRange?.(sheetRow, columnIndex);
      const raw = range?.getValue?.() ?? range?.getCellData?.()?.v;
      data[column.id] = stripTreeToggle(readCellPrimitive(raw));
    } catch {
      data[column.id] = null;
    }
  });
  return data;
};

/** 将变更流水按单元格叠加到 rows（tracks 按时间倒序，取每格最新 to） */
export const applyTracksToRows = (
  rows: ETableRow[],
  tracks: ETableCellChangeRecord[],
  leafColumns: ETableColumn[],
  headerDepth: number,
) => {
  const latestByCell = new Map<string, string>();
  tracks.forEach((track) => {
    if (!latestByCell.has(track.cell)) {
      latestByCell.set(track.cell, track.to);
    }
  });

  latestByCell.forEach((to, cell) => {
    const match = /^([A-Z]+)(\d+)$/.exec(cell.toUpperCase());
    if (!match) {
      return;
    }
    const columnLetters = match[1];
    const sheetRow = Number(match[2]) - 1;
    let column = 0;
    for (let i = 0; i < columnLetters.length; i += 1) {
      column = column * 26 + (columnLetters.charCodeAt(i) - 64);
    }
    column -= 1;
    const dataRow = sheetRow - headerDepth;
    const field = leafColumns[column]?.id;
    if (dataRow < 0 || dataRow >= rows.length || !field) {
      return;
    }
    rows[dataRow].data[field] = to;
  });
};

export const buildTableExportData = (params: {
  columns: ETableColumn[];
  rows: ETableRow[];
  leafColumns: ETableColumn[];
  headerDepth: number;
  worksheet: any | null;
  tracks: ETableCellChangeRecord[];
  useTreeViewport: boolean;
  virtualLoader: { getStats: () => { loadedPages: number; totalPages: number } } | null;
  options?: ETableGetTableDataOptions;
}): ETableExportData => {
  const {
    columns,
    rows,
    leafColumns,
    headerDepth,
    worksheet,
    tracks,
    useTreeViewport,
    virtualLoader,
    options,
  } = params;
  const preferWorksheet = options?.preferWorksheet !== false;
  const snapshot = cloneRows(rows);

  const canReadFullWorksheet =
    preferWorksheet &&
    worksheet &&
    !useTreeViewport &&
    (!virtualLoader ||
      virtualLoader.getStats().loadedPages >= virtualLoader.getStats().totalPages);

  if (canReadFullWorksheet) {
    for (let dataRow = 0; dataRow < snapshot.length; dataRow += 1) {
      const sheetRow = headerDepth + dataRow;
      snapshot[dataRow].data = {
        ...snapshot[dataRow].data,
        ...readSheetDataRow(worksheet, sheetRow, leafColumns),
      };
    }
    return {
      columns,
      leafColumns,
      headerDepth,
      rows: snapshot,
      source: 'worksheet',
    };
  }

  applyTracksToRows(snapshot, tracks, leafColumns, headerDepth);
  return {
    columns,
    leafColumns,
    headerDepth,
    rows: snapshot,
    source: 'memory',
  };
};
