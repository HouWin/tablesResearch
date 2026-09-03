import type { ColumnField } from './model';

export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date';
export type ColumnFormat =
  | 'currency'
  | 'integer'
  | 'percent'
  | 'date'
  | 'decimal';
export type ColumnEditor =
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'select'; options: readonly string[] }
  | { type: 'checkbox' }
  | { type: 'date' };

/** 根分组到叶子列的稳定 ID 路径，例如 core-metrics/income-metrics/revenue。 */
export type BusinessColumnDimension = readonly string[];

/** 后台列树中的叶子节点，对应 Worksheet 中的一列。 */
export type BusinessColumnLeaf = {
  id: string;
  field: ColumnField;
  label: string;
  width: number;
  dataType: ColumnDataType;
  format?: ColumnFormat;
  editor?: ColumnEditor;
  editable: boolean;
  searchable?: boolean;
};

/** 后台列树中的分组节点，对应一层合并表头。 */
export type BusinessColumnGroup = {
  id: string;
  label: string;
  children: readonly BusinessColumnNode[];
  /** 整个分组折叠时保留的汇总字段。 */
  summaryField?: ColumnField;
  /** 冻结该根分组下的所有叶子列。 */
  frozen?: boolean;
};

export type BusinessColumnNode = BusinessColumnGroup | BusinessColumnLeaf;
export type ColumnDefinition = BusinessColumnLeaf;

export type ColumnHeaderSpan = {
  id: string;
  label: string;
  startCol: number;
  colCount: number;
};

export type ColumnHeaderCell = ColumnHeaderSpan & {
  row: number;
  rowCount: number;
  kind: 'group' | 'column';
};

export type ColumnOutlineGroup = {
  id: string;
  summaryCol: number;
  detailStart: number;
  detailCount: number;
};

/**
 * 模拟后台返回的树形列配置。
 *
 * 数组顺序就是最终列顺序；children 表达表头层级；summaryField 同时
 * 描述列组折叠语义。前端不再另外维护平铺列、表头分组和 Outline 配置。
 */
export const BUSINESS_COLUMN_DATA = [
  {
    id: 'business-dimensions',
    label: '业务维度',
    frozen: true,
    children: [
      {
        id: 'product-hierarchy',
        field: 'productHierarchy',
        label: '产品层级',
        width: 178,
        dataType: 'string',
        editable: false,
        searchable: true,
      },
      {
        id: 'product-attribute',
        field: 'productAttribute',
        label: '产品属性',
        width: 144,
        dataType: 'string',
        editor: { type: 'text' },
        editable: true,
        searchable: true,
      },
      {
        id: 'region-hierarchy',
        field: 'regionHierarchy',
        label: '区域层级',
        width: 168,
        dataType: 'string',
        editable: false,
        searchable: true,
      },
    ],
  },
  {
    id: 'core-metrics',
    label: '核心经营指标',
    summaryField: 'revenue',
    children: [
      {
        id: 'income-metrics',
        label: '收入指标',
        summaryField: 'revenue',
        children: [
          {
            id: 'revenue',
            field: 'revenue',
            label: '净收入',
            width: 112,
            dataType: 'number',
            format: 'currency',
            editor: { type: 'number' },
            editable: true,
          },
          {
            id: 'product-revenue',
            field: 'productRevenue',
            label: '商品收入',
            width: 108,
            dataType: 'number',
            format: 'currency',
            editor: { type: 'number' },
            editable: true,
          },
          {
            id: 'service-revenue',
            field: 'serviceRevenue',
            label: '服务收入',
            width: 108,
            dataType: 'number',
            format: 'currency',
            editor: { type: 'number' },
            editable: true,
          },
        ],
      },
      {
        id: 'order-metrics',
        label: '订单指标',
        summaryField: 'orders',
        children: [
          {
            id: 'orders',
            field: 'orders',
            label: '订单数',
            width: 92,
            dataType: 'number',
            format: 'integer',
            editor: { type: 'number' },
            editable: true,
          },
          {
            id: 'online-orders',
            field: 'onlineOrders',
            label: '线上订单',
            width: 92,
            dataType: 'number',
            format: 'integer',
            editor: { type: 'number' },
            editable: true,
          },
          {
            id: 'offline-orders',
            field: 'offlineOrders',
            label: '线下订单',
            width: 92,
            dataType: 'number',
            format: 'integer',
            editor: { type: 'number' },
            editable: true,
          },
          {
            id: 'average-order',
            field: 'avgOrder',
            label: '客单价',
            width: 98,
            dataType: 'number',
            format: 'currency',
            editor: { type: 'number' },
            editable: true,
          },
        ],
      },
      {
        id: 'target-management',
        label: '目标管理',
        children: [
          {
            id: 'completion',
            field: 'completion',
            label: '目标达成',
            width: 96,
            dataType: 'number',
            format: 'percent',
            editor: { type: 'number' },
            editable: true,
          },
        ],
      },
    ],
  },
  {
    id: 'business-governance',
    label: '业务治理',
    summaryField: 'owner',
    children: [
      {
        id: 'responsibility-verification',
        label: '责任与核验',
        summaryField: 'owner',
        children: [
          {
            id: 'owner',
            field: 'owner',
            label: '负责人',
            width: 84,
            dataType: 'string',
            editor: { type: 'text' },
            editable: true,
            searchable: true,
          },
          {
            id: 'status',
            field: 'status',
            label: '核验状态',
            width: 96,
            dataType: 'string',
            editor: {
              type: 'select',
              options: ['已核验', '待复核', '异常'],
            },
            editable: true,
            searchable: true,
          },
          {
            id: 'verified',
            field: 'verified',
            label: '已核验',
            width: 82,
            dataType: 'boolean',
            editor: { type: 'checkbox' },
            editable: true,
            searchable: true,
          },
        ],
      },
      {
        id: 'record-information',
        label: '记录信息',
        children: [
          {
            id: 'updated-at',
            field: 'updatedAt',
            label: '更新日期',
            width: 104,
            dataType: 'date',
            format: 'date',
            editor: { type: 'date' },
            editable: true,
            searchable: true,
          },
          {
            id: 'adjustment-factor',
            field: 'adjustmentFactor',
            label: '调整系数',
            width: 96,
            dataType: 'number',
            format: 'decimal',
            editor: { type: 'number' },
            editable: true,
          },
        ],
      },
    ],
  },
] as const satisfies readonly BusinessColumnGroup[];

function isColumnLeaf(node: BusinessColumnNode): node is BusinessColumnLeaf {
  return 'field' in node;
}

function leavesOf(nodes: readonly BusinessColumnNode[]): BusinessColumnLeaf[] {
  return nodes.flatMap((node) =>
    isColumnLeaf(node) ? [node] : leavesOf(node.children),
  );
}

export function buildBusinessColumnModel(
  roots: readonly BusinessColumnGroup[],
) {
  const ids = new Set<string>();
  const fields = new Set<ColumnField>();
  const pathByField = new Map<ColumnField, BusinessColumnDimension>();
  const indexByDimension = new Map<string, number>();

  const validateNode = (
    node: BusinessColumnNode,
    parentPath: BusinessColumnDimension,
  ) => {
    if (ids.has(node.id)) throw new Error(`后台列配置存在重复 id：${node.id}`);
    ids.add(node.id);
    const path = [...parentPath, node.id];
    if (isColumnLeaf(node)) {
      if (fields.has(node.field))
        throw new Error(`后台列配置存在重复 field：${node.field}`);
      fields.add(node.field);
      pathByField.set(node.field, path);
      return;
    }
    if (!node.children.length)
      throw new Error(`后台列分组不能没有 children：${node.id}`);
    const containsLeaf = node.children.some(isColumnLeaf);
    const containsGroup = node.children.some((child) => !isColumnLeaf(child));
    if (containsLeaf && containsGroup)
      throw new Error(`同一列分组不能混合叶子列和子分组：${node.id}`);
    node.children.forEach((child) => validateNode(child, path));
  };
  roots.forEach((root) => validateNode(root, []));

  const columns = leavesOf(roots);
  const indexByField = new Map(
    columns.map((column, index) => [column.field, index]),
  );
  columns.forEach((column, index) => {
    const path = pathByField.get(column.field);
    if (!path) throw new Error(`后台叶子列缺少维度路径：${column.id}`);
    indexByDimension.set(JSON.stringify(path), index);
  });
  const spanOf = (group: BusinessColumnGroup): ColumnHeaderSpan => {
    const leaves = leavesOf(group.children);
    const startCol = indexByField.get(leaves[0].field);
    if (startCol === undefined)
      throw new Error(`后台列分组无法定位首列：${group.id}`);
    return {
      id: group.id,
      label: group.label,
      startCol,
      colCount: leaves.length,
    };
  };

  const headerSections = roots.map(spanOf);
  const headerGroups = roots.flatMap((root) =>
    root.children
      .filter((child): child is BusinessColumnGroup => !isColumnLeaf(child))
      .map(spanOf),
  );

  const leafDepth = (node: BusinessColumnNode, depth: number): number =>
    isColumnLeaf(node)
      ? depth
      : Math.max(...node.children.map((child) => leafDepth(child, depth + 1)));
  const lastHeaderRow = Math.max(...roots.map((root) => leafDepth(root, 0)));
  const headerCells: ColumnHeaderCell[] = [];
  const visitHeader = (group: BusinessColumnGroup, row: number) => {
    const span = spanOf(group);
    const directLeaves = group.children.every(isColumnLeaf);
    headerCells.push({
      ...span,
      row,
      rowCount: directLeaves ? lastHeaderRow - row : 1,
      kind: 'group',
    });
    if (directLeaves) {
      group.children.filter(isColumnLeaf).forEach((column) => {
        const startCol = indexByField.get(column.field);
        if (startCol === undefined)
          throw new Error(`后台叶子列无法定位：${column.id}`);
        headerCells.push({
          id: column.id,
          label: column.label,
          startCol,
          colCount: 1,
          row: lastHeaderRow,
          rowCount: 1,
          kind: 'column',
        });
      });
      return;
    }
    group.children.forEach((child) => {
      if (!isColumnLeaf(child)) visitHeader(child, row + 1);
    });
  };
  roots.forEach((root) => visitHeader(root, 0));

  const outlineGroups: ColumnOutlineGroup[] = [];
  const visitOutline = (group: BusinessColumnGroup) => {
    const leaves = leavesOf(group.children);
    if (group.summaryField && leaves.length > 1) {
      const summaryCol = indexByField.get(group.summaryField);
      const firstCol = indexByField.get(leaves[0].field);
      if (summaryCol === undefined || firstCol === undefined)
        throw new Error(`列组汇总字段不存在：${group.id}`);
      if (summaryCol !== firstCol)
        throw new Error(`列组汇总字段必须是分组第一列：${group.id}`);
      outlineGroups.push({
        id: group.id,
        summaryCol,
        detailStart: summaryCol + 1,
        detailCount: leaves.length - 1,
      });
    }
    group.children.forEach((child) => {
      if (!isColumnLeaf(child)) visitOutline(child);
    });
  };
  roots.forEach(visitOutline);

  const frozenColumns = roots
    .filter((root) => root.frozen)
    .flatMap((root) => leavesOf(root.children));
  frozenColumns.forEach((column, index) => {
    if (indexByField.get(column.field) !== index)
      throw new Error('冻结列必须连续位于后台列树最左侧');
  });

  return {
    columns,
    headerSections,
    headerGroups,
    headerCells,
    headerRowCount: lastHeaderRow + 1,
    outlineGroups,
    frozenColumnCount: frozenColumns.length,
    indexByField,
    pathByField,
    indexByDimension,
  };
}

const COLUMN_MODEL = buildBusinessColumnModel(BUSINESS_COLUMN_DATA);

export const COLUMNS: ColumnDefinition[] = [...COLUMN_MODEL.columns];
export const COLUMN_HEADER_SECTIONS = COLUMN_MODEL.headerSections;
export const COLUMN_HEADER_GROUPS = COLUMN_MODEL.headerGroups;
export const COLUMN_HEADER_CELLS = COLUMN_MODEL.headerCells;
export const COLUMN_HEADER_ROW_COUNT = COLUMN_MODEL.headerRowCount;
export const COLUMN_GROUPS = COLUMN_MODEL.outlineGroups;
export const HIERARCHY_COLUMN_COUNT = COLUMN_MODEL.frozenColumnCount;

/** 根据业务字段得到后台列树中的完整路径。 */
export function getBusinessColumnDimension(
  field: ColumnField,
): BusinessColumnDimension | null {
  const path = COLUMN_MODEL.pathByField.get(field);
  return path ? [...path] : null;
}

/** 根据后台给出的完整列路径得到物理列号；路径不完整或不匹配时返回 -1。 */
export function getBusinessColumnIndex(dimension: BusinessColumnDimension) {
  return COLUMN_MODEL.indexByDimension.get(JSON.stringify(dimension)) ?? -1;
}

function requiredColumnIndex(field: ColumnField) {
  const index = COLUMN_MODEL.indexByField.get(field);
  if (index === undefined) throw new Error(`后台列配置缺少字段：${field}`);
  return index;
}

export const PRODUCT_HIERARCHY_COLUMN = requiredColumnIndex('productHierarchy');
export const PRODUCT_ATTRIBUTE_COLUMN = requiredColumnIndex('productAttribute');
export const REGION_HIERARCHY_COLUMN = requiredColumnIndex('regionHierarchy');
export const REVENUE_COLUMN = requiredColumnIndex('revenue');
export const SERVICE_REVENUE_COLUMN = requiredColumnIndex('serviceRevenue');
export const ORDERS_COLUMN = requiredColumnIndex('orders');
export const AVG_ORDER_COLUMN = requiredColumnIndex('avgOrder');
export const COMPLETION_COLUMN = requiredColumnIndex('completion');
export const STATUS_COLUMN = requiredColumnIndex('status');
export const VERIFIED_COLUMN = requiredColumnIndex('verified');
export const UPDATED_AT_COLUMN = requiredColumnIndex('updatedAt');
export const DECIMAL_COLUMN = requiredColumnIndex('adjustmentFactor');
export const STRESS_TEXT_SEARCH_COLUMNS = new Set(
  COLUMNS.flatMap((column, index) => (column.searchable ? [index] : [])),
);
