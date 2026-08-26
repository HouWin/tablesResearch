import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_DATA,
  COLUMNS,
  EXTENSION_DETAIL_COLUMN,
  EXTENSION_REGION_COLUMN,
  PRIMARY_CATEGORY_COLUMN,
  PRIMARY_SUBCATEGORY_COLUMN,
  canDrillNode,
  findBusinessNode,
  flatRowsForView,
  flattenTree,
  formatStatistic,
  getRowOutlineGroups,
  getStressRecordsAsync,
  roundToTwoDecimals,
  rootsForView,
  updateBusinessNode,
  viewForNode,
  viewRowValues,
} from "../app/spreadsheet/model.ts";

test("business rows and column configuration stay aligned", () => {
  const rows = flattenTree(BUSINESS_DATA);
  assert.equal(COLUMNS.length, 18);
  assert.equal(rows.length, 30);
  assert.equal(viewRowValues(rows[0], COLUMNS.length).length, COLUMNS.length);
  assert.deepEqual(COLUMNS.slice(0, 4).map((column) => column.label), ["品类", "子品类", "区域", "城市 / 门店"]);
  assert.equal(viewRowValues(rows[0], COLUMNS.length)[PRIMARY_CATEGORY_COLUMN], "▾ 家具");
  assert.equal(viewRowValues(rows[1], COLUMNS.length)[PRIMARY_SUBCATEGORY_COLUMN], "▾ 书柜");
  assert.equal(viewRowValues(rows[2], COLUMNS.length)[EXTENSION_REGION_COLUMN], "▾ 华东");
  assert.equal(viewRowValues(rows[3], COLUMNS.length)[EXTENSION_DETAIL_COLUMN], "上海");
  assert.deepEqual(viewRowValues(rows[2], COLUMNS.length).slice(0, 2), [null, null]);
  const groups = getRowOutlineGroups(rows);
  assert.equal(groups.length, 14);
  assert.deepEqual(groups[0], { summaryRow: 0, detailStart: 1, detailCount: 14 });
  assert.deepEqual(groups[1], { summaryRow: 1, detailStart: 2, detailCount: 6 });
  assert.deepEqual(groups[2], { summaryRow: 2, detailStart: 3, detailCount: 2 });
});

test("drill paths support every business node with children", () => {
  const furnitureView = viewForNode([], BUSINESS_DATA[0]);
  assert.ok(furnitureView);
  assert.deepEqual(rootsForView(furnitureView).map((node) => node.name), ["书柜", "座椅"]);

  const bookcases = rootsForView(furnitureView).find((node) => node.id === "furniture-bookcases");
  const bookcasesView = bookcases ? viewForNode(furnitureView, bookcases) : null;
  assert.ok(bookcasesView);
  assert.deepEqual(rootsForView(bookcasesView).map((node) => node.name), ["华东", "华中"]);
  const east = rootsForView(bookcasesView)[0];
  const eastView = viewForNode(bookcasesView, east);
  assert.ok(eastView);
  assert.deepEqual(rootsForView(eastView).map((node) => node.name), ["上海", "江苏"]);
  assert.equal(canDrillNode(east), true);
  assert.equal(canDrillNode(rootsForView(eastView)[0]), false);
  assert.equal(viewForNode(eastView, rootsForView(eastView)[0]), null);

  const data = structuredClone(BUSINESS_DATA);
  const sourceShanghai = findBusinessNode(data, "bookcases-shanghai");
  assert.equal(sourceShanghai?.name, "上海");
  assert.equal(findBusinessNode(data, "missing"), undefined);
});

test("100k stress rows are cached and preserve every hierarchy level", async () => {
  const rows = await getStressRecordsAsync();
  const cachedRows = await getStressRecordsAsync();
  const groups = getRowOutlineGroups(rows);
  assert.equal(rows.length, 100_000);
  assert.equal(cachedRows, rows);
  assert.equal(groups.filter((group) => rows[group.summaryRow].level === 0).length, 10);
  assert.equal(groups.filter((group) => rows[group.summaryRow].level === 1).length, 100);
  assert.ok(groups.every((group) => group.detailCount > 0));

  const regionView = viewForNode([], rows[0]);
  assert.ok(regionView);
  const regionRows = flatRowsForView(rows, regionView);
  assert.equal(regionRows.length, 9_999);
  assert.equal(regionRows[0].level, 0);

  const cityView = viewForNode(regionView, regionRows[0]);
  assert.ok(cityView);
  const cityRows = flatRowsForView(rows, cityView);
  assert.equal(cityRows.length, 999);
  assert.ok(cityRows.every((row) => row.level === 0));
  assert.equal(flatRowsForView(rows, cityView.slice(0, -1)).length, 9_999);
});

test("coupled verification fields and decimal precision remain consistent", () => {
  const node = structuredClone(BUSINESS_DATA[0]);
  updateBusinessNode(node, "status", "异常");
  assert.equal(node.verified, false);
  updateBusinessNode(node, "verified", true);
  assert.equal(node.status, "已核验");
  assert.equal(roundToTwoDecimals(1.235), 1.24);
  assert.equal(formatStatistic(0.936, "percent"), "93.6%");
  assert.equal(formatStatistic(1.2, "decimal"), "1.20");
});
