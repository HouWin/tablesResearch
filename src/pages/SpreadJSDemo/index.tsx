import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Database,
  Gauge,
  GitBranch,
  History,
  Info,
  MessageSquareText,
  Paperclip,
  Redo2,
  Search,
  Settings2,
  Sigma,
  Trash2,
  Undo2,
} from "lucide-react";
import "@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css";
import "./index.less";
import {
  ColumnVisibilityPopover,
  DemoHeader,
  Drawer,
  SearchPopover,
  SheetStatusBar,
  ToastMessage,
} from "./components/spreadsheet-ui";
import {
  AGGREGATE_MODES,
  FEATURES,
  canDrillNode,
  displayValue,
  formatMoney,
  formatStatistic,
  pathForView,
} from "./spreadsheet/model";
import { useSpreadsheetController } from "./spreadsheet/use-spreadsheet-controller";
export default function Home() {
  const {
    hostRef,
    actionsRef,
    ready,
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
    setCommentDraft,
    selectedHistory,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResult,
    setSearchResult,
    columnMenuOpen,
    setColumnMenuOpen,
    columnVisibility,
    rowGroupsCollapsed,
    columnGroupsCollapsed,
    toast,
    datasetLabel,
    openPanel,
    tableBusy,
    aggregateValue,
  } = useSpreadsheetController();
  const canDrillSelected = canDrillNode(selected?.node);

  return (
    <div className="spreadjs-demo-page">
    <main className="demo-shell">
      <DemoHeader ready={ready} onOpenFeatures={() => openPanel("features")} />

      <section className="demo-toolbar" aria-label="表格工具栏">
        <div className="toolbar-group">
          <button type="button" disabled={tableBusy} onClick={() => actionsRef.current?.undo()} title="撤销单元格编辑"><Undo2 size={16} /><span>撤销</span></button>
          <button type="button" disabled={tableBusy} onClick={() => actionsRef.current?.redo()} title="重做单元格编辑"><Redo2 size={16} /><span>重做</span></button>
          <button type="button" disabled={tableBusy} onClick={() => actionsRef.current?.copy()} title="复制矩形选区"><Copy size={16} /><span>复制选区</span></button>
        </div>

        <div className="toolbar-separator" aria-hidden="true" />
        <div className="toolbar-popover-anchor">
          <button type="button" disabled={tableBusy} aria-label="快速搜索" aria-expanded={searchOpen} aria-controls="sheet-search-popover" className={searchOpen ? "is-active" : ""} onClick={() => { setSearchOpen((open) => !open); setColumnMenuOpen(false); }}><Search size={16} /><span>快速搜索</span></button>
          {searchOpen && (
            <SearchPopover
              query={searchQuery}
              result={searchResult}
              onQueryChange={(query) => {
                setSearchQuery(query);
                setSearchResult(query.trim() ? "按 Enter 查找下一个，Shift + Enter 查找上一个" : "输入关键词后定位");
              }}
              onSearch={(direction) => actionsRef.current?.search(searchQuery, direction)}
            />
          )}
        </div>

        <div className="toolbar-popover-anchor">
          <button type="button" disabled={tableBusy} aria-label="列管理" aria-expanded={columnMenuOpen} aria-controls="column-visibility-popover" className={columnMenuOpen ? "is-active" : ""} onClick={() => { setColumnMenuOpen((open) => !open); setSearchOpen(false); }}><Columns3 size={16} /><span>列管理</span><ChevronDown size={13} /></button>
          {columnMenuOpen && (
            <ColumnVisibilityPopover visibility={columnVisibility} onToggle={(column, visible) => actionsRef.current?.toggleColumn(column, visible)} />
          )}
        </div>

        <button type="button" disabled={tableBusy} aria-label={rowGroupsCollapsed ? "展开全部行组" : "收起全部行组"} onClick={() => actionsRef.current?.toggleRowGroups()} className={rowGroupsCollapsed ? "is-active" : ""}><Settings2 size={16} /><span>{rowGroupsCollapsed ? "展开全部行组" : "收起全部行组"}</span></button>
        <button type="button" disabled={tableBusy} aria-label={columnGroupsCollapsed ? "展开全部列组" : "收起全部列组"} onClick={() => actionsRef.current?.toggleColumnGroups()} className={columnGroupsCollapsed ? "is-active" : ""}><Columns3 size={16} /><span>{columnGroupsCollapsed ? "展开全部列组" : "收起全部列组"}</span></button>
        <button type="button" disabled={tableBusy} aria-label="适配全部列宽" onClick={() => actionsRef.current?.autoFit()}><Gauge size={16} /><span>适配列宽</span></button>

        <div className="toolbar-separator" aria-hidden="true" />
        <button type="button" disabled={tableBusy} aria-label="自定义统计" onClick={() => openPanel("aggregate")}><Sigma size={16} /><span>自定义统计</span></button>
        <button type="button" disabled={tableBusy} aria-label="单元格批注" onClick={() => openPanel("comment")}><MessageSquareText size={16} /><span>批注</span></button>
        <button type="button" disabled={tableBusy} aria-label="单元格历史" onClick={() => openPanel("history")}><History size={16} /><span>历史</span></button>
        <button type="button" disabled={tableBusy} aria-label="数据追踪" onClick={() => openPanel("lineage")}><GitBranch size={16} /><span>数据追踪</span></button>
        <button type="button" disabled={tableBusy} aria-label="单元格附件" onClick={() => openPanel("attachment")}><Paperclip size={16} /><span>附件</span></button>

        <div className="toolbar-spacer" />
        <button type="button" aria-label={dataMode === "stress" ? "恢复常规数据" : "载入10万行模式"} className={dataMode === "stress" ? "stress-active" : ""} disabled={tableBusy} onClick={() => actionsRef.current?.loadDataMode(dataMode === "stress" ? "regular" : "stress")}>
          <Database size={16} /><span>{dataMode === "loading" ? "载入中…" : dataMode === "stress" ? "恢复常规" : "10 万行模式"}</span>
        </button>
      </section>

      <section className="work-area">
        <div className="sheet-card">
          <div className="crumb-row">
            <nav aria-label="数据钻取路径">
              {pathForView(view).map((crumb, index, crumbs) => (
                <span key={`${index}-${crumb}`}>
                  <button type="button" disabled={tableBusy} className={index === crumbs.length - 1 ? "current" : ""} onClick={() => actionsRef.current?.setView(view.slice(0, index))}>{crumb}</button>
                  {index < crumbs.length - 1 && <ChevronRight size={12} />}
                </span>
              ))}
            </nav>
            <div className="drill-actions" aria-label="层级钻取操作">
              {view.length > 0 && <button className="up-button" type="button" disabled={tableBusy} onClick={() => actionsRef.current?.up()} title="返回上一级"><ChevronLeft size={13} />上钻</button>}
              <button className="drill-button" type="button" disabled={tableBusy || !canDrillSelected} onClick={() => actionsRef.current?.drillSelected()} title={canDrillSelected ? "查看所选行的下一级数据" : "当前行没有下级数据"}>下钻所选行<ChevronRight size={13} /></button>
            </div>
            <small>单击层级箭头展开 / 收起 · 双击指标单元格下钻 · 右键打开业务菜单</small>
          </div>

          <div className="formula-bar">
            <span className="name-box">{selected?.a1 ?? "A1"}</span>
            <span className="fx">fx</span>
            <span className="formula-value">{selected?.text || "选择单元格查看内容"}</span>
            <span className="selected-field">{selected?.node.name ?? "—"} · {selected?.fieldLabel ?? "—"}</span>
          </div>

          <div ref={hostRef} className="spread-host" aria-label="经营数据电子表格" aria-busy={tableBusy} />

          <SheetStatusBar selectionStats={selectionStats} dataMode={dataMode} datasetLabel={datasetLabel} />
        </div>
      </section>

      {panel === "comment" && (
        <Drawer title="单元格批注" subtitle={`${selected?.a1 ?? "—"} · ${selected?.node.name ?? "未选择"}`} onClose={() => setPanel(null)}>
          <div className="selected-card"><span>{selected?.fieldLabel}</span><strong>{selected?.text || "空单元格"}</strong><small>稳定 ID：{selected?.key}</small></div>
          <label className="field-label" htmlFor="comment-text">批注内容</label>
          <textarea id="comment-text" className="comment-input" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="输入一条简单批注…" />
          <div className="drawer-actions">
            <button className="danger-button" type="button" disabled={!commentExists} onClick={() => actionsRef.current?.deleteComment()}><Trash2 size={14} />删除</button>
            <button className="primary-button" type="button" disabled={!commentDraft.trim()} onClick={() => actionsRef.current?.saveComment(commentDraft)}>保存批注</button>
          </div>
          <p className="helper-text">批注使用 rowId + columnId 关联；切换钻取层级后仍会回到正确记录。</p>
        </Drawer>
      )}

      {panel === "history" && (
        <Drawer title="单元格历史" subtitle={`${selected?.a1 ?? "—"} · ${selected?.fieldLabel ?? "未选择"}`} onClose={() => setPanel(null)}>
          <div className="selected-card"><span>{selected?.node.name}</span><strong>{selected?.text || "空单元格"}</strong><small>仅记录值修改，不记录排序、筛选、折叠或列宽。</small></div>
          <div className="history-list">
            {selectedHistory.length ? selectedHistory.map((item) => (
              <article key={item.id}>
                <div><span>{item.source}</span><time>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</time></div>
                <p><del>{displayValue(item.oldValue)}</del><ChevronRight size={13} /><strong>{displayValue(item.newValue)}</strong></p>
              </article>
            )) : <div className="empty-state"><History size={22} /><b>暂无值变化</b><span>编辑当前单元格后，历史会立即记录。</span></div>}
          </div>
        </Drawer>
      )}

      {panel === "lineage" && (
        <Drawer title="数据追踪" subtitle={`${selected?.node.name ?? "—"} · ${selected?.fieldLabel ?? "未选择"}`} onClose={() => setPanel(null)}>
          {selected && ["revenue", "avgOrder", "completion"].includes(selected.field) ? (
            <div className="lineage-tree">
              <div className="lineage-result"><span>当前结果</span><strong>{selected.field === "completion" ? `${(selected.node.completion * 100).toFixed(1)}%` : formatMoney(Number(selected.value))}</strong><small>{selected.field === "revenue" ? "商品收入 + 服务收入" : selected.field === "avgOrder" ? "净收入 ÷ 订单数" : "实际完成额 ÷ 目标额"}</small></div>
              <div className="tree-connector" />
              <div className="lineage-rule"><Calculator size={16} /><div><b>计算规则</b><span>{selected.field === "revenue" ? "SUM(商品收入, 服务收入)" : selected.field === "avgOrder" ? "DIVIDE(净收入, 订单数)" : "DIVIDE(实际, 目标)"}</span><small>过滤：核验状态 ≠ 异常 · 空值：忽略 · 币种：CNY</small></div></div>
              <div className="tree-connector split" />
              <div className="source-grid">
                <div><span>{selected.field === "avgOrder" ? "净收入" : "商品收入"}</span><b>{formatMoney(selected.field === "avgOrder" ? selected.node.revenue : selected.node.productRevenue)}</b><small>业务日报 · {selected.node.id}</small></div>
                <div><span>{selected.field === "avgOrder" ? "订单数" : "服务收入"}</span><b>{selected.field === "avgOrder" ? selected.node.orders.toLocaleString("zh-CN") : formatMoney(selected.node.serviceRevenue)}</b><small>订单明细 · 去重后</small></div>
              </div>
              <button className="source-jump" type="button" onClick={() => actionsRef.current?.drillSelected()}>跳转到来源明细<ChevronRight size={14} /></button>
            </div>
          ) : (
            <div className="raw-source"><Database size={24} /><h3>原始字段，无上游计算</h3><p>来源记录：{selected?.node.id ?? "—"}<br />来源字段：{selected?.field ?? "—"}<br />原始值：{selected?.text || "—"}</p></div>
          )}
        </Drawer>
      )}

      {panel === "attachment" && (
        <Drawer title="单元格附件" subtitle={`${selected?.node.name ?? "—"} · ${selected?.a1 ?? "未选择"}`} onClose={() => setPanel(null)}>
          <div className="attachment-hero"><Paperclip size={22} /><div><b>SpreadJS FileUpload 单元格</b><span>支持选择、预览、下载和清除文件</span></div></div>
          <dl className="detail-list">
            <div><dt>允许类型</dt><dd>图片、PDF、Word、Excel</dd></div>
            <div><dt>单文件上限</dt><dd>5 MB</dd></div>
            <div><dt>关联方式</dt><dd>{selected?.node.id ?? "rowId"}::attachment</dd></div>
            <div><dt>当前状态</dt><dd>{selected?.field === "attachment" && selected.value ? "已添加附件" : "未添加"}</dd></div>
          </dl>
          <button className="primary-button full-width" type="button" onClick={() => actionsRef.current?.focusAttachment()}>定位到附件单元格</button>
          <p className="helper-text">点击单元格内的上传图标选择文件；上传、预览、下载和清除按钮由 SpreadJS 原生单元格类型提供。</p>
        </Drawer>
      )}

      {panel === "aggregate" && (
        <Drawer title="选区自定义统计" subtitle={`${selectionStats.cells.toLocaleString("zh-CN")} 个单元格`} onClose={() => setPanel(null)}>
          <div className="aggregate-modes">
            {AGGREGATE_MODES.map((mode) => <button key={mode} type="button" aria-pressed={aggregateMode === mode} className={aggregateMode === mode ? "active" : ""} onClick={() => setAggregateMode(mode)}>{mode}</button>)}
          </div>
          {aggregateMode === "CUSTOM" && (
            <label className="custom-formula">受控自定义表达式<select value={customFormula} onChange={(event) => setCustomFormula(event.target.value)}><option>SUM / COUNT</option><option>(MAX + MIN) / 2</option></select></label>
          )}
          <div className="aggregate-result"><span>{aggregateMode === "CUSTOM" ? customFormula : aggregateMode}</span><strong>{aggregateValue == null ? "—" : aggregateMode === "COUNT" ? aggregateValue.toLocaleString("zh-CN") : formatStatistic(aggregateValue, selectionStats.numericDisplay)}</strong></div>
          <div className="stats-grid">
            <div><span>参与计算</span><b>{selectionStats.numeric.toLocaleString("zh-CN")}</b></div>
            <div><span>忽略空值 / 非数值</span><b>{selectionStats.ignored.toLocaleString("zh-CN")}</b></div>
            <div><span>最小值</span><b>{selectionStats.numeric ? formatStatistic(selectionStats.min, selectionStats.numericDisplay) : "—"}</b></div>
            <div><span>最大值</span><b>{selectionStats.numeric ? formatStatistic(selectionStats.max, selectionStats.numericDisplay) : "—"}</b></div>
          </div>
          {selectionStats.truncated && <p className="warning-note">超大选区仅计算前 200,000 个单元格，避免阻塞主线程。</p>}
        </Drawer>
      )}

      {panel === "features" && (
        <Drawer title={`${FEATURES.length} 项能力验收`} subtitle="截图需求逐项映射" onClose={() => setPanel(null)}>
          <div className="feature-list">
            {FEATURES.map(([feature, implementation], index) => (
              <div key={`${feature}-${implementation}`}><i>{index + 1}</i><span>{feature}</span><b>{implementation}</b><CheckCircle2 size={15} /></div>
            ))}
          </div>
          <div className="license-note"><Info size={16} /><p><b>许可说明</b><br />未配置生产许可证时，SpreadJS 评估版仅适合 localhost，并显示评估水印。正式部署前请设置 <code>NEXT_PUBLIC_SPREADJS_LICENSE_KEY</code>。</p></div>
        </Drawer>
      )}

      {toast && <ToastMessage toast={toast} />}
    </main>
    </div>
  );
}
