import { VerticalAlign } from '@univerjs/core';
import type { ETableCell, ETableColumn, ETableRow, ETableTreeConfig } from './types';

export const DEFAULT_READONLY_CELL_BG = '#F5F5F5';
export const DEFAULT_EDITABLE_CELL_BG = '#FFFFFF';

/** Univer 默认 vt=0 顶对齐，写入数据区时统一垂直居中 */
export const DEFAULT_CELL_STYLE = { vt: VerticalAlign.MIDDLE };

export const mergeCellStyle = (style?: Record<string, unknown>) => ({
  ...DEFAULT_CELL_STYLE,
  ...(style || {}),
  vt: VerticalAlign.MIDDLE,
});

export interface ETableCellToneOptions {
  readonlyBackground?: string;
  editableBackground?: string;
}

export interface ETableCellToneContext {
  readonlyColumns: Set<number>;
  editableOnReadonlyRowColumns: Set<number>;
  readonlyDataRows: Set<number>;
  isReadonlyDataRow?: (dataRow: number) => boolean;
  readonlyBg: string;
  editableBg: string;
}

export interface ETableReadonlyLayout {
  readonlyColumns: number[];
  editableOnReadonlyRowColumns: number[];
  readonlyDataRows: number[];
  cellTone: ETableCellToneContext | null;
}

const toRgbStyle = (hex: string) => ({
  bg: {
    rgb: hex.startsWith('#') ? hex : `#${hex}`,
  },
});

/** 与 setupReadonlyCells 一致的只读列 / 行布局，并生成单元格背景上下文 */
export const resolveReadonlyLayout = (params: {
  leafColumns: ETableColumn[];
  rows: ETableRow[];
  treeUI: boolean;
  treeConfig?: ETableTreeConfig;
  cellTone?: boolean | ETableCellToneOptions;
  isReadonlyDataRow?: (dataRow: number) => boolean;
}): ETableReadonlyLayout => {
  const {
    leafColumns,
    rows,
    treeUI,
    treeConfig,
    cellTone: cellToneOption,
    isReadonlyDataRow,
  } = params;

  const readonlyColumnSet = new Set(
    leafColumns
      .map((column, index) => (column.editable === false ? index : -1))
      .filter((index) => index >= 0),
  );

  if (treeUI && treeConfig) {
    const lockFields = new Set([
      ...treeConfig.dimensions.map((item) => item.field),
      ...(treeConfig.attribute ? [treeConfig.attribute.field] : []),
    ]);
    leafColumns.forEach((column, index) => {
      if (lockFields.has(column.id) && column.editable !== true) {
        readonlyColumnSet.add(index);
      }
    });
  }

  const dimensionFieldSet = new Set(treeConfig?.dimensions.map((item) => item.field) ?? []);
  const editableOnReadonlyRowColumns = leafColumns
    .map((column, index) =>
      column.editable === true && dimensionFieldSet.has(column.id) ? index : -1,
    )
    .filter((index) => index >= 0);

  const readonlyDataRows: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].readonly) {
      readonlyDataRows.push(index);
    }
  }

  const toneEnabled =
    cellToneOption !== false && (cellToneOption !== undefined || treeUI);
  const toneOptions =
    typeof cellToneOption === 'object' ? cellToneOption : undefined;

  const cellTone: ETableCellToneContext | null = toneEnabled
    ? {
        readonlyColumns: readonlyColumnSet,
        editableOnReadonlyRowColumns: new Set(editableOnReadonlyRowColumns),
        readonlyDataRows: new Set(readonlyDataRows),
        isReadonlyDataRow,
        readonlyBg: toneOptions?.readonlyBackground ?? DEFAULT_READONLY_CELL_BG,
        editableBg: toneOptions?.editableBackground ?? DEFAULT_EDITABLE_CELL_BG,
      }
    : null;

  return {
    readonlyColumns: [...readonlyColumnSet],
    editableOnReadonlyRowColumns,
    readonlyDataRows,
    cellTone,
  };
};

export const isReadonlyDataCell = (
  dataRow: number,
  columnIndex: number,
  row: ETableRow,
  cellTone: ETableCellToneContext,
): boolean => {
  if (cellTone.editableOnReadonlyRowColumns.has(columnIndex)) {
    return false;
  }
  const rowReadonly =
    Boolean(cellTone.isReadonlyDataRow?.(dataRow)) ||
    cellTone.readonlyDataRows.has(dataRow) ||
    Boolean(row.readonly);
  if (rowReadonly) {
    return true;
  }
  return cellTone.readonlyColumns.has(columnIndex);
};

/** 将一行转为 worksheet setValues 矩阵（含只读/可编辑背景） */
export const buildRowSheetValues = (
  row: ETableRow,
  dataRow: number,
  leafColumns: ETableColumn[],
  cellTone: ETableCellToneContext | null,
) => {
  return leafColumns.map((column, columnIndex) => {
    const cell = row.data?.[column.id];
    const toneStyle = cellTone
      ? toRgbStyle(
          isReadonlyDataCell(dataRow, columnIndex, row, cellTone)
            ? cellTone.readonlyBg
            : cellTone.editableBg,
        )
      : row.style?.bg
        ? toRgbStyle(row.style.bg)
        : null;

    if (cell !== null && typeof cell === 'object') {
      const styledCell = cell as ETableCell;
      const cellStyle = styledCell.style as Record<string, unknown> | undefined;
      if (cellStyle || toneStyle) {
        return {
          v: styledCell.value ?? null,
          s: mergeCellStyle({
            ...(toneStyle || {}),
            ...(cellStyle || {}),
            bg: (cellStyle as { bg?: unknown })?.bg || toneStyle?.bg,
          }),
        };
      }
      return {
        v: styledCell.value ?? null,
        s: DEFAULT_CELL_STYLE,
      };
    }

    if (toneStyle) {
      return {
        v: cell ?? null,
        s: mergeCellStyle(toneStyle),
      };
    }
    return {
      v: cell ?? null,
      s: DEFAULT_CELL_STYLE,
    };
  });
};
