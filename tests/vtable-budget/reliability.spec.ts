import { test, expect, type Page } from '@playwright/test';
import type { ListTable } from '@visactor/vtable';

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function scrollTo(page: Page, row: number) {
  await page
    .locator('.vt-host canvas')
    .first()
    .evaluate((canvas, row) => {
      (
        canvas as HTMLCanvasElement & { __vtable__: ListTable }
      ).__vtable__.scrollTop = row * 32;
    }, row);
}

test('编辑中打开批注只保存一次，校验失败保持编辑与焦点', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/tanstack-budget/write', async (route) => {
    writes++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('97531');
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await expect(page.getByLabel('为这条预算补充说明')).toBeFocused();
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('97531');
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('金额有误');
  await page.getByRole('button', { name: '附件', exact: true }).click();
  await expect(page.locator('.vt-editor')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('.vt-editor')).toBeFocused();
  await expect(
    page.getByRole('complementary', { name: '单元格附件' }),
  ).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('97531');
  expect(writes).toBe(2);
  await page.locator('.vt-editor').press('Escape');
});

test('大数据分页失败不会因预取成功而循环重试，手动重试恢复实际单元格', async ({
  page,
}) => {
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  let failedRequests = 0;
  let retry = false;
  await page.route('**/api/tanstack-budget/page', async (route) => {
    const { offset } = route.request().postDataJSON();
    if (offset === 2000 && !retry) {
      failedRequests++;
      await route.fulfill({ status: 503, json: { error: '模拟分页故障' } });
    } else {
      if (offset === 2200)
        await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    }
  });
  const prefetch = page.waitForResponse(
    (response) =>
      response.url().endsWith('/page') &&
      response.request().postDataJSON().offset === 2200,
  );
  await scrollTo(page, 2000);
  await prefetch;
  await expect(page.locator('.tb-inline-error')).toContainText('模拟分页故障');
  // Trigger repeated rendering while the failed page remains visible.
  for (const row of [2001, 2002, 2000]) {
    await scrollTo(page, row);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  expect(failedRequests).toBe(1);
  retry = true;
  await page.getByRole('button', { name: '重试当前页' }).click();
  await expect(page.locator('.tb-inline-error')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.vt-host canvas')
        .first()
        .evaluate((canvas) => {
          const table = (
            canvas as HTMLCanvasElement & { __vtable__: ListTable }
          ).__vtable__;
          return table.getCellOriginRecord(5, 2004)?.index;
        }),
    )
    .toBe(2000);
});

test('慢网连续滚动取消旧分页，最新视口优先且缓存有界', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  const offsets: number[] = [];
  let cancelled = 0;
  page.on('requestfailed', (request) => {
    if (request.url().endsWith('/page')) cancelled++;
  });
  await page.route('**/api/tanstack-budget/page', async (route) => {
    offsets.push(route.request().postDataJSON().offset);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue().catch(() => {});
  });
  for (const row of [2000, 6000, 10000, 18000, 32000, 50000]) {
    await scrollTo(page, row);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  }
  await expect
    .poll(() =>
      page
        .locator('.vt-host canvas')
        .first()
        .evaluate((canvas) => {
          const table = (
            canvas as HTMLCanvasElement & { __vtable__: ListTable }
          ).__vtable__;
          return table.getCellOriginRecord(5, 50004)?.index;
        }),
    )
    .toBe(50000);
  expect(cancelled).toBeGreaterThan(0);
  expect(offsets).toContain(50000);
  const status = await page.locator('.tb-status-bar').innerText();
  expect(
    Number(status.match(/已加载 ([\d,]+) 行/)![1].replace(/,/g, '')),
  ).toBeLessThanOrEqual(2000);
  await expect(page.locator('.tb-inline-error')).toHaveCount(0);
  await info.attach('paging.json', {
    body: JSON.stringify({ offsets, cancelled, status }, null, 2),
    contentType: 'application/json',
  });
});

test('超过两万格的粘贴清楚提示，保持当前数据且不发送写请求', async ({
  page,
}) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/write')) writes++;
  });
  await grid(page).evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text/plain', '1\n'.repeat(20001));
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('alert', { name: '操作反馈' })).toContainText(
    '分批粘贴',
  );
  await expect(page.locator('.tb-formula-value')).toHaveText('43200');
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  expect(writes).toBe(0);
});

test('离开页面释放演示会话，重新进入正常加载', async ({ page }) => {
  const closed = page.waitForResponse(
    (response) => response.url().endsWith('/close') && response.ok(),
  );
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await closed;
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(page.locator('.tb-formula-value')).toHaveText('43200');
});
