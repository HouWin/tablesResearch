/**
 * 行列维 path / id map 工具（避免 cellChangeContext ↔ dimensionLocate 循环依赖）
 */
import type { ETableColumn, ETableDimensionIdMap, ETableDimensionInfo } from './types';

/** @deprecated 旧版路径拼接分隔符；新协议用 buildDimensionIdMap */
export const DIMENSION_ID_SEPARATOR = '/';

/**
 * 将维度路径转为 field→id map。
 * 例：[{ field:'organization', id:'hq' }, { field:'subject', id:'hq-summary' }]
 * → `{ organization: 'hq', subject: 'hq-summary' }`
 */
export const buildDimensionIdMap = (
  dims: Array<{ id?: string; field?: string }> | undefined,
): ETableDimensionIdMap | undefined => {
  if (!dims?.length) {
    return undefined;
  }
  const map: ETableDimensionIdMap = {};
  dims.forEach((item) => {
    const key = item.field;
    if (!key) {
      return;
    }
    const value =
      item.id !== undefined && item.id !== null && String(item.id) !== ''
        ? String(item.id)
        : key;
    map[key] = value;
  });
  return Object.keys(map).length ? map : undefined;
};

/**
 * @deprecated 旧版路径拼接；请改用 buildDimensionIdMap
 */
export const joinDimensionPathIds = (
  dims: Array<{ id?: string; field?: string }> | undefined,
  separator: string = DIMENSION_ID_SEPARATOR,
): string | undefined => {
  const map = buildDimensionIdMap(dims);
  if (!map) {
    return undefined;
  }
  return Object.values(map).join(separator);
};

/** 根据叶子列索引，解析多级表头路径（列维度）。 */
export const resolveColumnDimensionPath = (
  columns: ETableColumn[],
  targetLeafIndex: number,
): ETableDimensionInfo[] => {
  const path: ETableDimensionInfo[] = [];
  let leafCounter = 0;

  const walk = (nodes: ETableColumn[], ancestors: ETableDimensionInfo[]): boolean => {
    for (const column of nodes) {
      const node: ETableDimensionInfo = {
        field: column.dimensionField ?? column.id,
        title: column.title,
        id: column.dimensionId ?? column.id,
      };
      const nextPath = [...ancestors, node];
      if (!column.children?.length) {
        if (leafCounter === targetLeafIndex) {
          path.push(...nextPath);
          return true;
        }
        leafCounter += 1;
        continue;
      }
      if (walk(column.children, nextPath)) {
        return true;
      }
    }
    return false;
  };

  walk(columns, []);
  return path;
};
