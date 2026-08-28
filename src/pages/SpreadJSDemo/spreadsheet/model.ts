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
  attachment: string | null;
  adjustmentFactor: number;
  children?: BusinessNode[];
};

export type DrillPathItem = Pick<BusinessNode, 'id' | 'name'>;
export type DrillView = readonly DrillPathItem[];

export type HierarchyRole = 'category' | 'subcategory' | 'region' | 'detail';
export type HierarchyField =
  | 'categoryHierarchy'
  | 'subcategoryHierarchy'
  | 'regionHierarchy'
  | 'detailHierarchy';
export type BusinessField = Exclude<
  keyof BusinessNode,
  'id' | 'children' | 'hierarchyRole'
>;
export type ColumnField = BusinessField | HierarchyField;
export type ViewRow = BusinessNode & { level: number; hasChildren?: boolean };

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

export type RowOutlineGroup = {
  summaryRow: number;
  detailStart: number;
  detailCount: number;
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
  { field: 'categoryHierarchy', label: '品类', width: 126 },
  { field: 'subcategoryHierarchy', label: '子品类', width: 142 },
  { field: 'regionHierarchy', label: '区域', width: 126 },
  { field: 'detailHierarchy', label: '城市 / 门店', width: 166 },
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
  { field: 'attachment', label: '附件', width: 162 },
  { field: 'adjustmentFactor', label: '调整系数', width: 96 },
];

export const COLUMN_GROUPS = [
  { summaryCol: 4, detailStart: 5, detailCount: 7 },
  { summaryCol: 4, detailStart: 5, detailCount: 2 },
  { summaryCol: 7, detailStart: 8, detailCount: 3 },
  { summaryCol: 12, detailStart: 13, detailCount: 5 },
  { summaryCol: 12, detailStart: 13, detailCount: 2 },
  { summaryCol: 15, detailStart: 16, detailCount: 2 },
] as const;

export const COLUMN_HEADER_SECTIONS = [
  { label: '主行层级', startCol: 0, colCount: 2 },
  { label: '扩展行层级', startCol: 2, colCount: 2 },
  { label: '核心经营指标', startCol: 4, colCount: 8 },
  { label: '业务治理', startCol: 12, colCount: 6 },
] as const;

export const COLUMN_HEADER_GROUPS = [
  { label: 'rowTree', startCol: 0, colCount: 2 },
  { label: 'extensionRows', startCol: 2, colCount: 2 },
  { label: '收入指标', startCol: 4, colCount: 3 },
  { label: '订单指标', startCol: 7, colCount: 4 },
  { label: '目标管理', startCol: 11, colCount: 1 },
  { label: '责任与核验', startCol: 12, colCount: 3 },
  { label: '记录信息', startCol: 15, colCount: 3 },
] as const;

export const PRIMARY_CATEGORY_COLUMN = 0;
export const PRIMARY_SUBCATEGORY_COLUMN = 1;
export const EXTENSION_REGION_COLUMN = 2;
export const EXTENSION_DETAIL_COLUMN = 3;
export const HIERARCHY_COLUMN_COUNT = 4;
export const REVENUE_COLUMN = 4;
export const PRODUCT_REVENUE_COLUMN = 5;
export const SERVICE_REVENUE_COLUMN = 6;
export const ORDERS_COLUMN = 7;
export const ONLINE_ORDERS_COLUMN = 8;
export const OFFLINE_ORDERS_COLUMN = 9;
export const AVG_ORDER_COLUMN = 10;
export const COMPLETION_COLUMN = 11;
export const OWNER_COLUMN = 12;
export const STATUS_COLUMN = 13;
export const VERIFIED_COLUMN = 14;
export const UPDATED_AT_COLUMN = 15;
export const ATTACHMENT_COLUMN = 16;
export const DECIMAL_COLUMN = 17;
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
export const STRESS_TEXT_SEARCH_COLUMNS = new Set([
  0, 1, 2, 3, 12, 13, 14, 15, 16,
]);

export const FEATURES = [
  ['批注', '原生 + 稳定业务 ID'],
  ['下钻、上钻', '业务扩展'],
  ['撤销 / 重做', '原生'],
  ['批量复制', '原生矩形选区'],
  ['多列折叠', '汇总列常驻的原生 Outline'],
  ['多行折叠', 'rowTree + extensionRows 双树'],
  ['多层列表头', '三层 ColumnHeader + 两级原生 Outline'],
  ['自定义右键', '原生扩展菜单'],
  ['单元格类型', '下拉 / 日期 / 数字 / 复选 / 附件'],
  ['持续维护', 'SpreadJS 19.1'],
  ['是否收费', '商业许可'],
  ['电子表格', '是'],
  ['自定义统计', 'SUM / AVG / COUNT / MIN / MAX'],
  ['单元格历史', '业务扩展'],
  ['数据追踪', '业务扩展'],
  ['快速搜索', '表内定位'],
  ['显示 / 隐藏列', '原生'],
  ['单元格附件', '原生 FileUpload'],
  ['大数据', '10 万行 × 18 列'],
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
    attachment: null,
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
];

export function flattenTree(nodes: BusinessNode[], level = 0): ViewRow[] {
  return nodes.flatMap((node) => [
    { ...node, level, hasChildren: Boolean(node.children?.length) },
    ...flattenTree(node.children ?? [], level + 1),
  ]);
}

export const INITIAL_DATASET_LABEL = `${
  flattenTree(BUSINESS_DATA).length
} 行 × ${COLUMNS.length} 列`;

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

export function canDrillNode(node: BusinessNode | ViewRow | null | undefined) {
  return Boolean(
    node?.children?.length ||
      (node && 'hasChildren' in node && node.hasChildren),
  );
}

export function viewForNode(
  view: DrillView,
  node: BusinessNode | ViewRow,
): DrillView | null {
  if (!canDrillNode(node)) return null;
  return [...view, { id: node.id, name: node.name }];
}

export function flatRowsForView(rows: ViewRow[], view: DrillView): ViewRow[] {
  if (!view.length) return rows;

  let rangeStart = 0;
  let rangeEnd = rows.length;
  let parentLevel = -1;
  for (const pathItem of view) {
    const nodeIndex = rows.findIndex(
      (row, index) =>
        index >= rangeStart &&
        index < rangeEnd &&
        row.level === parentLevel + 1 &&
        row.id === pathItem.id,
    );
    if (nodeIndex < 0) return [];

    parentLevel = rows[nodeIndex].level;
    rangeStart = nodeIndex + 1;
    rangeEnd = rangeStart;
    while (rangeEnd < rows.length && rows[rangeEnd].level > parentLevel)
      rangeEnd += 1;
  }

  const levelOffset = parentLevel + 1;
  return rows.slice(rangeStart, rangeEnd).map((row) => ({
    ...row,
    level: row.level - levelOffset,
  }));
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
  return {
    ...makeNode(
      `stress-${index}`,
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
    hasChildren: isRegion || isCity,
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

export function getRowOutlineGroups(rows: ViewRow[]): RowOutlineGroup[] {
  const groups: RowOutlineGroup[] = [];
  const open: Array<{ summaryRow: number; level: number }> = [];

  const closeGroupsAt = (endRow: number, level: number) => {
    while (open.length && open[open.length - 1].level >= level) {
      const group = open.pop();
      if (group && endRow > group.summaryRow + 1) {
        groups.push({
          summaryRow: group.summaryRow,
          detailStart: group.summaryRow + 1,
          detailCount: endRow - group.summaryRow - 1,
        });
      }
    }
  };

  rows.forEach((row, index) => {
    closeGroupsAt(index, row.level);
    if (row.hasChildren || row.children?.length)
      open.push({ summaryRow: index, level: row.level });
  });
  closeGroupsAt(rows.length, Number.NEGATIVE_INFINITY);
  return groups.sort((left, right) => left.summaryRow - right.summaryRow);
}

export function hierarchyCellText(row: ViewRow, collapsed = false) {
  if (!row.hasChildren && !row.children?.length) return row.name;
  return `${collapsed ? '▸' : '▾'} ${row.name}`;
}

export function hierarchyColumnForRole(role: HierarchyRole) {
  if (role === 'category') return PRIMARY_CATEGORY_COLUMN;
  if (role === 'subcategory') return PRIMARY_SUBCATEGORY_COLUMN;
  if (role === 'region') return EXTENSION_REGION_COLUMN;
  return EXTENSION_DETAIL_COLUMN;
}

export function hierarchyColumnForRow(row: ViewRow) {
  return hierarchyColumnForRole(row.hierarchyRole);
}

export function isHierarchyField(field: ColumnField): field is HierarchyField {
  return (
    field === 'categoryHierarchy' ||
    field === 'subcategoryHierarchy' ||
    field === 'regionHierarchy' ||
    field === 'detailHierarchy'
  );
}

export function viewRowCellValue(row: ViewRow, col: number) {
  if (col < HIERARCHY_COLUMN_COUNT) {
    return col === hierarchyColumnForRow(row) ? hierarchyCellText(row) : null;
  }
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
    case 'attachment':
      node.attachment = typeof value === 'string' ? value : null;
      break;
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
