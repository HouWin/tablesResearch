import type { ETableColumnGroup, ETableRowGroup } from './types';

/**
 * 创建行大纲分组。
 *
 * 根据传入的行分组配置，在 Univer 工作表中创建原生行大纲，
 * 支持父子嵌套分组以及初始化时的折叠状态。
 *
 * 行分组的实际行号会根据数据区域的起始行进行偏移，
 * 因为多级表头会占用前面的若干行。
 *
 * @param worksheet Univer 工作表实例
 * @param groups 行分组配置
 * @param dataStartRow 数据区域开始行，从 0 开始
 *
 * @example
 * createRowOutlines(worksheet, [{ startRow: 0, count: 5, collapsed: true }], 2);
 */
export const createRowOutlines = (worksheet: any, groups: ETableRowGroup[] = [], dataStartRow: number) => {
  groups.forEach((group) => {
    /**
     * 无效分组直接跳过。
     */
    if (group.count <= 0) {
      return;
    }

    try {
      /**
       * 创建 Univer 原生行大纲。
       *
       * start：
       * 分组开始行。
       *
       * count：
       * 分组包含的行数。
       */
      const outline = worksheet.addRowOutline(
        dataStartRow + group.startRow,
        group.count,
      );

      /**
       * 如果配置了 collapsed，
       * 则在创建完成后将当前分组设置为折叠状态。
       */
      if (group.collapsed) {
        const outlines = worksheet.getDimensionOutlines('row');
        const target = outlines?.find((item: any) => item.start === dataStartRow + group.startRow && item.end === dataStartRow + group.startRow + group.count - 1);
        if (target) {
          worksheet.setDimensionOutlineCollapsed(target.id, true);
        }
      }
    } catch (error) {
      /**
       * 单个分组创建失败时不影响其他分组继续创建。
       */
      console.error('[ETable] create row outline failed', group, error);
    }

    /**
     * 递归创建子行分组。
     *
     * 通过递归支持多层嵌套的行分组结构。
     */
    if (group.children?.length) {
      createRowOutlines(worksheet, group.children, dataStartRow);
    }
  });
};

/**
 * 创建列大纲分组。
 *
 * 根据传入的列分组配置，在 Univer 工作表中创建原生列大纲，
 * 支持父子嵌套分组以及初始化时的折叠状态。
 *
 * @param worksheet Univer 工作表实例
 * @param groups 列分组配置
 *
 * @example
 * createColumnOutlines(worksheet, [{ startColumn: 2, count: 4, collapsed: true }]);
 */
export const createColumnOutlines = (worksheet: any, groups: ETableColumnGroup[] = [],) => {
  groups.forEach((group) => {
    /**
     * 无效分组直接跳过。
     */
    if (group.count <= 0) {
      return;
    }

    try {
      /**
       * 创建 Univer 原生列大纲。
       *
       * startColumn：
       * 分组开始列。
       *
       * count：
       * 分组包含的列数。
       */
      worksheet.addColumnOutline(group.startColumn, group.count);

      /**
       * 初始化列分组折叠状态。
       */
      if (group.collapsed) {
        const outlines = worksheet.getDimensionOutlines('column');
        const target = outlines?.find(
          (item: any) =>
            item.start === group.startColumn &&
            item.end === group.startColumn + group.count - 1,
        );
        if (target) {
          worksheet.setDimensionOutlineCollapsed(target.id, true);
        }
      }
    } catch (error) {
      /**
       * 单个列分组创建失败时不影响其他分组。
       */
      console.error('[ETable] create column outline failed', group, error);
    }

    /**
     * 递归创建子列分组。
     */
    if (group.children?.length) {
      createColumnOutlines(worksheet, group.children);
    }
  });
};

/**
 * 获取当前工作表中的全部行大纲。
 *
 * @param worksheet Univer 工作表实例
 * @returns 当前工作表所有行大纲配置，没有数据时返回空数组
 */
export const getRowOutlines = (worksheet: any) => {
  return worksheet.getDimensionOutlines('row') || [];
};

/**
 * 获取当前工作表中的全部列大纲。
 *
 * @param worksheet Univer 工作表实例
 * @returns 当前工作表所有列大纲配置，没有数据时返回空数组
 */
export const getColumnOutlines = (worksheet: any) => {
  return worksheet.getDimensionOutlines('column') || [];
};

/**
 * 设置指定大纲的折叠或展开状态。
 *
 * 该方法统一封装 Univer 的 setDimensionOutlineCollapsed API，
 * 上层组件无需直接操作 Univer 的大纲 API。
 *
 * @param worksheet Univer 工作表实例
 * @param id 大纲唯一 ID
 * @param collapsed 是否折叠
 *
 * @example
 * setOutlineCollapsed(worksheet, 'row-outline-1', true);
 *
 * @example
 * setOutlineCollapsed(worksheet, 'column-outline-1', false);
 */
export const setOutlineCollapsed = (worksheet: any, id: string, collapsed: boolean) => {
  worksheet.setDimensionOutlineCollapsed(id, collapsed);
};
