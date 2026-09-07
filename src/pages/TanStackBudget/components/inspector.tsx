import { useEffect, useState } from 'react';
import { Download, FileText, Paperclip, Trash2, X } from 'lucide-react';
import { toBusinessCellDimension } from '../../SpreadJSDemo/spreadsheet/business-cell-coordinate';
import { ATTACHMENT_ACCEPT } from '../../SpreadJSDemo/spreadsheet/attachments';
import {
  COLUMNS,
  columnLabel,
  formattedValue,
  rawValue,
} from '../core/columns';
import type { BudgetController } from '../core/use-budget-controller';

const TITLES = {
  comment: '单元格批注',
  history: '修改历史',
  attachment: '单元格附件',
  lineage: '数据追踪',
  aggregate: '选区统计',
  help: '使用指南',
};
export function Inspector({ controller: c }: { controller: BudgetController }) {
  const [comment, setComment] = useState('');
  const [formula, setFormula] = useState('SUM / COUNT');
  useEffect(
    () => setComment(c.comments.get(c.selectedKey) ?? ''),
    [c.selectedKey, c.comments],
  );
  if (!c.panel) return null;
  const row = c.selectedRow;
  const dimension = row
    ? toBusinessCellDimension(row, c.range.focus.col)
    : null;
  const files = c.attachments.get(c.selectedKey) ?? [];
  const stats = c.statistics;
  const customValue =
    formula === '(MAX + MIN) / 2'
      ? (stats.max + stats.min) / 2
      : formula === 'SUM - MAX - MIN'
      ? stats.sum - stats.max - stats.min
      : stats.average;
  return (
    <aside
      className="tb-inspector"
      aria-label={TITLES[c.panel]}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          c.setPanel(null);
          c.gridRef.current?.focus();
        }
      }}
    >
      <div className="tb-inspector-heading">
        <div>
          <h2>{TITLES[c.panel]}</h2>
          <p>
            {c.panel === 'help'
              ? '快捷操作与数据说明'
              : `${c.selectedAddress} · ${columnLabel(c.range.focus.col)}`}
          </p>
        </div>
        <button
          className="tb-icon-button"
          aria-label="关闭侧栏"
          onClick={() => {
            c.setPanel(null);
            c.gridRef.current?.focus();
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="tb-inspector-content">
        {c.panel === 'comment' ? (
          <>
            <label className="tb-label" htmlFor="budget-comment">
              为这条预算补充说明
            </label>
            <textarea
              id="budget-comment"
              value={comment}
              maxLength={4000}
              rows={7}
              onChange={(event) => setComment(event.target.value)}
              placeholder="例如：本月增加的研发设备采购预算…"
            />
            <div className="tb-panel-actions">
              <button
                className="tb-primary"
                disabled={!row}
                onClick={() => c.saveComment(comment)}
              >
                保存批注
              </button>
              <button
                disabled={!c.comments.has(c.selectedKey)}
                onClick={() => {
                  c.saveComment('');
                  setComment('');
                }}
              >
                删除批注
              </button>
            </div>
            <p className="tb-muted">
              批注按业务单元格关联，展开、折叠和滚动后仍保留。本演示的批注在刷新后清空。
            </p>
          </>
        ) : null}
        {c.panel === 'history' ? (
          c.selectedHistory.length ? (
            <ol className="tb-history">
              {c.selectedHistory.map((item) => (
                <li key={`${item.id}/${item.col}`}>
                  <b>{item.source}</b>
                  <time>
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </time>
                  <div>
                    <del>{item.beforeFormula || String(item.before)}</del>
                    <span>→</span>
                    <strong>{item.afterFormula || String(item.after)}</strong>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="tb-empty">
              <FileText size={30} />
              <p>这个单元格还没有修改记录</p>
              <small>编辑、粘贴、填充、清空、撤销和重做都会记录。</small>
            </div>
          )
        ) : null}
        {c.panel === 'attachment' ? (
          <>
            <label className="tb-upload">
              <Paperclip size={24} />
              <strong>选择或拖入附件</strong>
              <span>图片、PDF、Word、Excel · 单个不超过 5 MiB</span>
              <input
                aria-label="添加附件"
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                onChange={(event) => {
                  c.addAttachments(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
            </label>
            <div
              className="tb-attachment-list"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                c.addAttachments(Array.from(event.dataTransfer.files));
              }}
            >
              {files.map((file) => (
                <article key={file.id} className="tb-attachment">
                  {file.mimeType.startsWith('image/') ? (
                    <img src={file.objectUrl} alt={file.name} />
                  ) : (
                    <FileText size={30} />
                  )}
                  <div>
                    <strong title={file.name}>{file.name}</strong>
                    <small>{(file.size / 1024).toFixed(1)} KB</small>
                  </div>
                  <a
                    href={file.objectUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`预览 ${file.name}`}
                  >
                    预览
                  </a>
                  <a
                    href={file.objectUrl}
                    download={file.name}
                    aria-label={`下载 ${file.name}`}
                  >
                    <Download size={15} />
                  </a>
                  <button
                    aria-label={`删除 ${file.name}`}
                    onClick={() => c.removeAttachment(file.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
              {!files.length ? (
                <p className="tb-muted">
                  还没有附件。每个单元格最多可添加 10 个。
                </p>
              ) : null}
            </div>
            <p className="tb-muted">附件仅保存在当前页面会话中，刷新后清空。</p>
          </>
        ) : null}
        {c.panel === 'lineage' ? (
          row ? (
            <>
              <div className="tb-value-card">
                <span>当前值</span>
                <strong>
                  {formattedValue(
                    rawValue(row, c.range.focus.col),
                    COLUMNS[c.range.focus.col],
                  )}
                </strong>
              </div>
              <dl className="tb-details">
                <dt>组织</dt>
                <dd>{row.productLabel}</dd>
                <dt>科目</dt>
                <dd>{row.regionLabel}</dd>
                <dt>后台记录 ID</dt>
                <dd>{row.sourceNodes[0].id}</dd>
                <dt>后台字段</dt>
                <dd>{COLUMNS[c.range.focus.col].field}</dd>
                <dt>数据规则</dt>
                <dd>汇总与明细分别保存，不自动重算或分摊。</dd>
              </dl>
              {row.formulas[COLUMNS[c.range.focus.col].id] ? (
                <p className="tb-formula-info">
                  公式：{row.formulas[COLUMNS[c.range.focus.col].id]}
                  <br />
                  引用绑定公式录入时的业务记录。
                </p>
              ) : null}
              <label className="tb-label">业务坐标</label>
              <pre>
                {JSON.stringify(
                  dimension ?? {
                    row: row.rowDimension,
                    attribute:
                      COLUMNS[c.range.focus.col].type === 'attr'
                        ? { code: 'ATTR000038', ownerDimensionCode: 'DIM0069' }
                        : '行维度展示列',
                  },
                  null,
                  2,
                )}
              </pre>
            </>
          ) : (
            <p>正在加载单元格…</p>
          )
        ) : null}
        {c.panel === 'aggregate' ? (
          <>
            <p className="tb-muted">按完整选区计算，包含未加载到页面的记录。</p>
            {c.statisticsBusy ? (
              <p role="status">正在计算…</p>
            ) : c.statisticsError ? (
              <div role="alert">
                {c.statisticsError}
                <button onClick={c.retryStatistics}>重试</button>
              </div>
            ) : (
              <>
                <div className="tb-stat-list">
                  {[
                    ['单元格', stats.cells],
                    ['数字个数', stats.numeric],
                    ['合计 SUM', stats.sum],
                    ['平均值 AVG', stats.average],
                    ['最小值 MIN', stats.min],
                    ['最大值 MAX', stats.max],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <span>{label}</span>
                      <strong>
                        {Number(value).toLocaleString('zh-CN', {
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  ))}
                </div>
                <label className="tb-label" htmlFor="budget-stat-formula">
                  自定义统计
                </label>
                <select
                  id="budget-stat-formula"
                  value={formula}
                  onChange={(event) => setFormula(event.target.value)}
                >
                  <option>SUM / COUNT</option>
                  <option>(MAX + MIN) / 2</option>
                  <option>SUM - MAX - MIN</option>
                </select>
                <div className="tb-value-card">
                  <span>计算结果</span>
                  <strong>
                    {stats.numeric
                      ? customValue.toLocaleString('zh-CN', {
                          maximumFractionDigits: 2,
                        })
                      : '—'}
                  </strong>
                </div>
              </>
            )}
          </>
        ) : null}
        {c.panel === 'help' ? (
          <>
            <h3>像电子表格一样操作</h3>
            <dl className="tb-shortcuts">
              <dt>双击 / F2 / Enter</dt>
              <dd>编辑当前单元格</dd>
              <dt>方向键 / Tab</dt>
              <dd>移动到相邻单元格</dd>
              <dt>Shift + 点击或方向键</dt>
              <dd>扩展矩形选区</dd>
              <dt>Ctrl/⌘ + C / X / V</dt>
              <dd>复制 / 剪切 / 粘贴</dd>
              <dt>Ctrl/⌘ + Z / Shift + Z</dt>
              <dd>撤销 / 重做整次操作</dd>
              <dt>Ctrl/⌘ + F</dt>
              <dd>搜索完整数据集</dd>
              <dt>Ctrl/⌘ + D / R</dt>
              <dd>向下 / 向右填充</dd>
              <dt>Alt + 拖动选区</dt>
              <dd>移动选区数据</dd>
              <dt>Delete / Backspace</dt>
              <dd>清空文本；金额重置为 0</dd>
            </dl>
            <h3>公式与格式</h3>
            <p>
              金额支持以 = 开头的公式，例如 <code>=SUM(E1:P1)</code>、
              <code>=ROUND(E1*1.1,2)</code>
              。支持单元格、范围和绝对引用。明确录入的公式会重新计算；其他汇总值仍是独立记录。
            </p>
            <p>
              公式引用按录入时的业务记录绑定。拖拽填充和内部复制会调整相对引用。当前只有一张工作表，不支持外部工作簿引用。
            </p>
            <h3>数据与附件</h3>
            <p>
              10
              万行模式通过服务端按页加载，搜索和统计由服务端执行。单次批量修改最多
              2 万格，复制最多 20 万格；超出会提示，不会截断数据。
            </p>
            <p>
              金额、公式和撤销记录保存在演示服务的当前会话；批注与附件保存在当前页面。生产环境可通过同一接口接入数据库和文件存储。
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}
