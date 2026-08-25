import ETable from '@/components/UniverTable';
import { defaultContextMenuItems } from '@/components/UniverTable/contextMenu';
import type { ETableColumn, ETableRow, ETableRowGroup, ETableMerge, ETableOptions, ETableColumnGroup } from '@/components/UniverTable/types';

interface UniverTableProps {
  // 多级表头
  columns?: ETableColumn[];
  // 表格数据
  rows?: ETableRow[];
  // 行分组
  rowGroups?: ETableRowGroup[];
  // 列分组
  columnGroups?: ETableColumnGroup[];
  // 合并单元格
  merges?: ETableMerge[];
  // 表格配置
  options?: ETableOptions;
}

/**
 * =========================================================
 * 默认表头
 * =========================================================
 *
 * 结构：
 *
 * 组织机构
 * 预算项目
 * 费用科目
 *
 * 2026年度预算
 * ├── 上半年
 * │   ├── 第一季度
 * │   │   ├── 1月
 * │   │   ├── 2月
 * │   │   └── 3月
 * │   └── 第二季度
 * │       ├── 4月
 * │       ├── 5月
 * │       └── 6月
 *
 * └── 下半年
 *     ├── 第三季度
 *     │   ├── 7月
 *     │   ├── 8月
 *     │   └── 9月
 *     └── 第四季度
 *         ├── 10月
 *         ├── 11月
 *         └── 12月
 *
 * 注意：
 * org / project / subject 是叶子列。
 * ETable 的 renderHeader 应该负责把这些叶子列纵向合并到最大表头深度。
 */
const defaultColumns: ETableColumn[] = [
  { id: 'org', title: '组织机构', width: 140 },
  { id: 'project', title: '预算项目', width: 160 },
  { id: 'subject', title: '费用科目', width: 140 },
  {
    id: 'budget2026',
    title: '2026年度预算',
    children: [
      {
        id: 'firstHalf',
        title: '上半年',
        children: [
          {
            id: 'q1',
            title: '第一季度',
            children: [
              { id: 'jan', title: '1月', width: 100 },
              { id: 'feb', title: '2月', width: 100 },
              { id: 'mar', title: '3月', width: 100 },
            ],
          },
          {
            id: 'q2',
            title: '第二季度',
            children: [
              { id: 'apr', title: '4月', width: 100 },
              { id: 'may', title: '5月', width: 100 },
              { id: 'jun', title: '6月', width: 100 },
            ],
          },
        ],
      },
      {
        id: 'secondHalf',
        title: '下半年',
        children: [
          {
            id: 'q3',
            title: '第三季度',
            children: [
              { id: 'jul', title: '7月', width: 100 },
              { id: 'aug', title: '8月', width: 100 },
              { id: 'sep', title: '9月', width: 100 },
            ],
          },
          {
            id: 'q4',
            title: '第四季度',
            children: [
              { id: 'oct', title: '10月', width: 100 },
              { id: 'nov', title: '11月', width: 100 },
              { id: 'dec', title: '12月', width: 100 },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * =========================================================
 * 默认数据
 * =========================================================
 */
const defaultRows: ETableRow[] = [
  // index: 0
  {
    id: 'r1',
    data: {
      org: '华东销售中心',
      project: '市场推广费',
      subject: '广告费',
      jan: 100000, feb: 120000, mar: 130000,
      apr: 140000, may: 150000, jun: 160000,
      jul: 170000, aug: 180000, sep: 190000,
      oct: 200000, nov: 210000, dec: 220000,
    },
  },
  // index: 1
  {
    id: 'r2',
    data: {
      org: '华东销售中心',
      project: '市场推广费',
      subject: '活动费',
      jan: 80000, feb: 85000, mar: 90000,
      apr: 95000, may: 100000, jun: 105000,
      jul: 110000, aug: 115000, sep: 120000,
      oct: 125000, nov: 130000, dec: 135000,
    },
  },
  // index: 2
  {
    id: 'r3',
    data: {
      org: '华东销售中心',
      project: '差旅费',
      subject: '交通费',
      jan: 30000, feb: 32000, mar: 35000,
      apr: 36000, may: 38000, jun: 40000,
      jul: 42000, aug: 45000, sep: 48000,
      oct: 50000, nov: 52000, dec: 55000,
    },
  },
  // index: 3
  {
    id: 'r4',
    data: {
      org: '华东销售中心',
      project: '差旅费',
      subject: '住宿费',
      jan: 20000, feb: 22000, mar: 25000,
      apr: 26000, may: 28000, jun: 30000,
      jul: 32000, aug: 35000, sep: 38000,
      oct: 40000, nov: 42000, dec: 45000,
    },
  },
  // index: 4
  {
    id: 'r5',
    data: {
      org: '华南销售中心',
      project: '市场推广费',
      subject: '广告费',
      jan: 120000, feb: 125000, mar: 130000,
      apr: 135000, may: 140000, jun: 145000,
      jul: 150000, aug: 155000, sep: 160000,
      oct: 165000, nov: 170000, dec: 175000,
    },
  },
  // index: 5
  {
    id: 'r6',
    data: {
      org: '华南销售中心',
      project: '市场推广费',
      subject: '活动费',
      jan: 60000, feb: 65000, mar: 70000,
      apr: 75000, may: 80000, jun: 85000,
      jul: 90000, aug: 95000, sep: 100000,
      oct: 105000, nov: 110000, dec: 115000,
    },
  },
  // index: 6
  {
    id: 'r7',
    data: {
      org: '总部',
      project: '管理费用',
      subject: '办公费',
      jan: 50000, feb: 52000, mar: 55000,
      apr: 58000, may: 60000, jun: 62000,
      jul: 65000, aug: 68000, sep: 70000,
      oct: 72000, nov: 75000, dec: 78000,
    },
  },
];

/**
 * =========================================================
 * 默认行分组
 * =========================================================
 */
const defaultRowGroups: ETableRowGroup[] = [
  {
    id: 'east',
    startRow: 0, // 华东销售中心 (数据 index 0 ~ 3)
    count: 4,
    children: [
      { id: 'east-market', startRow: 0, count: 2 }, // 市场推广费 (数据 index 0 ~ 1)
      { id: 'east-travel', startRow: 2, count: 2 }, // 差旅费 (数据 index 2 ~ 3)
    ],
  },
  {
    id: 'south',
    startRow: 4, // 华南销售中心 (数据 index 4 ~ 5)
    count: 2,
  },
  {
    id: 'head-office',
    startRow: 6, // 总部 (数据 index 6)
    count: 1,
  },
];

/**
 * =========================================================
 * 默认列分组
 * =========================================================
 */
const defaultColumnGroups: ETableColumnGroup[] = [
  {
    id: 'first-half',
    startColumn: 3, // 1月 (列索引 3) 到 6月 (列索引 8)
    count: 6,
    children: [
      { id: 'q1', startColumn: 3, count: 3 }, // 1~3月
      { id: 'q2', startColumn: 6, count: 3 }, // 4~6月
    ],
  },
  {
    id: 'second-half',
    startColumn: 9, // 7月 (列索引 9) 到 12月 (列索引 14)
    count: 6,
    children: [
      { id: 'q3', startColumn: 9, count: 3 }, // 7~9月
      { id: 'q4', startColumn: 12, count: 3 }, // 10~12月
    ],
  },
];

/**
 * =========================================================
 * 默认合并
 * =========================================================
 */
const defaultMerges: ETableMerge[] = [
  // 左下角：费用合计单元格 (在数据下方，合并 2 行 3 列)
  {
    id: 'special-sum',
    row: 7, // 相对数据行号 7 (物理行：4 + 7 = 11 行)
    column: 0,
    rowSpan: 1,
    columnSpan: 3,
    value: '费用合计',
  },
  // 底部：专项预算区域
  {
    id: 'special-budget',
    row: 8, // 相对数据行号 8 (物理行：4 + 8 = 12 行)
    column: 0,
    rowSpan: 2,
    columnSpan: 3,
    value: '专项预算',
  },
];

/**
 * =========================================================
 * 默认配置
 * =========================================================
 */
const defaultOptions: ETableOptions = {
  name: '2026年度预算表',
  // 默认列宽
  defaultColumnWidth: 100,
  // 默认行高
  defaultRowHeight: 32,
  // 显示网格线
  showGridLines: true,
  // 冻结 4 行业务表头
  freezeRows: 4,
  // 冻结前三列
  freezeColumns: 3,
  // 自定义 Univer 原生列头
  customizeColumnHeader: true,
  // 注入右键菜单项配置
  contextMenuItems: defaultContextMenuItems,
  // 开启自定义右键菜单
  enableContextMenu: true,
} as any;

const UniverTable = ({ columns = defaultColumns, rows = defaultRows, rowGroups = defaultRowGroups, columnGroups = defaultColumnGroups, merges = defaultMerges, options = defaultOptions }: UniverTableProps) => {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <ETable
        columns={columns}
        rows={rows}
        rowGroups={rowGroups}
        columnGroups={columnGroups}
        merges={merges}
        options={options}
      />
    </div>
  );
};

export default UniverTable;
