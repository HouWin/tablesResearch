import { useRef, useState, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellClickedEvent } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { Modal, List, Tag, Space } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { generateMockData } from '@/utils/mockData'
import type { FinanceRow, GridColDef } from '@/types/grid'

interface HistoryItem {
  id: string
  field: string
  oldValue: any
  newValue: any
  timestamp: string
  user: string
}

const CellHistory = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'product', headerName: '产品名称', width: 120, cellRenderer: (params: any) => (
      <Space>
        {params.value}
        <HistoryOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
      </Space>
    )},
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

  const onCellClicked = useCallback((event: CellClickedEvent<FinanceRow>) => {
    // 模拟：点击产品名称列显示历史记录
    if (event.colDef.field === 'product') {
      // Mock 历史数据
      setHistoryData([
        { id: '1', field: 'product', oldValue: '产品01', newValue: '产品02', timestamp: '2024-01-15 10:30:00', user: '张三' },
        { id: '2', field: 'product', oldValue: '产品02', newValue: '产品03', timestamp: '2024-01-14 14:20:00', user: '李四' },
      ])
      setHistoryVisible(true)
    }
  }, [])

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：单元格历史记录（二开）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onCellClicked={onCellClicked}
        onGridReady={onGridReady}
      />

      <Modal
        title="单元格变更历史"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={700}
      >
        <List
          dataSource={historyData}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<HistoryOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={`字段: ${item.field}`}
                description={
                  <Space direction="vertical" size={0}>
                    <span>
                      旧值: <Tag>{item.oldValue}</Tag>
                      →
                      新值: <Tag color="blue">{item.newValue}</Tag>
                    </span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {item.user} 于 {item.timestamp}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </AgGridWrap>
  )
}

export default CellHistory
