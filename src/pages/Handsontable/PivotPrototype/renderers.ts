/**
 * 透视表 v8 —— 单元格 renderer（纯展示，不计算）
 *
 * Handsontable v18：renderer 直接改 td.innerHTML 受支持；baseRenderer 后置补 class 不清空内容。
 */
import { ROW_DIMS } from './data';
import type { ColSlotMeta, DirtyEntry, RowSlotMeta } from './renderModel';

/** 模块级共享状态：index.tsx 每次重建前更新（渲染器在渲染时读取） */
export const shared = {
  rowMeta: [] as RowSlotMeta[],
  colSlots: [] as ColSlotMeta[],
  dirtyMap: new Map<string, DirtyEntry>(),
  rowAreaCols: 4,
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c];
  });
}

/** 维度列（组织/科目）：缩进 + 折叠图标 + 标签；合并块内垂直居中、水平左对齐（保留缩进层级） */
export function dimRenderer(
  _hot: unknown,
  td: HTMLTableCellElement,
  row: number,
  col: number,
): void {
  const spec = shared.rowMeta[row]?.cellSpecs?.[col];
  if (!spec || spec.kind !== 'dim' || !spec.text) {
    td.innerHTML = '';
    return;
  }
  td.style.verticalAlign = 'middle';
  td.style.textAlign = 'left';
  const indent = `<span class="ht-tree-indent" style="width:${(spec.depth ?? 0) * 18}px"></span>`;
  const toggle = spec.hasChildren
    ? `<span class="ht-tree-toggle" title="${spec.collapsed ? '展开' : '折叠'}">${spec.collapsed ? '▸' : '▾'}</span>`
    : '<span class="ht-tree-spacer"></span>';
  td.innerHTML = `${indent}${toggle}<span class="ht-tree-label">${escapeHtml(spec.text)}</span>`;
}

/** 属性列（组织属性/科目属性）：行数据值 + 脏角标；合并块（组织属性）垂直+水平居中 */
export function attrRenderer(
  _hot: unknown,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  _prop: unknown,
  value: unknown,
): void {
  const meta = shared.rowMeta[row];
  const text = value === null || value === undefined ? '' : String(value);
  // 属性列下标 → 行维度下标（0=组织属性，holder=组织节点；1=科目属性，holder=组织|科目 组合）
  const dimIndex = (col - 1) / 2;
  td.style.verticalAlign = 'middle';
  if (Number.isInteger(dimIndex) && dimIndex === 0) {
    // 组织属性列是合并块 → 水平居中；科目属性列逐行展示 → 保持左对齐
    td.style.textAlign = 'center';
  } else {
    td.style.textAlign = 'left';
  }
  let dirty = false;
  if (meta && Number.isInteger(dimIndex) && dimIndex >= 0 && dimIndex < ROW_DIMS.length) {
    const holderKey = dimIndex === 0 ? meta.orgNode.key : meta.pairKey;
    dirty = shared.dirtyMap.has(`${holderKey}|attr:${ROW_DIMS[dimIndex].key}`);
  }
  td.innerHTML = (dirty ? '<span class="ht-dirty"></span>' : '') + escapeHtml(text);
}

/** 值列（指标）：数字 + 脏角标 + 按需占位 */
export function valueRenderer(
  _hot: unknown,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  _prop: unknown,
  value: unknown,
): void {
  const meta = shared.rowMeta[row];
  const slot = shared.colSlots[col - shared.rowAreaCols];
  if (!meta || !slot) {
    td.innerHTML = '';
    return;
  }
  const dirty = shared.dirtyMap.has(`${meta.pairKey}|${slot.colKey}`);
  if (value === null || value === undefined || value === '') {
    td.innerHTML = '';
    return;
  }
  if (value === '…') {
    td.innerHTML = '<span class="ht-pivot-loading">…</span>';
    return;
  }
  const num = typeof value === 'number' ? value : Number(value);
  const text = Number.isFinite(num) ? num.toLocaleString('zh-CN') : String(value);
  td.innerHTML = (dirty ? '<span class="ht-dirty"></span>' : '') + escapeHtml(text);
}
