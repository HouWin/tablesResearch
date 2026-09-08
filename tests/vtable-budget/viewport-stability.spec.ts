import { test, expect, type Page } from '@playwright/test';
import type { ListTable } from '@visactor/vtable';

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
async function read<T>(page: Page, fn: (table: ListTable) => T) {
  return page
    .locator('.vt-host canvas')
    .first()
    .evaluate((canvas, source) => {
      const table = (canvas as HTMLCanvasElement & { __vtable__: ListTable })
        .__vtable__;
      return new Function('table', `return (${source})(table)`)(table) as T;
    }, fn.toString());
}
async function geometry(page: Page, row: number, col = 1) {
  return page
    .locator('.vt-host canvas')
    .first()
    .evaluate(
      (canvas, at) => {
        const table = (canvas as HTMLCanvasElement & { __vtable__: ListTable })
          .__vtable__;
        const rect = table.getCellRelativeRect(at.col, at.row + 4);
        return {
          top: rect.top,
          left: rect.left,
          scroll: table.scrollTop,
          horizontal: table.scrollLeft,
          spacer: table.getRowHeight(table.rowCount - 1),
          end: table.getCellRelativeRect(1, table.rowCount - 2).bottom,
        };
      },
      { row, col },
    );
}
async function nextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const width of [1600, 700]) {
  test(`底部反复折叠上华公司保持屏幕位置，留白不可操作并随上滚回收（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/vtable');
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
    await read(page, (table) => {
      table.scrollTop = 1e8;
    });
    await nextPaint(page);
    const host = (await page.locator('.vt-host').boundingBox())!;
    const before = await geometry(page, 28);
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.mouse.click(
        host.x + before.left + 42,
        host.y + before.top + 64,
      );
      await expect(grid(page)).toHaveAttribute('aria-rowcount', '36');
      await nextPaint(page);
      expect(await geometry(page, 28)).toMatchObject({
        top: before.top,
        scroll: before.scroll,
        horizontal: before.horizontal,
        spacer: 128,
      });
      await expect(page.locator('.tb-address')).toHaveText('A29');
      // Empty trailing space is presentation only: no new row number, selection or menu.
      const folded = await geometry(page, 28);
      await page.mouse.click(
        host.x + before.left + 90,
        host.y + folded.end + 24,
      );
      await page.mouse.click(
        host.x + before.left + 90,
        host.y + folded.end + 24,
        { button: 'right' },
      );
      await expect(page.locator('.tb-address')).toHaveText('A29');
      await expect(page.getByRole('menu', { name: '单元格操作' })).toHaveCount(
        0,
      );
      await expect(page.locator('.tb-status-bar')).toContainText(
        '32 行 × 16 列',
      );
      await page.mouse.click(
        host.x + before.left + 42,
        host.y + before.top + 64,
      );
      await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
      await nextPaint(page);
      expect(await geometry(page, 28)).toMatchObject({
        top: before.top,
        scroll: before.scroll,
        spacer: 0,
      });
    }
    await page.mouse.click(host.x + before.left + 42, host.y + before.top + 64);
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '36');
    // Comments recreate cells; the fold position and spacer must survive the refresh.
    await page.getByRole('button', { name: '批注', exact: true }).click();
    await page.getByLabel('为这条预算补充说明').fill('折叠后保持定位');
    await page.getByRole('button', { name: '保存批注', exact: true }).click();
    await page.getByRole('button', { name: '关闭侧栏' }).click();
    await nextPaint(page);
    expect(await geometry(page, 28)).toMatchObject({
      top: before.top,
      scroll: before.scroll,
      spacer: 128,
    });
    await page.screenshot({ path: `test-results/fold-stable-${width}.png` });
    await page.mouse.move(host.x + before.left + 90, host.y + before.top + 64);
    await page.mouse.wheel(0, -48);
    await expect
      .poll(() => geometry(page, 28))
      .toMatchObject({ scroll: before.scroll - 48, spacer: 80 });
    await page.mouse.wheel(0, -160);
    await expect
      .poll(() => geometry(page, 28))
      .toMatchObject({ scroll: before.scroll - 208, spacer: 0 });
  });
}

test('滚动离开选中格后切换侧栏与窗口宽度不拉回旧选区', async ({ page }) => {
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(page.locator('.tb-address')).toHaveText('D1');
  await read(page, (table) => {
    table.scrollTop = 1e8;
  });
  const before = await geometry(page, 28);
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await nextPaint(page);
  expect(await geometry(page, 28)).toMatchObject({
    top: before.top,
    scroll: before.scroll,
  });
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.setViewportSize({ width: 1400, height: 1000 });
  await nextPaint(page);
  expect(await geometry(page, 28)).toMatchObject({
    top: before.top,
    scroll: before.scroll,
  });
  await expect(page.locator('.tb-address')).toHaveText('D1');
});

test('底部折叠分页失败重试后仍保留锚点，慢请求期间保持原画面', async ({
  page,
}) => {
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await read(page, (table) => {
    table.scrollTop = 1e8;
  });
  const host = (await page.locator('.vt-host').boundingBox())!;
  const before = await geometry(page, 28);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/tanstack-budget/page', async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: '折叠分页暂时失败' }),
    });
  });
  try {
    await page.mouse.click(host.x + before.left + 42, host.y + before.top + 64);
    await expect(page.locator('.tb-view-progress')).toHaveText('正在更新视图…');
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
    expect(await geometry(page, 28)).toMatchObject({
      top: before.top,
      scroll: before.scroll,
      spacer: 0,
    });
  } finally {
    release();
  }
  await expect(page.getByRole('alert')).toContainText('折叠分页暂时失败');
  expect(await geometry(page, 28)).toMatchObject({
    top: before.top,
    scroll: before.scroll,
  });
  await page.unroute('**/api/tanstack-budget/page');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '36');
  await nextPaint(page);
  expect(await geometry(page, 28)).toMatchObject({
    top: before.top,
    scroll: before.scroll,
    spacer: 128,
  });
});

test('十万行尾部科目折叠/展开保持锚点和横向位置，仅加载尾部分页', async ({
  page,
}) => {
  await page.goto('/vtable');
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  await read(page, (table) => {
    table.scrollTop = 100999 * 32;
    table.scrollLeft = 150;
  });
  await expect
    .poll(() =>
      read(page, (table) => Boolean(table.getCellOriginRecord(2, 101003))),
    )
    .toBe(true);
  const host = (await page.locator('.vt-host').boundingBox())!;
  const before = await geometry(page, 100999, 2);
  const offsets: number[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/page'))
      offsets.push(request.postDataJSON().offset);
  });
  for (const expanded of [false, true, false, true]) {
    await page.mouse.click(host.x + before.left + 42, host.y + before.top + 16);
    await expect(grid(page)).toHaveAttribute(
      'aria-rowcount',
      expanded ? '101104' : '101004',
    );
    await nextPaint(page);
    expect(await geometry(page, 100999, 2)).toMatchObject({
      top: before.top,
      scroll: before.scroll,
      horizontal: 150,
    });
  }
  expect(offsets.length).toBeGreaterThan(0);
  expect(offsets.every((offset) => offset >= 100800)).toBe(true);
});
