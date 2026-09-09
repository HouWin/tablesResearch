import { test, expect, type Page } from '@playwright/test';
import type { ListTable } from '@visactor/vtable';
import type { BudgetRow } from '../../src/pages/TanStackBudget/core/types';

const grid = (page: Page) =>
  page.getByRole('grid', { name: '费用预算表', exact: true });
async function ready(page: Page) {
  await page.goto('/vtable');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', '40');
  await page.getByRole('button', { name: '体验 10 万行数据' }).click();
  await count(page, 101100);
}
async function count(page: Page, rows: number) {
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', String(rows + 4));
}
async function at(page: Page, row: number, col = 2) {
  return page
    .locator('.vt-host canvas')
    .first()
    .evaluate(
      (canvas, { row, col }) => {
        const table = (canvas as HTMLCanvasElement & { __vtable__: ListTable })
          .__vtable__;
        const rect = table.getCellRelativeRect(col, row + 4);
        const record = table.getCellOriginRecord(col, row + 4) as
          | BudgetRow
          | undefined;
        return {
          left: rect.left,
          top: rect.top,
          scroll: table.scrollTop,
          label: table.getCellValue(col, row + 4),
          id: record?.sourceNodes[0].id,
          subject: record?.regionLabel,
          group: record?.regionIsGroup,
          expanded: record?.regionExpanded,
          span: record?.productRowSpan,
        };
      },
      { row, col },
    );
}
async function scrollTo(page: Page, row: number) {
  await page
    .locator('.vt-host canvas')
    .first()
    .evaluate((canvas, index) => {
      const table = (canvas as HTMLCanvasElement & { __vtable__: ListTable })
        .__vtable__;
      table.scrollTop = index * 32;
    }, row);
  await expect.poll(async () => (await at(page, row)).id).toBeTruthy();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function click(page: Page, row: number, col = 2) {
  const host = (await page.locator('.vt-host').boundingBox())!;
  const cell = await at(page, row, col);
  await page.mouse.click(host.x + cell.left + 42, host.y + cell.top + 16);
}
async function expectOrganizationLabel(page: Page, row: number) {
  await expect
    .poll(async () =>
      page
        .locator('.vt-host canvas')
        .first()
        .evaluate((canvas, index) => {
          const table = (
            canvas as HTMLCanvasElement & { __vtable__: ListTable }
          ).__vtable__;
          const range = table.getCellRange(1, index + 4);
          const text = table.scenegraph
            .getCell(1, index + 4)
            .getChildByName('text', true);
          if (!text) return Infinity;
          const top = Math.max(
            table.getFrozenRowsHeight(),
            table.getCellRelativeRect(1, range.start.row).top,
          );
          const bottom = Math.min(
            table.tableNoFrameHeight,
            table.getCellRelativeRect(1, range.end.row).bottom,
          );
          const center =
            (text.globalAABBBounds.y1 + text.globalAABBBounds.y2) / 2;
          return Math.abs(center - (top + bottom) / 2);
        }, row),
    )
    .toBeLessThanOrEqual(4);
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test('十万模式与常规模式一致：组织折叠后科目仍可独立收展，父子状态互不覆盖', async ({
  page,
}) => {
  await ready(page);
  const canvas = await page.locator('.vt-host canvas').first().elementHandle();
  await page.getByRole('button', { name: '收起全部组织', exact: true }).click();
  await count(page, 10100);
  expect(await at(page, 0)).toMatchObject({
    group: true,
    expanded: true,
    span: 1010,
  });
  await click(page, 0);
  await count(page, 10000);
  expect(await at(page, 0)).toMatchObject({ expanded: false, span: 910 });
  expect((await at(page, 0)).label).toContain('▸');
  expect((await at(page, 1)).subject).toBe('人力成本合计');
  await click(page, 0, 1);
  await count(page, 19100);
  await scrollTo(page, 910);
  expect(await at(page, 910)).toMatchObject({
    group: true,
    expanded: true,
    span: 910,
  });
  await click(page, 910);
  await count(page, 19010);
  expect(await at(page, 910)).toMatchObject({ expanded: false, span: 820 });
  await scrollTo(page, 0);
  expect((await at(page, 0)).expanded).toBe(false);
  await click(page, 0, 1);
  await count(page, 10000);
  await click(page, 0, 1);
  await count(page, 19010);
  await scrollTo(page, 910);
  expect((await at(page, 910)).expanded).toBe(false);
  await scrollTo(page, 0);
  await click(page, 0);
  await count(page, 19110);
  await scrollTo(page, 1010);
  expect((await at(page, 1010)).expanded).toBe(false);
  await page.getByRole('button', { name: '展开全部组织', exact: true }).click();
  await count(page, 101010);
  await page.getByRole('button', { name: '展开全部科目', exact: true }).click();
  await count(page, 101100);
  await page.getByRole('button', { name: '收起全部层级', exact: true }).click();
  await count(page, 100);
  await click(page, 0);
  await count(page, 200);
  expect((await at(page, 1)).subject).toBe('办公费 · 001');
  await page.getByRole('button', { name: '恢复默认视图', exact: true }).click();
  await count(page, 101100);
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
});

for (const region of [0, 1, 9]) {
  test(`十万模式区域 ${
    region + 1
  } 的首中尾科目跨分页反复收展，保持合并范围和点击位置`, async ({ page }) => {
    await ready(page);
    await page
      .getByRole('button', { name: '收起全部组织', exact: true })
      .click();
    await count(page, 10100);
    const sizes: number[] = [];
    page.on('response', async (response) => {
      if (response.url().endsWith('/page') && response.ok()) {
        const body = await response.json().catch(() => null);
        if (body?.data?.rows) sizes.push(body.data.rows.length);
      }
    });
    for (const group of [0, 4, 9]) {
      const row = region * 1010 + group * 101;
      await scrollTo(page, row);
      const before = await at(page, row);
      expect(before).toMatchObject({ group: true, expanded: true, span: 1010 });
      await expectOrganizationLabel(page, row);
      for (const expanded of [false, true, false, true]) {
        await click(page, row);
        await count(page, expanded ? 10100 : 10000);
        const after = await at(page, row);
        expect(after).toMatchObject({
          id: before.id,
          top: before.top,
          scroll: before.scroll,
          expanded,
          span: expanded ? 1010 : 910,
        });
        expect(after.label).toContain(expanded ? '▾' : '▸');
        await expectOrganizationLabel(page, row);
      }
    }
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((size) => size <= 200)).toBe(true);
    const loaded = (await page.locator('.tb-status-bar').innerText()).match(
      /已加载 ([\d,]+) 行/,
    )!;
    expect(Number(loaded[1].replaceAll(',', ''))).toBeLessThanOrEqual(2000);
    await page.screenshot({
      path: `test-results/vtable-hierarchy-region-${region}.png`,
    });
  });
}
