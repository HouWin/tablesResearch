import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from 'antd';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  CornerUpLeft,
  Database,
  Expand,
  FileClock,
  FolderTree,
  HelpCircle,
  LocateFixed,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Pencil,
  Redo2,
  RotateCcw,
  Search,
  Shrink,
  Undo2,
  X,
} from 'lucide-react';
import { getBusinessColumnDimension } from '../SpreadJSDemo/spreadsheet/model';
import { COLUMNS, columnLabel, formattedValue, rawValue } from './core/columns';
import { initialQuery } from './core/use-budget-data';
import { useBudgetController } from './core/use-budget-controller';
import { BudgetGrid } from './components/budget-grid';
import { Inspector } from './components/inspector';
import './index.less';

function Tool({
  icon,
  children,
  title,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tb-tool"
      title={title}
      aria-label={typeof children === 'string' ? children : title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
export default function TanStackBudgetPage() {
  const c = useBudgetController();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [locateOpen, setLocateOpen] = useState(false);
  const [locateText, setLocateText] = useState('');
  const [locateError, setLocateError] = useState('');
  const [locating, setLocating] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const disabled = c.busy || c.data.loading || !c.data.manifest;
  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === rootRef.current);
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'f' &&
        rootRef.current
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
  useEffect(() => {
    if (!columnsOpen) return;
    const outside = (event: PointerEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node))
        setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [columnsOpen]);
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
    >
      <a className="tb-skip" href="#tanstack-workspace">
        跳到费用预算表
      </a>
      <header className="tb-page-heading">
        <div className="tb-heading-main">
          <div className="tb-eyebrow">
            <span />
            预算管理工作台 <span className="tb-brand">TanStack Table</span>
          </div>
          <h1>费用预算表</h1>
          <p>按组织与科目查看、调整和追踪每一笔预算。</p>
        </div>
        <div className="tb-heading-actions">
          <span className="tb-open-source">MIT · 开源免费</span>
          <button
            className="tb-icon-button"
            aria-label="使用指南"
            title="使用指南"
            onClick={() => c.setPanel('help')}
          >
            <HelpCircle size={19} />
          </button>
          <button
            className="tb-icon-button"
            aria-label={fullscreen ? '退出全屏' : '全屏显示'}
            title={fullscreen ? '退出全屏' : '全屏显示'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </button>
        </div>
      </header>
      <section className="tb-dataset-strip">
        <div>
          <Database size={17} />
          <strong>{summaryText}</strong>
          <span className="tb-dataset-status">
            {c.data.loading
              ? '正在加载…'
              : c.data.error
              ? '连接异常'
              : '已连接'}
          </span>
        </div>
        <button
          className="tb-dataset-toggle"
          disabled={c.busy || c.data.loading}
          onClick={c.changeMode}
        >
          {c.data.query.mode === 'stress' ? '返回预算样例' : '体验 10 万行数据'}
          <ArrowUpRight size={15} />
        </button>
      </section>
      <section className="tb-toolbar" aria-label="预算表工具栏">
        <div className="tb-tool-group">
          <Tool
            icon={<Undo2 size={16} />}
            disabled={disabled || !c.undo.length}
            title="撤销（Ctrl/⌘ + Z）"
            onClick={() => void c.replay('undo')}
          >
            撤销
          </Tool>
          <Tool
            icon={<Redo2 size={16} />}
            disabled={disabled || !c.redo.length}
            title="重做（Ctrl/⌘ + Shift + Z）"
            onClick={() => void c.replay('redo')}
          >
            重做
          </Tool>
          <Tool
            icon={<Copy size={16} />}
            disabled={disabled}
            onClick={() => void c.copy()}
          >
            复制
          </Tool>
        </div>
        <div className="tb-search">
          <Search size={16} />
          <input
            ref={searchRef}
            aria-label="搜索完整预算数据"
            placeholder="搜索组织、科目或金额…"
            value={c.searchText}
            disabled={c.busy}
            onChange={(event) => c.setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void c.search(event.shiftKey ? -1 : 1);
              }
              if (event.key === 'Escape') c.gridRef.current?.focus();
            }}
          />
          <span aria-live="polite">
            {c.searchBusy
              ? '查找中'
              : c.searchResult
              ? c.searchResult.total
                ? `${c.searchResult.index + 1} / ${c.searchResult.total}`
                : '无结果'
              : ''}
          </span>
          <button
            aria-label="上一个搜索结果"
            disabled={disabled || c.searchBusy || !c.searchText}
            onClick={() => void c.search(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            aria-label="下一个搜索结果"
            disabled={disabled || c.searchBusy || !c.searchText}
            onClick={() => void c.search(1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="tb-tool-group">
          <Tool
            icon={<LocateFixed size={16} />}
            disabled={disabled}
            onClick={openLocate}
          >
            业务定位
          </Tool>
          <div className="tb-column-menu-anchor" ref={columnMenuRef}>
            <Tool
              icon={<Columns3 size={16} />}
              disabled={disabled}
              onClick={() => setColumnsOpen((value) => !value)}
            >
              列管理
            </Tool>
            {columnsOpen ? (
              <div
                className="tb-column-menu"
                role="dialog"
                aria-label="列管理"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setColumnsOpen(false);
                }}
              >
                <div>
                  <strong>显示的列</strong>
                  <button
                    aria-label="关闭列管理"
                    onClick={() => setColumnsOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
                {COLUMNS.map((column, col) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      disabled={col < 3}
                      checked={!c.hidden.has(col)}
                      onChange={(event) =>
                        c.setColumnVisible(col, event.target.checked)
                      }
                    />
                    {columnLabel(col)}
                    {col < 3 ? <small>冻结</small> : null}
                  </label>
                ))}
                <button className="tb-text-button" onClick={c.showAllColumns}>
                  恢复显示全部列
                </button>
              </div>
            ) : null}
          </div>
          <Tool
            icon={<Expand size={16} />}
            disabled={disabled}
            title="按当前已加载内容调整列宽；双击列边界调整单列"
            onClick={() => c.gridRef.current?.autoFit()}
          >
            适配列宽
          </Tool>
        </div>
        <div className="tb-tool-group tb-secondary-tools">
          <Tool
            icon={<MessageSquare size={16} />}
            disabled={disabled}
            onClick={() => c.setPanel('comment')}
          >
            批注
          </Tool>
          <Tool
            icon={<FileClock size={16} />}
            disabled={disabled}
            onClick={() => c.setPanel('history')}
          >
            历史
          </Tool>
          <Tool
            icon={<Paperclip size={16} />}
            disabled={disabled}
            onClick={() => c.setPanel('attachment')}
          >
            附件
          </Tool>
          <Tool
            icon={<FolderTree size={16} />}
            disabled={disabled}
            onClick={() => c.setPanel('lineage')}
          >
            追踪
          </Tool>
          <Tool
            icon={<ChartNoAxesCombined size={16} />}
            disabled={disabled}
            onClick={() => c.setPanel('aggregate')}
          >
            统计
          </Tool>
        </div>
      </section>
      <section className="tb-outline-bar" aria-label="层级控制">
        <div>
          <span>组织</span>
          <small>
            {outlineState?.organizationExpanded ?? 0}/
            {outlineState?.organizationGroups ?? 0}
          </small>
          <button
            aria-label="展开全部组织"
            title="展开全部组织"
            disabled={disabled}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                organizations: { all: true, ids: [] },
              })
            }
          >
            <Expand size={14} />
          </button>
          <button
            aria-label="收起全部组织"
            title="收起全部组织"
            disabled={disabled}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                organizations: { all: false, ids: [] },
              })
            }
          >
            <Shrink size={14} />
          </button>
        </div>
        <div>
          <span>科目</span>
          <small>
            {outlineState?.subjectExpanded ?? 0}/
            {outlineState?.subjectGroups ?? 0}
          </small>
          <button
            aria-label="展开全部科目"
            title="展开全部科目"
            disabled={disabled}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                subjects: { all: true, ids: [] },
              })
            }
          >
            <Expand size={14} />
          </button>
          <button
            aria-label="收起全部科目"
            title="收起全部科目"
            disabled={disabled}
            onClick={() =>
              c.changeQuery({
                ...c.data.query,
                subjects: { all: false, ids: [] },
              })
            }
          >
            <Shrink size={14} />
          </button>
        </div>
        <button
          className="tb-outline-text"
          disabled={disabled}
          onClick={c.toggleColumns}
        >
          {c.collapsedColumns ? '展开月份' : '收起月份'}
        </button>
        <button
          className="tb-outline-text"
          disabled={disabled}
          onClick={() =>
            c.changeQuery({
              ...c.data.query,
              organizations: { all: false, ids: [] },
              subjects: { all: false, ids: [] },
            })
          }
        >
          收起全部层级
        </button>
        <button
          className="tb-outline-text"
          disabled={disabled}
          onClick={() => c.changeQuery(initialQuery(c.data.query.mode))}
        >
          <RotateCcw size={13} />
          恢复默认视图
        </button>
        <span className="tb-outline-hint">汇总与明细独立保存</span>
      </section>
      <main
        className={`tb-workspace ${c.panel ? 'has-inspector' : ''}`}
        id="tanstack-workspace"
      >
        <div className="tb-sheet">
          <div className="tb-sheet-nav">
            <nav aria-label="组织钻取路径">
              <button
                disabled={disabled}
                onClick={() =>
                  c.changeQuery({ ...c.data.query, drillPath: [] })
                }
              >
                全部组织
              </button>
              {outlineState?.breadcrumbs.map((crumb, index) => (
                <span key={crumb.id}>
                  <ChevronRight size={13} />
                  <button
                    disabled={disabled}
                    onClick={() =>
                      c.changeQuery({
                        ...c.data.query,
                        drillPath: c.data.query.drillPath.slice(0, index + 1),
                      })
                    }
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </nav>
            <div>
              <button
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
              </button>
              <button
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
              </button>
            </div>
          </div>
          <div className="tb-formula-bar">
            <span className="tb-address">{c.selectedAddress}</span>
            <span className="tb-fx">ƒx</span>
            <span
              className="tb-formula-value"
              title={
                c.selectedRow
                  ? String(rawValue(c.selectedRow, c.range.focus.col))
                  : ''
              }
            >
              {c.selectedRow
                ? c.selectedRow.formulas[COLUMNS[c.range.focus.col].id] ??
                  String(rawValue(c.selectedRow, c.range.focus.col))
                : '正在加载…'}
            </span>
            <button
              className="tb-edit-trigger"
              aria-label="编辑当前单元格"
              disabled={disabled || !COLUMNS[c.range.focus.col].editable}
              onClick={() => void c.startEdit(c.range.focus)}
            >
              <Pencil size={13} />
              {COLUMNS[c.range.focus.col].editable ? '编辑' : '只读'}
            </button>
          </div>
          {c.data.loading ? (
            <div className="tb-loading" role="status">
              <div className="tb-spinner" />
              <strong>正在准备预算表</strong>
              <p>获取视图与第一批数据…</p>
            </div>
          ) : c.data.error ? (
            <div className="tb-loading" role="alert">
              <strong>预算表暂时无法加载</strong>
              <p>{c.data.error}</p>
              <button className="tb-primary" onClick={c.data.retry}>
                重新加载
              </button>
            </div>
          ) : (
            <BudgetGrid ref={c.gridRef} controller={c} />
          )}
          <footer className="tb-status-bar">
            <div>
              <span className="tb-sheet-tab">费用预算表</span>
              <span>
                {(outlineState?.totalRows ?? 0).toLocaleString()} 行 ×{' '}
                {c.visibleColumns.length} 列
              </span>
              <span title="只缓存最近使用的 10 页，每页 200 行">
                已加载 {c.data.cachedRows.toLocaleString()} 行
              </span>
            </div>
            <button
              onClick={() => c.setPanel('aggregate')}
              title={c.statisticsError || '查看完整选区统计'}
            >
              {c.busy ? (
                '保存中…'
              ) : c.statisticsBusy ? (
                '统计中…'
              ) : c.statisticsError ? (
                '统计失败 · 点击重试'
              ) : (
                <>
                  选中 {c.statistics.cells.toLocaleString()} 格{' '}
                  <b>合计 {formattedValue(c.statistics.sum, COLUMNS[3])}</b>
                </>
              )}
            </button>
          </footer>
        </div>
        <Inspector controller={c} />
      </main>
      <div className="tb-footnote">
        <span>双击编辑 · 拖动选择 · 右键查看更多操作</span>
        <button onClick={() => c.setPanel('help')}>查看快捷键与数据说明</button>
      </div>
      {c.toast ? (
        <div
          className={`tb-toast ${c.toast.error ? 'is-error' : ''}`}
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
