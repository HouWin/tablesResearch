import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef, GridOptions, FirstDataRenderedEvent, RowClassParams, CellValueChangedEvent } from 'ag-grid-community';
import AgGridWrap from '@/components/AgGridWrap';

// ============================================================================
// 1. 数据生成器 (保持6级维度的排列组合)
// ============================================================================
const orgDictionary = [
  { region: '华东大区', companies: [
    { name: '上海分公司', depts: ['直销一部', '渠道部'] },
    { name: '浙江分公司', depts: ['政企事业部'] }, 
  ]},
  { region: '华南大区', companies: [
    { name: '广东分公司', depts: ['大客户部', '直销部'] },
  ]}
];

const prodDictionary = [
  { category: '智能硬件', subCategories: [
    { name: '服务器', products: ['AI训练服务器', '边缘计算节点'] },
    { name: '工业网关', products: ['5G核心网关'] }, 
  ]},
  { category: 'SaaS软件', subCategories: [
    { name: '协同办公', products: ['企业版旗舰', '基础免费版'] }
  ]}
];

const generateQuarterlyBudget = (base: number, year: number) => {
  const data: any = {};
  let totalRev = 0; let totalProfit = 0;
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, i) => {
    const rev = Math.floor(base * (1 + i * 0.1) * (Math.random() * 0.2 + 0.9));
    const profit = Math.floor(rev * (Math.random() * 0.15 + 0.1));
    data[`rev${year}${q}`] = rev;
    data[`profit${year}${q}`] = profit;
    totalRev += rev; totalProfit += profit;
  });
  data[`rev${year}Total`] = totalRev;
  data[`profit${year}Total`] = totalProfit;
  return data;
};

const generateComprehensiveData = () => {
  const rows: any[] = [];
  orgDictionary.forEach(org => {
    org.companies.forEach(comp => {
      comp.depts.forEach(dept => {
        prodDictionary.forEach(prod => {
          prod.subCategories.forEach(sub => {
            sub.products.forEach(p => {
              if (Math.random() > 0.7) return; // 模拟非对称业务数据
              rows.push({
                region: org.region, company: comp.name, department: dept,
                deptCode: `D-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                category: prod.category, subCategory: sub.name, product: p,
                prodManager: ['张三', '李四', '王五'][Math.floor(Math.random() * 3)],
                ...generateQuarterlyBudget(Math.floor(Math.random() * 500000) + 100000, 2026),
                ...generateQuarterlyBudget(Math.floor(Math.random() * 600000) + 150000, 2027),
              });
            });
          });
        });
      });
    });
  });
  return rows;
};

// ============================================================================
// 2. 核心算法：平铺与行合并渲染引擎
// ============================================================================
const DIMENSION_LEVELS: Record<string, number> = {
  region: 0, company: 1, department: 2, 
  category: 3, subCategory: 4, product: 5
};

const TabularDimensionRenderer = (props: any) => {
  const { node, colDef, data } = props;
  const field = colDef.field; 
  const targetLevel = DIMENSION_LEVELS[field];

  // --- 【改进1：小计行纯净模式】---
  if (node.footer) {
    if (node.level === -1) return field === 'region' ? <span style={{color: '#cf1322'}}>全部总计</span> : null;
    
    const footerField = node.rowGroupColumn?.getColId();
    // 🌟 绝对的纯净：只在小计所属的列打印文本，左侧所有父级列强制留白！彻底消灭同名嵌套错觉！
    if (footerField === field) {
      return <span style={{color: '#0958d9'}}>{node.key} 小计</span>;
    }
    return null; 
  }

  // --- 【改进2：模拟行合并 (Row Span)】---
  let isFirst = true;
  let curr = node;
  while (curr && curr.level > targetLevel) {
    // 判定当前行是否是该维度的“第一行”，如果不是，直接隐藏文本
    const children = curr.parent?.childrenAfterSort || curr.parent?.childrenAfterGroup;
    if (children && children[0] !== curr) { isFirst = false; break; }
    curr = curr.parent;
  }
  // 不是首行则留白，形成完美的合并单元格视觉
  if (!isFirst) return null;

  let displayValue = node.group ? (
    targetLevel < node.level ? (function() {
      let c = node; while(c) { if (c.rowGroupColumn?.getColId() === field) return c.key; c = c.parent; }
    })() : node.key
  ) : data?.[field];

  if (!displayValue) return null;

  // --- 【改进3：智能展开逻辑（支持单节点维度）】---
  let groupNodeToToggle = null;
  let c2 = node;
  while (c2) {
    if (c2.rowGroupColumn?.getColId() === field) { groupNodeToToggle = c2; break; }
    c2 = c2.parent;
  }

  let showIcon = false;
  if (groupNodeToToggle) {
    // 🌟 核心改进：向上追溯到根节点，统计该维度在所有数据中的唯一值数量
    // 而不是只判断当前节点的直接子节点数量
    const uniqueValues = new Set<any>();
    const collectValues = (n: any) => {
      if (n.level === targetLevel && n.key) {
        uniqueValues.add(n.key);
      }
      const children = n.childrenAfterGroup || n.childrenAfterSort || [];
      children.forEach((child: any) => collectValues(child));
    };
    // 从根节点的所有后代中收集该维度的所有值
    const rootNode = groupNodeToToggle.parent;
    if (rootNode) {
      const siblings = rootNode.childrenAfterGroup || rootNode.childrenAfterSort || [];
      siblings.forEach((sibling: any) => collectValues(sibling));
    }

    // 如果该维度有多个不同值，显示展开图标（即使是单节点父级）
    if (uniqueValues.size > 1) showIcon = true;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {showIcon ? (
        <span
          onClick={(e) => { e.stopPropagation(); groupNodeToToggle.setExpanded(!groupNodeToToggle.expanded); }}
          style={{ cursor: 'pointer', marginRight: 8, fontSize: '10px', width: '16px', color: '#8c8c8c', flexShrink: 0, textAlign: 'center' }}
        >
          {groupNodeToToggle.expanded ? '▼' : '▶'}
        </span>
      ) : (
        <span style={{ width: '24px', flexShrink: 0 }}></span> 
      )}
      <span style={{ fontWeight: 'bold', color: '#1f1f1f' }}>{displayValue}</span>
    </div>
  );
};

// 属性列渲染器 (支持编辑)
const AttributeRenderer = (props: any) => {
  const { node, colDef, data, api } = props;
  if (node.footer) return null;

  const targetLevel = DIMENSION_LEVELS[colDef.cellRendererParams.groupField];
  let isFirst = true;
  let curr = node;
  while (curr && curr.level > targetLevel) {
    const children = curr.parent?.childrenAfterSort || curr.parent?.childrenAfterGroup;
    if (children && children[0] !== curr) { isFirst = false; break; }
    curr = curr.parent;
  }

  if (!isFirst) return null;

  const value = node.group ? node.allLeafChildren?.[0]?.data?.[colDef.field] : data?.[colDef.field];

  // 🌟 可编辑属性列：显示为普通文本，双击进入编辑模式
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const column = colDef.field;
    const rowNode = node;
    api.startEditingCell({
      rowIndex: rowNode.rowIndex!,
      colKey: column,
    });
  };

  return (
    <span
      style={{ color: '#595959', cursor: colDef.editable ? 'pointer' : 'default' }}
      onDoubleClick={colDef.editable ? handleDoubleClick : undefined}
      title={colDef.editable ? '双击编辑' : undefined}
    >
      {value || '-'}
    </span>
  );
};

// ============================================================================
// 3. 主表格组件
// ============================================================================
const UltimateTabularGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [rowData, setRowData] = useState<any[]>([]);

  useEffect(() => {
    setTimeout(() => setRowData(generateComprehensiveData()), 200);
  }, []);

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { field: 'region', rowGroup: true, hide: true },
    { field: 'company', rowGroup: true, hide: true },
    { field: 'department', rowGroup: true, hide: true },
    { field: 'category', rowGroup: true, hide: true },
    { field: 'subCategory', rowGroup: true, hide: true },
    { field: 'product', rowGroup: true, hide: true },

    {
      headerName: '组织架构', marryChildren: true,
      children: [
        { field: 'region', headerName: '大区', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 130, editable: false },
        { field: 'company', headerName: '分公司', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 130, editable: false },
        { field: 'department', headerName: '部门', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 140, editable: false },
        { field: 'deptCode', headerName: '部门编码', cellRenderer: AttributeRenderer, cellRendererParams: { groupField: 'department' }, pinned: 'left', width: 90, editable: true },
      ]
    },

    {
      headerName: '产品体系', marryChildren: true,
      children: [
        { field: 'category', headerName: '产品大类', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 120, editable: false },
        { field: 'subCategory', headerName: '产品中类', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 130, editable: false },
        { field: 'product', headerName: '具体产品', cellRenderer: TabularDimensionRenderer, pinned: 'left', width: 150, editable: false },
        { field: 'prodManager', headerName: '产品经理', cellRenderer: AttributeRenderer, cellRendererParams: { groupField: 'product' }, pinned: 'left', width: 90, editable: true },
      ]
    },

    ...[2026, 2027].map(year => ({
      headerName: `${year}年度 预算`,
      children: [
        { field: `rev${year}Total`, headerName: '总收入 (¥)', aggFunc: 'sum', columnGroupShow: 'closed', width: 110, editable: true },
        { field: `profit${year}Total`, headerName: '总净利 (¥)', aggFunc: 'sum', columnGroupShow: 'closed', width: 110, editable: true },
        ...['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
          field: `rev${year}${q}`, headerName: `${q} 收入`, aggFunc: 'sum', columnGroupShow: 'open', width: 95, editable: true
        })),
      ]
    }))
  ], []);

  // 🌟 处理单元格编辑事件
  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    console.log('单元格编辑:', {
      字段: colDef.field,
      旧值: oldValue,
      新值: newValue,
      行数据: data
    });

    // 🔥 重要：在实际项目中，这里应该调用API保存到后端
    // await api.updateBudgetData(data.id, { [colDef.field]: newValue });

    // 演示：显示提示
    // message.success(`${colDef.headerName} 已更新: ${oldValue} → ${newValue}`);
  }, []);

  const gridOptions = useMemo<GridOptions>(() => ({
    groupDisplayType: 'multipleColumns',
    autoGroupColumnDef: { hide: true },
    groupHideOpenParents: true,
    groupDefaultExpanded: -1,
    groupTotalRow: 'bottom',
    grandTotalRow: 'bottom',
    suppressAggFuncInHeader: true,
    rowSelection: { mode: 'singleRow' },
    enableCellTextSelection: true,

    // 🌟 【编辑功能启用】
    enableCellEditing: true, // 启用单元格编辑
    editType: 'fullRow', // 全行编辑模式（点击即编辑）
    // onCellValueChanged: onCellValueChanged, // 编辑事件回调

    // 🌟 【改进4：小计行独立 UI 样式】
    getRowStyle: (params: RowClassParams) => {
      if (params.node.footer) {
        if (params.node.level === -1) {
          return { backgroundColor: '#fffbe6', fontWeight: 'bold' };
        }
        return { backgroundColor: '#e6f4ff', fontWeight: 'bold' };
      }
      return undefined;
    }
  }), []);

  return (
    <AgGridWrap title="最终究极版：行合并视觉 + 高亮小计 + 纯净展开">
      <div style={{ height: 750, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ minWidth: 90, resizable: true }}
          gridOptions={gridOptions}
          onFirstDataRendered={(p) => p.api.autoSizeAllColumns()}
        />
      </div>
    </AgGridWrap>
  );
};

export default UltimateTabularGrid;