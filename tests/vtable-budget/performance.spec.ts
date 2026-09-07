import { test, expect } from '@playwright/test';

test('十万模式性能记录：分批加载、尾页编辑与完整统计', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/vtable');
  const grid = page.getByRole('grid', { name: '费用预算表', exact: true });
  await expect(grid).toHaveAttribute('aria-rowcount', '40');
  await page.evaluate(() => {
    const samples: { start: number; duration: number }[] = [];
    const state = window as unknown as { budgetLongTasks: typeof samples };
    state.budgetLongTasks = samples;
    new PerformanceObserver((list) => {
      samples.push(
        ...list
          .getEntries()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      );
    }).observe({ type: 'longtask' });
  });
  const requests: { offset: number; rows: number }[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('/page') && response.ok()) {
      const { data } = await response.json();
      requests.push({ offset: data.offset, rows: data.rows.length });
    }
  });
  const measures: Record<string, number> = {};
  const start = Date.now();
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(grid).toHaveAttribute('aria-rowcount', '101104');
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  measures.loadMs = Date.now() - start;
  const jump = Date.now();
  await grid.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(page.locator('.tb-address')).toHaveText('P101100');
  await expect(page.locator('.tb-formula-value')).toHaveText(/^\d/);
  measures.tailJumpMs = Date.now() - jump;
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('2345.67');
  const edit = Date.now();
  await page.locator('.vt-editor').press('Enter');
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('2345.67');
  measures.editMs = Date.now() - edit;
  const selection = Date.now();
  await grid.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('.tb-status-bar')).toContainText(
    '选中 1,617,600 格',
  );
  // The sum appears only after the server returns the full selection's statistics.
  await expect(page.locator('.tb-status-bar')).toContainText('合计');
  measures.statisticsMs = Date.now() - selection;
  const longTasks = await page.evaluate(
    () =>
      (
        window as unknown as {
          budgetLongTasks: { start: number; duration: number }[];
        }
      ).budgetLongTasks,
  );
  measures.maxMainThreadTaskMs = Math.max(
    0,
    ...longTasks.map((entry) => entry.duration),
  );
  const metrics = {
    viewport: page.viewportSize(),
    measures,
    requests,
    longTasks,
    status: await page.locator('.tb-status-bar').innerText(),
  };
  await info.attach('performance.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  console.log('[VTable regression performance]', JSON.stringify(metrics));
  expect(errors).toEqual([]);
  expect(requests.every((r) => r.rows <= 200)).toBeTruthy();
  expect(requests.length).toBeLessThan(12);
  expect(measures.maxMainThreadTaskMs).toBeLessThan(500);
  expect(measures.loadMs).toBeLessThan(5000);
  expect(measures.editMs).toBeLessThan(5000);
});
