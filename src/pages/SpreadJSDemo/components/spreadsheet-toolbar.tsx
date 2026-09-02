import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Database,
  Gauge,
  GitBranch,
  History,
  LocateFixed,
  MessageSquareText,
  Paperclip,
  Redo2,
  Search,
  Settings2,
  Sigma,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SpreadsheetController } from '../spreadsheet/use-spreadsheet-controller';
import {
  ColumnVisibilityPopover,
  DimensionLocatorPopover,
  SearchPopover,
} from './spreadsheet-ui';

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
    toolbar.scrollBy({
      left: direction * Math.min(320, toolbar.clientWidth * 0.7),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };
  return { toolbarRef, overflow, scroll };
}

export function SpreadsheetToolbar({
  controller,
}: {
  controller: SpreadsheetController;
}) {
  const {
    actionsRef,
    dataMode,
    tableBusy,
    openPanel,
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
  } = controller;
  const [dimensionLocatorOpen, setDimensionLocatorOpen] = useState(false);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const columnAnchorRef = useRef<HTMLDivElement>(null);
  const dimensionAnchorRef = useRef<HTMLDivElement>(null);
  const { toolbarRef, overflow, scroll } = useToolbarOverflow();

  const closeOtherPopovers = (keep: 'search' | 'columns' | 'dimension') => {
    if (keep !== 'search') {
      if (searchOpen) actionsRef.current?.cancelSearch();
      setSearchOpen(false);
    }
    if (keep !== 'columns') setColumnMenuOpen(false);
    if (keep !== 'dimension') setDimensionLocatorOpen(false);
  };

  return (
    <div className="toolbar-shell">
      <section
        id="spreadjs-toolbar"
        ref={toolbarRef}
        className="demo-toolbar"
        aria-label="表格工具栏"
      >
        <div className="toolbar-group" role="group" aria-label="编辑操作">
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
            aria-haspopup="true"
            aria-expanded={searchOpen}
            aria-controls="sheet-search-popover"
            className={searchOpen ? 'is-active' : ''}
            onClick={() => {
              const nextOpen = !searchOpen;
              closeOtherPopovers('search');
              if (!nextOpen) actionsRef.current?.cancelSearch();
              setSearchOpen(nextOpen);
            }}
          >
            <Search size={16} />
            <span>快速搜索</span>
          </button>
          {searchOpen ? (
            <SearchPopover
              anchorRef={searchAnchorRef}
              query={searchQuery}
              result={searchResult}
              busy={searchBusy}
              onClose={() => {
                actionsRef.current?.cancelSearch();
                setSearchOpen(false);
              }}
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
          ) : null}
        </div>

        <div ref={dimensionAnchorRef} className="toolbar-popover-anchor">
          <button
            type="button"
            disabled={tableBusy}
            aria-label="按业务维度定位"
            aria-haspopup="dialog"
            aria-expanded={dimensionLocatorOpen}
            aria-controls="dimension-locator-popover"
            className={dimensionLocatorOpen ? 'is-active' : ''}
            onClick={() => {
              const nextOpen = !dimensionLocatorOpen;
              closeOtherPopovers('dimension');
              setDimensionLocatorOpen(nextOpen);
            }}
          >
            <LocateFixed size={16} />
            <span>维度定位</span>
          </button>
          {dimensionLocatorOpen ? (
            <DimensionLocatorPopover
              anchorRef={dimensionAnchorRef}
              onLocate={(dimension) =>
                actionsRef.current?.locateBusinessCell(dimension) ?? false
              }
              onClose={() => setDimensionLocatorOpen(false)}
            />
          ) : null}
        </div>

        <div ref={columnAnchorRef} className="toolbar-popover-anchor">
          <button
            type="button"
            disabled={tableBusy}
            aria-label="列管理"
            aria-haspopup="true"
            aria-expanded={columnMenuOpen}
            aria-controls="column-visibility-popover"
            className={columnMenuOpen ? 'is-active' : ''}
            onClick={() => {
              const nextOpen = !columnMenuOpen;
              closeOtherPopovers('columns');
              setColumnMenuOpen(nextOpen);
            }}
          >
            <Columns3 size={16} />
            <span>列管理</span>
            <ChevronDown size={13} />
          </button>
          {columnMenuOpen ? (
            <ColumnVisibilityPopover
              anchorRef={columnAnchorRef}
              visibility={columnVisibility}
              onClose={() => setColumnMenuOpen(false)}
              onToggle={(column, visible) =>
                actionsRef.current?.toggleColumn(column, visible)
              }
              onShowAll={() => actionsRef.current?.showAllColumns()}
            />
          ) : null}
        </div>

        <button
          type="button"
          disabled={tableBusy}
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
          aria-pressed={rowGroupsCollapsed}
        >
          <Settings2 size={16} />
          <span>{rowGroupsCollapsed ? '展开全部行组' : '收起全部行组'}</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          title={columnGroupsCollapsed ? '展开全部列组' : '收起全部列组'}
          onClick={() => actionsRef.current?.toggleColumnGroups()}
          className={columnGroupsCollapsed ? 'is-active' : ''}
          aria-pressed={columnGroupsCollapsed}
        >
          <Columns3 size={16} />
          <span>{columnGroupsCollapsed ? '展开全部列组' : '收起全部列组'}</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          onClick={() => actionsRef.current?.autoFit()}
          title="根据内容适配全部列宽"
        >
          <Gauge size={16} />
          <span>适配列宽</span>
        </button>

        <div className="toolbar-separator" aria-hidden="true" />
        <button
          type="button"
          disabled={tableBusy}
          aria-label="打开选区自定义统计"
          title="打开选区自定义统计"
          onClick={() => openPanel('aggregate')}
        >
          <Sigma size={16} />
          <span>自定义统计</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          aria-label="打开单元格批注"
          title="打开单元格批注"
          onClick={() => openPanel('comment')}
        >
          <MessageSquareText size={16} />
          <span>批注</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          aria-label="打开单元格历史"
          title="打开单元格历史"
          onClick={() => openPanel('history')}
        >
          <History size={16} />
          <span>历史</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          aria-label="打开数据追踪"
          title="打开数据追踪"
          onClick={() => openPanel('lineage')}
        >
          <GitBranch size={16} />
          <span>数据追踪</span>
        </button>
        <button
          type="button"
          disabled={tableBusy}
          aria-label="打开单元格附件"
          title="打开单元格附件"
          onClick={() => openPanel('attachment')}
        >
          <Paperclip size={16} />
          <span>附件</span>
        </button>

        <div className="toolbar-spacer" />
        <button
          type="button"
          title={
            dataMode === 'stress' ? '恢复常规业务样例' : '载入 10 万行压力数据'
          }
          className={dataMode === 'stress' ? 'stress-active' : ''}
          disabled={tableBusy}
          aria-pressed={dataMode === 'stress'}
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
      {overflow.left ? (
        <button
          className="toolbar-scroll-button is-left"
          type="button"
          aria-label="查看左侧工具"
          aria-controls="spreadjs-toolbar"
          onClick={() => scroll(-1)}
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      {overflow.right ? (
        <button
          className="toolbar-scroll-button is-right"
          type="button"
          aria-label="查看更多工具"
          aria-controls="spreadjs-toolbar"
          onClick={() => scroll(1)}
        >
          <ChevronRight size={16} />
        </button>
      ) : null}
    </div>
  );
}
