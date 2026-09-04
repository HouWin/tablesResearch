/*
 * @Author: 知恩gg lichao.zhao@dxdstech.com
 * @Date: 2026-09-03 11:48:08
 * @LastEditors: 知恩gg lichao.zhao@dxdstech.com
 * @LastEditTime: 2026-09-03 15:25:48
 * @FilePath: /demo/tablesResearch/src/pages/UniverTable/expenseBudgetHeader.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * 费用预算表 · 表头与 treeConfig
 *
 * 对齐截图「费用预算表」：
 * 组织 / 科目 / 功能属性 / 2025年（全年合计 + 1–12月）
 */
import type {
  ETableColumn,
  ETableTreeConfig,
} from '@/components/UniverTable/types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const monthMeasureFields = MONTHS.map((m) => ({
  field: `m${m}`,
  title: `${m}月`,
  width: 88,
  type: 'number' as const,
  numberFormat: '#,##0.00',
}));

/** 多级表头：组织 / 科目 / 功能属性 / 2025年（全年合计 + 1–12月） */
export const expenseBudgetHeaderColumns: ETableColumn[] = [
  {
    id: 'organization',
    title: '组织',
    width: 200,
    editable: false,
  },
  {
    id: 'subject',
    title: '科目',
    width: 140,
    editable: false,
  },
  {
    id: 'funcAttr',
    title: '功能属性',
    width: 96,
  },
  {
    id: 'year',
    title: '2025年',
    children: [
      {
        id: 'yearTotal',
        title: '全年合计',
        width: 110,
        type: 'number',
        numberFormat: '#,##0.00',
      },
      ...MONTHS.map((m) => ({
        id: `m${m}`,
        title: `${m}月`,
        width: 88,
        type: 'number' as const,
        numberFormat: '#,##0.00',
      })),
    ],
  },
];

export const expenseBudgetTreeConfig: ETableTreeConfig = {
  treeUI: true,
  labelMode: 'single',
  collapseAttributes: true,
  defaultCollapsed: true,
  dimensions: [{ field: 'organization', title: '组织', width: 200 }],
  attribute: { field: 'subject', title: '科目', width: 140 },
  headerColumns: expenseBudgetHeaderColumns,
  measures: [
    {
      field: 'funcAttr',
      title: '功能属性',
      width: 96,
    },
    {
      field: 'yearTotal',
      title: '全年合计',
      width: 110,
      type: 'number',
      numberFormat: '#,##0.00',
    },
    ...monthMeasureFields,
  ],
  rowBackgrounds: ['#F7FBFF', '#F0F5FF'],
  regionDetailBackground: '#FFFBF0',
};

export const EXPENSE_BUDGET_HEADER_DEPTH = 2;
export const EXPENSE_BUDGET_FREEZE_COLS = 3;
/** 全年合计 + 12 个月 */
export const EXPENSE_BUDGET_VALUE_COLS = 13;
