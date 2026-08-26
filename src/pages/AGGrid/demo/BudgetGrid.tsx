import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef, GridOptions, FirstDataRenderedEvent } from 'ag-grid-community';
import { Tooltip } from 'antd';
import AgGridWrap from '@/components/AgGridWrap';

// --- 1. 真实且庞大的业务数据生成器 ---
export interface FinanceRow {
  productLine: string;
  productName: string;
  productCode: string;
  salesRegion: string;
  customerName: string;
  customerCode: string;
  [key: string]: string | number;
}

// 模拟真实半导体/硬件行业字典
const productDictionary = [
  { line: '功率器件', products: [
    { name: '中低压 MOSFET', code: 'P-MOS-01' }, { name: '高压 SuperJunction', code: 'P-MOS-02' },
    { name: 'IGBT 模块', code: 'P-IGB-01' }, { name: '碳化硅 SiC 芯片', code: 'P-SIC-01' }
  ]},
  { line: '模拟芯片', products: [
    { name: '高性能 LDO', code: 'P-ANA-01' }, { name: 'DC-DC 转换器', code: 'P-ANA-02' },
    { name: '高精度 ADC', code: 'P-ANA-03' }
  ]},
  { line: '传感器与光电', products: [
    { name: 'MEMS 惯性传感器', code: 'P-SEN-01' }, { name: '激光雷达接收器', code: 'P-SEN-02' }
  ]}
];

const customerDictionary = [
  { region: '华东区', customers: [
    { name: '华为机器', code: 'C-HD-001' }, { name: '中芯国际', code: 'C-HD-002' }, 
    { name: '阳光电源', code: 'C-HD-003' }, { name: '长电科技', code: 'C-HD-004' }
  ]},
  { region: '华南区', customers: [
    { name: '大疆创新', code: 'C-HN-001' }, { name: '比亚迪汽车', code: 'C-HN-002' },
    { name: '汇顶科技', code: 'C-HN-003' }, { name: '立讯精密', code: 'C-HN-004' }
  ]},
  { region: '西南区', customers: [
    { name: '长安汽车', code: 'C-XN-001' }, { name: '迈普通信', code: 'C-XN-002' }
  ]},
  { region: '华北区', customers: [
    { name: '理想汽车', code: 'C-HB-001' }, { name: '京东方 BOE', code: 'C-HB-002' }
  ]}
];

const generateQuarterData = (baseAmt: number, baseQty: number, year: number, isBudget: boolean = false) => {
  const seasonalFactor = [0.85, 0.9, 1.1, 1.3]; // 真实的淡旺季波动
  const data: any = {};
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, idx) => {
    const factor = seasonalFactor[idx];
    const budgetMultiplier = isBudget ? 1.15 : 1.0;
    // 引入随机数产生合理波动
    data[`amt${year}${q}`] = Math.floor(baseAmt * factor * budgetMultiplier * (1 + (Math.random() * 0.2 - 0.1)));
    data[`qty${year}${q}`] = Math.floor(baseQty * factor * budgetMultiplier * (1 + (Math.random() * 0.2 - 0.1)));
  });
  return data;
};

const generateRealisticData = (): FinanceRow[] => {
  const rows: FinanceRow[] = [];
  // 随机交集生成逻辑：并非每个客户都会买所有产品
  productDictionary.forEach(line => {
    line.products.forEach(product => {
      customerDictionary.forEach(region => {
        // 每个产品在每个大区随机抽取 1-3 个客户，模拟真实的稀疏矩阵交集
        const activeCustomers = [...region.customers].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
        
        activeCustomers.forEach(customer => {
          const baseAmt = Math.floor(Math.random() * 800000) + 200000;
          const baseQty = Math.floor(Math.random() * 50000) + 10000;
          rows.push({
            productLine: line.line,
            productName: product.name,
            productCode: product.code,
            salesRegion: region.region,
            customerName: customer.name,
            customerCode: customer.code,
            ...generateQuarterData(baseAmt, baseQty, 2026, false),
            ...generateQuarterData(baseAmt * 1.1, baseQty * 1.05, 2027, true),
          });
        });
      });
    });
  });
  return rows;
};

// --- 2. 纯净的小计与指标渲染器 ---
const CleanGroupInnerRenderer = (props: any) => {
  if (props.node.footer) {
    if (props.node.level === -1) return <span style={{ fontWeight: 'bold', color: '#1890ff' }}>全部总计</span>;
    return <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{props.node.parent?.key} 小计</span>;
  }
  // 移除所有 ASCII 树状线条，依靠 AG-Grid 原生折叠图标，保持报表清爽
  return <span style={{ fontWeight: props.node.group ? 'bold' : 'normal' }}>{props.value}</span>;
};

const CustomAggRenderer = (props: any) => (
  <span style={{
    fontWeight: props.node.footer ? 'bold' : 'normal',
    color: props.node.footer ? '#1890ff' : 'inherit'
  }}>
    {props.value?.toLocaleString() || '-'}
  </span>
);

// 获取向下填充值的通用函数
const getFillValue = (params: any, field: string) => {
  if (params.node?.footer) return '';
  return params.node?.group ? params.node.allLeafChildren[0]?.data?.[field] : params.data?.[field];
};

// --- 3. 主表格组件 ---
const BudgetGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [rowData, setRowData] = useState<FinanceRow[]>([]);

  useEffect(() => {
    // 模拟大数据量加载
    setTimeout(() => setRowData(generateRealisticData()), 300);
  }, []);

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    // 定义维度的先后顺序与层级：产品线 -> 产品 -> 大区 -> 客户
    { field: 'productLine', rowGroup: true, hide: true },
    { field: 'productName', rowGroup: true, hide: true },
    { field: 'salesRegion', rowGroup: true, hide: true },
    { field: 'customerName', rowGroup: true, hide: true },

    // ========== 产品维度内部层级 ==========
    {
      headerName: '产品线', showRowGroup: 'productLine', pinned: 'left', suppressAutoSize: true, width: 140,
      cellRenderer: 'agGroupCellRenderer', cellRendererParams: { innerRenderer: CleanGroupInnerRenderer, suppressCount: false },
      valueGetter: (p) => getFillValue(p, 'productLine')
    },
    {
      headerName: '产品名称', showRowGroup: 'productName', pinned: 'left', suppressAutoSize: true, width: 180,
      cellRenderer: 'agGroupCellRenderer', cellRendererParams: { innerRenderer: CleanGroupInnerRenderer, suppressCount: false },
      valueGetter: (p) => {
        // 如果当前是最高层产品线的分组行，次级维度留白
        if (p.node?.group && p.node.field === 'productLine') return '';
        return getFillValue(p, 'productName');
      }
    },
    { 
      field: 'productCode', headerName: '产.编码', pinned: 'left', suppressAutoSize: true, width: 90,
      valueGetter: (p) => (p.node?.group && p.node.field === 'productLine') ? '' : getFillValue(p, 'productCode')
    },

    // ========== 客户维度内部层级 (跨维度平行展示) ==========
    {
      headerName: '销售大区', showRowGroup: 'salesRegion', pinned: 'left', suppressAutoSize: true, width: 120,
      cellRenderer: 'agGroupCellRenderer', cellRendererParams: { innerRenderer: CleanGroupInnerRenderer, suppressCount: false },
      valueGetter: (p) => {
        // 产品层级的汇总行不应显示任何客户维度信息
        if (p.node?.group && ['productLine', 'productName'].includes(p.node.field!)) return '';
        return getFillValue(p, 'salesRegion');
      }
    },
    {
      headerName: '客户名称', showRowGroup: 'customerName', pinned: 'left', suppressAutoSize: true, width: 180,
      cellRenderer: 'agGroupCellRenderer', cellRendererParams: { innerRenderer: CleanGroupInnerRenderer, suppressCount: false },
      valueGetter: (p) => {
        if (p.node?.group && ['productLine', 'productName', 'salesRegion'].includes(p.node.field!)) return '';
        return getFillValue(p, 'customerName');
      }
    },
    { 
      field: 'customerCode', headerName: '客.编码', pinned: 'left', suppressAutoSize: true, width: 90,
      valueGetter: (p) => (p.node?.group && ['productLine', 'productName', 'salesRegion'].includes(p.node.field!)) ? '' : getFillValue(p, 'customerCode')
    },

    // ========== 指标列 ==========
    ...[2026, 2027].map(year => ({
      headerName: `${year}年${year === 2026 ? '实际' : '预算'}`,
      children: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
        headerName: q,
        children: [
          { 
            field: `amt${year}${q}`, headerName: '金额', aggFunc: 'sum', editable: year > 2026,
            valueFormatter: (p: any) => p.value ? `¥${p.value.toLocaleString()}` : '',
            cellRenderer: CustomAggRenderer 
          },
          { 
            field: `qty${year}${q}`, headerName: '销量', aggFunc: 'sum', editable: year > 2026,
            valueFormatter: (p: any) => p.value?.toLocaleString() || '',
            cellRenderer: CustomAggRenderer 
          },
        ]
      }))
    }))
  ], []);

  const defaultColDef = useMemo(() => ({ minWidth: 90, sortable: true, filter: true, resizable: true }), []);

  const gridOptions = useMemo<GridOptions<FinanceRow>>(() => ({
    groupDisplayType: 'custom',
    groupTotalRow: 'all',  // 在所有分组级别显示汇总行（替代 groupIncludeFooter 和 groupIncludeTotalFooter）
    grandTotalRow: 'bottom',
    suppressAggFuncInHeader: true,
    animateRows: true,
    groupDefaultExpanded: 2, // 默认展开产品线和产品，露出销售大区
    enableCellTextSelection: true,
    singleClickEdit: true,
  }), []);

  const onFirstDataRendered = useCallback((params: FirstDataRenderedEvent<FinanceRow>) => {
    params.api.autoSizeAllColumns();
  }, []);

  return (
    <AgGridWrap title="功能：多维预算分析（平铺报表布局）">
      <div style={{ height: 600, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          onFirstDataRendered={onFirstDataRendered} 
        />
      </div>
    </AgGridWrap>
  );
};

export default BudgetGrid;