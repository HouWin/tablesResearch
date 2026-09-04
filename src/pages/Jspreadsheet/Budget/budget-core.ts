/**
 * 费用表 Data Grid · 投影构建 / 表头合并 / 折叠绘制
 */
import {
  BUDGET_VALUE_FIELDS,
  type ViewRow,
} from '../../SpreadJSDemo/spreadsheet/model';

export const BUDGET_MONTHS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
] as const;

/** 列：0 组织 / 1 科目 / 2 功能属性 / 3 全年合计 / 4–15 月度 / 16 业务日期 */
export const COL_ORG = 0;
export const COL_SUBJECT = 1;
export const COL_ATTR = 2;
export const COL_ANNUAL = 3;
export const COL_MONTH_START = 4;
export const COL_DATE = COL_MONTH_START + BUDGET_MONTHS.length;
export const COL_COUNT = COL_DATE + 1;

export const ATTR_OPTIONS = [
  { id: '管理', name: '管理' },
  { id: '销售', name: '销售' },
  { id: '-', name: '-' },
];

export type BudgetEditPayload = {
  action: 'change';
  type: 'value' | 'attr' | 'date';
  row: { key: string; path: string[] };
  col: { key: string; path: string[] };
  oldValue: number | string | null;
  newValue: number | string | null;
};

/** 待保存变更（无单元格高亮，仅用于计数与保存载荷） */
export type BudgetDirtyChange = {
  type: 'value' | 'attr' | 'date';
  row: { key: string; path: string[] };
  col: { key: string; path: string[] };
  field: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  rowData: Record<string, unknown>;
  rowIndex?: number;
};

export type TrackItem = {
  id: string;
  cell: string;
  stableKey: string;
  from: string;
  to: string;
  time: string;
};

export type FoldMeta = {
  row: number;
  col: 0 | 1;
  label: string;
  indent: number;
  canFold: boolean;
  expanded: boolean;
  productId: string;
  regionRootId?: string;
};

export type BuiltSheet = {
  viewRows: ViewRow[];
  /** 大档时 viewRows 仅为模板；真实行数以 data.length 为准 */
  large: boolean;
  data: any[][];
  columns: Array<Record<string, unknown>>;
  nestedHeaders: Array<
    Array<{ title: string; colspan: number; align: 'center' }>
  >;
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  foldMetas: FoldMeta[];
  comments: Record<string, any>;
};

export type BudgetScale = 'demo' | '10000' | '100000';

export const BUDGET_SCALE_OPTIONS: Array<{ value: BudgetScale; label: string }> =
  [
    { value: 'demo', label: '演示数据' },
    { value: '10000', label: '约 1 万行（虚拟滚动）' },
    { value: '100000', label: '约 10 万行（虚拟滚动）' },
  ];

export function scaleTargetRows(scale: BudgetScale): number {
  if (scale === '10000') return 10000;
  if (scale === '100000') return 100000;
  return 0;
}

const DIM_BG = 'background-color:#93c5f3;text-align:center;vertical-align:middle';
const ORG_BG = `${DIM_BG};font-weight:600;text-align:left`;
const SUBJECT_BG =
  'background-color:#93c5f3;text-align:left;vertical-align:middle';
export const ANNUAL_BG = 'background-color:#fff2cc;text-align:right';

export function toEditValue(value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).replace(/,/g, '').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) && raw !== '' ? num : String(value);
}

export const BUDGET_FLAT_HEADERS = [
  '组织',
  '科目',
  '功能属性',
  '全年合计',
  ...BUDGET_MONTHS,
  '业务日期',
] as const;

export type SelectionStats = {
  cells: number;
  numeric: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  truncated: boolean;
};

const MAX_SELECTION_STATS_CELLS = 5000;

export function calcSelectionStats(
  data: any[][],
  px: number,
  py: number,
  ux: number,
  uy: number,
): SelectionStats {
  const c0 = Math.max(0, Math.min(px, ux));
  const c1 = Math.max(px, ux);
  const r0 = Math.max(0, Math.min(py, uy));
  const r1 = Math.max(py, uy);
  const rowCount = Math.max(0, r1 - r0 + 1);
  const colCount = Math.max(0, c1 - c0 + 1);
  const total = rowCount * colCount;
  const limit = Math.min(total, MAX_SELECTION_STATS_CELLS);
  let numeric = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < limit; i += 1) {
    const row = r0 + Math.floor(i / colCount);
    const col = c0 + (i % colCount);
    const raw = data[row]?.[col];
    const val = toEditValue(raw);
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    numeric += 1;
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  return {
    cells: total,
    numeric,
    sum,
    average: numeric ? sum / numeric : 0,
    min: numeric ? min : 0,
    max: numeric ? max : 0,
    truncated: total > MAX_SELECTION_STATS_CELLS,
  };
}

export function parseA1(a1: string): { col: number; row: number } | null {
  const m = String(a1 || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i += 1) {
    col = col * 26 + (m[1].charCodeAt(i) - 64);
  }
  col -= 1;
  const row = Number(m[2]) - 1;
  if (!Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0) {
    return null;
  }
  return { col, row };
}

function csvEscape(value: unknown): string {
  const text =
    value == null || value === ''
      ? ''
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function sheetDataToCsv(
  data: any[][],
  headers: readonly string[] = BUDGET_FLAT_HEADERS,
): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of data) {
    lines.push(
      headers.map((_, i) => csvEscape(row?.[i])).join(','),
    );
  }
  return lines.join('\n');
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatStatNumber(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
  });
}

export function buildRowDimension(viewRow: ViewRow) {
  const orgPart = `organization:${viewRow.productLabel}`;
  const subjectPart =
    viewRow.regionDepth > 0
      ? `subject:${viewRow.regionRootLabel}:${viewRow.regionLabel}`
      : `subject:${viewRow.regionLabel}`;
  return {
    key: `${orgPart}|${subjectPart}`,
    path: [orgPart, subjectPart],
  };
}

export function buildColDimension(col: number): {
  type: 'value' | 'attr' | 'date';
  key: string;
  path: string[];
  field: string;
} | null {
  if (col === COL_ATTR) {
    return {
      type: 'attr',
      key: 'functionalAttribute',
      path: ['functionalAttribute'],
      field: 'functionalAttribute',
    };
  }
  if (col === COL_ANNUAL) {
    return {
      type: 'value',
      key: 'year:2025年:全年合计',
      path: ['year', '2025年', '全年合计'],
      field: 'annualTotal',
    };
  }
  if (col >= COL_MONTH_START && col < COL_MONTH_START + BUDGET_MONTHS.length) {
    const monthIndex = col - COL_MONTH_START;
    const monthLabel = BUDGET_MONTHS[monthIndex];
    const field = BUDGET_VALUE_FIELDS[monthIndex + 1];
    return {
      type: 'value',
      key: `year:2025年:${monthLabel}`,
      path: ['year', '2025年', monthLabel],
      field,
    };
  }
  if (col === COL_DATE) {
    return {
      type: 'date',
      key: 'businessDate',
      path: ['businessDate'],
      field: 'businessDate',
    };
  }
  return null;
}

export function stableCellKey(viewRow: ViewRow, col: number): string | null {
  const row = buildRowDimension(viewRow);
  const colDim = buildColDimension(col);
  if (!colDim) return null;
  return `${row.key}|${colDim.key}`;
}

export function snapshotRowData(
  viewRow: ViewRow,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    organizationId: viewRow.productId,
    organization: viewRow.productLabel,
    subjectId: viewRow.regionBusinessId,
    subject: viewRow.regionLabel,
    subjectRoot: viewRow.regionRootLabel,
    functionalAttribute: viewRow.functionalAttribute,
    businessDate: (viewRow as any).businessDate ?? '',
  };
  BUDGET_VALUE_FIELDS.forEach((field) => {
    data[field] = viewRow[field];
  });
  return { ...data, ...overrides };
}

export function buildBudgetEditPayload(
  viewRow: ViewRow,
  col: number,
  oldValue: unknown,
  newValue: unknown,
): (BudgetEditPayload & { field: string; rowData: Record<string, unknown> }) | null {
  const colDim = buildColDimension(col);
  if (!colDim) return null;
  const row = buildRowDimension(viewRow);
  const next = toEditValue(newValue);
  return {
    action: 'change',
    type: colDim.type,
    row,
    col: { key: colDim.key, path: colDim.path },
    field: colDim.field,
    oldValue: toEditValue(oldValue),
    newValue: next,
    rowData: snapshotRowData(viewRow, { [colDim.field]: next }),
  };
}

export function dirtyCellKey(rowKey: string, colKey: string) {
  return `${rowKey}|${colKey}`;
}

export function isBudgetValueRowEditable(viewRow: ViewRow): boolean {
  if (viewRow.regionIsGroup) return false;
  if (viewRow.regionLabel === '管理费用合计') return false;
  return true;
}

export function fieldToColumnIndex(field: string): number | null {
  if (field === 'functionalAttribute') return COL_ATTR;
  if (field === 'businessDate') return COL_DATE;
  const valueIndex = (BUDGET_VALUE_FIELDS as readonly string[]).indexOf(field);
  if (valueIndex === 0) return COL_ANNUAL;
  if (valueIndex > 0) return COL_MONTH_START + valueIndex - 1;
  return null;
}

export function cellName(col: number, row: number) {
  let letters = '';
  let n = col;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${letters}${row + 1}`;
}

export function expandViewRowsForScale(
  base: ViewRow[],
  target: number,
): ViewRow[] {
  if (!target || base.length === 0) return base;
  if (base.length >= target) return base.slice(0, target);
  // 1 万以内可物化；更大档不要克隆 ViewRow（会直接撑爆内存）
  if (target > 12000) return base;
  const out: ViewRow[] = [];
  let copy = 0;
  while (out.length < target) {
    for (const row of base) {
      if (out.length >= target) break;
      if (copy === 0) {
        out.push(row);
      } else {
        // productId / regionRootId 必须保持与 BUSINESS_DATA 一致，否则折叠状态对不上树
        // 副本仅改展示名；折叠箭头只留在第一份树上，避免 N 份重复开关
        out.push({
          ...row,
          productLabel: `${row.productLabel}·${copy}`,
          productBlockStart: row.productBlockStart,
          productRowSpan: 1,
          productIsGroup: false,
          regionIsGroup: false,
          productExpanded: row.productExpanded,
          regionExpanded: row.regionExpanded,
        });
      }
    }
    copy += 1;
  }
  return out;
}

/** 去掉扩行后缀，折叠始终作用在真实组织/科目 id 上 */
export function canonicalProductId(productId: string) {
  return productId.replace(/__s\d+$/, '');
}

/** 大档按模板行解析业务行（不物化 10 万 ViewRow） */
export function resolveViewRow(sheet: BuiltSheet, row: number): ViewRow | null {
  const base = sheet.viewRows;
  if (!base.length || row < 0 || row >= sheet.data.length) return null;
  if (!sheet.large || base.length === sheet.data.length) {
    return base[row] ?? null;
  }
  const src = base[row % base.length];
  const copy = Math.floor(row / base.length);
  if (copy === 0) return src;
  return {
    ...src,
    productId: `${src.productId}__s${copy}`,
    productLabel: `${src.productLabel}·${copy}`,
    productBlockStart: false,
    productRowSpan: 1,
  };
}

function rowToDataCells(row: ViewRow, copyIndex: number): any[] {
  const businessDate = seedBusinessDate(row);
  const orgLabel =
    copyIndex === 0
      ? row.productBlockStart
        ? row.productLabel
        : ''
      : row.productBlockStart
        ? `${row.productLabel}·${copyIndex}`
        : '';
  return [
    orgLabel,
    row.regionLabel,
    row.functionalAttribute,
    ...BUDGET_VALUE_FIELDS.map((field) => row[field]),
    businessDate,
  ];
}

/** 分块生成大表 data，避免一次分配 + 同步计算卡死主线程 */
export async function buildLargeDataAsync(
  base: ViewRow[],
  target: number,
  onProgress?: (done: number, total: number) => void,
): Promise<any[][]> {
  const templates = base.map((row) => row);
  const data: any[][] = new Array(target);
  const chunk = 1500;
  let copy = 0;
  let baseIdx = 0;
  for (let i = 0; i < target; i += 1) {
    const row = templates[baseIdx];
    data[i] = rowToDataCells(row, copy);
    baseIdx += 1;
    if (baseIdx >= templates.length) {
      baseIdx = 0;
      copy += 1;
    }
    if (i > 0 && i % chunk === 0) {
      onProgress?.(i, target);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
    }
  }
  onProgress?.(target, target);
  return data;
}

function seedBusinessDate(viewRow: ViewRow): string {
  const seed =
    (viewRow.productId?.length || 0) * 17 +
    (viewRow.regionBusinessId?.length || 0) * 13;
  const month = (seed % 12) + 1;
  const day = (seed % 27) + 1;
  return `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildBudgetColumns(large: boolean): Array<Record<string, unknown>> {
  const monthCols = BUDGET_MONTHS.map((title, index) => {
    const col: Record<string, unknown> = {
      type: 'numeric' as const,
      title,
      width: 88,
      mask: '#,##0.00',
      align: 'right' as const,
    };
    if (!large && index === 0) {
      col.group = BUDGET_MONTHS.length - 1;
      col.state = true;
    }
    return col;
  });

  return [
    {
      type: 'text',
      title: '',
      width: 216,
      readOnly: true,
      align: 'left' as const,
    },
    {
      type: 'text',
      title: '',
      width: 194,
      readOnly: true,
      align: 'left' as const,
    },
    {
      type: 'dropdown',
      title: '',
      width: 154,
      align: 'center' as const,
      source: ATTR_OPTIONS,
      autocomplete: true,
      strictMode: false,
    },
    {
      type: 'numeric',
      title: '全年合计',
      width: 110,
      mask: '#,##0.00',
      align: 'right' as const,
    },
    ...monthCols,
    {
      type: 'calendar',
      title: '业务日期',
      width: 120,
      format: 'YYYY-MM-DD',
    },
  ];
}

function buildBudgetNestedHeaders() {
  return [
    [
      { title: '组织', colspan: 1, align: 'center' as const },
      { title: '科目', colspan: 1, align: 'center' as const },
      { title: '功能属性', colspan: 1, align: 'center' as const },
      {
        title: '2025年',
        colspan: 1 + BUDGET_MONTHS.length,
        align: 'center' as const,
      },
      { title: '业务日期', colspan: 1, align: 'center' as const },
    ],
  ];
}

/** 大档：模板 viewRows + 全量 data；折叠箭头仅绘前若干行，避免 10 万次 DOM 写入 */
export function buildLargeSheetFromData(
  baseViewRows: ViewRow[],
  data: any[][],
): BuiltSheet {
  const foldMetas: FoldMeta[] = [];
  const paintLimit = Math.min(data.length, Math.max(baseViewRows.length * 3, 400));
  for (let r = 0; r < paintLimit; r += 1) {
    const src = baseViewRows[r % baseViewRows.length];
    const copy = Math.floor(r / baseViewRows.length);
    const productId =
      copy === 0 ? src.productId : `${src.productId}__s${copy}`;
    const productLabel =
      copy === 0 ? src.productLabel : `${src.productLabel}·${copy}`;

    if (src.productBlockStart) {
      foldMetas.push({
        row: r,
        col: 0,
        label: productLabel,
        indent: src.productDepth,
        canFold: src.productIsGroup,
        expanded: src.productExpanded,
        productId,
      });
    }
    foldMetas.push({
      row: r,
      col: 1,
      label: src.regionLabel,
      indent: src.regionDepth,
      canFold: src.regionIsGroup,
      expanded: src.regionExpanded,
      productId,
      regionRootId: src.regionRootId,
    });
  }

  return {
    viewRows: baseViewRows,
    large: true,
    data,
    columns: buildBudgetColumns(true),
    nestedHeaders: buildBudgetNestedHeaders(),
    mergeCells: {},
    style: {},
    foldMetas,
    comments: {},
  };
}

export function buildSheetFromProjection(
  viewRows: ViewRow[],
  opts?: { large?: boolean },
): BuiltSheet {
  const large = !!opts?.large;
  const data: any[][] = [];
  const mergeCells: Record<string, [number, number]> = {};
  const style: Record<string, string> = {};
  const foldMetas: FoldMeta[] = [];
  const comments: Record<string, any> = {};

  viewRows.forEach((row, r) => {
    const businessDate = seedBusinessDate(row);
    (row as any).businessDate = businessDate;
    data.push([
      row.productBlockStart ? row.productLabel : '',
      row.regionLabel,
      row.functionalAttribute,
      ...BUDGET_VALUE_FIELDS.map((field) => row[field]),
      businessDate,
    ]);

    if (!large) {
      style[cellName(0, r)] = ORG_BG;
      style[cellName(1, r)] = SUBJECT_BG;
      style[cellName(2, r)] = DIM_BG;
      style[cellName(3, r)] = ANNUAL_BG;
    }

    if (row.productBlockStart) {
      if (!large && row.productRowSpan > 1) {
        mergeCells[cellName(0, r)] = [1, row.productRowSpan];
      }
      foldMetas.push({
        row: r,
        col: 0,
        label: row.productLabel,
        indent: row.productDepth,
        canFold: row.productIsGroup,
        expanded: row.productExpanded,
        productId: row.productId,
      });
    }

    foldMetas.push({
      row: r,
      col: 1,
      label: row.regionLabel,
      indent: row.regionDepth,
      canFold: row.regionIsGroup,
      expanded: row.regionExpanded,
      productId: row.productId,
      regionRootId: row.regionRootId,
    });

    if (r === 0) {
      comments[cellName(COL_ANNUAL, r)] = {
        comments: '示例批注：全年合计可编辑（叶子科目行）。',
      };
    }
  });

  return {
    viewRows,
    large,
    data,
    columns: buildBudgetColumns(large),
    nestedHeaders: buildBudgetNestedHeaders(),
    mergeCells,
    style,
    foldMetas,
    comments,
  };
}

export function getCellEl(ws: any, col: number, row: number): HTMLElement | null {
  try {
    const name = cellName(col, row);
    const el = ws.getCell?.(name) || ws.getCellFromCoords?.(col, row);
    if (el) return el as HTMLElement;
  } catch {
    // ignore
  }
  const root = ws.table || ws.element || ws.content || ws.el;
  return (
    (root?.querySelector?.(
      `td[data-x="${col}"][data-y="${row}"]`,
    ) as HTMLElement | null) || null
  );
}

export function mergeDimHeaders(ws: any) {
  if (!ws || typeof document === 'undefined') return;
  try {
    const roots: HTMLElement[] = [];
    const pushRoot = (el: HTMLElement | null | undefined) => {
      if (el && !roots.includes(el)) roots.push(el);
    };
    pushRoot(ws.thead);
    pushRoot(ws.table?.tHead);
    pushRoot(ws.element?.querySelector?.('thead'));
    pushRoot(ws.el?.querySelector?.('thead'));
    const host = ws.element || ws.el || ws.content || ws.parent?.el;
    host
      ?.querySelectorAll?.('thead')
      ?.forEach?.((node: Element) => pushRoot(node as HTMLElement));

    const titles = ['组织', '科目', '功能属性'];

    roots.forEach((thead) => {
      const table = thead.closest('table');
      table?.classList.add('jss-outline-table');

      const nestedRow = thead.querySelector(
        'tr.jss_nested',
      ) as HTMLTableRowElement | null;
      const headerRow = Array.from(thead.querySelectorAll('tr')).find((tr) => {
        const el = tr as HTMLElement;
        return (
          !el.classList.contains('jss_nested') &&
          !el.classList.contains('jss_filters') &&
          !el.classList.contains('jss_filter')
        );
      }) as HTMLTableRowElement | undefined;
      if (!nestedRow || !headerRow) return;

      const cells = Array.from(
        nestedRow.querySelectorAll(
          'th[role="nested-header"], th[data-x], td[data-x]',
        ),
      ) as HTMLTableCellElement[];
      const byX = (x: number) =>
        cells.find((cell) => cell.getAttribute('data-x') === String(x));

      for (let i = 0; i < 3; i += 1) {
        const cell = byX(i);
        if (!cell) continue;
        cell.textContent = titles[i];
        cell.colSpan = 1;
        cell.rowSpan = 2;
        cell.setAttribute('colspan', '1');
        cell.setAttribute('rowspan', '2');
        cell.style.verticalAlign = 'middle';
        cell.classList.add('jss-outline-dim-header');
      }

      const yearCell = byX(3);
      if (yearCell) {
        yearCell.textContent = '2025年';
        yearCell.colSpan = 1 + BUDGET_MONTHS.length;
        yearCell.rowSpan = 1;
        yearCell.setAttribute('colspan', String(1 + BUDGET_MONTHS.length));
        yearCell.setAttribute('rowspan', '1');
      }

      const dateCell = byX(COL_DATE);
      if (dateCell) {
        dateCell.textContent = '业务日期';
        dateCell.colSpan = 1;
        dateCell.rowSpan = 2;
        dateCell.setAttribute('colspan', '1');
        dateCell.setAttribute('rowspan', '2');
        dateCell.style.verticalAlign = 'middle';
        dateCell.classList.add('jss-outline-dim-header');
      }

      const dimOk = [0, 1, 2].every((x) => (byX(x)?.rowSpan ?? 0) >= 2);
      if (dimOk) {
        for (let x = 0; x < 3; x += 1) {
          headerRow
            .querySelector(`td[data-x="${x}"], th[data-x="${x}"]`)
            ?.remove();
        }
      } else {
        for (let x = 0; x < 3; x += 1) {
          const leaf = headerRow.querySelector(
            `td[data-x="${x}"], th[data-x="${x}"]`,
          ) as HTMLElement | null;
          if (!leaf) continue;
          leaf.textContent = '';
          leaf.setAttribute('data-title', '');
        }
      }

      if ((dateCell?.rowSpan ?? 0) >= 2) {
        headerRow
          .querySelector(`td[data-x="${COL_DATE}"], th[data-x="${COL_DATE}"]`)
          ?.remove();
      }

      nestedRow.setAttribute('data-dim-merged', '1');
    });
  } catch {
    // ignore
  }
}

export function bindHeaderStability(
  ws: any,
  onStable?: () => void,
): () => void {
  const host = (ws.element ||
    ws.el ||
    ws.content ||
    ws.parent?.el) as HTMLElement | null | undefined;

  const timers: number[] = [];
  let applying = false;
  let scrollRaf = 0;
  let observer: MutationObserver | null = null;
  let scrollTarget: HTMLElement | null = null;

  const run = () => {
    if (applying) return;
    applying = true;
    try {
      mergeDimHeaders(ws);
      onStable?.();
    } finally {
      applying = false;
    }
  };

  const needsMerge = () => {
    if (!host) return true;
    const sample = host.querySelector(
      'thead tr.jss_nested th[data-x="0"], thead tr.jss_nested th[role="nested-header"]',
    ) as HTMLTableCellElement | null;
    const leaf0 = host.querySelector(
      'thead tr:not(.jss_nested) th[data-x="0"], thead tr:not(.jss_nested) td[data-x="0"]',
    );
    return !(sample && sample.rowSpan >= 2 && !leaf0);
  };

  host
    ?.querySelectorAll?.('thead tr.jss_nested')
    ?.forEach?.((row: Element) => row.removeAttribute('data-dim-merged'));

  run();
  [0, 50, 100, 200, 400, 800].forEach((ms) => {
    timers.push(window.setTimeout(run, ms));
  });

  if (host && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (applying || !needsMerge()) return;
      run();
    });
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['rowspan', 'colspan', 'data-x'],
    });
  }

  const scrollCandidate =
    host?.querySelector?.('.jss_content') || ws.content || host;
  scrollTarget =
    scrollCandidate instanceof HTMLElement ? scrollCandidate : null;
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = window.requestAnimationFrame(() => {
      scrollRaf = 0;
      if (needsMerge()) run();
      else onStable?.();
    });
  };
  scrollTarget?.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
    if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
    observer?.disconnect();
    scrollTarget?.removeEventListener('scroll', onScroll);
  };
}

export function getWorksheetList(ref: { current: any }) {
  const current = ref.current;
  if (!current) return [];
  return Array.isArray(current) ? current : [current];
}

export function paintFoldToggle(ws: any, meta: FoldMeta) {
  const cell = getCellEl(ws, meta.col, meta.row);
  if (!cell) return;
  const icon = meta.canFold ? (meta.expanded ? '▼' : '▶') : '';
  const step = meta.col === 1 ? 14 : 16;
  const pad = 8 + meta.indent * step;
  cell.classList.add('readonly', 'jss-outline-group-cell');
  if (meta.col === 0) {
    cell.classList.add('jss-outline-category-col', 'jss-outline-org-tree');
  } else {
    cell.classList.add('jss-outline-subject-tree');
    if (meta.canFold) cell.classList.add('jss-outline-subject-parent');
    else cell.classList.add('jss-outline-subject-leaf');
  }
  cell.style.textAlign = 'left';
  cell.style.verticalAlign = 'middle';
  cell.style.paddingLeft = `${pad}px`;

  if (meta.canFold) {
    cell.innerHTML = `<span class="jss-outline-org-wrap jss-outline-org-wrap--tree"><span class="jss-outline-toggle" data-row="${meta.row}" data-col="${meta.col}" contenteditable="false">${icon}</span><span class="jss-outline-label">${meta.label}</span></span>`;
  } else {
    cell.innerHTML = `<span class="jss-outline-org-wrap jss-outline-org-wrap--tree"><span class="jss-outline-label">${meta.label}</span></span>`;
  }
}

/** 大档只画视口内单元格，避免对 1 万+ meta 做 querySelector */
export function paintVisibleFoldToggles(ws: any, sheet: BuiltSheet) {
  if (!sheet.foldMetas.length) return;

  if (!sheet.large) {
    sheet.foldMetas.forEach((meta) => paintFoldToggle(ws, meta));
    return;
  }

  const index = new Map<string, FoldMeta>();
  for (const meta of sheet.foldMetas) {
    index.set(`${meta.col}:${meta.row}`, meta);
  }

  const root = ws.table || ws.element || ws.content || ws.el;
  const cells = root?.querySelectorAll?.(
    'tbody td[data-x="0"][data-y], tbody td[data-x="1"][data-y]',
  );
  if (!cells?.length) {
    sheet.foldMetas.forEach((meta) => {
      if (meta.canFold) paintFoldToggle(ws, meta);
    });
    return;
  }

  cells.forEach((el: Element) => {
    const td = el as HTMLElement;
    const col = Number(td.dataset.x);
    const row = Number(td.dataset.y);
    if (!Number.isFinite(col) || !Number.isFinite(row)) return;
    const meta = index.get(`${col}:${row}`);
    if (meta) paintFoldToggle(ws, meta);
  });
}

function getWorksheetScrollHost(ws: any): HTMLElement | null {
  const host =
    (ws?.content as HTMLElement | undefined) ||
    (ws?.element?.querySelector?.('.jss_content') as HTMLElement | null) ||
    (ws?.el?.querySelector?.('.jss_content') as HTMLElement | null) ||
    null;
  return host instanceof HTMLElement ? host : null;
}

export function applySheetToWorksheet(ws: any, sheet: BuiltSheet) {
  const scrollHost = getWorksheetScrollHost(ws);
  const scrollTop = scrollHost?.scrollTop ?? 0;
  const scrollLeft = scrollHost?.scrollLeft ?? 0;

  try {
    ws.setData?.(sheet.data);
  } catch {
    // ignore
  }

  // 大档折叠更新：只换数据 + 可见折叠箭头，避免 merge/style/表头全量重刷导致抖动
  if (sheet.large) {
    paintVisibleFoldToggles(ws, sheet);
    if (scrollHost) {
      scrollHost.scrollTop = scrollTop;
      scrollHost.scrollLeft = scrollLeft;
    }
    return;
  }

  try {
    if (typeof ws.destroyMerge === 'function') {
      ws.destroyMerge();
    } else if (typeof ws.removeMerge === 'function') {
      Object.keys(sheet.mergeCells).forEach((name) => {
        try {
          ws.removeMerge(name);
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    Object.entries(sheet.mergeCells).forEach(([name, span]) => {
      try {
        ws.setMerge?.(name, span[0], span[1]);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  try {
    if (sheet.style && typeof ws.setStyle === 'function') {
      Object.entries(sheet.style).forEach(([name, css]) => {
        try {
          ws.setStyle(name, css);
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    ws.setNestedHeaders?.(sheet.nestedHeaders);
  } catch {
    // ignore
  }

  try {
    if (sheet.comments && typeof ws.setComments === 'function') {
      ws.setComments(sheet.comments);
    }
  } catch {
    // ignore
  }

  paintVisibleFoldToggles(ws, sheet);

  if (scrollHost) {
    scrollHost.scrollTop = scrollTop;
    scrollHost.scrollLeft = scrollLeft;
  }

  const colCount = sheet.columns.length;
  sheet.viewRows.forEach((viewRow, row) => {
    try {
      ws.setReadOnly?.(cellName(COL_SUBJECT, row), true);
      ws.setReadOnly?.(cellName(COL_ORG, row), true);
    } catch {
      // ignore
    }
    if (isBudgetValueRowEditable(viewRow)) return;
    for (let col = COL_ATTR; col < colCount; col += 1) {
      try {
        ws.setReadOnly?.(cellName(col, row), true);
      } catch {
        // ignore
      }
    }
  });
}
