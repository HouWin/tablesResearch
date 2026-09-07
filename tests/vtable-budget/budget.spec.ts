import { test, expect, type Page } from '@playwright/test';
import {
  COLUMNS,
  BUSINESS_DATA,
  BUSINESS_COLUMN_DATA,
} from '../../src/pages/SpreadJSDemo/spreadsheet/model';
import type { BusinessCellChangePayload } from '../../src/pages/SpreadJSDemo/spreadsheet/business-cell-change';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
const value = (page: Page) => page.locator('.tb-formula-value');
async function ready(page: Page, stress = false) {
  await page.goto('/vtable');
  await expect(page.locator('.vt-host canvas').first()).toBeVisible();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  if (stress) {
    await page.getByRole('button', { name: '体验 10 万行数据' }).click();
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  }
}
async function point(page: Page, row: number, col: number) {
  const rect = await page.locator('.vt-host').boundingBox();
  return {
    x:
      rect!.x +
      48 +
      COLUMNS.slice(0, col).reduce((sum, c) => sum + c.width, 0) +
      COLUMNS[col].width / 2,
    y: rect!.y + 112 + row * 32 + 16,
  };
}
async function select(page: Page, row: number, col: number) {
  const p = await point(page, row, col);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.tb-address')).toHaveText(
    `${String.fromCharCode(65 + col)}${row + 1}`,
  );
}
async function edit(page: Page, row: number, col: number, input: string) {
  const p = await point(page, row, col);
  await page.mouse.dblclick(p.x, p.y);
  const editor = page.locator('.vt-editor');
  await expect(editor).toBeVisible();
  await editor.fill(input);
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
}
async function selectedValue(
  page: Page,
  row: number,
  col: number,
  text: string,
) {
  await select(page, row, col);
  await expect(value(page)).toHaveText(text);
}
async function paste(page: Page, text: string) {
  await grid(page).evaluate((element, content) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', content);
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
}

test('VTable 菜单、Canvas 表头、原业务数据、列宽与截图', async ({ page }) => {
  const before = JSON.stringify({ BUSINESS_DATA, BUSINESS_COLUMN_DATA });
  await page.goto('/home');
  await page.getByText('Vtable', { exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(page.locator('.tb-brand')).toHaveText('VTable');
  await selectedValue(page, 0, 4, '3600');
  await expect(page.locator('.vt-host canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '适配列宽', exact: true }).click();
  await expect(page.locator('.vt-host canvas').first()).toBeVisible();
  expect(before).toBe(JSON.stringify({ BUSINESS_DATA, BUSINESS_COLUMN_DATA }));
  const scripts = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  );
  expect(
    scripts.filter((url) =>
      /spread-sheets|SpreadJSDemo.*use-spreadsheet-controller/i.test(url),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: 'test-results/vtable-desktop.png',
    fullPage: true,
  });
});

test('数值、属性、独立汇总、回调 JSON、撤销重做及非法输入', async ({
  page,
}) => {
  const logs: BusinessCellChangePayload[] = [];
  const prefix = '[VTable Budget][单元格修改]\n';
  page.on('console', (message) => {
    if (message.text().startsWith(prefix))
      logs.push(JSON.parse(message.text().slice(prefix.length)));
  });
  await ready(page);
  await edit(page, 1, 4, '1234.5');
  await selectedValue(page, 1, 4, '1234.5');
  await selectedValue(page, 0, 4, '3600');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await selectedValue(page, 1, 4, '600');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await selectedValue(page, 1, 4, '1234.5');
  await edit(page, 1, 2, '销售预算');
  await selectedValue(page, 1, 2, '销售预算');
  await expect.poll(() => logs.length).toBe(4);
  expect(logs[0]).toEqual({
    type: 'value',
    recordId: expect.any(String),
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
  expect(logs[1]).toEqual({ ...logs[0], oldValue: 1234.5, newValue: 600 });
  expect(logs[2]).toEqual(logs[0]);
  expect(logs[3]).toEqual({
    type: 'attribute',
    recordId: logs[0].recordId,
    oldValue: '管理',
    newValue: '销售预算',
    row: logs[0].type === 'value' ? logs[0].dimension.row : {},
    attribute: {
      code: 'ATTR000038',
      owner: {
        dimensionCode: 'DIM0069',
        memberCode: 'MEM_SUBJECT_OFFICE_EXPENSE',
      },
    },
  });
  await select(page, 1, 4);
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('错误金额');
  await page.locator('.vt-editor').press('Enter');
  await expect(page.getByRole('alert')).toContainText('预算金额');
  await page.locator('.vt-editor').press('Escape');
  await expect(value(page)).toHaveText('1234.5');
  await page.getByRole('button', { name: '历史', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: '修改历史' }),
  ).toContainText('1234.5');
});

test('矩形框选、批量粘贴、清空、只读校验、统计与事务', async ({ page }) => {
  await ready(page);
  await select(page, 1, 4);
  await paste(page, '10\t20\n30\t40');
  await expect(page.locator('.tb-status-bar')).toContainText('合计 100.00');
  await selectedValue(page, 2, 5, '40');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await selectedValue(page, 1, 4, '600');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await selectedValue(page, 2, 5, '40');
  const a = await point(page, 1, 4),
    b = await point(page, 2, 5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.tb-status-bar')).toContainText('合计 100.00');
  await grid(page).focus();
  await page.keyboard.press('Delete');
  await selectedValue(page, 2, 5, '0');
  await select(page, 1, 1);
  await paste(page, '不允许\t属性');
  await expect(page.getByRole('alert')).toContainText('只读');
  await selectedValue(page, 1, 2, '管理');
});

test('公式、依赖重算、复制相对引用、循环引用', async ({ page }) => {
  await ready(page);
  await edit(page, 1, 4, '2');
  await edit(page, 1, 5, '3');
  await edit(page, 1, 3, '=SUM(E2:F2)');
  await select(page, 1, 3);
  await expect(value(page)).toHaveText('=SUM(E2:F2)');
  await expect(page.locator('#vtable-active-cell')).toContainText('5');
  await edit(page, 1, 4, '7');
  await select(page, 1, 3);
  await expect(page.locator('#vtable-active-cell')).toContainText('10');
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
    '已复制',
  );
  await select(page, 2, 3);
  await page.keyboard.press('ControlOrMeta+V');
  await expect(value(page)).toHaveText('=SUM(E3:F3)');
  await expect(page.locator('#vtable-active-cell')).toContainText('2400');
  await select(page, 1, 4);
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('=D2');
  await page.locator('.vt-editor').press('Enter');
  await expect(page.getByRole('alert')).toContainText('公式');
  await page.locator('.vt-editor').press('Escape');
});

test('独立层级、隐藏路径搜索、业务定位与钻取', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '13');
  await page.getByRole('button', { name: '收起全部组织', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '5');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).fill('办公费');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).press('Enter');
  await expect(page.locator('.tb-search')).toContainText('1 / 9');
  await expect(value(page)).toHaveText('费用-办公费');
  await page.getByRole('button', { name: '下一个搜索结果' }).click();
  await expect(page.locator('.tb-search')).toContainText('2 / 9');
  await page.getByRole('button', { name: '收起月份', exact: true }).click();
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
  await expect(value(page)).toHaveText('100');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await select(page, 0, 4);
  await page.getByRole('button', { name: '下钻', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: '组织钻取路径' }),
  ).toContainText('华润微电子集团');
  await page.getByRole('button', { name: '上一级', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
});

test('列管理、年度收起、批注附件与右键', async ({ page }) => {
  await ready(page);
  await select(page, 1, 4);
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await page
    .getByRole('textbox', { name: '为这条预算补充说明' })
    .fill('采购预算说明');
  await page.getByRole('button', { name: '保存批注' }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '附件', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'budget.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await expect(
    page.getByRole('complementary', { name: '单元格附件' }),
  ).toContainText('budget.pdf');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await select(page, 1, 4);
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '为这条预算补充说明' }),
  ).toHaveValue('采购预算说明');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '列管理', exact: true }).click();
  await page
    .getByRole('dialog', { name: '列管理' })
    .getByLabel('1月 · 金额', { exact: true })
    .uncheck();
  await page
    .getByRole('button', { name: '恢复显示全部列', exact: true })
    .click();
  await page.getByRole('button', { name: '关闭列管理' }).click();
  await page.getByRole('button', { name: '收起月份', exact: true }).click();
  await expect(page.locator('.tb-status-bar')).toContainText('4 列');
  await page.getByRole('button', { name: '展开月份', exact: true }).click();
  await expect(page.locator('.tb-status-bar')).toContainText('16 列');
  const p = await point(page, 1, 4);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByRole('menu', { name: '单元格操作' })).toBeVisible();
  await page.getByRole('menuitem', { name: '数据追踪', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: '数据追踪' }),
  ).toContainText('后台');
});

test('十万模式分批加载、尾行编辑、缓存上限与跨页统计', async ({ page }) => {
  const pages: { offset: number; count: number }[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('/page') && response.ok()) {
      const body = await response.json();
      pages.push({ offset: body.data.offset, count: body.data.rows.length });
    }
  });
  await ready(page, true);
  await expect.poll(() => pages.length).toBeGreaterThanOrEqual(3);
  expect(pages.every((p) => p.count <= 200)).toBeTruthy();
  expect(pages.length).toBeLessThan(8);
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(page.locator('.tb-address')).toHaveText('P101100');
  await expect(value(page)).not.toContainText('加载');
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('9876.54');
  await page.locator('.vt-editor').press('Enter');
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await expect(value(page)).toHaveText('9876.54');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(value(page)).not.toHaveText('9876.54');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(value(page)).toHaveText('9876.54');
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('.tb-status-bar')).toContainText(
    '选中 1,617,600 格',
  );
  expect(pages.length).toBeLessThan(15);
  expect(pages.some((p) => p.offset === 101000)).toBeTruthy();
  const text = await page.locator('.tb-status-bar').innerText();
  const cached = Number(
    text.match(/已加载 ([\d,]+) 行/)![1].replaceAll(',', ''),
  );
  expect(cached).toBeLessThanOrEqual(2000);
  await page.screenshot({
    path: 'test-results/vtable-stress.png',
    fullPage: true,
  });
});

test('十万模式跨页粘贴、搜索、独立折叠及网络恢复', async ({ page }) => {
  await ready(page, true);
  await select(page, 1, 4);
  await paste(
    page,
    Array.from({ length: 205 }, (_, i) => String(5000 + i)).join('\n'),
  );
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
    '已粘贴 205 行',
  );
  await selectedValue(page, 1, 4, '5000');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(value(page)).not.toHaveText('5000');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(value(page)).toHaveText('5000');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).fill('办公费');
  await page.getByRole('textbox', { name: '搜索完整预算数据' }).press('Enter');
  await expect(page.locator('.tb-search')).toContainText('1 /');
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '1104');
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  await page.route('**/api/tanstack-budget/page', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: '模拟分页失败' }),
    }),
  );
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(page.locator('.tb-inline-error')).toContainText('模拟分页失败');
  await page.unroute('**/api/tanstack-budget/page');
  await page.getByRole('button', { name: '重试当前页', exact: true }).click();
  await expect(page.locator('.tb-inline-error')).toHaveCount(0);
  await expect(value(page)).not.toContainText('加载');
});

test('窄屏、全屏、快捷键与数据访问', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 900 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(page.locator('.tb-address')).toHaveText('P36');
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await page.locator('.vt-editor').fill('777');
  await page.locator('.vt-editor').press('Enter');
  await expect(value(page)).toHaveText('777');
  await page.getByRole('button', { name: '全屏显示' }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBeTruthy();
  await page.getByRole('button', { name: '退出全屏' }).click();
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await expect(page.locator('.vt-editor')).toBeVisible();
  await page.locator('.vt-editor').press('Escape');
  await page.screenshot({
    path: 'test-results/vtable-mobile.png',
    fullPage: true,
  });
});

for (const stress of [false, true]) {
  test(`${
    stress ? '十万模式' : '常规模式'
  }拖拽填充、快捷填充、移动及剪切事务`, async ({ page }) => {
    await ready(page, stress);
    await edit(page, 1, 4, '25');
    await select(page, 1, 4);
    const handle = await page
      .getByRole('button', { name: '拖拽填充选区' })
      .boundingBox();
    const destination = await point(page, 3, 4);
    await page.mouse.move(handle!.x + 3, handle!.y + 3);
    await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 10 });
    await expect(page.locator('.tb-address')).toHaveText('E4');
    await page.mouse.up();
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
    await selectedValue(page, 3, 4, '25');
    await select(page, 1, 4);
    const start = await point(page, 1, 4),
      end = await point(page, 1, 5);
    await page.keyboard.down('Alt');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    // Allow the drag animation frame to observe the final pointer position.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
    await selectedValue(page, 1, 5, '25');
    await selectedValue(page, 1, 4, '0');
    await select(page, 1, 5);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('ControlOrMeta+D');
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
    await selectedValue(page, 2, 5, '25');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('ControlOrMeta+R');
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
    await selectedValue(page, 2, 6, '25');
    await page.keyboard.press('ControlOrMeta+X');
    await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
      '已剪切',
    );
    await select(page, 3, 6);
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
      '已粘贴',
    );
    await selectedValue(page, 3, 6, '25');
    await selectedValue(page, 2, 6, '0');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(value(page)).toHaveText('25');
  });
}

test('Canvas 层级按钮、列宽行高调整、自定义统计与帮助', async ({ page }) => {
  await ready(page);
  const organization = await point(page, 0, 0);
  await page.mouse.click(organization.x, organization.y);
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '8');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  const subject = await point(page, 0, 1);
  await page.mouse.click(subject.x, subject.y);
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '37');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await select(page, 1, 4);
  await paste(page, '10\t20');
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText(
    '已粘贴',
  );
  await page.getByRole('button', { name: '统计', exact: true }).click();
  const stats = page.getByRole('complementary', { name: '选区统计' });
  await expect(stats.locator('.tb-stat-list')).toContainText('30');
  await page.getByLabel('自定义统计').selectOption('(MAX + MIN) / 2');
  await expect(stats.locator('.tb-value-card strong')).toHaveText('15');
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await select(page, 1, 3);
  const handle = page.getByRole('button', { name: '拖拽填充选区' });
  const before = await handle.boundingBox();
  const host = await page.locator('.vt-host').boundingBox();
  const colEdge = (await point(page, 1, 3)).x + COLUMNS[3].width / 2;
  await page.mouse.move(colEdge, host!.y + 100);
  await page.mouse.down();
  await page.mouse.move(colEdge + 45, host!.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await handle.boundingBox())!.x)
    .toBeGreaterThan(before!.x + 30);
  const beforeRow = await handle.boundingBox();
  const rowEdge = host!.y + 112 + 2 * 32;
  await page.mouse.move(host!.x + 25, rowEdge);
  await page.mouse.down();
  await page.mouse.move(host!.x + 25, rowEdge + 24, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await handle.boundingBox())!.y)
    .toBeGreaterThan(beforeRow!.y + 15);
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await expect(page.locator('.vt-editor')).toBeVisible();
  await page.locator('.vt-editor').press('Escape');
  await page.getByRole('button', { name: '查看快捷键与数据说明' }).click();
  await expect(
    page.getByRole('complementary', { name: '使用指南' }),
  ).toContainText('Ctrl/⌘ + C / X / V');
});

test('十万模式连续滚动有界缓存、取消旧页与初始化重试', async ({ page }) => {
  await ready(page);
  let fail = true;
  await page.route('**/api/tanstack-budget/project', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '初始化暂时失败' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(page.getByRole('alert')).toContainText('初始化暂时失败');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  let received = 0;
  page.on('response', async (response) => {
    if (response.url().endsWith('/page') && response.ok()) {
      const result = await response.json();
      expect(result.data.rows.length).toBeLessThanOrEqual(200);
      received += result.data.rows.length;
    }
  });
  const host = await page.locator('.vt-host').boundingBox();
  await page.mouse.move(host!.x + 760, host!.y + 200);
  for (let i = 0; i < 12; i++) {
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/page') && r.ok()),
      page.mouse.wheel(0, 25000),
    ]);
  }
  const status = await page.locator('.tb-status-bar').innerText();
  expect(
    Number(status.match(/已加载 ([\d,]+)/)![1].replaceAll(',', '')),
  ).toBeLessThanOrEqual(2000);
  expect(received).toBeLessThan(10000);
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let oldPage = false;
  await page.route('**/api/tanstack-budget/page', async (route) => {
    if (route.request().postDataJSON().offset >= 101000) {
      oldPage = true;
      await delayed;
    }
    await route.continue().catch(() => {});
  });
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect.poll(() => oldPage).toBeTruthy();
  await page.getByRole('button', { name: '返回预算样例' }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  release();
  await selectedValue(page, 0, 4, '3600');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
});

test('保存已成功但刷新失败时只提交一次，重试后可撤销', async ({ page }) => {
  await ready(page);
  let blockRefresh = false,
    writes = 0;
  page.on('response', (response) => {
    if (response.url().endsWith('/write')) {
      blockRefresh = true;
      writes += 1;
    }
  });
  await page.route('**/api/tanstack-budget/page', async (route) => {
    if (blockRefresh)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '刷新失败' }),
      });
    else await route.continue();
  });
  await edit(page, 1, 4, '867');
  await expect(page.locator('.tb-toast')).toContainText('修改已保存');
  blockRefresh = false;
  await page.getByRole('button', { name: '重试当前页', exact: true }).click();
  await selectedValue(page, 1, 4, '867');
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(value(page)).toHaveText('600');
});

test('编辑滚动、中文输入法和错误输入保留', async ({ page }) => {
  await ready(page, true);
  await select(page, 1, 2);
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  const editor = page.locator('.vt-editor');
  await editor.dispatchEvent('compositionstart');
  await editor.fill('中文预算说明');
  await editor.press('Enter');
  await expect(editor).toBeVisible();
  await editor.dispatchEvent('compositionend', { data: '中文预算说明' });
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
  await selectedValue(page, 1, 2, '中文预算说明');
  await select(page, 1, 4);
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await editor.fill('666');
  const host = await page.locator('.vt-host').boundingBox();
  await page.mouse.move(host!.x + 800, host!.y + 200);
  await page.mouse.wheel(0, 1200);
  await expect(editor).toHaveCount(0);
  await selectedValue(page, 1, 4, '666');
  await page.getByRole('button', { name: '编辑当前单元格' }).click();
  await editor.fill('不是金额');
  await page.mouse.move(host!.x + 800, host!.y + 200);
  await page.mouse.wheel(0, 1200);
  await expect(page.getByRole('alert')).toContainText('预算金额');
  await expect(editor).toBeFocused();
  await editor.press('Escape');
  await expect(value(page)).toHaveText('666');
});

test('十万模式附件、批注和公式经分页与折叠保持业务关联', async ({ page }) => {
  await ready(page, true);
  await edit(page, 1, 4, '=2+3');
  await select(page, 1, 4);
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await page.getByLabel('为这条预算补充说明').fill('十万行记录批注');
  await page.getByRole('button', { name: '保存批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '附件', exact: true }).click();
  await page.getByLabel('添加附件').setInputFiles({
    name: 'evidence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await grid(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(value(page)).toHaveText(/^\d/);
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '1104');
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  await selectedValue(page, 1, 4, '=2+3');
  await expect(page.locator('#vtable-active-cell')).toContainText('5');
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await expect(page.getByLabel('为这条预算补充说明')).toHaveValue(
    '十万行记录批注',
  );
  await page.getByRole('button', { name: '删除批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.getByRole('button', { name: '附件', exact: true }).click();
  const panel = page.getByRole('complementary', { name: '单元格附件' });
  await expect(panel).toContainText('evidence.pdf');
  const download = page.waitForEvent('download');
  await panel
    .getByRole('link', { name: '下载 evidence.pdf', exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe('evidence.pdf');
  await page
    .getByRole('button', { name: '删除 evidence.pdf', exact: true })
    .click();
  await expect(panel).not.toContainText('evidence.pdf');
});

for (const stress of [false, true]) {
  test(`${
    stress ? '十万' : '普通'
  }模式折叠展开等待分页时保留 Canvas，原位更新后可继续编辑`, async ({
    page,
  }) => {
    await ready(page, stress);
    const canvas = await page
      .locator('.vt-host canvas')
      .first()
      .elementHandle();
    const total = stress ? 101104 : 40;
    for (const col of [0, 1]) {
      // The first ten stress rows are summaries without subject children.
      const row = stress && col === 1 ? 10 : 0;
      for (const expanding of [false, true]) {
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        let requested = false;
        await page.route('**/api/tanstack-budget/page', async (route) => {
          requested = true;
          await held;
          await route.continue().catch(() => {});
        });
        const target = await point(page, row, col);
        await page.mouse.click(target.x, target.y);
        await expect.poll(() => requested).toBe(true);
        await expect(grid(page)).toHaveAttribute('aria-busy', 'true');
        await expect(page.locator('.tb-loading')).toHaveCount(0);
        expect(await canvas!.evaluate((element) => element.isConnected)).toBe(
          true,
        );
        await expect(page.locator('.vt-host canvas').first()).toBeVisible();
        await expect(value(page)).not.toHaveText('正在加载…');
        if (stress && col === 1 && !expanding)
          await page.screenshot({
            path: 'test-results/vtable-fold-pending.png',
          });
        // Even with focus retained by the grid, writes cannot use the old projection.
        await page.keyboard.press('Delete');
        release();
        await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
        await expect(grid(page)).toHaveAttribute(
          'aria-rowcount',
          String(
            expanding
              ? total
              : total - (col === 0 ? (stress ? 10100 : 32) : stress ? 100 : 3),
          ),
        );
        expect(await canvas!.evaluate((element) => element.isConnected)).toBe(
          true,
        );
        await page.unroute('**/api/tanstack-budget/page');
      }
    }
    await edit(page, 1, 4, '2468');
    await selectedValue(page, 1, 4, '2468');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(value(page)).not.toHaveText('2468');
  });
}

test('十万模式远处科目折叠保留滚动位置，仅加载当前分页，失败时保留画面并可重试', async ({
  page,
}) => {
  await ready(page, true);
  const canvas = await page.locator('.vt-host canvas').first().elementHandle();
  const rect = await page.locator('.vt-host').boundingBox();
  // Subject summary at index 414 (10 root summaries + four groups of 101 rows).
  await page.mouse.move(rect!.x + 760, rect!.y + 200);
  await page.mouse.wheel(0, 414 * 32);
  const target = { x: (await point(page, 0, 1)).x, y: rect!.y + 128 };
  const valueX = (await point(page, 0, 3)).x;
  await expect
    .poll(async () => {
      await page.mouse.click(valueX, target.y);
      return page.locator('.tb-address').innerText();
    })
    .toMatch(/415$/);
  const offsets: number[] = [];
  let fail = true;
  await page.route('**/api/tanstack-budget/page', async (route) => {
    offsets.push(route.request().postDataJSON().offset);
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '折叠分页暂时失败' }),
      });
    else await route.continue();
  });
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('alert')).toContainText('折叠分页暂时失败');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  fail = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101004');
  await page.mouse.click(valueX, target.y);
  await expect(page.locator('.tb-address')).toHaveText('D415');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  expect(offsets.length).toBeGreaterThan(0);
  expect(offsets.every((offset) => offset >= 400 && offset <= 600)).toBe(true);
  await page.mouse.click(target.x, target.y);
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  await page.mouse.click(valueX, target.y);
  await expect(page.locator('.tb-address')).toHaveText('D415');
  await page.screenshot({ path: 'test-results/vtable-fold-restored.png' });
});
