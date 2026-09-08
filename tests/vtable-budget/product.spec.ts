import { test, expect, type Page } from '@playwright/test';
import { COLUMNS } from '../../src/pages/TanStackBudget/core/columns';

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
async function point(page: Page, row: number, col: number) {
  const rect = (await page.locator('.vt-host').boundingBox())!;
  return {
    x:
      rect.x +
      48 +
      COLUMNS.slice(0, col).reduce((sum, column) => sum + column.width, 0) +
      COLUMNS[col].width / 2,
    y: rect.y + 112 + row * 32 + 16,
  };
}
async function select(page: Page, row = 1, col = 4) {
  const at = await point(page, row, col);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('.tb-address')).toHaveText(
    `${String.fromCharCode(65 + col)}${row + 1}`,
  );
}
async function edit(page: Page, text: string) {
  const at = await point(page, 1, 4);
  await page.mouse.dblclick(at.x, at.y);
  await page.locator('.vt-editor').fill(text);
}

test('编辑时一次点击层级命令：先保存一次，再切换视图', async ({ page }) => {
  const writes: unknown[] = [];
  await page.route('**/api/tanstack-budget/write', async (route) => {
    writes.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await edit(page, '987.65');
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '13');
  expect(writes).toHaveLength(1);
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await select(page);
  await expect(page.locator('.tb-formula-value')).toHaveText('987.65');
  await expect(page.locator('.tb-save-status')).toHaveText('本次修改已保存');
});

test('非法金额保留编辑和视图，显示持久校验提示，可取消或修正', async ({
  page,
}) => {
  await edit(page, '不是金额');
  await page.getByRole('button', { name: '收起全部科目', exact: true }).click();
  const editor = page.locator('.vt-editor');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect(editor).toHaveValue('不是金额');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await expect(page.locator('#vtable-edit-error')).toContainText('预算金额');
  await page.getByRole('button', { name: '取消当前编辑' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('600');
  await edit(page, '765');
  await page.getByRole('button', { name: '保存当前单元格' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('765');
});

test('反向选区折叠月份，全年合计隐藏时仍保持有效选区', async ({ page }) => {
  await select(page);
  await grid(page).press('Shift+ArrowLeft');
  await page.getByRole('button', { name: '收起月份', exact: true }).click();
  await expect(page.locator('.tb-address')).toHaveText('D2');
  await expect(page.locator('.tb-status-bar')).toContainText('选中 1 格');
  await page.getByRole('button', { name: '列管理', exact: true }).click();
  const columns = page.getByRole('dialog', { name: '列管理' });
  await columns.getByRole('checkbox', { name: '全年合计' }).uncheck();
  await page.getByRole('button', { name: '关闭列管理' }).click();
  await expect(page.locator('.tb-address')).toHaveText('C2');
  await grid(page).press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('C2');
  await page.getByRole('button', { name: '展开月份', exact: true }).click();
  await grid(page).press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('E2');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await expect(page.locator('.tb-address')).toHaveText('C1');
  await expect(page.locator('.tb-status-bar')).toContainText('选中 1 格');
});

test('方向键停留在边界，Tab 换行；键盘菜单只读保护与焦点返回', async ({
  page,
}) => {
  await grid(page).focus();
  await grid(page).press('Home');
  await grid(page).press('ArrowLeft');
  await expect(page.locator('.tb-address')).toHaveText('A1');
  await grid(page).press('Shift+F10');
  const menu = page.getByRole('menu', { name: '单元格操作' });
  await expect(
    menu.getByRole('menuitem', { name: '复制', exact: true }),
  ).toBeFocused();
  await expect(
    menu.getByRole('menuitem', { name: '剪切', exact: true }),
  ).toBeDisabled();
  await expect(
    menu.getByRole('menuitem', { name: '清空', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('End');
  await expect(
    menu.getByRole('menuitem', { name: '下钻到下一级' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(grid(page)).toBeFocused();
  await grid(page).press('End');
  await grid(page).press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('P1');
  await grid(page).press('Tab');
  // SpreadJS displays the merge origin, while continuing across the second row.
  await expect(page.locator('.tb-address')).toHaveText('A1');
  await grid(page).press('Tab');
  await expect(page.locator('.tb-address')).toHaveText('B2');
  await grid(page).press('ArrowLeft');
  await expect(page.locator('.tb-address')).toHaveText('A1');
  await grid(page).press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('B2');
  await grid(page).press('Shift+Tab');
  await expect(page.locator('.tb-address')).toHaveText('A1');
  await grid(page).press('Shift+Tab');
  await expect(page.locator('.tb-address')).toHaveText('P1');
});

test('菜单打开侧栏后可立即输入批注，Escape 返回表格', async ({ page }) => {
  await select(page);
  await grid(page).press('Shift+F10');
  await page.getByRole('menuitem', { name: '批注', exact: true }).click();
  await expect(page.getByLabel('为这条预算补充说明')).toBeFocused();
  await page.getByLabel('为这条预算补充说明').fill('键盘操作记录');
  await page.getByRole('button', { name: '保存批注' }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('complementary', { name: '单元格批注' }),
  ).toHaveCount(0);
  await expect(grid(page)).toBeFocused();
});

test('修改搜索词立即取消旧搜索；清除搜索可继续输入', async ({ page }) => {
  let finished = false;
  await page.route('**/api/tanstack-budget/search', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ response });
    finished = true;
  });
  const search = page.getByRole('textbox', { name: '搜索完整预算数据' });
  await search.fill('电费');
  await search.press('Enter');
  await expect(page.locator('.tb-search')).toContainText('查找中');
  await search.fill('不会匹配的新词');
  await expect.poll(() => finished).toBe(true);
  await expect(page.locator('.tb-address')).toHaveText('D1');
  await expect(page.locator('.tb-search > span')).toHaveText('');
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
});

test('拖拽填充时 Escape 取消，不写入任何单元格', async ({ page }) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/write')) writes++;
  });
  await select(page);
  const handle = (await page
    .getByRole('button', { name: '拖拽填充选区' })
    .boundingBox())!;
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  const destination = await point(page, 3, 4);
  await page.mouse.move(destination.x, destination.y, { steps: 5 });
  await expect(page.locator('.tb-address')).toHaveText('E4');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.tb-address')).toHaveText('E2');
  await expect(page.locator('.tb-status-bar')).toContainText('选中 1 格');
  expect(writes).toBe(0);
  await select(page, 3, 4);
  await expect(page.locator('.tb-formula-value')).toHaveText('1800');
});

test('附件上传区域接受拖放，390px 窄屏无页面横向溢出', async ({ page }) => {
  await select(page);
  await page.getByRole('button', { name: '附件', exact: true }).click();
  await page.locator('.tb-upload').evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(
      new File(['budget'], '预算说明.pdf', { type: 'application/pdf' }),
    );
    element.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(
    page.getByRole('link', { name: '下载 预算说明.pdf' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(grid(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/vtable-product-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({
    path: 'test-results/vtable-product-desktop.png',
    fullPage: true,
  });
});

test('编辑中点击撤销读取刚保存的事务，重做恢复该值', async ({ page }) => {
  await edit(page, '700');
  await page.locator('.vt-editor').press('Enter');
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await edit(page, '800');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.vt-editor')).toHaveCount(0);
  await expect(page.locator('.tb-formula-value')).toHaveText('700');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.locator('.tb-formula-value')).toHaveText('800');
});
