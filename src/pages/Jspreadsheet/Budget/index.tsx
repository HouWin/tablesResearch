/**
 * Jspreadsheet Data Grid · 预算费用表
 * 渲染对齐 SpreadJS Demo：createBusinessProjectionRows 投影可见行，
 * 组织 / 科目各自维护展开状态，收起后重建数据（非 hideRow）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import { PageContainer } from '@ant-design/pro-components';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet/dist/jspreadsheet.css';
import '@jsuites/css/dist/style.css';
import { zhCN } from '../dictionary';
import '../index.less';
import {
  BUDGET_VALUE_FIELDS,
  createBusinessProjectionRows,
  createInitialRegionExpansion,
  INITIAL_PRODUCT_EXPANDED,
  type ExtensionExpansionState,
  type ViewRow,
} from '../../SpreadJSDemo/spreadsheet/model';

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

const DIM_BG = 'background-color:#93c5f3;text-align:center;vertical-align:middle';
const ORG_BG = `${DIM_BG};font-weight:600;text-align:left`;
const SUBJECT_BG =
  'background-color:#93c5f3;text-align:left;vertical-align:middle';
const ANNUAL_BG = 'background-color:#fff2cc;text-align:right';

function cellName(col: number, row: number) {
  let letters = '';
  let n = col;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${letters}${row + 1}`;
}

type FoldMeta = {
  row: number;
  col: 0 | 1;
  label: string;
  indent: number;
  canFold: boolean;
  expanded: boolean;
  productId: string;
  regionRootId?: string;
};

type BuiltSheet = {
  viewRows: ViewRow[];
  data: any[][];
  columns: Array<Record<string, unknown>>;
  nestedHeaders: Array<
    Array<{ title: string; colspan: number; align: 'center' }>
  >;
  mergeCells: Record<string, [number, number]>;
  style: Record<string, string>;
  foldMetas: FoldMeta[];
};

function buildSheetFromProjection(viewRows: ViewRow[]): BuiltSheet {
  const data: any[][] = [];
  const mergeCells: Record<string, [number, number]> = {};
  const style: Record<string, string> = {};
  const foldMetas: FoldMeta[] = [];

  viewRows.forEach((row, r) => {
    data.push([
      row.productBlockStart ? row.productLabel : '',
      row.regionLabel,
      row.functionalAttribute,
      ...BUDGET_VALUE_FIELDS.map((field) => row[field]),
    ]);

    style[cellName(0, r)] = ORG_BG;
    style[cellName(1, r)] = SUBJECT_BG;
    style[cellName(2, r)] = DIM_BG;
    style[cellName(3, r)] = ANNUAL_BG;

    if (row.productBlockStart) {
      if (row.productRowSpan > 1) {
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
  });

  const columns = [
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
      align: 'left' as const,
    },
    {
      type: 'text',
      title: '',
      width: 154,
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

  return {
    viewRows,
    data,
    columns,
    nestedHeaders,
    mergeCells,
    style,
    foldMetas,
  };
}

function mergeDimHeaders(ws: any) {
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
      // nested 行可能带角落格，按 data-x 定位三维 + 2025年
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

      // 先保证 rowspan，再删第二行前三格；否则全年合计会顶到组织列下
      const dimOk = [0, 1, 2].every((x) => (byX(x)?.rowSpan ?? 0) >= 2);
      if (dimOk) {
        for (let x = 0; x < 3; x += 1) {
          headerRow
            .querySelector(`td[data-x="${x}"], th[data-x="${x}"]`)
            ?.remove();
        }
      } else {
        // rowspan 未生效时保留空单元格占位，避免叶子标题左移
        for (let x = 0; x < 3; x += 1) {
          const leaf = headerRow.querySelector(
            `td[data-x="${x}"], th[data-x="${x}"]`,
          ) as HTMLElement | null;
          if (!leaf) continue;
          leaf.textContent = '';
          leaf.setAttribute('data-title', '');
        }
      }

      nestedRow.setAttribute('data-dim-merged', '1');
    });
  } catch {
    // ignore
  }
}

function scheduleMergeDimHeaders(ws: any) {
  const host = (ws.element ||
    ws.el ||
    ws.content ||
    ws.parent?.el) as HTMLElement | null | undefined;

  host
    ?.querySelectorAll?.('thead tr.jss_nested')
    ?.forEach?.((row: Element) => row.removeAttribute('data-dim-merged'));

  mergeDimHeaders(ws);

  const delays = [0, 50, 100, 200, 400, 800];
  delays.forEach((ms) => window.setTimeout(() => mergeDimHeaders(ws), ms));

  // Jspreadsheet / React 重绘表头会清掉 rowspan，短时间盯住补回
  if (host && typeof MutationObserver !== 'undefined') {
    let applying = false;
    const observer = new MutationObserver(() => {
      if (applying) return;
      const sample = host.querySelector(
        'thead tr.jss_nested th[data-x="0"], thead tr.jss_nested th[role="nested-header"]',
      ) as HTMLTableCellElement | null;
      const leaf0 = host.querySelector(
        'thead tr:not(.jss_nested) th[data-x="0"], thead tr:not(.jss_nested) td[data-x="0"]',
      );
      if (sample && sample.rowSpan >= 2 && !leaf0) return;
      applying = true;
      try {
        mergeDimHeaders(ws);
      } finally {
        applying = false;
      }
    });
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['rowspan', 'colspan'],
    });
    window.setTimeout(() => observer.disconnect(), 2500);
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
    (root?.querySelector?.(
      `td[data-x="${col}"][data-y="${row}"]`,
    ) as HTMLElement | null) || null
  );
}

function paintFoldToggle(ws: any, meta: FoldMeta) {
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

function applySheetToWorksheet(ws: any, sheet: BuiltSheet) {
  try {
    ws.setData?.(sheet.data);
  } catch {
    // ignore
  }

  try {
    // 清掉旧合并，避免投影行数变化后残留
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

  scheduleMergeDimHeaders(ws);

  sheet.foldMetas.forEach((meta) => paintFoldToggle(ws, meta));
}

export default function JspreadsheetBudgetPage() {
  const spreadsheet = useRef<any>(null);
  const [mountId, setMountId] = useState(0);
  const [productExpanded, setProductExpanded] = useState(
    () => new Set<string>(INITIAL_PRODUCT_EXPANDED),
  );
  const [regionExpanded, setRegionExpanded] = useState<ExtensionExpansionState>(
    () => createInitialRegionExpansion(),
  );

  const sheet = useMemo(() => {
    const viewRows = createBusinessProjectionRows(
      [],
      productExpanded,
      regionExpanded,
    );
    return buildSheetFromProjection(viewRows);
  }, [productExpanded, regionExpanded]);

  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const toggleFold = useCallback((meta: FoldMeta) => {
    if (!meta.canFold) return;
    if (meta.col === 0) {
      setProductExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(meta.productId)) next.delete(meta.productId);
        else next.add(meta.productId);
        return next;
      });
      return;
    }
    if (!meta.regionRootId) return;
    setRegionExpanded((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(meta.productId) ?? []);
      if (current.has(meta.regionRootId!)) current.delete(meta.regionRootId!);
      else current.add(meta.regionRootId!);
      next.set(meta.productId, current);
      return next;
    });
  }, []);

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

      applySheetToWorksheet(ws, sheetRef.current);

      const table =
        ws.table ||
        ws.element?.querySelector?.('table') ||
        ws.content?.querySelector?.('table');
      if (!table) return;
      table.classList.add('jss-outline-table');

      const onClick = (ev: MouseEvent) => {
        const target = ev.target as HTMLElement | null;
        const toggle = target?.closest?.(
          '.jss-outline-toggle',
        ) as HTMLElement | null;
        if (!toggle || !table.contains(toggle)) return;
        ev.preventDefault();
        ev.stopPropagation();
        const row = Number(toggle.dataset.row);
        const col = Number(toggle.dataset.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) return;
        const meta = sheetRef.current.foldMetas.find(
          (m) => m.row === row && m.col === col && m.canFold,
        );
        if (meta) toggleFold(meta);
      };

      table.addEventListener('click', onClick);
      unbind = () => table.removeEventListener('click', onClick);
    }, 80);

    return () => {
      window.clearTimeout(timer);
      unbind?.();
    };
  }, [sheet, mountId, toggleFold]);

  return (
    <PageContainer
      title="Jspreadsheet Data Grid · 预算费用表"
      subTitle={`渲染对齐 SpreadJS Demo 投影 · ▶/▼ 展开收起 · ${sheet.data.length} 行`}
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
