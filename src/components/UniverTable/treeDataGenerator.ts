import type { ETableTreeAttribute, ETableTreeNode } from './types';

const CATEGORY_NAMES = [
  'Furniture',
  'Office Supplies',
  'Technology',
  'Electronics',
  'Apparel',
  'Food',
  'Health',
  'Sports',
] as const;

const LEAF_NAMES = [
  'Bookcases',
  'Chairs',
  'Furnishings',
  'Tables',
  'Binders',
  'Paper',
  'Phones',
  'Machines',
  'Accessories',
  'Storage',
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

const regionAttributesFast = (
  prefix: string,
  seed: number,
): ETableTreeAttribute[] => {
  const base = seed * 97;
  const mk = (offset: number): [number, number] => {
    const sales = (base + offset * 53) % 100000 + 1000;
    const profit = ((base + offset * 31) % 40000) - 8000;
    return [sales, profit];
  };
  const [east, central, west, south] = [mk(0), mk(1), mk(2), mk(3)];

  return [
    {
      id: `${prefix}-east`,
      label: 'East',
      collapsed: true,
      values: { sales: moneyFast(east[0]), profit: toProfitLevel(east[1]) },
    },
    {
      id: `${prefix}-central`,
      label: 'Central',
      values: { sales: moneyFast(central[0]), profit: toProfitLevel(central[1]) },
    },
    {
      id: `${prefix}-west`,
      label: 'West',
      values: { sales: moneyFast(west[0]), profit: toProfitLevel(west[1]) },
    },
    {
      id: `${prefix}-south`,
      label: 'South',
      values: { sales: moneyFast(south[0]), profit: toProfitLevel(south[1]) },
    },
  ];
};

/**
 * 估算展平后的工作表行数。
 * 每个带 Region 的节点：1 行汇总 + 3 行 Region 明细 = 4 行。
 */
export const estimateTreeFlatRows = (
  categoryCount: number,
  leafPerCategory: number,
): number => 4 * categoryCount * (1 + leafPerCategory);

/**
 * 根据目标展平行数规划 Category 数量与子项数量。
 */
export const planScaledTree = (targetFlatRows: number) => {
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
  };
};

/**
 * 分片生成大规模树形演示数据（Category → 子项，每行带 Region 折叠）。
 */
export const generateScaledTreeData = (
  targetFlatRows: number,
  onProgress?: (percent: number) => void,
): Promise<{ treeData: ETableTreeNode[]; flatRowCount: number }> =>
  new Promise((resolve) => {
    const { categoryCount, leafPerCategory, flatRowCount } =
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
          children[leafIndex] = {
            id: `leaf-${categoryIndex}-${leafIndex}`,
            label: `${LEAF_NAMES[globalLeaf % LEAF_NAMES.length]} ${globalLeaf + 1}`,
            attributes: regionAttributesFast(
              `leaf-${categoryIndex}-${leafIndex}`,
              globalLeaf + 1,
            ),
          };
        }

        const categoryProgress =
          ((categoryIndex + leafIndex / leafPerCategory) / categoryCount) * 100;
        onProgress?.(Math.min(99, Math.round(categoryProgress)));

        if (leafIndex < leafPerCategory) {
          window.setTimeout(buildLeaves, 0);
          return;
        }

        treeData[categoryIndex] = {
          id: `cat-${categoryIndex}`,
          label: `${CATEGORY_NAMES[categoryIndex % CATEGORY_NAMES.length]} ${categoryIndex + 1}`,
          collapsed: categoryIndex > 0,
          attributes: regionAttributesFast(`cat-${categoryIndex}`, categoryIndex),
          children,
        };
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
