import { IDialogService } from '@univerjs/ui';

/** Univer 查找对话框 id（@univerjs/find-replace） */
const FIND_REPLACE_DIALOG_ID = 'DESKTOP_FIND_REPLACE_DIALOG';
const FIND_REPLACE_PANEL_WIDTH = 350;
const FIND_PANEL_PAD = 12;

const getUniverInjector = (univerAPI: any) =>
  univerAPI?.__getInjector?.() ||
  univerAPI?.getGlobalContext?.()?.injector ||
  univerAPI?._injector;

const getFindDialogPanel = (): HTMLElement | null => {
  const inner = document.querySelector('[data-u-comp="find-replace-dialog"]');
  if (!inner) {
    return null;
  }
  return (
    (inner.closest('[role="dialog"]') as HTMLElement | null) ||
    (inner.parentElement as HTMLElement | null)
  );
};

const clampToContainer = (
  x: number,
  y: number,
  panel: HTMLElement,
  container: HTMLElement,
): { x: number; y: number } => {
  const bounds = container.getBoundingClientRect();
  const { width, height } = panel.getBoundingClientRect();
  const maxX = Math.max(bounds.left, bounds.right - width);
  const maxY = Math.max(bounds.top, bounds.bottom - height);
  return {
    x: Math.min(Math.max(x, bounds.left), maxX),
    y: Math.min(Math.max(y, bounds.top), maxY),
  };
};

const getDefaultPositionInContainer = (
  container: HTMLElement,
  width: number,
): { x: number; y: number } => {
  const bounds = container.getBoundingClientRect();
  const x = Math.min(
    Math.max(bounds.right - width - FIND_PANEL_PAD, bounds.left + FIND_PANEL_PAD),
    Math.max(bounds.left, bounds.right - width),
  );
  const y = bounds.top + FIND_PANEL_PAD;
  return { x, y };
};

/** 用 fixed + 视口坐标钉在表格内，避免 absolute 相对 body 时初始位置跑偏 */
const placeFindDialogInContainer = (
  panel: HTMLElement,
  container: HTMLElement,
  preferred?: { x: number; y: number },
) => {
  const width = panel.getBoundingClientRect().width || FIND_REPLACE_PANEL_WIDTH;
  const target =
    preferred ?? getDefaultPositionInContainer(container, width);
  const next = clampToContainer(target.x, target.y, panel, container);
  panel.style.setProperty('position', 'fixed', 'important');
  panel.style.setProperty('left', '0px', 'important');
  panel.style.setProperty('top', '0px', 'important');
  panel.style.setProperty('margin', '0px', 'important');
  panel.style.setProperty(
    'transform',
    `translate(${next.x}px, ${next.y}px)`,
    'important',
  );
  panel.style.setProperty('transition', 'none', 'important');
  return next;
};

/**
 * 打开 Univer 查找对话框（快速搜索）。
 */
export const openQuickSearch = (univerAPI: any): boolean => {
  if (!univerAPI) {
    return false;
  }
  const commands = [
    'ui.operation.open-find-dialog',
    'ui.command.open-find-dialog',
    'find-replace.operation.open-find-dialog',
  ];
  for (const id of commands) {
    try {
      if (univerAPI.executeCommand?.(id)) {
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
};

/**
 * 将查找对话框限制在表格容器内：
 * - Univer 默认按 window 定位，且拖拽只限制在视口 → 会拖出表格
 * - 打开后强制钉到表格右上，并接管标题栏拖拽
 * - 记住上次拖拽位置，避免第二次拖动时被 React 复位成 (0,0)/左上角
 */
export const constrainFindDialogToContainer = (
  univerAPI: any,
  container: HTMLElement,
): (() => void) => {
  const injector = getUniverInjector(univerAPI);
  if (!injector || !container) {
    return () => {};
  }

  let dialogService: {
    open: (option: Record<string, unknown>) => unknown;
  };
  try {
    dialogService = injector.get(IDialogService);
  } catch {
    return () => {};
  }

  /** 上次稳定位置（视口坐标）；拖拽与 React 覆盖后都以它为准 */
  let lastPos: { x: number; y: number } | null = null;
  let stickRaf = 0;
  let stickLeft = 0;
  let placedForPanel: HTMLElement | null = null;
  let styleObserver: MutationObserver | null = null;
  let applying = false;
  let dragging = false;

  const stopStick = () => {
    if (stickRaf) {
      cancelAnimationFrame(stickRaf);
      stickRaf = 0;
    }
    stickLeft = 0;
  };

  const applyPos = (
    panel: HTMLElement,
    preferred?: { x: number; y: number },
  ) => {
    const width = panel.getBoundingClientRect().width || FIND_REPLACE_PANEL_WIDTH;
    const target =
      preferred ??
      lastPos ??
      getDefaultPositionInContainer(container, width);
    applying = true;
    const next = placeFindDialogInContainer(panel, container, target);
    lastPos = next;
    placedForPanel = panel;
    // MutationObserver 异步触发，需延后解除，避免回写死循环
    queueMicrotask(() => {
      applying = false;
    });
    return next;
  };

  const watchPanelStyle = (panel: HTMLElement) => {
    styleObserver?.disconnect();
    styleObserver = new MutationObserver(() => {
      if (applying || dragging || !lastPos) {
        return;
      }
      // React 重渲染会清掉 !important，把位置打回内部 state（常为 0,0）
      applyPos(panel, lastPos);
    });
    styleObserver.observe(panel, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  };

  const stickPlace = (preferred?: { x: number; y: number }) => {
    stopStick();
    if (preferred) {
      lastPos = preferred;
    }
    stickLeft = 40;
    const tick = () => {
      const panel = getFindDialogPanel();
      if (panel) {
        applyPos(panel, lastPos ?? preferred);
        watchPanelStyle(panel);
      }
      stickLeft -= 1;
      if (stickLeft > 0) {
        stickRaf = requestAnimationFrame(tick);
      } else {
        stickRaf = 0;
      }
    };
    stickRaf = requestAnimationFrame(tick);
  };

  const originalOpen = dialogService.open.bind(dialogService);
  dialogService.open = (option: Record<string, unknown>) => {
    let preferred: { x: number; y: number } | undefined;
    if (option?.id === FIND_REPLACE_DIALOG_ID) {
      const width =
        typeof option.width === 'number'
          ? option.width
          : FIND_REPLACE_PANEL_WIDTH;
      const isFreshOpen = !getFindDialogPanel();
      preferred = isFreshOpen
        ? getDefaultPositionInContainer(container, width)
        : lastPos ?? getDefaultPositionInContainer(container, width);
      if (isFreshOpen) {
        lastPos = preferred;
      }
      option = {
        ...option,
        defaultPosition: preferred,
      };
    }
    const disposable = originalOpen(option);
    if (option?.id === FIND_REPLACE_DIALOG_ID) {
      stickPlace(preferred);
      window.setTimeout(() => stickPlace(lastPos ?? preferred), 0);
      window.setTimeout(() => stickPlace(lastPos ?? preferred), 50);
      window.setTimeout(() => stickPlace(lastPos ?? preferred), 120);
    }
    return disposable;
  };

  const domObserver = new MutationObserver(() => {
    const panel = getFindDialogPanel();
    if (!panel) {
      // 关闭时断开 style 监听；位置记忆保留到下次 open 再决定是否重置
      styleObserver?.disconnect();
      styleObserver = null;
      placedForPanel = null;
      return;
    }
    if (panel !== placedForPanel) {
      const preferred =
        lastPos ??
        getDefaultPositionInContainer(
          container,
          panel.getBoundingClientRect().width || FIND_REPLACE_PANEL_WIDTH,
        );
      lastPos = preferred;
      stickPlace(preferred);
      watchPanelStyle(panel);
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  let startClientX = 0;
  let startClientY = 0;
  let startPosX = 0;
  let startPosY = 0;

  const onMouseDownCapture = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const handle = target?.closest?.(
      '[data-drag-handle="true"]',
    ) as HTMLElement | null;
    if (!handle) {
      return;
    }
    const panel = getFindDialogPanel();
    if (!panel || !panel.contains(handle)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    stopStick();

    const rect = panel.getBoundingClientRect();
    // 第二次拖动时 React 常把 DOM 打回 (0,0)；优先用记忆位置
    let origin = lastPos ?? { x: rect.left, y: rect.top };
    if (
      lastPos &&
      Math.hypot(rect.left - lastPos.x, rect.top - lastPos.y) < 32
    ) {
      origin = { x: rect.left, y: rect.top };
    }

    const clamped = clampToContainer(origin.x, origin.y, panel, container);
    dragging = true;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startPosX = clamped.x;
    startPosY = clamped.y;
    applyPos(panel, clamped);
    watchPanelStyle(panel);
    document.body.style.userSelect = 'none';
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging) {
      return;
    }
    const panel = getFindDialogPanel();
    if (!panel) {
      return;
    }
    event.preventDefault();
    const next = clampToContainer(
      startPosX + (event.clientX - startClientX),
      startPosY + (event.clientY - startClientY),
      panel,
      container,
    );
    applyPos(panel, next);
  };

  const onMouseUp = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    document.body.style.userSelect = '';
    const panel = getFindDialogPanel();
    if (panel && lastPos) {
      applyPos(panel, lastPos);
      watchPanelStyle(panel);
    }
  };

  document.addEventListener('mousedown', onMouseDownCapture, true);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  return () => {
    dialogService.open = originalOpen;
    domObserver.disconnect();
    styleObserver?.disconnect();
    stopStick();
    document.removeEventListener('mousedown', onMouseDownCapture, true);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    dragging = false;
    document.body.style.userSelect = '';
  };
};

const readDisplay = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; value?: unknown };
    return String(obj.v ?? obj.value ?? '');
  }
  return String(value);
};

/**
 * 用 TextFinder 或全表扫描搜索关键字，并选中第一个匹配。
 */
export const searchAndSelect = async (
  univerAPI: any,
  keyword: string,
): Promise<{ count: number; cell?: string }> => {
  const text = String(keyword || '').trim();
  if (!univerAPI || !text) {
    return { count: 0 };
  }

  try {
    if (typeof univerAPI.createTextFinderAsync === 'function') {
      const finder = await univerAPI.createTextFinderAsync(text);
      await finder.matchCaseAsync?.(false);
      await finder.matchEntireCellAsync?.(false);
      await finder.ensureCompleteAsync?.();
      const all = finder.findAll?.() || [];
      const first = all[0] || finder.findNext?.();
      if (first?.activate) {
        first.activate();
      }
      return {
        count: all.length || (first ? 1 : 0),
        cell: first?.getA1Notation?.(),
      };
    }
  } catch (error) {
    console.warn('[ETable] text finder failed, fallback to scan', error);
  }

  try {
    const worksheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
    if (!worksheet) {
      return { count: 0 };
    }
    const rowCount = worksheet.getMaxRows?.() ?? 200;
    const colCount = worksheet.getMaxColumns?.() ?? 20;
    const needle = text.toLowerCase();
    const hits: Array<{ row: number; column: number }> = [];
    const scanRows = Math.min(rowCount, 5000);
    const values = worksheet.getRange(0, 0, scanRows, colCount).getValues?.() || [];
    values.forEach((row: unknown[], r: number) => {
      row.forEach((cell, c) => {
        if (readDisplay(cell).toLowerCase().includes(needle)) {
          hits.push({ row: r, column: c });
        }
      });
    });
    if (!hits.length) {
      return { count: 0 };
    }
    const first = hits[0];
    worksheet.getRange(first.row, first.column)?.activate?.();
    return {
      count: hits.length,
      cell: worksheet.getRange(first.row, first.column)?.getA1Notation?.(),
    };
  } catch (error) {
    console.warn('[ETable] scan search failed', error);
    return { count: 0 };
  }
};
