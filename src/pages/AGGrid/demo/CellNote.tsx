import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import AgGridWrap from '@/components/AgGridWrap'
import { generateMockData } from '@/utils/mockData'
import {
  ColDef,
  FullWidthNotesDataSource,
  Note,
  NotesDataSource,
} from 'ag-grid-community'
import type { FinanceRow } from '@/types/grid'

// 批注存储（模拟后端数据源）
const noteStore: Record<string, Record<string, Note>> = {}

// 批注数据源
const notesDataSource: NotesDataSource | FullWidthNotesDataSource = {
  getNote: (params: any) => {
    return noteStore[params.rowNode.id!]?.[params.column.getColId()]
  },
  setNote: (params: any) => {
    const rowId = params.rowNode.id!
    const colId = params.column.getColId()

    if (params.note === undefined) {
      // 删除批注
      delete noteStore[rowId]?.[colId]
    } else {
      // 保存批注
      const row = (noteStore[rowId] ??= {})
      row[colId] = params.note
    }
  },
}

const CellNote = () => {
  const gridRef = useRef<AgGridReact>(null)
  const rowData = useMemo(() => generateMockData(30), [])

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'product', headerName: '产品名称', width: 120 },
    { field: 'category', headerName: '产品大类', width: 120 },
    { field: 'qty', headerName: '数量', width: 100 },
    { field: 'price', headerName: '单价', width: 100 },
    { field: 'dt', headerName: '业务日期', width: 120 },
    { field: 'remark', headerName: '状态', width: 100 },
  ], [])

  const defaultColDef = useMemo(() => ({
    minWidth: 100,
    flex: 1,
    editable: true,
  }), [])

  const [selectedCell, setSelectedCell] = useState<{
    rowNode: any
    column: any
  } | null>(null)

  const [noteText, setNoteText] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('')
  const [noteReadOnly, setNoteReadOnly] = useState(false)
  const [statusMessage, setStatusMessage] = useState('点击单元格以查看或添加批注')

  // 获取显示的时间戳
  const getDisplayTimestamp = useCallback(() => {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
  }, [])

  // 单元格焦点事件
  const onCellFocused = useCallback((event: any) => {
    if (!gridRef.current?.api) return

    const rowNode = gridRef.current.api.getDisplayedRowAtIndex(event.rowIndex!)
    if (!rowNode) return

    setSelectedCell({
      rowNode,
      column: event.column,
    })

    // 加载该单元格的批注
    const note = gridRef.current.api.getNote({
      rowNode,
      column: event.column,
    })

    setNoteText(note?.text || '')
    setNoteAuthor(note?.author || '')
    setNoteReadOnly(!!note?.readOnly)
    setStatusMessage(
      note
        ? `已加载批注: ${rowNode.data?.product || rowNode.id} / ${event.column.getColId()}`
        : `单元格 ${rowNode.data?.product || rowNode.id} / ${event.column.getColId()} 暂无批注`
    )
  }, [])

  // 保存批注
  const saveNote = useCallback(() => {
    if (!gridRef.current?.api || !selectedCell) {
      setStatusMessage('请先选择一个单元格')
      return
    }

    const text = noteText.trim()
    const nextNote = text
      ? {
          text,
          author: noteAuthor || undefined,
          readOnly: noteReadOnly || undefined,
          updatedAt: getDisplayTimestamp(),
        }
      : undefined

    gridRef.current.api.setNote({
      ...selectedCell,
      note: nextNote,
    })

    setStatusMessage(
      text
        ? `✅ 批注已保存`
        : `✅ 批注已删除`
    )

    // 刷新网格显示
    gridRef.current.api.refreshCells({
      rowNodes: [selectedCell.rowNode],
      columns: [selectedCell.column],
    })
  }, [selectedCell, noteText, noteAuthor, noteReadOnly, getDisplayTimestamp])

  // 删除批注
  const removeNote = useCallback(() => {
    if (!gridRef.current?.api || !selectedCell) {
      setStatusMessage('请先选择一个单元格')
      return
    }

    gridRef.current.api.setNote({
      ...selectedCell,
      note: undefined,
    })

    setNoteText('')
    setNoteAuthor('')
    setNoteReadOnly(false)
    setStatusMessage('✅ 批注已删除')

    gridRef.current.api.refreshCells({
      rowNodes: [selectedCell.rowNode],
      columns: [selectedCell.column],
    })
  }, [selectedCell])

  return (
    <AgGridWrap title="功能：单元格批注（企业版）">
        <div style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: '#333' }}>📝 批注编辑器</div>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>{statusMessage}</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>作者</div>
            <input
              id="note-author"
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              placeholder="输入作者名称"
              style={{
                width: '100%',
                padding: '6px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>批注内容</div>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="输入批注内容..."
              rows={3}
              style={{
                width: '100%',
                padding: '6px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                id="note-readonly"
                type="checkbox"
                checked={noteReadOnly}
                onChange={(e) => setNoteReadOnly(e.target.checked)}
              />
              <span>只读</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={saveNote}
              style={{
                padding: '6px 16px',
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              保存批注
            </button>
            <button
              onClick={removeNote}
              style={{
                padding: '6px 16px',
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              删除批注
            </button>
          </div>
        </div>

        <div style={{ height: 500, width: '100%' }}>
          <AgGridReact<FinanceRow>
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            notesDataSource={notesDataSource}
            onCellFocused={onCellFocused}
            getRowId={(params) => params.data.id.toString()}
          />
        </div>
      </AgGridWrap>
  )
}

export default CellNote
