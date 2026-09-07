import {
  useEffect,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import { Modal } from 'antd';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  CornerUpLeft,
  Database,
  Expand,
  HelpCircle,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Shrink,
  Check,
  X,
} from 'lucide-react';
import { getBusinessColumnDimension } from '../../SpreadJSDemo/spreadsheet/model';
import type { BusinessCellChangePayload } from '../../SpreadJSDemo/spreadsheet/business-cell-change';
import {
  COLUMNS,
  columnLabel,
  formattedValue,
  rawValue,
} from '../core/columns';
import { initialQuery } from '../core/use-budget-data';
import {
  useBudgetController,
  type BudgetController,
  type GridHandle,
} from '../core/use-budget-controller';
import { Inspector } from './inspector';
import { BudgetToolbar } from './budget-toolbar';
import { BudgetCommand } from './budget-command';
import { useDelayedPending } from '../core/use-delayed-pending';
import '../index.less';

type BudgetWorkbenchProps = {
  engineName: string;
  Grid: ForwardRefExoticComponent<
    { controller: BudgetController } & RefAttributes<GridHandle>
  >;
  onBusinessCellChange: (
    payload: BusinessCellChangePayload,
  ) => void | Promise<void>;
};

/** Engine-independent budget workspace; each renderer shares the same business commands. */
export function BudgetWorkbench({
  engineName,
  Grid,
  onBusinessCellChange,
}: BudgetWorkbenchProps) {
  const c = useBudgetController({ onBusinessCellChange });
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [locateOpen, setLocateOpen] = useState(false);
  const [locateText, setLocateText] = useState('');
  const [locateError, setLocateError] = useState('');
  const [locating, setLocating] = useState(false);
  const disabled = Boolean(c.data.error) || !c.data.manifest;
  const pending = c.busy || c.data.loading;
  const viewPending = useDelayedPending(c.data.loading);
  const commandPending = useDelayedPending(c.busy);
  const statisticsPending = c.statisticsBusy || c.data.loading;
  const showStatisticsPending = useDelayedPending(statisticsPending);
  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === rootRef.current);
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'f' &&
        rootRef.current?.contains(document.activeElement) &&
        !(event.target as Element).closest('[role="dialog"]')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      c.notify('当前浏览器无法进入全屏。', true);
    }
  };
  const openLocate = () => {
    const row = c.selectedRow;
    setLocateText(
      JSON.stringify(
        {
          row: row?.rowDimension ?? {
            DIM0090: 'MEM_ORG_HUAJING_SALES',
            DIM0069: 'MEM_SUBJECT_OFFICE_EXPENSE',
          },
          column: getBusinessColumnDimension('january'),
        },
        null,
        2,
      ),
    );
    setLocateError('');
    setLocateOpen(true);
  };
  const outlineState = c.data.manifest;
  const summaryText =
    c.data.query.mode === 'stress'
      ? '100,000 条明细 · 1,100 条汇总'
      : '费用预算样例 · 2025 年';
  return (
    <div
      ref={rootRef}
      className={`tanstack-budget ${fullscreen ? 'is-fullscreen' : ''}`}
      onPointerDownCapture={(event) => {
        // Let the clicked command finish the edit. Native blur would disable
        // its button before click and silently swallow the user's action.
        if (c.editing && (event.target as Element).closest('button'))
          event.preventDefault();
      }}
    >
      <a className="tb-skip" href="#tanstack-workspace">
        跳到费用预算表
      </a>
      <header className="tb-page-heading">
        <div className="tb-heading-main">
          <div className="tb-eyebrow">
            <span />
            预算管理工作台 <span className="tb-brand">{engineName}</span>
          </div>
          <h1>费用预算表</h1>
          <p>按组织与科目查看、调整和追踪每一笔预算。</p>
        </div>
        <div className="tb-heading-actions">
          <span
            className="tb-open-source"
            title="金额、批注和附件仅在本次会话中保留"
          >
            会话数据 · 刷新后重置
          </span>
          <BudgetCommand
            className="tb-icon-button"
            aria-label="使用指南"
            title="使用指南"
            onClick={() => c.setPanel('help')}
          >
            <HelpCircle size={19} />
          </BudgetCommand>
          <BudgetCommand
            className="tb-icon-button"
            aria-label={fullscreen ? '退出全屏' : '全屏显示'}
            title={fullscreen ? '退出全屏' : '全屏显示'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </BudgetCommand>
        </div>
      </header>
      <section className="tb-dataset-strip">
        <div>
          <Database size={17} />
          <strong>{summaryText}</strong>
        </div>
        <BudgetCommand
          className="tb-dataset-toggle"
          pending={pending}
          onClick={c.changeMode}
        >
          {c.data.query.mode === 'stress' ? '返回预算样例' : '体验 10 万行数据'}
          <ArrowUpRight size={15} />
        </BudgetCommand>
      </section>
      <BudgetToolbar
        controller={c}
        engineName={engineName}
        searchRef={searchRef}
        openLocate={openLocate}
      />
      <section className="tb-outline-bar" aria-label="层级控制">
        <div>
          <span>组织</span>
          <small>
            {outlineState?.organizationExpanded ?? 0}/
            {outlineState?.organizationGroups ?? 0}
          </small>
          <BudgetCommand
            aria-label="展开全部组织"
            title="展开全部组织"
            pending={pending}
            disabled={
              disabled ||
              outlineState?.organizationExpanded ===
                outlineState?.organizationGroups
            }
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                organizations: { all: true, ids: [] },
              })
            }
          >
            <Expand size={14} />
          </BudgetCommand>
          <BudgetCommand
            aria-label="收起全部组织"
            title="收起全部组织"
            pending={pending}
            disabled={disabled || !outlineState?.organizationExpanded}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                organizations: { all: false, ids: [] },
              })
            }
          >
            <Shrink size={14} />
          </BudgetCommand>
        </div>
        <div>
          <span>科目</span>
          <small>
            {outlineState?.subjectExpanded ?? 0}/
            {outlineState?.subjectGroups ?? 0}
          </small>
          <BudgetCommand
            aria-label="展开全部科目"
            title="展开全部科目"
            pending={pending}
            disabled={
              disabled ||
              outlineState?.subjectExpanded === outlineState?.subjectGroups
            }
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                subjects: { all: true, ids: [] },
              })
            }
          >
            <Expand size={14} />
          </BudgetCommand>
          <BudgetCommand
            aria-label="收起全部科目"
            title="收起全部科目"
            pending={pending}
            disabled={disabled || !outlineState?.subjectExpanded}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                subjects: { all: false, ids: [] },
              })
            }
          >
            <Shrink size={14} />
          </BudgetCommand>
        </div>
        <BudgetCommand
          className="tb-outline-text"
          pending={pending}
          disabled={disabled}
          aria-expanded={!c.collapsedColumns}
          title={
            c.collapsedColumns
              ? '向右展开 1 至 12 月'
              : '向左收起月份，保留全年合计'
          }
          onClick={c.toggleColumns}
        >
          {c.collapsedColumns ? '展开月份' : '收起月份'}
        </BudgetCommand>
        <BudgetCommand
          className="tb-outline-text"
          pending={pending}
          disabled={
            disabled ||
            (!outlineState?.organizationExpanded &&
              !outlineState?.subjectExpanded)
          }
          onClick={() =>
            c.changeQuery({
              ...c.data.query,
              organizations: { all: false, ids: [] },
              subjects: { all: false, ids: [] },
            })
          }
        >
          收起全部层级
        </BudgetCommand>
        <BudgetCommand
          className="tb-outline-text"
          pending={pending}
          disabled={disabled}
          onClick={() => c.changeQuery(initialQuery(c.data.query.mode))}
        >
          <RotateCcw size={13} />
          恢复默认视图
        </BudgetCommand>
        <span className="tb-outline-hint">汇总与明细独立保存</span>
      </section>
      <main
        className={`tb-workspace ${c.panel ? 'has-inspector' : ''}`}
        id="tanstack-workspace"
        tabIndex={-1}
      >
        <div className="tb-sheet">
          <div className="tb-sheet-nav">
            <nav aria-label="组织钻取路径">
              <BudgetCommand
                pending={pending}
                disabled={disabled || !c.data.query.drillPath.length}
                aria-current={
                  !c.data.query.drillPath.length ? 'page' : undefined
                }
                onClick={() =>
                  c.changeQuery({ ...c.data.query, drillPath: [] })
                }
              >
                全部组织
              </BudgetCommand>
              {outlineState?.breadcrumbs.map((crumb, index) => (
                <span key={crumb.id}>
                  <ChevronRight size={13} />
                  <BudgetCommand
                    pending={pending}
                    disabled={
                      disabled || index === outlineState.breadcrumbs.length - 1
                    }
                    aria-current={
                      index === outlineState.breadcrumbs.length - 1
                        ? 'page'
                        : undefined
                    }
                    onClick={() =>
                      c.changeQuery({
                        ...c.data.query,
                        drillPath: c.data.query.drillPath.slice(0, index + 1),
                      })
                    }
                  >
                    {crumb.name}
                  </BudgetCommand>
                </span>
              ))}
            </nav>
            <div>
              <BudgetCommand
                pending={pending}
                disabled={disabled || !c.data.query.drillPath.length}
                onClick={() =>
                  c.changeQuery({
                    ...c.data.query,
                    drillPath: c.data.query.drillPath.slice(0, -1),
                  })
                }
              >
                <CornerUpLeft size={14} />
                上一级
              </BudgetCommand>
              <BudgetCommand
                pending={pending}
                disabled={disabled || !c.selectedRow?.productIsGroup}
                onClick={() => {
                  if (c.selectedRow)
                    c.changeQuery({
                      ...c.data.query,
                      drillPath: [
                        ...c.selectedRow.productAncestorIds,
                        c.selectedRow.productId,
                      ],
                    });
                }}
              >
                <ArrowDownToLine size={14} />
                下钻
              </BudgetCommand>
            </div>
          </div>
          <div className="tb-formula-bar" role="region" aria-label="当前单元格">
            <span className="tb-address">{c.selectedAddress}</span>
            <span className="tb-fx">ƒx</span>
            <span
              className="tb-formula-value"
              title={
                c.selectedRow
                  ? c.selectedRow.formulas[COLUMNS[c.range.focus.col].id] ??
                    String(rawValue(c.selectedRow, c.range.focus.col))
                  : ''
              }
            >
              {c.selectedRow
                ? c.selectedRow.formulas[COLUMNS[c.range.focus.col].id] ??
                  String(rawValue(c.selectedRow, c.range.focus.col))
                : '正在加载…'}
            </span>
            {c.editing ? (
              <div className="tb-edit-actions">
                <span>
                  {c.busy ? '正在保存…' : '编辑中 · Enter 保存 / Esc 取消'}
                </span>
                <BudgetCommand
                  aria-label="取消当前编辑"
                  title="取消（Esc）"
                  disabled={c.busy}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    c.setEditing(null);
                    c.gridRef.current?.focus();
                  }}
                >
                  <X size={15} />
                </BudgetCommand>
                <BudgetCommand
                  aria-label="保存当前单元格"
                  title="保存（Enter）"
                  disabled={c.busy}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    void c.finishEdit().then((ok) => {
                      if (ok) c.gridRef.current?.focus();
                    })
                  }
                >
                  <Check size={15} />
                </BudgetCommand>
              </div>
            ) : (
              <BudgetCommand
                className="tb-edit-trigger"
                aria-label="编辑当前单元格"
                pending={pending}
                disabled={disabled || !COLUMNS[c.range.focus.col].editable}
                onClick={() => void c.startEdit(c.range.focus)}
              >
                <Pencil size={13} />
                {COLUMNS[c.range.focus.col].editable ? '编辑' : '只读'}
              </BudgetCommand>
            )}
          </div>
          <div className="tb-cell-context" aria-label="当前预算明细">
            <span
              title={
                c.selectedRow
                  ? `${c.selectedRow.productLabel} / ${c.selectedRow.regionLabel}`
                  : undefined
              }
            >
              {c.selectedRow
                ? `${c.selectedRow.productLabel} / ${c.selectedRow.regionLabel}`
                : '正在加载预算明细…'}
            </span>
            <span>
              {columnLabel(c.range.focus.col)} ·{' '}
              {COLUMNS[c.range.focus.col].editable ? '可编辑' : '只读'}
            </span>
          </div>
          {!c.data.manifest && c.data.loading ? (
            <div className="tb-loading" role="status">
              <div className="tb-spinner" />
              <strong>正在准备预算表</strong>
              <p>获取视图与第一批数据…</p>
            </div>
          ) : !c.data.manifest && c.data.error ? (
            <div className="tb-loading" role="alert">
              <strong>预算表暂时无法加载</strong>
              <p>{c.data.error}</p>
              <BudgetCommand className="tb-primary" onClick={c.data.retry}>
                重新加载
              </BudgetCommand>
            </div>
          ) : (
            <div
              className="tb-grid-stage"
              onKeyDownCapture={(event) => {
                if (
                  (c.data.loading || c.data.error) &&
                  event.key !== 'Tab' &&
                  (event.target as Element).closest('[role="grid"]')
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onPasteCapture={(event) => {
                if (c.data.loading || c.data.error) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <Grid ref={c.gridRef} controller={c} />
              {c.data.loading || c.data.error ? (
                <div className="tb-view-transition">
                  {c.data.error ? (
                    <div className="tb-view-error" role="alert">
                      <strong>视图更新失败，当前表格已保留</strong>
                      <p>{c.data.error}</p>
                      <BudgetCommand
                        className="tb-primary"
                        onClick={c.data.retry}
                      >
                        重新加载
                      </BudgetCommand>
                    </div>
                  ) : viewPending ? (
                    <span className="tb-view-progress" role="status">
                      正在更新视图…
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          <footer className="tb-status-bar">
            <div>
              <span className="tb-sheet-tab">费用预算表</span>
              <span>
                {(outlineState?.totalRows ?? 0).toLocaleString()} 行 ×{' '}
                {c.visibleColumns.length} 列
              </span>
              <span
                className="tb-save-status"
                role="status"
                title="修改自动保存至当前会话，刷新页面后重置"
              >
                {commandPending && c.saving
                  ? '正在保存…'
                  : commandPending
                  ? '正在处理…'
                  : c.editing
                  ? '正在编辑'
                  : c.lastSavedAt
                  ? '本次修改已保存'
                  : '修改后自动保存'}
              </span>
              {c.data.query.mode === 'stress' ? (
                <span title="只缓存最近使用的 10 页，每页 200 行">
                  已加载 {c.data.cachedRows.toLocaleString()} 行
                </span>
              ) : null}
            </div>
            <BudgetCommand
              onClick={() => {
                c.setPanel('aggregate');
                if (c.statisticsError) c.retryStatistics();
              }}
              aria-busy={statisticsPending}
              title={
                c.statisticsError ||
                (statisticsPending
                  ? '正在更新统计，当前显示上次结果'
                  : '查看完整选区统计')
              }
            >
              {c.statisticsError ? (
                '统计失败 · 点击重试'
              ) : (
                <>
                  选中 {c.statistics.cells.toLocaleString()} 格{' '}
                  <b>合计 {formattedValue(c.statistics.sum, COLUMNS[3])}</b>
                  <span className="tb-statistics-progress" aria-live="polite">
                    {showStatisticsPending ? '更新中…' : ''}
                  </span>
                </>
              )}
            </BudgetCommand>
          </footer>
        </div>
        <Inspector controller={c} />
      </main>
      <div className="tb-footnote">
        <span>双击编辑 · 拖动选择 · 右键查看更多操作</span>
        <BudgetCommand onClick={() => c.setPanel('help')}>
          查看快捷键与数据说明
        </BudgetCommand>
      </div>
      {c.toast ? (
        <div
          className={`tb-toast ${c.toast.error ? 'is-error' : ''}`}
          aria-label="操作反馈"
          role={c.toast.error ? 'alert' : 'status'}
        >
          {c.toast.message}
        </div>
      ) : null}
      <Modal
        title="按业务维度定位"
        open={locateOpen}
        getContainer={false}
        okText="定位单元格"
        cancelText="取消"
        confirmLoading={locating}
        onCancel={() => setLocateOpen(false)}
        onOk={() => {
          setLocating(true);
          setLocateError('');
          void c
            .locate(locateText)
            .then(() => setLocateOpen(false))
            .catch((error) => setLocateError(error.message))
            .finally(() => setLocating(false));
        }}
      >
        <p className="tb-muted">
          粘贴完整业务坐标，自动展开组织、科目并显示目标月份。
        </p>
        <textarea
          className="tb-dimension-input"
          aria-label="业务维度 JSON"
          rows={15}
          value={locateText}
          onChange={(event) => setLocateText(event.target.value)}
        />
        {locateError ? (
          <p className="tb-form-error" role="alert">
            {locateError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
