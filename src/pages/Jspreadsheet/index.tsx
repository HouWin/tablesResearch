import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import comments from '@jspreadsheet/comments';
import search from '@jspreadsheet/search';
import bar from '@jspreadsheet/bar';
import formula from '@jspreadsheet/formula-pro';
import pivot from '@jspreadsheet/pivot';
import barFormulas from '@jspreadsheet/bar/dist/formulas.json';
import lemonade from 'lemonadejs';
import { message } from 'antd';
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

const PIVOT_CATEGORIES = [
  {
    name: 'Furniture',
    children: ['Bookcases', 'Chairs', 'Furnishings'],
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

/** 透视源数据（对齐参考图）：Selling Package → Year Quarter 二级行折叠 + 列折叠 */
const OUTLINE_STOCK = [
  {
    name: 'Each',
    expanded: true,
    quarters: [
      {
        name: '2013Q1',
        expanded: false,
        items: [
          [68, 'Pack of 12 action figures (female)'],
          [212, 'USB food flash drive - dim sum 10 drive variety pack'],
          [45, 'Developer joke mug - understanding'],
        ],
      },
      {
        name: '2016Q2',
        expanded: false,
        items: [
          [91, 'USB missile launcher (Green)'],
          [103, 'Dinosaur battery-powered walking'],
        ],
      },
    ],
  },
  {
    name: 'Packet',
    expanded: true,
    quarters: [
      {
        name: '2013Q1',
        expanded: true,
        items: [
          [68, 'Pack of 12 action figures (female)'],
          [212, 'USB food flash drive - dim sum 10 drive variety pack'],
          [19, 'Pack of 12 balloons - Assorted'],
          [77, 'Chocolate eclairs - 250g'],
          [140, 'RC foxy blues from Foggy Mountain'],
        ],
      },
    ],
  },
] as const;

type OutlineGroupCell = { row: number; col: number; label: string };

type OutlineSheet = {
  data: any[][];
  rows: Record<number, { group: number; state: boolean }>;
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  /** 行组标题所在列，用于放 ▼/▶（替代行号 +/-） */
  groupCells: OutlineGroupCell[];
};

function buildOutlineSourceSheet(): OutlineSheet {
  const data: any[][] = [];
  const rows: Record<number, { group: number; state: boolean }> = {};
  const mergeCells: Record<string, [number, number]> = {};
  const style: Record<string, string> = {};
  const groupCells: OutlineGroupCell[] = [];
  const groupBg = 'background-color: #ffe4c4';
  const zebraBg = 'background-color: #e8f4ff';

  let r = 0;
  OUTLINE_STOCK.forEach((pkg) => {
    const pkgStart = r;
    let childSpan = 0;
    pkg.quarters.forEach((q) => {
      childSpan += 1 + q.items.length;
    });
    // group = 标题行之后的子行数（不含标题本身）
    rows[pkgStart] = { group: childSpan, state: pkg.expanded };

    data.push([pkg.name, '', '', '']);
    groupCells.push({ row: pkgStart, col: 0, label: pkg.name });
    style[`A${pkgStart + 1}`] = groupBg;
    style[`B${pkgStart + 1}`] = groupBg;
    r += 1;

    pkg.quarters.forEach((q) => {
      const qStart = r;
      const itemCount = q.items.length;
      rows[qStart] = { group: itemCount, state: q.expanded };

      data.push(['', q.name, '', '']);
      groupCells.push({ row: qStart, col: 1, label: q.name });
      style[`A${qStart + 1}`] = groupBg;
      style[`B${qStart + 1}`] = groupBg;
      r += 1;

      q.items.forEach(([key, name], idx) => {
        data.push(['', '', key, name]);
        style[`A${r + 1}`] = groupBg;
        style[`B${r + 1}`] = groupBg;
        if (idx % 2 === 1) {
          style[`C${r + 1}`] = zebraBg;
          style[`D${r + 1}`] = zebraBg;
        }
        r += 1;
      });
    });

    const mergeSpan = 1 + childSpan;
    if (mergeSpan > 1) {
      mergeCells[`A${pkgStart + 1}`] = [1, mergeSpan];
    }
  });

  return { data, rows, mergeCells, style, groupCells };
}

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
  const rows: any[][] = [];
  for (let i = 0; i < count; i += 1) {
    const region = REGIONS[i % REGIONS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    const qty = Math.floor(Math.random() * 900) + 10;
    const price = Number((Math.random() * 800 + 20).toFixed(2));
    const day = String((i % 28) + 1).padStart(2, '0');
    rows.push([
      `订单-${10000 + i}`,
      region,
      category,
      STATUS[i % STATUS.length],
      `2025-${String((i % 12) + 1).padStart(2, '0')}-${day}`,
      qty,
      price,
      Number((qty * price).toFixed(2)),
      '',
      i % 17 === 0 ? '需要跟进' : '',
      `销售${(i % 8) + 1}`,
      i % 2 === 0 ? '线上' : '线下',
      `仓-${(i % 5) + 1}`,
    ]);
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
  const spreadsheet = useRef<any>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [historyCell, setHistoryCell] = useState('A1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<{ x: number; y: number } | null>(null);

  const orderData = useMemo(() => buildSeedRows(2000), []);
  const outlineSheet = useMemo(() => buildOutlineSourceSheet(), []);
  const outlineReadonlyCells = useMemo(
    () => buildOutlineReadonlyCells(outlineSheet.groupCells),
    [outlineSheet],
  );
  const pivotSourceData = useMemo(() => buildPivotSourceData(), []);
  const pivotSourceRowCount = pivotSourceData.length;

  const columns = useMemo(
    () => [
      { type: 'text', title: '订单号', width: 120, align: 'left' as const },
      {
        type: 'dropdown',
        title: '区域',
        width: 100,
        source: REGIONS,
        autocomplete: true,
      },
      {
        type: 'dropdown',
        title: '品类',
        width: 100,
        source: CATEGORIES,
      },
      {
        type: 'dropdown',
        title: '状态',
        width: 100,
        source: STATUS,
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
      {
        type: 'text',
        title: 'Selling Package',
        width: 170,
        group: 2,
        state: true,
        readOnly: true,
      },
      { type: 'text', title: 'Year Quarter', width: 140, readOnly: true },
      {
        type: 'numeric',
        title: 'Stock Item Key',
        width: 130,
        group: 2,
        state: true,
      },
      { type: 'text', title: 'Stock Item', width: 380 },
    ],
    [],
  );

  /** 多列折叠分组标题（与 columns.group 对应） */
  const outlineNestedHeaders = useMemo(
    () => [
      [
        { title: 'Package / Quarter', colspan: 2 },
        { title: 'Stock Items', colspan: 2 },
      ],
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
  }, []);

  // 透视源数据：去掉序列号 +/-；分组折叠统一 ▼/▶；可折叠属性只读；多列折叠
  useEffect(() => {
    let disposed = false;
    let painting = false;
    let observer: MutationObserver | null = null;
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let boundRoot: HTMLElement | null = null;
    let styleEl: HTMLStyleElement | null = null;

    const FOLD_STYLE_ID = 'jss-outline-fold-override-v2';
    const ensureFoldStyle = () => {
      let el = document.getElementById(FOLD_STYLE_ID) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = FOLD_STYLE_ID;
        document.head.appendChild(el);
      }
      styleEl = el;
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
        .jss-outline-root td.jss_header,
        .jss-outline-table td.jss_header,
        .jss_container td.jss_header {
          position: relative !important;
          padding-right: 18px !important;
        }
        /* 原始 material +/- 隐藏 */
        .jss_container td.jss_header > i.jss-fold-tri,
        .jss-outline-root td.jss_header > i.jss-fold-tri,
        .jss-outline-table td.jss_header > i.jss-fold-tri {
          opacity: 0 !important;
          font-size: 0 !important;
          width: 14px !important;
          height: 14px !important;
          overflow: hidden !important;
          pointer-events: none !important;
          color: transparent !important;
        }
        /* 可见的 ▼/▶ 徽章 */
        .jss_container .jss-fold-badge,
        .jss-outline-root .jss-fold-badge,
        .jss-outline-table .jss-fold-badge {
          position: absolute !important;
          right: 4px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          z-index: 6 !important;
          font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #555 !important;
          cursor: pointer !important;
          user-select: none !important;
          line-height: 1 !important;
          background: transparent !important;
          border: none !important;
        }
        .jss-outline-root .jss-outline-toggle,
        .jss-outline-table .jss-outline-toggle {
          display: inline-block !important;
          min-width: 1em;
          margin-right: 6px;
          font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #555 !important;
          cursor: pointer !important;
          user-select: none !important;
          vertical-align: middle;
        }
      `;
    };

    const ensureColumnGroups = (ws: any) => {
      if (!ws?.setColumnGroup || (ws as any).__outlineColGroupsBound) return;
      const applyGroup = (col: number, size: number) => {
        const existing = ws.cols?.[col]?.group;
        if (existing) {
          if (ws.cols[col].state) ws.openColumnGroup?.(col);
          else ws.closeColumnGroup?.(col);
          return;
        }
        ws.setColumnGroup(col, size, true);
      };
      try {
        applyGroup(0, 2);
        applyGroup(2, 2);
        (ws as any).__outlineColGroupsBound = true;
      } catch {
        // ignore
      }
    };

    /** 表头列组：隐藏 material +/-，叠一层可点的 ▼/▶ */
    const restyleGroupIcons = (root: HTMLElement) => {
      const scope =
        (root.closest('.jss_container, .jss-page__sheet') as HTMLElement | null) || root;

      scope.querySelectorAll<HTMLElement>('td.jss_header, th.jss_header, .jss_header').forEach((header) => {
        if (header.classList.contains('jss_row')) return;

        const icon = header.querySelector<HTMLElement>(
          ':scope > i.material-icons, :scope > i.jss-fold-tri, i.material-icons, i.jss-fold-tri',
        );
        if (!icon) return;
        if (icon.parentElement?.classList.contains('jss_row')) return;

        const raw = (icon.textContent || '').trim();
        // 列组折叠只用 add/remove（显示为 +/-）；其它 material 图标跳过
        const isClosed = raw === 'add' || raw === '+' || raw === '▶' || raw === '▸';
        const isOpen = raw === 'remove' || raw === '-' || raw === '−' || raw === '▼' || raw === '▾';
        const known =
          isClosed ||
          isOpen ||
          icon.classList.contains('jss-fold-tri') ||
          icon.getAttribute('data-fold') === 'open' ||
          icon.getAttribute('data-fold') === 'closed';
        if (!known) return;
        // 明确排除筛选图标
        if (
          raw === 'arrow_drop_down' ||
          raw === 'filter_list' ||
          raw === 'search' ||
          header.classList.contains('jss_filters_icon')
        ) {
          return;
        }

        let open = true;
        if (isClosed || icon.getAttribute('data-fold') === 'closed') open = false;
        if (isOpen || icon.getAttribute('data-fold') === 'open') open = true;
        // 若当前文本仍是 add/remove，以文本为准
        if (isClosed) open = false;
        if (isOpen) open = true;

        const tri = open ? '▼' : '▶';

        icon.classList.add('jss-fold-tri');
        icon.setAttribute('data-fold', open ? 'open' : 'closed');
        // 隐藏原始 +/-，保留节点供库绑定点击
        icon.style.cssText =
          'position:absolute!important;right:4px!important;top:50%!important;transform:translateY(-50%)!important;width:14px!important;height:14px!important;margin:0!important;padding:0!important;overflow:hidden!important;opacity:0!important;font-size:0!important;color:transparent!important;pointer-events:none!important;z-index:1!important;';

        let badge = header.querySelector(':scope > .jss-fold-badge') as HTMLElement | null;
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'jss-fold-badge';
          badge.contentEditable = 'false';
          header.style.position = 'relative';
          if (!header.style.paddingRight) header.style.paddingRight = '18px';
          header.appendChild(badge);
          badge.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          });
          badge.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            // 恢复可点后触发原图标
            icon.style.pointerEvents = 'auto';
            icon.style.opacity = '0';
            icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            window.setTimeout(() => restyleGroupIcons(scope), 0);
            window.setTimeout(() => restyleGroupIcons(scope), 50);
          });
        }
        if (badge.textContent !== tri) badge.textContent = tri;
        badge.setAttribute('data-fold', open ? 'open' : 'closed');
        badge.title = open ? '折叠列组' : '展开列组';
        badge.style.cssText =
          'position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:6;display:inline-block;font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;font-weight:700;line-height:1;color:#555;cursor:pointer;user-select:none;background:transparent;border:none;padding:2px;margin:0;';
      });

      scope.querySelectorAll<HTMLElement>('td.jss_row > i').forEach((icon) => {
        icon.style.display = 'none';
        icon.style.pointerEvents = 'none';
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

    const paint = (ws: any, root: HTMLElement) => {
      if (disposed || painting) return;
      painting = true;
      try {
        restyleGroupIcons(root);

        outlineSheet.groupCells.forEach(({ row, col, label }) => {
          const name = cellName(col, row);
          try {
            ws.setReadOnly?.(name, true);
          } catch {
            // ignore
          }
          const cell = getCellEl(ws, col, row);
          if (!cell) return;
          cell.classList.add('readonly', 'jss-outline-group-cell');
          const expanded = !!ws.rows?.[row]?.state;
          const icon = expanded ? '▼' : '▶';
          const existing = cell.querySelector('.jss-outline-toggle') as HTMLElement | null;
          if (existing) {
            existing.textContent = icon;
            const labelEl = cell.querySelector('.jss-outline-label');
            if (labelEl) labelEl.textContent = label;
            return;
          }
          cell.innerHTML = `<span class="jss-outline-toggle" data-row="${row}" contenteditable="false">${icon}</span><span class="jss-outline-label">${label}</span>`;
        });
      } finally {
        painting = false;
      }
    };

    const bind = () => {
      const ws = getWorksheetByName(spreadsheet, '透视源数据');
      if (!ws) return false;
      const table = (ws.table || ws.element) as HTMLElement | undefined;
      if (!table) return false;

      // 根节点覆盖整表容器（表头可能与数据区分开）
      const root =
        (table.closest('.jss_container') as HTMLElement) ||
        (ws.element as HTMLElement) ||
        (table.closest('.jss_worksheet, .jss_content, .jss') as HTMLElement) ||
        table;

      ensureFoldStyle();
      ensureColumnGroups(ws);
      root.classList.add('jss-outline-root');
      table.classList.add('jss-outline-table');

      if ((root as any).__outlineBound) {
        paint(ws, root);
        return true;
      }
      (root as any).__outlineBound = true;
      boundRoot = root;

      clickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;

        // 三角徽章自己处理列折叠
        if (target?.closest?.('.jss-fold-badge')) {
          requestAnimationFrame(() => paint(ws, root));
          return;
        }

        const colToggle = target?.closest?.('i.jss-fold-tri, td.jss_header > i') as HTMLElement | null;
        if (colToggle && root.contains(colToggle) && colToggle.closest('td.jss_header, .jss_header')) {
          requestAnimationFrame(() => paint(ws, root));
          return;
        }

        const toggle = target?.closest?.('.jss-outline-toggle') as HTMLElement | null;
        if (!toggle || !root.contains(toggle)) return;
        e.preventDefault();
        e.stopPropagation();
        const row = Number(toggle.dataset.row);
        if (!Number.isFinite(row) || !ws.rows?.[row]?.group) return;
        if (ws.rows[row].state) ws.closeRowGroup(row);
        else ws.openRowGroup(row);
        requestAnimationFrame(() => paint(ws, root));
      };
      root.addEventListener('click', clickHandler, true);

      // 切到「透视源数据」页签时再刷一次
      const onTab = () => {
        window.setTimeout(() => paint(ws, root), 0);
        window.setTimeout(() => paint(ws, root), 100);
      };
      root.querySelectorAll('.jtabs-container, .jss_tabs, [class*="jtabs"]').forEach((el) => {
        el.addEventListener('click', onTab);
      });
      document.querySelector('.jss-page__sheet')?.addEventListener('click', onTab);

      observer = new MutationObserver(() => {
        requestAnimationFrame(() => paint(ws, root));
      });
      observer.observe(root, { childList: true, subtree: true, characterData: true });

      paint(ws, root);
      // 首次进入可能表头稍后才渲染
      window.setTimeout(() => paint(ws, root), 100);
      window.setTimeout(() => paint(ws, root), 400);
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
  }, [outlineSheet]);

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
  }, []);

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
        列宽拖动 / 自适应列宽。「透视源数据」：行折叠（维度列 ▼/▶，只读）+ 多列折叠
        （Package/Quarter、Stock Items 表头三角）；「透视分析」读「透视底表」。
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.csv,.xlsx"
        style={{ display: 'none' }}
        onChange={handleAttachFile}
      />

      <div className="jss-page__body">
        <div className="jss-page__sheet">
          <Spreadsheet
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
              columns={columns}
              nestedHeaders={nestedHeaders}
              rows={orderRows}
              comments={commentsData}
              allowComments={true}
              search={true}
              filters={true}
              columnResize={true}
              columnDrag={true}
              rowResize={true}
              fillHandle={true}
              editable={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
              virtualizationX={true}
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
              nestedHeaders={outlineNestedHeaders}
              rows={outlineSheet.rows}
              mergeCells={outlineSheet.mergeCells}
              style={outlineSheet.style}
              cells={outlineReadonlyCells}
              filters={true}
              columnResize={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
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
