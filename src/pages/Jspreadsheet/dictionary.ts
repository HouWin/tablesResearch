/** Jspreadsheet / 工具栏 L() 文案中文化 */
export const zhCN: Record<string, string> = {
  Show: '显示',
  Hide: '隐藏',
  Search: '搜索',
  Reset: '重置',
  Find: '查找',
  Replace: '替换',
  'Replace by': '替换为',
  'Find and Replace': '查找替换',
  'Search and replace': '查找替换',
  'Toggle Search': '搜索',
  Next: '下一个',
  Prev: '上一个',
  'This worksheet': '当前工作表',
  'All worksheets': '全部工作表',
  'Case sensitive': '区分大小写',
  'Search inside formulas': '在公式内搜索',
  'Match all cell contents': '匹配整个单元格',
  'Replace cells that were hidden by a filter': '替换被筛选隐藏的行',
  'Replace All': '全部替换',
  'Sorry, no matches found': '未找到匹配项',

  Undo: '撤销',
  Redo: '重做',
  Download: '下载',
  Print: '打印',
  Fullscreen: '全屏',
  'Exit Fullscreen': '退出全屏',
  fullscreen: '全屏',
  fullscreen_exit: '退出全屏',
  search: '搜索',
  Save: '保存',
  Cancel: '取消',

  Copy: '复制',
  Cut: '剪切',
  Paste: '粘贴',

  Comments: '批注',
  'Edit this post': '编辑此批注',
  'Delete this post': '删除此批注',

  'Insert a new row before': '在上方插入行',
  'Insert a new row after': '在下方插入行',
  'Delete selected rows': '删除选中行',

  'Insert a new column before': '在左侧插入列',
  'Insert a new column after': '在右侧插入列',
  'Delete selected columns': '删除选中列',

  'Rename this column': '重命名列',
  'Order ascending': '升序',
  'Order descending': '降序',
  'Hide selected columns': '隐藏选中列',
  'Show hidden columns': '显示隐藏列',
  'Hide selected rows': '隐藏选中行',
  'Show hidden rows': '显示隐藏行',

  'Font Family': '字体',
  'Font Size': '字号',
  'Horizontal Align': '水平对齐',
  Align: '对齐',
  Bold: '加粗',
  'Text color': '文字颜色',
  'Background color': '背景色',
  'Vertical Align': '垂直对齐',
  'Merge cells': '合并单元格',
  'Border Style': '边框',
  'Insert image': '插入图片',
  'Are you sure?': '确定继续吗？',
  Default: '默认',
  default: '默认',
  Arial: 'Arial',
  Verdana: 'Verdana',
  'Courier New': 'Courier New（等宽）',
  'Times New Roman': 'Times New Roman（衬线）',
  Helvetica: 'Helvetica',
  Georgia: 'Georgia',
};

/** 工具栏「字体」下拉（第一个 select）显示文案 */
export const TOOLBAR_FONT_ZH: Record<string, string> = {
  '': '默认',
  Default: '默认',
  default: '默认',
  Arial: 'Arial 常规',
  Verdana: 'Verdana 常规',
  'Courier New': 'Courier New 等宽',
  'Times New Roman': 'Times New Roman 衬线',
  Helvetica: 'Helvetica 常规',
  Georgia: 'Georgia 衬线',
};

/** 工具栏图标 content → 中文按钮文案 */
export const TOOLBAR_ICON_ZH: Record<string, string> = {
  undo: '撤销',
  redo: '重做',
  save: '保存',
  content_copy: '复制',
  search: '搜索',
  format_bold: '加粗',
  fullscreen: '全屏',
  fullscreen_exit: '退出全屏',
  image: '图片',
  download: '导出',
  visibility_off: '隐藏列',
  visibility: '显示列',
  width_wide: '自适应',
  unfold_more: '展开行',
  unfold_less: '折叠行',
  view_column: '展开列',
  view_week: '折叠列',
};

function translateToolbarText(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  return zhCN[value] || value;
}

function translateFontFamilyText(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  return TOOLBAR_FONT_ZH[value] || translateToolbarText(value);
}

function patchSelectRender(item: any, translate: (value: unknown) => string) {
  const prevRender = item.render;
  item.render = (value: any, ...rest: any[]) => {
    const label = translate(value);
    if (typeof prevRender === 'function') {
      const el = prevRender(value, ...rest);
      if (el && typeof el === 'object' && 'nodeType' in el) {
        if ((el as HTMLElement).classList?.contains('material-icons')) {
          (el as HTMLElement).title = label;
          return el;
        }
        (el as HTMLElement).textContent = label;
        return el;
      }
      return label;
    }
    const span = document.createElement('span');
    span.className = 'jss-toolbar-label';
    span.textContent = label;
    return span;
  };
}

function patchTextToolbarButton(item: any, label: string) {
  item.render = (toolbarItem: HTMLElement) => {
    toolbarItem.title = item.tooltip || label;
    toolbarItem.innerHTML = `<span class="jss-toolbar-label">${label}</span>`;
  };
}

function syncFullscreenLabel(toolbarItem: HTMLElement) {
  const span = toolbarItem.querySelector('.jss-toolbar-label') as HTMLElement | null;
  if (!span) return;
  span.textContent =
    span.textContent === 'fullscreen_exit' ? '退出全屏' : '全屏';
}

function patchFullscreenButton(item: any): boolean {
  if (String(item.content) !== 'fullscreen') return false;

  patchTextToolbarButton(item, '全屏');

  const prevOnclick = item.onclick;
  item.onclick = function (...args: any[]) {
    const toolbarItem = args[2] as HTMLElement;
    const span = toolbarItem?.querySelector?.('.jss-toolbar-label') as HTMLElement | null;
    if (span) {
      span.textContent =
        span.textContent === '退出全屏' ? 'fullscreen_exit' : 'fullscreen';
    }
    prevOnclick?.apply(item, args);
    syncFullscreenLabel(toolbarItem);
  };

  const prevUpdate = item.updateState;
  item.updateState = function (...args: any[]) {
    prevUpdate?.apply(item, args);
    syncFullscreenLabel(args[2] as HTMLElement);
  };
  return true;
}

function patchSearchButton(item: any): boolean {
  if (String(item.content || '').toLowerCase() !== 'search') return false;

  item.tooltip = translateToolbarText(item.tooltip || 'Toggle Search');
  patchTextToolbarButton(item, '搜索');

  const prevUpdate = item.updateState;
  item.updateState = function (...args: any[]) {
    prevUpdate?.apply(item, args);
    const toolbarItem = args[2] as HTMLElement;
    if (!toolbarItem) return;
    toolbarItem.title = item.tooltip || '搜索';
    const span = toolbarItem.querySelector('.jss-toolbar-label') as HTMLElement | null;
    if (span) {
      span.textContent = '搜索';
      return;
    }
    toolbarItem.innerHTML = `<span class="jss-toolbar-label">搜索</span>`;
  };
  return true;
}

/** 将默认工具栏项改为中文 tooltip + 文字按钮（select/color 仅改 tooltip） */
export function localizeToolbarItems(items: any[]) {
  let selectIndex = 0;
  items.forEach((item) => {
    if (!item || item.type === 'divisor') return;
    if (typeof item.tooltip === 'string') {
      item.tooltip = translateToolbarText(item.tooltip);
    }
    if (patchFullscreenButton(item)) return;
    if (patchSearchButton(item)) return;
    if (item.type === 'select') {
      const isFontFamilySelect = selectIndex === 0;
      selectIndex += 1;
      patchSelectRender(
        item,
        isFontFamilySelect ? translateFontFamilyText : translateToolbarText,
      );
      return;
    }
    if (item.type === 'color') return;
    const label = TOOLBAR_ICON_ZH[String(item.content || '')];
    if (!label) return;
    const prevRender = item.render;
    item.render = (toolbarItem: HTMLElement, ...rest: any[]) => {
      if (prevRender) {
        prevRender(toolbarItem, ...rest);
        return;
      }
      toolbarItem.title = item.tooltip || label;
      toolbarItem.innerHTML = `<span class="jss-toolbar-label">${label}</span>`;
    };
  });
}

/** 去掉官方默认「保存」（undo/redo 旁），避免与自定义保存重复 */
export function removeDefaultToolbarSave(items: any[]) {
  return items.filter((item) => {
    if (!item || item.type === 'divisor') return true;
    return String(item.content || '').toLowerCase() !== 'save';
  });
}

/** 将全屏按钮移到工具栏最后 */
export function moveFullscreenToEnd(items: any[]) {
  const idx = items.findIndex(
    (item) =>
      item &&
      item.type !== 'divisor' &&
      String(item.content || '').toLowerCase() === 'fullscreen',
  );
  if (idx < 0) return items;

  const [fullscreenItem] = items.splice(idx, 1);
  if (
    idx < items.length &&
    items[idx]?.type === 'divisor' &&
    (idx === 0 || items[idx - 1]?.type === 'divisor')
  ) {
    items.splice(idx, 1);
  }
  if (items.length && items[items.length - 1]?.type !== 'divisor') {
    items.push({ type: 'divisor' });
  }
  items.push(fullscreenItem);
  return items;
}
