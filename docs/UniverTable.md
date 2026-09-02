# UniverTable 技术文档

> 基于 [Univer](https://univer.ai/)（`@univerjs/presets` 0.25.x）封装的业务表格组件，路径：`src/components/UniverTable/`。  
> 演示页：`/UniverTable`（`src/pages/UniverTable/index.tsx`）。

---

## 1. 定位与能力概览

UniverTable（内部组件名 `ETable`）在 Univer Sheets 之上提供：

- 多级表头、列宽/行高、冻结、网格线
- 树形数据展平 + 单元格内 ▶/▼ 折叠（`treeUI`）
- 平铺数据多重分组（`groupData`）
- 单元格合并、行列大纲分组
- 列类型（数字 / 下拉 / 日期）、只读区域
- 批注、附件、单元格历史、数据追踪
- 自定义右键菜单、快速搜索、撤销/重做
- 大数据渲染：异步分片、懒虚拟写入、树形视口投影

组件对外暴露 React `ref`（`ETableRef`），可调用 Univer API 与业务方法。

### 1.1 是否使用透视表？

**结论：不是。** UniverTable **未使用** Univer 透视表（`@univerjs-pro/sheets-pivot`）或任何引擎级 Pivot 能力，也未引入 Jspreadsheet Pivot 等第三方透视插件。

实现方式是 **普通电子表格（Worksheet）+ 应用层数据展平**：

```
业务数据（树 / 分组 / 平铺）
        │
        ▼
 flattenTreeData / flattenGroupedData / 直接 rows
        │
        ▼
 columns + rows + merges + rowGroups（二维结构）
        │
        ▼
 Univer Worksheet：setValues、merge、hideRows / 视口投影
```

| 能力 | 实现方式 | 说明 |
|------|----------|------|
| 多级表头 | `buildHeaderLayout()` + `setValues` | 表头行合并，非透视列字段 |
| 树形折叠 | `treeUI`：单元格 ▶/▼ + `hideRows` 或视口投影 | 折叠状态在 JS 内存维护 |
| 平铺分组 | `flattenGroupedData()` | **视觉效果类似**透视表行分组，但是预先展平写入单元格 |
| 列维度分组 | `measureGroups` → 多级 `columns` | 静态列布局，非运行时聚合透视 |
| 分组小计 | `groupStatistics` 展平时计算 | 汇总值写入行，非透视引擎重算 |
| 行/列大纲 | `outline.ts` → `addRowOutline` / `addColumnOutline` | Univer **原生大纲**，辅助折叠，仍非透视表 |

**与「透视表」的边界：**

- **像透视的地方**：维度 + 指标的数据模型、`measureGroups` 列分组、`groupData` 多级行分组、可折叠层级——交互上接近 Excel 透视表 / 分组表。
- **不像透视的地方**：没有透视缓存、没有拖拽字段、没有按源表动态 `SUM/COUNT` 重算；表头与单元格网格在初始化（或视口刷新）时**已经物化**；编辑的是普通单元格，改的是展平后的 `rows[].data`。
- **为何不用透视表**：业务表需要单元格级编辑、批注、附件、自定义右键、只读规则与大数据视口投影；透视表更适合只读分析，与当前「可编辑业务明细表」目标不一致。

**本仓库其他页面对照（便于区分）：**

| 页面 | 是否透视表 |
|------|------------|
| `/UniverTable`（本组件） | 否，Worksheet + 展平 |
| `/Jspreadsheet` | 是，`@jspreadsheet/pivot` 透视分析表 + 透视源数据 |
| `/AntvS2` | 是，`sheetType="pivot"` |
| `/SpreadJSDemo` | 否，树形数据投影为二维 ViewRow 再写入 Worksheet |

**Univer 已加载的 Preset**（`index.tsx`，无 Pivot）：

`UniverSheetsCorePreset`、`UniverSheetsAdvancedPreset`、`UniverSheetsThreadCommentPreset`、`UniverSheetsNotePreset`、`UniverSheetsDataValidationPreset`、`UniverSheetsFindReplacePreset`。

### 1.2 是否是二维表实现？

**结论：是。** UniverTable 的渲染内核就是 **标准二维电子表格网格**（行 × 列），所有业务形态最终都会归一成 `ETableFlattenResult`，再映射到 Univer Worksheet 的 `(row, column)` 单元格。

```
┌─────────────────────────────────────────────────────────┐
│  表头区（多级合并，占 0 .. maxDepth-1 行）                  │
├──────┬──────┬──────┬─────────┬─────────┬─────────┤
│ col0 │ col1 │ col2 │  col3   │  col4   │  col5   │  ← 叶子列（二维列轴）
├──────┼──────┼──────┼─────────┼─────────┼─────────┤
│ 家具 │      │ 华东 │ 3724800 │   646   │  周宁   │  row 0（数据区）
│      │ 书柜 │      │         │         │         │  row 1（merge 纵向合并）
│ 办公 │ 椅子 │ 华北 │  ...    │   ...   │  ...    │  row 2
└──────┴──────┴──────┴─────────┴─────────┴─────────┘
        ▲ 树形/分组在入表前已展平为二维 rows[]
```

**统一内部模型（二维）：**

| 结构 | 含义 | 坐标 |
|------|------|------|
| `columns`（叶子列） | 二维表的**列轴** | `column`：0-based |
| `rows[]` | 二维表的**行轴**，每行 `data[colId]` | `row`：相对数据区 0-based |
| `merges` | 在二维网格上做 `rowSpan` / `columnSpan` | 仍是 `(row, column)` |
| `rowGroups` / `columnGroups` | 大纲折叠，不改变二维本质 | 辅助隐藏行/列 |

树形 `ETableTreeNode`、分组 `groupData` 在入表前由 `flattenTreeData()` / `flattenGroupedData()` **投影为上述二维结构**；折叠只控制「哪些逻辑行可见」，不引入第三维存储。

**写入方式（仍是单元格矩阵）：**

1. `renderHeader()` → 表头区 `setValues` + 合并
2. `renderData()` / `renderDataAsync()` → 数据区按行 `setValues`
3. `applyMerges()` → 对二维区域执行 merge
4. 大数据：`virtualRender` 按页写二维块；`treeViewport` 只把**可见逻辑行的一个窗口**投影到 sheet 的连续物理行（底层仍是 `getRange(r, c).setValues`）

**两套行号（视口模式下需区分）：**

| 概念 | 说明 |
|------|------|
| **逻辑行** `logicalRow` | `rows[]` 下标，业务真实行，全量在内存 |
| **物理行** `dataStartRow + projectedIndex` | Worksheet 上实际行号，视口模式仅 ~300 行窗口 |
| **列** | 逻辑列与物理列一致（无列投影），`leafColumns[i]` ↔ 工作表第 `i` 列 |

对外 `onCellChange`、`comments`、`attachments` 的 `cell: 'D5'` 等，最终都落在 **二维 A1 记法** 上；视口模式通过 `logicalRowResolver` 把物理行反查为逻辑行。`onCellChange` 回调中已自动附带 `logicalRow`、`rowDimensions`（行维度）、`columnDimensions`（列维度路径）。

**与「多维表 / 透视 / 图模型」的对比：**

| 形态 | UniverTable | 说明 |
|------|-------------|------|
| 二维明细表 | ✅ 是 | 一行一记录（或合并后的展示行），列即字段 |
| 多维交叉（行维×列维×指标） | ❌ 否 | `measureGroups` 只是**静态多级列头**，不是运行时交叉表 |
| OLAP / 立方体 | ❌ 否 | 无维度切片、无 Drill 引擎，仅有应用层 `drillDown` 面包屑 |
| 原生树控件 / 图数据库 | ❌ 否 | 树是 **展平 + 缩进 + ▶/▼** 画在单元格里 |
| Canvas 自绘表格 | ❌ 否 | 使用 Univer Sheets 的 Worksheet 与选区/编辑管线 |

**为何采用二维表：**

- 与 Excel 式编辑、公式、批注、附件、冻结、查找等 Univer 能力天然对齐
- 合并单元格即可表达层级缩进，无需另建渲染引擎
- 业务侧心智简单：`rows[i].data[columnId]` 即单元格值

**本仓库对照：**

| 页面 | 数据形态 | 渲染 |
|------|----------|------|
| `/UniverTable` | 树/分组 → **展平二维** `rows` | Univer Worksheet |
| `/SpreadJSDemo` | 树 → **投影二维** `ViewRow[]` | SpreadJS Worksheet |
| `/AntvS2` | 多维配置 `fields` / `meta` | S2 透视/明细引擎（非传统 sheet 网格） |
| `/Jspreadsheet` | 源表二维 + 透视表二维 | Jspreadsheet Worksheet + Pivot 插件 |

简言之：**输入可以是树或多维分组，实现一定是二维表**——先展平，再写入行列网格；层级感来自合并、缩进与折叠，而非多维存储或透视引擎。

### 1.3 维度交叉、配置传入、编辑回传、更新与分页

#### 1.3.1 表单数据是否满足「维度交叉」？

**部分满足，但不是运行时 OLAP 交叉表。**

| 交叉类型 | 是否支持 | 说明 |
|----------|----------|------|
| **行维 × 指标**（品类 → 子品类 → 区域 + 多指标列） | ✅ | `treeConfig.dimensions` + `measures`，展平后每行一条记录 |
| **行维多级分组** | ✅ | `groupConfig.dimensions` 从左到右嵌套分组 |
| **列维分组（静态）** | ✅ | `measureGroups`：如 East / Central 下各挂 `east_sales`、`east_profit` |
| **行维 × 列维动态交叉**（拖拽字段、自动 `SUM` 重算） | ❌ | 无透视引擎；列组合须在配置时**写死** |
| **同一指标按列维展开**（如 2024Q1 / 2024Q2 自动生列） | ❌ | 须在业务层预计算，通过 `headerColumns` 或 `measures` 声明叶子列 |
| **稀疏矩阵**（仅非空交叉点有值） | ⚠️ 间接 | 展平时空位为 `null`/空单元格，仍占行列 |

**数据模型本质：**

```
行维（树/分组）          列维（表头，初始化时固定）
     │                        │
     ▼                        ▼
dimensions[]            measures[] / measureGroups[]
     │                        │
     └──────── flatten ───────┘
                  │
                  ▼
         rows[i].data[field]   ← 每个叶子列一个字段，宽表
```

- **行交叉**：通过 `flattenTreeData` / `flattenGroupedData` 把层级压成多行，维度列纵向合并。
- **列交叉**：`measureGroups` 只生成**多级列头 + 列大纲**，不会在运行时把「Region」旋转到列轴；East/Central 等指标列需事先定义 `field`。
- **若要真交叉**：在接入前由后端/业务层做 pivot（如 `region × quarter → 列`），再把结果作为 `columns` + `rows` 直接模式传入。

**演示页实际形态**：行树（品类/子品类/区域）+ 宽表指标列（`revenue`、`orders`…），属于 **「层级行 + 扁平列」**，不是 S2/Excel 透视那种动态交叉。

#### 1.3.2 组件传入的行 / 列配置

`ETableProps`（`types.ts`）按数据模式传入不同字段：

| 模式 | 列配置 | 行 / 数据配置 | 辅助结构 |
|------|--------|---------------|----------|
| **直接模式** | `columns: ETableColumn[]` | `rows: ETableRow[]` | `merges`、`rowGroups`、`columnGroups` |
| **树形模式** | `treeConfig` 内：`headerColumns` / `dimensions` / `attribute` / `measures` / `measureGroups` | `treeData: ETableTreeNode[]` | 展平后自动生成 merges、toggles |
| **分组模式** | `groupConfig.dimensions` + `groupConfig.measures`（单层表头） | `groupData: Record<string, primitive>[]` | 展平后自动生成 merges、rowGroups |

**列配置要点（`ETableColumn`）：**

- 多级：`children` 嵌套 → 表头合并；叶子节点必须有唯一 `id`
- 叶子列可带 `type`、`options`、`numberFormat`、`editable`、`width`
- 树形模式列 id 须与 `measures[].field`、`dimensions[].field` 对齐

**行配置要点（`ETableRow`）：**

- `id`：业务行标识（不写入单元格）
- `data`：`Record<列id, 值 | ETableCell>`
- `readonly`、`height`、`style.bg` 控制整行

**工作表级配置（`options`）：**

| 属性 | 默认 | 作用 |
|------|------|------|
| `freezeRows` | 自动 = 表头深度 | 冻结表头 |
| `freezeColumns` | 演示 3 | 冻结左侧维度列 |
| `defaultColumnWidth` / `defaultRowHeight` | 110 / 30 | 默认尺寸 |
| `virtualScroll` | `true` | 大数据懒写入 + Canvas 滚动 |
| `enableContextMenu` | `true` | 右键菜单 |

**展平优先级**：`treeData` > `groupData` > `rows`；树/分组变更会触发 `useEffect` 重新 `flatten`，进而**整表重建** Univer 实例。

#### 1.3.3 表格编辑拿到的数据格式

用户编辑后，通过回调拿到的是 **工作表坐标 + 字符串化新旧值**，不是自动回写的 `treeData` / `rows` 对象。

**`onCellChange(record: ETableCellChangeRecord)`**

```ts
interface ETableDimensionInfo {
  field: string;
  title: string;
  value?: ETablePrimitive; // 行维度带 value；列维度路径节点无 value
}

interface ETableCellChangeRecord {
  id: string;           // 变更唯一 id
  cell: string;         // A1 记法，含表头行（如 "F8"）
  row: number;          // 工作表行号，0-based（含表头）
  column: number;       // 工作表列号，0-based
  from: string;         // 编辑前值（字符串化）
  to: string;           // 编辑后值
  time: string;         // 本地时间字符串
  source?: 'edit' | 'paste' | 'api';  // 当前主要走 'edit'

  // —— 以下由 enrichCellChangeRecord 自动补充 ——
  field?: string;       // 叶子列 field，如 'revenue'
  dataRow?: number;     // 数据区相对行（0-based；视口模式下为投影行）
  logicalRow?: number;  // 逻辑行下标，可反查 rows[]
  rowDimensions?: ETableDimensionInfo[];    // 行维度 field / title / value
  columnDimensions?: ETableDimensionInfo[]; // 列维度多级表头路径
  rowPath?: string[];   // 树分组面包屑（展示用）
}
```

触发时机：`setupCellHistory` 监听 `SheetEditStarted` / `SheetEditEnded`，**每次确认编辑一个单元格**触发一条 `onCellChange`（`from === to` 时跳过）。组件在回调前通过 `enrichCellChangeRecord`（`cellChangeContext.ts`）补充 `field`、行列维度与逻辑行信息。

**行维度 `rowDimensions`**

树形模式下**不能仅读 `rows[logicalRow].data`**：城市明细行会清空品类列，区域列显示城市名（如「上海」）而非区域组名（如「华东」）。

展平阶段会为每行写入 `ETableRow.dimensionContext`（完整业务层级快照），`onCellChange` **优先读取此字段**；无快照时再回退到 `rowPath` + `row.data` 合并解析。

| 数据模式 | 解析策略 | 示例（编辑「家具 → 华东 → 华东 → 上海」行） |
|----------|----------|---------------------------------------------|
| 树形 `treeConfig` | `row.dimensionContext` 优先 | `[{ field: 'category', title: '品类', value: '家具' }, { field: 'subcategory', title: '子品类', value: '华东' }, { field: 'region', title: '区域', value: '华东' }, { field: 'regionDetail', title: '区域', value: '上海' }]` |
| 分组 `groupConfig` | `rowPath` 按序映射 `dimensions[]` | 按分组层级从左到右 |
| 直接 `rows` 模式 | 无 `treeConfig` / `groupConfig` 时不填充 | — |

`dimensionContext` 在 `flattenTreeData` 时由 `buildDimensionContext()` 写入，不受明细行「清空品类列」等展示逻辑影响。

**列维度 `columnDimensions`**

从 `columns` 多级表头树 DFS 到当前叶子列的完整路径，每项含 `field` + `title`，不含 `value`。例如编辑「净收入」列：

```json
[
  { "field": "core-metrics", "title": "核心经营指标" },
  { "field": "revenue-metrics", "title": "收入指标" },
  { "field": "revenue", "title": "净收入" }
]
```

**`rowPath`**

树形折叠分组路径（与右键「数据追踪」中的行路径一致），由 `treeCollapse` / `treeViewport` 的 `getBreadcrumb(logicalRow)` 生成，例如 `['家具', '书柜', '华东']`。

**`onSelectionChange(cell, row, column)`**

- `cell`：如 `"D5"`
- `row` / `column`：同上，**工作表绝对坐标**

**映射回业务字段（可直接使用 record 上的补充字段）：**

```ts
// 推荐：直接使用 enrich 后的字段
const { field, dataRow, logicalRow, rowDimensions, columnDimensions } = record;

// 等价手动换算（兼容旧代码）
const headerDepth = options.freezeRows ?? maxDepth;
const dataRow = record.dataRow ?? record.row - headerDepth;
const field = record.field ?? leafColumns[record.column]?.id;

// 视口模式（≥5000 行 treeUI）：dataRow 为工作表投影行，用 logicalRow 访问 rows[]
const row = rows[record.logicalRow ?? dataRow];
```

**Ref 查询：**

- `ref.getTracks()` / `ref.getCellHistory(cell)`：内存中的变更列表（默认最多 200 条）
- `ref.getDataTrace(cell)`：简化血缘树（演示用）
- **不会**自动把 `to` 写回 `treeData` / `groupData` props，需业务层在 `onCellChange` 里自行持久化

> 单格更新、全量 Diff、全量快照的完整说明见 **§1.3.6 数据获取方式**。

#### 1.3.4 表格数据的更新方式

| 场景 | 方式 | 粒度 | 说明 |
|------|------|------|------|
| 用户单元格编辑 | Univer 原生编辑 → `onCellChange` | **单格** | 每次 `SheetEditEnded` 一条记录 |
| 右键粘贴 | `univerAPI.paste()` 或内部 `setValues` | **选区（批量）** | 批量写入 sheet；`onCellChange` 不保证每格回调 |
| 初始化渲染 | `renderData` / `renderDataAsync` | **批量** | 按行矩阵 `setValues`，大行数分片（800～4000 行/片） |
| 树折叠图标 | 程序化 `setValue` | 单格 | 更新 ▶/▼ 文案，不走 `onCellChange` |
| 视口刷新 | `treeViewport` 窗口 `setValues` | 批量（窗口内） | 仅重写可见 ~300 行 |
| 懒虚拟补页 | `virtualRender.ensureRows` | 批量（每页 2000 行） | 滚动时按页写入 |
| 合并单元格 | `applyMerges` 分批 | 批量 | `batchSize` 200～400 |
| Props 变更（树/分组） | 重新 flatten → 销毁并重建 Univer | 全表 | `useEffect` 依赖 `flattened` |
| Props 变更（直接 `rows`） | **不自动同步** | — | 需改 `key` 强制 remount，或 `ref.getWorksheet().getRange().setValue(s)` |
| 撤销 / 重做 | `ref.undo()` / `ref.redo()` | Univer 命令栈 | 作用于 sheet，不自动更新业务 state |

**推荐业务同步模式：**

```tsx
onCellChange={(record) => {
  const { field, logicalRow, dataRow, rowDimensions, columnDimensions } = record;
  if (!field || dataRow === undefined || dataRow < 0) return;

  // 1. 用 logicalRow 定位 rows[]（视口模式必备）
  patchRow(logicalRow ?? dataRow, field, record.to);

  // 2. 上报后端时可附带行列维度上下文
  savePatch({
    field,
    value: record.to,
    rowDimensions,      // [{ field, title, value }]
    columnDimensions,   // [{ field, title }]
    rowPath: record.rowPath,
  });
}}
```

全量替换数据：更新 `treeData` / `groupData` 或给 `<ETable key={dataVersion} />` 触发完整重渲染。

#### 1.3.5 表格分页

**无面向用户的 UI 分页**（无「第 1/10 页」、无 `pageSize` Props）。全量逻辑数据始终在内存；大数据通过 **渲染层分页 / 视口窗口** 避免一次写入过多单元格。

| 机制 | 触发条件 | 「页」大小 | 行为 |
|------|----------|------------|------|
| **懒虚拟写入** `virtualRender` | 平铺表、`virtualScroll`、行数 ≥ 5000 | `VIRTUAL_PAGE_SIZE = 2000` | 首次写 2 页；滚动时 `ensureRows` 按页 `setValues` |
| **树视口投影** `treeViewport` | `treeUI`、行数 ≥ 5000 | `TREE_VIEWPORT_WINDOW_SIZE = 300` | 工作表只投影可见逻辑行的滑动窗口 |
| **异步分片渲染** `renderDataAsync` | 行数 ≥ 1000 | 800～4000 行/片 | 初始化时分片 `setValues`，仍写全量 |
| **树折叠分批** `treeCollapse` | 大量 toggle 初始化 | 200 个/批 | `hideRows` 分批，非数据分页 |

**查询状态：**

```ts
onReady={({ virtualRender, treeViewport }) => {
  // 平铺懒虚拟
  virtualRender?.loadedPages;      // 已加载页序号
  virtualRender?.loadedRowsEstimate;

  // 树视口
  treeViewport?.visibleLogicalRows;
  treeViewport?.displayRangeStart; // 当前窗口逻辑行范围
  treeViewport?.displayRangeEnd;
}}

ref.getVirtualRenderStats();
ref.getTreeViewportStats();
```

**与业务分页的区别：**

- 渲染分页：优化 **DOM/Canvas 写入**，不改变 `rows.length`
- 若业务需要服务端分页（每页 50 条接口）：须在业务层换 `rows` 并 remount 表格，组件**未内置**服务端分页 API

#### 1.3.6 数据获取方式

组件**没有** `getRows()` / `getTableData()` 一类「一键导出业务二维表」的 API。  
数据分三层理解，获取方式也不同：

```
┌─────────────────────────────────────────────────────────────┐
│  业务源数据（treeData / groupData / rows）  ← 父组件 state   │
├─────────────────────────────────────────────────────────────┤
│  展平结果（flatten 后 rows[]）              ← 组件内部，未暴露  │
├─────────────────────────────────────────────────────────────┤
│  工作表单元格（Worksheet）                  ← getWorksheet 可读 │
└─────────────────────────────────────────────────────────────┘
         编辑只改 Worksheet；不会自动回写上层
```

| 需求 | 推荐方式 | API / 回调 |
|------|----------|------------|
| **获取单个更新数据** | `onCellChange` 实时接收 | 每次编辑一条 `ETableCellChangeRecord` |
| **获取全量更新数据** | 父组件累积 `onCellChange` 或 `ref.getTracks()` | 变更流水，非当前格快照 |
| **获取全量表格数据** | 父组件维护镜像 + 必要时读 Worksheet | 见下文三种策略 |

---

##### A. 获取单个更新数据（单格编辑）

**方式 1：回调（推荐，实时）**

```tsx
<ETable
  onCellChange={(record) => {
    const patch = {
      cell: record.cell,
      sheetRow: record.row,
      sheetColumn: record.column,
      field: record.field,                    // 已补充，无需 leafColumns[record.column]
      dataRow: record.dataRow,                // 已补充
      logicalRow: record.logicalRow,          // 视口模式反查 rows[]
      rowDimensions: record.rowDimensions,    // 行维度
      columnDimensions: record.columnDimensions, // 列维度路径
      rowPath: record.rowPath,
      oldValue: record.from,
      newValue: record.to,
      time: record.time,
      source: record.source ?? 'edit',
    };
  }}
/>
```

**方式 2：查询某一格的历史（含多次编辑）**

```ts
const history = tableRef.current?.getCellHistory('D7') ?? [];
// 按时间倒序，每项为 ETableCellChangeRecord
const latest = history[0];
```

**单条记录示例解读：**

```json
{
  "id": "1788232356649-6-3-zfhvo",
  "cell": "D7",
  "row": 6,
  "column": 3,
  "from": "¥200",
  "to": "¥20,000",
  "time": "11:12:36",
  "source": "edit",
  "field": "revenue",
  "dataRow": 3,
  "logicalRow": 3,
  "rowDimensions": [
    { "field": "category", "title": "品类", "value": "家具" },
    { "field": "subcategory", "title": "子品类", "value": "华东" },
    { "field": "region", "title": "区域", "value": "华东" },
    { "field": "regionDetail", "title": "区域", "value": "上海" }
  ],
  "columnDimensions": [
    { "field": "core-metrics", "title": "核心经营指标" },
    { "field": "revenue-metrics", "title": "收入指标" },
    { "field": "revenue", "title": "净收入" }
  ],
  "rowPath": ["家具", "书柜", "华东"]
}
```

| 字段 | 含义（演示页） |
|------|----------------|
| `cell` / `row` / `column` | 工作表坐标 |
| `field` | 叶子列 field；上例为 `revenue`（净收入） |
| `dataRow` | 数据区相对行（`row - headerDepth`） |
| `logicalRow` | 逻辑行下标；非视口模式通常等于 `dataRow` |
| `rowDimensions` | 行维度 field / title / value；明细行含 `regionDetail` 等城市级标签 |
| `columnDimensions` | 当前列的多级表头路径（列维度） |
| `rowPath` | 树分组面包屑，与数据追踪 Drawer 一致 |
| `from` / `to` | **显示值字符串**（含 `¥`、千分位），不是原始 `number` |
| `source` | 当前实现主要为 `edit`；`setCellValue({ recordChange: true })` 为 `api`；粘贴批量写入**不一定**逐格回调 |

**数值列解析示例：**

```ts
const parseMoney = (display: string) =>
  Number(display.replace(/[¥,\s]/g, '')) || 0;

const numericValue = parseMoney(record.to); // 20000
```

---

##### B. 获取全量更新数据（变更流水 / Diff）

指「自打开表格以来（或自上次清空以来）所有编辑过的单元格」，不是整张表的当前值。

**方式 1：父组件 state 累积（推荐）**

```tsx
const [tracks, setTracks] = useState<ETableCellChangeRecord[]>([]);

<ETable
  onCellChange={(record) => {
    setTracks((prev) => [record, ...prev]);
  }}
/>

// 导出为业务 patch 列表
const patches = tracks.map((r) => ({
  cell: r.cell,
  field: r.field,
  dataRow: r.dataRow,
  logicalRow: r.logicalRow,
  rowDimensions: r.rowDimensions,
  columnDimensions: r.columnDimensions,
  rowPath: r.rowPath,
  from: r.from,
  to: r.to,
  time: r.time,
}));
```

**方式 2：`ref.getTracks()`**

```ts
const allChanges = tableRef.current?.getTracks() ?? [];
```

| 说明 | 限制 |
|------|------|
| 内存中最多保留 **200 条**（`setupCellHistory` 默认 `maxRecords`） | 超出后丢弃最旧记录 |
| 仅记录 **SheetEditEnded** 确认的单格编辑 | 粘贴、程序化 `setValue`、折叠 ▶/▼ 不一定入库 |
| 同一格多次编辑会有 **多条** 记录 | 取最新值需按 `cell` 合并或读 `getCellHistory(cell)[0]` |
| `ref.clearTracks()` | 清空流水，不影响 Worksheet 当前值 |

**按单元格去重取最新值：**

```ts
function latestByCell(tracks: ETableCellChangeRecord[]) {
  const map = new Map<string, ETableCellChangeRecord>();
  tracks.forEach((t) => {
    if (!map.has(t.cell)) map.set(t.cell, t); // tracks 已按时间倒序
  });
  return [...map.values()];
}
```

**提交后端示例（增量保存）：**

```ts
await api.batchPatchCells(
  latestByCell(tracks).map((r) => ({
    rowId: resolveRowId(r.row - HEADER_DEPTH), // 业务自行映射
    field: leafColumns[r.column]?.id,
    value: parseFieldValue(r.to, leafColumns[r.column]),
  })),
);
```

---

##### C. 获取全量表格数据（当前快照）

**推荐 API：`ref.getTableData()`**

```ts
const snapshot = tableRef.current?.getTableData();
// {
//   columns: ETableColumn[];      // 多级表头
//   leafColumns: ETableColumn[];  // 叶子列
//   headerDepth: number;          // 表头行数
//   rows: ETableRow[];            // 全量数据行
//   source: 'worksheet' | 'memory';
// }
```

| `source` | 含义 |
|----------|------|
| `worksheet` | 从 Worksheet 逐格读取当前值（含用户编辑），适用于中小数据全量写入 |
| `memory` | 内存 `rows` + `getTracks()` 变更叠加；树视口 / 懒虚拟未加载完时自动使用 |

```tsx
const tableRef = useRef<ETableRef>(null);

// 保存 / 导出
const handleExport = () => {
  const { rows, leafColumns, headerDepth, source } =
    tableRef.current?.getTableData() ?? { rows: [] };

  const records = rows.map((row, dataRow) => {
    const record: Record<string, unknown> = { id: row.id };
    leafColumns.forEach((col) => {
      const cell = row.data[col.id];
      record[col.id] =
        cell !== null && typeof cell === 'object' && 'value' in cell
          ? (cell as { value?: unknown }).value
          : cell;
    });
    return record;
  });

  console.log('数据来源', source, '行数', records.length, records);
};
```

**实现文件：** `src/components/UniverTable/exportData.ts`

---

**其他策略（无 ref 或需自定义时）：**

```tsx
// 直接模式：rows 放在父 state，编辑时更新
const [rows, setRows] = useState<ETableRow[]>(initialRows);

const handleCellChange = (record: ETableCellChangeRecord) => {
  const dataRow = record.logicalRow ?? record.dataRow;
  const field = record.field;
  if (!field || dataRow === undefined || dataRow < 0) return;

  setRows((prev) =>
    prev.map((row, i) =>
      i === dataRow
        ? { ...row, data: { ...row.data, [field]: record.to } }
        : row,
    ),
  );
};

// 全量表格数据 = rows
const fullTableData = rows;
```

```tsx
// 树形模式：保留 treeData，按 dataRow 映射回节点后 patch（需自建 rowIndex → node 映射）
// 或维护展平后的 rows 副本（初始化时 flattenTreeData 一次存父 state）
import { flattenTreeData } from '@/components/UniverTable';

const [flatRows, setFlatRows] = useState(() =>
  flattenTreeData(treeData, treeConfig).rows,
);
// onCellChange 更新 flatRows[record.logicalRow ?? record.dataRow].data[record.field]
```

---

**C2. 从 Worksheet 读取**

```ts
function readSheetMatrix(
  tableRef: React.RefObject<ETableRef>,
  headerDepth: number,
  leafColumns: ETableColumn[],
) {
  const worksheet = tableRef.current?.getWorksheet();
  if (!worksheet) return [];

  const dataStartRow = headerDepth;
  const rowCount = worksheet.getRowCount?.() ?? 0;
  const colCount = leafColumns.length;
  const dataRowCount = Math.max(0, rowCount - dataStartRow);

  const matrix =
    worksheet
      .getRange(dataStartRow, 0, dataRowCount, colCount)
      .getValues?.() ?? [];

  return matrix.map((cells, i) => {
    const data: Record<string, unknown> = {};
    leafColumns.forEach((col, j) => {
      const raw = cells[j];
      data[col.id] =
        raw !== null && typeof raw === 'object' && 'v' in raw
          ? (raw as { v: unknown }).v
          : raw;
    });
    return { id: String(i), data };
  });
}
```

| 模式 | 能否读到「全量」 | 注意 |
|------|------------------|------|
| 直接模式 / 树 &lt;5000 行 | ✅ 一般可以 | 合并格只有左上角有值；维度列可能含 ▶/▼ |
| 平铺懒虚拟 ≥5000 | ⚠️ 仅已加载页 | 未滚动到的页 sheet 上可能为空 |
| 树视口投影 ≥5000 | ❌ 仅 ~300 行窗口 | **不能**用此方式导全表，必须用 C1 或 C3 |

---

**C3. 树形：写回 treeData 后重新展平**

```ts
import { flattenTreeData } from '@/components/UniverTable';

// 1. 根据 onCellChange / tracks 把值写回 treeData 对应节点
// 2. 重新展平得到完整二维快照
const snapshot = flattenTreeData(treeData, treeConfig);
const { rows, columns, merges } = snapshot;
```

---

##### 数据获取对照小结

```
                    单个更新          全量更新（Diff）       全量表格（快照）
                    ────────          ──────────────       ──────────────
实时回调            onCellChange      onCellChange 累积     —
                    (含行列维度)      (含行列维度)
Ref 查询            getCellHistory    getTracks()           getTableData()
父组件 state        —                 tracks[]              rows / treeData 镜像
组件内置导出        —                 —                     getTableData()
大数据树视口        同左              同左                  ⚠️ 必须 C1/C3，勿读 sheet
```

**演示页参考：** `src/pages/UniverTable/index.tsx` 用 `tracks` state + `onCellChange` 实现「全量更新数据」展示；未实现「全量快照导出」。

#### 1.3.7 程序化更新单元格 `setCellValue`

```ts
const result = tableRef.current?.setCellValue('D7', 20000);
// { success: true, appliedToSheet: true, cell: 'D7', dataRow: 3, field: 'revenue', ... }
```

**三种定位方式：**

```ts
// 1. A1 地址（含表头，与 onCellChange.cell 一致）
tableRef.current?.setCellValue('D7', 20000);

// 2. 工作表行列（0-based）
tableRef.current?.setCellValue({ sheetRow: 6, column: 3 }, 20000);

// 3. 数据区行 + 字段名（推荐业务层使用）
tableRef.current?.setCellValue({ dataRow: 3, field: 'revenue' }, 20000);
```

**选项 `ETableSetCellValueOptions`：**

| 选项 | 默认 | 说明 |
|------|------|------|
| `syncMemory` | `true` | 同步更新内部 `rows`，保证 `getTableData()` 一致 |
| `recordChange` | `false` | 为 `true` 时写入 `getTracks()` 并触发 `onCellChange`（`source: 'api'`） |

```ts
tableRef.current?.setCellValue(
  { dataRow: 3, field: 'revenue' },
  20000,
  { recordChange: true },
);
```

**返回值 `ETableSetCellValueResult`：**

| 字段 | 说明 |
|------|------|
| `success` | 是否成功（定位有效且至少更新了内存或 sheet） |
| `appliedToSheet` | 是否写入了当前 Worksheet |
| `cell` / `dataRow` / `field` | 解析后的坐标 |

**注意：**

- 树视口模式（≥5000 行）：逻辑行不在当前 ~300 行窗口时，`success: true` 但 `appliedToSheet: false`（仅内存更新）
- 只读区域可程序化写入（与用户双击编辑不同）
- 富单元格：`setCellValue('D7', { value: 20000, style: { bl: 1 } })`

**实现文件：** `src/components/UniverTable/cellValue.ts`

#### 1.3.8 程序化更新一行 `setRowValue`

```ts
tableRef.current?.setRowValue(3, {
  revenue: 20000,
  orders: 500,
  owner: '张三',
  status: '已核验',
});
// { success: true, appliedToSheet: true, dataRow: 3, updatedFields: ['revenue','orders',...] }
```

**行定位：**

```ts
// 数据区行号（0-based，推荐）
setRowValue(3, { revenue: 20000 });
setRowValue({ dataRow: 3 }, { revenue: 20000 });

// 工作表绝对行号（含表头）
setRowValue({ sheetRow: 6 }, { revenue: 20000 });
```

**行为说明：**

| 项 | 说明 |
|----|------|
| 合并策略 | **按字段局部合并**到 `rows[dataRow].data`，未传入的列保持不变 |
| 写入方式 | 合并后对该行执行 `setValues`（整行刷新，比逐格 `setCellValue` 更高效） |
| 选项 | 与 `setCellValue` 相同：`syncMemory`、`recordChange` |
| 视口模式 | 逻辑行不在窗口时仅更新内存，`appliedToSheet: false` |

```ts
tableRef.current?.setRowValue(
  { dataRow: 3 },
  { revenue: 20000, profit: 'High' },
  { recordChange: true }, // 每个变更字段各一条 onCellChange
);
```

#### 1.3.9 读取单元格 / 行 `getCellValue` / `getRowValue`

与 `setCellValue` / `setRowValue` 对称，读取**当前值**（不是变更流水）。

**读取单格：**

```ts
const cell = tableRef.current?.getCellValue('D7');
// { success: true, value: 20000, displayValue: '¥20,000', source: 'worksheet', field: 'revenue', ... }

getCellValue({ dataRow: 3, field: 'revenue' });
getCellValue({ sheetRow: 6, column: 3 });
```

**读取一行：**

```ts
const row = tableRef.current?.getRowValue(3);
// { success: true, dataRow: 3, id: '...', data: { revenue, orders, ... }, source: 'worksheet' }

getRowValue({ dataRow: 3 }, { fields: ['revenue', 'orders'] });
getRowValue(3, { preferWorksheet: false }); // 强制读内存 rows
```

| `source` | 说明 |
|----------|------|
| `worksheet` | 从 Worksheet 读取（含用户编辑） |
| `memory` | 从内部 `rows` 读取（视口外行自动回退） |

| API | 粒度 |
|-----|------|
| `getCellValue` | 单格 |
| `getRowValue` | 一行 |
| `getTableData` | 全表（展平行） |
| `getTreeData` | 树形源数据（含编辑） |

#### 1.3.10 获取树形源数据 `getTreeData`

当使用 `treeData` + `treeConfig` 时，可用 `getTreeData()` 取**合并了用户编辑后的树形结构**（`ETableTreeNode[]`），而不是展平后的 `rows`。

```ts
const latestTree = tableRef.current?.getTreeData();
// 非树形模式返回 null

// 与 getTableData 相同：优先从 Worksheet 读当前值
const fromSheet = tableRef.current?.getTreeData({ preferWorksheet: true });
const fromMemory = tableRef.current?.getTreeData({ preferWorksheet: false });
```

**工作原理：**

1. 深拷贝当前 props 中的 `treeData`（结构以最新 props 为准）
2. 调用 `getTableData()` 获取最新展平行（含 Worksheet 编辑或内存 + tracks）
3. 按 `row.id` 与树节点 `id` / `attributes[].id` / `attributes[].children[].id` 的对应关系，将指标写回 `values`，维度字段写回 `node.data`（跳过带 `▶/▼` 的树形标签列）

**与 `getTableData` 的区别：**

| API | 返回形态 | 典型用途 |
|-----|----------|----------|
| `getTableData()` | 展平 `rows` + 列元数据 | 导出 Excel、全表扫描 |
| `getTreeData()` | 原始 `ETableTreeNode[]` | 回写后端、保存树形 JSON |

> 组件不会自动把编辑写回父组件的 `treeData` state；需要时在 `onCellChange` 或提交时调用 `getTreeData()` 同步。

---

## 2. 模块结构

```
UniverTable/
├── index.tsx           # 组件入口：初始化 Univer、串联各子模块
├── types.ts            # 类型定义（Props / Ref / 树形 / 分组）
├── layout.ts           # 多级表头布局计算
├── renderer.ts         # setValues、合并、异步渲染
├── header.tsx          # 自定义列头
├── columnTypes.ts      # 数字格式、下拉校验
├── tree.ts             # 树形数据展平 → rows / merges / toggles / dimensionContext
├── treeMerge.ts        # 展平行合并回树形源数据（getTreeData）
├── treeCollapse.ts     # 中小数据树折叠（hideRows）
├── treeViewport.ts     # 大数据树视口投影（≥5000 行）
├── treeDataGenerator.ts# 演示数据生成、性能阈值常量
├── virtualRender.ts    # 平铺表懒虚拟写入
├── groupData.ts        # 平铺多重分组展平
├── groupStatistics.ts  # 树形分组统计行
├── outline.ts          # Univer 原生行列大纲
├── readonly.ts         # 只读区域（BeforeSheetEditStart）
├── contextMenu.ts      # 右键菜单注册与默认项
├── attachment.ts       # 单元格附件
├── cellHistory.ts      # 变更历史 / 数据追踪
├── cellChangeContext.ts# onCellChange 行列维度补充（enrichCellChangeRecord）
├── cellValue.ts        # get/set 单元格与行值、定位解析
├── search.ts           # 快速搜索、查找框约束
└── icons.tsx           # 右键菜单 SVG 图标
```

---

## 3. 数据输入模式

组件支持三种互斥（或组合展平）的数据来源，优先级：`treeData` > `groupData` > `rows`。

### 3.1 直接模式

传入 `columns`、`rows`、`merges`、`rowGroups`、`columnGroups`，与 Univer 工作表一一对应。

```tsx
<ETable
  columns={[{ id: 'name', title: '姓名' }, { id: 'age', title: '年龄' }]}
  rows={[{ id: '1', data: { name: '张三', age: 28 } }]}
/>
```

- `row` / `column` / `merge` 中的索引均相对于**数据区域**（不含表头），从 0 开始。
- 表头行数由 `columns` 嵌套深度自动计算。

### 3.2 树形模式（推荐）

> **非透视表**：树形层级由 `flattenTreeData()` 在应用层展平为 `rows` / `merges`，再写入普通 Worksheet；折叠由 `treeCollapse` / `treeViewport` 控制可见行，而非 Univer Pivot 重算。

传入 `treeData` + `treeConfig`，由 `flattenTreeData()` 自动展平。

```tsx
<ETable
  treeData={treeNodes}
  treeConfig={{
    treeUI: true,
    labelMode: 'depth',
    dimensions: [
      { field: 'category', title: '品类' },
      { field: 'subcategory', title: '子品类', editable: true },
      { field: 'region', title: '区域' },
    ],
    measures: [
      { field: 'revenue', title: '净收入', type: 'number' },
      { field: 'profit', title: 'Profit', type: 'select', options: ['High', 'Medium', 'Low'] },
    ],
    defaultCollapsed: true,
  }}
/>
```

**树节点结构（`ETableTreeNode`）**

| 字段 | 说明 |
|------|------|
| `id` / `label` | 节点标识与显示名 |
| `collapsed` | 是否默认折叠子树 |
| `data` | 固定维度值（如 `{ subcategory: '华东' }`） |
| `values` | 当前行指标 |
| `children` | 子节点（品类 → 子品类） |
| `attributes` | 叶子上的属性层（如 Region），可带 `children` 城市明细 |

**`treeConfig` 要点**

| 配置 | 说明 |
|------|------|
| `treeUI: true` | 同列缩进 + ▶/▼，点击单元格折叠，不用左侧大纲栏 |
| `labelMode: 'single' \| 'depth'` | 标签写入第一维列 / 按深度写入各维列 |
| `measureGroups` | 列维度分组（East/Central 下挂 Sales/Profit） |
| `groupStatistics` | 子节点自动汇总行（小计/总计） |
| `liteMode` | 轻量展平，配合大数据生成器 |
| `compactLiteRows` | 每叶子 1 行，跳过城市明细与 Region toggle |
| `skipMerges` | 跳过海量跨行 merge（视口模式下 merge 懒应用） |

**折叠层级**

- `kind: 'category'`：品类/子品类折叠
- `kind: 'region'`：区域属性折叠（展开显示城市明细）
- 品类折叠仅隐藏品类 `rowGroups` 对应行；区域可独立展开（不强制展开父品类）

### 3.3 平铺分组模式

`groupData` + `groupConfig`：多维度路径分组（如 Selling Package → Year Quarter）。  
**交互类似透视表行分组**，但同样是 `flattenGroupedData()` 预展平 + 单元格合并 + 行大纲，不是透视引擎。

---

## 4. 表头配置（`columns` / `ETableColumn`）

表头由 **`ETableColumn[]` 树形结构**描述，组件内部经 `buildHeaderLayout()` 计算多级合并，再写入工作表第 `0 .. maxDepth-1` 行。

### 4.1 列节点字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 列唯一标识；**叶子列 `id` = 行数据 `data` 的 key** |
| `title` | `string` | 是 | 表头显示文案 |
| `width` | `number` | 否 | 列宽（px），未设则用 `options.defaultColumnWidth`（默认 110） |
| `children` | `ETableColumn[]` | 否 | 子列；有子列时为**分组表头**，无子列时为**叶子数据列** |
| `editable` | `boolean` | 否 | 是否允许编辑（树形维度列默认只读，见 `treeUI`） |
| `hidden` | `boolean` | 否 | 是否隐藏（预留） |
| `type` | `'text' \| 'number' \| 'date' \| 'select'` | 否 | 叶子列单元格类型，默认 `text` |
| `options` | `string[]` | 否 | `type: 'select'` 时的下拉选项 |
| `numberFormat` | `string` | 否 | 数字/日期格式，如 `¥#,##0`、`0.0%`、`yyyy-mm-dd` |
| `index` / `letter` | `number` / `string` | 否 | 展平后自动填充：列索引 0-based、Excel 列名 A/B/… |

### 4.2 多级表头布局规则

```
组织机构          │  2026年度预算                    │  费用科目
 (rowSpan=3)     │  (colSpan=6)                     │  (rowSpan=3)
                 ├──────────┬──────────┬───────────┤
                 │ 上半年    │ 下半年    │  …        │
                 │(colSpan=3)│(colSpan=3)│           │
                 ├────┬─────┼────┬─────┤           │
                 │ Q1 │ Q2  │ Q3 │ Q4  │  …        │  (叶子列)
```

- **有 `children`**：当前节点横向合并（`columnSpan = 子树叶子数`），占 1 行。
- **无 `children`（叶子）**：纵向合并至 `maxDepth`（`rowSpan = maxDepth - depth`）。
- **叶子列顺序**：从左到右 DFS 遍历，决定工作表列索引 `0, 1, 2, …`。
- **表头深度 `maxDepth`**：列树最大深度，同时决定 `options.freezeRows` 常用值。

### 4.3 表头来源（三种模式）

| 模式 | 表头来源 | 说明 |
|------|----------|------|
| 直接模式 | 直接传 `columns` | 业务完全自定义 |
| 树形模式 | `treeConfig.headerColumns` **或** 自动生成 | 见下节 |
| 分组模式 | `dimensions` + `measures` 拼成单层表头 | 无多级 children |

**树形表头生成优先级**（`buildTreeColumns`）：

1. **`treeConfig.headerColumns`** — 完整多级列树（演示页用法，可完全自定义分组名）
2. **`treeConfig.measureGroups`** — 指标按列分组（如 East/Central 下挂 Sales/Profit）
3. **自动生成** — `dimensions` + `attribute` + 扁平 `measures` 拼成一层表头

> 设置 `headerColumns` 后，展平逻辑仍从 `dimensions` / `attribute` / `measures` 读字段映射；**叶子列 `id` 必须与 `measures[].field`、维度 `field` 一致**。

### 4.4 演示页表头结构（参考）

`src/pages/UniverTable/index.tsx` → `buildHeaderColumns()`：

| 一级分组 | 二级 | 叶子列（field / id） |
|----------|------|----------------------|
| 主行层级 | rowTree | `category` 品类、`subcategory` 子品类 |
| 扩展行层级 | extensionRows | `region` 区域 |
| 核心经营指标 | 收入/订单/目标 | `revenue`、`productRevenue`、`orders`… |
| 业务治理 | 责任与核验/记录信息 | `owner`、`status`、`updatedAt`… |
| 扩展指标（动态） | 追加列 | 工具栏添加的 `cost`、`profit` 等 |

表头深度 `HEADER_DEPTH = 3`，冻结列 `HIERARCHY_COLS = 3`（品类 + 子品类 + 区域）。

### 4.5 自定义多级表头示例

```ts
const columns: ETableColumn[] = [
  {
    id: 'org',
    title: '组织',
    children: [
      { id: 'dept', title: '部门', width: 120 },
      { id: 'team', title: '团队', width: 100 },
    ],
  },
  {
    id: 'metrics',
    title: '经营指标',
    children: [
      {
        id: 'sales-group',
        title: '销售',
        children: [
          { id: 'amount', title: '金额', width: 110, type: 'number', numberFormat: '¥#,##0' },
          { id: 'qty', title: '数量', width: 90, type: 'number', numberFormat: '#,##0' },
        ],
      },
      { id: 'profit', title: '毛利', width: 100, type: 'select', options: ['High', 'Medium', 'Low'] },
    ],
  },
];
```

---

## 5. 表格数据格式

### 5.1 行数据（`ETableRow`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 行唯一标识（业务用，不写入单元格） |
| `data` | `Record<string, ETablePrimitive \| ETableCell>` | **key = 叶子列 `id`** |
| `height` | `number` | 行高（可选） |
| `readonly` | `boolean` | 整行只读（汇总行、总计行） |
| `style.bg` | `string` | 行背景色，如 `#E8F3FF` |

**单元格值两种写法：**

```ts
// 1. 原始值（简单场景）
data: { revenue: 128600, owner: '张三' }

// 2. 富单元格（带样式 / 公式 / 可编辑控制）
data: {
  revenue: { value: 128600, style: { bl: 1 } },
  profit: { value: 'High', editable: false },
  total: { formula: '=SUM(D4:D10)' },
}
```

**`ETableCell` 字段：**

| 字段 | 说明 |
|------|------|
| `value` | 显示值 |
| `style` | Univer 单元格样式（`bg`、`bl` 粗体等） |
| `formula` | 公式字符串 |
| `editable` | 覆盖列级/行级只读，单独控制该格 |

**`ETablePrimitive`：** `string | number | boolean | null | undefined`

### 5.2 合并（`ETableMerge`）

| 字段 | 说明 |
|------|------|
| `id` | 合并唯一标识 |
| `row` | 数据区起始行（**不含表头**，0-based） |
| `column` | 起始列（0-based，与叶子列顺序一致） |
| `rowSpan` / `columnSpan` | 跨度 |
| `value` | 合并区域显示值（可选，树形展平时自动写入） |

### 5.3 行分组 / 列分组

**`ETableRowGroup`（行大纲，相对数据区）：**

```ts
{ id: 'g-furniture', startRow: 1, count: 12, collapsed: true, children?: [...] }
```

**`ETableColumnGroup`（列大纲，相对叶子列）：**

```ts
{ id: 'cg-east', startColumn: 3, count: 4, collapsed: false }
```

树形 `treeUI` 模式下主要用单元格内 ▶/▼ + `hideRows`，原生行大纲为辅助；列分组用于 `measureGroups` 列折叠。

### 5.4 树形源数据（`ETableTreeNode`）

完整节点示例（对应演示页「家具 → 书柜 → 华东 → 上海/江苏」）：

```ts
const node: ETableTreeNode = {
  id: 'furniture',
  label: '家具',
  collapsed: true,
  children: [
    {
      id: 'furniture-bookcases',
      label: '书柜',
      data: { subcategory: '华东' },           // 写入子品类列
      attributes: [
        {
          id: 'bookcases-east',
          label: '华东',
          collapsed: true,                       // Region 默认折叠
          values: { revenue: 3724800, orders: 646, owner: '周宁' },  // 汇总行
          children: [                            // 展开后显示城市明细
            {
              id: 'bookcases-shanghai',
              label: '上海',
              values: { revenue: 2086400, orders: 352, owner: '杨晨', status: '已核验' },
            },
            {
              id: 'bookcases-jiangsu',
              label: '江苏',
              values: { revenue: 1638400, orders: 294, owner: '陈叶', status: '待复核' },
            },
          ],
        },
      ],
    },
  ],
};
```

**字段写入规则（展平后）：**

| 来源 | 写入列 | 说明 |
|------|--------|------|
| `label` | `dimensions[0]` 或按 `labelMode: 'depth'` 分层写入 | 树节点名称 + ▶/▼ |
| `data.{field}` | 对应维度列 | 如 `subcategory: '华东'` |
| `values.{field}` | 对应 `measures[].field` | 指标数值 |
| `attributes[].label` | `attribute.field`（如 `region`） | 属性层 |
| `attributes[].children[].values` | 指标列 | 城市明细行 |

**`ETableTreeAttribute`（属性层）：**

| 字段 | 说明 |
|------|------|
| `id` / `label` | 属性标识与显示（如「华东」） |
| `values` | 属性汇总行指标 |
| `children` | 明细（城市），展开 Region 后显示 |
| `collapsed` | 是否默认折叠明细 |

### 5.5 树形配置与表头对齐（`ETableTreeConfig`）

```ts
const treeConfig: ETableTreeConfig = {
  treeUI: true,
  labelMode: 'single',          // 或 'depth'
  defaultCollapsed: true,

  // 行维度（决定展平行结构与只读列）
  dimensions: [
    { field: 'category', title: '品类', width: 180 },
    { field: 'subcategory', title: '子品类', width: 120, editable: true },
  ],
  attribute: { field: 'region', title: '区域', width: 140 },

  // 表头（可选，与下面 measures 二选一或并用）
  headerColumns: buildHeaderColumns(),
  measures: [
    { field: 'revenue', title: '净收入', type: 'number', numberFormat: '¥#,##0' },
    { field: 'profit', title: 'Profit', type: 'select', options: ['High', 'Medium', 'Low'] },
  ],

  // 列维度分组（与行树独立）
  measureGroups: [
    {
      id: 'east',
      title: 'East',
      collapsed: false,
      measures: [
        { field: 'east_sales', title: 'Sales', type: 'number' },
        { field: 'east_profit', title: 'Profit', type: 'number' },
      ],
    },
  ],

  groupStatistics: {
    fields: [{ field: 'revenue', method: 'sum', name: '销售额合计' }],
    labelTemplate: '{label} 小计',
    showGrandTotal: true,
  },
};
```

**对齐约束（重要）：**

```
叶子列 columns[].id  ===  rows[].data 的 key
                      ===  treeConfig.measures[].field
                      ===  treeConfig.dimensions[].field / attribute.field
```

`headerColumns` 只影响表头展示层级，**不改变** `data` 的 key；`measures` 的 `field` 必须与叶子 `id` 一致。

### 5.6 平铺分组数据（`groupData` + `groupConfig`）

**`groupData`：** 平铺记录数组

```ts
[
  { sellingPackage: 'Each', yearQuarter: '2013Q1', sales: 100, profit: 20 },
  { sellingPackage: 'Each', yearQuarter: '2013Q2', sales: 120, profit: 25 },
]
```

**`groupConfig`：**

| 字段 | 说明 |
|------|------|
| `dimensions` | 分组维度列（从左到右层级递增） |
| `measures` | 明细指标列 |
| `dimensionStyle.bg` | 维度列背景色 |
| `defaultCollapsed` | 默认折叠 |
| `collapsedPaths` | 指定路径默认折叠，如 `[{ sellingPackage: 'Each' }]` |

展平后自动生成：维度列纵向合并、`rowGroups` 折叠、明细行 `data`。

### 5.7 展平结果（内部结构）

无论哪种输入，组件内部统一为 `ETableFlattenResult`：

```ts
interface ETableFlattenResult {
  columns: ETableColumn[];      // 含多级表头
  rows: ETableRow[];
  rowGroups: ETableRowGroup[];
  columnGroups: ETableColumnGroup[];
  merges: ETableMerge[];
  treeToggles?: ETableTreeToggleBinding[];  // treeUI 折叠绑定
}
```

**坐标系约定：**

| 概念 | 行 | 列 |
|------|----|----|
| 表头 | `0 .. maxDepth-1` | 叶子列索引 |
| 数据区 | `maxDepth + dataRow` | 叶子列索引 |
| `merge.row` / `rowGroup.startRow` | 相对**数据区** 0 起 | — |
| `merge.column` / `columnGroup.startColumn` | — | 相对**叶子列** 0 起 |

### 5.8 批注与附件（补充）

```ts
// 批注
comments: [{ cell: 'D5', content: '请复核', userId: 'u1' }]

// 附件（元数据在 customMetaData，非单元格 value）
attachments: [{
  cell: 'D5',
  files: [{ id: 'att-1', name: '报表.xlsx', url: 'https://...', size: 6200 }],
}]
```

---

## 6. 渲染策略

初始化时按数据规模自动选择路径（见 `index.tsx` `finishInit`）。

```
                    ┌─────────────────┐
                    │  flatten 数据    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   treeUI +           平铺 + virtualScroll    中小数据
   rows≥5000          + rows≥5000             全量/异步
         │                   │                   │
         ▼                   ▼                   ▼
  treeViewport         virtualRender         renderData
  (窗口 300 行)        (按页 2000 行)        / renderDataAsync
```

### 6.1 阈值常量

| 常量 | 值 | 文件 | 含义 |
|------|-----|------|------|
| `ASYNC_RENDER_ROW_THRESHOLD` | 1000 | treeDataGenerator | 异步分片 `setValues` |
| `LARGE_TREE_FLAT_ROW_THRESHOLD` | 5000 | treeDataGenerator | 大树轻量模式判定 |
| `VIRTUAL_LAZY_THRESHOLD` | 5000 | virtualRender | 平铺懒虚拟 |
| `VIRTUAL_PAGE_SIZE` | 2000 | virtualRender | 每页行数 |
| `TREE_VIEWPORT_THRESHOLD` | 5000 | treeViewport | 启用视口投影 |
| `TREE_VIEWPORT_WINDOW_SIZE` | 300 | treeViewport | 工作表投影行数 |
| `LARGE_TOGGLE_COUNT` | 200 | treeCollapse | 分批 hideRows |

### 6.2 树形视口投影（Plan A）

**条件**：`treeUI && rows.length >= 5000 && treeToggles.length > 0`

- 全量逻辑行保留在内存（`visibleLogicalRows`）
- 工作表仅投影约 300 行窗口（`windowOffset` 随滚动翻页）
- 折叠/展开过滤可见逻辑行，而非对全表 `hideRows`
- 合并单元格按逻辑锚点增量更新（`planProjectedMerges` / `breakStaleProjectedMerges`）
- 行号通过 `customizeRowHeader` 显示可见列表序号（1-based），非工作表物理行号

**统计**：`ref.getTreeViewportStats()` → `TreeViewportStats`（`displayRangeStart/End` 等）

### 6.3 树形 hideRows 模式（< 5000 行）

`setupTreeCellCollapse()`：对全量工作表行使用 `hideRows` / `showRows`，展开 Region 后 `reapplyMergesForRowSpan` 修复 merge。

### 6.4 平铺懒虚拟

非树表、行数 ≥ 5000：首次写表头，数据按页懒写入，滚动时 `ensureRows` 补页。

---

## 7. 组件 API

### 7.1 Props（`ETableProps`）

| 分类 | 属性 | 说明 |
|------|------|------|
| 数据 | `columns`, `rows`, `merges`, `rowGroups`, `columnGroups` | 直接模式 |
| 树形 | `treeData`, `treeConfig` | 自动展平 |
| 分组 | `groupData`, `groupConfig` | 多重分组 |
| 批注 | `comments` | Thread Comment 初始化 |
| 附件 | `attachments`, `onUploadAttachment`, `onAttachmentsChange` | 元数据写入 `customMetaData` |
| 事件 | `onCellChange`, `onSelectionChange`, `onViewCellHistory`, `onViewDataTrace` | `onCellChange` 含 `rowDimensions` / `columnDimensions` |
| 配置 | `options` | 见下表 |
| 生命周期 | `onReady` | 返回 `univerAPI`、`renderMs`、`rowCount`、`treeViewport` 等 |

**`options`（`ETableOptions` + 扩展）**

| 属性 | 默认 | 说明 |
|------|------|------|
| `name` | `'Table'` | 工作簿名 |
| `defaultColumnWidth` | `110` | |
| `defaultRowHeight` | `30` | |
| `showGridLines` | `true` | |
| `freezeRows` / `freezeColumns` | — | 冻结表头/列 |
| `customizeColumnHeader` | `true` | 业务列头覆盖原生 |
| `virtualScroll` | `true` | Canvas 滚动 + 大数据懒写 |
| `contextMenuItems` | `defaultContextMenuItems` | 右键菜单项 |
| `enableContextMenu` | `true` | `false` 时禁用并拦截右键 |

### 7.2 Ref（`ETableRef`）

| 方法 | 说明 |
|------|------|
| `getUniverAPI()` / `getWorkbook()` / `getWorksheet()` | Univer 实例 |
| `collapseRowGroup` / `expandRowGroup` | 折叠/展开指定行组 |
| `collapseAllRows` / `expandAllRows` | 收起所有展开项 / 展开所有折叠项（含品类与区域行组） |
| `collapseColumnGroup` / … | 列大纲 |
| `addComment` / `getComments` / `deleteComment` | 批注 |
| `addAttachment` / `setAttachments` / `getAttachments` / `viewAttachments` | 附件 |
| `drillDown` / `drillUp` / `getBreadcrumb` | 树形下钻/上钻 |
| `openSearch` / `search` | 快速搜索 |
| `undo` / `redo` | 撤销重做 |
| `getTracks` / `getCellHistory` / `getDataTrace` | 变更流水 / 单格历史 / 数据追踪（见 §1.3.6） |
| `getTableData(options?)` | **全量表格快照** `ETableExportData`（见 §1.3.6） |
| `getTreeData(options?)` | **树形源数据快照** `ETableTreeNode[] \| null`（见 §1.3.10） |
| `setCellValue(locator, value, options?)` | **程序化更新单格**（见 §1.3.7） |
| `setRowValue(locator, data, options?)` | **程序化更新一行**（见 §1.3.8） |
| `getCellValue(locator, options?)` | **读取单格当前值**（见 §1.3.9） |
| `getRowValue(locator, options?)` | **读取一行当前值**（见 §1.3.9） |
| `getVirtualRenderStats` / `getTreeViewportStats` | 性能状态 |

### 7.3 数据获取示例

```tsx
import { useRef, useState } from 'react';
import ETable, { type ETableRef, type ETableCellChangeRecord } from '@/components/UniverTable';

const HEADER_DEPTH = 3;
const leafColumns = [/* 与表头叶子列一致 */];

export default function Page() {
  const tableRef = useRef<ETableRef>(null);
  const [tracks, setTracks] = useState<ETableCellChangeRecord[]>([]);

  return (
    <ETable
      ref={tableRef}
      treeData={treeData}
      treeConfig={treeConfig}
      options={{ freezeRows: HEADER_DEPTH }}
      // ① 单个更新：每次编辑一条（含行列维度）
      onCellChange={(record) => {
        setTracks((prev) => [record, ...prev]);
        console.log('单格更新', {
          cell: record.cell,
          field: record.field,
          to: record.to,
          rowDimensions: record.rowDimensions,
          columnDimensions: record.columnDimensions,
          rowPath: record.rowPath,
        });
      }}
    />
  );
}

// ② 全量更新（Diff）
function exportPatches() {
  return tableRef.current?.getTracks() ?? [];
}

// ③ 全量表格（推荐 getTableData）
function exportAllTableData() {
  return tableRef.current?.getTableData();
}

// ④ 树形源数据（含编辑，回写后端）
function exportTreeData() {
  return tableRef.current?.getTreeData();
}
```

详见 **§1.3.6 数据获取方式**。

### 7.4 回调示例

```tsx
const tableRef = useRef<ETableRef>(null);

<ETable
  ref={tableRef}
  treeData={data}
  treeConfig={config}
  onReady={({ renderMs, rowCount, treeViewport }) => {
    console.log('渲染耗时', renderMs, '行数', rowCount, treeViewport);
  }}
  onCellChange={(record) => setTracks((prev) => [record, ...prev])}
  onSelectionChange={(cell) => setFocusCell(cell)}
/>
```

---

## 8. 只读规则

`setupReadonlyCells()` 监听 `BeforeSheetEditStart`：

- 表头行：全部只读
- `treeConfig.dimensions` 中未设 `editable: true` 的列：只读
- 汇总行 / 总计行：`readonly: true` 的行
- 例外：`editableOnReadonlyRowColumns`（如子品类列可在汇总行编辑）
- 视口模式：通过 `isReadonlyDataRow(logicalRow)` 动态判断

程序化 `setValue`（折叠图标 ▶/▼）不受只读拦截。

---

## 9. 右键菜单

默认项（`contextMenu.ts` → `defaultContextMenuItems`）：

- 复制 / 粘贴
- 批注：新增、编辑、删除
- 附件：添加、查看、清空
- 查看单元格历史、数据追踪
- 下钻 / 上钻、快速搜索
- 撤销 / 重做

实现要点：

- 通过 `customizeContextMenu()` 注册到 Univer `IMenuManagerService`
- `hideNativeContextMenus()` 隐藏原生项，仅保留 `etable-*` 白名单
- `enableContextMenu: false` 时调用 `disableContextMenu()` + `setupContextMenuBlock()`
- 有批注单元格首次右键：`setupCommentContextMenuGuard()` 先关闭 hover 弹层

自定义菜单：

```ts
import { createContextMenuItem, customizeContextMenu } from './contextMenu';

createContextMenuItem({
  id: 'my-action',
  title: '自定义操作',
  action: ({ cell, row, column }) => { /* ... */ },
});
```

---

## 10. 附件

- 元数据 key：`etableAttachments`（`customMetaData`）
- 有 Note 预设时同步 📎 角标（不与用户批注冲突）
- 默认上传：本地 `blob:` URL（演示用）；生产请实现 `onUploadAttachment`
- 查看弹窗：`showAttachmentsModal()`（`attachment.ts`）

```tsx
onUploadAttachment={async (file, cell) => ({
  id: '...',
  name: file.name,
  url: await uploadToOSS(file),
  size: file.size,
})}
```

---

## 11. 单元格历史与数据追踪

- `setupCellHistory()`：监听编辑、粘贴，写入 `ETableCellChangeRecord`
- `enrichCellChangeRecord()`（`cellChangeContext.ts`）：在 `onCellChange` 回调前补充 `field`、`dataRow`、`logicalRow`、`rowDimensions`、`columnDimensions`、`rowPath`
- 工具函数：`resolveColumnDimensionPath()`、`resolveRowDimensions()` 可单独用于测试或自定义 enrich
- 右键「查看单元格历史」→ `onViewCellHistory`
- 右键「数据追踪」→ `onViewDataTrace`（`getDataTrace()` 构建简化血缘树）
- 演示页右侧 Drawer 展示 `tracks` 与 `traceTree`

---

## 12. 搜索

- `openQuickSearch(univerAPI)`：打开 Univer 查找对话框
- `constrainFindDialogToContainer()`：将查找框限制在表格容器内
- `ref.search(keyword)`：程序化搜索并定位

---

## 13. Univer Preset 依赖

| Preset | 用途 |
|--------|------|
| `UniverSheetsCorePreset` | 核心表格、滚动、菜单预隐藏 |
| `UniverSheetsAdvancedPreset` | 高级能力 |
| `UniverSheetsThreadCommentPreset` | 批注 |
| `UniverSheetsNotePreset` | 备注/附件角标 |
| `UniverSheetsDataValidationPreset` | 下拉、数字格式 |
| `UniverSheetsFindReplacePreset` | 查找替换 |

初始化时关闭工具栏、公式栏、页脚（`header: false, toolbar: false, ...`），由业务页自行布局。

---

## 14. 演示页说明

`src/pages/UniverTable/index.tsx`：

| 开关 | 作用 |
|------|------|
| 数据规模 | 树形演示（~31 行）/ 1万 / 5万 / 10万 |
| 网格线 / 冻结表头 | `options.showGridLines` / `freezeRows` |
| 右键菜单 | `enableContextMenu` |
| 虚拟滚动 | `virtualScroll`（切换会 remount） |
| 全屏 | 仅表格区域 `requestFullscreen` |

树形演示数据：品类 → 子品类 → 区域（可展开城市）；`Profit` 下拉、`Date` 日期列、子品类可编辑。

大数据使用 `generateScaledTreeData()` + `liteMode` / `compactLiteRows`。

---

## 15. 性能建议

1. **1 万行以上树表**：保持 `treeUI: true`，依赖视口投影；避免关闭 `virtualScroll` 并期望全量行在 sheet 上。
2. **减少展平行数**：`compactLiteRows: true` + `liteMode: true`。
3. **减少 merge**：`skipMerges: true`（视口内懒 merge）。
4. **避免频繁 remount**：演示页切换 `virtualScroll` 会 `tableKey++` 整表重建，生产环境慎用。
5. **附件上传**：务必接真实 OSS，勿依赖默认 blob URL。

---

## 16. 已知限制

1. 视口投影下，工作表物理行号 ≠ 业务行号；导出/公式引用需注意 `logicalRowResolver`。
2. 全表展开后可见逻辑行上万时，折叠筛选仍有成本，无法与 2 行演示完全同等流畅。
3. `hideRows` 会破坏 merge，Region 展开后需 `reapplyMergesForRowSpan`。
4. 跨视口窗口搜索/跳转未单独增强，依赖 Univer 原生查找。
5. 选区高亮由 Univer 原生处理；树形展开/收起时 merge 可能导致选区短暂扩大（已不做自定义干预）。

---

## 17. 快速接入清单

```tsx
import ETable, { type ETableRef } from '@/components/UniverTable';
import type { ETableTreeNode, ETableTreeConfig } from '@/components/UniverTable/types';

const config: ETableTreeConfig = {
  treeUI: true,
  labelMode: 'depth',
  dimensions: [/* ... */],
  measures: [/* ... */],
};

export default function Page() {
  const ref = useRef<ETableRef>(null);
  return (
    <div style={{ height: 560 }}>
      <ETable
        ref={ref}
        treeData={nodes}
        treeConfig={config}
        options={{ freezeRows: 2, freezeColumns: 3 }}
        onReady={(p) => console.log(p.renderMs)}
      />
    </div>
  );
}
```

**注意**：容器必须有明确高度（`height` 或 `flex: 1` + `minHeight: 0`），否则 Univer Canvas 无法正确计算视口。

---

## 18. 相关文件索引

| 文件 | 说明 |
|------|------|
| `src/components/UniverTable/index.tsx` | 组件实现 |
| `src/components/UniverTable/types.ts` | 完整类型 |
| `src/pages/UniverTable/index.tsx` | 演示与大数据生成 |

---

*文档版本与代码同步至当前仓库实现（Univer 0.25.x，树形视口投影 + hideRows 双路径）。*
