export type Status = '已核验' | '待复核' | '异常';
export type PanelName =
  | 'comment'
  | 'history'
  | 'lineage'
  | 'attachment'
  | 'aggregate'
  | 'features'
  | null;
export type AggregateMode = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'CUSTOM';
export type DataMode = 'regular' | 'loading' | 'stress';
export type ToastTone = 'success' | 'error';
export type NumericDisplay =
  | 'currency'
  | 'percent'
  | 'decimal'
  | 'number'
  | 'mixed';

export type ToastState = {
  message: string;
  tone: ToastTone;
};

export type BusinessNode = {
  id: string;
  name: string;
  hierarchyRole: HierarchyRole;
  revenue: number;
  productRevenue: number;
  serviceRevenue: number;
  orders: number;
  onlineOrders: number;
  offlineOrders: number;
  avgOrder: number;
  completion: number;
  owner: string;
  status: Status;
  verified: boolean;
  updatedAt: Date;
  adjustmentFactor: number;
  children?: BusinessNode[];
};

export type CellAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  objectUrl: string;
  createdAt: number;
  lastModified: number;
};

export type DrillPathItem = Pick<BusinessNode, 'id' | 'name'>;
export type DrillView = readonly DrillPathItem[];

export type HierarchyRole = 'category' | 'subcategory' | 'region' | 'detail';
export type HierarchyField =
  | 'productHierarchy'
  | 'productAttribute'
  | 'regionHierarchy';
export type BusinessField = Exclude<
  keyof BusinessNode,
  'id' | 'children' | 'hierarchyRole'
>;
export type ColumnField = BusinessField | HierarchyField;
export type ViewRow = BusinessNode & {
  level: number;
  hasChildren?: boolean;
  productId: string;
  productLabel: string;
  productAttribute: string;
  productDepth: 0 | 1;
  productIsGroup: boolean;
  productExpanded: boolean;
  productBlockStart: boolean;
  productRowSpan: number;
  regionId: string;
  regionLabel: string;
  regionDepth: 0 | 1;
  regionIsGroup: boolean;
  regionExpanded: boolean;
  sourceNodeIds: readonly string[];
};

export type OutlineDimension = 'product' | 'region';
export type ExtensionExpansionState = ReadonlyMap<string, ReadonlySet<string>>;
export type OutlineSnapshot = {
  productExpanded: number;
  productTotal: number;
  regionExpanded: number;
  regionTotal: number;
  rowCount: number;
};

export type SelectedCell = {
  row: number;
  col: number;
  a1: string;
  key: string;
  field: string;
  fieldLabel: string;
  value: unknown;
  text: string;
  node: ViewRow;
};

export type SelectionStats = {
  cells: number;
  numeric: number;
  ignored: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  truncated: boolean;
  numericDisplay: NumericDisplay;
};

export type HistoryItem = {
  id: string;
  oldValue: unknown;
  newValue: unknown;
  source: string;
  createdAt: number;
};

export type ColumnDefinition = {
  field: ColumnField;
  label: string;
  width: number;
};

export const AGGREGATE_MODES = [
  'SUM',
  'AVG',
  'COUNT',
  'MIN',
  'MAX',
  'CUSTOM',
] as const satisfies readonly AggregateMode[];

export const COLUMNS: ColumnDefinition[] = [
  { field: 'productHierarchy', label: '第一列 · 产品树', width: 178 },
  { field: 'productAttribute', label: '第二列 · 产品属性', width: 144 },
  { field: 'regionHierarchy', label: '第三列 · 区域树', width: 168 },
  { field: 'revenue', label: '净收入', width: 112 },
  { field: 'productRevenue', label: '商品收入', width: 108 },
  { field: 'serviceRevenue', label: '服务收入', width: 108 },
  { field: 'orders', label: '订单数', width: 92 },
  { field: 'onlineOrders', label: '线上订单', width: 92 },
  { field: 'offlineOrders', label: '线下订单', width: 92 },
  { field: 'avgOrder', label: '客单价', width: 98 },
  { field: 'completion', label: '目标达成', width: 96 },
  { field: 'owner', label: '负责人', width: 84 },
  { field: 'status', label: '核验状态', width: 96 },
  { field: 'verified', label: '已核验', width: 82 },
  { field: 'updatedAt', label: '更新日期', width: 104 },
  { field: 'adjustmentFactor', label: '调整系数', width: 96 },
];

export const COLUMN_GROUPS = [
  { summaryCol: 3, detailStart: 4, detailCount: 7 },
  { summaryCol: 3, detailStart: 4, detailCount: 2 },
  { summaryCol: 6, detailStart: 7, detailCount: 3 },
  { summaryCol: 11, detailStart: 12, detailCount: 4 },
  { summaryCol: 11, detailStart: 12, detailCount: 2 },
] as const;

export const COLUMN_HEADER_SECTIONS = [
  { label: '业务维度', startCol: 0, colCount: 3 },
  { label: '核心经营指标', startCol: 3, colCount: 8 },
  { label: '业务治理', startCol: 11, colCount: 5 },
] as const;

// 业务维度列（产品树/产品属性/区域树）没有真实的二级表头细分，
// 因此不在此处列出——渲染时会让 COLUMN_HEADER_SECTIONS 的对应
// 表头纵向合并两行，避免出现内部代码名（rowTree / extensionRows）
// 这类开发调试信息展示给业务用户。
export const COLUMN_HEADER_GROUPS = [
  { label: '收入指标', startCol: 3, colCount: 3 },
  { label: '订单指标', startCol: 6, colCount: 4 },
  { label: '目标管理', startCol: 10, colCount: 1 },
  { label: '责任与核验', startCol: 11, colCount: 3 },
  { label: '记录信息', startCol: 14, colCount: 2 },
] as const;

export const PRODUCT_HIERARCHY_COLUMN = 0;
export const PRODUCT_ATTRIBUTE_COLUMN = 1;
export const REGION_HIERARCHY_COLUMN = 2;
export const HIERARCHY_COLUMN_COUNT = 3;
export const REVENUE_COLUMN = 3;
export const PRODUCT_REVENUE_COLUMN = 4;
export const SERVICE_REVENUE_COLUMN = 5;
export const ORDERS_COLUMN = 6;
export const ONLINE_ORDERS_COLUMN = 7;
export const OFFLINE_ORDERS_COLUMN = 8;
export const AVG_ORDER_COLUMN = 9;
export const COMPLETION_COLUMN = 10;
export const OWNER_COLUMN = 11;
export const STATUS_COLUMN = 12;
export const VERIFIED_COLUMN = 13;
export const UPDATED_AT_COLUMN = 14;
export const DECIMAL_COLUMN = 15;
export const DRILLABLE_METRIC_COLUMNS = new Set([
  REVENUE_COLUMN,
  PRODUCT_REVENUE_COLUMN,
  SERVICE_REVENUE_COLUMN,
  ORDERS_COLUMN,
  ONLINE_ORDERS_COLUMN,
  OFFLINE_ORDERS_COLUMN,
  AVG_ORDER_COLUMN,
  COMPLETION_COLUMN,
]);
export const STRESS_ROW_COUNT = 100_000;
export const STRESS_PAGE_SIZE = 400;
export const STRESS_FULL_PAGE_VISIBLE_ROWS = 8;
export const STRESS_TEXT_SEARCH_COLUMNS = new Set([0, 1, 2, 11, 12, 13, 14]);

export const FEATURES = [
  ['批注', '原生 + 稳定业务 ID'],
  ['下钻、上钻', '业务扩展'],
  ['撤销 / 重做', '原生'],
  ['批量复制', '原生矩形选区'],
  ['多列折叠', '汇总列常驻的原生 Outline'],
  ['多行折叠', '双列独立状态投影'],
  ['多层列表头', '三层 ColumnHeader + 两级原生 Outline'],
  ['自定义右键', '原生扩展菜单'],
  ['单元格类型', '下拉 / 日期 / 数字 / 复选'],
  ['持续维护', 'SpreadJS 19.1'],
  ['是否收费', '商业许可'],
  ['电子表格', '是'],
  ['自定义统计', 'SUM / AVG / COUNT / MIN / MAX'],
  ['单元格历史', '业务扩展'],
  ['数据追踪', '业务扩展'],
  ['快速搜索', '表内定位'],
  ['显示 / 隐藏列', '原生'],
  ['单元格附件', '稳定 ID 元数据 + CellButton'],
  ['大数据', '10 万行 × 16 列'],
  ['列宽拖动', '原生'],
  ['自适应内容宽度', '双击边界 / 工具栏'],
] as const;

export const EMPTY_STATS: SelectionStats = {
  cells: 1,
  numeric: 0,
  ignored: 1,
  sum: 0,
  average: 0,
  min: 0,
  max: 0,
  truncated: false,
  numericDisplay: 'number',
};

function makeNode(
  id: string,
  name: string,
  hierarchyRole: HierarchyRole,
  revenue: number,
  orders: number,
  completion: number,
  owner: string,
  status: Status,
  updatedAt: string,
  children?: BusinessNode[],
): BusinessNode {
  const productRevenue = Math.round(revenue * 0.78);
  const onlineOrders = Math.round(orders * 0.63);
  return {
    id,
    name,
    hierarchyRole,
    revenue,
    productRevenue,
    serviceRevenue: revenue - productRevenue,
    orders,
    onlineOrders,
    offlineOrders: orders - onlineOrders,
    avgOrder: Math.round(revenue / Math.max(orders, 1)),
    completion,
    owner,
    status,
    verified: status === '已核验',
    updatedAt: new Date(`${updatedAt}T00:00:00`),
    adjustmentFactor: Number((0.8 + (orders % 31) / 100).toFixed(2)),
    children,
  };
}

function makeGroup(
  id: string,
  name: string,
  hierarchyRole: Exclude<HierarchyRole, 'detail'>,
  children: BusinessNode[],
  owner: string,
  status: Status = '已核验',
): BusinessNode {
  const revenue = children.reduce((sum, child) => sum + child.revenue, 0);
  const orders = children.reduce((sum, child) => sum + child.orders, 0);
  const completion =
    children.reduce((sum, child) => sum + child.completion, 0) /
    Math.max(children.length, 1);
  return makeNode(
    id,
    name,
    hierarchyRole,
    revenue,
    orders,
    completion,
    owner,
    status,
    '2026-08-21',
    children,
  );
}

function makeRegion(
  id: string,
  name: string,
  children: BusinessNode[],
  owner: string,
) {
  return makeGroup(id, name, 'region', children, owner);
}

const furnitureBookcases = makeGroup(
  'furniture-bookcases',
  '书柜',
  'subcategory',
  [
    makeRegion(
      'bookcases-east',
      '华东',
      [
        makeNode(
          'bookcases-shanghai',
          '上海',
          'detail',
          2_086_400,
          352,
          0.982,
          '杨晨',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'bookcases-jiangsu',
          '江苏',
          'detail',
          1_638_400,
          294,
          0.953,
          '陈叶',
          '待复核',
          '2026-08-21',
        ),
      ],
      '周宁',
    ),
    makeRegion(
      'bookcases-central',
      '华中',
      [
        makeNode(
          'bookcases-hubei',
          '湖北',
          'detail',
          1_286_600,
          238,
          0.942,
          '孙毅',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'bookcases-henan',
          '河南',
          'detail',
          1_006_600,
          206,
          0.899,
          '徐昕',
          '待复核',
          '2026-08-20',
        ),
      ],
      '赵敏',
    ),
  ],
  '林嘉',
);

const furnitureChairs = makeGroup(
  'furniture-chairs',
  '座椅',
  'subcategory',
  [
    makeRegion(
      'chairs-east',
      '华东',
      [
        makeNode(
          'chairs-zhejiang',
          '浙江',
          'detail',
          2_483_500,
          414,
          0.934,
          '吴哲',
          '已核验',
          '2026-08-20',
        ),
        makeNode(
          'chairs-anhui',
          '安徽',
          'detail',
          1_783_500,
          314,
          0.904,
          '韩睿',
          '已核验',
          '2026-08-20',
        ),
      ],
      '周宁',
    ),
    makeRegion(
      'chairs-south',
      '华南',
      [
        makeNode(
          'chairs-guangdong',
          '广东',
          'detail',
          3_286_400,
          596,
          0.928,
          '黄清',
          '待复核',
          '2026-08-21',
        ),
        makeNode(
          'chairs-fujian',
          '福建',
          'detail',
          1_527_800,
          322,
          0.881,
          '罗蔚',
          '已核验',
          '2026-08-20',
        ),
      ],
      '苏然',
    ),
  ],
  '林嘉',
);

const officePaper = makeGroup(
  'office-paper',
  '纸品',
  'subcategory',
  [
    makeRegion(
      'paper-east',
      '华东',
      [
        makeNode(
          'paper-shanghai',
          '上海',
          'detail',
          1_486_400,
          442,
          0.972,
          '杨晨',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'paper-nanjing',
          '南京',
          'detail',
          1_138_400,
          344,
          0.943,
          '陈叶',
          '待复核',
          '2026-08-21',
        ),
      ],
      '周宁',
    ),
    makeRegion(
      'paper-north',
      '华北',
      [
        makeNode(
          'paper-beijing',
          '北京',
          'detail',
          1_686_600,
          408,
          0.922,
          '孙毅',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'paper-tianjin',
          '天津',
          'detail',
          906_600,
          256,
          0.889,
          '徐昕',
          '待复核',
          '2026-08-20',
        ),
      ],
      '赵敏',
    ),
  ],
  '罗蔚',
);

const officeStorage = makeGroup(
  'office-storage',
  '收纳',
  'subcategory',
  [
    makeRegion(
      'storage-central',
      '华中',
      [
        makeNode(
          'storage-wuhan',
          '武汉',
          'detail',
          1_583_500,
          374,
          0.924,
          '吴哲',
          '已核验',
          '2026-08-20',
        ),
        makeNode(
          'storage-changsha',
          '长沙',
          'detail',
          1_183_500,
          284,
          0.894,
          '韩睿',
          '已核验',
          '2026-08-20',
        ),
      ],
      '周宁',
    ),
    makeRegion(
      'storage-south',
      '华南',
      [
        makeNode(
          'storage-shenzhen',
          '深圳',
          'detail',
          2_186_400,
          496,
          0.918,
          '黄清',
          '待复核',
          '2026-08-21',
        ),
        makeNode(
          'storage-xiamen',
          '厦门',
          'detail',
          1_227_800,
          302,
          0.871,
          '罗蔚',
          '已核验',
          '2026-08-20',
        ),
      ],
      '苏然',
    ),
  ],
  '罗蔚',
);

const technologyMobile = makeGroup(
  'technology-mobile',
  '移动终端',
  'subcategory',
  [
    makeRegion(
      'mobile-east',
      '华东',
      [
        makeNode(
          'mobile-shanghai',
          '上海',
          'detail',
          4_862_000,
          1_034,
          1.036,
          '杨晨',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'mobile-zhejiang',
          '浙江',
          'detail',
          3_924_000,
          846,
          0.987,
          '吴哲',
          '已核验',
          '2026-08-21',
        ),
      ],
      '周宁',
    ),
    makeRegion(
      'mobile-north',
      '华北',
      [
        makeNode(
          'mobile-beijing',
          '北京',
          'detail',
          5_126_000,
          1_120,
          1.018,
          '孙毅',
          '待复核',
          '2026-08-21',
        ),
        makeNode(
          'mobile-tianjin',
          '天津',
          'detail',
          2_648_000,
          620,
          0.946,
          '徐昕',
          '已核验',
          '2026-08-20',
        ),
      ],
      '赵敏',
    ),
  ],
  '程澈',
);

const technologyEquipment = makeGroup(
  'technology-equipment',
  '办公设备',
  'subcategory',
  [
    makeRegion(
      'equipment-south',
      '华南',
      [
        makeNode(
          'equipment-shenzhen',
          '深圳',
          'detail',
          6_286_000,
          1_050,
          1.052,
          '黄清',
          '已核验',
          '2026-08-21',
        ),
        makeNode(
          'equipment-guangzhou',
          '广州',
          'detail',
          4_928_000,
          910,
          0.994,
          '罗蔚',
          '待复核',
          '2026-08-21',
        ),
      ],
      '苏然',
    ),
    makeRegion(
      'equipment-central',
      '华中',
      [
        makeNode(
          'equipment-wuhan',
          '武汉',
          'detail',
          3_824_000,
          770,
          0.968,
          '韩睿',
          '已核验',
          '2026-08-20',
        ),
        makeNode(
          'equipment-zhengzhou',
          '郑州',
          'detail',
          2_946_000,
          640,
          0.927,
          '陈叶',
          '异常',
          '2026-08-20',
        ),
      ],
      '赵敏',
    ),
  ],
  '程澈',
  '待复核',
);

export const BUSINESS_DATA = [
  makeGroup(
    'furniture',
    '家具',
    'category',
    [furnitureBookcases, furnitureChairs],
    '林嘉',
  ),
  makeGroup(
    'office-supplies',
    '办公用品',
    'category',
    [officePaper, officeStorage],
    '罗蔚',
    '待复核',
  ),
  makeGroup(
    'technology',
    '技术产品',
    'category',
    [technologyMobile, technologyEquipment],
    '程澈',
    '待复核',
  ),
];

export const INITIAL_PRODUCT_EXPANDED = ['furniture'] as const;

const PRODUCT_ATTRIBUTES: Readonly<Record<string, string>> = {
  furniture: '家居耐用品',
  'furniture-bookcases': '收纳家具',
  'furniture-chairs': '坐具',
  'office-supplies': '日常办公耗材',
  'office-paper': '纸制品',
  'office-storage': '收纳用品',
  technology: '数码与硬件',
  'technology-mobile': '移动终端',
  'technology-equipment': '商用硬件',
};

type VisibleProductNode = {
  node: BusinessNode;
  id: string;
  label: string;
  attribute: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
};

type RegionProjectionNode = {
  id: string;
  label: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
  sourceNodes: readonly BusinessNode[];
};

export function findBusinessNode(
  nodes: BusinessNode[],
  nodeId: string,
): BusinessNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findBusinessNode(node.children ?? [], nodeId);
    if (child) return child;
  }
  return undefined;
}

export function rootsForView(
  view: DrillView,
  roots: BusinessNode[] = BUSINESS_DATA,
) {
  let currentRoots = roots;
  for (const pathItem of view) {
    const currentNode = currentRoots.find((node) => node.id === pathItem.id);
    if (!currentNode?.children?.length) return [];
    currentRoots = currentNode.children;
  }
  return currentRoots;
}

export function pathForView(view: DrillView) {
  return ['全部业务', ...view.map((item) => item.name)];
}

function productRootsForView(view: DrillView) {
  return rootsForView(view).filter(
    (node) =>
      node.hierarchyRole === 'category' || node.hierarchyRole === 'subcategory',
  );
}

function productAttributeFor(node: BusinessNode) {
  return PRODUCT_ATTRIBUTES[node.id] ?? `${node.name}业务线`;
}

function getVisibleProducts(
  view: DrillView,
  expandedIds: ReadonlySet<string>,
): VisibleProductNode[] {
  return productRootsForView(view).flatMap((root) => {
    const children = (root.children ?? []).filter(
      (child) => child.hierarchyRole === 'subcategory',
    );
    const isGroup = children.length > 0;
    const expanded = isGroup && expandedIds.has(root.id);
    const rootNode: VisibleProductNode = {
      node: root,
      id: root.id,
      label: root.name,
      attribute: productAttributeFor(root),
      depth: 0,
      isGroup,
      expanded,
    };
    if (!expanded) return [rootNode];
    return [
      rootNode,
      ...children.map(
        (child): VisibleProductNode => ({
          node: child,
          id: child.id,
          label: child.name,
          attribute: productAttributeFor(child),
          depth: 1,
          isGroup: false,
          expanded: false,
        }),
      ),
    ];
  });
}

function productRegionSources(product: BusinessNode) {
  const productNodes =
    product.hierarchyRole === 'category'
      ? (product.children ?? []).filter(
          (child) => child.hierarchyRole === 'subcategory',
        )
      : [product];
  return productNodes.flatMap((node) =>
    (node.children ?? []).filter((child) => child.hierarchyRole === 'region'),
  );
}

const REGION_KEYS: Readonly<Record<string, string>> = {
  华东: 'east',
  华中: 'central',
  华南: 'south',
  华北: 'north',
};

function normalizedTreeKey(label: string) {
  return (
    REGION_KEYS[label] ??
    label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{Letter}\p{Number}-]/gu, '')
  );
}

function getRegionRoots(product: BusinessNode) {
  const groupedRegions = new Map<string, BusinessNode[]>();
  productRegionSources(product).forEach((region) => {
    const current = groupedRegions.get(region.name) ?? [];
    current.push(region);
    groupedRegions.set(region.name, current);
  });

  return [...groupedRegions.entries()].map(([label, regions]) => {
    const groupedDetails = new Map<string, BusinessNode[]>();
    regions.forEach((region) => {
      const details = region.children?.length ? region.children : [region];
      details.forEach((detail) => {
        const current = groupedDetails.get(detail.name) ?? [];
        current.push(detail);
        groupedDetails.set(detail.name, current);
      });
    });
    const rootId = `region:${normalizedTreeKey(label)}`;
    return {
      id: rootId,
      label,
      sourceNodes: [...groupedDetails.values()].flat(),
      children: [...groupedDetails.entries()].map(
        ([detailLabel, sourceNodes]) => ({
          id: `${rootId}:detail:${normalizedTreeKey(detailLabel)}`,
          label: detailLabel,
          sourceNodes,
        }),
      ),
    };
  });
}

function getVisibleRegions(
  product: BusinessNode,
  expandedIds: ReadonlySet<string>,
): RegionProjectionNode[] {
  return getRegionRoots(product).flatMap((root) => {
    const expanded = expandedIds.has(root.id);
    const rootNode: RegionProjectionNode = {
      id: root.id,
      label: root.label,
      depth: 0,
      isGroup: root.children.length > 0,
      expanded,
      sourceNodes: root.sourceNodes,
    };
    if (!expanded) return [rootNode];
    return [
      rootNode,
      ...root.children.map(
        (child): RegionProjectionNode => ({
          id: child.id,
          label: child.label,
          depth: 1,
          isGroup: false,
          expanded: false,
          sourceNodes: child.sourceNodes,
        }),
      ),
    ];
  });
}

function aggregateBusinessNodes(
  nodes: readonly BusinessNode[],
  fallback: BusinessNode,
) {
  const sourceNodes = nodes.length ? nodes : [fallback];
  const revenue = sourceNodes.reduce((sum, node) => sum + node.revenue, 0);
  const productRevenue = sourceNodes.reduce(
    (sum, node) => sum + node.productRevenue,
    0,
  );
  const serviceRevenue = sourceNodes.reduce(
    (sum, node) => sum + node.serviceRevenue,
    0,
  );
  const orders = sourceNodes.reduce((sum, node) => sum + node.orders, 0);
  const onlineOrders = sourceNodes.reduce(
    (sum, node) => sum + node.onlineOrders,
    0,
  );
  const offlineOrders = sourceNodes.reduce(
    (sum, node) => sum + node.offlineOrders,
    0,
  );
  const completion =
    sourceNodes.reduce(
      (sum, node) => sum + node.completion * (node.revenue || 1),
      0,
    ) / Math.max(revenue, 1);
  const status: Status = sourceNodes.some((node) => node.status === '异常')
    ? '异常'
    : sourceNodes.some((node) => node.status === '待复核')
    ? '待复核'
    : '已核验';
  const ownerNames = new Set(sourceNodes.map((node) => node.owner));
  const updatedAt = new Date(
    Math.max(...sourceNodes.map((node) => node.updatedAt.getTime())),
  );
  const adjustmentFactor =
    sourceNodes.reduce((sum, node) => sum + node.adjustmentFactor, 0) /
    sourceNodes.length;
  return {
    revenue,
    productRevenue,
    serviceRevenue,
    orders,
    onlineOrders,
    offlineOrders,
    avgOrder: Math.round(revenue / Math.max(orders, 1)),
    completion,
    owner: ownerNames.size === 1 ? sourceNodes[0].owner : fallback.owner,
    status,
    verified: status === '已核验',
    updatedAt,
    adjustmentFactor: Number(adjustmentFactor.toFixed(2)),
  };
}

export function createBusinessProjectionRows(
  view: DrillView,
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
): ViewRow[] {
  return getVisibleProducts(view, productExpanded).flatMap((product) => {
    const regions = getVisibleRegions(
      product.node,
      regionExpandedByProduct.get(product.id) ?? new Set<string>(),
    );
    return regions.map(
      (region, index): ViewRow => ({
        id: `${product.id}::${region.id}`,
        name: `${product.label} / ${region.label}`,
        hierarchyRole: product.isGroup ? 'category' : 'subcategory',
        ...aggregateBusinessNodes(region.sourceNodes, product.node),
        children: product.isGroup
          ? product.node.children?.filter(
              (child) => child.hierarchyRole === 'subcategory',
            )
          : undefined,
        level: product.depth,
        hasChildren: product.isGroup,
        productId: product.id,
        productLabel: product.label,
        productAttribute: product.attribute,
        productDepth: product.depth,
        productIsGroup: product.isGroup,
        productExpanded: product.expanded,
        productBlockStart: index === 0,
        productRowSpan: regions.length,
        regionId: region.id,
        regionLabel: region.label,
        regionDepth: region.depth,
        regionIsGroup: region.isGroup,
        regionExpanded: region.expanded,
        sourceNodeIds: region.sourceNodes.map((node) => node.id),
      }),
    );
  });
}

export function getProductGroupIdsForView(view: DrillView) {
  return productRootsForView(view)
    .filter((node) =>
      node.children?.some((child) => child.hierarchyRole === 'subcategory'),
    )
    .map((node) => node.id);
}

export function getAllProductIdsForView(view: DrillView) {
  return productRootsForView(view).flatMap((root) => [
    root.id,
    ...(root.children ?? [])
      .filter((child) => child.hierarchyRole === 'subcategory')
      .map((child) => child.id),
  ]);
}

export function getRegionGroupIdsForProduct(productId: string) {
  const product = findBusinessNode(BUSINESS_DATA, productId);
  return product ? getRegionRoots(product).map((region) => region.id) : [];
}

export function getBusinessProjectionSummary(
  view: DrillView,
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
): OutlineSnapshot {
  const productGroupIds = getProductGroupIdsForView(view);
  const products = getVisibleProducts(view, productExpanded);
  const regionGroups = products.flatMap((product) =>
    getRegionRoots(product.node).map((region) => ({
      productId: product.id,
      regionId: region.id,
    })),
  );
  return {
    productExpanded: productGroupIds.filter((id) => productExpanded.has(id))
      .length,
    productTotal: productGroupIds.length,
    regionExpanded: regionGroups.filter(({ productId, regionId }) =>
      regionExpandedByProduct.get(productId)?.has(regionId),
    ).length,
    regionTotal: regionGroups.length,
    rowCount: createBusinessProjectionRows(
      view,
      productExpanded,
      regionExpandedByProduct,
    ).length,
  };
}

export const INITIAL_DATASET_LABEL = `${
  createBusinessProjectionRows(
    [],
    new Set<string>(INITIAL_PRODUCT_EXPANDED),
    new Map<string, Set<string>>(),
  ).length
} 行 × ${COLUMNS.length} 列`;

export function canDrillNode(node: BusinessNode | ViewRow | null | undefined) {
  if (!node) return false;
  if ('productIsGroup' in node) return node.productIsGroup;
  return Boolean(node.children?.length);
}

export function viewForNode(
  view: DrillView,
  node: BusinessNode | ViewRow,
): DrillView | null {
  if (!canDrillNode(node)) return null;
  return [
    ...view,
    {
      id: 'productId' in node ? node.productId : node.id,
      name: 'productLabel' in node ? node.productLabel : node.name,
    },
  ];
}

export function stableCellKey(nodeId: string, field: string) {
  return `${nodeId}::${field}`;
}

export function columnName(col: number) {
  let name = '';
  let index = col + 1;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

const STRESS_OWNERS = [
  '林嘉',
  '周宁',
  '杨晨',
  '陈叶',
  '赵敏',
  '孙毅',
  '徐昕',
  '吴哲',
];
const STRESS_CITIES = [
  '上海',
  '苏州',
  '南京',
  '杭州',
  '广州',
  '厦门',
  '北京',
  '天津',
];

function createStressRecord(index: number): ViewRow {
  const positionInRegion = index % 10_000;
  const regionIndex = Math.floor(index / 10_000);
  const positionAfterRegion = Math.max(positionInRegion - 1, 0);
  const cityIndex = Math.floor(positionAfterRegion / 1_000);
  const isRegion = positionInRegion === 0;
  const isCity = !isRegion && positionAfterRegion % 1_000 === 0;
  const city = STRESS_CITIES[(regionIndex + cityIndex) % STRESS_CITIES.length];
  const revenue = 110_000 + ((index * 7_919) % 4_800_000);
  const orders = 30 + ((index * 37) % 970);
  const status: Status =
    index % 17 === 0 ? '异常' : index % 5 === 0 ? '待复核' : '已核验';
  const name = isRegion
    ? `压力区域 ${String(regionIndex + 1).padStart(2, '0')}`
    : isCity
    ? `${city}分区`
    : `${city}业务单元 ${String(index + 1).padStart(6, '0')}`;
  const productId = `stress-product-${Math.floor(index / 1_000)}`;
  const sourceId = `stress-${index}`;
  return {
    ...makeNode(
      sourceId,
      name,
      isRegion ? 'category' : isCity ? 'region' : 'detail',
      revenue,
      orders,
      0.72 + ((index * 13) % 35) / 100,
      STRESS_OWNERS[index % STRESS_OWNERS.length],
      status,
      index % 3 === 0 ? '2026-08-21' : '2026-08-20',
    ),
    level: isRegion ? 0 : isCity ? 1 : 2,
    hasChildren: false,
    productId,
    productLabel: `压力产品线 ${String(Math.floor(index / 1_000) + 1).padStart(
      3,
      '0',
    )}`,
    productAttribute: ['耐用品', '快消品', '数字产品'][index % 3],
    productDepth: 0,
    productIsGroup: false,
    productExpanded: false,
    productBlockStart: true,
    productRowSpan: 1,
    regionId: `stress-region-${regionIndex}-${cityIndex}`,
    regionLabel: name,
    regionDepth: isRegion ? 0 : 1,
    regionIsGroup: false,
    regionExpanded: false,
    sourceNodeIds: [sourceId],
  };
}

export function createStressRecords(size = STRESS_ROW_COUNT): ViewRow[] {
  return Array.from({ length: size }, (_, index) => createStressRecord(index));
}

let stressRecordsCache: ViewRow[] | null = null;
let stressRecordsPromise: Promise<ViewRow[]> | null = null;

export function getStressRecords() {
  stressRecordsCache ??= createStressRecords();
  return stressRecordsCache;
}

export async function getStressRecordsAsync() {
  if (stressRecordsCache) return stressRecordsCache;
  stressRecordsPromise ??= (async () => {
    const rows = new Array<ViewRow>(STRESS_ROW_COUNT);
    const chunkSize = 5_000;
    for (let start = 0; start < rows.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, rows.length);
      for (let index = start; index < end; index += 1)
        rows[index] = createStressRecord(index);
      if (end < rows.length) {
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function')
            requestAnimationFrame(() => resolve());
          else setTimeout(resolve, 0);
        });
      }
    }
    stressRecordsCache = rows;
    return rows;
  })();
  try {
    return await stressRecordsPromise;
  } finally {
    stressRecordsPromise = null;
  }
}

export function productHierarchyText(row: ViewRow) {
  if (!row.productBlockStart) return '';
  if (!row.productIsGroup) return row.productLabel;
  return `${row.productExpanded ? '▼' : '▶'}  ${row.productLabel}`;
}

export function regionHierarchyText(row: ViewRow) {
  if (!row.regionIsGroup) return row.regionLabel;
  return `${row.regionExpanded ? '▼' : '▶'}  ${row.regionLabel}`;
}

export function isHierarchyField(field: ColumnField): field is HierarchyField {
  return (
    field === 'productHierarchy' ||
    field === 'productAttribute' ||
    field === 'regionHierarchy'
  );
}

export function viewRowCellValue(row: ViewRow, col: number) {
  if (col === PRODUCT_HIERARCHY_COLUMN) return productHierarchyText(row);
  if (col === PRODUCT_ATTRIBUTE_COLUMN)
    return row.productBlockStart ? row.productAttribute : '';
  if (col === REGION_HIERARCHY_COLUMN) return regionHierarchyText(row);
  const column = COLUMNS[col];
  return column && !isHierarchyField(column.field) ? row[column.field] : null;
}

export function viewRowValues(row: ViewRow, columnCount: number) {
  return Array.from({ length: columnCount }, (_, col) =>
    viewRowCellValue(row, col),
  );
}

export function stressCellSearchText(
  row: ViewRow,
  col: number,
  includeFormattedNumber: boolean,
) {
  const value = viewRowCellValue(row, col);
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'boolean') return value ? '是 true' : '否 false';
  if (typeof value === 'number') {
    if (col === COMPLETION_COLUMN)
      return `${value} ${(value * 100).toFixed(1)}%`;
    if (col === DECIMAL_COLUMN) return `${value} ${value.toFixed(2)}`;
    if (includeFormattedNumber) {
      const currency =
        (col >= REVENUE_COLUMN && col <= SERVICE_REVENUE_COLUMN) ||
        col === AVG_ORDER_COLUMN
          ? '¥'
          : '';
      return `${value} ${currency}${value.toLocaleString('zh-CN')}`;
    }
    return String(value);
  }
  return value == null ? '' : String(value);
}

export function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (value instanceof Date) return value.toLocaleDateString('zh-CN');
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return value.toLocaleString('zh-CN');
  return String(value);
}

export function updateBusinessNode(
  node: BusinessNode,
  field: BusinessField,
  value: unknown,
) {
  switch (field) {
    case 'name':
      if (typeof value === 'string') node.name = value.replace(/^\u3000+/, '');
      break;
    case 'owner':
      if (typeof value === 'string') node.owner = value;
      break;
    case 'status':
      if (value === '已核验' || value === '待复核' || value === '异常') {
        node.status = value;
        node.verified = value === '已核验';
      }
      break;
    case 'verified':
      if (typeof value === 'boolean') {
        node.verified = value;
        if (value) node.status = '已核验';
        else if (node.status === '已核验') node.status = '待复核';
      }
      break;
    case 'updatedAt': {
      const nextDate = value instanceof Date ? value : new Date(String(value));
      if (!Number.isNaN(nextDate.getTime())) node.updatedAt = nextDate;
      break;
    }
    default:
      if (typeof value === 'number' && Number.isFinite(value))
        node[field] = value;
  }
}

export function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function numericDisplayForColumn(
  col: number,
): Exclude<NumericDisplay, 'mixed'> {
  if (
    (col >= REVENUE_COLUMN && col <= SERVICE_REVENUE_COLUMN) ||
    col === AVG_ORDER_COLUMN
  )
    return 'currency';
  if (col === COMPLETION_COLUMN) return 'percent';
  if (col === DECIMAL_COLUMN) return 'decimal';
  return 'number';
}

export function formatStatistic(value: number, display: NumericDisplay) {
  if (display === 'currency')
    return `¥${Math.round(value).toLocaleString('zh-CN')}`;
  if (display === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (display === 'decimal') return value.toFixed(2);
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export function formatMoney(value: number) {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

export function getAggregateValue(
  stats: SelectionStats,
  mode: AggregateMode,
  customFormula: string,
) {
  if (!stats.numeric) return null;
  if (mode === 'AVG') return stats.average;
  if (mode === 'COUNT') return stats.numeric;
  if (mode === 'MIN') return stats.min;
  if (mode === 'MAX') return stats.max;
  if (mode === 'CUSTOM') {
    return customFormula === '(MAX + MIN) / 2'
      ? (stats.max + stats.min) / 2
      : stats.sum / stats.numeric;
  }
  return stats.sum;
}
