import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { GridColDef } from '@/types/grid';
import type { GridOptions, CellValueChangedEvent, RowSpanParams, ICellRendererParams, IContextMenuParams, ValueFormatterParams } from 'ag-grid-community';
import { ChevronRight, ChevronDown, RotateCcw, Expand, Shrink, Download, Upload } from 'lucide-react';
import { Select, Button, Space, Tag, message, Statistic, Row, Col, Spin, Tooltip, Modal } from 'antd';
import { buildRegionRowSpanCache, buildLeafToGroupMap, computeMergeSpans } from './budgetGrid.utils';
import AgGridWrap from '@/components/AgGridWrap';
import 'ag-grid-enterprise';

// ============================================================================
// 主题常量（对齐 SpreadJS 配色）
// ============================================================================

const COLORS = {
  productGroupBg: '#edf8f2',
  productGroupFg: '#176a4b',
  regionGroupBg: '#f2efff',
  regionGroupFg: '#5b43ad',
  bothGroupDataBg: '#faf9ff',
  summaryFg: '#8c8c8c',
  groupLeafFg: '#333',
  headerProductBg: '#e8f6ee',
  headerProductFg: '#19704f',
  headerRegionBg: '#eeeafd',
  headerRegionFg: '#6045b8',
  headerDataBg: '#f5f7fa',
  headerDataFg: '#475467',
  rowBorder: '#f1f5f9',
  cellBorder: '#e2e8f0',
  mergedBg: '#f6fffa',
  profitNegative: '#cf1322',
} as const;

const FONT = '12px Arial, PingFang SC';

// ============================================================================
// 数据模型
// ============================================================================

export interface OutlineLeaf {
  id: string;
  label: string;
}

export interface OutlineRoot {
  id: string;
  label: string;
  children: readonly OutlineLeaf[];
}

export interface VisibleNode {
  id: string;
  label: string;
  depth: 0 | 1;
  isGroup: boolean;
  expanded: boolean;
  leafIds: readonly string[];
}

export interface RowData {
  id: string;
  productNode: VisibleNode;
  productLabel: string;
  productBlockStart: boolean;
  productRowSpan: number;
  productManager: string;
  productCategory: string;
  productCategoryBlockStart: boolean;
  productCategoryRowSpan: number;

  regionNode: VisibleNode;
  regionLabel: string;
  regionBlockStart: boolean;
  regionRowSpan: number;
  regionOwner: string;
  regionStatus: string;
  regionStatusBlockStart: boolean;
  regionStatusRowSpan: number;

  revenue: number;
  productRevenue: number;
  serviceRevenue: number;
  orders: number;
  onlineOrders: number;
  offlineOrders: number;
  avgOrder: number;
  profit: number;
  completion: number;
  verified: boolean;
  updatedAt: string;
}

// ============================================================================
// 量级配置
// ============================================================================

export interface ScaleConfig {
  label: string;
  value: number;
  productGroups: number;
  productsPerGroup: number;
  regionGroups: number;
  regionsPerGroup: number;
}

const SCALE_CONFIGS: ScaleConfig[] = [
  { label: '1k', value: 1000, productGroups: 2, productsPerGroup: 5, regionGroups: 2, regionsPerGroup: 5 },
  { label: '1w', value: 10000, productGroups: 5, productsPerGroup: 10, regionGroups: 5, regionsPerGroup: 10 },
  { label: '10w', value: 100000, productGroups: 10, productsPerGroup: 20, regionGroups: 10, regionsPerGroup: 20 },
  { label: '50w', value: 500000, productGroups: 20, productsPerGroup: 50, regionGroups: 20, regionsPerGroup: 50 },
  { label: '100w', value: 1000000, productGroups: 30, productsPerGroup: 100, regionGroups: 30, regionsPerGroup: 100 },
];

// ============================================================================
// 树生成（按量级动态扩展）
// ============================================================================

const PRODUCT_GROUP_NAMES = ['智能硬件', 'SaaS软件', '云服务', '数据智能', '安全合规', '企业应用', '开发者工具', '物联网', '游戏娱乐', '教育科技'];
const SUB_PRODUCT_NAMES = ['服务器', '工作站', '存储', '网络设备', '软件平台', '解决方案', '技术服务', '配件耗材', '工具链', '咨询'];
const REGION_GROUP_NAMES = ['华东大区', '华南大区', '华北大区', '华中大区', '西南大区', '西北大区', '东北大区', '海外事业部'];
const SUB_REGION_NAMES = ['上海', '江苏', '浙江', '安徽', '广东', '福建', '北京', '天津', '湖北', '湖南', '四川', '重庆', '陕西', '辽宁', '山东', '海外'];

const MANAGER_NAMES = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
const STATUS_OPTIONS = ['正常', '待审核', '已审核', '已锁定', '已作废'];

function generateProductTree(config: ScaleConfig): OutlineRoot[] {
  const groups: OutlineRoot[] = [];
  for (let g = 0; g < config.productGroups; g++) {
    const children: OutlineLeaf[] = [];
    for (let i = 0; i < config.productsPerGroup; i++) {
      const idx = g * config.productsPerGroup + i;
      children.push({
        id: `prod-${idx}`,
        label: `${SUB_PRODUCT_NAMES[idx % SUB_PRODUCT_NAMES.length]}-${idx + 1}`,
      });
    }
    groups.push({
      id: `prod-group-${g}`,
      label: `${PRODUCT_GROUP_NAMES[g % PRODUCT_GROUP_NAMES.length]} ${Math.floor(g / PRODUCT_GROUP_NAMES.length) + 1}部`,
      children,
    });
  }
  return groups;
}

function generateRegionTree(config: ScaleConfig): OutlineRoot[] {
  const groups: OutlineRoot[] = [];
  for (let g = 0; g < config.regionGroups; g++) {
    const children: OutlineLeaf[] = [];
    for (let i = 0; i < config.regionsPerGroup; i++) {
      const idx = g * config.regionsPerGroup + i;
      children.push({
        id: `region-${idx}`,
        label: `${SUB_REGION_NAMES[idx % SUB_REGION_NAMES.length]}-${idx + 1}`,
      });
    }
    groups.push({
      id: `region-group-${g}`,
      label: `${REGION_GROUP_NAMES[g % REGION_GROUP_NAMES.length]} ${Math.floor(g / REGION_GROUP_NAMES.length) + 1}区`,
      children,
    });
  }
  return groups;
}

// ============================================================================
// 可见节点
// ============================================================================

const getVisibleNodes = (tree: OutlineRoot[], expandedIds: Set<string>): VisibleNode[] => {
  return tree.flatMap((root) => {
    const expanded = expandedIds.has(root.id);
    const rootNode: VisibleNode = {
      id: root.id,
      label: root.label,
      depth: 0,
      isGroup: true,
      expanded,
      leafIds: root.children.map((child) => child.id),
    };

    if (!expanded) return [rootNode];

    return [
      rootNode,
      ...root.children.map(
        (child): VisibleNode => ({
          id: child.id,
          label: child.label,
          depth: 1,
          isGroup: false,
          expanded: false,
          leafIds: [child.id],
        }),
      ),
    ];
  });
};

// ============================================================================
// 指标计算（确定性伪随机）
// ============================================================================

const stableHash = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
};

const computeMetrics = (productId: string, regionId: string) => {
  const pIdx = stableHash(productId) % 1000 + 1;
  const rIdx = stableHash(regionId) % 1000 + 1;
  const revenue = Math.round(118_000 + pIdx * 476 + rIdx * 314 + pIdx * rIdx * 23.5);
  const orders = Math.round(72 + pIdx * 1.9 + rIdx * 1.3);
  const profit = Math.round(revenue * (0.13 + ((pIdx + rIdx) % 5) * 0.018));
  const productRevenue = Math.round(revenue * 0.78);
  const serviceRevenue = revenue - productRevenue;
  const onlineOrders = Math.round(orders * 0.63);
  const offlineOrders = orders - onlineOrders;
  const avgOrder = Math.round(revenue / Math.max(orders, 1));
  const completion = Number((0.7 + ((pIdx + rIdx) % 30) / 100).toFixed(2));

  return { revenue, productRevenue, serviceRevenue, orders, onlineOrders, offlineOrders, avgOrder, profit, completion };
};

// ============================================================================
// 行数据构建
// ============================================================================

const createRowData = (
  product: VisibleNode,
  region: VisibleNode,
  productBlockStart: boolean,
  productRowSpan: number,
  regionBlockStart: boolean,
  regionRowSpan: number,
  leafToGroup?: Map<string, string>,
): RowData => {
  const metrics = computeMetrics(product.id, region.id);
  const seed = stableHash(product.id + region.id);
  const effectiveRegionId = region.isGroup ? region.id : (leafToGroup?.get(region.id) || region.id);

  return {
    id: `${product.id}_${region.id}`,
    productNode: product,
    productLabel: product.label,
    productBlockStart,
    productRowSpan,
    productManager: MANAGER_NAMES[stableHash(product.id) % MANAGER_NAMES.length],
    productCategory: `${product.label}类`,
    productCategoryBlockStart: false,
    productCategoryRowSpan: 0,

    regionNode: region,
    regionLabel: region.label,
    regionBlockStart,
    regionRowSpan,
    regionOwner: MANAGER_NAMES[(stableHash(effectiveRegionId) + 3) % MANAGER_NAMES.length],
    regionStatus: STATUS_OPTIONS[stableHash(effectiveRegionId) % STATUS_OPTIONS.length],
    regionStatusBlockStart: false,
    regionStatusRowSpan: 0,

    ...metrics,
    verified: seed % 2 === 0,
    updatedAt: `2026-08-${String((seed % 28) + 1).padStart(2, '0')}`,
  };
};

const projectAllRows = (
  products: VisibleNode[],
  regionsByProduct: Map<string, VisibleNode[]>,
): RowData[] => {
  const rows: RowData[] = [];
  let rowIndex = 0;

  products.forEach((product) => {
    const regions = regionsByProduct.get(product.id) || [];
    const productRowSpan = regions.length;

    const leafToGroup = buildLeafToGroupMap(regions);
    const regionRowSpanCache = buildRegionRowSpanCache(regions);

    regions.forEach((region, regionIndex) => {
      const regionRowSpan = region.isGroup ? (regionRowSpanCache.get(region.id) || 1) : 1;
      const regionBlockStart = region.isGroup || regionIndex === 0;

      rows.push(createRowData(
        product,
        region,
        regionIndex === 0,
        productRowSpan,
        regionBlockStart,
        regionRowSpan,
        leafToGroup,
      ));
      rowIndex++;
    });
  });

  const mergeConfigs = [
    { field: 'productCategory' as const, blockStart: 'productCategoryBlockStart' as const, rowSpan: 'productCategoryRowSpan' as const, groupBreak: (current: RowData, next: RowData) => next.productBlockStart },
    { field: 'regionStatus' as const, blockStart: 'regionStatusBlockStart' as const, rowSpan: 'regionStatusRowSpan' as const, groupBreak: (current: RowData, next: RowData) => next.regionNode?.isGroup },
  ];

  computeMergeSpans(rows, mergeConfigs);

  return rows;
};

// ============================================================================
// 行索引构建（服务端分页按需生成）
// ============================================================================

export interface RowIndex {
  totalRows: number;
  getRowRange: (rowIndex: number) => { productIndex: number; regionIndex: number } | null;
}

const buildRowIndex = (products: VisibleNode[], regionsByProduct: Map<string, VisibleNode[]>): RowIndex => {
  const prefixSums: number[] = [0];
  for (const product of products) {
    const regionCount = regionsByProduct.get(product.id)?.length || 0;
    prefixSums.push(prefixSums[prefixSums.length - 1] + regionCount);
  }

  return {
    totalRows: prefixSums[prefixSums.length - 1],
    getRowRange: (rowIndex: number) => {
      if (rowIndex < 0 || rowIndex >= prefixSums[prefixSums.length - 1]) return null;
      let lo = 0;
      let hi = products.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (prefixSums[mid] <= rowIndex) lo = mid;
        else hi = mid - 1;
      }
      return { productIndex: lo, regionIndex: rowIndex - prefixSums[lo] };
    },
  };
};

// ============================================================================
// 渲染器
// ============================================================================

interface OutlineCellRendererProps {
  value: string;
  data: RowData;
  dimension: 'product' | 'region';
  toggleExpand: (dimension: 'product' | 'region', productId: string, nodeId: string) => void;
}

const AttributeCellRenderer = ({ value }: { value: string }) => {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>{value || '-'}</div>;
};

const TreeNodeCellRenderer = ({ value, data, dimension, toggleExpand }: OutlineCellRendererProps) => {
  const node = dimension === 'product' ? data.productNode : data.regionNode;
  if (!node) return <span>{value}</span>;

  const isGroup = node.isGroup;
  const isExpanded = node.expanded;
  const indent = (node.depth ?? 0) > 0 ? '24px' : '8px';

  let color: string = COLORS.groupLeafFg;
  let fontWeight: React.CSSProperties['fontWeight'] = 400;

  if (isGroup) {
    color = dimension === 'product' ? COLORS.productGroupFg : COLORS.regionGroupFg;
    fontWeight = 600;
  }

  return (
    <div
      style={{
        paddingLeft: indent,
        display: 'flex',
        alignItems: 'center',
        cursor: isGroup ? 'pointer' : 'default',
        color,
        fontWeight,
        font: FONT,
      }}
      onClick={() => isGroup && toggleExpand(dimension, data.productNode.id, node.id)}
    >
      {isGroup && (
        <span style={{ marginRight: 6, display: 'flex', alignItems: 'center', color: '#666' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
      <span>{value}</span>
    </div>
  );
};

const OutlineCellRenderer = ({ value, data, dimension, toggleExpand }: OutlineCellRendererProps) => {
  return <TreeNodeCellRenderer value={value} data={data} dimension={dimension} toggleExpand={toggleExpand} />;
};

// ============================================================================
// 列定义
// ============================================================================

const buildColumnDefs = (
  handleToggle: (dimension: 'product' | 'region', productId: string, nodeId: string) => void,
  regionCellStyle: (params: any) => any,
): GridColDef[] => [
  {
    field: 'productLabel',
    headerName: '产品层级',
    width: 180,
    pinned: 'left',
    cellRenderer: OutlineCellRenderer,
    cellRendererParams: { dimension: 'product', toggleExpand: handleToggle },
    spanRows: (params) => !!(params.nodeB?.data && !params.nodeB.data.productBlockStart),
    rowSpan: (params: RowSpanParams<RowData>) => (params.data?.productBlockStart ? (params.data?.productRowSpan ?? 1) : 1),
    editable: false,
  },
  {
    field: 'productManager',
    headerName: '产品经理',
    width: 90,
    pinned: 'left',
    cellRenderer: AttributeCellRenderer,
    editable: true,
  },
  {
    field: 'regionLabel',
    headerName: '区域层级',
    width: 160,
    pinned: 'left',
    cellStyle: regionCellStyle,
    cellRenderer: (params: ICellRendererParams<RowData>) => (
      <TreeNodeCellRenderer
        value={params.value}
        data={params.data as RowData}
        dimension="region"
        toggleExpand={(dimension, productId, nodeId) => handleToggle(dimension, productId, nodeId)}
      />
    ),
    editable: false,
  },
  {
    field: 'regionOwner',
    headerName: '区域负责人',
    width: 90,
    pinned: 'left',
    cellRenderer: AttributeCellRenderer,
    editable: true,
  },
  {
    headerName: '核心指标',
    children: [
      {
        headerName: '收入',
        children: [
          {
            field: 'revenue',
            headerName: '净收入',
            width: 110,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? `¥${p.value.toLocaleString()}` : ''),
            cellStyle: { textAlign: 'right' },
          },
          {
            field: 'productRevenue',
            headerName: '商品收入',
            width: 110,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? `¥${p.value.toLocaleString()}` : ''),
            cellStyle: { textAlign: 'right' },
          },
          {
            field: 'serviceRevenue',
            headerName: '服务收入',
            width: 110,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? `¥${p.value.toLocaleString()}` : ''),
            cellStyle: { textAlign: 'right' },
          },
        ],
      },
      {
        headerName: '订单',
        children: [
          {
            field: 'orders',
            headerName: '订单数',
            width: 100,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? p.value.toLocaleString() : ''),
            cellStyle: { textAlign: 'right' },
          },
          {
            field: 'onlineOrders',
            headerName: '线上订单',
            width: 100,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? p.value.toLocaleString() : ''),
            cellStyle: { textAlign: 'right' },
          },
          {
            field: 'offlineOrders',
            headerName: '线下订单',
            width: 100,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? p.value.toLocaleString() : ''),
            cellStyle: { textAlign: 'right' },
          },
          {
            field: 'avgOrder',
            headerName: '客单价',
            width: 100,
            editable: true,
            valueFormatter: (p: ValueFormatterParams) => (p.value != null ? `¥${p.value.toLocaleString()}` : ''),
            cellStyle: { textAlign: 'right' },
          },
        ],
      },
      {
        field: 'profit',
        headerName: '利润',
        width: 110,
        editable: true,
        valueFormatter: (p) => (p.value != null ? `¥${p.value.toLocaleString()}` : ''),
      },
    ],
  },
  {
    headerName: '业务治理',
    children: [
      {
        field: 'completion',
        headerName: '目标达成',
        width: 100,
        editable: true,
        valueFormatter: (p: ValueFormatterParams) => (p.value != null ? `${(p.value * 100).toFixed(0)}%` : '-'),
        cellStyle: { textAlign: 'right' },
      },
      {
        field: 'productManager',
        headerName: '产品经理',
        width: 90,
        cellRenderer: (params: ICellRendererParams<RowData>) => <AttributeCellRenderer value={params.value} />,
        editable: true,
      },
      {
        field: 'regionOwner',
        headerName: '区域负责人',
        width: 90,
        cellRenderer: (params: ICellRendererParams<RowData>) => <AttributeCellRenderer value={params.value} />,
        editable: true,
      },
      {
        field: 'regionStatus',
        headerName: '状态',
        width: 90,
        cellRenderer: (params: ICellRendererParams<RowData>) => {
          const status = params.value;
          const color = status === '已审核' ? 'green' : status === '待审核' ? 'orange' : status === '已锁定' ? 'red' : 'default';
          return <Tag color={color}>{status}</Tag>;
        },
        spanRows: (params) => !!(params.nodeB?.data && !params.nodeB.data.regionStatusBlockStart),
        rowSpan: (params: RowSpanParams<RowData>) => (params.data?.regionStatusBlockStart ? (params.data?.regionStatusRowSpan ?? 1) : 1),
        editable: true,
      },
      {
        field: 'verified',
        headerName: '已核验',
        width: 80,
        editable: true,
        cellRenderer: (params: ICellRendererParams<RowData>) => (params.value ? '✓' : ''),
        cellStyle: { textAlign: 'center' },
      },
      {
        field: 'updatedAt',
        headerName: '更新日期',
        width: 100,
        editable: true,
      },
    ],
  },
];

// ============================================================================
// 主表格组件
// ============================================================================

const BudgetGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [scale, setScale] = useState<ScaleConfig>(SCALE_CONFIGS[0]);
  const [dataMode, setDataMode] = useState<'client' | 'server'>('client');
  const [productExpanded, setProductExpanded] = useState<Set<string>>(new Set());
  const [regionExpanded, setRegionExpanded] = useState<Record<string, Set<string>>>({});
  const [activeRows, setActiveRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  // 动态生成树
  const productTree = useMemo(() => generateProductTree(scale), [scale]);
  const regionTree = useMemo(() => generateRegionTree(scale), [scale]);

  // 可见节点
  const visibleProducts = useMemo(() => getVisibleNodes(productTree, productExpanded), [productTree, productExpanded]);
  const regionsByProduct = useMemo(() => {
    const map = new Map<string, VisibleNode[]>();
    visibleProducts.forEach((product) => {
      map.set(product.id, getVisibleNodes(regionTree, regionExpanded[product.id] || new Set()));
    });
    return map;
  }, [regionTree, regionExpanded, visibleProducts]);

  const stats = useMemo(() => {
    let regionExpandedCount = 0;
    const regionTotalCount = regionTree.length * 2;
    Object.values(regionExpanded).forEach((set) => {
      regionExpandedCount += set.size;
    });
    const totalRows = regionsByProduct.size > 0
      ? Array.from(regionsByProduct.values()).reduce((sum, regions) => sum + regions.length, 0)
      : 0;
    return { productExpanded: productExpanded.size, productTotal: productTree.length, regionExpanded: regionExpandedCount, regionTotal: regionTotalCount, totalRows };
  }, [productExpanded, regionExpanded, productTree, regionTree, regionsByProduct]);

  // 投影数据
  const projectData = useCallback(() => {
    setLoading(true);
    const rows = projectAllRows(visibleProducts, regionsByProduct);
    setActiveRows(rows);
    setLoading(false);
  }, [visibleProducts, regionsByProduct]);

  useEffect(() => {
    projectData();
  }, [projectData]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 初始化默认展开
  useEffect(() => {
    if (productTree.length > 0) {
      setProductExpanded(new Set([productTree[0].id]));
    }
  }, [productTree]);

  // 展开/收起
  const handleToggle = useCallback(
    (dimension: 'product' | 'region', productId: string, nodeId: string) => {
      if (dimension === 'product') {
        setProductExpanded((prev) => {
          const next = new Set(prev);
          next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
          return next;
        });
      } else {
        setRegionExpanded((prev) => {
          const prodSet = new Set(prev[productId] || []);
          prodSet.has(nodeId) ? prodSet.delete(nodeId) : prodSet.add(nodeId);
          return { ...prev, [productId]: prodSet };
        });
      }
    },
    [],
  );

  // 全局展开/收起
  const expandAll = useCallback((dimension: 'product' | 'region') => {
    if (dimension === 'product') {
      setProductExpanded(new Set(productTree.map((n) => n.id)));
    } else {
      const allRegionIds = regionTree.flatMap((r) => r.children.map((c) => c.id));
      const newRegionExpanded: Record<string, Set<string>> = {};
      visibleProducts.forEach((p) => {
        newRegionExpanded[p.id] = new Set(allRegionIds);
      });
      setRegionExpanded(newRegionExpanded);
    }
  }, [productTree, regionTree, visibleProducts]);

  const collapseAll = useCallback((dimension: 'product' | 'region') => {
    if (dimension === 'product') {
      setProductExpanded(new Set());
    } else {
      const newRegionExpanded: Record<string, Set<string>> = {};
      visibleProducts.forEach((p) => {
        newRegionExpanded[p.id] = new Set();
      });
      setRegionExpanded(newRegionExpanded);
    }
  }, [visibleProducts]);

  const resetAll = useCallback(() => {
    setProductExpanded(new Set([productTree[0]?.id].filter(Boolean)));
    const newRegionExpanded: Record<string, Set<string>> = {};
    visibleProducts.forEach((p) => {
      newRegionExpanded[p.id] = new Set();
    });
    setRegionExpanded(newRegionExpanded);
    message.success('已恢复初始状态');
  }, [productTree, visibleProducts]);

  // 单元格值变更
  const handleCellValueChanged = useCallback((event: CellValueChangedEvent<RowData>) => {
    const { colDef } = event;

    // 客户端模式下重新计算指标
    if (dataMode === 'client') {
      // 简单处理：重新投影整个数据
      // 生产环境应只重算受影响的产品-区域组合
      projectData();
    }

    message.success(`${colDef.headerName || colDef.field} 已更新`);
  }, [dataMode, projectData]);

  // 区域列样式
  const regionCellStyle = useCallback((params: any) => {
    if (!params.data) return null;
    const node = params.data.regionNode;
    if (node.isGroup) {
      return {
        backgroundColor: COLORS.regionGroupBg,
      };
    }
    return null;
  }, []);

  // 列定义
  const columnDefs = buildColumnDefs(handleToggle, regionCellStyle);

  // 默认列配置
  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: false,
    filter: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    cellStyle: { font: FONT },
  }), []);

  // 网格配置
  const gridOptions = useMemo<GridOptions>(() => ({
    cellSelection: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 20,
    suppressRowTransform: true,
    enableCellSpan: true,
    rowHeight: 40,
    enableCellTextSelection: true,
    copyHeadersToClipboard: true,
    allowContextMenuWithControlKey: true,
    isCellEditable: (params: ICellRendererParams<RowData>) => {
      const data = params.data;
      return data ? !data.productNode.isGroup && !data.regionNode.isGroup : false;
    },
  }), []);

  const serverSideDatasource = useMemo(() => {
    if (dataMode !== 'server') return undefined;

    return {
      getRows: (params: any) => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setLoading(true);
        setTimeout(() => {
          if (abortController.signal.aborted) return;
          try {
            const products = getVisibleNodes(productTree, productExpanded);
            const regionsByProduct = new Map<string, VisibleNode[]>();
            products.forEach((p) => {
              regionsByProduct.set(p.id, getVisibleNodes(regionTree, regionExpanded[p.id] || new Set()));
            });
            const { totalRows, getRowRange } = buildRowIndex(products, regionsByProduct);
            const startRow = params.request.startRow;
            const endRow = Math.min(params.request.endRow, totalRows);

            const rows: RowData[] = [];
            for (let i = startRow; i < endRow; i++) {
              const range = getRowRange(i);
              if (range) {
                const product = products[range.productIndex];
                const regions = regionsByProduct.get(product.id) || [];
                const region = regions[range.regionIndex];
                if (product && region) {
                  const productRowSpan = regions.length;
                  const regionRowSpanCache = buildRegionRowSpanCache(regions);
                  const regionRowSpan = region.isGroup ? (regionRowSpanCache.get(region.id) || 1) : 1;
                  const regionBlockStart = region.isGroup || range.regionIndex === 0;
                  const leafToGroup = buildLeafToGroupMap(regions);

                  rows.push(createRowData(
                    product,
                    region,
                    range.regionIndex === 0,
                    productRowSpan,
                    regionBlockStart,
                    regionRowSpan,
                    leafToGroup,
                  ));
                }
              }
            }

            const serverMergeConfigs = [
              { field: 'productCategory' as const, blockStart: 'productCategoryBlockStart' as const, rowSpan: 'productCategoryRowSpan' as const, groupBreak: (current: RowData, next: RowData) => next.productBlockStart },
              { field: 'regionStatus' as const, blockStart: 'regionStatusBlockStart' as const, rowSpan: 'regionStatusRowSpan' as const, groupBreak: (current: RowData, next: RowData) => next.regionNode?.isGroup },
            ];

            computeMergeSpans(rows, serverMergeConfigs);

            if (!abortController.signal.aborted) {
              params.success({ rowData: rows, rowCount: totalRows });
            }
          } catch (error) {
            if (!abortController.signal.aborted) {
              console.error('Server-side data fetch failed', error);
              params.fail();
            }
          } finally {
            if (!abortController.signal.aborted) {
              setLoading(false);
            }
          }
        }, 600);
      },
    };
  }, [dataMode, productTree, regionTree, productExpanded, regionExpanded]);

  // 右键菜单
  const getContextMenuItems = useCallback((params: any) => {
    const items = [
      { name: '📋 复制', action: () => params.api?.copySelectedRangeToClipboard() },
      { name: '📋 复制带表头', action: () => { params.api?.copySelectedRangeToClipboard({ includeHeaders: true }); message.success('已复制带表头'); } },
      { name: 'separator', action: () => {} },
      { name: '📊 查看产品详情', action: () => message.info(`产品: ${params.data?.productLabel}`) },
      { name: '📊 查看区域详情', action: () => message.info(`区域: ${params.data?.regionLabel}`) },
      { name: 'separator', action: () => {} },
      { name: '✏️ 编辑单元格', action: () => params.api?.startEditingCell({ rowIndex: params.node?.rowIndex, colKey: params.column?.getColId() }) },
    ];
    return items as any[];
  }, []);

  // 切换量级
  const handleScaleChange = useCallback((newScale: ScaleConfig) => {
    setScale(newScale);
    setProductExpanded(new Set([productTree[0]?.id].filter(Boolean)));
    const newRegionExpanded: Record<string, Set<string>> = {};
    visibleProducts.forEach((p) => {
      newRegionExpanded[p.id] = new Set();
    });
    setRegionExpanded(newRegionExpanded);
    message.info(`已切换到 ${newScale.label} 量级`);
  }, [productTree, visibleProducts]);

  // 导出 CSV
  const handleExportCsv = useCallback(() => {
    if (!gridRef.current?.api) return;
    gridRef.current.api.exportDataAsCsv({ fileName: `budget-grid-${scale.label}.csv` });
    message.success('CSV 导出成功');
  }, [scale]);

  // 导入 CSV
  const handleImportCsv = useCallback(() => {
    Modal.info({
      title: '导入 CSV',
      content: (
        <div>
          <p>请选择 CSV 文件导入（功能演示）</p>
          <input type="file" accept=".csv" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              message.success(`已选择文件: ${file.name}`);
            }
          }} />
        </div>
      ),
      width: 500,
    });
  }, []);

  // 工具栏
  const toolbar = useMemo(() => (
    <Space size="middle" wrap>
      <Space>
        <span style={{ fontSize: 12, color: '#666' }}>量级:</span>
        <Select
          value={scale.label}
          onChange={(val) => {
            const config = SCALE_CONFIGS.find((c) => c.label === val);
            if (config) handleScaleChange(config);
          }}
          style={{ width: 100 }}
          options={SCALE_CONFIGS.map((c) => ({ label: c.label, value: c.label }))}
        />
      </Space>

      <Space>
        <span style={{ fontSize: 12, color: '#666' }}>模式:</span>
        <Select
          value={dataMode}
          onChange={setDataMode}
          style={{ width: 120 }}
          options={[
            { label: '客户端', value: 'client' },
            { label: '服务端', value: 'server' },
          ]}
        />
      </Space>

      <Button size="small" icon={<Expand size={14} />} onClick={() => expandAll('product')}>
        展开产品
      </Button>
      <Button size="small" icon={<Shrink size={14} />} onClick={() => collapseAll('product')}>
        收起产品
      </Button>
      <Button size="small" icon={<Expand size={14} />} onClick={() => expandAll('region')}>
        展开区域
      </Button>
      <Button size="small" icon={<Shrink size={14} />} onClick={() => collapseAll('region')}>
        收起区域
      </Button>
      <Button size="small" icon={<Expand size={14} />} onClick={() => { expandAll('product'); expandAll('region'); }}>
        全部展开
      </Button>
      <Button size="small" icon={<Shrink size={14} />} onClick={() => { collapseAll('product'); collapseAll('region'); }}>
        全部收起
      </Button>
      <Button size="small" icon={<RotateCcw size={14} />} onClick={resetAll}>
        重置
      </Button>

      <Space>
        <Button size="small" icon={<Download size={14} />} onClick={handleExportCsv}>
          导出
        </Button>
        <Button size="small" icon={<Upload size={14} />} onClick={handleImportCsv}>
          导入
        </Button>
      </Space>

      <Space>
        <Statistic title="产品展开" value={`${stats.productExpanded}/${stats.productTotal}`} suffix="" valueStyle={{ fontSize: 12 }} />
        <Statistic title="区域展开" value={`${stats.regionExpanded}/${stats.regionTotal}`} suffix="" valueStyle={{ fontSize: 12 }} />
        <Statistic title="投影行" value={stats.totalRows} suffix="" valueStyle={{ fontSize: 12 }} />
      </Space>
    </Space>
  ), [scale, dataMode, stats, expandAll, collapseAll, resetAll, handleScaleChange, handleExportCsv, handleImportCsv]);

  return (
    <AgGridWrap title="预算管理（独立折叠 + 多层表头 + 大数据分页）" toolbar={toolbar} height={700}>
      <div style={{ position: 'relative', height: '100%' }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)', zIndex: 10,
          }}>
            <Spin tip="数据生成中..." />
          </div>
        )}

        <div style={{ height: '100%', width: '100%' }} className="ag-theme-alpine">
          <style>{`
            ${FONT}

            .ag-header .ag-header-cell {
              font: ${FONT};
              border-right: 1px solid ${COLORS.cellBorder};
            }

            .ag-row {
              border-bottom-color: ${COLORS.rowBorder};
              font: ${FONT};
            }

            .ag-header-row, .ag-row {
              --ag-row-group-indent-size: 0;
            }

            .ag-cell[col-id="profit"] {
              font-weight: 500;
            }
          `}</style>

          <AgGridReact<RowData>
            ref={gridRef}
            rowData={activeRows}
            columnDefs={columnDefs as any}
            getRowId={(params) => params.data?.id}
            onCellValueChanged={handleCellValueChanged}
            defaultColDef={defaultColDef}
            gridOptions={gridOptions}
            getContextMenuItems={getContextMenuItems}
            rowModelType={dataMode === 'server' ? 'serverSide' : 'clientSide'}
            serverSideDatasource={serverSideDatasource}
          />
        </div>
      </div>
    </AgGridWrap>
  );
};

export default BudgetGrid;
