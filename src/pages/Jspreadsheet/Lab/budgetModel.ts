/**
 * 可配置预算表模型
 * 行维：组织架构树
 * 列维：年份 → 科目 → 期间 → 值
 */

export type BudgetValueType = 'number' | 'text';

/** 列维嵌套轴：年份 / 科目 / 期间 */
export type BudgetColumnAxisKey = 'year' | 'subject' | 'period';

export type BudgetOrgNode = {
  id: string;
  name: string;
  children?: BudgetOrgNode[];
  /** 叶子默认样例值：subjectId → periodId → value */
  values?: Record<string, Record<string, number | string>>;
};

export type BudgetSubjectDef = {
  id: string;
  name: string;
  valueType?: BudgetValueType;
};

export type BudgetPeriodDef = {
  id: string;
  name: string;
};

export type BudgetSheetConfig = {
  /** 行维：组织树 */
  orgTree: BudgetOrgNode[];
  /** 列维：年份 */
  years: number[];
  /** 列维：科目（收入类 / 利润 / 备注…） */
  subjects: BudgetSubjectDef[];
  /** 列维：期间（1月 / 2月 / 3月…） */
  periods: BudgetPeriodDef[];
  /** 组织列标题 */
  orgColumnTitle?: string;
  /** 列维嵌套顺序，默认 year → subject → period */
  columnAxis?: BudgetColumnAxisKey[];
  /** 最外层是否显示「度量维」表头 */
  showMeasureHeader?: boolean;
  /** 标签内容（可选覆盖组织列标题旁说明） */
  labelContent?: string;
  /** 标签对齐 */
  labelPosition?: 'left' | 'center' | 'right';
};

/** 展平后的列元数据（用于列维解析 / 保存 / 回显） */
export type BudgetColumnMeta = {
  col: number;
  field: string;
  year: number;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  valueType: BudgetValueType;
  /** 2028年 / 收入类 / 1月 */
  dimension: string;
};

export type BudgetRowMeta = {
  row: number;
  orgId: string;
  orgName: string;
  orgPath: string;
  depth: number;
  hasChildren: boolean;
  descendantCount: number;
};

export type BudgetRowDimensions = {
  organization: string;
  organizationPath: string;
  orgId: string;
  depth: number;
  dimension: string;
};

export type BudgetColumnDimensions = {
  field: string;
  year: number;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  dimension: string;
};

export type BudgetSavedCell = {
  cell: string;
  col: number;
  row: number;
  value: unknown;
  display?: unknown;
  rowDimensions: BudgetRowDimensions;
  columnDimensions: BudgetColumnDimensions;
};

export type BudgetGroupCell = {
  row: number;
  col: number;
  label: string;
  kind: 'category' | 'leaf';
  indent: number;
  orgPath: string;
  orgId: string;
  expanded?: boolean;
};

export type BudgetBuiltSheet = {
  data: any[][];
  columns: Array<Record<string, unknown>>;
  nestedHeaders: Array<Array<{ title: string; colspan: number }>>;
  rows: Record<number, { group: number; state: boolean }>;
  groupCells: BudgetGroupCell[];
  columnMetas: BudgetColumnMeta[];
  rowMetas: BudgetRowMeta[];
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  config: BudgetSheetConfig;
};

/** 默认配置：对齐「年份→科目→期间」×「组织树」示意 */
export const DEFAULT_BUDGET_CONFIG: BudgetSheetConfig = {
  orgColumnTitle: '组织',
  years: [2028],
  subjects: [
    { id: 'income', name: '收入类', valueType: 'number' },
    { id: 'profit', name: '利润', valueType: 'number' },
    { id: 'remark', name: '备注', valueType: 'text' },
  ],
  periods: [
    { id: 'm1', name: '1月' },
    { id: 'm2', name: '2月' },
    { id: 'm3', name: '3月' },
  ],
  orgTree: [
    {
      id: 'crm',
      name: '华润微电子集团',
      children: [
        {
          id: 'crm-hq',
          name: '华润微电子本部',
          values: {
            income: { m1: 600, m2: 600, m3: 600 },
            profit: { m1: 90, m2: 90, m3: 90 },
            remark: { m1: '-', m2: '-', m3: '-' },
          },
        },
        {
          id: 'hj',
          name: '华晶公司',
          children: [
            {
              id: 'hj-sales',
              name: '华晶公司-销售部',
              values: {
                income: { m1: 600, m2: 600, m3: 600 },
                profit: { m1: 90, m2: 90, m3: 90 },
                remark: { m1: '销售', m2: '销售', m3: '销售' },
              },
            },
            {
              id: 'hj-fin',
              name: '华晶公司-财务部',
              values: {
                income: { m1: 600, m2: 600, m3: 600 },
                profit: { m1: 90, m2: 90, m3: 90 },
                remark: { m1: '-', m2: '-', m3: '-' },
              },
            },
            {
              id: 'hj-admin',
              name: '华晶公司-行政部',
              values: {
                income: { m1: 600, m2: 600, m3: 600 },
                profit: { m1: 90, m2: 90, m3: 90 },
                remark: { m1: '-', m2: '-', m3: '-' },
              },
            },
            {
              id: 'hj-rd',
              name: '华晶公司-研发部',
              values: {
                income: { m1: 600, m2: 600, m3: 600 },
                profit: { m1: 90, m2: 90, m3: 90 },
                remark: { m1: '研发', m2: '研发', m3: '研发' },
              },
            },
          ],
        },
        {
          id: 'shanghua',
          name: '上华公司',
          children: [
            {
              id: 'shanghua-sales',
              name: '上华公司-销售部',
              values: {
                income: { m1: 600, m2: 600, m3: 600 },
                profit: { m1: 90, m2: 90, m3: 90 },
                remark: { m1: '销售', m2: '销售', m3: '销售' },
              },
            },
          ],
        },
      ],
    },
  ],
  columnAxis: ['year', 'subject', 'period'],
  showMeasureHeader: true,
};

function countDescendants(node: BudgetOrgNode): number {
  if (!node.children?.length) return 0;
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0,
  );
}

function formatOrgLabel(name: string, depth: number) {
  if (depth <= 0) return name;
  return `${'\u3000'.repeat(depth)}${name}`;
}

function flattenOrgTree(
  nodes: BudgetOrgNode[],
  parentPath: string[] = [],
  depth = 0,
): Array<BudgetOrgNode & { path: string[]; depth: number }> {
  const out: Array<BudgetOrgNode & { path: string[]; depth: number }> = [];
  nodes.forEach((node) => {
    const path = [...parentPath, node.name];
    out.push({ ...node, path, depth });
    if (node.children?.length) {
      out.push(...flattenOrgTree(node.children, path, depth + 1));
    }
  });
  return out;
}

function resolveColumnAxis(config: BudgetSheetConfig): BudgetColumnAxisKey[] {
  const axis = config.columnAxis?.length
    ? [...config.columnAxis]
    : (['year', 'subject', 'period'] as BudgetColumnAxisKey[]);
  const unique = axis.filter(
    (key, idx) =>
      (key === 'year' || key === 'subject' || key === 'period') &&
      axis.indexOf(key) === idx,
  );
  (['year', 'subject', 'period'] as BudgetColumnAxisKey[]).forEach((key) => {
    if (!unique.includes(key)) unique.push(key);
  });
  return unique;
}

type AxisCombo = {
  year: number;
  subject: BudgetSubjectDef;
  period: BudgetPeriodDef;
};

function buildAxisCombos(config: BudgetSheetConfig): AxisCombo[] {
  const axis = resolveColumnAxis(config);
  let combos: Array<Partial<AxisCombo>> = [{}];

  axis.forEach((key) => {
    const next: Array<Partial<AxisCombo>> = [];
    if (key === 'year') {
      const years = config.years.length ? config.years : [2028];
      combos.forEach((c) => {
        years.forEach((year) => next.push({ ...c, year }));
      });
    } else if (key === 'subject') {
      const subjects = config.subjects.length
        ? config.subjects
        : [{ id: 'income', name: '收入类', valueType: 'number' as const }];
      combos.forEach((c) => {
        subjects.forEach((subject) => next.push({ ...c, subject }));
      });
    } else {
      const periods = config.periods.length
        ? config.periods
        : [{ id: 'm1', name: '1月' }];
      combos.forEach((c) => {
        periods.forEach((period) => next.push({ ...c, period }));
      });
    }
    combos = next.length ? next : combos;
  });

  const fallbackYear = config.years[0] ?? 2028;
  const fallbackSubject =
    config.subjects[0] ??
    ({ id: 'income', name: '收入类', valueType: 'number' } as BudgetSubjectDef);
  const fallbackPeriod = config.periods[0] ?? { id: 'm1', name: '1月' };

  return combos.map((c) => ({
    year: c.year ?? fallbackYear,
    subject: c.subject ?? fallbackSubject,
    period: c.period ?? fallbackPeriod,
  }));
}

function axisLabel(key: BudgetColumnAxisKey, combo: AxisCombo): string {
  if (key === 'year') return `${combo.year}年`;
  if (key === 'subject') return combo.subject.name;
  return combo.period.name;
}

function leafAxisTitle(axis: BudgetColumnAxisKey[], combo: AxisCombo): string {
  const leaf = axis[axis.length - 1] || 'period';
  return axisLabel(leaf, combo);
}

/** 根据配置生成列元数据（按 columnAxis 笛卡尔积） */
export function buildBudgetColumnMetas(config: BudgetSheetConfig): BudgetColumnMeta[] {
  const axis = resolveColumnAxis(config);
  const combos = buildAxisCombos(config);
  return combos.map((combo, index) => {
    const col = index + 1;
    return {
      col,
      field: `${combo.year}-${combo.subject.id}-${combo.period.id}`,
      year: combo.year,
      subjectId: combo.subject.id,
      subjectName: combo.subject.name,
      periodId: combo.period.id,
      periodName: combo.period.name,
      valueType: combo.subject.valueType ?? 'number',
      dimension: axis.map((key) => axisLabel(key, combo)).join(' / '),
    };
  });
}

export function buildBudgetNestedHeaders(config: BudgetSheetConfig) {
  const orgTitle = config.orgColumnTitle || '组织';
  const axis = resolveColumnAxis(config);
  const combos = buildAxisCombos(config);
  if (!combos.length) {
    return [[{ title: orgTitle, colspan: 1 }]];
  }

  const headerRows: Array<Array<{ title: string; colspan: number }>> = [];

  if (config.showMeasureHeader) {
    headerRows.push([
      { title: orgTitle, colspan: 1 },
      { title: '度量维', colspan: combos.length },
    ]);
  }

  // 除最内层外，每一层轴生成一行 nested header；最内层放到 column.title
  const nestKeys = axis.slice(0, -1);
  nestKeys.forEach((key, level) => {
    const row: Array<{ title: string; colspan: number }> = [
      {
        title: config.showMeasureHeader || level > 0 ? '' : orgTitle,
        colspan: 1,
      },
    ];
    let i = 0;
    while (i < combos.length) {
      const label = axisLabel(key, combos[i]);
      let span = 1;
      while (
        i + span < combos.length &&
        axisLabel(key, combos[i + span]) === label &&
        nestKeys
          .slice(0, level)
          .every((k) => axisLabel(k, combos[i + span]) === axisLabel(k, combos[i]))
      ) {
        span += 1;
      }
      row.push({ title: label, colspan: span });
      i += span;
    }
    headerRows.push(row);
  });

  if (!headerRows.length) {
    headerRows.push([
      { title: orgTitle, colspan: 1 },
      { title: '', colspan: combos.length },
    ]);
  }

  return headerRows;
}

export function buildBudgetColumns(config: BudgetSheetConfig, columnMetas: BudgetColumnMeta[]) {
  const orgTitle = config.orgColumnTitle || '组织';
  const axis = resolveColumnAxis(config);
  const align =
    config.labelPosition === 'center'
      ? 'center'
      : config.labelPosition === 'right'
        ? 'right'
        : 'left';
  const columns: Array<Record<string, unknown>> = [
    {
      type: 'text',
      title: config.labelContent ? `${orgTitle}·${config.labelContent}` : orgTitle,
      width: 220,
      readOnly: true,
      align,
    },
  ];
  columnMetas.forEach((meta) => {
    const combo = {
      year: meta.year,
      subject: {
        id: meta.subjectId,
        name: meta.subjectName,
        valueType: meta.valueType,
      },
      period: { id: meta.periodId, name: meta.periodName },
    };
    const title = leafAxisTitle(axis, combo);
    if (meta.valueType === 'text') {
      columns.push({
        type: 'text',
        title,
        width: 88,
        align: 'left',
        name: meta.field,
      });
    } else {
      columns.push({
        type: 'numeric',
        title,
        width: 88,
        mask: '#,##0.00',
        align: 'right',
        name: meta.field,
      });
    }
  });
  return columns;
}

function seedValue(
  node: BudgetOrgNode,
  subjectId: string,
  periodId: string,
  valueType: BudgetValueType,
): number | string {
  const raw = node.values?.[subjectId]?.[periodId];
  if (raw != null) return raw;
  if (valueType === 'text') return '-';
  // 无样例时给稳定演示数
  const hash =
    (node.id.length * 17 + subjectId.length * 13 + periodId.length * 7) % 97;
  return (hash + 1) * 10;
}

/** 由配置构建整表（一行一个组织节点） */
export function buildBudgetSheet(
  config: BudgetSheetConfig = DEFAULT_BUDGET_CONFIG,
  opts?: { expandAll?: boolean },
): BudgetBuiltSheet {
  const expandAll = opts?.expandAll !== false;
  const columnMetas = buildBudgetColumnMetas(config);
  const columns = buildBudgetColumns(config, columnMetas);
  const nestedHeaders = buildBudgetNestedHeaders(config);
  const flat = flattenOrgTree(config.orgTree);

  const data: any[][] = [];
  const rows: Record<number, { group: number; state: boolean }> = {};
  const groupCells: BudgetGroupCell[] = [];
  const rowMetas: BudgetRowMeta[] = [];
  const style: Record<string, string> = {};

  /** 先算叶子值，父级数值科目按子节点汇总 */
  const valueCache = new Map<string, number | string>();
  const cacheKey = (orgId: string, subjectId: string, periodId: string) =>
    `${orgId}|${subjectId}|${periodId}`;

  const resolveNodeValue = (
    node: BudgetOrgNode,
    subjectId: string,
    periodId: string,
    valueType: BudgetValueType,
  ): number | string => {
    const key = cacheKey(node.id, subjectId, periodId);
    if (valueCache.has(key)) return valueCache.get(key)!;

    if (!node.children?.length) {
      const v = seedValue(node, subjectId, periodId, valueType);
      valueCache.set(key, v);
      return v;
    }

    if (valueType === 'text') {
      const v = seedValue(node, subjectId, periodId, valueType);
      valueCache.set(key, v);
      return v;
    }

    const sum = node.children.reduce((acc, child) => {
      const childVal = resolveNodeValue(child, subjectId, periodId, valueType);
      return acc + (typeof childVal === 'number' ? childVal : Number(childVal) || 0);
    }, 0);
    valueCache.set(key, sum);
    return sum;
  };

  flat.forEach((node, rowIndex) => {
    const label = formatOrgLabel(node.name, node.depth);
    const orgPath = node.path.join(' / ');
    const hasChildren = !!node.children?.length;
    const descendantCount = countDescendants(node);

    const rowValues: any[] = [label];
    columnMetas.forEach((meta) => {
      rowValues.push(
        resolveNodeValue(node, meta.subjectId, meta.periodId, meta.valueType),
      );
    });
    data.push(rowValues);

    rowMetas.push({
      row: rowIndex,
      orgId: node.id,
      orgName: node.name,
      orgPath,
      depth: node.depth,
      hasChildren,
      descendantCount,
    });

    groupCells.push({
      row: rowIndex,
      col: 0,
      label,
      kind: hasChildren ? 'category' : 'leaf',
      indent: node.depth,
      orgPath,
      orgId: node.id,
      expanded: expandAll,
    });

    if (hasChildren && descendantCount > 0) {
      rows[rowIndex] = { group: descendantCount, state: expandAll };
    }
  });

  return {
    data,
    columns,
    nestedHeaders,
    rows,
    groupCells,
    columnMetas,
    rowMetas,
    mergeCells: {},
    style,
    config,
  };
}

export function resolveBudgetRowDimensions(
  rowIndex: number,
  rowMetas: BudgetRowMeta[],
  fallbackOrg = '',
): BudgetRowDimensions {
  const meta = rowMetas.find((item) => item.row === rowIndex);
  if (!meta) {
    return {
      organization: fallbackOrg,
      organizationPath: fallbackOrg,
      orgId: '',
      depth: 0,
      dimension: fallbackOrg,
    };
  }
  return {
    organization: meta.orgName,
    organizationPath: meta.orgPath,
    orgId: meta.orgId,
    depth: meta.depth,
    dimension: meta.orgPath,
  };
}

export function resolveBudgetColumnDimensions(
  col: number,
  columnMetas: BudgetColumnMeta[],
  fieldHint = '',
): BudgetColumnDimensions | null {
  if (col <= 0) {
    return null;
  }
  const meta = columnMetas.find((item) => item.col === col);
  if (!meta) {
    return {
      field: fieldHint || `col${col}`,
      year: 0,
      subjectId: '',
      subjectName: '',
      periodId: '',
      periodName: fieldHint,
      dimension: fieldHint || `col${col}`,
    };
  }
  return {
    field: meta.field,
    year: meta.year,
    subjectId: meta.subjectId,
    subjectName: meta.subjectName,
    periodId: meta.periodId,
    periodName: meta.periodName,
    dimension: meta.dimension,
  };
}

/** 把保存结果展开为单元格记录（便于接口 / 回显） */
export function flattenSaveCells(updatedRows: Array<{
  rowIndex: number;
  modifiedFields: Array<{
    col: number;
    row: number;
    cell: string;
    value: unknown;
    display?: unknown;
    rowDimensions?: BudgetRowDimensions;
    columnDimensions?: BudgetColumnDimensions | null;
  }>;
  rowDimensions?: BudgetRowDimensions;
}>): BudgetSavedCell[] {
  const cells: BudgetSavedCell[] = [];
  updatedRows.forEach((row) => {
    row.modifiedFields.forEach((field) => {
      if (!field.columnDimensions || field.col <= 0) return;
      const rowDimensions = field.rowDimensions || row.rowDimensions;
      if (!rowDimensions) return;
      cells.push({
        cell: field.cell,
        col: field.col,
        row: field.row,
        value: field.value,
        display: field.display,
        rowDimensions,
        columnDimensions: field.columnDimensions,
      });
    });
  });
  return cells;
}

/** 保存成功后回显：按坐标写回，确认 round-trip */
export function echoSavedCellsToWorksheet(
  ws: any,
  cells: BudgetSavedCell[],
): number {
  if (!ws?.setValueFromCoords || !cells.length) return 0;
  let written = 0;
  cells.forEach((item) => {
    ws.setValueFromCoords(item.col, item.row, item.value, true);
    written += 1;
  });
  return written;
}

/** 某行的祖先行（近→远），用于编辑后向上汇总 */
export function findAncestorRowMetas(
  rowMetas: BudgetRowMeta[],
  rowIndex: number,
): BudgetRowMeta[] {
  const ancestors: BudgetRowMeta[] = [];
  for (let i = 0; i < rowMetas.length; i += 1) {
    const meta = rowMetas[i];
    if (!meta.hasChildren || meta.descendantCount <= 0) continue;
    if (rowIndex > meta.row && rowIndex <= meta.row + meta.descendantCount) {
      ancestors.push(meta);
    }
  }
  // 近父优先：行号大的更近
  return ancestors.sort((a, b) => b.row - a.row);
}

/** 直接子节点（深度 = parent.depth + 1） */
export function findDirectChildRowMetas(
  rowMetas: BudgetRowMeta[],
  parent: BudgetRowMeta,
): BudgetRowMeta[] {
  return rowMetas.filter(
    (meta) =>
      meta.depth === parent.depth + 1 &&
      meta.row > parent.row &&
      meta.row <= parent.row + parent.descendantCount,
  );
}

/**
 * 数值列编辑后：把变更行的祖先按「直接子节点之和」重算，消除上下级差额。
 * 返回被写回的父行号。
 */
export function rollupBudgetAncestors(
  ws: any,
  col: number,
  changedRow: number,
  rowMetas: BudgetRowMeta[] | undefined,
  columnMetas: BudgetColumnMeta[] | undefined,
): number[] {
  if (!ws?.setValueFromCoords || !rowMetas?.length || !columnMetas?.length) {
    return [];
  }
  if (col <= 0) return [];
  const colMeta = columnMetas.find((item) => item.col === col);
  if (!colMeta || colMeta.valueType !== 'number') return [];

  const ancestors = findAncestorRowMetas(rowMetas, changedRow);
  if (!ancestors.length) return [];

  const updated: number[] = [];
  // 自近及远：先更新直接父，再更新更高层
  ancestors.forEach((parent) => {
    const children = findDirectChildRowMetas(rowMetas, parent);
    const sum = children.reduce((acc, child) => {
      const raw = ws.getValueFromCoords?.(col, child.row, false);
      const n = Number(raw);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    const oldRaw = ws.getValueFromCoords?.(col, parent.row, false);
    const old = Number(oldRaw);
    if (Number.isFinite(old) && old === sum) return;
    ws.setValueFromCoords(col, parent.row, sum, true);
    updated.push(parent.row);
  });
  return updated;
}

/** 有子节点的组织行：数值格只读，避免手改造成与子级差额 */
export function isBudgetParentNumericCell(
  row: number,
  col: number,
  rowMetas?: BudgetRowMeta[],
  columnMetas?: BudgetColumnMeta[],
): boolean {
  if (col <= 0 || !rowMetas?.length || !columnMetas?.length) return false;
  const rowMeta = rowMetas.find((item) => item.row === row);
  if (!rowMeta?.hasChildren) return false;
  const colMeta = columnMetas.find((item) => item.col === col);
  return !!colMeta && colMeta.valueType === 'number';
}

/** 用扁平记录重建 values 映射（orgId → subjectId → periodId → value） */
export function recordsToValueMap(cells: BudgetSavedCell[]) {
  const map: Record<string, Record<string, Record<string, unknown>>> = {};
  cells.forEach((cell) => {
    const orgId = cell.rowDimensions.orgId || cell.rowDimensions.organizationPath;
    const { subjectId, periodId } = cell.columnDimensions;
    if (!orgId || !subjectId || !periodId) return;
    if (!map[orgId]) map[orgId] = {};
    if (!map[orgId][subjectId]) map[orgId][subjectId] = {};
    map[orgId][subjectId][periodId] = cell.value;
  });
  return map;
}
