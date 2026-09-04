/**
 * 透视表 v8 —— 渲染模型（纯结构逻辑，零计算规则）
 *
 * 行 = 组织树节点 × 科目树节点 全交叉（父节点常驻）；
 * 列 = 期间树（Q/月，仅 Q 可折叠，方案 a：折叠后出各指标聚合列）+ 指标尾（永不折叠）。
 * 值一律查 matrix（后端算好）；折叠/展开只改"可见结构"，不请求后端。
 *
 * 任务文档 docs/PivotPrototype.md（v8）第 6 节。
 */
import type { Attr, DimNode } from './data';
import { METRICS, ROW_DIMS } from './data';

export type Matrix = Map<string, number>;

export interface DirtyEntry {
  rowKey: string; // 值格 = 行对 key；属性格 = 维度节点 key
  colKey: string; // 值格 = 列节点 key；属性格 = attr:{dimKey}
  oldValue: number | string | null;
  newValue: number | string;
}

/** 单元格展示规格：renderer 直接读取 */
export interface CellSpec {
  kind: 'dim' | 'attr' | 'value';
  text?: string;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  nodeKey?: string;
  value?: number | string | null;
}

export interface RowSlotMeta {
  pairKey: string; // org节点key|acc节点key
  orgNode: DimNode;
  accNode: DimNode;
  isLeafPair: boolean;
  cellSpecs: Record<number, CellSpec>;
}

export interface ColSlotMeta {
  colKey: string; // 期间节点key:指标
  label: string; // 展示名（聚合列带（合计））
  isAgg: boolean; // Q 折叠产生的指标聚合列
  periodNodeKey: string;
  metric: string;
}

export interface ColGroup {
  key: string; // Q 节点 key
  label: string;
  startCol: number;
  colCount: number;
  collapsed: boolean;
}

export interface RenderModel {
  rows: Array<Record<string, unknown>>;
  rowMeta: RowSlotMeta[];
  nestedHeaders: unknown[][];
  merges: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
  colSlots: ColSlotMeta[];
  colGroups: ColGroup[];
}

export interface RenderInput {
  orgTree: DimNode[];
  accTree: DimNode[];
  periodQs: DimNode[];
  matrix: Matrix;
  /** 属性 map：holder = 组织节点key（组织属性）或 `${组织key}|${科目key}`（科目属性，方案 2） */
  attrMap: Map<string, Attr>;
  collapsedOrg: Set<string>;
  /** 科目折叠为"组织块局部"：key = `${org节点key}|${acc节点key}`（方案 1） */
  collapsedAcc: Set<string>;
  collapsedQ: Set<string>;
  loadedOrgScopes: Set<string>;
  loadingOrgScopes: Set<string>;
  dirtyMap: Map<string, DirtyEntry>;
  onDemand: boolean;
}

export const rowAreaCols = ROW_DIMS.length * 2; // 组织|组织属性|科目|科目属性 = 4
export const headerRows = 3; // Q 层 / 月层 / 指标层（顶层表头 coords.row = -3）
const dimCol = (i: number) => i * 2;
const attrCol = (i: number) => i * 2 + 1;

/** 组织节点矩阵是否已加载（自身或任一祖先 scope 已加载） */
function isOrgLoaded(orgNode: DimNode, loaded: Set<string>): boolean {
  let key = orgNode.key;
  for (;;) {
    if (loaded.has(key)) return true;
    const idx = key.lastIndexOf(':');
    if (idx <= 0) break;
    key = key.slice(0, idx);
    if (!key.startsWith('org:')) break;
  }
  return false;
}

export function buildRenderModel(input: RenderInput): RenderModel {
  const { orgTree, accTree, periodQs, matrix, attrMap, collapsedOrg, collapsedAcc, collapsedQ, dirtyMap, onDemand } = input;
  const loaded = input.loadedOrgScopes;
  const loading = input.loadingOrgScopes;

  // —— 1+2. 可见行对：组织先序外循环 × 该组织块内的可见科目（先序；折叠节点保留自身、剪掉后代） ——
  // 科目折叠作用域 = (组织节点, 科目节点)：每个组织块的科目树独立折叠（方案 1）
  const visibleAccFor = (orgKey: string): DimNode[] => {
    const out: DimNode[] = [];
    const emitAcc = (node: DimNode) => {
      out.push(node);
      if (!collapsedAcc.has(`${orgKey}|${node.key}`)) node.children.forEach(emitAcc);
    };
    accTree.forEach(emitAcc);
    return out;
  };

  const rows: Array<Record<string, unknown>> = [];
  const rowMeta: RowSlotMeta[] = [];
  const orgBlockStart = new Map<string, number>(); // org key → 行块首行

  const pushRow = (orgNode: DimNode, accNode: DimNode) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < ROW_DIMS.length; i++) {
      row[`d${i}`] = '';
      row[`a${i}`] = '';
    }
    const start = rows.length;
    rows.push(row);
    rowMeta.push({
      pairKey: `${orgNode.key}|${accNode.key}`,
      orgNode,
      accNode,
      isLeafPair: orgNode.children.length === 0 && accNode.children.length === 0,
      cellSpecs: {},
    });
    if (!orgBlockStart.has(orgNode.key)) orgBlockStart.set(orgNode.key, start);
  };

  const orgBlockSpan = new Map<string, number>();
  const emitOrg = (orgNode: DimNode) => {
    const accs = visibleAccFor(orgNode.key);
    orgBlockSpan.set(orgNode.key, accs.length);
    for (const acc of accs) pushRow(orgNode, acc);
    if (!collapsedOrg.has(orgNode.key)) orgNode.children.forEach(emitOrg);
  };
  orgTree.forEach(emitOrg);

  // —— 3. 可见值列：Q 折叠 → 每指标一个聚合列；展开 → 月份 × 指标 ——
  const colSlots: ColSlotMeta[] = [];
  const colGroups: ColGroup[] = [];
  for (const q of periodQs) {
    const collapsed = collapsedQ.has(q.key);
    const colCount = collapsed ? METRICS.length : q.children.length * METRICS.length;
    colGroups.push({
      key: q.key,
      label: q.label,
      startCol: rowAreaCols + colSlots.length,
      colCount,
      collapsed,
    });
    if (collapsed) {
      for (const m of METRICS) {
        colSlots.push({
          colKey: `${q.key}:${m}`,
          label: `${m}（合计）`,
          isAgg: true,
          periodNodeKey: q.key,
          metric: m,
        });
      }
    } else {
      for (const month of q.children) {
        for (const m of METRICS) {
          colSlots.push({
            colKey: `${month.key}:${m}`,
            label: m,
            isAgg: false,
            periodNodeKey: month.key,
            metric: m,
          });
        }
      }
    }
  }

  // —— 4. 单元格规格 + 数据行填充 ——
  for (let i = 0; i < rows.length; i++) {
    const meta = rowMeta[i];
    const specs = meta.cellSpecs;
    const orgStart = orgBlockStart.get(meta.orgNode.key) ?? i;

    // 组织列/组织属性列：行块首行显示（其余行被合并覆盖）；属性 holder = 组织节点
    if (i === orgStart) {
      specs[dimCol(0)] = {
        kind: 'dim',
        text: meta.orgNode.label,
        depth: meta.orgNode.depth,
        hasChildren: meta.orgNode.children.length > 0,
        collapsed: collapsedOrg.has(meta.orgNode.key),
        nodeKey: meta.orgNode.key,
      };
      specs[attrCol(0)] = { kind: 'attr', text: attrMap.get(meta.orgNode.key)?.value ?? '' };
    }
    // 科目列/科目属性列：每行都是该科目的行（折叠状态 = 该组织块局部）；属性 holder = 组织|科目 组合
    specs[dimCol(1)] = {
      kind: 'dim',
      text: meta.accNode.label,
      depth: meta.accNode.depth,
      hasChildren: meta.accNode.children.length > 0,
      collapsed: collapsedAcc.has(`${meta.orgNode.key}|${meta.accNode.key}`),
      nodeKey: meta.accNode.key,
    };
    specs[attrCol(1)] = { kind: 'attr', text: attrMap.get(`${meta.orgNode.key}|${meta.accNode.key}`)?.value ?? '' };

    // 值列：脏覆盖 / 矩阵查表 / 按需占位
    for (let c = 0; c < colSlots.length; c++) {
      const slot = colSlots[c];
      const key = `${meta.pairKey}|${slot.colKey}`;
      const dirty = dirtyMap.get(key);
      let value: number | string | null;
      if (dirty) {
        value = dirty.newValue;
      } else if (matrix.has(key)) {
        value = matrix.get(key) ?? 0;
      } else if (onDemand && !isOrgLoaded(meta.orgNode, loaded) && !loading.has(meta.orgNode.key)) {
        value = '…';
      } else {
        value = 0;
      }
      specs[rowAreaCols + c] = { kind: 'value', value };
    }

    // 填充数据行
    const row = rows[i];
    for (let k = 0; k < ROW_DIMS.length; k++) {
      row[`d${k}`] = specs[dimCol(k)]?.text ?? '';
      row[`a${k}`] = specs[attrCol(k)]?.text ?? '';
    }
    for (let c = 0; c < colSlots.length; c++) {
      row[colSlots[c].colKey] = specs[rowAreaCols + c].value;
    }
  }

  // —— 5. 合并区间：组织列 + 组织属性列（行块镜像） ——
  const merges: Array<{ row: number; col: number; rowspan: number; colspan: number }> = [];
  for (const [orgKey, start] of orgBlockStart) {
    const span = orgBlockSpan.get(orgKey) ?? 1;
    if (span > 1) {
      merges.push({ row: start, col: dimCol(0), rowspan: span, colspan: 1 });
      merges.push({ row: start, col: attrCol(0), rowspan: span, colspan: 1 });
    }
  }

  // —— 6. 表头（3 层：Q / 月 / 指标） ——
  const r0: unknown[] = [];
  const r1: unknown[] = [];
  const r2: unknown[] = [];
  for (let k = 0; k < ROW_DIMS.length; k++) {
    r0.push(ROW_DIMS[k].label);
    r1.push('');
    r2.push('');
    r0.push(`${ROW_DIMS[k].label}属性`);
    r1.push('');
    r2.push('');
  }
  for (const q of periodQs) {
    const collapsed = collapsedQ.has(q.key);
    if (collapsed) {
      r0.push({ label: `${q.label} ▸`, colspan: METRICS.length, headerClassName: 'ht-col-group-header' });
      for (let k = 0; k < METRICS.length; k++) r1.push('');
      for (const m of METRICS) r2.push(`${m}（合计）`);
    } else {
      r0.push({
        label: `${q.label} ▾`,
        colspan: q.children.length * METRICS.length,
        headerClassName: 'ht-col-group-header',
      });
      for (const month of q.children) {
        r1.push({ label: month.label, colspan: METRICS.length });
      }
      for (const month of q.children) {
        for (const m of METRICS) r2.push(m);
      }
    }
  }

  return {
    rows,
    rowMeta,
    nestedHeaders: [r0, r1, r2],
    merges,
    colSlots,
    colGroups,
  };
}
