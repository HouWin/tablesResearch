/**
 * ============================================================================
 * UniverTable 演示页（路由：/UniverTable）
 * ============================================================================
 *
 * 演示 ETable 组件的能力：
 * - 费用预算表（默认）：treeData + treeUI，组织→科目折叠，2021年月度
 * - 三层多级表头（品类/子品类/区域 + 经营指标 + 业务治理）
 * - 树形数据 treeData + treeConfig（单元格内 ▶/▼ 折叠）
 * - 1万～100万行大数据压测（generateScaledTreeData + liteMode）
 * - 工具栏：展开/折叠、全屏、动态追加列、虚拟滚动开关
 * - 侧栏：单元格变更历史、数据追踪、面包屑
 *
 * 数据流：
 *   费用预算 / 经营树 → flattenTreeData → Worksheet 二维网格
 *   onCellChange → setTracks（演示用，未回写源数据）
 *
 * 技术文档：tablesResearch/docs/UniverTable.md
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Tree,
  message,
} from 'antd';
import {
  ExpandAltOutlined,
  ShrinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  UndoOutlined,
  RedoOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import ETable from '@/components/UniverTable';
import { defaultContextMenuItems } from '@/components/UniverTable/contextMenu';
import {
  expenseBudgetTreeData,
  EXPENSE_BUDGET_ORG_COUNT,
} from './expenseBudgetData';
import {
  expenseBudgetTreeConfig,
  EXPENSE_BUDGET_FREEZE_COLS,
  EXPENSE_BUDGET_HEADER_DEPTH,
  EXPENSE_BUDGET_VALUE_COLS,
} from './expenseBudgetHeader';
import { generateScaledTreeData } from '@/components/UniverTable/treeDataGenerator';
import type {
  ETableCell,
  ETableCellChangeRecord,
  ETableColumn,
  ETableDataTraceNode,
  ETableDimensionInfo,
  ETableOptions,
  ETablePrimitive,
  ETableRef,
  ETableTreeAttribute,
  ETableTreeConfig,
  ETableTreeNode,
} from '@/components/UniverTable/types';

/** 数据规模选项：budget 为费用预算行维度；tree 为固定演示树；数字为展平后的目标行数 */
const DATA_SCALE_OPTIONS = [
  { value: 'budget', label: '费用预算（树形折叠）' },
  { value: 'tree', label: '树形演示' },
  { value: 10000, label: '1万行（树形）' },
  { value: 50000, label: '5万行（树形）' },
  { value: 100000, label: '10万行（树形）' },
  { value: 500000, label: '50万行（树形）' },
  { value: 1000000, label: '100万行（树形）' },
] as const;

type DataScale = (typeof DATA_SCALE_OPTIONS)[number]['value'];

const STATUS_OPTIONS = ['已核验', '待复核', '异常'] as const;
const VERIFIED_OPTIONS = ['是', '否'] as const;

/** 固定指标列（叶子列）：与 buildHeaderColumns / treeConfig.measures 的 field 一一对应 */
const LEAF_MEASURES: ETableColumn[] = [
  {
    id: 'revenue',
    title: '净收入',
    width: 112,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'productRevenue',
    title: '商品收入',
    width: 108,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'serviceRevenue',
    title: '服务收入',
    width: 108,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'orders',
    title: '订单数',
    width: 92,
    type: 'number',
    numberFormat: '#,##0',
  },
  {
    id: 'onlineOrders',
    title: '线上订单',
    width: 92,
    type: 'number',
    numberFormat: '#,##0',
  },
  {
    id: 'offlineOrders',
    title: '线下订单',
    width: 92,
    type: 'number',
    numberFormat: '#,##0',
  },
  {
    id: 'avgOrder',
    title: '客单价',
    width: 98,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'completion',
    title: '目标达成',
    width: 96,
    type: 'number',
    numberFormat: '0.0%',
  },
  { id: 'owner', title: '负责人', width: 84 },
  {
    id: 'status',
    title: '核验状态',
    width: 96,
    type: 'select',
    options: [...STATUS_OPTIONS],
  },
  {
    id: 'verified',
    title: '已核验',
    width: 82,
    type: 'select',
    options: [...VERIFIED_OPTIONS],
  },
  {
    id: 'updatedAt',
    title: '更新日期',
    width: 104,
    type: 'date',
    numberFormat: 'yyyy-mm-dd',
  },
  { id: 'attachment', title: '附件', width: 120 },
  {
    id: 'adjustmentFactor',
    title: '调整系数',
    width: 96,
    type: 'number',
    numberFormat: '0.00',
  },
];

/** 工具栏可动态追加的扩展指标列（会合并进 headerColumns 与 measures） */
const OPTIONAL_COLUMNS: ETableColumn[] = [
  {
    id: 'cost',
    title: '成本',
    width: 100,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'profit',
    title: '毛利',
    width: 100,
    type: 'number',
    numberFormat: '¥#,##0',
  },
  {
    id: 'margin',
    title: '毛利率',
    width: 96,
    type: 'number',
    numberFormat: '0.0%',
  },
  {
    id: 'refundCount',
    title: '退单数',
    width: 92,
    type: 'number',
    numberFormat: '#,##0',
  },
  { id: 'remark', title: '备注', width: 120 },
];

/** 为缺失的扩展列生成演示用随机值 */
const makeExtraColumnValue = (
  column: ETableColumn,
  seed: number,
  rowValues?: Record<string, ETablePrimitive>,
): ETablePrimitive => {
  const revenue = Number(rowValues?.revenue ?? (seed * 97) % 500000 + 50000);
  const orders = Number(rowValues?.orders ?? (seed * 13) % 800 + 50);
  switch (column.id) {
    case 'cost':
      return Math.round(revenue * (0.55 + (seed % 10) / 100));
    case 'profit':
      return Math.round(revenue * (0.25 + (seed % 8) / 100));
    case 'margin':
      return Number((0.18 + (seed % 12) / 100).toFixed(3));
    case 'refundCount':
      return (seed * 3) % 40;
    case 'remark':
      return `备注-${(seed % 100) + 1}`;
    default:
      return column.type === 'number' ? seed % 1000 : '';
  }
};

/** 合并节点 values 并补齐扩展列字段 */
const enrichValues = (
  values: Record<string, ETablePrimitive | ETableCell> | undefined,
  columns: ETableColumn[],
  seed: number,
): Record<string, ETablePrimitive> => {
  const next: Record<string, ETablePrimitive> = {};
  Object.entries(values ?? {}).forEach(([key, value]) => {
    if (value !== null && typeof value === 'object' && 'value' in value) {
      next[key] = (value as { value?: ETablePrimitive }).value ?? '';
      return;
    }
    next[key] = value as ETablePrimitive;
  });
  columns.forEach((column) => {
    if (next[column.id] === undefined) {
      next[column.id] = makeExtraColumnValue(column, seed, next);
    }
  });
  return next;
};

/** 递归为树节点 / 属性 / 城市明细补齐扩展列数据 */
const enrichTreeWithColumns = (
  nodes: ETableTreeNode[],
  columns: ETableColumn[],
  seedBase = 1,
): ETableTreeNode[] =>
  nodes.map((node, index) => {
    const seed = seedBase + index * 17;
    return {
      ...node,
      values: enrichValues(node.values, columns, seed),
      attributes: node.attributes?.map((attr, attrIndex) => ({
        ...attr,
        values: enrichValues(attr.values, columns, seed * 10 + attrIndex),
        children: attr.children?.map((child, childIndex) => ({
          ...child,
          values: enrichValues(child.values, columns, seed * 100 + childIndex),
        })),
      })),
      children: node.children
        ? enrichTreeWithColumns(node.children, columns, seed * 1000)
        : undefined,
    };
  });

/** treeConfig.measures 用 field；与表头叶子列 id 对齐 */
const toMeasureFields = (columns: ETableColumn[]) =>
  columns.map(({ id, title, width, type, options, numberFormat }) => ({
    field: id,
    title,
    width,
    type,
    options,
    numberFormat,
  }));

/** 三层表头：主行层级 / 扩展行层级 / 核心经营指标 / 业务治理 / 扩展指标 */
const buildHeaderColumns = (extraMeasures: ETableColumn[] = []): ETableColumn[] => [
  {
    id: 'main-hierarchy',
    title: '主行层级',
    children: [
      {
        id: 'rowTree',
        title: 'rowTree',
        children: [
          { id: 'category', title: '品类', width: 180, editable: false },
          { id: 'subcategory', title: '子品类', width: 120, editable: true },
        ],
      },
    ],
  },
  {
    id: 'ext-hierarchy',
    title: '扩展行层级',
    children: [
      {
        id: 'extensionRows',
        title: 'extensionRows',
        children: [
          { id: 'region', title: '区域', width: 140, editable: false },
        ],
      },
    ],
  },
  {
    id: 'core-metrics',
    title: '核心经营指标',
    children: [
      {
        id: 'revenue-metrics',
        title: '收入指标',
        children: LEAF_MEASURES.slice(0, 3),
      },
      {
        id: 'order-metrics',
        title: '订单指标',
        children: LEAF_MEASURES.slice(3, 7),
      },
      {
        id: 'target-mgmt',
        title: '目标管理',
        children: LEAF_MEASURES.slice(7, 8),
      },
    ],
  },
  {
    id: 'biz-gov',
    title: '业务治理',
    children: [
      {
        id: 'responsibility',
        title: '责任与核验',
        children: LEAF_MEASURES.slice(8, 11),
      },
      {
        id: 'record-info',
        title: '记录信息',
        children: LEAF_MEASURES.slice(11),
      },
    ],
  },
  ...(extraMeasures.length
    ? [
      {
        id: 'extra-metrics',
        title: '扩展指标',
        children: [
          {
            id: 'user-added',
            title: '追加列',
            children: extraMeasures,
          },
        ],
      },
    ]
    : []),
];

const HEADER_DEPTH = 3;   // 表头占用行数，与 freezeRows 一致
const HIERARCHY_COLS = 3; // 冻结左侧维度列数：品类 + 子品类 + 区域
const BASE_MEASURE_COUNT = LEAF_MEASURES.length;

/** 组装 treeConfig：维度、属性、三层表头、指标、分组统计 */
const buildTreeConfig = (extraMeasures: ETableColumn[] = []): ETableTreeConfig => {
  const allMeasures = [...LEAF_MEASURES, ...extraMeasures];
  const numericExtraFields = extraMeasures.filter((item) => item.type === 'number').map((item) => ({ field: item.id, method: 'sum' as const }));

  return {
    treeUI: true,
    labelMode: 'single',
    collapseAttributes: true,
    defaultCollapsed: true,
    dimensions: [
      { field: 'category', title: '品类', width: 180 },
      { field: 'subcategory', title: '子品类', width: 120, editable: true },
    ],
    attribute: { field: 'region', title: '区域', width: 140 },
    headerColumns: buildHeaderColumns(extraMeasures),
    measures: toMeasureFields(allMeasures),
    groupStatistics: {
      labelTemplate: '{label}',
      showGrandTotal: true,
      grandTotalLabel: '全部合计',
      grandTotalBackground: '#FFF7E6',
      fields: [
        { field: 'revenue', method: 'sum', name: '净收入合计' },
        { field: 'productRevenue', method: 'sum' },
        { field: 'serviceRevenue', method: 'sum' },
        { field: 'orders', method: 'sum' },
        { field: 'onlineOrders', method: 'sum' },
        { field: 'offlineOrders', method: 'sum' },
        ...numericExtraFields,
      ],
    },
  };
};

type Status = (typeof STATUS_OPTIONS)[number];

// ============================================================================
// 演示树数据构造：品类 → 子品类 → 区域（attributes）→ 城市（children）
// 结构对应 ETableTreeNode + ETableTreeAttribute，由 flattenTreeData 展平为二维 rows
// ============================================================================

/** 生成一行叶子节点的全部指标字段（净收入、订单、负责人等） */
const makeLeafValues = (
  revenue: number,
  orders: number,
  completion: number,
  owner: string,
  status: Status,
  updatedAt: string,
): Record<string, ETablePrimitive> => {
  const productRevenue = Math.round(revenue * 0.78);
  const onlineOrders = Math.round(orders * 0.63);
  return {
    revenue,
    productRevenue,
    serviceRevenue: revenue - productRevenue,
    orders,
    onlineOrders,
    offlineOrders: orders - onlineOrders,
    avgOrder: Math.round(revenue / Math.max(orders, 1)),
    completion,
    owner,
    status,
    verified: status === '已核验' ? '是' : '否',
    updatedAt,
    attachment: '+ 上传',
    adjustmentFactor: Number((0.8 + (orders % 31) / 100).toFixed(2)),
  };
};

const sumValues = (
  items: Array<Record<string, ETablePrimitive>>,
  owner: string,
  status: Status,
): Record<string, ETablePrimitive> => {
  const revenue = items.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0);
  const orders = items.reduce((sum, item) => sum + Number(item.orders ?? 0), 0);
  const completion =
    items.reduce((sum, item) => sum + Number(item.completion ?? 0), 0) /
    Math.max(items.length, 1);
  return makeLeafValues(revenue, orders, completion, owner, status, '2026-08-21');
};

const makeCity = (
  id: string,
  label: string,
  revenue: number,
  orders: number,
  completion: number,
  owner: string,
  status: Status,
  updatedAt: string,
) => ({
  id,
  label,
  values: makeLeafValues(revenue, orders, completion, owner, status, updatedAt),
});

/** 区域属性：可折叠，展开后显示城市明细（沿用原 Region 折叠方案） */
const makeRegionAttr = (
  id: string,
  label: string,
  cities: ReturnType<typeof makeCity>[],
  owner: string,
  collapsed = true,
): ETableTreeAttribute => ({
  id,
  label,
  collapsed,
  values: sumValues(
    cities.map((city) => city.values),
    owner,
    '已核验',
  ),
  children: cities,
});

/** 中间维度列（对齐原 Region=East）：每个节点都写入，保证子品类列无空单元格 */
const withSubcategoryDim = (
  nodes: ETableTreeNode[],
  subcategory = '华东',
): ETableTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      subcategory,
    },
    children: node.children
      ? withSubcategoryDim(node.children, subcategory)
      : undefined,
  }));

const furnitureBookcases: ETableTreeNode = {
  id: 'furniture-bookcases',
  label: '书柜',
  attributes: [
    makeRegionAttr(
      'bookcases-east',
      '华东',
      [
        makeCity('bookcases-shanghai', '上海', 2_086_400, 352, 0.982, '杨晨', '已核验', '2026-08-21'),
        makeCity('bookcases-jiangsu', '江苏', 1_638_400, 294, 0.953, '陈叶', '待复核', '2026-08-21'),
      ],
      '周宁',
    ),
    makeRegionAttr(
      'bookcases-central',
      '华中',
      [
        makeCity('bookcases-hubei', '湖北', 1_286_600, 238, 0.942, '孙毅', '已核验', '2026-08-21'),
        makeCity('bookcases-henan', '河南', 1_006_600, 206, 0.899, '徐昕', '待复核', '2026-08-20'),
      ],
      '赵敏',
    ),
  ],
};

const furnitureChairs: ETableTreeNode = {
  id: 'furniture-chairs',
  label: '座椅',
  attributes: [
    makeRegionAttr(
      'chairs-east',
      '华东',
      [
        makeCity('chairs-zhejiang', '浙江', 2_483_500, 414, 0.934, '吴哲', '已核验', '2026-08-20'),
        makeCity('chairs-anhui', '安徽', 1_783_500, 314, 0.904, '韩睿', '已核验', '2026-08-20'),
      ],
      '周宁',
    ),
    makeRegionAttr(
      'chairs-south',
      '华南',
      [
        makeCity('chairs-guangdong', '广东', 3_286_400, 596, 0.928, '黄清', '待复核', '2026-08-21'),
        makeCity('chairs-fujian', '福建', 1_527_800, 322, 0.881, '罗蔚', '已核验', '2026-08-20'),
      ],
      '苏然',
    ),
  ],
};

const officePaper: ETableTreeNode = {
  id: 'office-paper',
  label: '纸品',
  attributes: [
    makeRegionAttr(
      'paper-east',
      '华东',
      [
        makeCity('paper-shanghai', '上海', 1_486_400, 442, 0.972, '杨晨', '已核验', '2026-08-21'),
        makeCity('paper-nanjing', '南京', 1_138_400, 344, 0.943, '陈叶', '待复核', '2026-08-21'),
      ],
      '周宁',
    ),
    makeRegionAttr(
      'paper-north',
      '华北',
      [
        makeCity('paper-beijing', '北京', 1_686_600, 408, 0.922, '孙毅', '已核验', '2026-08-21'),
        makeCity('paper-tianjin', '天津', 906_600, 256, 0.889, '徐昕', '待复核', '2026-08-20'),
      ],
      '赵敏',
    ),
  ],
};

const officeStorage: ETableTreeNode = {
  id: 'office-storage',
  label: '收纳',
  attributes: [
    makeRegionAttr(
      'storage-central',
      '华中',
      [
        makeCity('storage-wuhan', '武汉', 1_583_500, 374, 0.924, '吴哲', '已核验', '2026-08-20'),
        makeCity('storage-changsha', '长沙', 1_183_500, 284, 0.894, '韩睿', '已核验', '2026-08-20'),
      ],
      '周宁',
    ),
    makeRegionAttr(
      'storage-south',
      '华南',
      [
        makeCity('storage-shenzhen', '深圳', 2_186_400, 496, 0.918, '黄清', '待复核', '2026-08-21'),
        makeCity('storage-xiamen', '厦门', 1_227_800, 302, 0.871, '罗蔚', '已核验', '2026-08-20'),
      ],
      '苏然',
    ),
  ],
};

/** 固定演示树：家具 / 办公用品，含书柜、椅子、纸张、收纳等子品类 */
const treeData: ETableTreeNode[] = withSubcategoryDim([
  {
    id: 'furniture',
    label: '家具',
    collapsed: true,
    attributes: [
      makeRegionAttr(
        'furniture-east',
        '华东',
        [
          makeCity('furniture-shanghai', '上海', 4_569_900, 766, 0.958, '林嘉', '已核验', '2026-08-21'),
          makeCity('furniture-jiangsu', '江苏', 3_421_900, 608, 0.928, '林嘉', '待复核', '2026-08-21'),
        ],
        '林嘉',
      ),
    ],
    children: [furnitureBookcases, furnitureChairs],
  },
  {
    id: 'office-supplies',
    label: '办公用品',
    collapsed: true,
    attributes: [
      makeRegionAttr(
        'office-east',
        '华东',
        [
          makeCity('office-shanghai', '上海', 2_624_800, 786, 0.958, '罗蔚', '待复核', '2026-08-21'),
          makeCity('office-nanjing', '南京', 2_322_000, 628, 0.918, '罗蔚', '已核验', '2026-08-20'),
        ],
        '罗蔚',
      ),
    ],
    children: [officePaper, officeStorage],
  },
]);

/** 传给 ETable 的默认工作表配置 */
const defaultOptions: ETableOptions = {
  name: '经营指标明细',
  defaultColumnWidth: 110,
  defaultRowHeight: 28,
  showGridLines: true,
  freezeRows: HEADER_DEPTH,
  freezeColumns: HIERARCHY_COLS,
  customizeColumnHeader: false,
  /** 隐藏原生 A/B/C 列标（业务表头已在单元格中） */
  showColumnHeader: false,
  /** Canvas 可视区绘制；≥5000 行时视口按页懒写入 */
  virtualScroll: true,
  contextMenuItems: defaultContextMenuItems,
  enableContextMenu: true,
} as any;

const countNodes = (nodes: ETableTreeNode[]): number =>
  nodes.reduce(
    (sum, node) => sum + 1 + (node.children ? countNodes(node.children) : 0),
    0,
  );

const TABLE_VIEW_HEIGHT = 560;

/** 保存接口：每个变更单元格一条，含行列维度 */
interface ETableCellSavePatch {
  cell: string;
  field?: string;
  columnId?: string;
  from: string;
  to: string;
  time: string;
  source?: ETableCellChangeRecord['source'];
  dataRow?: number;
  logicalRow?: number;
  rowDimensions?: ETableDimensionInfo[];
  columnDimensions?: ETableDimensionInfo[];
  rowPath?: string[];
  rowId?: string;
}

interface ETableSavePayload {
  updatedAt: string;
  changeCount: number;
  patches: ETableCellSavePatch[];
}

/** 按 cell 去重：保留最新 to / 维度，from 取最早一次编辑前的值 */
const dedupeTrackPatches = (records: ETableCellChangeRecord[]): Map<string, ETableCellSavePatch> => {
  const byCell = new Map<string, ETableCellSavePatch>();

  records.forEach((record) => {
    const existing = byCell.get(record.cell);
    if (!existing) {
      byCell.set(record.cell, {
        cell: record.cell,
        field: record.field,
        columnId: record.columnId ?? record.field,
        from: record.from,
        to: record.to,
        time: record.time,
        source: record.source,
        dataRow: record.dataRow,
        logicalRow: record.logicalRow,
        rowDimensions: record.rowDimensions,
        columnDimensions: record.columnDimensions,
        rowPath: record.rowPath,
        rowId: record.rowId,
      });
      return;
    }
    existing.from = record.from;
  });

  return byCell;
};

const readCellDisplay = (
  tableRef: RefObject<ETableRef | null>,
  cell: string,
): string | null => {
  const result = tableRef.current?.getCellValue(cell);
  if (!result?.success) {
    return null;
  }
  return result.displayValue;
};

/**
 * 构建保存数据：与 worksheet 当前值对齐。
 * 已回撤还原的单元格（当前值 === from）不会出现在 patches 中。
 */
const buildSavePayload = (
  records: ETableCellChangeRecord[],
  tableRef: RefObject<ETableRef | null>,
): ETableSavePayload => {
  const patches: ETableCellSavePatch[] = [];

  dedupeTrackPatches(records).forEach((patch) => {
    const current = readCellDisplay(tableRef, patch.cell);
    if (current === null || current === patch.from) {
      return;
    }
    patches.push({ ...patch, to: current });
  });

  return {
    updatedAt: new Date().toISOString(),
    changeCount: patches.length,
    patches,
  };
};

/** 回撤/重做后同步 tracks，只保留仍与初始值不同的单元格 */
const syncTracksFromWorksheet = (
  records: ETableCellChangeRecord[],
  tableRef: RefObject<ETableRef | null>,
): ETableCellChangeRecord[] => {
  const payload = buildSavePayload(records, tableRef);
  if (!payload.patches.length) {
    return [];
  }

  const latestByCell = new Map<string, ETableCellChangeRecord>();
  records.forEach((record) => {
    if (!latestByCell.has(record.cell)) {
      latestByCell.set(record.cell, record);
    }
  });

  return payload.patches.map((patch) => {
    const latest = latestByCell.get(patch.cell);
    if (!latest) {
      return null;
    }
    return { ...latest, to: patch.to };
  }).filter(Boolean) as ETableCellChangeRecord[];
};

/**
 * 演示页主组件：工具栏控制数据规模与表格选项，侧栏展示编辑历史与数据追踪
 */
const UniverTablePage = () => {
  // ETable 实例 ref，用于调用 expandAllRows / search / undo 等命令
  const tableRef = useRef<ETableRef>(null);
  /** 表格容器，用于仅表格区域全屏 */
  const tableShellRef = useRef<HTMLDivElement>(null);

  // ---------- 数据规模与生成状态 ----------
  const [dataScale, setDataScale] = useState<DataScale>('budget');
  const [scaledTreeData, setScaledTreeData] = useState<ETableTreeNode[] | null>(
    null,
  );
  const [flatRowCount, setFlatRowCount] = useState(0);
  const [sheetRowCount, setSheetRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tableKey, setTableKey] = useState(0);
  const [gridLines, setGridLines] = useState(true);
  const [freezeHeader, setFreezeHeader] = useState(false);
  const [contextMenu, setContextMenu] = useState(true);
  const [virtualScroll, setVirtualScroll] = useState(true);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [tableRendering, setTableRendering] = useState(false);
  const [tracks, setTracks] = useState<ETableCellChangeRecord[]>([]);
  const [focusCell, setFocusCell] = useState('D5');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceTree, setTraceTree] = useState<ETableDataTraceNode | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [addedColumns, setAddedColumns] = useState<ETableColumn[]>([]);
  const [addColumnKey, setAddColumnKey] = useState<string | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportRange, setViewportRange] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  // ---------- 全屏：监听 fullscreenchange 并触发 resize 让 Univer 重算布局 ----------
  useEffect(() => {
    const syncFullscreen = () => {
      const active =
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement;
      setIsFullscreen(active === tableShellRef.current);
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = tableShellRef.current;
    if (!shell) {
      return;
    }
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (active) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else {
          await doc.webkitExitFullscreen?.();
        }
      } else if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else {
        await (shell as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
          .webkitRequestFullscreen?.();
      }
    } catch {
      message.warning('全屏切换失败，请检查浏览器权限');
    }
  }, []);

  const isBudgetMode = dataScale === 'budget';
  const isDemoTree = dataScale === 'tree';
  const targetRowCount = typeof dataScale === 'number' ? dataScale : 0;

  // ---------- 派生数据：费用预算树 / 演示树 / 生成树 + 动态追加列 ----------
  const activeTreeData = useMemo(() => {
    if (isBudgetMode) {
      return expenseBudgetTreeData;
    }
    const base = isDemoTree ? treeData : scaledTreeData ?? [];
    if (!addedColumns.length) {
      return base;
    }
    return enrichTreeWithColumns(base, addedColumns);
  }, [isBudgetMode, isDemoTree, scaledTreeData, addedColumns]);
  /** 费用预算用专用 treeConfig；大数据启用 liteMode */
  const activeTreeConfig = useMemo(() => {
    if (isBudgetMode) {
      return expenseBudgetTreeConfig;
    }
    const config = buildTreeConfig(addedColumns);
    if (isDemoTree) {
      return config;
    }
    return {
      ...config,
      liteMode: true,
      skipMerges: true,
      defaultCollapsed: true,
      groupStatistics: undefined,
    };
  }, [isBudgetMode, isDemoTree, addedColumns]);
  const addableColumnOptions = useMemo(
    () =>
      OPTIONAL_COLUMNS.filter(
        (column) => !addedColumns.some((item) => item.id === column.id),
      ).map((column) => ({
        value: column.id,
        label: column.title,
      })),
    [addedColumns],
  );
  const cellHistory = useMemo(
    () => tracks.filter((item) => item.cell === focusCell),
    [tracks, focusCell],
  );

  const loadScaledTree = useCallback(async (count: number) => {
    /** 调用 treeDataGenerator 生成指定展平行数的树，完成后 setScaledTreeData */
    if (count >= 500000) {
      message.warning('数据量较大，生成与渲染可能较慢，请耐心等待');
    }
    setLoading(true);
    setTableRendering(true);
    setProgress(0);
    setRenderMs(null);
    try {
      const { treeData: generated, flatRowCount: rows } =
        await generateScaledTreeData(count, setProgress);
      setScaledTreeData(generated);
      setFlatRowCount(rows);
      setTracks([]);
      setTableKey((key) => key + 1);
      message.success(
        `成功生成树形数据，约 ${rows.toLocaleString()} 行（展平后）`,
      );
    } catch {
      message.error('树形数据生成失败');
      setTableRendering(false);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  }, []);

  const handleScaleChange = async (value: DataScale) => {
    if (typeof value === 'number') {
      setLoading(true);
      setTableRendering(true);
    }
    setDataScale(value);
    if (value === 'budget') {
      setScaledTreeData(null);
      setFlatRowCount(0);
      setTracks([]);
      setRenderMs(null);
      setTableRendering(true);
      setTableKey((key) => key + 1);
      message.success('已切换到费用预算（树形折叠）示例');
      return;
    }
    if (value === 'tree') {
      setScaledTreeData(null);
      setFlatRowCount(0);
      setTracks([]);
      setRenderMs(null);
      setTableRendering(true);
      setTableKey((key) => key + 1);
      message.success('已切换到树形演示数据');
      return;
    }
    await loadScaledTree(value);
  };

  const handleRegenerate = async () => {
    if (dataScale === 'budget') {
      setTracks([]);
      setRenderMs(null);
      setTableRendering(true);
      setTableKey((key) => key + 1);
      message.success('已重新加载费用预算表示例');
      return;
    }
    if (dataScale === 'tree') {
      setTracks([]);
      setRenderMs(null);
      setTableRendering(true);
      setTableKey((key) => key + 1);
      message.success('已重新加载树形演示');
      return;
    }
    await loadScaledTree(dataScale);
  };

  const handleAddColumn = (columnId: string) => {
    if (isBudgetMode) {
      message.info('费用预算模式暂不支持动态追加列，请切换到树形演示');
      return;
    }
    const column = OPTIONAL_COLUMNS.find((item) => item.id === columnId);
    if (!column) {
      return;
    }
    if (addedColumns.some((item) => item.id === columnId)) {
      message.info(`列「${column.title}」已存在`);
      return;
    }
    setAddedColumns((prev) => [...prev, column]);
    setTableRendering(true);
    setTableKey((key) => key + 1);
    setRenderMs(null);
    setAddColumnKey(undefined);
    message.success(`已添加列「${column.title}」`);
  };

  const stats = useMemo(() => {
    if (isBudgetMode) {
      const sheetRows = sheetRowCount || 0;
      const totalCols = EXPENSE_BUDGET_FREEZE_COLS + EXPENSE_BUDGET_VALUE_COLS;
      return {
        treeNodes: EXPENSE_BUDGET_ORG_COUNT,
        sheetRows,
        totalCols,
        totalCells: sheetRows * totalCols,
        modeLabel: '费用预算树',
      };
    }
    const treeNodes = countNodes(activeTreeData);
    const sheetRows = isDemoTree ? sheetRowCount : flatRowCount;
    const totalCols = HIERARCHY_COLS + BASE_MEASURE_COUNT + addedColumns.length;
    return {
      treeNodes,
      sheetRows,
      totalCols,
      totalCells: sheetRows * totalCols,
      modeLabel: isDemoTree ? '树形演示' : '树形大数据',
    };
  }, [
    isBudgetMode,
    activeTreeData,
    sheetRowCount,
    flatRowCount,
    isDemoTree,
    addedColumns.length,
  ]);

  const options = useMemo(() => {
    const headerDepth = isBudgetMode ? EXPENSE_BUDGET_HEADER_DEPTH : HEADER_DEPTH;
    const freezeCols = isBudgetMode ? EXPENSE_BUDGET_FREEZE_COLS : HIERARCHY_COLS;
    return {
      ...defaultOptions,
      name: isBudgetMode
        ? '费用预算表-行维度展示示例'
        : isDemoTree
          ? '经营指标明细'
          : `Tree Data ${targetRowCount}`,
      showGridLines: gridLines,
      freezeRows: freezeHeader ? headerDepth : 0,
      freezeColumns: freezeHeader ? freezeCols : 0,
      enableContextMenu: contextMenu,
      virtualScroll,
      defaultRowHeight: 32,
      // 显式关闭，避免被其它覆盖；业务表头已在单元格中
      showColumnHeader: false,
      showRowHeader: true,
    };
  }, [
    gridLines,
    freezeHeader,
    contextMenu,
    virtualScroll,
    isBudgetMode,
    isDemoTree,
    targetRowCount,
  ]);

  const refreshViewportRange = useCallback(() => {
    const stats = tableRef.current?.getTreeViewportStats();
    if (!stats?.enabled || stats.visibleLogicalRows <= stats.windowSize) {
      setViewportRange(null);
      return;
    }
    setViewportRange(
      `视口投影：显示第 ${stats.displayRangeStart.toLocaleString()}–${stats.displayRangeEnd.toLocaleString()} 行，共 ${stats.visibleLogicalRows.toLocaleString()} 行（滚到底部自动翻页）`,
    );
  }, []);

  const refreshBreadcrumb = () => {
    setBreadcrumb(tableRef.current?.getBreadcrumb() || []);
    refreshViewportRange();
  };

  const handleExpandAll = () => {
    tableRef.current?.expandAllRows();
    message.success('已展开全部折叠项');
    window.setTimeout(refreshViewportRange, 0);
    refreshBreadcrumb();
  };

  const handleCollapseAll = () => {
    tableRef.current?.collapseAllRows();
    message.success('已收起全部展开项');
    window.setTimeout(refreshViewportRange, 0);
    refreshBreadcrumb();
  };

  const handleDrillDown = () => {
    const ok = tableRef.current?.drillDown();
    message[ok ? 'success' : 'info'](ok ? '已下钻展开' : '当前行无可下钻分组');
    refreshBreadcrumb();
  };

  const handleDrillUp = () => {
    const ok = tableRef.current?.drillUp();
    message[ok ? 'success' : 'info'](ok ? '已上钻折叠' : '当前行无可上钻分组');
    refreshBreadcrumb();
  };

  const handleQuickSearch = async () => {
    if (searchKeyword.trim()) {
      const result = await tableRef.current?.search(searchKeyword.trim());
      if (result?.count) {
        message.success(`找到 ${result.count} 处，已定位 ${result.cell || ''}`);
      } else {
        message.warning('未找到匹配内容');
      }
      return;
    }
    const ok = tableRef.current?.openSearch();
    if (!ok) {
      message.warning('快速搜索不可用');
    }
  };

  const handleUndo = async () => {
    const ok = await tableRef.current?.undo();
    if (ok) {
      window.setTimeout(() => {
        setTracks((prev) => syncTracksFromWorksheet(prev, tableRef));
      }, 0);
    }
    message[ok ? 'success' : 'info'](ok ? '已撤销上一步编辑' : '没有可撤销的操作');
  };

  const handleRedo = async () => {
    const ok = await tableRef.current?.redo();
    if (ok) {
      window.setTimeout(() => {
        setTracks((prev) => syncTracksFromWorksheet(prev, tableRef));
      }, 0);
    }
    message[ok ? 'success' : 'info'](ok ? '已重做' : '没有可重做的操作');
  };

  const handleViewHistory = (cell: string) => {
    setFocusCell(cell);
    setSidePanelOpen(true);
    message.info(`已切换到 ${cell} 的历史记录`);
  };

  const handleViewTrace = (cell: string) => {
    setFocusCell(cell);
    const trace = tableRef.current?.getDataTrace(cell) || null;
    setTraceTree(trace);
    setTraceOpen(true);
  };

  const handleSave = () => {
    const payload = buildSavePayload(tracks, tableRef);
    if (!payload.patches.length) {
      messageApi.warning('暂无变更数据可保存，请先编辑单元格');
      return;
    }
    console.log('[UniverTable] save payload', payload);
  };

  const toAntdTree = (node: ETableDataTraceNode, key = 'root'): any => ({
    key,
    title: node.value ? `${node.label}: ${node.value}` : node.label,
    children: node.children?.map((child, index) =>
      toAntdTree(child, `${key}-${index}`),
    ),
  });


  return (
    <>
      {contextHolder}
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <h2 style={{ margin: 0 }}>
                {isBudgetMode ? 'Univer 费用预算表 / 行维度示例' : 'Univer 树形分组 / 大数据示例'}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                {isBudgetMode
                  ? '组织树折叠 · 科目费用汇总 · 功能属性 · 全年合计 · 2021年1–12月 · treeUI ▶/▼'
                  : '三层表头 · 品类/区域树 · 上钻下钻 · 回撤重做 · 单元格历史 · 净收入 / 核验状态 / 日期'}
              </p>
            </Col>
            <Col>
              <Space wrap>
                <Select
                  placeholder="添加列"
                  style={{ width: 132 }}
                  value={addColumnKey}
                  allowClear
                  suffixIcon={<PlusOutlined />}
                  options={addableColumnOptions}
                  disabled={isBudgetMode || !addableColumnOptions.length}
                  onChange={(value) => {
                    if (value) {
                      handleAddColumn(String(value));
                    } else {
                      setAddColumnKey(undefined);
                    }
                  }}
                />
                <Select
                  value={dataScale}
                  style={{ width: 168 }}
                  onChange={handleScaleChange}
                  options={DATA_SCALE_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                />
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={handleRegenerate}
                >
                  重新生成
                </Button>
                <Tooltip title="展开所有折叠项（品类 / 区域等全部行组）">
                  <Button icon={<ExpandAltOutlined />} onClick={handleExpandAll}>
                    全部展开
                  </Button>
                </Tooltip>
                <Tooltip title="收起所有展开项（品类 / 区域等全部行组）">
                  <Button icon={<ShrinkOutlined />} onClick={handleCollapseAll}>
                    全部折叠
                  </Button>
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 24px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 16,
              }}
            >
              <Statistic title={isBudgetMode ? '组织单元' : '树节点数'} value={stats.treeNodes} suffix="个" />
              <Statistic title="展平行数" value={stats.sheetRows} suffix="行" />
              <Statistic title="总列数" value={stats.totalCols} suffix="列" />
              <Statistic title="变更记录" value={tracks.length} suffix="条" />
              <Statistic title="数据模式" value={stats.modeLabel} />
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 88 }}>
              <Statistic
                title="渲染时长"
                value={renderMs ?? '-'}
                suffix={renderMs == null ? undefined : 'ms'}
                valueStyle={
                  renderMs != null && renderMs > 3000
                    ? { color: '#cf1322' }
                    : renderMs != null && renderMs > 1000
                      ? { color: '#d48806' }
                      : undefined
                }
              />
            </div>
          </div>
        </Card>

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            position: 'relative',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, transition: 'flex 0.28s ease' }}>
            <Card style={{ height: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 8,
                }}
              >
                <Tooltip title={sidePanelOpen ? '隐藏数据追踪面板' : '显示数据追踪面板'}>
                  <Button
                    type="text"
                    size="small"
                    icon={sidePanelOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                    onClick={() => setSidePanelOpen((open) => !open)}
                  >
                    {sidePanelOpen ? '隐藏面板' : '显示面板'}
                  </Button>
                </Tooltip>
              </div>
              <Alert
                message="树形交互说明"
                description={
                  isDemoTree
                    ? '品类列同列缩进折叠（▶/▼）；区域列可展开城市明细。Sales 为数字列，Profit 为下拉，Date 为日期列。右键可查看历史、数据追踪、上钻下钻、快速搜索。'
                    : `当前约 ${stats.sheetRows.toLocaleString()} 行。≥5000 行启用视口投影：左侧序号为展开后的行号，滚到底部自动加载下一页。${viewportRange ? ` ${viewportRange}` : ''}`
                }
                type={!isDemoTree && targetRowCount >= 500000 ? 'warning' : 'info'}
                showIcon
                closable
                style={{ marginBottom: 16 }}
              />
              <div
                style={{
                  marginBottom: 12,
                  padding: '12px 0',
                  borderTop: '1px solid #f0f0f0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Row gutter={[16, 12]} align="middle" justify="space-between" wrap>
                  <Col flex="1 1 auto" style={{ minWidth: 0 }}>
                    <Space wrap>
                      <Tooltip title="保存所有单元格变更（含行维度 / 列维度）">
                        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                          保存
                        </Button>
                      </Tooltip>
                      <Tooltip title="撤销上一步单元格编辑（Ctrl/Cmd+Z）">
                        <Button icon={<UndoOutlined />} onClick={handleUndo}>
                          回撤
                        </Button>
                      </Tooltip>
                      <Tooltip title="重做（Ctrl/Cmd+Y / Ctrl+Shift+Z）">
                        <Button icon={<RedoOutlined />} onClick={handleRedo}>
                          重做
                        </Button>
                      </Tooltip>
                      <Tooltip title="下钻：展开当前选中行组">
                        <Button
                          icon={<VerticalAlignBottomOutlined />}
                          onClick={handleDrillDown}
                        >
                          下钻
                        </Button>
                      </Tooltip>
                      <Tooltip title="上钻：折叠当前选中行组">
                        <Button
                          icon={<VerticalAlignTopOutlined />}
                          onClick={handleDrillUp}
                        >
                          上钻
                        </Button>
                      </Tooltip>
                      <Tooltip title="展开所有折叠项（品类 / 区域等全部行组）">
                        <Button icon={<ExpandAltOutlined />} onClick={handleExpandAll}>
                          展开行
                        </Button>
                      </Tooltip>
                      <Tooltip title="收起所有展开项（品类 / 区域等全部行组）">
                        <Button icon={<ShrinkOutlined />} onClick={handleCollapseAll}>
                          折叠行
                        </Button>
                      </Tooltip>
                      <Input.Search
                        placeholder="快速搜索"
                        allowClear
                        style={{ width: 220 }}
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onSearch={handleQuickSearch}
                        enterButton={<SearchOutlined />}
                      />
                      <Button onClick={() => tableRef.current?.openSearch()}>
                        查找面板
                      </Button>
                    </Space>
                  </Col>
                  <Col flex="0 0 auto" style={{ textAlign: 'right' }}>
                    <Space wrap style={{ justifyContent: 'flex-end' }}>
                      <span>功能开关：</span>
                      <Switch
                        checked={gridLines}
                        onChange={setGridLines}
                        checkedChildren="网格线"
                        unCheckedChildren="网格线"
                      />
                      <Switch
                        checked={freezeHeader}
                        onChange={setFreezeHeader}
                        checkedChildren="冻结表头"
                        unCheckedChildren="冻结表头"
                      />
                      <Switch
                        checked={contextMenu}
                        onChange={setContextMenu}
                        checkedChildren="右键菜单"
                        unCheckedChildren="右键菜单"
                      />
                      <Switch
                        checked={virtualScroll}
                        onChange={(checked) => {
                          setVirtualScroll(checked);
                          setRenderMs(null);
                          setTableKey((k) => k + 1);
                        }}
                        checkedChildren="虚拟滚动"
                        unCheckedChildren="虚拟滚动"
                      />
                    </Space>
                  </Col>
                </Row>
                {breadcrumb.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Breadcrumb
                      items={[
                        { title: '根' },
                        ...breadcrumb.map((item) => ({ title: item })),
                      ]}
                    />
                  </div>
                )}
                {loading && (
                  <div style={{ marginTop: 12 }}>
                    <Progress percent={progress} status="active" />
                  </div>
                )}
              </div>
              {loading ? (
                <div
                  style={{
                    height: TABLE_VIEW_HEIGHT,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Spin size="large" tip={`生成树形数据中… ${progress}%`} />
                </div>
              ) : isBudgetMode || isDemoTree || scaledTreeData ? (
                <div
                  ref={tableShellRef}
                  style={{
                    height: isFullscreen ? '100%' : TABLE_VIEW_HEIGHT,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#fff',
                  }}
                >
                  <Tooltip title={isFullscreen ? '退出全屏 (Esc)' : '全屏表格'}>
                    <Button
                      type="default"
                      size="small"
                      icon={
                        isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
                      }
                      onClick={() => void toggleFullscreen()}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 20,
                        opacity: 0.92,
                      }}
                    />
                  </Tooltip>
                  {tableRendering && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.88)',
                      }}
                    >
                      <Spin size="large" tip="渲染表格中…" />
                    </div>
                  )}
                  {/*
                  ETable：费用预算 / 树形演示均走 treeData + treeUI（▶/▼ 折叠）
                */}
                  <ETable
                    ref={tableRef}
                    key={`${dataScale}-${tableKey}-${gridLines}-${freezeHeader}-${contextMenu}-${virtualScroll}-budget-fold-v16-${addedColumns.map((item) => item.id).join(',')}`}
                    treeData={activeTreeData}
                    treeConfig={activeTreeConfig}
                    options={options}
                    onReady={({ renderMs: ms, rowCount, worksheet }) => {
                      setTableRendering(false);
                      // 渲染完成后强制隐藏 A/B/C（本版 Univer 需等 render 就绪）
                      try {
                        worksheet?.setColumnHeaderHeight?.(0);
                        const skeleton = worksheet?.getSkeleton?.();
                        if (skeleton) {
                          skeleton.columnHeaderHeight = 0;
                        }
                        worksheet?.refreshCanvas?.();
                        window.setTimeout(() => {
                          worksheet?.setColumnHeaderHeight?.(0);
                          worksheet?.refreshCanvas?.();
                        }, 100);
                        window.setTimeout(() => {
                          worksheet?.setColumnHeaderHeight?.(0);
                          worksheet?.refreshCanvas?.();
                        }, 400);
                      } catch (error) {
                        console.warn('[UniverTable] hide column header onReady failed', error);
                      }
                      if (typeof rowCount === 'number') {
                        setSheetRowCount(rowCount);
                      }
                      if (typeof ms === 'number') {
                        setRenderMs(ms);
                        if (ms >= 1000) {
                          message.info(`表格渲染完成，耗时 ${ms.toLocaleString()} ms`);
                        }
                      }
                      window.setTimeout(refreshViewportRange, 0);
                    }}
                    onCellChange={(record: ETableCellChangeRecord) => {
                      setTracks((prev) => [record, ...prev].slice(0, 200));
                      setFocusCell(record.cell);
                      console.log('[onCellChange]', {
                        cell: record.cell,
                        field: record.field,
                        rowId: record.rowId,
                        columnId: record.columnId,
                        from: record.from,
                        to: record.to,
                        rowDimensions: record.rowDimensions,
                        columnDimensions: record.columnDimensions,
                        rowPath: record.rowPath,
                      });
                      console.log(tableRef.current?.setCellValue({ rowId: 'group/group-summary/group-office', columnId: 'year/m1' }, 9999))
                      console.log(activeTreeData, 'activeTreeData')
                    }}
                    onSelectionChange={(cell: string) => {
                      setFocusCell(cell);
                      refreshBreadcrumb();
                    }}
                    onViewCellHistory={handleViewHistory}
                    onViewDataTrace={handleViewTrace}
                  />
                </div>
              ) : (
                <div
                  style={{
                    height: TABLE_VIEW_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}
                >
                  请选择数据规模并点击「重新生成」
                </div>
              )}
            </Card>
          </div>

          <div
            style={{
              width: sidePanelOpen ? 320 : 0,
              marginLeft: sidePanelOpen ? 16 : 0,
              flexShrink: 0,
              overflow: 'hidden',
              transition: 'width 0.28s ease, margin-left 0.28s ease',
            }}
          >
            <div
              style={{
                width: 320,
                height: '100%',
                minHeight: 640,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                opacity: sidePanelOpen ? 1 : 0,
                transform: sidePanelOpen ? 'translateX(0)' : 'translateX(24px)',
                transition: 'opacity 0.24s ease, transform 0.28s ease',
                pointerEvents: sidePanelOpen ? 'auto' : 'none',
              }}
            >
              <Card
                size="small"
                title="数据追踪（最近变更）"
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto' } }}
                extra={
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setTracks([]);
                      tableRef.current?.clearTracks();
                    }}
                  >
                    清空
                  </Button>
                }
              >
                {tracks.length === 0 ? (
                  <div style={{ color: '#999' }}>编辑任意单元格后，变更会记录在这里。</div>
                ) : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {tracks.slice(0, 40).map((item) => (
                      <li key={item.id} style={{ marginBottom: 8 }}>
                        <div>
                          <a onClick={() => setFocusCell(item.cell)}>{item.cell}</a>
                          <span style={{ color: '#999' }}> · {item.time}</span>
                        </div>
                        <div>
                          {item.from || '∅'} → {item.to || '∅'}
                        </div>
                        {(item.rowDimensions?.length || item.columnDimensions?.length) ? (
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                            {item.rowId ? `rowId=${item.rowId}; ` : ''}
                            {item.columnId || item.field
                              ? `columnId=${item.columnId ?? item.field}; `
                              : ''}
                            行维: {(item.rowDimensions ?? [])
                              .map((d) => `${d.field}${d.id ? `(${d.id})` : ''}=${d.value ?? ''}`)
                              .join(' / ') || '—'}
                            <br />
                            列维: {(item.columnDimensions ?? [])
                              .map((d) => `${d.title}${d.id ? `(${d.id})` : ''}`)
                              .join(' > ') || '—'}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                size="small"
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>单元格历史 · {focusCell}</div>
                    <Tag color="blue">提示：编辑后显示在下方</Tag>
                  </div>
                }
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto' } }}
              >
                {cellHistory.length === 0 ? (
                  <div style={{ color: '#999' }}>
                    编辑当前单元格并确认后，这里会列出该格的变更历史。也可右键「查看单元格历史」。
                  </div>
                ) : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {cellHistory.map((item) => (
                      <li key={item.id} style={{ marginBottom: 8 }}>
                        <div style={{ color: '#999' }}>{item.time}</div>
                        <div>
                          {item.from || '∅'} → {item.to || '∅'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>

        <Card style={{ marginTop: 16 }} size="small">
          <Row gutter={[24, 20]}>
            <Col xs={24} lg={12}>
              <h4 style={{ marginBottom: 4 }}>💡 功能说明</h4>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 8 }}>编辑与保存</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">单元格编辑：编辑后打修改标记（浅橙底 + 左侧色条），并实时 onCellChange</Tag></li>
                <li><Tag color="green">保存：收集全部变更单元格，含 rowDimensions / columnDimensions；与 worksheet 对齐，回撤后自动过滤已撤销项</Tag></li>
                <li><Tag color="green">无变更保存提示；侧栏展示最近 200 条变更记录</Tag></li>
                <li><Tag color="green">回撤 / 重做：工具栏、右键菜单或 Ctrl/Cmd+Z、Ctrl/Cmd+Y</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>树形交互</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">品类列 ▶/▼ 同列缩进折叠；区域列可展开城市明细</Tag></li>
                <li><Tag color="green">展开行 / 折叠行：展开所有折叠项、收起所有展开项（含品类与区域行组）</Tag></li>
                <li><Tag color="green">上钻 / 下钻：按当前选中行折叠或展开行组</Tag></li>
                <li><Tag color="green">面包屑：顶部显示当前行层级路径；选中行联动刷新</Tag></li>
                <li><Tag color="green">折叠 / 展开保持滚动位置，避免视口跳行</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>搜索与导航</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">快速搜索：工具栏输入关键字定位单元格</Tag></li>
                <li><Tag color="green">查找面板：Ctrl/Cmd+F 或「查找面板」按钮</Tag></li>
                <li><Tag color="green">全屏表格：右上角全屏按钮，Esc 退出</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>表格展示</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">费用预算（默认）：组织/科目树形 ▶▼ + 2021年月度</Tag></li>
                <li><Tag color="green">三层表头：主行层级 / 扩展行层级 / 核心经营指标 / 业务治理</Tag></li>
                <li><Tag color="green">分组统计：父行按子项自动汇总净收入、订单数等；支持全部合计行</Tag></li>
                <li><Tag color="green">只读 / 可编辑背景色区分：维度列灰底只读，指标列白底可编辑</Tag></li>
                <li><Tag color="green">冻结表头 / 网格线 / 动态追加列（功能开关可切换）</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>数据追踪</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">单元格历史：右键查看单格编辑流水</Tag></li>
                <li><Tag color="green">数据追踪：右键或侧栏打开血缘树（Modal / Drawer）</Tag></li>
                <li><Tag color="green">数据规模切换：树形演示 / 1万～100万行压测；支持重新生成</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>性能与扩展</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="green">虚拟滚动：Canvas 仅绘制可视区；≥5000 行启用视口投影或按页懒写入</Tag></li>
                <li><Tag color="green">渲染耗时 / 展平行数 / 变更条数 / 数据模式统计</Tag></li>
                <li><Tag color="green">右键菜单：复制粘贴、批注、附件、历史、追踪、下钻、搜索、撤销重做</Tag></li>
              </ul>
            </Col>

            <Col xs={24} lg={12}>
              <h4 style={{ marginBottom: 4 }}>🔍 封装特点</h4>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 8 }}>数据输入模式</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan">声明式 <code>treeData</code> + <code>treeConfig</code>：dimensions / attribute / measures / headerColumns</Tag></li>
                <li><Tag color="cyan"><code>groupData</code> + <code>groupConfig</code>：平铺多重分组展平</Tag></li>
                <li><Tag color="cyan">直接模式 <code>columns</code> + <code>rows</code> + <code>merges</code></Tag></li>
                <li><Tag color="cyan"><code>groupStatistics</code>：分组汇总字段、合计行、labelTemplate 配置</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>展平与维度</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan"><code>flattenTreeData</code>：树 → rows + toggles + merges + rowGroups</Tag></li>
                <li><Tag color="cyan"><code>dimensionContext</code> 行维度快照，避免明细行品类被清空后解析错误</Tag></li>
                <li><Tag color="cyan"><code>onCellChange</code> 自动 enrich：field / logicalRow / rowDimensions / columnDimensions / rowPath</Tag></li>
                <li><Tag color="cyan"><code>getCellDimensions(locator)</code>：任意时刻读取单格行列维度</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>渲染策略</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan">四路径自动选型：全量 renderData / 异步 renderDataAsync（≥1000 行）</Tag></li>
                <li><Tag color="cyan">平铺懒虚拟 virtualRender（≥5000 行，按页 2000 行懒写入）</Tag></li>
                <li><Tag color="cyan">树视口投影 treeViewport（treeUI + ≥5000 行，窗口 ~300 行滑动投影）</Tag></li>
                <li><Tag color="cyan">小数据 hideRows 折叠；大数据过滤可见行，避免全表 hideRows 卡顿</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>Ref API</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan">树形：expandAllRows / collapseAllRows / drillDown / drillUp / getBreadcrumb</Tag></li>
                <li><Tag color="cyan">数据：getTableData / getTreeData / getTracks / getCellHistory / getDataTrace</Tag></li>
                <li><Tag color="cyan">读写：setCellValue / setRowValue / getCellValue / getRowValue / getCellDimensions</Tag></li>
                <li><Tag color="cyan">搜索：openSearch / search；编辑：undo / redo</Tag></li>
                <li><Tag color="cyan">批注：addComment / getComments / deleteComment；附件：addAttachment / viewAttachments</Tag></li>
                <li><Tag color="cyan">大纲：collapseRowGroup / expandRowGroup / collapseColumnGroup 等</Tag></li>
                <li><Tag color="cyan">性能：getVirtualRenderStats / getTreeViewportStats；底层 getUniverAPI / getWorksheet</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>只读与样式</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan"><code>setupReadonlyCells</code>：表头 + 维度列 + 汇总行 BeforeSheetEditStart 拦截</Tag></li>
                <li><Tag color="cyan"><code>cellTone</code>：只读 #F5F5F5 / 可编辑 #FFFFFF 统一背景（treeUI 默认开启）</Tag></li>
                <li><Tag color="cyan">列 <code>editable: true</code> 可在汇总行编辑（如子品类）；<code>type</code> 驱动数据验证</Tag></li>
                <li><Tag color="cyan">列 <code>type: number | select | date</code> + applyColumnTypes 数据验证</Tag></li>
              </ul>

              <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 12 }}>Univer 集成</div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0', margin: 0, listStyle: 'none' }}>
                <li><Tag color="cyan">Preset 组合：Core / Advanced / ThreadComment / Note / DataValidation / FindReplace</Tag></li>
                <li><Tag color="cyan">自定义列头 customizeColumnHeaders；单元格合并 renderMerges（视口模式投影合并）</Tag></li>
                <li><Tag color="cyan">自定义右键 contextMenuItems；enableContextMenu 可关闭并拦截原生菜单</Tag></li>
                <li><Tag color="cyan">附件元数据 customMetaData + Note 角标；onReady 返回 renderMs / rowCount / treeViewport</Tag></li>
                <li><Tag color="cyan">事件：onCellChange / onSelectionChange / onViewCellHistory / onViewDataTrace</Tag></li>
              </ul>
            </Col>
          </Row>
        </Card>

        <Modal
          title={traceTree?.label || '数据追踪'}
          open={traceOpen}
          onCancel={() => setTraceOpen(false)}
          footer={null}
          width={480}
        >
          {traceTree ? (
            <Tree
              defaultExpandAll
              treeData={[toAntdTree(traceTree)]}
            />
          ) : (
            <div style={{ color: '#999' }}>暂无追踪信息</div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default UniverTablePage;
