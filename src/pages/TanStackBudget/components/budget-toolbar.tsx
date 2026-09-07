import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Expand,
  FileClock,
  FolderTree,
  LocateFixed,
  MessageSquare,
  Paperclip,
  Redo2,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { COLUMNS, columnLabel } from '../core/columns';
import type { BudgetController } from '../core/use-budget-controller';

function Tool({
  icon,
  children,
  title,
  disabled,
  onClick,
  expanded,
}: {
  icon: ReactNode;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="tb-tool"
      title={title}
      aria-label={typeof children === 'string' ? children : title}
      disabled={disabled}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : 'dialog'}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** Shared commands and popovers; the workbench remains responsible for layout. */
export function BudgetToolbar({
  controller: c,
  engineName,
  searchRef,
  openLocate,
}: {
  controller: BudgetController;
  engineName: string;
  searchRef: RefObject<HTMLInputElement>;
  openLocate: () => void;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [autoFitting, setAutoFitting] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const disabled =
    c.busy || c.data.loading || Boolean(c.data.error) || !c.data.manifest;
  useEffect(() => {
    if (!columnsOpen) return;
    columnMenuRef.current
      ?.querySelector<HTMLInputElement>('input:not(:disabled)')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node))
        setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [columnsOpen]);
  return (
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
          disabled={disabled}
          onChange={(event) => c.setSearchText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
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
        {c.searchText ? (
          <button
            aria-label="清除搜索"
            disabled={disabled}
            onClick={() => {
              c.setSearchText('');
              searchRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        ) : null}
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
            expanded={columnsOpen}
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
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setColumnsOpen(false);
                  columnMenuRef.current
                    ?.querySelector<HTMLButtonElement>('.tb-tool')
                    ?.focus();
                }
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
                  {col < 3 ? <small>必显</small> : null}
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
          disabled={disabled || autoFitting}
          title={
            engineName === 'VTable'
              ? '按当前层级视图全部内容适配列宽；双击列边界适配单列'
              : '按当前已加载内容调整列宽；双击列边界调整单列'
          }
          onClick={() => {
            void (async () => {
              if (!(await c.finishEdit())) return;
              setAutoFitting(true);
              try {
                await new Promise(requestAnimationFrame);
                await c.gridRef.current?.autoFit();
              } finally {
                setAutoFitting(false);
              }
            })();
          }}
        >
          {autoFitting ? '适配中…' : '适配列宽'}
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
  );
}
