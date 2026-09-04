import {
  BUSINESS_ATTRIBUTE_CODES,
  BUSINESS_DIMENSION_CODES,
  dimensionMemberValuesKey,
  hasExactDimensionCodes,
  type DimensionMemberValues,
} from './business-dimensions';
import type { BudgetValueField, ColumnField } from './model';

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

const COLUMN_DIMENSION_CODES = [
  BUSINESS_DIMENSION_CODES.dataCategory,
  BUSINESS_DIMENSION_CODES.year,
  BUSINESS_DIMENSION_CODES.period,
  BUSINESS_DIMENSION_CODES.measure,
] as const;

type BusinessColumnDimensionCode = (typeof COLUMN_DIMENSION_CODES)[number];

/** 数值单元格的列坐标：每个表头层级都明确保存维度编码和成员编码。 */
export type BusinessColumnDimension = Readonly<
  Record<BusinessColumnDimensionCode, string>
>;

export function businessColumnDimensionKey(dimension: BusinessColumnDimension) {
  return dimensionMemberValuesKey(dimension);
}

type BusinessColumnLeafBase = {
  id: string;
  field: ColumnField;
  label: string;
  width: number;
  dataType: ColumnDataType;
  format?: ColumnFormat;
  editor?: ColumnEditor;
  editable: boolean;
  searchable?: boolean;
  /** 仅在顶层节点上生效；冻结该叶子列。 */
  frozen?: boolean;
};

/** 组织、科目：行维度成员的展示列。 */
export type BusinessRowDimensionColumn = BusinessColumnLeafBase & {
  type: 'rowDim';
  field: 'organizationHierarchy' | 'subjectHierarchy';
  dimensionCode:
    | typeof BUSINESS_DIMENSION_CODES.organization
    | typeof BUSINESS_DIMENSION_CODES.subject;
};

/** 功能属性：属于科目维度，但不参与数值单元格坐标。 */
export type BusinessAttributeColumn = BusinessColumnLeafBase & {
  type: 'attr';
  field: 'functionalAttribute';
  attributeCode: typeof BUSINESS_ATTRIBUTE_CODES.functionalAttribute;
  ownerDimensionCode: typeof BUSINESS_DIMENSION_CODES.subject;
};

/** 指标维度成员也是列维的一层；field 只负责映射前端记录值。 */
export type BusinessValueColumn = BusinessColumnLeafBase & {
  type: 'value';
  field: BudgetValueField;
  dimension: {
    code: typeof BUSINESS_DIMENSION_CODES.measure;
    memberCode: string;
  };
};

export type BusinessColumnLeaf =
  | BusinessRowDimensionColumn
  | BusinessAttributeColumn
  | BusinessValueColumn;

/** 一层分组表头就是一个列维度成员。 */
export type BusinessColumnGroup = {
  type: 'colDim';
  id: string;
  label: string;
  dimension: {
    code: Exclude<
      BusinessColumnDimensionCode,
      typeof BUSINESS_DIMENSION_CODES.measure
    >;
    memberCode: string;
  };
  children: readonly BusinessColumnNode[];
  /** 生成 SpreadJS 列 Outline；第一片叶子列作为收起后的汇总列。 */
  collapsible?: boolean;
  /** 仅在顶层节点上生效；冻结该分组下的所有叶子列。 */
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

const PERIODS = [
  ['annualTotal', '全年合计', 'MEM_PERIOD_YEAR_TOTAL', 114],
  ['january', '1月', 'MEM_PERIOD_01', 92],
  ['february', '2月', 'MEM_PERIOD_02', 92],
  ['march', '3月', 'MEM_PERIOD_03', 92],
  ['april', '4月', 'MEM_PERIOD_04', 92],
  ['may', '5月', 'MEM_PERIOD_05', 92],
  ['june', '6月', 'MEM_PERIOD_06', 92],
  ['july', '7月', 'MEM_PERIOD_07', 92],
  ['august', '8月', 'MEM_PERIOD_08', 92],
  ['september', '9月', 'MEM_PERIOD_09', 92],
  ['october', '10月', 'MEM_PERIOD_10', 92],
  ['november', '11月', 'MEM_PERIOD_11', 92],
  ['december', '12月', 'MEM_PERIOD_12', 92],
] as const satisfies readonly [BudgetValueField, string, string, number][];

/**
 * 可直接由后端返回的费用预算列树。
 *
 * - 组织、科目是行维度列；功能属性是科目属性列。
 * - 预算类型、年度、期间和指标是四层列维度，每一层节点对应一个成员。
 * - 叶子的 field 仅用于读取当前前端记录，不承担业务坐标语义。
 * - 期间层包含全年合计和 1—12 月；全年合计是列组折叠后保留的汇总列。
 */
export const BUSINESS_COLUMN_DATA = [
  {
    type: 'rowDim',
    id: 'organization-hierarchy',
    field: 'organizationHierarchy',
    dimensionCode: BUSINESS_DIMENSION_CODES.organization,
    label: '组织',
    width: 216,
    dataType: 'string',
    editable: false,
    searchable: true,
    frozen: true,
  },
  {
    type: 'rowDim',
    id: 'subject-hierarchy',
    field: 'subjectHierarchy',
    dimensionCode: BUSINESS_DIMENSION_CODES.subject,
    label: '科目',
    width: 194,
    dataType: 'string',
    editable: false,
    searchable: true,
    frozen: true,
  },
  {
    type: 'attr',
    id: 'functional-attribute',
    field: 'functionalAttribute',
    attributeCode: BUSINESS_ATTRIBUTE_CODES.functionalAttribute,
    ownerDimensionCode: BUSINESS_DIMENSION_CODES.subject,
    label: '功能属性',
    width: 154,
    dataType: 'string',
    editor: { type: 'text' },
    editable: true,
    searchable: true,
    frozen: true,
  },
  {
    type: 'colDim',
    id: 'budget-data-category',
    label: '预算数',
    dimension: {
      code: BUSINESS_DIMENSION_CODES.dataCategory,
      memberCode: 'MEM_DATA_CATEGORY_BUDGET',
    },
    children: [
      {
        type: 'colDim',
        id: 'budget-year-2025',
        label: '2025年',
        dimension: {
          code: BUSINESS_DIMENSION_CODES.year,
          memberCode: 'MEM_YEAR_2025',
        },
        collapsible: true,
        children: PERIODS.map(([field, label, memberCode, width]) => ({
          type: 'colDim' as const,
          id: `period-${field}`,
          label,
          dimension: {
            code: BUSINESS_DIMENSION_CODES.period,
            memberCode,
          },
          children: [
            {
              type: 'value' as const,
              id: `amount-${field}`,
              field,
              label: '金额',
              width,
              dataType: 'number' as const,
              format: 'decimal' as const,
              editor: { type: 'number' as const },
              editable: true,
              dimension: {
                code: BUSINESS_DIMENSION_CODES.measure,
                memberCode: 'MEM_MEASURE_AMOUNT',
              },
            },
          ],
        })),
      },
    ],
  },
] as const satisfies readonly BusinessColumnNode[];

function isColumnLeaf(node: BusinessColumnNode): node is BusinessColumnLeaf {
  return node.type !== 'colDim';
}

export function isValueColumn(
  column: ColumnDefinition,
): column is BusinessValueColumn {
  return column.type === 'value';
}

function leavesOf(nodes: readonly BusinessColumnNode[]): BusinessColumnLeaf[] {
  return nodes.flatMap((node) =>
    isColumnLeaf(node) ? [node] : leavesOf(node.children),
  );
}

export function buildBusinessColumnModel(roots: readonly BusinessColumnNode[]) {
  const ids = new Set<string>();
  const leafFields = new Set<ColumnField>();
  const dimensionByField = new Map<ColumnField, BusinessColumnDimension>();
  const indexByDimension = new Map<string, number>();

  const validateNode = (
    node: BusinessColumnNode,
    parentDimension: DimensionMemberValues,
  ) => {
    if (ids.has(node.id)) throw new Error(`后台列配置存在重复 id：${node.id}`);
    ids.add(node.id);

    if (isColumnLeaf(node)) {
      if (leafFields.has(node.field))
        throw new Error(`后台叶子列存在重复数据 field：${node.field}`);
      leafFields.add(node.field);
      if (node.type !== 'value') {
        if (Object.keys(parentDimension).length)
          throw new Error(`行维度列或属性列不能嵌套在列维度中：${node.id}`);
        return;
      }
      if (parentDimension[node.dimension.code])
        throw new Error(`列维度路径存在重复维度：${node.dimension.code}`);
      const dimension = {
        ...parentDimension,
        [node.dimension.code]: node.dimension.memberCode,
      };
      if (!hasExactDimensionCodes(dimension, COLUMN_DIMENSION_CODES))
        throw new Error(`数值列缺少完整列维度：${node.id}`);
      dimensionByField.set(node.field, dimension as BusinessColumnDimension);
      return;
    }

    if (!node.children.length)
      throw new Error(`后台列分组不能没有 children：${node.id}`);
    if (parentDimension[node.dimension.code])
      throw new Error(`列维度路径存在重复维度：${node.dimension.code}`);
    const dimension = {
      ...parentDimension,
      [node.dimension.code]: node.dimension.memberCode,
    };
    const containsLeaf = node.children.some(isColumnLeaf);
    const containsGroup = node.children.some((child) => !isColumnLeaf(child));
    if (containsLeaf && containsGroup)
      throw new Error(`同一列分组不能混合叶子列和子分组：${node.id}`);
    node.children.forEach((child) => validateNode(child, dimension));
  };
  roots.forEach((root) => validateNode(root, {}));

  const columns = leavesOf(roots);
  const indexByField = new Map<ColumnField, number>(
    columns.map((column, index) => [column.field, index]),
  );
  columns.forEach((column, index) => {
    const dimension = dimensionByField.get(column.field);
    if (!dimension) return;
    const key = businessColumnDimensionKey(dimension);
    if (indexByDimension.has(key))
      throw new Error(`后台数值列存在重复业务坐标：${column.id}`);
    indexByDimension.set(key, index);
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

  const spanOfNode = (node: BusinessColumnNode): ColumnHeaderSpan => {
    if (!isColumnLeaf(node)) return spanOf(node);
    const startCol = indexByField.get(node.field);
    if (startCol === undefined)
      throw new Error(`后台叶子列无法定位：${node.id}`);
    return {
      id: node.id,
      label: node.label,
      startCol,
      colCount: 1,
    };
  };

  const headerSections = roots.map(spanOfNode);
  const leafDepth = (node: BusinessColumnNode, depth: number): number =>
    isColumnLeaf(node)
      ? depth
      : Math.max(...node.children.map((child) => leafDepth(child, depth + 1)));
  const lastHeaderRow = Math.max(...roots.map((root) => leafDepth(root, 0)));
  const headerCells: ColumnHeaderCell[] = [];
  const addLeafHeader = (column: BusinessColumnLeaf, row: number) => {
    const startCol = indexByField.get(column.field);
    if (startCol === undefined)
      throw new Error(`后台叶子列无法定位：${column.id}`);
    headerCells.push({
      id: column.id,
      label: column.label,
      startCol,
      colCount: 1,
      row,
      rowCount: lastHeaderRow - row + 1,
      kind: 'column',
    });
  };
  const visitHeader = (group: BusinessColumnGroup, row: number) => {
    const span = spanOf(group);
    const directLeaves = group.children.every(isColumnLeaf);
    // 分组标题只占一行，叶子标题补齐剩余表头行。
    headerCells.push({
      ...span,
      row,
      rowCount: 1,
      kind: 'group',
    });
    if (directLeaves) {
      group.children
        .filter(isColumnLeaf)
        .forEach((column) => addLeafHeader(column, row + 1));
      return;
    }
    group.children.forEach((child) => {
      if (isColumnLeaf(child)) addLeafHeader(child, row + 1);
      else visitHeader(child, row + 1);
    });
  };
  roots.forEach((root) => {
    if (isColumnLeaf(root)) addLeafHeader(root, 0);
    else visitHeader(root, 0);
  });

  const outlineGroups: ColumnOutlineGroup[] = [];
  const visitOutline = (group: BusinessColumnGroup) => {
    const leaves = leavesOf(group.children);
    if (group.collapsible && leaves.length > 1) {
      const summaryCol = indexByField.get(leaves[0].field);
      if (summaryCol === undefined)
        throw new Error(`后台列分组无法定位首列：${group.id}`);
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
  roots.forEach((root) => {
    if (!isColumnLeaf(root)) visitOutline(root);
  });

  const frozenColumns = roots
    .filter((root) => root.frozen)
    .flatMap((root) => (isColumnLeaf(root) ? [root] : leavesOf(root.children)));
  frozenColumns.forEach((column, index) => {
    if (indexByField.get(column.field) !== index)
      throw new Error('冻结列必须连续位于后台列树最左侧');
  });

  return {
    columns,
    headerSections,
    headerCells,
    headerRowCount: lastHeaderRow + 1,
    outlineGroups,
    frozenColumnCount: frozenColumns.length,
    indexByField,
    dimensionByField,
    indexByDimension,
  };
}

const COLUMN_MODEL = buildBusinessColumnModel(BUSINESS_COLUMN_DATA);

export const COLUMNS: ColumnDefinition[] = [...COLUMN_MODEL.columns];
export const COLUMN_HEADER_SECTIONS = COLUMN_MODEL.headerSections;
export const COLUMN_HEADER_CELLS = COLUMN_MODEL.headerCells;
export const COLUMN_HEADER_ROW_COUNT = COLUMN_MODEL.headerRowCount;
export const COLUMN_GROUPS = COLUMN_MODEL.outlineGroups;
export const HIERARCHY_COLUMN_COUNT = COLUMN_MODEL.frozenColumnCount;

export function getBusinessColumnDimension(
  field: ColumnField,
): BusinessColumnDimension | null {
  const dimension = COLUMN_MODEL.dimensionByField.get(field);
  return dimension ? { ...dimension } : null;
}

export function getBusinessColumnIndex(dimension: BusinessColumnDimension) {
  return (
    COLUMN_MODEL.indexByDimension.get(businessColumnDimensionKey(dimension)) ??
    -1
  );
}

function requiredColumnIndex(field: ColumnField) {
  const index = COLUMN_MODEL.indexByField.get(field);
  if (index === undefined) throw new Error(`后台列配置缺少字段：${field}`);
  return index;
}

// 保留控制器使用的常量名，值已对应新的组织 / 功能属性 / 科目列。
export const PRODUCT_HIERARCHY_COLUMN = requiredColumnIndex(
  'organizationHierarchy',
);
export const REGION_HIERARCHY_COLUMN = requiredColumnIndex('subjectHierarchy');
export const PRODUCT_ATTRIBUTE_COLUMN = requiredColumnIndex(
  'functionalAttribute',
);
export const ANNUAL_TOTAL_COLUMN = requiredColumnIndex('annualTotal');
export const STRESS_TEXT_SEARCH_COLUMNS = new Set(
  COLUMNS.flatMap((column, index) => (column.searchable ? [index] : [])),
);
