import type {
  ETableCell,
  ETableColumnGroup,
  ETableFlattenResult,
  ETableMerge,
  ETablePrimitive,
  ETableRow,
  ETableRowGroup,
  ETableTreeAttribute,
  ETableTreeColumnGroup,
  ETableTreeConfig,
  ETableTreeNode,
  ETableTreeToggleBinding,
} from './types';
import {
  applyGroupStatistics,
  computeGrandTotalValues,
} from './groupStatistics';

export const TREE_EXPAND_ICON = '▼';
export const TREE_COLLAPSE_ICON = '▶';

/**
 * 根据树形配置生成列定义。
 * 优先 measureGroups（多级表头：Region → Sales/Profit），否则用扁平 measures。
 */
export const buildTreeColumns = (config: ETableTreeConfig) => {
  const lockDims = Boolean(config.treeUI);
  const columns: Array<{
    id: string;
    title: string;
    width?: number;
    editable?: boolean;
    type?: 'text' | 'number' | 'date' | 'select';
    options?: string[];
    numberFormat?: string;
    children?: Array<{
      id: string;
      title: string;
      width?: number;
      editable?: boolean;
      type?: 'text' | 'number' | 'date' | 'select';
      options?: string[];
      numberFormat?: string;
    }>;
  }> = [
    ...config.dimensions.map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
      editable: lockDims ? false : undefined,
    })),
  ];
  if (config.attribute) {
    columns.push({
      id: config.attribute.field,
      title: config.attribute.title,
      width: config.attribute.width,
      editable: lockDims ? false : undefined,
    });
  }
  if (config.measureGroups?.length) {
    config.measureGroups.forEach((group) => {
      columns.push({
        id: group.id,
        title: group.title,
        children: group.measures.map((item) => ({
          id: item.field,
          title: item.title,
          width: item.width,
          type: item.type,
          options: item.options,
          numberFormat: item.numberFormat,
        })),
      });
    });
    return columns;
  }
  columns.push(
    ...(config.measures ?? []).map((item) => ({
      id: item.field,
      title: item.title,
      width: item.width,
      type: item.type,
      options: item.options,
      numberFormat: item.numberFormat,
    })),
  );
  return columns;
};

/**
 * 由 measureGroups 生成列大纲（Region 列折叠，与行树独立）。
 */
export const buildMeasureGroupColumnGroups = (
  config: ETableTreeConfig,
): ETableTreeColumnGroup[] => {
  if (!config.measureGroups?.length) {
    return [];
  }
  return config.measureGroups.map((group) => ({
    id: group.id,
    fields: group.measures.map((item) => item.field),
    collapsed: group.collapsed,
  }));
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

const toLabelCell = (
  text: string,
  options?: { bold?: boolean },
): ETablePrimitive | ETableCell => {
  if (!options?.bold) {
    return text;
  }
  return {
    value: text,
    style: { bl: 1 },
  };
};

const indentPrefix = (depth: number) => (depth > 0 ? '  '.repeat(depth) : '');

/** 树形 UI：缩进 + 可选 ▶/▼ */
export const formatTreeLabel = (
  label: string,
  depth: number,
  options?: { expandable?: boolean; collapsed?: boolean },
) => {
  const { expandable = false, collapsed = false } = options ?? {};
  if (expandable) {
    const icon = collapsed ? TREE_COLLAPSE_ICON : TREE_EXPAND_ICON;
    return `${indentPrefix(depth)}${icon} ${label}`;
  }
  return `${indentPrefix(depth)}${label}`;
};

const styleMeasureCell = (
  value: ETablePrimitive | ETableCell | undefined,
): ETablePrimitive | ETableCell | undefined => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'number') {
    if (value < 0) {
      return {
        value,
        style: { cl: { rgb: '#CF1322' } },
      };
    }
    return value;
  }
  const text = String(value);
  if (text.includes('-') && /[\d.]/.test(text)) {
    return {
      value,
      style: { cl: { rgb: '#CF1322' } },
    };
  }
  return value;
};

/**
 * 将树形数据展平为 ETable 可用的 rows / rowGroups / columnGroups / merges / columns。
 *
 * treeUI=true（推荐，对齐截图）：
 * - 父子写在同一维度列，子行缩进
 * - 可展开节点单元格内显示 ▶/▼
 * - 折叠后父行仍在，子行隐藏（Univer 行大纲）
 *
 * treeUI=false：保留旧的属性层纵向合并行为。
 */
export const flattenTreeData = (
  treeData: ETableTreeNode[] = [],
  config: ETableTreeConfig,
): ETableFlattenResult => {
  const stats = config.groupStatistics;
  const preparedTree =
    stats && stats.enabled !== false && stats.fields?.length
      ? applyGroupStatistics(treeData, stats, config)
      : treeData;

  const columns = buildTreeColumns(config);
  const rows: ETableRow[] = [];
  const rowGroups: ETableRowGroup[] = [];
  const merges: ETableMerge[] = [];
  const treeToggles: ETableTreeToggleBinding[] = [];
  const labelMode = config.labelMode ?? 'single';
  const treeUI = Boolean(config.treeUI);
  const DEFAULT_ROW_BACKGROUNDS = ['#E8F3FF', '#F5FAFF', '#FFFFFF'];
  const rowBackgrounds =
    config.rowBackgrounds?.length
      ? config.rowBackgrounds
      : treeUI
        ? DEFAULT_ROW_BACKGROUNDS
        : [];
  const regionDetailBackground =
    config.regionDetailBackground ?? (treeUI ? '#FAFBFC' : undefined);

  const resolveRowStyle = (
    depth: number,
    options?: { regionDetail?: boolean },
  ): ETableRow['style'] | undefined => {
    if (options?.regionDetail && regionDetailBackground) {
      return { bg: regionDetailBackground };
    }
    if (!rowBackgrounds.length) {
      return undefined;
    }
    const index = Math.min(Math.max(depth, 0), rowBackgrounds.length - 1);
    const bg = rowBackgrounds[index];
    return bg ? { bg } : undefined;
  };

  const dimensionFields = config.dimensions.map((item) => item.field);
  const attributeField = config.attribute?.field;
  const fieldColumnIndex = new Map<string, number>();

  // 叶子列顺序（与 renderHeader / 列大纲一致）
  let leafIndex = 0;
  const indexLeaves = (
    items: Array<{ id: string; children?: Array<{ id: string }> }>,
  ) => {
    items.forEach((column) => {
      if (column.children?.length) {
        indexLeaves(column.children);
        return;
      }
      fieldColumnIndex.set(column.id, leafIndex);
      leafIndex += 1;
    });
  };
  indexLeaves(columns);

  const columnGroups = buildTreeColumnGroups(
    [
      ...buildMeasureGroupColumnGroups(config),
      ...(config.columnGroups ?? []),
    ],
    fieldColumnIndex,
  );
  const labelColumn = fieldColumnIndex.get(dimensionFields[0] ?? '') ?? 0;
  const attributeColumn =
    attributeField !== undefined ? fieldColumnIndex.get(attributeField) : undefined;

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
    if (attributeField) {
      data[attributeField] = attributeLabel;
    }
    if (values) {
      Object.entries(values).forEach(([key, value]) => {
        data[key] = styleMeasureCell(value) as ETablePrimitive | ETableCell;
      });
    }
    return data;
  };

  const emitAttribute = (
    attr: ETableTreeAttribute,
    path: Record<string, ETablePrimitive>,
    options?: { clearCategory?: boolean; depth?: number },
  ): ETableRowGroup | null => {
    const hasDetails = Boolean(attr.children?.length);
    const collapsed = attr.collapsed ?? config.collapseAttributes ?? true;
    const displayLabel = treeUI
      ? formatTreeLabel(attr.label, 0, { expandable: hasDetails, collapsed })
      : attr.label;
    const depth = options?.depth ?? 0;

    // Region 明细行不占用 Category 列，避免看起来像 Category 子项
    const rowPath = { ...path };
    if (treeUI && options?.clearCategory && dimensionFields[0]) {
      rowPath[dimensionFields[0]] = '';
    }

    rows.push({
      id: attr.id,
      data: buildData(rowPath, displayLabel, attr.values),
      style: resolveRowStyle(depth, { regionDetail: options?.clearCategory }),
    });
    currentRow += 1;

    if (!hasDetails) {
      return null;
    }

    const headerRow = currentRow - 1;
    const detailStart = currentRow;
    attr.children!.forEach((detail) => {
      rows.push({
        id: detail.id,
        data: buildData(
          rowPath,
          treeUI ? formatTreeLabel(detail.label, 1) : detail.label,
          detail.values,
        ),
        style: resolveRowStyle(depth, { regionDetail: true }),
      });
      currentRow += 1;
    });

    const detailCount = currentRow - detailStart;
    if (detailCount <= 0) {
      return null;
    }

    const groupId = `${attr.id}-details`;
    if (treeUI && attributeColumn !== undefined) {
      treeToggles.push({
        groupId,
        row: headerRow,
        column: attributeColumn,
        collapsed,
        kind: 'region',
        expandedText: formatTreeLabel(attr.label, 0, { expandable: true, collapsed: false }),
        collapsedText: formatTreeLabel(attr.label, 0, { expandable: true, collapsed: true }),
      });
    }

    return {
      id: groupId,
      startRow: detailStart,
      count: detailCount,
      collapsed,
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
      const hasChildren = Boolean(node.children?.length);
      const hasAttributes = Boolean(node.attributes?.length);
      const collapsed = Boolean(node.collapsed);

      // treeUI：叶子节点 Region 写在 values[attributeField] 或 attributes[0] 同行展示
      if (treeUI && !hasChildren && hasAttributes) {
        const primary = node.attributes![0];
        const rest = node.attributes!.slice(1);
        const hasRegionDetails =
          Boolean(primary.children?.length) || rest.length > 0;
        const regionCollapsed =
          primary.collapsed ?? config.collapseAttributes ?? true;

        if (labelField) {
          path[labelField] = formatTreeLabel(node.label, depth);
        }
        if (node.data) {
          Object.assign(path, node.data);
        }

        const headerRow = currentRow;
        const regionLabel = formatTreeLabel(primary.label, 0, {
          expandable: hasRegionDetails,
          collapsed: regionCollapsed,
        });

        rows.push({
          id: node.id,
          data: buildData(path, regionLabel, {
            ...primary.values,
            ...node.values,
          }),
          style: resolveRowStyle(depth),
        });
        currentRow += 1;

        const detailStart = currentRow;
        const childGroups: ETableRowGroup[] = [];
        const regionPath = { ...path };
        if (labelField) {
          regionPath[labelField] = '';
        }

        primary.children?.forEach((detail) => {
          rows.push({
            id: detail.id,
            data: buildData(
              regionPath,
              formatTreeLabel(detail.label, 1),
              detail.values,
            ),
            style: resolveRowStyle(depth, { regionDetail: true }),
          });
          currentRow += 1;
        });

        rest.forEach((attr) => {
          const attrGroup = emitAttribute(attr, path, {
            clearCategory: true,
            depth,
          });
          if (attrGroup) {
            childGroups.push(attrGroup);
          }
        });

        const detailCount = currentRow - detailStart;
        if (detailCount > 0) {
          groups.push({
            id: node.id,
            startRow: detailStart,
            count: detailCount,
            collapsed: regionCollapsed,
            children: childGroups.length ? childGroups : undefined,
          });
          if (hasRegionDetails && attributeColumn !== undefined) {
            treeToggles.push({
              groupId: node.id,
              row: headerRow,
              column: attributeColumn,
              collapsed: regionCollapsed,
              kind: 'region',
              expandedText: formatTreeLabel(primary.label, 0, {
                expandable: true,
                collapsed: false,
              }),
              collapsedText: formatTreeLabel(primary.label, 0, {
                expandable: true,
                collapsed: true,
              }),
            });
          }
          // 中间维度列（如 Region=East）跨汇总行 + Region 明细行纵向合并
          if (node.data) {
            Object.entries(node.data).forEach(([key, value]) => {
              if (key === labelField || !fieldColumnIndex.has(key)) {
                return;
              }
              pushMerge(key, headerRow, 1 + detailCount, value);
            });
          }
        }
        return;
      }

      if (labelField) {
        path[labelField] = treeUI
          ? toLabelCell(
              formatTreeLabel(node.label, depth, {
                expandable: hasChildren,
                collapsed,
              }),
              { bold: hasChildren || depth === 0 },
            ) as any
          : node.label;
      }
      if (node.data) {
        Object.assign(path, node.data);
      }

      if (!hasChildren && !hasAttributes) {
        // 无 Region 明细时不显示假 ▶，只显示纯文本
        const regionFromValues =
          attributeField && node.values?.[attributeField] !== undefined
            ? String(node.values[attributeField])
            : '';
        const values = { ...node.values };
        if (attributeField && values[attributeField] !== undefined) {
          delete values[attributeField];
        }
        rows.push({
          id: node.id,
          data: buildData(path, regionFromValues, values),
          style: resolveRowStyle(depth),
        });
        currentRow += 1;
        return;
      }

      const summaryStart = currentRow;

      // treeUI：Category 子树 + Region 属性可分别折叠
      const primaryRegion = hasAttributes ? node.attributes![0] : undefined;
      const restRegions = hasAttributes ? node.attributes!.slice(1) : [];
      const regionCollapsed =
        primaryRegion?.collapsed ?? config.collapseAttributes ?? true;
      const hasRegionDetails =
        Boolean(primaryRegion?.children?.length) || restRegions.length > 0;

      let regionLabel = '';
      if (primaryRegion) {
        regionLabel = formatTreeLabel(primaryRegion.label, 0, {
          expandable: hasRegionDetails,
          collapsed: regionCollapsed,
        });
      } else if (attributeField && node.values?.[attributeField] !== undefined) {
        regionLabel = String(node.values[attributeField]);
      }

      const summaryValues = { ...node.values, ...primaryRegion?.values };
      if (attributeField && summaryValues[attributeField] !== undefined) {
        delete summaryValues[attributeField];
      }

      rows.push({
        id: node.id,
        data: buildData(path, regionLabel, summaryValues),
        style: resolveRowStyle(depth),
      });
      currentRow += 1;

      const childGroups: ETableRowGroup[] = [];

      // 1) Region 明细（Central / West / South 或 primary.children）
      let regionGroup: ETableRowGroup | null = null;
      if (treeUI && hasRegionDetails && primaryRegion) {
        const regionDetailStart = currentRow;
        const regionNested: ETableRowGroup[] = [];
        primaryRegion.children?.forEach((detail) => {
          const regionPath = { ...path };
          if (dimensionFields[0]) {
            regionPath[dimensionFields[0]] = '';
          }
          rows.push({
            id: detail.id,
            data: buildData(
              regionPath,
              formatTreeLabel(detail.label, 1),
              detail.values,
            ),
            style: resolveRowStyle(depth, { regionDetail: true }),
          });
          currentRow += 1;
        });
        restRegions.forEach((attr) => {
          const attrGroup = emitAttribute(attr, path, {
            clearCategory: true,
            depth,
          });
          if (attrGroup) {
            regionNested.push(attrGroup);
          }
        });
        const regionCount = currentRow - regionDetailStart;
        if (regionCount > 0) {
          const regionGroupId = `${node.id}-regions`;
          regionGroup = {
            id: regionGroupId,
            startRow: regionDetailStart,
            count: regionCount,
            collapsed: regionCollapsed,
            children: regionNested.length ? regionNested : undefined,
          };
          if (attributeColumn !== undefined) {
            treeToggles.push({
              groupId: regionGroupId,
              row: summaryStart,
              column: attributeColumn,
              collapsed: regionCollapsed,
              kind: 'region',
              expandedText: formatTreeLabel(primaryRegion.label, 0, {
                expandable: true,
                collapsed: false,
              }),
              collapsedText: formatTreeLabel(primaryRegion.label, 0, {
                expandable: true,
                collapsed: true,
              }),
            });
          }
        }
      } else if (!treeUI && hasAttributes) {
        node.attributes!.forEach((attr) => {
          const attrGroup = emitAttribute(attr, path);
          if (attrGroup) {
            childGroups.push(attrGroup);
          }
        });
      }

      // 2) Category 子节点
      let categoryGroup: ETableRowGroup | null = null;
      if (hasChildren) {
        const childParentPath = { ...parentPath };
        if (node.data) {
          Object.assign(childParentPath, node.data);
        }
        const categoryDetailStart = currentRow;
        const nested = walk(node.children!, depth + 1, childParentPath);
        const categoryCount = currentRow - categoryDetailStart;
        if (categoryCount > 0) {
          categoryGroup = {
            id: node.id,
            startRow: categoryDetailStart,
            count: categoryCount,
            collapsed: node.collapsed,
            children: nested.length ? nested : undefined,
          };
          childGroups.push(categoryGroup);
          if (treeUI) {
            treeToggles.push({
              groupId: node.id,
              row: summaryStart,
              column: labelColumn,
              collapsed,
              kind: 'category',
              expandedText: formatTreeLabel(node.label, depth, {
                expandable: true,
                collapsed: false,
              }),
              collapsedText: formatTreeLabel(node.label, depth, {
                expandable: true,
                collapsed: true,
              }),
            });
          }
        } else {
          childGroups.push(...nested);
        }
      }

      const totalCount = currentRow - summaryStart;
      const detailCount = currentRow - (summaryStart + 1);

      if (!treeUI && hasAttributes && !hasChildren) {
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

      // treeUI：中间维度列只跨「汇总 + Region 明细」，不吞进 Category 子行
      if (treeUI && node.data && regionGroup) {
        const regionSpan = 1 + regionGroup.count;
        Object.entries(node.data).forEach(([key, value]) => {
          if (key === labelField || !fieldColumnIndex.has(key)) {
            return;
          }
          pushMerge(key, summaryStart, regionSpan, value);
        });
      }

      // 顶层分组：包住该节点下全部明细，便于嵌套折叠
      if (detailCount > 0) {
        if (categoryGroup && regionGroup) {
          // 已分别注册 category / region 两组，再包一层总组会与 hideRows 冲突；
          // 只把子组挂到 groups，由各自 toggle 控制。
          groups.push(categoryGroup);
          groups.push(regionGroup);
          // regionGroup 已在 childGroups，避免重复；category 含 nested
        } else if (categoryGroup) {
          groups.push(categoryGroup);
        } else if (regionGroup) {
          groups.push(regionGroup);
        } else if (childGroups.length) {
          groups.push({
            id: node.id,
            startRow: summaryStart + 1,
            count: detailCount,
            collapsed: node.collapsed,
            children: childGroups,
          });
        }
      }
    });

    return groups;
  };

  rowGroups.push(...walk(preparedTree, 0, {}));

  // 总计行
  if (
    stats &&
    stats.enabled !== false &&
    stats.showGrandTotal &&
    stats.fields?.length &&
    preparedTree.length
  ) {
    const dim0 = dimensionFields[0];
    const totals = computeGrandTotalValues(preparedTree, stats);
    const totalLabel = stats.grandTotalLabel || '总计';
    const data: ETableRow['data'] = { ...totals };
    if (dim0) {
      data[dim0] = totalLabel;
    }
    if (attributeField) {
      data[attributeField] = '';
    }
    rows.push({
      id: '__group_grand_total__',
      data,
      style: {
        bg: stats.grandTotalBackground || '#FFF7E6',
      },
    });
  }

  return { columns, rows, rowGroups, columnGroups, merges, treeToggles };
};
