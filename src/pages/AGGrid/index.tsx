import { useEffect, useMemo } from 'react'
import { Layout, Card } from 'antd'
import { useSearchParams } from 'react-router-dom'

// 注册 AG Grid Enterprise 模块（必须在使用前导入）
import '@/utils/agGridModules'

// 引入样式
import './index.less'

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

// 组件映射表 - key为查询参数name的值
const componentMap: Record<string, React.ComponentType> = {
  'cell-note': CellNote,
  'master-detail': MasterDetail,
  'undo-redo': UndoRedo,
  'range-copy': RangeCopy,
  'column-group-collapse': ColumnGroupCollapse,
  'row-group-collapse': RowGroupCollapse,
  'budget-grid': BudgetGrid,
  'context-menu': ContextMenu,
  'cell-editor': CellEditorDemo,
  'custom-agg': CustomAgg,
  'cell-history': CellHistory,
  'data-track': DataTrack,
  'quick-search': QuickSearch,
  'column-visible': ColumnVisible,
  'cell-attachment': CellAttachment,
  'server-side-bigdata': ServerSideBigData,
  'column-resize-autosize': ColumnResizeAutoSize,
}

// localStorage key
const STORAGE_KEY = 'ag-grid-selected-demo'

// 菜单项配置
const menuConfig = [
  { key: 'cell-note', label: '单元格批注' },
  { key: 'master-detail', label: 'Master-Detail' },
  { key: 'undo-redo', label: 'Undo-Redo' },
  { key: 'range-copy', label: '批量复制' },
  { key: 'column-group-collapse', label: '列分组' },
  { key: 'row-group-collapse', label: '行分组' },
  { key: 'budget-grid', label: '预算管理' },
  { key: 'context-menu', label: '右键菜单' },
  { key: 'cell-editor', label: '单元格编辑器' },
  { key: 'custom-agg', label: '自定义聚合' },
  { key: 'cell-history', label: '历史记录' },
  { key: 'data-track', label: '数据追踪' },
  { key: 'quick-search', label: '快速搜索' },
  { key: 'column-visible', label: '列显隐' },
  { key: 'cell-attachment', label: '单元格附件' },
  { key: 'server-side-bigdata', label: '大数据' },
  { key: 'column-resize-autosize', label: '列宽自适应' },
]

function App() {
  const [searchParams, setSearchParams] = useSearchParams()

  // 从URL参数或localStorage获取当前选中的组件key
  const selectedKey = useMemo(() => {
    const urlParam = searchParams.get('name')
    if (urlParam && componentMap[urlParam]) {
      // URL参数合法，同步到localStorage
      localStorage.setItem(STORAGE_KEY, urlParam)
      return urlParam
    }

    // URL参数不存在或无效，尝试从localStorage恢复
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && componentMap[saved]) {
      // 同步到URL（不触发导航，只是更新地址栏）
      setSearchParams({ name: saved }, { replace: true })
      return saved
    }

    // 都没有，返回默认值
    return 'cell-note'
  }, [searchParams, setSearchParams])

  // 如果当前key不合法，自动修正
  useEffect(() => {
    const urlParam = searchParams.get('name')
    if (!urlParam || !componentMap[urlParam]) {
      // 使用localStorage中的值或默认值
      const validKey = selectedKey || 'cell-note'
      localStorage.setItem(STORAGE_KEY, validKey)
      setSearchParams({ name: validKey }, { replace: true })
    }
  }, [searchParams, selectedKey, setSearchParams])

  const handleMenuClick = ({ key }: { key: string }) => {
    // 同时更新URL参数和localStorage
    localStorage.setItem(STORAGE_KEY, key)
    setSearchParams({ name: key })
  }

  // 获取当前要渲染的组件
  const CurrentComponent = componentMap[selectedKey]

  // 统计信息
  const totalDemos = Object.keys(componentMap).length

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', height: 'auto', lineHeight: 'normal' }}>
        <div style={{ padding: '16px 0 12px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>
              AG Grid Feature Demo <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal', marginLeft: 8 }}>v36.1.0 Enterprise</span>
            </h3>
            <div style={{ fontSize: 12, color: '#999' }}>
              共 {totalDemos} 个功能演示
            </div>
          </div>
          {/* 使用div模拟菜单，避免Ant Design Menu的overflow折叠 */}
          <div className="ag-grid-menu-container">
            {menuConfig.map((item) => (
              <div
                key={item.key}
                className={`ag-grid-menu-item ${selectedKey === item.key ? 'selected' : ''}`}
                onClick={() => handleMenuClick({ key: item.key } as any)}
              >
                {item.label}
              </div>
            ))}
          </div>
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
