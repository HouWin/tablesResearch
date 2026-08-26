import { useRef, useState, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellValueChangedEvent } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { Table, Tag } from 'antd'
import { generateMockData } from '@/utils/mockData'
import type { FinanceRow, GridColDef } from '@/types/grid'

interface ChangeRecord {
  key: string
  rowId: number
  field: string
  oldValue: any
  newValue: any
  timestamp: string
}

const DataTrack = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)
  const [changeLog, setChangeLog] = useState<ChangeRecord[]>([])

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, editable: false },
    { field: 'product', headerName: '产品名称', width: 120, editable: true },
    { field: 'category', headerName: '产品大类', width: 120, editable: true },
    { field: 'qty', headerName: '数量', width: 100, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'price', headerName: '单价', width: 100, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'dt', headerName: '业务日期', width: 120, editable: true },
    { field: 'remark', headerName: '状态', width: 100, editable: true },
  ]

  const onCellValueChanged = useCallback((event: CellValueChangedEvent<FinanceRow>) => {
    const { data, colDef, oldValue, newValue } = event
    const record: ChangeRecord = {
      key: Date.now().toString(),
      rowId: data.id,
      field: colDef.field || '',
      oldValue,
      newValue,
      timestamp: new Date().toLocaleString()
    }
    setChangeLog(prev => [record, ...prev].slice(0, 20)) // 保持最近20条
  }, [])

  const columns = [
    { title: '行ID', dataIndex: 'rowId', key: 'rowId', width: 80 },
    { title: '字段', dataIndex: 'field', key: 'field', width: 120 },
    { title: '旧值', dataIndex: 'oldValue', key: 'oldValue', width: 100 },
    { title: '新值', dataIndex: 'newValue', key: 'newValue', width: 100 },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180 },
  ]

  return (
    <AgGridWrap title="功能：数据追踪变更事件">
      <div style={{ marginBottom: 16 }}>
        <Tag color="blue">提示：编辑单元格后变更记录会显示在下方表格</Tag>
      </div>
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        onCellValueChanged={onCellValueChanged}
      />
      <div style={{ marginTop: 24 }}>
        <h3>变更记录（最近20条）</h3>
        <Table
          dataSource={changeLog}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ y: 300 }}
        />
      </div>
    </AgGridWrap>
  )
}

export default DataTrack
