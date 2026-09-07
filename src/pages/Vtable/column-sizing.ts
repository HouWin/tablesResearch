import {
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  type BusinessColumnNode,
} from '../SpreadJSDemo/spreadsheet/model';
import type { ColumnSizeSample } from '../TanStackBudget/core/types';

export const GRID_FONT_FAMILY =
  'Arial, PingFang SC, Microsoft YaHei, sans-serif';
export const GRID_FONT_SIZE = 12;
export const MIN_COLUMN_WIDTH = 76;

/** Uses the same font, padding and outline offsets as the Canvas cells. */
export function contentWidth(
  ctx: CanvasRenderingContext2D,
  sample: ColumnSizeSample,
  icons = 0,
) {
  ctx.font = `${
    sample.bold ? 600 : 400
  } ${GRID_FONT_SIZE}px ${GRID_FONT_FAMILY}`;
  const text = Math.max(
    0,
    ...sample.text.split(/\r\n?|\n/).map((line) => ctx.measureText(line).width),
  );
  return Math.ceil(
    text + 24 + sample.indent * 14 + (sample.formula ? 14 : 0) + icons + 2,
  );
}

/** Parent headers span their children; do not repeat the entire header path in each leaf. */
export function fitHeaders(
  ctx: CanvasRenderingContext2D,
  widths: Map<number, number>,
  visible: number[],
  currentWidth: (col: number) => number,
  collapsed: boolean,
) {
  const visibleSet = new Set(visible);
  const visit = (node: BusinessColumnNode): number[] => {
    const columns =
      node.type === 'colDim'
        ? node.children.flatMap(visit)
        : [COLUMNS.findIndex((column) => column.id === node.id)].filter((col) =>
            visibleSet.has(col),
          );
    const targets = columns.filter((col) => widths.has(col));
    if (!targets.length) return columns;
    ctx.font = `600 ${GRID_FONT_SIZE}px ${GRID_FONT_FAMILY}`;
    const title =
      node.type === 'colDim' && node.collapsible
        ? `${collapsed ? '▸' : '◂'}  ${node.label}`
        : node.label;
    const needed = Math.ceil(
      ctx.measureText(title).width + (node.type === 'colDim' ? 32 : 24) + 2,
    );
    const available = columns.reduce(
      (sum, col) => sum + (widths.get(col) ?? currentWidth(col)),
      0,
    );
    if (needed > available) {
      const extra = Math.ceil((needed - available) / targets.length);
      targets.forEach((col) => widths.set(col, widths.get(col)! + extra));
    }
    return columns;
  };
  BUSINESS_COLUMN_DATA.forEach(visit);
}
