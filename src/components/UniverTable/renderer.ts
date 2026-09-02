/**
 * 表格渲染核心（renderer.ts）
 *
 * 负责将展平后的二维数据写入 Univer Worksheet：
 * - renderHeader：多级表头布局 + 合并
 * - renderData / renderDataAsync：数据区 setValues（支持分片、跳过写入供懒虚拟用）
 * - renderMerges：单元格合并（含视口模式下的逻辑锚点合并）
 * - ensureSheetCapacity：写入前扩容行列，避免 Range out of bounds
 */
import { VerticalAlign } from '@univerjs/core';
import { buildHeaderLayout } from './layout';
import { ASYNC_RENDER_ROW_THRESHOLD } from './treeDataGenerator';
import type { ETableCell, ETableColumn, ETableMerge, ETableRow } from './types';
import type { ETableCellToneContext } from './cellTone';
import { buildRowSheetValues } from './cellTone';

/**
 * =========================================================
 * 类型
 * =========================================================
 */

/**
 * Univer Worksheet。
 *
 * Univer 不同版本的类型定义可能存在差异，
 * 因此这里暂时使用 any，避免和具体版本强绑定。
 */
type UniverWorksheet = any;

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 32 });
      return;
    }
    window.setTimeout(resolve, 0);
  });

/** 按行数自适应分片大小，减少 setValues 调用次数 */
const resolveDataChunkSize = (rowCount: number, explicit?: number) => {
  if (explicit !== undefined) {
    return Math.max(400, explicit);
  }
  if (rowCount >= 100_000) {
    return 4000;
  }
  if (rowCount >= 50_000) {
    return 3000;
  }
  if (rowCount >= 20_000) {
    return 2000;
  }
  if (rowCount >= 5000) {
    return 1200;
  }
  return 800;
};

/**
 * Univer 默认工作表仅 1000 行 × 20 列。
 * 写入大数据前先扩容，避免 Range is out of bounds。
 */
export const ensureSheetCapacity = (
  worksheet: UniverWorksheet,
  rowCount: number,
  columnCount: number,
) => {
  // 如果工作表不存在，则直接返回
  if (!worksheet) {
    return;
  }
  // 计算需要扩容的行数
  const needRows = Math.max(1, Math.ceil(rowCount));
  // 计算需要扩容的列数
  const needCols = Math.max(1, Math.ceil(columnCount));
  try {
    // 获取最大行数
    const maxRows = typeof worksheet.getMaxRows === 'function' ? worksheet.getMaxRows() : 1000;
    if (needRows > maxRows) {
      // 设置行数
      worksheet.setRowCount(needRows);
    }
  } catch (error) {
    console.warn('[ETable] setRowCount failed', error);
  }
  try {
    // 获取最大列数
    const maxCols = typeof worksheet.getMaxColumns === 'function' ? worksheet.getMaxColumns() : 20;
    // 如果需要扩容的列数大于最大列数，则设置列数
    if (needCols > maxCols) {
      // 设置列数
      worksheet.setColumnCount(needCols);
    }
  } catch (error) {
    console.warn('[ETable] setColumnCount failed', error);
  }
};

/**
 * =========================================================
 * 表头
 * =========================================================
 */

/**
 * 根据多级列配置渲染业务表头。
 *
 * ---------------------------------------------------------
 * 负责：
 *
 * 1. 根据 columns 计算表头布局
 * 2. 写入表头标题
 * 3. 执行横向合并
 * 4. 执行纵向合并
 *
 * ---------------------------------------------------------
 * 不负责：
 *
 * 1. Univer 原生 A/B/C/D 列头
 * 2. 列宽
 * 3. 数据
 * 4. 行分组
 * 5. 列分组
 *
 * 原生列头由 header.ts 单独处理。
 *
 * @param worksheet Univer 工作表
 * @param columns 多级表头
 *
 * @returns
 *
 * leafColumns:
 *   所有叶子列
 *
 * maxDepth:
 *   表头最大深度
 */
export const renderHeader = (worksheet: UniverWorksheet, columns: ETableColumn[] = []) => {
  /**
   * 没有列配置时直接返回。
   */
  if (!worksheet || !columns.length) {
    return { leafColumns: [], maxDepth: 0 };
  }

  /**
   * -------------------------------------------------------
   * 统一通过 layout.ts 计算布局
   * -------------------------------------------------------
   *
   * layout.ts 应负责计算：
   *
   * startRow
   * startColumn
   * rowSpan
   * columnSpan
   * title
   *
   * 特别是：
   *
   * 组织机构
   * 预算项目
   * 费用科目
   *
   * 这种没有 children 的叶子节点，
   * 应该由 layout.ts 自动计算：
   *
   * rowSpan = maxDepth
   */
  const { layouts, leafColumns, maxDepth } = buildHeaderLayout(columns);
  // 写入表头
  layouts.forEach((item) => {
    // 防止非法布局数据影响整个表格。
    if (item.startRow < 0 || item.startColumn < 0 || item.rowSpan <= 0 || item.columnSpan <= 0) {
      return;
    }
    // 获取当前表头区域。
    const range = worksheet.getRange(item.startRow, item.startColumn, item.rowSpan, item.columnSpan);
    // 写入标题（Univer 默认顶对齐，表头统一垂直居中）
    range.setValue({
      v: item.title,
      s: { vt: VerticalAlign.MIDDLE },
    });

    /**
     * -----------------------------------------------------
     * 执行表头合并
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 2026年度预算
     * ├── 上半年
     * └── 下半年
     *
     * 需要横向合并。
     *
     * 而：
     *
     * 组织机构
     *
     * 需要纵向合并。
     */
    if (item.rowSpan > 1 || item.columnSpan > 1) {
      try {
        range.merge();
      } catch (error) {
        /**
         * 单个表头合并失败，
         * 不影响其他表头。
         */
        console.warn('[ETable] header merge failed', { item, error });
      }
    }
  });
  return { leafColumns, maxDepth };
};

/**
 * =========================================================
 * 数据
 * =========================================================
 */

/**
 * 将业务数据写入 Univer。
 *
 * ---------------------------------------------------------
 * 支持：
 *
 * 1. 多级表头
 * 2. 叶子列自动匹配
 * 3. 普通值
 * 4. { value, label } 类型数据
 * 5. 批量 setValues
 * 6. 单独设置行高
 *
 * ---------------------------------------------------------
 * 数据开始位置：
 *
 * renderData(
 *   worksheet,
 *   rows,
 *   leafColumns,
 *   maxDepth,
 * );
 *
 * maxDepth = 4
 *
 * 则：
 *
 * 0 ~ 3  => 表头
 * 4      => 第一条数据
 * 5      => 第二条数据
 * ...
 *
 * @param worksheet Univer 工作表
 * @param rows 数据
 * @param leafColumns 叶子列
 * @param startRow 数据开始行
 * @param options.virtualScroll 分片写入，避免超大矩阵一次 setValues
 * @returns 实际写入的行数（全量模式 = rows.length；视口懒加载时由 loader 另行写入）
 */
export const renderData = (
  worksheet: UniverWorksheet,
  rows: ETableRow[] = [],
  leafColumns: ETableColumn[] = [],
  startRow: number,
  options?: {
    virtualScroll?: boolean;
    chunkSize?: number;
    skipWrite?: boolean;
    cellTone?: ETableCellToneContext | null;
  },
): number => {
  // 如果工作表不存在，或者没有数据，或者没有叶子列，则直接返回
  if (!worksheet || !rows.length || !leafColumns.length) {
    return 0;
  }

  // 如果数据开始行小于0，则直接返回
  if (startRow < 0) {
    return 0;
  }

  // 视口懒加载模式：骨架已扩容，数据由 virtualRender 按页写入
  if (options?.skipWrite) {
    return 0;
  }

  // 计算分片大小
  const chunkSize = resolveDataChunkSize(rows.length, options?.chunkSize);

  // 是否使用单次写入
  const useSingleWrite = rows.length <= 400;

  // 如果使用单次写入，则直接写入
  if (useSingleWrite) {
    const values = buildRowValues(rows, leafColumns, { cellTone: options?.cellTone });
    worksheet.getRange(startRow, 0, values.length, leafColumns.length).setValues(values);
  } else {
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const limit = Math.min(chunkSize, rows.length - offset);
      const values = buildRowValues(rows, leafColumns, {
        offset,
        limit,
        cellTone: options?.cellTone,
      });
      // 分片写入
      worksheet.getRange(startRow + offset, 0, values.length, leafColumns.length).setValues(values);
    }
  }

  // 遍历行
  rows.forEach((row, index) => {
    // 如果行高大于0，则设置行高
    if (typeof row.height === 'number') {
      // 设置行高
      worksheet.setRowHeight(startRow + index, row.height);
    }
  });

  // 返回实际写入的行数
  return rows.length;
};

const buildRowValues = (
  rows: ETableRow[],
  leafColumns: ETableColumn[],
  options?: {
    skipRowBackgrounds?: boolean;
    offset?: number;
    limit?: number;
    cellTone?: ETableCellToneContext | null;
  },
) => {
  const cellTone = options?.cellTone ?? null;
  const skipRowBackgrounds = options?.skipRowBackgrounds ?? false;
  // 偏移量
  const offset = options?.offset ?? 0;
  // 结束位置
  const end = options?.limit !== undefined ? offset + options.limit : rows.length;
  // 行数
  const rowCount = end - offset;
  // 列数
  const colCount = leafColumns.length;
  // 如果行数小于等于0，或者列数为0，则直接返回

  // 创建列ID数组
  const colIds = new Array<string>(colCount);
  // 遍历列
  for (let c = 0; c < colCount; c += 1) {
    colIds[c] = leafColumns[c].id;
  }

  if (cellTone) {
    const matrix = new Array(rowCount);
    for (let r = 0; r < rowCount; r += 1) {
      const dataRow = offset + r;
      matrix[r] = buildRowSheetValues(rows[dataRow], dataRow, leafColumns, cellTone);
    }
    return matrix;
  }

  if (skipRowBackgrounds) {
    // 创建矩阵
    const matrix = new Array(rowCount);
    // 遍历行
    for (let r = 0; r < rowCount; r += 1) {
      // 获取行
      const row = rows[offset + r];
      // 获取数据
      const data = row.data;
      // 创建输出数组
      const out = new Array(colCount);
      for (let c = 0; c < colCount; c += 1) {
        // 获取单元格
        const cell = data?.[colIds[c]];
        // 如果单元格存在，并且是对象，则设置输出
        if (cell !== null && typeof cell === 'object') {
          // 获取样式
          const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
          // 如果样式存在，则设置输出
          if (styledCell.style) {
            out[c] = {
              v: styledCell.value ?? null,
              s: styledCell.style,
            };
          } else {
            // 设置输出
            out[c] = styledCell.value ?? null;
          }
        } else {
          // 设置输出
          out[c] = cell ?? null;
        }
      }
      // 设置矩阵
      matrix[r] = out;
    }
    return matrix;
  }

  // 创建行值
  const toRowValues = (row: ETableRow) => {
    // 获取背景样式
    const bgStyle =
      row.style?.bg
        ? // 如果背景样式存在，则设置输出
        {
          // 设置背景样式
          bg: {
            // 如果背景样式以#开头，则直接设置，否则以#开头
            rgb: row.style.bg.startsWith('#') ? row.style.bg : `#${row.style.bg}`,
          },
        }
        : null;

    // 创建输出数组
    const out = new Array(colCount);
    // 遍历列
    for (let c = 0; c < colCount; c += 1) {
      // 获取单元格
      const cell = row.data?.[colIds[c]];
      // 如果单元格存在，并且是对象，则设置输出
      if (cell !== null && typeof cell === 'object') {
        // 获取样式
        const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
        // 如果样式存在，或者背景样式存在，则设置输出
        if (styledCell.style || bgStyle) {
          out[c] = {
            // 设置值
            v: styledCell.value ?? null,
            // 设置样式
            s: {
              ...(bgStyle || {}),
              ...(styledCell.style || {}),
              // 设置背景样式
              bg: (styledCell.style as any)?.bg || bgStyle?.bg,
            },
          };
        } else {
          // 设置输出
          out[c] = styledCell.value ?? null;
        }
      } else if (bgStyle) {
        // 设置输出
        out[c] = {
          // 设置值
          v: cell ?? null,
          s: bgStyle,
        };
      } else {
        // 设置输出
        out[c] = cell ?? null;
      }
    }
    return out;
  };

  // 创建矩阵
  const matrix = new Array(rowCount);
  // 遍历行
  for (let r = 0; r < rowCount; r += 1) {
    // 设置矩阵
    matrix[r] = toRowValues(rows[offset + r]);
  }
  // 返回矩阵
  return matrix;
};

/**
 * 分片异步写入：每批之间让出主线程，避免 1 万行以上长时间阻塞导致页面无响应。
 */
export const renderDataAsync = async (
  worksheet: UniverWorksheet,
  rows: ETableRow[] = [],
  leafColumns: ETableColumn[] = [],
  startRow: number,
  options?: {
    virtualScroll?: boolean;
    chunkSize?: number;
    skipRowBackgrounds?: boolean;
    cellTone?: ETableCellToneContext | null;
  },
): Promise<void> => {
  // 如果工作表不存在，或者没有数据，或者没有叶子列，或者数据开始行小于0，则直接返回
  if (!worksheet || !rows.length || !leafColumns.length || startRow < 0) {
    return;
  }

  // 是否使用虚拟滚动
  const virtualScroll = options?.virtualScroll !== false;
  // 计算分片大小
  const chunkSize = resolveDataChunkSize(rows.length, options?.chunkSize);
  // 创建值选项
  const cellTone = options?.cellTone ?? null;
  const valueOptions = {
    skipRowBackgrounds: cellTone
      ? false
      : options?.skipRowBackgrounds ?? rows.length > 2000,
    cellTone,
  };
  // 是否在分片之间让出主线程
  const yieldBetweenChunks = rows.length >= ASYNC_RENDER_ROW_THRESHOLD;

  // 遍历行
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    // 计算分片大小
    const limit = Math.min(chunkSize, rows.length - offset);
    // 构建行值
    const values = buildRowValues(rows, leafColumns, {
      ...valueOptions,
      offset,
      limit,
    });
    // 分片写入
    worksheet.getRange(startRow + offset, 0, values.length, leafColumns.length).setValues(values);
    // 如果需要让出主线程，并且分片结束位置小于总行数，则让出主线程
    if (yieldBetweenChunks && offset + limit < rows.length) {
      await yieldToMain();
    }
  }
  // 是否有自定义行高
  const hasCustomHeights = rows.some((row) => typeof row.height === 'number');
  // 如果没有自定义行高，并且行数大于0，则设置行高
  if (!hasCustomHeights && rows.length > 0) {
    // 设置行高
    try {
      worksheet.setRowHeights(startRow, rows.length, 30);
    } catch {
      // ignore batch height failure
    }
    return;
  }
  // 遍历行
  rows.forEach((row, index) => {
    // 如果行高大于0，则设置行高
    if (typeof row.height === 'number') {
      // 设置行高
      worksheet.setRowHeight(startRow + index, row.height);
    }
  });
};

/**
 * =========================================================
 * 列宽
 * =========================================================
 */

/**
 * 根据叶子列配置设置列宽。
 *
 * 每个叶子列对应一个实际工作表列。
 *
 * 例如：
 *
 * 0 -> 组织机构
 * 1 -> 预算项目
 * 2 -> 费用科目
 * 3 -> 1月
 * 4 -> 2月
 *
 * @param worksheet Univer 工作表
 * @param leafColumns 叶子列
 * @param defaultWidth 默认列宽
 */
export const renderColumnWidths = (worksheet: UniverWorksheet, leafColumns: ETableColumn[] = [], defaultWidth = 110) => {
  if (!worksheet || !leafColumns.length) {
    return;
  }
  // 遍历叶子列
  leafColumns.forEach((column, index) => {
    // 获取列宽
    const width = typeof column.width === 'number' ? column.width : defaultWidth;
    // 如果列宽小于等于0，则直接返回
    if (width <= 0) {
      return;
    }
    // 设置列宽
    worksheet.setColumnWidth(index, width);
  },
  );
};

/**
 * =========================================================
 * 行高
 * =========================================================
 */

/**
 * 批量设置连续行的行高。
 *
 * @param worksheet Univer 工作表
 * @param startRow 起始行
 * @param count 行数
 * @param height 行高
 */
export const renderRowHeights = (worksheet: UniverWorksheet, startRow: number, count: number, height: number) => {
  // 如果工作表不存在，或者行数小于等于0，或者行高小于等于0，则直接返回
  if (!worksheet || count <= 0 || height <= 0) {
    return;
  }
  // 设置行高
  worksheet.setRowHeights(startRow, count, height);
};

/**
 * =========================================================
 * 自定义合并
 * =========================================================
 */

/**
 * 纵向合并单元格写入值，并强制垂直居中（Univer 默认 vt=0 会顶对齐）。
 */
const toMergedCellPayload = (value: unknown) => {
  // 如果值不为空，并且是对象，并且有value属性，则设置输出
  if (value !== null && typeof value === 'object' && 'value' in value) {
    // 获取单元格
    const cell = value as ETableCell;
    // 设置输出
    return {
      v: cell.value ?? null,
      s: {
        ...(cell.style || {}),
        vt: VerticalAlign.MIDDLE,
      },
    };
  }
  // 设置输出
  return {
    // 设置值
    v: value ?? null,
    // 设置样式
    s: { vt: VerticalAlign.MIDDLE },
  };
};

/**
 * 根据业务配置执行单元格合并。
 *
 * 与 renderHeader() 的表头自动合并完全独立。
 *
 * merges.row 相对于数据区域（与 rowGroups.startRow 一致），
 * 实际写入时会加上 dataStartRow（通常等于表头 maxDepth）。
 *
 * @param worksheet Univer 工作表
 * @param merges 自定义合并
 * @param dataStartRow 数据区域起始行
 */
export const renderMerges = (
  worksheet: UniverWorksheet,
  merges: ETableMerge[] = [],
  dataStartRow = 0,
) => {
  // 如果工作表不存在，或者没有合并，则直接返回
  if (!worksheet || !merges.length) {
    return;
  }
  // 遍历合并
  merges.forEach((merge) => {
    // 应用合并
    applyMerge(worksheet, merge, dataStartRow);
  });
};

/**
 * 大数据分片合并，避免一次性 merge 阻塞主线程。
 */
export const renderMergesAsync = async (
  worksheet: UniverWorksheet,
  merges: ETableMerge[] = [],
  dataStartRow = 0,
  options?: { batchSize?: number },
) => {
  // 如果工作表不存在，或者没有合并，则直接返回
  if (!worksheet || !merges.length) {
    return;
  }

  // 计算分片大小
  const batchSize = Math.max(50, options?.batchSize ?? (merges.length > 5000 ? 400 : 200));
  // 遍历合并
  for (let offset = 0; offset < merges.length; offset += batchSize) {
    // 计算分片
    const batch = merges.slice(offset, offset + batchSize);
    // 遍历分片
    batch.forEach((merge) => {
      // 应用合并
      applyMerge(worksheet, merge, dataStartRow);
    });
    if (offset + batchSize < merges.length) {
      // 让出主线程
      await yieldToMain();
    }
  }
};

/**
 * hideRows / unhideRow 会破坏跨行 merge，展开后按数据行区间重新合并。
 */
export const buildMergeIndexByAnchorRow = (
  merges: ETableMerge[],
): Map<number, ETableMerge[]> => {
  // 创建索引
  const index = new Map<number, ETableMerge[]>();
  // 遍历合并
  merges.forEach((merge) => {
    // 如果合并行跨度小于等于1，则直接返回
    if (merge.rowSpan <= 1) {
      return;
    }
    // 获取列表
    const list = index.get(merge.row) ?? [];
    // 添加合并
    list.push(merge);
    // 设置索引
    index.set(merge.row, list);
  });
  return index;
};

/**
 * hideRows / unhideRow 会破坏跨行 merge，展开后按数据行区间重新合并。
 */
export const reapplyMergesForRowSpan = (
  worksheet: UniverWorksheet,
  merges: ETableMerge[],
  dataStartRow: number,
  anchorRow: number,
  rowSpan: number,
) => {
  // 如果工作表不存在，或者没有合并，或者行跨度小于等于1，则直接返回
  if (!worksheet || !merges.length || rowSpan <= 1) {
    return;
  }
  // 获取触摸开始位置
  const touchStart = anchorRow;
  // 获取触摸结束位置
  const touchEnd = anchorRow + rowSpan;
  // 获取受影响的合并
  const affected = merges.filter((merge) => {
    // 如果合并行跨度小于等于1，则直接返回
    if (merge.rowSpan <= 1) {
      return false;
    }
    // 获取合并开始位置
    const mergeStart = merge.row;
    // 获取合并结束位置
    const mergeEnd = merge.row + merge.rowSpan;
    return mergeStart < touchEnd && mergeEnd > touchStart;
  });

  // 如果受影响的合并为空，则直接返回
  if (!affected.length) {
    return;
  }

  // 遍历受影响的合并
  affected.forEach((merge) => {
    // 尝试应用合并
    try {
      // 获取单元格范围
      worksheet
        .getRange(
          dataStartRow + merge.row,
          // 获取列
          merge.column,
          // 获取行跨度
          merge.rowSpan,
          merge.columnSpan,
        )
        // 拆分合并
        .breakApart?.();
    } catch {
      // ignore broken merge cleanup
    }
  });
  // 遍历受影响的合并
  affected.forEach((merge) => {
    // 应用合并
    applyMerge(worksheet, merge, dataStartRow, { preserveValue: true });
  });
};

/** 按数据区半开区间 [rangeStart, rangeEnd) 重新应用相交的纵向 merge */
export const reapplyMergesInDataRange = (
  worksheet: UniverWorksheet,
  merges: ETableMerge[],
  dataStartRow: number,
  rangeStart: number,
  rangeEnd: number,
) => {
  if (rangeEnd <= rangeStart) {
    return;
  }
  reapplyMergesForRowSpan(
    worksheet,
    merges,
    dataStartRow,
    rangeStart,
    rangeEnd - rangeStart,
  );
};

/**
 * 视口投影：将逻辑行 merge 映射到当前窗口内的物理行，并垂直居中。
 */
type ProjectedMergeRange = {
  // 行
  row: number;
  // 列
  column: number;
  // 行跨度
  rowSpan: number;
  columnSpan: number;
};


export type PlannedProjectedMerge = ProjectedMergeRange & {
  logicalRow: number;
};

const logicalMergeSignature = (merge: PlannedProjectedMerge) =>
  `${merge.logicalRow}:${merge.column}:${merge.rowSpan}:${merge.columnSpan}`;

const breakApartProjectedMergeAt = (
  worksheet: UniverWorksheet,
  dataStartRow: number,
  range: ProjectedMergeRange,
) => {
  if (range.rowSpan <= 1 && range.columnSpan <= 1) {
    return;
  }
  try {
    worksheet
      .getRange(
        dataStartRow + range.row,
        range.column,
        range.rowSpan,
        range.columnSpan,
      )
      .breakApart?.();
  } catch {
    // ignore broken merge cleanup
  }
};

/**
 * 在重绘行前解除已删除或位置变化的 merge（按逻辑锚点，避免误拆其他分组）。
 */
export const breakStaleProjectedMerges = (
  worksheet: UniverWorksheet,
  dataStartRow: number,
  previous: PlannedProjectedMerge[],
  next: PlannedProjectedMerge[],
) => {
  // 如果工作表不存在，或者没有前一个合并，则直接返回
  if (!worksheet || !previous.length) {
    return;
  }
  // 创建下一个合并的逻辑映射
  const nextByLogical = new Map(
    next.map((merge) => [logicalMergeSignature(merge), merge]),
  );
  // 遍历前一个合并
  previous.forEach((prev) => {
    // 获取下一个合并
    const nextMerge = nextByLogical.get(logicalMergeSignature(prev));
    // 如果下一个合并不存在，则拆分合并
    if (!nextMerge) {
      breakApartProjectedMergeAt(worksheet, dataStartRow, prev);
      return;
    }
    // 如果前一个合并的行、行跨度、列、列跨度与下一个合并不一致，则拆分合并
    if (
      prev.row !== nextMerge.row ||
      prev.rowSpan !== nextMerge.rowSpan ||
      prev.column !== nextMerge.column ||
      prev.columnSpan !== nextMerge.columnSpan
    ) {
      // 拆分合并
      breakApartProjectedMergeAt(worksheet, dataStartRow, prev);
    }
  });
};

/**
 * 解除逻辑上已不存在、但物理位置仍残留的 merge（按逻辑锚点比较，避免行号偏移误拆）。
 */
export const breakRemovedProjectedMerges = (
  worksheet: UniverWorksheet,
  dataStartRow: number,
  previous: PlannedProjectedMerge[],
  next: PlannedProjectedMerge[],
) => {
  // 如果工作表不存在，或者没有前一个合并，则直接返回
  if (!worksheet || !previous.length) {
    return;
  }
  // 创建下一个合并的逻辑映射
  const nextLogical = new Set(next.map(logicalMergeSignature));
  // 遍历前一个合并
  previous.forEach((range) => {
    // 如果下一个合并的逻辑映射包含当前合并，则直接返回
    if (nextLogical.has(logicalMergeSignature(range))) {
      return;
    }
    // 拆分合并
    breakApartProjectedMergeAt(worksheet, dataStartRow, range);
  });
};

/**
 * 解除视口投影区域内上一次写入的合并，避免 reproject 后残留错位 merge。
 */
export const breakApartProjectedMerges = (
  worksheet: UniverWorksheet,
  dataStartRow: number,
  ranges: ProjectedMergeRange[],
) => {
  // 如果工作表不存在，或者没有范围，则直接返回
  if (!worksheet || !ranges.length) {
    return;
  }
  // 遍历范围
  ranges.forEach((range) => {
    breakApartProjectedMergeAt(worksheet, dataStartRow, range);
  });
};

/**
 * 视口投影：将逻辑行 merge 映射到当前窗口内的物理行，并垂直居中。
 * 仅当 merge 覆盖的逻辑行在 slice 中连续出现时才应用。
 */
export const planProjectedMerges = (
  merges: ETableMerge[],
  projectedLogicalRows: number[],
): PlannedProjectedMerge[] => {
  // 如果没有合并，或者没有逻辑行，则直接返回
  if (!merges.length || !projectedLogicalRows.length) {
    return [];
  }

  // 创建逻辑到投影的映射
  const logicalToProjected = new Map<number, number>();
  // 遍历逻辑行
  projectedLogicalRows.forEach((logicalRow, projectedIndex) => {
    // 设置映射
    logicalToProjected.set(logicalRow, projectedIndex);
  });

  // 创建计划
  const planned: PlannedProjectedMerge[] = [];
  // 创建已见集合
  const seen = new Set<string>();

  // 遍历合并
  merges.forEach((merge) => {
    // 如果行跨度小于等于1，则直接返回
    if (merge.rowSpan <= 1) {
      return;
    }

    // 创建键
    const key = `${merge.row}:${merge.column}`;
    // 如果已见集合包含键，则直接返回
    if (seen.has(key)) {
      return;
    }

    // 获取投影开始位置
    const projectedStart = logicalToProjected.get(merge.row);
    // 如果投影开始位置为空，则直接返回
    if (projectedStart === undefined) {
      return;
    }

    // 获取逻辑结束位置
    const logicalEnd = merge.row + merge.rowSpan;
    // 遍历逻辑行
    for (let logicalRow = merge.row + 1; logicalRow < logicalEnd; logicalRow += 1) {
      // 获取投影
      const projected = logicalToProjected.get(logicalRow);
      // 如果投影不等于投影开始位置加上逻辑行减去合并行，则直接返回
      if (projected !== projectedStart + (logicalRow - merge.row)) {
        return;
      }
    }

    // 添加已见集合
    seen.add(key);
    // 添加计划
    planned.push({
      row: projectedStart,
      column: merge.column,
      rowSpan: merge.rowSpan,
      columnSpan: merge.columnSpan,
      logicalRow: merge.row,
    });
  });

  return planned;
};

export const applyProjectedMerges = (
  worksheet: UniverWorksheet,
  merges: ETableMerge[],
  dataStartRow: number,
  projectedLogicalRows: number[],
  previousMerges: PlannedProjectedMerge[] = [],
  options?: {
    planned?: PlannedProjectedMerge[];
    forceRebuild?: boolean;
  },
): PlannedProjectedMerge[] => {
  if (!worksheet || !merges.length || !projectedLogicalRows.length) {
    return [];
  }

  const applied: PlannedProjectedMerge[] = [];
  const planned = options?.planned ?? planProjectedMerges(merges, projectedLogicalRows);
  const forceRebuild = options?.forceRebuild ?? false;
  const mergeByKey = new Map<string, ETableMerge>();
  merges.forEach((merge) => {
    mergeByKey.set(`${merge.row}:${merge.column}`, merge);
  });
  const prevByLogical = new Map(
    previousMerges.map((merge) => [logicalMergeSignature(merge), merge]),
  );

  planned.forEach((projectedRange) => {
    const logicalKey = logicalMergeSignature(projectedRange);
    const prevMerge = prevByLogical.get(logicalKey);
    const matchesPrev =
      prevMerge &&
      prevMerge.row === projectedRange.row &&
      prevMerge.column === projectedRange.column &&
      prevMerge.rowSpan === projectedRange.rowSpan &&
      prevMerge.columnSpan === projectedRange.columnSpan;

    if (!forceRebuild && matchesPrev) {
      applied.push(projectedRange);
      return;
    }

    if (prevMerge) {
      breakApartProjectedMergeAt(worksheet, dataStartRow, prevMerge);
    }

    const sourceMerge = mergeByKey.get(
      `${projectedRange.logicalRow}:${projectedRange.column}`,
    );
    if (!sourceMerge) {
      return;
    }

    const projectedMerge: ETableMerge = {
      ...sourceMerge,
      row: projectedRange.row,
    };

    try {
      applyMerge(worksheet, projectedMerge, dataStartRow, { preserveValue: true });
      applied.push(projectedRange);
    } catch (error) {
      console.warn('[ETable] projected merge failed', { merge: projectedMerge, error });
    }
  });

  return applied;
};

const applyMerge = (
  worksheet: UniverWorksheet,
  merge: ETableMerge,
  dataStartRow: number,
  options?: { preserveValue?: boolean },
) => {
  // 参数校验
  if (merge.row < 0 || merge.column < 0 || merge.rowSpan <= 0 || merge.columnSpan <= 0) {
    return;
  }
  // 获取开始行
  const startRow = dataStartRow + merge.row;
  // 获取区域。
  const range = worksheet.getRange(startRow, merge.column, merge.rowSpan, merge.columnSpan);

  // 单个单元格无需 merge。
  if (merge.rowSpan === 1 && merge.columnSpan === 1) {
    if (merge.value !== undefined) {
      // 设置值
      range.setValue(merge.value);
    }
    return;
  }

  // 执行合并后再写入左上角，避免 merge 覆盖样式。
  try {
    // 应用合并
    range.merge();
    // 警告合并失败
  } catch (error) {
    console.warn('[ETable] custom merge failed', { merge, error });
    return;
  }

  // 获取左上角单元格
  const topLeft = worksheet.getRange(startRow, merge.column, 1, 1);

  // 如果行跨度大于1，则设置值
  if (merge.rowSpan > 1) {
    // 如果值不为空，并且不保留值，则设置值
    if (merge.value !== undefined && !options?.preserveValue) {
      // 设置值
      topLeft.setValue(toMergedCellPayload(merge.value));
    } else if (options?.preserveValue) {
      try {
        // 获取原始值
        const raw = topLeft.getValue?.() ?? topLeft.getCellData?.()?.v;
        // 获取单元格值
        const cellValue = raw !== null && typeof raw === 'object' && 'v' in raw ? (raw as { v?: unknown }).v : raw;
        // 设置值
        topLeft.setValue({
          v: cellValue ?? merge.value ?? null,
          s: {
            ...((raw !== null && typeof raw === 'object' && 's' in raw
              ? (raw as { s?: Record<string, unknown> }).s
              : {}) || {}),
            vt: VerticalAlign.MIDDLE,
          },
        });
      } catch {
        // ignore style patch after merge
      }
    }
    return;
  }

  // 如果值不为空，并且不保留值，则设置值
  if (merge.value !== undefined && !options?.preserveValue) {
    range.setValue(merge.value);
  }
};

/**
 * =========================================================
 * 列索引转换
 * =========================================================
 */

/**
 * 将 0-based 列索引转换成 Excel 风格列字母。
 *
 * 0  -> A
 * 1  -> B
 * 2  -> C
 * ...
 * 25 -> Z
 * 26 -> AA
 * 27 -> AB
 *
 * @param index 0-based 列索引
 */
export const columnIndexToLetter = (index: number): string => {
  // 非法索引直接返回空字符串。
  if (!Number.isInteger(index) || index < 0) {
    return '';
  }
  // 创建结果
  let result = '';
  // 创建当前索引
  let current = index;
  // 遍历当前索引
  while (current >= 0) {
    // 添加结果
    result = String.fromCharCode((current % 26) + 65,) + result;
    // 更新当前索引
    current = Math.floor(current / 26,) - 1;
  }
  // 返回结果
  return result;
};

/**
 * =========================================================
 * 展开叶子列
 * =========================================================
 */

/**
 * 将多级表头树展开成叶子列数组。
 *
 * ---------------------------------------------------------
 * 输入：
 *
 * [
 *   {
 *     id: 'basic',
 *     title: '基本信息',
 *     children: [
 *       {
 *         id: 'name',
 *         title: '姓名',
 *       },
 *       {
 *         id: 'age',
 *         title: '年龄',
 *       },
 *     ],
 *   },
 *
 *   {
 *     id: 'amount',
 *     title: '金额',
 *   },
 * ]
 *
 * ---------------------------------------------------------
 * 输出：
 *
 * [
 *   {
 *     id: 'name',
 *     title: '姓名',
 *   },
 *   {
 *     id: 'age',
 *     title: '年龄',
 *   },
 *   {
 *     id: 'amount',
 *     title: '金额',
 *   },
 * ]
 *
 * ---------------------------------------------------------
 * 注意：
 *
 * 只有没有 children 的节点，
 * 才是真正的数据列。
 */
export const flattenColumns = (columns: ETableColumn[] = []): ETableColumn[] => {
  if (!columns.length) {
    return [];
  }
  const result: ETableColumn[] = [];
  // 递归遍历列树。
  const walk = (items: ETableColumn[]) => {
    items.forEach((column) => {
      // 有子节点：继续向下。
      if (column.children?.length) {
        walk(column.children,);
        return;
      }
      // 没有子节点：当前节点就是叶子列。
      result.push(column);
    },
    );
  };
  walk(columns);
  return result;
};
