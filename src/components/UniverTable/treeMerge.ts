import { buildTreeColumns } from './tree';
import type {
  ETableCell,
  ETablePrimitive,
  ETableRow,
  ETableTreeAttribute,
  ETableTreeAttributeDetail,
  ETableTreeConfig,
  ETableTreeNode,
} from './types';

const toPrimitive = (value: ETablePrimitive | ETableCell): ETablePrimitive => {
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return (value as ETableCell).value ?? null;
  }
  return value as ETablePrimitive;
};

const deepCloneTree = (nodes: ETableTreeNode[]): ETableTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    data: node.data ? { ...node.data } : undefined,
    values: node.values ? { ...node.values } : undefined,
    children: node.children ? deepCloneTree(node.children) : undefined,
    attributes: node.attributes?.map((attr) => ({
      ...attr,
      values: attr.values ? { ...attr.values } : undefined,
      children: attr.children?.map((detail) => ({
        ...detail,
        values: detail.values ? { ...detail.values } : undefined,
      })),
    })),
  }));

const collectMeasureFields = (config: ETableTreeConfig): Set<string> => {
  const fields = new Set<string>();
  (config.measures ?? []).forEach((item) => fields.add(item.field));
  config.measureGroups?.forEach((group) => {
    group.measures.forEach((item) => fields.add(item.field));
  });
  if (!fields.size) {
    buildTreeColumns(config).forEach((column) => {
      const walk = (col: { id: string; children?: Array<{ id: string }> }) => {
        if (col.children?.length) {
          col.children.forEach(walk);
          return;
        }
        fields.add(col.id);
      };
      walk(column);
    });
    config.dimensions.forEach((item) => fields.delete(item.field));
    if (config.attribute?.field) {
      fields.delete(config.attribute.field);
    }
  }
  return fields;
};

const pickMeasures = (
  rowData: Record<string, ETablePrimitive | ETableCell>,
  measureFields: Set<string>,
): Record<string, ETablePrimitive> => {
  const values: Record<string, ETablePrimitive> = {};
  measureFields.forEach((field) => {
    if (rowData[field] !== undefined) {
      values[field] = toPrimitive(rowData[field]);
    }
  });
  return values;
};

const applyDimensionData = (
  target: Record<string, ETablePrimitive> | undefined,
  rowData: Record<string, ETablePrimitive | ETableCell>,
  dimensionFields: string[],
  labelField: string | undefined,
) => {
  if (!target) {
    return;
  }
  dimensionFields.forEach((field) => {
    if (field === labelField) {
      return;
    }
    if (rowData[field] !== undefined) {
      target[field] = toPrimitive(rowData[field]);
    }
  });
};

const mergeValues = (
  target: Record<string, ETablePrimitive | ETableCell> | undefined,
  patch: Record<string, ETablePrimitive>,
) => {
  if (!target) {
    return { ...patch };
  }
  return { ...target, ...patch };
};

const applyRowToAttribute = (
  attr: ETableTreeAttribute,
  rowData: Record<string, ETablePrimitive | ETableCell>,
  measureFields: Set<string>,
) => {
  const measures = pickMeasures(rowData, measureFields);
  if (Object.keys(measures).length) {
    attr.values = mergeValues(attr.values, measures);
  }
};

const applyRowToDetail = (
  detail: ETableTreeAttributeDetail,
  rowData: Record<string, ETablePrimitive | ETableCell>,
  measureFields: Set<string>,
) => {
  const measures = pickMeasures(rowData, measureFields);
  if (Object.keys(measures).length) {
    detail.values = mergeValues(detail.values, measures);
  }
};

const applyRowToNode = (
  node: ETableTreeNode,
  rowData: Record<string, ETablePrimitive | ETableCell>,
  config: ETableTreeConfig,
  measureFields: Set<string>,
  dimensionFields: string[],
  labelField: string | undefined,
) => {
  if (node.data) {
    applyDimensionData(node.data, rowData, dimensionFields, labelField);
  }

  const measures = pickMeasures(rowData, measureFields);
  if (!measures || !Object.keys(measures).length) {
    return;
  }

  if (node.attributes?.length) {
    const primary = node.attributes[0];
    primary.values = mergeValues(primary.values, measures);
    if (node.values) {
      node.values = mergeValues(node.values, measures);
    }
    return;
  }

  node.values = mergeValues(node.values, measures);
};

const walkMerge = (
  nodes: ETableTreeNode[],
  rowById: Map<string, Record<string, ETablePrimitive | ETableCell>>,
  config: ETableTreeConfig,
  measureFields: Set<string>,
  dimensionFields: string[],
  labelField: string | undefined,
) => {
  nodes.forEach((node) => {
    const rowData = rowById.get(node.id);
    if (rowData) {
      applyRowToNode(node, rowData, config, measureFields, dimensionFields, labelField);
    }

    node.attributes?.forEach((attr) => {
      const attrRow = rowById.get(attr.id);
      if (attrRow) {
        applyRowToAttribute(attr, attrRow, measureFields);
      }
      attr.children?.forEach((detail) => {
        const detailRow = rowById.get(detail.id);
        if (detailRow) {
          applyRowToDetail(detail, detailRow, measureFields);
        }
      });
    });

    if (node.children?.length) {
      walkMerge(
        node.children,
        rowById,
        config,
        measureFields,
        dimensionFields,
        labelField,
      );
    }
  });
};

/**
 * 将当前展平行（含用户编辑）合并回树形源数据结构。
 * 依赖 flatten 时写入的 row.id 与树节点 id 对应关系。
 */
export const mergeTreeDataWithRows = (
  treeData: ETableTreeNode[],
  treeConfig: ETableTreeConfig,
  rows: ETableRow[],
): ETableTreeNode[] => {
  if (!treeData.length) {
    return [];
  }

  const cloned = deepCloneTree(treeData);
  const rowById = new Map<string, Record<string, ETablePrimitive | ETableCell>>();
  rows.forEach((row) => {
    if (row.id && row.id !== '__group_grand_total__') {
      rowById.set(row.id, row.data);
    }
  });

  const measureFields = collectMeasureFields(treeConfig);
  const dimensionFields = treeConfig.dimensions.map((item) => item.field);
  const labelField = dimensionFields[0];

  walkMerge(cloned, rowById, treeConfig, measureFields, dimensionFields, labelField);
  return cloned;
};
