import type {
  ETableGroupStatisticField,
  ETableGroupStatistics,
  ETablePrimitive,
  ETableTreeAttribute,
  ETableTreeConfig,
  ETableTreeNode,
} from './types';

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; value?: unknown };
    return toNumber(obj.v ?? obj.value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const aggregateNumbers = (
  method: ETableGroupStatisticField['method'],
  values: number[],
): number | null => {
  if (!values.length) {
    return method === 'count' ? 0 : null;
  }
  switch (method ?? 'sum') {
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((sum, n) => sum + n, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'sum':
    default:
      return values.reduce((sum, n) => sum + n, 0);
  }
};

const cloneAttribute = (attr: ETableTreeAttribute): ETableTreeAttribute => ({
  ...attr,
  values: attr.values ? { ...attr.values } : undefined,
  children: attr.children?.map((detail) => ({
    ...detail,
    values: detail.values ? { ...detail.values } : undefined,
  })),
});

const cloneTree = (nodes: ETableTreeNode[]): ETableTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    data: node.data ? { ...node.data } : undefined,
    values: node.values ? { ...node.values } : undefined,
    attributes: node.attributes?.map(cloneAttribute),
    children: node.children ? cloneTree(node.children) : undefined,
  }));

const collectValueSources = (
  node: ETableTreeNode,
): Array<Record<string, ETablePrimitive | import('./types').ETableCell> | undefined> => {
  const sources: Array<
    Record<string, ETablePrimitive | import('./types').ETableCell> | undefined
  > = [];
  node.children?.forEach((child) => {
    sources.push(child.values);
  });
  node.attributes?.forEach((attr) => {
    sources.push(attr.values);
  });
  return sources;
};

const resolveStatName = (
  field: ETableGroupStatisticField,
  config: ETableTreeConfig,
): string => {
  if (field.name) {
    return field.name;
  }
  const measure = config.measures?.find((item) => item.field === field.field);
  if (measure?.title) {
    return measure.title;
  }
  for (const group of config.measureGroups ?? []) {
    const hit = group.measures.find((item) => item.field === field.field);
    if (hit?.title) {
      return hit.title;
    }
  }
  return field.field;
};

const formatLabel = (
  template: string | undefined,
  label: string,
  statName: string,
): string => {
  if (!template) {
    return label;
  }
  return template
    .replace(/\{label\}/g, label)
    .replace(/\{name\}/g, label)
    .replace(/\{statName\}/g, statName);
};

/**
 * 自底向上汇总数值指标，并按模板改写分组行名称。
 * 不修改入参，返回新树。
 */
export const applyGroupStatistics = (
  treeData: ETableTreeNode[],
  stats: ETableGroupStatistics,
  config: ETableTreeConfig,
): ETableTreeNode[] => {
  if (stats.enabled === false || !stats.fields?.length) {
    return treeData;
  }

  const cloned = cloneTree(treeData);
  const primaryStatName = resolveStatName(stats.fields[0], config);

  const walk = (node: ETableTreeNode): void => {
    node.children?.forEach(walk);

    const sources = collectValueSources(node);
    if (!sources.length) {
      return;
    }

    const aggregated: Record<string, ETablePrimitive> = {};
    stats.fields.forEach((field) => {
      const nums = sources
        .map((source) => toNumber(source?.[field.field]))
        .filter((n): n is number => n !== null);
      const value = aggregateNumbers(field.method, nums);
      if (value !== null) {
        aggregated[field.field] = Math.round(value * 10000) / 10000;
      }
    });

    node.values = {
      ...node.values,
      ...aggregated,
    };

    const originalLabel = node.label;
    node.label = formatLabel(
      stats.labelTemplate,
      originalLabel,
      primaryStatName,
    );
  };

  cloned.forEach(walk);
  return cloned;
};

/**
 * 汇总整棵树的指标，用于总计行。
 */
export const computeGrandTotalValues = (
  treeData: ETableTreeNode[],
  stats: ETableGroupStatistics,
): Record<string, ETablePrimitive> => {
  const result: Record<string, ETablePrimitive> = {};
  if (!stats.fields?.length) {
    return result;
  }

  const topValues = treeData.map((node) => node.values);
  stats.fields.forEach((field) => {
    const nums = topValues
      .map((source) => toNumber(source?.[field.field]))
      .filter((n): n is number => n !== null);
    // 若顶层已是分组汇总，直接再汇总一层；否则对顶层 values 求和
    const value = aggregateNumbers(field.method ?? 'sum', nums);
    if (value !== null) {
      result[field.field] = Math.round(value * 10000) / 10000;
    }
  });
  return result;
};

export const resolveGroupStatPrimaryName = (
  stats: ETableGroupStatistics,
  config: ETableTreeConfig,
): string => resolveStatName(stats.fields[0], config);
