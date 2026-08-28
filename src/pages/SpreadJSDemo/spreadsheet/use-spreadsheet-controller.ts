'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CLIPBOARD_CALLBACKS,
  clipboardTextToMatrix,
  describeClipboardRange,
} from './clipboard';
import {
  BUSINESS_DATA,
  COLUMNS,
  COLUMN_GROUPS,
  COLUMN_HEADER_GROUPS,
  COLUMN_HEADER_SECTIONS,
  AVG_ORDER_COLUMN,
  COMPLETION_COLUMN,
  DECIMAL_COLUMN,
  DRILLABLE_METRIC_COLUMNS,
  EMPTY_STATS,
  HIERARCHY_COLUMN_COUNT,
  INITIAL_DATASET_LABEL,
  ORDERS_COLUMN,
  REVENUE_COLUMN,
  STATUS_COLUMN,
  STRESS_FULL_PAGE_VISIBLE_ROWS,
  STRESS_PAGE_SIZE,
  STRESS_TEXT_SEARCH_COLUMNS,
  UPDATED_AT_COLUMN,
  VERIFIED_COLUMN,
  columnName,
  findBusinessNode,
  flatRowsForView,
  flattenTree,
  getAggregateValue,
  getRowOutlineGroups,
  getStressRecordsAsync,
  hierarchyCellText,
  hierarchyColumnForRow,
  isHierarchyField,
  numericDisplayForColumn,
  pathForView,
  rootsForView,
  roundToTwoDecimals,
  stableCellKey,
  stressCellSearchText,
  updateBusinessNode,
  viewForNode,
  viewRowCellValue,
  viewRowValues,
  type AggregateMode,
  type CellAttachment,
  type DataMode,
  type DrillView,
  type HistoryItem,
  type NumericDisplay,
  type PanelName,
  type SelectedCell,
  type SelectionStats,
  type ToastState,
  type ToastTone,
  type ViewRow,
} from './model';

type GCModule = typeof import('@grapecity-software/spread-sheets');
type Workbook =
  import('@grapecity-software/spread-sheets').Spread.Sheets.Workbook;
type Worksheet =
  import('@grapecity-software/spread-sheets').Spread.Sheets.Worksheet;
type CellChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ICellChangedEventArgs;
type CellClickArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ICellClickEventArgs;
type CellDoubleClickArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ICellDoubleClickEventArgs;
type SelectionChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ISelectionChangedEventArgs;
type RangeGroupStateChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IRangeGroupStateChangedEventArgs;
type TopRowChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.ITopRowChangedEventArgs;
type ValidationErrorArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IValidationErrorEventArgs;
type ClipboardChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IClipboardChangedEventArgs;
type ClipboardPastingArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IClipboardPastingEventArgs;

export type SpreadsheetActions = {
  undo: () => void;
  redo: () => void;
  copy: () => void;
  autoFit: () => void;
  search: (query: string, direction: 1 | -1) => void;
  toggleColumn: (col: number, visible: boolean) => void;
  showAllColumns: () => void;
  setView: (view: DrillView) => void;
  drillSelected: () => void;
  up: () => void;
  toggleRowGroups: () => void;
  toggleColumnGroups: () => void;
  loadDataMode: (mode: 'regular' | 'stress') => void;
  openPanel: (panel: Exclude<PanelName, null>) => void;
  saveComment: (content: string) => void;
  deleteComment: () => void;
  addAttachments: (files: File[]) => void;
  removeAttachment: (attachmentId: string) => void;
};

export const ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_CELL = 10;
const ATTACHMENT_EXTENSION_PATTERN =
  /\.(?:avif|bmp|gif|jpe?g|png|svg|webp|pdf|docx?|xlsx?)$/i;
const ATTACHMENT_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6548c8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
)}`;

function isAcceptedAttachment(file: File) {
  return (
    file.type.startsWith('image/') ||
    ATTACHMENT_EXTENSION_PATTERN.test(file.name)
  );
}

export function useSpreadsheetController() {
  const hostRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<SpreadsheetActions | null>(null);
  const panelRef = useRef<PanelName>(null);
  const columnVisibilityRef = useRef(COLUMNS.map(() => true));
  const rowGroupsCollapsedRef = useRef(false);
  const columnGroupsCollapsedRef = useRef(false);
  const historyRef = useRef<Map<string, HistoryItem[]>>(
    new Map([
      [
        stableCellKey('bookcases-shanghai', 'revenue'),
        [
          {
            id: 'history-3',
            oldValue: 2_062_000,
            newValue: 2_086_400,
            source: '日报回写',
            createdAt: new Date('2026-08-21T16:34:00+08:00').getTime(),
          },
          {
            id: 'history-2',
            oldValue: 2_048_400,
            newValue: 2_062_000,
            source: '批量粘贴',
            createdAt: new Date('2026-08-21T14:18:00+08:00').getTime(),
          },
          {
            id: 'history-1',
            oldValue: null,
            newValue: 2_048_400,
            source: '数据导入',
            createdAt: new Date('2026-08-21T09:02:00+08:00').getTime(),
          },
        ],
      ],
    ]),
  );
  const commentsRef = useRef<Map<string, string>>(
    new Map([
      [
        stableCellKey('bookcases-shanghai', 'revenue'),
        '待复核：净收入与城市日报存在 2,400 元差异。',
      ],
    ]),
  );
  const attachmentsRef = useRef<Map<string, CellAttachment[]>>(new Map());

  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [view, setView] = useState<DrillView>([]);
  const [dataMode, setDataMode] = useState<DataMode>('regular');
  const [panel, setPanel] = useState<PanelName>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [selectionStats, setSelectionStats] =
    useState<SelectionStats>(EMPTY_STATS);
  const [aggregateMode, setAggregateMode] = useState<AggregateMode>('SUM');
  const [customFormula, setCustomFormula] = useState('SUM / COUNT');
  const [commentDraft, setCommentDraft] = useState('');
  const [persistedComment, setPersistedComment] = useState('');
  const [commentExists, setCommentExists] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<
    CellAttachment[]
  >([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('输入关键词后定位');
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() =>
    COLUMNS.map(() => true),
  );
  const [rowGroupsCollapsed, setRowGroupsCollapsed] = useState(false);
  const [columnGroupsCollapsed, setColumnGroupsCollapsed] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [datasetLabel, setDatasetLabel] = useState(INITIAL_DATASET_LABEL);
  const aggregateValue = getAggregateValue(
    selectionStats,
    aggregateMode,
    customFormula,
  );

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachments) =>
        attachments.forEach((attachment) =>
          URL.revokeObjectURL(attachment.objectUrl),
        ),
      );
    },
    [],
  );

  useEffect(() => {
    if (!panel && !searchOpen && !columnMenuOpen) return;
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPanel(null);
      setSearchOpen(false);
      setColumnMenuOpen(false);
    };
    const closePopoversOnOutsidePress = (event: PointerEvent) => {
      if (!searchOpen && !columnMenuOpen) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('.toolbar-popover-anchor')
      )
        return;
      setSearchOpen(false);
      setColumnMenuOpen(false);
    };
    window.addEventListener('keydown', closeTransientUi);
    document.addEventListener('pointerdown', closePopoversOnOutsidePress, true);
    return () => {
      window.removeEventListener('keydown', closeTransientUi);
      document.removeEventListener(
        'pointerdown',
        closePopoversOnOutsidePress,
        true,
      );
    };
  }, [columnMenuOpen, panel, searchOpen]);

  useEffect(() => {
    setReady(false);
    setInitializationError(null);
    let cancelled = false;
    let workbook: Workbook | null = null;
    let activeRows = flattenTree(BUSINESS_DATA);
    let activeRowOutlineGroups = getRowOutlineGroups(activeRows);
    let activeView: DrillView = [];
    let stressSourceRows: ViewRow[] | null = null;
    let stressSourceById = new Map<string, ViewRow>();
    let activeDataMode: 'regular' | 'stress' = 'regular';
    let activeSearch = { query: '', row: -1, col: -1 };
    let activeSearchRun = 0;
    let toastTimer = 0;
    let stressLoadTimer = 0;
    let stressViewportTimer = 0;
    let pendingStressTopRow = 0;
    let groupChangeBatching = false;
    const loadedStressPages = new Set<number>();
    const loadedStressRows = new Set<number>();
    let validationFlashTimer = 0;
    const renderedAttachmentCells = new Set<string>();
    let validationFlashCell: {
      row: number;
      col: number;
      backColor: string | null;
    } | null = null;

    const notify = (message: string, tone: ToastTone = 'success') => {
      window.clearTimeout(toastTimer);
      setToast({ message, tone });
      toastTimer = window.setTimeout(
        () => setToast(null),
        tone === 'error' ? 3200 : 2400,
      );
    };

    const start = async () => {
      const [GC] = (await Promise.all([
        import('@grapecity-software/spread-sheets'),
        import('@grapecity-software/spread-sheets-resources-zh'),
      ])) as [GCModule, unknown];
      if (cancelled || !hostRef.current) return;

      const licenseKey = process.env.NEXT_PUBLIC_SPREADJS_LICENSE_KEY;
      if (licenseKey) GC.Spread.Sheets.LicenseKey = licenseKey;
      GC.Spread.Common.CultureManager.culture('zh-cn');

      const spread = new GC.Spread.Sheets.Workbook(hostRef.current, {
        sheetCount: 1,
        allowUndo: true,
        allowUserResize: true,
        allowExtendPasteRange: true,
        allowCopyPasteExcelStyle: true,
        showResizeTip: GC.Spread.Sheets.ShowResizeTip.both,
        enableAccessibility: true,
        newTabVisible: false,
        tabEditable: false,
        autoFitType: GC.Spread.Sheets.AutoFitType.cellWithHeader,
        incrementalCalculation: true,
      });
      workbook = spread;
      spread.options.highlightInvalidData = true;
      const sheet = spread.getActiveSheet();
      sheet.name('经营明细');
      sheet.frozenColumnCount(HIERARCHY_COLUMN_COUNT);
      sheet.options.isProtected = false;
      sheet.options.rowHeaderAutoText = GC.Spread.Sheets.HeaderAutoText.numbers;
      spread.options.scrollByPixel = true;
      spread.options.scrollPixel = 22;

      // Cell types are immutable after setup. Reusing them avoids allocating
      // new controls and validators for every lazily loaded stress-data page.
      const statusCellType = new GC.Spread.Sheets.CellTypes.ComboBox();
      statusCellType.items(['已核验', '待复核', '异常']);
      statusCellType.editable(false);
      const verifiedCellType = new GC.Spread.Sheets.CellTypes.CheckBox();
      const datePickerCellButton: import('@grapecity-software/spread-sheets').Spread.Sheets.ICellButton =
        {
          imageType: GC.Spread.Sheets.ButtonImageType.dropdown,
          command: 'openDateTimePicker',
          position: GC.Spread.Sheets.ButtonPosition.right,
          visibility: GC.Spread.Sheets.ButtonVisibility.always,
          useButtonStyle: false,
          buttonBackColor: 'transparent',
          width: 18,
        };
      const decimalValidator =
        GC.Spread.Sheets.DataValidation.createNumberValidator(
          GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators.between,
          -1_000_000_000,
          1_000_000_000,
          false,
        );
      decimalValidator.ignoreBlank(true);
      decimalValidator.showInputMessage(false);
      decimalValidator.showErrorMessage(false);
      decimalValidator.errorStyle(
        GC.Spread.Sheets.DataValidation.ErrorStyle.stop,
      );

      const updateSelected = (row: number, col: number) => {
        const node = activeRows[row];
        const column = COLUMNS[col];
        if (!node || !column || col < 0 || col >= sheet.getColumnCount())
          return;
        const value = sheet.getValue(row, col);
        const cell: SelectedCell = {
          row,
          col,
          a1: `${columnName(col)}${row + 1}`,
          key: stableCellKey(node.id, column.field),
          field: column.field,
          fieldLabel: column.label,
          value,
          text: sheet.getText(row, col),
          node,
        };
        setSelected(cell);
        if (panelRef.current === 'history')
          setSelectedHistory(historyRef.current.get(cell.key) ?? []);
        if (panelRef.current === 'attachment')
          setSelectedAttachments([
            ...(attachmentsRef.current.get(cell.key) ?? []),
          ]);
      };

      const calculateSelection = (
        worksheet: Worksheet,
        range: import('@grapecity-software/spread-sheets').Spread.Sheets.Range,
      ) => {
        const startRow = Math.max(range.row, 0);
        const startCol = Math.max(range.col, 0);
        const rowCount =
          range.row < 0 ? worksheet.getRowCount() : range.rowCount;
        const colCount =
          range.col < 0 ? worksheet.getColumnCount() : range.colCount;
        const total = Math.max(0, rowCount * colCount);
        const inspectLimit = 200_000;
        const inspectCount = Math.min(total, inspectLimit);
        let numeric = 0;
        let sum = 0;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        let numericDisplay: NumericDisplay | null = null;
        for (let offset = 0; offset < inspectCount; offset += 1) {
          const row = startRow + Math.floor(offset / colCount);
          const col = startCol + (offset % colCount);
          const stressDataLoaded =
            loadedStressPages.has(Math.floor(row / STRESS_PAGE_SIZE)) ||
            loadedStressRows.has(row);
          const value =
            activeDataMode === 'stress' && !stressDataLoaded
              ? viewRowCellValue(activeRows[row], col)
              : worksheet.getValue(row, col);
          if (typeof value === 'number' && Number.isFinite(value)) {
            const cellDisplay = numericDisplayForColumn(col);
            numericDisplay =
              numericDisplay === null
                ? cellDisplay
                : numericDisplay === cellDisplay
                ? numericDisplay
                : 'mixed';
            numeric += 1;
            sum += value;
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
        setSelectionStats({
          cells: total,
          numeric,
          ignored: inspectCount - numeric,
          sum,
          average: numeric ? sum / numeric : 0,
          min: numeric ? min : 0,
          max: numeric ? max : 0,
          truncated: total > inspectLimit,
          numericDisplay: numericDisplay ?? 'number',
        });
      };

      const clearOutlinesAndComments = () => {
        const oldRows = Math.max(sheet.getRowCount(), 1);
        const oldCols = Math.max(sheet.getColumnCount(), 1);
        sheet.rowOutlines.ungroup();
        sheet.columnOutlines.ungroup();
        try {
          sheet.comments.clear(
            new GC.Spread.Sheets.Range(0, 0, oldRows, oldCols),
          );
        } catch {
          /* no comments */
        }
        renderedAttachmentCells.forEach((coordinate) => {
          const [row, col] = coordinate.split(':').map(Number);
          if (row >= oldRows || col >= oldCols) return;
          const cell = sheet.getCell(row, col);
          cell.cellButtons(
            col === UPDATED_AT_COLUMN ? [datePickerCellButton] : [],
          );
          cell.tag(null);
        });
        renderedAttachmentCells.clear();
      };

      const applyStableComments = () => {
        activeRows.forEach((row, rowIndex) => {
          COLUMNS.forEach((column, colIndex) => {
            const text = commentsRef.current.get(
              stableCellKey(row.id, column.field),
            );
            if (text) sheet.comments.add(rowIndex, colIndex, text);
          });
        });
      };

      const refreshAttachmentIndicator = (row: number, col: number) => {
        const node = activeRows[row];
        const column = COLUMNS[col];
        if (!node || !column || row < 0 || col < 0) return;
        const coordinate = `${row}:${col}`;
        const key = stableCellKey(node.id, column.field);
        const count = attachmentsRef.current.get(key)?.length ?? 0;
        const cell = sheet.getCell(row, col);
        const buttons = col === UPDATED_AT_COLUMN ? [datePickerCellButton] : [];
        if (count) {
          buttons.push({
            imageType: GC.Spread.Sheets.ButtonImageType.custom,
            imageSrc: ATTACHMENT_ICON,
            imageSize: { width: 13, height: 13 },
            caption: count > 1 ? String(count) : undefined,
            command: (_sheet, buttonRow, buttonCol) => {
              _sheet.setActiveCell(buttonRow, buttonCol);
              _sheet.setSelection(buttonRow, buttonCol, 1, 1);
              updateSelected(buttonRow, buttonCol);
              calculateSelection(
                _sheet,
                new GC.Spread.Sheets.Range(buttonRow, buttonCol, 1, 1),
              );
              openPanelForSelection('attachment');
            },
            position: GC.Spread.Sheets.ButtonPosition.right,
            visibility: GC.Spread.Sheets.ButtonVisibility.always,
            useButtonStyle: true,
            buttonBackColor: '#f3efff',
            hoverBackColor: '#e6defd',
            width: count > 1 ? 34 : 25,
          });
          cell.tag({ kind: 'cell-attachments', key, count });
          renderedAttachmentCells.add(coordinate);
        } else {
          cell.tag(null);
          renderedAttachmentCells.delete(coordinate);
        }
        cell.cellButtons(buttons);
      };

      const applyStableAttachmentIndicators = () => {
        activeRows.forEach((row, rowIndex) => {
          COLUMNS.forEach((column, colIndex) => {
            if (attachmentsRef.current.has(stableCellKey(row.id, column.field)))
              refreshAttachmentIndicator(rowIndex, colIndex);
          });
        });
      };

      const styleStatusCells = (
        startRow = 0,
        rowCount = Math.min(activeRows.length, STRESS_PAGE_SIZE),
      ) => {
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        for (let row = startRow; row < endRow; row += 1) {
          const status = activeRows[row].status;
          const cell = sheet.getCell(row, STATUS_COLUMN);
          if (status === '已核验')
            cell.backColor('#e6f5ef').foreColor('#19715d');
          else if (status === '异常')
            cell.backColor('#fee9e8').foreColor('#b13b3b');
          else cell.backColor('#fff4da').foreColor('#8a5a16');
        }
      };

      const syncGroupToolbarState = (isRowGroup: boolean) => {
        const collapsed = isRowGroup
          ? activeRowOutlineGroups.some(({ detailStart }) =>
              sheet.rowOutlines.isCollapsed(detailStart),
            )
          : COLUMN_GROUPS.some(({ detailStart }) =>
              sheet.columnOutlines.isCollapsed(detailStart),
            );
        if (isRowGroup) {
          rowGroupsCollapsedRef.current = collapsed;
          setRowGroupsCollapsed(collapsed);
        } else {
          columnGroupsCollapsedRef.current = collapsed;
          setColumnGroupsCollapsed(collapsed);
        }
      };

      const configureCellTypes = (startRow: number, rowCount: number) => {
        sheet
          .getRange(startRow, STATUS_COLUMN, rowCount, 1)
          .cellType(statusCellType);
        sheet
          .getRange(startRow, VERIFIED_COLUMN, rowCount, 1)
          .cellType(verifiedCellType);

        const updatedAtRange = sheet.getRange(
          startRow,
          UPDATED_AT_COLUMN,
          rowCount,
          1,
        );
        updatedAtRange.cellButtons([datePickerCellButton]);
        updatedAtRange.dropDowns([
          {
            type: GC.Spread.Sheets.DropDownType.dateTimePicker,
            option: {
              showTime: false,
              calendarPage: GC.Spread.Sheets.CalendarPage.day,
              startDay: GC.Spread.Sheets.CalendarStartDay.monday,
            },
          },
        ]);
        sheet.setDataValidator(
          startRow,
          DECIMAL_COLUMN,
          rowCount,
          1,
          decimalValidator,
          GC.Spread.Sheets.SheetArea.viewport,
        );
      };

      const styleDataRows = (
        startRow: number,
        rowCount: number,
        columnCount: number,
      ) => {
        sheet
          .getRange(startRow, REVENUE_COLUMN, rowCount, 3)
          .formatter('¥#,##0');
        sheet.getRange(startRow, ORDERS_COLUMN, rowCount, 3).formatter('#,##0');
        sheet
          .getRange(startRow, AVG_ORDER_COLUMN, rowCount, 1)
          .formatter('¥#,##0');
        sheet
          .getRange(startRow, COMPLETION_COLUMN, rowCount, 1)
          .formatter('0.0%');
        sheet
          .getRange(startRow, UPDATED_AT_COLUMN, rowCount, 1)
          .formatter('yyyy-mm-dd');
        sheet.getRange(startRow, DECIMAL_COLUMN, rowCount, 1).formatter('0.00');
        sheet
          .getRange(startRow, 0, rowCount, columnCount)
          .font('12px Arial, PingFang SC');
        sheet
          .getRange(startRow, 0, rowCount, 2)
          .backColor('#f4f6f8')
          .foreColor('#475467')
          .hAlign(GC.Spread.Sheets.HorizontalAlign.center);
        sheet
          .getRange(startRow, 2, rowCount, 2)
          .backColor('#eaf0f5')
          .foreColor('#1d2939')
          .font('600 12px Arial, PingFang SC');
        sheet
          .getRange(startRow, 0, rowCount, columnCount)
          .vAlign(GC.Spread.Sheets.VerticalAlign.center);
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        for (let row = startRow; row < endRow; row += 1) {
          const hierarchyCol = hierarchyColumnForRow(activeRows[row]);
          sheet
            .getCell(row, hierarchyCol)
            .textIndent(activeRows[row].hierarchyRole === 'detail' ? 1 : 0);
        }
      };

      const refreshHierarchyNavigator = (
        startRow = 0,
        rowCount = activeRows.length,
      ) => {
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        spread.suspendEvent();
        try {
          activeRowOutlineGroups.forEach(({ summaryRow, detailStart }) => {
            if (summaryRow < startRow || summaryRow >= endRow) return;
            const text = hierarchyCellText(
              activeRows[summaryRow],
              sheet.rowOutlines.isCollapsed(detailStart),
            );
            const hierarchyCol = hierarchyColumnForRow(activeRows[summaryRow]);
            if (sheet.getValue(summaryRow, hierarchyCol) !== text) {
              sheet.setValue(summaryRow, hierarchyCol, text);
            }
          });
        } finally {
          spread.resumeEvent();
        }
      };

      const writeStressPage = (pageIndex: number) => {
        if (activeDataMode !== 'stress' || loadedStressPages.has(pageIndex))
          return;
        const startRow = pageIndex * STRESS_PAGE_SIZE;
        if (startRow < 0 || startRow >= activeRows.length) return;
        const rowCount = Math.min(
          STRESS_PAGE_SIZE,
          activeRows.length - startRow,
        );
        let segmentStart = 0;
        for (let localRow = 0; localRow <= rowCount; localRow += 1) {
          const preserveExistingRow =
            localRow === rowCount || loadedStressRows.has(startRow + localRow);
          if (!preserveExistingRow) continue;
          if (localRow > segmentStart) {
            const segmentValues = activeRows
              .slice(startRow + segmentStart, startRow + localRow)
              .map((row) => viewRowValues(row, sheet.getColumnCount()));
            sheet.setArray(startRow + segmentStart, 0, segmentValues);
          }
          segmentStart = localRow + 1;
        }
        styleDataRows(startRow, rowCount, sheet.getColumnCount());
        configureCellTypes(startRow, rowCount);
        styleStatusCells(startRow, rowCount);
        refreshHierarchyNavigator(startRow, rowCount);
        loadedStressPages.add(pageIndex);
        for (let row = startRow; row < startRow + rowCount; row += 1)
          loadedStressRows.delete(row);
      };

      const writeStressRow = (row: number) => {
        const page = Math.floor(row / STRESS_PAGE_SIZE);
        if (
          row < 0 ||
          row >= activeRows.length ||
          loadedStressPages.has(page) ||
          loadedStressRows.has(row)
        )
          return;
        sheet.setArray(row, 0, [
          viewRowValues(activeRows[row], sheet.getColumnCount()),
        ]);
        styleDataRows(row, 1, sheet.getColumnCount());
        configureCellTypes(row, 1);
        styleStatusCells(row, 1);
        refreshHierarchyNavigator(row, 1);
        loadedStressRows.add(row);
      };

      const loadStressData = (
        pageIndices: Iterable<number>,
        rowIndices: Iterable<number> = [],
      ) => {
        if (activeDataMode !== 'stress') return;
        const maxPage = Math.ceil(activeRows.length / STRESS_PAGE_SIZE) - 1;
        const unloadedPages = [...new Set(pageIndices)].filter(
          (page) =>
            page >= 0 && page <= maxPage && !loadedStressPages.has(page),
        );
        const pagesBeingLoaded = new Set(unloadedPages);
        const unloadedRows = [...new Set(rowIndices)].filter(
          (row) =>
            row >= 0 &&
            row < activeRows.length &&
            !pagesBeingLoaded.has(Math.floor(row / STRESS_PAGE_SIZE)) &&
            !loadedStressPages.has(Math.floor(row / STRESS_PAGE_SIZE)) &&
            !loadedStressRows.has(row),
        );
        if (!unloadedPages.length && !unloadedRows.length) return;
        sheet.suspendPaint();
        sheet.suspendCalcService(false);
        sheet.suspendDirty();
        spread.suspendEvent();
        try {
          unloadedPages.forEach(writeStressPage);
          unloadedRows.forEach(writeStressRow);
        } finally {
          spread.resumeEvent();
          sheet.resumeDirty();
          sheet.resumeCalcService(false);
          sheet.resumePaint();
        }
        spread.repaint();
      };

      const loadVisibleStressRows = (fallbackTopRow = 0) => {
        if (activeDataMode !== 'stress') return;
        const viewportTop = sheet.getViewportTopRow(1);
        const topRow =
          viewportTop >= 0 ? viewportTop : Math.max(fallbackTopRow, 0);
        const viewportBottom = sheet.getViewportBottomRow(1);
        const bottomRow = Math.min(
          activeRows.length - 1,
          viewportBottom >= topRow ? viewportBottom : topRow + STRESS_PAGE_SIZE,
        );
        const visibleRowsByPage = new Map<number, number[]>();
        for (let row = topRow; row <= bottomRow; row += 1) {
          if (sheet.getRowVisible(row, GC.Spread.Sheets.SheetArea.viewport)) {
            const page = Math.floor(row / STRESS_PAGE_SIZE);
            const rows = visibleRowsByPage.get(page) ?? [];
            rows.push(row);
            visibleRowsByPage.set(page, rows);
          }
        }
        if (!visibleRowsByPage.size) {
          visibleRowsByPage.set(Math.floor(topRow / STRESS_PAGE_SIZE), [
            topRow,
          ]);
        }

        const fullPages: number[] = [];
        const sparseRows: number[] = [];
        visibleRowsByPage.forEach((rows, page) => {
          if (rows.length >= STRESS_FULL_PAGE_VISIBLE_ROWS)
            fullPages.push(page);
          else sparseRows.push(...rows);
        });

        // Prefetch the next physical page only for a normal, mostly contiguous
        // viewport. A collapsed outline can span tens of thousands of hidden rows.
        const nextRow = bottomRow + 1;
        if (
          bottomRow - topRow < STRESS_PAGE_SIZE * 2 &&
          nextRow < activeRows.length &&
          sheet.getRowVisible(nextRow, GC.Spread.Sheets.SheetArea.viewport)
        ) {
          fullPages.push(Math.floor(nextRow / STRESS_PAGE_SIZE));
        }
        loadStressData(fullPages, sparseRows);
      };

      const ensureStressRowLoaded = (row: number) => {
        if (activeDataMode !== 'stress') return;
        const page = Math.floor(row / STRESS_PAGE_SIZE);
        if (loadedStressPages.has(page) || loadedStressRows.has(row)) return;
        loadStressData([], [row]);
      };

      const scheduleStressViewportLoad = (topRow: number) => {
        pendingStressTopRow = topRow;
        window.clearTimeout(stressViewportTimer);
        stressViewportTimer = window.setTimeout(() => {
          stressViewportTimer = 0;
          loadVisibleStressRows(pendingStressTopRow);
        }, 32);
      };

      const normalizeActiveSelection = () => {
        const activeRow = sheet.getActiveRowIndex();
        const activeCol = sheet.getActiveColumnIndex();
        let nextRow = activeRow;
        let nextCol = activeCol;

        if (
          activeRow >= 0 &&
          !sheet.getRowVisible(activeRow, GC.Spread.Sheets.SheetArea.viewport)
        ) {
          for (nextRow = activeRow - 1; nextRow >= 0; nextRow -= 1) {
            if (
              sheet.getRowVisible(nextRow, GC.Spread.Sheets.SheetArea.viewport)
            )
              break;
          }
          if (nextRow < 0) nextRow = 0;
        }
        if (
          activeCol >= 0 &&
          !sheet.getColumnVisible(
            activeCol,
            GC.Spread.Sheets.SheetArea.viewport,
          )
        ) {
          for (nextCol = activeCol - 1; nextCol >= 0; nextCol -= 1) {
            if (
              sheet.getColumnVisible(
                nextCol,
                GC.Spread.Sheets.SheetArea.viewport,
              )
            )
              break;
          }
          if (nextCol < 0) nextCol = 0;
        }
        if (nextRow === activeRow && nextCol === activeCol) return;

        ensureStressRowLoaded(nextRow);
        sheet.setActiveCell(nextRow, nextCol);
        sheet.setSelection(nextRow, nextCol, 1, 1);
        sheet.showCell(
          nextRow,
          nextCol,
          GC.Spread.Sheets.VerticalPosition.nearest,
          GC.Spread.Sheets.HorizontalPosition.nearest,
        );
        updateSelected(nextRow, nextCol);
        calculateSelection(
          sheet,
          new GC.Spread.Sheets.Range(nextRow, nextCol, 1, 1),
        );
      };

      const refreshAfterGroupChange = (isRowGroup: boolean) => {
        syncGroupToolbarState(isRowGroup);
        if (isRowGroup) refreshHierarchyNavigator();
        spread.invalidateLayout();
        if (isRowGroup && activeDataMode === 'stress') {
          window.clearTimeout(stressViewportTimer);
          stressViewportTimer = 0;
          loadVisibleStressRows(sheet.getViewportTopRow(1));
        }
        normalizeActiveSelection();
        if (isRowGroup && activeDataMode === 'stress') {
          // Re-check after SpreadJS has committed its new viewport bounds.
          scheduleStressViewportLoad(sheet.getViewportTopRow(1));
        }
        spread.repaint();
      };

      const runOutlineBatch = (isRowGroup: boolean, change: () => void) => {
        groupChangeBatching = true;
        sheet.suspendPaint();
        try {
          change();
        } finally {
          sheet.resumePaint();
          groupChangeBatching = false;
        }
        refreshAfterGroupChange(isRowGroup);
      };

      const renderRows = (rows: ViewRow[], stress: boolean) => {
        activeRows = rows;
        activeRowOutlineGroups = getRowOutlineGroups(rows);
        activeDataMode = stress ? 'stress' : 'regular';
        activeSearch = { query: '', row: -1, col: -1 };
        const rowCount = rows.length;
        const colCount = COLUMNS.length;
        sheet.suspendPaint();
        sheet.suspendCalcService(false);
        sheet.suspendDirty();
        spread.suspendEvent();
        try {
          clearOutlinesAndComments();
          sheet.setRowCount(rowCount);
          sheet.setColumnCount(colCount);
          sheet.frozenColumnCount(HIERARCHY_COLUMN_COUNT);
          loadedStressPages.clear();
          loadedStressRows.clear();
          if (stress) {
            writeStressPage(0);
            writeStressPage(1);
          } else {
            sheet.setArray(
              0,
              0,
              rows.map((row) => viewRowValues(row, colCount)),
            );
          }

          const headerArea = GC.Spread.Sheets.SheetArea.colHeader;
          sheet.getSpans(undefined, headerArea).forEach((span) => {
            sheet.removeSpan(span.row, span.col, headerArea);
          });
          sheet.setRowCount(3, headerArea);

          const allHeaders = COLUMNS.map((column) => column.label);
          allHeaders.forEach((header, col) => {
            sheet.setValue(0, col, null, headerArea);
            sheet.setValue(1, col, null, headerArea);
            sheet.setValue(2, col, header, headerArea);
          });

          COLUMN_HEADER_GROUPS.forEach(
            ({ label, startCol, colCount: groupColumnCount }) => {
              sheet.setValue(1, startCol, label, headerArea);
              if (groupColumnCount > 1)
                sheet.addSpan(1, startCol, 1, groupColumnCount, headerArea);
            },
          );

          COLUMN_HEADER_SECTIONS.forEach(
            ({ label, startCol, colCount: sectionColumnCount }) => {
              // Sections without a real second-level breakdown (e.g. the
              // hierarchy columns) span both group rows so the header reads
              // as a single label instead of leaving row 1 blank.
              const hasSubGroups = COLUMN_HEADER_GROUPS.some(
                (group) =>
                  group.startCol >= startCol &&
                  group.startCol < startCol + sectionColumnCount,
              );
              const rowSpan = hasSubGroups ? 1 : 2;
              sheet.setValue(0, startCol, label, headerArea);
              if (sectionColumnCount > 1 || rowSpan > 1)
                sheet.addSpan(
                  0,
                  startCol,
                  rowSpan,
                  sectionColumnCount,
                  headerArea,
                );
            },
          );
          COLUMNS.forEach((column, col) =>
            sheet.setColumnWidth(col, column.width),
          );

          if (!stress) styleDataRows(0, rowCount, colCount);
          sheet
            .getRange(0, 0, 3, colCount, headerArea)
            .backColor('#f4f6fa')
            .foreColor('#344054')
            .hAlign(GC.Spread.Sheets.HorizontalAlign.center)
            .vAlign(GC.Spread.Sheets.VerticalAlign.center)
            .font('600 12px Arial, PingFang SC');
          sheet
            .getRange(1, 0, 1, colCount, headerArea)
            .backColor('#f7f5ff')
            .foreColor('#67569e')
            .font('650 12px Arial, PingFang SC');
          sheet
            .getRange(0, 0, 1, colCount, headerArea)
            .backColor('#e9e3fb')
            .foreColor('#513b9d')
            .font('700 12px Arial, PingFang SC');
          sheet.setRowHeight(0, 27, headerArea);
          sheet.setRowHeight(1, 27, headerArea);
          sheet.setRowHeight(2, 34, headerArea);
          if (!stress) configureCellTypes(0, rowCount);

          // Summary rows sit above their detail rows. The control therefore stays
          // on the row whose own descendants it expands or collapses.
          sheet.rowOutlines.direction(
            GC.Spread.Sheets.Outlines.OutlineDirection.backward,
          );
          activeRowOutlineGroups.forEach(
            ({ summaryRow, detailStart, detailCount }) => {
              sheet.rowOutlines.group(detailStart, detailCount);
              sheet
                .getRange(summaryRow, 0, 1, colCount)
                .font('600 12px Arial, PingFang SC');
            },
          );
          sheet.showRowOutline(true);
          refreshHierarchyNavigator();
          // Keep each summary column visible and collapse only its detail columns.
          sheet.columnOutlines.direction(
            GC.Spread.Sheets.Outlines.OutlineDirection.backward,
          );
          COLUMN_GROUPS.forEach(({ detailStart, detailCount }) => {
            sheet.columnOutlines.group(detailStart, detailCount);
          });
          sheet.showColumnOutline(true);
          if (!stress) {
            applyStableComments();
            applyStableAttachmentIndicators();
            styleStatusCells(0, rowCount);
          }

          COLUMNS.forEach((_, col) =>
            sheet.setColumnVisible(col, columnVisibilityRef.current[col]),
          );
        } finally {
          spread.resumeEvent();
          sheet.resumeDirty();
          sheet.resumeCalcService(false);
          sheet.resumePaint();
        }
        spread.invalidateLayout();
        spread.repaint();
        sheet.setActiveCell(0, 0);
        sheet.setSelection(0, 0, 1, 1);
        sheet.showCell(
          0,
          0,
          GC.Spread.Sheets.VerticalPosition.top,
          GC.Spread.Sheets.HorizontalPosition.left,
        );
        updateSelected(0, 0);
        calculateSelection(sheet, new GC.Spread.Sheets.Range(0, 0, 1, 1));
        setDatasetLabel(
          `${rowCount.toLocaleString('zh-CN')} 行 × ${colCount} 列`,
        );
        rowGroupsCollapsedRef.current = false;
        columnGroupsCollapsedRef.current = false;
        setRowGroupsCollapsed(false);
        setColumnGroupsCollapsed(false);
        setReady(true);
      };

      const openPanelForSelection = (nextPanel: Exclude<PanelName, null>) => {
        const row = sheet.getActiveRowIndex();
        const col = sheet.getActiveColumnIndex();
        updateSelected(row, col);
        const node = activeRows[row];
        const column = COLUMNS[col];
        if (node && column) {
          const key = stableCellKey(node.id, column.field);
          if (nextPanel === 'comment') {
            const existingComment = commentsRef.current.get(key);
            setCommentDraft(existingComment ?? '');
            setPersistedComment(existingComment ?? '');
            setCommentExists(Boolean(existingComment));
          }
          if (nextPanel === 'attachment')
            setSelectedAttachments([
              ...(attachmentsRef.current.get(key) ?? []),
            ]);
          if (nextPanel === 'history')
            setSelectedHistory(historyRef.current.get(key) ?? []);
        }
        setSearchOpen(false);
        setColumnMenuOpen(false);
        setPanel(nextPanel);
      };

      const setViewAndRender = (nextView: DrillView) => {
        const previousDepth = activeView.length;
        const nextRows =
          activeDataMode === 'stress'
            ? flatRowsForView(stressSourceRows ?? [], nextView)
            : flattenTree(rootsForView(nextView));
        if (nextView.length && !nextRows.length) {
          notify('当前层级没有可显示的下级数据', 'error');
          return;
        }
        activeView = nextView;
        setView([...nextView]);
        setPanel(null);
        renderRows(nextRows, activeDataMode === 'stress');
        const currentName = pathForView(nextView).at(-1);
        notify(
          nextView.length === 0
            ? '已返回全部区域'
            : nextView.length > previousDepth
            ? `已下钻至${currentName}`
            : `已返回${currentName}`,
        );
      };

      const drillRow = (row: number) => {
        const node = activeRows[row];
        const nextView = node ? viewForNode(activeView, node) : null;
        if (!nextView) {
          notify('当前已经是最细粒度');
          return;
        }
        setViewAndRender(nextView);
      };

      const drillSelected = () => drillRow(sheet.getActiveRowIndex());

      const toggleHierarchyRow = (row: number) => {
        const node = activeRows[row];
        const group = activeRowOutlineGroups.find(
          (candidate) => candidate.summaryRow === row,
        );
        if (!node || !group) return;
        const groupInfo = sheet.rowOutlines.find(group.detailStart, node.level);
        if (!groupInfo) return;
        const collapse = !sheet.rowOutlines.isCollapsed(group.detailStart);
        // The range group owns the complete descendant range, including cells
        // that have not been materialized yet in 100k mode. The middle column
        // is a lightweight navigation surface over that single source of truth.
        runOutlineBatch(true, () =>
          sheet.rowOutlines.expandGroup(groupInfo, !collapse),
        );
        notify(
          collapse ? `已收起${node.name}的下级` : `已展开${node.name}的下级`,
        );
      };

      const openDatePicker = (row: number, col: number) => {
        if (row < 0 || col !== UPDATED_AT_COLUMN) return;
        ensureStressRowLoaded(row);
        spread.commandManager().execute({
          cmd: 'openDateTimePicker',
          sheetName: sheet.name(),
          row,
          col,
          sheetArea: GC.Spread.Sheets.SheetArea.viewport,
        });
      };

      const searchCellBlock = (
        query: string,
        rowStart: number,
        colStart: number,
        rowEnd: number,
        colEnd: number,
      ) => {
        if (rowStart > rowEnd || colStart > colEnd) return null;
        const condition = new GC.Spread.Sheets.Search.SearchCondition();
        condition.searchString = query;
        condition.sheetArea = GC.Spread.Sheets.SheetArea.viewport;
        condition.rowStart = rowStart;
        condition.rowEnd = rowEnd;
        condition.columnStart = colStart;
        condition.columnEnd = colEnd;
        condition.searchOrder = GC.Spread.Sheets.Search.SearchOrder.nOrder;
        condition.searchTarget =
          GC.Spread.Sheets.Search.SearchFoundFlags.cellText |
          GC.Spread.Sheets.Search.SearchFoundFlags.cellFormula;
        condition.searchFlags =
          GC.Spread.Sheets.Search.SearchFlags.ignoreCase |
          GC.Spread.Sheets.Search.SearchFlags.blockRange;
        const result = sheet.search(condition);
        if (
          result.searchFoundFlag ===
          GC.Spread.Sheets.Search.SearchFoundFlags.none
        )
          return null;
        return { row: result.foundRowIndex, col: result.foundColumnIndex };
      };

      const findLastCellMatch = (
        query: string,
        rowStart: number,
        colStart: number,
        rowEnd: number,
        colEnd: number,
      ) => {
        if (!searchCellBlock(query, rowStart, colStart, rowEnd, colEnd))
          return null;

        let firstRow = rowStart;
        let lastRow = rowEnd;
        while (firstRow < lastRow) {
          const middleRow = Math.floor((firstRow + lastRow + 1) / 2);
          if (searchCellBlock(query, middleRow, colStart, rowEnd, colEnd))
            firstRow = middleRow;
          else lastRow = middleRow - 1;
        }

        let firstCol = colStart;
        let lastCol = colEnd;
        while (firstCol < lastCol) {
          const middleCol = Math.floor((firstCol + lastCol + 1) / 2);
          if (searchCellBlock(query, firstRow, middleCol, firstRow, colEnd))
            firstCol = middleCol;
          else lastCol = middleCol - 1;
        }
        return searchCellBlock(query, firstRow, firstCol, firstRow, firstCol);
      };

      const findStressCellMatch = async (
        query: string,
        direction: 1 | -1,
        queryChanged: boolean,
        searchRun: number,
      ) => {
        const columnCount = sheet.getColumnCount();
        const totalCells = activeRows.length * columnCount;
        if (!totalCells) return null;
        const currentIndex = activeSearch.row * columnCount + activeSearch.col;
        let cellIndex = queryChanged
          ? direction === 1
            ? 0
            : totalCells - 1
          : (currentIndex + direction + totalCells) % totalCells;
        const normalizedQuery = query.toLowerCase();
        const includeFormattedNumber = /[,，%¥￥]/.test(query);
        const textOnlyQuery = /[A-Za-z\u3400-\u9fff]/u.test(query);
        for (let inspected = 0; inspected < totalCells; inspected += 1) {
          if (inspected > 0 && inspected % 50_000 === 0) {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            if (cancelled || searchRun !== activeSearchRun) return null;
          }
          const row = Math.floor(cellIndex / columnCount);
          const col = cellIndex % columnCount;
          if (!textOnlyQuery || STRESS_TEXT_SEARCH_COLUMNS.has(col)) {
            const stressDataLoaded =
              loadedStressPages.has(Math.floor(row / STRESS_PAGE_SIZE)) ||
              loadedStressRows.has(row);
            const text = stressDataLoaded
              ? `${sheet.getText(row, col)} ${
                  sheet.getFormula(row, col) ?? ''
                } ${sheet.getValue(row, col) ?? ''}`.toLowerCase()
              : stressCellSearchText(
                  activeRows[row],
                  col,
                  includeFormattedNumber,
                ).toLowerCase();
            if (text.includes(normalizedQuery)) return { row, col };
          }
          cellIndex = (cellIndex + direction + totalCells) % totalCells;
        }
        return null;
      };

      const revealSearchMatch = (row: number, col: number) => {
        if (!sheet.getRowVisible(row)) {
          runOutlineBatch(true, () => {
            for (
              let level = 0;
              level <= sheet.rowOutlines.getMaxLevel();
              level += 1
            ) {
              sheet.rowOutlines.expand(level, true);
            }
          });
        }
        if (!sheet.getColumnVisible(col)) {
          runOutlineBatch(false, () => {
            for (
              let level = 0;
              level <= sheet.columnOutlines.getMaxLevel();
              level += 1
            ) {
              sheet.columnOutlines.expand(level, true);
            }
          });
          if (!sheet.getColumnVisible(col)) {
            sheet.setColumnVisible(col, true);
            if (col < COLUMNS.length) {
              columnVisibilityRef.current[col] = true;
              setColumnVisibility((current) =>
                current.map((value, index) => (index === col ? true : value)),
              );
            }
          }
        }
        sheet.setActiveCell(row, col);
        sheet.setSelection(row, col, 1, 1);
        sheet.showCell(
          row,
          col,
          GC.Spread.Sheets.VerticalPosition.center,
          GC.Spread.Sheets.HorizontalPosition.center,
        );
        updateSelected(row, col);
        calculateSelection(sheet, new GC.Spread.Sheets.Range(row, col, 1, 1));
      };

      const search = async (query: string, direction: 1 | -1) => {
        const trimmed = query.trim();
        if (!trimmed) {
          setSearchResult('请输入搜索关键词');
          return;
        }
        const rowCount = sheet.getRowCount();
        const colCount = sheet.getColumnCount();
        const lastRow = rowCount - 1;
        const lastCol = colCount - 1;
        const queryChanged =
          activeSearch.query !== trimmed ||
          activeSearch.row < 0 ||
          activeSearch.col < 0;
        if (activeDataMode === 'stress') {
          const searchRun = ++activeSearchRun;
          setSearchResult('正在搜索 10 万行…');
          const stressMatch = await findStressCellMatch(
            trimmed,
            direction,
            queryChanged,
            searchRun,
          );
          if (cancelled || searchRun !== activeSearchRun) return;
          if (!stressMatch) {
            activeSearch = { query: trimmed, row: -1, col: -1 };
            setSearchResult('未找到匹配项');
            notify(`所有 10 万行、${colCount} 列中均未找到匹配项`);
            return;
          }
          activeSearch = {
            query: trimmed,
            row: stressMatch.row,
            col: stressMatch.col,
          };
          ensureStressRowLoaded(stressMatch.row);
          revealSearchMatch(stressMatch.row, stressMatch.col);
          setSearchResult(
            `匹配于 ${columnName(stressMatch.col)}${stressMatch.row + 1}`,
          );
          return;
        }
        const cursor = queryChanged
          ? { row: 0, col: direction === 1 ? -1 : 0 }
          : { row: activeSearch.row, col: activeSearch.col };

        const match =
          direction === 1
            ? searchCellBlock(
                trimmed,
                cursor.row,
                cursor.col + 1,
                cursor.row,
                lastCol,
              ) ??
              searchCellBlock(trimmed, cursor.row + 1, 0, lastRow, lastCol) ??
              searchCellBlock(trimmed, 0, 0, cursor.row - 1, lastCol) ??
              searchCellBlock(trimmed, cursor.row, 0, cursor.row, cursor.col)
            : findLastCellMatch(
                trimmed,
                cursor.row,
                0,
                cursor.row,
                cursor.col - 1,
              ) ??
              findLastCellMatch(trimmed, 0, 0, cursor.row - 1, lastCol) ??
              findLastCellMatch(trimmed, cursor.row + 1, 0, lastRow, lastCol) ??
              findLastCellMatch(
                trimmed,
                cursor.row,
                cursor.col,
                cursor.row,
                lastCol,
              );

        if (!match) {
          activeSearch = { query: trimmed, row: -1, col: -1 };
          setSearchResult('未找到匹配项');
          notify('所有单元格中均未找到匹配项');
          return;
        }
        activeSearch = { query: trimmed, row: match.row, col: match.col };
        revealSearchMatch(match.row, match.col);
        setSearchResult(`匹配于 ${columnName(match.col)}${match.row + 1}`);
      };

      actionsRef.current = {
        undo: () => {
          if (!spread.undoManager().canUndo()) {
            notify('暂无可撤销的单元格操作');
            return;
          }
          spread
            .commandManager()
            .execute({ cmd: 'undo', sheetName: sheet.name() });
          notify('已撤销上一次单元格操作');
        },
        redo: () => {
          if (!spread.undoManager().canRedo()) {
            notify('暂无可重做的单元格操作');
            return;
          }
          spread
            .commandManager()
            .execute({ cmd: 'redo', sheetName: sheet.name() });
          notify('已重做上一次单元格操作');
        },
        copy: () => {
          spread
            .commandManager()
            .execute({ cmd: 'copy', sheetName: sheet.name() });
          notify('矩形选区已复制，可粘贴到 Excel');
        },
        autoFit: () => {
          const columnCount = sheet.getColumnCount();
          sheet.suspendPaint();
          try {
            for (let col = 0; col < columnCount; col += 1) {
              sheet.autoFitColumn(col);
            }
          } finally {
            sheet.resumePaint();
          }
          spread.invalidateLayout();
          spread.repaint();
          notify(`已按内容适配全部 ${columnCount} 列宽`);
        },
        search,
        toggleColumn: (col, visible) => {
          if (col < HIERARCHY_COLUMN_COUNT) return;
          sheet.setColumnVisible(col, visible);
          columnVisibilityRef.current[col] = visible;
          setColumnVisibility((current) =>
            current.map((value, index) => (index === col ? visible : value)),
          );
          if (!visible) normalizeActiveSelection();
        },
        showAllColumns: () => {
          COLUMNS.forEach((_, col) => {
            sheet.setColumnVisible(col, true);
            columnVisibilityRef.current[col] = true;
          });
          setColumnVisibility(COLUMNS.map(() => true));
          normalizeActiveSelection();
          notify('已显示全部列');
        },
        setView: setViewAndRender,
        drillSelected,
        up: () => {
          if (activeView.length) setViewAndRender(activeView.slice(0, -1));
          else notify('当前已经是最高层级');
        },
        toggleRowGroups: () => {
          const collapse = !rowGroupsCollapsedRef.current;
          runOutlineBatch(true, () => {
            if (collapse) {
              for (
                let level = sheet.rowOutlines.getMaxLevel();
                level >= 0;
                level -= 1
              ) {
                sheet.rowOutlines.expand(level, false);
              }
            } else {
              for (
                let level = 0;
                level <= sheet.rowOutlines.getMaxLevel();
                level += 1
              ) {
                sheet.rowOutlines.expand(level, true);
              }
            }
          });
          notify(collapse ? '已收起所有行分组' : '已展开所有行分组');
        },
        toggleColumnGroups: () => {
          const collapse = !columnGroupsCollapsedRef.current;
          runOutlineBatch(false, () => {
            if (collapse) {
              for (
                let level = sheet.columnOutlines.getMaxLevel();
                level >= 0;
                level -= 1
              ) {
                sheet.columnOutlines.expand(level, false);
              }
            } else {
              for (
                let level = 0;
                level <= sheet.columnOutlines.getMaxLevel();
                level += 1
              ) {
                sheet.columnOutlines.expand(level, true);
              }
            }
          });
          notify(collapse ? '已收起所有列分组明细' : '已展开所有列分组明细');
        },
        loadDataMode: (mode) => {
          activeSearchRun += 1;
          window.clearTimeout(stressLoadTimer);
          stressLoadTimer = 0;
          if (mode === 'regular') {
            setDataMode('regular');
            activeView = [];
            setView([]);
            renderRows(flattenTree(BUSINESS_DATA), false);
            notify('已恢复常规业务数据');
            return;
          }
          setDataMode('loading');
          setPanel(null);
          stressLoadTimer = window.setTimeout(() => {
            stressLoadTimer = 0;
            if (cancelled) return;
            const startedAt = performance.now();
            void getStressRecordsAsync()
              .then((rows) => {
                if (cancelled) return;
                stressSourceRows = rows;
                stressSourceById = new Map(rows.map((row) => [row.id, row]));
                activeView = [];
                setView([]);
                renderRows(rows, true);
                setDataMode('stress');
                notify(
                  `10 万行已载入，用时 ${Math.round(
                    performance.now() - startedAt,
                  )} ms`,
                );
              })
              .catch((error: unknown) => {
                console.error('[SpreadJS] 压力数据生成失败', error);
                if (cancelled) return;
                setDataMode('regular');
                notify('压力数据生成失败，请重试', 'error');
              });
          }, 40);
        },
        openPanel: openPanelForSelection,
        saveComment: (content) => {
          const row = sheet.getActiveRowIndex();
          const col = sheet.getActiveColumnIndex();
          const node = activeRows[row];
          const column = COLUMNS[col];
          const normalized = content.trim();
          if (!node || !column || !normalized) return;
          const key = stableCellKey(node.id, column.field);
          commentsRef.current.set(key, normalized);
          const current = sheet.comments.get(row, col);
          if (current) current.text(normalized);
          else sheet.comments.add(row, col, normalized);
          setCommentDraft(normalized);
          setPersistedComment(normalized);
          setCommentExists(true);
          notify('批注已保存到稳定单元格 ID');
        },
        deleteComment: () => {
          const row = sheet.getActiveRowIndex();
          const col = sheet.getActiveColumnIndex();
          const node = activeRows[row];
          const column = COLUMNS[col];
          if (!node || !column) return;
          commentsRef.current.delete(stableCellKey(node.id, column.field));
          if (sheet.comments.get(row, col)) sheet.comments.remove(row, col);
          setCommentDraft('');
          setPersistedComment('');
          setCommentExists(false);
          notify('批注已删除');
        },
        addAttachments: (files) => {
          const row = sheet.getActiveRowIndex();
          const col = sheet.getActiveColumnIndex();
          const node = activeRows[row];
          const column = COLUMNS[col];
          if (!node || !column || !files.length) return;
          const key = stableCellKey(node.id, column.field);
          const current = attachmentsRef.current.get(key) ?? [];
          const availableSlots = Math.max(
            MAX_ATTACHMENTS_PER_CELL - current.length,
            0,
          );
          const accepted: File[] = [];
          let rejected = 0;
          files.forEach((file) => {
            const duplicate = current.some(
              (attachment) =>
                attachment.name === file.name &&
                attachment.size === file.size &&
                attachment.lastModified === file.lastModified,
            );
            if (
              !isAcceptedAttachment(file) ||
              file.size > MAX_ATTACHMENT_SIZE ||
              duplicate ||
              accepted.length >= availableSlots
            ) {
              rejected += 1;
              return;
            }
            accepted.push(file);
          });
          if (!accepted.length) {
            notify(
              availableSlots
                ? '未添加：请检查文件类型、5 MB 大小限制或是否重复'
                : `每个单元格最多添加 ${MAX_ATTACHMENTS_PER_CELL} 个附件`,
              'error',
            );
            return;
          }
          const created = accepted.map<CellAttachment>((file) => ({
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            objectUrl: URL.createObjectURL(file),
            createdAt: Date.now(),
            lastModified: file.lastModified,
          }));
          const next = [...current, ...created];
          attachmentsRef.current.set(key, next);
          setSelectedAttachments([...next]);
          refreshAttachmentIndicator(row, col);
          spread.repaint();
          notify(
            rejected
              ? `已添加 ${created.length} 个附件，跳过 ${rejected} 个无效或重复文件`
              : `已为 ${columnName(col)}${row + 1} 添加 ${
                  created.length
                } 个附件`,
          );
        },
        removeAttachment: (attachmentId) => {
          const row = sheet.getActiveRowIndex();
          const col = sheet.getActiveColumnIndex();
          const node = activeRows[row];
          const column = COLUMNS[col];
          if (!node || !column) return;
          const key = stableCellKey(node.id, column.field);
          const current = attachmentsRef.current.get(key) ?? [];
          const removed = current.find(
            (attachment) => attachment.id === attachmentId,
          );
          if (!removed) return;
          URL.revokeObjectURL(removed.objectUrl);
          const next = current.filter(
            (attachment) => attachment.id !== attachmentId,
          );
          if (next.length) attachmentsRef.current.set(key, next);
          else attachmentsRef.current.delete(key);
          setSelectedAttachments([...next]);
          refreshAttachmentIndicator(row, col);
          spread.repaint();
          notify(`已删除附件「${removed.name}」`);
        },
      };

      spread.commandManager().register('businessComment', {
        canUndo: false,
        execute: () => {
          openPanelForSelection('comment');
          return true;
        },
      });
      spread.commandManager().register('businessHistory', {
        canUndo: false,
        execute: () => {
          openPanelForSelection('history');
          return true;
        },
      });
      spread.commandManager().register('businessLineage', {
        canUndo: false,
        execute: () => {
          openPanelForSelection('lineage');
          return true;
        },
      });
      spread.commandManager().register('businessAttachment', {
        canUndo: false,
        execute: () => {
          openPanelForSelection('attachment');
          return true;
        },
      });
      spread.commandManager().register('businessDrill', {
        canUndo: false,
        execute: () => {
          drillSelected();
          return true;
        },
      });
      spread.contextMenu.menuData.push(
        {
          text: '新增 / 编辑批注',
          name: 'business-comment',
          command: 'businessComment',
          workArea: 'viewport',
        },
        {
          text: '查看值历史',
          name: 'business-history',
          command: 'businessHistory',
          workArea: 'viewport',
        },
        {
          text: '数据追踪',
          name: 'business-lineage',
          command: 'businessLineage',
          workArea: 'viewport',
        },
        {
          text: '附件管理',
          name: 'business-attachment',
          command: 'businessAttachment',
          workArea: 'viewport',
        },
        {
          text: '下钻到下一层',
          name: 'business-drill',
          command: 'businessDrill',
          workArea: 'viewport',
        },
      );

      sheet.bind(
        GC.Spread.Sheets.Events.EnterCell,
        (_sender: unknown, args: { row: number; col: number }) => {
          updateSelected(args.row, args.col);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.SelectionChanged,
        (_sender: unknown, args: SelectionChangedArgs) => {
          const range = args.newSelections.at(-1);
          if (range) calculateSelection(sheet, range);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.CellClick,
        (_sender: unknown, args: CellClickArgs) => {
          if (args.sheetArea !== GC.Spread.Sheets.SheetArea.viewport) return;
          const node = activeRows[args.row];
          if (node && args.col === hierarchyColumnForRow(node)) {
            toggleHierarchyRow(args.row);
            return;
          }
          openDatePicker(args.row, args.col);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.CellDoubleClick,
        (_sender: unknown, args: CellDoubleClickArgs) => {
          if (args.sheetArea !== GC.Spread.Sheets.SheetArea.viewport) return;
          const node = activeRows[args.row];
          if (!node || !DRILLABLE_METRIC_COLUMNS.has(args.col)) return;
          drillRow(args.row);
        },
      );
      spread.bind(
        GC.Spread.Sheets.Events.ClipboardChanged,
        (_sender: unknown, args: ClipboardChangedArgs) => {
          const text = args.copyData.text ?? '';
          const range = args.sheet.getSelections().at(-1);
          CLIPBOARD_CALLBACKS.onCopied?.({
            sheetName: args.sheetName,
            range: describeClipboardRange(range),
            text,
            data: clipboardTextToMatrix(text),
          });
        },
      );
      spread.bind(
        GC.Spread.Sheets.Events.ClipboardPasting,
        (_sender: unknown, args: ClipboardPastingArgs) => {
          const text = args.pasteData.text ?? '';
          const shouldContinue = CLIPBOARD_CALLBACKS.onPasting?.({
            sheetName: args.sheetName,
            range: describeClipboardRange(args.cellRange),
            text,
            data: clipboardTextToMatrix(text),
            isCutting: args.isCutting,
          });
          if (shouldContinue === false) args.cancel = true;
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.ValidationError,
        (_sender: unknown, args: ValidationErrorArgs) => {
          if (args.col !== DECIMAL_COLUMN) return;

          args.validationResult =
            GC.Spread.Sheets.DataValidation.DataValidationResult.discard;
          window.clearTimeout(validationFlashTimer);
          if (validationFlashCell) {
            sheet
              .getCell(validationFlashCell.row, validationFlashCell.col)
              .backColor(validationFlashCell.backColor ?? '#fff');
          }
          const cell = sheet.getCell(args.row, args.col);
          validationFlashCell = {
            row: args.row,
            col: args.col,
            backColor: cell.backColor() ?? null,
          };
          cell.backColor('#fff0ef');
          spread.repaint();
          validationFlashTimer = window.setTimeout(() => {
            if (!validationFlashCell) return;
            sheet
              .getCell(validationFlashCell.row, validationFlashCell.col)
              .backColor(validationFlashCell.backColor ?? '#fff');
            validationFlashCell = null;
            spread.repaint();
          }, 2400);
          notify('调整系数仅支持数字，例如 1.25；已保留原值', 'error');
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.CellChanged,
        (_sender: unknown, args: CellChangedArgs) => {
          if (args.propertyName !== 'value' || args.row < 0 || args.col < 0)
            return;
          const node = activeRows[args.row];
          const column = COLUMNS[args.col];
          if (!node || !column) return;
          if (isHierarchyField(column.field)) {
            spread.suspendEvent();
            try {
              const group = activeRowOutlineGroups.find(
                (candidate) => candidate.summaryRow === args.row,
              );
              const hierarchyCol = hierarchyColumnForRow(node);
              sheet.setValue(
                args.row,
                args.col,
                args.col === hierarchyCol
                  ? hierarchyCellText(
                      node,
                      group
                        ? sheet.rowOutlines.isCollapsed(group.detailStart)
                        : false,
                    )
                  : null,
              );
            } finally {
              spread.resumeEvent();
            }
            notify('层级字段用于展开和折叠，名称请从业务数据源维护');
            updateSelected(args.row, args.col);
            return;
          }
          let nextValue = args.newValue;
          if (
            column.field === 'adjustmentFactor' &&
            typeof nextValue === 'number'
          ) {
            const rounded = roundToTwoDecimals(nextValue);
            if (rounded !== nextValue) {
              spread.suspendEvent();
              try {
                sheet.setValue(args.row, args.col, rounded);
              } finally {
                spread.resumeEvent();
              }
              nextValue = rounded;
            }
          }
          updateBusinessNode(node, column.field, nextValue);
          const sourceNode =
            activeDataMode === 'stress'
              ? stressSourceById.get(node.id)
              : findBusinessNode(BUSINESS_DATA, node.id);
          if (sourceNode && sourceNode !== node)
            updateBusinessNode(sourceNode, column.field, nextValue);
          if (column.field === 'status' || column.field === 'verified') {
            spread.suspendEvent();
            try {
              sheet.setValue(args.row, STATUS_COLUMN, node.status);
              sheet.setValue(args.row, VERIFIED_COLUMN, node.verified);
            } finally {
              spread.resumeEvent();
            }
            styleStatusCells(args.row, 1);
          }
          const key = stableCellKey(node.id, column.field);
          const nextItem: HistoryItem = {
            id: crypto.randomUUID(),
            oldValue: args.oldValue,
            newValue: nextValue,
            source: args.isUndo ? '撤销 / 重做' : '单元格编辑',
            createdAt: Date.now(),
          };
          historyRef.current.set(
            key,
            [nextItem, ...(historyRef.current.get(key) ?? [])].slice(0, 30),
          );
          updateSelected(args.row, args.col);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.RangeGroupStateChanged,
        (_sender: unknown, args: RangeGroupStateChangedArgs) => {
          if (!groupChangeBatching) refreshAfterGroupChange(args.isRowGroup);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.TopRowChanged,
        (_sender: unknown, args: TopRowChangedArgs) => {
          if (activeDataMode === 'stress')
            scheduleStressViewportLoad(args.newTopRow);
        },
      );

      renderRows(activeRows, false);
      spread.focus();
    };

    void start().catch((error: unknown) => {
      if (cancelled) return;
      console.error('[SpreadJS] 初始化失败', error);
      workbook?.destroy();
      workbook = null;
      actionsRef.current = null;
      setReady(false);
      setInitializationError('表格初始化失败，请检查资源后重试');
      notify('表格初始化失败，请刷新后重试', 'error');
    });
    return () => {
      cancelled = true;
      window.clearTimeout(toastTimer);
      window.clearTimeout(stressLoadTimer);
      window.clearTimeout(stressViewportTimer);
      window.clearTimeout(validationFlashTimer);
      actionsRef.current = null;
      workbook?.destroy();
    };
  }, [initializationAttempt]);

  const openPanel = (nextPanel: Exclude<PanelName, null>) =>
    actionsRef.current?.openPanel(nextPanel);
  const tableBusy = !ready || dataMode === 'loading';
  const commentDirty = commentDraft.trim() !== persistedComment;
  const retryInitialization = () =>
    setInitializationAttempt((attempt) => attempt + 1);

  return {
    hostRef,
    actionsRef,
    ready,
    initializationError,
    retryInitialization,
    view,
    dataMode,
    panel,
    setPanel,
    selected,
    selectionStats,
    aggregateMode,
    setAggregateMode,
    customFormula,
    setCustomFormula,
    commentDraft,
    commentExists,
    commentDirty,
    setCommentDraft,
    selectedAttachments,
    selectedHistory,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResult,
    setSearchResult,
    columnMenuOpen,
    setColumnMenuOpen,
    columnVisibility,
    rowGroupsCollapsed,
    columnGroupsCollapsed,
    toast,
    datasetLabel,
    aggregateValue,
    openPanel,
    tableBusy,
  };
}
