import { useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'

const ColumnGroupCollapse = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)

  const columnDefs = useMemo(() => [
    {
      headerName: '基本信息',
      groupId: 'basic',
      children: [
        { field: 'id', headerName: 'ID', width: 80, hide: true },
        { field: 'product', headerName: '产品名称', width: 120 },
        { field: 'category', headerName: '产品大类', width: 120 },
      ]
    },
    {
      headerName: '数量信息',
      groupId: 'qty',
      children: [
        { field: 'qty', headerName: '数量', width: 100 },
      ]
    },
    {
      headerName: '金额信息',
      groupId: 'amount',
      children: [
        { field: 'price', headerName: '单价', width: 100 },
      ]
    },
    {
      headerName: '其他',
      groupId: 'other',
      children: [
        { field: 'dt', headerName: '业务日期', width: 120 },
        { field: 'remark', headerName: '状态', width: 100 },
      ]
    }
  ], [])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    sortable: true,
    filter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  const onGridReady = useCallback(() => {
    // v36 API 变更：columnApi 访问方式改变
    // 列分组默认展开功能已通过配置实现
    // 自适应列宽
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：多列折叠-列分组（企业版）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
      />
    </AgGridWrap>
  )
}

export default ColumnGroupCollapse
