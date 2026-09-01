# SpreadJS 经营数据表

本目录实现了 `/spreadjs-demo/business` 页面。它以普通 SpreadJS Worksheet 为内核，在其上增加业务层级投影、双列独立折叠、单元格审计、附件和 10 万行压力数据等能力。

这不是 SpreadJS PivotTable。页面先将树形业务数据投影为二维 `ViewRow[]`，再写入 Worksheet；产品树和区域树的展开状态由应用层单独维护。

## 快速定位

- 路由配置：[`../../../.umirc.ts`](../../../.umirc.ts)
- 页面入口：[`index.tsx`](./index.tsx)
- React 通用界面：[`components/spreadsheet-ui.tsx`](./components/spreadsheet-ui.tsx)
- 数据模型与二维投影：[`spreadsheet/model.ts`](./spreadsheet/model.ts)
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
BUSINESS_DATA + 产品展开状态 + 区域展开状态
    ↓ createBusinessProjectionRows()
ViewRow[]
    ↓ viewRowValues() / renderRows()
SpreadJS Worksheet
    ↓ EnterCell / CellClick / CellChanged / RangeChanged 等事件
业务数据、历史记录和 React 面板状态同步更新
```

---

## 1. 表格实现的功能

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

`COLUMNS` 定义 16 个业务字段；`COLUMN_HEADER_SECTIONS` 和 `COLUMN_HEADER_GROUPS` 生成三级表头：

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
- 层级列、产品属性、自动计算的客单价和所有汇总数据只读。

`getCellEditability()` 是唯一的可编辑策略入口。只有能够唯一映射到一个底层叶子明细的业务单元格才允许编辑；区域汇总、产品汇总以及由多个明细合并出的城市数据都不能直接改写。控制器同时使用 SpreadJS 单元格锁定、`EditStarting` 和粘贴前校验执行这套规则，不能只依赖灰色样式。

所有业务值修改最终批量进入 `commitBusinessCellValues()`：

```text
单格编辑 / 粘贴 / 清空 / 撤销 / 重做
  ↓ getCellEditability()
定位唯一底层 BusinessNode 叶子
  ↓ updateBusinessNode()
更新直接字段及收入、订单、状态等同级联动字段
  ↓ createBusinessProjectionRows() / createStressProjectionRows()
常规模式重新读取 BUSINESS_DATA；压力模式重新生成当前投影
  ↓ 比较修改前后的 ViewRow[]
刷新直接修改和同级字段联动，并写入历史
```

具体规则如下：

- 修改净收入：按修改前占比同步分摊商品收入和服务收入，并重算客单价；
- 修改商品收入或服务收入：重算净收入和客单价；
- 修改订单数：按修改前占比同步分摊线上和线下订单，并重算客单价；
- 修改线上订单或线下订单：重算订单数和客单价；
- 修改状态或“已核验”：双向同步另一字段；
- 常规模式的产品、子类和区域汇总指标由后端直接返回，Demo 将这些静态值明确保存在 `BUSINESS_DATA`。`regionSummaries` 保存产品大类下的区域汇总，`detailIds` 只声明展开后对应哪些明细；前端不再根据明细执行求和、平均值或状态归并。因此编辑明细只改变该明细及其同级派生字段，不会擅自修改后端汇总值。

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

开发环境中，用户每次直接编辑单元格都会输出一条精简日志 `[SpreadJS Demo][单元格修改]`，附带一个对象 `{ rowId, field, oldValue, newValue }`：`rowId` + `field` 标识改的是哪条业务记录的哪个字段，`oldValue`/`newValue` 是修改前后的值，供后端/上游消费方了解具体变更内容。生产构建不会输出这些调试日志。

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
- 列定义和列号常量；
- 常规演示数据；
- 后端汇总节点与明细节点的二维投影；
- 产品和区域投影；
- 下钻路径计算；
- 10 万行数据生成、聚合索引和可见行投影；
- 行到单元格值的转换；
- 搜索文本和数字格式；
- 业务字段更新；
- 选区统计结果计算。

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

- `BUSINESS_DATA` / 压力数据叶子节点：业务明细；
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
