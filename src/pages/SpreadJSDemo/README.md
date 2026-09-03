# SpreadJS 费用预算表

本目录实现 `/spreadjs-demo/business` 页面。页面以普通 SpreadJS Worksheet 为内核，将 `费用预算表-行维度展开示例.xlsx` 的表格结构和数据投影为可编辑的二维表格，同时保留原有的层级展开、搜索定位、列管理、审计、附件和 10 万行压力模式。

## 数据与表格结构

- 页面运行时数据源：[`spreadsheet/model.ts`](./spreadsheet/model.ts) 中的 `BUSINESS_DATA`；[`data.js`](./data.js) 保留与后台返回形态一致的完整静态数据示例。
- 列配置：[`spreadsheet/business-column-schema.ts`](./spreadsheet/business-column-schema.ts) 中的 `BUSINESS_COLUMN_DATA`。组织、科目、功能属性是顶层叶子列，2025 年是包含全年合计及 1—12 月的顶层分组，与 Excel 表头结构直接对应；列树的叶子、顶层分组及中间分组都必须提供全树唯一的 `field`。
- Excel 原始样例：[`费用预算表-行维度展开示例.xlsx`](./费用预算表-行维度展开示例.xlsx)。
- 页面包含 3 个行维度：组织、科目、功能属性；数值列为全年合计和 1 月至 12 月。
- 常规样例完全展开后为 36 行 × 16 列。
- 列分组默认以第一个叶子列作为收起后保留列，因此“2025年”收起后会自动保留“全年合计”，不需要额外配置。

`BUSINESS_DATA` 直接保存 Excel 中的明细和汇总值。组织节点通过 `children` 保存下级组织，通过 `subjects` 保存当前组织的科目树；科目树内部继续使用 `children` 表达合计与明细。科目树不保留额外的“费用汇总”层，日常费用合计、管理费用合计等后台汇总记录直接作为可折叠节点，其费用明细向右缩进一级。前端编辑明细时不会重新计算或覆盖这些汇总记录。

`hierarchyRole` 直接表达节点的业务身份，并与实际树层级保持一致：集团层使用 `group`；本部和公司处于同一层，统一使用 `businessUnit`；部门层使用 `department`；科目汇总和科目明细分别使用 `subjectSummary`、`subjectDetail`。模型初始化时会校验组织节点的角色与树深度，防止同层级出现不同角色。

## 层级投影

页面维护两套互不干扰的展开状态：

```ts
organizationExpanded: Set<string>
subjectExpandedByOrganization: Map<organizationId, Set<subjectId>>
```

组织列支持集团、公司、部门多级展开；每个组织分别维护自己的科目展开状态。`createBusinessProjectionRows()` 根据两套状态生成当前可见的 `ViewRow[]`，再由控制器写入 SpreadJS。

组织和科目名称是层级投影字段，只能通过展开/收起操作改变；功能属性、全年合计及各月份值均可直接编辑。编辑结果根据后台记录 ID 和完整业务坐标写回 `BUSINESS_DATA`，并进入撤销、重做与历史记录链路。

## 单元格双向业务坐标

单元格坐标由完整行维和列维组成。行维分别保存组织、科目的稳定节点路径，列维保存 `BUSINESS_COLUMN_DATA` 从顶层到叶子列的稳定节点路径。路径中的 `name`、`label` 仅用于日志和界面展示，匹配只使用 `id`、`field`，因此业务名称变化不会导致坐标失效。

```ts
{
  row: {
    organization: [
      { id: 'cr-micro-group', name: '华润微电子集团', hierarchyRole: 'group' },
      { id: 'huajing', name: '华晶公司', hierarchyRole: 'businessUnit' },
      { id: 'huajing-sales', name: '华晶公司-销售部', hierarchyRole: 'department' },
    ],
    subject: [
      { id: 'huajing-sales-subtotal', name: '管理费用合计', hierarchyRole: 'subjectSummary' },
      { id: 'huajing-sales-office', name: '费用-办公费', hierarchyRole: 'subjectDetail' },
    ],
  },
  column: [
    { id: 'budget-2025', field: 'budget2025', label: '2025年' },
    { id: 'january', field: 'january', label: '1月' },
  ],
}
```

- Worksheet → 后端：`toBusinessCellDimension()` 生成业务坐标；`onBusinessCellChange` 回调发送 `recordId`、`field`、新旧值和完整 `dimension`。
- 后端 → Worksheet：`resolveBusinessCellDimension()` 根据相同坐标，通过缓存的行维索引和列维索引查找投影行、叶子列；`locateBusinessCell()` 会自动展开必要的组织、科目祖先后选中目标单元格。10 万行模式会在载入时预热行维索引。

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

生产构建完成后，应至少回归：默认 36 × 16 数据规模、组织与科目的独立折叠、科目明细缩进、业务维度定位、数值及功能属性编辑、撤销恢复，以及浏览器控制台无运行时错误。
