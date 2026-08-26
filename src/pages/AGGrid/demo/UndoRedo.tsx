import { useMemo, useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellValueChangedEvent } from 'ag-grid-community'
import { Button, Space, Typography, message } from 'antd'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { FinanceRow, GridColDef } from '@/types/grid'

const { Text } = Typography

const UndoRedo = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)

  // 默认列定义 - 使所有单元格可编辑并启用闪烁效果
  const defaultColDef = useMemo(() => {
    return {
      editable: true,
      enableCellChangeFlash: true,
      flex: 1,
      minWidth: 100,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }
  }, [])

  // 单元格选择配置 - 启用填充手柄（拖拽填充）
  const cellSelection = useMemo(() => {
    return {
      handle: {
        mode: 'fill' as const,  // 启用填充手柄模式
      },
    }
  }, [])

  // 启用撤销/重做编辑
  const undoRedoCellEditing = true

  // 限制撤销/重做步骤数为 5
  const undoRedoCellEditingLimit = 5

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, editable: false },
    { field: 'product', headerName: '产品名称', width: 120, editable: true },
    { field: 'category', headerName: '产品大类', width: 120, editable: true },
    { field: 'qty', headerName: '数量', width: 100, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'price', headerName: '单价', width: 100, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'dt', headerName: '业务日期', width: 120, editable: true },
    { field: 'remark', headerName: '状态', width: 100, editable: true },
  ]

  // 撤销操作
  const onUndo = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.undoCellEditing()
      message.info('已撤销')
    }
  }, [])

  // 重做操作
  const onRedo = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.redoCellEditing()
      message.info('已重做')
    }
  }, [])

  const onCellValueChanged = useCallback((event: CellValueChangedEvent<FinanceRow>) => {
    message.success(`单元格值已变更: ${event.colDef?.headerName}`)
  }, [])

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap
      title="功能：撤销回撤 Undo/Redo（企业版）"
      toolbar={
        <Space>
          <Button onClick={onUndo} disabled={!undoRedoCellEditing}>
            ↶ 撤销 (Ctrl+Z)
          </Button>
          <Button onClick={onRedo} disabled={!undoRedoCellEditing}>
            ↷ 重做 (Ctrl+Y)
          </Button>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            支持撤销/重做最近 {undoRedoCellEditingLimit} 步操作
          </Text>
        </Space>
      }
    >
      <div style={{ marginBottom: 16, padding: '12px', background: '#f0f7ff', borderRadius: '6px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 4 }}>💡 使用说明</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>
          • <strong>编辑单元格</strong>：双击单元格或按 F2 进入编辑模式<br/>
          • <strong>撤销</strong>：点击"撤销"按钮或按 <strong>Ctrl+Z</strong> 撤销上一步操作<br/>
          • <strong>重做</strong>：点击"重做"按钮或按 <strong>Ctrl+Y</strong> 恢复已撤销的操作<br/>
          • <strong>拖拽填充</strong>：选中单元格后拖动右下角的填充柄，快速复制数据<br/>
          • <strong>单元格闪烁</strong>：编辑后单元格会闪烁绿色（新增）或黄色（修改）
        </div>
      </div>

      <div style={{ height: 600, width: '100%' }}>
        <AgGridReact<FinanceRow>
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          cellSelection={cellSelection}
          undoRedoCellEditing={undoRedoCellEditing}
          undoRedoCellEditingLimit={undoRedoCellEditingLimit}
          onCellValueChanged={onCellValueChanged}
          onGridReady={onGridReady}
        />
      </div>
    </AgGridWrap>
  )
}

export default UndoRedo
