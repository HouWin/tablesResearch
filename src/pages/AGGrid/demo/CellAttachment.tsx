import { useRef, useState, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellClickedEvent } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { Modal, List, Tag, Button, message } from 'antd'
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons'
import { generateMockData } from '@/utils/mockData'
import type { FinanceRow, GridColDef } from '@/types/grid'

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  uploadTime: string
}

const CellAttachment = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = generateMockData(30)
  const [attachments, setAttachments] = useState<Attachment[]>([
    { id: '1', fileName: '附件1.pdf', fileSize: 1024000, uploadTime: '2024-01-15 10:30:00' },
    { id: '2', fileName: '附件2.xlsx', fileSize: 512000, uploadTime: '2024-01-14 14:20:00' },
  ])
  const [uploadVisible, setUploadVisible] = useState(false)
  const [currentRowId, setCurrentRowId] = useState<number>(0)

  const columnDefs: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'product', headerName: '产品名称', width: 120 },
    { field: 'category', headerName: '产品大类', width: 120 },
    { field: 'qty', headerName: '数量', width: 100 },
    { field: 'price', headerName: '单价', width: 100 },
    { field: 'dt', headerName: '业务日期', width: 120 },
    {
      field: 'remark',
      headerName: '状态',
      width: 100,
      cellRenderer: (params: any) => (
        <Tag color={params.value === '正常' ? 'green' : params.value === '待审核' ? 'orange' : 'red'}>
          {params.value}
        </Tag>
      )
    },
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

  const handleRowClick = useCallback((event: CellClickedEvent<FinanceRow>) => {
    if (event.data) {
      setCurrentRowId(event.data.id)
      setUploadVisible(true)
    }
  }, [])

  const handleUpload = useCallback(() => {
    // Mock 上传
    const newAttachment: Attachment = {
      id: Date.now().toString(),
      fileName: `新附件${Date.now()}.pdf`,
      fileSize: Math.floor(Math.random() * 2000000),
      uploadTime: new Date().toLocaleString()
    }
    setAttachments(prev => [...prev, newAttachment])
    message.success('附件上传成功（Mock）')
  }, [])

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  return (
    <AgGridWrap title="功能：单元格附件（二开）">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onCellClicked={handleRowClick}
        onGridReady={onGridReady}
      />

      <Modal
        title={`附件管理 - 行 ${currentRowId}`}
        open={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        footer={[
          <Button key="upload" type="primary" icon={<UploadOutlined />} onClick={handleUpload}>
            上传附件
          </Button>,
          <Button key="close" onClick={() => setUploadVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <List
          dataSource={attachments}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button type="link" size="small" icon={<PaperClipOutlined />}>
                  下载
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<PaperClipOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={item.fileName}
                description={`大小: ${(item.fileSize / 1024).toFixed(0)} KB | 上传时间: ${item.uploadTime}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </AgGridWrap>
  )
}

export default CellAttachment
