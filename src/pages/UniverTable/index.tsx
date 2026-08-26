import ETable from '@/components/UniverTable';
import { defaultContextMenuItems } from '@/components/UniverTable/contextMenu';
import type {
  ETableAttachment,
  ETableOptions,
  ETableTreeConfig,
  ETableTreeNode,
} from '@/components/UniverTable/types';
import { message } from 'antd';

/**
 * =========================================================
 * 树形 + 属性 示例（行折叠 + 列折叠 + 单元格附件）
 * =========================================================
 *
 * 行：Category 树 + Region 属性层（左侧大纲）
 * 列：Region 两列一组、Sales/Profit 指标一组（顶部大纲）
 * 附件：右键单元格 → 添加附件 / 查看附件 / 清空附件
 */
const treeConfig: ETableTreeConfig = {
  labelMode: 'single',
  collapseAttributes: true,
  dimensions: [
    { field: 'category', title: 'Category', width: 140 },
    { field: 'region', title: 'Region', width: 100 },
  ],
  attribute: { field: 'attribute', title: 'Region', width: 120 },
  measures: [
    { field: 'sales', title: 'Sales', width: 120 },
    { field: 'profit', title: 'Profit', width: 120 },
  ],
  columnGroups: [
    {
      id: 'region-cols',
      fields: ['region', 'attribute'],
    },
    {
      id: 'metrics',
      fields: ['sales', 'profit'],
    },
  ],
};

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const regionAttributes = (
  prefix: string,
  eastSales: number,
  eastProfit: number,
  withEastDetails = false,
): ETableTreeNode['attributes'] => [
  {
    id: `${prefix}-attr-east`,
    label: 'East',
    values: {
      sales: money(eastSales),
      profit: money(eastProfit),
    },
    collapsed: true,
    children: withEastDetails
      ? [
          {
            id: `${prefix}-east-d1`,
            label: 'East / Retail',
            values: {
              sales: money(eastSales * 0.6),
              profit: money(Number((eastProfit * 0.6).toFixed(2))),
            },
          },
          {
            id: `${prefix}-east-d2`,
            label: 'East / Wholesale',
            values: {
              sales: money(eastSales * 0.4),
              profit: money(Number((eastProfit * 0.4).toFixed(2))),
            },
          },
        ]
      : undefined,
  },
  { id: `${prefix}-attr-central`, label: 'Central' },
  { id: `${prefix}-attr-west`, label: 'West' },
  { id: `${prefix}-attr-south`, label: 'South' },
];

const treeData: ETableTreeNode[] = [
  {
    id: 'furniture',
    label: 'Furniture',
    children: [
      {
        id: 'bookcases',
        label: 'Bookcases',
        data: { region: 'East' },
        attributes: regionAttributes('bookcases', 43819.33, -1167.63, true),
      },
      {
        id: 'chairs',
        label: 'Chairs',
        data: { region: 'East' },
        attributes: regionAttributes('chairs', 98621.45, 5240.18),
      },
      {
        id: 'furnishings',
        label: 'Furnishings',
        data: { region: 'East' },
        attributes: regionAttributes('furnishings', 21540.9, 832.4),
      },
    ],
  },
];

/**
 * 演示附件：挂在 Bookcases / East 的 Sales 单元格
 * 表头 1 行 + 数据 index 2 → Excel D4
 */
const demoAttachments: ETableAttachment[] = [
  {
    cell: 'D4',
    files: [
      {
        id: 'demo-att-1',
        name: 'bookcases-east-sales.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        size: 13264,
        mimeType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
      },
    ],
  },
];

const defaultOptions: ETableOptions = {
  name: 'Sales by Category',
  defaultColumnWidth: 110,
  defaultRowHeight: 32,
  showGridLines: true,
  freezeRows: 1,
  freezeColumns: 1,
  customizeColumnHeader: true,
  contextMenuItems: defaultContextMenuItems,
  enableContextMenu: true,
} as any;

const UniverTablePage = () => {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <div style={{ padding: '8px 12px', color: '#595959', fontSize: 13 }}>
        右键单元格可「添加附件 / 查看附件 / 清空附件」。D4 已预置演示附件。
      </div>
      <ETable
        treeData={treeData}
        treeConfig={treeConfig}
        attachments={demoAttachments}
        options={defaultOptions}
        onAttachmentsChange={(cell, files) => {
          message.info(`${cell} 附件数量：${files.length}`);
        }}
      />
    </div>
  );
};

export default UniverTablePage;
