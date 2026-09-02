import type { RowData, VisibleNode } from './BudgetGrid';

export interface MergeConfig {
  field: keyof RowData;
  blockStart: keyof RowData;
  rowSpan: keyof RowData;
  groupBreak: (current: RowData, next: RowData) => boolean;
}

export function buildRegionRowSpanCache(regions: VisibleNode[]): Map<string, number> {
  const cache = new Map<string, number>();
  let currentLeafCount = 0;
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (r.isGroup) {
      cache.set(r.id, currentLeafCount + 1);
      currentLeafCount = 0;
    } else {
      currentLeafCount++;
    }
  }
  return cache;
}

export function buildLeafToGroupMap(regions: VisibleNode[]): Map<string, string> {
  const leafToGroup = new Map<string, string>();
  let currentGroupId: string | null = null;
  for (const r of regions) {
    if (r.isGroup) {
      currentGroupId = r.id;
    } else if (currentGroupId) {
      leafToGroup.set(r.id, currentGroupId);
    }
  }
  return leafToGroup;
}

export function computeMergeSpans(rows: RowData[], configs: MergeConfig[]): void {
  for (const { field, blockStart, rowSpan, groupBreak } of configs) {
    let i = 0;
    while (i < rows.length) {
      const currentValue = rows[i][field];
      let j = i + 1;
      while (j < rows.length && rows[j][field] === currentValue) {
        if (groupBreak(rows[i], rows[j])) {
          break;
        }
        j++;
      }
      const span = j - i;
      for (let k = i; k < j; k++) {
        (rows[k] as any)[blockStart] = k === i;
        (rows[k] as any)[rowSpan] = k === i ? span : 0;
      }
      i = j;
    }
  }
}
