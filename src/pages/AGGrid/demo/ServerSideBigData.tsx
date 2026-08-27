import { useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const ServerSideBigData = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = useMemo(() => generateMockData(10000), [])

  const columnDefs = useMemo<GridColDef[]>(() => [
    { field: 'id', headerName: 'ID', width: 80, hide: true },
    { field: 'product', headerName: '产品名称', width: 120, filter: true },
    { field: 'category', headerName: '产品大类', width: 120, filter: true },
    { field: 'qty', headerName: '数量', width: 100, filter: true },
    { field: 'price', headerName: '单价', width: 100, filter: true },
    { field: 'dt', headerName: '业务日期', width: 120, filter: true },
    { field: 'remark', headerName: '状态', width: 100, filter: true },
  ], [])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  const onGridReady = useCallback(() => {
    // 服务端模式配置已通过props设置
  }, [])

  return (
    <AgGridWrap title="功能：大数据服务端模式（企业版）- 10000条数据">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        // 使用客户端行模型，AG Grid会自动启用虚拟滚动优化
        // 如需使用真正的服务端模式，需要设置 rowModelType="serverSide" 并配置 datasource
        // rowModelType="serverSide"
        // datasource={dataSource}
        suppressScrollOnNewData={true}
      />
    </AgGridWrap>
  )
}

export default ServerSideBigData
