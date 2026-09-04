/**
 * 费用预算表 · 树形行数据
 *
 * 组织（对齐截图）：
 * 华润微电子集团
 *   ├─ 华润微电子本部
 *   ├─ 华晶公司
 *   │    ├─ 华晶公司-销售部
 *   │    ├─ 华晶公司-财务部
 *   │    ├─ 华晶公司-行政部
 *   │    └─ 华晶公司-研发部
 *   └─ 上华公司
 *        └─ 上华公司-销售部
 *
 * 科目（每个组织固定 5 行）：
 * 费用汇总
 *   └─ 日常费用合计
 *        ├─ 费用-办公费
 *        ├─ 费用-电费
 *        └─ 费用-水费
 *
 * 默认全部折叠。
 */
import type {
  ETableCell,
  ETablePrimitive,
  ETableTreeAttribute,
  ETableTreeNode,
} from '@/components/UniverTable/types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type MeasureValues = Record<string, ETablePrimitive | ETableCell>;

const fillMonths = (monthly: number): MeasureValues => {
  const values: MeasureValues = {};
  MONTHS.forEach((m) => {
    values[`m${m}`] = monthly;
  });
  return values;
};

/** 汇总行功能属性固定为「-」且不可编辑 */
const LOCKED_FUNC_ATTR: ETableCell = { value: '-', editable: false };

const measureValues = (
  monthly: number,
  funcAttr: string | ETableCell,
): MeasureValues => ({
  funcAttr,
  yearTotal: Number((monthly * 12).toFixed(2)),
  ...fillMonths(monthly),
});

/** 单组织叶子科目月度金额（对齐截图：办公 100 / 电 200 / 水 300） */
type LeafFees = {
  office: number;
  electric: number;
  water: number;
};

const DEFAULT_LEAF: LeafFees = { office: 100, electric: 200, water: 300 };

const scaleFees = (fees: LeafFees, n: number): LeafFees => ({
  office: fees.office * n,
  electric: fees.electric * n,
  water: fees.water * n,
});

const sumFees = (...list: LeafFees[]): LeafFees =>
  list.reduce(
    (acc, cur) => ({
      office: acc.office + cur.office,
      electric: acc.electric + cur.electric,
      water: acc.water + cur.water,
    }),
    { office: 0, electric: 0, water: 0 },
  );

const feesMonthlyTotal = (fees: LeafFees) =>
  fees.office + fees.electric + fees.water;

/**
 * 科目属性：费用汇总 → 日常费用合计 → 办公/电/水
 * depth 表达缩进层级；collapsed 默认收起。
 */
const makeSubjectAttributes = (
  prefix: string,
  fees: LeafFees,
  leafFuncAttr: string,
  options?: { collapsed?: boolean; subtotalLabel?: string },
): ETableTreeAttribute[] => {
  const total = feesMonthlyTotal(fees);
  const collapsed = options?.collapsed ?? true;
  const subtotalLabel = options?.subtotalLabel ?? '日常费用合计';

  return [
    {
      id: `${prefix}-summary`,
      label: '费用汇总',
      collapsed,
      values: measureValues(total, LOCKED_FUNC_ATTR),
      children: [
        {
          id: `${prefix}-daily-total`,
          label: subtotalLabel,
          depth: 1,
          collapsed: true,
          values: measureValues(total, LOCKED_FUNC_ATTR),
          children: [
            {
              id: `${prefix}-office`,
              label: '费用-办公费',
              depth: 2,
              values: measureValues(fees.office, leafFuncAttr),
            },
            {
              id: `${prefix}-electric`,
              label: '费用-电费',
              depth: 2,
              values: measureValues(fees.electric, leafFuncAttr),
            },
            {
              id: `${prefix}-water`,
              label: '费用-水费',
              depth: 2,
              values: measureValues(fees.water, leafFuncAttr),
            },
          ],
        },
      ],
    },
  ];
};

const makeOrgNode = (
  id: string,
  label: string,
  fees: LeafFees,
  leafFuncAttr: string,
  children?: ETableTreeNode[],
  options?: { subtotalLabel?: string },
): ETableTreeNode => ({
  id,
  label,
  collapsed: true,
  attributes: makeSubjectAttributes(id, fees, leafFuncAttr, {
    collapsed: true,
    subtotalLabel: options?.subtotalLabel,
  }),
  ...(children?.length ? { children } : {}),
});

/**
 * 费用-办公费 / 电费 / 水费 行的功能属性（对齐截图）：
 * 汇总与合计行为「-」，三项明细按组织挂 管理 / 销售 / 研发。
 */
/** 华晶各部门（叶子） */
const huajingSales = makeOrgNode(
  'hj-sales',
  '华晶公司-销售部',
  DEFAULT_LEAF,
  '销售',
  undefined,
  { subtotalLabel: '管理费用合计' },
);
const huajingFinance = makeOrgNode(
  'hj-finance',
  '华晶公司-财务部',
  DEFAULT_LEAF,
  '销售',
  undefined,
  { subtotalLabel: '管理费用合计' },
);
const huajingAdmin = makeOrgNode(
  'hj-admin',
  '华晶公司-行政部',
  DEFAULT_LEAF,
  '管理',
);
const huajingRd = makeOrgNode(
  'hj-rd',
  '华晶公司-研发部',
  DEFAULT_LEAF,
  '研发',
);

/** 华晶公司汇总 = 4 个部门 */
const HUOJING_FEES = scaleFees(DEFAULT_LEAF, 4);

/** 上华销售部 */
const shanghuaSales = makeOrgNode(
  'sh-sales',
  '上华公司-销售部',
  DEFAULT_LEAF,
  '销售',
);

/** 上华公司 = 销售部 */
const SHANGHUA_FEES = DEFAULT_LEAF;

/** 本部 */
const HQ_FEES = DEFAULT_LEAF;

/** 集团 = 本部 + 华晶 + 上华 */
const GROUP_FEES = sumFees(HQ_FEES, HUOJING_FEES, SHANGHUA_FEES);

/**
 * 组织树（对齐截图，默认全部折叠）
 * 办公费/电费/水费均带功能属性；费用汇总、日常/管理费用合计为「-」。
 */
export const expenseBudgetTreeData: ETableTreeNode[] = [
  makeOrgNode(
    'group',
    '华润微电子集团',
    GROUP_FEES,
    '管理',
    [
      makeOrgNode('hq', '华润微电子本部', HQ_FEES, '管理', undefined, {
        subtotalLabel: '管理费用合计',
      }),
      makeOrgNode('hj', '华晶公司', HUOJING_FEES, '管理', [
        huajingSales,
        huajingFinance,
        huajingAdmin,
        huajingRd,
      ]),
      makeOrgNode('sh', '上华公司', SHANGHUA_FEES, '管理', [shanghuaSales]),
    ],
  ),
];

/**
 * 组织节点数：
 * 集团 + 本部 + 华晶 + 销售/财务/行政/研发 + 上华 + 上华销售 = 9
 */
export const EXPENSE_BUDGET_ORG_COUNT = 9;
