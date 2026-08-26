import { useState } from 'react'
import { Layout, Menu, Card } from 'antd'

// 注册 AG Grid Enterprise 模块（必须在使用前导入）
import '@/utils/agGridModules'

import CellNote from './demo/CellNote'
import MasterDetail from './demo/MasterDetail'
import UndoRedo from './demo/UndoRedo'
import RangeCopy from './demo/RangeCopy'
import ColumnGroupCollapse from './demo/ColumnGroupCollapse'
import RowGroupCollapse from './demo/RowGroupCollapse'
import ContextMenu from './demo/ContextMenu'
import CellEditorDemo from './demo/CellEditorDemo'
import CustomAgg from './demo/CustomAgg'
import CellHistory from './demo/CellHistory'
import DataTrack from './demo/DataTrack'
import QuickSearch from './demo/QuickSearch'
import ColumnVisible from './demo/ColumnVisible'
import CellAttachment from './demo/CellAttachment'
import ServerSideBigData from './demo/ServerSideBigData'
import ColumnResizeAutoSize from './demo/ColumnResizeAutoSize'
import BudgetGrid from './demo/BudgetGrid'

const { Header, Content } = Layout

// 组件映射表
const componentMap: Record<string, React.ComponentType> = {
  '/demo/cell-note': CellNote,
  '/demo/master-detail': MasterDetail,
  '/demo/undo-redo': UndoRedo,
  '/demo/range-copy': RangeCopy,
  '/demo/demo-column-group-collapse': ColumnGroupCollapse,
  '/demo/row-group-collapse': RowGroupCollapse,
  '/demo/budget-grid': BudgetGrid,
  '/demo/context-menu': ContextMenu,
  '/demo/cell-editor': CellEditorDemo,
  '/demo/custom-agg': CustomAgg,
  '/demo/cell-history': CellHistory,
  '/demo/data-track': DataTrack,
  '/demo/quick-search': QuickSearch,
  '/demo/column-visible': ColumnVisible,
  '/demo/cell-attachment': CellAttachment,
  '/demo/server-side-bigdata': ServerSideBigData,
  '/demo/column-resize-autosize': ColumnResizeAutoSize,
}

function App() {
  const [selectedKey, setSelectedKey] = useState<string>('')
  const menuItems = [
    { key: '/demo/cell-note', label: '单元格批注' },
    { key: '/demo/master-detail', label: 'Master-Detail' },
    { key: '/demo/undo-redo', label: 'Undo-Redo' },
    { key: '/demo/range-copy', label: '批量复制' },
    { key: '/demo/demo-column-group-collapse', label: '列分组' },
    { key: '/demo/row-group-collapse', label: '行分组' },
    { key: '/demo/budget-grid', label: '预算管理' },
    { key: '/demo/context-menu', label: '右键菜单' },
    { key: '/demo/cell-editor', label: '单元格编辑器' },
    { key: '/demo/custom-agg', label: '自定义聚合' },
    { key: '/demo/cell-history', label: '历史记录' },
    { key: '/demo/data-track', label: '数据追踪' },
    { key: '/demo/quick-search', label: '快速搜索' },
    { key: '/demo/column-visible', label: '列显隐' },
    { key: '/demo/cell-attachment', label: '单元格附件' },
    { key: '/demo/server-side-bigdata', label: '大数据' },
    { key: '/demo/column-resize-autosize', label: '列宽自适应' },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedKey(key)
  }

  // 获取当前要渲染的组件
  const CurrentComponent = selectedKey ? componentMap[selectedKey] : null

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', height: 'auto', lineHeight: 'normal' }}>
        <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>
            AG Grid Feature Demo <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal', marginLeft: 8 }}>v36.1.0 Enterprise</span>
          </h3>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            onClick={handleMenuClick}
            style={{
              border: 'none',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',  // Firefox
              msOverflowStyle: 'none',  // IE/Edge
              '&::-webkit-scrollbar': { display: 'none' },  // Chrome/Safari
            } as React.CSSProperties}
            items={menuItems.map(item => ({
              key: item.key,
              label: item.label,
            }))}
          />
        </div>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5', overflow: 'auto' }}>
        <Card bordered={false} style={{ minHeight: 'calc(100vh - 200px)' }}>
          {CurrentComponent ? (
            <CurrentComponent />
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              请从上方菜单选择功能演示页面
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  )
}

export default App
