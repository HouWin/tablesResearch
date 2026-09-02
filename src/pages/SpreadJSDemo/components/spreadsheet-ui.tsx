import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  LocateFixed,
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
  FEATURES,
  HIERARCHY_COLUMN_COUNT,
  formatStatistic,
  type DataMode,
  type SelectionStats,
  type ToastState,
} from '../spreadsheet/model';

type DemoStatus = 'loading' | 'ready' | 'error';

function useAnchoredPopover(anchorRef: RefObject<HTMLElement>) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    let animationFrame = 0;
    const updatePosition = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const margin = 12;
        const gap = 6;
        const maxLeft = Math.max(
          margin,
          window.innerWidth - popoverRect.width - margin,
        );
        const left = Math.min(Math.max(anchorRect.left, margin), maxLeft);
        const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
        const top =
          spaceBelow >= popoverRect.height
            ? anchorRect.bottom + gap
            : Math.max(margin, anchorRect.top - popoverRect.height - gap);
        setStyle({ left, top, visibility: 'visible' });
      });
    };

    updatePosition();
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePosition);
    resizeObserver?.observe(anchor);
    resizeObserver?.observe(popover);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  return { popoverRef, style };
}

export function DemoHeader({
  status,
  onOpenFeatures,
}: {
  status: DemoStatus;
  onOpenFeatures: () => void;
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
          S
        </div>
        <div>
          <div className="eyebrow">SpreadJS 19.1 · 功能验收 Demo</div>
          <h1>经营数据表</h1>
        </div>
      </div>
      <div className="header-meta">
        <span className="meta-pill">
          <TableProperties size={13} />
          电子表格内核
        </span>
        <span className="meta-pill warning">
          <Info size={13} />
          评估许可 · localhost
        </span>
        <button
          className="feature-count"
          type="button"
          aria-haspopup="dialog"
          onClick={onOpenFeatures}
        >
          <CheckCircle2 size={14} />
          <span>{FEATURES.length} 项能力</span>
        </button>
        <span
          className={`ready-state ${status === 'error' ? 'is-error' : ''}`}
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
  onQueryChange,
  onSearch,
}: {
  anchorRef: RefObject<HTMLElement>;
  query: string;
  result: string;
  busy: boolean;
  onQueryChange: (query: string) => void;
  onSearch: (direction: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { popoverRef, style } = useAnchoredPopover(anchorRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      ref={popoverRef}
      style={style}
      id="sheet-search-popover"
      className="toolbar-popover search-popover"
      role="search"
      aria-label="搜索全部业务层级"
      aria-busy={busy}
    >
      <label htmlFor="sheet-search">搜索全部业务层级（包括已折叠内容）</label>
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
          placeholder="搜索任意单元格内容…"
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
      category: '家具',
      subcategory: '书柜',
      region: '华中',
      detail: '湖北',
    },
    column: ['core-metrics', 'income-metrics', 'revenue'],
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
  const { popoverRef, style } = useAnchoredPopover(anchorRef);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      )
        return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [anchorRef, onClose, popoverRef]);

  const locate = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError('JSON 格式不正确，请检查引号、逗号和括号。');
      return;
    }
    if (!isBusinessCellDimension(parsed)) {
      setError('必须包含有效的 row 行维对象和 column 列维路径。');
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
        <small>仅用于验证</small>
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
  onToggle,
  onShowAll,
}: {
  anchorRef: RefObject<HTMLElement>;
  visibility: boolean[];
  onToggle: (column: number, visible: boolean) => void;
  onShowAll: () => void;
}) {
  const { popoverRef, style } = useAnchoredPopover(anchorRef);
  const visibleCount = visibility.filter(Boolean).length;

  return (
    <div
      ref={popoverRef}
      style={style}
      id="column-visibility-popover"
      className="toolbar-popover column-popover"
      role="region"
      aria-label="显示或隐藏列"
    >
      <div className="popover-title">
        <span>显示 / 隐藏列</span>
        <div>
          <small>
            {visibleCount}/{COLUMNS.length}
          </small>
          <button
            type="button"
            disabled={visibleCount === COLUMNS.length}
            onClick={onShowAll}
          >
            全部显示
          </button>
        </div>
      </div>
      <div className="column-list">
        {COLUMNS.map((column, index) => (
          <label key={column.field}>
            <input
              type="checkbox"
              checked={visibility[index]}
              disabled={index < HIERARCHY_COLUMN_COUNT}
              onChange={(event) => onToggle(index, event.target.checked)}
            />
            {visibility[index] ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{column.label}</span>
            {index < HIERARCHY_COLUMN_COUNT ? <small>固定</small> : null}
          </label>
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
        <span>{dataMode === 'stress' ? '压力数据' : '业务样例'}</span>
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
  const titleId = useId();

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const drawer = drawerRef.current;
    (initialFocusRef?.current ?? closeButtonRef.current)?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
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
      >
        <header className="drawer-header">
          <div>
            <span>{subtitle}</span>
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
