import type { ETableColumn } from './types';

export interface ETableHeaderLayout {
  // 当前表头节点标题
  title: string;
  // 起始行
  startRow: number;
  // 起始列
  startColumn: number;
  // 纵向合并行数
  rowSpan: number;
  // 横向合并列数
  columnSpan: number;
  // 当前节点
  column: ETableColumn;
}

/**
 * =========================================================
 * 获取最大表头深度
 * =========================================================
 *
 * 例如：
 *
 * 2026年度预算
 *   └── 上半年
 *       └── 第一季度
 *           └── 1月
 *
 * 深度：
 *
 * 2026年度预算 = 1
 * 上半年       = 2
 * 第一季度     = 3
 * 1月          = 4
 *
 * 最终 maxDepth = 4
 */
const getMaxDepth = (columns: ETableColumn[]): number => {
  if (!columns.length) {
    return 0;
  }

  const getDepth = (column: ETableColumn): number => {
    if (!column.children?.length) {
      return 1;
    }

    return (1 + Math.max(...column.children.map(getDepth)));
  };

  return Math.max(...columns.map(getDepth));
};

/**
 * =========================================================
 * 获取叶子列数量
 * =========================================================
 *
 * 一个没有 children 的列，
 * 就是一个真正的数据列。
 *
 * 例如：
 *
 * 第一季度
 * ├── 1月
 * ├── 2月
 * └── 3月
 *
 * 第一季度的 leafCount = 3
 */
const getLeafCount = (column: ETableColumn,): number => {
  if (!column.children?.length) {
    return 1;
  }
  return column.children.reduce((total, child) => {
    return (
      total +
      getLeafCount(child)
    );
  }, 0);
};

/**
 * =========================================================
 * 构建多级表头布局
 * =========================================================
 *
 * 核心规则：
 *
 * 1. 有 children
 *    → 横向合并
 *
 * 2. 没有 children
 *    → 纵向合并到 maxDepth
 *
 * 所以：
 *
 * 组织机构
 * rowSpan = 4
 *
 * 2026年度预算
 * columnSpan = 12
 *
 * 上半年
 * columnSpan = 6
 *
 * 第一季度
 * columnSpan = 3
 *
 * 1月
 * rowSpan = 1
 */
export const buildHeaderLayout = (columns: ETableColumn[] = [],) => {
  // 没有配置列
  if (!columns.length) {
    return {
      layouts: [],
      leafColumns: [],
      maxDepth: 0,
    };
  }

  // 最大深度。
  const maxDepth = getMaxDepth(columns);
  // 所有叶子列
  const leafColumns: ETableColumn[] = [];
  // 最终布局。
  const layouts: ETableHeaderLayout[] = [];

  /**
   * 当前叶子列位置。
   *
   * 例如：
   *
   * 组织机构 = 0
   * 预算项目 = 1
   * 费用科目 = 2
   * 1月       = 3
   * 2月       = 4
   * ...
   */
  let currentColumn = 0;

  /**
   * =======================================================
   * 递归处理列
   * =======================================================
   */
  const walk = (column: ETableColumn, depth: number,) => {
    /**
     * 当前节点所在行。
     *
     * depth 从 0 开始。
     */
    const startRow = depth;

    /**
     * -----------------------------------------------------
     * 叶子节点
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 组织机构
     * 预算项目
     * 费用科目
     * 1月
     * 2月
     *
     * 没有 children。
     */
    if (!column.children?.length) {
      const startColumn = currentColumn;
      //  叶子列
      leafColumns.push(column);

      /**
       * ⭐ 关键：
       *
       * 叶子节点需要纵向合并到最大深度。
       *
       * 例如：
       *
       * maxDepth = 4
       *
       * 组织机构：
       *
       * row 0
       * row 1
       * row 2
       * row 3
       *
       * rowSpan = 4
       */
      const rowSpan = maxDepth - depth;
      layouts.push({ title: column.title, startRow, startColumn, rowSpan, columnSpan: 1, column });
      // 下一列
      currentColumn += 1;

      return;
    }

    /**
     * -----------------------------------------------------
     * 父节点
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 2026年度预算
     *
     * children：
     *
     * 上半年
     * 下半年
     */
    const startColumn = currentColumn;

    /**
     * 当前节点下面有多少个叶子列。
     *
     * 2026年度预算：
     *
     * 12
     *
     * 上半年：
     *
     * 6
     *
     * 第一季度：
     *
     * 3
     */
    const columnSpan = getLeafCount(column);

    /**
     * 当前父节点先记录下来。
     *
     * children 后面再递归。
     */
    layouts.push({ title: column.title, startRow, startColumn, rowSpan: 1, columnSpan, column });

    /**
     * 递归处理子节点。
     */
    column.children.forEach((child) => {
      walk(child, depth + 1);
    });
  };

  /**
   * 从根节点开始。
   */
  columns.forEach((column) => {
    walk(column, 0);
  });

  return { layouts, leafColumns, maxDepth };
};
