/**
 * 平铺表视口懒写入（virtualRender.ts）
 *
 * 当行数 ≥ VIRTUAL_LAZY_THRESHOLD（5000）且非树形视口模式时启用：
 * - 全量 rows 保留在内存
 * - 工作表按 VIRTUAL_PAGE_SIZE（2000 行/页）懒写入
 * - 滚动时 ensureRows 补页，避免百万行一次 setValues 卡死主线程
 *
 * 注意：这是渲染层「分页」，不是面向用户的 UI 分页。
 */
import { applyColumnTypes } from './columnTypes';
import type { ETableColumn, ETableRow } from './types';

/** 超过该行数时启用视口按页懒写入（否则仍分片全量写入） */
export const VIRTUAL_LAZY_THRESHOLD = 5000;
/** 每页行数 */
export const VIRTUAL_PAGE_SIZE = 2000;
/** 首次预写入页数（含视口缓冲） */
export const VIRTUAL_INITIAL_PAGES = 2;
/** 滚动时向后预取行数（按视口行数，而非整页） */
export const VIRTUAL_PREFETCH_ROWS = 80;
/** 估算可视行数（高度未知时的兜底） */
const ESTIMATED_VIEWPORT_ROWS = 40;

export type VirtualRenderStats = {
  enabled: boolean;
  totalRows: number;
  pageSize: number;
  totalPages: number;
  loadedPages: number;
  /** 已写入的大致行数（按页估算） */
  loadedRowsEstimate: number;
  loadedPageIndexes: number[];
};

type UniverWorksheet = any;

export type VirtualDataLoader = {
  /** 已加载页集合 */
  loadedPages: Set<number>;
  /** 确保 [start, end] 数据行已写入 */
  ensureRows: (startRow: number, endRow: number) => void;
  /** 根据当前滚动位置加载可视区 + 预取 */
  loadVisible: () => void;
  getStats: () => VirtualRenderStats;
  dispose: () => void;
};

const toRowValues = (row: ETableRow, leafColumns: ETableColumn[]) => {
  const bgStyle = row.style?.bg
    ? {
        bg: {
          rgb: row.style.bg.startsWith('#') ? row.style.bg : `#${row.style.bg}`,
        },
      }
    : null;

  return leafColumns.map((column) => {
    const cell = row.data?.[column.id];
    if (cell !== null && typeof cell === 'object') {
      const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
      if (styledCell.style || bgStyle) {
        return {
          v: styledCell.value ?? null,
          s: {
            ...(bgStyle || {}),
            ...(styledCell.style || {}),
            bg: (styledCell.style as any)?.bg || bgStyle?.bg,
          },
        };
      }
      return styledCell.value ?? null;
    }
    if (bgStyle) {
      return {
        v: cell ?? null,
        s: bgStyle,
      };
    }
    return cell ?? null;
  });
};

/**
 * 视口虚拟写入：只写可见页，滚动时再补页。
 * Canvas 本身只绘制可视区；此处避免百万行一次 setValues 卡死主线程。
 */
export const createVirtualDataLoader = (params: {
  univerAPI: any;
  worksheet: UniverWorksheet;
  rows: ETableRow[];
  leafColumns: ETableColumn[];
  dataStartRow: number;
  defaultRowHeight?: number;
  pageSize?: number;
  initialPages?: number;
  prefetchRows?: number;
  onPageLoaded?: (stats: VirtualRenderStats) => void;
}): VirtualDataLoader | null => {
  const {
    univerAPI,
    worksheet,
    rows,
    leafColumns,
    dataStartRow,
    defaultRowHeight = 28,
    pageSize = VIRTUAL_PAGE_SIZE,
    initialPages = VIRTUAL_INITIAL_PAGES,
    prefetchRows = VIRTUAL_PREFETCH_ROWS,
    onPageLoaded,
  } = params;

  if (!worksheet || !rows.length || !leafColumns.length) {
    return null;
  }

  const loadedPages = new Set<number>();
  const maxPage = Math.ceil(rows.length / pageSize) - 1;
  let disposed = false;
  let rafId = 0;

  const getStats = (): VirtualRenderStats => {
    const indexes = [...loadedPages].sort((a, b) => a - b);
    let loadedRowsEstimate = 0;
    indexes.forEach((pageIndex) => {
      const offset = pageIndex * pageSize;
      loadedRowsEstimate += Math.min(pageSize, rows.length - offset);
    });
    return {
      enabled: true,
      totalRows: rows.length,
      pageSize,
      totalPages: maxPage + 1,
      loadedPages: loadedPages.size,
      loadedRowsEstimate,
      loadedPageIndexes: indexes,
    };
  };

  const writePage = (pageIndex: number) => {
    if (disposed || pageIndex < 0 || pageIndex > maxPage || loadedPages.has(pageIndex)) {
      return;
    }
    const offset = pageIndex * pageSize;
    const slice = rows.slice(offset, offset + pageSize);
    if (!slice.length) {
      return;
    }
    const values = slice.map((row) => toRowValues(row, leafColumns));
    const sheetRow = dataStartRow + offset;
    worksheet.getRange(sheetRow, 0, values.length, leafColumns.length).setValues(values);

    if (defaultRowHeight > 0) {
      worksheet.setRowHeights(sheetRow, values.length, defaultRowHeight);
    }
    for (let i = 0; i < slice.length; i += 1) {
      const h = slice[i]?.height;
      if (typeof h === 'number' && h > 0 && h !== defaultRowHeight) {
        worksheet.setRowHeight(sheetRow + i, h);
      }
    }

    // 列类型按页应用；大数据跳过校验，避免滚动时挂验证拖慢主线程
    applyColumnTypes(univerAPI, worksheet, leafColumns, sheetRow, values.length, {
      skipValidation: true,
    });
    loadedPages.add(pageIndex);
    onPageLoaded?.(getStats());
  };

  const ensureRows = (startRow: number, endRow: number) => {
    if (disposed) return;
    const start = Math.max(0, Math.min(startRow, rows.length - 1));
    const end = Math.max(start, Math.min(endRow, rows.length - 1));
    const fromPage = Math.floor(start / pageSize);
    const toPage = Math.floor(end / pageSize);
    for (let p = fromPage; p <= toPage; p += 1) {
      writePage(p);
    }
  };

  const loadVisible = () => {
    if (disposed) return;
    let viewStart = 0;
    try {
      const state = worksheet.getScrollState?.();
      if (state && typeof state.sheetViewStartRow === 'number') {
        viewStart = Math.max(0, state.sheetViewStartRow - dataStartRow);
      }
    } catch {
      // ignore
    }
    const viewEnd = viewStart + ESTIMATED_VIEWPORT_ROWS;
    const prefetchEnd = viewEnd + prefetchRows;
    ensureRows(viewStart, prefetchEnd);
  };

  const scheduleLoad = () => {
    if (disposed || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      loadVisible();
    });
  };

  // 首屏预写
  for (let p = 0; p < initialPages && p <= maxPage; p += 1) {
    writePage(p);
  }

  let scrollDisposable: { dispose?: () => void } | null = null;
  try {
    if (univerAPI?.Event?.Scroll && typeof univerAPI.addEvent === 'function') {
      scrollDisposable = univerAPI.addEvent(univerAPI.Event.Scroll, () => {
        scheduleLoad();
      });
    }
  } catch (error) {
    console.warn('[ETable] bind Scroll for virtual render failed', error);
  }

  // 选区变化时也确保当前行已加载（跳转 / 搜索）
  let selectionDisposable: { dispose?: () => void } | null = null;
  try {
    if (univerAPI?.Event?.SelectionChanged && typeof univerAPI.addEvent === 'function') {
      selectionDisposable = univerAPI.addEvent(univerAPI.Event.SelectionChanged, (params: any) => {
        const row = params?.selections?.[0]?.startRow;
        if (typeof row === 'number') {
          const dataRow = row - dataStartRow;
          if (dataRow >= 0 && dataRow < rows.length) {
            ensureRows(dataRow, dataRow + ESTIMATED_VIEWPORT_ROWS);
          }
        }
      });
    }
  } catch {
    // ignore
  }

  if (import.meta.env.DEV) {
    console.info(
      '[ETable] virtual render enabled',
      getStats(),
    );
  }

  return {
    loadedPages,
    ensureRows,
    loadVisible,
    getStats,
    dispose: () => {
      disposed = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      try {
        scrollDisposable?.dispose?.();
      } catch {
        // ignore
      }
      try {
        selectionDisposable?.dispose?.();
      } catch {
        // ignore
      }
    },
  };
};
