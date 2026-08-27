/**
 * 禁止编辑指定区域（表头、树形维度列等）。
 *
 * 通过 BeforeSheetEditStart 取消进入编辑，不影响程序化 setValue（折叠图标切换仍可用）。
 */
export const setupReadonlyCells = (
  univerAPI: any,
  options: {
    /** 表头占用行数（从 0 起） */
    headerRowCount: number;
    /** 不可编辑的列索引（0-based） */
    readonlyColumns: number[];
    /** 数据总行数（含表头）；用于判断是否在表内 */
    totalRows?: number;
    totalColumns?: number;
  },
): (() => void) => {
  if (!univerAPI) {
    return () => {};
  }

  const readonlyColSet = new Set(options.readonlyColumns);
  const headerRowCount = Math.max(0, options.headerRowCount);

  const isReadonly = (row: number, column: number) => {
    if (row < 0 || column < 0) {
      return false;
    }
    if (row < headerRowCount) {
      return true;
    }
    return readonlyColSet.has(column);
  };

  let disposable: { dispose?: () => void } | null = null;
  try {
    disposable = univerAPI.addEvent(
      univerAPI.Event.BeforeSheetEditStart,
      (params: { row?: number; column?: number; cancel?: boolean }) => {
        const row = params?.row;
        const column = params?.column;
        if (typeof row !== 'number' || typeof column !== 'number') {
          return;
        }
        if (isReadonly(row, column)) {
          params.cancel = true;
        }
      },
    );
  } catch (error) {
    console.warn('[ETable] bind readonly cells failed', error);
  }

  return () => {
    try {
      disposable?.dispose?.();
    } catch {
      // ignore
    }
  };
};
