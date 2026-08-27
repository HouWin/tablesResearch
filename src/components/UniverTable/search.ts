/**
 * 打开 Univer 查找对话框（快速搜索）。
 */
export const openQuickSearch = (univerAPI: any): boolean => {
  if (!univerAPI) {
    return false;
  }
  const commands = [
    'ui.operation.open-find-dialog',
    'ui.command.open-find-dialog',
    'find-replace.operation.open-find-dialog',
  ];
  for (const id of commands) {
    try {
      if (univerAPI.executeCommand?.(id)) {
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
};

const readDisplay = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    const obj = value as { v?: unknown; value?: unknown };
    return String(obj.v ?? obj.value ?? '');
  }
  return String(value);
};

/**
 * 用 TextFinder 或全表扫描搜索关键字，并选中第一个匹配。
 */
export const searchAndSelect = async (
  univerAPI: any,
  keyword: string,
): Promise<{ count: number; cell?: string }> => {
  const text = String(keyword || '').trim();
  if (!univerAPI || !text) {
    return { count: 0 };
  }

  try {
    if (typeof univerAPI.createTextFinderAsync === 'function') {
      const finder = await univerAPI.createTextFinderAsync(text);
      await finder.matchCaseAsync?.(false);
      await finder.matchEntireCellAsync?.(false);
      await finder.ensureCompleteAsync?.();
      const all = finder.findAll?.() || [];
      const first = all[0] || finder.findNext?.();
      if (first?.activate) {
        first.activate();
      }
      return {
        count: all.length || (first ? 1 : 0),
        cell: first?.getA1Notation?.(),
      };
    }
  } catch (error) {
    console.warn('[ETable] text finder failed, fallback to scan', error);
  }

  try {
    const worksheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
    if (!worksheet) {
      return { count: 0 };
    }
    const rowCount = worksheet.getMaxRows?.() ?? 200;
    const colCount = worksheet.getMaxColumns?.() ?? 20;
    const needle = text.toLowerCase();
    const hits: Array<{ row: number; column: number }> = [];
    const scanRows = Math.min(rowCount, 5000);
    const values = worksheet.getRange(0, 0, scanRows, colCount).getValues?.() || [];
    values.forEach((row: unknown[], r: number) => {
      row.forEach((cell, c) => {
        if (readDisplay(cell).toLowerCase().includes(needle)) {
          hits.push({ row: r, column: c });
        }
      });
    });
    if (!hits.length) {
      return { count: 0 };
    }
    const first = hits[0];
    worksheet.getRange(first.row, first.column)?.activate?.();
    return {
      count: hits.length,
      cell: worksheet.getRange(first.row, first.column)?.getA1Notation?.(),
    };
  } catch (error) {
    console.warn('[ETable] scan search failed', error);
    return { count: 0 };
  }
};
