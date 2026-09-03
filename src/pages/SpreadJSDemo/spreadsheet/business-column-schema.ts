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

/** 顶层节点到叶子列的稳定 ID 路径。 */
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
  /** 仅在顶层节点上生效；冻结该叶子列。 */
  frozen?: boolean;
};

/** 后台列树中的分组节点，对应一层合并表头。 */
export type BusinessColumnGroup = {
  id: string;
  /** 分组节点自身的稳定字段标识，不直接映射 BUSINESS_DATA 的单元格值。 */
  field: string;
  label: string;
  children: readonly BusinessColumnNode[];
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

/**
 * “费用预算表-行维度展开示例.xlsx”对应的后台列树。
 *
 * 前三列来自 Excel 的行维度，后十三列严格对应 2025 年全年合计与
 * 1—12 月。全年合计是列组折叠时保留的汇总列。
 */
export const BUSINESS_COLUMN_DATA = [
  {
    id: 'organization-hierarchy',
    field: 'organizationHierarchy',
    label: '组织',
    width: 216,
    dataType: 'string',
    editable: false,
    searchable: true,
    frozen: true,
  },
  {
    id: 'subject-hierarchy',
    field: 'subjectHierarchy',
    label: '科目',
    width: 194,
    dataType: 'string',
    editable: false,
    searchable: true,
    frozen: true,
  },
  {
    id: 'functional-attribute',
    field: 'functionalAttribute',
    label: '功能属性',
    width: 154,
    dataType: 'string',
    editor: { type: 'text' },
    editable: true,
    searchable: true,
    frozen: true,
  },
  {
    id: 'budget-2025',
    field: 'budget2025',
    label: '2025年',
    children: [
      {
        id: 'annual-total',
        field: 'annualTotal',
        label: '全年合计',
        width: 114,
        dataType: 'number',
        format: 'decimal',
        editor: { type: 'number' },
        editable: true,
      },
      ...(
        [
          ['january', '1月'],
          ['february', '2月'],
          ['march', '3月'],
          ['april', '4月'],
          ['may', '5月'],
          ['june', '6月'],
          ['july', '7月'],
          ['august', '8月'],
          ['september', '9月'],
          ['october', '10月'],
          ['november', '11月'],
          ['december', '12月'],
        ] as const
      ).map(([field, label]) => ({
        id: field,
        field,
        label,
        width: 92,
        dataType: 'number' as const,
        format: 'decimal' as const,
        editor: { type: 'number' as const },
        editable: true,
      })),
    ],
  },
] as const satisfies readonly BusinessColumnNode[];

function isColumnLeaf(node: BusinessColumnNode): node is BusinessColumnLeaf {
  return !('children' in node);
}

function leavesOf(nodes: readonly BusinessColumnNode[]): BusinessColumnLeaf[] {
  return nodes.flatMap((node) =>
    isColumnLeaf(node) ? [node] : leavesOf(node.children),
  );
}

export function buildBusinessColumnModel(roots: readonly BusinessColumnNode[]) {
  const ids = new Set<string>();
  const nodeFields = new Set<string>();
  const leafFields = new Set<ColumnField>();
  const pathByField = new Map<ColumnField, BusinessColumnDimension>();
  const indexByDimension = new Map<string, number>();

  const validateNode = (
    node: BusinessColumnNode,
    parentPath: BusinessColumnDimension,
  ) => {
    if (ids.has(node.id)) throw new Error(`后台列配置存在重复 id：${node.id}`);
    ids.add(node.id);
    if (nodeFields.has(node.field))
      throw new Error(`后台列配置存在重复 field：${node.field}`);
    nodeFields.add(node.field);
    const path = [...parentPath, node.id];
    if (isColumnLeaf(node)) {
      if (leafFields.has(node.field))
        throw new Error(`后台叶子列存在重复数据 field：${node.field}`);
      leafFields.add(node.field);
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
  const headerGroups = roots.flatMap((root) =>
    isColumnLeaf(root)
      ? []
      : root.children
          .filter((child): child is BusinessColumnGroup => !isColumnLeaf(child))
          .map(spanOf),
  );

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
    headerCells.push({
      ...span,
      row,
      rowCount: directLeaves ? lastHeaderRow - row : 1,
      kind: 'group',
    });
    if (directLeaves) {
      group.children
        .filter(isColumnLeaf)
        .forEach((column) => addLeafHeader(column, lastHeaderRow));
      return;
    }
    group.children.forEach((child) => {
      if (!isColumnLeaf(child)) visitHeader(child, row + 1);
    });
  };
  roots.forEach((root) => {
    if (isColumnLeaf(root)) addLeafHeader(root, 0);
    else visitHeader(root, 0);
  });

  const outlineGroups: ColumnOutlineGroup[] = [];
  const visitOutline = (group: BusinessColumnGroup) => {
    const leaves = leavesOf(group.children);
    if (leaves.length > 1) {
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

export function getBusinessColumnDimension(
  field: ColumnField,
): BusinessColumnDimension | null {
  const path = COLUMN_MODEL.pathByField.get(field);
  return path ? [...path] : null;
}

export function getBusinessColumnIndex(dimension: BusinessColumnDimension) {
  return COLUMN_MODEL.indexByDimension.get(JSON.stringify(dimension)) ?? -1;
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
