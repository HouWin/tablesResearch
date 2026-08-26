import type {
  ETableColumnGroup,
  ETableFlattenResult,
  ETableMerge,
  ETableRow,
  ETableRowGroup,
  ETableTreeAttribute,
  ETableTreeColumnGroup,
  ETableTreeConfig,
  ETableTreeNode,
  ETablePrimitive,
  ETableCell,
} from './types';

/**
 * 根据树形配置生成列定义。
 */
export const buildTreeColumns = (config: ETableTreeConfig) => {
  return [
    ...config.dimensions.map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
    })),
    {
      id: config.attribute.field,
      title: config.attribute.title,
      width: config.attribute.width,
    },
    ...config.measures.map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
    })),
  ];
};

/**
 * 将 field 列分组配置转成 Univer 列大纲所需的 startColumn / count。
 */
export const buildTreeColumnGroups = (
  groups: ETableTreeColumnGroup[] = [],
  fieldColumnIndex: Map<string, number>,
): ETableColumnGroup[] => {
  const result: ETableColumnGroup[] = [];

  groups.forEach((group) => {
    const indices = group.fields
      .map((field) => fieldColumnIndex.get(field))
      .filter((index): index is number => typeof index === 'number');

    if (!indices.length) {
      console.warn('[ETable] column group fields not found', group);
      return;
    }

    const startColumn = Math.min(...indices);
    const endColumn = Math.max(...indices);
    const count = endColumn - startColumn + 1;

    if (count <= 0) {
      return;
    }

    result.push({
      id: group.id,
      startColumn,
      count,
      collapsed: group.collapsed,
      children: group.children?.length
        ? buildTreeColumnGroups(group.children, fieldColumnIndex)
        : undefined,
    });
  });

  return result;
};

/**
 * 将树形数据展平为 ETable 可用的 rows / rowGroups / columnGroups / merges / columns。
 *
 * 规则：
 * 1. 有 children 或 attributes 的节点先写一行「汇总行」
 * 2. 明细行紧随其后；rowGroup 只包明细，折叠后汇总行仍在
 * 3. 叶子节点（带 attributes）会对维度列做纵向合并
 * 4. attributes 即最底层属性（如 East / Central / West / South）
 * 5. columnGroups 由 treeConfig.columnGroups（field 声明）转换而来
 */
export const flattenTreeData = (
  treeData: ETableTreeNode[] = [],
  config: ETableTreeConfig,
): ETableFlattenResult => {
  const columns = buildTreeColumns(config);
  const rows: ETableRow[] = [];
  const rowGroups: ETableRowGroup[] = [];
  const merges: ETableMerge[] = [];
  const labelMode = config.labelMode ?? 'single';

  const dimensionFields = config.dimensions.map((item) => item.field);
  const attributeField = config.attribute.field;
  const fieldColumnIndex = new Map<string, number>();
  columns.forEach((column, index) => {
    fieldColumnIndex.set(column.id, index);
  });

  const columnGroups = buildTreeColumnGroups(config.columnGroups ?? [], fieldColumnIndex);

  let currentRow = 0;

  const getLabelField = (depth: number): string | undefined => {
    if (!dimensionFields.length) {
      return undefined;
    }
    if (labelMode === 'single') {
      return dimensionFields[0];
    }
    return dimensionFields[Math.min(depth, dimensionFields.length - 1)];
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
      id: `merge-${field}-${startRow}`,
      row: startRow,
      column,
      rowSpan: count,
      columnSpan: 1,
      value,
    });
  };

  const buildData = (
    path: Record<string, ETablePrimitive>,
    attributeLabel: string,
    values?: Record<string, ETablePrimitive | ETableCell>,
  ): ETableRow['data'] => {
    const data: ETableRow['data'] = { ...path };
    data[attributeField] = attributeLabel;
    if (values) {
      Object.assign(data, values);
    }
    return data;
  };

  const emitAttribute = (
    attr: ETableTreeAttribute,
    path: Record<string, ETablePrimitive>,
  ): ETableRowGroup | null => {
    const hasDetails = Boolean(attr.children?.length);

    if (!hasDetails) {
      rows.push({
        id: attr.id,
        data: buildData(path, attr.label, attr.values),
      });
      currentRow += 1;
      return null;
    }

    rows.push({
      id: attr.id,
      data: buildData(path, attr.label, attr.values),
    });
    currentRow += 1;

    const detailStart = currentRow;
    attr.children!.forEach((detail) => {
      rows.push({
        id: detail.id,
        data: buildData(path, detail.label, detail.values),
      });
      currentRow += 1;
    });

    const detailCount = currentRow - detailStart;
    if (detailCount <= 0) {
      return null;
    }

    return {
      id: `${attr.id}-details`,
      startRow: detailStart,
      count: detailCount,
      collapsed: attr.collapsed ?? config.collapseAttributes ?? true,
    };
  };

  const walk = (
    nodes: ETableTreeNode[],
    depth: number,
    parentPath: Record<string, ETablePrimitive>,
  ): ETableRowGroup[] => {
    const groups: ETableRowGroup[] = [];

    nodes.forEach((node) => {
      const labelField = getLabelField(depth);
      const path: Record<string, ETablePrimitive> = { ...parentPath };
      if (labelField) {
        path[labelField] = node.label;
      }
      if (node.data) {
        Object.assign(path, node.data);
      }

      const hasChildren = Boolean(node.children?.length);
      const hasAttributes = Boolean(node.attributes?.length);

      if (!hasChildren && !hasAttributes) {
        rows.push({
          id: node.id,
          data: buildData(path, '', undefined),
        });
        currentRow += 1;
        return;
      }

      const summaryStart = currentRow;

      rows.push({
        id: node.id,
        data: buildData(path, '', undefined),
      });
      currentRow += 1;

      const detailStart = currentRow;
      const childGroups: ETableRowGroup[] = [];

      if (hasChildren) {
        childGroups.push(...walk(node.children!, depth + 1, path));
      }

      if (hasAttributes) {
        node.attributes!.forEach((attr) => {
          const attrGroup = emitAttribute(attr, path);
          if (attrGroup) {
            childGroups.push(attrGroup);
          }
        });
      }

      const totalCount = currentRow - summaryStart;
      const detailCount = currentRow - detailStart;

      /**
       * 叶子（属性层）：维度值在汇总行与属性行上一致，做纵向合并。
       * 非叶子：子节点会改写同列 label，只保留汇总行自己的值，不做跨子节点合并。
       */
      if (hasAttributes && !hasChildren) {
        if (labelField && totalCount > 1) {
          pushMerge(labelField, summaryStart, totalCount, node.label);
        }
        if (node.data) {
          Object.entries(node.data).forEach(([key, value]) => {
            if (key !== labelField && fieldColumnIndex.has(key)) {
              pushMerge(key, summaryStart, totalCount, value);
            }
          });
        }
      }

      if (detailCount > 0) {
        groups.push({
          id: node.id,
          startRow: detailStart,
          count: detailCount,
          collapsed: node.collapsed,
          children: childGroups.length ? childGroups : undefined,
        });
      }
    });

    return groups;
  };

  rowGroups.push(...walk(treeData, 0, {}));

  return { columns, rows, rowGroups, columnGroups, merges };
};
