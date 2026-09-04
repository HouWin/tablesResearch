/**
 * 透视表 v8 —— 模拟后端（可替换为真实 HTTP）
 *
 * 职责：四元明细（组织叶×科目叶×期间月×指标）聚合、按指标规则引擎、
 * 回写分摊（按比例/平均 + 最大余数取整）、增量重算受影响闭包、审计历史、
 * 延迟、版本冲突、期间结构切换（对称/非对称）。前端零计算。
 *
 * 矩阵 key：行 = 行对 `org节点key|acc节点key`；列 = `期间节点key:指标`
 * （如 period:Q1:1月:预算数；Q 折叠聚合列 = period:Q1:预算数）。
 * 明细 key：`org叶key|acc叶key|period月key|指标`。
 */
import {
  buildPeriodTree,
  buildRowDimTree,
  flattenNodes,
  generateAttrMap,
  generateRecords,
  inSubtree,
  leafNodes,
  METRICS,
  ROW_DIMS,
  splitColKey,
  type Attr,
  type DimNode,
  type PeriodStructure,
  type SourceRecord,
} from './data';

export type Rule = 'sum' | 'weighted';
export type AllocationStrategy = 'ratio' | 'equal';

export interface EditPayload {
  kind: 'value' | 'attr';
  row: { key: string; path: string[] }; // key = 行对 key
  col: { key: string; path: string[] }; // 值列 key 或 attr:org / attr:acc
  oldValue: number | string | null;
  newValue: number | string;
}

export interface SaveDelta {
  version: number;
  changedCells: Array<[string, string, number]>; // [行对key, 列key, value]
  changedLeaves: Array<[string, string, number]>; // [明细key, 明细key, amount]
  structureChanged?: boolean;
}

export class ConflictError extends Error {
  readonly currentVersion: number;
  constructor(currentVersion: number) {
    super(`数据已被他人修改（当前版本 ${currentVersion}），已重新加载最新数据`);
    this.currentVersion = currentVersion;
  }
}

export interface CellHistoryEntry {
  rowKey: string;
  colKey: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  operator: string;
  timestamp: number;
  type: 'manual' | 'allocated';
  affectedLeaves: number;
  version: number;
}

const OPERATORS = ['张伟', '李娜', '王强', '刘洋'];
const LATENCY_MS = 300;

// 加权演示权重（按指标）；加权规则 = Σ(amount×w)/Σw（单指标格内退化为均值，演示"前端与规则无关"）
const METRIC_WEIGHTS: Record<string, number> = { 预算数: 1.2, 实际数: 1.0, 完成率: 0.8 };

/**
 * 最大余数法取整：保证 Σ 结果 === total（精确）
 */
function largestRemainder(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const base = Math.floor(total / n);
    const rem = total - base * n;
    return weights.map((_, i) => base + (i < rem ? 1 : 0));
  }
  const raw = weights.map(w => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) out[order[k % order.length].i] += 1;
  return out;
}

class MockApi {
  private records: SourceRecord[] = [];
  private orgTree: DimNode[] = [];
  private accTree: DimNode[] = [];
  private periodTree: DimNode[] = [];
  private orgByKey = new Map<string, DimNode>();
  private accByKey = new Map<string, DimNode>();
  private periodByKey = new Map<string, DimNode>();
  /** 属性 map（方案 2）：holder = 组织节点key（组织属性）或 `${组织key}|${科目key}`（科目属性） */
  private attrMap = new Map<string, Attr>();
  private history: CellHistoryEntry[] = [];
  version = 1;
  rule: Rule = 'sum';
  allocation: AllocationStrategy = 'ratio';
  structure: PeriodStructure = 'sym';

  init(structure: PeriodStructure = 'sym'): void {
    this.structure = structure;
    this.rebuildWorld();
  }

  /** 重建树/属性/明细（结构切换 / 初始化共用） */
  private rebuildWorld(): void {
    this.orgTree = buildRowDimTree(ROW_DIMS[0]); // org
    this.accTree = buildRowDimTree(ROW_DIMS[1]); // acc
    this.periodTree = buildPeriodTree(this.structure);
    this.records = generateRecords(this.orgTree, this.accTree, this.periodTree, METRICS);
    this.orgByKey = new Map(flattenNodes(this.orgTree).map(n => [n.key, n]));
    this.accByKey = new Map(flattenNodes(this.accTree).map(n => [n.key, n]));
    this.periodByKey = new Map(flattenNodes(this.periodTree).map(n => [n.key, n]));
    this.attrMap = generateAttrMap(this.orgTree, this.accTree);
  }

  private delay(): Promise<void> {
    return new Promise(res => setTimeout(res, LATENCY_MS));
  }

  private operator(): string {
    return OPERATORS[this.history.length % OPERATORS.length];
  }

  /** 单元格覆盖的明细集：(行对子树 ∩ 列期间子树) 且指标一致 */
  private leafSet(orgNodeKey: string, accNodeKey: string, periodNodeKey: string, metric: string): SourceRecord[] {
    return this.records.filter(
      r =>
        inSubtree(r.orgKey, orgNodeKey) &&
        inSubtree(r.accKey, accNodeKey) &&
        inSubtree(r.periodKey, periodNodeKey) &&
        r.metric === metric,
    );
  }

  /** 规则引擎：按指标计算 (行对 × 期间节点) 的聚合值 */
  private ruleValue(orgNodeKey: string, accNodeKey: string, periodNodeKey: string, metric: string): number {
    const ls = this.leafSet(orgNodeKey, accNodeKey, periodNodeKey, metric);
    if (ls.length === 0) return 0;
    if (this.rule === 'sum') return ls.reduce((a, r) => a + r.amount, 0);
    let num = 0;
    let den = 0;
    for (const r of ls) {
      const w = METRIC_WEIGHTS[r.metric] ?? 1;
      num += r.amount * w;
      den += w;
    }
    return Math.round(num / den);
  }

  /** 行对列表：全部 组织节点 × 科目节点（矩阵覆盖所有行对，折叠只影响展示） */
  private rowPairs(): Array<{ orgKey: string; accKey: string; pairKey: string }> {
    const pairs: Array<{ orgKey: string; accKey: string; pairKey: string }> = [];
    const orgs = flattenNodes(this.orgTree);
    const accs = flattenNodes(this.accTree);
    for (const org of orgs) {
      for (const acc of accs) {
        pairs.push({ orgKey: org.key, accKey: acc.key, pairKey: `${org.key}|${acc.key}` });
      }
    }
    return pairs;
  }

  /** 矩阵列节点：期间树全部节点（Q、月）× 指标（Q 折叠聚合列直接用 Q 级节点） */
  private colKeys(): Array<{ periodKey: string; metric: string; colKey: string }> {
    const out: Array<{ periodKey: string; metric: string; colKey: string }> = [];
    for (const pn of flattenNodes(this.periodTree)) {
      for (const m of METRICS) out.push({ periodKey: pn.key, metric: m, colKey: `${pn.key}:${m}` });
    }
    return out;
  }

  /** 按行对集合计算矩阵 */
  private matrixFor(pairs: Array<{ orgKey: string; accKey: string; pairKey: string }>): Array<[string, string, number]> {
    const cols = this.colKeys();
    const matrix: Array<[string, string, number]> = [];
    for (const p of pairs) {
      for (const c of cols) {
        matrix.push([p.pairKey, c.colKey, this.ruleValue(p.orgKey, p.accKey, c.periodKey, c.metric)]);
      }
    }
    return matrix;
  }

  /**
   * 加载数据。orgScope：'root'（或省略）= 顶层组织行对；组织节点 key = 该组织子树的行对（按需分块演示）。
   */
  async loadMatrix(req?: {
    orgScope?: string;
    colScope?: string;
  }): Promise<{
    records: SourceRecord[];
    matrix: Array<[string, string, number]>;
    version: number;
  }> {
    await this.delay();
    let pairs = this.rowPairs();
    if (req?.orgScope) {
      if (req.orgScope === 'root') {
        pairs = pairs.filter(p => p.orgKey === this.orgTree[0]?.key); // 顶层组织（集团）行对
      } else {
        pairs = pairs.filter(p => inSubtree(p.orgKey, req.orgScope!));
      }
    }
    return { records: this.records, matrix: this.matrixFor(pairs), version: this.version };
  }

  /**
   * 输出与真实后端一致的全量载荷（供 console 打印 / 对接后端同事核对契约）：
   * 1) 维度结构 rowDims（组织/科目树）+ colConfig（期间树 + 指标尾）
   * 2) 属性 attrs（holder → Attr；holder = 组织节点key 或 `${组织key}|${科目key}`）
   * 3) 明细 records（值源：组织叶×科目叶×期间月×指标）
   * 4) 聚合矩阵 matrix（行对 × 期间节点:指标，含 Q 级折叠聚合列）
   * 5) version（乐观锁）
   */
  dumpContract(): {
    rowDims: Array<{ key: string; label: string; nodes: unknown[] }>;
    colConfig: { periods: unknown[]; metrics: string[] };
    attrs: Record<string, Attr>;
    records: SourceRecord[];
    matrix: Array<[string, string, number]>;
    version: number;
  } {
    const serializeNodes = (nodes: DimNode[]): unknown[] =>
      nodes.map(n => ({ key: n.key, label: n.label, children: serializeNodes(n.children) }));
    return {
      rowDims: ROW_DIMS.map((d, i) => ({
        key: d.key,
        label: d.label,
        nodes: serializeNodes(i === 0 ? this.orgTree : this.accTree),
      })),
      colConfig: {
        periods: serializeNodes(this.periodTree),
        metrics: METRICS,
      },
      attrs: Object.fromEntries(this.attrMap),
      records: this.records,
      matrix: this.matrixFor(this.rowPairs()),
      version: this.version,
    };
  }

  /** 保存：批量提交 → 分摊 → 增量重算受影响闭包 → 写历史 → 返回 delta */
  async save(req: { changes: EditPayload[]; version: number }): Promise<SaveDelta> {
    await this.delay();
    if (req.version !== this.version) throw new ConflictError(this.version);
    const newVersion = this.version + 1;
    const ts = Date.now();
    const op = this.operator();

    // 1. 受影响矩阵格闭包：每个受影响明细的 (组织祖先 × 科目祖先 × 期间祖先) × 指标
    //    每个编辑格产生的闭包格统一标记该格的类型（manual/allocated）
    const affected = new Map<string, [string, string]>();
    const typeOf = new Map<string, 'manual' | 'allocated'>();
    const orgAll = flattenNodes(this.orgTree);
    const accAll = flattenNodes(this.accTree);
    const periodAll = flattenNodes(this.periodTree);

    const addCell = (orgKey: string, accKey: string, periodKey: string, metric: string, type: 'manual' | 'allocated') => {
      const key = `${orgKey}|${accKey}|${periodKey}:${metric}`;
      affected.set(key, [`${orgKey}|${accKey}`, `${periodKey}:${metric}`]);
      typeOf.set(key, type);
    };

    for (const ch of req.changes) {
      if (ch.kind !== 'value') continue;
      const split = ch.row.key.split('|');
      const orgNodeKey = split[0];
      const accNodeKey = split[1];
      const col = splitColKey(ch.col.key, METRICS);
      if (!orgNodeKey || !accNodeKey || !col) continue;
      const leafSet = this.leafSet(orgNodeKey, accNodeKey, col.periodKey, col.metric);
      if (leafSet.length === 0) continue; // 空集在步骤 3 抛错
      const type: 'manual' | 'allocated' = leafSet.length <= 1 ? 'manual' : 'allocated';
      for (const r of leafSet) {
        const orgAnc = orgAll.filter(n => inSubtree(r.orgKey, n.key));
        const accAnc = accAll.filter(n => inSubtree(r.accKey, n.key));
        const periodAnc = periodAll.filter(n => inSubtree(r.periodKey, n.key));
        for (const o of orgAnc) {
          for (const a of accAnc) {
            for (const p of periodAnc) {
              addCell(o.key, a.key, p.key, r.metric, type);
            }
          }
        }
      }
    }

    // 2. 快照旧值
    const oldValues = new Map<string, number>();
    for (const [key, [rowKey, colKey]] of affected) {
      const [ok, ak] = rowKey.split('|');
      const col = splitColKey(colKey, METRICS)!;
      oldValues.set(key, this.ruleValue(ok!, ak!, col.periodKey, col.metric));
    }

    // 3. 应用变更（属性直改 / 叶子直改 / 聚合格分摊）
    const changedLeaves: Array<[string, string, number]> = [];
    for (const ch of req.changes) {
      if (ch.kind === 'attr') {
        // attr 载荷：row.key = 属性 holder（组织节点 key 或 `${组织key}|${科目key}`）
        const holder = ch.row.key;
        const existing = this.attrMap.get(holder);
        this.attrMap.set(holder, {
          ...(existing ?? { format: 'text' as const, value: '' }),
          value: String(ch.newValue),
        });
        this.history.push({
          rowKey: holder,
          colKey: ch.col.key,
          oldValue: ch.oldValue,
          newValue: ch.newValue,
          operator: op,
          timestamp: ts,
          type: 'manual',
          affectedLeaves: 1,
          version: newVersion,
        });
        continue;
      }
      const split = ch.row.key.split('|');
      const orgNodeKey = split[0];
      const accNodeKey = split[1];
      const col = splitColKey(ch.col.key, METRICS);
      if (!orgNodeKey || !accNodeKey || !col) continue;
      const leafSet = this.leafSet(orgNodeKey, accNodeKey, col.periodKey, col.metric);
      if (leafSet.length === 0) {
        throw new Error(`单元格（${ch.row.key} × ${ch.col.key}）无对应明细数据，无法编辑`);
      }
      const N = Number(ch.newValue);
      if (!Number.isFinite(N) || N < 0) throw new Error('非法数值，仅支持非负数字');
      const oldSum = leafSet.reduce((a, r) => a + r.amount, 0);
      const newValues =
        leafSet.length === 1
          ? [N]
          : this.allocation === 'ratio' && oldSum > 0
            ? largestRemainder(leafSet.map(r => r.amount), N)
            : largestRemainder(leafSet.map(() => 1), N);
      leafSet.forEach((r, i) => {
        const nv = newValues[i];
        if (r.amount !== nv) {
          r.amount = nv;
          const leafKey = `${r.orgKey}|${r.accKey}|${r.periodKey}|${r.metric}`;
          changedLeaves.push([leafKey, leafKey, nv]);
        }
      });
    }

    // 4. 增量重算受影响格 + 写历史（只返回值真正变化的格）
    const changedCells: Array<[string, string, number]> = [];
    for (const [key, [rowKey, colKey]] of affected) {
      const [ok, ak] = rowKey.split('|');
      const col = splitColKey(colKey, METRICS)!;
      const v = this.ruleValue(ok!, ak!, col.periodKey, col.metric);
      const old = oldValues.get(key);
      if (old !== v) {
        changedCells.push([rowKey, colKey, v]);
        this.history.push({
          rowKey,
          colKey,
          oldValue: old ?? null,
          newValue: v,
          operator: op,
          timestamp: ts,
          type: typeOf.get(key) ?? 'manual',
          affectedLeaves: this.leafSet(ok!, ak!, col.periodKey, col.metric).length,
          version: newVersion,
        });
      }
    }

    this.version = newVersion;
    return { version: newVersion, changedCells, changedLeaves };
  }

  /** 单元格历史查询（倒序） */
  async getCellHistory(rowKey: string, colKey: string): Promise<CellHistoryEntry[]> {
    await this.delay();
    return this.history
      .filter(h => h.rowKey === rowKey && h.colKey === colKey)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /** demo 辅助：切换期间结构（对称/非对称），重建树与明细并重置版本基线由前端全量重拉 */
  setPeriodStructure(s: PeriodStructure): void {
    this.structure = s;
    this.rebuildWorld();
    this.version += 1;
  }

  /** demo 辅助：切换计算规则（下次保存生效） */
  setRule(rule: Rule): void {
    this.rule = rule;
  }

  /** demo 辅助：切换分摊策略（下次保存生效） */
  setAllocationStrategy(s: AllocationStrategy): void {
    this.allocation = s;
  }

  /** demo 辅助：模拟他人修改 */
  simulateConflict(): void {
    this.version += 1;
  }

  /** demo 数据辅助：叶子节点信息（供页面说明卡展示） */
  stats(): { orgLeaves: number; accLeaves: number; months: number; records: number } {
    return {
      orgLeaves: leafNodes(this.orgTree).length,
      accLeaves: leafNodes(this.accTree).length,
      months: flattenNodes(this.periodTree).filter(n => n.depth === 1).length,
      records: this.records.length,
    };
  }
}

export const mockApi = new MockApi();
