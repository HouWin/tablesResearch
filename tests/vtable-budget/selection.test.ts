import assert from 'node:assert/strict';
import test from 'node:test';
import {
  visibleBudgetColumns,
  visibleRange,
} from '../../src/pages/TanStackBudget/core/selection';
import type { OrganizationBlock } from '../../src/pages/Vtable/grid-model';
import {
  organizationPosition,
  organizationSelection,
} from '../../src/pages/Vtable/grid-selection';

const block = (start: number, span: number): OrganizationBlock => ({
  blockStart: start,
  productRowSpan: span,
  productId: `org-${start}`,
  productLabel: '组织',
  productDepth: 0,
  productExpanded: true,
  productIsGroup: true,
  productAncestorIds: [],
});

test('合并组织单击保留完整范围和起始地址，重复同步不改变选区', () => {
  const getBlock = () => block(4, 4);
  const point = { row: 6, col: 0 };
  assert.deepEqual(organizationPosition(point, getBlock), { row: 4, col: 0 });
  const result = organizationSelection(
    { anchor: point, focus: point },
    getBlock,
  );
  assert.deepEqual(result, {
    anchor: { row: 7, col: 0 },
    focus: { row: 4, col: 0 },
  });
  assert.deepEqual(organizationSelection(result, getBlock), result);
});

test('跨组织反向矩形只扩展边界合并；金额选区不受影响', () => {
  const getBlock = (row: number) => block(Math.floor(row / 4) * 4, 4);
  assert.deepEqual(
    organizationSelection(
      { anchor: { row: 6, col: 3 }, focus: { row: 2, col: 0 } },
      getBlock,
    ),
    { anchor: { row: 7, col: 3 }, focus: { row: 0, col: 0 } },
  );
  const amounts = { anchor: { row: 6, col: 3 }, focus: { row: 2, col: 5 } };
  assert.equal(organizationSelection(amounts, getBlock), amounts);
});

test('十万行合并选区仅查询两端元数据，不逐行读取数据', () => {
  let reads = 0;
  const result = organizationSelection(
    { anchor: { row: 50500, col: 0 }, focus: { row: 50500, col: 0 } },
    () => {
      reads++;
      return block(0, 101100);
    },
  );
  assert.equal(reads, 2);
  assert.deepEqual(result, {
    anchor: { row: 101099, col: 0 },
    focus: { row: 0, col: 0 },
  });
});

test('折叠月份修正反向选区的两个端点并保留行坐标', () => {
  assert.deepEqual(
    visibleRange(
      { anchor: { row: 4, col: 8 }, focus: { row: 1, col: 3 } },
      [0, 1, 2, 3],
    ),
    {
      anchor: { row: 4, col: 3 },
      focus: { row: 1, col: 3 },
    },
  );
});

test('全年合计隐藏后折叠不会选中隐藏列，重新展开保留用户显隐设置', () => {
  const hidden = new Set([3, 7]);
  const columns = visibleBudgetColumns(hidden, true);
  assert.deepEqual(columns, [0, 1, 2]);
  assert.deepEqual(
    visibleRange(
      { anchor: { row: 1, col: 4 }, focus: { row: 1, col: 3 } },
      columns,
    ),
    {
      anchor: { row: 1, col: 2 },
      focus: { row: 1, col: 2 },
    },
  );
  assert.deepEqual(
    visibleBudgetColumns(hidden, false),
    [0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15],
  );
});
