import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Modal, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import { formatCurrency } from '@/utils/format'
import type { FinanceRow, GridColDef } from '@/types/grid'

// 自定义下钻按钮组件
const DrillDownButton = (params: ICellRendererParams & { onDrillDown?: (row: FinanceRow) => void }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (params.onDrillDown && params.data) {
      params.onDrillDown(params.data)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="drill-down-btn"
      style={{
        padding: '4px 12px',
        background: '#1890ff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: 12,
      }}
    >
      下钻
    </button>
  )
}

// 价格单元格渲染组件
const PriceCell = (params: ICellRendererParams<FinanceRow> & { onCellClick?: (row: FinanceRow) => void }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (params.onCellClick && params.data) {
      params.onCellClick(params.data)
    }
  }

  return (
    <a
      href="#"
      onClick={handleClick}
      className="drill-down-link"
      style={{
        color: '#1890ff',
        textDecoration: 'underline',
        cursor: 'pointer',
      }}
    >
      {formatCurrency(params.value)}
    </a>
  )
}

// 定义层级结构类型
interface DrillDownLevel {
  key: string
  label: string
  data: FinanceRow[]
}

const MasterDetail = () => {
  const gridRef = useRef<AgGridReact>(null)

  // 面包屑导航状态
  const [breadcrumb, setBreadcrumb] = useState<DrillDownLevel[]>([
    { key: 'root', label: '总预算', data: generateMockData(20) }
  ])

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [detailData, setDetailData] = useState<FinanceRow[]>([])
  const [loading, setLoading] = useState(false)

  // 当前层级数据
  const currentData = useMemo(() => {
    return breadcrumb[breadcrumb.length - 1]?.data || []
  }, [breadcrumb])

  // 数据变化时自适应列宽
  useEffect(() => {
    const timer = setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
    return () => clearTimeout(timer)
  }, [currentData])

  // 模拟接口请求 - 获取明细数据
  const fetchDetailData = useCallback(async (row: FinanceRow) => {
    setLoading(true)
    // 模拟 API 请求延迟
    await new Promise(resolve => setTimeout(resolve, 500))

    // 模拟返回明细数据（3-5条）
    const detailCount = Math.floor(Math.random() * 3) + 3
    const details = generateMockData(detailCount).map((item, idx) => ({
      ...item,
      id: row.id * 1000 + idx,
      product: `${row.product}-明细${idx + 1}`,
      category: row.category,
      qty: Math.floor(item.qty * 0.3),
      price: item.price,
      dt: row.dt,
      remark: ['正常', '待审核', '已审核'][idx % 3],
    }))

    setDetailData(details)
    setLoading(false)
  }, [])

  // 弹窗下钻：显示明细
  const openDetailModal = useCallback(async (row: FinanceRow) => {
    setModalTitle(`明细数据 - ${row.product}`)
    await fetchDetailData(row)
    setModalVisible(true)
  }, [fetchDetailData])

  // 关闭弹窗
  const closeModal = useCallback(() => {
    setModalVisible(false)
    setDetailData([])
  }, [])

  // 上钻：面包屑点击
  const onBreadcrumbClick = useCallback((index: number) => {
    // 保留到点击的层级
    if (index < breadcrumb.length - 1) {
      const newBreadcrumb = breadcrumb.slice(0, index + 1)
      setBreadcrumb(newBreadcrumb)
    }
  }, [breadcrumb])

  // 下钻到子级
  const drillDownToLevel = useCallback((row: FinanceRow) => {
    const levelKey = `level-${Date.now()}`
    const levelLabel = `${breadcrumb[breadcrumb.length - 1].label} > ${row.product}`

    // 生成子级数据（模拟）
    const childData = generateMockData(10).map((item, idx) => ({
      ...item,
      id: row.id * 100 + idx,
      product: `${row.product}-子项${idx + 1}`,
      category: row.category,
      qty: Math.floor(item.qty * 0.2),
      dt: row.dt,
    }))

    // 添加新层级到面包屑
    setBreadcrumb(prev => [...prev, {
      key: levelKey,
      label: levelLabel,
      data: childData
    }])
  }, [breadcrumb])

  // 上钻到上级
  const drillUp = useCallback(() => {
    if (breadcrumb.length > 1) {
      setBreadcrumb(prev => prev.slice(0, -1))
    }
  }, [breadcrumb])

  // 主表格列定义
  const columnDefs = useMemo<GridColDef[]>(() => [
    { field: 'id', headerName: 'ID', width: 80, hide: true },
    { field: 'product', headerName: '产品名称', width: 150 },
    { field: 'category', headerName: '产品大类', width: 120 },
    { field: 'qty', headerName: '数量', width: 100 },
    {
      field: 'price',
      headerName: '单价',
      width: 120,
      cellRenderer: PriceCell,
      cellRendererParams: {
        onCellClick: openDetailModal,
      } as any,
    },
    { field: 'dt', headerName: '业务日期', width: 120 },
    { field: 'remark', headerName: '状态', width: 100 },
    {
      field: 'action',
      headerName: '操作',
      width: 100,
      cellRenderer: DrillDownButton,
      cellRendererParams: {
        onDrillDown: drillDownToLevel,
      } as any,
    },
  ], [drillDownToLevel, openDetailModal])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
  }), [])

  // 明细表格列定义（弹窗用）
  const detailColumns = useMemo<ColumnsType<FinanceRow>>(() => [
    { title: '明细ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '明细产品', dataIndex: 'product', key: 'product', width: 200 },
    { title: '产品大类', dataIndex: 'category', key: 'category', width: 120 },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 100 },
    { title: '单价', dataIndex: 'price', key: 'price', width: 120, render: (val: any) => formatCurrency(val) },
    { title: '业务日期', dataIndex: 'dt', key: 'dt', width: 120 },
    { title: '状态', dataIndex: 'remark', key: 'remark', width: 100 },
  ], [])

  return (
    <AgGridWrap
      title="功能：上钻下钻（面包屑导航 + 弹窗明细）"
      toolbar={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* 面包屑导航 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            {breadcrumb.map((level, index) => (
              <span key={level.key} style={{ display: 'flex', alignItems: 'center' }}>
                {index > 0 && <span style={{ color: '#999', margin: '0 4px' }}>/</span>}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onBreadcrumbClick(index)
                  }}
                  style={{
                    color: index === breadcrumb.length - 1 ? '#1890ff' : '#666',
                    fontWeight: index === breadcrumb.length - 1 ? 600 : 400,
                    textDecoration: 'none',
                    cursor: index === breadcrumb.length - 1 ? 'default' : 'pointer',
                  }}
                >
                  {level.label}
                </a>
              </span>
            ))}
          </div>

          {/* 上钻按钮 */}
          {breadcrumb.length > 1 && (
            <button
              onClick={drillUp}
              style={{
                padding: '4px 12px',
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              ⬆️ 上钻
            </button>
          )}

          {/* 使用说明 - Tooltip */}
          <Tooltip
            title={
              <div style={{ lineHeight: '1.8', fontSize: 12 }}>
                <div><strong>📌 下钻：</strong></div>
                <div>• 点击<strong style={{ color: '#1890ff' }}>蓝色金额</strong> → 弹窗查看明细</div>
                <div>• 点击<strong style={{ color: '#1890ff' }}>下钻按钮</strong> → 进入下一层级</div>
                <div style={{ marginTop: 4 }}><strong>📌 上钻：</strong></div>
                <div>• 点击<strong>面包屑</strong>或<strong style={{ color: '#1890ff' }}>上钻按钮</strong>返回上级</div>
              </div>
            }
            placement="bottom"
            overlayStyle={{ maxWidth: 300 }}
          >
            <span style={{ fontSize: 12, color: '#999', cursor: 'help', borderBottom: '1px dashed #999' }}>
              💡 使用说明
            </span>
          </Tooltip>
        </div>
      }
    >

      {/* 主表格 */}
      <div style={{ height: 600, width: '100%' }}>
        <AgGridReact<FinanceRow>
          ref={gridRef}
          rowData={currentData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => params.data.id.toString()}
        />
      </div>

      {/* 明细弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={1000}
      >
        <Table
          columns={detailColumns}
          dataSource={detailData}
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          bordered
        />
      </Modal>
    </AgGridWrap>
  )
}

export default MasterDetail
