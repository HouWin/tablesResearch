/**
 * Jspreadsheet Data Grid · 预算费用表
 * 官方 Spreadsheet / Worksheet + nestedHeaders / mergeCells / rows
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import { PageContainer } from '@ant-design/pro-components';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet/dist/jspreadsheet.css';
import '@jsuites/css/dist/style.css';
import { zhCN } from '../dictionary';
import '../index.less';

jspreadsheet.setLicense('evaluation');
jspreadsheet.setDictionary(zhCN);

const BUDGET_MONTHS = [
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

const BUDGET_SUBJECTS = [
  { name: '费用汇总', attr: '-', kind: 'summary' as const },
  { name: '日常费用合计', attr: '-', kind: 'subtotal' as const },
  { name: '费用-办公费', attr: '管理', kind: 'detail' as const, share: 1 },
  { name: '费用-电费', attr: '管理', kind: 'detail' as const, share: 2 },
  { name: '费用-水费', attr: '管理', kind: 'detail' as const, share: 3 },
] as const;

type OrgNode = {
  name: string;
  monthly: number;
  decimals?: boolean;
  adjustJan?: boolean;
  attr?: string;
  subtotalName?: string;
  children?: OrgNode[];
};

/** 金额对齐参考截图：各级科目块独立，不向上汇总 */
const ORG_TREE: OrgNode[] = [
  {
    name: '华润微电子集团',
    monthly: 3600,
    decimals: true,
    adjustJan: true,
    children: [
      {
        name: '华润微电子本部',
        monthly: 3600,
        decimals: false,
        adjustJan: true,
        subtotalName: '管理费用合计',
      },
      {
        name: '华晶公司',
        monthly: 2400,
        decimals: false,
        children: [
          { name: '华晶公司-销售部', monthly: 600, attr: '销售' },
          { name: '华晶公司-财务部', monthly: 600 },
          { name: '华晶公司-行政部', monthly: 600 },
          { name: '华晶公司-研发部', monthly: 600, attr: '研发' },
        ],
      },
      {
        name: '上华公司',
        monthly: 600,
        decimals: false,
        children: [{ name: '上华公司-销售部', monthly: 600, attr: '销售' }],
      },
    ],
  },
];

const DIM_BG = 'background-color:#dceaf5;text-align:center;vertical-align:middle';
const ORG_BG = `${DIM_BG};font-weight:600`;
const ANNUAL_BG = 'background-color:#fff2cc;text-align:right';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number, decimals: boolean) {
  return decimals ? round2(n) : Math.round(n);
}

function cellName(col: number, row: number) {
  let letters = '';
  let n = col;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${letters}${row + 1}`;
}

function splitDetails(monthly: number, decimals: boolean) {
  const shares = [1, 2, 3];
  const parts = shares.map((s) => fmt((monthly * s) / 6, decimals));
  const drift = fmt(monthly - parts.reduce((a, b) => a + Number(b), 0), decimals);
  parts[2] = fmt(Number(parts[2]) + Number(drift), decimals);
  return parts.map(Number);
}

function monthSeries(base: number, decimals: boolean, adjustJan: boolean) {
  const rest = fmt(base, decimals);
  const months = Array.from({ length: 12 }, () => Number(rest));
  if (adjustJan && Number(rest) >= 1) {
    months[0] = Number(fmt(Number(rest) - 1, decimals));
  }
  return months;
}

function sumMonths(list: number[][], decimals: boolean) {
  return Array.from({ length: 12 }, (_, i) =>
    fmt(list.reduce((s, m) => s + Number(m[i] || 0), 0), decimals),
  );
}

function sumAnnual(months: Array<number | string>, decimals: boolean) {
  let total = 0;
  for (const v of months) total += Number(v) || 0;
  return fmt(total, decimals);
}

type FoldMeta = {
  row: number;
  col: number;
  label: string;
  /** group 跨度（不含自身） */
  span: number;
  /** 缩进层级 */
  indent: number;
  /** 是否显示箭头（叶子科目无箭头） */
  canFold: boolean;
};

type BuiltSheet = {
  data: any[][];
  columns: Array<Record<string, unknown>>;
  nestedHeaders: Array<Array<{ title: string; colspan: number; align: 'center' }>>;
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  rows: Record<number, { group: number; state: boolean }>;
  foldMetas: FoldMeta[];
};

function buildExpenseSheet(tree: OrgNode[]): BuiltSheet {
  const data: any[][] = [];
  const mergeCells: Record<string, [number, number]> = {};
  const style: Record<string, string> = {};
  const rows: Record<number, { group: number; state: boolean }> = {};
  const foldMetas: FoldMeta[] = [];

  const append = (org: OrgNode, startRow: number, depth = 0): number => {
    const decimals = !!org.decimals;
    const adjustJan = !!org.adjustJan;
    const bases = splitDetails(org.monthly, decimals);
    const detailSeries = bases.map((b, i) => monthSeries(b, decimals, adjustJan && i === 0));
    const rollup = sumMonths(detailSeries, decimals);
    let r = startRow;
    let detailIdx = 0;
    const subjectStart = startRow;

    for (const subject of BUDGET_SUBJECTS) {
      let subjectName = String(subject.name);
      let attr = String(subject.attr);
      let months: Array<number | string> = rollup;
      let subjectIndent = 0;
      let subjectCanFold = false;
      let subjectSpan = 0;

      if (subject.kind === 'summary') {
        subjectName = '费用汇总';
        attr = '-';
        subjectIndent = 0;
        subjectCanFold = true;
        // 汇总下挂：合计 + 3 明细
        subjectSpan = BUDGET_SUBJECTS.length - 1;
      } else if (subject.kind === 'subtotal') {
        subjectName = String(org.subtotalName || subject.name);
        attr = '-';
        subjectIndent = 1;
        subjectCanFold = true;
        // 合计下挂：3 明细
        subjectSpan = 3;
      } else {
        attr = String(org.attr || subject.attr || '管理');
        months = detailSeries[detailIdx++] || rollup;
        subjectIndent = 2;
        subjectCanFold = false;
      }

      const showOrg = r === startRow ? org.name : '';
      const annual = sumAnnual(months, decimals);
      data.push([showOrg, subjectName, attr, annual, ...months]);

      style[cellName(0, r)] = ORG_BG;
      // 科目列左对齐（树形）
      style[cellName(1, r)] =
        'background-color:#dceaf5;text-align:left;vertical-align:middle';
      style[cellName(2, r)] = DIM_BG;
      style[cellName(3, r)] = ANNUAL_BG;

      foldMetas.push({
        row: r,
        col: 1,
        label: subjectName,
        span: subjectSpan,
        indent: subjectIndent,
        canFold: subjectCanFold,
      });

      r += 1;
    }

    const subjectRows = BUDGET_SUBJECTS.length;
    let childRows = 0;
    if (org.children?.length) {
      let cursor = r;
      for (const child of org.children) {
        const span = append(child, cursor, depth + 1);
        cursor += span;
        childRows += span;
      }
    }

    const totalSpan = subjectRows + childRows;
    mergeCells[cellName(0, subjectStart)] = [1, subjectRows];

    // 仅有下级组织时显示组织箭头；叶子组织无箭头（科目列仍可独立折叠）
    const orgCanFold = childRows > 0;
    if (orgCanFold) {
      rows[subjectStart] = { group: totalSpan - 1, state: true };
    }
    foldMetas.push({
      row: subjectStart,
      col: 0,
      label: org.name,
      span: orgCanFold ? totalSpan - 1 : 0,
      indent: depth,
      canFold: orgCanFold,
    });

    return totalSpan;
  };

  for (const root of tree) {
    append(root, data.length, 0);
  }

  const columns = [
    {
      type: 'text',
      title: '\u00a0',
      width: 200,
      readOnly: true,
      align: 'left' as const,
    },
    {
      type: 'text',
      title: '\u00a0',
      width: 160,
      align: 'left' as const,
    },
    {
      type: 'text',
      title: '\u00a0',
      width: 90,
      align: 'center' as const,
    },
    {
      type: 'numeric',
      title: '全年合计',
      width: 110,
      mask: '#,##0.00',
      align: 'right' as const,
      readOnly: true,
    },
    ...BUDGET_MONTHS.map((title) => ({
      type: 'numeric' as const,
      title,
      width: 88,
      mask: '#,##0.00',
      align: 'right' as const,
    })),
  ];

  const nestedHeaders = [
    [
      { title: '组织', colspan: 1, align: 'center' as const },
      { title: '科目', colspan: 1, align: 'center' as const },
      { title: '功能属性', colspan: 1, align: 'center' as const },
      {
        title: '2025年',
        colspan: 1 + BUDGET_MONTHS.length,
        align: 'center' as const,
      },
    ],
  ];

  return { data, columns, nestedHeaders, mergeCells, style, rows, foldMetas };
}

function mergeDimHeaders(ws: any) {
  if (!ws || typeof document === 'undefined') return;
  try {
    const thead: HTMLTableSectionElement | null =
      ws.thead ||
      ws.table?.tHead ||
      ws.element?.querySelector?.('thead') ||
      ws.el?.querySelector?.('thead') ||
      null;
    if (!thead) return;

    const nestedRow = thead.querySelector('tr.jss_nested') as HTMLTableRowElement | null;
    const headerRow = Array.from(thead.querySelectorAll('tr')).find((tr) => {
      const el = tr as HTMLElement;
      return !el.classList.contains('jss_nested') && !el.classList.contains('jss_filters');
    }) as HTMLTableRowElement | undefined;
    if (!nestedRow || !headerRow) return;
    if (nestedRow.getAttribute('data-dim-merged') === '1') return;

    // 第二行列头已有「组织/科目/功能属性」时，把文案提到 nested 并 rowspan
    const titles = ['组织', '科目', '功能属性'];
    const cells = nestedRow.querySelectorAll('th[role="nested-header"]');
    for (let i = 0; i < 3; i += 1) {
      const cell = cells[i] as HTMLTableCellElement | undefined;
      if (!cell) continue;
      const headerCell = headerRow.querySelector(
        `td[data-x="${i}"], th[data-x="${i}"]`,
      ) as HTMLElement | null;
      const title =
        (headerCell?.textContent || '').trim() ||
        (cell.textContent || '').trim() ||
        titles[i];
      cell.textContent = title;
      cell.rowSpan = 2;
      cell.style.verticalAlign = 'middle';
      cell.classList.add('jss-outline-dim-header');
    }

    for (let x = 0; x < 3; x += 1) {
      headerRow.querySelector(`td[data-x="${x}"], th[data-x="${x}"]`)?.remove();
    }
    nestedRow.setAttribute('data-dim-merged', '1');
  } catch {
    // ignore
  }
}

function getWorksheetList(ref: React.MutableRefObject<any>) {
  const current = ref.current;
  if (!current) return [];
  return Array.isArray(current) ? current : [current];
}

function getCellEl(ws: any, col: number, row: number): HTMLElement | null {
  try {
    const name = cellName(col, row);
    const el = ws.getCell?.(name) || ws.getCellFromCoords?.(col, row);
    if (el) return el as HTMLElement;
  } catch {
    // ignore
  }
  const root = ws.table || ws.element || ws.content || ws.el;
  return (
    (root?.querySelector?.(`td[data-x="${col}"][data-y="${row}"]`) as HTMLElement | null) ||
    null
  );
}

function foldKey(meta: Pick<FoldMeta, 'col' | 'row'>) {
  return `${meta.col}:${meta.row}`;
}

/** 任一折叠节点收起时，藏起其 span 内的子行 */
function collectHiddenRows(sheet: BuiltSheet, openMap: Map<string, boolean>) {
  const hidden = new Set<number>();
  sheet.foldMetas.forEach((meta) => {
    if (!meta.canFold || meta.span <= 0) return;
    if (openMap.get(foldKey(meta)) === false) {
      for (let i = meta.row + 1; i <= meta.row + meta.span; i += 1) {
        hidden.add(i);
      }
    }
  });
  return hidden;
}

/** 科目是否被某个已收起的组织盖住（仅影响箭头显示，不改科目 openMap） */
function isCoveredByClosedOrg(
  meta: FoldMeta,
  sheet: BuiltSheet,
  openMap: Map<string, boolean>,
) {
  if (meta.col !== 1) return false;
  return sheet.foldMetas.some(
    (m) =>
      m.col === 0 &&
      m.canFold &&
      openMap.get(foldKey(m)) === false &&
      meta.row >= m.row &&
      meta.row <= m.row + m.span,
  );
}

function paintFoldToggle(
  ws: any,
  meta: FoldMeta,
  sheet: BuiltSheet,
  openMap: Map<string, boolean>,
) {
  const cell = getCellEl(ws, meta.col, meta.row);
  if (!cell) return;
  let open = meta.canFold ? openMap.get(foldKey(meta)) !== false : false;
  // 组织收起时，范围内科目箭头显示 ▶，但不改科目真实状态（否则组织再展开会无效）
  if (open && isCoveredByClosedOrg(meta, sheet, openMap)) open = false;
  const icon = meta.canFold ? (open ? '▼' : '▶') : '';
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

function recomputeFoldVisibility(
  ws: any,
  sheet: BuiltSheet,
  openMap: Map<string, boolean>,
) {
  const total = sheet.data.length;
  const hidden = collectHiddenRows(sheet, openMap);

  if (!ws.rows) ws.rows = {};
  // 引擎行组始终保持 open，语义收起只靠 hideRow（state=false / closeRowGroup 会导致 showRow 失效）
  sheet.foldMetas
    .filter((m) => m.col === 0 && m.canFold)
    .forEach((meta) => {
      ws.rows[meta.row] = { group: meta.span, state: true };
      try {
        ws.openRowGroup?.(meta.row);
      } catch {
        // ignore
      }
    });

  for (let i = 0; i < total; i += 1) {
    try {
      if (hidden.has(i)) ws.hideRow?.(i);
      else ws.showRow?.(i);
    } catch {
      // ignore
    }
  }

  return hidden;
}

function bindBudgetFolds(ws: any, sheet: BuiltSheet) {
  const table =
    ws.table ||
    ws.element?.querySelector?.('table') ||
    ws.content?.querySelector?.('table');
  if (!table) return () => {};

  table.classList.add('jss-outline-table');

  const openMap = new Map<string, boolean>();
  sheet.foldMetas.forEach((meta) => {
    if (meta.canFold) openMap.set(foldKey(meta), true);
  });

  const paintAll = () => {
    sheet.foldMetas.forEach((meta) => paintFoldToggle(ws, meta, sheet, openMap));
  };

  recomputeFoldVisibility(ws, sheet, openMap);
  paintAll();

  const onClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    const toggle = target?.closest?.('.jss-outline-toggle') as HTMLElement | null;
    if (!toggle || !table.contains(toggle)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const row = Number(toggle.dataset.row);
    const col = Number(toggle.dataset.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    const meta = sheet.foldMetas.find(
      (m) => m.row === row && m.col === col && m.canFold,
    );
    if (!meta) return;

    // 组织盖住时科目箭头是 ▶，但真实可能仍是展开：点击科目只切换科目自身
    const key = foldKey(meta);
    openMap.set(key, openMap.get(key) === false);

    recomputeFoldVisibility(ws, sheet, openMap);
    paintAll();
  };

  table.addEventListener('click', onClick);
  return () => table.removeEventListener('click', onClick);
}

export default function JspreadsheetBudgetPage() {
  const spreadsheet = useRef<any>(null);
  const sheet = useMemo(() => buildExpenseSheet(ORG_TREE), []);
  const [mountId, setMountId] = React.useState(0);

  useEffect(() => {
    return () => {
      spreadsheet.current = null;
    };
  }, [mountId]);

  useEffect(() => {
    let unbind: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const list = getWorksheetList(spreadsheet);
      const ws = list[0];
      if (!ws) {
        setMountId((n) => (n === 0 ? 1 : n));
        return;
      }

      try {
        if (typeof ws.setData === 'function' && sheet.data.length) {
          ws.setData(sheet.data);
        }
      } catch {
        // ignore
      }

      try {
        if (sheet.mergeCells && typeof ws.setMerge === 'function') {
          Object.entries(sheet.mergeCells).forEach(([name, span]) => {
            try {
              ws.setMerge(name, span[0], span[1]);
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

      const thead =
        ws.thead ||
        ws.table?.tHead ||
        ws.element?.querySelector?.('thead');
      thead?.querySelector?.('tr.jss_nested')?.removeAttribute?.('data-dim-merged');
      mergeDimHeaders(ws);
      window.setTimeout(() => mergeDimHeaders(ws), 60);

      unbind = bindBudgetFolds(ws, sheet);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      unbind?.();
    };
  }, [sheet, mountId]);

  return (
    <PageContainer
      title="Jspreadsheet Data Grid · 预算费用表"
      subTitle={`▶/▼ 展开收起 · ${sheet.data.length} 行`}
    >
      <div className="jss-page">
        <div className="jss-page__body jss-page__body--side-collapsed">
          <div className="jss-page__sheet">
            <Spreadsheet
              key={`jss-budget-datagrid-${mountId}`}
              ref={spreadsheet}
              tabs={true}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="640px"
            >
              <Worksheet
                worksheetName="预算费用表"
                data={sheet.data}
                columns={sheet.columns}
                nestedHeaders={sheet.nestedHeaders}
                mergeCells={sheet.mergeCells}
                style={sheet.style}
                rows={sheet.rows}
                minDimensions={[sheet.columns.length, sheet.data.length]}
                columnResize={true}
                tableOverflow={true}
                tableWidth="100%"
                tableHeight="640px"
                freezeColumns={3}
              />
            </Spreadsheet>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
