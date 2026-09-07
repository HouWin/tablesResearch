import assert from 'node:assert/strict';
import test from 'node:test';
import {
  visibleBudgetColumns,
  visibleRange,
} from '../../src/pages/TanStackBudget/core/selection';

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
