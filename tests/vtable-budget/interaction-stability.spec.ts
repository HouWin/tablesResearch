import { expect, test, type Page } from '@playwright/test';
import type { ListTable } from '@visactor/vtable';

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(page.locator('.tb-status-bar b')).toHaveText('合计 43,200.00');
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function tableRead<T>(page: Page, read: (table: ListTable) => T) {
  // VTable exposes its instance on the canvas; inspect actual rendered geometry.
  return page
    .locator('.vt-host canvas')
    .first()
    .evaluate((canvas, source) => {
      const table = (canvas as HTMLCanvasElement & { __vtable__: ListTable })
        .__vtable__;
      return new Function('table', `return (${source})(table)`)(table) as T;
    }, read.toString());
}

test('慢速折叠保留按钮外观与焦点，局部反馈且拦截重复命令', async ({ page }) => {
  const names = [
    '复制',
    '业务定位',
    '列管理',
    '适配列宽',
    '批注',
    '历史',
    '附件',
    '追踪',
    '统计',
    '收起月份',
  ];
  const before = await Promise.all(
    names.map((name) =>
      button(page, name).evaluate((element) => ({
        opacity: getComputedStyle(element).opacity,
        width: element.getBoundingClientRect().width,
      })),
    ),
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let projectRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/project')) projectRequests++;
  });
  await page.route('**/api/tanstack-budget/page', async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await button(page, '收起全部科目').click();
    await expect(grid(page)).toHaveAttribute('aria-busy', 'true');
    await expect(button(page, '收起全部科目')).toBeFocused();
    await expect(page.locator('.tb-view-progress')).toHaveText('正在更新视图…');
    await expect(page.locator('.tb-dataset-strip')).not.toContainText(
      /正在加载|已连接|连接异常/,
    );
    for (let index = 0; index < names.length; index++) {
      const command = button(page, names[index]);
      await expect(command).toHaveAttribute('aria-disabled', 'true');
      const during = await command.evaluate((element) => ({
        opacity: getComputedStyle(element).opacity,
        width: element.getBoundingClientRect().width,
        nativeDisabled: (element as HTMLButtonElement).disabled,
      }));
      expect(during).toEqual({ ...before[index], nativeDisabled: false });
    }
    await button(page, '收起全部科目').dispatchEvent('click');
    await button(page, '复制').dispatchEvent('click');
    await grid(page).press('Delete');
    expect(projectRequests).toBe(1);
    await expect(page.locator('.vt-editor')).toHaveCount(0);
    await expect(page.locator('.tb-status-bar b')).toHaveText('合计 43,200.00');
    await page.screenshot({ path: 'test-results/vtable-stable-pending.png' });
  } finally {
    release();
  }
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '13');
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.tb-view-progress')).toHaveCount(0);
  await expect(button(page, '收起全部科目')).toBeDisabled();
  await expect(button(page, '展开全部科目')).toBeEnabled();
  await button(page, '展开全部科目').click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(button(page, '展开全部科目')).toBeDisabled();
});

test('快速视图请求不播报加载；搜索揭示结果后输入框保持焦点', async ({
  page,
}) => {
  // Deterministic fast replies reuse the current projection solely to measure UI feedback.
  let manifest: unknown;
  let firstPage: unknown;
  page.on('response', async (response) => {
    if (response.url().endsWith('/project')) manifest = await response.json();
    if (response.url().endsWith('/page')) firstPage = await response.json();
  });
  await page.reload();
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => Boolean(manifest && firstPage)).toBe(true);
  await page.route('**/api/tanstack-budget/project', (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.route('**/api/tanstack-budget/page', (route) =>
    route.fulfill({ json: firstPage }),
  );
  const observations = await page.evaluateHandle(() => {
    const states: string[] = [];
    const observer = new MutationObserver(() => {
      const message = document.querySelector('.tb-view-progress');
      if (message) states.push(message.textContent || '');
    });
    observer.observe(document.querySelector('.tanstack-budget')!, {
      subtree: true,
      childList: true,
    });
    return {
      stop: () => {
        observer.disconnect();
        return states;
      },
    };
  });
  for (let i = 0; i < 3; i++) {
    await button(page, '恢复默认视图').click();
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  }
  expect(await observations.evaluate((value) => value.stop())).toEqual([]);
  await observations.dispose();
  await page.unroute('**/api/tanstack-budget/project');
  await page.unroute('**/api/tanstack-budget/page');
  const search = page.getByRole('textbox', { name: '搜索完整预算数据' });
  await search.fill('电费');
  await search.press('Enter');
  await expect(page.locator('.tb-search > span')).toContainText('1 /');
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  await expect(search).toBeFocused();
});

test('组织合并文字垂直居中，月份左右收展且不请求行数据', async ({ page }) => {
  const geometry = await tableRead(page, (table) => {
    const text = table.scenegraph.getCell(1, 4).getChildByName('text', true)!;
    return {
      y: (text.globalAABBBounds.y1 + text.globalAABBBounds.y2) / 2,
      title: table.getCellValue(4, 1),
    };
  });
  expect(geometry.y).toBeCloseTo(176, -1);
  expect(geometry.title).toBe('◂  2025年');
  await page.screenshot({ path: 'test-results/vtable-alignment-expanded.png' });
  let requests = 0;
  page.on('request', (request) => {
    if (/\/(project|page)$/.test(request.url())) requests++;
  });
  // Click the actual Canvas year header as users do.
  const host = (await page.locator('.vt-host').boundingBox())!;
  const year = await tableRead(page, (table) => {
    const rect = table.getCellRelativeRect(4, 1);
    return { x: rect.left + 20, y: rect.top + 14 };
  });
  await page.mouse.click(host.x + year.x, host.y + year.y);
  await expect(button(page, '展开月份')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(await tableRead(page, (table) => table.getCellValue(4, 1))).toBe(
    '▸  2025年',
  );
  await page.screenshot({
    path: 'test-results/vtable-alignment-collapsed.png',
  });
  await page.mouse.click(host.x + year.x, host.y + year.y);
  await expect(button(page, '收起月份')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(await tableRead(page, (table) => table.getCellValue(4, 1))).toBe(
    '◂  2025年',
  );
  expect(requests).toBe(0);
});

test('统计等待保留上次合计，新结果就绪后替换，不短暂清零', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/tanstack-budget/statistics', async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await grid(page).press('ArrowDown');
    await grid(page).press('ArrowRight');
    await expect(page.locator('.tb-address')).toHaveText('E2');
    await expect(page.locator('.tb-statistics-progress')).toHaveText('更新中…');
    await expect(page.locator('.tb-status-bar b')).toHaveText('合计 43,200.00');
    await expect(page.locator('.tb-status-bar')).not.toContainText(
      /选中 0 格|统计中/,
    );
  } finally {
    release();
  }
  await expect(page.locator('.tb-status-bar b')).toHaveText('合计 600.00');
  await expect(page.locator('.tb-statistics-progress')).toHaveText('');
});
