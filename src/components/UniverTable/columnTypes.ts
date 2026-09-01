/**
 * 列类型与数据验证（columnTypes.ts）
 *
 * 根据 ETableColumn.type 为叶子列应用 Univer 能力：
 * - number：数字格式（numberFormat）
 * - select：下拉数据验证（options）
 * - date：日期格式
 *
 * 大数据场景可 skipValidation 跳过全表校验以提升初始化速度。
 */
import type { ETableColumn } from './types';

/** 按连续可编辑行分段，跳过汇总行等只读行 */
const forEachEditableRowSegment = (
  rowCount: number,
  readonlyDataRows: number[] | undefined,
  callback: (offset: number, length: number) => void,
) => {
  const readonlySet = new Set(readonlyDataRows ?? []);
  let segmentStart: number | null = null;

  const flush = (end: number) => {
    if (segmentStart === null) {
      return;
    }
    callback(segmentStart, end - segmentStart);
    segmentStart = null;
  };

  for (let row = 0; row < rowCount; row += 1) {
    if (readonlySet.has(row)) {
      flush(row);
      continue;
    }
    if (segmentStart === null) {
      segmentStart = row;
    }
  }
  flush(rowCount);
};

/**
 * 将叶子列上的 type / options 应用到工作表：
 * - number：数字格式 + 小数校验
 * - select：下拉列表数据验证
 * - date：日期格式 + 日期校验
 *
 * 汇总行 / 总计行（readonly）不挂数据验证，避免下拉、日期选择器等交互。
 */
export const applyColumnTypes = (
  univerAPI: any,
  worksheet: any,
  leafColumns: ETableColumn[],
  dataStartRow: number,
  rowCount: number,
  options?: { skipValidation?: boolean; readonlyDataRows?: number[] },
) => {
  if (!univerAPI || !worksheet || !leafColumns.length || rowCount <= 0) {
    return;
  }

  // 是否跳过校验
  const skipValidation = options?.skipValidation ?? rowCount > 5000;
  // 只读行
  const readonlyDataRows = options?.readonlyDataRows;

  // 应用校验规则
  const applyValidation = (
    columnIndex: number,
    applyRule: (range: any) => void,
  ) => {
    if (skipValidation || typeof univerAPI.newDataValidation !== 'function') {
      return;
    }

    // 遍历可编辑行段
    forEachEditableRowSegment(rowCount, readonlyDataRows, (offset, length) => {
      const range = worksheet.getRange(dataStartRow + offset, columnIndex, length, 1);
      applyRule(range);
    });
  };

  // 遍历叶子列
  leafColumns.forEach((column, columnIndex) => {
    // 列类型
    const type = column.type ?? 'text';

    // 文本类型不校验
    if (type === 'text') {
      return;
    }

    try {
      // 获取单元格范围
      const range = worksheet.getRange(dataStartRow, columnIndex, rowCount, 1);

      // 数字类型校验
      if (type === 'number') {
        const pattern = column.numberFormat || '0.00';
        try {
          // 设置单元格数字格式
          range.setNumberFormat?.(pattern);
        } catch {
          // 忽略格式失败
        }

        // 单元格数字校验
        applyValidation(columnIndex, (editableRange) => {
          const builder = univerAPI.newDataValidation();
          if (typeof builder.requireNumberBetween === 'function') {
            const rule = builder
              .requireNumberBetween(-1e15, 1e15)
              .setOptions({
                allowBlank: true,
                showErrorMessage: true,
                error: '请输入数字',
              })
              .build();
            editableRange.setDataValidation?.(rule);
          }
        });
        return;
      }

      if (type === 'date') {
        const pattern = column.numberFormat || 'yyyy-mm-dd';
        try {
          // 设置单元格日期格式
          range.setNumberFormat?.(pattern);
        } catch {
          // 忽略格式失败
        }

        // 单元格日期校验
        applyValidation(columnIndex, (editableRange) => {
          // 创建日期校验规则
          const builder = univerAPI.newDataValidation();
          if (typeof builder.requireDateBetween === 'function') {
            // 设置日期范围
            // 设置日期校验规则
            const rule = builder
              .requireDateBetween(new Date('1900-01-01'), new Date('2100-12-31'))
              .setOptions({
                allowBlank: true,
                showErrorMessage: true,
                error: '请输入有效日期',
              })
              .build();
            editableRange.setDataValidation?.(rule);
          }
        });
        return;
      }

      // 单元格下拉校验
      if (type === 'select' && column.options?.length) {
        applyValidation(columnIndex, (editableRange) => {
          // 创建下拉校验规则
          const rule = univerAPI
            .newDataValidation()
            .requireValueInList(column.options, false, true)
            .setOptions({
              allowBlank: true,
              showErrorMessage: true,
              error: '请从下拉列表中选择',
            })
            .build();
          editableRange.setDataValidation?.(rule);
        });
      }
    } catch (error) {
      console.warn('[ETable] apply column type failed', column.id, error);
    }
  });
};
