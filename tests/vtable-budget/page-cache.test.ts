import { dispatchBudgetRequest } from '../../server/budget-api';
import { initialQuery } from '../../src/pages/TanStackBudget/core/use-budget-data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  BudgetPageCache,
  PAGE_CONCURRENCY,
} from '../../src/pages/TanStackBudget/core/page-cache';
import { parseTsv } from '../../src/pages/TanStackBudget/core/clipboard';
import type {
  BudgetRow,
  Manifest,
  Page,
} from '../../src/pages/TanStackBudget/core/types';

const manifest: Manifest = {
  id: 'test-view',
  totalRows: 101100,
  pageSize: 200,
  detailCount: 100000,
  summaryCount: 1100,
  organizationGroups: 10,
  organizationExpanded: 10,
  subjectGroups: 1100,
  subjectExpanded: 1100,
  breadcrumbs: [],
};
const page = (offset: number): Page => ({
  projectionId: manifest.id,
  offset,
  rows: Array.from(
    { length: Math.min(200, manifest.totalRows - offset) },
    (_, i) => ({ index: offset + i } as BudgetRow),
  ),
});
function harness() {
  const calls: {
    offset: number;
    signal: AbortSignal;
    resolve: (value: Page) => void;
    reject: (error: Error) => void;
  }[] = [];
  const cache = new BudgetPageCache(
    manifest,
    (_id, offset, signal) =>
      new Promise((resolve, reject) =>
        calls.push({ offset, signal: signal!, resolve, reject }),
      ),
    () => {},
  );
  return { cache, calls };
}

test('分页去重、三请求并发上限和队列按需执行', async () => {
  const { cache, calls } = harness();
  const first = cache.load(0);
  assert.equal(cache.load(199), first);
  const all = [first, ...[200, 400, 600, 800].map((row) => cache.load(row))];
  assert.equal(calls.length, PAGE_CONCURRENCY);
  for (let i = 0; i < all.length; i++) {
    calls[i].resolve(page(calls[i].offset));
    await setImmediate();
  }
  await Promise.all(all);
  assert.equal(cache.cachedRows, 1000);
});

test('最新视口取消过期预取，迟到响应不污染缓存', async () => {
  const { cache, calls } = harness();
  cache.loadViewport(0, 15);
  cache.loadViewport(8000, 8015);
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, true);
  for (let i = 0; i < 4; i++) {
    calls[i].resolve(page(calls[i].offset));
    await setImmediate();
  }
  assert.equal(cache.rowAt(0), undefined);
  assert.equal(cache.rowAt(8000)?.index, 8000);
  assert.equal(cache.cachedRows, 400);
  assert.equal(cache.error, '');
});

test('显式读取优先于预取，编辑所需分页不会因滚动被取消', async () => {
  const { cache, calls } = harness();
  const busy = [0, 200, 400].map((row) => cache.load(row));
  cache.loadViewport(600, 610);
  const required = cache.load(800);
  calls[0].resolve(page(0));
  await setImmediate();
  assert.equal(calls[3].offset, 800);
  cache.loadViewport(2000, 2010);
  assert.equal(calls[3].signal.aborted, false);
  calls[3].resolve(page(800));
  assert.equal((await required)[0].index, 800);
  calls[1].resolve(page(200));
  calls[2].resolve(page(400));
  await Promise.all(busy);
  cache.cancelPending();
});

test('分页失败保留到显式重试，其他成功页不会清错或自动重发', async () => {
  const { cache, calls } = harness();
  const failed = assert.rejects(cache.load(200), /离线/);
  const success = cache.load(400);
  calls[0].reject(new Error('离线'));
  await failed;
  calls[1].resolve(page(400));
  await success;
  assert.match(cache.error, /201–400.*离线/);
  await assert.rejects(cache.load(200), /离线/);
  assert.equal(calls.length, 2);
  cache.retry();
  const retry = cache.load(200);
  calls[2].resolve(page(200));
  await retry;
  assert.equal(cache.error, '');
});

test('视图或写入刷新取消所有旧工作，不接收已取消响应', async () => {
  const { cache, calls } = harness();
  const aborted = assert.rejects(cache.load(0), { name: 'AbortError' });
  cache.clear();
  const fresh = cache.load(0);
  calls[0].resolve(page(0));
  await aborted;
  await setImmediate();
  assert.equal(cache.cachedRows, 0);
  calls[1].resolve(page(0));
  await fresh;
  assert.equal(cache.cachedRows, 200);
});

test('LRU 最多 2000 行，重新访问更新淘汰顺序，尾页只有 100 行', async () => {
  const cache = new BudgetPageCache(
    manifest,
    async (_id, offset) => page(offset),
    () => {},
  );
  for (let offset = 0; offset < 2000; offset += 200) await cache.load(offset);
  await cache.load(0);
  await cache.load(2000);
  assert.equal(cache.rowAt(200), undefined);
  assert.equal(cache.rowAt(0)?.index, 0);
  assert.equal(cache.cachedRows, 2000);
  assert.equal((await cache.load(101099)).length, 100);
  assert.equal(cache.cachedRows, 1900);
});

test('错误投影、错误页码和不完整分页必须可重试，不能静默留空', async () => {
  for (const response of [
    { ...page(0), projectionId: 'expired' },
    page(200),
    { ...page(0), rows: [] },
  ]) {
    const cache = new BudgetPageCache(
      manifest,
      async () => response,
      () => {},
    );
    await assert.rejects(cache.load(0), /响应不完整/);
    assert.equal(cache.cachedRows, 0);
    assert.match(cache.error, /重试/);
  }
});

test('超限粘贴在解析阶段拒绝，保留正常 Excel 引号与末尾空列', () => {
  assert.throws(() => parseTsv('1\n'.repeat(20001), 20000), /分批粘贴/);
  assert.throws(
    () => parseTsv('a'.repeat(8 * 1024 * 1024 + 1), 20000),
    /内容过大/,
  );
  assert.equal(parseTsv('1\n'.repeat(20000), 20000).length, 20000);
  assert.deepEqual(parseTsv('"一\n二"\t"a""b"\t\r\n', 3), [
    ['一\n二', 'a"b', ''],
  ]);
});

test('关闭演示会话幂等，连续超过 100 次打开与退出不会耗尽会话容量', () => {
  for (let i = 0; i < 120; i++) {
    const session = `lifecycle-${i}`;
    const view = dispatchBudgetRequest(session, 'project', {
      query: initialQuery('regular'),
    }) as Manifest;
    assert.equal(view.totalRows, 36);
    assert.deepEqual(dispatchBudgetRequest(session, 'close', {}), {
      closed: true,
    });
    assert.deepEqual(dispatchBudgetRequest(session, 'close', {}), {
      closed: true,
    });
  }
});
