import { registerAllIcons } from './icons'; // 引入注册函数
import {
  clearCellAttachments,
  getCellAttachments,
  showAttachmentsModal,
  uploadAndAttachToCell,
} from './attachment';
import { message } from 'antd';
import { of } from 'rxjs';
import { ICommandService } from '@univerjs/core';
import { AddCommentCommand } from '@univerjs/thread-comment';
import { SetActiveCommentOperation } from '@univerjs/thread-comment-ui';
import { IMenuManagerService } from '@univerjs/ui';
import { SheetsThreadCommentPopupService } from '@univerjs/sheets-thread-comment-ui';

/**
 * ETable 自定义右键菜单
 *
 * 基于 Univer Facade API
 *
 * 功能：
 * 1. 自定义右键菜单名称
 * 2. 新增自定义菜单
 * 3. 支持菜单分隔线
 * 4. 支持子菜单
 * 5. 获取当前选中单元格
 * 6. 获取当前 Worksheet
 * 7. 支持自定义菜单点击事件
 * 8. 支持动态控制菜单是否显示
 * 9. 支持动态控制菜单是否禁用
 */

export interface ETableContextMenuContext {
  //  Univer Facade API
  univerAPI: any;
  // 当前 Worksheet
  worksheet: any;
  // 当前选区
  selection: any;
  // 当前选中的 Range
  range: any;
  // 当前单元格
  row: number;
  // 当前列
  column: number;
  // 当前单元格 A1 地址
  cell: string;
  // 附件上传回调（由 ETable 注入）
  onUploadAttachment?: (
    file: File,
    cell: string,
  ) => Promise<any>;
  // 附件变化回调
  onAttachmentsChange?: (cell: string, files: any[]) => void;
  // 查看单元格历史
  onViewCellHistory?: (cell: string) => void;
  // 数据追踪
  onViewDataTrace?: (cell: string) => void;
  // 下钻
  onDrillDown?: () => void;
  // 上钻
  onDrillUp?: () => void;
  // 快速搜索
  onQuickSearch?: () => void;
}

export interface ETableContextMenuItem {
  // 可选增加 type 用于 TS 类型收窄
  type?: 'item';
  // 菜单唯一 ID
  id: string;
  // 菜单显示名称
  title: string;
  // 新增 icon 属性（可以是一个图标名称字符串）
  icon?: string;
  // 菜单点击事件
  action?: (context: ETableContextMenuContext) => void | Promise<void>;
  // 是否显示 | 可以是 boolean，也可以根据当前单元格动态判断
  hidden?: boolean | ((context: ETableContextMenuContext) => boolean);
  // 是否禁用 | 可以是 boolean，也可以根据当前单元格动态判断
  disabled?: boolean | ((context: ETableContextMenuContext) => boolean);
  // 菜单显示位置 | contextMenu.others | contextMenu.mainArea
  position?: string | string[];
  // 菜单排序
  order?: number;
}

export interface ETableContextMenuSeparator {
  type: 'separator';
}

export interface ETableContextMenuSubmenu {
  type: 'submenu';
  // 子菜单 ID
  id: string;
  // 子菜单名称
  title: string;
  // 子菜单
  items: ETableContextMenuConfig[];
}

export type ETableContextMenuConfig = | ETableContextMenuItem | ETableContextMenuSeparator | ETableContextMenuSubmenu;

/**
 * 预置需要隐藏的 Univer 原生右键/相关菜单命令。
 * 传给 UniverSheetsCorePreset({ menu })，从源头隐藏。
 */
export const NATIVE_CONTEXT_MENU_HIDE_CONFIG: Record<string, { hidden: true }> = {
  'sheet.command.copy': { hidden: true },
  'sheet.command.cut': { hidden: true },
  'sheet.command.paste': { hidden: true },
  'sheet.command.paste-value': { hidden: true },
  'sheet.command.paste-format': { hidden: true },
  'sheet.command.paste-col-width': { hidden: true },
  'sheet.command.paste-besides-border': { hidden: true },
  'sheet.command.optional-paste': { hidden: true },
  'sheet.command.clear-selection-content': { hidden: true },
  'sheet.command.clear-selection-format': { hidden: true },
  'sheet.command.clear-selection-all': { hidden: true },
  'sheet.command.insert-row-before': { hidden: true },
  'sheet.command.insert-row-after': { hidden: true },
  'sheet.command.insert-col-before': { hidden: true },
  'sheet.command.insert-col-after': { hidden: true },
  'sheet.command.remove-row-confirm': { hidden: true },
  'sheet.command.remove-col-confirm': { hidden: true },
  'sheet.command.delete-range-move-left-confirm': { hidden: true },
  'sheet.command.delete-range-move-up-confirm': { hidden: true },
  'sheet.command.insert-range-move-right-confirm': { hidden: true },
  'sheet.command.insert-range-move-down-confirm': { hidden: true },
  'sheet.command.hide-row-confirm': { hidden: true },
  'sheet.command.hide-col-confirm': { hidden: true },
  'sheet.command.set-row-height': { hidden: true },
  'sheet.command.set-col-width': { hidden: true },
  'sheet.command.set-col-auto-width': { hidden: true },
  'sheet.command.set-row-is-auto-height': { hidden: true },
  'sheet.command.set-selection-frozen': { hidden: true },
  'sheet.command.set-row-frozen': { hidden: true },
  'sheet.command.set-col-frozen': { hidden: true },
  'sheet.command.set-first-row-frozen': { hidden: true },
  'sheet.command.set-first-column-frozen': { hidden: true },
  'sheet.command.cancel-frozen': { hidden: true },
  'sheet.menu.copy-special': { hidden: true },
  'sheet.menu.sheet-frozen': { hidden: true },
  'sheet.column-header-menu.sheet-frozen': { hidden: true },
  'sheet.row-header-menu.sheet-frozen': { hidden: true },
  'sheet.operation.screenshot': { hidden: true },
  'sheet.menu.clear-selection': { hidden: true },
  'sheet.menu.paste-special': { hidden: true },
  'sheet.menu.cell-insert': { hidden: true },
  'sheet.menu.delete': { hidden: true },
  'sheet.contextMenu.permission': { hidden: true },
  'sheet.contextMenu.text-to-number': { hidden: true },
  'sheet.command.add-range-protection-from-context-menu': { hidden: true },
  'sheet.command.delete-range-protection-from-context-menu': { hidden: true },
  'sheet.command.set-range-protection-from-context-menu': { hidden: true },
  'sheet.command.view-sheet-permission-from-context-menu': { hidden: true },
  'thread-comment.command.add-comment': { hidden: true },
  'thread-comment.command.delete-comment': { hidden: true },
  'sheets.command.insert-note': { hidden: true },
  'sheets.command.delete-note': { hidden: true },
  'sheets.command.toggle-note': { hidden: true },
  'data-validation.operation.open-data-validation-panel': { hidden: true },
  'data-validation.command.add-rule': { hidden: true },
  'sheet.command.add-data-validation': { hidden: true },
};

/**
 * 表格内部剪贴板。
 *
 * 右键菜单点击时，浏览器系统剪贴板（Clipboard API）经常因焦点丢失 /
 * 非安全上下文失败，导致 univerAPI.copy/paste 无效。
 * 这里额外缓存选区值，保证表内复制粘贴可用。
 */
let internalClipboard: {
  values: any[][];
  rowCount: number;
  columnCount: number;
} | null = null;

/**
 * 深拷贝二维数组，避免引用被后续编辑污染。
 */
const cloneMatrix = (matrix: any[][]): any[][] => {
  return matrix.map((row) => row.map((cell) => {
    if (cell !== null && typeof cell === 'object') {
      try {
        return JSON.parse(JSON.stringify(cell));
      } catch {
        return cell;
      }
    }
    return cell;
  }));
};

/**
 * 读取选区值矩阵。
 */
const readRangeValues = (range: any): any[][] | null => {
  if (!range) {
    return null;
  }
  try {
    const values = range.getValues?.();
    if (Array.isArray(values) && values.length) {
      return values;
    }
  } catch {
    // ignore
  }
  try {
    const value = range.getValue?.();
    return [[value ?? null]];
  } catch {
    return null;
  }
};

/**
 * 右键复制：先缓存选区，再尝试系统剪贴板。
 */
const copySelection = async (context: ETableContextMenuContext) => {
  const { univerAPI, range } = context;
  if (!range) {
    message.warning('请先选中要复制的单元格');
    return;
  }

  try {
    range.activate?.();
  } catch {
    // ignore
  }

  const values = readRangeValues(range);
  if (!values?.length) {
    message.warning('当前选区没有可复制的内容');
    return;
  }

  internalClipboard = {
    values: cloneMatrix(values),
    rowCount: values.length,
    columnCount: values[0]?.length || 1,
  };

  let systemOk = false;
  try {
    if (typeof univerAPI?.copy === 'function') {
      systemOk = Boolean(await univerAPI.copy());
    }
  } catch (error) {
    console.warn('[ETable] system clipboard copy failed', error);
  }

  // 系统剪贴板失败时，仍可用内部缓存做表内粘贴
  if (systemOk) {
    message.success('已复制');
  } else {
    message.success('已复制（表内粘贴可用）');
  }
};

/**
 * 右键粘贴：优先系统剪贴板，失败则用内部缓存写入当前选区。
 */
const pasteSelection = async (context: ETableContextMenuContext) => {
  const { univerAPI, range, worksheet } = context;
  if (!range) {
    message.warning('请先选中要粘贴的目标单元格');
    return;
  }

  try {
    range.activate?.();
  } catch {
    // ignore
  }

  let systemOk = false;
  try {
    if (typeof univerAPI?.paste === 'function') {
      systemOk = Boolean(await univerAPI.paste());
    }
  } catch (error) {
    console.warn('[ETable] system clipboard paste failed', error);
  }

  if (systemOk) {
    message.success('已粘贴');
    return;
  }

  if (!internalClipboard?.values?.length) {
    message.warning('剪贴板为空，请先复制内容');
    return;
  }

  try {
    const startRow = range.getRow?.() ?? 0;
    const startColumn = range.getColumn?.() ?? 0;
    const target = worksheet?.getRange?.(
      startRow,
      startColumn,
      internalClipboard.rowCount,
      internalClipboard.columnCount,
    ) ?? range;
    target.setValues?.(internalClipboard.values);
    message.success('已粘贴');
  } catch (error) {
    console.error('[ETable] internal paste failed', error);
    message.error('粘贴失败');
  }
};

/** 右键后短暂抑制 hover 临时批注弹层（ms） */
const COMMENT_POPUP_SUPPRESS_MS = 600;

const getUniverInjector = (univerAPI: any) =>
  univerAPI?.__getInjector?.() ||
  univerAPI?.getGlobalContext?.()?.injector ||
  univerAPI?._injector;

/**
 * 修复：有批注单元格首次右键时，hover 临时弹层与 clickOutside 抢占，导致菜单不出现。
 *
 * 1. 右键 capture 阶段先关闭批注弹层
 * 2. 抑制 debounce hover 触发的 temp 弹层
 */
export const setupCommentContextMenuGuard = (
  univerAPI: any,
  container: HTMLElement,
): (() => void) => {
  const injector = getUniverInjector(univerAPI);
  if (!injector || !container) {
    return () => {};
  }

  let popupService: SheetsThreadCommentPopupService;
  let commandService: ICommandService;
  try {
    popupService = injector.get(SheetsThreadCommentPopupService);
    commandService = injector.get(ICommandService);
  } catch {
    return () => {};
  }

  let suppressHoverPopupUntil = 0;

  const shouldSuppressHoverPopup = () => Date.now() < suppressHoverPopupUntil;

  const hideCommentPopup = () => {
    try {
      popupService.hidePopup();
    } catch {
      // ignore
    }
    try {
      commandService.executeCommand(SetActiveCommentOperation.id);
    } catch {
      // ignore
    }
  };

  const prepareForContextMenu = () => {
    suppressHoverPopupUntil = Date.now() + COMMENT_POPUP_SUPPRESS_MS;
    hideCommentPopup();
  };

  const onPointerDownCapture = (event: PointerEvent) => {
    if (event.button !== 2) {
      return;
    }
    if (!container.contains(event.target as Node)) {
      return;
    }
    prepareForContextMenu();
  };

  const onContextMenuCapture = (event: MouseEvent) => {
    if (!container.contains(event.target as Node)) {
      return;
    }
    prepareForContextMenu();
  };

  const popupSub = popupService.activePopup$.subscribe((popup) => {
    if (!popup?.temp || !shouldSuppressHoverPopup()) {
      return;
    }
    window.setTimeout(() => {
      if (shouldSuppressHoverPopup() && popupService.activePopup?.temp) {
        hideCommentPopup();
      }
    }, 0);
  });

  container.addEventListener('pointerdown', onPointerDownCapture, true);
  container.addEventListener('contextmenu', onContextMenuCapture, true);

  return () => {
    container.removeEventListener('pointerdown', onPointerDownCapture, true);
    container.removeEventListener('contextmenu', onContextMenuCapture, true);
    popupSub.unsubscribe();
  };
};

/**
 * 打开单元格批注弹层（立即显示，无需再 hover）。
 *
 * 注意：
 * 1. 不要传 temp: true，否则 SheetsThreadCommentHoverController
 *    在鼠标移到无批注单元格时会直接 hidePopup。
 * 2. 延迟打开，避免右键菜单关闭时的 clickOutside 立刻把弹层关掉。
 * 3. trigger: 'context-menu' 用于自动聚焦输入框。
 * 4. 保存批注后自动关闭弹层，避免下次右键被 clickOutside 拦截。
 */
const openCommentPopup = (context: ETableContextMenuContext) => {
  const { univerAPI, range, worksheet } = context;
  if (!range) {
    message.warning('请先选中要批注的单元格');
    return false;
  }

  try {
    range.activate?.();
  } catch {
    // ignore
  }

  const row = range.getRow?.() ?? 0;
  const col = range.getColumn?.() ?? 0;

  const show = () => {
    try {
      const injector = getUniverInjector(univerAPI);
      const workbook = univerAPI?.getActiveWorkbook?.();
      const sheet = workbook?.getActiveSheet?.() || worksheet;
      const unitId = workbook?.getId?.();
      const subUnitId = sheet?.getSheetId?.();

      if (injector && unitId && subUnitId) {
        const popupService = injector.get(SheetsThreadCommentPopupService);
        const commandService = injector.get(ICommandService);
        const cellRef = numberToColumnName(col) + String(row + 1);
        let commandListener: { dispose: () => void } | null = null;

        const disposeCommandListener = () => {
          commandListener?.dispose();
          commandListener = null;
        };

        popupService.showPopup({
          unitId,
          subUnitId,
          row,
          col,
          trigger: 'context-menu',
        }, disposeCommandListener);

        commandListener = commandService.onCommandExecuted((commandInfo) => {
          if (commandInfo.id !== AddCommentCommand.id) {
            return;
          }
          const params = commandInfo.params as {
            unitId?: string;
            subUnitId?: string;
            comment?: { ref?: string };
          };
          if (
            params?.unitId !== unitId ||
            params?.subUnitId !== subUnitId ||
            params?.comment?.ref !== cellRef
          ) {
            return;
          }
          // 批注保存后弹层仍开着，首次右键会先触发 clickOutside 关闭弹层
          window.setTimeout(() => popupService.hidePopup(), 0);
        });
        return true;
      }
    } catch (error) {
      console.warn('[ETable] show comment popup via service failed', error);
    }

    try {
      return Boolean(univerAPI?.executeCommand?.('sheet.operation.show-comment-modal'));
    } catch (error) {
      console.warn('[ETable] show comment modal command failed', error);
      message.error('打开批注失败');
      return false;
    }
  };

  // 等右键菜单卸载后再弹，防止 clickOutside 误关
  window.setTimeout(show, 50);
  return true;
};

/**
 * 默认右键菜单配置
 *
 * 注意：
 * 这些是“新增到 Univer 原生右键菜单”的菜单，
 * 不会删除 Univer 原有菜单。
 */
export const defaultContextMenuItems: ETableContextMenuConfig[] = [
  { id: 'etable-copy', title: '复制内容', icon: 'CopyIcon', action: copySelection },
  { id: 'etable-paste', title: '粘贴数据', icon: 'PasteIcon', action: pasteSelection },
  { type: 'separator', },
  {
    id: 'etable-add-comment',
    title: '新增批注',
    icon: 'AddCommentIcon',
    action: async (context) => {
      openCommentPopup(context);
    },
  },
  {
    id: 'etable-delete-comment', title: '删除批注', icon: 'DeleteCommentIcon', action: async ({ range }) => {
      if (!range) { return; }
      const comment = range.getComment();
      if (!comment) {
        return;
      }
      await comment.deleteAsync();
    },
    hidden: ({ range }) => {
      if (!range) {
        return true;
      }
      return !range.getComment();
    },
  },
  { type: 'separator' },
  {
    id: 'etable-add-attachment',
    title: '添加附件',
    icon: 'AddAttachmentIcon',
    action: async ({ range, cell, onUploadAttachment, onAttachmentsChange }) => {
      if (!range) {
        return;
      }
      const files = await uploadAndAttachToCell({
        range,
        cell,
        onUpload: onUploadAttachment,
      });
      onAttachmentsChange?.(cell, files);
    },
  },
  {
    id: 'etable-view-attachment',
    title: '查看附件',
    icon: 'ViewAttachmentIcon',
    action: ({ range, cell }) => {
      if (!range) {
        return;
      }
      showAttachmentsModal(cell, getCellAttachments(range));
    },
    hidden: ({ range }) => {
      if (!range) {
        return true;
      }
      return getCellAttachments(range).length === 0;
    },
  },
  {
    id: 'etable-clear-attachment',
    title: '清空附件',
    icon: 'ClearAttachmentIcon',
    action: ({ range, cell, onAttachmentsChange }) => {
      if (!range) {
        return;
      }
      clearCellAttachments(range);
      onAttachmentsChange?.(cell, []);
      message.success(`已清空 ${cell} 的附件`);
    },
    hidden: ({ range }) => {
      if (!range) {
        return true;
      }
      return getCellAttachments(range).length === 0;
    },
  },
  { type: 'separator' },
  {
    id: 'etable-cell-history',
    title: '查看单元格历史',
    icon: 'CellHistoryIcon',
    action: ({ cell, onViewCellHistory }) => {
      onViewCellHistory?.(cell);
    },
  },
  {
    id: 'etable-data-trace',
    title: '数据追踪',
    icon: 'DataTraceIcon',
    action: ({ cell, onViewDataTrace }) => {
      onViewDataTrace?.(cell);
    },
  },
  { type: 'separator' },
  {
    id: 'etable-drill-down',
    title: '下钻（展开行组）',
    icon: 'DrillDownIcon',
    action: ({ onDrillDown }) => {
      onDrillDown?.();
    },
  },
  {
    id: 'etable-drill-up',
    title: '上钻（折叠行组）',
    icon: 'DrillUpIcon',
    action: ({ onDrillUp }) => {
      onDrillUp?.();
    },
  },
  {
    id: 'etable-quick-search',
    title: '快速搜索',
    icon: 'QuickSearchIcon',
    action: ({ onQuickSearch }) => {
      onQuickSearch?.();
    },
  },
];

/**
 * 获取当前选区
 */
const getCurrentSelection = (univerAPI: any, worksheet: any) => {
  try {
    // 优先使用 Univer 当前选区
    if (univerAPI?.getActiveWorkbook) {
      const workbook = univerAPI.getActiveWorkbook();
      const activeSheet = workbook?.getActiveSheet?.();
      if (activeSheet) {
        worksheet = activeSheet;
      }
    }

    // 获取当前选择
    const selection = worksheet?.getSelection?.();
    if (!selection) {
      return {
        selection: null,
        range: null,
        row: 0,
        column: 0,
        cell: 'A1',
      };
    }

    // 获取当前 Range
    let range = null;
    try {
      range = selection.getActiveRange?.();
    } catch {
      range = null;
    }

    /**
     * 如果当前版本没有 getActiveRange，
     * 尝试直接获取 Range
     */
    if (!range) {
      try {
        range = selection.getRange?.();
      } catch {
        range = null;
      }
    }

    let row = 0;
    let column = 0;

    try {
      row = range?.getRow?.() ?? 0;
    } catch {
      row = 0;
    }

    try {
      column = range?.getColumn?.() ?? 0;
    } catch {
      column = 0;
    }

    const cell = numberToColumnName(column) + String(row + 1);

    return { selection, range, row, column, cell };
  } catch (error) {
    console.warn('[ETable] get current selection failed', error);
    return { selection: null, range: null, row: 0, column: 0, cell: 'A1' };
  }
}

/**
 * 列数字转 Excel 列名
 *
 * 0  -> A
 * 1  -> B
 * 25 -> Z
 * 26 -> AA
 */
const numberToColumnName = (column: number): string => {
  let result = '';
  let value = column + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

/**
 * 创建菜单上下文
 */
const createMenuContext = (
  univerAPI: any,
  worksheet: any,
  extras?: {
    onUploadAttachment?: ETableContextMenuContext['onUploadAttachment'];
    onAttachmentsChange?: ETableContextMenuContext['onAttachmentsChange'];
    onViewCellHistory?: ETableContextMenuContext['onViewCellHistory'];
    onViewDataTrace?: ETableContextMenuContext['onViewDataTrace'];
    onDrillDown?: ETableContextMenuContext['onDrillDown'];
    onDrillUp?: ETableContextMenuContext['onDrillUp'];
    onQuickSearch?: ETableContextMenuContext['onQuickSearch'];
  },
): ETableContextMenuContext => {
  const current = getCurrentSelection(univerAPI, worksheet);
  return {
    univerAPI,
    worksheet,
    selection: current.selection,
    range: current.range,
    row: current.row,
    column: current.column,
    cell: current.cell,
    onUploadAttachment: extras?.onUploadAttachment,
    onAttachmentsChange: extras?.onAttachmentsChange,
    onViewCellHistory: extras?.onViewCellHistory,
    onViewDataTrace: extras?.onViewDataTrace,
    onDrillDown: extras?.onDrillDown,
    onDrillUp: extras?.onDrillUp,
    onQuickSearch: extras?.onQuickSearch,
  };
};

/**
 * 判断菜单是否隐藏
 */
const isMenuHidden = (item: ETableContextMenuItem, context: ETableContextMenuContext): boolean => {
  if (typeof item.hidden === 'function') {
    return item.hidden(context);
  }
  return item.hidden === true;
}

/**
 * 判断菜单是否禁用
 */
const isMenuDisabled = (item: ETableContextMenuItem, context: ETableContextMenuContext,): boolean => {
  if (typeof item.disabled === 'function') {
    return item.disabled(context);
  }
  return item.disabled === true;
}

/**
 * 注册普通菜单
 */
const registerMenu = (
  univerAPI: any,
  worksheet: any,
  item: ETableContextMenuItem,
  extras?: {
    onUploadAttachment?: ETableContextMenuContext['onUploadAttachment'];
    onAttachmentsChange?: ETableContextMenuContext['onAttachmentsChange'];
    onViewCellHistory?: ETableContextMenuContext['onViewCellHistory'];
    onViewDataTrace?: ETableContextMenuContext['onViewDataTrace'];
    onDrillDown?: ETableContextMenuContext['onDrillDown'];
    onDrillUp?: ETableContextMenuContext['onDrillUp'];
    onQuickSearch?: ETableContextMenuContext['onQuickSearch'];
  },
) => {
  const menu = univerAPI.createMenu({
    id: item.id,
    title: item.title,
    icon: item.icon,
    action: async () => {
      const context = createMenuContext(
        univerAPI,
        worksheet,
        extras,
      );
      // 动态判断
      if (isMenuHidden(item, context)) {
        return;
      }
      if (isMenuDisabled(item, context)) {
        return;
      }
      try {
        await item.action?.(context);
      } catch (error) {
        console.error(`[ETable] context menu "${item.id}" failed`, error);
      }
    },
  });

  /**
   * Univer Facade API 会在 appendTo 后
   * 将菜单真正添加到 UI。
   */
  menu.appendTo(item.position ?? ['contextMenu.mainArea', 'contextMenu.others']);
  return menu;
}

/**
 * 注册子菜单
 */
const registerSubmenu = (
  univerAPI: any,
  worksheet: any,
  submenu: ETableContextMenuSubmenu,
  extras?: {
    onUploadAttachment?: ETableContextMenuContext['onUploadAttachment'];
    onAttachmentsChange?: ETableContextMenuContext['onAttachmentsChange'];
    onViewCellHistory?: ETableContextMenuContext['onViewCellHistory'];
    onViewDataTrace?: ETableContextMenuContext['onViewDataTrace'];
    onDrillDown?: ETableContextMenuContext['onDrillDown'];
    onDrillUp?: ETableContextMenuContext['onDrillUp'];
    onQuickSearch?: ETableContextMenuContext['onQuickSearch'];
  },
) => {
  const root = univerAPI.createSubmenu({ id: submenu.id, title: submenu.title });
  submenu.items.forEach((item) => {
    // 1. 判断分隔线
    if ('type' in item && item.type === 'separator') {
      root.addSeparator();
      return;
    }
    // 2. 判断子菜单
    if ('type' in item && item.type === 'submenu') {
      const child = registerSubmenu(univerAPI, worksheet, item, extras);
      root.addSubmenu(child);
      return;
    }
    // 3. 普通菜单
    const menuItem = item as ETableContextMenuItem;
    const menu = univerAPI.createMenu({
      id: menuItem.id,
      title: menuItem.title,
      icon: menuItem.icon,
      action: async () => {
        const context = createMenuContext(univerAPI, worksheet, extras);
        if (isMenuHidden(menuItem, context)) return;
        if (isMenuDisabled(menuItem, context)) return;
        try {
          await menuItem.action?.(context);
        } catch (error) {
          console.error(`[ETable] context submenu "${menuItem.id}" failed`, error);
        }
      },
    });
    root.addSubmenu(menu);
  });

  root.appendTo(['contextMenu.mainArea', 'contextMenu.others']);
  return root;
};

/**
 * 注册 ETable 自定义右键菜单
 *
 * 使用：
 *
 * customizeContextMenu(
 *   univerAPI,
 *   worksheet,
 *   [
 *     {
 *       id: 'add-row',
 *       title: '新增行',
 *       action: ({ row }) => {
 *         console.log(row);
 *       },
 *     },
 *   ],
 * );
 */
export const customizeContextMenu = (
  univerAPI: any,
  worksheet: any,
  items: ETableContextMenuConfig[] = defaultContextMenuItems,
  extras?: {
    onUploadAttachment?: ETableContextMenuContext['onUploadAttachment'];
    onAttachmentsChange?: ETableContextMenuContext['onAttachmentsChange'];
    onViewCellHistory?: ETableContextMenuContext['onViewCellHistory'];
    onViewDataTrace?: ETableContextMenuContext['onViewDataTrace'];
    onDrillDown?: ETableContextMenuContext['onDrillDown'];
    onDrillUp?: ETableContextMenuContext['onDrillUp'];
    onQuickSearch?: ETableContextMenuContext['onQuickSearch'];
  },
) => {
  if (!univerAPI || !worksheet || !Array.isArray(items) || !items.length) {
    return;
  }
  registerAllIcons(univerAPI);
  items.forEach((item) => {
    // 分隔线
    if ('type' in item && item.type === 'separator') {
      return;
    }
    // 子菜单
    if ('type' in item && item.type === 'submenu') {
      registerSubmenu(univerAPI, worksheet, item, extras);
      return;
    }
    // 普通菜单
    registerMenu(univerAPI, worksheet, item as ETableContextMenuItem, extras);
  });

  // 隐藏 Univer 原生右键菜单，只保留自定义项
  const keepIds = collectCustomMenuIds(items);
  // 等菜单 schema 注册完成后再隐藏（部分插件会延迟注册）
  const hide = () => hideNativeContextMenus(univerAPI, keepIds);
  requestAnimationFrame(hide);
  setTimeout(hide, 300);
  setTimeout(hide, 1000);
};

/**
 * 收集自定义菜单 id，用于白名单保留。
 */
const collectCustomMenuIds = (items: ETableContextMenuConfig[]): string[] => {
  const ids: string[] = [];
  const walk = (list: ETableContextMenuConfig[]) => {
    list.forEach((item) => {
      if ('type' in item && item.type === 'separator') {
        return;
      }
      if ('type' in item && item.type === 'submenu') {
        ids.push(item.id);
        walk(item.items);
        return;
      }
      ids.push((item as ETableContextMenuItem).id);
    });
  };
  walk(items);
  return ids;
};

/**
 * 隐藏 Univer 自带右键菜单项，只保留白名单中的自定义菜单。
 */
export const hideNativeContextMenus = (
  univerAPI: any,
  keepIds: string[] = [],
) => {
  if (!univerAPI) {
    return;
  }

  try {
    const injector =
      univerAPI.__getInjector?.() ||
      univerAPI.getGlobalContext?.()?.injector ||
      univerAPI._injector;
    if (!injector) {
      console.warn('[ETable] injector not found, skip hide native context menu');
      return;
    }

    const menuManager = injector.get(IMenuManagerService);
    if (!menuManager) {
      return;
    }

    const keepSet = new Set(keepIds);
    const positions = [
      'contextMenu.mainArea',
      'contextMenu.colHeader',
      'contextMenu.rowHeader',
      'contextMenu.footerTabs',
      'contextMenu.footerMenu',
    ];

    const hideSchema = (schemas: any[] = []) => {
      schemas.forEach((schema) => {
        if (!schema) {
          return;
        }
        const key = schema.key as string;
        const keep = keepSet.has(key) || key?.startsWith?.('etable-');

        if (schema.item && !keep) {
          // 强制隐藏原生菜单项
          schema.item.hidden$ = of(true);
        }

        if (Array.isArray(schema.children) && schema.children.length) {
          hideSchema(schema.children);
        }
      });
    };

    positions.forEach((position) => {
      try {
        const schemas = menuManager.getMenuByPositionKey?.(position) || [];
        hideSchema(schemas);
      } catch (error) {
        console.warn('[ETable] hide context menu failed', position, error);
      }
    });

    // 通知菜单刷新
    try {
      menuManager.menuChanged$?.next?.();
    } catch {
      // ignore
    }
  } catch (error) {
    console.warn('[ETable] hideNativeContextMenus failed', error);
  }
};

/**
 * 创建一个右键菜单项
 *
 * 方便业务代码动态创建菜单。
 */
export const createContextMenuItem = (item: ETableContextMenuItem): ETableContextMenuItem => {
  return item;
}

/**
 * 创建右键菜单分隔线
 */
export const createContextMenuSeparator = (): ETableContextMenuSeparator => {
  return {
    type: 'separator',
  };
}

/**
 * 创建右键子菜单
 */
export const createContextSubmenu = (id: string, title: string, items: ETableContextMenuConfig[]): ETableContextMenuSubmenu => {
  return { type: 'submenu', id, title, items };
}
