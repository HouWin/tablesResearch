import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Columns3,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Gauge,
  GitBranch,
  History,
  Info,
  MessageSquareText,
  Paperclip,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  Sigma,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import './index.less';
import {
  ColumnVisibilityPopover,
  DemoHeader,
  Drawer,
  SearchPopover,
  SheetStatusBar,
  ToastMessage,
} from './components/spreadsheet-ui';
import {
  AGGREGATE_MODES,
  FEATURES,
  canDrillNode,
  displayValue,
  formatMoney,
  formatStatistic,
  pathForView,
  type DataMode,
  type OutlineDimension,
  type OutlineSnapshot,
  type SelectedCell,
} from './spreadsheet/model';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_SIZE,
  useSpreadsheetController,
} from './spreadsheet/use-spreadsheet-controller';

type LineageDetails = {
  result: string;
  description: string;
  formula: string;
  sources: [
    { label: string; value: string; note: string },
    { label: string; value: string; note: string },
  ];
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreviewAttachment(mimeType: string, name: string) {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    /\.pdf$/i.test(name)
  );
}

function getLineageDetails(
  selected: SelectedCell | null,
): LineageDetails | null {
  if (!selected) return null;
  if (selected.field === 'revenue') {
    return {
      result: formatMoney(selected.node.revenue),
      description: '商品收入 + 服务收入',
      formula: 'SUM(商品收入, 服务收入)',
      sources: [
        {
          label: '商品收入',
          value: formatMoney(selected.node.productRevenue),
          note: `业务日报 · ${selected.node.id}`,
        },
        {
          label: '服务收入',
          value: formatMoney(selected.node.serviceRevenue),
          note: '服务台账 · 已核验',
        },
      ],
    };
  }
  if (selected.field === 'avgOrder') {
    return {
      result: formatMoney(selected.node.avgOrder),
      description: '净收入 ÷ 订单数',
      formula: 'DIVIDE(净收入, 订单数)',
      sources: [
        {
          label: '净收入',
          value: formatMoney(selected.node.revenue),
          note: `业务日报 · ${selected.node.id}`,
        },
        {
          label: '订单数',
          value: selected.node.orders.toLocaleString('zh-CN'),
          note: '订单明细 · 去重后',
        },
      ],
    };
  }
  if (selected.field === 'completion') {
    const target = selected.node.completion
      ? selected.node.revenue / selected.node.completion
      : 0;
    return {
      result: `${(selected.node.completion * 100).toFixed(1)}%`,
      description: '实际完成额 ÷ 目标额',
      formula: 'DIVIDE(实际完成额, 目标额)',
      sources: [
        {
          label: '实际完成额',
          value: formatMoney(selected.node.revenue),
          note: `经营日报 · ${selected.node.id}`,
        },
        {
          label: '目标额',
          value: formatMoney(target),
          note: '目标计划 · 当前周期',
        },
      ],
    };
  }
  return null;
}

function useToolbarOverflow() {
  const toolbarRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const update = () => {
      const maxScrollLeft = toolbar.scrollWidth - toolbar.clientWidth;
      setOverflow({
        left: toolbar.scrollLeft > 2,
        right: toolbar.scrollLeft < maxScrollLeft - 2,
      });
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resizeObserver?.observe(toolbar);
    toolbar.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      resizeObserver?.disconnect();
      toolbar.removeEventListener('scroll', update);
    };
  }, []);

  const scroll = (direction: -1 | 1) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    toolbar.scrollBy({
      left: direction * Math.min(320, toolbar.clientWidth * 0.7),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return { toolbarRef, overflow, scroll };
}

function OutlineControlCard({
  dimension,
  title,
  description,
  expanded,
  total,
  disabled,
  onSetAll,
}: {
  dimension: OutlineDimension;
  title: string;
  description: string;
  expanded: number;
  total: number;
  disabled: boolean;
  onSetAll: (dimension: OutlineDimension, expanded: boolean) => void;
}) {
  return (
    <section className={`integrated-outline-card is-${dimension}`}>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <span aria-label={`${expanded} 个分组已展开，共 ${total} 个`}>
        {expanded}/{total} 展开
      </span>
      <div className="integrated-outline-actions">
        <button
          type="button"
          disabled={disabled || total === 0 || expanded === total}
          onClick={() => onSetAll(dimension, true)}
        >
          <ChevronDown size={13} />
          全部展开
        </button>
        <button
          type="button"
          disabled={disabled || expanded === 0}
          onClick={() => onSetAll(dimension, false)}
        >
          <ChevronRight size={13} />
          全部收起
        </button>
      </div>
    </section>
  );
}

function IntegratedOutlineControls({
  snapshot,
  dataMode,
  disabled,
  onSetAll,
  onReset,
}: {
  snapshot: OutlineSnapshot;
  dataMode: DataMode;
  disabled: boolean;
  onSetAll: (dimension: OutlineDimension, expanded: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div
      className={`integrated-outline-controls${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label="双列独立折叠控制"
    >
      <OutlineControlCard
        dimension="product"
        title={dataMode === 'stress' ? '事业群与产品线' : '产品层级'}
        description={
          dataMode === 'stress'
            ? '10 个事业群 / 100 条产品线；两级均可独立折叠'
            : '家具 / 办公用品 / 技术产品；属性列跟随产品'
        }
        expanded={snapshot.productExpanded}
        total={snapshot.productTotal}
        disabled={disabled}
        onSetAll={onSetAll}
      />
      <OutlineControlCard
        dimension="region"
        title="区域层级"
        description={
          dataMode === 'stress'
            ? '约 1,000 个区域组；折叠状态不影响产品层级'
            : '每个产品分别维护区域展开状态'
        }
        expanded={snapshot.regionExpanded}
        total={snapshot.regionTotal}
        disabled={disabled}
        onSetAll={onSetAll}
      />
      <button
        type="button"
        className="integrated-outline-reset"
        disabled={disabled}
        onClick={onReset}
        title={
          dataMode === 'stress'
            ? '收起全部层级，仅显示事业群汇总'
            : '恢复产品树默认展开、区域树全部收起'
        }
      >
        <RotateCcw size={14} />
        恢复默认
      </button>
    </div>
  );
}

export default function SpreadJSDemoPage() {
  const {
    hostRef,
    actionsRef,
    ready,
    initializationError,
    retryInitialization,
    view,
    dataMode,
    panel,
    setPanel,
    selected,
    selectionStats,
    aggregateMode,
    setAggregateMode,
    customFormula,
    setCustomFormula,
    commentDraft,
    commentExists,
    commentDirty,
    setCommentDraft,
    selectedAttachments,
    selectedHistory,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResult,
    setSearchResult,
    searchBusy,
    columnMenuOpen,
    setColumnMenuOpen,
    columnVisibility,
    rowGroupsCollapsed,
    columnGroupsCollapsed,
    outlineSnapshot,
    toast,
    datasetLabel,
    openPanel,
    tableBusy,
    aggregateValue,
  } = useSpreadsheetController();
  const canDrillSelected =
    dataMode === 'regular' && canDrillNode(selected?.node);
  const lineageDetails = getLineageDetails(selected);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const columnAnchorRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const {
    toolbarRef,
    overflow: toolbarOverflow,
    scroll: scrollToolbar,
  } = useToolbarOverflow();

  return (
    <div className="spreadjs-demo-page">
      <main className="demo-shell">
        <DemoHeader
          status={initializationError ? 'error' : ready ? 'ready' : 'loading'}
          onOpenFeatures={() => openPanel('features')}
        />

        <div className="toolbar-shell">
          <section
            id="spreadjs-toolbar"
            ref={toolbarRef}
            className="demo-toolbar"
            aria-label="表格工具栏"
          >
            <div className="toolbar-group">
              <button
                type="button"
                disabled={tableBusy}
                onClick={() => actionsRef.current?.undo()}
                title="撤销单元格编辑"
              >
                <Undo2 size={16} />
                <span>撤销</span>
              </button>
              <button
                type="button"
                disabled={tableBusy}
                onClick={() => actionsRef.current?.redo()}
                title="重做单元格编辑"
              >
                <Redo2 size={16} />
                <span>重做</span>
              </button>
              <button
                type="button"
                disabled={tableBusy}
                onClick={() => actionsRef.current?.copy()}
                title="复制矩形选区"
              >
                <Copy size={16} />
                <span>复制选区</span>
              </button>
            </div>

            <div className="toolbar-separator" aria-hidden="true" />
            <div ref={searchAnchorRef} className="toolbar-popover-anchor">
              <button
                type="button"
                disabled={tableBusy}
                aria-label="快速搜索"
                aria-expanded={searchOpen}
                aria-controls="sheet-search-popover"
                className={searchOpen ? 'is-active' : ''}
                onClick={() => {
                  setSearchOpen((open) => {
                    if (open) actionsRef.current?.cancelSearch();
                    return !open;
                  });
                  setColumnMenuOpen(false);
                }}
              >
                <Search size={16} />
                <span>快速搜索</span>
              </button>
              {searchOpen && (
                <SearchPopover
                  anchorRef={searchAnchorRef}
                  query={searchQuery}
                  result={searchResult}
                  busy={searchBusy}
                  onQueryChange={(query) => {
                    actionsRef.current?.cancelSearch();
                    setSearchQuery(query);
                    setSearchResult(
                      query.trim()
                        ? '按 Enter 搜索全部层级，Shift + Enter 反向搜索'
                        : '输入关键词，按 Enter 开始搜索',
                    );
                  }}
                  onSearch={(direction) =>
                    actionsRef.current?.search(searchQuery, direction)
                  }
                />
              )}
            </div>

            <div ref={columnAnchorRef} className="toolbar-popover-anchor">
              <button
                type="button"
                disabled={tableBusy}
                aria-label="列管理"
                aria-expanded={columnMenuOpen}
                aria-controls="column-visibility-popover"
                className={columnMenuOpen ? 'is-active' : ''}
                onClick={() => {
                  setColumnMenuOpen((open) => !open);
                  if (searchOpen) actionsRef.current?.cancelSearch();
                  setSearchOpen(false);
                }}
              >
                <Columns3 size={16} />
                <span>列管理</span>
                <ChevronDown size={13} />
              </button>
              {columnMenuOpen && (
                <ColumnVisibilityPopover
                  anchorRef={columnAnchorRef}
                  visibility={columnVisibility}
                  onToggle={(column, visible) =>
                    actionsRef.current?.toggleColumn(column, visible)
                  }
                  onShowAll={() => actionsRef.current?.showAllColumns()}
                />
              )}
            </div>

            <button
              type="button"
              disabled={tableBusy}
              aria-label={rowGroupsCollapsed ? '展开全部行组' : '收起全部行组'}
              title={
                rowGroupsCollapsed
                  ? dataMode === 'stress'
                    ? '展开全部事业群、产品线与区域层级'
                    : '展开全部产品与区域层级'
                  : dataMode === 'stress'
                  ? '收起全部事业群、产品线与区域层级'
                  : '收起全部产品与区域层级'
              }
              onClick={() => actionsRef.current?.toggleRowGroups()}
              className={rowGroupsCollapsed ? 'is-active' : ''}
            >
              <Settings2 size={16} />
              <span>
                {rowGroupsCollapsed ? '展开全部行组' : '收起全部行组'}
              </span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label={
                columnGroupsCollapsed ? '展开全部列组' : '收起全部列组'
              }
              onClick={() => actionsRef.current?.toggleColumnGroups()}
              className={columnGroupsCollapsed ? 'is-active' : ''}
            >
              <Columns3 size={16} />
              <span>
                {columnGroupsCollapsed ? '展开全部列组' : '收起全部列组'}
              </span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label="适配全部列宽"
              onClick={() => actionsRef.current?.autoFit()}
            >
              <Gauge size={16} />
              <span>适配列宽</span>
            </button>

            <div className="toolbar-separator" aria-hidden="true" />
            <button
              type="button"
              disabled={tableBusy}
              aria-label="自定义统计"
              onClick={() => openPanel('aggregate')}
            >
              <Sigma size={16} />
              <span>自定义统计</span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label="单元格批注"
              onClick={() => openPanel('comment')}
            >
              <MessageSquareText size={16} />
              <span>批注</span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label="单元格历史"
              onClick={() => openPanel('history')}
            >
              <History size={16} />
              <span>历史</span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label="数据追踪"
              onClick={() => openPanel('lineage')}
            >
              <GitBranch size={16} />
              <span>数据追踪</span>
            </button>
            <button
              type="button"
              disabled={tableBusy}
              aria-label="单元格附件"
              onClick={() => openPanel('attachment')}
            >
              <Paperclip size={16} />
              <span>附件</span>
            </button>

            <div className="toolbar-spacer" />
            <button
              type="button"
              aria-label={
                dataMode === 'stress' ? '恢复常规数据' : '载入10万行模式'
              }
              className={dataMode === 'stress' ? 'stress-active' : ''}
              disabled={tableBusy}
              onClick={() =>
                actionsRef.current?.loadDataMode(
                  dataMode === 'stress' ? 'regular' : 'stress',
                )
              }
            >
              <Database size={16} />
              <span>
                {dataMode === 'loading'
                  ? '载入中…'
                  : dataMode === 'stress'
                  ? '恢复常规'
                  : '10 万行模式'}
              </span>
            </button>
          </section>
          {toolbarOverflow.left && (
            <button
              className="toolbar-scroll-button is-left"
              type="button"
              aria-label="查看左侧工具"
              aria-controls="spreadjs-toolbar"
              onClick={() => scrollToolbar(-1)}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {toolbarOverflow.right && (
            <button
              className="toolbar-scroll-button is-right"
              type="button"
              aria-label="查看更多工具"
              aria-controls="spreadjs-toolbar"
              onClick={() => scrollToolbar(1)}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        <section className="work-area">
          <div className="sheet-card">
            <div className="crumb-row">
              <nav aria-label="数据钻取路径">
                {pathForView(view).map((crumb, index, crumbs) => (
                  <span key={`${index}-${crumb}`}>
                    <button
                      type="button"
                      disabled={tableBusy || dataMode !== 'regular'}
                      className={index === crumbs.length - 1 ? 'current' : ''}
                      onClick={() =>
                        actionsRef.current?.setView(view.slice(0, index))
                      }
                    >
                      {crumb}
                    </button>
                    {index < crumbs.length - 1 && <ChevronRight size={12} />}
                  </span>
                ))}
              </nav>
              <div className="drill-actions" aria-label="层级钻取操作">
                {view.length > 0 && (
                  <button
                    className="up-button"
                    type="button"
                    disabled={tableBusy}
                    onClick={() => actionsRef.current?.up()}
                    title="返回上一级"
                  >
                    <ChevronLeft size={13} />
                    上钻
                  </button>
                )}
                <button
                  className="drill-button"
                  type="button"
                  disabled={tableBusy || !canDrillSelected}
                  onClick={() => actionsRef.current?.drillSelected()}
                  title={
                    canDrillSelected
                      ? '查看所选行的下一级数据'
                      : '当前行没有下级数据'
                  }
                >
                  下钻所选行
                  <ChevronRight size={13} />
                </button>
              </div>
              <small>
                {dataMode === 'stress'
                  ? '单击产品或区域层级单元格逐级展开 / 收起 · 搜索会自动展开命中项路径'
                  : '单击层级单元格展开 / 收起 · 选中汇总行后下钻 · 右键打开业务菜单'}
              </small>
            </div>

            <IntegratedOutlineControls
              snapshot={outlineSnapshot}
              dataMode={dataMode}
              disabled={tableBusy}
              onSetAll={(dimension, expanded) =>
                actionsRef.current?.setOutlineDimension(dimension, expanded)
              }
              onReset={() => actionsRef.current?.resetOutline()}
            />

            <div className="formula-bar">
              <span className="name-box">{selected?.a1 ?? 'A1'}</span>
              <span className="fx">fx</span>
              <span className="formula-value">
                {selected?.text || '选择单元格查看内容'}
              </span>
              <span className="selected-field">
                {selected?.node.name ?? '—'} · {selected?.fieldLabel ?? '—'}
              </span>
            </div>

            <div className="spread-host-wrap" aria-busy={tableBusy}>
              <div
                ref={hostRef}
                className="spread-host"
                aria-label="经营数据电子表格"
              />
              {!ready && !initializationError && (
                <div className="table-state-overlay" role="status">
                  <i />
                  <strong>正在初始化电子表格</strong>
                  <span>首次加载表格引擎可能需要几秒钟</span>
                </div>
              )}
              {ready && dataMode === 'loading' && (
                <div className="table-state-overlay" role="status">
                  <i />
                  <strong>正在生成 10 万行压力数据</strong>
                  <span>表格会分批渲染，页面仍会保持响应</span>
                </div>
              )}
              {initializationError && (
                <div
                  className="table-state-overlay table-state-error"
                  role="alert"
                >
                  <CircleAlert size={22} />
                  <strong>{initializationError}</strong>
                  <span>可以重试初始化，无需刷新整个页面</span>
                  <button type="button" onClick={retryInitialization}>
                    重新初始化
                  </button>
                </div>
              )}
            </div>

            <SheetStatusBar
              selectionStats={selectionStats}
              dataMode={dataMode}
              datasetLabel={datasetLabel}
            />
          </div>
        </section>

        {panel === 'comment' && (
          <Drawer
            title="单元格批注"
            subtitle={`${selected?.a1 ?? '—'} · ${
              selected?.node.name ?? '未选择'
            }`}
            onClose={() => setPanel(null)}
            initialFocusRef={commentInputRef}
          >
            <div className="selected-card">
              <span>{selected?.fieldLabel}</span>
              <strong>{selected?.text || '空单元格'}</strong>
              <small>稳定 ID：{selected?.key}</small>
            </div>
            <label className="field-label" htmlFor="comment-text">
              批注内容
            </label>
            <textarea
              ref={commentInputRef}
              id="comment-text"
              className="comment-input"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="输入一条简单批注…"
            />
            <div className="drawer-actions">
              <button
                className="danger-button"
                type="button"
                disabled={!commentExists}
                onClick={() => actionsRef.current?.deleteComment()}
              >
                <Trash2 size={14} />
                删除
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!commentDraft.trim() || !commentDirty}
                onClick={() => actionsRef.current?.saveComment(commentDraft)}
              >
                {commentDirty ? '保存批注' : '已保存'}
              </button>
            </div>
            <p className="helper-text">
              批注使用 rowId + columnId 关联；切换钻取层级后仍会回到正确记录。
            </p>
          </Drawer>
        )}

        {panel === 'history' && (
          <Drawer
            title="单元格历史"
            subtitle={`${selected?.a1 ?? '—'} · ${
              selected?.fieldLabel ?? '未选择'
            }`}
            onClose={() => setPanel(null)}
          >
            <div className="selected-card">
              <span>{selected?.node.name}</span>
              <strong>{selected?.text || '空单元格'}</strong>
              <small>仅记录值修改，不记录排序、筛选、折叠或列宽。</small>
            </div>
            <div className="history-list">
              {selectedHistory.length ? (
                selectedHistory.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span>{item.source}</span>
                      <time>
                        {new Date(item.createdAt).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </time>
                    </div>
                    <p>
                      <del>{displayValue(item.oldValue)}</del>
                      <ChevronRight size={13} />
                      <strong>{displayValue(item.newValue)}</strong>
                    </p>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <History size={22} />
                  <b>暂无值变化</b>
                  <span>编辑当前单元格后，历史会立即记录。</span>
                </div>
              )}
            </div>
          </Drawer>
        )}

        {panel === 'lineage' && (
          <Drawer
            title="数据追踪"
            subtitle={`${selected?.node.name ?? '—'} · ${
              selected?.fieldLabel ?? '未选择'
            }`}
            onClose={() => setPanel(null)}
          >
            {lineageDetails ? (
              <div className="lineage-tree">
                <div className="lineage-result">
                  <span>当前结果</span>
                  <strong>{lineageDetails.result}</strong>
                  <small>{lineageDetails.description}</small>
                </div>
                <div className="tree-connector" />
                <div className="lineage-rule">
                  <Calculator size={16} />
                  <div>
                    <b>计算规则</b>
                    <span>{lineageDetails.formula}</span>
                    <small>
                      过滤：核验状态 ≠ 异常 · 空值：忽略 · 币种：CNY
                    </small>
                  </div>
                </div>
                <div className="tree-connector split" />
                <div className="source-grid">
                  {lineageDetails.sources.map((source) => (
                    <div key={source.label}>
                      <span>{source.label}</span>
                      <b>{source.value}</b>
                      <small>{source.note}</small>
                    </div>
                  ))}
                </div>
                <button
                  className="source-jump"
                  type="button"
                  disabled={!canDrillSelected}
                  title={
                    canDrillSelected
                      ? '查看所选业务的下一级明细'
                      : '当前已经是最细业务层级'
                  }
                  onClick={() => actionsRef.current?.drillSelected()}
                >
                  {canDrillSelected ? '跳转到来源明细' : '当前已是明细层级'}
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="raw-source">
                <Database size={24} />
                <h3>原始字段，无上游计算</h3>
                <p>
                  来源记录：{selected?.node.id ?? '—'}
                  <br />
                  来源字段：{selected?.field ?? '—'}
                  <br />
                  原始值：{selected?.text || '—'}
                </p>
              </div>
            )}
          </Drawer>
        )}

        {panel === 'attachment' && (
          <Drawer
            title="单元格附件"
            subtitle={`${selected?.a1 ?? '未选择'} · ${
              selectedAttachments.length
            } 个附件`}
            onClose={() => setPanel(null)}
          >
            <div className="attachment-hero">
              <Paperclip size={22} />
              <div>
                <b>附件与单元格内容分开保存</b>
                <span>附件使用稳定单元格 ID 关联，不会改写当前值</span>
              </div>
            </div>
            <div className="selected-card attachment-cell-card">
              <span>{selected?.fieldLabel ?? '未选择字段'}</span>
              <strong>{selected?.text || '空单元格'}</strong>
              <small>稳定 ID：{selected?.key ?? '—'}</small>
            </div>

            <label
              className="attachment-dropzone"
              htmlFor="cell-attachment-input"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                actionsRef.current?.addAttachments([
                  ...event.dataTransfer.files,
                ]);
              }}
            >
              <Upload size={20} />
              <strong>拖放文件到此处，或点击选择</strong>
              <span>
                图片、PDF、Word、Excel · 单文件不超过{' '}
                {formatFileSize(MAX_ATTACHMENT_SIZE)}
              </span>
              <input
                id="cell-attachment-input"
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                onChange={(event) => {
                  actionsRef.current?.addAttachments([
                    ...(event.currentTarget.files ?? []),
                  ]);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <div className="attachment-list" aria-live="polite">
              <div className="attachment-list-heading">
                <b>已添加附件</b>
                <span>{selectedAttachments.length}/10</span>
              </div>
              {selectedAttachments.length ? (
                selectedAttachments.map((attachment) => (
                  <article key={attachment.id}>
                    <FileText size={18} />
                    <div>
                      <b title={attachment.name}>{attachment.name}</b>
                      <span>
                        {formatFileSize(attachment.size)} ·{' '}
                        {new Date(attachment.createdAt).toLocaleString(
                          'zh-CN',
                          {
                            hour12: false,
                          },
                        )}
                      </span>
                    </div>
                    <div className="attachment-file-actions">
                      {canPreviewAttachment(
                        attachment.mimeType,
                        attachment.name,
                      ) && (
                        <a
                          href={attachment.objectUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`预览 ${attachment.name}`}
                          title="预览附件"
                        >
                          <Eye size={14} />
                        </a>
                      )}
                      <a
                        href={attachment.objectUrl}
                        download={attachment.name}
                        aria-label={`下载 ${attachment.name}`}
                        title="下载附件"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        type="button"
                        aria-label={`删除 ${attachment.name}`}
                        title="删除附件"
                        onClick={() =>
                          actionsRef.current?.removeAttachment(attachment.id)
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="attachment-empty">
                  <Paperclip size={18} />
                  <span>当前单元格还没有附件</span>
                </div>
              )}
            </div>
            <p className="helper-text">
              添加后，单元格右侧会显示回形针标记；点击标记可再次打开附件列表。
              Demo 使用浏览器内存保存文件，刷新页面后会清空。
            </p>
          </Drawer>
        )}

        {panel === 'aggregate' && (
          <Drawer
            title="选区自定义统计"
            subtitle={`${selectionStats.cells.toLocaleString(
              'zh-CN',
            )} 个单元格`}
            onClose={() => setPanel(null)}
          >
            <div className="aggregate-modes">
              {AGGREGATE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={aggregateMode === mode}
                  className={aggregateMode === mode ? 'active' : ''}
                  onClick={() => setAggregateMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            {aggregateMode === 'CUSTOM' && (
              <label className="custom-formula">
                受控自定义表达式
                <select
                  value={customFormula}
                  onChange={(event) => setCustomFormula(event.target.value)}
                >
                  <option>SUM / COUNT</option>
                  <option>(MAX + MIN) / 2</option>
                </select>
              </label>
            )}
            <div className="aggregate-result">
              <span>
                {aggregateMode === 'CUSTOM' ? customFormula : aggregateMode}
              </span>
              <strong>
                {aggregateValue == null
                  ? '—'
                  : aggregateMode === 'COUNT'
                  ? aggregateValue.toLocaleString('zh-CN')
                  : formatStatistic(
                      aggregateValue,
                      selectionStats.numericDisplay,
                    )}
              </strong>
            </div>
            <div className="stats-grid">
              <div>
                <span>参与计算</span>
                <b>{selectionStats.numeric.toLocaleString('zh-CN')}</b>
              </div>
              <div>
                <span>忽略空值 / 非数值</span>
                <b>{selectionStats.ignored.toLocaleString('zh-CN')}</b>
              </div>
              <div>
                <span>最小值</span>
                <b>
                  {selectionStats.numeric
                    ? formatStatistic(
                        selectionStats.min,
                        selectionStats.numericDisplay,
                      )
                    : '—'}
                </b>
              </div>
              <div>
                <span>最大值</span>
                <b>
                  {selectionStats.numeric
                    ? formatStatistic(
                        selectionStats.max,
                        selectionStats.numericDisplay,
                      )
                    : '—'}
                </b>
              </div>
            </div>
            {selectionStats.truncated && (
              <p className="warning-note">
                超大选区仅计算前 200,000 个单元格，避免阻塞主线程。
              </p>
            )}
          </Drawer>
        )}

        {panel === 'features' && (
          <Drawer
            title={`${FEATURES.length} 项能力验收`}
            subtitle="截图需求逐项映射"
            onClose={() => setPanel(null)}
          >
            <div className="feature-list">
              {FEATURES.map(([feature, implementation], index) => (
                <div key={`${feature}-${implementation}`}>
                  <i>{index + 1}</i>
                  <span>{feature}</span>
                  <b>{implementation}</b>
                  <CheckCircle2 size={15} />
                </div>
              ))}
            </div>
            <div className="license-note">
              <Info size={16} />
              <p>
                <b>许可说明</b>
                <br />
                未配置生产许可证时，SpreadJS 评估版仅适合
                localhost，并显示评估水印。正式部署前请设置{' '}
                <code>NEXT_PUBLIC_SPREADJS_LICENSE_KEY</code>。
              </p>
            </div>
          </Drawer>
        )}

        {toast && <ToastMessage toast={toast} />}
      </main>
    </div>
  );
}
