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

  const skipValidation = options?.skipValidation ?? rowCount > 5000;
  const readonlyDataRows = options?.readonlyDataRows;

  const applyValidation = (
    columnIndex: number,
    applyRule: (range: any) => void,
  ) => {
    if (skipValidation || typeof univerAPI.newDataValidation !== 'function') {
      return;
    }
    forEachEditableRowSegment(rowCount, readonlyDataRows, (offset, length) => {
      const range = worksheet.getRange(dataStartRow + offset, columnIndex, length, 1);
      applyRule(range);
    });
  };

  leafColumns.forEach((column, columnIndex) => {
    const type = column.type ?? 'text';
    if (type === 'text') {
      return;
    }

    try {
      const range = worksheet.getRange(dataStartRow, columnIndex, rowCount, 1);

      if (type === 'number') {
        const pattern = column.numberFormat || '0.00';
        try {
          range.setNumberFormat?.(pattern);
        } catch {
          // ignore format failure
        }
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
          range.setNumberFormat?.(pattern);
        } catch {
          // ignore format failure
        }
        applyValidation(columnIndex, (editableRange) => {
          const builder = univerAPI.newDataValidation();
          if (typeof builder.requireDateBetween === 'function') {
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

      if (type === 'select' && column.options?.length) {
        applyValidation(columnIndex, (editableRange) => {
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
