import { VerticalAlign } from '@univerjs/core';
import { buildHeaderLayout } from './layout';
import type { ETableCell, ETableColumn, ETableMerge, ETableRow } from './types';

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
  if (!worksheet) {
    return;
  }
  const needRows = Math.max(1, Math.ceil(rowCount));
  const needCols = Math.max(1, Math.ceil(columnCount));
  try {
    const maxRows = typeof worksheet.getMaxRows === 'function'
      ? worksheet.getMaxRows()
      : 1000;
    if (needRows > maxRows) {
      worksheet.setRowCount(needRows);
    }
  } catch (error) {
    console.warn('[ETable] setRowCount failed', error);
  }
  try {
    const maxCols = typeof worksheet.getMaxColumns === 'function'
      ? worksheet.getMaxColumns()
      : 20;
    if (needCols > maxCols) {
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
    // 写入标题。
    range.setValue(item.title);

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
  options?: { virtualScroll?: boolean; chunkSize?: number; skipWrite?: boolean },
): number => {
  if (!worksheet || !rows.length || !leafColumns.length) {
    return 0;
  }

  if (startRow < 0) {
    return 0;
  }

  // 视口懒加载模式：骨架已扩容，数据由 virtualRender 按页写入
  if (options?.skipWrite) {
    return 0;
  }

  const virtualScroll = options?.virtualScroll !== false;
  const chunkSize = resolveDataChunkSize(rows.length, options?.chunkSize);

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const limit = Math.min(chunkSize, rows.length - offset);
    const values = buildRowValues(rows, leafColumns, { offset, limit });
    worksheet
      .getRange(startRow + offset, 0, values.length, leafColumns.length)
      .setValues(values);
  }

  rows.forEach((row, index) => {
    if (typeof row.height === 'number') {
      worksheet.setRowHeight(startRow + index, row.height);
    }
  });
};

const buildRowValues = (
  rows: ETableRow[],
  leafColumns: ETableColumn[],
  options?: { skipRowBackgrounds?: boolean; offset?: number; limit?: number },
) => {
  const skipRowBackgrounds = options?.skipRowBackgrounds ?? false;
  const offset = options?.offset ?? 0;
  const end = options?.limit !== undefined ? offset + options.limit : rows.length;
  const rowCount = end - offset;
  const colCount = leafColumns.length;

  if (rowCount <= 0 || !colCount) {
    return [];
  }

  const colIds = new Array<string>(colCount);
  for (let c = 0; c < colCount; c += 1) {
    colIds[c] = leafColumns[c].id;
  }

  if (skipRowBackgrounds) {
    const matrix = new Array(rowCount);
    for (let r = 0; r < rowCount; r += 1) {
      const row = rows[offset + r];
      const data = row.data;
      const out = new Array(colCount);
      for (let c = 0; c < colCount; c += 1) {
        const cell = data?.[colIds[c]];
        if (cell !== null && typeof cell === 'object') {
          const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
          if (styledCell.style) {
            out[c] = {
              v: styledCell.value ?? null,
              s: styledCell.style,
            };
          } else {
            out[c] = styledCell.value ?? null;
          }
        } else {
          out[c] = cell ?? null;
        }
      }
      matrix[r] = out;
    }
    return matrix;
  }

  const toRowValues = (row: ETableRow) => {
    const bgStyle =
      row.style?.bg
        ? {
            bg: {
              rgb: row.style.bg.startsWith('#') ? row.style.bg : `#${row.style.bg}`,
            },
          }
        : null;

    const out = new Array(colCount);
    for (let c = 0; c < colCount; c += 1) {
      const cell = row.data?.[colIds[c]];
      if (cell !== null && typeof cell === 'object') {
        const styledCell = cell as { value?: unknown; style?: Record<string, unknown> };
        if (styledCell.style || bgStyle) {
          out[c] = {
            v: styledCell.value ?? null,
            s: {
              ...(bgStyle || {}),
              ...(styledCell.style || {}),
              bg: (styledCell.style as any)?.bg || bgStyle?.bg,
            },
          };
        } else {
          out[c] = styledCell.value ?? null;
        }
      } else if (bgStyle) {
        out[c] = {
          v: cell ?? null,
          s: bgStyle,
        };
      } else {
        out[c] = cell ?? null;
      }
    }
    return out;
  };

  const matrix = new Array(rowCount);
  for (let r = 0; r < rowCount; r += 1) {
    matrix[r] = toRowValues(rows[offset + r]);
  }
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
  },
): Promise<void> => {
  if (!worksheet || !rows.length || !leafColumns.length || startRow < 0) {
    return;
  }

  const virtualScroll = options?.virtualScroll !== false;
  const chunkSize = resolveDataChunkSize(rows.length, options?.chunkSize);
  const valueOptions = {
    skipRowBackgrounds: options?.skipRowBackgrounds ?? rows.length > 2000,
  };
  const yieldBetweenChunks = rows.length > 2000;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const limit = Math.min(chunkSize, rows.length - offset);
    const values = buildRowValues(rows, leafColumns, {
      ...valueOptions,
      offset,
      limit,
    });
    worksheet
      .getRange(startRow + offset, 0, values.length, leafColumns.length)
      .setValues(values);

    if (yieldBetweenChunks && offset + limit < rows.length) {
      await yieldToMain();
    }
  }

  const hasCustomHeights = rows.some((row) => typeof row.height === 'number');
  if (!hasCustomHeights && rows.length > 0) {
    try {
      worksheet.setRowHeights(startRow, rows.length, 30);
    } catch {
      // ignore batch height failure
    }
    return;
  }

  rows.forEach((row, index) => {
    if (typeof row.height === 'number') {
      worksheet.setRowHeight(startRow + index, row.height);
    }
  });

  return rows.length;
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

  leafColumns.forEach((column, index) => {
    const width = typeof column.width === 'number' ? column.width : defaultWidth;
    // 防止非法列宽。
    if (width <= 0) {
      return;
    }
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
  if (!worksheet || count <= 0 || height <= 0) {
    return;
  }
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
  if (value !== null && typeof value === 'object' && 'value' in value) {
    const cell = value as ETableCell;
    return {
      v: cell.value ?? null,
      s: {
        ...(cell.style || {}),
        vt: VerticalAlign.MIDDLE,
      },
    };
  }
  return {
    v: value ?? null,
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
  if (!worksheet || !merges.length) {
    return;
  }

  merges.forEach((merge) => {
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
  if (!worksheet || !merges.length) {
    return;
  }

  const batchSize = Math.max(50, options?.batchSize ?? (merges.length > 5000 ? 400 : 200));
  for (let offset = 0; offset < merges.length; offset += batchSize) {
    const batch = merges.slice(offset, offset + batchSize);
    batch.forEach((merge) => {
      applyMerge(worksheet, merge, dataStartRow);
    });
    if (offset + batchSize < merges.length) {
      await yieldToMain();
    }
  }
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
  if (!worksheet || !merges.length || rowSpan <= 1) {
    return;
  }

  const touchStart = anchorRow;
  const touchEnd = anchorRow + rowSpan;
  const affected = merges.filter((merge) => {
    if (merge.rowSpan <= 1) {
      return false;
    }
    const mergeStart = merge.row;
    const mergeEnd = merge.row + merge.rowSpan;
    return mergeStart < touchEnd && mergeEnd > touchStart;
  });

  if (!affected.length) {
    return;
  }

  affected.forEach((merge) => {
    try {
      worksheet
        .getRange(
          dataStartRow + merge.row,
          merge.column,
          merge.rowSpan,
          merge.columnSpan,
        )
        .breakApart?.();
    } catch {
      // ignore broken merge cleanup
    }
  });

  affected.forEach((merge) => {
    applyMerge(worksheet, merge, dataStartRow, { preserveValue: true });
  });
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
  const startRow = dataStartRow + merge.row;
  // 获取区域。
  const range = worksheet.getRange(startRow, merge.column, merge.rowSpan, merge.columnSpan);

  // 单个单元格无需 merge。
  if (merge.rowSpan === 1 && merge.columnSpan === 1) {
    if (merge.value !== undefined) {
      range.setValue(merge.value);
    }
    return;
  }

  // 执行合并后再写入左上角，避免 merge 覆盖样式。
  try {
    range.merge();
  } catch (error) {
    console.warn('[ETable] custom merge failed', { merge, error });
    return;
  }

  if (merge.value !== undefined && !options?.preserveValue) {
    const topLeft = worksheet.getRange(startRow, merge.column, 1, 1);
    topLeft.setValue(
      merge.rowSpan > 1 ? toMergedCellPayload(merge.value) : merge.value,
    );
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
  let result = '';
  let current = index;
  while (current >= 0) {
    result = String.fromCharCode((current % 26) + 65,) + result;
    current = Math.floor(current / 26,) - 1;
  }

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
