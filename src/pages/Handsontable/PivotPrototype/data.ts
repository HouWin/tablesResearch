/**
 * 透视表 v8 —— 数据层（维度配置 / 树构建 / 属性 / 明细生成，纯数据与结构，无计算规则）
 *
 * 任务文档 docs/PivotPrototype.md（v8）：
 * - 行维度：组织（华润微电子集团 → 本部/华晶公司）、科目（费用汇总 → 办公费/电费/水费）
 * - 列：维度层 期间（Q1/Q2 → 月份，对称/非对称）+ 指标尾（预算数/实际数/完成率）
 * - 行 = 组织树节点 × 科目树节点 全交叉；值 = (组织叶, 科目叶, 期间月, 指标) 明细聚合
 *
 * 属性（方案 2，用户确认）：属性挂在"holder"上而非维度节点——
 * - 组织属性 holder = 组织节点 key（组织列按块合并，天然每组织一个）
 * - 科目属性 holder = `${组织节点key}|${科目节点key}`（科目树按组织块重复出现，
 *   每个 (组织,科目) 组合的属性独立，改一处不影响其他组织块）
 */

export type AttrFormat = 'none' | 'date' | 'text' | 'dropdown';
// 'none'：该 holder 无属性 —— 属性格为空且只读（如父级汇总节点）

export interface Attr {
  format: AttrFormat;
  value: string;
  options?: string[];
}

export interface DimNode {
  key: string; // 全路径 key：`org:华润微电子集团`、`period:Q1:1月`
  label: string;
  depth: number; // 0 起
  children: DimNode[];
}

export interface TreeSpec {
  label: string;
  children?: TreeSpec[];
}

export interface DimConfig {
  key: string;
  label: string;
  tree: TreeSpec[];
}

// —— 行维度配置 ——
export const ORG_ATTR_OPTIONS = ['一级责任单位', '二级责任单位', '项目单位'];

export const ROW_DIMS: DimConfig[] = [
  {
    key: 'org',
    label: '组织',
    tree: [
      {
        label: '华润微电子集团',
        children: [{ label: '华润微电子本部' }, { label: '华晶公司' }],
      },
    ],
  },
  {
    key: 'acc',
    label: '科目',
    tree: [
      {
        label: '费用汇总',
        children: [{ label: '费用-办公费' }, { label: '费用-电费' }, { label: '费用-水费' }],
      },
    ],
  },
];

// —— 列：期间维度层（对称/非对称）+ 指标尾 ——
export type PeriodStructure = 'sym' | 'asym';

/** 各季度覆盖的月份（非对称示例：Q1→1、2月，Q2→2、3月；不同 Q 的同名月份是独立节点） */
export const PERIOD_STRUCTURES: Record<PeriodStructure, Record<string, number[]>> = {
  sym: { Q1: [1, 2, 3], Q2: [1, 2, 3] },
  asym: { Q1: [1, 2], Q2: [2, 3] },
};

export const PERIOD_DIM_KEY = 'period';
export const PERIOD_DIM_LABEL = '期间';
export const METRICS = ['预算数', '实际数', '完成率'];

// —— 树构建（通用：按 TreeSpec 递归，key = 维度key:标签路径） ——
function buildNodes(specs: TreeSpec[], dimKey: string, parentKey: string, depth: number): DimNode[] {
  return specs.map(spec => {
    const key = parentKey ? `${parentKey}:${spec.label}` : `${dimKey}:${spec.label}`;
    const node: DimNode = { key, label: spec.label, depth, children: [] };
    node.children = spec.children ? buildNodes(spec.children, dimKey, key, depth + 1) : [];
    return node;
  });
}

/** 行维度树（组织/科目各一棵） */
export function buildRowDimTree(cfg: DimConfig): DimNode[] {
  return buildNodes(cfg.tree, cfg.key, '', 0);
}

/** 列维度期间树：Q 为深度 0，月份为深度 1 */
export function buildPeriodTree(structure: PeriodStructure): DimNode[] {
  const qs: DimNode[] = [];
  const spec: Record<string, number[]> = PERIOD_STRUCTURES[structure];
  for (const [qLabel, months] of Object.entries(spec)) {
    const qKey = `${PERIOD_DIM_KEY}:${qLabel}`;
    const qNode: DimNode = { key: qKey, label: qLabel, depth: 0, children: [] };
    qNode.children = months.map(n => {
      const label = `${n}月`;
      return { key: `${qKey}:${label}`, label, depth: 1, children: [] };
    });
    qs.push(qNode);
  }
  return qs;
}

// —— 属性生成（holder → Attr） ——
/**
 * 组织属性：holder = 组织节点 key（dropdown，按层级给不同值）
 * 科目属性：holder = `${组织节点key}|${科目节点key}`（方案 2）
 *   - 科目父节点（费用汇总）：none（空 + 只读）
 *   - 科目叶子：date，值按 (组织顺序, 科目顺序) 区分，如
 *     集团→办公费 2024-01-01 / 本部→办公费 2024-04-01 / 华晶→办公费 2024-07-01
 */
export function generateAttrMap(orgTree: DimNode[], accTree: DimNode[]): Map<string, Attr> {
  const map = new Map<string, Attr>();
  const orgs = flattenNodes(orgTree);
  const accNodes = flattenNodes(accTree);
  for (const o of orgs) {
    map.set(o.key, {
      format: 'dropdown',
      options: ORG_ATTR_OPTIONS,
      value: ORG_ATTR_OPTIONS[Math.min(o.depth, ORG_ATTR_OPTIONS.length - 1)],
    });
  }
  orgs.forEach((o, oi) => {
    accNodes.forEach((a, ai) => {
      const holder = `${o.key}|${a.key}`;
      if (a.children.length === 0) {
        const month = ((oi * 3 + ai) % 12) + 1;
        map.set(holder, {
          format: 'date',
          value: `2024-${String(month).padStart(2, '0')}-01`,
        });
      } else {
        map.set(holder, { format: 'none', value: '' });
      }
    });
  });
  return map;
}

/** 先序遍历展平（含自身） */
export function flattenNodes(nodes: DimNode[]): DimNode[] {
  const out: DimNode[] = [];
  const walk = (ns: DimNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** 叶子节点（无子级） */
export function leafNodes(nodes: DimNode[]): DimNode[] {
  return flattenNodes(nodes).filter(n => n.children.length === 0);
}

/** 构建 节点key → 根路径key数组 */
export function buildPathMap(nodes: DimNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const walk = (ns: DimNode[], path: string[]) => {
    for (const n of ns) {
      const p = [...path, n.key];
      map.set(n.key, p);
      walk(n.children, p);
    }
  };
  walk(nodes, []);
  return map;
}

// —— 明细（源数据）：(组织叶, 科目叶, 期间月, 指标) → amount ——
export interface SourceRecord {
  orgKey: string; // 组织叶子节点 key
  accKey: string; // 科目叶子节点 key
  periodKey: string; // 期间月叶子节点 key（如 period:Q1:1月）
  metric: string; // 指标
  amount: number;
}

/** 确定性 PRNG（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成明细：组织叶 × 科目叶 × 期间月 × 指标，金额确定性随机 60~420 */
export function generateRecords(
  orgTree: DimNode[],
  accTree: DimNode[],
  periodTree: DimNode[],
  metrics: string[],
  seed = 20260801,
): SourceRecord[] {
  const rnd = mulberry32(seed);
  const orgLeaves = leafNodes(orgTree);
  const accLeaves = leafNodes(accTree);
  const months = flattenNodes(periodTree).filter(n => n.depth === 1);
  const records: SourceRecord[] = [];
  for (const org of orgLeaves) {
    for (const acc of accLeaves) {
      for (const month of months) {
        for (const metric of metrics) {
          records.push({
            orgKey: org.key,
            accKey: acc.key,
            periodKey: month.key,
            metric,
            amount: Math.floor(rnd() * 361) + 60,
          });
        }
      }
    }
  }
  return records;
}

/** 节点子树成员判定：leafKey 属于 nodeKey 子树（key 为全路径前缀） */
export function inSubtree(leafKey: string, nodeKey: string): boolean {
  return leafKey === nodeKey || leafKey.startsWith(`${nodeKey}:`);
}

/** 从列 key（periodNodeKey:指标）拆出期间节点 key 与指标 */
export function splitColKey(colKey: string, metrics: string[]): { periodKey: string; metric: string } | null {
  for (const m of metrics) {
    const suffix = `:${m}`;
    if (colKey.endsWith(suffix)) {
      return { periodKey: colKey.slice(0, -suffix.length), metric: m };
    }
  }
  return null;
}
