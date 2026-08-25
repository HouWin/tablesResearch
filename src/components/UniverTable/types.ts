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
}

/**
 * ETable 自定义单元格合并配置。
 *
 * 用于处理业务数据区域中的横向、纵向或者多行多列合并。
 */
export interface ETableMerge {
  /** 合并配置唯一标识 */
  id: string;
  /** 合并区域开始行，从 0 开始 */
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
 * ETable 组件参数。
 *
 * 用于配置多级表头、数据、合并、行列分组、批注以及工作表基础配置。
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
  /** 初始化批注 */
  comments?: ETableComment[];
  /** 表格配置 */
  options?: ETableOptions;
  /** Univer 初始化完成 */
  onReady?: (params: { univerAPI: any; workbook: any; worksheet: any }) => void;
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
}
