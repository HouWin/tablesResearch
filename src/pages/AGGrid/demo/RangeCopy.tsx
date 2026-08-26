import { useMemo, useRef, useCallback, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellSelectionOptions } from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { Button, Space, message, Typography } from 'antd'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

const { Text } = Typography

const RangeCopy = () => {
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

  // 默认列定义
  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    editable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  // 单元格选择配置 - 启用范围选择
  const cellSelection = useMemo<boolean | CellSelectionOptions>(() => {
    return {
      // 启用范围选择
      enableRangeSelection: true,

      // 抑制浏览器默认选择样式
      suppressBrowserSelection: true,

      // 允许多选范围
      suppressMultiRanges: false,

      // 启用列选择
      enableColumnSelection: true,

      // 启用表头高亮
      enableHeaderHighlight: true,
    }
  }, [])

  // 复制选中区域（不带表头）
  const handleCopy = useCallback(() => {
    const api = gridRef.current?.api
    if (api) {
      api.copySelectedRangeToClipboard()
      message.success('✅ 已复制选中区域')
    }
  }, [])

  // 粘贴数据
  const handlePaste = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return

    try {
      // 获取当前选择
      const selectedRanges = api.getCellRanges?.() || []

      if (selectedRanges.length === 0) {
        message.warning('请先点击目标单元格')
        return
      }

      // 执行粘贴
      api.pasteFromClipboard()
      message.success('✅ 已粘贴数据')
    } catch (error) {
      console.error('粘贴失败:', error)
      message.error('❌ 粘贴失败')
    }
  }, [])

  const onGridReady = useCallback(() => {
    setTimeout(() => {
      gridRef.current?.api?.autoSizeAllColumns()
    }, 100)
  }, [])

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Ctrl+C 复制
        e.preventDefault()
        handleCopy()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // Ctrl+V 粘贴
        e.preventDefault()
        handlePaste()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCopy, handlePaste])

  return (
    <AgGridWrap title="功能：批量复制选区（企业版）">
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" onClick={handleCopy}>
            📋 复制选中区域
          </Button>
          <Button onClick={handlePaste}>
            📄 粘贴
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            提示：拖拽选中单元格区域后点击复制按钮，Ctrl+C 复制，Ctrl+V 粘贴
          </Text>
        </Space>
      </div>

      <div style={{ marginBottom: 16, padding: '12px', background: '#f0f7ff', borderRadius: '6px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 8 }}>💡 使用说明</div>
        <div style={{ color: '#666', lineHeight: 1.6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            <div>
              <span style={{ fontWeight: 600, color: '#333' }}>📋 复制：</span>
              拖拽选择区域 → <strong>Ctrl+C</strong> 或点击复制按钮
            </div>
            <div>
              <span style={{ fontWeight: 600, color: '#333' }}>📄 粘贴：</span>
              点击目标单元格 → <strong>Ctrl+V</strong> 或点击粘贴按钮
            </div>
            <div>
              <span style={{ fontWeight: 600, color: '#333' }}>✨ 特性：</span>
              蓝色范围选择 · 格式保持
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 600, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          cellSelection={cellSelection}
          enableCellTextSelection={true}
          onGridReady={onGridReady}
        />
      </div>
    </AgGridWrap>
  )
}

export default RangeCopy
