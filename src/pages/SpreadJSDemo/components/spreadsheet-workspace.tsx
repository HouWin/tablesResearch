import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LockKeyhole,
} from 'lucide-react';
import {
  canDrillNode,
  getCellEditability,
  pathForView,
} from '../spreadsheet/model';
import type { SpreadsheetController } from '../spreadsheet/use-spreadsheet-controller';
import { OutlineControls } from './outline-controls';
import { SheetStatusBar } from './spreadsheet-ui';

export function SpreadsheetWorkspace({
  controller,
}: {
  controller: SpreadsheetController;
}) {
  const {
    actionsRef,
    hostRef,
    ready,
    initializationError,
    retryInitialization,
    view,
    dataMode,
    selected,
    selectionStats,
    outlineSnapshot,
    datasetLabel,
    tableBusy,
  } = controller;
  const canDrillSelected =
    dataMode === 'regular' && canDrillNode(selected?.node);
  const selectedEditability = selected
    ? getCellEditability(selected.node, selected.col)
    : null;

  return (
    <section
      id="spreadsheet-workspace"
      className="work-area"
      aria-label="费用预算工作区"
      tabIndex={-1}
    >
      <div className="sheet-card">
        <div className="crumb-row">
          <nav aria-label="数据钻取路径">
            {pathForView(view).map((crumb, index, crumbs) => (
              <span key={`${index}-${crumb}`}>
                <button
                  type="button"
                  disabled={tableBusy || dataMode !== 'regular'}
                  aria-current={
                    index === crumbs.length - 1 ? 'page' : undefined
                  }
                  className={index === crumbs.length - 1 ? 'current' : ''}
                  onClick={() =>
                    actionsRef.current?.setView(view.slice(0, index))
                  }
                >
                  {crumb}
                </button>
                {index < crumbs.length - 1 ? <ChevronRight size={12} /> : null}
              </span>
            ))}
          </nav>
          <div className="drill-actions" aria-label="层级钻取操作">
            {view.length > 0 ? (
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
            ) : null}
            <button
              className="drill-button"
              type="button"
              disabled={tableBusy || !canDrillSelected}
              onClick={() => actionsRef.current?.drillSelected()}
              title={
                canDrillSelected
                  ? '查看所选行的下一级数据'
                  : '请先选择具有下级数据的汇总行'
              }
            >
              下钻所选行
              <ChevronRight size={13} />
            </button>
          </div>
          <small>
            {dataMode === 'stress'
              ? '单击层级单元格展开或收起；搜索会自动展开命中路径'
              : '单击层级单元格展开或收起；选中汇总行可下钻；右键查看更多操作'}
          </small>
        </div>

        <OutlineControls
          snapshot={outlineSnapshot}
          dataMode={dataMode}
          disabled={tableBusy}
          onSetAll={(dimension, expanded) =>
            actionsRef.current?.setOutlineDimension(dimension, expanded)
          }
          onReset={() => actionsRef.current?.resetOutline()}
        />

        <div
          className="formula-bar"
          role="region"
          aria-label="当前单元格"
          aria-live="polite"
        >
          <span className="name-box">{selected?.a1 ?? 'A1'}</span>
          <span className="fx" aria-hidden="true">
            fx
          </span>
          <span className="formula-value">
            {selected?.text || '选择单元格查看内容'}
          </span>
          {selectedEditability && !selectedEditability.editable ? (
            <span
              className="cell-readonly-badge"
              title={selectedEditability.reason}
            >
              <LockKeyhole size={10} />
              只读
            </span>
          ) : null}
          <span className="selected-field">
            {selected?.node.name ?? '—'} · {selected?.fieldLabel ?? '—'}
          </span>
        </div>

        <div className="spread-host-wrap" aria-busy={tableBusy}>
          <div
            ref={hostRef}
            className="spread-host"
            role="application"
            aria-label="费用预算电子表格"
          />
          {!ready && !initializationError ? (
            <div className="table-state-overlay" role="status">
              <i />
              <strong>正在初始化电子表格</strong>
              <span>首次加载表格引擎可能需要几秒钟</span>
            </div>
          ) : null}
          {ready && dataMode === 'loading' ? (
            <div className="table-state-overlay" role="status">
              <i />
              <strong>正在生成 10 万行压力数据</strong>
              <span>表格会分批渲染，页面仍会保持响应</span>
            </div>
          ) : null}
          {initializationError ? (
            <div className="table-state-overlay table-state-error" role="alert">
              <CircleAlert size={22} />
              <strong>{initializationError}</strong>
              <span>可以重试初始化，无需刷新整个页面</span>
              <button type="button" onClick={retryInitialization}>
                重新初始化
              </button>
            </div>
          ) : null}
        </div>

        <SheetStatusBar
          selectionStats={selectionStats}
          dataMode={dataMode}
          datasetLabel={datasetLabel}
        />
      </div>
    </section>
  );
}
