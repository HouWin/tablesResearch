export type ETablePrimitive = string | number | boolean | null | undefined;

/**
 * ETable 单元格数据。
 *
 * 用于描述单元格的值以及单元格自身的显示和编辑属性。
 */
export interface ETableCell {
  /** 单元格实际显示值 */
  value?: ETablePrimitive;
  /** 单元格样式配置 */
  style?: any;
  /** 单元格公式，例如 =SUM(A1:A5) */
  formula?: string;
  /** 是否允许编辑当前单元格 */
  editable?: boolean;
}

/**
 * ETable 多级表头列配置。
 *
 * columns 可以通过 children 形成多级嵌套结构，
 * 没有 children 的列会作为最终的数据列。
 *
 * @example
 * {
 *   id: 'basic',
 *   title: '基本信息',
 *   children: [
 *     { id: 'name', title: '姓名' },
 *     { id: 'age', title: '年龄' },
 *   ],
 * }
 */
export interface ETableColumn {
  /** 列唯一标识，同时用于匹配行数据中的字段 */
  id: string;
  /** 表头显示名称 */
  title: string;
  /** 当前列宽度 */
  width?: number;
  /** 子列配置，用于创建多级表头 */
  children?: ETableColumn[];
  /** 是否允许编辑当前列 */
  editable?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
  /** 单元格类型 */
  type?: 'text' | 'number' | 'date' | 'select';
  /** select 下拉选项 */
  options?: string[];
  /** number 列数字格式，默认 0.00 */
  numberFormat?: string;
  /**
   * Univer 列索引
   *
   * 自动生成：
   * A = 0
   * B = 1
   * C = 2
   */
  index?: number;
  /**
   * Excel 列名
   *
   * 自动生成：
   * 0 = A
   * 1 = B
   * 2 = C
   * 26 = AA
   */
  letter?: string;
}

/**
 * ETable 数据行配置。
 *
 * 每一条 ETableRow 对应工作表中的一行数据。
 */
export interface ETableRow {
  /** 数据行唯一标识 */
  id: string;
  /** 当前行的数据，key 对应 ETableColumn.id */
  data: Record<string, ETablePrimitive | ETableCell>;
  /** 当前行高度 */
  height?: number;
  /**
   * 是否整行只读（如分组汇总行、总计行）。
   * 为 true 时禁止进入单元格编辑。
   */
  readonly?: boolean;
  /** 行样式（会应用到该行全部单元格） */
  style?: {
    /** 背景色，如 #E8F3FF */
    bg?: string;
  };
}

/**
 * ETable 自定义单元格合并配置。
 *
 * 用于处理业务数据区域中的横向、纵向或者多行多列合并。
 * row / column 均相对于数据区域（不含表头），从 0 开始。
 */
export interface ETableMerge {
  /** 合并配置唯一标识 */
  id: string;
  /** 合并区域开始行，相对于数据区域，从 0 开始 */
  row: number;
  /** 合并区域开始列，从 0 开始 */
  column: number;
  /** 合并区域占用的行数 */
  rowSpan: number;
  /** 合并区域占用的列数 */
  columnSpan: number;
  /** 合并区域写入的值 */
  value?: ETablePrimitive;
}

/**
 * ETable 行大纲分组配置。
 *
 * 用于创建 Univer 原生行分组，
 * 支持多级嵌套以及初始化折叠状态。
 */
export interface ETableRowGroup {
  /** 行分组唯一标识 */
  id: string;
  /** 分组开始行，相对于数据区域，从 0 开始 */
  startRow: number;
  /** 当前分组包含的数据行数量 */
  count: number;
  /** 是否在初始化时折叠当前分组 */
  collapsed?: boolean;
  /** 子行分组，支持多级嵌套 */
  children?: ETableRowGroup[];
}

/**
 * ETable 列大纲分组配置。
 *
 * 用于创建 Univer 原生列分组，
 * 支持多级嵌套以及初始化折叠状态。
 */
export interface ETableColumnGroup {
  /** 列分组唯一标识 */
  id: string;
  /** 分组开始列，相对于叶子列，从 0 开始 */
  startColumn: number;
  /** 当前分组包含的列数量 */
  count: number;
  /** 是否在初始化时折叠当前分组 */
  collapsed?: boolean;
  /** 子列分组，支持多级嵌套 */
  children?: ETableColumnGroup[];
}

/**
 * ETable 基础配置。
 *
 * 用于控制工作簿名称、默认尺寸、网格线以及冻结行列等功能。
 */
export interface ETableOptions {
  /** Workbook 名称 */
  name?: string;
  /** 默认列宽 */
  defaultColumnWidth?: number;
  /** 默认行高 */
  defaultRowHeight?: number;
  /** 是否显示网格线 */
  showGridLines?: boolean;
  /** 冻结行数量 */
  freezeRows?: number;
  /** 冻结列数量 */
  freezeColumns?: number;
  /** 是否自定义 Univer 原生列头 */
  customizeColumnHeader?: boolean;
  /**
   * 开启虚拟滚动渲染（默认 true）。
   * - Canvas 仅绘制可视区
   * - 小数据：分片 setValues
   * - ≥5000 行：视口按页懒写入，滚动/选区时再补页
   */
  virtualScroll?: boolean;
}

/**
 * ETable 单元格批注配置。
 *
 * 用于初始化表格时创建 Thread Comment，
 * 也可以用于保存和恢复后端返回的批注数据。
 */
export interface ETableComment {
  /** 批注所在单元格，例如 A1、B2 */
  cell: string;
  /** 批注内容 */
  content: string;
  /** 创建批注的用户 ID */
  userId?: string;
  /** 批注唯一 ID */
  id?: string;
  /** Thread Comment 线程 ID */
  threadId?: string;
  /** 批注创建时间 */
  dateTime?: string | Date;
}

/**
 * 单个附件文件。
 */
export interface ETableAttachmentFile {
  /** 附件唯一 ID */
  id: string;
  /** 文件名 */
  name: string;
  /** 可访问地址（上传后的 URL 或本地 blob URL） */
  url: string;
  /** 文件大小（字节） */
  size?: number;
  /** MIME 类型 */
  mimeType?: string;
  /** 上传时间 */
  uploadedAt?: string;
}

/**
 * 单元格附件配置。
 *
 * 附件元数据会写入单元格 customMetaData，
 * 并在启用 Note 预设时同步备注角标。
 */
export interface ETableAttachment {
  /** 单元格地址，例如 A1、B2 */
  cell: string;
  /** 附件列表 */
  files: ETableAttachmentFile[];
}

/**
 * 树形节点上的属性（最底层可折叠项，例如 East / Central / West / South）。
 */
export interface ETableTreeAttribute {
  /** 属性唯一标识 */
  id: string;
  /** 属性显示名 */
  label: string;
  /** 指标值，key 对应 measure field */
  values?: Record<string, ETablePrimitive | ETableCell>;
  /**
   * 属性下的明细行（可选）。
   * 有 children 时可通过大纲折叠/展开这些明细。
   */
  children?: ETableTreeAttributeDetail[];
  /** 明细行是否默认折叠 */
  collapsed?: boolean;
}

/**
 * 属性下的明细行。
 */
export interface ETableTreeAttributeDetail {
  id: string;
  label: string;
  values?: Record<string, ETablePrimitive | ETableCell>;
}

/**
 * 树形行节点。
 *
 * 非叶子节点通过 children 继续下钻；
 * 叶子节点通过 attributes 挂载属性层。
 */
export interface ETableTreeNode {
  /** 节点唯一标识 */
  id: string;
  /** 当前维度列上的显示值 */
  label: string;
  /** 是否默认折叠当前节点下的子行 */
  collapsed?: boolean;
  /**
   * 叶子节点上附带的固定维度值。
   * 例如 { region: 'East' }，会写入对应维度列并参与纵向合并。
   */
  data?: Record<string, ETablePrimitive>;
  /**
   * 当前节点行上的指标/字段值（父行汇总、叶子明细均可）。
   * 若包含 attribute.field，会写入 Region 列。
   */
  values?: Record<string, ETablePrimitive | ETableCell>;
  /** 子节点 */
  children?: ETableTreeNode[];
  /** 属性列表（仅叶子节点使用） */
  attributes?: ETableTreeAttribute[];
}

/**
 * 树形配置中的列分组（用 field 声明，展平时转成列索引）。
 *
 * 同一组内的列必须在表头中连续；
 * 会按 fields 对应列的最小～最大索引生成 startColumn / count。
 */
export interface ETableTreeColumnGroup {
  id: string;
  /** 分到同一组的列 field */
  fields: string[];
  /** 是否默认折叠 */
  collapsed?: boolean;
  /** 子列分组 */
  children?: ETableTreeColumnGroup[];
}

/**
 * 树形数据展平配置。
 *
 * dimensions 从左到右对应层级；
 * attribute 是属性列；
 * measures 是指标列。
 */
export interface ETableTreeConfig {
  /** 维度列（不含属性列） */
  dimensions: Array<{ field: string; title: string; width?: number }>;
  /** 属性列（可选；行内属性展开。与 measureGroups 列维度互斥场景下不要混用） */
  attribute?: { field: string; title: string; width?: number };
  /**
   * 自定义多级表头（完整列树）。
   * 设置后优先使用，不再由 dimensions / measures / measureGroups 自动生成表头；
   * 展平逻辑仍读取 dimensions / attribute / measures。
   */
  headerColumns?: ETableColumn[];
  /** 指标列（扁平；若配置了 measureGroups 则忽略） */
  measures?: Array<{
    field: string;
    title: string;
    width?: number;
    type?: 'text' | 'number' | 'date' | 'select';
    options?: string[];
    numberFormat?: string;
  }>;
  /**
   * 指标列分组（列维度，如 Region）。
   * 与行树 Category 完全独立：行折叠不影响列，列折叠不影响行。
   * 例：East / Central / West 各组下挂 Sales、Profit。
   */
  measureGroups?: Array<{
    id: string;
    title: string;
    /** 是否默认折叠该列组 */
    collapsed?: boolean;
    measures: Array<{
      field: string;
      title: string;
      width?: number;
      type?: 'text' | 'number' | 'date' | 'select';
      options?: string[];
      numberFormat?: string;
    }>;
  }>;
  /**
   * 树节点 label 写入方式：
   * - 'single'：所有层级写入 dimensions[0]（同列树，如 Category 下的 Furniture / Bookcases）
   * - 'depth'：第 n 层写入 dimensions[n]（多列维度）
   * @default 'single'
   */
  labelMode?: 'single' | 'depth';
  /**
   * 树形 UI：
   * 同列缩进 + 单元格内 ▶/▼，点击单元格折叠行，不使用左侧大纲栏。
   */
  treeUI?: boolean;
  /** 属性明细是否默认折叠（仅当属性带 children 时生效） */
  collapseAttributes?: boolean;
  /** 树节点默认折叠（未显式设置 node.collapsed 时生效），默认 true */
  defaultCollapsed?: boolean;
  /**
   * 行背景色（按树深度）。
   * 例如 ['#E8F3FF', '#F5F9FC']；超出部分循环使用最后一色。
   * Region 明细行可用 regionDetailBackground。
   */
  rowBackgrounds?: string[];
  /** Region 明细行（Category 为空）背景色 */
  regionDetailBackground?: string;
  /**
   * 列分组（列折叠）。
   * 用 field 声明；若已配置 measureGroups，会自动生成，无需再传。
   */
  columnGroups?: ETableTreeColumnGroup[];
  /**
   * 分组统计：按子节点/属性明细自动汇总，统计名称可自定义。
   * 例：fields: [{ field: 'sales', method: 'sum', name: '销售额合计' }]
   * labelTemplate: '{label} 小计'
   */
  groupStatistics?: ETableGroupStatistics;
  /**
   * 大数据轻量模式：跳过分组统计与 Region 多层展平，配合 generateScaledTreeData 使用。
   * 每个叶子约 1 行，避免 1 万目标膨胀到数万行。
   */
  liteMode?: boolean;
  /**
   * 跳过海量跨行 merge（品类整列跨千行等）。
   * liteMode 下仍允许品类/子品类在单个 Region 块内纵向合并（与树形演示一致）。
   */
  skipMerges?: boolean;
}

/** 分组统计字段 */
export interface ETableGroupStatisticField {
  /** 指标字段（对应 measures.field） */
  field: string;
  /** 汇总方式，默认 sum */
  method?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  /**
   * 统计名称（可自定义）。
   * 可用于 labelTemplate 的 {statName}，不传则回退为 measures.title / field。
   */
  name?: string;
}

/** 分组统计配置 */
export interface ETableGroupStatistics {
  /** 是否启用，默认 true（配置了 fields 即启用） */
  enabled?: boolean;
  /**
   * 分组行标签模板。
   * 占位符：{label} 原节点名、{statName} 首个统计字段的自定义名称
   * 例：'{label} 小计' → Furniture 小计
   */
  labelTemplate?: string;
  /** 是否在表格底部追加总计行 */
  showGrandTotal?: boolean;
  /** 总计行名称，默认「总计」 */
  grandTotalLabel?: string;
  /** 总计行背景色 */
  grandTotalBackground?: string;
  /** 参与统计的字段 */
  fields: ETableGroupStatisticField[];
}

/**
 * 树形单元格内折叠绑定（treeUI）。
 */
export interface ETableTreeToggleBinding {
  groupId: string;
  /** 相对于数据区域的行 */
  row: number;
  column: number;
  collapsed: boolean;
  expandedText: string;
  collapsedText: string;
  /**
   * category：分类树折叠；region：Region 属性折叠。
   * 收起 category 时会联动收起同行的 region。
   */
  kind?: 'category' | 'region';
}

/**
 * 树形数据展平结果。
 */
export interface ETableFlattenResult {
  columns: ETableColumn[];
  rows: ETableRow[];
  rowGroups: ETableRowGroup[];
  columnGroups: ETableColumnGroup[];
  merges: ETableMerge[];
  treeToggles?: ETableTreeToggleBinding[];
}

/**
 * 多重分组维度列。
 */
export interface ETableGroupDimension {
  field: string;
  title: string;
  width?: number;
}

/**
 * 多重分组明细/指标列。
 */
export interface ETableGroupMeasure {
  field: string;
  title: string;
  width?: number;
}

/**
 * 平铺数据多重分组配置。
 *
 * dimensions 从左到右表示分组层级（如 Selling Package → Year Quarter）；
 * measures 为展开后显示的明细列。
 */
export interface ETableGroupConfig {
  dimensions: ETableGroupDimension[];
  measures: ETableGroupMeasure[];
  /** 维度列背景色，如 #FFE0B2 */
  dimensionStyle?: { bg?: string };
  /** 未在 collapsedPaths 中匹配时的默认折叠状态 */
  defaultCollapsed?: boolean;
  /**
   * 指定默认折叠的分组路径。
   * 例如 [{ sellingPackage: 'Each', yearQuarter: '2013Q1' }]
   */
  collapsedPaths?: Array<Partial<Record<string, ETablePrimitive>>>;
}

/**
 * 单元格变更记录（历史 / 数据追踪）。
 */
export interface ETableCellChangeRecord {
  id: string;
  cell: string;
  row: number;
  column: number;
  from: string;
  to: string;
  time: string;
  source?: 'edit' | 'paste' | 'api';
}

/**
 * 数据追踪节点（计算血缘的简化展示）。
 */
export interface ETableDataTraceNode {
  label: string;
  value?: string;
  children?: ETableDataTraceNode[];
}

/**
 * ETable 组件参数。
 *
 * 用于配置多级表头、数据、合并、行列分组、批注以及工作表基础配置。
 *
 * 也可直接传 treeData + treeConfig，组件内部会自动展平为 rows / rowGroups / merges。
 */
export interface ETableProps {
  /** 多级表头 */
  columns?: ETableColumn[];
  /** 表格数据 */
  rows?: ETableRow[];
  /** 自定义合并 */
  merges?: ETableMerge[];
  /** 行分组 */
  rowGroups?: ETableRowGroup[];
  /** 列分组 */
  columnGroups?: ETableColumnGroup[];
  /** 树形数据（与 rows 二选一，优先 treeData） */
  treeData?: ETableTreeNode[];
  /** 树形展平配置（配合 treeData 使用） */
  treeConfig?: ETableTreeConfig;
  /** 平铺数据（配合 groupConfig 做多重分组） */
  groupData?: Array<Record<string, ETablePrimitive>>;
  /** 多重分组配置（配合 groupData 使用） */
  groupConfig?: ETableGroupConfig;
  /** 初始化批注 */
  comments?: ETableComment[];
  /** 初始化单元格附件 */
  attachments?: ETableAttachment[];
  /**
   * 附件上传回调。
   * 不传时默认使用本地 blob URL（仅适合演示）。
   */
  onUploadAttachment?: (
    file: File,
    cell: string,
  ) => Promise<ETableAttachmentFile | ETableAttachmentFile[]>;
  /** 附件变化回调 */
  onAttachmentsChange?: (cell: string, files: ETableAttachmentFile[]) => void;
  /** 单元格值变更（数据追踪 / 历史） */
  onCellChange?: (record: ETableCellChangeRecord) => void;
  /** 选区变化 */
  onSelectionChange?: (cell: string, row: number, column: number) => void;
  /** 右键查看单元格历史 */
  onViewCellHistory?: (cell: string) => void;
  /** 右键数据追踪 */
  onViewDataTrace?: (cell: string) => void;
  /** 表格配置 */
  options?: ETableOptions;
  /** Univer 初始化完成（含渲染耗时） */
  onReady?: (params: {
    univerAPI: any;
    workbook: any;
    worksheet: any;
    /** 表格初始化到数据渲染完成的耗时（毫秒） */
    renderMs?: number;
    /** 展平后的数据行数 */
    rowCount?: number;
  }) => void;
}

/**
 * ETable 对外暴露的实例方法。
 *
 * 父组件可以通过 React ref 获取 ETableRef，
 * 从而直接操作 Univer 工作簿、工作表、行列分组以及批注。
 *
 * @example
 * const tableRef = useRef<ETableRef>(null);
 *
 * tableRef.current?.collapseRowGroup('group-1');
 * tableRef.current?.addComment('B2', '请确认预算金额');
 */
export interface ETableRef {
  /** 获取 Univer API 实例 */
  getUniverAPI(): any;
  /** 获取当前工作簿实例 */
  getWorkbook(): any;
  /** 获取当前工作表实例 */
  getWorksheet(): any;
  /** 获取当前工作表中的全部行大纲 */
  getRowOutlines(): any[];
  /** 折叠指定的行分组 */
  collapseRowGroup(id: string): void;
  /** 展开指定的行分组 */
  expandRowGroup(id: string): void;
  /** 折叠全部行分组 */
  collapseAllRows(): void;
  /** 展开全部行分组 */
  expandAllRows(): void;
  /** 获取当前工作表中的全部列大纲 */
  getColumnOutlines(): any[];
  /** 折叠指定的列分组 */
  collapseColumnGroup(id: string): void;
  /** 展开指定的列分组 */
  expandColumnGroup(id: string): void;
  /** 折叠全部列分组 */
  collapseAllColumns(): void;
  /** 展开全部列分组 */
  expandAllColumns(): void;
  /** 向指定单元格添加批注 */
  addComment(cell: string, content: string, userId?: string): Promise<any>;
  /** 获取当前工作表中的全部批注 */
  getComments(): any[];
  /** 获取指定单元格上的批注，没有批注时返回 null */
  getComment(cell: string): any;
  /** 删除指定单元格上的批注 */
  deleteComment(cell: string): Promise<boolean>;
  /** 删除当前工作表中的全部批注 */
  clearComments(): Promise<void>;
  /** 向指定单元格添加附件（弹出文件选择） */
  addAttachment(cell: string): Promise<ETableAttachmentFile[]>;
  /** 设置指定单元格的附件列表 */
  setAttachments(cell: string, files: ETableAttachmentFile[]): void;
  /** 获取指定单元格的附件列表 */
  getAttachments(cell: string): ETableAttachmentFile[];
  /** 删除指定单元格的某个附件 */
  removeAttachment(cell: string, attachmentId: string): ETableAttachmentFile[];
  /** 清空指定单元格的全部附件 */
  clearAttachments(cell: string): void;
  /** 查看指定单元格附件（弹窗） */
  viewAttachments(cell: string): void;
  /** 下钻：展开当前选中行组 */
  drillDown(): boolean;
  /** 上钻：折叠当前选中行组 */
  drillUp(): boolean;
  /** 当前行面包屑 */
  getBreadcrumb(): string[];
  /** 打开快速搜索 */
  openSearch(): boolean;
  /** 按关键字搜索并定位 */
  search(keyword: string): Promise<{ count: number; cell?: string }>;
  /** 撤销上一次编辑 */
  undo(): Promise<boolean>;
  /** 重做上一次撤销 */
  redo(): Promise<boolean>;
  /** 全部变更记录 */
  getTracks(): ETableCellChangeRecord[];
  /** 指定单元格历史 */
  getCellHistory(cell: string): ETableCellChangeRecord[];
  /** 清空变更记录 */
  clearTracks(): void;
  /** 构建当前单元格数据追踪树 */
  getDataTrace(cell?: string): ETableDataTraceNode | null;
}
