import { useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type {
  GridReadyEvent,
  ColDef,
  ColGroupDef,
  GridOptions
} from 'ag-grid-community'
import { Tooltip } from 'antd'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { FinanceRow } from '@/types/grid'

// 自定义聚合值格式化器 - 显示中文汇总提示
const customAggFunc = (params: any) => {
  // 如果已经分组，显示分组的汇总提示
  if (params.node && params.node.group) {
    const colId = params.column?.getColId()

    // 数量汇总
    if (colId === 'qty') {
      return `${params.node.childrenAfterFilter?.length || 0}项合计`
    }

    // 单价汇总
    if (colId === 'price') {
      return `均值: ${params.value?.toFixed(2) || '-'}`
    }

    // ID或状态汇总
    if (colId === 'id' || colId === 'remark') {
      const count = params.node.childrenAfterFilter?.length || 0
      return count > 0 ? `${count}条记录` : '-'
    }

    // 日期汇总
    if (colId === 'dt') {
      return '时间区间'
    }
  }

  // 未分组时返回原始值
  return params.value
}

const RowGroupCollapse = () => {
  const gridRef = useRef<AgGridReact>(null)

  // 生成50条数据
  const rowData = useMemo(() => generateMockData(50), [])

  // 列分组定义 - 支持列维度分组
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    // ========== 行分组维度 ==========
    { field: 'category', headerName: '产品大类', width: 120, rowGroup: true, enableRowGroup: true },
    { field: 'product', headerName: '产品名称', width: 120, rowGroup: true, enableRowGroup: true },

    // ========== 列维度分组 ==========
    {
      headerName: '📊 基本信息',
      children: [
        { field: 'id', headerName: 'ID', width: 80, hide: true },
        { field: 'remark', headerName: '状态', width: 100, editable: true },
      ]
    },
    {
      headerName: '💰 金额信息',
      children: [
        { field: 'qty', headerName: '数量', width: 100, aggFunc: 'sum', editable: true },
        {
          field: 'price',
          headerName: '单价',
          width: 100,
          aggFunc: customAggFunc,
          editable: true,
        },
      ]
    },
    {
      headerName: '📅 时间信息',
      children: [
        { field: 'dt', headerName: '业务日期', width: 120, editable: true },
      ]
    },
  ], [])

  // 自动分组列配置（行分组用）
  const autoGroupColumnDef = useMemo(() => ({
    minWidth: 250,
    headerName: '分组维度',
    cellRendererParams: {
      suppressCount: false,
      suppressDoubleClickExpand: false
    }
  }), [])

  // 默认列分组配置（列分组用）
  const defaultColGroupDef = useMemo(() => ({
    marryChildren: true,  // 保持列组完整性
    openByDefault: true,  // 默认展开列组
  }), [])

  // 默认列配置
  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    sortable: true,
    filter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  // 网格选项
  const gridOptions = useMemo<GridOptions<FinanceRow>>(() => ({
    groupDisplayType: 'multipleColumns',
    animateRows: true,
    groupDefaultExpanded: 1,  // 默认展开层级
    suppressAggFuncInHeader: false,
    grandTotalRow: 'bottom',
    enableCellTextSelection: true
  }), [])

  // 网格就绪回调
  const onGridReady = useCallback((params: GridReadyEvent<FinanceRow>) => {
    // 默认展开第一层分组
    params.api.forEachNode((node) => {
      if (node.level === 0) {
        node.setExpanded(true)
      }
    })

    // 自适应所有列宽
    setTimeout(() => {
      params.api.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap
      title="功能：行列分组展开收起（企业版）"
      toolbar={
        <Tooltip
          title={
            <div style={{ lineHeight: '1.8', fontSize: 12 }}>
              <div><strong>📌 行分组：</strong></div>
              <div>• 按<b>产品大类</b> → <b>产品名称</b> 多层级分组</div>
              <div>• 点击 <b>▶</b> 展开分组，点击 <b>▼</b> 收起分组</div>
              <div>• <b>数量</b>自动求和，<b>单价</b>自动平均值</div>
              <div style={{ marginTop: 4 }}><strong>📌 列分组：</strong></div>
              <div>• 列按<b>基本信息</b>、<b>金额信息</b>、<b>时间信息</b>分组</div>
              <div>• 点击 <b>▶</b> 展开列组，点击 <b>▼</b> 收起列组</div>
              <div style={{ marginTop: 4 }}><strong>📌 列编辑：</strong></div>
              <div>• 可编辑列：<b>数量、单价、业务日期、状态</b></div>
              <div>• 双击单元格即可编辑，Enter 保存</div>
              <div style={{ marginTop: 4 }}><strong>📌 自定义汇总：</strong></div>
              <div>• <b>科目汇总</b>、<b>产品明细</b>、<b>N项合计</b></div>
            </div>
          }
          placement="bottom"
          overlayStyle={{ maxWidth: 320 }}
        >
          <span style={{ fontSize: 12, color: '#999', cursor: 'help', borderBottom: '1px dashed #999' }}>
            💡 使用说明
          </span>
        </Tooltip>
      }
    >
      <div style={{ height: 600, width: '100%' }}>
        <AgGridReact<FinanceRow>
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          defaultColGroupDef={defaultColGroupDef}
          autoGroupColumnDef={autoGroupColumnDef}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
        />
      </div>
    </AgGridWrap>
  )
}

export default RowGroupCollapse
