/**
 * 平铺数据多重分组展平（groupData.ts）
 *
 * 将 groupData[] + groupConfig 转为带维度列纵向合并、行大纲的二维表：
 * - dimensions 从左到右为分组层级（如 Package → Quarter）
 * - measures 为展开后的明细指标列
 * - 视觉效果类似透视表行分组，但为预展平写入单元格
 */
import type {
  ETableCell,
  ETableColumn,
  ETableFlattenResult,
  ETableGroupConfig,
  ETableMerge,
  ETablePrimitive,
  ETableRow,
  ETableRowGroup,
} from './types';

type FlatRecord = Record<string, ETablePrimitive>;

/**
 * 将平铺数据按多个维度字段分组，生成带合并单元格与行大纲的表格结构。
 *
 * 效果类似 Excel / 透视表行分组：
 * - 每个维度占一列，上层维度纵向合并
 * - 最内层维度支持折叠/展开（Univer 行大纲）
 * - 折叠时仅显示分组标题行，明细行隐藏
 */
export const flattenGroupedData = (
  records: FlatRecord[] = [],
  config: ETableGroupConfig,
): ETableFlattenResult => {
  const columns: ETableColumn[] = [
    ...config.dimensions.map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
    })),
    ...config.measures.map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
    })),
  ];

  const dimensionFields = config.dimensions.map((item) => item.field);
  const measureFields = config.measures.map((item) => item.field);
  const fieldColumnIndex = new Map<string, number>();
  columns.forEach((column, index) => {
    fieldColumnIndex.set(column.id, index);
  });

  const rows: ETableRow[] = [];
  const rowGroups: ETableRowGroup[] = [];
  const merges: ETableMerge[] = [];
  let currentRow = 0;

  const dimensionCellStyle = config.dimensionStyle?.bg
    ? { style: { bg: { rgb: config.dimensionStyle.bg } } }
    : undefined;

  const toDimensionCell = (value: ETablePrimitive): ETablePrimitive | ETableCell => {
    if (!dimensionCellStyle) {
      return value;
    }
    return { value, ...dimensionCellStyle };
  };

  const isPathCollapsed = (path: FlatRecord, depth: number): boolean => {
    if (!config.collapsedPaths?.length) {
      return config.defaultCollapsed ?? false;
    }
    return config.collapsedPaths.some((candidate) =>
      dimensionFields.every((field, index) => {
        if (index > depth) {
          return true;
        }
        if (candidate[field] === undefined) {
          return true;
        }
        return candidate[field] === path[field];
      }) && dimensionFields.slice(0, depth + 1).every((field) => candidate[field] !== undefined),
    );
  };

  const pushMerge = (
    field: string,
    startRow: number,
    count: number,
    value: ETablePrimitive,
  ) => {
    if (count <= 1) {
      return;
    }
    const column = fieldColumnIndex.get(field);
    if (column === undefined) {
      return;
    }
    merges.push({
      id: `merge-${field}-${startRow}-${count}`,
      row: startRow,
      column,
      rowSpan: count,
      columnSpan: 1,
      value,
    });
  };

  const buildDimensionData = (
    path: FlatRecord,
    depth: number,
    showDepth: number,
  ): ETableRow['data'] => {
    const data: ETableRow['data'] = {};
    dimensionFields.forEach((field, index) => {
      if (index <= showDepth) {
        data[field] = toDimensionCell(path[field] ?? '');
      } else {
        data[field] = toDimensionCell('');
      }
    });
    measureFields.forEach((field) => {
      data[field] = '';
    });
    return data;
  };

  const buildLeafRowData = (
    record: FlatRecord,
    path: FlatRecord,
    depth: number,
    showLabels: boolean,
  ): ETableRow['data'] => {
    const data: ETableRow['data'] = {};
    dimensionFields.forEach((field, index) => {
      if (showLabels && index <= depth) {
        data[field] = toDimensionCell(path[field] ?? '');
      } else {
        data[field] = toDimensionCell('');
      }
    });
    measureFields.forEach((field) => {
      data[field] = record[field] ?? '';
    });
    return data;
  };

  const emitCollapsedLeafGroup = (
    groupItems: FlatRecord[],
    path: FlatRecord,
    depth: number,
    groupId: string,
  ) => {
    const blockStart = currentRow;

    rows.push({
      id: `${groupId}-header`,
      data: buildDimensionData(path, depth, depth),
    });
    currentRow += 1;

    const detailStart = currentRow;
    groupItems.forEach((record, index) => {
      rows.push({
        id: `${groupId}-detail-${index}`,
        data: buildLeafRowData(record, path, depth, false),
      });
      currentRow += 1;
    });

    if (groupItems.length > 0) {
      rowGroups.push({
        id: groupId,
        startRow: detailStart,
        count: groupItems.length,
        collapsed: true,
      });
    }

    const totalRows = currentRow - blockStart;
    if (totalRows > 1) {
      dimensionFields.slice(0, depth + 1).forEach((field) => {
        pushMerge(field, blockStart, totalRows, path[field] ?? '');
      });
    }
  };

  const emitExpandedLeafGroup = (
    groupItems: FlatRecord[],
    path: FlatRecord,
    depth: number,
    groupId: string,
  ) => {
    const blockStart = currentRow;

    groupItems.forEach((record, index) => {
      rows.push({
        id: `${groupId}-row-${index}`,
        data: buildLeafRowData(record, path, depth, index === 0),
      });
      currentRow += 1;
    });

    const leafCount = groupItems.length;
    if (leafCount > 1) {
      rowGroups.push({
        id: groupId,
        startRow: blockStart + 1,
        count: leafCount - 1,
        collapsed: false,
      });
      dimensionFields.slice(0, depth + 1).forEach((field) => {
        pushMerge(field, blockStart, leafCount, path[field] ?? '');
      });
    }
  };

  const walk = (items: FlatRecord[], depth: number, parentPath: FlatRecord) => {
    if (!items.length) {
      return;
    }

    if (depth >= dimensionFields.length) {
      return;
    }

    const field = dimensionFields[depth];
    const grouped = new Map<string, FlatRecord[]>();

    items.forEach((item) => {
      const key = String(item[field] ?? '');
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(key, [item]);
      }
    });

    grouped.forEach((groupItems, groupValue) => {
      const path = { ...parentPath, [field]: groupValue };
      const blockStart = currentRow;
      const groupId = `group-${dimensionFields.slice(0, depth + 1).map((f) => path[f]).join('-')}`;

      if (depth === dimensionFields.length - 1) {
        if (isPathCollapsed(path, depth)) {
          emitCollapsedLeafGroup(groupItems, path, depth, groupId);
        } else {
          emitExpandedLeafGroup(groupItems, path, depth, groupId);
        }
        return;
      }

      walk(groupItems, depth + 1, path);

      const totalRows = currentRow - blockStart;
      if (totalRows > 1) {
        dimensionFields.slice(0, depth + 1).forEach((dimField) => {
          pushMerge(dimField, blockStart, totalRows, path[dimField] ?? '');
        });
      }
    });
  };

  walk(records, 0, {});

  return {
    columns,
    rows,
    rowGroups,
    columnGroups: [],
    merges,
  };
};
