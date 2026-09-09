import { test, expect, type Page, type Request } from '@playwright/test';
import type { Page as BudgetPage } from '../../src/pages/TanStackBudget/core/types';
import type { BusinessCellChangePayload } from '../../src/pages/SpreadJSDemo/spreadsheet/business-cell-change';

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

const cell = (page: Page, row: number, col: number) =>
  page.locator(`[role="gridcell"][data-row="${row}"][data-col="${col}"]`);
async function ready(page: Page) {
  await page.goto('/tanstack-budget');
  await expect(cell(page, 0, 4)).toHaveAttribute('data-value', '3600');
}
async function edit(page: Page, row: number, col: number, input: string) {
  await cell(page, row, col).dblclick();
  const editor = page.locator('.tb-cell-editor');
  await expect(editor).toBeVisible();
  await editor.fill(input);
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
}
async function paste(page: Page, text: string) {
  await page
    .getByRole('grid', { name: '费用预算表', exact: true })
    .evaluate((element, value) => {
      const clipboard = new DataTransfer();
      clipboard.setData('text/plain', value);
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
}
test('菜单、四层表头、冻结、列宽和首页导航', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/home');
  await page.getByText('TanStack 费用预算表', { exact: true }).click();
  await expect(cell(page, 0, 4)).toBeVisible();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '40');
  await expect(
    page.getByRole('columnheader', { name: '预算数', exact: true }),
  ).toBeVisible();
  const organizationBefore = await cell(page, 0, 0).boundingBox();
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollLeft = 450;
  });
  const organizationAfter = await cell(page, 0, 0).boundingBox();
  expect(organizationAfter!.x).toBeCloseTo(organizationBefore!.x, 0);
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollLeft = 0;
  });
  const separator = page.getByRole('separator', {
    name: '调整组织列宽',
    exact: true,
  });
  const box = await separator.boundingBox();
  await page.mouse.move(box!.x + 2, box!.y + 12);
  await page.mouse.down();
  await page.mouse.move(box!.x + 42, box!.y + 12, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await cell(page, 0, 0).boundingBox())!.width)
    .toBeGreaterThan(organizationBefore!.width + 20);
  expect(errors).toEqual([]);
});
test('金额和属性编辑、校验、只读、撤销重做与历史', async ({ page }) => {
  const callbacks: string[] = [];
  const logPrefix = '[TanStack Budget][单元格修改]\n';
  page.on('console', (message) => {
    if (message.type() === 'log' && message.text().startsWith(logPrefix)) {
      callbacks.push(message.text());
    }
  });
  await ready(page);
  const recordId = await cell(page, 1, 4).getAttribute('data-record-id');
  const writes: unknown[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('/write')) writes.push(await response.json());
  });
  await edit(page, 1, 4, '1234.5');
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '1234.5');
  await expect(cell(page, 0, 4)).toHaveAttribute('data-value', '3600');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '600');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '1234.5');
  await edit(page, 1, 2, '销售预算');
  await expect(cell(page, 1, 2)).toHaveAttribute('data-value', '销售预算');
  await cell(page, 1, 4).dblclick();
  await page.locator('.tb-cell-editor').fill('不是金额');
  await page.locator('.tb-cell-editor').press('Enter');
  await expect(page.getByRole('alert')).toContainText('预算金额');
  await expect(page.locator('.tb-cell-editor')).toBeVisible();
  await page.locator('.tb-cell-editor').press('Escape');
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '1234.5');
  await cell(page, 1, 1).dblclick();
  await expect(page.locator('.tb-cell-editor')).toHaveCount(0);
  await cell(page, 1, 4).click();
  await page.getByRole('button', { name: '历史', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: '修改历史' }),
  ).toContainText('1234.5');
  expect(JSON.stringify(writes)).toContain('"type":"attribute"');
  expect(JSON.stringify(writes)).toContain('"dimension"');
  // Assert browser callback output against the production build, not just the API response.
  await expect.poll(() => callbacks.length).toBe(4);
  const [edited, undone, redone, attribute] = callbacks.map((text) => {
    const payload = JSON.parse(
      text.slice(logPrefix.length),
    ) as BusinessCellChangePayload;
    expect(text).toBe(`${logPrefix}${JSON.stringify(payload, null, 2)}`);
    return payload;
  });
  expect(edited).toEqual({
    type: 'value',
    recordId,
    oldValue: 600,
    newValue: 1234.5,
    dimension: {
      row: {
        DIM0090: expect.any(String),
        DIM0069: 'MEM_SUBJECT_OFFICE_EXPENSE',
      },
      column: {
        DIM0086: 'MEM_DATA_CATEGORY_BUDGET',
        DIM0067: 'MEM_YEAR_2025',
        DIM0068: 'MEM_PERIOD_01',
        default_measure: 'MEM_MEASURE_AMOUNT',
      },
    },
  });
  expect(undone).toEqual({ ...edited, oldValue: 1234.5, newValue: 600 });
  expect(redone).toEqual(edited);
  expect(attribute).toEqual({
    type: 'attribute',
    recordId,
    oldValue: '管理',
    newValue: '销售预算',
    row: edited.type === 'value' ? edited.dimension.row : {},
    attribute: {
      code: 'ATTR000038',
      owner: {
        dimensionCode: 'DIM0069',
        memberCode: 'MEM_SUBJECT_OFFICE_EXPENSE',
      },
    },
  });
});
test('矩形粘贴、统计、清空和整批只读校验', async ({ page }) => {
  await ready(page);
  await cell(page, 1, 4).click();
  await paste(page, '10\t20\n30\t40');
  await expect(cell(page, 2, 5)).toHaveAttribute('data-value', '40');
  await expect(page.locator('.tb-status-bar')).toContainText('合计 100.00');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '600');
  await expect(cell(page, 2, 5)).toHaveAttribute('data-value', '1200');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(cell(page, 2, 5)).toHaveAttribute('data-value', '40');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Delete');
  await expect(cell(page, 2, 5)).toHaveAttribute('data-value', '0');
  await cell(page, 1, 1).click();
  await paste(page, '不允许\t属性');
  await expect(page.getByRole('alert')).toContainText('只读');
  await expect(cell(page, 1, 2)).toHaveAttribute('data-value', '管理');
});
test('公式编辑、依赖重算、复制相对引用与循环校验', async ({ page }) => {
  await ready(page);
  await edit(page, 1, 4, '2');
  await edit(page, 1, 5, '3');
  await edit(page, 1, 3, '=SUM(E2:F2)');
  await expect(cell(page, 1, 3)).toHaveAttribute('data-value', '5');
  await edit(page, 1, 4, '7');
  await expect(cell(page, 1, 3)).toHaveAttribute('data-value', '10');
  await cell(page, 1, 3).click();
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
    '已复制',
  );
  await cell(page, 2, 3).click();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(cell(page, 2, 3)).toHaveAttribute('data-value', '2400');
  await expect(page.locator('.tb-formula-value')).toContainText('=SUM(E3:F3)');
  await cell(page, 1, 4).dblclick();
  await page.locator('.tb-cell-editor').fill('=D2');
  await page.locator('.tb-cell-editor').press('Enter');
  await expect(page.getByRole('alert')).toContainText('公式');
  await page.locator('.tb-cell-editor').press('Escape');
});
test('层级独立折叠、钻取、全表搜索与业务维度定位', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '13');
  await page.getByRole('button', { name: '收起全部组织', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '5');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).fill('办公费');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).press('Enter');
  await expect(page.locator('.tb-search')).toContainText('1 / 9');
  await expect(page.locator('.tb-formula-value')).toContainText('办公费');
  await page.getByRole('button', { name: '下一个搜索结果' }).click();
  await expect(page.locator('.tb-search')).toContainText('2 / 9');
  await page.getByRole('button', { name: '业务定位', exact: true }).click();
  await page.getByRole('textbox', { name: '业务维度 JSON' }).fill(
    JSON.stringify({
      row: {
        DIM0090: 'MEM_ORG_HUAJING_SALES',
        DIM0069: 'MEM_SUBJECT_OFFICE_EXPENSE',
      },
      column: {
        DIM0086: 'MEM_DATA_CATEGORY_BUDGET',
        DIM0067: 'MEM_YEAR_2025',
        DIM0068: 'MEM_PERIOD_01',
        default_measure: 'MEM_MEASURE_AMOUNT',
      },
    }),
  );
  await page.getByRole('button', { name: '定位单元格', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('100');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await expect(cell(page, 0, 0)).toBeVisible();
  await cell(page, 0, 0).click();
  await page.getByRole('button', { name: '下钻', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: '组织钻取路径' }),
  ).toContainText('华润微电子集团');
  await page.getByRole('button', { name: '上一级', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '40');
});
test('列管理、年度折叠、选区导航、批注与附件稳定关联', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '收起月份', exact: true }).click();
  await expect(cell(page, 0, 4)).toHaveCount(0);
  await expect(cell(page, 0, 3)).toBeVisible();
  await page.getByRole('button', { name: '展开月份', exact: true }).click();
  await expect(cell(page, 0, 4)).toBeVisible();
  await page.getByRole('button', { name: '列管理', exact: true }).click();
  await page
    .getByRole('checkbox', { name: '1月 · 金额', exact: true })
    .uncheck();
  await expect(cell(page, 0, 4)).toHaveCount(0);
  await page
    .getByRole('button', { name: '恢复显示全部列', exact: true })
    .click();
  await page.getByRole('button', { name: '关闭列管理' }).click();
  await cell(page, 1, 4).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('F2');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await page.getByLabel('为这条预算补充说明').fill('回归测试：采购预算');
  await page.getByRole('button', { name: '保存批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await expect(
    page.getByRole('button', { name: '查看 E2 批注' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '附件', exact: true }).click();
  await page.getByLabel('添加附件').setInputFiles({
    name: 'budget-note.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await expect(
    page.getByRole('complementary', { name: '单元格附件' }),
  ).toContainText('budget-note.pdf');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '查看 E2 批注' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '查看 E2 附件' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '查看 E2 附件' }).click();
  await page
    .getByRole('button', { name: '删除 budget-note.pdf', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: '单元格附件' }),
  ).not.toContainText('budget-note.pdf');
});
test('拖动矩形选区、填充和 Alt 拖放移动', async ({ page }) => {
  await ready(page);
  await edit(page, 1, 4, '25');
  await cell(page, 1, 4).click();
  const handle = await page
    .getByRole('button', { name: '拖拽填充选区' })
    .boundingBox();
  const destination = await cell(page, 3, 4).boundingBox();
  await page.mouse.move(handle!.x + 3, handle!.y + 3);
  await page.mouse.down();
  await page.mouse.move(destination!.x + 30, destination!.y + 15, {
    steps: 10,
  });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect(cell(page, 3, 4)).toHaveAttribute('data-value', '25');
  await cell(page, 1, 4).click();
  const start = await cell(page, 1, 4).boundingBox();
  const end = await cell(page, 1, 5).boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(start!.x + 30, start!.y + 15);
  await page.mouse.down();
  await page.mouse.move(end!.x + 30, end!.y + 15, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect(cell(page, 1, 5)).toHaveAttribute('data-value', '25');
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '0');
});
test('10 万行按页加载、缓存上限、远端编辑和全数据搜索', async ({ page }) => {
  const pages: BudgetPage[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const captures = new Set<Promise<void>>();
  const capture = (request: Request) => {
    if (!request.url().endsWith('/page')) return;
    const pending = (async () => {
      const response = await request.response();
      if (response?.status() === 200) pages.push((await response.json()).data);
    })()
      .catch((error) => {
        errors.push(String(error));
      })
      .finally(() => captures.delete(pending));
    captures.add(pending);
  };
  // Obsolete prefetches can be aborted after headers arrive. Only completed
  // requests have a readable body; aborted requests are intentionally absent.
  page.on('requestfinished', capture);
  await ready(page);
  pages.length = 0;
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-rowcount',
    '101104',
  );
  await expect(page.locator('.tb-status-bar')).toContainText('101,100 行');
  await expect
    .poll(() => pages.some((item) => item.rows.length === 200))
    .toBe(true);
  expect(pages.every((item) => item.rows.length <= 200)).toBeTruthy();
  expect(pages.flatMap((item) => item.rows).length).toBeLessThanOrEqual(600);
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(cell(page, 101099, 4)).toHaveAttribute('data-value', /\d/);
  await expect
    .poll(() => pages.some((item) => item.offset >= 101000))
    .toBe(true);
  await edit(page, 101099, 4, '98765');
  await expect(cell(page, 101099, 4)).toHaveAttribute('data-value', '98765');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(cell(page, 101099, 4)).not.toHaveAttribute(
    'data-value',
    '98765',
  );
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(cell(page, 101099, 4)).toHaveAttribute('data-value', '98765');
  for (const index of [
    5000, 15000, 25000, 35000, 45000, 55000, 65000, 75000, 85000, 95000,
  ]) {
    await page.locator('.tb-grid-scroll').evaluate((element, row) => {
      element.scrollTop = row * 32;
    }, index);
    await expect(page.locator('.tb-cell.is-loading')).toHaveCount(0);
  }
  const loaded = await page.locator('.tb-status-bar').innerText();
  expect(
    Number(loaded.match(/已加载 ([\d,]+)/)![1].replaceAll(',', '')),
  ).toBeLessThanOrEqual(2000);
  const group = page.locator('.tb-cell.is-organization').first();
  await expect(group).toBeVisible();
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).fill('98765');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).press('Enter');
  await expect(page.locator('.tb-search')).toContainText('1 /');
  await expect(page.locator('.tb-formula-value')).toHaveText('98765');
  page.off('requestfinished', capture);
  await Promise.all(captures);
  expect(errors).toEqual([]);
});
test('网络失败可重试，切换视图丢弃旧页响应', async ({ page }) => {
  await ready(page);
  let fail = true;
  await page.route('**/api/tanstack-budget/project', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '测试：服务暂时不可用' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-rowcount',
    '101104',
  );
  await page.route('**/api/tanstack-budget/page', async (route) => {
    if (route.request().postDataJSON().offset > 200)
      await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {});
  });
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = 50000 * 32;
  });
  await page.getByRole('button', { name: '返回预算样例' }).click();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '40');
  await expect(cell(page, 0, 4)).toHaveAttribute('data-value', '3600');
  await page.waitForTimeout(900);
  await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '40');
});
test('窄屏无页面横向溢出，滚动后金额可编辑', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 900 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollLeft = 500;
  });
  await expect(cell(page, 1, 4)).toBeVisible();
  await edit(page, 1, 4, '2468');
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '2468');
  await page.screenshot({
    path: 'test-results/tanstack-budget/mobile.png',
    fullPage: true,
  });
});

test('右键剪切粘贴、数据追踪与批注删除', async ({ page }) => {
  await ready(page);
  await edit(page, 1, 4, '314');
  await cell(page, 1, 4).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '剪切', exact: true }).click();
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
    '已剪切',
  );
  await cell(page, 2, 4).click();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(cell(page, 2, 4)).toHaveAttribute('data-value', '314');
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '0');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '314');
  await cell(page, 1, 4).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '数据追踪', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: '数据追踪' }),
  ).toContainText('MEM_PERIOD_01');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await page.getByLabel('为这条预算补充说明').fill('临时说明');
  await page.getByRole('button', { name: '保存批注', exact: true }).click();
  await page.getByRole('button', { name: '删除批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await expect(page.getByRole('button', { name: '查看 E2 批注' })).toHaveCount(
    0,
  );
});

test('调整行高、自定义统计、全屏与帮助', async ({ page }) => {
  await ready(page);
  const before = await cell(page, 1, 4).boundingBox();
  const handle = await page
    .getByRole('separator', { name: '调整第2行高度', exact: true })
    .boundingBox();
  await page.mouse.move(handle!.x + 12, handle!.y + 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 12, handle!.y + 27, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await cell(page, 1, 4).boundingBox())!.height)
    .toBeGreaterThan(before!.height + 15);
  await cell(page, 1, 4).click();
  await paste(page, '10\t20');
  await expect(cell(page, 1, 5)).toHaveAttribute('data-value', '20');
  await page.getByRole('button', { name: '统计', exact: true }).click();
  const stats = page.getByRole('complementary', { name: '选区统计' });
  await expect(stats.locator('.tb-stat-list')).toContainText('30');
  await page.getByLabel('自定义统计').selectOption('(MAX + MIN) / 2');
  await expect(stats.locator('.tb-value-card strong')).toHaveText('15');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '全屏显示', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBeTruthy();
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBeFalsy();
  await page.getByRole('button', { name: '查看快捷键与数据说明' }).click();
  await expect(
    page.getByRole('complementary', { name: '使用指南' }),
  ).toContainText('Ctrl/⌘ + C / X / V');
  await page.getByRole('button', { name: '关闭侧栏' }).focus();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('complementary', { name: '使用指南' }),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/tanstack-budget/desktop.png',
    fullPage: true,
  });
});

test('预取分页失败可恢复，保存成功后的刷新失败不重复提交', async ({ page }) => {
  await ready(page);
  let fail = true;
  await page.route('**/api/tanstack-budget/page', async (route) => {
    if (fail && route.request().postDataJSON().offset === 200) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '测试：分页中断' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(page.getByRole('alert')).toContainText('分页中断');
  await page.getByRole('button', { name: '重试当前页', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = 205 * 32;
  });
  await expect(cell(page, 210, 4)).toHaveAttribute('data-value', /\d/);
  await page.getByRole('button', { name: '返回预算样例' }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '600');
  await page.unroute('**/api/tanstack-budget/page');
  let blockRefresh = false;
  let writeCount = 0;
  page.on('response', (response) => {
    if (response.url().endsWith('/write')) {
      blockRefresh = true;
      writeCount += 1;
    }
  });
  await page.route('**/api/tanstack-budget/page', async (route) => {
    if (blockRefresh)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '测试：刷新失败' }),
      });
    else await route.continue();
  });
  await edit(page, 1, 4, '867');
  await expect(page.locator('.tb-toast')).toContainText('修改已保存');
  blockRefresh = false;
  await page.getByRole('button', { name: '重试当前页', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '867');
  expect(writeCount).toBe(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute('data-value', '600');
});

test('十万行全选统计完整，批量操作限制和加载期间的视图保护', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(cell(page, 0, 4)).toHaveAttribute('data-value', /\d/);
  await page.getByRole('button', { name: '选择全部单元格' }).click();
  await expect(page.locator('.tb-status-bar')).toContainText(
    '选中 1,617,600 格',
  );
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('200,000');
  await cell(page, 10, 4).click();
  await page.route('**/api/tanstack-budget/range', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await paste(
    page,
    Array.from({ length: 205 }, (_, index) => String(7000 + index)).join('\n'),
  );
  await expect(
    page.getByRole('button', { name: '返回预算样例' }),
  ).toBeDisabled();
  await expect(page.locator('.tb-toast')).toContainText('已粘贴 205 行');
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = 207 * 32;
  });
  await expect(cell(page, 214, 4)).toHaveAttribute('data-value', '7204');
  await cell(page, 214, 4).click();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(page.locator('.tb-address')).toHaveText('P101100');
  await expect(cell(page, 101099, 15)).toHaveAttribute('data-value', /\d/);
});

test('虚拟长组织块的批注和键盘焦点保持一致，页面不加载 SpreadJS 引擎', async ({
  page,
}) => {
  const resources: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') resources.push(request.url());
  });
  await ready(page);
  expect(resources.some((url) => /spread-sheets.*\.js/.test(url))).toBeFalsy();
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-rowcount',
    '101104',
  );
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = 30 * 32;
  });
  await expect(page.locator('.tb-cell.is-loading')).toHaveCount(0);
  await page.locator('.tb-cell.is-organization').first().click();
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await page.getByLabel('为这条预算补充说明').fill('组织说明跟随合并区域');
  await page.getByRole('button', { name: '保存批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.locator('.tb-grid-scroll').evaluate((element) => {
    element.scrollTop = 500 * 32;
  });
  const organization = page.locator('.tb-cell.is-organization').first();
  await expect(organization.getByTitle('组织说明跟随合并区域')).toBeVisible();
  await expect(organization).toHaveClass(/is-active/);
  // The scroll event can replace virtual rows between the two reads. Wait for
  // the new page and its active descendant together instead of freezing null.
  await expect
    .poll(async () => {
      const activeId = await page
        .getByRole('grid')
        .getAttribute('aria-activedescendant');
      return activeId ? page.locator(`#${activeId}`).count() : 0;
    })
    .toBe(1);
  expect(await page.locator('.tb-grid-row').count()).toBeLessThan(100);
});
