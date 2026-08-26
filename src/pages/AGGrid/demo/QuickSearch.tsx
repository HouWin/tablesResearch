import { useRef, useState, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { Input, Space, message, Button } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const QuickSearch = () => {
  const gridRef = useRef<AgGridReact>(null)
  const [searchText, setSearchText] = useState('')
  const rowData = generateMockData(50)

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'product', headerName: '产品名称', width: 120 },
    { field: 'category', headerName: '产品大类', width: 120 },
    { field: 'qty', headerName: '数量', width: 100 },
    { field: 'price', headerName: '单价', width: 100 },
    { field: 'dt', headerName: '业务日期', width: 120 },
    { field: 'remark', headerName: '状态', width: 100 },
  ]

  const handleSearch = useCallback(() => {
    const api = gridRef.current?.api
    if (api) {
      api.setGridOption('quickFilterText', searchText)
      message.success(`搜索: ${searchText || '(清空)'}`)
    }
  }, [searchText])

  return (
    <AgGridWrap title="功能：快速搜索">
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="输入关键词搜索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Button onClick={handleSearch}>搜索</Button>
          <Button onClick={() => { setSearchText(''); gridRef.current?.api?.setGridOption('quickFilterText', ''); }}>清空</Button>
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

export default QuickSearch
