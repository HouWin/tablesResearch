import { ReactNode } from 'react'
import { Card } from 'antd'
import type { GridOptions } from '../types/grid'

interface AgGridWrapProps {
  title: string
  children: ReactNode
  toolbar?: ReactNode
  gridOptions?: GridOptions
  height?: string | number
}

/**
 * AG Grid 包装组件
 * 提供统一的标题、工具栏和网格容器样式
 */
const AgGridWrap = ({
  title,
  children,
  toolbar,
  height = 600
}: AgGridWrapProps) => {
  return (
    <Card
      title={title}
      extra={toolbar}
      bordered={false}
      style={{
        marginBottom: 24,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)'
      }}
      bodyStyle={{
        padding: 16,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    >
      {children}
    </Card>
  )
}

export default AgGridWrap
