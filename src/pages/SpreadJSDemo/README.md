# SpreadJS 费用预算表

`/spreadjs-demo/business` 是一个可直接演示和继续接入后端的费用预算工作台。页面以普通 SpreadJS Worksheet 为内核，将 `费用预算表-行维度展开示例.xlsx` 的组织、科目和年度月份结构投影为可编辑二维表格，并提供搜索定位、列管理、审计、附件、统计和 10 万行压力模式。

## 快速验收

```bash
pnpm typecheck:spreadjs
pnpm build
pnpm dev
```

打开终端输出的 `/spreadjs-demo/business` 地址。首次加载 SpreadJS 引擎可能需要几秒；页面会显示明确的初始化状态，失败时可在页面内重试。

## 数据与表格结构

- 页面运行时数据源：[`spreadsheet/model.ts`](./spreadsheet/model.ts) 中的 `BUSINESS_DATA`，它本身就是后台返回形态的类型化示例，不再维护重复静态副本。
- 列配置：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts) 中的 `BUSINESS_COLUMN_DATA`。组织、科目、功能属性是顶层叶子列，2025 年是包含全年合计及 1—12 月的顶层分组，与 Excel 表头结构直接对应；列树的叶子、顶层分组及中间分组都必须提供全树唯一的 `field`。
- Excel 原始样例：[`费用预算表-行维度展开示例.xlsx`](./费用预算表-行维度展开示例.xlsx)。
- 页面包含 3 个行维度：组织、科目、功能属性；数值列为全年合计和 1 月至 12 月。
- 常规样例完全展开后为 36 行 × 16 列。
- 10 万行模式从常规组织和“办公费 / 电费 / 水费”科目继续扩展，补充区域经营单元、成本中心、人力、研发、制造、供应链、信息化、质量、折旧等真实预算科目；月度数值带有确定性波动和季节性，全年合计严格等于 12 个月之和。除 10 万条明细外，还模拟后台返回 1,100 条带稳定 ID 的“组织 × 科目”汇总记录。
- 列分组默认以第一个叶子列作为收起后保留列，因此“2025年”收起后会自动保留“全年合计”，不需要额外配置。

`BUSINESS_DATA` 直接保存 Excel 中的明细和汇总值。组织节点通过 `children` 保存下级组织，通过 `subjects` 保存当前组织的科目树；科目树内部继续使用 `children` 表达合计与明细。科目树不保留额外的“费用汇总”层，日常费用合计、管理费用合计等后台汇总记录直接作为可折叠节点，其费用明细向右缩进一级。前端编辑明细时不会重新计算或覆盖这些汇总记录。

`BUSINESS_DATA` 不再保存 `hierarchyRole`。组织与科目由所在容器区分：根节点和组织节点的 `children` 都是下级组织，组织节点的 `subjects` 是科目树；科目节点是否可折叠则直接由其 `children` 判断。层级和汇总身份均由树结构推导，避免后台同时维护“结构”和“角色”两套可能冲突的信息。

## 层级投影

页面维护两套互不干扰的展开状态：

```ts
organizationExpanded: Set<string>
subjectExpandedByOrganization: Map<organizationId, Set<subjectId>>
```

组织列支持集团、公司、部门多级展开；每个组织分别维护自己的科目展开状态。`createBusinessProjectionRows()` 根据两套状态生成当前可见的 `ViewRow[]`，再由控制器写入 SpreadJS。

组织和科目名称是层级投影字段，只能通过展开/收起操作改变；功能属性、全年合计及各月份值均可直接编辑。这条规则同时适用于明细和汇总：汇总行是后台独立记录，修改汇总不会由前端自动分摊到明细，修改明细也不会在前端重算汇总。编辑结果根据后台记录 ID 和完整业务坐标写回对应记录，并进入撤销、重做与历史记录链路。

## 单元格双向业务坐标

单元格坐标由行维和列维组成。行维只保存当前组织和科目的稳定 ID；列维只保存 `BUSINESS_COLUMN_DATA` 从顶层到叶子列的 `field` 数组。定位不依赖中文名称、树节点角色或 Worksheet 物理行列号，因此业务名称和展开状态变化不会导致坐标失效。组织 ID、科目 ID 需在各自业务域内保持全局唯一，列树中的每个 `field` 也必须唯一。

```ts
{
  row: {
    organizationId: 'huajing-sales',
    subjectId: 'huajing-sales-office',
  },
  column: ['budget2025', 'january'],
}
```

- Worksheet → 后端：`toBusinessCellDimension()` 生成业务坐标；`onBusinessCellChange` 回调发送 `recordId`、`field`、新旧值和完整 `dimension`。
- 后端 → Worksheet：`resolveBusinessCellDimension()` 根据相同坐标，通过缓存的行维索引和列维索引查找投影行、叶子列；`locateBusinessCell()` 会自动展开必要的组织、科目祖先后选中目标单元格。10 万行模式会在载入时预热行维索引。

## 模块边界

- 路由与菜单：[`../../../.umirc.ts`](../../../.umirc.ts)
- 页面入口：[`index.tsx`](./index.tsx)
- 页面和工具栏：[`components/spreadsheet-ui.tsx`](./components/spreadsheet-ui.tsx)、[`components/spreadsheet-toolbar.tsx`](./components/spreadsheet-toolbar.tsx)
- 层级控制：[`components/outline-controls.tsx`](./components/outline-controls.tsx)
- 数据模型与投影：[`spreadsheet/model.ts`](./spreadsheet/model.ts)
- 多级表头与列定义：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts)
- SpreadJS 渲染与事件：[`spreadsheet/use-spreadsheet-controller.ts`](./spreadsheet/use-spreadsheet-controller.ts)
- 大数据生成、分页契约与本地页源：[`spreadsheet/stress-data-source.ts`](./spreadsheet/stress-data-source.ts)
- 生产分批加载方案：[`LARGE_DATA_STRATEGY.md`](./LARGE_DATA_STRATEGY.md)
- 业务坐标：[`spreadsheet/business-cell-coordinate.ts`](./spreadsheet/business-cell-coordinate.ts)
- 附件策略与展示：[`spreadsheet/attachments.ts`](./spreadsheet/attachments.ts)
- 选区统计：[`spreadsheet/selection-statistics.ts`](./spreadsheet/selection-statistics.ts)
- 通用常量：[`spreadsheet/constants.ts`](./spreadsheet/constants.ts)
- 弹层定位与关闭：[`components/use-anchored-popover.ts`](./components/use-anchored-popover.ts)

`useSpreadsheetController()` 是 SpreadJS 与 React 的适配边界：React 组件只读取控制器状态并调用 `actionsRef`；Worksheet 实例、事件绑定、物理行列和增量加载细节不会泄漏到展示组件。附件校验、选区统计、列模型与业务坐标均保持为独立纯逻辑模块，便于单独替换或测试。

## 保留的交互能力

- 组织、科目两套独立展开/收起和恢复默认；
- 业务层级下钻、上钻与面包屑导航；
- 快速搜索和按完整业务维度 JSON 精确定位；
- 年度列组展开/收起、列管理、冻结行列和自适应列宽；
- 单元格编辑、撤销、重做、复制、历史、批注、数据追踪和附件；
- 自定义统计、全屏和 10 万行压力模式。

## 后端接入

页面默认直接更新内存中的 `BUSINESS_DATA`，并在开发环境打印回调载荷。接入保存接口时，在页面入口传入回调即可：

```tsx
const controller = useSpreadsheetController({
  onBusinessCellChange: async (payload) => {
    await saveBudgetCell(payload);
  },
});
```

回调载荷包含后台 `recordId`、叶子列 `field`、新旧值和完整 `dimension`。生产接入建议由请求层负责乐观更新失败后的回滚、权限错误和并发版本冲突；不要在展示组件里直接拼装行列坐标。

批注、历史与附件当前保存在浏览器内存中，刷新后清空。它们已经使用稳定单元格 ID 关联，接入持久化时可以直接以该键或业务 `dimension` 作为服务端关联依据。附件限制统一定义在 `spreadsheet/attachments.ts`：支持图片、PDF、Word、Excel，单文件 5 MiB，每格最多 10 个。

### 10 万行与真实后端分页

独立 Demo 没有后端，因此会在浏览器中分块生成 10 万条确定性明细记录和 1,100 条独立汇总记录，用于完整验证层级、编辑、搜索和统计。两类记录都模拟后台返回的稳定 ID 与预算字段；表格不使用临时前端聚合行代替可编辑汇总。进入 Worksheet 后不会一次写入全部单元格：控制器监听 SpreadJS `TopRowChanged`，只请求当前可视页并预取下一页，每页 400 行，通过 `setArray` 批量写入；切换层级投影会取消旧页请求并丢弃过期响应。

生产环境不应把 10 万条源记录一次返回前端。`spreadsheet/stress-data-source.ts` 已定义 `BudgetPageGateway`，推荐后端提供 manifest、游标 page、search、locate 四类接口，把全表搜索、过滤、排序、跨页统计和业务坐标定位留在服务端。完整接口、缓存、一致性与技术选型见 [`LARGE_DATA_STRATEGY.md`](./LARGE_DATA_STRATEGY.md)。

## 交互约定

- 组织和科目名称由投影维护，只能通过展开、收起或钻取改变视图；功能属性、全年合计和月份值可编辑。
- `Ctrl/⌘ + F` 打开页面级全表搜索；Enter / Shift + Enter 切换下一个 / 上一个结果。
- 展开、收起、钻取或切换数据模式会重建可见投影，并清理依赖物理行号的撤销栈，防止旧坐标作用到另一条业务记录。
- 所有工具栏按钮在窄屏隐藏文字后仍保留可访问名称；弹层支持 Escape、点击外部关闭并将焦点还给触发按钮。
- 10 万行模式按视口分页写入 Worksheet，并显示已载入行数；本地 Demo 搜索完整的确定性源数据，生产模式则应替换为服务端搜索。

## 验证

```bash
pnpm typecheck:spreadjs
pnpm build
```

生产构建完成后，至少回归以下路径：

1. 默认数据为 36 × 16，组织和科目可独立展开、收起与恢复默认。
2. 搜索“办公费”可在 9 个结果间前后切换，并自动展开命中路径。
3. 使用 README 中的业务维度 JSON 可以定位到对应月份单元格。
4. 编辑数值或功能属性后，撤销、重做、历史与回调载荷一致。
5. 隐藏月份列后仍能通过搜索或“全部显示”恢复；全年合计在年度列组收起后保留。
6. 批注和附件跟随稳定业务单元格，不因折叠或钻取串位。
7. 10 万行模式展示真实组织、科目和季节性月度金额；首次进入期间有进度提示，滚动时按 400 行分页并预取下一页。
8. 10 万行模式下的后台汇总行和明细行都可编辑；汇总修改在展开/收起后保留，撤销/重做、复制、搜索、列管理、统计、批注、附件均可用。
9. 1280 px 桌面宽度和 620 px 以下窄屏均无页面级横向溢出，键盘焦点清晰可见。

未配置正式许可证时出现 SpreadJS 评估水印属于预期行为。正式部署请设置 `UMI_APP_SPREADJS_LICENSE_KEY`，具体见仓库根 README。
