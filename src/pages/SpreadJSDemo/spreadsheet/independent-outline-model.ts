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

export type ExtensionExpansionState = ReadonlyMap<string, ReadonlySet<string>>;

export type IndependentOutlineRow = {
  product: VisibleOutlineNode;
  region: VisibleOutlineNode;
  productBlockStart: boolean;
  productRowSpan: number;
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
      { id: 'furnishings', label: '装饰用品' },
    ],
  },
  {
    id: 'office',
    label: '办公用品',
    children: [
      { id: 'paper', label: '纸品' },
      { id: 'storage', label: '收纳' },
      { id: 'art', label: '美术用品' },
    ],
  },
  {
    id: 'technology',
    label: '技术产品',
    children: [
      { id: 'phones', label: '手机' },
      { id: 'accessories', label: '配件' },
      { id: 'machines', label: '设备' },
    ],
  },
] as const;

// 对应 VTable 示例 extensionRows 中的一棵 East -> State 扩展树。
export const REGION_TREE: readonly OutlineRoot[] = [
  {
    id: 'east',
    label: '华东',
    children: [
      { id: 'shanghai', label: '上海' },
      { id: 'jiangsu', label: '江苏' },
      { id: 'zhejiang', label: '浙江' },
      { id: 'anhui', label: '安徽' },
    ],
  },
] as const;

export const INITIAL_PRODUCT_EXPANDED = ['furniture'] as const;

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

export function getAllOutlineNodeIds(tree: readonly OutlineRoot[]) {
  return tree.flatMap((root) => [
    root.id,
    ...root.children.map((child) => child.id),
  ]);
}

const PRODUCT_LEAF_IDS = PRODUCT_TREE.flatMap((root) => root.children).map(
  (leaf) => leaf.id,
);
const REGION_LEAF_IDS = REGION_TREE.flatMap((root) => root.children).map(
  (leaf) => leaf.id,
);

function createLeafMetric(productId: string, regionId: string) {
  const productIndex = PRODUCT_LEAF_IDS.indexOf(productId) + 1;
  const regionIndex = REGION_LEAF_IDS.indexOf(regionId) + 1;
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
 * 复刻 VTable rowTree + extensionRows 的布局：第一棵树先产生可见产品节点，
 * 每个产品节点再拥有一棵独立的扩展树。产品节点在视图中只出现一次，
 * 由渲染层纵向合并它所覆盖的扩展行，而不是重复绘制同一个箭头。
 */
export function createIndependentOutlineRows(
  productExpanded: ReadonlySet<string>,
  extensionExpandedByProduct: ExtensionExpansionState,
): IndependentOutlineRow[] {
  const products = getVisibleOutlineNodes(PRODUCT_TREE, productExpanded);

  return products.flatMap((product) => {
    const regions = getVisibleOutlineNodes(
      REGION_TREE,
      extensionExpandedByProduct.get(product.id) ?? new Set<string>(),
    );

    return regions.map((region, regionIndex) => ({
      product,
      region,
      productBlockStart: regionIndex === 0,
      productRowSpan: regions.length,
      ...aggregateMetrics(product.leafIds, region.leafIds),
    }));
  });
}

export function getVisibleExtensionSummary(
  productExpanded: ReadonlySet<string>,
  extensionExpandedByProduct: ExtensionExpansionState,
) {
  const products = getVisibleOutlineNodes(PRODUCT_TREE, productExpanded);
  return {
    expanded: products.reduce(
      (count, product) =>
        count +
        REGION_TREE.filter((region) =>
          extensionExpandedByProduct.get(product.id)?.has(region.id),
        ).length,
      0,
    ),
    total: products.length * REGION_TREE.length,
  };
}

export function outlineNodeLabel(node: VisibleOutlineNode) {
  if (!node.isGroup) return node.label;
  return `${node.expanded ? '▼' : '▶'}  ${node.label}`;
}
