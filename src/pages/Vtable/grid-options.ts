import type { data, ListTableConstructorOptions } from '@visactor/vtable';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';
import {
  createColumns,
  organizationLabel,
  HEADER_ROWS,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
  type OrganizationBlock,
} from './grid-model';
import { GRID_FONT_FAMILY, GRID_FONT_SIZE } from './column-sizing';

/** Declarative renderer configuration; no event listeners or React state. */
export function createTableOptions({
  source,
  getController,
  widths,
  getBlock,
}: {
  source: data.CachedDataSource;
  getController: () => BudgetController;
  widths: ReadonlyMap<number, number>;
  getBlock: (index: number) => OrganizationBlock | undefined;
}): ListTableConstructorOptions {
  return {
    columns: createColumns(getController, widths, getBlock),
    dataSource: source,
    widthMode: 'standard',
    heightMode: 'standard',
    defaultRowHeight: ROW_HEIGHT,
    defaultHeaderRowHeight: HEADER_HEIGHT,
    frozenColCount: 4,
    frozenRowCount: HEADER_ROWS,
    autoWrapText: false,
    rowSeriesNumber: {
      width: ROW_NUMBER_WIDTH,
      title: '#',
      format: (_col, row) => (row ?? HEADER_ROWS) - HEADER_ROWS + 1,
      style: {
        color: '#8b9daa',
        fontSize: 11,
        textAlign: 'center',
        padding: [0, 4],
        bgColor: '#f7f9fc',
      },
      headerStyle: { bgColor: '#e4eef7' },
    },
    customMergeCell: (col, row) => {
      if (col !== 1 || row < HEADER_ROWS) return;
      const block = getBlock(row - HEADER_ROWS);
      if (!block || block.productRowSpan <= 1) return;
      return {
        text: organizationLabel(block),
        range: {
          start: { col, row: block.blockStart + HEADER_ROWS },
          end: {
            col,
            row: block.blockStart + block.productRowSpan - 1 + HEADER_ROWS,
          },
        },
        style: {
          bgColor: '#f7fafc',
          color: '#344f62',
          fontWeight: 600,
          textAlign: 'left',
          textBaseline: 'middle',
          textStick: 'vertical',
          textStickBaseOnAlign: true,
          padding: [0, 12, 0, 12 + block.productDepth * 14],
          cursor: block.productIsGroup ? 'pointer' : 'default',
        },
      };
    },
    select: {
      disableHeaderSelect: true,
      highlightMode: 'cell',
      // Controller navigation handles scrolling. Selecting a huge range must
      // not render both endpoints and restore the viewport on every update.
      makeSelectCellVisible: false,
    },
    keyboardOptions: {
      copySelected: false,
      cutSelected: false,
      pasteValueToCell: false,
      selectAllOnCtrlA: false,
      moveFocusCellOnTab: false,
      moveFocusCellOnEnter: false,
      moveSelectedCellOnArrowKeys: false,
      editCellOnEnter: false,
    },
    eventOptions: {
      preventDefaultContextMenu: true,
      contextmenuReturnAllSelectedCells: false,
    },
    resize: {
      columnResizeMode: 'header',
      rowResizeMode: 'all',
      disableDblclickAutoResizeColWidth: true,
    },
    dragOrder: { dragHeaderMode: 'none' },
    theme: {
      defaultStyle: {
        fontFamily: GRID_FONT_FAMILY,
      },
      bodyStyle: {
        fontSize: GRID_FONT_SIZE,
        borderColor: '#e6edf2',
        borderLineWidth: 1,
      },
      headerStyle: {
        fontSize: GRID_FONT_SIZE,
        borderColor: '#d9e4ec',
        borderLineWidth: 1,
      },
      selectionStyle: {
        cellBgColor: 'rgba(41,147,158,0.10)',
        cellBorderColor: '#268a94',
        cellBorderLineWidth: 2,
      },
      underlayBackgroundColor: '#fff',
      scrollStyle: {
        visible: 'scrolling',
        width: 10,
        barToSide: true,
        scrollSliderColor: '#b6c7d3',
        scrollRailColor: '#f3f6f9',
      },
      frameStyle: { borderLineWidth: 0 },
    },
  };
}
