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

jspreadsheet.setLicense(
  // 官方文档一日试用 license；过期后表格会只读。可到 https://jspreadsheet.com 重新生成。
  'ZjU5MmI5OTg4NDM1NGQ0YWYzMDU1NGYxMjNkN2EwYzU4ODdjNWI4NDZkNjFkNWJjMWU5ZmE0ZTk3ZjNlMzUzNmZmNDliYjU5ZjEwNDk5ZDIwYTc2MGU1YmU4YWRiMDZlZThjNmU4NTY5NjVlZTAzZjQ4MGJmYzQ3NjA5ZTA3YWMsZXlKamJHbGxiblJKWkNJNklpSXNJbTVoYldVaU9pSktjM0J5WldGa2MyaGxaWFFpTENKa1lYUmxJam94TnpnM09ERTRNall5TENKa2IyMWhhVzRpT2xzaWFuTndjbVZoWkhOb1pXVjBMbU52YlNJc0ltTnZaR1Z6WVc1a1ltOTRMbWx2SWl3aWFuTm9aV3hzTG01bGRDSXNJbU56WWk1aGNIQWlMQ0p6ZEdGamEySnNhWFI2TG1sdklpd2lkMlZpWTI5dWRHRnBibVZ5TG1sdklpd2liRzlqWVd4b2IzTjBJbDBzSW5Cc1lXNGlPaUl6TkNJc0luTmpiM0JsSWpwYkluWTNJaXdpZGpnaUxDSjJPU0lzSW5ZeE1DSXNJbll4TVNJc0luWXhNaUlzSW1Ob1lYSjBjeUlzSW1admNtMXpJaXdpWm05eWJYVnNZU0lzSW5CaGNuTmxjaUlzSW5KbGJtUmxjaUlzSW1OdmJXMWxiblJ6SWl3aWFXMXdiM0owWlhJaUxDSmlZWElpTENKMllXeHBaR0YwYVc5dWN5SXNJbk5sWVhKamFDSXNJbkJ5YVc1MElpd2ljMmhsWlhSeklpd2lZMnhwWlc1MElpd2ljMlZ5ZG1WeUlpd2ljMmhoY0dWeklpd2labTl5YldGMElpd2ljR2wyYjNRaVhTd2laR1Z0YnlJNmRISjFaWDA9',
);
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
        source: `透视源数据!A1:E${pivotSourceRowCount}`,
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

  // Spreadsheet React 只初始化一次；用插件 onevent + 挂载后包装 config.onevent 双保险
  useEffect(() => {
    const bind = () => {
      const list = getWorksheetList(spreadsheet);
      const parent = list[0]?.parent;
      if (!parent?.config) return false;
      if ((parent.config as any).__historyBound) return true;
      const prev = parent.config.onevent;
      parent.config.onevent = function historyOnevent(event: string, ...rest: any[]) {
        cellHistoryPlugin.onevent(event, ...rest);
        return prev?.call(this, event, ...rest);
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
        「订单明细」已集成：批注 / 下钻上钻 / 回撤 / 批量复制 / 多行列折叠 / 自定义右键 /
        下拉·日期·数值 / 单元格历史 / 数据追踪 / 快速搜索 / 显隐列 / 附件 / 大数据虚拟滚动 /
        列宽拖动 / 自适应列宽。右键单元格可访问更多操作；「透视分析」页可看层级折叠示例。
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
