import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import comments from '@jspreadsheet/comments';
import search from '@jspreadsheet/search';
import bar from '@jspreadsheet/bar';
import formula from '@jspreadsheet/formula-pro';
import pivot from '@jspreadsheet/pivot';
import barFormulas from '@jspreadsheet/bar/dist/formulas.json';
import lemonade from 'lemonadejs';
import { App, Select, Spin } from 'antd';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet/dist/jspreadsheet.css';
import '@jsuites/css/dist/style.css';
import '@jspreadsheet/comments/dist/style.css';
import '@jspreadsheet/bar/dist/style.css';
import '@jspreadsheet/pivot/dist/style.css';
import 'material-icons/iconfont/material-icons.css';
import { zhCN } from './dictionary';
import './index.less';

// 批注扩展依赖全局 lemonade
(window as any).lemonade = lemonade;

jspreadsheet.setLicense('evaluation');
// localhost 开发用内置 evaluation（不过期）。非 localhost 需到 https://jspreadsheet.com 生成证书。
jspreadsheet.setDictionary(zhCN);

comments({
  user_id: 1,
  name: '演示用户',
  permission: 2,
});

// Edition bar：本地公式建议，避免远程拉取失败
bar({ suggestions: barFormulas as any });

const extensions = { formula, bar, comments, search, pivot };

type TrackItem = {
  id: string;
  cell: string;
  from: string;
  to: string;
  time: string;
};

/** 插件 onevent 会先于 Worksheet 事件触发，用桥接把变更交给页面 state */
const historyBridge = {
  onChange: (_ws: any, _x: any, _y: any, _oldValue: any, _newValue: any) => {},
  onSelect: (_ws: any, _px: any, _py: any, _ux: any, _uy: any) => {},
};

/** 透视源数据：工具栏「全部展开 / 全部折叠」桥接（由 outline effect 注入） */
const outlineBridge = {
  expandAll: (_onDone?: () => void) => {},
  collapseAll: (_onDone?: () => void) => {},
};

/** expand_all / collapse_all 不在 Material Icons 字体中，用 SVG 还原官方造型 */
const OUTLINE_TOOLBAR_SVG = {
  expand_all:
    '<svg viewBox="0 -960 960 960" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M480-880 680-680H560v200H400v-200H280L480-880Zm0 720L280-360h120v-200h160v200h120L480-160Z"/></svg>',
  collapse_all:
    '<svg viewBox="0 -960 960 960" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M280-680 480-880l200 200H560v200H400v-200H280Zm400 240L480-160 280-360h120v-200h160v200h120Z"/></svg>',
};

function renderOutlineToolbarIcon(kind: 'expand_all' | 'collapse_all') {
  return (toolbarItem: HTMLElement) => {
    const icon = toolbarItem.querySelector('i');
    if (!icon) return;
    icon.classList.remove('material-icons');
    icon.classList.add('jss-outline-toolbar-icon');
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '24px';
    icon.style.height = '24px';
    icon.style.fontFamily = 'inherit';
    icon.innerHTML = OUTLINE_TOOLBAR_SVG[kind];
  };
}

const cellHistoryPlugin = {
  onevent(event: string, worksheet?: any, a?: any, b?: any, c?: any, d?: any, e?: any) {
    if (event === 'onchange') {
      historyBridge.onChange(worksheet, b, c, e, d);
      return;
    }
    if (event === 'onafterchanges' && Array.isArray(a)) {
      a.forEach((rec: any) => {
        historyBridge.onChange(
          worksheet,
          rec.x ?? rec.col,
          rec.y ?? rec.row,
          rec.oldValue ?? rec.oldvalue,
          rec.value ?? rec.newValue ?? rec.v,
        );
      });
      return;
    }
    if (event === 'oneditionend' && e) {
      historyBridge.onChange(worksheet, b, c, undefined, d);
      return;
    }
    if (event === 'onselection') {
      historyBridge.onSelect(worksheet, a, b, c, d);
    }
  },
};

const REGIONS = ['华东', '华南', '华北', '西南', '西北'];
const CATEGORIES = ['整机', '配件', '耗材', '服务'];
const STATUS = ['待审核', '已通过', '已驳回'];

/** dropdown 用 id/name，避免大数据虚拟滚动下把选项值渲染错 */
const REGION_OPTIONS = REGIONS.map((name) => ({ id: name, name }));
const CATEGORY_OPTIONS = CATEGORIES.map((name) => ({ id: name, name }));
const STATUS_OPTIONS = STATUS.map((name) => ({ id: name, name }));

const PIVOT_CATEGORIES = [
  {
    name: 'Furniture',
    children: ['Bookcases', 'Chairs', 'Furnishings', 'Tables'],
  },
  {
    name: 'Office Supplies',
    children: ['Binders', 'Paper', 'Storage'],
  },
  {
    name: 'Technology',
    children: ['Phones', 'Accessories', 'Machines'],
  },
];
const PIVOT_REGIONS = ['East', 'Central', 'West', 'South'];

/** Region 展开后显示的州（对齐参考图二） */
const EAST_STATES = [
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Maine',
  'Maryland',
  'Massachusetts',
  'New Hampshire',
  'New Jersey',
] as const;

/** 透视源数据：Category→SubCategory（图一）；Region→State（图二） */
const OUTLINE_TREE = [
  {
    name: 'Furniture',
    expanded: false,
    children: [
      { name: 'Bookcases', sales: 72800.47, profit: -3399.9 },
      { name: 'Chairs', sales: 26579.76, profit: 1869.08 },
      { name: 'Furnishings', sales: 17256.71, profit: 1307.18 },
      { name: 'Tables', sales: 41287.95, profit: -943.99 },
    ],
  },
  {
    name: 'Office Supplies',
    expanded: false,
    children: [
      { name: 'Binders', sales: 28400.2, profit: 5200.1 },
      { name: 'Paper', sales: 22100.19, profit: 4100.55 },
      { name: 'Storage', sales: 21447.0, profit: 3331.1 },
    ],
  },
  {
    name: 'Technology',
    expanded: false,
    children: [
      { name: 'Phones', sales: 68200.4, profit: 9200.2 },
      { name: 'Accessories', sales: 42100.15, profit: 6100.32 },
      { name: 'Machines', sales: 38294.0, profit: 4746.2 },
    ],
  },
] as const;

type OutlineGroupCell = {
  row: number;
  col: number;
  label: string;
  /** category=品类→子类；region=地区→州；leaf=仅展示 */
  kind: 'category' | 'region' | 'leaf';
  indent?: number;
  detailRows?: number[];
  expanded?: boolean;
};

type OutlineSheet = {
  data: any[][];
  rows: Record<number, { group: number; state: boolean }>;
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  groupCells: OutlineGroupCell[];
  /** 州明细行（统一 CSS 绘制，不依赖 style/mergeCells） */
  stateDetailRows: Set<number>;
  negProfitRows: Set<number>;
  /** >1 万行生成时为 true，走 heavy 折叠/绘制路径 */
  liteMeta?: boolean;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 把汇总拆到各州，末行吃掉差额保证合计一致 */
function splitToStates(sales: number, profit: number, seed: number) {
  const n = EAST_STATES.length;
  const weights = EAST_STATES.map((_, i) => 0.7 + ((seed * 17 + i * 13) % 10) / 10);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const rows = EAST_STATES.map((name, i) => {
    const salesPart = round2((sales * weights[i]) / wSum);
    const profitPart = round2((profit * weights[i]) / wSum);
    return { name, sales: salesPart, profit: profitPart };
  });
  const salesAdj = round2(sales - rows.reduce((a, x) => a + x.sales, 0));
  const profitAdj = round2(profit - rows.reduce((a, x) => a + x.profit, 0));
  rows[n - 1].sales = round2(rows[n - 1].sales + salesAdj);
  rows[n - 1].profit = round2(rows[n - 1].profit + profitAdj);
  return rows;
}

type OutlineCatInput = {
  name: string;
  expanded: boolean;
  children: { name: string; sales: number; profit: number }[];
};

function outlineRowsForCat(childCount: number) {
  const stateCount = EAST_STATES.length;
  return 1 + stateCount + childCount * (1 + stateCount);
}

function totalOutlineRows(cats: OutlineCatInput[]) {
  let total = 0;
  for (let i = 0; i < cats.length; i += 1) {
    total += outlineRowsForCat(cats[i].children.length);
  }
  return total;
}

const STATE_DETAIL_COUNT = EAST_STATES.length;

function eachRegionDetailRow(regionRow: number, fn: (detailRow: number) => void) {
  for (let i = 1; i <= STATE_DETAIL_COUNT; i += 1) fn(regionRow + i);
}

function regionDetailSet(regionRow: number) {
  const set = new Set<number>();
  eachRegionDetailRow(regionRow, (r) => set.add(r));
  return set;
}

/** 透视源数据可编辑列：状态 + 下单日期（Sales/Profit 为数值列） */
function outlineEditableSeed(row: number, seed: number) {
  const status = STATUS[(row + seed) % STATUS.length];
  const month = ((row * 3 + seed) % 12) + 1;
  const day = ((row * 5 + seed) % 11) + 1;
  const date = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return [status, date] as const;
}

const OUTLINE_PROFIT_COL = 5;

function buildOutlineFromCats(
  cats: OutlineCatInput[],
  opts?: { liteMeta?: boolean },
): OutlineSheet {
  const liteMeta = !!opts?.liteMeta;
  const totalRows = totalOutlineRows(cats);
  const data: any[][] = new Array(totalRows);
  const rows: Record<number, { group: number; state: boolean }> = {};
  const groupCells: OutlineGroupCell[] = [];
  const stateDetailRows = new Set<number>();
  const negProfitRows = new Set<number>();
  let seed = 1;

  const markNegProfit = (row: number, profit: number) => {
    if (profit < 0) negProfitRows.add(row);
  };

  let r = 0;
  for (let ci = 0; ci < cats.length; ci += 1) {
    const cat = cats[ci];
    const catStart = r;
    const catSales = round2(cat.children.reduce((a, c) => a + c.sales, 0));
    const catProfit = round2(cat.children.reduce((a, c) => a + c.profit, 0));

    data[r] = (() => {
      const [status, orderDate] = outlineEditableSeed(r, seed);
      return [cat.name, 'East', status, orderDate, catSales, catProfit];
    })();
    groupCells.push({ row: catStart, col: 0, label: cat.name, kind: 'category', indent: 0 });
    groupCells.push({
      row: catStart,
      col: 1,
      label: 'East',
      kind: 'region',
      indent: 0,
      expanded: false,
      ...(liteMeta ? {} : { detailRows: [] as number[] }),
    });
    markNegProfit(catStart, catProfit);
    r += 1;

    const catRegionCell = groupCells[groupCells.length - 1];
    const catStates = splitToStates(catSales, catProfit, seed++);
    for (let si = 0; si < catStates.length; si += 1) {
      const st = catStates[si];
      data[r] = (() => {
        const [status, orderDate] = outlineEditableSeed(r, seed);
        return ['', st.name, status, orderDate, st.sales, st.profit];
      })();
      stateDetailRows.add(r);
      markNegProfit(r, st.profit);
      if (!liteMeta) catRegionCell.detailRows!.push(r);
      r += 1;
    }

    for (let sj = 0; sj < cat.children.length; sj += 1) {
      const sub = cat.children[sj];
      const subStart = r;
      data[r] = (() => {
        const [status, orderDate] = outlineEditableSeed(r, seed);
        return [sub.name, 'East', status, orderDate, sub.sales, sub.profit];
      })();
      groupCells.push({ row: subStart, col: 0, label: sub.name, kind: 'leaf', indent: 1 });
      groupCells.push({
        row: subStart,
        col: 1,
        label: 'East',
        kind: 'region',
        indent: 0,
        expanded: false,
        ...(liteMeta ? {} : { detailRows: [] as number[] }),
      });
      markNegProfit(subStart, sub.profit);
      r += 1;

      const subRegionCell = groupCells[groupCells.length - 1];
      const subStates = splitToStates(sub.sales, sub.profit, seed++);
      for (let si = 0; si < subStates.length; si += 1) {
        const st = subStates[si];
        data[r] = (() => {
        const [status, orderDate] = outlineEditableSeed(r, seed);
        return ['', st.name, status, orderDate, st.sales, st.profit];
      })();
        stateDetailRows.add(r);
        markNegProfit(r, st.profit);
        if (!liteMeta) subRegionCell.detailRows!.push(r);
        r += 1;
      }
    }

    rows[catStart] = { group: r - catStart - 1, state: cat.expanded };
  }

  return {
    data,
    rows,
    mergeCells: {},
    style: {},
    groupCells,
    stateDetailRows,
    negProfitRows,
    liteMeta,
  };
}

/** 任意数据量都生成可折叠树；>1 万行 liteMeta 仅减 detailRows 元数据，样式统一走 paint/CSS */
function buildOutlineSourceSheet(targetRows?: number | 'demo'): OutlineSheet {
  if (targetRows === undefined || targetRows === 'demo') {
    return buildOutlineFromCats(
      OUTLINE_TREE.map((cat) => ({
        name: cat.name,
        expanded: cat.expanded,
        children: cat.children.map((c) => ({ ...c })),
      })),
    );
  }

  const count = Number(targetRows);
  if (!Number.isFinite(count) || count <= 0) {
    return buildOutlineSourceSheet('demo');
  }

  const liteMeta = count > 10000;
  const cats: OutlineCatInput[] = [];
  let approx = 0;
  let i = 0;
  while (approx < count) {
    const tpl = OUTLINE_TREE[i % OUTLINE_TREE.length];
    const batch = Math.floor(i / OUTLINE_TREE.length);
    const suffix = batch === 0 ? '' : ` ${batch + 1}`;
    const children = tpl.children.map((c, ci) => ({
      name: `${c.name}${suffix}`,
      sales: round2(c.sales * (1 + ((i * 3 + ci) % 7) * 0.01)),
      profit: round2(c.profit * (1 + ((i * 5 + ci) % 5) * 0.02)),
    }));
    cats.push({
      name: `${tpl.name}${suffix}`,
      expanded: false,
      children,
    });
    approx += outlineRowsForCat(children.length);
    i += 1;
    if (i > 500000) break;
  }

  return buildOutlineFromCats(cats, { liteMeta });
}

const ORDER_SCALE_OPTIONS = [
  { value: '2000', label: '演示 · 2 千行' },
  { value: '10000', label: '1 万行' },
  { value: '100000', label: '10 万行' },
  { value: '1000000', label: '100 万行（慎用）' },
] as const;

type OrderScale = (typeof ORDER_SCALE_OPTIONS)[number]['value'];

const OUTLINE_SCALE_OPTIONS = [
  { value: 'demo', label: '演示 · 折叠树' },
  { value: '2000', label: '2 千行' },
  { value: '10000', label: '1 万行' },
  { value: '100000', label: '10 万行' },
  { value: '1000000', label: '100 万行（慎用）' },
] as const;

type OutlineScale = (typeof OUTLINE_SCALE_OPTIONS)[number]['value'];

/** 折叠维度单元格只读配置 */
function buildOutlineReadonlyCells(groupCells: OutlineGroupCell[]) {
  const cells: Record<string, { readOnly: boolean }> = {};
  groupCells.forEach(({ row, col }) => {
    const name = cellName(col, row);
    if (name) cells[name] = { readOnly: true };
  });
  return cells;
}

function cellName(x: number, y: number) {
  const col = Number(x);
  const row = Number(y);
  if (!Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0) return '';
  try {
    const name = jspreadsheet.helpers?.getCellNameFromCoords?.(col, row);
    if (name) return name;
  } catch {
    // fallback below
  }
  let letters = '';
  let n = col;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${letters}${row + 1}`;
}

function buildSeedRows(count: number) {
  const rows: any[][] = new Array(count);
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let i = 0; i < count; i += 1) {
    const region = REGIONS[i % REGIONS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    const qty = (i % 900) + 10;
    const price = Math.round((20 + (i % 800) + (i % 37) * 0.17) * 100) / 100;
    const month = (i % 12) + 1;
    const day = (i % daysInMonth[month - 1]) + 1;
    rows[i] = [
      `订单-${10000 + i}`,
      region,
      category,
      STATUS[i % STATUS.length],
      `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      qty,
      price,
      Math.round(qty * price * 100) / 100,
      '',
      i % 17 === 0 ? '需要跟进' : '',
      `销售${(i % 8) + 1}`,
      i % 2 === 0 ? '线上' : '线下',
      `仓-${(i % 5) + 1}`,
    ];
  }
  return rows;
}

/** 透视源数据：Category / SubCategory / Region / Sales / Profit */
function buildPivotSourceData() {
  const header = ['Category', 'SubCategory', 'Region', 'Sales', 'Profit'];
  const rows: any[][] = [header];
  let seed = 1;
  PIVOT_CATEGORIES.forEach((cat) => {
    cat.children.forEach((sub) => {
      PIVOT_REGIONS.forEach((region) => {
        seed += 1;
        const sales = Number((20000 + ((seed * 137) % 35000) + seed * 11.37).toFixed(2));
        const profit = Number((((seed % 5) - 2) * 800 + (seed % 17) * 35.2 - 400).toFixed(2));
        rows.push([cat.name, sub, region, sales, profit]);
      });
    });
  });
  return rows;
}

function getWorksheetList(ref: React.MutableRefObject<any>) {
  const current = ref.current;
  if (!current) return [] as any[];
  return Array.isArray(current) ? current : [current];
}

/** 当前激活工作表（工具栏/附件操作优先作用在当前页） */
function getActiveWorksheet(ref: React.MutableRefObject<any>) {
  const list = getWorksheetList(ref);
  if (!list.length) return null;
  const parent = list[0]?.parent;
  const idx =
    typeof parent?.getWorksheetActive === 'function'
      ? parent.getWorksheetActive()
      : 0;
  return list[idx] || list[0];
}

function getWorksheetByName(ref: React.MutableRefObject<any>, name: string) {
  const list = getWorksheetList(ref);
  return (
    list.find(
      (ws) =>
        ws?.options?.worksheetName === name ||
        ws?.getWorksheetName?.() === name,
    ) || null
  );
}

export default function JspreadsheetPage() {
  return (
    <App>
      <JspreadsheetPageInner />
    </App>
  );
}

function JspreadsheetPageInner() {
  const { message } = App.useApp();
  const spreadsheet = useRef<any>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [historyCell, setHistoryCell] = useState('A1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<{ x: number; y: number } | null>(null);
  const outlineLoadTokenRef = useRef(0);

  const [orderScale, setOrderScale] = useState<OrderScale>('2000');
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderLoadInfo, setOrderLoadInfo] = useState('');
  const [outlineScale, setOutlineScale] = useState<OutlineScale>('demo');
  const [outlineBusy, setOutlineBusy] = useState(false);
  const [outlineLoadInfo, setOutlineLoadInfo] = useState('');
  const [sheetNonce, setSheetNonce] = useState(0);
  const [orderData, setOrderData] = useState(() => buildSeedRows(2000));
  const [outlineSheet, setOutlineSheet] = useState(() => buildOutlineSourceSheet('demo'));

  const outlineReadonlyCells = useMemo(() => {
    // 百万行量级不预建 cells 映射，靠 oneditionstart 拦编辑
    if (outlineSheet.groupCells.length > 20000) return undefined;
    return buildOutlineReadonlyCells(outlineSheet.groupCells);
  }, [outlineSheet]);
  const pivotSourceData = useMemo(() => buildPivotSourceData(), []);
  const pivotSourceRowCount = pivotSourceData.length;
  const isOrderPerf = orderScale !== '2000';
  const isOutlinePerf = outlineScale === '100000' || outlineScale === '1000000';
  const sheetBusy = orderBusy || outlineBusy;
  const sheetLoadInfo = orderBusy ? orderLoadInfo : outlineLoadInfo;

  const destroySpreadsheet = useCallback(() => {
    // 只清空 ref，让 React 通过 key 卸载旧节点。
    // 不要 jspreadsheet.destroy(React 管理的 DOM)，否则重挂载后单元格/表头容易错乱。
    spreadsheet.current = null;
  }, []);

  const openWorksheetByName = useCallback((name: string) => {
    const list = getWorksheetList(spreadsheet);
    if (!list.length) return null;
    const idx = list.findIndex(
      (ws) =>
        ws?.options?.worksheetName === name || ws?.getWorksheetName?.() === name,
    );
    const parent = list[0]?.parent;
    if (idx >= 0 && parent?.openWorksheet) {
      try {
        parent.openWorksheet(idx, true);
      } catch {
        // ignore
      }
    }
    return idx >= 0 ? list[idx] : getWorksheetByName(spreadsheet, name);
  }, []);

  const openOrderWorksheet = useCallback(
    () => openWorksheetByName('订单明细'),
    [openWorksheetByName],
  );

  const openOutlineWorksheet = useCallback(
    () => openWorksheetByName('透视源数据'),
    [openWorksheetByName],
  );

  const handleOrderScaleChange = useCallback(
    (value: OrderScale) => {
      if (sheetBusy) return;
      if (value === orderScale) return;

      const count = Number(value);
      setOrderBusy(true);
      setOrderScale(value);
      setOrderLoadInfo(`正在生成 ${count.toLocaleString()} 行订单明细…`);

      window.setTimeout(() => {
        const t0 = performance.now();
        try {
          const data = buildSeedRows(count);
          const genCost = Math.round(performance.now() - t0);
          setOrderLoadInfo(
            `${count.toLocaleString()} 行已生成（${genCost}ms），正在渲染表格…`,
          );

          destroySpreadsheet();
          setOrderData(data);
          setSheetNonce((n) => n + 1);

          window.setTimeout(() => {
            openOrderWorksheet();
            const total = Math.round(performance.now() - t0);
            setOrderLoadInfo(`${count.toLocaleString()} 行 · 总耗时 ${total}ms`);
            setOrderBusy(false);
            try {
              message.success(`订单明细已加载 ${count.toLocaleString()} 行`);
            } catch {
              // ignore
            }
          }, 200);
        } catch (err) {
          destroySpreadsheet();
          setOrderScale('2000');
          setOrderData(buildSeedRows(2000));
          setSheetNonce((n) => n + 1);
          setOrderLoadInfo('加载失败，已回到 2 千行演示');
          setOrderBusy(false);
          try {
            message.error(`加载失败：${(err as Error)?.message || err}`);
          } catch {
            // ignore
          }
        }
      }, 50);
    },
    [sheetBusy, orderScale, destroySpreadsheet, openOrderWorksheet, message],
  );

  const handleOutlineScaleChange = useCallback(
    (value: OutlineScale) => {
      if (value === outlineScale) return;

      // 立即切断上一档位的批量展开/折叠，避免切换后仍操作旧 worksheet
      outlineBridge.expandAll = () => {};
      outlineBridge.collapseAll = () => {};
      const token = ++outlineLoadTokenRef.current;
      const label =
        value === 'demo' ? '演示折叠树' : `${Number(value).toLocaleString()} 行`;
      setOutlineBusy(true);
      setOutlineScale(value);
      setOutlineLoadInfo(`正在生成透视源数据（${label}）…`);

      window.setTimeout(() => {
        if (token !== outlineLoadTokenRef.current) return;
        const t0 = performance.now();
        try {
          const next =
            value === 'demo'
              ? buildOutlineSourceSheet('demo')
              : buildOutlineSourceSheet(Number(value));
          if (token !== outlineLoadTokenRef.current) return;
          const genCost = Math.round(performance.now() - t0);
          const rows = next.data.length;
          setOutlineLoadInfo(
            `${rows.toLocaleString()} 行已生成（${genCost}ms），正在渲染表格…`,
          );

          destroySpreadsheet();
          setOutlineSheet(next);
          setSheetNonce((n) => n + 1);

          window.setTimeout(() => {
            if (token !== outlineLoadTokenRef.current) return;
            openOutlineWorksheet();
            const total = Math.round(performance.now() - t0);
            setOutlineLoadInfo(
              `透视源数据 ${rows.toLocaleString()} 行 · 总耗时 ${total}ms`,
            );
            setOutlineBusy(false);
            try {
              message.success(`透视源数据已加载 ${rows.toLocaleString()} 行`);
            } catch {
              // ignore
            }
          }, 200);
        } catch (err) {
          if (token !== outlineLoadTokenRef.current) return;
          destroySpreadsheet();
          setOutlineScale('demo');
          setOutlineSheet(buildOutlineSourceSheet('demo'));
          setSheetNonce((n) => n + 1);
          setOutlineLoadInfo('加载失败，已回到演示折叠树');
          setOutlineBusy(false);
          try {
            message.error(`加载失败：${(err as Error)?.message || err}`);
          } catch {
            // ignore
          }
        }
      }, 50);
    },
    [outlineScale, destroySpreadsheet, openOutlineWorksheet, message],
  );

  const columns = useMemo(
    () => [
      { type: 'text', title: '订单号', width: 120, align: 'left' as const },
      {
        type: 'dropdown',
        title: '区域',
        width: 100,
        source: REGION_OPTIONS,
        autocomplete: true,
        strictMode: false,
      },
      {
        type: 'dropdown',
        title: '品类',
        width: 100,
        source: CATEGORY_OPTIONS,
        strictMode: false,
      },
      {
        type: 'dropdown',
        title: '状态',
        width: 100,
        source: STATUS_OPTIONS,
        strictMode: false,
      },
      {
        type: 'calendar',
        title: '下单日期',
        width: 120,
        format: 'YYYY-MM-DD',
      },
      {
        type: 'numeric',
        title: '数量',
        width: 90,
        mask: '#,##0',
        align: 'right' as const,
        group: 3,
        state: true,
      },
      {
        type: 'numeric',
        title: '单价',
        width: 100,
        mask: '#,##0.00',
        align: 'right' as const,
      },
      {
        type: 'numeric',
        title: '金额',
        width: 110,
        mask: '#,##0.00',
        align: 'right' as const,
      },
      {
        type: 'text',
        title: '附件',
        width: 120,
        align: 'left' as const,
        readOnly: false,
      },
      {
        type: 'text',
        title: '备注',
        width: 160,
        align: 'left' as const,
      },
      { type: 'text', title: '销售员', width: 90, group: 3, state: true },
      { type: 'text', title: '渠道', width: 90 },
      { type: 'text', title: '仓库', width: 90 },
    ],
    [],
  );

  /** 压测仍保留 dropdown/calendar；仅去掉列组，避免折叠列造成“缺数据”错觉 */
  const orderColumns = useMemo(() => {
    if (!isOrderPerf) return columns;
    return columns.map((col) => {
      const next = { ...(col as Record<string, unknown>) };
      delete next.group;
      delete next.state;
      return next;
    });
  }, [columns, isOrderPerf]);

  const nestedHeaders = useMemo(
    () => [
      [
        { title: '基础信息', colspan: 5 },
        { title: '数值指标', colspan: 3 },
        { title: '扩展字段', colspan: 5 },
      ],
    ],
    [],
  );

  /** 多级行组：品类 → 明细，类似透视表可折叠树 */
  const orderRows = useMemo(() => {
    const map: Record<number, { group: number; state: boolean }> = {};
    for (let i = 0; i < 40; i += 5) {
      map[i] = { group: 4, state: true };
    }
    for (let i = 0; i < 40; i += 5) {
      map[i + 2] = { group: 2, state: false };
    }
    return map;
  }, []);

  const commentsData = useMemo(
    () => ({
      // 高级批注扩展：必须是对象数组，字符串只会显示红点/title，点不开弹层
      A1: [
        {
          user_id: 1,
          name: '演示用户',
          date: '2025-08-01 10:00:00',
          comments: '示例批注：可在此讨论订单细节。',
        },
      ],
      D2: [
        {
          user_id: 1,
          name: '演示用户',
          date: '2025-08-02 14:30:00',
          comments: '状态待确认',
        },
      ],
    }),
    [],
  );

  /**
   * 透视分析表（参考图片）：
   * - 行维度：Category → SubCategory（自定义折叠，行号列无原生三角；A/B 列单元格内 ▼/▶）
   * - 列维度：Region（多列折叠）
   * - 值：Sales / Profit
   */
  const pivotTables = useMemo(
    () => [
      {
        anchor: 'A1',
        source: `透视底表!A1:E${pivotSourceRowCount}`,
        rows: [
          {
            columnIndex: 0,
            sortBy: 'name',
            ascendingOrder: true,
          },
          {
            columnIndex: 1,
            sortBy: 'name',
            ascendingOrder: true,
            collapsed: ['Furnishings', 'Paper', 'Machines'],
          },
        ],
        columns: [
          {
            columnIndex: 2,
            sortBy: 'name',
            ascendingOrder: true,
            collapsed: ['Central', 'South'],
          },
        ],
        cells: [
          {
            id: 'pivot-sales',
            columnIndex: 3,
            method: 'SUM',
          },
          {
            id: 'pivot-profit',
            columnIndex: 4,
            method: 'SUM',
          },
        ],
      },
    ],
    [pivotSourceRowCount],
  );

  const pivotSourceColumns = useMemo(
    () => [
      { type: 'text', title: 'Category', width: 140 },
      { type: 'text', title: 'SubCategory', width: 140 },
      { type: 'dropdown', title: 'Region', width: 110, source: PIVOT_REGIONS },
      {
        type: 'numeric',
        title: 'Sales',
        width: 120,
        mask: '#,##0.00',
        align: 'right' as const,
      },
      {
        type: 'numeric',
        title: 'Profit',
        width: 120,
        mask: '#,##0.00',
        align: 'right' as const,
      },
    ],
    [],
  );

  const outlineColumns = useMemo(
    () => [
      { type: 'text', title: 'Category', width: 160, readOnly: true, align: 'left' as const },
      { type: 'text', title: 'Region', width: 110, readOnly: true, align: 'left' as const },
      {
        type: 'dropdown',
        title: '状态',
        width: 100,
        source: STATUS_OPTIONS,
        strictMode: false,
      },
      {
        type: 'calendar',
        title: '下单日期',
        width: 120,
        format: 'YYYY-MM-DD',
      },
      {
        type: 'numeric',
        title: 'Sales',
        width: 120,
        mask: '$#,##0.00',
        align: 'right' as const,
      },
      {
        type: 'numeric',
        title: 'Profit',
        width: 120,
        mask: '$#,##0.00',
        align: 'right' as const,
      },
    ],
    [],
  );

  // Spreadsheet React 只初始化一次；插件 onevent + config 回调三路绑定
  useEffect(() => {
    const bind = () => {
      const list = getWorksheetList(spreadsheet);
      const parent = list[0]?.parent;
      if (!parent?.config) return false;
      if ((parent.config as any).__historyBound) return true;

      const prevOnevent = parent.config.onevent;
      parent.config.onevent = function historyOnevent(event: string, ...rest: any[]) {
        cellHistoryPlugin.onevent(event, ...rest);
        return prevOnevent?.call(this, event, ...rest);
      };

      // 再挂原生 onchange / onselection（官方事件签名：ws, cell, x, y, newValue, oldValue）
      const prevChange = parent.config.onchange;
      parent.config.onchange = function (
        worksheet: any,
        _cell: any,
        x: any,
        y: any,
        newValue: any,
        oldValue: any,
      ) {
        historyBridge.onChange(worksheet, x, y, oldValue, newValue);
        return prevChange?.call(this, worksheet, _cell, x, y, newValue, oldValue);
      };

      const prevSelect = parent.config.onselection;
      parent.config.onselection = function (
        worksheet: any,
        px: any,
        py: any,
        ux: any,
        uy: any,
        ...rest: any[]
      ) {
        historyBridge.onSelect(worksheet, px, py, ux, uy);
        return prevSelect?.call(this, worksheet, px, py, ux, uy, ...rest);
      };

      (parent.config as any).__historyBound = true;
      return true;
    };
    if (bind()) return undefined;
    const timer = window.setInterval(() => {
      if (bind()) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [sheetNonce]);

  // 透视源数据：Category 树形第一列；Region 列每一行都可折叠；隐藏行号 +/-
  // sheetNonce：切换数据量会 remount 整表，需重新绑定折叠操作
  useEffect(() => {
    if (!outlineSheet.groupCells.length) return undefined;

    // outlineBatch：仅控制分批 init/expand（性能）；样式与交互路径各档位保持一致
    const outlinePerf = isOutlinePerf;
    const outlineBatch =
      outlineSheet.data.length > 150 || !!outlineSheet.liteMeta || outlinePerf;
    const outlineWatchDom = true;

    let disposed = false;
    let painting = false;
    let paintTimer: number | undefined;
    let tabTimer: number | undefined;
    const initTimers: number[] = [];
    const bindToken = sheetNonce;
    let observer: MutationObserver | null = null;
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let boundRoot: HTMLElement | null = null;
    let outlineBulkBusy = false;
    let outlineInitBusy = false;
    let scrollTarget: HTMLElement | null = null;
    let onScrollPaint: (() => void) | null = null;
    const pendingIdle: number[] = [];

    /** Region 折叠状态：key = 标题行号 */
    const regionState = new Map<number, boolean>();
    const foldMetaByKey = new Map<string, OutlineGroupCell>();
    const regionByRow = new Map<number, OutlineGroupCell>();
    outlineSheet.groupCells.forEach((cell) => {
      foldMetaByKey.set(`${cell.col}:${cell.row}`, cell);
      if (cell.kind === 'region') {
        regionState.set(cell.row, !!cell.expanded);
        regionByRow.set(cell.row, cell);
      }
    });

    const FOLD_STYLE_ID = 'jss-outline-fold-override-v10';
    const ensureFoldStyle = () => {
      let el = document.getElementById(FOLD_STYLE_ID) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = FOLD_STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent = `
        /* 透视源数据表内：去掉所有 material-icons */
        table.jss-outline-table i.material-icons {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          font-size: 0 !important;
          width: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          opacity: 0 !important;
          position: absolute !important;
          left: -9999px !important;
        }
        .jss-outline-root .jss-outline-toggle,
        .jss-outline-table .jss-outline-toggle {
          display: inline-block !important;
          min-width: 1em;
          margin-right: 6px;
          font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #555 !important;
          cursor: pointer !important;
          user-select: none !important;
          vertical-align: middle;
          line-height: 1;
        }
        .jss-outline-root .jss-outline-label,
        .jss-outline-table .jss-outline-label {
          font-weight: 700 !important;
          color: #222 !important;
          vertical-align: middle;
        }
        .jss-outline-root .jss-outline-region-col,
        .jss-outline-table .jss-outline-region-col {
          text-align: left !important;
          font-weight: 700 !important;
        }
        .jss-outline-root .jss-outline-region-col .jss-outline-toggle,
        .jss-outline-table .jss-outline-region-col .jss-outline-toggle {
          color: #555 !important;
          font-size: 11px !important;
          margin-right: 5px !important;
        }
        .jss-outline-root .jss-outline-region-col .jss-outline-label,
        .jss-outline-table .jss-outline-region-col .jss-outline-label {
          font-weight: 700 !important;
          color: #222 !important;
        }
      `;
    };

    const getOutlineTable = (ws: any, fallback?: HTMLElement | null) => {
      const content = ws?.content as HTMLElement | undefined;
      const el = ws?.element as HTMLElement | undefined;
      const tableProp = ws?.table;
      const fromProp =
        typeof tableProp === 'object' && tableProp?.nodeType
          ? (tableProp as HTMLElement)
          : null;
      const table =
        (fromProp?.matches?.('table') ? fromProp : null) ||
        content?.querySelector?.('table.jss') ||
        el?.querySelector?.('table.jss') ||
        fallback?.querySelector?.('table.jss') ||
        (fallback?.matches?.('table') ? fallback : null) ||
        fromProp ||
        content ||
        el ||
        null;
      return table as HTMLElement | null;
    };

    /** 透视源数据表格内：删除全部 i.material-icons */
    const stripMaterialIcons = (scope: HTMLElement | null) => {
      if (!scope) return;
      const table =
        (scope.matches?.('table.jss-outline-table, table.jss') ? scope : null) ||
        scope.querySelector('table.jss-outline-table, table.jss');
      const root = table || scope;
      if (!root.querySelector('i.material-icons')) return;
      root.querySelectorAll('i.material-icons').forEach((icon) => {
        icon.remove();
      });
    };

    /** hideRow 追踪 + 逻辑行号→连续序号（虚拟滚动下滚动不重算） */
    const hiddenRows = new Set<number>();
    const rowSeqMap = new Map<number, number>();

    const rebuildRowSeqMap = () => {
      rowSeqMap.clear();
      let seq = 0;
      const total = outlineSheet.data.length;
      for (let r = 0; r < total; r += 1) {
        if (hiddenRows.has(r)) continue;
        seq += 1;
        rowSeqMap.set(r, seq);
      }
    };

    const writeRowNumberCell = (cell: HTMLElement, seq: number) => {
      cell.querySelectorAll('i').forEach((i) => i.remove());
      let wrote = false;
      Array.from(cell.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        if (!wrote) {
          node.textContent = String(seq);
          wrote = true;
        } else {
          node.textContent = '';
        }
      });
      if (!wrote) {
        cell.insertBefore(document.createTextNode(String(seq)), cell.firstChild);
      }
    };

    /** 按逻辑行号写序号；仅重绘视口内 DOM，避免虚拟滚动时从 1 重排导致滚动跳号 */
    const renumberVisibleRows = (table: HTMLElement | null) => {
      if (outlinePerf || !table || !rowSeqMap.size) return;
      table.querySelectorAll('td.jss_row').forEach((cellEl) => {
        const cell = cellEl as HTMLElement;
        const tr = cell.closest('tr') as HTMLElement | null;
        if (!tr) return;
        try {
          if (
            tr.style.display === 'none' ||
            getComputedStyle(tr).display === 'none' ||
            tr.classList.contains('jss_hidden')
          ) {
            return;
          }
        } catch {
          return;
        }
        const row = Number(
          cell.getAttribute('data-y') ??
            tr.querySelector('td[data-y]')?.getAttribute('data-y'),
        );
        if (!Number.isFinite(row)) return;
        const seq = rowSeqMap.get(row);
        if (seq == null) return;
        writeRowNumberCell(cell, seq);
      });
    };

    const getCellEl = (ws: any, col: number, row: number): HTMLElement | undefined => {
      return (
        ws.getCellFromCoords?.(col, row) ||
        ws.getCell?.(col, row) ||
        ws.records?.[row]?.[col]?.element ||
        undefined
      );
    };

    const setRowVisible = (ws: any, row: number, visible: boolean) => {
      try {
        if (visible) {
          ws.showRow?.(row);
          hiddenRows.delete(row);
        } else {
          ws.hideRow?.(row);
          hiddenRows.add(row);
        }
      } catch {
        // ignore
      }
    };

    const applyOneRegion = (ws: any, row: number) => {
      const cell = regionByRow.get(row);
      if (cell?.kind !== 'region') return;
      const open = !!regionState.get(row);
      if (cell.detailRows?.length) {
        cell.detailRows.forEach((detailRow) => setRowVisible(ws, detailRow, open));
        return;
      }
      eachRegionDetailRow(row, (detailRow) => setRowVisible(ws, detailRow, open));
    };

    const findCategoryStart = (ws: any, targetRow: number) => {
      let catStart = -1;
      Object.keys(ws.rows || {}).forEach((key) => {
        const r = Number(key);
        if (r <= targetRow && ws.rows[r]?.group) catStart = r;
      });
      return catStart;
    };

    const clearOutlineSnapInSpan = (
      tableEl: HTMLElement | null,
      catRow: number,
      span: number,
    ) => {
      if (!tableEl) return;
      for (let r = catRow; r <= catRow + span; r += 1) {
        [0, 1, OUTLINE_PROFIT_COL].forEach((col) => {
          const cell = tableEl.querySelector(
            `td[data-x="${col}"][data-y="${r}"]`,
          ) as HTMLElement | null;
          if (cell) delete cell.dataset.outlineSnap;
        });
      }
    };

    const applyCategoryVisibilityDemo = (ws: any, row: number) => {
      const meta = ws.rows?.[row];
      if (!meta?.group) return;
      const span = Number(meta.group) || 0;
      const open = !!meta.state;
      if (!open) {
        meta.state = false;
        if (outlinePerf) {
          // perf：closeRowGroup 批量收起；展开前需 showRow 清 hide
          for (let i = row + 1; i <= row + span; i += 1) setRowVisible(ws, i, true);
          try {
            ws.closeRowGroup?.(row);
          } catch {
            // ignore
          }
          meta.state = false;
        } else {
          // 非 perf：引擎层保持 open，语义收起只靠 hideRow（勿 closeRowGroup，否则 showRow 无效）
          try {
            ws.openRowGroup?.(row);
          } catch {
            // ignore
          }
          meta.state = false;
        }
        for (let i = row + 1; i <= row + span; i += 1) setRowVisible(ws, i, false);
        return;
      }
      meta.state = true;
      try {
        ws.openRowGroup?.(row);
      } catch {
        // ignore
      }
      meta.state = true;
      for (let i = row + 1; i <= row + span; i += 1) setRowVisible(ws, i, true);
      applyRegionVisibility(ws, { from: row, to: row + span });
    };

    /** Category 语义收起时：仅按 Region 露出必要行；perf 下 openRowGroup 作 DOM 解锁，state 保持 false */
    const applyRegionWhenCategoryCollapsed = (ws: any, catRow: number) => {
      const meta = ws.rows?.[catRow];
      if (!meta?.group || meta.state) return;
      const span = Number(meta.group) || 0;
      meta.state = false;

      try {
        ws.openRowGroup?.(catRow);
      } catch {
        // ignore
      }
      meta.state = false;

      for (let i = catRow + 1; i <= catRow + span; i += 1) setRowVisible(ws, i, false);

      for (let i = catRow + 1; i <= catRow + span; i += 1) {
        let visible = false;
        for (let r = catRow; r <= catRow + span; r += 1) {
          if (!regionByRow.has(r)) continue;
          const regionOpen = !!regionState.get(r);
          if (i === r) {
            if (r > catRow && regionOpen) visible = true;
            break;
          }
          if (!regionOpen) continue;
          if (regionDetailSet(r).has(i)) {
            visible = true;
            break;
          }
        }
        if (visible) setRowVisible(ws, i, true);
      }
    };

    const paintOutlineToggles = (
      ws: any,
      table: HTMLElement | null,
      catRow: number,
      span: number,
      includeRegions: boolean,
    ) => {
      if (!table) return;
      const catCell = table.querySelector(`td[data-x="0"][data-y="${catRow}"]`) as HTMLElement | null;
      const catMeta = foldMetaByKey.get(`0:${catRow}`);
      if (catCell && catMeta) paintCell(ws, catCell, catMeta);
      const headerRegion = regionByRow.get(catRow);
      if (headerRegion) {
        const headerRegionCell = table.querySelector(
          `td[data-x="1"][data-y="${catRow}"]`,
        ) as HTMLElement | null;
        if (headerRegionCell) paintCell(ws, headerRegionCell, headerRegion);
      }
      if (!includeRegions) return;
      for (let r = catRow + 1; r <= catRow + span; r += 1) {
        if (!regionByRow.has(r)) continue;
        const regionCell = table.querySelector(`td[data-x="1"][data-y="${r}"]`) as HTMLElement | null;
        const regionMeta = regionByRow.get(r);
        if (regionCell && regionMeta) paintCell(ws, regionCell, regionMeta);
      }
    };

    /** 解锁所有行组，再按 Category/Region 语义显隐 */
    const unlockRowGroups = (ws: any) => {
      const rowGroups = ws.rows || {};
      Object.keys(rowGroups).forEach((key) => {
        const row = Number(key);
        const meta = rowGroups[row];
        if (!meta?.group) return;
        const wantOpen = !!meta.state;
        try {
          ws.openRowGroup?.(row);
        } catch {
          // ignore
        }
        // openRowGroup 会把 state 设为 true，恢复我们的语义状态
        meta.state = wantOpen;
      });
    };

    /** 只处理展开品类内的 Region；scope 内按行号扫描，避免十万行遍历全表 regionByRow */
    const applyRegionVisibility = (ws: any, scope?: { from: number; to: number }) => {
      if (scope) {
        for (let r = scope.from; r <= scope.to; r += 1) {
          if (regionByRow.has(r)) applyOneRegion(ws, r);
        }
        return;
      }
      const rowGroups = ws.rows || {};
      Object.keys(rowGroups).forEach((key) => {
        const row = Number(key);
        const meta = rowGroups[row];
        if (!meta?.group || !meta.state) return;
        const span = Number(meta.group) || 0;
        applyRegionVisibility(ws, { from: row, to: row + span });
      });
    };

    const syncAllOutline = (ws: any, opts?: { unlock?: boolean }) => {
      if (outlinePerf) return;
      if (opts?.unlock !== false && !outlineBatch) unlockRowGroups(ws);
      const rowGroups = ws.rows || {};
      Object.keys(rowGroups).forEach((key) => {
        const row = Number(key);
        if (!rowGroups[row]?.group) return;
        applyCategoryVisibilityDemo(ws, row);
      });
    };

    /** 首屏：仅对已展开 Category 同步 Region；收起组用 closeRowGroup 批量处理 */
    const syncExpandedCategoryRegions = (ws: any) => {
      const rowGroups = ws.rows || {};
      Object.keys(rowGroups).forEach((key) => {
        const row = Number(key);
        const meta = rowGroups[row];
        if (!meta?.group || !meta.state) return;
        try {
          ws.openRowGroup?.(row);
        } catch {
          // ignore
        }
        meta.state = true;
        applyCategoryVisibilityDemo(ws, row);
      });
    };

    /** 首屏：依赖 rows 初始 state；仅在 idle 时批量 close，避免阻塞首屏绘制 */
    const initCollapsedGroups = (ws: any, onDone?: () => void) => {
      if (!outlinePerf) {
        onDone?.();
        return;
      }
      const initToken = sheetNonce;
      const rowGroups = ws.rows || {};
      const collapsed: number[] = [];
      Object.keys(rowGroups).forEach((key) => {
        const row = Number(key);
        const meta = rowGroups[row];
        if (meta?.group && !meta.state) collapsed.push(row);
      });
      const finish = () => {
        if (disposed || initToken !== sheetNonce) return;
        syncExpandedCategoryRegions(ws);
        onDone?.();
      };
      if (!collapsed.length) {
        finish();
        return;
      }
      let idx = 0;
      const batchSize = 200;
      const run = () => {
        if (disposed || initToken !== sheetNonce) return;
        const end = Math.min(idx + batchSize, collapsed.length);
        for (; idx < end; idx += 1) {
          try {
            ws.closeRowGroup?.(collapsed[idx]);
          } catch {
            // ignore
          }
          if (ws.rows?.[collapsed[idx]]) ws.rows[collapsed[idx]].state = false;
        }
        if (idx < collapsed.length) {
          const ric = (window as any).requestIdleCallback as
            | ((cb: () => void, opts?: { timeout: number }) => number)
            | undefined;
          if (ric) ric(run, { timeout: 1200 });
          else window.setTimeout(run, 0);
          return;
        }
        finish();
      };
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (ric) ric(run, { timeout: 800 });
      else window.setTimeout(run, 0);
    };

    const { stateDetailRows, negProfitRows } = outlineSheet;

    const paintStateDetailCell = (cell: HTMLElement, col: number) => {
      if (cell.dataset.outlineStateCol === String(col)) return;
      cell.dataset.outlineStateCol = String(col);
      cell.classList.add('readonly');
      if (col === 0) {
        cell.classList.add('jss-outline-state-fill');
        return;
      }
      if (col !== 1) return;
      cell.classList.add('jss-outline-state-region');
      if (cell.querySelector('.jss-outline-label')) return;
      const text = (cell.textContent || '').trim();
      cell.innerHTML = `<span class="jss-outline-label">${text}</span>`;
    };

    const paintProfitCell = (cell: HTMLElement, row: number) => {
      const neg = negProfitRows.has(row);
      const hasNeg = cell.classList.contains('jss-outline-neg-profit');
      if (neg === hasNeg) return;
      if (neg) cell.classList.add('jss-outline-neg-profit');
      else cell.classList.remove('jss-outline-neg-profit');
    };

    const paintCell = (
      ws: any,
      cell: HTMLElement,
      meta: OutlineGroupCell,
    ) => {
      const { row, col, label, kind, indent = 0 } = meta;
      const pad = col === 0 ? 8 + indent * 18 : 8 + indent * 16;
      const canFold = kind === 'category' || kind === 'region';
      const expanded =
        kind === 'category'
          ? !!ws.rows?.[row]?.state
          : kind === 'region'
            ? !!regionState.get(row)
            : false;
      const icon = canFold ? (expanded ? '▼' : '▶') : '';
      const snap = `${kind}|${icon}|${label}|${pad}`;
      if (cell.dataset.outlineSnap === snap) return;
      cell.dataset.outlineSnap = snap;

      cell.classList.add('readonly', 'jss-outline-group-cell');
      if (col === 0) cell.classList.add('jss-outline-category-col');
      if (col === 1) cell.classList.add('jss-outline-region-col');
      cell.style.paddingLeft = `${pad}px`;

      const existing = cell.querySelector('.jss-outline-toggle') as HTMLElement | null;
      if (existing) {
        if (canFold) {
          if (existing.textContent !== icon) existing.textContent = icon;
          existing.classList.remove('is-static');
          existing.dataset.row = String(row);
          existing.dataset.kind = kind;
        } else {
          existing.remove();
        }
        let labelEl = cell.querySelector('.jss-outline-label') as HTMLElement | null;
        if (!labelEl) {
          labelEl = document.createElement('span');
          labelEl.className = 'jss-outline-label';
          cell.appendChild(labelEl);
        }
        if (labelEl.textContent !== label) labelEl.textContent = label;
        return;
      }

      if (canFold) {
        cell.innerHTML = `<span class="jss-outline-toggle" data-row="${row}" data-kind="${kind}" contenteditable="false">${icon}</span><span class="jss-outline-label">${label}</span>`;
      } else {
        cell.innerHTML = `<span class="jss-outline-label">${label}</span>`;
      }
    };

    const paint = (ws: any, root: HTMLElement, outlineTable?: HTMLElement | null) => {
      if (disposed || painting) return;
      painting = true;
      try {
        const table =
          outlineTable ||
          getOutlineTable(ws) ||
          (root.querySelector('table.jss-outline-table') as HTMLElement | null);
        if (!outlinePerf) stripMaterialIcons(table);

        // 优先只画可见单元格（虚拟滚动时 groupCells 可能几十万）
        const searchRoot = table || root;
        const visible = searchRoot.querySelectorAll<HTMLElement>(
          `td[data-x="0"], td[data-x="1"], td[data-x="${OUTLINE_PROFIT_COL}"]`,
        );
        if (visible.length) {
          visible.forEach((cell) => {
            if (cell.classList.contains('jss_row')) return;
            const col = Number(cell.getAttribute('data-x'));
            const row = Number(cell.getAttribute('data-y'));
            if (!Number.isFinite(col) || !Number.isFinite(row)) return;
            const meta = foldMetaByKey.get(`${col}:${row}`);
            if (meta) {
              paintCell(ws, cell, meta);
              if (col === OUTLINE_PROFIT_COL) paintProfitCell(cell, row);
              return;
            }
            if (stateDetailRows.has(row)) {
              if (col === 0 || col === 1) paintStateDetailCell(cell, col);
              if (col === OUTLINE_PROFIT_COL) paintProfitCell(cell, row);
            }
          });
        } else {
          // fallback：虚拟滚动首帧尚无 data-x 时，按元数据补绘
          outlineSheet.groupCells.forEach((meta) => {
            const el = getCellEl(ws, meta.col, meta.row);
            if (el) paintCell(ws, el, meta);
          });
        }

        renumberVisibleRows(table);
      } finally {
        painting = false;
      }
    };

    const syncView = (
      ws: any,
      root: HTMLElement,
      scope?: { from: number; to: number },
      outlineTable?: HTMLElement | null,
    ) => {
      if (disposed || bindToken !== sheetNonce) return;
      if (scope) {
        applyRegionVisibility(ws, scope);
      } else {
        syncAllOutline(ws, { unlock: !outlineBatch });
      }
      paint(ws, root, outlineTable);
    };

    const outlineBindKey = `outline-${sheetNonce}`;

    let schedulePaintRef: (() => void) | null = null;

    const stopWatching = () => {
      observer?.disconnect();
      if (scrollTarget && onScrollPaint) {
        scrollTarget.removeEventListener('scroll', onScrollPaint);
      }
      scrollTarget = null;
      onScrollPaint = null;
    };

    const startWatching = (tableEl: HTMLElement, rootEl: HTMLElement) => {
      stopWatching();
      if (disposed) return;

      if (!observer) {
        observer = new MutationObserver(() => {
          if (outlineBulkBusy || outlineInitBusy) return;
          schedulePaintRef?.();
        });
      }
      if (outlineWatchDom) {
        observer.observe(tableEl, { childList: true, subtree: true });
      }

      scrollTarget =
        (rootEl.querySelector('.jss_content') as HTMLElement | null) ||
        (rootEl.querySelector('.jss_worksheet') as HTMLElement | null) ||
        rootEl;
      onScrollPaint = () => schedulePaintRef?.();
      scrollTarget.addEventListener('scroll', onScrollPaint, { passive: true });
      (rootEl as any).__outlineScrollEl = scrollTarget;
      (rootEl as any).__outlineScrollFn = onScrollPaint;
    };

    const detachOutlineDom = (el: HTMLElement | null) => {
      if (!el) return;
      const prevClick = (el as any).__outlineClickHandler as
        | ((e: MouseEvent) => void)
        | undefined;
      if (prevClick) {
        el.removeEventListener('click', prevClick, true);
        delete (el as any).__outlineClickHandler;
      }
      delete (el as any).__outlineBindKey;
      const prevScrollEl = (el as any).__outlineScrollEl as HTMLElement | null | undefined;
      const prevScrollFn = (el as any).__outlineScrollFn as (() => void) | null | undefined;
      if (prevScrollEl && prevScrollFn) {
        prevScrollEl.removeEventListener('scroll', prevScrollFn);
        delete (el as any).__outlineScrollEl;
        delete (el as any).__outlineScrollFn;
      }
      const prevTab = (el as any).__outlineOnTab as (() => void) | undefined;
      const prevTabEls = (el as any).__outlineTabEls as NodeListOf<Element> | undefined;
      if (prevTab && prevTabEls) prevTabEls.forEach((node) => node.removeEventListener('click', prevTab));
      delete (el as any).__outlineOnTab;
      delete (el as any).__outlineTabEls;
    };

    const bind = () => {
      const ws = getWorksheetByName(spreadsheet, '透视源数据');
      if (!ws) return false;
      const table = getOutlineTable(ws);
      if (!table) return false;

      const root =
        (table.closest('.jss_container') as HTMLElement) ||
        (ws.element as HTMLElement) ||
        (table.closest('.jss_worksheet, .jss_content, .jss') as HTMLElement) ||
        table;

      const outlineBindKey = `outline-${sheetNonce}`;
      if ((root as any).__outlineBindKey === outlineBindKey) return true;

      ensureFoldStyle();
      root.classList.add('jss-outline-root');
      table.classList.add('jss-outline-table');
      stripMaterialIcons(table);
      detachOutlineDom(root);

      boundRoot = root;

      clickHandler = (e: MouseEvent) => {
        if (outlineInitBusy || outlineBulkBusy) return;
        const target = e.target as HTMLElement | null;
        const toggle = target?.closest?.('.jss-outline-toggle') as HTMLElement | null;
        if (!toggle || !root.contains(toggle)) return;
        const kind = toggle.dataset.kind;
        if (kind !== 'category' && kind !== 'region') return;

        e.preventDefault();
        e.stopPropagation();
        const row = Number(toggle.dataset.row);
        if (!Number.isFinite(row)) return;

        if (kind === 'category') {
          const groupMeta = ws.rows?.[row];
          if (groupMeta?.group == null || groupMeta.group <= 0) return;
          const span = Number(groupMeta.group) || 0;
          const nextOpen = !groupMeta.state;
          groupMeta.state = nextOpen;
          if (!nextOpen) {
            // Category 收起：第二列同步显示 ▶（子行已隐藏，Region 语义状态一并复位）
            regionState.set(row, false);
            regionByRow.forEach((_c, r) => {
              if (r > row && r <= row + span) regionState.set(r, false);
            });
          }
          applyCategoryVisibilityDemo(ws, row);
          rebuildRowSeqMap();
          clearOutlineSnapInSpan(table, row, span);
          paint(ws, root, table);
          requestAnimationFrame(() => {
            if (disposed || bindToken !== sheetNonce) return;
            paint(ws, root, table);
          });
          return;
        }

        const meta = regionByRow.get(row);
        if (meta?.kind !== 'region') return;

        const next = !regionState.get(row);
        regionState.set(row, next);

        const catStart = findCategoryStart(ws, row);
        if (catStart >= 0 && !ws.rows[catStart]?.state) {
          applyRegionWhenCategoryCollapsed(ws, catStart);
          ws.rows[catStart].state = false;
          const span = Number(ws.rows[catStart]?.group) || 0;
          rebuildRowSeqMap();
          clearOutlineSnapInSpan(table, catStart, span);
          paint(ws, root, table);
          return;
        }
        applyOneRegion(ws, row);
        const catSpan =
          catStart >= 0 ? Number(ws.rows[catStart]?.group) || 0 : 0;
        rebuildRowSeqMap();
        if (catStart >= 0) clearOutlineSnapInSpan(table, catStart, catSpan);
        paint(ws, root, table);
      };
      (root as any).__outlineClickHandler = clickHandler;
      (root as any).__outlineBindKey = outlineBindKey;
      root.addEventListener('click', clickHandler, true);

      const schedulePaint = () => {
        if (disposed || outlineBulkBusy || outlineInitBusy) return;
        if (paintTimer) window.clearTimeout(paintTimer);
        const debounceMs = outlineBatch ? 80 : 32;
        paintTimer = window.setTimeout(() => {
          paintTimer = undefined;
          if (disposed || outlineBulkBusy || outlineInitBusy) return;
          if (!outlinePerf) stripMaterialIcons(table);
          paint(ws, root, table);
        }, debounceMs);
      };
      schedulePaintRef = schedulePaint;

      const flushPaint = () => {
        if (paintTimer) window.clearTimeout(paintTimer);
        paintTimer = undefined;
        if (!outlinePerf) stripMaterialIcons(table);
        paint(ws, root, table);
      };

      const onTab = () => {
        if (tabTimer) window.clearTimeout(tabTimer);
        tabTimer = window.setTimeout(() => {
          tabTimer = undefined;
          if (disposed || bindToken !== sheetNonce) return;
          schedulePaint();
        }, 80);
      };

      const tabEls = root.querySelectorAll('.jtabs-container, .jss_tabs, [class*="jtabs"]');
      tabEls.forEach((el) => el.addEventListener('click', onTab));
      (root as any).__outlineOnTab = onTab;
      (root as any).__outlineTabEls = tabEls;

      const listCategoryRows = (sheet: any) => {
        const rowGroups = sheet.rows || {};
        return Object.keys(rowGroups)
          .map(Number)
          .filter((r) => rowGroups[r]?.group)
          .sort((a, b) => a - b);
      };

      const runOutlineBatch = (
        rows: number[],
        batchSize: number,
        fn: (row: number) => void,
        onDone: () => void,
      ) => {
        if (!rows.length) {
          onDone();
          return;
        }
        let idx = 0;
        const run = () => {
          if (disposed || bindToken !== sheetNonce) return;
          const end = Math.min(idx + batchSize, rows.length);
          for (; idx < end; idx += 1) fn(rows[idx]);
          if (idx < rows.length) {
            const ric = (window as any).requestIdleCallback as
              | ((cb: () => void, opts?: { timeout: number }) => number)
              | undefined;
            const cancelRic = (window as any).cancelIdleCallback as
              | ((id: number) => void)
              | undefined;
            if (ric) {
              const idleId = ric(run, { timeout: 800 });
              pendingIdle.push(idleId);
            } else {
              const tid = window.setTimeout(run, 0);
              initTimers.push(tid);
            }
            return;
          }
          onDone();
        };
        run();
      };

      outlineBridge.expandAll = (onDone) => {
        outlineBulkBusy = true;
        // 全部展开：Category + Region 第二列一并展开
        regionByRow.forEach((_, r) => regionState.set(r, true));
        const cats = listCategoryRows(ws);
        const expandOne = (row: number) => {
          ws.rows[row].state = true;
          applyCategoryVisibilityDemo(ws, row);
        };
        const finish = () => {
          outlineBulkBusy = false;
          rebuildRowSeqMap();
          flushPaint();
          onDone?.();
        };
        if (outlineBatch && cats.length > 5) {
          runOutlineBatch(cats, outlinePerf ? 60 : 6, expandOne, finish);
        } else {
          cats.forEach(expandOne);
          finish();
        }
      };

      outlineBridge.collapseAll = (onDone) => {
        outlineBulkBusy = true;
        regionByRow.forEach((_, r) => regionState.set(r, false));
        const cats = listCategoryRows(ws);
        const collapseOne = (row: number) => {
          ws.rows[row].state = false;
          applyCategoryVisibilityDemo(ws, row);
        };
        const finish = () => {
          outlineBulkBusy = false;
          rebuildRowSeqMap();
          flushPaint();
          onDone?.();
        };
        if (outlineBatch && cats.length > 5) {
          runOutlineBatch(cats, outlinePerf ? 120 : 10, collapseOne, finish);
        } else {
          cats.forEach(collapseOne);
          finish();
        }
      };

      const applyInitialOutlineVisibility = (onDone: () => void) => {
        const cats = listCategoryRows(ws);
        const applyOne = (row: number) => applyCategoryVisibilityDemo(ws, row);
        if (cats.length > 6) {
          runOutlineBatch(cats, outlineBatch ? 8 : 4, applyOne, onDone);
          return;
        }
        cats.forEach(applyOne);
        onDone();
      };

      const finishOutlineInit = () => {
        if (disposed || bindToken !== sheetNonce) return;
        outlineInitBusy = false;
        rebuildRowSeqMap();
        flushPaint();
        startWatching(table, root);
      };

      if (outlinePerf) {
        outlineInitBusy = true;
        initCollapsedGroups(ws, () => {
          if (!disposed && bindToken === sheetNonce) finishOutlineInit();
        });
      } else {
        outlineInitBusy = true;
        applyInitialOutlineVisibility(finishOutlineInit);
      }
      return true;
    };

    const clearOutlineTimers = () => {
      if (paintTimer) window.clearTimeout(paintTimer);
      if (tabTimer) window.clearTimeout(tabTimer);
      initTimers.forEach((id) => window.clearTimeout(id));
      initTimers.length = 0;
      const cancelRic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;
      if (cancelRic) pendingIdle.forEach((id) => cancelRic(id));
      pendingIdle.length = 0;
    };

    if (bind()) {
      return () => {
        disposed = true;
        outlineBridge.expandAll = () => {};
        outlineBridge.collapseAll = () => {};
        clearOutlineTimers();
        stopWatching();
        detachOutlineDom(boundRoot);
        if (boundRoot) {
          delete (boundRoot as any).__outlineOnTab;
          delete (boundRoot as any).__outlineTabEls;
        }
      };
    }

    const timer = window.setInterval(() => {
      if (bind()) window.clearInterval(timer);
    }, 50);
    return () => {
      disposed = true;
      outlineBridge.expandAll = () => {};
      outlineBridge.collapseAll = () => {};
      clearOutlineTimers();
      stopWatching();
      window.clearInterval(timer);
      observer?.disconnect();
      detachOutlineDom(boundRoot);
      if (boundRoot) {
        delete (boundRoot as any).__outlineOnTab;
        delete (boundRoot as any).__outlineTabEls;
      }
    };
  }, [outlineSheet, sheetNonce, isOutlinePerf]);

  // 全表：表头列组折叠 add/remove(+/-) → data-fold，由 CSS 画 ▼/▶
  useEffect(() => {
    let disposed = false;
    let root: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let timer: number | undefined;
    let poll: number | undefined;

    const markHeaderFoldIcons = (container: HTMLElement) => {
      container.querySelectorAll<HTMLElement>('.jss_header > i, td.jss_header > i').forEach((icon) => {
        const parent = icon.parentElement;
        if (!parent) return;
        if (parent.classList.contains('jss_filters_icon')) return;
        if (parent.classList.contains('jss_row')) return;
        if (icon.closest('td.jss_row')) return;
        // 透视源数据表：不把 material-icons 转成三角，后面统一删除
        if (icon.closest('table.jss-outline-table')) return;

        const raw = (icon.textContent || '').trim();
        // 已标记过且库未改回 add/remove，保持
        const prev = icon.getAttribute('data-fold');
        let next: 'open' | 'closed' | null = null;
        if (
          raw === 'add' ||
          raw === '+' ||
          raw === '▶' ||
          raw === '▸' ||
          raw === 'keyboard_arrow_right' ||
          raw === 'arrow-up' ||
          raw === 'expand'
        ) {
          next = 'closed';
        } else if (
          raw === 'remove' ||
          raw === '-' ||
          raw === '−' ||
          raw === '▼' ||
          raw === '▾' ||
          raw === 'keyboard_arrow_down' ||
          raw === 'arrow-down' ||
          raw === 'collapse'
        ) {
          next = 'open';
        } else if (prev === 'open' || prev === 'closed') {
          // 库可能清空了文本，保留原状态
          return;
        } else {
          return;
        }

        icon.textContent = next === 'closed' ? '▶' : '▼';
        icon.classList.remove('material-icons');
        icon.classList.add('jss-col-fold-toggle', 'jss-fold-tri');
        if (prev !== next) icon.setAttribute('data-fold', next);
        icon.style.cssText =
          'font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif!important;font-size:12px!important;font-weight:700!important;font-style:normal!important;color:#555!important;line-height:1!important;display:inline-block!important;cursor:pointer!important;position:absolute!important;right:4px!important;top:50%!important;transform:translateY(-50%)!important;z-index:5!important;';
      });
      // 透视源数据：表内残留的 material-icons 全部移除
      container.querySelectorAll('table.jss-outline-table i.material-icons').forEach((icon) => {
        icon.remove();
      });
    };

    const bind = () => {
      const sheetRoot = document.querySelector('.jss-page__sheet') as HTMLElement | null;
      if (!sheetRoot) return false;
      const list = getWorksheetList(spreadsheet);
      root =
        (list[0]?.parent?.element as HTMLElement | undefined) ||
        (sheetRoot.querySelector('.jss_container') as HTMLElement | null) ||
        sheetRoot;

      markHeaderFoldIcons(root);

      if ((root as any).__colFoldIconBound) return true;
      (root as any).__colFoldIconBound = true;

      observer = new MutationObserver(() => {
        if (disposed || !root) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => root && markHeaderFoldIcons(root), 0);
      });
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class'],
      });

      poll = window.setInterval(() => {
        if (!disposed && root) markHeaderFoldIcons(root);
      }, 400);

      return true;
    };

    if (!bind()) {
      const boot = window.setInterval(() => {
        if (bind()) window.clearInterval(boot);
      }, 50);
      return () => {
        disposed = true;
        window.clearInterval(boot);
        window.clearInterval(poll);
        window.clearTimeout(timer);
        observer?.disconnect();
        if (root) delete (root as any).__colFoldIconBound;
      };
    }

    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.clearTimeout(timer);
      observer?.disconnect();
      if (root) delete (root as any).__colFoldIconBound;
    };
  }, [sheetNonce]);

  const stringifyValue = useCallback((value: any): string => {
    if (value == null || value === '') return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).join(', ');
    if (typeof value === 'object') {
      if ('value' in value) return stringifyValue((value as any).value);
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return String(value);
  }, []);

  const pushTrack = useCallback(
    (cell: string, from: any, to: any) => {
      if (!cell) return;
      const fromText = stringifyValue(from);
      const toText = stringifyValue(to);
      if (fromText === toText) return;
      const item: TrackItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        cell,
        from: fromText,
        to: toText,
        time: new Date().toLocaleString(),
      };
      setTracks((prev) => {
        const last = prev[0];
        if (last && last.cell === cell && last.from === fromText && last.to === toText) {
          return prev;
        }
        return [item, ...prev].slice(0, 200);
      });
    },
    [stringifyValue],
  );

  const syncAmount = useCallback((worksheet: any, col: number, row: number) => {
    if (col !== 5 && col !== 6) return;
    const qty = Number(worksheet.getValueFromCoords?.(5, row) ?? 0);
    const price = Number(worksheet.getValueFromCoords?.(6, row) ?? 0);
    if (Number.isNaN(qty) || Number.isNaN(price)) return;
    const amount = Number((qty * price).toFixed(2));
    const prev = worksheet.getValueFromCoords?.(7, row);
    if (Number(prev) === amount) return;
    const ignore = (jspreadsheet as any).history;
    if (ignore) ignore.ignore = true;
    worksheet.setValueFromCoords?.(7, row, amount, true);
    if (ignore) ignore.ignore = false;
  }, []);

  historyBridge.onChange = (worksheet, x, y, oldValue, newValue) => {
    const col = Number(x);
    const row = Number(y);
    const name = cellName(col, row);
    if (!name) return;
    setHistoryCell(name);
    pushTrack(name, oldValue, newValue);
    syncAmount(worksheet, col, row);
  };

  historyBridge.onSelect = (_worksheet, px, py, ux, uy) => {
    const start = cellName(Number(px), Number(py));
    const end = cellName(Number(ux), Number(uy));
    if (!start) return;
    setHistoryCell(start === end ? start : `${start}:${end}`);
  };

  // 高级批注扩展写入的是对象数组；不要再压成字符串，否则红三角弹层为空
  const onbeforecomments = useCallback((_ws: any, cells: Record<string, any>) => {
    const next: Record<string, any> = {};
    Object.keys(cells || {}).forEach((key) => {
      const val = cells[key];
      if (val == null || val === '') {
        next[key] = '';
        return;
      }
      if (typeof val === 'string' || Array.isArray(val)) {
        next[key] = val;
        return;
      }
      if (typeof val === 'object' && (val.comments != null || val.text != null)) {
        next[key] = [val];
        return;
      }
      next[key] = '';
    });
    return next;
  }, []);

  const handleAttachFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const target = attachTarget.current;
      const ws =
        getWorksheetByName(spreadsheet, '订单明细') ||
        getActiveWorksheet(spreadsheet);
      e.target.value = '';
      if (!file || !target || !ws) return;

      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        // 附件列存文件名（可点开看 meta 里的 dataURL）
        ws.setValueFromCoords(8, target.y, file.name, true);
        ws.setMeta(cellName(8, target.y), {
          attachmentName: file.name,
          attachmentType: file.type,
          attachmentSize: file.size,
          attachmentDataUrl: url,
        });
        pushTrack(cellName(8, target.y), '', `[附件] ${file.name}`);
        message.success(`已添加附件：${file.name}`);
      };
      reader.readAsDataURL(file);
    },
    [pushTrack],
  );

  const contextMenu = useCallback(
    (
      instance: any,
      x: number,
      y: number,
      _e: MouseEvent,
      items: any[],
      section: string,
    ) => {
      if (section !== 'cell' && section !== 'header') return items;

      items.push({ type: 'line' });
      items.push({
        title: '查看单元格历史',
        icon: 'history',
        onclick: () => {
          if (typeof x === 'number' && typeof y === 'number') {
            setHistoryCell(cellName(x, y));
          }
        },
      });
      items.push({
        title: '添加单元格附件',
        icon: 'attach_file',
        onclick: () => {
          if (typeof x !== 'number' || typeof y !== 'number') return;
          attachTarget.current = { x, y };
          fileInputRef.current?.click();
        },
      });
      items.push({
        title: '批量复制选区',
        icon: 'content_copy',
        onclick: () => {
          instance.copy?.();
          message.success('已复制选区到剪贴板');
        },
      });
      items.push({
        title: '隐藏当前列',
        icon: 'visibility_off',
        onclick: () => {
          if (typeof x === 'number') instance.hideColumn(x);
        },
      });
      items.push({
        title: '显示全部隐藏列',
        icon: 'visibility',
        onclick: () => {
          const total = instance.getHeaders?.()?.length ?? columns.length;
          instance.showColumn(Array.from({ length: total }, (_, i) => i));
        },
      });
      items.push({
        title: '展开行组（下钻）',
        icon: 'unfold_more',
        onclick: () => instance.openRowGroup(typeof y === 'number' ? y : undefined),
      });
      items.push({
        title: '折叠行组（上钻）',
        icon: 'unfold_less',
        onclick: () => instance.closeRowGroup(typeof y === 'number' ? y : undefined),
      });
      items.push({
        title: '展开列组',
        icon: 'view_column',
        onclick: () => instance.openColumnGroup(typeof x === 'number' ? x : undefined),
      });
      items.push({
        title: '折叠列组',
        icon: 'view_week',
        onclick: () => instance.closeColumnGroup(typeof x === 'number' ? x : undefined),
      });

      return items;
    },
    [columns.length],
  );

  const toolbar = useCallback((defaultToolbar: any) => {
    const ws = () =>
      getActiveWorksheet(spreadsheet) ||
      getWorksheetByName(spreadsheet, '订单明细');

    const isOutlineSheetActive = () => {
      const sheet = getActiveWorksheet(spreadsheet);
      const name = sheet?.options?.worksheetName || sheet?.getWorksheetName?.();
      return name === '透视源数据';
    };

    const extraItems = [
      { type: 'divisor' },
      {
        content: 'expand_all',
        tooltip: '透视源数据：全部展开（Category 行组）',
        render: renderOutlineToolbarIcon('expand_all'),
        onclick: () => {
          if (!isOutlineSheetActive()) {
            message.warning('请先切换到「透视源数据」工作表');
            return;
          }
          if (!getWorksheetByName(spreadsheet, '透视源数据')) return;
          message.loading({ content: '正在全部展开…', key: 'outline-fold-all', duration: 0 });
          outlineBridge.expandAll(() => {
            message.success({ content: '已全部展开', key: 'outline-fold-all' });
          });
        },
      },
      {
        content: 'collapse_all',
        tooltip: '透视源数据：全部折叠（Category 行组）',
        render: renderOutlineToolbarIcon('collapse_all'),
        onclick: () => {
          if (!isOutlineSheetActive()) {
            message.warning('请先切换到「透视源数据」工作表');
            return;
          }
          if (!getWorksheetByName(spreadsheet, '透视源数据')) return;
          message.loading({ content: '正在全部折叠…', key: 'outline-fold-all', duration: 0 });
          outlineBridge.collapseAll(() => {
            message.success({ content: '已全部折叠', key: 'outline-fold-all' });
          });
        },
      },
      { type: 'divisor' },
      {
        content: 'content_copy',
        tooltip: '批量复制选区',
        onclick: () => {
          ws()?.copy?.();
          message.success('已复制选区');
        },
      },
      {
        content: 'search',
        tooltip: '快速搜索',
        onclick: () => {
          const sheet = ws();
          sheet?.showSearch?.();
          (search as any)?.(sheet);
        },
      },
      { type: 'divisor' },
      {
        content: 'unfold_more',
        tooltip: '下钻：展开行组',
        onclick: () => ws()?.openRowGroup?.(),
      },
      {
        content: 'unfold_less',
        tooltip: '上钻：折叠行组',
        onclick: () => ws()?.closeRowGroup?.(),
      },
      {
        content: 'view_column',
        tooltip: '展开多列分组',
        onclick: () => ws()?.openColumnGroup?.(),
      },
      {
        content: 'view_week',
        tooltip: '折叠多列分组',
        onclick: () => ws()?.closeColumnGroup?.(),
      },
      { type: 'divisor' },
      {
        content: 'visibility_off',
        tooltip: '隐藏选中列',
        onclick: () => {
          const sheet = ws();
          const selected = sheet?.getSelectedColumns?.() || [];
          if (!selected.length) {
            message.warning('请先选中列');
            return;
          }
          sheet.hideColumn(selected);
        },
      },
      {
        content: 'visibility',
        tooltip: '显示全部隐藏列',
        onclick: () => {
          const sheet = ws();
          const total = sheet?.getHeaders?.()?.length ?? columns.length;
          sheet?.showColumn?.(Array.from({ length: total }, (_, i) => i));
        },
      },
      {
        content: 'width_wide',
        tooltip: '自适应内容宽度',
        onclick: () => {
          ws()?.autoWidth?.();
          message.success('已按内容自适应列宽');
        },
      },
      {
        content: 'download',
        tooltip: '导出 CSV',
        onclick: () => ws()?.download?.(),
      },
    ];

    // 官方约定：回调收到 { items, responsive, ... }，应原地追加，保留撤销/重做等默认项样式
    if (defaultToolbar && Array.isArray(defaultToolbar.items)) {
      defaultToolbar.items.push(...extraItems);
      return defaultToolbar;
    }
    if (Array.isArray(defaultToolbar)) {
      defaultToolbar.push(...extraItems);
      return defaultToolbar;
    }
    return { items: extraItems, responsive: true };
  }, [columns.length, message, spreadsheet]);

  const focusCell = historyCell.split(':')[0];
  const cellHistory = useMemo(
    () => tracks.filter((item) => item.cell === focusCell),
    [tracks, focusCell],
  );

  return (
    <div className="jss-page">
      <p className="jss-page__hint">
        「订单明细已集成：批注 / 下钻上钻 / 回撤 / 批量复制 / 多行列折叠 / 自定义右键 /
        下拉·日期·数值 / 单元格历史 / 数据追踪 / 快速搜索 / 显隐列 / 附件 / 大数据虚拟滚动 /
        列宽拖动 / 自适应列宽。「透视源数据」：Category / Region 折叠；状态(下拉)、下单日期、Sales/Profit(数值) 可编辑；
        「透视分析」读「透视底表」。
      </p>

      <div className="jss-page__outline-tools">
        <span className="jss-page__outline-tools-label">订单明细 · 数据量</span>
        <Select
          size="small"
          style={{ width: 200 }}
          value={orderScale}
          options={ORDER_SCALE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => handleOrderScaleChange(v as OrderScale)}
          disabled={sheetBusy}
        />
        <span className="jss-page__outline-tools-label">透视源数据 · 数据量</span>
        <Select
          size="small"
          style={{ width: 200 }}
          value={outlineScale}
          options={OUTLINE_SCALE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => handleOutlineScaleChange(v as OutlineScale)}
        />
        {sheetLoadInfo ? (
          <span className="jss-page__outline-tools-meta">{sheetLoadInfo}</span>
        ) : (
          <span className="jss-page__outline-tools-meta">
            订单明细 / 透视源数据均可压测虚拟滚动（10 万 / 100 万行）
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.csv,.xlsx"
        style={{ display: 'none' }}
        onChange={handleAttachFile}
      />

      <div className="jss-page__body">
        <div className={`jss-page__sheet${sheetBusy ? ' is-loading' : ''}`}>
          {sheetBusy ? (
            <div className="jss-page__sheet-loading">
              <Spin size="large" tip={sheetLoadInfo || '加载中…'} />
            </div>
          ) : null}
          <Spreadsheet
            key={`jss-sheet-${sheetNonce}`}
            ref={spreadsheet}
            toolbar={toolbar}
            bar={true}
            extensions={extensions}
            plugins={{ cellHistory: cellHistoryPlugin }}
            tabs={true}
            tableOverflow={true}
            tableWidth="100%"
            tableHeight="560px"
            onevent={(event: string, ...rest: any[]) => {
              cellHistoryPlugin.onevent(event, ...rest);
            }}
            onchange={(
              worksheet: any,
              _cell: any,
              x: any,
              y: any,
              newValue: any,
              oldValue: any,
            ) => {
              historyBridge.onChange(worksheet, x, y, oldValue, newValue);
            }}
            onselection={(worksheet: any, px: any, py: any, ux: any, uy: any) => {
              historyBridge.onSelect(worksheet, px, py, ux, uy);
            }}
            onbeforecomments={onbeforecomments}
            contextMenu={contextMenu}
          >
            <Worksheet
              worksheetName="订单明细"
              data={orderData}
              columns={orderColumns as any}
              nestedHeaders={nestedHeaders}
              rows={isOrderPerf ? undefined : orderRows}
              comments={isOrderPerf ? undefined : commentsData}
              allowComments={!isOrderPerf}
              search={!isOrderPerf}
              filters={!isOrderPerf}
              columnResize={true}
              columnDrag={!isOrderPerf}
              rowResize={!isOrderPerf}
              fillHandle={!isOrderPerf}
              editable={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
              // 纵向虚拟滚动保性能；横向关掉，降低 dropdown 列错位/错显概率
              virtualizationX={false}
              virtualizationY={true}
              pagination={false}
            />
            <Worksheet
              worksheetName="透视分析"
              pivotTables={pivotTables as any}
              minDimensions={[16, 28]}
            />
            <Worksheet
              worksheetName="透视源数据"
              data={outlineSheet.data}
              columns={outlineColumns}
              rows={outlineSheet.rows}
              cells={outlineReadonlyCells}
              filters={!isOutlinePerf}
              columnResize={true}
              rowResize={!isOutlinePerf}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
              virtualizationX={false}
              virtualizationY={true}
              pagination={false}
              oneditionstart={(_ws: any, _cell: any, x: any) => {
                const col = Number(x);
                if (col === 0 || col === 1) return false;
                return true;
              }}
            />
            <Worksheet
              worksheetName="透视底表"
              data={pivotSourceData}
              columns={pivotSourceColumns}
              columnResize={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
            />
          </Spreadsheet>
        </div>

        <aside className="jss-page__side">
          <section className="jss-panel" style={{ flex: 1.2 }}>
            <div className="jss-panel__title">数据追踪（最近变更）</div>
            {tracks.length === 0 ? (
              <div className="jss-panel__empty">编辑任意单元格后，变更会记录在这里。</div>
            ) : (
              <ul className="jss-panel__list">
                {tracks.slice(0, 40).map((item) => (
                  <li key={item.id} className="jss-panel__item">
                    <div>
                      <strong>{item.cell}</strong>
                      <span className="jss-panel__meta"> · {item.time}</span>
                    </div>
                    <div>
                      {item.from || '∅'} → {item.to || '∅'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="jss-panel" style={{ flex: 1 }}>
            <div className="jss-panel__title">单元格历史 · {focusCell || historyCell}</div>
            {cellHistory.length === 0 ? (
              <div className="jss-panel__empty">
                双击编辑当前单元格并确认后，这里会列出该格的变更历史。
              </div>
            ) : (
              <ul className="jss-panel__list">
                {cellHistory.map((item) => (
                  <li key={item.id} className="jss-panel__item">
                    <div className="jss-panel__meta">{item.time}</div>
                    <div>
                      {item.from || '∅'} → {item.to || '∅'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
