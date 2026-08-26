import { registerAllIcons } from './icons'; // 引入注册函数
import {
  clearCellAttachments,
  getCellAttachments,
  showAttachmentsModal,
  uploadAndAttachToCell,
} from './attachment';
import { message } from 'antd';

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
    id: 'etable-add-comment', title: '新增批注', icon: 'AddCommentIcon', action: async ({ univerAPI, range }) => {
      if (!range) { return; }
      const richText = univerAPI.newRichText().insertText('请输入批注内容');
      const comment = univerAPI.newTheadComment().setContent(richText).setPersonId('current-user').setDateTime(new Date());
      await range.addCommentAsync(comment);
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
    icon: 'AttachmentIcon',
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
    icon: 'AttachmentIcon',
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
    icon: 'AttachmentIcon',
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
    id: 'etable-delete-row', title: '删除当前行', action: ({ worksheet, row }) => {
      if (!worksheet || row < 0) {
        return;
      }
      worksheet.getRange(row, 0, 1, worksheet.getColumnCount()).clear();
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
  menu.appendTo(item.position ?? 'contextMenu.others');
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

  root.appendTo('contextMenu.others');
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
