'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CLIPBOARD_CALLBACKS,
  clipboardTextToMatrix,
  describeClipboardRange,
} from './clipboard';
import {
  describeBusinessCellDimension,
  isBusinessCellDimension,
  prepareBusinessCellLocationIndex,
  resolveBusinessCellDimension,
  toBusinessCellDimension,
  type BusinessCellDimension,
} from './business-cell-coordinate';
import {
  BUSINESS_DATA,
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  COLUMN_GROUPS,
  COLUMN_HEADER_CELLS,
  COLUMN_HEADER_ROW_COUNT,
  EMPTY_STATS,
  HIERARCHY_COLUMN_COUNT,
  INITIAL_PRODUCT_EXPANDED,
  INITIAL_DATASET_LABEL,
  ANNUAL_TOTAL_COLUMN,
  PRODUCT_ATTRIBUTE_COLUMN,
  PRODUCT_HIERARCHY_COLUMN,
  REGION_HIERARCHY_COLUMN,
  STRESS_FULL_PAGE_VISIBLE_ROWS,
  STRESS_PAGE_SIZE,
  STRESS_TEXT_SEARCH_COLUMNS,
  canDrillNode,
  columnName,
  createBusinessProjectionRows,
  createInitialRegionExpansion,
  createStressProjectionRows,
  getAllProductIdsForView,
  getAggregateValue,
  getBusinessProjectionSummary,
  getCellEditability,
  getProductGroupIdsForView,
  getProductAncestorIds,
  getRegionGroupIdsForProduct,
  getStressAllProductIds,
  getStressProductGroupIds,
  getStressProjectionSummary,
  getStressRecordsAsync,
  getStressRegionGroupIdsForProduct,
  isHierarchyField,
  numericDisplayForColumn,
  pathForView,
  releaseStressRecords,
  simulateStressBackendDelay,
  stableCellKey,
  stressCellSearchText,
  updateBusinessNode,
  viewForNode,
  viewRowCellValue,
  viewRowValues,
  type AggregateMode,
  type BusinessField,
  type CellAttachment,
  type ColumnFormat,
  type DataMode,
  type DrillView,
  type HistoryItem,
  type NumericDisplay,
  type OutlineDimension,
  type OutlineSnapshot,
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
type ClipboardPastedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IClipboardPastedEventArgs;
type RangeChangedArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IRangeChangedEventArgs;
type EditStartingArgs =
  import('@grapecity-software/spread-sheets').Spread.Sheets.IEditStartingEventArgs;

type ClipboardHistoryCell = {
  row: number;
  col: number;
  oldValue: unknown;
  oldFormula: string;
};

type TrackedHistoryCell = {
  nodeId: string;
  field: BusinessField;
  row: number;
  col: number;
};

type CellEditRequest = {
  row: number;
  col: number;
  oldValue: unknown;
  requestedValue: unknown;
  source: string;
};

type VisibleCellChange = {
  row: number;
  col: number;
  rowId: string;
  product: string;
  region: string;
  field: BusinessField;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  kind: '直接修改' | '投影同步';
};

export type BusinessCellChangePayload = {
  /** 后台 BUSINESS_DATA 中被修改的唯一记录。 */
  recordId: string;
  /** 被修改的叶子列 field。 */
  field: BusinessField;
  oldValue: unknown;
  newValue: unknown;
  /** 完整行维和列维，可原样回传给 locateBusinessCell。 */
  dimension: BusinessCellDimension;
};

function logRegularBackendData() {
  if (process.env.NODE_ENV === 'production') return;
  console.log(
    '[SpreadJS Demo][渲染完成] 后台列结构 BUSINESS_COLUMN_DATA：',
    BUSINESS_COLUMN_DATA,
  );
  console.log(
    '[SpreadJS Demo][渲染完成] 后台业务数据 BUSINESS_DATA：',
    BUSINESS_DATA,
  );
}

// Demo 默认把完整回调载荷打印到控制台；真实项目可通过
// useSpreadsheetController({ onBusinessCellChange }) 发送给后端。
function logCellChange(payload: BusinessCellChangePayload) {
  if (process.env.NODE_ENV === 'production') return;
  console.log(
    `[SpreadJS Demo][单元格修改]\n${JSON.stringify(payload, null, 2)}`,
  );
}

export type SpreadsheetControllerOptions = {
  onBusinessCellChange?: (payload: BusinessCellChangePayload) => void;
};

export type SpreadsheetActions = {
  undo: () => void;
  redo: () => void;
  copy: () => void;
  autoFit: () => void;
  search: (query: string, direction: 1 | -1) => void;
  cancelSearch: () => void;
  toggleColumn: (col: number, visible: boolean) => void;
  showAllColumns: () => void;
  setView: (view: DrillView) => void;
  drillSelected: () => void;
  up: () => void;
  toggleRowGroups: () => void;
  toggleColumnGroups: () => void;
  setOutlineDimension: (dimension: OutlineDimension, expanded: boolean) => void;
  resetOutline: () => void;
  loadDataMode: (mode: 'regular' | 'stress') => void;
  openPanel: (panel: Exclude<PanelName, null>) => void;
  saveComment: (content: string) => void;
  deleteComment: () => void;
  addAttachments: (files: File[]) => void;
  removeAttachment: (attachmentId: string) => void;
  locateBusinessCell: (dimension: BusinessCellDimension) => boolean;
};

export const ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx';
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_CELL = 10;
const ATTACHMENT_EXTENSION_PATTERN =
  /\.(?:gif|jpe?g|png|webp|pdf|docx?|xlsx?)$/i;
const ACCEPTED_ATTACHMENT_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

type RegularSearchMatch = {
  nodeId: string;
  productId: string;
  productParentId: string | null;
  productAncestorIds: readonly string[];
  regionRootId: string;
  regionDepth: 0 | 1;
  col: number;
};
// A solid-color rounded badge with a white paperclip glyph (and an optional
// count bubble) baked directly into the icon. A bare 13px outline icon on a
// near-white button background had almost no contrast and just looked like
// an empty little box, so the badge now carries its own color regardless of
// the surrounding cell/theme colors.
function attachmentIconDataUrl(count: number) {
  const badge =
    count > 1
      ? `<circle cx="18.5" cy="5.5" r="5.5" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>
         <text x="18.5" y="6.2" text-anchor="middle" dominant-baseline="middle" font-size="7.5" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${
           count > 9 ? '9+' : count
         }</text>`
      : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <rect x="1" y="1" width="22" height="22" rx="6" fill="#6548c8"/>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,3) scale(0.62)"/>
    ${badge}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isAcceptedAttachment(file: File) {
  return (
    ACCEPTED_ATTACHMENT_MIME_TYPES.has(file.type) ||
    ATTACHMENT_EXTENSION_PATTERN.test(file.name)
  );
}

export function useSpreadsheetController(
  options: SpreadsheetControllerOptions = {},
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<SpreadsheetActions | null>(null);
  const onBusinessCellChangeRef = useRef(options.onBusinessCellChange);
  onBusinessCellChangeRef.current = options.onBusinessCellChange;
  const regularSourceLoggedRef = useRef(false);
  const panelRef = useRef<PanelName>(null);
  const columnVisibilityRef = useRef(COLUMNS.map(() => true));
  const rowGroupsCollapsedRef = useRef(false);
  const columnGroupsCollapsedRef = useRef(false);
  const historyRef = useRef<Map<string, HistoryItem[]>>(new Map());
  const commentsRef = useRef<Map<string, string>>(new Map());
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
  const [searchResult, setSearchResult] =
    useState('输入关键词，按 Enter 开始搜索');
  const [searchBusy, setSearchBusy] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() =>
    COLUMNS.map(() => true),
  );
  const [rowGroupsCollapsed, setRowGroupsCollapsed] = useState(false);
  const [columnGroupsCollapsed, setColumnGroupsCollapsed] = useState(false);
  const [outlineSnapshot, setOutlineSnapshot] = useState<OutlineSnapshot>(() =>
    getBusinessProjectionSummary(
      [],
      new Set<string>(INITIAL_PRODUCT_EXPANDED),
      createInitialRegionExpansion(),
    ),
  );
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
      if (searchOpen) actionsRef.current?.cancelSearch();
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
      if (searchOpen) actionsRef.current?.cancelSearch();
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
    const productExpanded = new Set<string>(INITIAL_PRODUCT_EXPANDED);
    const regionExpandedByProduct = createInitialRegionExpansion();
    let activeView: DrillView = [];
    let activeRows = createBusinessProjectionRows(
      activeView,
      productExpanded,
      regionExpandedByProduct,
    );
    let stressSourceRows: ViewRow[] = [];
    let activeDataMode: 'regular' | 'stress' = 'regular';
    let activeSearch = {
      query: '',
      mode: 'regular' as 'regular' | 'stress',
      matchIndex: -1,
      row: -1,
      col: -1,
    };
    let regularSearchMatches: RegularSearchMatch[] = [];
    let stressSearchMatches: number[] = [];
    let activeSearchRun = 0;
    let toastTimer = 0;
    let stressLoadTimer = 0;
    let stressViewportTimer = 0;
    let pendingStressTopRow = 0;
    let groupChangeBatching = false;
    const loadedStressPages = new Set<number>();
    const loadedStressRows = new Set<number>();
    const pendingStressPages = new Set<number>();
    const pendingStressRows = new Set<number>();
    let stressSessionEpoch = 0;
    let validationFlashTimer = 0;
    let clipboardHistoryTimer = 0;
    let clipboardHistorySource: string | null = null;
    let clipboardHistorySnapshot: ClipboardHistoryCell[] | null = null;
    let commandHistorySource: '撤销' | '重做' | null = null;
    let commandHistoryDiffInProgress = false;
    const trackedHistoryCells = new Map<string, TrackedHistoryCell>();
    const cellFormulaState = new Map<string, string>();
    const renderedAttachmentCells = new Set<string>();
    let validationFlashCell: {
      row: number;
      col: number;
      backColor: string | null;
    } | null = null;

    const extensionStateFor = (productId: string) => {
      let state = regionExpandedByProduct.get(productId);
      if (!state) {
        state = new Set<string>();
        regionExpandedByProduct.set(productId, state);
      }
      return state;
    };

    const buildRegularRows = () =>
      createBusinessProjectionRows(
        activeView,
        productExpanded,
        regionExpandedByProduct,
      );

    const buildStressRows = () =>
      createStressProjectionRows(
        stressSourceRows,
        productExpanded,
        regionExpandedByProduct,
      );

    const currentProductGroupIds = () =>
      activeDataMode === 'stress'
        ? getStressProductGroupIds(stressSourceRows)
        : getProductGroupIdsForView(activeView);

    const currentProductIds = () =>
      activeDataMode === 'stress'
        ? getStressAllProductIds(stressSourceRows)
        : getAllProductIdsForView(activeView);

    const currentRegionGroupIds = (productId: string) =>
      activeDataMode === 'stress'
        ? getStressRegionGroupIdsForProduct(stressSourceRows, productId)
        : getRegionGroupIdsForProduct(productId);

    const buildFullyExpandedRegularRows = () => {
      const allProductGroups = new Set(getProductGroupIdsForView(activeView));
      const allRegionGroups = new Map<string, Set<string>>();
      getAllProductIdsForView(activeView).forEach((productId) => {
        allRegionGroups.set(
          productId,
          new Set(getRegionGroupIdsForProduct(productId)),
        );
      });
      return createBusinessProjectionRows(
        activeView,
        allProductGroups,
        allRegionGroups,
      );
    };

    const invalidateSearchSession = (message?: string) => {
      activeSearchRun += 1;
      setSearchBusy(false);
      activeSearch = {
        query: '',
        mode: activeDataMode,
        matchIndex: -1,
        row: -1,
        col: -1,
      };
      regularSearchMatches = [];
      stressSearchMatches = [];
      if (message) setSearchResult(message);
    };

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

      const licenseKey = process.env.UMI_APP_SPREADJS_LICENSE_KEY;
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
      sheet.name('费用预算表');
      sheet.frozenColumnCount(HIERARCHY_COLUMN_COUNT);
      sheet.options.protectionOptions = {
        allowSelectLockedCells: true,
        allowSelectUnlockedCells: true,
        allowResizeRows: true,
        allowResizeColumns: true,
        allowOutlineRows: true,
        allowOutlineColumns: true,
      };
      sheet.options.isProtected = true;
      sheet.options.rowHeaderAutoText = GC.Spread.Sheets.HeaderAutoText.numbers;
      sheet.options.gridline.color = '#e9edf3';
      sheet.options.gridline.showVerticalGridline = true;
      sheet.options.gridline.showHorizontalGridline = false;
      sheet.defaults.rowHeight = 24;
      spread.options.scrollByPixel = true;
      spread.options.scrollPixel = 22;

      // 编辑器完全由后台列配置生成，并在所有数据行复用。
      const columnCellTypes = COLUMNS.map((column) => {
        if (column.editor?.type === 'select') {
          const cellType = new GC.Spread.Sheets.CellTypes.ComboBox();
          cellType.items([...column.editor.options]);
          cellType.editable(false);
          return cellType;
        }
        if (column.editor?.type === 'checkbox')
          return new GC.Spread.Sheets.CellTypes.CheckBox();
        return undefined;
      });
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

      const historyValuesEqual = (left: unknown, right: unknown) => {
        if (Object.is(left, right)) return true;
        if (left instanceof Date && right instanceof Date)
          return left.getTime() === right.getTime();
        return false;
      };

      const appendCellHistory = (
        row: number,
        col: number,
        oldValue: unknown,
        newValue: unknown,
        source: string,
      ) => {
        if (historyValuesEqual(oldValue, newValue)) return false;
        const node = activeRows[row];
        const column = COLUMNS[col];
        if (!node || !column || isHierarchyField(column.field)) return false;
        const key = stableCellKey(node.id, column.field);
        trackedHistoryCells.set(key, {
          nodeId: node.id,
          field: column.field,
          row,
          col,
        });
        if (commandHistoryDiffInProgress) return false;
        const nextHistory = [
          {
            id: crypto.randomUUID(),
            oldValue,
            newValue,
            source,
            createdAt: Date.now(),
          },
          ...(historyRef.current.get(key) ?? []),
        ];
        historyRef.current.set(key, nextHistory);
        if (
          panelRef.current === 'history' &&
          sheet.getActiveRowIndex() === row &&
          sheet.getActiveColumnIndex() === col
        ) {
          setSelectedHistory([...nextHistory]);
        }
        return true;
      };

      const captureTrackedHistoryCells = () => {
        const snapshot: ClipboardHistoryCell[] = [];
        trackedHistoryCells.forEach((tracked, key) => {
          let row = tracked.row;
          if (activeRows[row]?.id !== tracked.nodeId)
            row = activeRows.findIndex((item) => item.id === tracked.nodeId);
          const col =
            COLUMNS[tracked.col]?.field === tracked.field
              ? tracked.col
              : COLUMNS.findIndex((column) => column.field === tracked.field);
          if (row < 0 || col < 0) return;
          trackedHistoryCells.set(key, { ...tracked, row, col });
          snapshot.push({
            row,
            col,
            oldValue: sheet.getValue(row, col),
            oldFormula: sheet.getFormula(row, col) ?? '',
          });
        });
        return snapshot;
      };

      const historySourceForChange = (args: CellChangedArgs) => {
        if (commandHistorySource) return commandHistorySource;
        if (args.isUndo) return '撤销';
        if (clipboardHistorySource) return clipboardHistorySource;
        if (args.propertyName === 'formula') return '公式编辑';
        if (args.newValue == null || args.newValue === '') return '清空单元格';
        return '单元格编辑';
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
            COLUMNS[col]?.editor?.type === 'date' ? [datePickerCellButton] : [],
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
        const buttons =
          column.editor?.type === 'date' &&
          getCellEditability(node, col).editable
            ? [datePickerCellButton]
            : [];
        if (count) {
          buttons.push({
            imageType: GC.Spread.Sheets.ButtonImageType.custom,
            imageSrc: attachmentIconDataUrl(count),
            imageSize: { width: 20, height: 20 },
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
            buttonBackColor: 'transparent',
            hoverBackColor: '#e6defd',
            width: 24,
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

      const applyCellEditability = (startRow: number, rowCount: number) => {
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        for (let row = startRow; row < endRow; row += 1) {
          for (let col = 0; col < COLUMNS.length; col += 1) {
            const editability = getCellEditability(activeRows[row], col);
            const cell = sheet.getCell(row, col);
            cell.locked(!editability.editable);
            if (
              isHierarchyField(COLUMNS[col].field) ||
              COLUMNS[col].field === 'functionalAttribute' ||
              COLUMNS[col].editor?.type === 'select' ||
              COLUMNS[col].editor?.type === 'checkbox'
            )
              continue;
            if (!editability.editable) {
              cell.backColor('#f5f6f8').foreColor('#667085');
            }
          }
        }
      };

      const commitBusinessCellValues = (requests: CellEditRequest[]) => {
        if (!requests.length) return 0;
        const beforeRows = activeRows;
        const accepted: Array<{
          request: CellEditRequest;
          projectionRowId: string;
          recordId: string;
          field: BusinessField;
          dimension: BusinessCellDimension;
        }> = [];
        const rejected: Array<{
          request: CellEditRequest;
          reason: string;
        }> = [];

        requests.forEach((request) => {
          const row = beforeRows[request.row];
          const column = COLUMNS[request.col];
          const editability = getCellEditability(row, request.col);
          if (
            !row ||
            !column ||
            isHierarchyField(column.field) ||
            !editability.editable ||
            !editability.sourceNode
          ) {
            rejected.push({ request, reason: editability.reason });
            return;
          }
          const dimension = toBusinessCellDimension(row, request.col);
          if (!dimension) {
            rejected.push({
              request,
              reason: '无法将当前投影转换为唯一业务维度',
            });
            return;
          }
          const nextValue = request.requestedValue;
          updateBusinessNode(editability.sourceNode, column.field, nextValue);
          accepted.push({
            request: { ...request, requestedValue: nextValue },
            projectionRowId: row.id,
            recordId: editability.sourceNode.id,
            field: column.field,
            dimension,
          });
        });

        if (rejected.length) {
          spread.suspendEvent();
          try {
            rejected.forEach(({ request }) => {
              const row = beforeRows[request.row];
              if (!row) return;
              sheet.setFormula(request.row, request.col, '');
              sheet.setValue(
                request.row,
                request.col,
                viewRowCellValue(row, request.col),
              );
            });
          } finally {
            spread.resumeEvent();
          }
          const first = rejected[0];
          notify(
            `无法编辑 ${columnName(first.request.col)}${
              first.request.row + 1
            }：${first.reason}`,
            'error',
          );
        }
        if (!accepted.length) return 0;

        const nextRows =
          activeDataMode === 'stress' ? buildStressRows() : buildRegularRows();
        const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
        const nextRowIndexById = new Map(
          nextRows.map((row, index) => [row.id, index]),
        );
        const directKeys = new Set(
          accepted.map(({ projectionRowId, field }) =>
            stableCellKey(projectionRowId, field),
          ),
        );
        const changes: VisibleCellChange[] = [];
        nextRows.forEach((nextRow, row) => {
          const beforeRow = beforeById.get(nextRow.id);
          if (!beforeRow) return;
          COLUMNS.forEach((column, col) => {
            if (isHierarchyField(column.field)) return;
            const oldValue = viewRowCellValue(beforeRow, col);
            const newValue = viewRowCellValue(nextRow, col);
            if (historyValuesEqual(oldValue, newValue)) return;
            const key = stableCellKey(nextRow.id, column.field);
            changes.push({
              row,
              col,
              rowId: nextRow.id,
              product: nextRow.productLabel,
              region: nextRow.regionLabel,
              field: column.field,
              fieldLabel: column.label,
              oldValue,
              newValue,
              kind: directKeys.has(key) ? '直接修改' : '投影同步',
            });
          });
        });

        const sameStructure =
          beforeRows.length === nextRows.length &&
          beforeRows.every((row, index) => row.id === nextRows[index]?.id);
        const preferredCell = currentCellIdentity();
        if (!sameStructure) {
          renderRows(nextRows, activeDataMode === 'stress', preferredCell);
        } else {
          activeRows = nextRows;
          const changedRows = new Set<number>();
          sheet.suspendPaint();
          sheet.suspendCalcService(false);
          sheet.suspendDirty();
          spread.suspendEvent();
          try {
            accepted.forEach(({ request, projectionRowId }) => {
              const row = nextRowIndexById.get(projectionRowId);
              if (row === undefined || sheet.getFormula(row, request.col))
                return;
              sheet.setValue(
                row,
                request.col,
                viewRowCellValue(nextRows[row], request.col),
              );
            });
            changes.forEach((change) => {
              const stressRowLoaded =
                activeDataMode !== 'stress' ||
                loadedStressPages.has(
                  Math.floor(change.row / STRESS_PAGE_SIZE),
                ) ||
                loadedStressRows.has(change.row);
              if (!stressRowLoaded) return;
              if (
                change.kind === '直接修改' &&
                sheet.getFormula(change.row, change.col)
              )
                return;
              sheet.setValue(change.row, change.col, change.newValue);
              changedRows.add(change.row);
            });
            changedRows.forEach((row) => {
              applyCellEditability(row, 1);
            });
          } finally {
            spread.resumeEvent();
            sheet.resumeDirty();
            sheet.resumeCalcService(false);
            sheet.resumePaint();
          }
          spread.repaint();
        }

        const operationSource = [
          ...new Set(accepted.map(({ request }) => request.source)),
        ].join(' / ');
        let historyCount = 0;
        changes.forEach((change) => {
          const historySource =
            change.kind === '直接修改'
              ? operationSource
              : `${operationSource} · ${change.kind}`;
          if (
            appendCellHistory(
              change.row,
              change.col,
              change.oldValue,
              change.newValue,
              historySource,
            )
          )
            historyCount += 1;
        });
        syncProjectionSnapshot();

        accepted.forEach(
          ({ request, projectionRowId, recordId, field, dimension }) => {
            const nextRowIndex = nextRowIndexById.get(projectionRowId);
            const nextValue =
              nextRowIndex === undefined
                ? request.requestedValue
                : viewRowCellValue(nextRows[nextRowIndex], request.col);
            const oldValue = viewRowCellValue(
              beforeById.get(projectionRowId) ?? beforeRows[request.row],
              request.col,
            );
            if (historyValuesEqual(oldValue, nextValue)) return;
            const payload: BusinessCellChangePayload = {
              recordId,
              field,
              oldValue,
              newValue: nextValue,
              dimension,
            };
            onBusinessCellChangeRef.current?.(payload);
            logCellChange(payload);
          },
        );
        return Math.max(historyCount, changes.length);
      };

      const commitBusinessCellValue = (
        row: number,
        col: number,
        oldValue: unknown,
        requestedValue: unknown,
        source: string,
      ) =>
        commitBusinessCellValues([
          { row, col, oldValue, requestedValue, source },
        ]) > 0;

      const captureClipboardHistory = (
        range: import('@grapecity-software/spread-sheets').Spread.Sheets.Range,
        sourceRowCount = 0,
        sourceColCount = 0,
      ) => {
        const startRow = Math.max(range.row, 0);
        const startCol = Math.max(range.col, 0);
        const requestedRowCount =
          range.row < 0
            ? sheet.getRowCount()
            : Math.max(range.rowCount, sourceRowCount);
        const requestedColCount =
          range.col < 0
            ? sheet.getColumnCount()
            : Math.max(range.colCount, sourceColCount);
        const endRow = Math.min(
          activeRows.length,
          startRow + Math.max(requestedRowCount, 0),
        );
        const endCol = Math.min(
          COLUMNS.length,
          startCol + Math.max(requestedColCount, 0),
        );
        const snapshot: ClipboardHistoryCell[] = [];
        for (let row = startRow; row < endRow; row += 1) {
          for (let col = startCol; col < endCol; col += 1) {
            snapshot.push({
              row,
              col,
              oldValue: sheet.getValue(row, col),
              oldFormula: sheet.getFormula(row, col) ?? '',
            });
          }
        }
        return snapshot;
      };

      const firstReadonlyCellInRange = (
        range: import('@grapecity-software/spread-sheets').Spread.Sheets.Range,
        requestedRowCount = range.rowCount,
        requestedColCount = range.colCount,
      ) => {
        const startRow = Math.max(range.row, 0);
        const startCol = Math.max(range.col, 0);
        const endRow = Math.min(
          activeRows.length,
          startRow + Math.max(requestedRowCount, 0),
        );
        const endCol = Math.min(
          COLUMNS.length,
          startCol + Math.max(requestedColCount, 0),
        );
        for (let row = startRow; row < endRow; row += 1) {
          for (let col = startCol; col < endCol; col += 1) {
            const editability = getCellEditability(activeRows[row], col);
            if (!editability.editable)
              return { row, col, reason: editability.reason };
          }
        }
        return null;
      };

      const rangeHistorySource = (args: RangeChangedArgs) => {
        if (args.isUndo) return '撤销';
        const action = GC.Spread.Sheets.RangeChangedAction;
        const sources: Partial<Record<number, string>> = {
          [action.clear]: '清空单元格',
          [action.dragDrop]: '拖放移动',
          [action.dragFill]: '拖拽填充',
          [action.paste]: '粘贴',
          [action.setArrayFormula]: '数组公式',
          [action.evaluateFormula]: '公式重算',
        };
        return sources[args.action] ?? null;
      };

      const syncGroupToolbarState = (isRowGroup: boolean) => {
        if (isRowGroup) {
          setRowGroupsCollapsed(rowGroupsCollapsedRef.current);
          return;
        }
        const collapsed = COLUMN_GROUPS.some(({ detailStart }) =>
          sheet.columnOutlines.isCollapsed(detailStart),
        );
        columnGroupsCollapsedRef.current = collapsed;
        setColumnGroupsCollapsed(collapsed);
      };

      const configureCellTypes = (startRow: number, rowCount: number) => {
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        for (let row = startRow; row < endRow; row += 1) {
          COLUMNS.forEach((column, col) => {
            const editable = getCellEditability(activeRows[row], col).editable;
            const cell = sheet.getCell(row, col);
            cell.cellType(editable ? columnCellTypes[col] : undefined);
            const dateEditable = editable && column.editor?.type === 'date';
            cell.cellButtons(dateEditable ? [datePickerCellButton] : []);
            cell.dropDowns(
              dateEditable
                ? [
                    {
                      type: GC.Spread.Sheets.DropDownType.dateTimePicker,
                      option: {
                        showTime: false,
                        calendarPage: GC.Spread.Sheets.CalendarPage.day,
                        startDay: GC.Spread.Sheets.CalendarStartDay.monday,
                      },
                    },
                  ]
                : [],
            );
          });
        }
        COLUMNS.forEach((column, col) => {
          if (column.format !== 'decimal') return;
          sheet.setDataValidator(
            startRow,
            col,
            rowCount,
            1,
            decimalValidator,
            GC.Spread.Sheets.SheetArea.viewport,
          );
        });
      };

      const styleDataRows = (
        startRow: number,
        rowCount: number,
        columnCount: number,
      ) => {
        const formatters: Record<ColumnFormat, string> = {
          currency: '¥#,##0',
          integer: '#,##0',
          percent: '0.0%',
          date: 'yyyy-mm-dd',
          decimal: '0.00',
        };
        COLUMNS.forEach((column, col) => {
          const formatter = column.format
            ? formatters[column.format]
            : undefined;
          if (formatter)
            sheet.getRange(startRow, col, rowCount, 1).formatter(formatter);
          if (column.dataType === 'boolean' || column.dataType === 'date')
            sheet
              .getRange(startRow, col, rowCount, 1)
              .hAlign(GC.Spread.Sheets.HorizontalAlign.center);
        });
        sheet
          .getRange(startRow, 0, rowCount, columnCount)
          .font('400 12px Arial, PingFang SC');
        sheet
          .getRange(startRow, PRODUCT_HIERARCHY_COLUMN, rowCount, 1)
          .backColor('#93c5f3')
          .foreColor('#172b3a');
        sheet
          .getRange(startRow, REGION_HIERARCHY_COLUMN, rowCount, 1)
          .backColor('#93c5f3')
          .foreColor('#172b3a');
        sheet
          .getRange(startRow, PRODUCT_ATTRIBUTE_COLUMN, rowCount, 1)
          .backColor('#93c5f3')
          .foreColor('#172b3a');
        sheet
          .getRange(startRow, ANNUAL_TOTAL_COLUMN, rowCount, 1)
          .backColor('#fff2cc')
          .foreColor('#2f2f2f');
        sheet
          .getRange(startRow, 0, rowCount, columnCount)
          .vAlign(GC.Spread.Sheets.VerticalAlign.center);
        const endRow = Math.min(activeRows.length, startRow + rowCount);
        for (let row = startRow; row < endRow; row += 1) {
          const node = activeRows[row];
          sheet
            .getCell(row, PRODUCT_HIERARCHY_COLUMN)
            .textIndent(node.productDepth);
          sheet
            .getCell(row, REGION_HIERARCHY_COLUMN)
            .textIndent(node.regionDepth);
          const isSummaryRow =
            node.sourceNodes.length !== 1 ||
            node.sourceNodes.some(
              (sourceNode) =>
                sourceNode.hierarchyRole !== 'subjectDetail' ||
                sourceNode.name.includes('合计'),
            );
          if (isSummaryRow) {
            sheet
              .getRange(row, 0, 1, columnCount)
              .font('600 12px Arial, PingFang SC');
            sheet
              .getRange(
                row,
                ANNUAL_TOTAL_COLUMN,
                1,
                columnCount - ANNUAL_TOTAL_COLUMN,
              )
              .backColor('#fff2cc');
          }
          if (
            activeDataMode === 'stress' &&
            node.productBlockStart &&
            node.productRowSpan > 1
          ) {
            // 常规组织块只有几行，居中阅读更自然；压力数据块较长，
            // 顶部对齐才能让组织与首个科目同时出现。
            sheet
              .getRange(row, PRODUCT_HIERARCHY_COLUMN, 1, 2)
              .vAlign(GC.Spread.Sheets.VerticalAlign.top);
          }
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
        applyCellEditability(startRow, rowCount);
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
        applyCellEditability(row, 1);
        loadedStressRows.add(row);
      };

      // 滚动到已加载数据边界时，先在这批行里打一个“正在加载…”占位提示，
      // 让用户能感知到这是一次异步的分批请求，而不是瞬间完成。
      const writeStressLoadingPlaceholder = (
        pageIndices: number[],
        rowIndices: number[],
      ) => {
        const rows = new Set<number>();
        pageIndices.forEach((page) => {
          const startRow = page * STRESS_PAGE_SIZE;
          const rowCount = Math.min(
            STRESS_PAGE_SIZE,
            activeRows.length - startRow,
          );
          for (let row = startRow; row < startRow + rowCount; row += 1)
            rows.add(row);
        });
        rowIndices.forEach((row) => rows.add(row));
        if (!rows.size) return;
        sheet.suspendPaint();
        spread.suspendEvent();
        try {
          rows.forEach((row) => {
            sheet.setValue(row, PRODUCT_HIERARCHY_COLUMN, '正在加载…');
          });
        } finally {
          spread.resumeEvent();
          sheet.resumePaint();
        }
        spread.repaint();
      };

      const loadStressData = (
        pageIndices: Iterable<number>,
        rowIndices: Iterable<number> = [],
      ) => {
        if (activeDataMode !== 'stress') return;
        const maxPage = Math.ceil(activeRows.length / STRESS_PAGE_SIZE) - 1;
        const unloadedPages = [...new Set(pageIndices)].filter(
          (page) =>
            page >= 0 &&
            page <= maxPage &&
            !loadedStressPages.has(page) &&
            !pendingStressPages.has(page),
        );
        const pagesBeingLoaded = new Set([
          ...unloadedPages,
          ...pendingStressPages,
        ]);
        const unloadedRows = [...new Set(rowIndices)].filter(
          (row) =>
            row >= 0 &&
            row < activeRows.length &&
            !pagesBeingLoaded.has(Math.floor(row / STRESS_PAGE_SIZE)) &&
            !loadedStressPages.has(Math.floor(row / STRESS_PAGE_SIZE)) &&
            !loadedStressRows.has(row) &&
            !pendingStressRows.has(row),
        );
        if (!unloadedPages.length && !unloadedRows.length) return;

        unloadedPages.forEach((page) => pendingStressPages.add(page));
        unloadedRows.forEach((row) => pendingStressRows.add(row));
        writeStressLoadingPlaceholder(unloadedPages, unloadedRows);

        // 模拟一次真实的分批后端请求：数据早已在内存中就绪，
        // 但要等这段延迟结束才把结果写进表格，制造滚动到底部
        // 触发下一批加载的真实观感。
        const epoch = stressSessionEpoch;
        void simulateStressBackendDelay().then(() => {
          unloadedPages.forEach((page) => pendingStressPages.delete(page));
          unloadedRows.forEach((row) => pendingStressRows.delete(row));
          if (
            cancelled ||
            activeDataMode !== 'stress' ||
            epoch !== stressSessionEpoch
          )
            return;
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
        });
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
          const page = Math.floor(row / STRESS_PAGE_SIZE);
          const rows = visibleRowsByPage.get(page) ?? [];
          rows.push(row);
          visibleRowsByPage.set(page, rows);
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

        // Prefetch the next physical page for continuous scrolling. The visible
        // projection has no hidden Outline ranges, so page adjacency is stable.
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
        spread.invalidateLayout();
        normalizeActiveSelection();
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

      const renderRows = (
        rows: ViewRow[],
        stress: boolean,
        preferredCell?: { nodeId: string; productId: string; col: number },
      ) => {
        activeRows = rows;
        activeDataMode = stress ? 'stress' : 'regular';
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
          sheet
            .getSpans(undefined, GC.Spread.Sheets.SheetArea.viewport)
            .forEach((span) =>
              sheet.removeSpan(
                span.row,
                span.col,
                GC.Spread.Sheets.SheetArea.viewport,
              ),
            );
          loadedStressPages.clear();
          loadedStressRows.clear();
          pendingStressPages.clear();
          pendingStressRows.clear();
          stressSessionEpoch += 1;
          if (!stress) {
            sheet.setArray(
              0,
              0,
              rows.map((row) => viewRowValues(row, colCount)),
            );
          }
          rows.forEach((row, rowIndex) => {
            if (!row.productBlockStart || row.productRowSpan <= 1) return;
            sheet.addSpan(
              rowIndex,
              PRODUCT_HIERARCHY_COLUMN,
              row.productRowSpan,
              1,
            );
          });

          const headerArea = GC.Spread.Sheets.SheetArea.colHeader;
          sheet.getSpans(undefined, headerArea).forEach((span) => {
            sheet.removeSpan(span.row, span.col, headerArea);
          });
          sheet.setRowCount(COLUMN_HEADER_ROW_COUNT, headerArea);
          for (let row = 0; row < COLUMN_HEADER_ROW_COUNT; row += 1) {
            for (let col = 0; col < colCount; col += 1)
              sheet.setValue(row, col, null, headerArea);
          }
          COLUMN_HEADER_CELLS.forEach(
            ({ row, startCol, rowCount, colCount, label }) => {
              sheet.setValue(row, startCol, label, headerArea);
              if (rowCount > 1 || colCount > 1)
                sheet.addSpan(row, startCol, rowCount, colCount, headerArea);
            },
          );
          COLUMNS.forEach((column, col) =>
            sheet.setColumnWidth(col, column.width),
          );

          if (!stress) styleDataRows(0, rowCount, colCount);
          sheet
            .getRange(0, 0, COLUMN_HEADER_ROW_COUNT, colCount, headerArea)
            .backColor('#93c5f3')
            .foreColor('#172b3a')
            .hAlign(GC.Spread.Sheets.HorizontalAlign.center)
            .vAlign(GC.Spread.Sheets.VerticalAlign.center)
            .font('600 12px Arial, PingFang SC');
          if (COLUMN_HEADER_ROW_COUNT > 2)
            sheet
              .getRange(1, 0, COLUMN_HEADER_ROW_COUNT - 2, colCount, headerArea)
              .backColor('#f7f5ff')
              .foreColor('#67569e')
              .font('650 12px Arial, PingFang SC');
          sheet
            .getRange(0, 0, 1, colCount, headerArea)
            .backColor('#93c5f3')
            .foreColor('#172b3a')
            .font('700 12px Arial, PingFang SC');
          sheet
            .getRange(
              COLUMN_HEADER_ROW_COUNT - 1,
              PRODUCT_HIERARCHY_COLUMN,
              1,
              1,
              headerArea,
            )
            .backColor('#93c5f3')
            .foreColor('#172b3a');
          sheet
            .getRange(
              COLUMN_HEADER_ROW_COUNT - 1,
              PRODUCT_ATTRIBUTE_COLUMN,
              1,
              1,
              headerArea,
            )
            .backColor('#93c5f3')
            .foreColor('#172b3a');
          sheet
            .getRange(
              COLUMN_HEADER_ROW_COUNT - 1,
              REGION_HIERARCHY_COLUMN,
              1,
              1,
              headerArea,
            )
            .backColor('#93c5f3')
            .foreColor('#172b3a');
          for (let row = 0; row < COLUMN_HEADER_ROW_COUNT; row += 1)
            sheet.setRowHeight(
              row,
              row === COLUMN_HEADER_ROW_COUNT - 1 ? 34 : 27,
              headerArea,
            );
          if (!stress) configureCellTypes(0, rowCount);

          // 常规与大数据模式都由组织列、科目列分别维护独立状态并
          // 重建可见投影。大数据模式只在单元格写入阶段按视口分页，
          // 不再使用会把两列可见性绑在一起的整行 Outline。
          sheet.showRowOutline(false);
          // Keep each summary column visible and collapse only its detail columns.
          sheet.columnOutlines.direction(
            GC.Spread.Sheets.Outlines.OutlineDirection.backward,
          );
          COLUMN_GROUPS.forEach(({ detailStart, detailCount }) => {
            sheet.columnOutlines.group(detailStart, detailCount);
          });
          if (columnGroupsCollapsedRef.current) {
            for (
              let level = sheet.columnOutlines.getMaxLevel();
              level >= 0;
              level -= 1
            ) {
              sheet.columnOutlines.expand(level, false);
            }
          }
          sheet.showColumnOutline(true);
          if (!stress) {
            applyStableComments();
            applyStableAttachmentIndicators();
            applyCellEditability(0, rowCount);
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
        let nextRow = preferredCell
          ? rows.findIndex((row) => row.id === preferredCell.nodeId)
          : 0;
        if (nextRow < 0 && preferredCell)
          nextRow = rows.findIndex(
            (row) => row.productId === preferredCell.productId,
          );
        if (nextRow < 0) nextRow = 0;
        const nextCol = Math.min(
          Math.max(preferredCell?.col ?? 0, 0),
          colCount - 1,
        );
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
        setDatasetLabel(
          stress
            ? `${stressSourceRows.length.toLocaleString(
                'zh-CN',
              )} 条底层记录（当前显示 ${rowCount.toLocaleString(
                'zh-CN',
              )} 行） × ${colCount} 列`
            : `${rowCount.toLocaleString('zh-CN')} 行 × ${colCount} 列`,
        );
        if (stress) {
          scheduleStressViewportLoad(nextRow);
        }
        setReady(true);
        if (!stress && !regularSourceLoggedRef.current) {
          regularSourceLoggedRef.current = true;
          logRegularBackendData();
        }
      };

      const currentCellIdentity = () => {
        const row = activeRows[sheet.getActiveRowIndex()];
        if (!row) return undefined;
        return {
          nodeId: row.id,
          productId: row.productId,
          col: sheet.getActiveColumnIndex(),
        };
      };

      const syncProjectionSnapshot = () => {
        const snapshot =
          activeDataMode === 'stress'
            ? getStressProjectionSummary(
                stressSourceRows,
                productExpanded,
                regionExpandedByProduct,
              )
            : getBusinessProjectionSummary(
                activeView,
                productExpanded,
                regionExpandedByProduct,
              );
        setOutlineSnapshot(snapshot);
        const collapsed =
          snapshot.productExpanded === 0 && snapshot.regionExpanded === 0;
        rowGroupsCollapsedRef.current = collapsed;
        setRowGroupsCollapsed(collapsed);
      };

      const renderProjectionRows = () => {
        const preferredCell = currentCellIdentity();
        const stress = activeDataMode === 'stress';
        renderRows(
          stress ? buildStressRows() : buildRegularRows(),
          stress,
          preferredCell,
        );
        syncProjectionSnapshot();
      };

      const setOutlineDimension = (
        dimension: OutlineDimension,
        expanded: boolean,
      ) => {
        if (dimension === 'product') {
          currentProductGroupIds().forEach((productId) => {
            if (expanded) productExpanded.add(productId);
            else productExpanded.delete(productId);
          });
        } else if (expanded) {
          currentProductIds().forEach((productId) => {
            const state = extensionStateFor(productId);
            currentRegionGroupIds(productId).forEach((regionId) =>
              state.add(regionId),
            );
          });
        } else {
          regionExpandedByProduct.clear();
        }
        renderProjectionRows();
        notify(
          `${dimension === 'product' ? '组织树' : '科目树'}已全部${
            expanded ? '展开' : '收起'
          }`,
        );
      };

      const resetOutline = () => {
        if (activeDataMode === 'stress') {
          currentProductGroupIds().forEach((id) => productExpanded.delete(id));
          currentProductIds().forEach((id) =>
            regionExpandedByProduct.delete(id),
          );
          renderProjectionRows();
          notify('已恢复大数据默认折叠状态');
          return;
        }
        productExpanded.clear();
        INITIAL_PRODUCT_EXPANDED.forEach((id) => productExpanded.add(id));
        regionExpandedByProduct.clear();
        createInitialRegionExpansion(activeView).forEach((state, productId) =>
          regionExpandedByProduct.set(productId, state),
        );
        renderProjectionRows();
        notify('已恢复费用预算表默认展开状态');
      };

      const openPanelForSelection = (nextPanel: Exclude<PanelName, null>) => {
        activeSearchRun += 1;
        setSearchBusy(false);
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
        if (activeDataMode === 'stress') {
          notify('10 万行模式使用表内分组展开，不提供下钻页面');
          return;
        }
        const previousView = activeView;
        activeView = nextView;
        const nextRows = buildRegularRows();
        if (nextView.length && !nextRows.length) {
          activeView = previousView;
          notify('当前层级没有可显示的下级数据', 'error');
          return;
        }
        setView([...nextView]);
        setPanel(null);
        invalidateSearchSession(
          activeSearch.query ? '业务层级已变化，按 Enter 重新搜索' : undefined,
        );
        renderRows(nextRows, false);
        syncProjectionSnapshot();
        const currentName = pathForView(nextView).at(-1);
        notify(
          nextView.length === 0
            ? '已返回全部业务'
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

      const toggleHierarchyRow = (row: number, col: number) => {
        const node = activeRows[row];
        if (!node) return;
        if (
          col === PRODUCT_HIERARCHY_COLUMN &&
          node.productBlockStart &&
          node.productIsGroup
        ) {
          const expanded = !productExpanded.has(node.productId);
          if (expanded) productExpanded.add(node.productId);
          else productExpanded.delete(node.productId);
          renderProjectionRows();
          notify(`已${expanded ? '展开' : '收起'}组织 ${node.productLabel}`);
          return;
        }
        if (col === REGION_HIERARCHY_COLUMN && node.regionIsGroup) {
          const state = extensionStateFor(node.productId);
          const expanded = !state.has(node.regionId);
          if (expanded) state.add(node.regionId);
          else state.delete(node.regionId);
          renderProjectionRows();
          notify(
            `已${expanded ? '展开' : '收起'}${node.productLabel}的${
              node.regionLabel
            }科目`,
          );
        }
      };

      const collectRegularSearchMatches = (query: string) => {
        const normalizedQuery = query.toLocaleLowerCase('zh-CN');
        const matches: RegularSearchMatch[] = [];
        buildFullyExpandedRegularRows().forEach((row) => {
          COLUMNS.forEach((_, col) => {
            const text = stressCellSearchText(row, col, true).toLocaleLowerCase(
              'zh-CN',
            );
            if (!text.includes(normalizedQuery)) return;
            matches.push({
              nodeId: row.id,
              productId: row.productId,
              productParentId: row.productParentId,
              productAncestorIds: row.productAncestorIds,
              regionRootId: row.regionRootId,
              regionDepth: row.regionDepth,
              col,
            });
          });
        });
        return matches;
      };

      const collectStressSearchMatches = async (
        query: string,
        searchRun: number,
      ) => {
        const columnCount = COLUMNS.length;
        const totalCells = stressSourceRows.length * columnCount;
        if (!totalCells) return [];
        const normalizedQuery = query.toLocaleLowerCase('zh-CN');
        const textOnlyQuery = /[A-Za-z\u3400-\u9fff]/u.test(query);
        const searchableColumns = textOnlyQuery
          ? [...STRESS_TEXT_SEARCH_COLUMNS]
          : COLUMNS.map((_, col) => col);
        const matches: number[] = [];
        for (let row = 0; row < stressSourceRows.length; row += 1) {
          if (row > 0 && row % 5_000 === 0) {
            setSearchResult(
              `正在搜索全部 10 万行… ${Math.round(
                (row / stressSourceRows.length) * 100,
              )}%`,
            );
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            if (cancelled || searchRun !== activeSearchRun) return null;
          }
          for (const col of searchableColumns) {
            const text = stressCellSearchText(
              stressSourceRows[row],
              col,
              true,
            ).toLocaleLowerCase('zh-CN');
            if (text.includes(normalizedQuery))
              matches.push(row * columnCount + col);
          }
        }
        return matches;
      };

      const revealSearchMatch = (row: number, col: number) => {
        let expandedHierarchy = false;
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
        return expandedHierarchy;
      };

      const revealStressSearchMatch = (sourceRow: number, col: number) => {
        const source = stressSourceRows[sourceRow];
        if (!source) return null;
        let expandedHierarchy = false;
        if (
          source.productParentId &&
          !productExpanded.has(source.productParentId)
        ) {
          productExpanded.add(source.productParentId);
          expandedHierarchy = true;
        }
        if (!source.productIsGroup && source.regionDepth > 0) {
          const state = extensionStateFor(source.productId);
          if (!state.has(source.regionRootId)) {
            state.add(source.regionRootId);
            expandedHierarchy = true;
          }
        }
        if (expandedHierarchy) renderProjectionRows();

        const projectedId = source.productIsGroup
          ? null
          : source.regionDepth > 0
          ? `${source.productId}::${source.regionRootId}::${source.id}`
          : `${source.productId}::${source.regionRootId}`;
        let row = projectedId
          ? activeRows.findIndex((item) => item.id === projectedId)
          : -1;
        if (row < 0)
          row = activeRows.findIndex(
            (item) => item.productId === source.productId,
          );
        if (row < 0) return null;
        ensureStressRowLoaded(row);
        const columnExpanded = revealSearchMatch(row, col);
        return {
          row,
          expandedHierarchy: expandedHierarchy || columnExpanded,
        };
      };

      const revealRegularSearchMatch = (match: RegularSearchMatch) => {
        let expandedHierarchy = false;
        match.productAncestorIds.forEach((ancestorId) => {
          if (productExpanded.has(ancestorId)) return;
          productExpanded.add(ancestorId);
          expandedHierarchy = true;
        });
        if (match.regionDepth > 0) {
          const state = extensionStateFor(match.productId);
          if (!state.has(match.regionRootId)) {
            state.add(match.regionRootId);
            expandedHierarchy = true;
          }
        }
        if (expandedHierarchy) {
          renderRows(buildRegularRows(), false, {
            nodeId: match.nodeId,
            productId: match.productId,
            col: match.col,
          });
          syncProjectionSnapshot();
        }
        const row = activeRows.findIndex((item) => item.id === match.nodeId);
        if (row < 0) return null;
        revealSearchMatch(row, match.col);
        return { row, expandedHierarchy };
      };

      /**
       * 使用后端回传的行维和列维定位单元格。定位前只展开目标所需的
       * 组织和科目祖先；常规模式若处于下钻页，会回到全量投影重试。
       */
      const locateBusinessCell = (dimension: BusinessCellDimension) => {
        if (!isBusinessCellDimension(dimension)) {
          notify('后端返回的行维或列维不完整', 'error');
          return false;
        }

        if (activeDataMode === 'stress') {
          const source = resolveBusinessCellDimension(
            stressSourceRows,
            dimension,
          );
          if (!source) {
            notify('当前 10 万行数据中未找到该业务单元格', 'error');
            return false;
          }
          const located = revealStressSearchMatch(source.row, source.col);
          if (!located) {
            notify('业务维度存在，但无法投影到当前表格', 'error');
            return false;
          }
          notify(
            `已定位 ${describeBusinessCellDimension(dimension)} · ${columnName(
              source.col,
            )}${located.row + 1}`,
          );
          return true;
        }

        let viewReset = false;
        let target = resolveBusinessCellDimension(
          buildFullyExpandedRegularRows(),
          dimension,
        );
        if (!target && activeView.length) {
          activeView = [];
          setView([]);
          viewReset = true;
          target = resolveBusinessCellDimension(
            buildFullyExpandedRegularRows(),
            dimension,
          );
        }
        if (!target) {
          notify('当前常规数据中未找到该业务单元格', 'error');
          return false;
        }

        let hierarchyExpanded = viewReset;
        getProductAncestorIds(target.productId).forEach((ancestorId) => {
          if (productExpanded.has(ancestorId)) return;
          productExpanded.add(ancestorId);
          hierarchyExpanded = true;
        });
        if (target.subjectDepth > 0) {
          const state = extensionStateFor(target.productId);
          if (!state.has(target.subjectRootId)) {
            state.add(target.subjectRootId);
            hierarchyExpanded = true;
          }
        }
        if (hierarchyExpanded) {
          renderRows(buildRegularRows(), false, {
            nodeId: target.projectionRowId,
            productId: target.productId,
            col: target.col,
          });
          syncProjectionSnapshot();
        }

        const visible = resolveBusinessCellDimension(activeRows, dimension);
        if (!visible) {
          notify('业务维度存在，但目标行未能正确展开', 'error');
          return false;
        }
        revealSearchMatch(visible.row, visible.col);
        notify(
          `已定位 ${describeBusinessCellDimension(dimension)} · ${columnName(
            visible.col,
          )}${visible.row + 1}`,
        );
        return true;
      };

      const searchStatus = (
        total: number,
        index: number,
        row: number,
        col: number,
        expandedHierarchy = false,
      ) =>
        `共 ${total.toLocaleString('zh-CN')} 个匹配 · ${(
          index + 1
        ).toLocaleString('zh-CN')}/${total.toLocaleString(
          'zh-CN',
        )} · ${columnName(col)}${row + 1}${
          expandedHierarchy ? ' · 已自动展开层级' : ''
        }`;

      const search = async (query: string, direction: 1 | -1) => {
        const trimmed = query.trim();
        if (!trimmed) {
          setSearchResult('请输入搜索关键词');
          return;
        }
        const colCount = sheet.getColumnCount();
        const queryChanged =
          activeSearch.query !== trimmed ||
          activeSearch.mode !== activeDataMode;
        if (activeDataMode === 'stress') {
          if (queryChanged) {
            const searchRun = ++activeSearchRun;
            setSearchBusy(true);
            setSearchResult('正在搜索全部 10 万行… 0%');
            const matches = await collectStressSearchMatches(
              trimmed,
              searchRun,
            );
            if (searchRun === activeSearchRun) setSearchBusy(false);
            if (cancelled || searchRun !== activeSearchRun || !matches) return;
            stressSearchMatches = matches;
            regularSearchMatches = [];
            activeSearch = {
              query: trimmed,
              mode: 'stress',
              matchIndex: -1,
              row: -1,
              col: -1,
            };
          }
          if (!stressSearchMatches.length) {
            setSearchResult('共 0 个匹配');
            notify(`所有 10 万行、${colCount} 列中均未找到匹配项`);
            return;
          }
          const matchIndex =
            activeSearch.matchIndex < 0
              ? direction === 1
                ? 0
                : stressSearchMatches.length - 1
              : (activeSearch.matchIndex +
                  direction +
                  stressSearchMatches.length) %
                stressSearchMatches.length;
          const cellIndex = stressSearchMatches[matchIndex];
          const row = Math.floor(cellIndex / colCount);
          const col = cellIndex % colCount;
          activeSearch = {
            query: trimmed,
            mode: 'stress',
            matchIndex,
            row,
            col,
          };
          const revealed = revealStressSearchMatch(row, col);
          if (!revealed) {
            invalidateSearchSession('数据结构已变化，请重新搜索');
            notify('无法定位该结果，请重新搜索', 'error');
            return;
          }
          activeSearch.row = revealed.row;
          setSearchResult(
            searchStatus(
              stressSearchMatches.length,
              matchIndex,
              revealed.row,
              col,
              revealed.expandedHierarchy,
            ),
          );
          return;
        }
        if (queryChanged) {
          regularSearchMatches = collectRegularSearchMatches(trimmed);
          stressSearchMatches = [];
          activeSearch = {
            query: trimmed,
            mode: 'regular',
            matchIndex: -1,
            row: -1,
            col: -1,
          };
        }
        if (!regularSearchMatches.length) {
          setSearchResult('共 0 个匹配');
          notify('当前业务层级（含已折叠内容）中未找到匹配项');
          return;
        }
        const matchIndex =
          activeSearch.matchIndex < 0
            ? direction === 1
              ? 0
              : regularSearchMatches.length - 1
            : (activeSearch.matchIndex +
                direction +
                regularSearchMatches.length) %
              regularSearchMatches.length;
        const match = regularSearchMatches[matchIndex];
        const revealed = revealRegularSearchMatch(match);
        if (!revealed) {
          invalidateSearchSession('数据结构已变化，请重新搜索');
          notify('无法定位该结果，请重新搜索', 'error');
          return;
        }
        activeSearch = {
          query: trimmed,
          mode: 'regular',
          matchIndex,
          row: revealed.row,
          col: match.col,
        };
        setSearchResult(
          searchStatus(
            regularSearchMatches.length,
            matchIndex,
            revealed.row,
            match.col,
            revealed.expandedHierarchy,
          ),
        );
      };

      const runHistoryCommand = <T>(
        source: '撤销' | '重做',
        command: () => T,
      ) => {
        const before = captureTrackedHistoryCells();
        const previousSource = commandHistorySource;
        commandHistorySource = source;
        commandHistoryDiffInProgress = true;
        let result: T;
        try {
          result = command();
        } finally {
          commandHistoryDiffInProgress = false;
          commandHistorySource = previousSource;
        }
        let changedCount = 0;
        const pendingEdits: CellEditRequest[] = [];
        before.forEach(({ row, col, oldValue, oldFormula }) => {
          const newValue = sheet.getValue(row, col);
          const newFormula = sheet.getFormula(row, col) ?? '';
          if (oldFormula !== newFormula) {
            if (
              appendCellHistory(
                row,
                col,
                oldFormula,
                newFormula,
                `${source} · 公式`,
              )
            )
              changedCount += 1;
            const node = activeRows[row];
            const column = COLUMNS[col];
            if (node && column) {
              const key = stableCellKey(node.id, column.field);
              if (newFormula) cellFormulaState.set(key, newFormula);
              else cellFormulaState.delete(key);
            }
          }
          if (!historyValuesEqual(oldValue, newValue))
            pendingEdits.push({
              row,
              col,
              oldValue,
              requestedValue: newValue,
              source,
            });
        });
        changedCount += commitBusinessCellValues(pendingEdits);
        if (changedCount) {
          invalidateSearchSession(
            activeSearch.query
              ? '数据已更新，按 Enter 刷新搜索结果'
              : undefined,
          );
          const activeRow = sheet.getActiveRowIndex();
          const activeCol = sheet.getActiveColumnIndex();
          updateSelected(activeRow, activeCol);
          const range = sheet.getSelections().at(-1);
          if (range) calculateSelection(sheet, range);
        }
        return result;
      };

      const performUndo = () => {
        if (!spread.undoManager().canUndo()) {
          notify('暂无可撤销的单元格操作');
          return false;
        }
        const succeeded = runHistoryCommand('撤销', () =>
          spread.undoManager().undo(),
        );
        notify(
          succeeded ? '已撤销上一次单元格操作' : '撤销失败',
          succeeded ? 'success' : 'error',
        );
        return succeeded;
      };

      const performRedo = () => {
        if (!spread.undoManager().canRedo()) {
          notify('暂无可重做的单元格操作');
          return false;
        }
        const succeeded = runHistoryCommand('重做', () =>
          spread.undoManager().redo(),
        );
        notify(
          succeeded ? '已重做上一次单元格操作' : '重做失败',
          succeeded ? 'success' : 'error',
        );
        return succeeded;
      };

      const commandManager = spread.commandManager();
      commandManager.register('historyUndo', {
        canUndo: false,
        execute: performUndo,
      });
      commandManager.register('historyRedo', {
        canUndo: false,
        execute: performRedo,
      });
      const commandKey = GC.Spread.Commands.Key;
      commandManager.setShortcutKey(
        'historyUndo',
        commandKey.z,
        true,
        false,
        false,
        false,
      );
      commandManager.setShortcutKey(
        'historyUndo',
        commandKey.z,
        false,
        false,
        false,
        true,
      );
      commandManager.setShortcutKey(
        'historyRedo',
        commandKey.y,
        true,
        false,
        false,
        false,
      );
      commandManager.setShortcutKey(
        'historyRedo',
        commandKey.z,
        true,
        true,
        false,
        false,
      );
      commandManager.setShortcutKey(
        'historyRedo',
        commandKey.z,
        false,
        true,
        false,
        true,
      );

      actionsRef.current = {
        undo: performUndo,
        redo: performRedo,
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
        cancelSearch: () => {
          activeSearchRun += 1;
          setSearchBusy(false);
        },
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
          currentProductGroupIds().forEach((productId) => {
            if (collapse) productExpanded.delete(productId);
            else productExpanded.add(productId);
          });
          if (collapse) regionExpandedByProduct.clear();
          else {
            currentProductIds().forEach((productId) => {
              const state = extensionStateFor(productId);
              currentRegionGroupIds(productId).forEach((regionId) =>
                state.add(regionId),
              );
            });
          }
          renderProjectionRows();
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
        setOutlineDimension,
        resetOutline,
        locateBusinessCell,
        loadDataMode: (mode) => {
          invalidateSearchSession('输入关键词，按 Enter 开始搜索');
          setSearchQuery('');
          window.clearTimeout(stressLoadTimer);
          stressLoadTimer = 0;
          if (mode === 'regular') {
            setDataMode('regular');
            activeView = [];
            activeDataMode = 'regular';
            setView([]);
            renderProjectionRows();
            stressSourceRows = [];
            releaseStressRecords();
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
                activeView = [];
                stressSourceRows = rows;
                prepareBusinessCellLocationIndex(rows);
                getStressProductGroupIds(rows).forEach((id) =>
                  productExpanded.delete(id),
                );
                getStressAllProductIds(rows).forEach((id) =>
                  regionExpandedByProduct.delete(id),
                );
                activeDataMode = 'stress';
                setView([]);
                renderRows(buildStressRows(), true);
                syncProjectionSnapshot();
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
          const signatures = new Set(
            current.map(
              (attachment) =>
                `${attachment.name}:${attachment.size}:${attachment.lastModified}`,
            ),
          );
          let rejected = 0;
          files.forEach((file) => {
            const signature = `${file.name}:${file.size}:${file.lastModified}`;
            const duplicate = signatures.has(signature);
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
            signatures.add(signature);
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
      // Grey out "下钻到下一层" when the right-clicked row has no lower
      // level to drill into, so choosing it can never surface an error
      // toast — mirrors the disabled state already used by the toolbar
      // "下钻所选行" button.
      spread.contextMenu.onOpenMenu = (
        _menuData: unknown,
        itemsDataForShown: {
          name?: string;
          disable?: boolean;
          title?: string;
        }[],
      ) => {
        const drillItem = itemsDataForShown.find(
          (item) => item.name === 'business-drill',
        );
        if (drillItem) {
          const node = activeRows[sheet.getActiveRowIndex()];
          const drillable = activeDataMode === 'regular' && canDrillNode(node);
          drillItem.disable = !drillable;
          drillItem.title = drillable ? undefined : '当前行没有下级数据';
        }
        return false;
      };

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
        GC.Spread.Sheets.Events.EditStarting,
        (_sender: unknown, args: EditStartingArgs) => {
          const editability = getCellEditability(
            activeRows[args.row],
            args.col,
          );
          if (editability.editable) return;
          args.cancel = true;
          notify(
            `无法编辑 ${columnName(args.col)}${args.row + 1}：${
              editability.reason
            }`,
            'error',
          );
          if (process.env.NODE_ENV !== 'production') {
            console.info('[SpreadJS Demo][编辑已阻止]', {
              cell: `${columnName(args.col)}${args.row + 1}`,
              rowId: activeRows[args.row]?.id,
              field: COLUMNS[args.col]?.field,
              reason: editability.reason,
            });
          }
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.CellClick,
        (_sender: unknown, args: CellClickArgs) => {
          if (args.sheetArea !== GC.Spread.Sheets.SheetArea.viewport) return;
          const node = activeRows[args.row];
          if (
            node &&
            (args.col === PRODUCT_HIERARCHY_COLUMN ||
              args.col === REGION_HIERARCHY_COLUMN)
          ) {
            toggleHierarchyRow(args.row, args.col);
            return;
          }
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
          window.clearTimeout(clipboardHistoryTimer);
          const text = args.pasteData.text ?? '';
          const matrix = clipboardTextToMatrix(text);
          const pasteRowCount = Math.max(
            args.fromRange?.rowCount ?? 0,
            matrix.length,
            args.cellRange.rowCount,
          );
          const pasteColCount = Math.max(
            args.fromRange?.colCount ?? 0,
            ...matrix.map((row) => row.length),
            args.cellRange.colCount,
          );
          const readonlyTarget = firstReadonlyCellInRange(
            args.cellRange,
            pasteRowCount,
            pasteColCount,
          );
          if (readonlyTarget) {
            args.cancel = true;
            clipboardHistorySource = null;
            clipboardHistorySnapshot = null;
            notify(
              `无法粘贴到 ${columnName(readonlyTarget.col)}${
                readonlyTarget.row + 1
              }：${readonlyTarget.reason}`,
              'error',
            );
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[SpreadJS Demo][粘贴已阻止]', {
                cell: `${columnName(readonlyTarget.col)}${
                  readonlyTarget.row + 1
                }`,
                reason: readonlyTarget.reason,
                pasteRowCount,
                pasteColCount,
              });
            }
            return;
          }
          clipboardHistorySnapshot = captureClipboardHistory(
            args.cellRange,
            pasteRowCount,
            pasteColCount,
          );
          clipboardHistorySource = args.isCutting
            ? '剪切粘贴'
            : args.fromSheet || args.fromRange
            ? '复制粘贴'
            : '外部粘贴';
          const shouldContinue = CLIPBOARD_CALLBACKS.onPasting?.({
            sheetName: args.sheetName,
            range: describeClipboardRange(args.cellRange),
            text,
            data: clipboardTextToMatrix(text),
            isCutting: args.isCutting,
          });
          if (shouldContinue === false) {
            args.cancel = true;
            clipboardHistorySource = null;
            clipboardHistorySnapshot = null;
            return;
          }
          clipboardHistoryTimer = window.setTimeout(() => {
            clipboardHistorySource = null;
          }, 30_000);
        },
      );
      spread.bind(
        GC.Spread.Sheets.Events.ClipboardPasted,
        (_sender: unknown, _args: ClipboardPastedArgs) => {
          window.clearTimeout(clipboardHistoryTimer);
          const snapshot = clipboardHistorySnapshot;
          const source = clipboardHistorySource ?? '粘贴';
          clipboardHistorySnapshot = null;
          let changedCount = 0;
          let blockedReadonlyChange = false;
          const pendingEdits: CellEditRequest[] = [];
          spread.suspendPaint();
          try {
            snapshot?.forEach(({ row, col, oldValue, oldFormula }) => {
              const column = COLUMNS[col];
              const newValue = sheet.getValue(row, col);
              const newFormula = sheet.getFormula(row, col) ?? '';
              if (!column) return;
              const editability = getCellEditability(activeRows[row], col);
              if (!editability.editable) {
                if (
                  !historyValuesEqual(oldValue, newValue) ||
                  oldFormula !== newFormula
                ) {
                  spread.suspendEvent();
                  try {
                    sheet.setFormula(row, col, oldFormula);
                    if (!oldFormula) sheet.setValue(row, col, oldValue);
                  } finally {
                    spread.resumeEvent();
                  }
                  blockedReadonlyChange = true;
                }
                return;
              }
              if (oldFormula !== newFormula) {
                if (
                  appendCellHistory(
                    row,
                    col,
                    oldFormula,
                    newFormula,
                    `${source} · 公式`,
                  )
                )
                  changedCount += 1;
                const key = stableCellKey(activeRows[row].id, column.field);
                if (newFormula) cellFormulaState.set(key, newFormula);
                else cellFormulaState.delete(key);
              }
              if (!historyValuesEqual(oldValue, newValue))
                pendingEdits.push({
                  row,
                  col,
                  oldValue,
                  requestedValue: newValue,
                  source,
                });
            });
          } finally {
            spread.resumePaint();
          }
          changedCount += commitBusinessCellValues(pendingEdits);
          if (changedCount) {
            invalidateSearchSession(
              activeSearch.query
                ? '粘贴数据已更新，按 Enter 刷新搜索结果'
                : undefined,
            );
          }
          if (blockedReadonlyChange)
            notify('已跳过只读或无法映射的单元格', 'error');
          updateSelected(
            sheet.getActiveRowIndex(),
            sheet.getActiveColumnIndex(),
          );
          clipboardHistoryTimer = window.setTimeout(() => {
            clipboardHistorySource = null;
          });
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.ValidationError,
        (_sender: unknown, args: ValidationErrorArgs) => {
          if (COLUMNS[args.col]?.format !== 'decimal') return;

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
          if (
            (args.propertyName !== 'value' &&
              args.propertyName !== 'formula') ||
            args.row < 0 ||
            args.col < 0
          )
            return;
          if (clipboardHistorySnapshot) return;
          if (commandHistoryDiffInProgress) return;
          const node = activeRows[args.row];
          const column = COLUMNS[args.col];
          if (!node || !column) return;
          const editability = getCellEditability(node, args.col);
          if (!editability.editable) {
            spread.suspendEvent();
            try {
              const oldFormula =
                args.propertyName === 'formula'
                  ? String(args.oldValue ?? '')
                  : '';
              sheet.setFormula(args.row, args.col, oldFormula);
              if (!oldFormula)
                sheet.setValue(
                  args.row,
                  args.col,
                  viewRowCellValue(node, args.col),
                );
            } finally {
              spread.resumeEvent();
            }
            notify(`无法编辑：${editability.reason}`, 'error');
            updateSelected(args.row, args.col);
            return;
          }
          const historySource = historySourceForChange(args);
          if (args.propertyName === 'formula') {
            appendCellHistory(
              args.row,
              args.col,
              args.oldValue,
              args.newValue,
              historySource,
            );
            const key = stableCellKey(node.id, column.field);
            const nextFormula = String(args.newValue ?? '');
            if (nextFormula) cellFormulaState.set(key, nextFormula);
            else cellFormulaState.delete(key);
            const formulaResult = sheet.getValue(args.row, args.col);
            commitBusinessCellValue(
              args.row,
              args.col,
              viewRowCellValue(node, args.col),
              formulaResult,
              `${historySource} · 计算结果`,
            );
            invalidateSearchSession(
              activeSearch.query
                ? '公式已更新，按 Enter 刷新搜索结果'
                : undefined,
            );
            updateSelected(args.row, args.col);
            return;
          }
          commitBusinessCellValue(
            args.row,
            args.col,
            args.oldValue,
            args.newValue,
            historySource,
          );
          invalidateSearchSession(
            activeSearch.query
              ? '数据已更新，按 Enter 刷新搜索结果'
              : undefined,
          );
          updateSelected(args.row, args.col);
        },
      );
      sheet.bind(
        GC.Spread.Sheets.Events.RangeChanged,
        (_sender: unknown, args: RangeChangedArgs) => {
          if (commandHistoryDiffInProgress || clipboardHistorySnapshot) return;
          const source = rangeHistorySource(args);
          if (!source) return;

          const changedCells = args.changedCells.length
            ? args.changedCells
            : Array.from(
                { length: Math.max(args.rowCount, 0) },
                (_, rowOffset) =>
                  Array.from(
                    { length: Math.max(args.colCount, 0) },
                    (__, colOffset) => ({
                      row: args.row + rowOffset,
                      col: args.col + colOffset,
                    }),
                  ),
              ).flat();
          const seen = new Set<string>();
          let changedCount = 0;
          let blockedReadonlyChange = false;
          const pendingEdits: CellEditRequest[] = [];
          spread.suspendPaint();
          try {
            changedCells.forEach(({ row, col }) => {
              const coordinate = `${row}:${col}`;
              if (seen.has(coordinate)) return;
              seen.add(coordinate);
              const node = activeRows[row];
              const column = COLUMNS[col];
              if (!node || !column) return;
              const newValue = sheet.getValue(row, col);
              const newFormula = sheet.getFormula(row, col) ?? '';
              const editability = getCellEditability(node, col);
              if (!editability.editable) {
                const expectedValue = viewRowCellValue(node, col);
                if (!historyValuesEqual(expectedValue, newValue)) {
                  spread.suspendEvent();
                  try {
                    sheet.setFormula(row, col, '');
                    sheet.setValue(row, col, expectedValue);
                  } finally {
                    spread.resumeEvent();
                  }
                  blockedReadonlyChange = true;
                }
                return;
              }

              const key = stableCellKey(node.id, column.field);
              const oldFormula = cellFormulaState.get(key) ?? '';
              if (oldFormula !== newFormula) {
                if (
                  appendCellHistory(
                    row,
                    col,
                    oldFormula,
                    newFormula,
                    `${source} · 公式`,
                  )
                )
                  changedCount += 1;
                if (newFormula) cellFormulaState.set(key, newFormula);
                else cellFormulaState.delete(key);
              }

              const oldValue = viewRowCellValue(node, col);
              if (!historyValuesEqual(oldValue, newValue))
                pendingEdits.push({
                  row,
                  col,
                  oldValue,
                  requestedValue: newValue,
                  source,
                });
            });
          } finally {
            spread.resumePaint();
          }
          changedCount += commitBusinessCellValues(pendingEdits);
          if (changedCount) {
            invalidateSearchSession(
              activeSearch.query
                ? '数据已更新，按 Enter 刷新搜索结果'
                : undefined,
            );
            updateSelected(
              sheet.getActiveRowIndex(),
              sheet.getActiveColumnIndex(),
            );
            const range = sheet.getSelections().at(-1);
            if (range) calculateSelection(sheet, range);
          }
          if (blockedReadonlyChange)
            notify('已跳过只读或无法映射的单元格', 'error');
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
      renderRows(buildRegularRows(), false);
      syncProjectionSnapshot();
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
      window.clearTimeout(clipboardHistoryTimer);
      clipboardHistorySnapshot = null;
      trackedHistoryCells.clear();
      cellFormulaState.clear();
      actionsRef.current = null;
      workbook?.destroy();
      releaseStressRecords();
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
    searchBusy,
    columnMenuOpen,
    setColumnMenuOpen,
    columnVisibility,
    rowGroupsCollapsed,
    columnGroupsCollapsed,
    outlineSnapshot,
    toast,
    datasetLabel,
    aggregateValue,
    licenseConfigured: Boolean(process.env.UMI_APP_SPREADJS_LICENSE_KEY),
    openPanel,
    tableBusy,
  };
}

export type SpreadsheetController = ReturnType<typeof useSpreadsheetController>;
