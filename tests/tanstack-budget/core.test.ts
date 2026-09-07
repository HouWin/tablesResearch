import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetService } from '../../server/budget-service';
import {
  BUSINESS_DATA,
  BUSINESS_COLUMN_DATA,
  COLUMNS,
  createBusinessProjectionRows,
  INITIAL_PRODUCT_EXPANDED,
  createInitialRegionExpansion,
  getBusinessColumnDimension,
} from '../../src/pages/SpreadJSDemo/spreadsheet/model';
import { initialQuery } from '../../src/pages/TanStackBudget/core/use-budget-data';
import {
  parseTsv,
  shiftFormula,
} from '../../src/pages/TanStackBudget/core/clipboard';
import type { BudgetQuery } from '../../src/pages/TanStackBudget/core/types';

const expanded = (mode: BudgetQuery['mode'] = 'regular'): BudgetQuery => ({
  mode,
  organizations: { all: true, ids: [] },
  subjects: { all: true, ids: [] },
  drillPath: [],
});
test('原始数据和列结构不变，默认投影及完整投影与业务模型一致', () => {
  const before = JSON.stringify({ BUSINESS_DATA, BUSINESS_COLUMN_DATA });
  const service = new BudgetService();
  const manifest = service.project(initialQuery('regular'));
  const page = service.page(manifest.id, 0);
  const expected = createBusinessProjectionRows(
    [],
    new Set(INITIAL_PRODUCT_EXPANDED),
    createInitialRegionExpansion(),
  );
  assert.equal(page.rows.length, expected.length);
  assert.deepEqual(
    page.rows.map((row) => [
      row.rowDimension,
      row.january,
      row.functionalAttribute,
    ]),
    expected.map((row) => [
      row.rowDimension,
      row.january,
      row.functionalAttribute,
    ]),
  );
  assert.equal(service.project(expanded()).totalRows, 36);
  assert.equal(COLUMNS.length, 16);
  service.write(
    manifest.id,
    [{ recordId: page.rows[0].sourceNodes[0].id, col: 4, input: 99 }],
    '编辑',
  );
  assert.equal(JSON.stringify({ BUSINESS_DATA, BUSINESS_COLUMN_DATA }), before);
});
test('10 万条明细按需分页、尾页和独立组织汇总正确', () => {
  const service = new BudgetService();
  const manifest = service.project(expanded('stress'));
  assert.equal(manifest.totalRows, 101100);
  assert.equal(manifest.detailCount, 100000);
  assert.equal(manifest.summaryCount, 1100);
  const first = service.page(manifest.id, 0);
  const tail = service.page(manifest.id, 101000);
  assert.equal(first.rows.length, 200);
  assert.equal(tail.rows.length, 100);
  assert.equal(tail.rows.at(-1)!.index, 101099);
  assert.notEqual(
    first.rows[0].sourceNodes[0].id,
    tail.rows[0].sourceNodes[0].id,
  );
  assert.equal(tail.rows[0].blockStart, 100090);
  const row = tail.rows.at(-1)!;
  assert.equal(
    row.annualTotal,
    Math.round(
      COLUMNS.slice(4).reduce(
        (sum, col) => sum + Number(row[col.field as 'january']),
        0,
      ) * 100,
    ) / 100,
  );
  const transaction = service.write(
    manifest.id,
    [{ recordId: row.sourceNodes[0].id, col: 4, input: 4567 }],
    '跨页编辑',
  );
  assert.equal(transaction.patches[0].payload.type, 'value');
  assert.equal(service.page(manifest.id, 101000).rows.at(-1)!.january, 4567);
  const collapsed = service.project({
    ...expanded('stress'),
    subjects: { all: false, ids: [] },
  });
  assert.equal(collapsed.totalRows, 1100);
  const restored = service.project(expanded('stress'));
  assert.equal(service.page(restored.id, 101000).rows.at(-1)!.january, 4567);
});
test('批量校验具备原子性，金额和属性沿用原有修改载荷', () => {
  const service = new BudgetService();
  const manifest = service.project(expanded());
  const row = service.page(manifest.id, 0).rows[1];
  const recordId = row.sourceNodes[0].id;
  const summaryBefore = service.page(manifest.id, 0).rows[0].annualTotal;
  assert.throws(() =>
    service.write(
      manifest.id,
      [
        { recordId, col: 4, input: 123 },
        { recordId, col: 5, input: '错误金额' },
      ],
      '粘贴',
    ),
  );
  assert.equal(service.page(manifest.id, 0).rows[1].january, row.january);
  assert.throws(() =>
    service.write(
      manifest.id,
      [{ recordId, col: 1, input: '禁止' }],
      '修改只读',
    ),
  );
  assert.throws(() =>
    service.write(manifest.id, [{ recordId, col: 4, input: -1 }], '负数'),
  );
  const transaction = service.write(
    manifest.id,
    [
      { recordId, col: 4, input: '1,234.50', expected: row.january },
      { recordId, col: 2, input: '研发' },
    ],
    '粘贴',
  );
  assert.equal(transaction.patches[0].after, 1234.5);
  const attribute = transaction.patches[1].payload;
  assert.equal(attribute.type, 'attribute');
  if (attribute.type === 'attribute')
    assert.equal(attribute.attribute.code, 'ATTR000038');
  assert.equal(service.page(manifest.id, 0).rows[0].annualTotal, summaryBefore);
  assert.throws(() =>
    service.write(
      manifest.id,
      [{ recordId, col: 4, input: 5, expected: row.january }],
      '过期修改',
    ),
  );
});
test('公式引用、重算、整次撤销重做以及循环引用拒绝', () => {
  const service = new BudgetService();
  const manifest = service.project(expanded());
  const row = service.page(manifest.id, 0).rows[0];
  const recordId = row.sourceNodes[0].id;
  service.write(
    manifest.id,
    [
      { recordId, col: 4, input: 2 },
      { recordId, col: 5, input: 3 },
      { recordId, col: 3, input: '=SUM(E1:F1)' },
    ],
    '公式',
  );
  assert.equal(service.page(manifest.id, 0).rows[0].annualTotal, 5);
  const transaction = service.write(
    manifest.id,
    [{ recordId, col: 4, input: 7 }],
    '联动',
  );
  assert.equal(transaction.patches.length, 2);
  assert.equal(service.page(manifest.id, 0).rows[0].annualTotal, 10);
  service.replay('regular', transaction, 'undo');
  assert.equal(service.page(manifest.id, 0).rows[0].annualTotal, 5);
  service.replay('regular', transaction, 'redo');
  assert.equal(service.page(manifest.id, 0).rows[0].annualTotal, 10);
  assert.throws(() =>
    service.write(manifest.id, [{ recordId, col: 4, input: '=D1' }], '循环'),
  );
  assert.equal(service.page(manifest.id, 0).rows[0].january, 7);
  assert.throws(() =>
    service.write(manifest.id, [{ recordId, col: 4, input: '=1/0' }], '除零'),
  );
  const newProjection = service.project({
    ...expanded(),
    subjects: { all: false, ids: [] },
  });
  assert.equal(service.page(newProjection.id, 0).rows[0].annualTotal, 10);
});
test('搜索覆盖隐藏层级，维度定位和任意位置分页一致', () => {
  const service = new BudgetService();
  const result = service.search('regular', '办公费', 0);
  assert.equal(result.total, 9);
  assert.ok(result.match);
  assert.equal(service.search('regular', '办公费', -1).index, 8);
  const dimension = {
    row: result.match.rowDimension,
    column: getBusinessColumnDimension('january')!,
  };
  const found = service.locate('regular', dimension);
  assert.equal(found?.recordId, result.match.recordId);
  assert.equal(found?.column, 4);
  const manifest = service.project(expanded());
  const index = service.position(manifest.id, found!.recordId);
  assert.equal(
    service.page(manifest.id, 0).rows[index].sourceNodes[0].id,
    found!.recordId,
  );
  const hidden = service.project({
    ...expanded(),
    subjects: { all: false, ids: [] },
  });
  assert.equal(service.position(hidden.id, found!.recordId), -1);
});
test('跨页选区读取和服务端统计不遗漏未加载记录', () => {
  const service = new BudgetService();
  const manifest = service.project(expanded('stress'));
  const range = { anchor: { row: 195, col: 4 }, focus: { row: 405, col: 5 } };
  const first = service.range(manifest.id, range, [4, 5], 0);
  const next = service.range(manifest.id, range, [4, 5], first.nextOffset!);
  assert.equal(first.rows.length, 200);
  assert.equal(next.rows.length, 11);
  assert.equal(next.nextOffset, null);
  const sum = [...first.rows, ...next.rows].reduce(
    (total, row) => total + row.january + row.february,
    0,
  );
  const stats = service.statistics(manifest.id, range, [4, 5]);
  assert.equal(stats.numeric, 422);
  assert.ok(Math.abs(stats.sum - sum) < 0.001);
  assert.throws(() => service.range(manifest.id, range, [4, 5], -1));
});
test('Excel TSV 和公式相对引用保留引号、换行和绝对引用', () => {
  assert.deepEqual(
    parseTsv('"研发\t费用"\t"一行\n二行"\r\n"引号""文本"\t12\r\n'),
    [
      ['研发\t费用', '一行\n二行'],
      ['引号"文本', '12'],
    ],
  );
  assert.equal(
    shiftFormula('=SUM(A1,$B2,C$3,$D$4)+IF(A1="A1",1,0)', 2, 1),
    '=SUM(B3,$B4,D$3,$D$4)+IF(B3="A1",1,0)',
  );
  assert.equal(shiftFormula('=A1', -1, 0), '=#REF!');
});

test('大范围搜索索引完整，重复保存不占用有效撤销历史', () => {
  const service = new BudgetService();
  const common = service.search('stress', '0', 0);
  assert.ok(common.total > 100000);
  assert.ok(common.match);
  assert.equal(service.search('stress', '0', -1).index, common.total - 1);
  const manifest = service.project(expanded());
  const recordId = service.page(manifest.id, 0).rows[0].sourceNodes[0].id;
  const transaction = service.write(
    manifest.id,
    [{ recordId, col: 4, input: 321 }],
    '编辑',
  );
  for (let index = 0; index < 105; index += 1) {
    assert.equal(
      service.write(manifest.id, [{ recordId, col: 4, input: 321 }], '重复提交')
        .patches.length,
      0,
    );
  }
  service.replay('regular', transaction, 'undo');
  assert.equal(service.page(manifest.id, 0).rows[0].january, 3600);
});

test('列宽样本覆盖全视图、区分显示样式、分页并在修改和撤销后更新', async () => {
  const service = new BudgetService();
  const manifest = service.project(expanded('stress'));
  const tail = service.page(manifest.id, 101000).rows.at(-1)!;
  const id = tail.sourceNodes[0].id;
  const text = '屏幕外的长文本 WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW';
  const transaction = service.write(
    manifest.id,
    [
      { recordId: id, col: 2, input: text },
      { recordId: id, col: 4, input: '=1000000000' },
    ],
    '适配列宽回归',
  );
  const samples = [];
  let offset: number | null = 0;
  let batches = 0;
  while (offset !== null) {
    const page = await service.columnSizes(
      manifest.id,
      COLUMNS.map((_, col) => col),
      offset,
    );
    assert.ok(page.samples.length <= 200);
    samples.push(...page.samples);
    offset = page.nextOffset;
    batches++;
  }
  assert.ok(
    samples.some(
      (sample) => sample.col === 2 && sample.text === text && !sample.bold,
    ),
  );
  assert.ok(
    samples.some(
      (sample) =>
        sample.col === 4 &&
        sample.text === '1,000,000,000.00' &&
        sample.formula,
    ),
  );
  assert.ok(
    samples.some(
      (sample) => sample.col === 0 && sample.indent > 0 && sample.bold,
    ),
  );
  assert.ok(samples.some((sample) => sample.col === 1 && sample.indent === 1));
  assert.ok(samples.length < 1000, '十万行只需小量去重文本及数值极值样本');
  assert.ok(batches < 6);
  service.replay('stress', transaction, 'undo');
  const undone = await service.columnSizes(manifest.id, [2, 4], 0);
  assert.ok(
    !undone.samples.some((sample) => sample.text === text || sample.formula),
  );
  await assert.rejects(service.columnSizes(manifest.id, [-1], 0), /列宽查询/);
  const changed = service.columnSizes(manifest.id, [0, 1, 2, 3, 4], 0);
  service.write(
    manifest.id,
    [{ recordId: id, col: 2, input: '并发更新' }],
    '更新',
  );
  await assert.rejects(changed, /数据已更新/);
});
