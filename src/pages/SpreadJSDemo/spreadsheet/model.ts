import {
  COLUMNS,
  PRODUCT_HIERARCHY_COLUMN,
  REGION_HIERARCHY_COLUMN,
} from './business-column-schema';

export {
  ANNUAL_TOTAL_COLUMN,
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  COLUMN_GROUPS,
  COLUMN_HEADER_CELLS,
  COLUMN_HEADER_ROW_COUNT,
  COLUMN_HEADER_SECTIONS,
  HIERARCHY_COLUMN_COUNT,
  PRODUCT_ATTRIBUTE_COLUMN,
  PRODUCT_HIERARCHY_COLUMN,
  REGION_HIERARCHY_COLUMN,
  STRESS_TEXT_SEARCH_COLUMNS,
  getBusinessColumnDimension,
  getBusinessColumnIndex,
} from './business-column-schema';
export type {
  BusinessColumnDimension,
  BusinessColumnGroup,
  BusinessColumnLeaf,
  BusinessColumnNode,
  ColumnDataType,
  ColumnDefinition,
  ColumnEditor,
  ColumnFormat,
  ColumnHeaderCell,
} from './business-column-schema';

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

export const BUDGET_VALUE_FIELDS = [
  'annualTotal',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;
export type BudgetValueField = (typeof BUDGET_VALUE_FIELDS)[number];

type BusinessNodeBase = {
  /** 后台记录 ID；组织、科目汇总和科目明细记录都全局唯一。 */
  id: string;
  name: string;
};

export type BudgetValues = {
  annualTotal: number;
  january: number;
  february: number;
  march: number;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  september: number;
  october: number;
  november: number;
  december: number;
};

/** 组织节点只负责组织树，不保存已删除“费用汇总”行的业务值。 */
export type OrganizationNode = BusinessNodeBase & {
  children?: OrganizationNode[];
  /** 当前组织对应的科目树，由后台直接返回。 */
  subjects?: SubjectNode[];
};

/** 科目汇总和科目明细才是 Worksheet 业务单元格的数据记录。 */
export type SubjectNode = BusinessNodeBase &
  BudgetValues & {
    /** Excel“功能属性”列的后台字段。 */
    functionalAttribute: string;
    children?: SubjectNode[];
  };

export type BusinessNode = OrganizationNode | SubjectNode;

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

/** 前后台共用的稳定行维；组织 ID 与科目 ID 唯一确定一条业务记录。 */
export type BusinessRowDimension = {
  organizationId: string;
  subjectId: string;
};
export type HierarchyField = 'organizationHierarchy' | 'subjectHierarchy';
export type BusinessField = 'name' | 'functionalAttribute' | BudgetValueField;
export type ColumnField = BusinessField | HierarchyField;

export type ViewRow = SubjectNode & {
  rowDimension: BusinessRowDimension;
  sourceNodes: readonly SubjectNode[];
  productId: string;
  productParentId: string | null;
  /** 压力模式生成组织树时使用；常规模式可从 BUSINESS_DATA 获取。 */
  productParentLabel?: string;
  productAncestorIds: readonly string[];
  productLabel: string;
  productDepth: number;
  productIsGroup: boolean;
  productExpanded: boolean;
  productBlockStart: boolean;
  productRowSpan: number;
  regionId: string;
  regionRootId: string;
  regionBusinessId: string;
  regionRootLabel: string;
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
  sourceNode: SubjectNode | null;
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

export const AGGREGATE_MODES = [
  'SUM',
  'AVG',
  'COUNT',
  'MIN',
  'MAX',
  'CUSTOM',
] as const satisfies readonly AggregateMode[];

export const FEATURES = [
  ['批注', '原生 + 稳定业务 ID'],
  ['组织下钻、上钻', '业务扩展'],
  ['撤销 / 重做', '原生'],
  ['批量复制', '原生矩形选区'],
  ['月份列折叠', '全年合计常驻的原生 Outline'],
  ['组织与科目折叠', '双列独立状态投影'],
  ['多层列表头', 'Excel 同构表头 + 原生 Outline'],
  ['自定义右键', '原生扩展菜单'],
  ['单元格类型', '文本 / 数字'],
  ['持续维护', 'SpreadJS 19.1'],
  ['是否收费', '商业许可'],
  ['电子表格', '是'],
  ['自定义统计', 'SUM / AVG / COUNT / MIN / MAX'],
  ['单元格历史', '业务扩展'],
  ['数据追踪', '业务扩展'],
  ['快速搜索', '全层级计数 / 自动展开定位'],
  ['显示 / 隐藏列', '原生'],
  ['单元格附件', '稳定 ID 元数据 + CellButton'],
  ['大数据', '10 万条真实化记录 + 视口分页'],
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

type BudgetPair = readonly [annualTotal: number, monthly: number];

function repeatedBudget(annualTotal: number, monthly: number): BudgetValues {
  return {
    annualTotal,
    january: monthly,
    february: monthly,
    march: monthly,
    april: monthly,
    may: monthly,
    june: monthly,
    july: monthly,
    august: monthly,
    september: monthly,
    october: monthly,
    november: monthly,
    december: monthly,
  };
}

function makeBudgetNode(
  id: string,
  name: string,
  functionalAttribute: string,
  annualTotal: number,
  monthly: number,
  children?: SubjectNode[],
): SubjectNode {
  return {
    id,
    name,
    functionalAttribute,
    ...repeatedBudget(annualTotal, monthly),
    children,
  };
}

function makeSubjectTree(
  id: string,
  summaryName: string,
  functionalAttribute: string,
  values: {
    summary: BudgetPair;
    office: BudgetPair;
    electricity: BudgetPair;
    water: BudgetPair;
  },
) {
  return makeBudgetNode(`${id}-subtotal`, summaryName, '-', ...values.summary, [
    makeBudgetNode(
      `${id}-office`,
      '费用-办公费',
      functionalAttribute,
      ...values.office,
    ),
    makeBudgetNode(
      `${id}-electricity`,
      '费用-电费',
      functionalAttribute,
      ...values.electricity,
    ),
    makeBudgetNode(
      `${id}-water`,
      '费用-水费',
      functionalAttribute,
      ...values.water,
    ),
  ]);
}

const STANDARD_UNIT_VALUES = {
  summary: [7_200, 600],
  office: [1_200, 100],
  electricity: [2_400, 200],
  water: [3_600, 300],
} as const;

function makeOrganization(
  id: string,
  name: string,
  subjectTree: SubjectNode,
  children?: OrganizationNode[],
): OrganizationNode {
  return {
    id,
    name,
    children,
    subjects: [subjectTree],
  };
}

const huajingSales = makeOrganization(
  'huajing-sales',
  '华晶公司-销售部',
  makeSubjectTree(
    'huajing-sales',
    '管理费用合计',
    '销售',
    STANDARD_UNIT_VALUES,
  ),
);
const huajingFinance = makeOrganization(
  'huajing-finance',
  '华晶公司-财务部',
  // 源 Excel 的财务部功能属性确实为“销售”，按原始数据保留。
  makeSubjectTree(
    'huajing-finance',
    '管理费用合计',
    '销售',
    STANDARD_UNIT_VALUES,
  ),
);
const huajingAdministration = makeOrganization(
  'huajing-administration',
  '华晶公司-行政部',
  makeSubjectTree(
    'huajing-administration',
    '日常费用合计',
    '管理',
    STANDARD_UNIT_VALUES,
  ),
);
const huajingResearch = makeOrganization(
  'huajing-research',
  '华晶公司-研发部',
  makeSubjectTree(
    'huajing-research',
    '日常费用合计',
    '研发',
    STANDARD_UNIT_VALUES,
  ),
);
const huajing = makeOrganization(
  'huajing',
  '华晶公司',
  makeSubjectTree('huajing', '日常费用合计', '管理', {
    summary: [28_800, 2_400],
    office: [4_800, 400],
    electricity: [9_600, 800],
    water: [14_400, 1_200],
  }),
  [huajingSales, huajingFinance, huajingAdministration, huajingResearch],
);

const shanghuaSales = makeOrganization(
  'shanghua-sales',
  '上华公司-销售部',
  makeSubjectTree(
    'shanghua-sales',
    '日常费用合计',
    '销售',
    STANDARD_UNIT_VALUES,
  ),
);
const shanghua = makeOrganization(
  'shanghua',
  '上华公司',
  makeSubjectTree('shanghua', '日常费用合计', '管理', STANDARD_UNIT_VALUES),
  [shanghuaSales],
);
const headquarters = makeOrganization(
  'headquarters',
  '华润微电子本部',
  makeSubjectTree('headquarters', '日常费用合计', '管理', STANDARD_UNIT_VALUES),
);

/**
 * 后台直接返回的完整费用预算树。组织节点只描述组织结构；科目汇总和
 * 科目明细节点携带后台给出的全年与月度值，前端不会重算其他记录。
 */
export const BUSINESS_DATA: OrganizationNode[] = [
  makeOrganization(
    'cr-micro-group',
    '华润微电子集团',
    makeSubjectTree('cr-micro-group', '日常费用合计', '管理', {
      summary: [43_200, 3_600],
      office: [7_200, 600],
      electricity: [14_400, 1_200],
      water: [21_600, 1_800],
    }),
    [headquarters, huajing, shanghua],
  ),
];

function isOrganizationNode(node: BusinessNode): node is OrganizationNode {
  return !('functionalAttribute' in node);
}

function assertBusinessDataMatchesColumns(
  organizations: readonly OrganizationNode[],
) {
  const recordIds = new Set<string>();
  const assertUniqueId = (node: BusinessNode) => {
    if (recordIds.has(node.id))
      throw new Error(`BUSINESS_DATA 存在重复记录 id：${node.id}`);
    recordIds.add(node.id);
  };
  const visitSubject = (node: SubjectNode) => {
    assertUniqueId(node);
    COLUMNS.forEach((column) => {
      if (isHierarchyField(column.field)) return;
      if (!(column.field in node))
        throw new Error(
          `BUSINESS_DATA 记录 ${node.id} 缺少列字段：${column.field}`,
        );
      const value = node[column.field];
      if (typeof value !== column.dataType)
        throw new Error(
          `BUSINESS_DATA 记录 ${node.id} 的 ${column.field} 应为 ${column.dataType}`,
        );
    });
    node.children?.forEach(visitSubject);
  };
  const visitOrganization = (node: OrganizationNode) => {
    assertUniqueId(node);
    COLUMNS.forEach((column) => {
      if (isHierarchyField(column.field)) return;
      if (column.field in node)
        throw new Error(
          `BUSINESS_DATA 组织 ${node.id} 不应保存业务字段：${column.field}`,
        );
    });
    node.children?.forEach(visitOrganization);
    node.subjects?.forEach(visitSubject);
  };
  organizations.forEach(visitOrganization);
}

assertBusinessDataMatchesColumns(BUSINESS_DATA);

export function businessRowDimensionKey(dimension: BusinessRowDimension) {
  return JSON.stringify([dimension.organizationId, dimension.subjectId]);
}

const BUSINESS_ROW_DIMENSION_BY_ID = new Map<string, BusinessRowDimension>();
const BUSINESS_NODE_BY_ROW_DIMENSION = new Map<string, SubjectNode>();

function cloneBusinessRowDimension(
  dimension: BusinessRowDimension,
): BusinessRowDimension {
  return { ...dimension };
}

function indexSubjectRowDimensions(
  nodes: readonly SubjectNode[],
  organizationId: string,
) {
  nodes.forEach((node) => {
    const dimension: BusinessRowDimension = {
      organizationId,
      subjectId: node.id,
    };
    const key = businessRowDimensionKey(dimension);
    const duplicate = BUSINESS_NODE_BY_ROW_DIMENSION.get(key);
    if (duplicate)
      throw new Error(
        `BUSINESS_DATA 行维度不唯一：${duplicate.id} 与 ${node.id}`,
      );
    BUSINESS_ROW_DIMENSION_BY_ID.set(node.id, dimension);
    BUSINESS_NODE_BY_ROW_DIMENSION.set(key, node);
    if (node.children?.length)
      indexSubjectRowDimensions(node.children, organizationId);
  });
}

function indexBusinessRowDimensions(nodes: readonly OrganizationNode[]) {
  nodes.forEach((node) => {
    if (node.subjects?.length)
      indexSubjectRowDimensions(node.subjects, node.id);
    if (node.children?.length) indexBusinessRowDimensions(node.children);
  });
}

indexBusinessRowDimensions(BUSINESS_DATA);

export function getBusinessRowDimension(recordId: string) {
  const dimension = BUSINESS_ROW_DIMENSION_BY_ID.get(recordId);
  return dimension ? cloneBusinessRowDimension(dimension) : null;
}

export const INITIAL_PRODUCT_EXPANDED = [
  'cr-micro-group',
  'huajing',
  'shanghua',
] as const;

type VisibleProductNode = {
  node: OrganizationNode;
  id: string;
  parentId: string | null;
  ancestorIds: readonly string[];
  label: string;
  depth: number;
  isGroup: boolean;
  expanded: boolean;
};

type RegionProjectionNode = {
  id: string;
  rootId: string;
  businessId: string;
  rootLabel: string;
  label: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
  sourceNodes: readonly SubjectNode[];
};

export function findBusinessNode(
  nodes: readonly BusinessNode[],
  nodeId: string,
): BusinessNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const descendants: readonly BusinessNode[] = isOrganizationNode(node)
      ? [...(node.children ?? []), ...(node.subjects ?? [])]
      : node.children ?? [];
    const child = findBusinessNode(descendants, nodeId);
    if (child) return child;
  }
  return undefined;
}

export function rootsForView(
  view: DrillView,
  roots: OrganizationNode[] = BUSINESS_DATA,
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
  return ['全部组织', ...view.map((item) => item.name)];
}

function productRootsForView(view: DrillView) {
  return rootsForView(view);
}

function organizationChildren(node: OrganizationNode) {
  return node.children ?? [];
}

function getVisibleProducts(
  view: DrillView,
  expandedIds: ReadonlySet<string>,
): VisibleProductNode[] {
  const visit = (
    node: OrganizationNode,
    parentId: string | null,
    ancestorIds: readonly string[],
    depth: number,
  ): VisibleProductNode[] => {
    const children = organizationChildren(node);
    const isGroup = children.length > 0;
    const expanded = isGroup && expandedIds.has(node.id);
    const current: VisibleProductNode = {
      node,
      id: node.id,
      parentId,
      ancestorIds,
      label: node.name,
      depth,
      isGroup,
      expanded,
    };
    if (!expanded) return [current];
    return [
      current,
      ...children.flatMap((child) =>
        visit(child, node.id, [...ancestorIds, node.id], depth + 1),
      ),
    ];
  };
  return productRootsForView(view).flatMap((root) => visit(root, null, [], 0));
}

function getRegionRoots(product: OrganizationNode) {
  return (product.subjects ?? []).map((subject) => {
    const rootId = `subject:${subject.id}`;
    return {
      id: rootId,
      businessId: subject.id,
      label: subject.name,
      sourceNodes: [subject],
      children: (subject.children ?? []).map((detail) => ({
        id: `${rootId}:detail:${detail.id}`,
        businessId: detail.id,
        label: detail.name,
        sourceNodes: [detail],
      })),
    };
  });
}

function getVisibleRegions(
  product: OrganizationNode,
  expandedIds: ReadonlySet<string>,
): RegionProjectionNode[] {
  return getRegionRoots(product).flatMap((root) => {
    const expanded = expandedIds.has(root.id);
    const rootNode: RegionProjectionNode = {
      id: root.id,
      rootId: root.id,
      businessId: root.businessId,
      rootLabel: root.label,
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
          businessId: child.businessId,
          rootLabel: root.label,
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
      const backendNode = region.sourceNodes[0];
      if (!backendNode)
        throw new Error(`BUSINESS_DATA 组织缺少科目数据：${product.id}`);
      const rowDimension = getBusinessRowDimension(backendNode.id);
      if (!rowDimension)
        throw new Error(`BUSINESS_DATA 记录缺少行维度：${backendNode.id}`);
      return {
        ...backendNode,
        id:
          region.depth === 0
            ? `${product.id}::${region.rootId}`
            : `${product.id}::${region.rootId}::${backendNode.id}`,
        name: `${product.label} / ${region.label}`,
        children: undefined,
        rowDimension,
        sourceNodes: region.sourceNodes,
        productId: product.id,
        productParentId: product.parentId,
        productAncestorIds: product.ancestorIds,
        productLabel: product.label,
        productDepth: product.depth,
        productIsGroup: product.isGroup,
        productExpanded: product.expanded,
        productBlockStart: index === 0,
        productRowSpan: regions.length,
        regionId: region.id,
        regionRootId: region.rootId,
        regionBusinessId: region.businessId,
        regionRootLabel: region.rootLabel,
        regionLabel: region.label,
        regionDepth: region.depth,
        regionIsGroup: region.isGroup,
        regionExpanded: region.expanded,
      };
    });
  });
}

function flattenOrganizations(
  nodes: readonly OrganizationNode[],
): OrganizationNode[] {
  return nodes.flatMap((node): OrganizationNode[] => [
    node,
    ...flattenOrganizations(organizationChildren(node)),
  ]);
}

export function getProductGroupIdsForView(view: DrillView): string[] {
  return flattenOrganizations(productRootsForView(view))
    .filter((node) => organizationChildren(node).length > 0)
    .map((node) => node.id);
}

export function getAllProductIdsForView(view: DrillView): string[] {
  return flattenOrganizations(productRootsForView(view)).map((node) => node.id);
}

export function getProductAncestorIds(productId: string): readonly string[] {
  const find = (
    nodes: readonly OrganizationNode[],
    ancestors: readonly string[],
  ): readonly string[] | null => {
    for (const node of nodes) {
      if (node.id === productId) return ancestors;
      const match = find(organizationChildren(node), [...ancestors, node.id]);
      if (match) return match;
    }
    return null;
  };
  return find(BUSINESS_DATA, []) ?? [];
}

export function getRegionGroupIdsForProduct(productId: string): string[] {
  const product = findBusinessNode(BUSINESS_DATA, productId);
  return product && isOrganizationNode(product)
    ? getRegionRoots(product).map((region) => region.id)
    : [];
}

export function createInitialRegionExpansion(
  view: DrillView = [],
): Map<string, Set<string>> {
  const expansion = new Map<string, Set<string>>();
  getAllProductIdsForView(view).forEach((productId) => {
    expansion.set(productId, new Set(getRegionGroupIdsForProduct(productId)));
  });
  return expansion;
}

export function getBusinessProjectionSummary(
  view: DrillView,
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
): OutlineSnapshot {
  const productGroupIds = getProductGroupIdsForView(view);
  const regionGroups = getAllProductIdsForView(view).flatMap((productId) =>
    getRegionGroupIdsForProduct(productId).map((regionId) => ({
      productId,
      regionId,
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
    createInitialRegionExpansion(),
  ).length
} 行 × ${COLUMNS.length} 列`;

export function canDrillNode(node: BusinessNode | ViewRow | null | undefined) {
  if (!node) return false;
  if ('productIsGroup' in node) return node.productIsGroup;
  return isOrganizationNode(node) && organizationChildren(node).length > 0;
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

function aggregateBudgetNodes(
  nodes: readonly SubjectNode[],
  fallback: SubjectNode,
): Pick<SubjectNode, 'functionalAttribute' | BudgetValueField> {
  const sourceNodes = nodes.length ? nodes : [fallback];
  const totals = Object.fromEntries(
    BUDGET_VALUE_FIELDS.map((field) => [
      field,
      sourceNodes.reduce((sum, node) => sum + node[field], 0),
    ]),
  ) as BudgetValues;
  const attributes = new Set(
    sourceNodes.map((node) => node.functionalAttribute),
  );
  return {
    functionalAttribute:
      attributes.size === 1 ? sourceNodes[0].functionalAttribute : '-',
    ...totals,
  };
}

type StressRegion = {
  id: string;
  label: string;
  facts: ViewRow[];
};

type StressProduct = {
  id: string;
  parentId: string | null;
  ancestorIds: readonly string[];
  label: string;
  depth: 0 | 1;
  isGroup: boolean;
  facts: ViewRow[];
  regions: Map<string, StressRegion>;
  children: StressProduct[];
};

type StressIndex = {
  roots: StressProduct[];
  productGroups: string[];
  allProducts: string[];
  productsById: Map<string, StressProduct>;
};

const stressProjectionIndexCache = new WeakMap<ViewRow[], StressIndex>();

function addStressFact(product: StressProduct, fact: ViewRow) {
  product.facts.push(fact);
  let region = product.regions.get(fact.regionRootLabel);
  if (!region) {
    region = {
      id: product.isGroup
        ? `${product.id}:subject:${fact.regionRootLabel}`
        : fact.regionRootId,
      label: fact.regionRootLabel,
      facts: [],
    };
    product.regions.set(fact.regionRootLabel, region);
  }
  region.facts.push(fact);
}

function buildStressProjectionIndex(rows: ViewRow[]): StressIndex {
  const cached = stressProjectionIndexCache.get(rows);
  if (cached) return cached;
  const rootsById = new Map<string, StressProduct>();
  const productsById = new Map<string, StressProduct>();

  rows.forEach((fact) => {
    const rootId = fact.productParentId as string;
    let root = rootsById.get(rootId);
    if (!root) {
      root = {
        id: rootId,
        parentId: null,
        ancestorIds: [],
        label: fact.productParentLabel ?? rootId,
        depth: 0,
        isGroup: true,
        facts: [],
        regions: new Map(),
        children: [],
      };
      rootsById.set(rootId, root);
      productsById.set(rootId, root);
    }
    let product = productsById.get(fact.productId);
    if (!product) {
      product = {
        id: fact.productId,
        parentId: root.id,
        ancestorIds: [root.id],
        label: fact.productLabel,
        depth: 1,
        isGroup: false,
        facts: [],
        regions: new Map(),
        children: [],
      };
      root.children.push(product);
      productsById.set(product.id, product);
    }
    addStressFact(root, fact);
    addStressFact(product, fact);
  });

  const roots = [...rootsById.values()];
  const index = {
    roots,
    productGroups: roots.map((root) => root.id),
    allProducts: [...productsById.keys()],
    productsById,
  };
  stressProjectionIndexCache.set(rows, index);
  return index;
}

function projectStressProduct(
  product: StressProduct,
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
) {
  const expandedRegions =
    regionExpandedByProduct.get(product.id) ?? new Set<string>();
  const rows = [...product.regions.values()].flatMap((region) => {
    const fallback = region.facts[0];
    const summary: SubjectNode = {
      ...fallback,
      id: `${product.id}:${region.id}:summary`,
      name: region.label,
      ...aggregateBudgetNodes(region.facts, fallback),
      children: undefined,
    };
    const expanded = expandedRegions.has(region.id);
    const rowDimension: BusinessRowDimension = {
      organizationId: product.id,
      subjectId: region.id,
    };
    const rootRow: ViewRow = {
      ...summary,
      id: `${product.id}::${region.id}`,
      name: `${product.label} / ${region.label}`,
      rowDimension,
      sourceNodes: region.facts,
      productId: product.id,
      productParentId: product.parentId,
      productAncestorIds: product.ancestorIds,
      productLabel: product.label,
      productDepth: product.depth,
      productIsGroup: product.isGroup,
      productExpanded: product.isGroup && productExpanded.has(product.id),
      productBlockStart: false,
      productRowSpan: 1,
      regionId: region.id,
      regionRootId: region.id,
      regionBusinessId: region.id,
      regionRootLabel: region.label,
      regionLabel: region.label,
      regionDepth: 0,
      regionIsGroup: true,
      regionExpanded: expanded,
    };
    if (!expanded) return [rootRow];

    const detailRows: ViewRow[] = product.isGroup
      ? product.children.flatMap((child) => {
          const childRegion = child.regions.get(region.label);
          if (!childRegion?.facts.length) return [];
          const childFallback = childRegion.facts[0];
          const childSummary: SubjectNode = {
            ...childFallback,
            id: `${child.id}:${region.id}:summary`,
            name: child.label,
            ...aggregateBudgetNodes(childRegion.facts, childFallback),
          };
          return [
            {
              ...childSummary,
              id: `${product.id}::${region.id}::${childSummary.id}`,
              rowDimension: {
                organizationId: child.id,
                subjectId: childFallback.regionRootId,
              },
              sourceNodes: childRegion.facts,
              productId: product.id,
              productParentId: product.parentId,
              productAncestorIds: product.ancestorIds,
              productLabel: product.label,
              productDepth: product.depth,
              productIsGroup: product.isGroup,
              productExpanded: true,
              productBlockStart: false,
              productRowSpan: 1,
              regionId: `${region.id}:detail:${childSummary.id}`,
              regionRootId: region.id,
              regionBusinessId: childFallback.regionRootId,
              regionRootLabel: region.label,
              regionLabel: child.label,
              regionDepth: 1,
              regionIsGroup: false,
              regionExpanded: false,
            },
          ];
        })
      : region.facts.map((fact) => ({
          ...fact,
          id: `${product.id}::${region.id}::${fact.id}`,
          productBlockStart: false,
          productRowSpan: 1,
          regionId: `${region.id}:detail:${fact.id}`,
          regionRootId: region.id,
          regionRootLabel: region.label,
          regionDepth: 1,
          regionIsGroup: false,
          regionExpanded: false,
        }));
    return [rootRow, ...detailRows];
  });
  if (rows.length) {
    rows[0].productBlockStart = true;
    rows[0].productRowSpan = rows.length;
  }
  return rows;
}

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
  return [
    ...(buildStressProjectionIndex(sourceRows)
      .productsById.get(productId)
      ?.regions.values() ?? []),
  ].map((region) => region.id);
}

export function getStressProjectionSummary(
  sourceRows: ViewRow[],
  productExpanded: ReadonlySet<string>,
  regionExpandedByProduct: ExtensionExpansionState,
  projectedRowCount?: number,
): OutlineSnapshot {
  const index = buildStressProjectionIndex(sourceRows);
  const regionGroups = index.allProducts.flatMap((productId) =>
    getStressRegionGroupIdsForProduct(sourceRows, productId).map(
      (regionId) => ({
        productId,
        regionId,
      }),
    ),
  );
  return {
    productExpanded: index.productGroups.filter((id) => productExpanded.has(id))
      .length,
    productTotal: index.productGroups.length,
    regionExpanded: regionGroups.filter(({ productId, regionId }) =>
      regionExpandedByProduct.get(productId)?.has(regionId),
    ).length,
    regionTotal: regionGroups.length,
    // 控制器已持有刚刚生成的投影时直接复用其长度，避免在“全部展开”
    // 后为了统计摘要再同步创建一次十万级 ViewRow 数组。
    rowCount:
      projectedRowCount ??
      createStressProjectionRows(
        sourceRows,
        productExpanded,
        regionExpandedByProduct,
      ).length,
  };
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
  return field === 'organizationHierarchy' || field === 'subjectHierarchy';
}

export function getCellSourceNode(row: ViewRow | undefined, col: number) {
  const column = COLUMNS[col];
  if (!row || !column || isHierarchyField(column.field)) return null;
  return row.sourceNodes.length === 1 ? row.sourceNodes[0] : null;
}

export function getCellSourceRowDimension(
  row: ViewRow | undefined,
  col: number,
) {
  const sourceNode = getCellSourceNode(row, col);
  if (!row || !sourceNode) return null;
  return cloneBusinessRowDimension(row.rowDimension);
}

export function getCellEditability(
  row: ViewRow | undefined,
  col: number,
): CellEditability {
  const column = COLUMNS[col];
  if (!row || !column)
    return { editable: false, reason: '单元格不存在', sourceNode: null };
  if (!column.editable) {
    return {
      editable: false,
      reason: isHierarchyField(column.field)
        ? '层级字段由表格投影维护'
        : '后台列配置将该字段设为只读',
      sourceNode: null,
    };
  }
  const sourceNode = getCellSourceNode(row, col);
  if (!sourceNode) {
    return {
      editable: false,
      reason: '当前投影无法唯一映射到一条后台业务记录',
      sourceNode: null,
    };
  }
  return {
    editable: true,
    reason: row.regionDepth > 0 ? '可编辑预算明细记录' : '可编辑后台汇总记录',
    sourceNode,
  };
}

export function viewRowCellValue(row: ViewRow, col: number) {
  if (col === PRODUCT_HIERARCHY_COLUMN) return productHierarchyText(row);
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
  if (typeof value === 'number')
    return includeFormattedNumber
      ? `${value} ${value.toLocaleString('zh-CN')}`
      : String(value);
  return value == null ? '' : String(value);
}

export function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number')
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  return String(value);
}

export function updateBusinessNode(
  node: SubjectNode,
  field: BusinessField,
  value: unknown,
) {
  if (field === 'name') {
    if (typeof value === 'string') node.name = value.replace(/^\u3000+/, '');
    return;
  }
  if (field === 'functionalAttribute') {
    if (typeof value === 'string') node.functionalAttribute = value;
    return;
  }
  if (!BUDGET_VALUE_FIELDS.includes(field as BudgetValueField)) return;
  const parsedNumber =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
      ? Number(value.replace(/[\s,¥￥]/g, ''))
      : Number.NaN;
  if (Number.isFinite(parsedNumber))
    node[field as BudgetValueField] = Math.max(0, parsedNumber);
}

export function numericDisplayForColumn(
  col: number,
): Exclude<NumericDisplay, 'mixed'> {
  const format = COLUMNS[col]?.format;
  if (format === 'currency') return 'currency';
  if (format === 'percent') return 'percent';
  if (format === 'decimal') return 'decimal';
  return 'number';
}

export function formatStatistic(value: number, display: NumericDisplay) {
  if (display === 'currency')
    return `¥${Math.round(value).toLocaleString('zh-CN')}`;
  if (display === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (display === 'decimal')
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
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
