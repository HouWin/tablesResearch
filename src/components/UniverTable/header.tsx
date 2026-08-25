import type { ETableColumn } from './types';

/**
 * 展平树结构，获取叶子列（用于数据与列的索引绑定）
 */
export const getLeafColumns = (columns: ETableColumn[]): ETableColumn[] => {
  const leaves: ETableColumn[] = [];
  const traverse = (cols: ETableColumn[]) => {
    for (const col of cols) {
      if (col.children && col.children.length > 0) {
        traverse(col.children);
      } else {
        leaves.push(col);
      }
    }
  };
  traverse(columns);
  return leaves;
}

/**
 * 计算多级表头的最大深度
 */
export const getHeaderDepth = (columns: ETableColumn[]): number => {
  let max = 0;
  for (const col of columns) {
    if (col.children && col.children.length > 0) {
      max = Math.max(max, getHeaderDepth(col.children));
    }
  }
  return max + 1;
}

/**
 * 原生多维列头配置渲染
 */
export const customizeColumnHeaders = (worksheet: any, columns: ETableColumn[]) => {
  if (!worksheet || !columns || !columns.length) return;
  const leafColumns = getLeafColumns(columns);
  // 1. 构造列头 Name 映射配置 { 0: "组织机构", 1: "预算项目", ... }
  const columnsCfg: Record<number, string> = {};
  leafColumns.forEach((col, index) => {
    columnsCfg[index] = col.title;
  });
  // 2. 优先调用 Univer 原生暴露的 customizeColumnHeader 接口
  try {
    if (typeof worksheet.customizeColumnHeader === 'function') {
      worksheet.customizeColumnHeader({
        columnsCfg,
        treeSchema: columns, // 传给 Univer 渲染引擎多级树结构
      });
      return;
    }
  } catch (e) {
    console.warn('[ETable] worksheet.customizeColumnHeader failed:', e);
  }
  // 3. Fallback：如果采用传统 columnsCfg 传入
  try {
    const rawCustom = worksheet.getWorkbook?.()?.getCustomColumnHeader?.();
    if (rawCustom && typeof rawCustom.setColumnTitle === 'function') {
      Object.keys(columnsCfg).forEach((colIdx) => {
        rawCustom.setColumnTitle(Number(colIdx), columnsCfg[Number(colIdx)]);
      });
    }
  } catch (e) {
    // ignore
  }
}
