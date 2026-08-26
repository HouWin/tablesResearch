import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the SpreadJS business table demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>SpreadJS 经营数据表 Demo<\/title>/i);
  assert.match(html, /经营数据表/);
  assert.match(html, /数据追踪/);
  assert.match(html, /自定义统计/);
  assert.match(html, /10 万行模式/);
  assert.match(html, /单元格批注/);
  assert.match(html, /单元格附件/);
  assert.match(html, /21(?:<!-- -->)? 项能力/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/);
});

test("ships every requested SpreadJS and business-layer interaction", async () => {
  const [page, controller, model, clipboard, spreadsheetUi, cellStateRoute, layout, hosting, schema, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spreadsheet/use-spreadsheet-controller.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/spreadsheet/model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/spreadsheet/clipboard.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/spreadsheet-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cell-state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const source = [page, controller, model, clipboard, spreadsheetUi].join("\n");

  assert.match(source, /@grapecity-software\/spread-sheets/);
  assert.match(source, /@grapecity-software\/spread-sheets-resources-zh/);
  assert.match(source, /CultureManager\.culture\("zh-cn"\)/);
  assert.match(source, /allowUndo:\s*true/);
  assert.match(source, /commandManager\(\)\.execute\(\{ cmd: "undo"/);
  assert.match(source, /commandManager\(\)\.execute\(\{ cmd: "copy"/);
  assert.match(source, /Events\.ClipboardChanged/);
  assert.match(source, /Events\.ClipboardPasting/);
  assert.match(source, /CLIPBOARD_CALLBACKS\.onCopied/);
  assert.match(source, /CLIPBOARD_CALLBACKS\.onPasting/);
  assert.match(source, /console\.table\(payload\.data\)/);
  assert.match(source, /if \(shouldContinue === false\) args\.cancel = true/);
  assert.match(source, /rowOutlines\.group/);
  assert.match(source, /columnOutlines\.group/);
  assert.match(source, /COLUMN_HEADER_SECTIONS/);
  assert.match(source, /COLUMN_HEADER_GROUPS/);
  assert.match(source, /setRowCount\(3, headerArea\)/);
  assert.match(source, /sheet\.addSpan\(1, startCol, 1, groupColumnCount, headerArea\)/);
  assert.match(source, /sheet\.addSpan\(0, startCol, 1, sectionColumnCount, headerArea\)/);
  assert.match(source, /label: "核心经营指标"/);
  assert.match(source, /label: "业务治理"/);
  assert.match(source, /label: "收入指标"/);
  assert.match(source, /label: "订单指标"/);
  assert.match(source, /rowOutlines\.direction\(GC\.Spread\.Sheets\.Outlines\.OutlineDirection\.backward\)/);
  assert.match(source, /columnOutlines\.direction\(GC\.Spread\.Sheets\.Outlines\.OutlineDirection\.backward\)/);
  assert.match(source, /sheet\.showColumnOutline\(true\)/);
  assert.match(source, /\{ summaryCol: 4, detailStart: 5, detailCount: 7 \}/);
  assert.match(source, /\{ summaryCol: 4, detailStart: 5, detailCount: 2 \}/);
  assert.match(source, /\{ summaryCol: 7, detailStart: 8, detailCount: 3 \}/);
  assert.match(source, /\{ summaryCol: 12, detailStart: 13, detailCount: 5 \}/);
  assert.match(source, /\{ summaryCol: 12, detailStart: 13, detailCount: 2 \}/);
  assert.match(source, /\{ summaryCol: 15, detailStart: 16, detailCount: 2 \}/);
  assert.match(source, /label: "主行层级"/);
  assert.match(source, /label: "扩展行层级"/);
  assert.match(source, /label: "rowTree"/);
  assert.match(source, /label: "extensionRows"/);
  assert.match(source, /field: "categoryHierarchy"/);
  assert.match(source, /field: "regionHierarchy"/);
  assert.match(source, /hierarchyCellText/);
  assert.match(source, /sheet\.rowOutlines\.expandGroup/);
  assert.match(source, /Events\.CellDoubleClick/);
  assert.match(source, /args\.col === hierarchyColumnForRow\(node\)/);
  assert.doesNotMatch(source, /sheet\.outlineColumn\.setCollapsed/);
  assert.match(source, /CellTypes\.ComboBox/);
  assert.match(source, /CellTypes\.CheckBox/);
  assert.match(source, /CellTypes\.FileUpload/);
  assert.match(source, /label: "调整系数"/);
  assert.match(source, /DataValidation\.createNumberValidator/);
  assert.match(source, /DataValidation\.ErrorStyle\.stop/);
  assert.match(source, /showInputMessage\(false\)/);
  assert.match(source, /showErrorMessage\(false\)/);
  assert.match(source, /Events\.ValidationError/);
  assert.match(source, /DataValidationResult\.discard/);
  assert.match(source, /toast-error/);
  assert.doesNotMatch(source, /inputTitle\("两位小数"\)/);
  assert.match(source, /highlightInvalidData = true/);
  assert.match(source, /formatter\("0\.00"\)/);
  assert.match(source, /DropDownType\.dateTimePicker/);
  assert.match(source, /ButtonImageType\.dropdown/);
  assert.match(source, /ButtonVisibility\.always/);
  assert.match(source, /cmd: "openDateTimePicker"/);
  assert.match(source, /calendarPage: GC\.Spread\.Sheets\.CalendarPage\.day/);
  assert.match(source, /startDay: GC\.Spread\.Sheets\.CalendarStartDay\.monday/);
  assert.match(source, /contextMenu\.menuData\.push/);
  assert.match(source, /businessComment/);
  assert.match(source, /stableCellKey/);
  assert.match(source, /new GC\.Spread\.Sheets\.Search\.SearchCondition/);
  assert.match(source, /SearchFoundFlags\.cellText/);
  assert.match(source, /SearchFoundFlags\.cellFormula/);
  assert.match(source, /SearchFlags\.blockRange/);
  assert.match(source, /sheet\.getRowCount\(\)/);
  assert.match(source, /sheet\.getColumnCount\(\)/);
  assert.match(source, /搜索任意单元格内容/);
  assert.doesNotMatch(source, /const buildSearchMatches/);
  assert.match(source, /SelectionChanged/);
  assert.match(source, /CellChanged/);
  assert.match(source, /createStressRecords\(size = STRESS_ROW_COUNT\)/);
  assert.match(source, /STRESS_ROW_COUNT = 100_000/);
  assert.match(controller, /const colCount = COLUMNS\.length/);
  assert.doesNotMatch(source, /STRESS_COLUMN_COUNT|extendedMetric|扩展指标|扩展数据/);
  assert.match(source, /STRESS_PAGE_SIZE = 400/);
  assert.match(source, /STRESS_FULL_PAGE_VISIBLE_ROWS = 8/);
  assert.match(source, /Events\.TopRowChanged/);
  assert.match(source, /loadVisibleStressRows/);
  assert.match(source, /loadStressData/);
  assert.match(source, /sheet\.getRowVisible\(row, GC\.Spread\.Sheets\.SheetArea\.viewport\)/);
  assert.match(source, /refreshAfterGroupChange\(args\.isRowGroup\)/);
  assert.match(source, /normalizeActiveSelection/);
  assert.match(source, /loadedStressRows/);
  assert.match(source, /loadStressData\(fullPages, sparseRows\)/);
  assert.match(source, /runOutlineBatch/);
  assert.doesNotMatch(source, /loadStressRowsAround/);
  assert.match(source, /COLUMN_GROUPS\.forEach/);
  assert.match(model, /row\.hasChildren \|\| row\.children\?\.length/);
  assert.doesNotMatch(source, /压力模式不创建行分组|压力模式不创建列分组/);
  assert.doesNotMatch(source, /disabled=\{dataMode !== "regular"\}/);
  assert.match(source, /sheet\.setColumnVisible/);
  assert.match(source, /for \(let col = 0; col < columnCount; col \+= 1\)/);
  assert.match(source, /sheet\.autoFitColumn\(col\)/);
  assert.match(source, /已按内容适配全部 \$\{columnCount\} 列宽/);
  assert.match(source, /NEXT_PUBLIC_SPREADJS_LICENSE_KEY/);
  assert.match(source, /SUM \/ COUNT/);
  assert.match(source, /INITIAL_DATASET_LABEL/);
  assert.match(source, /COLUMNS\.length/);
  assert.match(source, /window\.clearTimeout\(stressLoadTimer\)/);
  assert.match(source, /start\(\)\.catch/);
  assert.match(source, /aria-expanded=\{searchOpen\}/);
  assert.match(source, /aria-expanded=\{columnMenuOpen\}/);
  assert.match(source, /aria-pressed=\{aggregateMode === mode\}/);
  assert.doesNotMatch(source, /Math\.min\(\.\.\.values\)|Math\.max\(\.\.\.values\)/);
  assert.match(cellStateRoute, /mode === "comment-markers"/);
  assert.match(layout, /summary_large_image/);
  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(hosting, /"r2":\s*"ATTACHMENTS"/);
  assert.match(schema, /cellComments/);
  assert.match(schema, /cellHistory/);
  assert.match(schema, /attachments/);
  assert.match(packageJson, /@grapecity-software\/spread-sheets/);
  assert.match(packageJson, /@grapecity-software\/spread-sheets-resources-zh/);
  assert.doesNotMatch(packageJson, /@visactor\/vtable/);

  await access(new URL("../public/og.png", import.meta.url));
});
