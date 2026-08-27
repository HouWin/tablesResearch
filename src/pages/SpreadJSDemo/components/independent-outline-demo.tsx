'use client';

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MousePointerClick,
  RotateCcw,
  Rows3,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  INITIAL_PRODUCT_EXPANDED,
  INITIAL_REGION_EXPANDED,
  PRODUCT_TREE,
  REGION_TREE,
  createIndependentOutlineRows,
  outlineNodeLabel,
  type IndependentOutlineRow,
} from '../spreadsheet/independent-outline-model';

type GCModule = typeof import('@grapecity-software/spread-sheets');
type Workbook =
  import('@grapecity-software/spread-sheets').Spread.Sheets.Workbook;
type CellClickArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ICellClickEventArgs;
type OutlineDimension = 'product' | 'region';

type OutlineActions = {
  setAll: (dimension: OutlineDimension, expanded: boolean) => void;
  reset: () => void;
};

type DemoSnapshot = {
  status: 'loading' | 'ready' | 'error';
  productExpanded: number;
  regionExpanded: number;
  rowCount: number;
  message: string;
};

const INITIAL_SNAPSHOT: DemoSnapshot = {
  status: 'loading',
  productExpanded: INITIAL_PRODUCT_EXPANDED.length,
  regionExpanded: INITIAL_REGION_EXPANDED.length,
  rowCount: 0,
  message: '正在初始化独立折叠表格…',
};

function dimensionLabel(dimension: OutlineDimension) {
  return dimension === 'product' ? '第一列（产品树）' : '第二列（区域树）';
}

function IndependentControls({
  dimension,
  title,
  description,
  expandedCount,
  totalCount,
  onSetAll,
}: {
  dimension: OutlineDimension;
  title: string;
  description: string;
  expandedCount: number;
  totalCount: number;
  onSetAll: (dimension: OutlineDimension, expanded: boolean) => void;
}) {
  return (
    <div className={`outline-control-card is-${dimension}`}>
      <div className="outline-control-copy">
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <strong aria-label={`${expandedCount} 个分组已展开，共 ${totalCount} 个`}>
        {expandedCount}/{totalCount} 展开
      </strong>
      <div className="outline-control-actions">
        <button
          type="button"
          onClick={() => onSetAll(dimension, true)}
          disabled={expandedCount === totalCount}
        >
          <ChevronDown size={14} />
          全部展开
        </button>
        <button
          type="button"
          onClick={() => onSetAll(dimension, false)}
          disabled={expandedCount === 0}
        >
          <ChevronRight size={14} />
          全部收起
        </button>
      </div>
    </div>
  );
}

export function IndependentOutlineDemo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<OutlineActions | null>(null);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;
    let workbook: Workbook | null = null;

    const start = async () => {
      try {
        const [GC] = (await Promise.all([
          import('@grapecity-software/spread-sheets'),
          import('@grapecity-software/spread-sheets-resources-zh'),
        ])) as [GCModule, unknown];
        if (cancelled || !hostRef.current) return;

        const licenseKey = process.env.NEXT_PUBLIC_SPREADJS_LICENSE_KEY;
        if (licenseKey) GC.Spread.Sheets.LicenseKey = licenseKey;
        GC.Spread.Common.CultureManager.culture('zh-cn');

        const spread = new GC.Spread.Sheets.Workbook(hostRef.current, {
          sheetCount: 1,
          allowUndo: false,
          allowUserResize: true,
          enableAccessibility: true,
          newTabVisible: false,
          tabEditable: false,
          showResizeTip: GC.Spread.Sheets.ShowResizeTip.both,
        });
        workbook = spread;
        spread.options.scrollByPixel = true;
        spread.options.scrollPixel = 24;

        const sheet = spread.getActiveSheet();
        sheet.name('双列独立折叠');
        sheet.setColumnCount(5);
        sheet.frozenColumnCount(2);
        sheet.options.rowHeaderAutoText =
          GC.Spread.Sheets.HeaderAutoText.numbers;
        sheet.options.isProtected = true;
        sheet.options.protectionOptions = {
          allowSelectLockedCells: true,
          allowSelectUnlockedCells: false,
          allowResizeColumns: true,
          allowResizeRows: false,
        };

        const productExpanded = new Set<string>(INITIAL_PRODUCT_EXPANDED);
        const regionExpanded = new Set<string>(INITIAL_REGION_EXPANDED);
        let activeRows: IndependentOutlineRow[] = [];

        const renderRows = (message: string) => {
          activeRows = createIndependentOutlineRows(
            productExpanded,
            regionExpanded,
          );
          const activeRow = Math.min(
            Math.max(sheet.getActiveRowIndex(), 0),
            activeRows.length - 1,
          );
          const activeColumn = Math.min(
            Math.max(sheet.getActiveColumnIndex(), 0),
            4,
          );

          sheet.suspendPaint();
          sheet.setRowCount(activeRows.length);
          sheet.setArray(
            0,
            0,
            activeRows.map((row) => [
              outlineNodeLabel(row.product),
              outlineNodeLabel(row.region),
              row.revenue,
              row.orders,
              row.profit,
            ]),
          );

          const headers = [
            '第一列 · 产品树',
            '第二列 · 区域树',
            '销售额',
            '订单数',
            '利润',
          ];
          headers.forEach((header, column) => {
            sheet.setValue(
              0,
              column,
              header,
              GC.Spread.Sheets.SheetArea.colHeader,
            );
          });
          [190, 190, 132, 104, 122].forEach((width, column) =>
            sheet.setColumnWidth(column, width),
          );
          sheet.setRowHeight(0, 38, GC.Spread.Sheets.SheetArea.colHeader);
          sheet.setColumnWidth(0, 44, GC.Spread.Sheets.SheetArea.rowHeader);

          sheet
            .getRange(0, 0, activeRows.length, 5)
            .font('12px Arial, PingFang SC')
            .vAlign(GC.Spread.Sheets.VerticalAlign.center)
            .backColor('#ffffff')
            .foreColor('#344054');
          sheet.getRange(0, 2, activeRows.length, 1).formatter('¥#,##0');
          sheet.getRange(0, 3, activeRows.length, 1).formatter('#,##0');
          sheet.getRange(0, 4, activeRows.length, 1).formatter('¥#,##0');
          sheet
            .getRange(0, 2, activeRows.length, 3)
            .hAlign(GC.Spread.Sheets.HorizontalAlign.right);
          sheet
            .getRange(0, 0, 1, 1, GC.Spread.Sheets.SheetArea.colHeader)
            .backColor('#e8f6ee')
            .foreColor('#19704f')
            .font('600 12px Arial, PingFang SC');
          sheet
            .getRange(0, 1, 1, 1, GC.Spread.Sheets.SheetArea.colHeader)
            .backColor('#eeeafd')
            .foreColor('#6045b8')
            .font('600 12px Arial, PingFang SC');
          sheet
            .getRange(0, 2, 1, 3, GC.Spread.Sheets.SheetArea.colHeader)
            .backColor('#f5f7fa')
            .foreColor('#475467')
            .font('600 12px Arial, PingFang SC');

          activeRows.forEach((row, rowIndex) => {
            sheet.setRowHeight(rowIndex, 29);
            const productCell = sheet.getCell(rowIndex, 0);
            const regionCell = sheet.getCell(rowIndex, 1);
            productCell.textIndent(row.product.depth);
            regionCell.textIndent(row.region.depth);

            if (row.product.isGroup) {
              productCell
                .backColor('#edf8f2')
                .foreColor('#176a4b')
                .font('600 12px Arial, PingFang SC');
            }
            if (row.region.isGroup) {
              regionCell
                .backColor('#f2efff')
                .foreColor('#5b43ad')
                .font('600 12px Arial, PingFang SC');
            }
            if (row.product.isGroup && row.region.isGroup) {
              sheet
                .getRange(rowIndex, 2, 1, 3)
                .backColor('#faf9ff')
                .font('600 12px Arial, PingFang SC');
            }
          });

          sheet.setActiveCell(activeRow, activeColumn);
          sheet.resumePaint();
          setSnapshot({
            status: 'ready',
            productExpanded: productExpanded.size,
            regionExpanded: regionExpanded.size,
            rowCount: activeRows.length,
            message,
          });
        };

        const setAll = (dimension: OutlineDimension, expanded: boolean) => {
          const tree = dimension === 'product' ? PRODUCT_TREE : REGION_TREE;
          const target =
            dimension === 'product' ? productExpanded : regionExpanded;
          target.clear();
          if (expanded) tree.forEach((node) => target.add(node.id));
          renderRows(
            `${dimensionLabel(dimension)}已${
              expanded ? '全部展开' : '全部收起'
            }，另一列的状态未改变。`,
          );
        };

        const reset = () => {
          productExpanded.clear();
          regionExpanded.clear();
          INITIAL_PRODUCT_EXPANDED.forEach((id) => productExpanded.add(id));
          INITIAL_REGION_EXPANDED.forEach((id) => regionExpanded.add(id));
          renderRows('已恢复初始组合，两列仍使用各自独立的展开状态。');
        };

        actionsRef.current = { setAll, reset };
        sheet.bind(
          GC.Spread.Sheets.Events.CellClick,
          (_sender: unknown, args: CellClickArgs) => {
            if (
              args.sheetArea !== GC.Spread.Sheets.SheetArea.viewport ||
              (args.col !== 0 && args.col !== 1)
            )
              return;

            const row = activeRows[args.row];
            const dimension: OutlineDimension =
              args.col === 0 ? 'product' : 'region';
            const node = args.col === 0 ? row?.product : row?.region;
            if (!node?.isGroup) return;

            const target =
              dimension === 'product' ? productExpanded : regionExpanded;
            const nextExpanded = !target.has(node.id);
            if (nextExpanded) target.add(node.id);
            else target.delete(node.id);
            renderRows(
              `${dimensionLabel(dimension)}的「${node.label}」已${
                nextExpanded ? '展开' : '收起'
              }，另一列的状态未改变。`,
            );
          },
        );

        renderRows('准备就绪：点击任一列带箭头的分组，观察另一列保持原状。');
      } catch (error) {
        console.error('[SpreadJS] 独立折叠 Demo 初始化失败', error);
        if (!cancelled) {
          setSnapshot((current) => ({
            ...current,
            status: 'error',
            message: '表格初始化失败，请刷新页面后重试。',
          }));
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      actionsRef.current = null;
      workbook?.destroy();
    };
  }, []);

  const setAll = (dimension: OutlineDimension, expanded: boolean) =>
    actionsRef.current?.setAll(dimension, expanded);
  const controlsDisabled = snapshot.status !== 'ready';

  return (
    <section
      id="independent-outline-demo"
      className="independent-outline-section"
      aria-labelledby="independent-outline-title"
    >
      <div className="independent-outline-card">
        <header className="independent-outline-header">
          <div className="independent-outline-title">
            <span className="outline-demo-mark">
              <Rows3 size={20} />
            </span>
            <div>
              <p>SpreadJS · 独立维度折叠 Demo</p>
              <h2 id="independent-outline-title">两列展开状态互不干扰</h2>
            </div>
          </div>
          <div className="independent-outline-meta">
            <span className={`outline-ready-state is-${snapshot.status}`}>
              {snapshot.status === 'ready' ? (
                <CheckCircle2 size={14} />
              ) : (
                <i aria-hidden="true" />
              )}
              {snapshot.status === 'loading'
                ? '初始化中'
                : snapshot.status === 'error'
                ? '初始化失败'
                : `${snapshot.rowCount} 个投影行`}
            </span>
            <button
              type="button"
              onClick={() => actionsRef.current?.reset()}
              disabled={controlsDisabled}
            >
              <RotateCcw size={14} />
              恢复初始状态
            </button>
          </div>
        </header>

        <div className="independent-outline-explainer">
          <MousePointerClick size={17} />
          <p>
            直接点击第一列或第二列中带 <b>▶ / ▼</b> 的分组。每一列维护自己的
            <code>expandedIds</code>，切换后只重算展示投影与汇总值。
          </p>
        </div>

        <div
          className={`independent-outline-controls ${
            controlsDisabled ? 'is-disabled' : ''
          }`}
          aria-disabled={controlsDisabled}
        >
          <IndependentControls
            dimension="product"
            title="第一列 · 产品树"
            description="家具 / 办公用品 / 技术产品"
            expandedCount={snapshot.productExpanded}
            totalCount={PRODUCT_TREE.length}
            onSetAll={setAll}
          />
          <IndependentControls
            dimension="region"
            title="第二列 · 区域树"
            description="华东 / 华中 / 华南"
            expandedCount={snapshot.regionExpanded}
            totalCount={REGION_TREE.length}
            onSetAll={setAll}
          />
        </div>

        <div className="independent-outline-sheet-shell">
          <div
            ref={hostRef}
            className="independent-outline-sheet"
            aria-label="第一列产品树与第二列区域树独立展开的 SpreadJS 表格"
            aria-busy={snapshot.status === 'loading'}
          />
          {snapshot.status !== 'ready' && (
            <div
              className={`independent-outline-overlay is-${snapshot.status}`}
              role={snapshot.status === 'error' ? 'alert' : 'status'}
            >
              <i aria-hidden="true" />
              <span>{snapshot.message}</span>
            </div>
          )}
        </div>

        <footer className="independent-outline-footer">
          <span className="outline-state-dot is-product" />
          第一列 {snapshot.productExpanded}/{PRODUCT_TREE.length} 展开
          <span className="outline-state-dot is-region" />
          第二列 {snapshot.regionExpanded}/{REGION_TREE.length} 展开
          <span className="outline-projection-count">
            当前 {snapshot.rowCount} 行
          </span>
          <p aria-live="polite">{snapshot.message}</p>
        </footer>
      </div>
    </section>
  );
}
