import ETable from '@/components/UniverTable';
import { defaultContextMenuItems } from '@/components/UniverTable/contextMenu';
import type {
  ETableOptions,
  ETableTreeAttribute,
  ETableTreeConfig,
  ETableTreeNode,
} from '@/components/UniverTable/types';

/**
 * 对齐目标图：Category | Region | Sales | Profit
 *
 * - 第 1 列 Category：行树折叠（Furniture → Bookcases…）
 * - 第 2 列 Region：独立折叠（East → Central / West / South）
 * - 两者互不影响
 */
const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const treeConfig: ETableTreeConfig = {
  treeUI: true,
  labelMode: 'single',
  collapseAttributes: true,
  dimensions: [{ field: 'category', title: 'Category', width: 180 }],
  attribute: { field: 'region', title: 'Region', width: 120 },
  measures: [
    { field: 'sales', title: 'Sales', width: 130 },
    { field: 'profit', title: 'Profit', width: 130 },
  ],
};

/** East 默认展示；展开 Region 后显示其他地区（与 Category 无关） */
const regionAttributes = (
  prefix: string,
  east: [number, number],
  central: [number, number],
  west: [number, number],
  south: [number, number],
): ETableTreeAttribute[] => [
  {
    id: `${prefix}-east`,
    label: 'East',
    collapsed: true,
    values: { sales: money(east[0]), profit: money(east[1]) },
  },
  {
    id: `${prefix}-central`,
    label: 'Central',
    values: { sales: money(central[0]), profit: money(central[1]) },
  },
  {
    id: `${prefix}-west`,
    label: 'West',
    values: { sales: money(west[0]), profit: money(west[1]) },
  },
  {
    id: `${prefix}-south`,
    label: 'South',
    values: { sales: money(south[0]), profit: money(south[1]) },
  },
];

const treeData: ETableTreeNode[] = [
  {
    id: 'furniture',
    label: 'Furniture',
    collapsed: false,
    attributes: regionAttributes(
      'furniture',
      [208291.2, 3046.17],
      [52000, 2100],
      [48000, 1800],
      [41000, -900],
    ),
    children: [
      {
        id: 'bookcases',
        label: 'Bookcases',
        attributes: regionAttributes(
          'bookcases',
          [43819.33, -1167.63],
          [12000, 400],
          [9800, -200],
          [7500, 120],
        ),
      },
      {
        id: 'chairs',
        label: 'Chairs',
        attributes: regionAttributes(
          'chairs',
          [98621.45, 5240.18],
          [22000, 1100],
          [18500, 900],
          [16000, 700],
        ),
      },
      {
        id: 'furnishings',
        label: 'Furnishings',
        attributes: regionAttributes(
          'furnishings',
          [21540.9, 832.4],
          [6200, 300],
          [5100, 180],
          [4300, 90],
        ),
      },
      {
        id: 'tables',
        label: 'Tables',
        attributes: regionAttributes(
          'tables',
          [44309.52, -1858.78],
          [11800, -400],
          [9600, -300],
          [8200, -220],
        ),
      },
    ],
  },
  {
    id: 'office-supplies',
    label: 'Office Supplies',
    collapsed: true,
    attributes: regionAttributes(
      'office',
      [205516.05, 41014.28],
      [58000, 12000],
      [49000, 9800],
      [42000, 7200],
    ),
    children: [
      {
        id: 'binders',
        label: 'Binders',
        attributes: regionAttributes(
          'binders',
          [72000, 12000],
          [18000, 3200],
          [15000, 2800],
          [12000, 2100],
        ),
      },
      {
        id: 'paper',
        label: 'Paper',
        attributes: regionAttributes(
          'paper',
          [53000, 15000],
          [14000, 4000],
          [11000, 3200],
          [9000, 2500],
        ),
      },
      {
        id: 'storage',
        label: 'Storage',
        attributes: regionAttributes(
          'storage',
          [80516.05, 14014.28],
          [21000, 3600],
          [17000, 2900],
          [14000, 2200],
        ),
      },
    ],
  },
  {
    id: 'technology',
    label: 'Technology',
    collapsed: true,
    attributes: regionAttributes(
      'tech',
      [269870.85, 48275.14],
      [72000, 13000],
      [65000, 11000],
      [58000, 9200],
    ),
    children: [
      {
        id: 'phones',
        label: 'Phones',
        attributes: regionAttributes(
          'phones',
          [110000, 20000],
          [28000, 5200],
          [24000, 4100],
          [20000, 3500],
        ),
      },
      {
        id: 'accessories',
        label: 'Accessories',
        attributes: regionAttributes(
          'accessories',
          [90000, 18000],
          [23000, 4500],
          [19000, 3800],
          [16000, 3000],
        ),
      },
      {
        id: 'machines',
        label: 'Machines',
        attributes: regionAttributes(
          'machines',
          [69870.85, 10275.14],
          [18000, 2800],
          [15000, 2200],
          [12000, 1800],
        ),
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
  freezeColumns: 0,
  customizeColumnHeader: true,
  contextMenuItems: defaultContextMenuItems,
  enableContextMenu: true,
} as any;

const UniverTablePage = () => {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <div style={{ padding: '8px 12px', color: '#595959', fontSize: 13 }}>
        第 1 列 Category、第 2 列 Region 均可折叠，互不影响：点 Category 展开子类；点
        Region 的 ▶ 展开 Central / West / South。
      </div>
      <ETable
        treeData={treeData}
        treeConfig={treeConfig}
        options={defaultOptions}
      />
    </div>
  );
};

export default UniverTablePage;
