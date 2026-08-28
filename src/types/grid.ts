import type { ColDef } from 'ag-grid-community'

// 财务成本报表数据行类型
export interface FinanceRow {
  id: number
  product: string
  category: string
  qty: number
  price: number
  dt: string
  remark: string
  children?: FinanceRow[]
  [key: string]: any
}

// 网格列定义 - 直接使用ColDef，通过扩展添加自定义属性
export type GridColDef = ColDef & {
  field: string
  headerName: string
  width?: number
  hide?: boolean
  editable?: boolean
  cellEditor?: string | any
  enableRowGroup?: boolean
  rowGroup?: boolean
  aggFunc?: string | ((params: any) => any)
  valueFormatter?: (params: any) => string
  cellRenderer?: string | any
  cellRendererParams?: any
  groupId?: string
  children?: GridColDef[]
}

// 工具栏按钮配置
export interface ToolbarButton {
  key: string
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

// 网格配置选项 - 简化版本，避免类型冲突
export interface GridOptions {
  [key: string]: any
  enableCellNotes?: boolean
  undoRedoCellEditing?: boolean
  undoRedoCellEditingLimit?: number
  masterDetail?: boolean
  rowModelType?: string
  cacheBlockSize?: number
  maxBlocksInCache?: number
  infiniteInitialRowCount?: number
  groupDefaultExpanded?: number
  groupDisplayType?: string
  groupTotalRow?: 'top' | 'bottom' // 替代已废弃的 groupIncludeFooter
  suppressAggFuncInHeader?: boolean
  enableCellTextSelection?: boolean
  copyHeadersToClipboard?: boolean
  suppressContextMenu?: boolean
  suppressScrollOnNewData?: boolean
}
