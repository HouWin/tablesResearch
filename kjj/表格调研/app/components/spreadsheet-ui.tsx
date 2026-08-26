"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  Search,
  TableProperties,
  X,
} from "lucide-react";
import {
  COLUMNS,
  FEATURES,
  HIERARCHY_COLUMN_COUNT,
  formatStatistic,
  type DataMode,
  type SelectionStats,
  type ToastState,
} from "../spreadsheet/model";

export function DemoHeader({ ready, onOpenFeatures }: { ready: boolean; onOpenFeatures: () => void }) {
  return (
    <header className="demo-header">
      <div className="title-lockup">
        <div className="logo-mark" aria-hidden="true">S</div>
        <div>
          <div className="eyebrow">SpreadJS 19.1 · 功能验收 Demo</div>
          <h1>经营数据表</h1>
        </div>
      </div>
      <div className="header-meta">
        <span className="meta-pill"><TableProperties size={13} />电子表格内核</span>
        <span className="meta-pill warning"><Info size={13} />评估许可 · localhost</span>
        <button className="feature-count" type="button" aria-haspopup="dialog" onClick={onOpenFeatures}><CheckCircle2 size={14} />{FEATURES.length} 项能力</button>
        <span className="ready-state" role="status" aria-live="polite"><i />{ready ? "已就绪" : "初始化…"}</span>
      </div>
    </header>
  );
}

export function SearchPopover({ query, result, onQueryChange, onSearch }: {
  query: string;
  result: string;
  onQueryChange: (query: string) => void;
  onSearch: (direction: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div id="sheet-search-popover" className="toolbar-popover search-popover" role="search" aria-label="当前数据集搜索">
      <label htmlFor="sheet-search">当前数据集搜索</label>
      <div className="search-input-row">
        <Search size={15} />
        <input
          ref={inputRef}
          id="sheet-search"
          value={query}
          aria-describedby="sheet-search-result"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch(event.shiftKey ? -1 : 1);
          }}
          placeholder="搜索任意单元格内容…"
        />
        <button type="button" onClick={() => onSearch(-1)} aria-label="上一个匹配"><ChevronLeft size={15} /></button>
        <button type="button" onClick={() => onSearch(1)} aria-label="下一个匹配"><ChevronRight size={15} /></button>
      </div>
      <small id="sheet-search-result" aria-live="polite">{result}</small>
    </div>
  );
}

export function ColumnVisibilityPopover({ visibility, onToggle }: {
  visibility: boolean[];
  onToggle: (column: number, visible: boolean) => void;
}) {
  return (
    <div id="column-visibility-popover" className="toolbar-popover column-popover" role="region" aria-label="显示或隐藏列">
      <div className="popover-title"><span>显示 / 隐藏列</span><small>{visibility.filter(Boolean).length}/{COLUMNS.length}</small></div>
      <div className="column-list">
        {COLUMNS.map((column, index) => (
          <label key={column.field}>
            <input type="checkbox" checked={visibility[index]} disabled={index < HIERARCHY_COLUMN_COUNT} onChange={(event) => onToggle(index, event.target.checked)} />
            {visibility[index] ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{column.label}</span>
            {index < HIERARCHY_COLUMN_COUNT ? <small>固定</small> : null}
          </label>
        ))}
      </div>
    </div>
  );
}

export function SheetStatusBar({ selectionStats, dataMode, datasetLabel }: {
  selectionStats: SelectionStats;
  dataMode: DataMode;
  datasetLabel: string;
}) {
  return (
    <footer className="sheet-statusbar">
      <div className="selection-summary">
        <span>选区 <b>{selectionStats.cells.toLocaleString("zh-CN")}</b> 格</span>
        <span>数字 <b>{selectionStats.numeric.toLocaleString("zh-CN")}</b></span>
        <span>求和 <b>{selectionStats.numeric ? formatStatistic(selectionStats.sum, selectionStats.numericDisplay) : "—"}</b></span>
        <span>平均 <b>{selectionStats.numeric ? formatStatistic(selectionStats.average, selectionStats.numericDisplay) : "—"}</b></span>
      </div>
      <div className="dataset-summary"><span>{dataMode === "stress" ? "压力数据" : "业务样例"}</span><b>{datasetLabel}</b></div>
    </footer>
  );
}

export function ToastMessage({ toast }: { toast: ToastState }) {
  return (
    <div className={`toast ${toast.tone === "error" ? "toast-error" : ""}`} role={toast.tone === "error" ? "alert" : "status"}>
      {toast.tone === "error" ? <CircleAlert size={16} /> : <CheckCircle2 size={15} />}
      <span>{toast.message}</span>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    closeButtonRef.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
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

    drawer?.addEventListener("keydown", keepFocusInside);
    return () => {
      drawer?.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus();
    };
  }, []);

  return (
    <>
      <button className="drawer-scrim" type="button" tabIndex={-1} aria-label="关闭侧边面板" onClick={onClose} />
      <aside ref={drawerRef} className="inspector-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer-header">
          <div>
            <span>{subtitle}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
