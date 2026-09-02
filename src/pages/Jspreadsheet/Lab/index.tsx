import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import comments from '@jspreadsheet/comments';
import search from '@jspreadsheet/search';
import bar from '@jspreadsheet/bar';
import formula from '@jspreadsheet/formula-pro';
import pivot from '@jspreadsheet/pivot';
import barFormulas from '@jspreadsheet/bar/dist/formulas.json';
import lemonade from 'lemonadejs';
import { App, Button, Select, Spin } from 'antd';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet/dist/jspreadsheet.css';
import '@jsuites/css/dist/style.css';
import '@jspreadsheet/comments/dist/style.css';
import '@jspreadsheet/bar/dist/style.css';
import '@jspreadsheet/pivot/dist/style.css';
import 'material-icons/iconfont/material-icons.css';
import { localizeToolbarItems, moveFullscreenToEnd, removeDefaultToolbarSave, zhCN } from '../dictionary';
import '../index.less';

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

type EditFormatInfo = {
  cell: string;
  col: number;
  row: number;
  type?: string;
  mask?: string;
  format?: string;
  title?: string;
  raw: unknown;
  display: unknown;
  time: string;
};

type DirtyRowChange = {
  cell: string;
  field: string;
  col: number;
  row: number;
  rowNumber: number;
  oldValue: unknown;
  value: unknown;
  from: string;
  to: string;
  raw: unknown;
  display: unknown;
  time: string;
};

type ModifiedField = {
  field: string;
  cell: string;
  col: number;
  row: number;
  rowNumber: number;
  oldValue: unknown;
  value: unknown;
  display: unknown;
};

function cellCoordKey(col: number, row: number) {
  return `${col}:${row}`;
}

function unwrapCellValue(value: unknown): unknown {
  if (value != null && typeof value === 'object' && 'value' in (value as object)) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function cellValuesEqual(a: unknown, b: unknown): boolean {
  const av = unwrapCellValue(a);
  const bv = unwrapCellValue(b);
  if (av === bv) return true;
  if (av == null && bv == null) return true;
  return String(av) === String(bv);
}

function cloneTableData(data: unknown): unknown[][] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => (Array.isArray(row) ? [...row] : []));
}

/** 超过此行数时保存仅校验 dirtyCells，避免全表 diff 卡顿 */
const SAVE_FULL_DIFF_ROW_LIMIT = 10000;

function buildUpdatedRowsFromDirtyCells(
  ws: any,
  baseline: unknown[][],
  dirtyCells: Iterable<string>,
  columns: Array<{ title?: unknown }>,
) {
  const byRow = new Map<number, ModifiedField[]>();

  for (const key of dirtyCells) {
    const [col, row] = key.split(':').map(Number);
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;

    const oldValue = baseline[row]?.[col];
    const value = ws.getValueFromCoords?.(col, row, false);
    const display = ws.getValueFromCoords?.(col, row, true);
    if (cellValuesEqual(oldValue, value)) continue;

    const field = resolveColumnField(ws, col, columns);
    const cell = cellName(col, row) || `c${col}r${row}`;
    const item: ModifiedField = {
      field,
      cell,
      col,
      row,
      rowNumber: row + 1,
      oldValue,
      value,
      display,
    };

    const rowFields = byRow.get(row);
    if (rowFields) rowFields.push(item);
    else byRow.set(row, [item]);
  }

  return Array.from(byRow.entries())
    .sort(([a], [b]) => a - b)
    .map(([rowIndex, modifiedFields]) => ({
      rowIndex,
      rowNumber: rowIndex + 1,
      modifiedFields: modifiedFields.sort((a, b) => a.col - b.col),
      row: buildRowRecord(ws, rowIndex, columns),
    }));
}

function collectUpdatedRows(
  ws: any,
  baseline: unknown[][],
  columns: Array<{ title?: unknown }>,
  dirtyCells: Set<string>,
  fullScan: boolean,
) {
  const cellsToCheck = new Set(dirtyCells);
  const current = ws.getData?.(false);

  if (fullScan && Array.isArray(current)) {
    const colCount = columns.length;
    for (let row = 0; row < current.length; row++) {
      for (let col = 0; col < colCount; col++) {
        const oldValue = baseline[row]?.[col];
        const value = current[row]?.[col];
        if (!cellValuesEqual(oldValue, value)) {
          cellsToCheck.add(cellCoordKey(col, row));
        }
      }
    }
  }

  return buildUpdatedRowsFromDirtyCells(ws, baseline, cellsToCheck, columns);
}

function resolveColumnField(ws: any, col: number, columns: Array<{ title?: unknown }>) {
  const runtime = ws?.getColumn?.(col) || ws?.getColumnOptions?.(col, 0) || {};
  return String(runtime?.title ?? columns[col]?.title ?? `col${col}`);
}

/** 单元格变更时组装字段名 + 坐标 + raw/display 数据 */
function buildCellChangePayload(
  ws: any,
  col: number,
  row: number,
  oldValue: unknown,
  newValue: unknown,
  columns: Array<{ title?: unknown }>,
) {
  const field = resolveColumnField(ws, col, columns);
  const cell = cellName(col, row) || `c${col}r${row}`;
  const format = captureCellFormat(ws, col, row, newValue);
  return {
    field,
    col,
    row,
    rowNumber: row + 1,
    cell,
    oldValue,
    newValue,
    raw: format.raw,
    display: format.display,
    type: format.type,
    mask: format.mask,
    format: format.format,
  };
}

/** 将工作表行转为 { 列标题: 值 }，供保存接口使用 */
function buildRowRecord(
  ws: any,
  rowIndex: number,
  columns: Array<{ title?: unknown }>,
): Record<string, unknown> {
  const raw = ws?.getRowData?.(rowIndex, false);
  if (raw && !Array.isArray(raw) && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  const rowArr = Array.isArray(raw)
    ? raw
    : ((ws?.getData?.(false)?.[rowIndex] as unknown[] | undefined) ?? []);
  const record: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    record[String(col.title ?? `col${i}`)] = rowArr[i];
  });
  return record;
}

/** 单元格变更 / 选区：Spreadsheet props onchange / onselection 写入 config */
const historyBridge = {
  onChange: (_ws: any, _x: any, _y: any, _oldValue: any, _newValue: any) => {},
  onSelect: (_ws: any, _px: any, _py: any, _ux: any, _uy: any) => {},
};

/** 透视源数据：折叠/展开不进入撤销栈，避免与单元格编辑 undo 互相干扰 */
const runWithoutHistory = (fn: () => void) => {
  const historyCtrl = (jspreadsheet as any).history;
  const prev = historyCtrl?.ignore;
  if (historyCtrl) historyCtrl.ignore = true;
  try {
    fn();
  } finally {
    if (historyCtrl) historyCtrl.ignore = prev ?? false;
  }
};

/** 透视源数据：工具栏「全部展开 / 全部折叠」桥接（由 outline effect 注入） */
const outlineBridge = {
  expandAll: (_onDone?: () => void) => {},
  collapseAll: (_onDone?: () => void) => {},
};

/** 透视源数据：折叠样式初始化完成后通知（用于统计渲染总耗时） */
const outlineLoadBridge = {
  onRenderDone: () => {},
  restoreTab: () => {},
};

/** 扩展页仅一张透视源数据工作表 */
const WORKSHEET_TAB_INDEX: Record<string, number> = {
  透视源数据: 0,
};

function resolvePinnedTabIndex(
  list: any[],
  target: { index: number; name: string },
) {
  let idx = target.index;
  if (idx >= 0 && idx < list.length) {
    const ws = list[idx];
    const name = ws?.options?.worksheetName || ws?.getWorksheetName?.();
    if (name === target.name) return idx;
  }
  return list.findIndex(
    (ws) =>
      ws?.options?.worksheetName === target.name ||
      ws?.getWorksheetName?.() === target.name,
  );
}

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

type OutlineRowDimensions = {
  /** 品类（Category） */
  category: string;
  /** 子类（SubCategory / leaf） */
  subCategory: string;
  /** 地区 / 州（Region） */
  region: string;
  /** 属性（Attribute） */
  attribute: string;
  /** 行在层次中的位置 */
  rowLevel: 'category' | 'subCategory' | 'stateDetail';
  /** 维度拼接：Category / SubCategory / Region / Attribute */
  dimension: string;
};

type OutlineDimensionIndex = {
  categoryByRow: Map<number, string>;
  subCategoryByRow: Map<number, string>;
  regionHeaderByRow: Map<number, number>;
  regionLabelByRow: Map<number, string>;
  stateDetailRows: Set<number>;
  leafRows: Set<number>;
  categoryRows: Set<number>;
};

/** 根据透视源数据结构，为每一行预解析 Category / SubCategory / Region 维度 */
function buildOutlineDimensionIndex(sheet: OutlineSheet): OutlineDimensionIndex {
  const categoryByRow = new Map<number, string>();
  const subCategoryByRow = new Map<number, string>();
  const regionHeaderByRow = new Map<number, number>();
  const regionLabelByRow = new Map<number, string>();
  const leafRows = new Set<number>();
  const categoryRows = new Set<number>();

  sheet.groupCells.forEach((cell) => {
    if (cell.kind === 'category') {
      categoryRows.add(cell.row);
      categoryByRow.set(cell.row, cell.label);
    }
    if (cell.kind === 'leaf') {
      leafRows.add(cell.row);
      subCategoryByRow.set(cell.row, cell.label);
    }
    if (cell.kind === 'region') {
      regionLabelByRow.set(cell.row, cell.label);
      cell.detailRows?.forEach((detailRow) => {
        regionHeaderByRow.set(detailRow, cell.row);
      });
    }
  });

  const categoryStarts = Object.keys(sheet.rows)
    .map(Number)
    .filter((r) => sheet.rows[r]?.group != null)
    .sort((a, b) => a - b);
  const sortedLeafRows = [...leafRows].sort((a, b) => a - b);
  const sortedRegionCells = sheet.groupCells
    .filter((cell) => cell.kind === 'region')
    .sort((a, b) => a.row - b.row);

  for (let row = 0; row < sheet.data.length; row += 1) {
    let catStart = -1;
    for (const cs of categoryStarts) {
      if (cs <= row) catStart = cs;
      else break;
    }
    if (catStart >= 0) {
      const cat =
        categoryByRow.get(catStart) || String(sheet.data[catStart]?.[0] ?? '');
      categoryByRow.set(row, cat);
    }

    let sub = '';
    for (const lr of sortedLeafRows) {
      if (lr > catStart && lr <= row) {
        sub = subCategoryByRow.get(lr) || String(sheet.data[lr]?.[0] ?? '');
      }
    }
    if (sub) subCategoryByRow.set(row, sub);

    if (!regionHeaderByRow.has(row)) {
      let regionHeader = -1;
      for (const rc of sortedRegionCells) {
        if (rc.row <= row) regionHeader = rc.row;
        else break;
      }
      if (sheet.stateDetailRows.has(row) && regionHeader >= 0 && row !== regionHeader) {
        regionHeaderByRow.set(row, regionHeader);
      }
    }
  }

  return {
    categoryByRow,
    subCategoryByRow,
    regionHeaderByRow,
    regionLabelByRow,
    stateDetailRows: sheet.stateDetailRows,
    leafRows,
    categoryRows,
  };
}

function readWorksheetCell(ws: any, col: number, row: number): string {
  const v = ws.getValueFromCoords?.(col, row, false);
  return String(unwrapCellValue(v) ?? '').trim();
}

function joinOutlineDimensions(
  parts: Pick<OutlineRowDimensions, 'category' | 'subCategory' | 'region' | 'attribute'>,
): string {
  return [parts.category, parts.subCategory, parts.region, parts.attribute]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' / ');
}

function resolveOutlineRowDimensions(
  ws: any,
  rowIndex: number,
  index: OutlineDimensionIndex,
): OutlineRowDimensions {
  const category = index.categoryByRow.get(rowIndex) || readWorksheetCell(ws, 0, rowIndex);
  const subCategory = index.subCategoryByRow.get(rowIndex) || '';
  const attribute = readWorksheetCell(ws, 1, rowIndex);
  const col2 = readWorksheetCell(ws, 2, rowIndex);

  let rowLevel: OutlineRowDimensions['rowLevel'] = 'category';
  let region = col2 || index.regionLabelByRow.get(rowIndex) || '';

  if (index.stateDetailRows.has(rowIndex)) {
    rowLevel = 'stateDetail';
    const headerRow = index.regionHeaderByRow.get(rowIndex);
    region = col2 || (headerRow != null ? index.regionLabelByRow.get(headerRow) || '' : '');
  } else if (index.leafRows.has(rowIndex)) {
    rowLevel = 'subCategory';
    region = col2 || index.regionLabelByRow.get(rowIndex) || '';
  } else if (index.categoryRows.has(rowIndex)) {
    rowLevel = 'category';
    region = col2 || index.regionLabelByRow.get(rowIndex) || '';
  } else if (subCategory) {
    rowLevel = 'subCategory';
  }

  const dimension = joinOutlineDimensions({ category, subCategory, region, attribute });
  return { category, subCategory, region, attribute, rowLevel, dimension };
}

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

const OUTLINE_ATTRS = ['标准品', '促销品', '定制', '常备'] as const;

function outlineAttrValue(row: number, seed: number, level: 'category' | 'sub' | 'state') {
  if (level === 'state') return '';
  if (level === 'category') return '品类';
  return OUTLINE_ATTRS[(row + seed) % OUTLINE_ATTRS.length];
}

const OUTLINE_REGION_COL = 2;
const OUTLINE_PROFIT_COL = 6;
const OUTLINE_EXTRA_COL_COUNT = 20;
const OUTLINE_EXTRA_COL_TITLES = [
  'Remark',
  'SalesRep',
  'Channel',
  'Warehouse',
  'Customer',
  'ProductCode',
  'Batch',
  'Unit',
  'TaxRate',
  'Discount',
  'Freight',
  'Cost',
  'GrossProfit',
  'GrossMargin',
  'Stock',
  'Supplier',
  'PurchasePrice',
  'ExpiryDate',
  'Tag',
  'Extension',
] as const;

function outlineExtraValues(row: number, seed: number): any[] {
  const n = (i: number) => (row * (i + 3) + seed + i * 11) % 997;
  return [
    row % 17 === 0 ? '需要跟进' : '',
    `销售${(row % 8) + 1}`,
    row % 2 === 0 ? '线上' : '线下',
    `仓-${(row % 5) + 1}`,
    `客户-${1000 + n(0)}`,
    `SKU-${String(n(1)).padStart(4, '0')}`,
    `B${String(202500 + n(2)).slice(-6)}`,
    ['件', '箱', '套', 'kg'][n(3) % 4],
    Number((0.06 + (n(4) % 7) * 0.01).toFixed(2)),
    Number(((n(5) % 20) * 0.5).toFixed(1)),
    Number((50 + (n(6) % 120)).toFixed(2)),
    Number((800 + (n(7) % 4000)).toFixed(2)),
    Number((120 + (n(8) % 800)).toFixed(2)),
    `${((n(9) % 35) + 5).toFixed(1)}%`,
    (n(10) % 500) + 10,
    `供应商-${(n(11) % 12) + 1}`,
    Number((60 + (n(12) % 300)).toFixed(2)),
    `2026-${String((n(13) % 12) + 1).padStart(2, '0')}-${String((n(14) % 28) + 1).padStart(2, '0')}`,
    ['热销', '新品', '清仓', '常规'][n(15) % 4],
    `EXT-${String(n(16)).padStart(3, '0')}`,
  ];
}

const OUTLINE_CORE_COL_COUNT = 7;

type OutlineExpandMode = 'collapsed' | 'first' | 'all';

type OutlineLayoutForm = {
  extraColumns: string[];
  expandMode: OutlineExpandMode;
  defaultRowHeight: number;
  customExtraColumnsJson: string;
  /** 可选：完整 columns 配置 JSON，优先级高于扩展列勾选 */
  columnsJson: string;
  /** 可选：最多渲染行数，null 表示全部 */
  maxRows: number | null;
};

const DEFAULT_OUTLINE_LAYOUT: OutlineLayoutForm = {
  extraColumns: [...OUTLINE_EXTRA_COL_TITLES],
  expandMode: 'collapsed',
  defaultRowHeight: 25,
  customExtraColumnsJson: '',
  columnsJson: '',
  maxRows: null,
};

const OUTLINE_CORE_HEADERS = [
  'Category',
  'Attribute',
  'Region',
  'Status',
  'OrderDate',
  'Sales',
  'Profit',
] as const;

const OUTLINE_ALL_HEADERS = [...OUTLINE_CORE_HEADERS, ...OUTLINE_EXTRA_COL_TITLES];

function parseColumnsConfigArray(json: string) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error('列配置须为非空 JSON 数组');
  }
  return parsed as Array<Record<string, unknown>>;
}

function resolveLayoutExtraTitles(config: OutlineLayoutForm) {
  if (config.customExtraColumnsJson.trim()) {
    try {
      return parseColumnsConfigArray(config.customExtraColumnsJson)
        .map((col) => String(col.title ?? ''))
        .filter(Boolean);
    } catch {
      // fallthrough
    }
  }
  return normalizeExtraColumnTitles(config.extraColumns);
}

function sliceDataByColumnTitles(
  matrix: any[][],
  headers: string[],
  columns: Array<{ title?: unknown }>,
) {
  const indices = columns.map((col) => headers.indexOf(String(col.title ?? '')));
  if (indices.some((index) => index < 0)) {
    return matrix.map((row) => row.slice(0, columns.length));
  }
  return matrix.map((row) => indices.map((index) => row[index]));
}

function filterRowConfig<T extends Record<number, { group: number; state: boolean }>>(
  rows: T,
  maxRows: number | null | undefined,
) {
  if (!maxRows || maxRows <= 0) return rows;
  return Object.fromEntries(
    Object.entries(rows).filter(([key]) => Number(key) < maxRows),
  ) as T;
}

function buildOutlineCoreColumns(isOutlineLarge: boolean) {
  if (isOutlineLarge) {
    return [
      { type: 'text', title: 'Category', width: 160, readOnly: true, align: 'left' as const },
      { type: 'text', title: 'Attribute', width: 100, align: 'left' as const },
      { type: 'text', title: 'Region', width: 110, readOnly: true, align: 'left' as const },
      { type: 'text', title: 'Status', width: 90, align: 'left' as const },
      { type: 'text', title: 'OrderDate', width: 110, align: 'left' as const },
      { type: 'text', title: 'Sales', width: 110, align: 'right' as const },
      { type: 'text', title: 'Profit', width: 110, align: 'right' as const },
    ];
  }
  return [
    { type: 'text', title: 'Category', width: 160, readOnly: true, align: 'left' as const },
    { type: 'text', title: 'Attribute', width: 100, align: 'left' as const },
    { type: 'text', title: 'Region', width: 110, readOnly: true, align: 'left' as const },
    {
      type: 'dropdown',
      title: 'Status',
      width: 100,
      source: STATUS_OPTIONS,
      strictMode: false,
    },
    {
      type: 'calendar',
      title: 'OrderDate',
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
  ];
}

/** 根据默认行列配置生成 Worksheet 渲染所需的 columns / data / nestedHeaders / rows */
function buildOutlineTableRender(
  sheet: OutlineSheet,
  config: OutlineLayoutForm,
  isOutlineLarge: boolean,
) {
  if (config.columnsJson.trim()) {
    try {
      const columns = parseColumnsConfigArray(config.columnsJson);
      let data = sliceDataByColumnTitles(sheet.data, [...OUTLINE_ALL_HEADERS], columns);
      if (config.maxRows && config.maxRows > 0) {
        data = data.slice(0, config.maxRows);
      }
      const extraCount = Math.max(0, columns.length - OUTLINE_CORE_COL_COUNT);
      return {
        columns,
        data,
        nestedHeaders: buildOutlineNestedHeadersForExtraCount(extraCount),
        rows: filterRowConfig(sheet.rows, config.maxRows),
      };
    } catch {
      // fallthrough to default builder
    }
  }

  const extraTitles = resolveLayoutExtraTitles(config);
  let extraDefs = buildOutlineExtraColumnDefsForTitles(extraTitles);
  if (config.customExtraColumnsJson.trim()) {
    try {
      extraDefs = parseColumnsConfigArray(config.customExtraColumnsJson);
    } catch {
      // keep title-based defs
    }
  }

  const extraLarge = extraTitles.map((title, i) => ({
    type: 'text' as const,
    title,
    width: title === 'Remark' || i === 0 ? 140 : 90,
    align: 'left' as const,
  }));

  const columns = [
    ...buildOutlineCoreColumns(isOutlineLarge),
    ...(isOutlineLarge ? extraLarge : extraDefs),
  ];

  let data = sliceOutlineDataExtraCols(sheet.data, extraTitles);
  if (config.maxRows && config.maxRows > 0) {
    data = data.slice(0, config.maxRows);
  }

  return {
    columns,
    data,
    nestedHeaders: buildOutlineNestedHeadersForExtraCount(extraTitles.length),
    rows: filterRowConfig(sheet.rows, config.maxRows),
  };
}

function categoryExpandedForMode(mode: OutlineExpandMode, index: number, demoDefault?: boolean) {
  if (mode === 'all') return true;
  if (mode === 'first') return index === 0;
  if (mode === 'collapsed') return false;
  return !!demoDefault;
}

function normalizeExtraColumnTitles(selected: string[]) {
  const valid = selected.filter((title) =>
    OUTLINE_EXTRA_COL_TITLES.includes(title as (typeof OUTLINE_EXTRA_COL_TITLES)[number]),
  );
  return valid.length ? valid : [...OUTLINE_EXTRA_COL_TITLES];
}

function outlineExtraColumnIndices(titles: string[]) {
  return titles
    .map((title) => OUTLINE_EXTRA_COL_TITLES.indexOf(title as (typeof OUTLINE_EXTRA_COL_TITLES)[number]))
    .filter((index) => index >= 0);
}

function sliceOutlineDataExtraCols(data: any[][], extraTitles: string[]) {
  const extraIndices = outlineExtraColumnIndices(extraTitles);
  return data.map((row) => [
    ...row.slice(0, OUTLINE_CORE_COL_COUNT),
    ...extraIndices.map((index) => row[OUTLINE_CORE_COL_COUNT + index]),
  ]);
}

function buildOutlineExtraColumnDefsForTitles(titles: string[]) {
  const defs = buildOutlineExtraColumnDefs();
  return titles.map((title) => {
    const index = OUTLINE_EXTRA_COL_TITLES.indexOf(
      title as (typeof OUTLINE_EXTRA_COL_TITLES)[number],
    );
    if (index < 0) {
      return { type: 'text' as const, title, width: 100, align: 'left' as const };
    }
    return defs[index];
  });
}

function buildOutlineNestedHeadersForExtraCount(extraCount: number) {
  if (extraCount <= 0) {
    return [
      [
        { title: 'Dimension', colspan: 3 },
        { title: 'Order', colspan: 2 },
        { title: 'Metrics', colspan: 2 },
      ],
    ];
  }
  if (extraCount >= OUTLINE_EXTRA_COL_COUNT) {
    return [
      [
        { title: 'Dimension', colspan: 3 },
        { title: 'Order', colspan: 2 },
        { title: 'Metrics', colspan: 2 },
        { title: 'Extension', colspan: extraCount },
      ],
      [
        { title: 'Hierarchy', colspan: 3 },
        { title: 'Status & Date', colspan: 2 },
        { title: 'Sales & Profit', colspan: 2 },
        { title: 'Party', colspan: 4 },
        { title: 'Product', colspan: 6 },
        { title: 'Finance', colspan: Math.max(0, extraCount - 10) },
      ],
    ];
  }
  return [
    [
      { title: 'Dimension', colspan: 3 },
      { title: 'Order', colspan: 2 },
      { title: 'Metrics', colspan: 2 },
      { title: 'Extension', colspan: extraCount },
    ],
    [
      { title: 'Hierarchy', colspan: 3 },
      { title: 'Status & Date', colspan: 2 },
      { title: 'Sales & Profit', colspan: 2 },
      { title: 'Extension', colspan: extraCount },
    ],
  ];
}

function parseCustomExtraColumns(json: string) {
  return parseColumnsConfigArray(json);
}

function buildOutlineExtraColumnDefs() {
  return OUTLINE_EXTRA_COL_TITLES.map((title, i) => {
    if (i === 8 || i === 9 || i === 10 || i === 11 || i === 12 || i === 16) {
      return {
        type: 'numeric' as const,
        title,
        width: 90,
        mask: '#,##0.00',
        align: 'right' as const,
      };
    }
    if (i === 14) {
      return {
        type: 'numeric' as const,
        title,
        width: 80,
        mask: '#,##0',
        align: 'right' as const,
      };
    }
    if (i === 17) {
      return {
        type: 'calendar' as const,
        title,
        width: 110,
        format: 'YYYY-MM-DD',
      };
    }
    return {
      type: 'text' as const,
      title,
      width: i === 0 ? 140 : 100,
      align: 'left' as const,
    };
  });
}

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
      return [
        cat.name,
        outlineAttrValue(r, seed, 'category'),
        'East',
        status,
        orderDate,
        catSales,
        catProfit,
        ...outlineExtraValues(r, seed),
      ];
    })();
    groupCells.push({ row: catStart, col: 0, label: cat.name, kind: 'category', indent: 0 });
    groupCells.push({
      row: catStart,
      col: OUTLINE_REGION_COL,
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
        return [
          '',
          '',
          st.name,
          status,
          orderDate,
          st.sales,
          st.profit,
          ...outlineExtraValues(r, seed),
        ];
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
        return [
          sub.name,
          outlineAttrValue(r, seed, 'sub'),
          'East',
          status,
          orderDate,
          sub.sales,
          sub.profit,
          ...outlineExtraValues(r, seed),
        ];
      })();
      groupCells.push({ row: subStart, col: 0, label: sub.name, kind: 'leaf', indent: 1 });
      groupCells.push({
        row: subStart,
        col: OUTLINE_REGION_COL,
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
          return [
            '',
            '',
            st.name,
            status,
            orderDate,
            st.sales,
            st.profit,
            ...outlineExtraValues(r, seed),
          ];
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
function buildOutlineSourceSheet(
  targetRows?: number | 'demo',
  opts?: { expandMode?: OutlineExpandMode },
): OutlineSheet {
  const expandMode = opts?.expandMode ?? 'collapsed';

  if (targetRows === undefined || targetRows === 'demo') {
    return buildOutlineFromCats(
      OUTLINE_TREE.map((cat, index) => ({
        name: cat.name,
        expanded:
          expandMode === 'collapsed'
            ? false
            : categoryExpandedForMode(expandMode, index, cat.expanded),
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
      expanded: categoryExpandedForMode(expandMode, i),
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

/** 编辑/选中时读取列配置与单元格展示值 */
function captureCellFormat(
  ws: any,
  col: number,
  row: number,
  rawValue?: unknown,
): EditFormatInfo {
  const prop =
    ws?.getProperty?.(col, row) ||
    ws?.getColumnOptions?.(col, row) ||
    ws?.getColumn?.(col) ||
    {};
  return {
    cell: cellName(col, row) || `c${col}r${row}`,
    col,
    row,
    type: prop?.type,
    mask: prop?.mask,
    format: prop?.format,
    title: prop?.title,
    raw: rawValue ?? ws?.getValueFromCoords?.(col, row, false),
    display: ws?.getValueFromCoords?.(col, row, true),
    time: new Date().toLocaleTimeString(),
  };
}

/** 表格渲染完成后打印列配置与运行时数据格式 */
function logOutlineTableRenderFormat(
  ws: any,
  columns: Array<Record<string, unknown>>,
  rowCount: number,
) {
  const columnFormats = columns.map((config, index) => {
    const runtime =
      ws?.getColumn?.(index) ||
      ws?.getColumnOptions?.(index, 0) ||
      {};
    const sampleRow = rowCount > 0 ? 0 : -1;
    return {
      index,
      field: config.title ?? runtime?.title,
      config,
      runtime: {
        type: runtime?.type,
        title: runtime?.title,
        mask: runtime?.mask,
        format: runtime?.format,
        source: runtime?.source,
        readOnly: runtime?.readOnly,
        align: runtime?.align,
      },
      sample:
        sampleRow >= 0
          ? {
              cell: captureCellFormat(ws, index, sampleRow),
            }
          : null,
    };
  });

  const headers = columns.map((col) => String(col.title ?? ''));
  const rawRows = ws?.getData?.(false) ?? [];
  const displayRows = ws?.getData?.(true) ?? [];
  let jsonRows: Array<Record<string, unknown>> = [];
  try {
    const json = ws?.getData?.(false, true, undefined, true);
    if (Array.isArray(json)) jsonRows = json as Array<Record<string, unknown>>;
  } catch {
    jsonRows = rawRows.map((row: unknown[]) => {
      const record: Record<string, unknown> = {};
      headers.forEach((key, i) => {
        record[key] = row?.[i];
      });
      return record;
    });
  }

  console.group('[Jspreadsheet 扩展] 表格渲染数据格式');
  console.log('列格式:', columnFormats);
  console.log('多行表头:', ws?.getNestedHeaders?.() ?? null);
  console.log('数据规模:', { rowCount, colCount: columns.length });
  console.log('整个表格数据:', {
    headers,
    raw: rawRows,
    display: displayRows,
    json: jsonRows,
  });
  console.groupEnd();
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

/** 透视底表：Category / SubCategory / Region / Sales / Profit */
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

function getActiveWorksheetIndex(ref: React.MutableRefObject<any>) {
  const list = getWorksheetList(ref);
  if (!list.length) return 0;
  const parent = list[0]?.parent;
  if (typeof parent?.getWorksheetActive === 'function') {
    const idx = parent.getWorksheetActive();
    return typeof idx === 'number' && idx >= 0 ? idx : 0;
  }
  return 0;
}

function getActiveWorksheetName(ref: React.MutableRefObject<any>) {
  const ws = getActiveWorksheet(ref);
  if (!ws) return '透视源数据';
  return ws.options?.worksheetName || ws.getWorksheetName?.() || '透视源数据';
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

export default function JspreadsheetLabPage() {
  return (
    <App>
      <JspreadsheetLabPageInner />
    </App>
  );
}

function JspreadsheetLabPageInner() {
  const { message } = App.useApp();
  const spreadsheet = useRef<any>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [historyCell, setHistoryCell] = useState('A1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<{ x: number; y: number } | null>(null);
  const outlineLoadTokenRef = useRef(0);
  const orderLoadTokenRef = useRef(0);
  const outlineLoadPendingRef = useRef<{
    token: number;
    t0: number;
    rows: number;
  } | null>(null);
  const orderLoadPendingRef = useRef<{
    token: number;
    t0: number;
    count: number;
  } | null>(null);
  const outlineLoadFallbackRef = useRef<number | undefined>(undefined);
  const restoreWorksheetRef = useRef<{ index: number; name: string } | null>(null);
  const outlineTabLockRef = useRef(false);
  const outlineTabGuardRef = useRef(false);
  /** 自上次保存以来有编辑的行（rowIndex → 变更明细） */
  const dirtyRowsRef = useRef<Map<number, { changes: DirtyRowChange[] }>>(new Map());
  /** 自上次保存以来编辑过的单元格 col:row */
  const dirtyCellsRef = useRef<Set<string>>(new Set());
  /** 表格加载/上次保存后的基线数据，用于对比拿到所有变更 */
  const baselineDataRef = useRef<unknown[][]>([]);

  const [orderScale, setOrderScale] = useState<OrderScale>('2000');
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderLoadInfo, setOrderLoadInfo] = useState('');
  const [outlineScale, setOutlineScale] = useState<OutlineScale>('demo');
  const [outlineBusy, setOutlineBusy] = useState(false);
  const [outlineLoadInfo, setOutlineLoadInfo] = useState('');
  const [editFormats, setEditFormats] = useState<EditFormatInfo[]>([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
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
  const isOrderPerf = false; // 扩展页不含订单明细，保留变量避免遗留逻辑报错
  const isOutlinePerf = outlineScale === '100000' || outlineScale === '1000000';
  /** 1 万行及以上视为大数据：开启双向虚拟滚动 */
  const isOutlineLarge =
    isOutlinePerf ||
    outlineScale === '10000' ||
    !!outlineSheet.liteMeta ||
    outlineSheet.data.length >= 10000;
  const sheetBusy = outlineBusy;
  const sheetLoadInfo = outlineLoadInfo;

  const destroySpreadsheet = useCallback(() => {
    // 只清空 ref，让 React 通过 key 卸载旧节点。
    // 不要 jspreadsheet.destroy(React 管理的 DOM)，否则重挂载后单元格/表头容易错乱。
    spreadsheet.current = null;
  }, []);

  /** remount 后恢复到指定工作表（订单明细 / 透视源数据切换数据量时用） */
  const pinWorksheetTab = useCallback((name: string) => {
    restoreWorksheetRef.current = {
      index: WORKSHEET_TAB_INDEX[name] ?? -1,
      name,
    };
    outlineTabLockRef.current = true;
    outlineTabGuardRef.current = false;
  }, []);

  const restoreActiveWorksheet = useCallback((onDone?: (ok: boolean) => void) => {
    const target = restoreWorksheetRef.current;
    if (!target) {
      onDone?.(false);
      return;
    }

    const markTabRestored = () => {
      if (outlineTabLockRef.current) {
        outlineTabGuardRef.current = true;
      }
    };

    const tryRestore = (): boolean => {
      const list = getWorksheetList(spreadsheet);
      if (!list.length) return false;
      const parent = list[0]?.parent;
      if (!parent?.openWorksheet) return false;

      const idx = resolvePinnedTabIndex(list, target);
      if (idx < 0) return false;

      const activeIdx =
        typeof parent.getWorksheetActive === 'function'
          ? parent.getWorksheetActive()
          : -1;
      if (activeIdx === idx) {
        markTabRestored();
        if (!outlineTabLockRef.current) {
          restoreWorksheetRef.current = null;
        }
        return true;
      }

      try {
        parent.openWorksheet(idx, true);
        const nowActive =
          typeof parent.getWorksheetActive === 'function'
            ? parent.getWorksheetActive()
            : -1;
        if (nowActive !== idx) return false;
        markTabRestored();
        if (!outlineTabLockRef.current) {
          restoreWorksheetRef.current = null;
        }
        return true;
      } catch {
        return false;
      }
    };

    const poll = (attempts = 0) => {
      if (!restoreWorksheetRef.current) {
        onDone?.(false);
        return;
      }
      if (tryRestore()) {
        onDone?.(true);
        return;
      }
      // 十万行 remount 后 worksheet 创建较慢，锁定期间持续重试（最多约 120s）
      const maxAttempts = outlineTabLockRef.current ? 2400 : 40;
      if (attempts >= maxAttempts) {
        onDone?.(false);
        return;
      }
      window.setTimeout(() => poll(attempts + 1), 50);
    };

    poll();
  }, []);

  const finishOutlineLoad = useCallback(
    (token: number) => {
      if (token !== outlineLoadTokenRef.current) return;
      const pending = outlineLoadPendingRef.current;
      if (!pending || pending.token !== token) return;
      if (outlineLoadFallbackRef.current) {
        window.clearTimeout(outlineLoadFallbackRef.current);
        outlineLoadFallbackRef.current = undefined;
      }
      outlineLoadPendingRef.current = null;
      const total = Math.round(performance.now() - pending.t0);
      setOutlineLoadInfo(
        `透视源数据 ${pending.rows.toLocaleString()} 行 · 总耗时 ${total}ms`,
      );
      restoreActiveWorksheet((ok) => {
        if (!ok) {
          restoreActiveWorksheet((ok2) => {
            if (!ok2) {
              try {
                message.warning('页签恢复可能未完成，请手动切到「透视源数据」');
              } catch {
                // ignore
              }
            }
            setOutlineBusy(false);
            outlineTabLockRef.current = false;
            outlineTabGuardRef.current = false;
            restoreWorksheetRef.current = null;
          });
          return;
        }
        setOutlineBusy(false);
        outlineTabLockRef.current = false;
        outlineTabGuardRef.current = false;
        restoreWorksheetRef.current = null;
        try {
          message.success(`透视源数据已加载 ${pending.rows.toLocaleString()} 行`);
        } catch {
          // ignore
        }
      });
    },
    [message, restoreActiveWorksheet],
  );

  const finishOrderLoad = useCallback(
    (token: number) => {
      if (token !== orderLoadTokenRef.current) return;
      const pending = orderLoadPendingRef.current;
      if (!pending || pending.token !== token) return;
      orderLoadPendingRef.current = null;
      const total = Math.round(performance.now() - pending.t0);
      setOrderLoadInfo(`${pending.count.toLocaleString()} 行 · 总耗时 ${total}ms`);
      restoreActiveWorksheet(() => {
        setOrderBusy(false);
        outlineTabLockRef.current = false;
        outlineTabGuardRef.current = false;
        restoreWorksheetRef.current = null;
        try {
          message.success(`订单明细已加载 ${pending.count.toLocaleString()} 行`);
        } catch {
          // ignore
        }
      });
    },
    [message, restoreActiveWorksheet],
  );

  useEffect(() => {
    outlineLoadBridge.onRenderDone = () => {
      const pending = outlineLoadPendingRef.current;
      if (!pending) return;
      finishOutlineLoad(pending.token);
    };
    outlineLoadBridge.restoreTab = () => {
      restoreActiveWorksheet();
    };
    return () => {
      outlineLoadBridge.onRenderDone = () => {};
      outlineLoadBridge.restoreTab = () => {};
    };
  }, [finishOutlineLoad, restoreActiveWorksheet]);

  /** 大数据 remount + 折叠 init 期间，防止页签被引擎拉回默认 sheet */
  useEffect(() => {
    if (!sheetBusy) return undefined;
    const timer = window.setInterval(() => {
      const target = restoreWorksheetRef.current;
      if (!target) return;
      const list = getWorksheetList(spreadsheet);
      if (!list.length) return;
      const parent = list[0]?.parent;
      if (!parent?.openWorksheet || typeof parent.getWorksheetActive !== 'function') return;
      const idx = resolvePinnedTabIndex(list, target);
      if (idx < 0) return;
      if (parent.getWorksheetActive() === idx) {
        if (outlineTabLockRef.current) outlineTabGuardRef.current = true;
        return;
      }
      try {
        parent.openWorksheet(idx, true);
        if (outlineTabLockRef.current) outlineTabGuardRef.current = true;
      } catch {
        // ignore
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [sheetBusy, sheetNonce]);

  const handleOrderScaleChange = useCallback(
    (value: OrderScale) => {
      if (sheetBusy) return;
      if (value === orderScale) return;

      const count = Number(value);
      const token = ++orderLoadTokenRef.current;
      setOrderBusy(true);
      setOrderScale(value);
      setOrderLoadInfo(`正在生成 ${count.toLocaleString()} 行订单明细…`);
      pinWorksheetTab('订单明细');

      window.setTimeout(() => {
        if (token !== orderLoadTokenRef.current) return;
        const t0 = performance.now();
        try {
          const data = buildSeedRows(count);
          const genCost = Math.round(performance.now() - t0);
          setOrderLoadInfo(
            `${count.toLocaleString()} 行已生成（${genCost}ms），正在渲染表格…`,
          );

          orderLoadPendingRef.current = { token, t0, count };
          destroySpreadsheet();
          setOrderData(data);
          setSheetNonce((n) => n + 1);
        } catch (err) {
          orderLoadPendingRef.current = null;
          outlineTabLockRef.current = false;
          outlineTabGuardRef.current = false;
          restoreWorksheetRef.current = null;
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
    [sheetBusy, orderScale, destroySpreadsheet, pinWorksheetTab, message],
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
      pinWorksheetTab('透视源数据');

      window.setTimeout(() => {
        if (token !== outlineLoadTokenRef.current) return;
        const t0 = performance.now();
        try {
          const next =
            value === 'demo'
              ? buildOutlineSourceSheet('demo', { expandMode: DEFAULT_OUTLINE_LAYOUT.expandMode })
              : buildOutlineSourceSheet(Number(value), { expandMode: DEFAULT_OUTLINE_LAYOUT.expandMode });
          if (token !== outlineLoadTokenRef.current) return;
          const genCost = Math.round(performance.now() - t0);
          const rows = next.data.length;
          setOutlineLoadInfo(
            `${rows.toLocaleString()} 行已生成（${genCost}ms），正在渲染表格…`,
          );

          destroySpreadsheet();
          setOutlineSheet(next);
          setSheetNonce((n) => n + 1);
          outlineLoadPendingRef.current = { token, t0, rows };

          if (outlineLoadFallbackRef.current) {
            window.clearTimeout(outlineLoadFallbackRef.current);
          }
          outlineLoadFallbackRef.current = window.setTimeout(() => {
            outlineLoadFallbackRef.current = undefined;
            finishOutlineLoad(token);
          }, 120_000);
        } catch (err) {
          if (outlineLoadFallbackRef.current) {
            window.clearTimeout(outlineLoadFallbackRef.current);
            outlineLoadFallbackRef.current = undefined;
          }
          outlineLoadPendingRef.current = null;
          outlineTabLockRef.current = false;
          outlineTabGuardRef.current = false;
          restoreWorksheetRef.current = null;
          if (token !== outlineLoadTokenRef.current) return;
          destroySpreadsheet();
          setOutlineScale('demo');
          setOutlineSheet(buildOutlineSourceSheet('demo', { expandMode: DEFAULT_OUTLINE_LAYOUT.expandMode }));
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
    [outlineScale, destroySpreadsheet, message, finishOutlineLoad, pinWorksheetTab],
  );

  const handleCreateWorksheet = useCallback(
    (ws: any, options: { worksheetName?: string }, position: number) => {
      if (!outlineTabLockRef.current) return;
      const target = restoreWorksheetRef.current;
      if (!target) return;
      const name = options?.worksheetName || ws?.getWorksheetName?.();
      if (name !== target.name && position !== target.index) return;
      restoreActiveWorksheet();
    },
    [restoreActiveWorksheet],
  );

  const handleBeforeOpenWorksheet = useCallback((_ws: any, index: number) => {
    if (!outlineTabLockRef.current || !outlineTabGuardRef.current) return;
    const target = restoreWorksheetRef.current;
    if (!target) return;
    const list = getWorksheetList(spreadsheet);
    const targetIdx = resolvePinnedTabIndex(list, target);
    if (targetIdx < 0) return;
    if (index === targetIdx) return;
    return false;
  }, []);

  const handleOpenWorksheet = useCallback(
    (_ws: any, index: number) => {
      if (!outlineTabLockRef.current) return;
      const target = restoreWorksheetRef.current;
      if (!target) return;
      const list = getWorksheetList(spreadsheet);
      const targetIdx = resolvePinnedTabIndex(list, target);
      if (targetIdx < 0) return;
      if (index === targetIdx) {
        outlineTabGuardRef.current = true;
        return;
      }
      window.requestAnimationFrame(() => restoreActiveWorksheet());
    },
    [restoreActiveWorksheet],
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

  const outlineTableRender = useMemo(
    () => buildOutlineTableRender(outlineSheet, DEFAULT_OUTLINE_LAYOUT, isOutlineLarge),
    [outlineSheet, isOutlineLarge],
  );

  const outlineColumns = outlineTableRender.columns;
  const outlineTableData = outlineTableRender.data;
  const outlineNestedHeaders = outlineTableRender.nestedHeaders;
  const outlineRenderRows = outlineTableRender.rows;
  const outlineDimensionIndex = useMemo(
    () => buildOutlineDimensionIndex(outlineSheet),
    [outlineSheet],
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
   * - 行维度：Category → SubCategory
   * - 列维度：Region
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

  // 单元格变更监听：挂在 Spreadsheet props（初始化时写入 config.onchange）
  // 透视源数据 / 透视底表：Category 树形第一列；Region 列每一行都可折叠；隐藏行号 +/-
  // sheetNonce：切换数据量会 remount 整表，需重新绑定折叠操作
  useEffect(() => {
    const attachOutlineFold = ({
      worksheetName,
      sheet,
      outlinePerf,
      withBridge,
    }: {
      worksheetName: string;
      sheet: typeof outlineSheet;
      outlinePerf: boolean;
      withBridge: boolean;
    }) => {
    // outlineBatch：仅控制分批 init/expand（性能）；样式与交互路径各档位保持一致
    const outlineBatch =
      sheet.data.length > 150 || !!sheet.liteMeta || outlinePerf;
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
    sheet.groupCells.forEach((cell) => {
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
    let rowSeqDirty = true;
    const paintCols = new Set([0, OUTLINE_REGION_COL, OUTLINE_PROFIT_COL]);

    const markRowSeqDirty = () => {
      rowSeqDirty = true;
    };

    const rebuildRowSeqMap = () => {
      if (!rowSeqDirty && rowSeqMap.size) return;
      rowSeqMap.clear();
      let seq = 0;
      const total = sheet.data.length;
      for (let r = 0; r < total; r += 1) {
        if (hiddenRows.has(r)) continue;
        seq += 1;
        rowSeqMap.set(r, seq);
      }
      rowSeqDirty = false;
    };

    const writeRowNumberCell = (cell: HTMLElement, seq: number) => {
      const key = String(seq);
      if (cell.dataset.outlineRowSeq === key) return;
      cell.dataset.outlineRowSeq = key;
      cell.querySelectorAll('i').forEach((i) => i.remove());
      let wrote = false;
      Array.from(cell.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        if (!wrote) {
          node.textContent = key;
          wrote = true;
        } else {
          node.textContent = '';
        }
      });
      if (!wrote) {
        cell.insertBefore(document.createTextNode(key), cell.firstChild);
      }
    };

    /** 按逻辑行号写序号；仅重绘视口内 DOM，避免虚拟滚动时从 1 重排导致滚动跳号 */
    const renumberVisibleRows = (table: HTMLElement | null) => {
      if (outlinePerf || !table || !rowSeqMap.size) return;
      table.querySelectorAll('td.jss_row').forEach((cellEl) => {
        const cell = cellEl as HTMLElement;
        const tr = cell.closest('tr') as HTMLElement | null;
        if (!tr) return;
        if (tr.style.display === 'none' || tr.classList.contains('jss_hidden')) return;
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
          if (hiddenRows.delete(row)) markRowSeqDirty();
          ws.showRow?.(row);
        } else {
          if (!hiddenRows.has(row)) markRowSeqDirty();
          hiddenRows.add(row);
          ws.hideRow?.(row);
        }
      } catch {
        // ignore
      }
    };

    const setRowsVisible = (ws: any, rows: number[], visible: boolean) => {
      if (!rows.length) return;
      try {
        if (visible) {
          let changed = false;
          rows.forEach((r) => {
            if (hiddenRows.delete(r)) changed = true;
          });
          if (changed) markRowSeqDirty();
          ws.showRow?.(rows.length === 1 ? rows[0] : rows);
        } else {
          let changed = false;
          rows.forEach((r) => {
            if (!hiddenRows.has(r)) changed = true;
            hiddenRows.add(r);
          });
          if (changed) markRowSeqDirty();
          ws.hideRow?.(rows.length === 1 ? rows[0] : rows);
        }
      } catch {
        rows.forEach((r) => setRowVisible(ws, r, visible));
      }
    };

    const collectRegionDetailRows = (regionRow: number) => {
      const rows: number[] = [];
      eachRegionDetailRow(regionRow, (detailRow) => rows.push(detailRow));
      return rows;
    };

    const flipToggleIcon = (toggle: HTMLElement, expanded: boolean) => {
      toggle.textContent = expanded ? '▼' : '▶';
      const td = toggle.closest('td') as HTMLElement | null;
      if (td) delete td.dataset.outlineSnap;
    };

    const applyOneRegion = (ws: any, row: number) => {
      const cell = regionByRow.get(row);
      if (cell?.kind !== 'region') return;
      const open = !!regionState.get(row);
      const detailRows =
        cell.detailRows?.length ? cell.detailRows : collectRegionDetailRows(row);
      setRowsVisible(ws, detailRows, open);
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
        [0, OUTLINE_REGION_COL, OUTLINE_PROFIT_COL].forEach((col) => {
          const cell = tableEl.querySelector(
            `td[data-x="${col}"][data-y="${r}"]`,
          ) as HTMLElement | null;
          if (cell) delete cell.dataset.outlineSnap;
        });
      }
    };

    const clearAllOutlineSnap = (tableEl: HTMLElement | null) => {
      if (!tableEl) return;
      tableEl.querySelectorAll('td[data-x][data-y]').forEach((el) => {
        delete (el as HTMLElement).dataset.outlineSnap;
      });
    };

    /** 仅从引擎 visible 重建 hideRow 追踪 */
    const rebuildHiddenRowsFromEngine = (ws: any) => {
      hiddenRows.clear();
      markRowSeqDirty();
      const total = sheet.data.length;
      for (let r = 0; r < total; r += 1) {
        if (ws.rows?.[r]?.visible === false) hiddenRows.add(r);
      }
    };

    const isCategorySpanVisible = (ws: any, catRow: number, span: number) => {
      for (let i = catRow + 1; i <= catRow + span; i += 1) {
        if (ws.rows?.[i]?.visible !== false && !hiddenRows.has(i)) return true;
      }
      return false;
    };

    /** 绑定初 ws.rows 可能尚未合并 props，用 sheet.rows 作为行组配置源 */
    const listCategoryRows = () =>
      Object.keys(sheet.rows)
        .map(Number)
        .filter((r) => sheet.rows[r]?.group)
        .sort((a, b) => a - b);

    const ensureWsRowMetaFromSheet = (ws: any) => {
      if (!ws.rows) ws.rows = {};
      Object.entries(sheet.rows).forEach(([key, meta]) => {
        const row = Number(key);
        const src = meta as { group: number; state: boolean };
        if (!ws.rows[row]) {
          ws.rows[row] = { group: src.group, state: src.state };
          return;
        }
        if (ws.rows[row].group == null) ws.rows[row].group = src.group;
        if (typeof ws.rows[row].state !== 'boolean') ws.rows[row].state = src.state;
      });
    };

    const showCategorySpanRows = (
      ws: any,
      row: number,
      span: number,
      opts?: { ignoreHistory?: boolean },
    ) => {
      const ignoreHistory = opts?.ignoreHistory !== false;
      for (let i = row + 1; i <= row + span; i += 1) {
        hiddenRows.delete(i);
        try {
          ws.showRow?.(i);
        } catch {
          // ignore
        }
      }
      if (outlinePerf) {
        try {
          ws.setRowGroup?.(row, span, true, ignoreHistory);
        } catch {
          try {
            ws.openRowGroup?.(row);
          } catch {
            // ignore
          }
        }
      } else {
        try {
          ws.openRowGroup?.(row);
        } catch {
          // ignore
        }
      }
      if (ws.rows?.[row]) ws.rows[row].state = true;
    };

    const applyRegionVisibilityInSpan = (ws: any, from: number, to: number) => {
      for (let r = from; r <= to; r += 1) {
        if (regionByRow.has(r)) applyOneRegion(ws, r);
      }
    };

    const applyCategoryVisibilityDemo = (
      ws: any,
      row: number,
      opts?: { ignoreHistory?: boolean },
    ) => {
      const meta = ws.rows?.[row];
      if (!meta?.group) return;
      const span = Number(meta.group) || 0;
      const open = !!meta.state;
      const ignoreHistory = opts?.ignoreHistory !== false;

      /** 10万+：Category 用 setRowGroup；hideRow 仅用于 Region 州明细 */
      if (outlinePerf) {
        if (!open) {
          meta.state = false;
          // 须先清 span 内 hideRow，再 setRowGroup(false)（与 expand 对称）
          for (let i = row + 1; i <= row + span; i += 1) {
            hiddenRows.delete(i);
            try {
              ws.showRow?.(i);
            } catch {
              // ignore
            }
          }
          try {
            ws.setRowGroup?.(row, span, false, ignoreHistory);
          } catch {
            try {
              ws.closeRowGroup?.(row);
            } catch {
              // ignore
            }
          }
          meta.state = false;
          try {
            ws.updateSelectionFromCoords?.(0, row, 0, row);
          } catch {
            // ignore
          }
          return;
        }
        meta.state = true;
        showCategorySpanRows(ws, row, span, { ignoreHistory });
        applyRegionVisibilityInSpan(ws, row, row + span);
        try {
          ws.updateSelectionFromCoords?.(0, row, 0, row);
        } catch {
          // ignore
        }
        return;
      }

      if (!open) {
        meta.state = false;
        // 非 perf：引擎层保持 open，语义收起只靠 hideRow（勿 closeRowGroup，否则 showRow 无效）
        try {
          ws.openRowGroup?.(row);
        } catch {
          // ignore
        }
        meta.state = false;
        const childRows: number[] = [];
        for (let i = row + 1; i <= row + span; i += 1) childRows.push(i);
        setRowsVisible(ws, childRows, false);
        return;
      }
      meta.state = true;
      showCategorySpanRows(ws, row, span, { ignoreHistory });
      applyRegionVisibility(ws, { from: row, to: row + span });
    };

    /** Category 语义收起时：仅按 Region 露出必要行；引擎层解锁但第一列 state 保持 false */
    const applyRegionWhenCategoryCollapsed = (ws: any, catRow: number) => {
      const meta = ws.rows?.[catRow];
      if (!meta?.group || meta.state) return;
      const span = Number(meta.group) || 0;
      meta.state = false;

      // 10万+：须先解除 closeRowGroup，否则 showRow 无效；语义上 Category 仍收起
      if (outlinePerf) {
        for (let i = catRow + 1; i <= catRow + span; i += 1) {
          hiddenRows.delete(i);
          try {
            ws.showRow?.(i);
          } catch {
            // ignore
          }
        }
        try {
          ws.setRowGroup?.(catRow, span, true, true);
        } catch {
          try {
            ws.openRowGroup?.(catRow);
          } catch {
            // ignore
          }
        }
      } else {
        try {
          ws.openRowGroup?.(catRow);
        } catch {
          // ignore
        }
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

      try {
        ws.updateSelectionFromCoords?.(OUTLINE_REGION_COL, catRow, OUTLINE_REGION_COL, catRow);
      } catch {
        // ignore
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
          `td[data-x="${OUTLINE_REGION_COL}"][data-y="${catRow}"]`,
        ) as HTMLElement | null;
        if (headerRegionCell) paintCell(ws, headerRegionCell, headerRegion);
      }
      if (!includeRegions) return;
      for (let r = catRow + 1; r <= catRow + span; r += 1) {
        if (!regionByRow.has(r)) continue;
        const regionCell = table.querySelector(
          `td[data-x="${OUTLINE_REGION_COL}"][data-y="${r}"]`,
        ) as HTMLElement | null;
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
      const collapsed: number[] = [];
      Object.keys(sheet.rows).forEach((key) => {
        const row = Number(key);
        const meta = sheet.rows[row];
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
        runWithoutHistory(() => {
          for (; idx < end; idx += 1) {
            const catRow = collapsed[idx];
            const span = Number(ws.rows?.[catRow]?.group) || 0;
            try {
              if (span > 0) ws.setRowGroup?.(catRow, span, false, true);
              else ws.closeRowGroup?.(catRow);
            } catch {
              try {
                ws.closeRowGroup?.(catRow);
              } catch {
                // ignore
              }
            }
            if (ws.rows?.[catRow]) ws.rows[catRow].state = false;
          }
        });
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

    const { stateDetailRows, negProfitRows } = sheet;

    const paintStateDetailCell = (cell: HTMLElement, col: number) => {
      if (cell.dataset.outlineStateCol === String(col)) return;
      cell.dataset.outlineStateCol = String(col);
      cell.classList.add('readonly');
      if (col === 0) {
        cell.classList.add('jss-outline-state-fill');
        return;
      }
      if (col !== OUTLINE_REGION_COL) return;
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
      if (col === OUTLINE_REGION_COL) cell.classList.add('jss-outline-region-col');
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

    let paintPending = false;

    const paint = (
      ws: any,
      root: HTMLElement,
      outlineTable?: HTMLElement | null,
      opts?: { stripIcons?: boolean },
    ) => {
      if (disposed) return;
      if (painting) {
        paintPending = true;
        return;
      }
      painting = true;
      try {
        const table =
          outlineTable ||
          getOutlineTable(ws) ||
          (root.querySelector('table.jss-outline-table') as HTMLElement | null);
        if (!outlinePerf && opts?.stripIcons !== false) stripMaterialIcons(table);

        // 单次扫描 data-x，比三条选择器合并查询更省
        const searchRoot = table || root;
        const cells = searchRoot.querySelectorAll<HTMLElement>('td[data-x]');
        if (cells.length) {
          for (let i = 0; i < cells.length; i += 1) {
            const cell = cells[i];
            if (cell.classList.contains('jss_row')) continue;
            const col = Number(cell.getAttribute('data-x'));
            if (!paintCols.has(col)) continue;
            const row = Number(cell.getAttribute('data-y'));
            if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
            const meta = foldMetaByKey.get(`${col}:${row}`);
            if (meta) {
              paintCell(ws, cell, meta);
              if (col === OUTLINE_PROFIT_COL) paintProfitCell(cell, row);
              continue;
            }
            if (stateDetailRows.has(row)) {
              if (col === 0 || col === OUTLINE_REGION_COL) paintStateDetailCell(cell, col);
              if (col === OUTLINE_PROFIT_COL) paintProfitCell(cell, row);
            }
          }
        } else if (!outlineBatch) {
          // fallback：虚拟滚动首帧尚无 data-x 时，按元数据补绘（仅小表）
          sheet.groupCells.forEach((meta) => {
            const el = getCellEl(ws, meta.col, meta.row);
            if (el) paintCell(ws, el, meta);
          });
        }

        if (rowSeqDirty) rebuildRowSeqMap();
        renumberVisibleRows(table);
      } finally {
        painting = false;
        if (paintPending) {
          paintPending = false;
          paint(ws, root, outlineTable, opts);
        }
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

    const outlineBindKey = `${worksheetName}-${sheetNonce}`;

    let schedulePaintRef: (() => void) | null = null;
    let scrollPaintRef: (() => void) | null = null;
    let scrollPaintRaf: number | undefined;

    const mutationNeedsPaint = (records: MutationRecord[]) => {
      for (let i = 0; i < records.length; i += 1) {
        const rec = records[i];
        if (rec.type !== 'childList') continue;
        if (rec.addedNodes.length || rec.removedNodes.length) return true;
      }
      return false;
    };

    const stopWatching = () => {
      observer?.disconnect();
      if (scrollPaintRaf) {
        window.cancelAnimationFrame(scrollPaintRaf);
        scrollPaintRaf = undefined;
      }
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
        observer = new MutationObserver((records) => {
          if (outlineBulkBusy || outlineInitBusy) return;
          if (!mutationNeedsPaint(records)) return;
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
      onScrollPaint = () => scrollPaintRef?.();
      scrollTarget.addEventListener('scroll', onScrollPaint, { passive: true });
      (rootEl as any)[scrollElKey] = scrollTarget;
      (rootEl as any)[scrollFnKey] = onScrollPaint;
    };

    const clickHandlerKey = `__outlineClickHandler:${worksheetName}`;
    const bindKeyProp = `__outlineBindKey:${worksheetName}`;
    const scrollElKey = `__outlineScrollEl:${worksheetName}`;
    const scrollFnKey = `__outlineScrollFn:${worksheetName}`;
    const onTabKey = `__outlineOnTab:${worksheetName}`;
    const tabElsKey = `__outlineTabEls:${worksheetName}`;

    const detachOutlineDom = (el: HTMLElement | null) => {
      if (!el) return;
      const prevClick = (el as any)[clickHandlerKey] as
        | ((e: MouseEvent) => void)
        | undefined;
      if (prevClick) {
        el.removeEventListener('click', prevClick, true);
        delete (el as any)[clickHandlerKey];
      }
      delete (el as any)[bindKeyProp];
      const prevScrollEl = (el as any)[scrollElKey] as HTMLElement | null | undefined;
      const prevScrollFn = (el as any)[scrollFnKey] as (() => void) | null | undefined;
      if (prevScrollEl && prevScrollFn) {
        prevScrollEl.removeEventListener('scroll', prevScrollFn);
        delete (el as any)[scrollElKey];
        delete (el as any)[scrollFnKey];
      }
      const prevTab = (el as any)[onTabKey] as (() => void) | undefined;
      const prevTabEls = (el as any)[tabElsKey] as NodeListOf<Element> | undefined;
      if (prevTab && prevTabEls) prevTabEls.forEach((node) => node.removeEventListener('click', prevTab));
      delete (el as any)[onTabKey];
      delete (el as any)[tabElsKey];
    };

    const bind = () => {
      const ws = getWorksheetByName(spreadsheet, worksheetName);
      if (!ws) return false;
      const table = getOutlineTable(ws);
      if (!table) return false;

      const root =
        (table.closest('.jss_container') as HTMLElement) ||
        (ws.element as HTMLElement) ||
        (table.closest('.jss_worksheet, .jss_content, .jss') as HTMLElement) ||
        table;

      const outlineBindKey = `${worksheetName}-${sheetNonce}`;
      if ((root as any)[bindKeyProp] === outlineBindKey) return true;

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
        // 只处理本工作表表格内的折叠点击，避免双页签共享容器时互相抢事件
        if (!toggle || !table.contains(toggle)) return;
        const kind = toggle.dataset.kind;
        if (kind !== 'category' && kind !== 'region') return;

        e.preventDefault();
        e.stopPropagation();
        const row = Number(toggle.dataset.row);
        if (!Number.isFinite(row)) return;

        if (kind === 'category') {
          runWithoutHistory(() => {
            const groupMeta = ws.rows?.[row];
            if (groupMeta?.group == null || groupMeta.group <= 0) return;
            const span = Number(groupMeta.group) || 0;
            const spanVisible = isCategorySpanVisible(ws, row, span);
            let nextOpen = !groupMeta.state;
            if (groupMeta.state && !spanVisible) {
              nextOpen = true;
            } else if (!groupMeta.state && spanVisible) {
              nextOpen = false;
            }
            flipToggleIcon(toggle, nextOpen);
            groupMeta.state = nextOpen;
            if (!nextOpen) {
              regionState.set(row, false);
              for (let r = row + 1; r <= row + span; r += 1) {
                if (regionByRow.has(r)) regionState.set(r, false);
              }
            }
            applyCategoryVisibilityDemo(ws, row);
            markRowSeqDirty();
            rebuildRowSeqMap();
            clearOutlineSnapInSpan(table, row, span);
            paint(ws, root, table);
          });
          return;
        }

        const meta = regionByRow.get(row);
        if (meta?.kind !== 'region') return;

        runWithoutHistory(() => {
          const next = !regionState.get(row);
          flipToggleIcon(toggle, next);
          regionState.set(row, next);

          const catStart = findCategoryStart(ws, row);
          if (catStart >= 0 && !ws.rows[catStart]?.state) {
            applyRegionWhenCategoryCollapsed(ws, catStart);
            ws.rows[catStart].state = false;
            const span = Number(ws.rows[catStart]?.group) || 0;
            markRowSeqDirty();
            rebuildRowSeqMap();
            clearOutlineSnapInSpan(table, catStart, span);
            paint(ws, root, table);
            return;
          }
          applyOneRegion(ws, row);
          try {
            ws.updateSelectionFromCoords?.(OUTLINE_REGION_COL, row, OUTLINE_REGION_COL, row);
          } catch {
            // ignore
          }
          const catSpan =
            catStart >= 0 ? Number(ws.rows[catStart]?.group) || 0 : 0;
          rebuildRowSeqMap();
          if (catStart >= 0) clearOutlineSnapInSpan(table, catStart, catSpan);
          paint(ws, root, table);
        });
      };
      (root as any)[clickHandlerKey] = clickHandler;
      (root as any)[bindKeyProp] = outlineBindKey;
      root.addEventListener('click', clickHandler, true);

      const schedulePaint = () => {
        if (disposed || outlineBulkBusy || outlineInitBusy) return;
        if (paintTimer) window.clearTimeout(paintTimer);
        const debounceMs = outlineBatch ? 48 : 0;
        if (debounceMs === 0) {
          paint(ws, root, table);
          return;
        }
        paintTimer = window.setTimeout(() => {
          paintTimer = undefined;
          if (disposed || outlineBulkBusy || outlineInitBusy) return;
          paint(ws, root, table);
        }, debounceMs);
      };
      schedulePaintRef = schedulePaint;

      scrollPaintRef = () => {
        if (disposed || outlineBulkBusy || outlineInitBusy) return;
        if (scrollPaintRaf) return;
        scrollPaintRaf = window.requestAnimationFrame(() => {
          scrollPaintRaf = undefined;
          if (disposed || outlineBulkBusy || outlineInitBusy) return;
          paint(ws, root, table, { stripIcons: false });
        });
      };

      const flushPaint = () => {
        if (paintTimer) window.clearTimeout(paintTimer);
        paintTimer = undefined;
        if (scrollPaintRaf) {
          window.cancelAnimationFrame(scrollPaintRaf);
          scrollPaintRaf = undefined;
        }
        if (!outlinePerf) stripMaterialIcons(table);
        if (rowSeqDirty) rebuildRowSeqMap();
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
      (root as any)[onTabKey] = onTab;
      (root as any)[tabElsKey] = tabEls;

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

      if (withBridge) {
      outlineBridge.expandAll = (onDone) => {
        outlineBulkBusy = true;
        regionByRow.forEach((_, r) => regionState.set(r, true));
        const cats = listCategoryRows();
        const expandOne = (row: number) =>
          runWithoutHistory(() => {
            ensureWsRowMetaFromSheet(ws);
            ws.rows[row].state = true;
            applyCategoryVisibilityDemo(ws, row);
          });
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
        const cats = listCategoryRows();
        const collapseOne = (row: number) =>
          runWithoutHistory(() => {
            ensureWsRowMetaFromSheet(ws);
            ws.rows[row].state = false;
            applyCategoryVisibilityDemo(ws, row);
          });
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
      }

      const applyInitialOutlineVisibility = (onDone: () => void) => {
        ensureWsRowMetaFromSheet(ws);
        const cats = listCategoryRows();
        const applyOne = (row: number) =>
          runWithoutHistory(() => applyCategoryVisibilityDemo(ws, row));
        if (!cats.length) {
          window.setTimeout(() => applyInitialOutlineVisibility(onDone), 50);
          return;
        }
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
        if (withBridge) {
          outlineLoadBridge.restoreTab();
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              if (disposed || bindToken !== sheetNonce) return;
              outlineLoadBridge.onRenderDone();
            });
          });
        }
      };

      if (outlinePerf) {
        outlineInitBusy = true;
        ensureWsRowMetaFromSheet(ws);
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
      if (scrollPaintRaf) window.cancelAnimationFrame(scrollPaintRaf);
      scrollPaintRaf = undefined;
      initTimers.forEach((id) => window.clearTimeout(id));
      initTimers.length = 0;
      const cancelRic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;
      if (cancelRic) pendingIdle.forEach((id) => cancelRic(id));
      pendingIdle.length = 0;
    };

    if (bind()) {
      return () => {
        disposed = true;
        if (withBridge) {
          outlineBridge.expandAll = () => {};
          outlineBridge.collapseAll = () => {};
        }
        clearOutlineTimers();
        stopWatching();
        detachOutlineDom(boundRoot);
        if (boundRoot) {
          delete (boundRoot as any)[onTabKey];
          delete (boundRoot as any)[tabElsKey];
        }
      };
    }

    const timer = window.setInterval(() => {
      if (bind()) window.clearInterval(timer);
    }, 50);
    return () => {
      disposed = true;
      if (withBridge) {
        outlineBridge.expandAll = () => {};
        outlineBridge.collapseAll = () => {};
      }
      clearOutlineTimers();
      stopWatching();
      window.clearInterval(timer);
      observer?.disconnect();
      detachOutlineDom(boundRoot);
      if (boundRoot) {
        delete (boundRoot as any)[onTabKey];
        delete (boundRoot as any)[tabElsKey];
      }
    };
    };

    const cleanups: Array<() => void> = [];
    if (outlineSheet.groupCells.length) {
      cleanups.push(
        attachOutlineFold({
          worksheetName: '透视源数据',
          sheet: outlineSheet,
          outlinePerf: isOutlinePerf,
          withBridge: true,
        }),
      );
    }
    return () => cleanups.forEach((fn) => fn());
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
      return { fromText, toText };
    },
    [stringifyValue],
  );

  const markDirtyRow = useCallback(
    (row: number, change: DirtyRowChange) => {
      const dirty = dirtyRowsRef.current;
      const prev = dirty.get(row);
      if (prev) {
        prev.changes.push(change);
      } else {
        dirty.set(row, { changes: [change] });
      }
    },
    [],
  );

  const recordCellDirty = useCallback(
    (
      worksheet: any,
      col: number,
      row: number,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      const fromText = stringifyValue(oldValue);
      const toText = stringifyValue(newValue);
      if (fromText === toText) return false;

      const name = cellName(col, row);
      if (!name) return false;

      const payload = buildCellChangePayload(
        worksheet,
        col,
        row,
        oldValue,
        newValue,
        outlineColumns,
      );
      markDirtyRow(row, {
        cell: name,
        field: payload.field,
        col,
        row,
        rowNumber: payload.rowNumber,
        oldValue: payload.oldValue,
        value: payload.newValue,
        from: fromText,
        to: toText,
        raw: payload.raw,
        display: payload.display,
        time: new Date().toLocaleString(),
      });
      dirtyCellsRef.current.add(cellCoordKey(col, row));
      return true;
    },
    [markDirtyRow, outlineColumns, stringifyValue],
  );

  const syncBaselineSnapshot = useCallback(() => {
    const ws =
      getWorksheetByName(spreadsheet, '透视源数据') ||
      getActiveWorksheet(spreadsheet);
    if (!ws) return;
    baselineDataRef.current = cloneTableData(ws.getData?.(false));
    dirtyRowsRef.current.clear();
    dirtyCellsRef.current.clear();
  }, [spreadsheet]);

  const handleSave = useCallback(() => {
    const ws =
      getWorksheetByName(spreadsheet, '透视源数据') ||
      getActiveWorksheet(spreadsheet);
    if (!ws) {
      message.warning('未找到「透视源数据」工作表');
      return null;
    }

    const fullScan = outlineSheet.data.length <= SAVE_FULL_DIFF_ROW_LIMIT;
    const updatedRows = collectUpdatedRows(
      ws,
      baselineDataRef.current,
      outlineColumns,
      dirtyCellsRef.current,
      fullScan,
    ).map((item) => {
      const dimensions = resolveOutlineRowDimensions(
        ws,
        item.rowIndex,
        outlineDimensionIndex,
      );
      return {
        ...item,
        dimension: dimensions.dimension,
        dimensions,
      };
    });

    const modifiedCellCount = updatedRows.reduce(
      (sum, row) => sum + row.modifiedFields.length,
      0,
    );

    const savePayload = {
      worksheetName: ws.getWorksheetName?.() ?? '透视源数据',
      updatedRowCount: updatedRows.length,
      modifiedCellCount,
      updatedRows,
    };

    console.group('[Jspreadsheet 扩展] 保存');
    console.log('修改的行（维度 / 字段 / 坐标 / 值）:', savePayload.updatedRows);
    console.log('保存载荷:', savePayload);
    console.groupEnd();

    if (updatedRows.length === 0) {
      message.info('无行变更');
    } else {
      message.success(
        `已保存：${updatedRows.length} 行、${modifiedCellCount} 个单元格有更新（详见控制台）`,
      );
    }
    syncBaselineSnapshot();
    return savePayload;
  }, [message, outlineColumns, outlineDimensionIndex, outlineSheet.data.length, spreadsheet, syncBaselineSnapshot]);

  const handleSetF82 = useCallback(() => {
    const ws =
      getWorksheetByName(spreadsheet, '透视源数据') ||
      getActiveWorksheet(spreadsheet);
    if (!ws) {
      message.warning('表格尚未加载');
      return;
    }
    const value = 8888;
    ws.setValue?.('F82', value, true);
    message.success(`已将 F82（Sales 第 82 行）设为 ${value}`);
  }, [message, spreadsheet]);

  const logTableRenderFormat = useCallback(() => {
    const ws =
      getWorksheetByName(spreadsheet, '透视源数据') ||
      getActiveWorksheet(spreadsheet);
    if (!ws) return;
    logOutlineTableRenderFormat(ws, outlineColumns, outlineSheet.data.length);
  }, [outlineColumns, outlineSheet.data.length, spreadsheet]);

  historyBridge.onChange = (worksheet, x, y, oldValue, newValue) => {
    const col = Number(x);
    const row = Number(y);
    const name = cellName(col, row);
    if (!name) return;

    const changed = recordCellDirty(worksheet, col, row, oldValue, newValue);
    if (!changed) return;

    const payload = buildCellChangePayload(
      worksheet,
      col,
      row,
      oldValue,
      newValue,
      outlineColumns,
    );

    console.log('[Jspreadsheet 扩展] 单元格更新', payload);
    setHistoryCell(name);
    pushTrack(name, oldValue, newValue);
    setEditFormats((prev) => [
      captureCellFormat(worksheet, col, row, newValue),
      ...prev,
    ].slice(0, 30));
  };

  historyBridge.onSelect = (worksheet, px, py, ux, uy) => {
    const start = cellName(Number(px), Number(py));
    const end = cellName(Number(ux), Number(uy));
    if (!start) return;
    setHistoryCell(start === end ? start : `${start}:${end}`);
    if (start === end && worksheet) {
      setEditFormats((prev) => [
        captureCellFormat(worksheet, Number(px), Number(py)),
        ...prev,
      ].slice(0, 30));
    }
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
        getWorksheetByName(spreadsheet, '透视源数据') ||
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

      return items;
    },
    [columns.length],
  );

  const toolbar = useCallback((defaultToolbar: any) => {
    const ws = () =>
      getActiveWorksheet(spreadsheet) ||
      getWorksheetByName(spreadsheet, '透视源数据');

    const saveItem = {
      type: 'label',
      content: '保存',
      tooltip: '保存：控制台输出每行维度、修改字段、坐标与值',
      onclick: () => handleSave(),
    };

    const insertSaveAfterRedo = (items: any[]) => {
      const redoIndex = items.findIndex(
        (item) =>
          item &&
          item.type !== 'divisor' &&
          String(item.content || '').toLowerCase() === 'redo',
      );
      if (redoIndex >= 0) {
        items.splice(redoIndex + 1, 0, saveItem);
      } else {
        items.unshift(saveItem);
      }
      return items;
    };

    const extraItems = [
      { type: 'divisor' },
      {
        type: 'label',
        content: '复制',
        tooltip: '批量复制选区',
        onclick: () => {
          ws()?.copy?.();
          message.success('已复制选区');
        },
      },
      { type: 'divisor' },
      {
        type: 'label',
        content: '隐藏列',
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
        type: 'label',
        content: '显示列',
        tooltip: '显示全部隐藏列',
        onclick: () => {
          const sheet = ws();
          const total = sheet?.getHeaders?.()?.length ?? columns.length;
          sheet?.showColumn?.(Array.from({ length: total }, (_, i) => i));
        },
      },
      {
        type: 'label',
        content: '自适应',
        tooltip: '自适应内容宽度',
        onclick: () => {
          ws()?.autoWidth?.();
          message.success('已按内容自适应列宽');
        },
      },
      {
        type: 'label',
        content: '导出',
        tooltip: '导出 CSV',
        onclick: () => ws()?.download?.(),
      },
    ];

    // 官方约定：回调收到 { items, responsive, ... }，应原地追加，保留撤销/重做等默认项样式
    if (defaultToolbar && Array.isArray(defaultToolbar.items)) {
      defaultToolbar.items = removeDefaultToolbarSave(defaultToolbar.items);
      localizeToolbarItems(defaultToolbar.items);
      insertSaveAfterRedo(defaultToolbar.items);
      defaultToolbar.items.push(...extraItems);
      moveFullscreenToEnd(defaultToolbar.items);
      return defaultToolbar;
    }
    if (Array.isArray(defaultToolbar)) {
      const items = removeDefaultToolbarSave(defaultToolbar);
      localizeToolbarItems(items);
      insertSaveAfterRedo(items);
      items.push(...extraItems);
      moveFullscreenToEnd(items);
      return items;
    }
    return { items: extraItems, responsive: true };
  }, [columns.length, handleSave, message, spreadsheet]);

  useEffect(() => {
    dirtyRowsRef.current.clear();
    dirtyCellsRef.current.clear();
    baselineDataRef.current = [];
  }, [sheetNonce, outlineSheet]);

  useEffect(() => {
    if (sheetBusy) return undefined;
    const timer = window.setTimeout(() => syncBaselineSnapshot(), 150);
    return () => window.clearTimeout(timer);
  }, [sheetBusy, sheetNonce, outlineSheet, syncBaselineSnapshot]);

  useEffect(() => {
    if (sheetBusy) return undefined;
    const timer = window.setTimeout(() => logTableRenderFormat(), 100);
    return () => window.clearTimeout(timer);
  }, [sheetBusy, sheetNonce, outlineColumns, outlineScale, logTableRenderFormat]);

  const focusCell = historyCell.split(':')[0];
  const cellHistory = useMemo(
    () => tracks.filter((item) => item.cell === focusCell),
    [tracks, focusCell],
  );

  return (
    <div className="jss-page">
      <p className="jss-page__hint">
        Jspreadsheet · 扩展页（透视源数据完整副本，与「大数据演示」互不影响）。Category / Region
        折叠；多行表头 + 英文字段；编辑或选中单元格时展示列数据格式；Attribute、Status、OrderDate、Sales/Profit 可编辑；1 万行及以上双向虚拟滚动。
      </p>

      <div className="jss-page__outline-tools">
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
            独立副本：切换数据量不会影响大数据演示页
          </span>
        )}
        <Button size="small" onClick={handleSetF82} disabled={sheetBusy}>
          设置 F82
        </Button>
        <Button
          size="small"
          style={{ marginLeft: 'auto' }}
          onClick={() => setSidePanelOpen((open) => !open)}
        >
          {sidePanelOpen ? '收起侧栏' : '展开侧栏'}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.csv,.xlsx"
        style={{ display: 'none' }}
        onChange={handleAttachFile}
      />

      <div className={`jss-page__body${sidePanelOpen ? '' : ' jss-page__body--side-collapsed'}`}>
        <div className={`jss-page__sheet${sheetBusy ? ' is-loading' : ''}`}>
          {sheetBusy ? (
            <div className="jss-page__sheet-loading">
              <Spin size="large" tip={sheetLoadInfo || '加载中…'} />
            </div>
          ) : null}
          <Spreadsheet
            key={`jss-lab-outline-${sheetNonce}`}
            ref={spreadsheet}
            toolbar={toolbar}
            bar={true}
            extensions={extensions}
            tabs={true}
            tableOverflow={true}
            tableWidth="100%"
            tableHeight="560px"
            onload={() => {
              if (outlineLoadPendingRef.current || outlineTabLockRef.current) {
                restoreActiveWorksheet();
              }
              window.setTimeout(() => syncBaselineSnapshot(), 100);
            }}
            oncreateworksheet={handleCreateWorksheet}
            onbeforeopenworksheet={handleBeforeOpenWorksheet}
            onopenworksheet={handleOpenWorksheet}
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
              worksheetName="透视源数据"
              data={outlineTableData}
              columns={outlineColumns}
              nestedHeaders={outlineNestedHeaders}
              rows={outlineRenderRows}
              cells={outlineReadonlyCells}
              filters={false}
              columnResize={true}
              rowResize={!isOutlineLarge}
              defaultRowHeight={DEFAULT_OUTLINE_LAYOUT.defaultRowHeight}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="560px"
              virtualizationX={isOutlineLarge}
              virtualizationY={true}
              pagination={false}
              oneditionstart={(_ws: any, _cell: any, x: any) => {
                const col = Number(x);
                if (col === 0 || col === OUTLINE_REGION_COL) return false;
                return true;
              }}
            />
          </Spreadsheet>
        </div>

        <aside className="jss-page__side">
          <section className="jss-panel" style={{ flex: 1 }}>
            <div className="jss-panel__title">编辑数据格式</div>
            {editFormats.length === 0 ? (
              <div className="jss-panel__empty">
                选中或编辑单元格后，展示字段名、坐标 (col/row)、type/mask/format 与 raw/display 值；每次更新也会打印到控制台。
              </div>
            ) : (
              <ul className="jss-panel__list">
                {editFormats.slice(0, 20).map((item, idx) => (
                  <li key={`${item.cell}-${item.time}-${idx}`} className="jss-panel__item">
                    <div>
                      <strong>{item.cell}</strong>
                      {item.title ? ` · ${item.title}` : ''}
                      <span className="jss-panel__meta">
                        {' '}
                        · col={item.col} row={item.row}
                      </span>
                      <span className="jss-panel__meta"> · {item.time}</span>
                    </div>
                    <div className="jss-panel__meta">
                      type: {item.type || '—'}
                      {item.mask ? ` · mask: ${item.mask}` : ''}
                      {item.format ? ` · format: ${item.format}` : ''}
                    </div>
                    <div>raw: {String(item.raw ?? '∅')}</div>
                    <div>display: {String(item.display ?? '∅')}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
