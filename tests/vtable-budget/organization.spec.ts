import { test, expect, type Page } from '@playwright/test';
import type { ListTable } from '@visactor/vtable';
import type { BudgetRow } from '../../src/pages/TanStackBudget/core/types';

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
const errors = new WeakMap<Page, string[]>();
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
async function ready(page: Page) {
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
}
async function selection(page: Page) {
  return read(page, (table) => {
    const range = table.getSelectedCellRanges().at(-1)!;
    return {
      top: Math.min(range.start.row, range.end.row),
      bottom: Math.max(range.start.row, range.end.row),
      left: Math.min(range.start.col, range.end.col),
      right: Math.max(range.start.col, range.end.col),
      heights: [...table.scenegraph.selectedRangeComponents.values()].map(
        (part) => part.rect.attribute.height,
      ),
    };
  });
}
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test('对照 SpreadJS：叶子组织整块选中，父组织合并区域任意位置折叠', async ({
  page,
}) => {
  await page.goto('/spreadjs-demo/business');
  await expect(page.locator('.spread-host canvas').first()).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.name-box')).toHaveText('A1');
  const host = (await page.locator('.spread-host').boundingBox())!;
  await page.mouse.click(host.x + 90, host.y + 298);
  await expect(page.locator('.name-box')).toHaveText('A5');
  await expect(page.locator('.spreadjs-demo-page')).toContainText('选区 4 格');
  await page.mouse.click(host.x + 90, host.y + 226);
  await expect(page.locator('.name-box')).toHaveText('A1');
  await expect(page.locator('.spreadjs-demo-page')).toContainText(
    '4 行 × 16 列',
  );
  await page.mouse.click(host.x + 90, host.y + 226);
  await expect(page.locator('.spreadjs-demo-page')).toContainText(
    '36 行 × 16 列',
  );
  await page.screenshot({
    path: 'test-results/organization-spreadjs-reference.png',
  });
  await page.mouse.click(host.x + 90, host.y + 298);
  await page.keyboard.press('ArrowUp');
  for (let column = 0; column < 15; column++)
    await page.keyboard.press('ArrowRight');
  await expect(page.locator('.name-box')).toHaveText('P1');
  await page.keyboard.press('Tab');
  await expect(page.locator('.name-box')).toHaveText('A1');
  await page.keyboard.press('Tab');
  await expect(page.locator('.name-box')).toHaveText('B2');
});

test('叶子组织文字、空白及内部行边界均选中整个合并区，保持起始格地址', async ({
  page,
}) => {
  await ready(page);
  const host = (await page.locator('.vt-host').boundingBox())!;
  let queries = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/project')) queries++;
  });
  for (const [x, y] of [
    [65, 250],
    [140, 272],
    [100, 304],
    [230, 336],
    [230, 362],
  ]) {
    await page.mouse.click(host.x + x, host.y + y);
    await expect(page.locator('.tb-address')).toHaveText('A5');
    await expect(page.locator('.tb-cell-context')).toContainText(
      '华润微电子本部 / 日常费用合计',
    );
    await expect
      .poll(() => selection(page))
      .toMatchObject({ top: 8, bottom: 11, left: 1, right: 1 });
    expect((await selection(page)).heights).toContain(128);
    await expect(page.locator('.tb-status-bar')).toContainText('选中 4 格');
  }
  expect(queries).toBe(0);
  await expect(page.locator('.tb-toast')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/organization-vtable-selection.png',
  });
  await grid(page).press('ArrowUp');
  await expect(page.locator('.tb-address')).toHaveText('A1');
  await grid(page).press('ArrowDown');
  await expect(page.locator('.tb-address')).toHaveText('A5');
  await grid(page).press('ArrowDown');
  await expect(page.locator('.tb-address')).toHaveText('A9');
  await grid(page).press('ArrowRight');
  await expect(page.locator('.tb-address')).toHaveText('B9');
  await grid(page).press('ArrowDown');
  await expect(page.locator('.tb-address')).toHaveText('B10');
});

test('父组织居中箭头与合并区空白处每次只切换一次，不误调整行高', async ({
  page,
}) => {
  await ready(page);
  const host = (await page.locator('.vt-host').boundingBox())!;
  let queries = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/project')) queries++;
  });
  for (const [index, [x, y]] of [
    [65, 176],
    [230, 224],
    [145, 144],
    [100, 208],
  ].entries()) {
    await page.mouse.click(host.x + x, host.y + y);
    await expect(grid(page)).toHaveAttribute(
      'aria-rowcount',
      index % 2 ? '40' : '8',
    );
    await expect(page.locator('.tb-address')).toHaveText('A1');
    await expect
      .poll(() => selection(page))
      .toMatchObject({ top: 4, bottom: 7, left: 1, right: 1 });
    expect(
      await read(page, (table) =>
        [4, 5, 6, 7].map((row) => table.getRowHeight(row)),
      ),
    ).toEqual([32, 32, 32, 32]);
    expect(queries).toBe(index + 1);
  }
});

for (const width of [1600, 700]) {
  test(`选中组织后反复滑动保持浅色背景，不累积绘制层（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await ready(page);
    await grid(page).press('Home');
    const host = (await page.locator('.vt-host').boundingBox())!;
    const rect = await read(page, (table) => {
      const cell = table.getCellRelativeRect(1, 8);
      return { right: cell.right, top: cell.top };
    });
    await page.mouse.click(host.x + rect.right - 24, host.y + rect.top + 16);
    await expect(page.locator('.tb-address')).toHaveText('A5');
    const paint = () =>
      page
        .locator('.vt-host canvas')
        .first()
        .evaluate((canvas) => {
          const element = canvas as HTMLCanvasElement & {
            __vtable__: ListTable;
          };
          const table = element.__vtable__;
          const cell = table.getCellRelativeRect(1, 8);
          const scale = element.width / element.getBoundingClientRect().width;
          const pixel = [
            ...element
              .getContext('2d')!
              .getImageData(
                Math.round((cell.right - 24) * scale),
                Math.round((cell.top + 16) * scale),
                1,
                1,
              ).data,
          ];
          return {
            pixel,
            layers: [...table.scenegraph.selectedRangeComponents.values()].map(
              (part) => part.rect.parent!.childrenCount,
            ),
          };
        });
    const before = await paint();
    expect(before.layers).toEqual([1]);
    expect(before.pixel[0]).toBeGreaterThan(210);
    const expectStablePaint = () =>
      expect
        .poll(async () => {
          const after = await paint();
          return {
            layers: after.layers,
            // Canvas compositing can round a channel by one between frames.
            sameColor: after.pixel.every(
              (value, channel) => Math.abs(value - before.pixel[channel]) <= 2,
            ),
          };
        })
        .toEqual({ layers: [1], sameColor: true });
    // Small wheel events reproduce a trackpad swipe. The old code added one
    // translucent rectangle per event, darkening both the fill and the label.
    for (const direction of [1, -1, 1]) {
      for (let step = 0; step < 12; step++) {
        const previous = await read(page, (table) => table.scrollTop);
        await page.mouse.wheel(0, direction * 6);
        await expect
          .poll(() => read(page, (table) => table.scrollTop))
          .toBe(previous + direction * 6);
      }
      await expectStablePaint();
      await expect(page.locator('.tb-address')).toHaveText('A5');
    }
    // Changing the selected block must also remove the preceding overlay.
    const first = await read(page, (table) => {
      const cell = table.getCellRelativeRect(2, 6);
      return { right: cell.right, top: cell.top };
    });
    await page.mouse.click(host.x + first.right - 24, host.y + first.top + 16);
    const leaf = await read(page, (table) => {
      const cell = table.getCellRelativeRect(1, 8);
      return { right: cell.right, top: cell.top };
    });
    await page.mouse.click(host.x + leaf.right - 24, host.y + leaf.top + 16);
    await expectStablePaint();
    await page.screenshot({
      path: `test-results/organization-scroll-${width}.png`,
    });
  });
}

test('只有行号分隔线调整行高，支持取消及键盘微调；组织菜单归属不随内部行变化', async ({
  page,
}) => {
  await ready(page);
  const host = (await page.locator('.vt-host').boundingBox())!;
  await page.mouse.click(host.x + 220, host.y + 352, { button: 'right' });
  await expect(page.locator('.tb-address')).toHaveText('A5');
  await page.getByRole('menuitem', { name: '批注', exact: true }).click();
  await page.getByLabel('为这条预算补充说明').fill('整块组织批注');
  await page.getByRole('button', { name: '保存批注', exact: true }).click();
  await page.getByRole('button', { name: '关闭侧栏' }).click();
  const handle = page.getByRole('separator', {
    name: '调整第 6 行高度',
    exact: true,
  });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 27, { steps: 5 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '56');
  await handle.press('ArrowUp');
  await expect(handle).toHaveAttribute('aria-valuenow', '52');
  const moved = (await handle.boundingBox())!;
  await page.mouse.move(moved.x + 20, moved.y + 3);
  await page.mouse.down();
  await page.mouse.move(moved.x + 20, moved.y + 23, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '52');
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '32');
  await page.mouse.click(host.x + 230, host.y + 255);
  await page.getByRole('button', { name: '批注', exact: true }).click();
  await expect(page.getByLabel('为这条预算补充说明')).toHaveValue(
    '整块组织批注',
  );
});

test('十万行屏幕外起始格的组织合并区仍整块选中，不跳回顶部或加载整表', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '101104');
  await read(page, (table) => {
    table.scrollTop = 20850 * 32;
    table.render();
  });
  let record: BudgetRow;
  await expect
    .poll(async () => {
      record = await read(
        page,
        (table) =>
          table.getCellOriginRecord(
            1,
            table.getBodyVisibleRowRange().rowStart,
          ) as BudgetRow,
      );
      return Boolean(record?.productId);
    })
    .toBe(true);
  const before = await read(page, (table) => table.scrollTop);
  const host = (await page.locator('.vt-host').boundingBox())!;
  const offsets: number[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/page'))
      offsets.push(request.postDataJSON().offset);
  });
  await page.mouse.click(host.x + 180, host.y + 192, { button: 'right' });
  await expect(page.locator('.tb-address')).toHaveText(
    `A${record!.blockStart + 1}`,
  );
  await expect(page.locator('.tb-formula-value')).toHaveText(
    record!.productLabel,
  );
  await expect(page.locator('.tb-status-bar')).toContainText(
    `选中 ${record!.productRowSpan.toLocaleString('en-US')} 格`,
  );
  expect(await read(page, (table) => table.scrollTop)).toBe(before);
  const drawn = await selection(page);
  expect(drawn.bottom - drawn.top).toBeLessThan(200);
  expect(
    offsets.every(
      (offset) =>
        offset === Math.floor(record!.blockStart / 200) * 200 ||
        (offset >= 20800 && offset <= 21000),
    ),
  ).toBe(true);
  await expect(
    page.getByRole('menuitem', { name: '复制', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: '单元格操作' })).toHaveCount(0);
  for (let step = 0; step < 6; step++) {
    const previous = await read(page, (table) => table.scrollTop);
    await page.mouse.wheel(0, 24);
    await expect
      .poll(() => read(page, (table) => table.scrollTop))
      .toBe(previous + 24);
    await expect
      .poll(() =>
        read(page, (table) =>
          [...table.scenegraph.selectedRangeComponents.values()].map(
            (part) => part.rect.parent!.childrenCount,
          ),
        ),
      )
      .toEqual([1]);
  }
  await expect(page.locator('.tb-address')).toHaveText(
    `A${record!.blockStart + 1}`,
  );
  await page.screenshot({
    path: 'test-results/organization-vtable-offscreen.png',
  });
});
