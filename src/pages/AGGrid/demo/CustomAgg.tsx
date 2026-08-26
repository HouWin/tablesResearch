import { useRef, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const CustomAgg = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(50)

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, hide: true },
    { field: 'product', headerName: '产品名称', width: 120, enableRowGroup: true, rowGroup: true },
    { field: 'category', headerName: '产品大类', width: 120, enableRowGroup: true },
    { field: 'qty', headerName: '数量', width: 100, aggFunc: 'sum', valueFormatter: (p) => `总计: ${p.value?.toLocaleString()}` },
    { field: 'price', headerName: '单价', width: 100, aggFunc: 'avg', valueFormatter: (p) => `平均: ¥${p.value?.toFixed(2)}` },
    { field: 'dt', headerName: '业务日期', width: 120 },
    { field: 'remark', headerName: '状态', width: 100 },
  ]

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 100,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  const onGridReady = useCallback(() => {
    // 分组配置已通过props设置
    // 自适应列宽
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：自定义统计聚合（企业版）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        groupDisplayType="multipleColumns"
        autoGroupColumnDef={{
          headerName: '产品分组',
          minWidth: 200
        }}
      />
    </AgGridWrap>
  )
}

export default CustomAgg
