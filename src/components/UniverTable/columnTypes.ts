import type { ETableColumn } from './types';

/**
 * 将叶子列上的 type / options 应用到工作表：
 * - number：数字格式 + 小数校验
 * - select：下拉列表数据验证
 * - date：日期格式 + 日期校验
 */
export const applyColumnTypes = (
  univerAPI: any,
  worksheet: any,
  leafColumns: ETableColumn[],
  dataStartRow: number,
  rowCount: number,
) => {
  if (!univerAPI || !worksheet || !leafColumns.length || rowCount <= 0) {
    return;
  }

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
        if (typeof univerAPI.newDataValidation === 'function') {
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
            range.setDataValidation?.(rule);
          }
        }
        return;
      }

      if (type === 'date') {
        const pattern = column.numberFormat || 'yyyy-mm-dd';
        try {
          range.setNumberFormat?.(pattern);
        } catch {
          // ignore format failure
        }
        if (typeof univerAPI.newDataValidation === 'function') {
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
            range.setDataValidation?.(rule);
          }
        }
        return;
      }

      if (type === 'select' && column.options?.length) {
        if (typeof univerAPI.newDataValidation !== 'function') {
          console.warn('[ETable] data validation preset missing, skip select column');
          return;
        }
        const rule = univerAPI
          .newDataValidation()
          .requireValueInList(column.options, false, true)
          .setOptions({
            allowBlank: true,
            showErrorMessage: true,
            error: '请从下拉列表中选择',
          })
          .build();
        range.setDataValidation?.(rule);
      }
    } catch (error) {
      console.warn('[ETable] apply column type failed', column.id, error);
    }
  });
};
