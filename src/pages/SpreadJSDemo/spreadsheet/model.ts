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
  regionSummaries?: BusinessNode[];
  detailIds?: string[];
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
  'id' | 'children' | 'regionSummaries' | 'detailIds' | 'hierarchyRole'
>;
export type ColumnField = BusinessField | HierarchyField;
export type ViewRow = BusinessNode & {
  sourceNodes: readonly BusinessNode[];
  level: number;
  hasChildren?: boolean;
  productId: string;
  productParentId: string | null;
  productLabel: string;
  productAttribute: string;
  productDepth: 0 | 1;
  productIsGroup: boolean;
  productExpanded: boolean;
  productBlockStart: boolean;
  productRowSpan: number;
  regionId: string;
  regionRootId: string;
  regionLabel: string;
  regionDepth: 0 | 1;
  regionIsGroup: boolean;
  regionExpanded: boolean;
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

export type CellEditability = {
  editable: boolean;
  reason: string;
  sourceNode: BusinessNode | null;
};

type StressAggregationRange = {
  summaryRow: number;
  detailStart: number;
  detailCount: number;
  level: number;
  dimension: OutlineDimension;
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
  { field: 'productHierarchy', label: '产品层级', width: 178 },
  { field: 'productAttribute', label: '产品属性', width: 144 },
  { field: 'regionHierarchy', label: '区域层级', width: 168 },
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
export const SERVICE_REVENUE_COLUMN = 5;
export const ORDERS_COLUMN = 6;
export const AVG_ORDER_COLUMN = 9;
export const COMPLETION_COLUMN = 10;
export const STATUS_COLUMN = 12;
export const VERIFIED_COLUMN = 13;
export const UPDATED_AT_COLUMN = 14;
export const DECIMAL_COLUMN = 15;
export const STRESS_ROW_COUNT = 100_000;
export const STRESS_PAGE_SIZE = 400;
export const STRESS_FULL_PAGE_VISIBLE_ROWS = 8;
export const STRESS_TEXT_SEARCH_COLUMNS = new Set([0, 1, 2, 11, 12, 13, 14]);
// 模拟一次“分批拉取”的后端网络往返耗时：滚动到已加载数据底部时，
// 每批新数据都会先经历这段延迟，再返回给前端写入表格。
export const STRESS_PAGE_FETCH_DELAY_MS = 220;

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
  ['快速搜索', '全层级计数 / 自动展开定位'],
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

type BackendAggregateMetrics = Pick<
  BusinessNode,
  | 'revenue'
  | 'productRevenue'
  | 'serviceRevenue'
  | 'orders'
  | 'onlineOrders'
  | 'offlineOrders'
  | 'avgOrder'
  | 'completion'
  | 'adjustmentFactor'
>;

// 模拟后端直接返回的产品、子类和区域汇总指标。这里只做 ID 映射，
// 不根据 children 在浏览器中执行求和、平均值或状态归并。
const BACKEND_AGGREGATE_METRICS: Record<string, BackendAggregateMetrics> = {
  furniture: {
    revenue: 15_099_200,
    productRevenue: 11_777_376,
    serviceRevenue: 3_321_824,
    orders: 2_736,
    onlineOrders: 1_724,
    offlineOrders: 1_012,
    avgOrder: 5_519,
    completion: 0.927875,
    adjustmentFactor: 0.88,
  },
  'furniture-bookcases': {
    revenue: 6_018_000,
    productRevenue: 4_694_040,
    serviceRevenue: 1_323_960,
    orders: 1_090,
    onlineOrders: 687,
    offlineOrders: 403,
    avgOrder: 5_521,
    completion: 0.944,
    adjustmentFactor: 0.85,
  },
  'bookcases-east': {
    revenue: 3_724_800,
    productRevenue: 2_905_344,
    serviceRevenue: 819_456,
    orders: 646,
    onlineOrders: 407,
    offlineOrders: 239,
    avgOrder: 5_766,
    completion: 0.9675,
    adjustmentFactor: 1.06,
  },
  'bookcases-central': {
    revenue: 2_293_200,
    productRevenue: 1_788_696,
    serviceRevenue: 504_504,
    orders: 444,
    onlineOrders: 280,
    offlineOrders: 164,
    avgOrder: 5_165,
    completion: 0.9205,
    adjustmentFactor: 0.9,
  },
  'furniture-chairs': {
    revenue: 9_081_200,
    productRevenue: 7_083_336,
    serviceRevenue: 1_997_864,
    orders: 1_646,
    onlineOrders: 1_037,
    offlineOrders: 609,
    avgOrder: 5_517,
    completion: 0.91175,
    adjustmentFactor: 0.83,
  },
  'chairs-east': {
    revenue: 4_267_000,
    productRevenue: 3_328_260,
    serviceRevenue: 938_740,
    orders: 728,
    onlineOrders: 459,
    offlineOrders: 269,
    avgOrder: 5_861,
    completion: 0.919,
    adjustmentFactor: 0.95,
  },
  'chairs-south': {
    revenue: 4_814_200,
    productRevenue: 3_755_076,
    serviceRevenue: 1_059_124,
    orders: 918,
    onlineOrders: 578,
    offlineOrders: 340,
    avgOrder: 5_244,
    completion: 0.9045,
    adjustmentFactor: 0.99,
  },
  'office-supplies': {
    revenue: 11_399_200,
    productRevenue: 8_891_376,
    serviceRevenue: 2_507_824,
    orders: 2_906,
    onlineOrders: 1_831,
    offlineOrders: 1_075,
    avgOrder: 3_923,
    completion: 0.916625,
    adjustmentFactor: 1.03,
  },
  'office-paper': {
    revenue: 5_218_000,
    productRevenue: 4_070_040,
    serviceRevenue: 1_147_960,
    orders: 1_450,
    onlineOrders: 914,
    offlineOrders: 536,
    avgOrder: 3_599,
    completion: 0.9315,
    adjustmentFactor: 1.04,
  },
  'paper-east': {
    revenue: 2_624_800,
    productRevenue: 2_047_344,
    serviceRevenue: 577_456,
    orders: 786,
    onlineOrders: 495,
    offlineOrders: 291,
    avgOrder: 3_339,
    completion: 0.9575,
    adjustmentFactor: 0.91,
  },
  'paper-north': {
    revenue: 2_593_200,
    productRevenue: 2_022_696,
    serviceRevenue: 570_504,
    orders: 664,
    onlineOrders: 418,
    offlineOrders: 246,
    avgOrder: 3_905,
    completion: 0.9055,
    adjustmentFactor: 0.93,
  },
  'office-storage': {
    revenue: 6_181_200,
    productRevenue: 4_821_336,
    serviceRevenue: 1_359_864,
    orders: 1_456,
    onlineOrders: 917,
    offlineOrders: 539,
    avgOrder: 4_245,
    completion: 0.90175,
    adjustmentFactor: 1.1,
  },
  'storage-central': {
    revenue: 2_767_000,
    productRevenue: 2_158_260,
    serviceRevenue: 608_740,
    orders: 658,
    onlineOrders: 415,
    offlineOrders: 243,
    avgOrder: 4_205,
    completion: 0.909,
    adjustmentFactor: 0.87,
  },
  'storage-south': {
    revenue: 3_414_200,
    productRevenue: 2_663_076,
    serviceRevenue: 751_124,
    orders: 798,
    onlineOrders: 503,
    offlineOrders: 295,
    avgOrder: 4_278,
    completion: 0.8945,
    adjustmentFactor: 1.03,
  },
  technology: {
    revenue: 34_544_000,
    productRevenue: 26_944_320,
    serviceRevenue: 7_599_680,
    orders: 6_990,
    onlineOrders: 4_404,
    offlineOrders: 2_586,
    avgOrder: 4_942,
    completion: 0.991,
    adjustmentFactor: 0.95,
  },
  'technology-mobile': {
    revenue: 16_560_000,
    productRevenue: 12_916_800,
    serviceRevenue: 3_643_200,
    orders: 3_620,
    onlineOrders: 2_281,
    offlineOrders: 1_339,
    avgOrder: 4_575,
    completion: 0.99675,
    adjustmentFactor: 1.04,
  },
  'mobile-east': {
    revenue: 8_786_000,
    productRevenue: 6_853_080,
    serviceRevenue: 1_932_920,
    orders: 1_880,
    onlineOrders: 1_184,
    offlineOrders: 696,
    avgOrder: 4_673,
    completion: 1.0115,
    adjustmentFactor: 1,
  },
  'mobile-north': {
    revenue: 7_774_000,
    productRevenue: 6_063_720,
    serviceRevenue: 1_710_280,
    orders: 1_740,
    onlineOrders: 1_096,
    offlineOrders: 644,
    avgOrder: 4_468,
    completion: 0.982,
    adjustmentFactor: 0.84,
  },
  'technology-equipment': {
    revenue: 17_984_000,
    productRevenue: 14_027_520,
    serviceRevenue: 3_956_480,
    orders: 3_370,
    onlineOrders: 2_123,
    offlineOrders: 1_247,
    avgOrder: 5_336,
    completion: 0.98525,
    adjustmentFactor: 1.02,
  },
  'equipment-south': {
    revenue: 11_214_000,
    productRevenue: 8_746_920,
    serviceRevenue: 2_467_080,
    orders: 1_960,
    onlineOrders: 1_235,
    offlineOrders: 725,
    avgOrder: 5_721,
    completion: 1.023,
    adjustmentFactor: 0.87,
  },
  'equipment-central': {
    revenue: 6_770_000,
    productRevenue: 5_280_600,
    serviceRevenue: 1_489_400,
    orders: 1_410,
    onlineOrders: 888,
    offlineOrders: 522,
    avgOrder: 4_801,
    completion: 0.9475,
    adjustmentFactor: 0.95,
  },
};

function makeGroup(
  id: string,
  name: string,
  hierarchyRole: Exclude<HierarchyRole, 'detail'>,
  children: BusinessNode[],
  owner: string,
  status: Status = '已核验',
  regionSummaries?: BusinessNode[],
): BusinessNode {
  const metrics = BACKEND_AGGREGATE_METRICS[id];
  if (!metrics) throw new Error(`缺少后端汇总数据：${id}`);
  return {
    id,
    name,
    hierarchyRole,
    ...metrics,
    owner,
    status,
    verified: status === '已核验',
    updatedAt: new Date('2026-08-21T00:00:00'),
    children,
    regionSummaries,
  };
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

type BackendRegionSummaryInput = Omit<
  BusinessNode,
  'updatedAt' | 'children' | 'regionSummaries'
> & {
  updatedAt: string;
  detailIds: string[];
};

function backendRegionSummary(
  summary: BackendRegionSummaryInput,
): BusinessNode {
  return {
    ...summary,
    updatedAt: new Date(`${summary.updatedAt}T00:00:00`),
  };
}

export const BUSINESS_DATA = [
  makeGroup(
    'furniture',
    '家具',
    'category',
    [furnitureBookcases, furnitureChairs],
    '林嘉',
    '已核验',
    [
      backendRegionSummary({
        id: 'furniture-summary-east',
        name: '华东',
        hierarchyRole: 'region',
        revenue: 7_991_800,
        productRevenue: 6_233_604,
        serviceRevenue: 1_758_196,
        orders: 1_374,
        onlineOrders: 866,
        offlineOrders: 508,
        avgOrder: 5_816,
        completion: 0.9437314497359793,
        owner: '林嘉',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.9,
        detailIds: [
          'bookcases-shanghai',
          'bookcases-jiangsu',
          'chairs-zhejiang',
          'chairs-anhui',
        ],
      }),
      backendRegionSummary({
        id: 'furniture-summary-central',
        name: '华中',
        hierarchyRole: 'region',
        revenue: 2_293_200,
        productRevenue: 1_788_696,
        serviceRevenue: 504_504,
        orders: 444,
        onlineOrders: 280,
        offlineOrders: 164,
        avgOrder: 5_165,
        completion: 0.9231251526251527,
        owner: '林嘉',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 1,
        detailIds: ['bookcases-hubei', 'bookcases-henan'],
      }),
      backendRegionSummary({
        id: 'furniture-summary-south',
        name: '华南',
        hierarchyRole: 'region',
        revenue: 4_814_200,
        productRevenue: 3_755_076,
        serviceRevenue: 1_059_124,
        orders: 918,
        onlineOrders: 578,
        offlineOrders: 340,
        avgOrder: 5_244,
        completion: 0.9130844169332392,
        owner: '林嘉',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.9,
        detailIds: ['chairs-guangdong', 'chairs-fujian'],
      }),
    ],
  ),
  makeGroup(
    'office-supplies',
    '办公用品',
    'category',
    [officePaper, officeStorage],
    '罗蔚',
    '待复核',
    [
      backendRegionSummary({
        id: 'office-supplies-summary-east',
        name: '华东',
        hierarchyRole: 'region',
        revenue: 2_624_800,
        productRevenue: 2_047_344,
        serviceRevenue: 577_456,
        orders: 786,
        onlineOrders: 495,
        offlineOrders: 291,
        avgOrder: 3_339,
        completion: 0.9594224321853093,
        owner: '罗蔚',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.85,
        detailIds: ['paper-shanghai', 'paper-nanjing'],
      }),
      backendRegionSummary({
        id: 'office-supplies-summary-north',
        name: '华北',
        hierarchyRole: 'region',
        revenue: 2_593_200,
        productRevenue: 2_022_696,
        serviceRevenue: 570_504,
        orders: 664,
        onlineOrders: 418,
        offlineOrders: 246,
        avgOrder: 3_905,
        completion: 0.9104629801018047,
        owner: '罗蔚',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.86,
        detailIds: ['paper-beijing', 'paper-tianjin'],
      }),
      backendRegionSummary({
        id: 'office-supplies-summary-central',
        name: '华中',
        hierarchyRole: 'region',
        revenue: 2_767_000,
        productRevenue: 2_158_260,
        serviceRevenue: 608_740,
        orders: 658,
        onlineOrders: 415,
        offlineOrders: 243,
        avgOrder: 4_205,
        completion: 0.9111684134441633,
        owner: '罗蔚',
        status: '已核验',
        verified: true,
        updatedAt: '2026-08-20',
        adjustmentFactor: 0.83,
        detailIds: ['storage-wuhan', 'storage-changsha'],
      }),
      backendRegionSummary({
        id: 'office-supplies-summary-south',
        name: '华南',
        hierarchyRole: 'region',
        revenue: 3_414_200,
        productRevenue: 2_663_076,
        serviceRevenue: 751_124,
        orders: 798,
        onlineOrders: 502,
        offlineOrders: 296,
        avgOrder: 4_278,
        completion: 0.9010980610391892,
        owner: '罗蔚',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.92,
        detailIds: ['storage-shenzhen', 'storage-xiamen'],
      }),
    ],
  ),
  makeGroup(
    'technology',
    '技术产品',
    'category',
    [technologyMobile, technologyEquipment],
    '程澈',
    '待复核',
    [
      backendRegionSummary({
        id: 'technology-summary-east',
        name: '华东',
        hierarchyRole: 'region',
        revenue: 8_786_000,
        productRevenue: 6_853_080,
        serviceRevenue: 1_932_920,
        orders: 1_880,
        onlineOrders: 1_184,
        offlineOrders: 696,
        avgOrder: 4_673,
        completion: 1.0141156385158205,
        owner: '程澈',
        status: '已核验',
        verified: true,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.9,
        detailIds: ['mobile-shanghai', 'mobile-zhejiang'],
      }),
      backendRegionSummary({
        id: 'technology-summary-north',
        name: '华北',
        hierarchyRole: 'region',
        revenue: 7_774_000,
        productRevenue: 6_063_720,
        serviceRevenue: 1_710_280,
        orders: 1_740,
        onlineOrders: 1_097,
        offlineOrders: 643,
        avgOrder: 4_468,
        completion: 0.9934751736557756,
        owner: '程澈',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.82,
        detailIds: ['mobile-beijing', 'mobile-tianjin'],
      }),
      backendRegionSummary({
        id: 'technology-summary-south',
        name: '华南',
        hierarchyRole: 'region',
        revenue: 11_214_000,
        productRevenue: 8_746_920,
        serviceRevenue: 2_467_080,
        orders: 1_960,
        onlineOrders: 1_235,
        offlineOrders: 725,
        avgOrder: 5_721,
        completion: 1.0265118601747816,
        owner: '程澈',
        status: '待复核',
        verified: false,
        updatedAt: '2026-08-21',
        adjustmentFactor: 0.99,
        detailIds: ['equipment-shenzhen', 'equipment-guangzhou'],
      }),
      backendRegionSummary({
        id: 'technology-summary-central',
        name: '华中',
        hierarchyRole: 'region',
        revenue: 6_770_000,
        productRevenue: 5_280_600,
        serviceRevenue: 1_489_400,
        orders: 1_410,
        onlineOrders: 888,
        offlineOrders: 522,
        avgOrder: 4_801,
        completion: 0.9501586410635156,
        owner: '程澈',
        status: '异常',
        verified: false,
        updatedAt: '2026-08-20',
        adjustmentFactor: 1.03,
        detailIds: ['equipment-wuhan', 'equipment-zhengzhou'],
      }),
    ],
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
  parentId: string | null;
  label: string;
  attribute: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
};

type RegionProjectionNode = {
  id: string;
  rootId: string;
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
    const child = findBusinessNode(
      [...(node.children ?? []), ...(node.regionSummaries ?? [])],
      nodeId,
    );
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
      parentId: null,
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
          parentId: root.id,
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
  if (product.regionSummaries?.length) return product.regionSummaries;
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
  return productRegionSources(product).map((region) => {
    const rootId = `region:${normalizedTreeKey(region.name)}`;
    const details = region.detailIds?.length
      ? region.detailIds
          .map((detailId) => findBusinessNode(BUSINESS_DATA, detailId))
          .filter((detail): detail is BusinessNode => Boolean(detail))
      : region.children ?? [];
    return {
      id: rootId,
      label: region.name,
      sourceNodes: [region],
      children: details.map((detail) => ({
        id: `${rootId}:detail:${normalizedTreeKey(detail.name)}`,
        label: detail.name,
        sourceNodes: [detail],
      })),
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
      rootId: root.id,
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
          rootId: root.id,
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
    return regions.map((region, index): ViewRow => {
      const backendNode = region.sourceNodes[0] ?? product.node;
      return {
        ...backendNode,
        id: `${product.id}::${region.id}`,
        name: `${product.label} / ${region.label}`,
        hierarchyRole: product.isGroup ? 'category' : 'subcategory',
        children: product.isGroup
          ? product.node.children?.filter(
              (child) => child.hierarchyRole === 'subcategory',
            )
          : undefined,
        sourceNodes: region.sourceNodes,
        level: product.depth,
        hasChildren: product.isGroup,
        productId: product.id,
        productParentId: product.parentId,
        productLabel: product.label,
        productAttribute: product.attribute,
        productDepth: product.depth,
        productIsGroup: product.isGroup,
        productExpanded: product.expanded,
        productBlockStart: index === 0,
        productRowSpan: regions.length,
        regionId: region.id,
        regionRootId: region.rootId,
        regionLabel: region.label,
        regionDepth: region.depth,
        regionIsGroup: region.isGroup,
        regionExpanded: region.expanded,
      };
    });
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
  const regionGroups = getAllProductIdsForView(view).flatMap((productId) => {
    const product = findBusinessNode(BUSINESS_DATA, productId);
    return (product ? getRegionRoots(product) : []).map((region) => ({
      productId,
      regionId: region.id,
    }));
  });
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
const STRESS_BUSINESS_GROUPS = [
  '智能家居',
  '办公科技',
  '消费电子',
  '商业设备',
  '生活服务',
  '数字零售',
  '企业采购',
  '智慧门店',
  '渠道运营',
  '新兴业务',
];
const STRESS_PRODUCT_LINES = [
  '收纳家具',
  '人体工学坐具',
  '办公耗材',
  '移动终端',
  '商用硬件',
  '门店服务',
  '数字订阅',
  '渠道设备',
  '零售配件',
  '创新产品',
];
const STRESS_PRODUCT_ATTRIBUTES = ['耐用品', '快消品', '数字产品'];
const STRESS_REGIONS = [
  ['华东', '上海'],
  ['华东', '苏州'],
  ['华东', '杭州'],
  ['华中', '武汉'],
  ['华中', '郑州'],
  ['华南', '广州'],
  ['华南', '厦门'],
  ['华北', '北京'],
  ['华北', '天津'],
  ['西南', '成都'],
] as const;
const STRESS_CHANNELS = ['直营网点', '经销网点', '电商渠道', '企业客户'];

const STRESS_BUSINESS_GROUP_SIZE = 10_000;
const STRESS_PRODUCT_LINE_SIZE = 1_000;
const STRESS_REGION_SIZE = 100;

function createStressRecord(index: number): ViewRow {
  const positionInBusinessGroup = index % STRESS_BUSINESS_GROUP_SIZE;
  const businessGroupIndex = Math.floor(index / STRESS_BUSINESS_GROUP_SIZE);
  const positionAfterBusinessGroup = Math.max(positionInBusinessGroup - 1, 0);
  const productLineOffset = Math.floor(
    positionAfterBusinessGroup / STRESS_PRODUCT_LINE_SIZE,
  );
  const positionInProductLine =
    positionAfterBusinessGroup % STRESS_PRODUCT_LINE_SIZE;
  const regionOffset = Math.floor(positionInProductLine / STRESS_REGION_SIZE);
  const positionInRegion = positionInProductLine % STRESS_REGION_SIZE;
  const isBusinessGroup = positionInBusinessGroup === 0;
  const isProductLine = !isBusinessGroup && positionInProductLine === 0;
  const isRegion = !isBusinessGroup && positionInRegion === 0;
  const productLineIndex = businessGroupIndex * 10 + productLineOffset;
  const [regionName, city] =
    STRESS_REGIONS[regionOffset % STRESS_REGIONS.length];
  const businessGroupId = `stress-business-group-${businessGroupIndex}`;
  const productId = `stress-product-${productLineIndex}`;
  const regionId = isBusinessGroup
    ? `${businessGroupId}:region-all`
    : `${productId}:region-${regionOffset}`;
  const businessGroupLabel = `${STRESS_BUSINESS_GROUPS[businessGroupIndex]}事业群`;
  const productLabel = `${
    STRESS_PRODUCT_LINES[productLineOffset]
  }产品线 ${String(productLineIndex + 1).padStart(3, '0')}`;
  const regionLabel = `${regionName} · ${city}片区`;
  const detailLabel = `${city}${
    STRESS_CHANNELS[index % STRESS_CHANNELS.length]
  } ${String(index + 1).padStart(6, '0')}`;
  const revenue = 110_000 + ((index * 7_919) % 4_800_000);
  const orders = 30 + ((index * 37) % 970);
  const status: Status =
    index % 17 === 0 ? '异常' : index % 5 === 0 ? '待复核' : '已核验';
  const name = isBusinessGroup
    ? businessGroupLabel
    : isProductLine
    ? productLabel
    : isRegion
    ? regionLabel
    : detailLabel;
  const sourceId = `stress-${index}`;
  return {
    ...makeNode(
      sourceId,
      name,
      isBusinessGroup
        ? 'category'
        : isProductLine
        ? 'subcategory'
        : isRegion
        ? 'region'
        : 'detail',
      revenue,
      orders,
      0.72 + ((index * 13) % 35) / 100,
      STRESS_OWNERS[index % STRESS_OWNERS.length],
      status,
      index % 3 === 0 ? '2026-08-21' : '2026-08-20',
    ),
    sourceNodes: [],
    level: isBusinessGroup ? 0 : isProductLine ? 1 : isRegion ? 2 : 3,
    hasChildren: isBusinessGroup || isRegion,
    productId: isBusinessGroup ? businessGroupId : productId,
    productParentId: isBusinessGroup ? null : businessGroupId,
    productLabel: isBusinessGroup ? businessGroupLabel : productLabel,
    productAttribute: isBusinessGroup
      ? '战略业务组合'
      : STRESS_PRODUCT_ATTRIBUTES[productLineIndex % 3],
    productDepth: isBusinessGroup ? 0 : 1,
    productIsGroup: isBusinessGroup,
    productExpanded: isBusinessGroup,
    productBlockStart: isBusinessGroup || isProductLine,
    productRowSpan: isProductLine
      ? Math.min(
          STRESS_PRODUCT_LINE_SIZE,
          STRESS_BUSINESS_GROUP_SIZE - positionInBusinessGroup,
        )
      : 1,
    regionId,
    regionRootId: regionId,
    regionLabel: isBusinessGroup
      ? '全国 · 事业群汇总'
      : isRegion
      ? regionLabel
      : detailLabel,
    regionDepth: isRegion ? 0 : 1,
    regionIsGroup: isRegion,
    regionExpanded: isRegion,
  };
}

function getStressAggregationRanges(rows: ViewRow[]) {
  const groups: StressAggregationRange[] = [];
  let openProductSummary = -1;
  let openRegionSummary = -1;
  const closeGroup = (
    summaryRow: number,
    endRow: number,
    level: number,
    dimension: OutlineDimension,
  ) => {
    if (summaryRow < 0 || endRow <= summaryRow + 1) return;
    groups.push({
      summaryRow,
      detailStart: summaryRow + 1,
      detailCount: endRow - summaryRow - 1,
      level,
      dimension,
    });
  };

  rows.forEach((row, index) => {
    if (row.productBlockStart && row.productIsGroup) {
      closeGroup(openRegionSummary, index, 1, 'region');
      openRegionSummary = -1;
      closeGroup(openProductSummary, index, 0, 'product');
      openProductSummary = index;
    }
    if (row.regionIsGroup) {
      closeGroup(openRegionSummary, index, 1, 'region');
      openRegionSummary = index;
    }
  });
  closeGroup(openRegionSummary, rows.length, 1, 'region');
  closeGroup(openProductSummary, rows.length, 0, 'product');
  return groups.sort(
    (left, right) =>
      left.summaryRow - right.summaryRow || left.level - right.level,
  );
}

function applyStressGroupSummaries(rows: ViewRow[]) {
  getStressAggregationRanges(rows).forEach((group) => {
    const summary = rows[group.summaryRow];
    const endRow = group.detailStart + group.detailCount;
    let leafCount = 0;
    let revenue = 0;
    let productRevenue = 0;
    let serviceRevenue = 0;
    let orders = 0;
    let onlineOrders = 0;
    let offlineOrders = 0;
    let weightedCompletion = 0;
    let adjustmentFactor = 0;
    let abnormal = 0;
    let pending = 0;
    let latestUpdate = 0;
    for (let rowIndex = group.detailStart; rowIndex < endRow; rowIndex += 1) {
      const row = rows[rowIndex];
      if (row.hasChildren) continue;
      leafCount += 1;
      revenue += row.revenue;
      productRevenue += row.productRevenue;
      serviceRevenue += row.serviceRevenue;
      orders += row.orders;
      onlineOrders += row.onlineOrders;
      offlineOrders += row.offlineOrders;
      weightedCompletion += row.completion * row.revenue;
      adjustmentFactor += row.adjustmentFactor;
      latestUpdate = Math.max(latestUpdate, row.updatedAt.getTime());
      if (row.status === '异常') abnormal += 1;
      else if (row.status === '待复核') pending += 1;
    }
    if (!leafCount) return;
    const status: Status =
      abnormal / leafCount > 0.08
        ? '异常'
        : pending || abnormal
        ? '待复核'
        : '已核验';
    summary.revenue = revenue;
    summary.productRevenue = productRevenue;
    summary.serviceRevenue = serviceRevenue;
    summary.orders = orders;
    summary.onlineOrders = onlineOrders;
    summary.offlineOrders = offlineOrders;
    summary.avgOrder = Math.round(revenue / Math.max(orders, 1));
    summary.completion = weightedCompletion / Math.max(revenue, 1);
    summary.owner = '多负责人';
    summary.status = status;
    summary.verified = status === '已核验';
    summary.updatedAt = new Date(latestUpdate);
    summary.adjustmentFactor = Number(
      (adjustmentFactor / leafCount).toFixed(2),
    );
  });
}

type StressProjectionRegion = {
  id: string;
  label: string;
  summaryRows: ViewRow[];
  details: ViewRow[];
};

type StressProjectionProduct = {
  id: string;
  parentId: string | null;
  label: string;
  attribute: string;
  depth: 0 | 1;
  isGroup: boolean;
  summary: ViewRow;
  regions: StressProjectionRegion[];
  children: StressProjectionProduct[];
};

type StressProjectionIndex = {
  roots: StressProjectionProduct[];
  productGroups: string[];
  allProducts: string[];
  productsById: Map<string, StressProjectionProduct>;
};

const stressProjectionIndexCache = new WeakMap<
  ViewRow[],
  StressProjectionIndex
>();

function buildStressProjectionIndex(rows: ViewRow[]): StressProjectionIndex {
  const cached = stressProjectionIndexCache.get(rows);
  if (cached) return cached;

  const roots: StressProjectionProduct[] = [];
  const productGroups: string[] = [];
  const allProducts: string[] = [];
  const productsById = new Map<string, StressProjectionProduct>();

  for (
    let groupStart = 0;
    groupStart < rows.length;
    groupStart += STRESS_BUSINESS_GROUP_SIZE
  ) {
    const groupSummary = rows[groupStart];
    if (!groupSummary) break;
    const groupEnd = Math.min(
      rows.length,
      groupStart + STRESS_BUSINESS_GROUP_SIZE,
    );
    const categoryRegions = new Map<string, StressProjectionRegion>();
    const children: StressProjectionProduct[] = [];

    for (
      let productStart = groupStart + 1;
      productStart < groupEnd;
      productStart += STRESS_PRODUCT_LINE_SIZE
    ) {
      const productSummary = rows[productStart];
      if (!productSummary) break;
      const productEnd = Math.min(
        groupEnd,
        productStart + STRESS_PRODUCT_LINE_SIZE,
      );
      const regions: StressProjectionRegion[] = [];

      for (
        let regionStart = productStart;
        regionStart < productEnd;
        regionStart += STRESS_REGION_SIZE
      ) {
        const regionSummary = rows[regionStart];
        if (!regionSummary) break;
        const regionEnd = Math.min(
          productEnd,
          regionStart + STRESS_REGION_SIZE,
        );
        const details = rows.slice(regionStart + 1, regionEnd);
        const region: StressProjectionRegion = {
          id: regionSummary.regionRootId,
          label: regionSummary.regionLabel,
          summaryRows: details,
          details,
        };
        regions.push(region);

        const categoryRegionId = `${groupSummary.productId}:region-${
          regions.length - 1
        }`;
        let categoryRegion = categoryRegions.get(region.label);
        if (!categoryRegion) {
          categoryRegion = {
            id: categoryRegionId,
            label: region.label,
            summaryRows: [],
            details: [],
          };
          categoryRegions.set(region.label, categoryRegion);
        }
        categoryRegion.summaryRows.push(...details);
        // 事业群区域展开到产品线汇总即可；明细记录仍由对应产品线的
        // 区域节点展开。这样与常规模式的“父级聚合、子级明细”一致，
        // 也避免同一批 10 万条事实在父子产品下重复投影。
        categoryRegion.details.push({
          ...regionSummary,
          id: `${regionSummary.id}:category-detail`,
          name: productSummary.productLabel,
          regionLabel: productSummary.productLabel,
          sourceNodes: details,
        });
      }

      const product: StressProjectionProduct = {
        id: productSummary.productId,
        parentId: groupSummary.productId,
        label: productSummary.productLabel,
        attribute: productSummary.productAttribute,
        depth: 1,
        isGroup: false,
        summary: productSummary,
        regions,
        children: [],
      };
      children.push(product);
      allProducts.push(product.id);
      productsById.set(product.id, product);
    }

    const root: StressProjectionProduct = {
      id: groupSummary.productId,
      parentId: null,
      label: groupSummary.productLabel,
      attribute: groupSummary.productAttribute,
      depth: 0,
      isGroup: children.length > 0,
      summary: groupSummary,
      regions: [...categoryRegions.values()],
      children,
    };
    roots.push(root);
    productGroups.push(root.id);
    allProducts.push(root.id);
    productsById.set(root.id, root);
  }

  const index = { roots, productGroups, allProducts, productsById };
  stressProjectionIndexCache.set(rows, index);
  return index;
}

function stressRegionSummary(
  product: StressProjectionProduct,
  region: StressProjectionRegion,
) {
  const fallback =
    region.summaryRows[0] ?? region.details[0] ?? product.summary;
  return {
    ...fallback,
    ...aggregateBusinessNodes(
      region.summaryRows.length ? region.summaryRows : region.details,
      fallback,
    ),
  };
}

function projectStressProduct(
  product: StressProjectionProduct,
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
) {
  const expandedRegions =
    regionExpandedByProduct.get(product.id) ?? new Set<string>();
  const rows = product.regions.flatMap((region) => {
    const summary = stressRegionSummary(product, region);
    const expanded = expandedRegions.has(region.id);
    const root: ViewRow = {
      ...summary,
      id: `${product.id}::${region.id}`,
      name: `${product.label} / ${region.label}`,
      hierarchyRole: product.isGroup ? 'category' : 'subcategory',
      children: undefined,
      sourceNodes: region.summaryRows.flatMap((row) =>
        row.sourceNodes.length ? row.sourceNodes : [row],
      ),
      level: product.depth,
      hasChildren: product.isGroup,
      productId: product.id,
      productParentId: product.parentId,
      productLabel: product.label,
      productAttribute: product.attribute,
      productDepth: product.depth,
      productIsGroup: product.isGroup,
      productExpanded: product.isGroup && productExpanded.has(product.id),
      productBlockStart: false,
      productRowSpan: 1,
      regionId: region.id,
      regionRootId: region.id,
      regionLabel: region.label,
      regionDepth: 0,
      regionIsGroup: region.details.length > 0,
      regionExpanded: expanded,
    };
    if (!expanded) return [root];
    return [
      root,
      ...region.details.map((detail): ViewRow => {
        const sourceNodes = detail.sourceNodes.length
          ? detail.sourceNodes
          : [detail];
        return {
          ...detail,
          ...aggregateBusinessNodes(sourceNodes, detail),
          id: `${product.id}::${region.id}::${detail.id}`,
          name: `${product.label} / ${detail.regionLabel}`,
          hierarchyRole: 'detail',
          children: undefined,
          sourceNodes,
          level: product.depth,
          hasChildren: false,
          productId: product.id,
          productParentId: product.parentId,
          productLabel: product.label,
          productAttribute: product.attribute,
          productDepth: product.depth,
          productIsGroup: product.isGroup,
          productExpanded: product.isGroup && productExpanded.has(product.id),
          productBlockStart: false,
          productRowSpan: 1,
          regionId: `${region.id}:detail:${detail.id}`,
          regionRootId: region.id,
          regionLabel: detail.regionLabel,
          regionDepth: 1,
          regionIsGroup: false,
          regionExpanded: false,
        };
      }),
    ];
  });
  if (!rows.length) return rows;
  rows[0].productBlockStart = true;
  rows[0].productRowSpan = rows.length;
  return rows;
}

/**
 * 10 万条底层记录的可见行投影。这里刻意复用常规模式的交互语义：
 * 产品列和区域列分别维护展开状态，任一列变化都只重建可见行，不借助
 * 整行 Outline 隐藏另一列的数据。
 */
export function createStressProjectionRows(
  sourceRows: ViewRow[],
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
) {
  const index = buildStressProjectionIndex(sourceRows);
  return index.roots.flatMap((root) => {
    const products = productExpanded.has(root.id)
      ? [root, ...root.children]
      : [root];
    return products.flatMap((product) =>
      projectStressProduct(product, productExpanded, regionExpandedByProduct),
    );
  });
}

export function getStressProductGroupIds(sourceRows: ViewRow[]) {
  return buildStressProjectionIndex(sourceRows).productGroups;
}

export function getStressAllProductIds(sourceRows: ViewRow[]) {
  return buildStressProjectionIndex(sourceRows).allProducts;
}

export function getStressRegionGroupIdsForProduct(
  sourceRows: ViewRow[],
  productId: string,
) {
  return (
    buildStressProjectionIndex(sourceRows).productsById.get(productId)
      ?.regions ?? []
  ).map((region) => region.id);
}

export function getStressProjectionSummary(
  sourceRows: ViewRow[],
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
): OutlineSnapshot {
  const index = buildStressProjectionIndex(sourceRows);
  const regionGroups = index.allProducts.flatMap((productId) =>
    (index.productsById.get(productId)?.regions ?? []).map((region) => ({
      productId,
      regionId: region.id,
    })),
  );
  const rowCount = index.roots.reduce((total, root) => {
    const products = productExpanded.has(root.id)
      ? [root, ...root.children]
      : [root];
    return (
      total +
      products.reduce(
        (productTotal, product) =>
          productTotal +
          product.regions.reduce(
            (regionTotal, region) =>
              regionTotal +
              1 +
              (regionExpandedByProduct.get(product.id)?.has(region.id)
                ? region.details.length
                : 0),
            0,
          ),
        0,
      )
    );
  }, 0);
  return {
    productExpanded: index.productGroups.filter((id) => productExpanded.has(id))
      .length,
    productTotal: index.productGroups.length,
    regionExpanded: regionGroups.filter(({ productId, regionId }) =>
      regionExpandedByProduct.get(productId)?.has(regionId),
    ).length,
    regionTotal: regionGroups.length,
    rowCount,
  };
}

let stressRecordsCache: ViewRow[] | null = null;
let stressRecordsPromise: Promise<ViewRow[]> | null = null;
let stressRecordsCacheEpoch = 0;

export async function getStressRecordsAsync() {
  if (stressRecordsCache) return stressRecordsCache;
  stressRecordsPromise ??= (async () => {
    const cacheEpoch = stressRecordsCacheEpoch;
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
    applyStressGroupSummaries(rows);
    if (cacheEpoch === stressRecordsCacheEpoch) stressRecordsCache = rows;
    return rows;
  })();
  try {
    return await stressRecordsPromise;
  } finally {
    stressRecordsPromise = null;
  }
}

export function releaseStressRecords() {
  stressRecordsCacheEpoch += 1;
  stressRecordsCache = null;
}

// 模拟一次分批加载请求的网络往返：可见投影（含展开/折叠、汇总合并后的
// 树形结构）已经在内存中就绪，这里只补上“这批数据是从后端取回来的”
// 这段延迟，供前端在把某一批可见行写入表格前先等待，制造真实的分批加载感。
export async function simulateStressBackendDelay() {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, STRESS_PAGE_FETCH_DELAY_MS),
  );
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

export function getCellEditability(
  row: ViewRow | undefined,
  col: number,
): CellEditability {
  const column = COLUMNS[col];
  if (!row || !column)
    return { editable: false, reason: '单元格不存在', sourceNode: null };
  if (isHierarchyField(column.field)) {
    return {
      editable: false,
      reason: '层级和属性字段由业务数据源维护',
      sourceNode: null,
    };
  }
  if (column.field === 'avgOrder') {
    return {
      editable: false,
      reason: '客单价由净收入 ÷ 订单数自动计算',
      sourceNode: null,
    };
  }
  const sourceNode = row.sourceNodes.length === 1 ? row.sourceNodes[0] : null;
  if (
    row.regionDepth === 0 ||
    !sourceNode ||
    sourceNode.hierarchyRole !== 'detail' ||
    sourceNode.children?.length
  ) {
    return {
      editable: false,
      reason: '汇总数据由下级明细自动聚合，不能直接编辑',
      sourceNode: null,
    };
  }
  return { editable: true, reason: '可编辑明细单元格', sourceNode };
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
  const updateAverageOrder = () => {
    node.avgOrder = Math.round(node.revenue / Math.max(node.orders, 1));
  };
  const parsedNumber =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
      ? Number(value.replace(/[\s,¥￥]/g, ''))
      : Number.NaN;
  const finiteNumber = Number.isFinite(parsedNumber) ? parsedNumber : null;
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
    case 'revenue':
      if (finiteNumber !== null) {
        const previousComponentTotal =
          node.productRevenue + node.serviceRevenue;
        const productShare = previousComponentTotal
          ? node.productRevenue / previousComponentTotal
          : 0.78;
        node.revenue = Math.max(0, Math.round(finiteNumber));
        node.productRevenue = Math.round(node.revenue * productShare);
        node.serviceRevenue = node.revenue - node.productRevenue;
        updateAverageOrder();
      }
      break;
    case 'productRevenue':
      if (finiteNumber !== null) {
        node.productRevenue = Math.max(0, Math.round(finiteNumber));
        node.revenue = node.productRevenue + node.serviceRevenue;
        updateAverageOrder();
      }
      break;
    case 'serviceRevenue':
      if (finiteNumber !== null) {
        node.serviceRevenue = Math.max(0, Math.round(finiteNumber));
        node.revenue = node.productRevenue + node.serviceRevenue;
        updateAverageOrder();
      }
      break;
    case 'orders':
      if (finiteNumber !== null) {
        const previousOrderTotal = node.onlineOrders + node.offlineOrders;
        const onlineShare = previousOrderTotal
          ? node.onlineOrders / previousOrderTotal
          : 0.63;
        node.orders = Math.max(0, Math.round(finiteNumber));
        node.onlineOrders = Math.round(node.orders * onlineShare);
        node.offlineOrders = node.orders - node.onlineOrders;
        updateAverageOrder();
      }
      break;
    case 'onlineOrders':
      if (finiteNumber !== null) {
        node.onlineOrders = Math.max(0, Math.round(finiteNumber));
        node.orders = node.onlineOrders + node.offlineOrders;
        updateAverageOrder();
      }
      break;
    case 'offlineOrders':
      if (finiteNumber !== null) {
        node.offlineOrders = Math.max(0, Math.round(finiteNumber));
        node.orders = node.onlineOrders + node.offlineOrders;
        updateAverageOrder();
      }
      break;
    case 'avgOrder':
      // Derived field. Kept in the switch so programmatic callers cannot
      // accidentally break the revenue/order relationship.
      updateAverageOrder();
      break;
    case 'completion':
    case 'adjustmentFactor':
      if (finiteNumber !== null) node[field] = finiteNumber;
      break;
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
