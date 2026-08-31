import type { ETablePrimitive, ETableTreeAttribute, ETableTreeNode } from './types';

const CATEGORY_NAMES = [
  '家具',
  '办公用品',
  '科技',
  '电子',
  '服饰',
  '食品',
  '健康',
  '运动',
] as const;

const LEAF_NAMES = [
  '书柜',
  '座椅',
  '收纳',
  '桌子',
  '装订',
  '纸品',
  '手机',
  '设备',
  '配件',
  '仓储',
] as const;

const STATUS_OPTIONS = ['已核验', '待复核', '异常'] as const;

/** 展平后超过该阈值时启用轻量树（叶子 1 行；品类行保留简化 Region 折叠） */
export const LARGE_TREE_FLAT_ROW_THRESHOLD = 5000;

/** 超过该阈值时数据/合并/折叠初始化走异步分片，避免主线程长时间阻塞 */
export const ASYNC_RENDER_ROW_THRESHOLD = 1000;

const NUMERIC_MEASURE_FIELDS = [
  'revenue',
  'productRevenue',
  'serviceRevenue',
  'orders',
  'onlineOrders',
  'offlineOrders',
  'avgOrder',
  'completion',
  'adjustmentFactor',
] as const;

/** 大数据场景用轻量格式，避免百万次 toLocaleString */
const moneyFast = (n: number) => n;

export const PROFIT_OPTIONS = ['High', 'Medium', 'Low', 'Loss'] as const;

export const toProfitLevel = (n: number): (typeof PROFIT_OPTIONS)[number] => {
  if (n < 0) return 'Loss';
  if (n < 1000) return 'Low';
  if (n < 10000) return 'Medium';
  return 'High';
};

/** 由 seed 生成稳定演示日期 YYYY-MM-DD */
export const toDemoDate = (seed: number): string => {
  const year = 2020 + (Math.abs(seed) % 6);
  const month = (Math.abs(seed * 7) % 12) + 1;
  const day = (Math.abs(seed * 13) % 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const makeLeafValues = (seed: number): Record<string, ETablePrimitive> => {
  const revenue = moneyFast((seed * 97) % 500000 + 50000);
  const orders = (seed * 13) % 800 + 50;
  const productRevenue = Math.round(revenue * 0.78);
  const onlineOrders = Math.round(orders * 0.63);
  const status = STATUS_OPTIONS[seed % STATUS_OPTIONS.length];
  return {
    region: '华东',
    revenue,
    productRevenue,
    serviceRevenue: revenue - productRevenue,
    orders,
    onlineOrders,
    offlineOrders: orders - onlineOrders,
    avgOrder: Math.round(revenue / Math.max(orders, 1)),
    completion: Number((0.85 + (seed % 15) / 100).toFixed(3)),
    owner: `负责人${(seed % 20) + 1}`,
    status,
    verified: status === '已核验' ? '是' : '否',
    updatedAt: toDemoDate(seed),
    attachment: '+ 上传',
    adjustmentFactor: Number((0.8 + (orders % 31) / 100).toFixed(2)),
  };
};

const aggregateLeafValues = (
  valuesList: Array<Record<string, ETablePrimitive>>,
): Record<string, ETablePrimitive> => {
  const totals: Record<string, number> = {};
  NUMERIC_MEASURE_FIELDS.forEach((field) => {
    totals[field] = 0;
  });

  valuesList.forEach((values) => {
    NUMERIC_MEASURE_FIELDS.forEach((field) => {
      const value = values[field];
      if (typeof value === 'number') {
        totals[field] += value;
      }
    });
  });

  const orders = totals.orders || 1;
  totals.avgOrder = Math.round(totals.revenue / orders);

  return {
    region: '华东',
    ...totals,
    owner: '—',
    status: '已核验',
    verified: '—',
    updatedAt: '—',
    attachment: '',
  };
};

const regionAttributesLite = (
  prefix: string,
  seed: number,
): ETableTreeAttribute[] => {
  const mk = (offset: number) => makeLeafValues(seed * 10 + offset);
  return [
    {
      id: `${prefix}-east`,
      label: '华东',
      collapsed: true,
      values: mk(0),
      children: [
        { id: `${prefix}-shanghai`, label: '上海', values: mk(1) },
        { id: `${prefix}-jiangsu`, label: '江苏', values: mk(2) },
      ],
    },
  ];
};

const regionAttributesFast = (
  prefix: string,
  seed: number,
): ETableTreeAttribute[] => {
  const mk = (offset: number) => makeLeafValues(seed * 10 + offset);
  return [
    {
      id: `${prefix}-east`,
      label: '华东',
      collapsed: true,
      values: mk(0),
      children: [
        { id: `${prefix}-shanghai`, label: '上海', values: mk(1) },
        { id: `${prefix}-jiangsu`, label: '江苏', values: mk(2) },
      ],
    },
    {
      id: `${prefix}-central`,
      label: '华中',
      values: mk(3),
      children: [
        { id: `${prefix}-hubei`, label: '湖北', values: mk(4) },
        { id: `${prefix}-henan`, label: '河南', values: mk(5) },
      ],
    },
    {
      id: `${prefix}-south`,
      label: '华南',
      values: mk(6),
    },
    {
      id: `${prefix}-north`,
      label: '华北',
      values: mk(7),
    },
  ];
};

/**
 * 估算展平后的工作表行数（含 Region 明细的完整树）。
 */
export const estimateTreeFlatRows = (
  categoryCount: number,
  leafPerCategory: number,
): number => 4 * categoryCount * (1 + leafPerCategory);

const getLeafMeasureValues = (node: ETableTreeNode): Record<string, ETablePrimitive> =>
  (node.attributes?.[0]?.values ?? node.values ?? {}) as Record<string, ETablePrimitive>;

/**
 * 轻量树：品类汇总 3 行（汇总 + 2 城市）+ 每个叶子 3 行（行本身 + 2 城市，折叠后隐藏）。
 */
export const estimateLiteTreeFlatRows = (
  categoryCount: number,
  leafPerCategory: number,
  compact = false,
): number =>
  compact
    ? categoryCount * (1 + leafPerCategory)
    : categoryCount * (3 + leafPerCategory * 3);

/**
 * 根据目标展平行数规划 Category 数量与子项数量。
 */
export const planScaledTree = (targetFlatRows: number) => {
  const useLite = targetFlatRows >= LARGE_TREE_FLAT_ROW_THRESHOLD;

  if (useLite) {
    const categoryCount = Math.min(
      100,
      Math.max(5, Math.round(Math.sqrt(targetFlatRows / 50))),
    );
    const leafPerCategory = Math.max(
      1,
      Math.floor((targetFlatRows / categoryCount - 3) / 3),
    );

    return {
      categoryCount,
      leafPerCategory,
      flatRowCount: estimateLiteTreeFlatRows(categoryCount, leafPerCategory),
      useLite: true as const,
    };
  }

  const categoryCount = Math.min(
    100,
    Math.max(3, Math.round(Math.sqrt(targetFlatRows / 40))),
  );
  const leafPerCategory = Math.max(
    1,
    Math.floor(targetFlatRows / (4 * categoryCount) - 1),
  );

  return {
    categoryCount,
    leafPerCategory,
    flatRowCount: estimateTreeFlatRows(categoryCount, leafPerCategory),
    useLite: false as const,
  };
};

/**
 * 分片生成大规模树形演示数据（品类 → 子项）。
 * 目标 ≥5000 行时使用轻量结构，避免 Region 明细导致行数膨胀 5～8 倍。
 */
export const generateScaledTreeData = (
  targetFlatRows: number,
  onProgress?: (percent: number) => void,
): Promise<{ treeData: ETableTreeNode[]; flatRowCount: number }> =>
  new Promise((resolve) => {
    const { categoryCount, leafPerCategory, flatRowCount, useLite } =
      planScaledTree(targetFlatRows);
    const treeData: ETableTreeNode[] = new Array(categoryCount);
    let categoryIndex = 0;

    const chunkSize =
      targetFlatRows >= 500000
        ? Math.max(500, Math.floor(leafPerCategory / 20))
        : Math.max(200, Math.floor(leafPerCategory / 10));

    const buildCategory = () => {
      const children: ETableTreeNode[] = new Array(leafPerCategory);
      let leafIndex = 0;

      const buildLeaves = () => {
        const end = Math.min(leafIndex + chunkSize, leafPerCategory);
        for (; leafIndex < end; leafIndex += 1) {
          const globalLeaf = categoryIndex * leafPerCategory + leafIndex;
          const leafName = `${LEAF_NAMES[globalLeaf % LEAF_NAMES.length]} ${globalLeaf + 1}`;

          if (useLite) {
            children[leafIndex] = {
              id: `leaf-${categoryIndex}-${leafIndex}`,
              label: leafName,
              collapsed: true,
              data: { subcategory: '华东' },
              attributes: regionAttributesLite(
                `leaf-${categoryIndex}-${leafIndex}`,
                globalLeaf + 1,
              ),
            };
          } else {
            children[leafIndex] = {
              id: `leaf-${categoryIndex}-${leafIndex}`,
              label: leafName,
              data: { subcategory: '华东' },
              attributes: regionAttributesFast(
                `leaf-${categoryIndex}-${leafIndex}`,
                globalLeaf + 1,
              ),
            };
          }
        }

        const categoryProgress =
          ((categoryIndex + leafIndex / leafPerCategory) / categoryCount) * 100;
        onProgress?.(Math.min(99, Math.round(categoryProgress)));

        if (leafIndex < leafPerCategory) {
          window.setTimeout(buildLeaves, 0);
          return;
        }

        if (useLite) {
          treeData[categoryIndex] = {
            id: `cat-${categoryIndex}`,
            label: `${CATEGORY_NAMES[categoryIndex % CATEGORY_NAMES.length]} ${categoryIndex + 1}`,
            collapsed: true,
            data: { subcategory: '华东' },
            attributes: regionAttributesLite(`cat-${categoryIndex}`, categoryIndex),
            values: aggregateLeafValues(children.map(getLeafMeasureValues)),
            children,
          };
        } else {
          treeData[categoryIndex] = {
            id: `cat-${categoryIndex}`,
            label: `${CATEGORY_NAMES[categoryIndex % CATEGORY_NAMES.length]} ${categoryIndex + 1}`,
            collapsed: true,
            data: { subcategory: '华东' },
            attributes: regionAttributesFast(`cat-${categoryIndex}`, categoryIndex),
            children,
          };
        }

        categoryIndex += 1;

        if (categoryIndex < categoryCount) {
          window.setTimeout(buildCategory, 0);
          return;
        }

        onProgress?.(100);
        resolve({ treeData, flatRowCount });
      };

      buildLeaves();
    };

    buildCategory();
  });
