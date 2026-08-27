export type OutlineLeaf = {
  id: string;
  label: string;
};

export type OutlineRoot = {
  id: string;
  label: string;
  children: readonly OutlineLeaf[];
};

export type VisibleOutlineNode = {
  id: string;
  label: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
  leafIds: readonly string[];
};

export type IndependentOutlineRow = {
  product: VisibleOutlineNode;
  region: VisibleOutlineNode;
  revenue: number;
  orders: number;
  profit: number;
};

export const PRODUCT_TREE: readonly OutlineRoot[] = [
  {
    id: 'furniture',
    label: '家具',
    children: [
      { id: 'bookcases', label: '书柜' },
      { id: 'chairs', label: '座椅' },
    ],
  },
  {
    id: 'office',
    label: '办公用品',
    children: [
      { id: 'paper', label: '纸品' },
      { id: 'storage', label: '收纳' },
    ],
  },
  {
    id: 'technology',
    label: '技术产品',
    children: [
      { id: 'phones', label: '手机' },
      { id: 'accessories', label: '配件' },
    ],
  },
] as const;

export const REGION_TREE: readonly OutlineRoot[] = [
  {
    id: 'east',
    label: '华东',
    children: [
      { id: 'shanghai', label: '上海' },
      { id: 'jiangsu', label: '江苏' },
    ],
  },
  {
    id: 'central',
    label: '华中',
    children: [
      { id: 'hubei', label: '湖北' },
      { id: 'henan', label: '河南' },
    ],
  },
  {
    id: 'south',
    label: '华南',
    children: [
      { id: 'guangdong', label: '广东' },
      { id: 'fujian', label: '福建' },
    ],
  },
] as const;

export const INITIAL_PRODUCT_EXPANDED = ['furniture'] as const;
export const INITIAL_REGION_EXPANDED = ['east', 'central'] as const;

export function getVisibleOutlineNodes(
  tree: readonly OutlineRoot[],
  expandedIds: ReadonlySet<string>,
): VisibleOutlineNode[] {
  return tree.flatMap((root) => {
    const expanded = expandedIds.has(root.id);
    const rootNode: VisibleOutlineNode = {
      id: root.id,
      label: root.label,
      depth: 0,
      isGroup: true,
      expanded,
      leafIds: root.children.map((child) => child.id),
    };

    if (!expanded) return [rootNode];

    return [
      rootNode,
      ...root.children.map(
        (child): VisibleOutlineNode => ({
          id: child.id,
          label: child.label,
          depth: 1,
          isGroup: false,
          expanded: false,
          leafIds: [child.id],
        }),
      ),
    ];
  });
}

function createLeafMetric(productId: string, regionId: string) {
  const productLeafIds = PRODUCT_TREE.flatMap((root) => root.children).map(
    (leaf) => leaf.id,
  );
  const regionLeafIds = REGION_TREE.flatMap((root) => root.children).map(
    (leaf) => leaf.id,
  );
  const productIndex = productLeafIds.indexOf(productId) + 1;
  const regionIndex = regionLeafIds.indexOf(regionId) + 1;
  const revenue =
    118_000 +
    productIndex * 47_600 +
    regionIndex * 31_400 +
    productIndex * regionIndex * 2_350;
  const orders = 72 + productIndex * 19 + regionIndex * 13;

  return {
    revenue,
    orders,
    profit: Math.round(
      revenue * (0.13 + ((productIndex + regionIndex) % 5) * 0.018),
    ),
  };
}

function aggregateMetrics(
  productLeafIds: readonly string[],
  regionLeafIds: readonly string[],
) {
  return productLeafIds.reduce(
    (total, productId) =>
      regionLeafIds.reduce((subtotal, regionId) => {
        const metric = createLeafMetric(productId, regionId);
        return {
          revenue: subtotal.revenue + metric.revenue,
          orders: subtotal.orders + metric.orders,
          profit: subtotal.profit + metric.profit,
        };
      }, total),
    { revenue: 0, orders: 0, profit: 0 },
  );
}

/**
 * 两棵树只共享最终的展示投影，不共享展开状态。每次切换任意维度后，
 * 重新计算两个可见节点集合的笛卡尔积，因此不会通过隐藏物理行误伤另一列。
 */
export function createIndependentOutlineRows(
  productExpanded: ReadonlySet<string>,
  regionExpanded: ReadonlySet<string>,
): IndependentOutlineRow[] {
  const products = getVisibleOutlineNodes(PRODUCT_TREE, productExpanded);
  const regions = getVisibleOutlineNodes(REGION_TREE, regionExpanded);

  return products.flatMap((product) =>
    regions.map((region) => ({
      product,
      region,
      ...aggregateMetrics(product.leafIds, region.leafIds),
    })),
  );
}

export function outlineNodeLabel(node: VisibleOutlineNode) {
  if (!node.isGroup) return node.label;
  return `${node.expanded ? '▼' : '▶'}  ${node.label}`;
}
