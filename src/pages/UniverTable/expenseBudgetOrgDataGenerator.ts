/**
 * 组织科目大数据：按「费用预算（组织科目）」示例树完全同构复制。
 *
 * 每棵副本：
 *   华润微电子集团
 *     ├─ 华润微电子本部
 *     ├─ 华晶公司
 *     │    ├─ 华晶公司-销售部 / 财务部 / 行政部 / 研发部
 *     └─ 上华公司
 *          └─ 上华公司-销售部
 * 每节点均含：费用汇总 → 日常/管理费用合计 → 办公/电/水（默认折叠）
 */
import {
  createExpenseBudgetGroupTree,
  EXPENSE_BUDGET_GROUP_FLAT_ROWS,
  EXPENSE_BUDGET_ORG_COUNT,
} from './expenseBudgetData';
import type { ETableTreeNode } from '@/components/UniverTable/types';

export const planScaledExpenseBudgetOrg = (targetFlatRows: number) => {
  const rowsPerGroup = EXPENSE_BUDGET_GROUP_FLAT_ROWS;
  const groupCount = Math.max(1, Math.round(targetFlatRows / rowsPerGroup));
  return {
    groupCount,
    orgCount: groupCount * EXPENSE_BUDGET_ORG_COUNT,
    rowsPerGroup,
    flatRowCount: groupCount * rowsPerGroup,
  };
};

/**
 * 分片生成多棵与示例同构的集团树。
 */
export const generateScaledExpenseBudgetOrgTreeData = (
  targetFlatRows: number,
  onProgress?: (percent: number) => void,
): Promise<{
  treeData: ETableTreeNode[];
  flatRowCount: number;
  orgCount: number;
}> =>
  new Promise((resolve) => {
    const { groupCount, orgCount, flatRowCount } =
      planScaledExpenseBudgetOrg(targetFlatRows);

    const treeData: ETableTreeNode[] = new Array(groupCount);
    let index = 0;
    const chunkSize =
      targetFlatRows >= 500000
        ? 20
        : targetFlatRows >= 100000
          ? 40
          : 80;

    const buildChunk = () => {
      const end = Math.min(index + chunkSize, groupCount);
      for (; index < end; index += 1) {
        treeData[index] = createExpenseBudgetGroupTree(index);
      }
      onProgress?.(
        Math.min(99, Math.round((index / Math.max(groupCount, 1)) * 100)),
      );
      if (index < groupCount) {
        window.setTimeout(buildChunk, 0);
        return;
      }
      onProgress?.(100);
      resolve({
        treeData,
        flatRowCount,
        orgCount,
      });
    };

    buildChunk();
  });
