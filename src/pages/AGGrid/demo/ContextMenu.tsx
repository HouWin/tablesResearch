import { useRef, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { GetContextMenuItemsParams } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { message } from 'antd'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const ContextMenu = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'product', headerName: '产品名称', width: 120 },
    { field: 'category', headerName: '产品大类', width: 120 },
    { field: 'qty', headerName: '数量', width: 100 },
    { field: 'price', headerName: '单价', width: 100 },
    { field: 'dt', headerName: '业务日期', width: 120 },
    { field: 'remark', headerName: '状态', width: 100 },
  ]

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    sortable: true,
    filter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  const getContextMenuItems = useCallback((params: GetContextMenuItemsParams) => {
    return [
      { name: '📋 复制', action: () => params.api?.copySelectedRangeToClipboard() },
      { name: '📋 复制带表头', action: () => { params.api?.copySelectedRangeToClipboard(); message.success('已复制带表头'); } },
      { name: 'separator', action: () => {} },
      { name: '🔍 查看详情', action: () => message.info(`查看行: ${params.node?.rowIndex}`) },
      { name: '✏️ 编辑', action: () => message.info('进入编辑模式') },
      { name: 'separator2', action: () => {} },
      { name: '📊 自定义操作1', action: () => message.info('执行自定义操作1') },
      { name: '📊 自定义操作2', action: () => message.info('执行自定义操作2') },
    ] as any[]
  }, [])

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：自定义右键菜单（企业版）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getContextMenuItems={getContextMenuItems}
        suppressContextMenu={false}
        onGridReady={onGridReady}
      />
    </AgGridWrap>
  )
}

export default ContextMenu
