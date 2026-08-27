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
    expanded: true,
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

function buildOutlineFromCats(
  cats: OutlineCatInput[],
  opts?: { liteStyle?: boolean },
): OutlineSheet {
  const liteStyle = !!opts?.liteStyle;
  const data: any[][] = [];
  const rows: Record<number, { group: number; state: boolean }> = {};
  const mergeCells: Record<string, [number, number]> = {};
  const style: Record<string, string> = {};
  const groupCells: OutlineGroupCell[] = [];
  const catBold = 'font-weight: 700; color: #222; background-color: #e8f1f8;';
  const regionBold = 'font-weight: 700; color: #222;';
  const negProfit = 'color: #d4380d;';
  const stateCount = EAST_STATES.length;
  let seed = 1;

  let r = 0;
  cats.forEach((cat) => {
    const catStart = r;
    const catSales = round2(cat.children.reduce((a, c) => a + c.sales, 0));
    const catProfit = round2(cat.children.reduce((a, c) => a + c.profit, 0));

    data.push([cat.name, 'East', catSales, catProfit]);
    groupCells.push({ row: catStart, col: 0, label: cat.name, kind: 'category', indent: 0 });
    const catRegionCell: OutlineGroupCell = {
      row: catStart,
      col: 1,
      label: 'East',
      kind: 'region',
      indent: 0,
      detailRows: [],
      expanded: false,
    };
    groupCells.push(catRegionCell);
    style[`A${catStart + 1}`] = catBold;
    style[`B${catStart + 1}`] = regionBold;
    if (catProfit < 0) style[`D${catStart + 1}`] = negProfit;
    r += 1;

    splitToStates(catSales, catProfit, seed++).forEach((st) => {
      data.push(['', st.name, st.sales, st.profit]);
      catRegionCell.detailRows!.push(r);
      // 大数据量不给州行建 leaf 元数据，折叠箭头只挂在 Category/Region
      if (!liteStyle) {
        groupCells.push({ row: r, col: 1, label: st.name, kind: 'leaf', indent: 1 });
        style[`A${r + 1}`] = 'background-color: #e8f1f8;';
        style[`B${r + 1}`] = regionBold;
        if (st.profit < 0) style[`D${r + 1}`] = negProfit;
      } else if (st.profit < 0) {
        style[`D${r + 1}`] = negProfit;
      }
      r += 1;
    });
    mergeCells[`A${catStart + 1}`] = [1, 1 + stateCount];

    cat.children.forEach((sub) => {
      const subStart = r;
      data.push([sub.name, 'East', sub.sales, sub.profit]);
      groupCells.push({ row: subStart, col: 0, label: sub.name, kind: 'leaf', indent: 1 });
      const subRegionCell: OutlineGroupCell = {
        row: subStart,
        col: 1,
        label: 'East',
        kind: 'region',
        indent: 0,
        detailRows: [],
        expanded: false,
      };
      groupCells.push(subRegionCell);
      style[`A${subStart + 1}`] = catBold;
      style[`B${subStart + 1}`] = regionBold;
      if (sub.profit < 0) style[`D${subStart + 1}`] = negProfit;
      r += 1;

      splitToStates(sub.sales, sub.profit, seed++).forEach((st) => {
        data.push(['', st.name, st.sales, st.profit]);
        subRegionCell.detailRows!.push(r);
        if (!liteStyle) {
          groupCells.push({ row: r, col: 1, label: st.name, kind: 'leaf', indent: 1 });
          style[`A${r + 1}`] = 'background-color: #e8f1f8;';
          style[`B${r + 1}`] = regionBold;
          if (st.profit < 0) style[`D${r + 1}`] = negProfit;
        } else if (st.profit < 0) {
          style[`D${r + 1}`] = negProfit;
        }
        r += 1;
      });
      mergeCells[`A${subStart + 1}`] = [1, 1 + stateCount];
    });

    rows[catStart] = { group: r - catStart - 1, state: cat.expanded };
  });

  return { data, rows, mergeCells, style, groupCells };
}

/** 任意数据量都生成可折叠树；大数据用 liteStyle 减轻元数据 */
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

  const liteStyle = count > 10000;
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
      // 大数据默认只展开第一组，避免首屏 hideRow 扫全表
      expanded: i === 0,
      children,
    });
    approx += outlineRowsForCat(children.length);
    i += 1;
    if (i > 500000) break;
  }

  return buildOutlineFromCats(cats, { liteStyle });
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
      if (sheetBusy) return;
      if (value === outlineScale) return;

      const label =
        value === 'demo' ? '演示折叠树' : `${Number(value).toLocaleString()} 行`;
      setOutlineBusy(true);
      setOutlineScale(value);
      setOutlineLoadInfo(`正在生成透视源数据（${label}）…`);

      window.setTimeout(() => {
        const t0 = performance.now();
        try {
          const next =
            value === 'demo'
              ? buildOutlineSourceSheet('demo')
              : buildOutlineSourceSheet(Number(value));
          const genCost = Math.round(performance.now() - t0);
          const rows = next.data.length;
          setOutlineLoadInfo(
            `${rows.toLocaleString()} 行已生成（${genCost}ms），正在渲染表格…`,
          );

          destroySpreadsheet();
          setOutlineSheet(next);
          setSheetNonce((n) => n + 1);

          window.setTimeout(() => {
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
    [sheetBusy, outlineScale, destroySpreadsheet, openOutlineWorksheet, message],
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
   * - 行维度：Category → SubCategory（多行折叠，▼/▶）
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
      { type: 'text', title: 'Category', width: 180, readOnly: true, align: 'left' as const },
      { type: 'text', title: 'Region', width: 120, readOnly: true, align: 'left' as const },
      {
        type: 'numeric',
        title: 'Sales',
        width: 130,
        mask: '$#,##0.00',
        align: 'right' as const,
      },
      {
        type: 'numeric',
        title: 'Profit',
        width: 130,
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

    let disposed = false;
    let painting = false;
    let observer: MutationObserver | null = null;
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let boundRoot: HTMLElement | null = null;

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

    const FOLD_STYLE_ID = 'jss-outline-fold-override-v4';
    const ensureFoldStyle = () => {
      let el = document.getElementById(FOLD_STYLE_ID) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = FOLD_STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent = `
        .jss-outline-table td.jss_row > i,
        .jss-outline-root td.jss_row > i,
        .jss_container td.jss_row > i {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          font-size: 0 !important;
          width: 0 !important;
          height: 0 !important;
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

    const getCellEl = (ws: any, col: number, row: number): HTMLElement | undefined => {
      return (
        ws.getCellFromCoords?.(col, row) ||
        ws.getCell?.(col, row) ||
        ws.records?.[row]?.[col]?.element ||
        undefined
      );
    };

    const applyOneRegion = (ws: any, row: number) => {
      const cell = regionByRow.get(row);
      if (!cell?.detailRows?.length) return;
      const open = !!regionState.get(row);
      cell.detailRows.forEach((detailRow) => {
        try {
          if (open) ws.showRow?.(detailRow);
          else ws.hideRow?.(detailRow);
        } catch {
          // ignore
        }
      });
    };

    /** 只处理展开品类内的 Region，避免百万行全表 hideRow */
    const applyRegionVisibility = (ws: any, scope?: { from: number; to: number }) => {
      if (scope) {
        regionByRow.forEach((cell, row) => {
          if (row < scope.from || row > scope.to) return;
          applyOneRegion(ws, row);
        });
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

    const paintCell = (
      ws: any,
      cell: HTMLElement,
      meta: OutlineGroupCell,
    ) => {
      const { row, col, label, kind, indent = 0 } = meta;
      cell.classList.add('readonly', 'jss-outline-group-cell');
      if (col === 0) {
        cell.classList.add('jss-outline-category-col');
        cell.style.backgroundColor = '#e8f1f8';
      }
      if (col === 1) cell.classList.add('jss-outline-region-col');

      const pad = col === 0 ? 8 + indent * 18 : 8 + indent * 16;
      cell.style.paddingLeft = `${pad}px`;
      cell.style.fontWeight = '700';
      cell.style.textAlign = 'left';

      const canFold = kind === 'category' || kind === 'region';
      const expanded =
        kind === 'category'
          ? !!ws.rows?.[row]?.state
          : kind === 'region'
            ? !!regionState.get(row)
            : false;
      const icon = canFold ? (expanded ? '▼' : '▶') : '';

      const existing = cell.querySelector('.jss-outline-toggle') as HTMLElement | null;
      if (existing) {
        if (canFold) {
          existing.textContent = icon;
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
        labelEl.textContent = label;
        return;
      }

      if (canFold) {
        cell.innerHTML = `<span class="jss-outline-toggle" data-row="${row}" data-kind="${kind}" contenteditable="false">${icon}</span><span class="jss-outline-label">${label}</span>`;
      } else {
        cell.innerHTML = `<span class="jss-outline-label">${label}</span>`;
      }
    };

    const paint = (ws: any, root: HTMLElement) => {
      if (disposed || painting) return;
      painting = true;
      try {
        root.querySelectorAll<HTMLElement>('td.jss_row > i').forEach((icon) => {
          icon.style.display = 'none';
          icon.style.pointerEvents = 'none';
        });

        // 优先只画可见单元格（虚拟滚动时 groupCells 可能几十万）
        const visible = root.querySelectorAll<HTMLElement>(
          'td[data-x="0"], td[data-x="1"], td[data-x=\'0\'], td[data-x=\'1\']',
        );
        if (visible.length) {
          visible.forEach((cell) => {
            const col = Number(cell.getAttribute('data-x'));
            const row = Number(cell.getAttribute('data-y'));
            if (!Number.isFinite(col) || !Number.isFinite(row)) return;
            const meta = foldMetaByKey.get(`${col}:${row}`);
            if (!meta) return;
            paintCell(ws, cell, meta);
          });
          return;
        }

        // fallback：无 data-x 时按元数据尝试（演示树很小）
        outlineSheet.groupCells.forEach((meta) => {
          const el = getCellEl(ws, meta.col, meta.row);
          if (el) paintCell(ws, el, meta);
        });
      } finally {
        painting = false;
      }
    };

    const syncView = (ws: any, root: HTMLElement, scope?: { from: number; to: number }) => {
      applyRegionVisibility(ws, scope);
      paint(ws, root);
    };

    const bind = () => {
      const ws = getWorksheetByName(spreadsheet, '透视源数据');
      if (!ws) return false;
      const table = (ws.table || ws.element) as HTMLElement | undefined;
      if (!table) return false;

      const root =
        (table.closest('.jss_container') as HTMLElement) ||
        (ws.element as HTMLElement) ||
        (table.closest('.jss_worksheet, .jss_content, .jss') as HTMLElement) ||
        table;

      ensureFoldStyle();
      root.classList.add('jss-outline-root');
      table.classList.add('jss-outline-table');

      if ((root as any).__outlineBound) {
        syncView(ws, root);
        return true;
      }
      (root as any).__outlineBound = true;
      boundRoot = root;

      clickHandler = (e: MouseEvent) => {
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
          if (!ws.rows?.[row]?.group) return;
          const wasOpen = !!ws.rows[row].state;
          const span = Number(ws.rows[row].group) || 0;
          if (wasOpen) {
            regionState.set(row, false);
            regionByRow.forEach((_c, r) => {
              if (r > row && r <= row + span) regionState.set(r, false);
            });
            ws.closeRowGroup(row);
            window.setTimeout(() => syncView(ws, root, { from: row, to: row + span }), 0);
            requestAnimationFrame(() => paint(ws, root));
          } else {
            ws.openRowGroup(row);
            window.setTimeout(() => syncView(ws, root, { from: row, to: row + span }), 0);
            requestAnimationFrame(() => paint(ws, root));
          }
          return;
        }

        const meta = regionByRow.get(row);
        if (!meta?.detailRows?.length) return;

        if (ws.rows?.[row]?.group && !ws.rows[row].state) {
          ws.openRowGroup(row);
        }

        const next = !regionState.get(row);
        regionState.set(row, next);
        window.setTimeout(() => {
          applyOneRegion(ws, row);
          paint(ws, root);
        }, 0);
        requestAnimationFrame(() => paint(ws, root));
      };
      root.addEventListener('click', clickHandler, true);

      const onTab = () => {
        window.setTimeout(() => syncView(ws, root), 0);
        window.setTimeout(() => syncView(ws, root), 100);
      };
      root.querySelectorAll('.jtabs-container, .jss_tabs, [class*="jtabs"]').forEach((el) => {
        el.addEventListener('click', onTab);
      });
      document.querySelector('.jss-page__sheet')?.addEventListener('click', onTab);

      observer = new MutationObserver(() => {
        requestAnimationFrame(() => paint(ws, root));
      });
      observer.observe(root, { childList: true, subtree: true, characterData: true });

      syncView(ws, root);
      window.setTimeout(() => syncView(ws, root), 100);
      window.setTimeout(() => syncView(ws, root), 400);
      return true;
    };

    if (bind()) {
      return () => {
        disposed = true;
        observer?.disconnect();
        if (boundRoot && clickHandler) {
          boundRoot.removeEventListener('click', clickHandler, true);
          delete (boundRoot as any).__outlineBound;
        }
      };
    }

    const timer = window.setInterval(() => {
      if (bind()) window.clearInterval(timer);
    }, 50);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      observer?.disconnect();
      if (boundRoot && clickHandler) {
        boundRoot.removeEventListener('click', clickHandler, true);
        delete (boundRoot as any).__outlineBound;
      }
    };
  }, [outlineSheet, sheetNonce]);


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

    const extraItems = [
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
  }, [columns.length]);

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
        列宽拖动 / 自适应列宽。「透视源数据」：Category / Region 两列折叠；可用下方下拉压测行数；
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
          disabled={sheetBusy}
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
              mergeCells={outlineSheet.mergeCells}
              style={outlineSheet.style}
              cells={outlineReadonlyCells}
              filters={!isOutlinePerf}
              columnResize={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
              virtualizationX={false}
              virtualizationY={true}
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
