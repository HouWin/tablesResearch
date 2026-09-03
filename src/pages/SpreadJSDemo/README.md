# SpreadJS 费用预算表

本目录实现 `/spreadjs-demo/business` 页面。页面以普通 SpreadJS Worksheet 为内核，将 `费用预算表-行维度展开示例.xlsx` 的表格结构和数据投影为可编辑的二维表格，同时保留原有的层级展开、搜索定位、列管理、审计、附件和 10 万行压力模式。

## 数据与表格结构

- 唯一业务数据源：[`spreadsheet/model.ts`](./spreadsheet/model.ts) 中的 `BUSINESS_DATA`；[`data.js`](./data.js) 仅保留兼容导出。
- 列配置：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts) 中的 `BUSINESS_COLUMN_DATA`。
- Excel 原始样例：[`费用预算表-行维度展开示例.xlsx`](./费用预算表-行维度展开示例.xlsx)。
- 页面包含 3 个行维度：组织、科目、功能属性；数值列为全年合计和 1 月至 12 月。
- 常规样例完全展开后为 45 行 × 16 列。

`BUSINESS_DATA` 直接保存 Excel 中的明细和汇总值。费用汇总、日常费用合计、管理费用合计等记录均视为后台独立返回的数据，前端编辑明细时不会重新计算或覆盖这些汇总记录。

## 层级投影

页面维护两套互不干扰的展开状态：

```ts
organizationExpanded: Set<string>
subjectExpandedByOrganization: Map<organizationId, Set<subjectId>>
```

组织列支持集团、公司、部门多级展开；每个组织分别维护自己的科目展开状态。`createBusinessProjectionRows()` 根据两套状态生成当前可见的 `ViewRow[]`，再由控制器写入 SpreadJS。

组织和科目名称是层级投影字段，只能通过展开/收起操作改变；功能属性、全年合计及各月份值均可直接编辑。编辑结果根据后台记录 ID 和完整业务坐标写回 `BUSINESS_DATA`，并进入撤销、重做与历史记录链路。

## 主要文件

- 路由与菜单：[`../../../.umirc.ts`](../../../.umirc.ts)
- 页面入口：[`index.tsx`](./index.tsx)
- 页面和工具栏：[`components/spreadsheet-ui.tsx`](./components/spreadsheet-ui.tsx)、[`components/spreadsheet-toolbar.tsx`](./components/spreadsheet-toolbar.tsx)
- 层级控制：[`components/outline-controls.tsx`](./components/outline-controls.tsx)
- 数据模型与投影：[`spreadsheet/model.ts`](./spreadsheet/model.ts)
- 多级表头与列定义：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts)
- SpreadJS 渲染与事件：[`spreadsheet/use-spreadsheet-controller.ts`](./spreadsheet/use-spreadsheet-controller.ts)
- 业务坐标：[`spreadsheet/business-cell-coordinate.ts`](./spreadsheet/business-cell-coordinate.ts)

## 保留的交互能力

- 组织、科目两套独立展开/收起和恢复默认；
- 业务层级下钻、上钻与面包屑导航；
- 快速搜索和按完整业务维度 JSON 精确定位；
- 年度列组展开/收起、列管理、冻结行列和自适应列宽；
- 单元格编辑、撤销、重做、复制、历史、批注、数据追踪和附件；
- 自定义统计、全屏和 10 万行压力模式。

## 验证

```bash
npm run build
```

生产构建完成后，应至少回归：默认 45 × 16 数据规模、组织与科目的独立折叠、业务维度定位、数值及功能属性编辑、撤销恢复，以及浏览器控制台无运行时错误。
