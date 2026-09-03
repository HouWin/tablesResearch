import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CalendarDays,
  Eye,
  EyeOff,
  Info,
  LocateFixed,
  Maximize2,
  Minimize2,
  Search,
  TableProperties,
  X,
} from 'lucide-react';
import {
  isBusinessCellDimension,
  type BusinessCellDimension,
} from '../spreadsheet/business-cell-coordinate';
import {
  COLUMNS,
  COLUMN_HEADER_SECTIONS,
  FEATURES,
  HIERARCHY_COLUMN_COUNT,
  formatStatistic,
  type DataMode,
  type SelectionStats,
  type ToastState,
} from '../spreadsheet/model';
import { useAnchoredPopover } from './use-anchored-popover';

type DemoStatus = 'loading' | 'ready' | 'error';

export function DemoHeader({
  status,
  licenseConfigured,
  fullscreenAvailable,
  isFullscreen,
  onOpenFeatures,
  onToggleFullscreen,
}: {
  status: DemoStatus;
  licenseConfigured: boolean;
  fullscreenAvailable: boolean;
  isFullscreen: boolean;
  onOpenFeatures: () => void;
  onToggleFullscreen: () => void;
}) {
  const statusLabel =
    status === 'ready'
      ? '已就绪'
      : status === 'error'
      ? '初始化失败'
      : '初始化…';

  return (
    <header className="demo-header">
      <div className="title-lockup">
        <div className="logo-mark" aria-hidden="true">
          费
        </div>
        <div>
          <div className="eyebrow">预算管理工作台 · SpreadJS 19.1</div>
          <h1>费用预算表</h1>
        </div>
      </div>
      <div className="header-meta">
        <span className="meta-pill period">
          <CalendarDays size={14} />
          2025 年 · 费用预算
        </span>
        {licenseConfigured ? (
          <span className="meta-pill licensed">
            <TableProperties size={14} />
            生产许可已配置
          </span>
        ) : (
          <span className="meta-pill warning">
            <Info size={14} />
            评估许可 · 仅限本地
          </span>
        )}
        <button
          className="feature-count"
          type="button"
          aria-haspopup="dialog"
          aria-label={`${FEATURES.length} 项能力清单`}
          onClick={onOpenFeatures}
        >
          <CheckCircle2 size={14} />
          <span>{FEATURES.length} 项能力</span>
        </button>
        <button
          className="fullscreen-toggle"
          type="button"
          aria-label={isFullscreen ? '退出全屏' : '全屏显示费用预算表'}
          aria-pressed={isFullscreen}
          disabled={!fullscreenAvailable}
          title={fullscreenAvailable ? undefined : '当前浏览器不支持全屏'}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span>{isFullscreen ? '退出全屏' : '全屏'}</span>
        </button>
        <span
          className={`ready-state is-${status}`}
          role="status"
          aria-live="polite"
        >
          <i />
          {statusLabel}
        </span>
      </div>
    </header>
  );
}

export function SearchPopover({
  anchorRef,
  query,
  result,
  busy,
  onClose,
  onQueryChange,
  onSearch,
}: {
  anchorRef: RefObject<HTMLElement>;
  query: string;
  result: string;
  busy: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSearch: (direction: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const { popoverRef, style, close } = useAnchoredPopover(anchorRef, onClose);

  useEffect(() => {
    if (style.visibility === 'visible') inputRef.current?.focus();
  }, [style.visibility]);

  return (
    <div
      ref={popoverRef}
      style={style}
      id="sheet-search-popover"
      className="toolbar-popover search-popover"
      role="search"
      aria-labelledby={titleId}
      aria-busy={busy}
    >
      <div className="popover-title">
        <div>
          <Search size={15} />
          <span id={titleId}>全表搜索</span>
        </div>
        <button
          className="popover-close-button"
          type="button"
          onClick={() => close()}
          aria-label="关闭搜索"
        >
          <X size={15} />
        </button>
      </div>
      <label htmlFor="sheet-search">关键词（包含已折叠层级）</label>
      <div className="search-input-row">
        <Search size={15} />
        <input
          ref={inputRef}
          id="sheet-search"
          value={query}
          aria-describedby="sheet-search-result"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            onSearch(event.shiftKey ? -1 : 1);
          }}
          placeholder="输入组织、科目、功能属性或数值…"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="清空搜索"
            title="清空搜索"
          >
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !query.trim()}
          onClick={() => onSearch(-1)}
          aria-label="上一个匹配"
          title="上一个匹配（Shift + Enter）"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          disabled={busy || !query.trim()}
          onClick={() => onSearch(1)}
          aria-label="下一个匹配"
          title="下一个匹配（Enter）"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <small
        id="sheet-search-result"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {result}
      </small>
    </div>
  );
}

const DIMENSION_LOCATOR_EXAMPLE = JSON.stringify(
  {
    row: {
      organizationId: 'huajing-sales',
      subjectId: 'huajing-sales-office',
    },
    column: ['budget2025', 'january'],
  },
  null,
  2,
);

/** 仅用于人工验收业务维度 -> 物理单元格的反向转换。 */
export function DimensionLocatorPopover({
  anchorRef,
  onLocate,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement>;
  onLocate: (dimension: BusinessCellDimension) => boolean;
  onClose: () => void;
}) {
  const [value, setValue] = useState(DIMENSION_LOCATOR_EXAMPLE);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { popoverRef, style, close } = useAnchoredPopover(anchorRef, onClose);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const locate = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError('JSON 格式不正确，请检查引号、逗号和括号。');
      return;
    }
    if (!isBusinessCellDimension(parsed)) {
      setError('必须包含有效的 row 行维和 column 列维路径。');
      return;
    }
    if (!onLocate(parsed)) {
      setError('当前数据中没有找到这个业务单元格。');
      return;
    }
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      style={style}
      id="dimension-locator-popover"
      className="toolbar-popover dimension-locator-popover"
      role="dialog"
      aria-labelledby="dimension-locator-title"
    >
      <div className="popover-title">
        <div>
          <LocateFixed size={14} />
          <span id="dimension-locator-title">按业务维度定位</span>
        </div>
        <div>
          <small>高级工具</small>
          <button
            className="popover-close-button"
            type="button"
            onClick={() => close()}
            aria-label="关闭精确定位"
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <label htmlFor="dimension-locator-input">行维与列维 JSON</label>
      <textarea
        ref={textareaRef}
        id="dimension-locator-input"
        value={value}
        spellCheck={false}
        aria-describedby="dimension-locator-help dimension-locator-error"
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError('');
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey))
            return;
          event.preventDefault();
          locate();
        }}
      />
      <small id="dimension-locator-help">
        点击定位，或按 Ctrl/⌘ + Enter。表格会自动展开并选中目标单元格。
      </small>
      <div className="dimension-locator-footer">
        <span id="dimension-locator-error" role="alert">
          {error}
        </span>
        <button type="button" onClick={locate} disabled={!value.trim()}>
          <LocateFixed size={14} />
          定位单元格
        </button>
      </div>
    </div>
  );
}

export function ColumnVisibilityPopover({
  anchorRef,
  visibility,
  onClose,
  onToggle,
  onShowAll,
}: {
  anchorRef: RefObject<HTMLElement>;
  visibility: boolean[];
  onClose: () => void;
  onToggle: (column: number, visible: boolean) => void;
  onShowAll: () => void;
}) {
  const titleId = useId();
  const { popoverRef, style, close } = useAnchoredPopover(anchorRef, onClose);
  const visibleCount = visibility.filter(Boolean).length;

  return (
    <div
      ref={popoverRef}
      style={style}
      id="column-visibility-popover"
      className="toolbar-popover column-popover"
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="popover-title">
        <div>
          <Eye size={14} />
          <span id={titleId}>列管理</span>
        </div>
        <div>
          <small>
            已显示 {visibleCount}/{COLUMNS.length}
          </small>
          <button
            type="button"
            disabled={visibleCount === COLUMNS.length}
            onClick={onShowAll}
          >
            全部显示
          </button>
          <button
            className="popover-close-button"
            type="button"
            onClick={() => close()}
            aria-label="关闭列管理"
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="column-list">
        {COLUMN_HEADER_SECTIONS.map((section) => (
          <section key={section.id} className="column-section">
            {section.colCount > 1 ? <h3>{section.label}</h3> : null}
            {COLUMNS.slice(
              section.startCol,
              section.startCol + section.colCount,
            ).map((column, sectionIndex) => {
              const index = section.startCol + sectionIndex;
              return (
                <label key={column.field}>
                  <input
                    type="checkbox"
                    checked={visibility[index]}
                    disabled={index < HIERARCHY_COLUMN_COUNT}
                    onChange={(event) => onToggle(index, event.target.checked)}
                  />
                  {visibility[index] ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{column.label}</span>
                  {index < HIERARCHY_COLUMN_COUNT ? <small>固定</small> : null}
                </label>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

export function SheetStatusBar({
  selectionStats,
  dataMode,
  datasetLabel,
}: {
  selectionStats: SelectionStats;
  dataMode: DataMode;
  datasetLabel: string;
}) {
  return (
    <footer className="sheet-statusbar">
      <div className="selection-summary">
        <span>
          选区 <b>{selectionStats.cells.toLocaleString('zh-CN')}</b> 格
        </span>
        <span>
          数字 <b>{selectionStats.numeric.toLocaleString('zh-CN')}</b>
        </span>
        <span>
          求和{' '}
          <b>
            {selectionStats.numeric
              ? formatStatistic(
                  selectionStats.sum,
                  selectionStats.numericDisplay,
                )
              : '—'}
          </b>
        </span>
        <span>
          平均{' '}
          <b>
            {selectionStats.numeric
              ? formatStatistic(
                  selectionStats.average,
                  selectionStats.numericDisplay,
                )
              : '—'}
          </b>
        </span>
      </div>
      <div className="dataset-summary">
        <span>{dataMode === 'stress' ? '压力数据' : '预算样例'}</span>
        <b>{datasetLabel}</b>
      </div>
    </footer>
  );
}

export function ToastMessage({ toast }: { toast: ToastState }) {
  return (
    <div
      className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      {toast.tone === 'error' ? (
        <CircleAlert size={16} />
      ) : (
        <CheckCircle2 size={15} />
      )}
      <span>{toast.message}</span>
    </div>
  );
}

export function Drawer({
  title,
  subtitle,
  onClose,
  initialFocusRef,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const drawer = drawerRef.current;
    (initialFocusRef?.current ?? closeButtonRef.current)?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = [
        ...drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    drawer?.addEventListener('keydown', keepFocusInside);
    return () => {
      drawer?.removeEventListener('keydown', keepFocusInside);
      previousFocus?.focus();
    };
  }, []);

  return (
    <>
      <button
        className="drawer-scrim"
        type="button"
        tabIndex={-1}
        aria-label="关闭侧边面板"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="inspector-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <header className="drawer-header">
          <div>
            <span id={subtitleId}>{subtitle}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={17} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
