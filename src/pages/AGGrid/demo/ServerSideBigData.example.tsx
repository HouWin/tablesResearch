import { useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type {
  GridReadyEvent,
  IServerSideDatasource,
  ColumnApi,
  GridApi,
} from 'ag-grid-community'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import type { GridColDef } from '@/types/grid'

/**
 * 服务端模式大数据示例
 *
 * 服务端模式适用于以下场景：
 * - 数据量极大（10万+行）
 * - 数据存储在服务端
 * - 需要按需加载数据
 * - 服务端处理排序、筛选、聚合
 *
 * 与客户端模式的区别：
 * - 客户端模式：所有数据一次性加载到前端，AG Grid在浏览器中处理
 * - 服务端模式：数据按需从服务端加载，服务端处理数据逻辑
 */
const ServerSideBigDataExample = () => {
  const gridRef = useRef<AgGridReact>(null)
  const columnApiRef = useRef<ColumnApi | null>(null)
  const gridApiRef = useRef<GridApi | null>(null)

  const columnDefs = useMemo<GridColDef[]>(() => [
    { field: 'id', headerName: 'ID', width: 80, hide: true },
    { field: 'product', headerName: '产品名称', width: 120, filter: true },
    { field: 'category', headerName: '产品大类', width: 120, filter: true },
    { field: 'qty', headerName: '数量', width: 100, filter: true, sortable: true },
    { field: 'price', headerName: '单价', width: 100, filter: true, sortable: true },
    { field: 'dt', headerName: '业务日期', width: 120, filter: true },
    { field: 'remark', headerName: '状态', width: 100, filter: true },
  ], [])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [])

  /**
   * 模拟服务端数据源
   * 实际项目中，这里应该调用后端API
   */
  const dataSource = useMemo<IServerSideDatasource>(() => {
    return {
      // 服务端模式的核心方法：获取数据
      getRows: async (params) => {
        console.log('服务端请求参数:', {
          startRow: params.request.startRow,
          endRow: params.request.endRow,
          sortModel: params.request.sortModel,
          filterModel: params.request.filterModel,
        })

        try {
          // 模拟网络延迟
          await new Promise(resolve => setTimeout(resolve, 300))

          // 模拟数据量（实际应从后端API获取）
          const totalRows = 1000000 // 100万条数据

          // 生成模拟数据
          const rows = generateMockData(params.request.endRow - params.request.startRow)
            .map((row, index) => ({
              ...row,
              id: params.request.startRow + index + 1,
            }))

          // 模拟服务端排序（实际应在后端处理）
          let data = [...rows]
          if (params.request.sortModel?.length) {
            const sort = params.request.sortModel[0]
            data.sort((a, b) => {
              const aVal = a[sort.colId as keyof typeof a]
              const bVal = b[sort.colId as keyof typeof b]
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sort.sort === 'asc' ? aVal - bVal : bVal - aVal
              }
              return 0
            })
          }

          // 调用成功回调
          params.success({
            rowData: data,
            rowCount: totalRows, // 总行数（用于分页计算）
          })
        } catch (error) {
          // 调用失败回调
          params.fail()
        }
      },
    }
  }, [])

  const onGridReady = useCallback((params: GridReadyEvent) => {
    console.log('Grid ready')
    columnApiRef.current = params.columnApi
    gridApiRef.current = params.api

    // 设置服务端数据源
    params.api.setGridOption('datasource', dataSource)
  }, [dataSource])

  return (
    <AgGridWrap title="功能：大数据服务端模式（企业版）- 支持百万级数据">
      <div style={{ marginBottom: 16, color: '#666', fontSize: 13 }}>
        <p>💡 <strong>服务端模式说明</strong>：</p>
        <ul style={{ marginLeft: 20, lineHeight: 1.8 }}>
          <li>数据按需从服务端加载（这里模拟100万条数据）</li>
          <li>只加载当前视口可见的数据块（默认100行）</li>
          <li>排序、筛选在服务端处理</li>
          <li>首次加载会自动加载10000行（infiniteInitialRowCount）</li>
          <li>滚动到底部时会自动加载更多数据</li>
        </ul>
      </div>
      <AgGridReact
        ref={gridRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        // 服务端模式配置
        rowModelType="serverSide"
        // 缓存配置
        cacheBlockSize={100} // 每个块100行
        maxBlocksInCache={10} // 最多缓存10个块
        // 初始加载行数
        infiniteInitialRowCount={10000} // 初始加载10000行
        // 滚动优化
        suppressScrollOnNewData={true}
        // 分页配置（可选）
        pagination={false}
        // 性能优化
        debounceVerticalScroll={50}
      />
    </AgGridWrap>
  )
}

export default ServerSideBigDataExample
