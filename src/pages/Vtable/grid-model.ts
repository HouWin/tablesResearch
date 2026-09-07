import type { ColumnsDefine, TYPES } from '@visactor/vtable';
import {
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  type BusinessColumnNode,
} from '../SpreadJSDemo/spreadsheet/model';
import {
  cellKey,
  formattedValue,
  rawValue,
} from '../TanStackBudget/core/columns';
import type { BudgetRow, CellPosition } from '../TanStackBudget/core/types';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';

export const HEADER_ROWS = 4;
export const HEADER_HEIGHT = 28;
export const ROW_HEIGHT = 32;
export const ROW_NUMBER_WIDTH = 48;

/** VTable includes the header and row-number cells in its addresses. */
export function toTableCell(position: CellPosition, visible: number[]) {
  return {
    row: position.row + HEADER_ROWS,
    col: visible.indexOf(position.col) + 1,
  };
}
export function toBusinessPosition(
  col: number,
  row: number,
  visible: number[],
  total: number,
): CellPosition | null {
  if (
    row < HEADER_ROWS ||
    row >= total + HEADER_ROWS ||
    col < 1 ||
    col > visible.length
  )
    return null;
  return { row: row - HEADER_ROWS, col: visible[col - 1] };
}

export type OrganizationBlock = Pick<
  BudgetRow,
  | 'blockStart'
  | 'productRowSpan'
  | 'productLabel'
  | 'productDepth'
  | 'productExpanded'
  | 'productIsGroup'
  | 'productId'
  | 'productAncestorIds'
>;

export function organizationLabel(block: OrganizationBlock) {
  return `${
    block.productIsGroup ? (block.productExpanded ? '▾  ' : '▸  ') : ''
  }${block.productLabel}`;
}

export function createColumns(
  getController: () => BudgetController,
  widths: ReadonlyMap<number, number>,
  getBlock: (index: number) => OrganizationBlock | undefined,
): ColumnsDefine {
  const visible = new Set(getController().visibleColumns);
  const icons = (
    row: BudgetRow | undefined,
    col: number,
    index: number,
  ): TYPES.ColumnIconOption[] => {
    const c = getController();
    const block = col === 0 ? getBlock(index) : undefined;
    const key = row
      ? cellKey(row, col)
      : block
      ? `${block.productId}/${COLUMNS[col].id}`
      : '';
    if (!key) return [];
    const values: TYPES.ColumnIconOption[] = [];
    if (c.comments.has(key))
      values.push({
        type: 'svg',
        name: 'budget-comment',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 2h10v8H7l-4 3V2Z" fill="#bd7f21"/></svg>',
        funcType: 'budget-comment',
        positionType: 'right' as TYPES.IconPosition,
        width: 12,
        height: 12,
        marginLeft: 3,
        cursor: 'pointer',
        tooltip: { title: c.comments.get(key)! },
      });
    const files = c.attachments.get(key);
    if (files?.length)
      values.push({
        type: 'svg',
        name: 'budget-attachment',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="m6 5 4-3c3-2 5 2 3 4l-6 7c-3 3-7-1-5-4l6-6m2 2-5 5" fill="none" stroke="#7353ba" stroke-width="1.6" stroke-linecap="round"/></svg>',
        funcType: 'budget-attachment',
        positionType: 'right' as TYPES.IconPosition,
        width: 14,
        height: 14,
        marginLeft: 3,
        cursor: 'pointer',
        tooltip: { title: `${files.length} 个附件，点击管理` },
      });
    if (row?.formulas[COLUMNS[col].id])
      values.push({
        type: 'text',
        name: 'budget-formula',
        content: 'ƒ',
        positionType: 'right' as TYPES.IconPosition,
        width: 14,
        height: 18,
        style: { fill: '#00848b', fontSize: 13 },
        tooltip: { title: row.formulas[COLUMNS[col].id] },
      });
    return values;
  };
  const visit = (nodes: readonly BusinessColumnNode[]): ColumnsDefine =>
    nodes.flatMap((node): ColumnsDefine => {
      if (node.type === 'colDim') {
        const children = visit(node.children);
        if (!children.length) return [];
        return [
          {
            title: node.collapsible
              ? `${getController().collapsedColumns ? '▸' : '▾'}  ${node.label}`
              : node.label,
            columns: children,
            headerStyle: {
              bgColor:
                node.dimension.code === 'DIM0068' ? '#eff3f9' : '#e4eef7',
              color: '#35566f',
              fontWeight: 600,
              textAlign: 'left',
              padding: [0, 16],
              textStick: 'horizontal',
              cursor: node.collapsible ? 'pointer' : 'default',
            },
          },
        ];
      }
      const col = COLUMNS.findIndex((column) => column.id === node.id);
      if (!visible.has(col)) return [];
      return [
        {
          field: node.field,
          key: node.id,
          title: node.label,
          width: widths.get(col) ?? node.width,
          minWidth: 76,
          maxWidth: 520,
          fieldFormat: (record: BudgetRow | undefined) => {
            if (!record) return '…';
            if (col === 0) return organizationLabel(record);
            if (col === 1)
              return `${
                record.regionIsGroup
                  ? record.regionExpanded
                    ? '▾  '
                    : '▸  '
                  : ''
              }${record.regionLabel}`;
            return formattedValue(rawValue(record, col), node);
          },
          style: ({ row }) => {
            const record = getController().data.rowAt(row - HEADER_ROWS);
            const summary = record?.regionDepth === 0;
            return {
              textAlign: col >= 3 ? 'right' : 'left',
              textBaseline: 'middle',
              bgColor:
                col === 0
                  ? '#f7fafc'
                  : summary
                  ? '#f0f6fa'
                  : col === 3
                  ? '#f7fbfc'
                  : '#ffffff',
              color: record ? (col >= 3 ? '#294957' : '#344f62') : '#a6b4c0',
              fontWeight: summary || col === 0 ? 600 : 400,
              padding: [
                0,
                12,
                0,
                12 +
                  (col === 0
                    ? record?.productDepth ?? 0
                    : col === 1
                    ? record?.regionDepth ?? 0
                    : 0) *
                    14,
              ],
              textStick: col === 0 ? 'vertical' : false,
              cursor:
                col < 2 &&
                (col === 0 ? record?.productIsGroup : record?.regionIsGroup)
                  ? 'pointer'
                  : 'default',
            };
          },
          icon: ({ row }) => {
            const record = getController().data.rowAt(row - HEADER_ROWS);
            return icons(record, col, row - HEADER_ROWS);
          },
          headerStyle: {
            bgColor: '#f0f4f8',
            color: '#476179',
            textAlign: 'center',
            fontWeight: 600,
          },
        },
      ];
    });
  return visit(BUSINESS_COLUMN_DATA);
}
