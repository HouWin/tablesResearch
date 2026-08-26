// 全局注册 AG Grid 模块
import { ModuleRegistry } from 'ag-grid-community'
import {
  ClientSideRowModelModule,
  RowApiModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  UndoRedoEditModule,
  HighlightChangesModule,
} from 'ag-grid-community'
import {
  NotesModule,
  MasterDetailModule,
  CellSelectionModule,
  ClipboardModule,
  RowGroupingModule,
  RowGroupingPanelModule,
  ColumnMenuModule,
  ContextMenuModule,
  MenuModule,
  ExcelExportModule,
  TreeDataModule,
} from 'ag-grid-enterprise'

// 注册核心模块
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowApiModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  CellSelectionModule,
  UndoRedoEditModule,
  HighlightChangesModule,
  ClipboardModule,
  MasterDetailModule,
  NotesModule,
  RowGroupingModule,
  RowGroupingPanelModule,
  ColumnMenuModule,
  ContextMenuModule,
  MenuModule,
  ExcelExportModule,
  TreeDataModule,
])
