import { useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { Button, Space, message } from 'antd'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const ColumnResizeAutoSize = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, resizable: true },
    { field: 'product', headerName: '产品名称', width: 120, resizable: true },
    { field: 'category', headerName: '产品大类', width: 120, resizable: true },
    { field: 'qty', headerName: '数量', width: 100, resizable: true },
    { field: 'price', headerName: '单价', width: 100, resizable: true },
    { field: 'dt', headerName: '业务日期', width: 120, resizable: true },
    { field: 'remark', headerName: '状态', width: 100, resizable: true },
  ]

  const handleAutoSizeAll = useCallback(() => {
    const api = gridRef.current?.api
    if (api) {
      api.autoSizeAllColumns()
      message.success('已自适应所有列宽')
    }
  }, [])

  const handleAutoSizeCurrent = useCallback(() => {
    const api = gridRef.current?.api
    if (api) {
      // v36: autoSizeColumn 改为 autoSizeColumns
      api.autoSizeColumns(['product'])
      message.success('已自适应产品名称列')
    }
  }, [])

  return (
    <AgGridWrap title="功能：列宽拖动+自适应内容宽度">
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button onClick={handleAutoSizeAll}>自适应所有列</Button>
          <Button onClick={handleAutoSizeCurrent}>自适应产品名称列</Button>
          <span style={{ color: '#666', fontSize: 12 }}>提示：拖动列头边缘可手动调整列宽</span>
        </Space>
      </div>
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
      />
    </AgGridWrap>
  )
}

export default ColumnResizeAutoSize
