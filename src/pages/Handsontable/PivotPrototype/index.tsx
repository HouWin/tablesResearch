/**
 * 透视表 v8 —— 页面组装
 *
 * 结构：行 = 组织树 × 科目树 全交叉；列 = 期间树（Q/月）+ 指标尾。
 * 架构（沿用 v7 已验证决策）：
 * - 前端零计算：值一律查后端矩阵；数据命令式驱动（不走 props，避免
 *   updateSettings({data}) 整表 reload 死循环/性能坑）
 * - 编辑来源白名单 EDIT_SOURCES；脏标记方案 B（等值过滤 + 基准比较消脏）
 * - 保存制：脏收集 → 批量提交 → delta 打补丁；409 冲突全量重拉
 * - 折叠：组织/科目（行侧节点行）、Q（列维度层，方案 a 指标聚合列）；
 *   月份/指标层不可折叠
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import {
  Button,
  Card,
  Drawer,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  buildPathMap,
  buildPeriodTree,
  buildRowDimTree,
  flattenNodes,
  generateAttrMap,
  METRICS,
  ROW_DIMS,
  splitColKey,
  type Attr,
  type DimNode,
  type PeriodStructure,
} from './data';
import {
  buildRenderModel,
  headerRows,
  rowAreaCols,
  type ColSlotMeta,
  type RenderModel,
} from './renderModel';
import { attrRenderer, dimRenderer, shared, valueRenderer } from './renderers';
import {
  ConflictError,
  mockApi,
  type CellHistoryEntry,
  type EditPayload,
  type Rule,
} from './mockApi';
import './index.less';

registerAllModules();

const HOT_HEIGHT = 560;

// —— 真实编辑来源白名单（关键，防 reload 伪编辑与死循环，见 NOTES） ——
const EDIT_SOURCES = ['edit', 'Autofill.fill', 'paste'];
const SKIP_SOURCES = ['loadData', 'updateSettings'];

/** 由可见值列构建 Handsontable columns（行区 4 列 + 指标值列） */
function buildColumnConfig(colSlots: ColSlotMeta[]): { columns: any[]; colWidths: number[] } {
  const columns: any[] = [];
  const colWidths: number[] = [];
  for (let i = 0; i < ROW_DIMS.length; i++) {
    columns.push({ data: `d${i}`, readOnly: true, renderer: dimRenderer });
    colWidths.push(i === 0 ? 190 : 200);
    columns.push({ data: `a${i}`, renderer: attrRenderer });
    colWidths.push(150);
  }
  for (const s of colSlots) {
    columns.push({ data: s.colKey, renderer: valueRenderer });
    colWidths.push(100);
  }
  return { columns, colWidths };
}

export default function PivotPrototype() {
  const hotRef = useRef<any>(null);
  const orgTreeRef = useRef<DimNode[]>([]);
  const accTreeRef = useRef<DimNode[]>([]);
  const periodQsRef = useRef<DimNode[]>([]);
  const orgPathMapRef = useRef<Map<string, string[]>>(new Map());
  const attrMapRef = useRef<Map<string, Attr>>(new Map());
  const matrixRef = useRef<Map<string, number>>(new Map());
  const versionRef = useRef(1);
  const loadedOrgScopesRef = useRef<Set<string>>(new Set());
  const loadingOrgScopesRef = useRef<Set<string>>(new Set());
  const dirtyRef = useRef<Map<string, { rowKey: string; colKey: string; oldValue: number | string | null; newValue: number | string }>>(new Map());
  const collapsedOrgRef = useRef<Set<string>>(new Set());
  const collapsedAccRef = useRef<Set<string>>(new Set());
  const collapsedQRef = useRef<Set<string>>(new Set());
  const onDemandRef = useRef(false);
  const readyRef = useRef(false);
  const colGroupsRef = useRef<RenderModel['colGroups']>([]);
  const dataLoggedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [structure, setStructure] = useState<PeriodStructure>('sym');
  const [collapsedOrg, setCollapsedOrg] = useState<Set<string>>(new Set());
  const [collapsedAcc, setCollapsedAcc] = useState<Set<string>>(new Set());
  const [collapsedQ, setCollapsedQ] = useState<Set<string>>(new Set());
  const [onDemand, setOnDemand] = useState(false);
  const [rule, setRule] = useState<Rule>('sum');
  const [strategy, setStrategy] = useState<'ratio' | 'equal'>('ratio');
  const [saving, setSaving] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [history, setHistory] = useState<{ open: boolean; title: string; rows: CellHistoryEntry[] }>({
    open: false,
    title: '',
    rows: [],
  });

  // —— 树/属性/数据初始化（对称结构） ——
  const rebuildTrees = useCallback((s: PeriodStructure) => {
    orgTreeRef.current = buildRowDimTree(ROW_DIMS[0]);
    accTreeRef.current = buildRowDimTree(ROW_DIMS[1]);
    periodQsRef.current = buildPeriodTree(s);
    orgPathMapRef.current = buildPathMap(orgTreeRef.current);
    // 属性 map（方案 2）：组织属性 holder=组织节点；科目属性 holder=组织|科目
    attrMapRef.current = generateAttrMap(orgTreeRef.current, accTreeRef.current);
  }, []);

  // —— 编辑数据打印（载荷与保存一致） ——
  const logEditPayload = useCallback(
    (
      action: 'change' | 'revert',
      entry: { rowKey: string; colKey: string; oldValue: number | string | null; newValue: number | string | null },
    ) => {
      const isAttr = entry.colKey.startsWith('attr:');
      const rowPath = isAttr
        ? orgPathMapRef.current.get(entry.rowKey) ?? [entry.rowKey]
        : entry.rowKey.split('|');
      // eslint-disable-next-line no-console
      console.log('[pivot-edit]', {
        action,
        type: isAttr ? 'attr' : 'value',
        row: { key: entry.rowKey, path: rowPath },
        col: { key: entry.colKey, path: entry.colKey.split(':') },
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      });
    },
    [],
  );

  // —— 数据/结构打印（初始化一次） ——
  const logDataFormat = useCallback((m: RenderModel) => {
    if (dataLoggedRef.current) return;
    dataLoggedRef.current = true;
    const { columns } = buildColumnConfig(m.colSlots);
    // eslint-disable-next-line no-console
    console.log('[pivot-data] ==== 表格结构 ====');
    // eslint-disable-next-line no-console
    console.log('[pivot-data] 行维度：组织树', flattenNodes(orgTreeRef.current).map(n => n.key), '× 科目树', flattenNodes(accTreeRef.current).map(n => n.key));
    // eslint-disable-next-line no-console
    console.log('[pivot-data] 列：期间', periodQsRef.current.map(q => q.key), '× 指标', METRICS, '；全展开值列数 =', m.colSlots.length);
    // eslint-disable-next-line no-console
    console.log('[pivot-data] 矩阵条目数 =', matrixRef.current.size, '，示例：', [...matrixRef.current.entries()].slice(0, 6));
    // eslint-disable-next-line no-console
    console.log('[pivot-data] 行数据（前 2 行示例）：', m.rows.slice(0, 2));
    // eslint-disable-next-line no-console
    console.log('[pivot-data] columns（前 6 列示例）：', columns.slice(0, 6), '… 共', columns.length, '列');
    // eslint-disable-next-line no-console
    console.log('[pivot-data] nestedHeaders：', JSON.stringify(m.nestedHeaders));
    // eslint-disable-next-line no-console
    console.log('[pivot-data] mergeCells（前 6 个）：', m.merges.slice(0, 6), '共', m.merges.length, '个');
  }, []);

  // —— 后端契约 dump：打印与真实后端一致的全量载荷（元数据/属性/明细/矩阵/版本） ——
  const logBackendContract = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[pivot-backend] ==== 后端应返回的数据（契约：rowDims/colConfig/attrs/records/matrix/version）====');
    // eslint-disable-next-line no-console
    console.log('[pivot-backend]', mockApi.dumpContract());
  }, []);

  // —— 重建渲染模型（命令式驱动，不走 props） ——
  const rebuildFromRefs = useCallback(() => {
    if (!readyRef.current) return;
    const m = buildRenderModel({
      orgTree: orgTreeRef.current,
      accTree: accTreeRef.current,
      periodQs: periodQsRef.current,
      matrix: matrixRef.current,
      attrMap: attrMapRef.current,
      collapsedOrg: collapsedOrgRef.current,
      collapsedAcc: collapsedAccRef.current,
      collapsedQ: collapsedQRef.current,
      loadedOrgScopes: loadedOrgScopesRef.current,
      loadingOrgScopes: loadingOrgScopesRef.current,
      dirtyMap: dirtyRef.current,
      onDemand: onDemandRef.current,
    });
    shared.rowMeta = m.rowMeta;
    shared.colSlots = m.colSlots;
    shared.dirtyMap = dirtyRef.current;
    colGroupsRef.current = m.colGroups;
    logDataFormat(m);
    const hot = getHot();
    if (!hot) return;
    const { columns, colWidths } = buildColumnConfig(m.colSlots);
    // 顺序关键：
    // 1) 结构（columns/nestedHeaders）先于数据，保证 prop 映射正确；
    // 2) loadData 之后才应用 mergeCells —— mergeCells 插件会用"当前行/列数"
    //    做越界校验（validateSetting → isOutOfBounds），若在空表/旧行数上先应用，
    //    合并区间会被静默丢弃（首次 0 行时全部被丢）。
    hot.updateSettings({ columns, colWidths, nestedHeaders: m.nestedHeaders });
    hot.loadData(m.rows);
    hot.updateSettings({ mergeCells: m.merges });
  }, [logDataFormat]);

  const getHot = () => {
    const r = hotRef.current as any;
    return r?.hotInstance ?? r ?? null;
  };

  // —— 初始化：建树 + 全量加载 ——
  useEffect(() => {
    (async () => {
      rebuildTrees('sym');
      mockApi.init('sym');
      const res = await mockApi.loadMatrix({});
      matrixRef.current = new Map(res.matrix.map(([r, c, v]) => [`${r}|${c}`, v]));
      versionRef.current = res.version;
      loadedOrgScopesRef.current = new Set(flattenNodes(orgTreeRef.current).map(n => n.key));
      readyRef.current = true;
      setReady(true);
      logBackendContract(); // 初始加载后打印后端契约载荷
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 折叠/结构/按需变化 → 重建
  useEffect(() => {
    if (ready) rebuildFromRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, collapsedOrg, collapsedAcc, collapsedQ, onDemand, structure]);

  // —— 行节点折叠（组织/科目；纯前端查矩阵） ——
  const toggleOrg = (key: string) => {
    const next = new Set(collapsedOrgRef.current);
    const expanding = next.has(key);
    if (expanding) next.delete(key);
    else next.add(key);
    collapsedOrgRef.current = next;
    setCollapsedOrg(next);
    if (onDemandRef.current && expanding && !isOrgLoadedAny(key)) void loadChunk(key);
  };

  // —— 科目折叠（方案 1：按 (组织节点, 科目节点) 局部作用域，各组织块独立） ——
  const toggleAcc = (pairKey: string) => {
    const next = new Set(collapsedAccRef.current);
    if (next.has(pairKey)) next.delete(pairKey);
    else next.add(pairKey);
    collapsedAccRef.current = next;
    setCollapsedAcc(next);
  };

  // —— 列维度 Q 折叠（方案 a：出指标聚合列） ——
  const toggleQ = (key: string) => {
    if (!periodQsRef.current.some(q => q.key === key)) return; // 只允许 Q 层
    const next = new Set(collapsedQRef.current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedQRef.current = next;
    setCollapsedQ(next);
  };

  const isOrgLoadedAny = (orgKey: string) => {
    let key = orgKey;
    for (;;) {
      if (loadedOrgScopesRef.current.has(key)) return true;
      const idx = key.lastIndexOf(':');
      if (idx <= 0) return false;
      key = key.slice(0, idx);
      if (!key.startsWith('org:')) return false;
    }
  };

  // —— 按需分块加载：组织子树行对矩阵 ——
  const loadChunk = async (orgKey: string) => {
    if (loadingOrgScopesRef.current.has(orgKey) || isOrgLoadedAny(orgKey)) return;
    loadingOrgScopesRef.current.add(orgKey);
    rebuildFromRefs();
    try {
      const res = await mockApi.loadMatrix({ orgScope: orgKey });
      for (const [r, c, v] of res.matrix) matrixRef.current.set(`${r}|${c}`, v);
      // 标记该组织及所有后代已加载
      const node = flattenNodes(orgTreeRef.current).find(n => n.key === orgKey);
      const keys = node ? flattenNodes([node]).map(n => n.key) : [orgKey];
      for (const k of keys) loadedOrgScopesRef.current.add(k);
    } finally {
      loadingOrgScopesRef.current.delete(orgKey);
      rebuildFromRefs();
    }
  };

  // —— 点击：单元格图标折叠（组织/科目）、表头 Q 折叠 ——
  const afterOnCellMouseDown = useCallback((event: MouseEvent, coords: any) => {
    if (coords && coords.row >= 0 && coords.col >= 0) {
      const toggleEl = (event.target as HTMLElement).closest('.ht-tree-toggle');
      if (!toggleEl) return;
      const meta = shared.rowMeta[coords.row];
      const spec = meta?.cellSpecs?.[coords.col];
      if (spec?.kind !== 'dim' || !spec.nodeKey) return;
      if (coords.col === 0) toggleOrg(spec.nodeKey);
      else if (coords.col === 2) toggleAcc(`${meta.orgNode.key}|${spec.nodeKey}`); // 组织块局部折叠
      return;
    }
    // 表头：仅顶层（Q 层，row = -headerRows）可折叠
    if (coords && coords.row === -headerRows) {
      const g = colGroupsRef.current.find(
        gr => coords.col >= gr.startCol && coords.col < gr.startCol + gr.colCount,
      );
      if (g) toggleQ(g.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 逐格 meta：属性列按节点格式；值列可编辑；维度列只读 ——
  const cellsCallback = useCallback((row: number, col: number) => {
    const meta = shared.rowMeta[row];
    if (!meta) return {};
    if (col >= rowAreaCols) return {}; // 指标值列：全部可编辑
    if (col % 2 === 1) {
      const dimIndex = (col - 1) / 2;
      // holder：组织属性 = 组织节点 key；科目属性 = 组织|科目 组合（方案 2）
      const holder = dimIndex === 0 ? meta.orgNode.key : meta.pairKey;
      const a = attrMapRef.current.get(holder);
      if (!a || a.format === 'none') return { readOnly: true }; // 无属性 holder：空 + 只读
      // type 展开会覆盖 columns 的 renderer（脏角标消失），必须同层显式声明 renderer
      if (a.format === 'dropdown') {
        return { type: 'dropdown', source: a.options, allowInvalid: false, renderer: attrRenderer };
      }
      if (a.format === 'date') return { type: 'date', renderer: attrRenderer };
      return { type: 'text', renderer: attrRenderer };
    }
    return {};
  }, []);

  // —— 编辑拦截：维度列只读 / 值列非负数字 / 属性列放行 ——
  const beforeChange = useCallback((changes: any[], source: string) => {
    if (SKIP_SOURCES.includes(source) || !changes || changes.length === 0) return true;
    const result: any[] = [];
    for (const ch of changes) {
      const prop = ch[1] as string;
      if (/^d\d$/.test(prop)) return false; // 维度列（双保险）
      if (/^a\d$/.test(prop)) {
        result.push(ch);
        continue; // 属性列：下拉 allowInvalid 拦截、日期原生输入约束
      }
      const newV = ch[3];
      const n = typeof newV === 'number' ? newV : Number(newV);
      if (newV === '' || newV === null || !Number.isFinite(n) || n < 0) {
        message.warning('值单元格仅支持输入非负数字');
        return false;
      }
      ch[3] = n;
      result.push(ch);
    }
    return result;
  }, []);

  // —— 编辑收集：脏标记（方案 B）+ 本地模型同步 + [pivot-edit] 打印 ——
  const afterChange = useCallback((changes: any[], source: string) => {
    if (!EDIT_SOURCES.includes(source) || !changes || changes.length === 0) return;
    for (const ch of changes) {
      const row = ch[0] as number;
      const prop = ch[1] as string;
      const oldV = ch[2];
      const newV = ch[3];
      if (oldV === newV) continue; // 等值变更：不产生脏
      const meta = shared.rowMeta[row];
      if (!meta) continue;
      if (/^a\d$/.test(prop)) {
        const dimIndex = Number(prop.slice(1));
        // holder：组织属性 = 组织节点 key；科目属性 = 组织|科目 组合
        const holder = dimIndex === 0 ? meta.orgNode.key : meta.pairKey;
        const prevAttr = attrMapRef.current.get(holder);
        if (!prevAttr || prevAttr.format === 'none') continue; // 无属性 holder 不可编辑（双保险）
        attrMapRef.current.set(holder, { ...prevAttr, value: String(newV ?? '') });
        const colKey = `attr:${ROW_DIMS[dimIndex].key}`;
        const key = `${holder}|${colKey}`;
        const prev = dirtyRef.current.get(key);
        const original = prev?.oldValue ?? (oldV ?? null);
        if (original === newV) {
          dirtyRef.current.delete(key);
          logEditPayload('revert', { rowKey: holder, colKey, oldValue: prev?.newValue ?? oldV, newValue: original });
        } else {
          const entry = { rowKey: holder, colKey, oldValue: original, newValue: String(newV ?? '') };
          dirtyRef.current.set(key, entry);
          logEditPayload('change', entry);
        }
      } else {
        // 值列（prop = 列 key）
        const colKey = prop;
        const key = `${meta.pairKey}|${colKey}`;
        const prev = dirtyRef.current.get(key);
        const original = prev?.oldValue ?? (oldV ?? null);
        if (original === newV) {
          dirtyRef.current.delete(key);
          logEditPayload('revert', { rowKey: meta.pairKey, colKey, oldValue: prev?.newValue ?? oldV, newValue: original });
        } else {
          const entry = { rowKey: meta.pairKey, colKey, oldValue: original, newValue: newV };
          dirtyRef.current.set(key, entry);
          logEditPayload('change', entry);
        }
      }
    }
    setDirtyCount(dirtyRef.current.size);
    getHot()?.render(); // 重绘脏角标
  }, [logEditPayload]);

  // —— 保存：批量提交 → delta 打补丁 / 409 全量重拉 ——
  const handleSave = useCallback(async () => {
    if (dirtyRef.current.size === 0 || saving) return;
    setSaving(true);
    const changes: EditPayload[] = [...dirtyRef.current.values()].map(d => {
      const isAttr = d.colKey.startsWith('attr:');
      return {
        kind: isAttr ? 'attr' : 'value',
        row: {
          key: d.rowKey,
          path: isAttr
            ? orgPathMapRef.current.get(d.rowKey) ?? [d.rowKey]
            : d.rowKey.split('|'),
        },
        col: { key: d.colKey, path: d.colKey.split(':') },
        oldValue: d.oldValue,
        newValue: d.newValue,
      };
    });
    // eslint-disable-next-line no-console
    console.log('[pivot-save] 提交的全部更改：', changes);
    try {
      const delta = await mockApi.save({ changes, version: versionRef.current });
      // eslint-disable-next-line no-console
      console.log('[pivot-save] 保存成功，返回增量：', {
        version: delta.version,
        changedCells: delta.changedCells,
        changedLeaves: delta.changedLeaves,
      });
      for (const [r, c, v] of delta.changedCells) matrixRef.current.set(`${r}|${c}`, v);
      versionRef.current = delta.version;
      dirtyRef.current.clear();
      setDirtyCount(0);
      rebuildFromRefs();
      message.success(
        `保存成功：更新 ${delta.changedCells.length} 个聚合值 / ${delta.changedLeaves.length} 条明细`,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[pivot-save] 保存失败：', e);
      if (e instanceof ConflictError) {
        message.error(`保存失败：${e.message}`);
        await reloadAll();
      } else {
        message.error(`保存失败：${(e as Error).message}`);
      }
    } finally {
      setSaving(false);
    }
  }, [saving]);

  // —— 全量重拉（冲突 / 重置 / 关闭按需 / 结构切换后） ——
  const reloadAll = useCallback(async () => {
    const res = await mockApi.loadMatrix({});
    matrixRef.current = new Map(res.matrix.map(([r, c, v]) => [`${r}|${c}`, v]));
    versionRef.current = res.version;
    loadedOrgScopesRef.current = new Set(flattenNodes(orgTreeRef.current).map(n => n.key));
    loadingOrgScopesRef.current.clear();
    dirtyRef.current.clear();
    setDirtyCount(0);
    rebuildFromRefs();
  }, []);

  const handleReset = useCallback(async () => {
    collapsedOrgRef.current = new Set();
    collapsedAccRef.current = new Set();
    collapsedQRef.current = new Set();
    setCollapsedOrg(new Set());
    setCollapsedAcc(new Set());
    setCollapsedQ(new Set());
    await reloadAll();
  }, [reloadAll]);

  const handleExpandAll = useCallback(() => {
    collapsedOrgRef.current = new Set();
    collapsedAccRef.current = new Set();
    collapsedQRef.current = new Set();
    setCollapsedOrg(new Set());
    setCollapsedAcc(new Set());
    setCollapsedQ(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    const orgs = flattenNodes(orgTreeRef.current);
    const accs = flattenNodes(accTreeRef.current).filter(n => n.children.length > 0);
    collapsedOrgRef.current = new Set(orgs.filter(n => n.children.length > 0).map(n => n.key));
    // 科目折叠：每个组织块内各自折叠（方案 1）
    const accPairs = new Set<string>();
    for (const o of orgs) for (const a of accs) accPairs.add(`${o.key}|${a.key}`);
    collapsedAccRef.current = accPairs;
    collapsedQRef.current = new Set(periodQsRef.current.map(q => q.key)); // 仅 Q 层
    setCollapsedOrg(collapsedOrgRef.current);
    setCollapsedAcc(collapsedAccRef.current);
    setCollapsedQ(collapsedQRef.current);
  }, []);

  // —— 期间结构切换（对称/非对称） ——
  const handleStructure = useCallback(
    async (s: PeriodStructure) => {
      setStructure(s);
      mockApi.setPeriodStructure(s);
      rebuildTrees(s);
      collapsedOrgRef.current = new Set();
      collapsedAccRef.current = new Set();
      collapsedQRef.current = new Set();
      setCollapsedOrg(new Set());
      setCollapsedAcc(new Set());
      setCollapsedQ(new Set());
      await reloadAll();
      logBackendContract(); // 结构切换后重新打印（非对称结构）
      message.info(`已切换为${s === 'sym' ? '对称' : '非对称'}期间结构（Q1/Q2 子项见表头）`);
    },
    [reloadAll, logBackendContract],
  );

  // —— 按需加载模式 ——
  const handleOnDemand = useCallback(
    async (v: boolean) => {
      onDemandRef.current = v;
      setOnDemand(v);
      if (v) {
        const res = await mockApi.loadMatrix({ orgScope: 'root' });
        matrixRef.current = new Map(res.matrix.map(([r, c, val]) => [`${r}|${c}`, val]));
        // 顶层组织（集团）行对已加载；初始折叠所有含子级组织，展开时按需拉取
        const topOrg = orgTreeRef.current[0]?.key ?? '';
        loadedOrgScopesRef.current = new Set(topOrg ? [topOrg] : []);
        collapsedOrgRef.current = new Set(flattenNodes(orgTreeRef.current).filter(n => n.children.length > 0).map(n => n.key));
        setCollapsedOrg(collapsedOrgRef.current);
        message.info('已开启按需加载：仅加载顶层组织矩阵，展开组织节点时按需拉取');
      } else {
        await reloadAll();
      }
    },
    [reloadAll],
  );

  // —— 单元格历史 ——
  const openHistory = useCallback(async () => {
    const hot = getHot();
    if (!hot) return;
    const sel = hot.getSelectedLast();
    if (!sel) return;
    const [row, col] = sel;
    const meta = shared.rowMeta[row];
    if (!meta) return;
    let rowKey = '';
    let colKey = '';
    if (col >= rowAreaCols) {
      rowKey = meta.pairKey;
      colKey = shared.colSlots[col - rowAreaCols]?.colKey ?? '';
    } else if (col % 2 === 1) {
      const dimIndex = (col - 1) / 2;
      // holder：组织属性 = 组织节点 key；科目属性 = 组织|科目 组合
      rowKey = dimIndex === 0 ? meta.orgNode.key : meta.pairKey;
      colKey = `attr:${ROW_DIMS[dimIndex].key}`;
    }
    if (!rowKey || !colKey) {
      message.info('维度列没有历史记录');
      return;
    }
    const rows = await mockApi.getCellHistory(rowKey, colKey);
    setHistory({ open: true, title: `${rowKey} × ${colKey}`, rows });
  }, []);

  const contextMenu = useMemo(
    () => ({
      items: {
        查看历史记录: { name: '查看历史记录', callback: () => void openHistory() },
      },
    }),
    [openHistory],
  );

  const beforeContextMenu = useCallback((items: any, coords: any) => {
    const item = Array.isArray(items)
      ? items.find((i: any) => i?.key === '查看历史记录' || i?.name === '查看历史记录')
      : items?.['查看历史记录'];
    if (!item) return true;
    const { row, col } = coords ?? {};
    const editable = row >= 0 && (col >= rowAreaCols || (col % 2 === 1 && col < rowAreaCols));
    item.disabled = !editable;
    return true;
  }, []);

  // —— 未保存离开提醒 ——
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const historyColumns = [
    { title: '时间', dataIndex: 'timestamp', width: 180, render: (v: number) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作人', dataIndex: 'operator', width: 90 },
    { title: '旧值', dataIndex: 'oldValue', width: 120, render: (v: any) => (v === null || v === undefined ? '—' : String(v)) },
    { title: '新值', dataIndex: 'newValue', width: 120, render: (v: any) => (v === null || v === undefined ? '—' : String(v)) },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v: string) =>
        v === 'manual' ? <Tag color="blue">手动编辑</Tag> : <Tag color="orange">分摊写入</Tag>,
    },
    { title: '影响明细', dataIndex: 'affectedLeaves', width: 90 },
    { title: '版本', dataIndex: 'version', width: 70 },
  ];

  if (!ready) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" tip="数据加载中..." />
      </div>
    );
  }

  const stats = mockApi.stats();

  return (
    <div className="pivot-prototype" style={{ padding: '16px 24px' }}>
      {/* 说明卡片 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size="middle">
          <span style={{ fontWeight: 600 }}>📊 透视表 v8（组织 × 科目 × 期间 → 指标）</span>
          <span style={{ color: '#666' }}>
            期间结构：{structure === 'sym' ? '对称' : '非对称'}（{periodQsRef.current.map(q => `${q.label}[${q.children.map(c => c.label).join('/')}]`).join('，')}）
          </span>
          <span style={{ color: '#666' }}>
            明细：{stats.orgLeaves} 组织叶 × {stats.accLeaves} 科目叶 × {stats.months} 期间叶 × {METRICS.length} 指标 = {stats.records} 条
          </span>
          <span style={{ color: '#666' }}>数据版本：v{versionRef.current}</span>
          {dirtyCount > 0 && <Tag color="orange">未保存修改 {dirtyCount} 处</Tag>}
        </Space>
      </Card>

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size="middle">
          <Button type="primary" icon={<SaveOutlined />} onClick={() => void handleSave()} disabled={dirtyCount === 0} loading={saving}>
            保存（回写分摊）
          </Button>
          <Button icon={<UndoOutlined />} onClick={() => void handleReset()}>重置</Button>
          <Button icon={<CaretDownOutlined />} onClick={handleExpandAll}>全部展开</Button>
          <Button icon={<CaretRightOutlined />} onClick={handleCollapseAll}>全部折叠</Button>
          <span style={{ color: '#666' }}>期间结构：</span>
          <Select
            value={structure}
            style={{ width: 110 }}
            onChange={v => void handleStructure(v as PeriodStructure)}
            options={[
              { value: 'sym', label: '对称' },
              { value: 'asym', label: '非对称' },
            ]}
          />
          <span style={{ color: '#666' }}>按需加载：</span>
          <Switch checked={onDemand} onChange={v => void handleOnDemand(v)} />
          <span style={{ color: '#666' }}>计算规则：</span>
          <Select
            value={rule}
            style={{ width: 110 }}
            onChange={v => {
              setRule(v);
              mockApi.setRule(v);
              message.info('规则已切换（后端），保存后生效');
            }}
            options={[
              { value: 'sum', label: '求和' },
              { value: 'weighted', label: '加权' },
            ]}
          />
          <span style={{ color: '#666' }}>分摊策略：</span>
          <Select
            value={strategy}
            style={{ width: 110 }}
            onChange={v => {
              setStrategy(v);
              mockApi.setAllocationStrategy(v);
              message.info('分摊策略已切换（后端），保存后生效');
            }}
            options={[
              { value: 'ratio', label: '按比例' },
              { value: 'equal', label: '平均' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              mockApi.simulateConflict();
              message.warning('已模拟他人修改（版本号 +1），下次保存将触发冲突');
            }}
          >
            模拟冲突
          </Button>
        </Space>
      </Card>

      {/* 表格（数据/列/表头/合并由 rebuildFromRefs 命令式驱动） */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <HotTable
          ref={hotRef}
          colHeaders={false}
          rowHeaders={false}
          fixedColumnsStart={rowAreaCols}
          licenseKey="non-commercial-and-evaluation"
          width="100%"
          height={HOT_HEIGHT}
          stretchH="all"
          contextMenu={contextMenu}
          beforeContextMenu={beforeContextMenu}
          afterOnCellMouseDown={afterOnCellMouseDown}
          beforeChange={beforeChange}
          afterChange={afterChange}
          cells={cellsCallback}
          autoColumnSize={false}
          viewportRowRenderingOffset={20}
          viewportColumnRenderingOffset={10}
        />
      </Card>

      {/* 历史抽屉 */}
      <Drawer title={`单元格历史：${history.title}`} width={760} open={history.open} onClose={() => setHistory(h => ({ ...h, open: false }))}>
        {history.rows.length === 0 ? (
          <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>暂无历史记录</div>
        ) : (
          <Table size="small" rowKey={(_, i) => String(i)} columns={historyColumns} dataSource={history.rows} pagination={false} />
        )}
      </Drawer>
    </div>
  );
}
