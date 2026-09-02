# SpreadJS 经营数据表

本目录实现了 `/spreadjs-demo/business` 页面。它以普通 SpreadJS Worksheet 为内核，在其上增加业务层级投影、双列独立折叠、单元格审计、附件和 10 万行压力数据等能力。

这不是 SpreadJS PivotTable。页面先将树形业务数据投影为二维 `ViewRow[]`，再写入 Worksheet；产品树和区域树的展开状态由应用层单独维护。

## 快速定位

- 路由配置：[`../../../.umirc.ts`](../../../.umirc.ts)
- 页面入口：[`index.tsx`](./index.tsx)
- React 通用界面：[`components/spreadsheet-ui.tsx`](./components/spreadsheet-ui.tsx)
- 数据模型与二维投影：[`spreadsheet/model.ts`](./spreadsheet/model.ts)
- 后台树形列配置：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts)
- 前后端业务维度：[`spreadsheet/business-cell-coordinate.ts`](./spreadsheet/business-cell-coordinate.ts)
- SpreadJS 初始化、渲染和事件：[`spreadsheet/use-spreadsheet-controller.ts`](./spreadsheet/use-spreadsheet-controller.ts)
- 剪贴板回调适配：[`spreadsheet/clipboard.ts`](./spreadsheet/clipboard.ts)
- 页面样式：[`index.less`](./index.less)
- SpreadJS 类型补充：[`typings.d.ts`](./typings.d.ts)

页面的主调用链如下：

```text
.umirc.ts 路由
    ↓
SpreadJSDemoPage（React 页面）
    ↓ useSpreadsheetController()
创建 SpreadJS Workbook，并注册命令与事件
    ↓
BUSINESS_DATA（children 行树，包含全部汇总与明细）
    + BUSINESS_COLUMN_DATA（children 列树）
    + 产品展开状态 + 区域展开状态
    ↓ createBusinessProjectionRows()
ViewRow[]
    ↓ viewRowValues() / renderRows()
SpreadJS Worksheet
    ↓ EnterCell / CellClick / CellChanged / RangeChanged 等事件
业务数据、历史记录和 React 面板状态同步更新
```

---

## 1. 表格实现的功能

### 1.0 后台业务数据结构

`BUSINESS_DATA` 使用与业务层级一致的 `children` 树。`id` 就是后台记录 ID，每一级节点都直接包含自己的完整指标：

```ts
[
  {
    id: 'furniture',
    name: '家具',
    hierarchyRole: 'category',
    revenue: 15099200, // 家具汇总，由后台直接返回
    // ...其他完整指标
    children: [
      {
        id: 'furniture-chairs',
        name: '座椅',
        hierarchyRole: 'subcategory',
        revenue: 9081200, // 座椅汇总
        children: [
          {
            id: 'chairs-east',
            name: '华东',
            hierarchyRole: 'region',
            revenue: 4267000, // 座椅 × 华东汇总
            children: [
              {
                id: 'chairs-zhejiang',
                name: '浙江',
                hierarchyRole: 'detail',
                revenue: 2483500
              }
            ]
          }
        ]
      }
    ],
    regionSummaries: [
      {
        id: 'furniture-summary-east',
        name: '华东',
        hierarchyRole: 'region',
        revenue: 7991800,
        detailIds: ['bookcases-shanghai', 'bookcases-jiangsu', 'chairs-zhejiang', 'chairs-anhui']
      }
    ]
  }
]
```

结构约定：

- 主业务层级始终通过 `children` 表达：产品大类 → 产品子类 → 区域 → 明细；
- `category`、`subcategory`、`region` 都是后台返回的可编辑汇总记录，不由前端根据子节点重算；
- `detail` 是叶子明细；
- 顶层产品大类的 `regionSummaries` 是跨多个产品子类的区域汇总。它同样由后台直接返回；`detailIds` 只引用树中已有明细，避免复制同一条记录；
- 所有节点 `id` 仍然全局唯一，供前端内部更新数据；前后台单元格通信使用完整行维路径和列维路径。应用启动时会检查完整行维是否唯一。

例如，后台编辑“座椅 × 华东”的净收入时，只需要：

```ts
{
  row: {
    category: '家具',
    subcategory: '座椅',
    region: '华东'
  },
  column: ['core-metrics', 'income-metrics', 'revenue']
}
```

### 1.1 业务维度和双列独立折叠

前三列是业务维度：

| 列 | 内容 | 行为 |
| --- | --- | --- |
| 产品层级 | 产品大类、产品子类或事业群、产品线 | 维护产品树的展开状态 |
| 产品属性 | 产品的业务属性 | 跟随产品块纵向合并，不参与折叠 |
| 区域层级 | 大区、城市或区域明细 | 每个产品分别维护自己的区域展开状态 |

常规模式通过两个彼此独立的数据结构维护展开状态：

```ts
productExpanded: Set<string>
regionExpandedByProduct: Map<productId, Set<regionId>>
```

因此，展开“家具”的“华东”不会改变其他产品的区域状态；收起产品树也不会清空已经保存的区域选择。

`createBusinessProjectionRows()` 根据这两个状态重新计算当前可见的 `ViewRow[]`。同一产品对应的产品名称和属性使用 `productRowSpan` 纵向合并，区域行则在第三列独立展开。

常规模式和 10 万行模式都采用“重新投影并渲染当前可见数据”，不使用 SpreadJS 原生行 Outline。两种模式共享同一套交互语义：

- 产品列只读写 `productExpanded`；
- 区域列只读写 `regionExpandedByProduct`；
- 展开或收起任意一列，都不会改写另一列的状态；
- 10 万行模式仅扩展底层数据规模，并在单元格写入阶段增加按视口分页。

因此，两种模式不仅布局相同，节点箭头、可点击位置、展开层级和状态保持行为也相同。

### 1.2 多级表头、冻结列和列分组

列配置同样模拟由后台返回。后台只需要返回一棵直观的 `BUSINESS_COLUMN_DATA` 树，不再分别维护平铺列、表头合并范围和 Outline 数字：

```ts
{
  id: 'core-metrics',
  label: '核心经营指标',
  summaryField: 'revenue', // 整组折叠后保留净收入
  children: [
    {
      id: 'income-metrics',
      label: '收入指标',
      summaryField: 'revenue',
      children: [
        {
          id: 'revenue',
          field: 'revenue',
          label: '净收入',
          width: 112,
          dataType: 'number',
          format: 'currency',
          editor: { type: 'number' },
          editable: true
        },
        // 商品收入、服务收入……
      ]
    }
  ]
}
```

其中：

- 有 `children` 的节点是合并表头分组；
- 有 `field` 的节点是实际数据列；
- 数组顺序就是最终列顺序；
- `summaryField` 指定列组折叠后常驻的汇总列；
- `frozen` 指定需要冻结的根分组；
- `dataType` 只描述业务值类型，例如 `string`、`number`、`boolean`、`date`；日期在 JSON 中可以传 ISO 字符串，前端入模时转换为 `Date`；
- `format` 只描述显示格式，例如 `currency`、`integer`、`percent`、`date`、`decimal`；
- `editor` 只描述编辑控件，例如普通输入框、下拉框、复选框或日期选择器；
- `editable` 控制该字段是否允许编辑。

例如，`status` 本质上是字符串，只是使用固定选项下拉框；`verified` 才是真正的布尔值：

```ts
{
  field: 'status',
  dataType: 'string',
  editor: { type: 'select', options: ['已核验', '待复核', '异常'] },
  editable: true
}

{
  field: 'verified',
  dataType: 'boolean',
  editor: { type: 'checkbox' },
  editable: true
}
```

前端通过 `buildBusinessColumnModel()` 一次性派生：

```text
BUSINESS_COLUMN_DATA
  ├─ COLUMNS：叶子列顺序
  ├─ COLUMN_HEADER_CELLS：任意层级表头及合并范围
  ├─ COLUMN_GROUPS：SpreadJS 列 Outline
  ├─ HIERARCHY_COLUMN_COUNT：左侧冻结列数
  └─ field → columnIndex：业务字段到物理列号
```

列树与 `BUSINESS_DATA` 通过 `field` 配合：普通叶子列的 `field` 必须是业务节点上的字段，例如 `revenue`；产品层级、产品属性和区域层级是投影字段。应用启动时会检查所有业务节点 `id` 和完整行维唯一，并检查每个业务节点是否具有后台列配置要求的字段，配置错误会立即报出。

最终生成的表头包括：

- 业务维度；
- 核心经营指标；
- 业务治理。

前三列被冻结。收入、订单和治理明细使用 SpreadJS 原生 Column Outline，可以统一展开或收起，同时保留汇总列。

### 1.3 下钻和上钻

常规模式支持从产品大类下钻到下一级产品数据，并通过面包屑或“返回上级”恢复视图。

```text
当前 ViewRow
    ↓ viewForNode()
DrillView 路径
    ↓ rootsForView()
当前层级的业务根节点
    ↓ createBusinessProjectionRows()
新的二维表格
```

10 万行模式同样使用产品树和区域树的独立投影，但不提供页面级下钻，避免在压力数据上同时维护两套导航语义。

### 1.4 单元格编辑和字段控件

表格按字段配置不同交互：

- 金额、订单、百分比和小数格式；
- 核验状态下拉框；
- “已核验”复选框；
- 更新日期选择器；
- 调整系数数值校验；
- 状态与“已核验”字段联动；
- 收入、商品收入、服务收入与客单价保持计算一致；
- 订单数、线上订单、线下订单与客单价保持计算一致；
- 层级列、产品属性和自动计算的客单价只读；后台返回的汇总记录与明细记录都可编辑。

`getCellEditability()` 是唯一的可编辑策略入口。只要当前投影单元格能够唯一映射到 `BUSINESS_DATA` 中的一条后台记录，就允许编辑；这既包括叶子明细，也包括产品、子类和区域汇总。只有层级/属性字段、自动派生的客单价或无法唯一映射的投影数据只读。控制器同时使用 SpreadJS 单元格锁定、`EditStarting` 和粘贴前校验执行这套规则，不能只依赖样式。

`BUSINESS_DATA` 是完整的后台业务树，必须包含所有汇总数据：产品汇总、区域汇总和叶子明细都各自拥有稳定 `id` 与完整指标。前端不会根据明细重新聚合或覆盖汇总值；编辑汇总节点也只更新该节点，不会自动向下分摊到明细。

所有业务值修改最终批量进入 `commitBusinessCellValues()`：

```text
单格编辑 / 粘贴 / 清空 / 撤销 / 重做
  ↓ getCellEditability()
定位唯一 BUSINESS_DATA 树节点（汇总或明细）
  ↓ toBusinessCellDimension()
从两棵后台树生成稳定的行维路径和列维路径
  ↓ updateBusinessNode()
更新直接字段及收入、订单、状态等同级联动字段
  ↓ createBusinessProjectionRows() / createStressProjectionRows()
常规模式直接更新 BUSINESS_DATA 节点并重新投影；压力模式重新生成当前投影
  ↓ 比较修改前后的 ViewRow[]
刷新直接修改和同级字段联动，并写入历史
```

具体规则如下：

- 修改净收入：按修改前占比同步分摊商品收入和服务收入，并重算客单价；
- 修改商品收入或服务收入：重算净收入和客单价；
- 修改订单数：按修改前占比同步分摊线上和线下订单，并重算客单价；
- 修改线上订单或线下订单：重算订单数和客单价；
- 修改状态或“已核验”：双向同步另一字段；
- 常规模式的产品和区域汇总指标由后端直接返回，并保存在对应的 `BUSINESS_DATA` 树节点上。编辑明细只改变该明细节点，编辑汇总也只改变对应汇总节点；两者都只联动同一节点内的派生字段。

#### 前后端业务单元格维度

不要把 Worksheet 行号或 `ViewRow.id` 传给后端。它们会随着折叠、展开和下钻变化。编辑回调只返回修改前值、修改后值以及明确分开的行维和列维：

```ts
{
  oldValue: 4814200,
  newValue: 4900000,
  dimension: {
    row: {
      category: '家具',
      subcategory: '书柜',
      region: '华东',
      detail: '上海'
    },
    column: ['core-metrics', 'income-metrics', 'revenue']
  }
}
```

其中：

- `dimension.row` 来自 `BUSINESS_DATA` 的 `children` 路径，键固定为 `category → subcategory → region → detail`；汇总行只包含实际存在的层级，例如大类区域汇总是 `{ category: '家具', region: '华东' }`；
- `dimension.column` 来自 `BUSINESS_COLUMN_DATA` 的 `children` 路径，数组内容全部是稳定 `id`，最后一项是叶子列 ID；
- 行维、列维都不包含物理行号或列号。前端启动时会校验行路径唯一、列 ID 和字段唯一，避免后台维度定位到多个业务单元格。

转换方向如下：

```text
表格行列位置
  ↓ toBusinessCellDimension(viewRow, col)
{ row: BusinessRowDimension, column: BusinessColumnDimension }
  ↓ 随修改请求发给后台，后台可原样返回
isBusinessCellDimension() 运行时校验
  ↓ resolveBusinessCellDimension()
全展开投影中的目标及祖先
  ↓ actionsRef.current.locateBusinessCell(dimension)
只展开必要产品/区域，选中并滚动到实际单元格
```

真实接口可通过控制器回调接入：

```ts
useSpreadsheetController({
  onBusinessCellChange(payload) {
    // payload 只有 oldValue、newValue、dimension。
    void saveCellChange(payload);
  },
});
```

后端响应中的维度可直接反向定位：

```ts
actionsRef.current?.locateBusinessCell(response.dimension);
```

底层的纯转换方法也可以单独使用：

```ts
const dimension = toBusinessCellDimension(viewRow, columnIndex);
const location = resolveBusinessCellDimension(fullyExpandedRows, dimension);
// location.row / location.col 是当前投影中的物理坐标。
```

页面工具栏提供“维度定位”验证入口。粘贴 `{ row, column }` JSON 后点击“定位单元格”（或按 Ctrl/⌘ + Enter），页面会调用 `locateBusinessCell()`，自动展开必要的产品、区域和列分组，再滚动并选中目标单元格。该入口只用于人工验收双向转换，不属于正式业务流程。

### 1.5 撤销、重做和单元格历史

页面在 SpreadJS 原生 UndoManager 外增加了一层业务历史。以下修改都会记录旧值、新值、来源和时间：

- 直接编辑；
- 公式编辑；
- 复制、剪切和外部粘贴；
- 清空；
- 拖拽填充、拖放移动；
- 撤销和重做；
- 同级字段联动（如净收入 ↔ 商品/服务收入）。

区域、产品及事业群等汇总行不再随明细编辑联动变化（详见 1.4 节），因此不会产生“汇总联动”历史记录。

粘贴场景在 `ClipboardPasting` 中保存操作前快照，在 `ClipboardPasted` 中比较新旧值。批量范围操作由 `RangeChanged` 兜底。

开发环境中，每个直接修改都会输出 `[SpreadJS Demo][单元格修改]`，对象中只有 `oldValue`、`newValue` 和 `dimension`。生产构建不会输出这些调试日志；正式接入使用 `onBusinessCellChange` 回调。

### 1.6 快速搜索

搜索范围包含当前业务层级内的已折叠内容：

- 常规模式先构造“全部展开”的投影视图，搜索稳定业务 ID 对应的单元格；
- 命中隐藏行时，只展开命中项所需的产品和区域祖先；
- 命中隐藏列时自动展开列组或恢复该列；
- 展示匹配总数、当前位置和 A1 地址；
- 支持上一个、下一个匹配；
- 数据变化后主动使旧搜索结果失效。

10 万行模式直接搜索全部底层 `ViewRow`，命中后展开必要的事业群、产品线和区域节点，再定位到投影后的稳定行。扫描过程中每 5,000 行让出一次主线程，使搜索可以取消，并避免长时间冻结页面。

### 1.7 批注、附件和数据追踪

批注、附件和历史不以 `A1` 地址作为持久身份，而是使用：

```ts
stableCellKey(node.id, column.field)
```

即“业务行 ID + 字段 ID”。展开、折叠和下钻可能改变行号，但不会改变业务单元格身份。

- **批注**：使用 SpreadJS 原生 Comment 展示，同时用稳定 ID 保存内容；
- **附件**：附件与单元格值分开保存，通过单元格按钮显示回形针和数量；
- **数据追踪**：对净收入、客单价、目标达成等字段展示来源和计算规则；
- **历史**：按稳定单元格 ID 展示所有值变化。

当前附件和历史都是 Demo 级浏览器内存实现，刷新后不会持久化。数据追踪中的来源规则也是前端演示数据，不代表真实后端血缘。

### 1.8 选区统计

选区变化后计算：

- 单元格数量；
- 数值数量和忽略数量；
- SUM、AVG、COUNT、MIN、MAX；
- 两种受控自定义表达式；
- 金额、百分比、小数等结果格式。

为避免超大选区阻塞主线程，最多检查 200,000 个单元格，并在结果中提示截断状态。

### 1.9 10 万行压力模式

压力模式生成固定的 100,000 个底层 `ViewRow`，数据层级为：

```text
10 个事业群
  └─ 100 条产品线
       └─ 1,000 个产品线区域组
            └─ 经营明细
```

事业群还会按区域聚合出 100 个父级区域节点，因此界面统计的可展开区域节点总数为 1,100。初始状态只投影 10 个事业群各自的 10 个区域汇总，共 100 行；展开事业群后再加入对应产品线，展开区域后再加入该区域的明细。

主要性能策略：

- 数据按 5,000 行异步生成并让出主线程；
- 使用 `WeakMap` 缓存 10 万条底层记录的产品、区域索引；
- 折叠时只生成当前可见的业务投影，不把 10 万行全部写入 Worksheet；
- 产品树与区域树复用常规模式的独立状态集合；
- 当前投影按每页 400 行物化，且每一批都会先模拟一次带延迟（`STRESS_PAGE_FETCH_DELAY_MS`）的后端分页请求：滚动接近已加载数据边界时先在该批行写入“正在加载…”占位提示，请求“返回”后才把真实数据写入表格，制造真实的分批加载观感；
- `TopRowChanged` 后仅加载可视区附近数据；
- 单元格类型和验证器复用；
- 批量操作期间暂停绘制、事件和计算服务；
- 退出压力模式或重新加载时，会递增内部“会话代次”使尚未返回的分页请求失效，避免过期数据回写到错误的行；
- 退出压力模式时释放缓存。

---

## 2. 代码组织结构

### 2.1 `index.tsx`：React 页面编排

该文件负责“界面是什么样”，不直接操作 SpreadJS Workbook。

主要内容：

- 页面标题和工具栏；
- 搜索、列管理和折叠控制；
- 下钻路径；
- 公式栏外观；
- SpreadJS 挂载容器；
- 批注、历史、附件、数据追踪、统计等抽屉；
- 加载、错误、Toast 和状态栏。

页面通过下面两个引用连接 SpreadJS：

```ts
const { hostRef, actionsRef, ...uiState } = useSpreadsheetController();
```

- `hostRef` 是 Workbook 的 DOM 挂载点；
- `actionsRef` 是 React 按钮调用 SpreadJS 命令的桥梁；
- `uiState` 是需要触发 React 渲染的选中项、搜索结果、面板状态等。

例如工具栏“撤销”只调用 `actionsRef.current?.undo()`，具体命令和历史处理都在控制器中完成。

### 2.2 `components/spreadsheet-ui.tsx`：通用 React 组件

这里包含不依赖 Workbook 实例的展示组件：

- `DemoHeader`；
- `SearchPopover`；
- `ColumnVisibilityPopover`；
- `SheetStatusBar`；
- `ToastMessage`；
- `Drawer`。

这些组件通过 props 接收状态和回调。新增纯界面功能时优先放在这里，不要把 Workbook 操作传入组件内部。

### 2.3 `spreadsheet/model.ts`：业务数据和纯计算

该文件应尽量保持为“不依赖 React、不直接操作 SpreadJS”的模型层，主要负责：

- 业务类型：`BusinessNode`、`ViewRow`、`SelectedCell` 等；
- `BUSINESS_DATA` 行树及其二维投影；
- 常规演示数据；
- 后端汇总节点与明细节点的二维投影；
- 产品和区域投影；
- 下钻路径计算；
- 10 万行数据生成、聚合索引和可见行投影；
- 行到单元格值的转换；
- 搜索文本和数字格式；
- 业务字段更新；
- 选区统计结果计算。

`business-column-schema.ts` 单独负责后台列树 Mock、列配置校验，以及平铺列、表头合并、冻结列和 Outline 的派生，模型层和控制器不再维护硬编码列号。

阅读该文件时建议从以下链路入手：

```text
BUSINESS_DATA
  ↓ getVisibleProducts()
可见产品
  ↓ getVisibleRegions()
按 regionSummaries / detailIds 找到后端节点
  ↓ createBusinessProjectionRows()
直接复制节点指标得到 ViewRow[]（不做前端聚合）
  ↓ viewRowValues()
SpreadJS 二维数组
```

### 2.4 `spreadsheet/use-spreadsheet-controller.ts`：命令式核心

这是页面最核心的文件，管理 Workbook 的完整生命周期。

#### 初始化阶段

`useEffect → start()` 完成：

1. 动态加载 SpreadJS 和中文资源；
2. 设置许可证和文化信息；
3. 创建 Workbook 和 Worksheet；
4. 创建下拉框、复选框、日期按钮和验证器；
5. 注册自定义命令、快捷键和右键菜单；
6. 绑定 SpreadJS 事件；
7. 首次执行 `renderRows(buildRegularRows(), false)`。

使用动态 import 是为了避免服务端环境访问浏览器 API，并减少页面入口的同步加载成本。

#### 渲染阶段

`renderRows()` 是统一渲染入口：

```text
ViewRow[]
  ├─ 设置行列数
  ├─ 写入二维数据
  ├─ 生成三级表头
  ├─ 合并产品和属性块
  ├─ 配置格式、控件、验证器
  ├─ 建立列 Outline
  ├─ 恢复批注、附件和列显隐
  └─ 恢复选区并更新 React 状态
```

常规模式和压力模式都调用 `renderProjectionRows()` 重新计算当前可见行；压力模式随后只物化当前需要的页。

#### 事件阶段

控制器监听的关键事件包括：

| 事件 | 作用 |
| --- | --- |
| `EnterCell` | 更新当前单元格和抽屉内容 |
| `SelectionChanged` | 重算选区统计 |
| `CellClick` | 处理产品列和区域列折叠 |
| `EditStarting` | 按统一策略阻止汇总、派生和层级字段编辑 |
| `ClipboardPasting` | 校验整个目标区域并保存粘贴前快照 |
| `ClipboardPasted` | 提交粘贴结果并记录历史 |
| `ValidationError` | 拦截非法调整系数 |
| `CellChanged` | 提交单格编辑和公式变化 |
| `RangeChanged` | 处理清空、拖拽填充等范围修改 |
| `RangeGroupStateChanged` | 同步 Outline 工具栏状态 |
| `TopRowChanged` | 压力模式按视口加载数据 |

#### 清理阶段

effect cleanup 负责：

- 清理所有定时器；
- 取消未完成搜索或压力数据任务；
- 清空历史跟踪临时状态；
- 销毁 Workbook；
- 释放 10 万行缓存。

任何新增长任务、事件或 Blob URL 都应在相应清理阶段释放。

### 2.5 `spreadsheet/clipboard.ts`：剪贴板边界

该文件将制表符文本转换为矩阵，并统一输出复制、粘贴前回调信息。目前回调只用于 Demo 控制台观察；如果以后接入权限校验、脱敏或操作审计，应从这里或控制器中的粘贴事件扩展。

### 2.6 `index.less`：页面视觉和响应式布局

样式文件负责页面壳、工具栏、表格容器、弹层、抽屉、附件和状态栏。SpreadJS 单元格内部颜色、格式和控件样式主要仍在控制器的 `styleDataRows()`、`configureCellTypes()` 等函数中设置。

修改视觉时先判断目标属于：

- React DOM：修改 `index.less`；
- SpreadJS 单元格、表头、Outline：修改控制器中的 SpreadJS 样式 API。

---

## 状态由谁管理

理解状态所有权可以避免 React 和 SpreadJS 互相覆盖。

| 状态类型 | 保存位置 | 示例 |
| --- | --- | --- |
| 需要更新 React UI 的状态 | React `useState` | 当前选中项、搜索结果、抽屉、Toast |
| React 事件需要读取但不应触发渲染 | React `useRef` | `actionsRef`、附件、历史、批注 |
| 仅属于 Workbook 生命周期的可变状态 | `useEffect` 闭包 | `activeRows`、展开集合、已加载压力页 |
| 表格引擎内部状态 | SpreadJS | 单元格值、选区、UndoManager、Outline |

不要把 Workbook 放进 React State，也不要让 React 组件直接调用大量 Worksheet API。页面通过 `actionsRef` 发出命令，控制器统一操作 SpreadJS，再将需要显示的结果同步回 React。

---

## 常见修改方式

### 新增一个业务列

至少检查以下位置：

1. `BusinessNode` / `BusinessField`；
2. `COLUMNS`；
3. 列号常量；
4. `viewRowCellValue()`；
5. 表头 Section / Group；
6. 格式化和单元格类型；
7. 搜索字段；
8. `updateBusinessNode()`；
9. 选区统计显示类型；
10. 数据追踪或历史是否需要支持。

不要只在 `COLUMNS` 末尾加一项，因为当前部分逻辑仍依赖明确列号。

### 新增一个工具栏功能

推荐路径：

```text
SpreadsheetActions 增加方法
  ↓
actionsRef.current 实现 SpreadJS 操作
  ↓
控制器同步必要 React State
  ↓
index.tsx 增加按钮或面板
```

纯展示组件放入 `components/spreadsheet-ui.tsx`；不要在按钮组件中自行查找 Workbook。

### 修改产品或区域折叠逻辑

常规模式优先修改 `model.ts` 的投影函数和展开状态，不要直接隐藏 Worksheet 行。还要确认：

- 产品和属性合并范围；
- 选中单元格恢复；
- 稳定单元格 ID；
- 搜索命中后的祖先展开；
- 批注、附件和历史重挂载；
- 下钻视图是否仍有数据。

压力模式还需同步检查 `createStressProjectionRows()`、`getStressProjectionSummary()`、可见行统计和懒加载范围。不要为压力模式新增独立的整行 Outline 语义，否则产品列和区域列会重新耦合。

### 接入真实后端

建议将下面几类内存 Map 抽象成单独的数据仓库或 API 层：

- `BUSINESS_DATA`：包含全部汇总与明细记录的完整业务快照；
- 压力数据叶子节点：10 万行模式的模拟明细；
- `BusinessCellDimension`：编辑接口的 `row` 行层级路径和 `column` 列树路径；
- `commentsRef`：批注；
- `historyRef`：审计历史；
- `attachmentsRef`：附件元数据。

生产环境中，历史记录应由服务端生成操作者、服务端时间、版本和请求 ID；附件应上传对象存储并执行权限校验、类型验证、病毒扫描和受控下载。

---

## 开发与调试

启动项目：

```bash
npm run dev
```

访问：

```text
http://localhost:8000/spreadjs-demo/business
```

建议按以下顺序设置断点并操作页面：

1. `start()`：观察 Workbook 初始化；
2. `renderRows()`：观察二维数据进入 Worksheet；
3. `toggleHierarchyRow()`：点击产品或区域箭头；
4. `getCellEditability()`：确认目标单元格是否允许编辑；
5. `commitBusinessCellValues()`：提交明细值并观察同级字段联动；
6. `CellChanged` / `RangeChanged`：观察单格和批量修改；
7. `search()`：搜索一个处于折叠状态的区域明细；
8. `loadVisibleStressRows()`：滚动 10 万行模式。

正式部署前需要配置：

```text
NEXT_PUBLIC_SPREADJS_LICENSE_KEY
```

未配置许可证时只适合本地评估，并会显示 SpreadJS 评估水印。

## 修改后的回归清单

- 常规模式产品和区域可以分别展开、收起；
- 一个产品的区域状态不会影响另一个产品；
- 下钻、上钻后选区和稳定单元格功能仍正确；
- 搜索能命中折叠内容并只展开必要祖先；
- 编辑、粘贴、清空、撤销、重做都有历史；
- 汇总、派生和层级单元格不能编辑或粘贴覆盖；
- 收入、订单、客单价以及状态字段的同级联动正确；
- 修改城市明细后，后端汇总静态值保持不变；
- 开发者控制台能输出直接修改的业务行 ID、字段和新旧值；
- 批注和附件不会改写单元格值；
- 列显隐、列 Outline 和自动列宽仍可用；
- 10 万行模式的产品和区域节点与常规模式行为一致且互不干扰；
- 10 万行模式切换、滚动、搜索和折叠保持响应；
- 页面卸载或切换数据模式后没有残留定时器和 Object URL。
