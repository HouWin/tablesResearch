import {
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileText,
  History,
  Info,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef } from 'react';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_CELL,
  MAX_ATTACHMENT_SIZE,
  canPreviewAttachment,
  formatFileSize,
} from '../spreadsheet/attachments';
import { MAX_SELECTION_INSPECTION_CELLS } from '../spreadsheet/constants';
import {
  AGGREGATE_MODES,
  FEATURES,
  displayValue,
  formatStatistic,
} from '../spreadsheet/model';
import { getLineageDetails } from '../spreadsheet/presentation';
import type { SpreadsheetController } from '../spreadsheet/use-spreadsheet-controller';
import { Drawer } from './spreadsheet-ui';

const AGGREGATE_LABELS = {
  SUM: '求和',
  AVG: '平均值',
  COUNT: '计数',
  MIN: '最小值',
  MAX: '最大值',
  CUSTOM: '自定义',
} as const;

export function InspectorPanels({
  controller,
  canDrillSelected,
  licenseConfigured,
}: {
  controller: SpreadsheetController;
  canDrillSelected: boolean;
  licenseConfigured: boolean;
}) {
  const {
    actionsRef,
    panel,
    setPanel,
    selected,
    selectionStats,
    aggregateMode,
    setAggregateMode,
    customFormula,
    setCustomFormula,
    aggregateValue,
    commentDraft,
    commentExists,
    commentDirty,
    setCommentDraft,
    selectedAttachments,
    selectedHistory,
  } = controller;
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const lineageDetails = getLineageDetails(selected);
  const close = () => setPanel(null);

  if (!panel) return null;

  if (panel === 'comment') {
    return (
      <Drawer
        title="单元格批注"
        subtitle={`${selected?.a1 ?? '—'} · ${selected?.node.name ?? '未选择'}`}
        onClose={close}
        initialFocusRef={commentInputRef}
      >
        <div className="selected-card">
          <span>{selected?.fieldLabel ?? '未选择字段'}</span>
          <strong>{selected?.text || '空单元格'}</strong>
          <small>已与当前业务记录稳定关联</small>
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
          批注使用行与列的稳定业务 ID 关联；切换钻取层级后仍会回到正确记录。
        </p>
      </Drawer>
    );
  }

  if (panel === 'history') {
    return (
      <Drawer
        title="单元格历史"
        subtitle={`${selected?.a1 ?? '—'} · ${
          selected?.fieldLabel ?? '未选择'
        }`}
        onClose={close}
      >
        <div className="selected-card">
          <span>{selected?.node.name ?? '未选择记录'}</span>
          <strong>{selected?.text || '空单元格'}</strong>
          <small>
            已记录 {selectedHistory.length}{' '}
            次变化；覆盖编辑、粘贴、清空、撤销与重做。
          </small>
        </div>
        <div className="history-list">
          {selectedHistory.length ? (
            selectedHistory.map((item) => (
              <article key={item.id}>
                <div>
                  <span>{item.source}</span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>
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
              <span>编辑、粘贴或清空当前单元格后，历史会立即记录。</span>
            </div>
          )}
        </div>
      </Drawer>
    );
  }

  if (panel === 'lineage') {
    return (
      <Drawer
        title="数据追踪"
        subtitle={`${selected?.node.name ?? '—'} · ${
          selected?.fieldLabel ?? '未选择'
        }`}
        onClose={close}
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
              <Database size={16} />
              <div>
                <b>数据规则</b>
                <span>{lineageDetails.rule}</span>
                <small>编辑仅提交当前字段；刷新与最终值以后端响应为准</small>
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
    );
  }

  if (panel === 'attachment') {
    return (
      <Drawer
        title="单元格附件"
        subtitle={`${selected?.a1 ?? '未选择'} · ${
          selectedAttachments.length
        } 个附件`}
        onClose={close}
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
          <small>附件不会改变当前单元格的业务值</small>
        </div>

        <label
          className="attachment-dropzone"
          htmlFor="cell-attachment-input"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            actionsRef.current?.addAttachments([...event.dataTransfer.files]);
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
            <span>
              {selectedAttachments.length}/{MAX_ATTACHMENTS_PER_CELL}
            </span>
          </div>
          {selectedAttachments.length ? (
            selectedAttachments.map((attachment) => (
              <article key={attachment.id}>
                <FileText size={18} />
                <div>
                  <b title={attachment.name}>{attachment.name}</b>
                  <span>
                    {formatFileSize(attachment.size)} ·{' '}
                    {new Date(attachment.createdAt).toLocaleString('zh-CN', {
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className="attachment-file-actions">
                  {canPreviewAttachment(
                    attachment.mimeType,
                    attachment.name,
                  ) ? (
                    <a
                      href={attachment.objectUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`预览 ${attachment.name}`}
                      title="预览附件"
                    >
                      <Eye size={14} />
                    </a>
                  ) : null}
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
          本演示使用浏览器内存保存文件，刷新页面后会清空。
        </p>
      </Drawer>
    );
  }

  if (panel === 'aggregate') {
    return (
      <Drawer
        title="选区自定义统计"
        subtitle={`${selectionStats.cells.toLocaleString('zh-CN')} 个单元格`}
        onClose={close}
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
              {AGGREGATE_LABELS[mode]}
            </button>
          ))}
        </div>
        {aggregateMode === 'CUSTOM' ? (
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
        ) : null}
        <div className="aggregate-result">
          <span>
            {aggregateMode === 'CUSTOM' ? customFormula : aggregateMode}
          </span>
          <strong>
            {aggregateValue == null
              ? '—'
              : aggregateMode === 'COUNT'
              ? aggregateValue.toLocaleString('zh-CN')
              : formatStatistic(aggregateValue, selectionStats.numericDisplay)}
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
        {selectionStats.truncated ? (
          <p className="warning-note">
            超大选区仅计算前{' '}
            {MAX_SELECTION_INSPECTION_CELLS.toLocaleString('zh-CN')}{' '}
            个单元格，避免阻塞主线程。
          </p>
        ) : null}
      </Drawer>
    );
  }

  return (
    <Drawer
      title={`${FEATURES.length} 项能力清单`}
      subtitle="关键业务场景可直接验收"
      onClose={close}
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
      <div
        className={`license-note${licenseConfigured ? ' is-configured' : ''}`}
      >
        {licenseConfigured ? <CheckCircle2 size={16} /> : <Info size={16} />}
        <p>
          <b>{licenseConfigured ? '许可证已配置' : '当前为评估许可'}</b>
          <br />
          {licenseConfigured ? (
            '页面已读取 SpreadJS 许可证环境变量。'
          ) : (
            <>
              未配置生产许可证时仅适合
              localhost，并会显示评估水印。正式部署前请设置{' '}
              <code>UMI_APP_SPREADJS_LICENSE_KEY</code>。
            </>
          )}
        </p>
      </div>
    </Drawer>
  );
}
