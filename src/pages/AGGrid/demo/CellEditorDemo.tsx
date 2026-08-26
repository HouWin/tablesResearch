import { useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { GridReadyEvent } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const CellEditorDemo = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)

  const columnDefs = useMemo<GridColDef[]>(() => [
    { field: 'id', headerName: 'ID', width: 80, editable: false },
    { field: 'product', headerName: '产品名称', width: 120, editable: true, cellEditor: 'agTextCellEditor' },
    { field: 'category', headerName: '产品大类', width: 120, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['大类A', '大类B', '大类C'] } },
    { field: 'qty', headerName: '数量', width: 100, editable: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, max: 10000 } },
    { field: 'price', headerName: '单价', width: 100, editable: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 2 } },
    { field: 'dt', headerName: '业务日期', width: 120, editable: true, cellEditor: 'agDateCellEditor' },
    { field: 'remark', headerName: '状态', width: 100, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['正常', '待审核', '作废'] } },
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

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // 启用单元格编辑
    params.api.setGridOption('suppressClickEdit', false)
    // 自适应列宽
    setTimeout(() => {
      params.api.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：单元格编辑器-下拉/日期/数值（企业版）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        singleClickEdit={true}
      />
    </AgGridWrap>
  )
}

export default CellEditorDemo
