import { test, expect, type Page } from '@playwright/test';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
async function ready(page: Page, stress = false) {
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  if (stress) {
    await page.getByRole('button', { name: '体验 10 万行数据' }).click();
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  }
}
async function selectColumn(page: Page, col: number, tail = false) {
  await grid(page).focus();
  await page.keyboard.press(tail ? 'ControlOrMeta+End' : 'ControlOrMeta+Home');
  for (let i = 0; i < (tail ? 15 - col : col); i++)
    await page.keyboard.press(tail ? 'ArrowLeft' : 'ArrowRight');
  await expect(page.locator('.tb-formula-value')).not.toHaveText('正在加载…');
}
async function editTail(page: Page, col: number, input: string) {
  await selectColumn(page, col, true);
  await page.keyboard.press('F2');
  await page.locator('.vt-editor').fill(input);
  await page.locator('.vt-editor').press('Enter');
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
}
async function columnRect(page: Page, col: number) {
  await selectColumn(page, col);
  await page.keyboard.press('F2');
  const editor = page.locator('.vt-editor');
  await expect(editor).toBeVisible();
  const rect = (await editor.boundingBox())!;
  await editor.press('Escape');
  return rect;
}
async function fit(page: Page) {
  await page.getByRole('button', { name: '适配列宽', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '适配列宽', exact: true }),
  ).toBeEnabled();
  await expect(page.locator('.vt-sizing-status')).toHaveCount(0);
  await expect(page.locator('.tb-toast.is-error')).toHaveCount(0);
}
async function measure(page: Page, text: string) {
  return page.evaluate((text) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = '400 12px Arial, PingFang SC, Microsoft YaHei, sans-serif';
    return ctx.measureText(text).width;
  }, text);
}

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
  await expect(page.locator('.umi-error-overlay')).toHaveCount(0);
});
for (const stress of [false, true]) {
  test(`${
    stress ? '十万' : '普通'
  }模式适配全视图长文本、格式化金额及图标，修改和撤销后可重新收缩`, async ({
    page,
  }) => {
    await ready(page, stress);
    const long = '预算备注' + 'W'.repeat(48);
    await editTail(page, 2, long);
    await editTail(page, 4, '=1000000000');
    await selectColumn(page, 4, true);
    await page.getByRole('button', { name: '批注', exact: true }).click();
    await page
      .getByRole('textbox', { name: '为这条预算补充说明' })
      .fill('金额说明');
    await page.getByRole('button', { name: '保存批注' }).click();
    await page.getByRole('button', { name: '关闭侧栏' }).click();
    await selectColumn(page, 3);
    const responses: number[] = [];
    let rowsDownloaded = 0;
    page.on('response', async (response) => {
      if (response.url().endsWith('/column-sizes') && response.ok()) {
        const { data } = await response.json();
        responses.push(data.samples.length);
      }
      if (response.url().endsWith('/page') && response.ok()) {
        const { data } = await response.json();
        rowsDownloaded += data.rows.length;
      }
    });
    const monitor = await page.evaluateHandle(() => {
      let frames = 0;
      let frame = 0;
      const tasks: number[] = [];
      const observer = new PerformanceObserver((list) =>
        tasks.push(...list.getEntries().map((entry) => entry.duration)),
      );
      observer.observe({ type: 'longtask' });
      const tick = () => {
        frames++;
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return {
        stop: () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          return { frames, maxMainThreadTaskMs: Math.max(0, ...tasks) };
        },
      };
    });
    const start = Date.now();
    await fit(page);
    const fittingMs = Date.now() - start;
    const responsiveness = await monitor.evaluate((state) => state.stop());
    await monitor.dispose();
    expect(responsiveness.maxMainThreadTaskMs).toBeLessThan(500);
    if (stress) expect(responsiveness.frames).toBeGreaterThan(5);
    const wide = (await columnRect(page, 2)).width;
    const expected = Math.ceil(await measure(page, long)) + 26;
    expect(wide).toBeGreaterThan(440);
    expect(wide).toBeGreaterThanOrEqual(expected);
    expect(wide).toBeLessThanOrEqual(expected + 2);
    const amount = (await columnRect(page, 4)).width;
    expect(amount).toBeGreaterThanOrEqual(
      Math.ceil(await measure(page, '1,000,000,000.00')) + 26 + 14 + 15,
    );
    expect(responses.every((count) => count <= 200)).toBe(true);
    expect(responses.reduce((sum, count) => sum + count, 0)).toBeLessThan(1000);
    expect(rowsDownloaded).toBeLessThanOrEqual(600);
    expect(fittingMs).toBeLessThan(6000);
    console.log(
      '[column sizing]',
      JSON.stringify({
        stress,
        fittingMs,
        samples: responses,
        wide,
        amount,
        rowsDownloaded,
        responsiveness,
      }),
    );
    if (stress)
      await page.screenshot({ path: 'test-results/vtable-autofit-stress.png' });
    // Equal character counts can have very different pixel widths.
    await editTail(page, 2, '预算备注' + 'i'.repeat(48));
    await fit(page);
    expect((await columnRect(page, 2)).width).toBeLessThan(wide / 2);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await fit(page);
    expect((await columnRect(page, 2)).width).toBe(wide);
    await page
      .getByRole('button', { name: '收起全部科目', exact: true })
      .click();
    await expect(grid(page)).toHaveAttribute(
      'aria-rowcount',
      stress ? '1104' : '13',
    );
    await fit(page);
    expect((await columnRect(page, 2)).width).toBeLessThan(wide / 2);
  });
}

test('双击列边界只适配该列，其他列宽及隐藏列保持不变', async ({ page }) => {
  await ready(page);
  const oldAmount = (await columnRect(page, 4)).width;
  const long = 'W'.repeat(45);
  await editTail(page, 2, long);
  const rect = await columnRect(page, 2);
  const host = (await page.locator('.vt-host').boundingBox())!;
  await page.mouse.move(host.x + 25, rect.y + rect.height);
  await page.mouse.down();
  await page.mouse.move(host.x + 25, rect.y + rect.height + 20, { steps: 6 });
  await page.mouse.up();
  const resizedHeight = (await columnRect(page, 2)).height;
  expect(resizedHeight).toBeGreaterThan(rect.height + 15);
  const response = page.waitForResponse((response) =>
    response.url().endsWith('/column-sizes'),
  );
  await page.mouse.dblclick(rect.x + rect.width, host.y + 100);
  const request = (await response).request().postDataJSON();
  expect(request.columns).toEqual([2]);
  await expect(page.locator('.vt-sizing-status')).toHaveCount(0);
  expect((await columnRect(page, 2)).width).toBeGreaterThan(440);
  expect((await columnRect(page, 2)).height).toBe(resizedHeight);
  expect((await columnRect(page, 4)).width).toBe(oldAmount);
  await page.getByRole('button', { name: '收起月份', exact: true }).click();
  await fit(page);
  await expect(page.locator('.tb-status-bar')).toContainText('4 列');
  await page.getByRole('button', { name: '展开月份', exact: true }).click();
  expect((await columnRect(page, 4)).width).toBe(oldAmount);
});

test('列宽查询失败及取消不会写入部分列宽，切换模式后丢弃迟到结果', async ({
  page,
}) => {
  await ready(page);
  const before = (await columnRect(page, 2)).width;
  await page.route('**/api/tanstack-budget/column-sizes', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: '列宽查询暂时失败' }),
    }),
  );
  await page.getByRole('button', { name: '适配列宽', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('列宽查询暂时失败');
  expect((await columnRect(page, 2)).width).toBe(before);
  await page.unroute('**/api/tanstack-budget/column-sizes');
  for (const switchMode of [false, true]) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested = false;
    await page.route('**/api/tanstack-budget/column-sizes', async (route) => {
      requested = true;
      await held;
      await route.continue().catch(() => {});
    });
    await page.getByRole('button', { name: '适配列宽', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    if (switchMode) {
      await page.getByRole('button', { name: '体验 10 万行数据' }).click();
      await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
    } else
      await page.getByRole('button', { name: '取消适配', exact: true }).click();
    await expect(page.locator('.vt-sizing-status')).toHaveCount(0);
    release();
    await page.unroute('**/api/tanstack-budget/column-sizes');
    expect((await columnRect(page, 2)).width).toBe(before);
  }
});
