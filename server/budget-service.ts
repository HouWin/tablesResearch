import { randomUUID } from 'node:crypto';
import FormulaParser from 'fast-formula-parser';
import {
  BUSINESS_DATA,
  BUDGET_VALUE_FIELDS,
  COLUMNS,
  BUSINESS_DIMENSION_CODES as DIM,
  getBusinessColumnIndex,
  type OrganizationNode,
  type SubjectNode,
} from '../src/pages/SpreadJSDemo/spreadsheet/model';
import {
  createBusinessCellChangePayload,
  toBusinessCellEditTarget,
} from '../src/pages/SpreadJSDemo/spreadsheet/business-cell-change';
import {
  isBusinessCellDimension,
  type BusinessCellDimension,
} from '../src/pages/SpreadJSDemo/spreadsheet/business-cell-coordinate';
import {
  bounds,
  isExpanded,
  type BudgetQuery,
  type BudgetRow,
  type CellPatch,
  type CellRange,
  type CellWrite,
  type Manifest,
  type SearchMatch,
  type Statistics,
  type Transaction,
} from '../src/pages/TanStackBudget/core/types';

const PAGE_SIZE = 200;
const MAX_BATCH = 20_000;
const SEARCH_NUMBER_FORMAT = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const SUBJECTS = [
  '日常费用',
  '人力成本',
  '研发投入',
  '市场销售',
  '制造运营',
  '供应链',
  '信息技术',
  '质量管理',
  '资产折旧',
  '行政管理',
];
const DETAIL_NAMES = [
  '办公费',
  '电费',
  '水费',
  '差旅费',
  '材料费',
  '维护费',
  '服务费',
  '培训费',
  '运输费',
  '设备费',
];
const REGIONS = [
  '华东',
  '华南',
  '华北',
  '华中',
  '西南',
  '西北',
  '东北',
  '长三角',
  '粤港澳',
  '成渝',
];
type Subject = {
  id: string;
  memberCode: string;
  name: string;
  detailCount: number;
  source?: SubjectNode;
  group: number;
};
type Organization = {
  id: string;
  memberCode: string;
  name: string;
  parent: string | null;
  ancestors: string[];
  children: string[];
  subjects: Subject[];
  serial: number;
};
type Segment = {
  start: number;
  count: number;
  org: Organization;
  subject: Subject;
  depth: number;
  blockStart: number;
  blockCount: number;
};
type Projection = {
  manifest: Manifest;
  query: BudgetQuery;
  segments: Segment[];
};
type RecordTarget = { org: Organization; subject: Subject; detail: number };
type Formula = {
  text: string;
  projection: Projection;
  row: number;
  col: number;
};
type StoredCell = { value: string | number; formula?: Formula };
type SearchBucket = { target: RecordTarget; columns: number[]; end: number };

function collectOrganizations() {
  const result = new Map<string, Organization>();
  function visit(
    node: OrganizationNode,
    parent: string | null,
    ancestors: string[],
  ) {
    result.set(node.id, {
      id: node.id,
      memberCode: node.memberCode,
      name: node.name,
      parent,
      ancestors,
      children: (node.children ?? []).map((child) => child.id),
      serial: result.size,
      subjects: (node.subjects ?? []).map((source, group) => ({
        id: source.id,
        memberCode: source.memberCode,
        name: source.name,
        detailCount: source.children?.length ?? 0,
        source,
        group,
      })),
    });
    node.children?.forEach((child) =>
      visit(child, node.id, [...ancestors, node.id]),
    );
  }
  BUSINESS_DATA.forEach((org) => visit(org, null, []));
  return result;
}
const REGULAR_ORGS = collectOrganizations();
function createStressOrganizations() {
  const result = new Map<string, Organization>();
  for (let region = 0; region < 10; region += 1) {
    const rootId = `stress-region-${region}`;
    for (let unit = -1; unit < 10; unit += 1) {
      const serial = region * 11 + unit + 1;
      const id = unit < 0 ? rootId : `${rootId}-unit-${unit}`;
      result.set(id, {
        id,
        serial,
        memberCode: `MEM_ORG_STRESS_${serial}`,
        parent: unit < 0 ? null : rootId,
        ancestors: unit < 0 ? [] : [rootId],
        name:
          unit < 0
            ? `${REGIONS[region]}经营区域`
            : `${REGIONS[region]} · ${
                ['研发', '制造', '销售', '供应链', '质量'][unit % 5]
              }中心 ${unit + 1}`,
        children:
          unit < 0
            ? Array.from(
                { length: 10 },
                (_, child) => `${rootId}-unit-${child}`,
              )
            : [],
        subjects: SUBJECTS.map((name, group) => ({
          id: `${id}-subject-${group}`,
          name: `${name}合计`,
          memberCode: `MEM_SUBJECT_STRESS_${group}`,
          detailCount: unit < 0 ? 0 : 100,
          group,
        })),
      });
    }
  }
  return result;
}
const STRESS_ORGS = createStressOrganizations();
const orgsFor = (mode: BudgetQuery['mode']) =>
  mode === 'regular' ? REGULAR_ORGS : STRESS_ORGS;
export const subjectKey = (org: Organization, subject: Subject) =>
  `${org.id}/${subject.id}`;
function baseRecord(target: RecordTarget): SubjectNode {
  const { org, subject, detail } = target;
  if (subject.source)
    return detail < 0 ? subject.source : subject.source.children![detail];
  const months = Array.from(
    { length: 12 },
    (_, month) =>
      Math.round(
        (800 + (org.serial + 1) * 23 + subject.group * 71 + (detail + 1) * 13) *
          [0.92, 0.88, 1.02, 1.04, 1, 1.03, 1.08, 1.06, 1.01, 1.04, 1, 1.12][
            month
          ] *
          (detail < 0 ? 100 : 1) *
          100,
      ) / 100,
  );
  return {
    id: detail < 0 ? subject.id : `${subject.id}-detail-${detail}`,
    memberCode:
      detail < 0
        ? subject.memberCode
        : `${subject.memberCode}_DETAIL_${detail}`,
    name:
      detail < 0
        ? subject.name
        : `${DETAIL_NAMES[detail % 10]} · ${String(detail + 1).padStart(
            3,
            '0',
          )}`,
    functionalAttribute:
      subject.group === 3 ? '销售' : subject.group === 2 ? '研发' : '管理',
    ...Object.fromEntries(
      BUDGET_VALUE_FIELDS.map((field, index) => [
        field,
        index === 0
          ? Math.round(months.reduce((sum, value) => sum + value, 0) * 100) /
            100
          : months[index - 1],
      ]),
    ),
  } as SubjectNode;
}
// Index metadata and the small original sample only; stress details remain lazy.
const RECORD_INDEX = new Map<string, RecordTarget>();
for (const orgs of [REGULAR_ORGS, STRESS_ORGS]) {
  for (const org of orgs.values())
    for (const subject of org.subjects) {
      RECORD_INDEX.set(subject.id, { org, subject, detail: -1 });
      subject.source?.children?.forEach((child, detail) =>
        RECORD_INDEX.set(child.id, { org, subject, detail }),
      );
    }
}
function findRecord(
  mode: BudgetQuery['mode'],
  id: string,
): RecordTarget | null {
  if (typeof id !== 'string') return null;
  const exact = RECORD_INDEX.get(id);
  if (exact && orgsFor(mode).has(exact.org.id)) return exact;
  if (mode !== 'stress') return null;
  const parsed = /^(.*)-detail-(0|[1-9]\d*)$/.exec(id);
  const parent = parsed && RECORD_INDEX.get(parsed[1]);
  const detail = parsed ? Number(parsed[2]) : -1;
  return parent && !parent.subject.source && detail < parent.subject.detailCount
    ? { ...parent, detail }
    : null;
}
export class BudgetError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
function normalizeInput(input: unknown, col: number): string | number {
  if (!COLUMNS[col]?.editable || col < 2)
    throw new BudgetError('组织和科目由层级维护，不能修改。');
  if (col === 2) {
    if (typeof input !== 'string' || input.length > 1000)
      throw new BudgetError('功能属性应为不超过 1000 字的文本。');
    return input;
  }
  if (typeof input !== 'string' && typeof input !== 'number')
    throw new BudgetError('预算金额必须为数字或数字文本。');
  const normalized =
    typeof input === 'string' ? input.replace(/[\s,¥￥]/g, '') : input;
  const value = normalized === '' ? 0 : Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
    throw new BudgetError(
      '预算金额须为 0 至 10 亿之间的数字；清空金额将恢复为 0。',
    );
  return value;
}
function validateQuery(query: BudgetQuery) {
  if (
    !query ||
    !['regular', 'stress'].includes(query.mode) ||
    !Array.isArray(query.drillPath) ||
    query.drillPath.length > 100 ||
    query.drillPath.some((id) => typeof id !== 'string')
  )
    throw new BudgetError('无效的数据查询。');
  for (const state of [query.organizations, query.subjects]) {
    if (
      !state ||
      typeof state.all !== 'boolean' ||
      !Array.isArray(state.ids) ||
      state.ids.length > 5000 ||
      state.ids.some((id) => typeof id !== 'string')
    )
      throw new BudgetError('无效的展开状态。');
  }
}

/** Server-owned sparse dataset. Projection segments describe ranges, never 100k materialized rows. */
export class BudgetService {
  private projections = new Map<string, Projection>();
  private values = new Map<string, StoredCell>();
  private history = new Map<
    string,
    {
      patches: CellPatch[];
      before: Map<string, StoredCell | undefined>;
      after: Map<string, StoredCell | undefined>;
      mode: BudgetQuery['mode'];
    }
  >();
  private revision = 0;
  private searchCache: {
    key: string;
    buckets: SearchBucket[];
    total: number;
  } | null = null;
  private key(mode: string, id: string, col: number) {
    return `${mode}/${id}/${col}`;
  }

  project(query: BudgetQuery): Manifest {
    validateQuery(query);
    const orgs = orgsFor(query.mode);
    let rootIds = [...orgs.values()]
      .filter((org) => org.parent === null)
      .map((org) => org.id);
    for (const id of query.drillPath) {
      if (!rootIds.includes(id)) throw new BudgetError('下钻路径不存在。');
      rootIds = orgs.get(id)!.children;
    }
    const visible: { org: Organization; depth: number }[] = [];
    const visit = (id: string, depth: number) => {
      const org = orgs.get(id)!;
      visible.push({ org, depth });
      if (isExpanded(query.organizations, id))
        org.children.forEach((child) => visit(child, depth + 1));
    };
    rootIds.forEach((id) => visit(id, 0));
    let start = 0;
    const segments: Segment[] = [];
    for (const { org, depth } of visible) {
      const blockCount = org.subjects.reduce(
        (sum, subject) =>
          sum +
          1 +
          (isExpanded(query.subjects, subjectKey(org, subject))
            ? subject.detailCount
            : 0),
        0,
      );
      const blockStart = start;
      for (const subject of org.subjects) {
        const count =
          1 +
          (isExpanded(query.subjects, subjectKey(org, subject))
            ? subject.detailCount
            : 0);
        segments.push({
          start,
          count,
          org,
          subject,
          depth,
          blockStart,
          blockCount,
        });
        start += count;
      }
    }
    const allOrgs = [...orgs.values()];
    const orgGroups = allOrgs.filter((org) => org.children.length);
    const subjects = allOrgs.flatMap((org) =>
      org.subjects
        .filter((subject) => subject.detailCount)
        .map((subject) => subjectKey(org, subject)),
    );
    const manifest: Manifest = {
      id: randomUUID(),
      totalRows: start,
      pageSize: PAGE_SIZE,
      detailCount: allOrgs.reduce(
        (sum, org) =>
          sum +
          org.subjects.reduce(
            (count, subject) => count + subject.detailCount,
            0,
          ),
        0,
      ),
      summaryCount: allOrgs.reduce((sum, org) => sum + org.subjects.length, 0),
      organizationGroups: orgGroups.length,
      organizationExpanded: orgGroups.filter((org) =>
        isExpanded(query.organizations, org.id),
      ).length,
      subjectGroups: subjects.length,
      subjectExpanded: subjects.filter((id) => isExpanded(query.subjects, id))
        .length,
      breadcrumbs: query.drillPath.map((id) => ({
        id,
        name: orgs.get(id)!.name,
      })),
    };
    this.projections.set(manifest.id, {
      manifest,
      query: structuredClone(query),
      segments,
    });
    if (this.projections.size > 24)
      this.projections.delete(this.projections.keys().next().value!);
    return manifest;
  }
  private projection(id: string) {
    const projection = this.projections.get(id);
    if (!projection) throw new BudgetError('视图已过期，请重新载入。', 410);
    return projection;
  }
  private targetAt(projection: Projection, index: number) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= projection.manifest.totalRows
    )
      throw new BudgetError('行号超出当前视图。');
    const segments = projection.segments;
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (segments[mid].start <= index) low = mid;
      else high = mid - 1;
    }
    const segment = segments[low];
    return {
      segment,
      target: {
        org: segment.org,
        subject: segment.subject,
        detail: index - segment.start - 1,
      },
    };
  }
  private record(
    mode: BudgetQuery['mode'],
    target: RecordTarget,
    values = this.values,
  ) {
    const source = baseRecord(target);
    const record = { ...source, children: undefined };
    for (let col = 2; col < COLUMNS.length; col += 1) {
      const patch = values.get(this.key(mode, source.id, col));
      if (patch) Object.assign(record, { [COLUMNS[col].field]: patch.value });
    }
    return record;
  }
  private rowAt(projection: Projection, index: number): BudgetRow {
    const { segment, target } = this.targetAt(projection, index);
    const { org, subject, detail } = target;
    const record = this.record(projection.query.mode, target);
    const formulas: Record<string, string> = {};
    COLUMNS.forEach((column, col) => {
      const formula = this.values.get(
        this.key(projection.query.mode, record.id, col),
      )?.formula;
      if (formula) formulas[column.id] = formula.text;
    });
    return {
      ...record,
      id: `${org.id}::${record.id}`,
      sourceNodes: [record],
      rowDimension: {
        [DIM.organization]: org.memberCode,
        [DIM.subject]: record.memberCode,
      },
      productId: org.id,
      productParentId: org.parent,
      productAncestorIds: org.ancestors,
      productLabel: org.name,
      productDepth: segment.depth,
      productIsGroup: Boolean(org.children.length),
      productExpanded: isExpanded(projection.query.organizations, org.id),
      productBlockStart: index === segment.blockStart,
      productRowSpan: segment.blockCount,
      regionId: record.id,
      regionRootId: subjectKey(org, subject),
      regionBusinessId: record.id,
      regionRootLabel: subject.name,
      regionLabel: record.name,
      regionDepth: detail < 0 ? 0 : 1,
      regionIsGroup: detail < 0 && subject.detailCount > 0,
      regionExpanded: isExpanded(
        projection.query.subjects,
        subjectKey(org, subject),
      ),
      index,
      blockStart: segment.blockStart,
      formulas,
    };
  }
  page(id: string, offset: number) {
    const projection = this.projection(id);
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > projection.manifest.totalRows
    )
      throw new BudgetError('无效的分页偏移。');
    const count = Math.min(PAGE_SIZE, projection.manifest.totalRows - offset);
    return {
      projectionId: id,
      offset,
      rows: Array.from({ length: count }, (_, index) =>
        this.rowAt(projection, offset + index),
      ),
    };
  }
  position(id: string, recordId: string) {
    const projection = this.projection(id);
    const target = findRecord(projection.query.mode, recordId);
    if (!target) return -1;
    const segment = projection.segments.find(
      (item) =>
        item.org.id === target.org.id && item.subject.id === target.subject.id,
    );
    const offset = target.detail + 1;
    return segment && offset < segment.count ? segment.start + offset : -1;
  }
  private match(target: RecordTarget, column: number): SearchMatch {
    const record = baseRecord(target);
    return {
      recordId: record.id,
      organizationId: target.org.id,
      subjectKey: subjectKey(target.org, target.subject),
      ancestors: target.org.ancestors,
      column,
      label: `${target.org.name} / ${record.name}`,
      rowDimension: {
        [DIM.organization]: target.org.memberCode,
        [DIM.subject]: record.memberCode,
      },
    };
  }
  search(mode: BudgetQuery['mode'], query: string, index: number) {
    const text = query.trim().toLocaleLowerCase();
    if (!text || text.length > 200) return { total: 0, index: 0, match: null };
    const key = `${mode}:${this.revision}:${text}`;
    if (this.searchCache?.key !== key) {
      const buckets: SearchBucket[] = [];
      let total = 0;
      const numericQuery = /[0-9]/.test(text);
      for (const org of orgsFor(mode).values()) {
        const organizationMatches = org.name.toLocaleLowerCase().includes(text);
        for (const subject of org.subjects) {
          for (let detail = -1; detail < subject.detailCount; detail += 1) {
            const target = { org, subject, detail };
            const record = this.record(mode, target);
            const columns: number[] = [];
            if (
              organizationMatches &&
              subject === org.subjects[0] &&
              detail === -1
            )
              columns.push(0);
            if (record.name.toLocaleLowerCase().includes(text)) columns.push(1);
            if (record.functionalAttribute.toLocaleLowerCase().includes(text))
              columns.push(2);
            if (numericQuery)
              BUDGET_VALUE_FIELDS.forEach((field, offset) => {
                if (
                  String(record[field]).includes(text) ||
                  SEARCH_NUMBER_FORMAT.format(record[field]).includes(text)
                )
                  columns.push(offset + 3);
              });
            if (columns.length) {
              total += columns.length;
              buckets.push({ target, columns, end: total });
            }
          }
        }
      }
      // One compact bucket per matching record; do not allocate a full business payload per cell.
      this.searchCache = { key, buckets, total };
    }
    const { buckets, total } = this.searchCache;
    const selected = total
      ? (((Number.isFinite(index) ? Math.trunc(index) : 0) % total) + total) %
        total
      : 0;
    if (!total) return { total, index: selected, match: null };
    let low = 0;
    let high = buckets.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (buckets[mid].end <= selected) low = mid + 1;
      else high = mid;
    }
    const bucket = buckets[low];
    return {
      total,
      index: selected,
      match: this.match(
        bucket.target,
        bucket.columns[selected - (bucket.end - bucket.columns.length)],
      ),
    };
  }
  locate(mode: BudgetQuery['mode'], dimension: BusinessCellDimension) {
    if (!isBusinessCellDimension(dimension))
      throw new BudgetError('业务维度格式或成员编码不正确。');
    const col = getBusinessColumnIndex(dimension.column);
    const org = [...orgsFor(mode).values()].find(
      (item) => item.memberCode === dimension.row[DIM.organization],
    );
    if (!org) return null;
    for (const subject of org.subjects) {
      for (let detail = -1; detail < subject.detailCount; detail += 1) {
        const target = { org, subject, detail };
        if (baseRecord(target).memberCode === dimension.row[DIM.subject])
          return this.match(target, col);
      }
    }
    return null;
  }
  private evaluate(
    formula: Formula,
    mode: BudgetQuery['mode'],
    staged: Map<string, StoredCell>,
    evaluating: Set<string>,
  ): number {
    let referenceCount = 0;
    const read = (
      row: number,
      col: number,
      sheet?: string,
    ): string | number => {
      referenceCount += 1;
      if (referenceCount > 200_000)
        throw new BudgetError('公式引用范围过大，请缩小到 20 万个单元格内。');
      if (sheet && sheet !== '费用预算表')
        throw new BudgetError(
          '当前工作簿只有“费用预算表”，无法引用其他工作表。',
        );
      if (col < 1 || col > COLUMNS.length)
        throw new BudgetError('公式引用的列不存在。');
      const { target } = this.targetAt(formula.projection, row - 1);
      const base = baseRecord(target);
      if (col === 1) return target.org.name;
      if (col === 2) return base.name;
      const key = this.key(mode, base.id, col - 1);
      if (evaluating.has(key)) throw new BudgetError('公式存在循环引用。');
      const stored = staged.get(key);
      if (stored?.formula) {
        evaluating.add(key);
        const value = this.evaluate(stored.formula, mode, staged, evaluating);
        evaluating.delete(key);
        stored.value = value;
        return value;
      }
      return (
        stored?.value ?? base[COLUMNS[col - 1].field as 'functionalAttribute']
      );
    };
    const parser = new FormulaParser({
      onCell: ({ row, col, sheet }) => read(row, col, sheet),
      onRange: ({ from, to, sheet }) => {
        const lastRow = Math.min(to.row, formula.projection.manifest.totalRows);
        const lastCol = Math.min(to.col, COLUMNS.length);
        if ((lastRow - from.row + 1) * (lastCol - from.col + 1) > 200_000)
          throw new BudgetError('公式引用范围过大。');
        return Array.from(
          { length: Math.max(0, lastRow - from.row + 1) },
          (_, r) =>
            Array.from(
              { length: Math.max(0, lastCol - from.col + 1) },
              (_, c) => read(from.row + r, from.col + c, sheet),
            ),
        );
      },
      // Keep user formulas deterministic and local to this budget dataset.
      functions: {
        WEBSERVICE: () => {
          throw new BudgetError('不支持公式发起外部网络请求。');
        },
      },
    });
    let result: unknown;
    try {
      result = parser.parse(formula.text.slice(1), {
        row: formula.row + 1,
        col: formula.col + 1,
        sheet: '费用预算表',
      });
    } catch (error) {
      throw new BudgetError(
        `公式无法计算：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return normalizeInput(result, formula.col) as number;
  }
  write(id: string, writes: CellWrite[], source: string): Transaction {
    const projection = this.projection(id);
    if (!Array.isArray(writes) || !writes.length || writes.length > MAX_BATCH)
      throw new BudgetError(`每次修改应包含 1 至 ${MAX_BATCH} 个单元格。`);
    const mode = projection.query.mode;
    const staged = new Map(
      [...this.values].map(([key, cell]) => [key, { ...cell }]),
    );
    const targets = new Map<string, { target: RecordTarget; col: number }>();
    for (const write of writes) {
      if (!write || typeof write.recordId !== 'string')
        throw new BudgetError('无效的修改目标。');
      const target = findRecord(mode, write.recordId);
      if (
        !target ||
        !Number.isInteger(write.col) ||
        !COLUMNS[write.col]?.editable
      )
        throw new BudgetError('修改目标不存在或为只读单元格。');
      const key = this.key(mode, write.recordId, write.col);
      if (targets.has(key)) throw new BudgetError('同一事务包含重复单元格。');
      const before = this.record(mode, target)[
        COLUMNS[write.col].field as 'functionalAttribute'
      ];
      if (write.expected !== undefined && write.expected !== before)
        throw new BudgetError('数据已被其他操作修改，请刷新后重试。', 409);
      const formulaText =
        typeof write.input === 'string' &&
        write.input.trim().startsWith('=') &&
        write.col >= 3
          ? write.input.trim()
          : '';
      if (formulaText.length > 4000)
        throw new BudgetError('公式长度不能超过 4000 字符。');
      const row = this.position(id, write.recordId);
      if (row < 0) throw new BudgetError('该记录不在当前视图，请重新选择。');
      staged.set(
        key,
        formulaText
          ? {
              value: 0,
              formula: { text: formulaText, projection, row, col: write.col },
            }
          : { value: normalizeInput(write.input, write.col) },
      );
      targets.set(key, { target, col: write.col });
    }
    // Recompute only cells with explicit formulas. Backend totals never implicitly aggregate.
    for (const [key, cell] of staged) {
      if (!key.startsWith(`${mode}/`) || !cell.formula) continue;
      cell.value = this.evaluate(cell.formula, mode, staged, new Set([key]));
      if (!targets.has(key)) {
        const { target } = this.targetAt(
          cell.formula.projection,
          cell.formula.row,
        );
        targets.set(key, { target, col: cell.formula.col });
      }
    }
    const patches: CellPatch[] = [];
    const beforeStates = new Map<string, StoredCell | undefined>();
    const afterStates = new Map<string, StoredCell | undefined>();
    for (const [key, { target, col }] of targets) {
      const record = this.record(mode, target);
      const before = record[COLUMNS[col].field as 'functionalAttribute'];
      const next = staged.get(key)!;
      const previous = this.values.get(key);
      if (
        before === next.value &&
        (previous?.formula?.text ?? '') === (next.formula?.text ?? '')
      )
        continue;
      const row = this.rowForTarget(target, mode);
      const editTarget = toBusinessCellEditTarget(row, col)!;
      patches.push({
        recordId: record.id,
        col,
        before,
        after: next.value,
        beforeFormula: previous?.formula?.text ?? '',
        afterFormula: next.formula?.text ?? '',
        payload: createBusinessCellChangePayload(
          editTarget,
          before,
          next.value,
        ),
      });
      beforeStates.set(key, previous);
      afterStates.set(key, next);
    }
    this.values = staged;
    this.revision += 1;
    const transaction = {
      id: randomUUID(),
      source: source.slice(0, 40),
      createdAt: Date.now(),
      patches,
    };
    if (patches.length)
      this.history.set(transaction.id, {
        patches,
        before: beforeStates,
        after: afterStates,
        mode,
      });
    if (this.history.size > 100)
      this.history.delete(this.history.keys().next().value!);
    return transaction;
  }
  private rowForTarget(
    target: RecordTarget,
    mode: BudgetQuery['mode'],
  ): BudgetRow {
    const record = this.record(mode, target);
    const { org, subject, detail } = target;
    return {
      ...record,
      rowDimension: {
        [DIM.organization]: org.memberCode,
        [DIM.subject]: record.memberCode,
      },
      sourceNodes: [record],
      productId: org.id,
      productParentId: org.parent,
      productAncestorIds: org.ancestors,
      productLabel: org.name,
      productDepth: org.ancestors.length,
      productIsGroup: Boolean(org.children.length),
      productExpanded: true,
      productBlockStart: false,
      productRowSpan: 1,
      regionId: record.id,
      regionRootId: subjectKey(org, subject),
      regionBusinessId: record.id,
      regionRootLabel: subject.name,
      regionLabel: record.name,
      regionDepth: detail < 0 ? 0 : 1,
      regionIsGroup: detail < 0 && subject.detailCount > 0,
      regionExpanded: true,
      index: -1,
      blockStart: -1,
      formulas: {},
    };
  }
  replay(
    mode: BudgetQuery['mode'],
    transaction: Transaction,
    direction: 'undo' | 'redo',
  ): Transaction {
    if (!transaction || typeof transaction.id !== 'string')
      throw new BudgetError('无效的历史操作。');
    const stored = this.history.get(transaction.id);
    if (!stored || stored.mode !== mode)
      throw new BudgetError('该操作已过期，无法撤销或重做。', 410);
    const expected = direction === 'undo' ? stored.after : stored.before;
    const desired = direction === 'undo' ? stored.before : stored.after;
    for (const [key, cell] of expected) {
      const current = this.values.get(key);
      if (
        current?.value !== cell?.value ||
        current?.formula?.text !== cell?.formula?.text
      )
        throw new BudgetError('数据已更新，无法覆盖新的修改。', 409);
    }
    desired.forEach((cell, key) =>
      cell ? this.values.set(key, { ...cell }) : this.values.delete(key),
    );
    this.revision += 1;
    return {
      id: randomUUID(),
      source: direction === 'undo' ? '撤销' : '重做',
      createdAt: Date.now(),
      patches: stored.patches.map((patch) =>
        direction === 'redo'
          ? patch
          : {
              ...patch,
              before: patch.after,
              after: patch.before,
              beforeFormula: patch.afterFormula,
              afterFormula: patch.beforeFormula,
              payload: {
                ...patch.payload,
                oldValue: patch.after,
                newValue: patch.before,
              },
            },
      ),
    };
  }
  private checkedRange(id: string, range: CellRange, columns: number[]) {
    const projection = this.projection(id);
    if (!range?.anchor || !range.focus || !Array.isArray(columns))
      throw new BudgetError('无效的选区。');
    const box = bounds(range);
    if (
      Object.values(box).some(
        (value) => !Number.isInteger(value) || value < 0,
      ) ||
      box.bottom >= projection.manifest.totalRows ||
      box.right >= COLUMNS.length ||
      columns.some(
        (col) => !Number.isInteger(col) || col < 0 || col >= COLUMNS.length,
      )
    )
      throw new BudgetError('选区超出数据范围。');
    return {
      projection,
      box,
      selectedColumns: [...new Set(columns)].filter(
        (col) => col >= box.left && col <= box.right,
      ),
    };
  }
  statistics(id: string, range: CellRange, columns: number[]): Statistics {
    const { projection, box, selectedColumns } = this.checkedRange(
      id,
      range,
      columns,
    );
    const stats: Statistics = {
      cells: (box.bottom - box.top + 1) * selectedColumns.length,
      numeric: 0,
      sum: 0,
      average: 0,
      min: Infinity,
      max: -Infinity,
      ignored: 0,
    };
    for (let index = box.top; index <= box.bottom; index += 1) {
      const { target } = this.targetAt(projection, index);
      const record = this.record(projection.query.mode, target);
      for (const col of selectedColumns) {
        const value = col > 2 ? record[COLUMNS[col].field as 'january'] : null;
        if (typeof value !== 'number') {
          stats.ignored += 1;
          continue;
        }
        stats.numeric += 1;
        stats.sum += value;
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
      }
    }
    stats.average = stats.numeric ? stats.sum / stats.numeric : 0;
    if (!stats.numeric) stats.min = stats.max = 0;
    return stats;
  }
  range(id: string, range: CellRange, columns: number[], offset: number) {
    const { projection, box } = this.checkedRange(id, range, columns);
    if (!Number.isInteger(offset) || offset < 0)
      throw new BudgetError('无效的选区分页。');
    const start = box.top + offset;
    const end = Math.min(box.bottom + 1, start + PAGE_SIZE);
    return {
      rows: Array.from({ length: Math.max(0, end - start) }, (_, index) =>
        this.rowAt(projection, start + index),
      ),
      nextOffset: end <= box.bottom ? end - box.top : null,
    };
  }
}
