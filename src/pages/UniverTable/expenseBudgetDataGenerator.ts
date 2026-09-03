/**
 * 费用预算大数据生成：按目标展平行数生成「组织树 + 科目 attributes」。
 *
 * 每个组织固定 5 行：费用汇总 → 日常费用合计 → 办公/电/水。
 * 结构：集团 → 公司 → 部门（默认全部折叠）。
 */
import type {
  ETableCell,
  ETablePrimitive,
  ETableTreeAttribute,
  ETableTreeNode,
} from '@/components/UniverTable/types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const FUNC_ATTRS = ['管理', '销售', '研发'] as const;

/** 每个组织展平后的科目行数 */
export const EXPENSE_BUDGET_ROWS_PER_ORG = 5;

type MeasureValues = Record<string, ETablePrimitive | ETableCell>;

const LOCKED_FUNC_ATTR: ETableCell = { value: '-', editable: false };

const fillMonths = (monthly: number): MeasureValues => {
  const values: MeasureValues = {};
  MONTHS.forEach((m) => {
    values[`m${m}`] = monthly;
  });
  return values;
};

const measureValues = (
  monthly: number,
  funcAttr: string | ETableCell,
): MeasureValues => ({
  funcAttr,
  yearTotal: Number((monthly * 12).toFixed(2)),
  ...fillMonths(monthly),
});

const makeSubjectAttributes = (
  prefix: string,
  office: number,
  electric: number,
  water: number,
  leafFuncAttr: string,
): ETableTreeAttribute[] => {
  const total = office + electric + water;
  return [
    {
      id: `${prefix}-summary`,
      label: '费用汇总',
      collapsed: true,
      values: measureValues(total, LOCKED_FUNC_ATTR),
      children: [
        {
          id: `${prefix}-daily-total`,
          label: '日常费用合计',
          depth: 1,
          values: measureValues(total, LOCKED_FUNC_ATTR),
        },
        {
          id: `${prefix}-office`,
          label: '费用-办公费',
          depth: 2,
          values: measureValues(office, leafFuncAttr),
        },
        {
          id: `${prefix}-electric`,
          label: '费用-电费',
          depth: 2,
          values: measureValues(electric, leafFuncAttr),
        },
        {
          id: `${prefix}-water`,
          label: '费用-水费',
          depth: 2,
          values: measureValues(water, leafFuncAttr),
        },
      ],
    },
  ];
};

const leafFeesFromSeed = (seed: number) => {
  const office = 100 + (seed % 50);
  const electric = 200 + (seed % 80);
  const water = 300 + (seed % 100);
  return { office, electric, water };
};

const makeDeptNode = (
  companyIndex: number,
  deptIndex: number,
): ETableTreeNode => {
  const seed = companyIndex * 1000 + deptIndex + 1;
  const fees = leafFeesFromSeed(seed);
  const funcAttr = FUNC_ATTRS[seed % FUNC_ATTRS.length];
  const id = `co-${companyIndex}-dept-${deptIndex}`;
  return {
    id,
    label: `公司${companyIndex + 1}-部门${deptIndex + 1}`,
    collapsed: true,
    attributes: makeSubjectAttributes(
      id,
      fees.office,
      fees.electric,
      fees.water,
      funcAttr,
    ),
  };
};

/**
 * 规划公司数 / 每公司部门数，使展平行数贴近 targetFlatRows。
 * flatRows ≈ (1 + companyCount * (1 + deptPerCompany)) * 5
 */
export const planScaledExpenseBudget = (targetFlatRows: number) => {
  const orgTarget = Math.max(
    2,
    Math.ceil(targetFlatRows / EXPENSE_BUDGET_ROWS_PER_ORG),
  );
  // 预留 1 个集团根节点
  const leafAndCompanyBudget = Math.max(1, orgTarget - 1);
  const companyCount = Math.min(
    200,
    Math.max(4, Math.round(Math.sqrt(leafAndCompanyBudget))),
  );
  const deptPerCompany = Math.max(
    1,
    Math.floor((leafAndCompanyBudget - companyCount) / companyCount),
  );
  const orgCount = 1 + companyCount * (1 + deptPerCompany);
  const flatRowCount = orgCount * EXPENSE_BUDGET_ROWS_PER_ORG;

  return { companyCount, deptPerCompany, orgCount, flatRowCount };
};

/**
 * 分片生成大规模费用预算树（避免主线程长时间阻塞）。
 */
export const generateScaledExpenseBudgetTreeData = (
  targetFlatRows: number,
  onProgress?: (percent: number) => void,
): Promise<{ treeData: ETableTreeNode[]; flatRowCount: number; orgCount: number }> =>
  new Promise((resolve) => {
    const { companyCount, deptPerCompany, orgCount, flatRowCount } =
      planScaledExpenseBudget(targetFlatRows);

    const companies: ETableTreeNode[] = new Array(companyCount);
    let companyIndex = 0;

    const chunkSize =
      targetFlatRows >= 500000
        ? Math.max(20, Math.floor(deptPerCompany / 25))
        : Math.max(40, Math.floor(deptPerCompany / 10));

    const buildCompany = () => {
      const children: ETableTreeNode[] = new Array(deptPerCompany);
      let deptIndex = 0;

      const buildDepts = () => {
        const end = Math.min(deptIndex + chunkSize, deptPerCompany);
        for (; deptIndex < end; deptIndex += 1) {
          children[deptIndex] = makeDeptNode(companyIndex, deptIndex);
        }

        const progress =
          ((companyIndex + deptIndex / deptPerCompany) / companyCount) * 100;
        onProgress?.(Math.min(99, Math.round(progress)));

        if (deptIndex < deptPerCompany) {
          window.setTimeout(buildDepts, 0);
          return;
        }

        // 公司汇总 ≈ 部门费用之和的简化：取部门均值 * 部门数
        const sample = leafFeesFromSeed(companyIndex * 1000 + 1);
        const companyFees = {
          office: sample.office * deptPerCompany,
          electric: sample.electric * deptPerCompany,
          water: sample.water * deptPerCompany,
        };
        const companyId = `co-${companyIndex}`;
        companies[companyIndex] = {
          id: companyId,
          label: `演示公司 ${companyIndex + 1}`,
          collapsed: true,
          attributes: makeSubjectAttributes(
            companyId,
            companyFees.office,
            companyFees.electric,
            companyFees.water,
            '管理',
          ),
          children,
        };

        companyIndex += 1;
        if (companyIndex < companyCount) {
          window.setTimeout(buildCompany, 0);
          return;
        }

        const groupFees = {
          office: companyFees.office * companyCount,
          electric: companyFees.electric * companyCount,
          water: companyFees.water * companyCount,
        };
        const treeData: ETableTreeNode[] = [
          {
            id: 'group-scaled',
            label: '费用预算压测集团',
            collapsed: true,
            attributes: makeSubjectAttributes(
              'group-scaled',
              groupFees.office,
              groupFees.electric,
              groupFees.water,
              '管理',
            ),
            children: companies,
          },
        ];

        onProgress?.(100);
        resolve({ treeData, flatRowCount, orgCount });
      };

      buildDepts();
    };

    buildCompany();
  });
