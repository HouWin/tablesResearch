# TanStack 费用预算表

菜单：**TanStack 费用预算表**；路由：`/tanstack-budget`。

独立实现原费用预算 Demo 的业务工作台。使用 TanStack Table 9.2.4 管理列与可视行模型、TanStack Virtual 3.14.10 虚拟渲染、fast-formula-parser 1.0.19 在服务端计算公式，三者均为 MIT 开源依赖。原 SpreadJS 菜单继续保留，便于对照。

## 运行与验收

需要 Node.js 22 和 pnpm；浏览器回归默认使用本机 Google Chrome。

```bash
pnpm install
pnpm dev
# http://localhost:8000/tanstack-budget
```

开发服务的 Umi mock 是真实 HTTP 接口，业务服务在 Node 端运行。修改 `server/` 后请重启 `pnpm dev`，避免 Umi mock 的依赖缓存继续使用旧服务实例。

构建后同时启动静态资源与演示 API：

```bash
pnpm build
pnpm serve:budget
# http://127.0.0.1:8010/tanstack-budget
```

可用 `BUDGET_PORT=8011 pnpm serve:budget` 改端口。直接用不含 API 的静态文件服务器打开 dist，页面会提示接口错误。

```bash
pnpm typecheck:tanstack
pnpm typecheck:spreadjs
pnpm test:tanstack
# 保持 serve:budget 运行，在另一个终端执行：
pnpm test:tanstack:e2e
# 或针对开发服务：
BUDGET_BASE_URL=http://localhost:8000 pnpm test:tanstack:e2e
```

## 数据契约

`BUSINESS_DATA`、`BUSINESS_COLUMN_DATA` 及原业务模型源码均未修改。常规模式直接从原树结构创建服务端投影，完整展开仍为 **36 行 × 16 列**。组织的 `children`、`subjects`、科目的 `children` 以及记录 `id`、成员 `memberCode` 的语义不变。

- 组织和科目是只读层级展示列；功能属性、全年合计及各月份允许编辑。
- 汇总与明细都是独立后台记录。修改明细不会隐式重算汇总，修改汇总不会分摊明细。
- 编辑采用稳定记录 ID 和原 `BusinessCellChangePayload` 协议，数值为 `recordId + dimension`，属性为 `recordId + row + attribute`。分页响应中的索引、跨度、公式属于内部视图元数据。
- 会话编辑保存在服务端覆盖层，不修改原 `BUSINESS_DATA` 常量。类型检查及核心测试覆盖结构保持、投影一致和修改载荷。

## 已实现的功能

| 能力 | 实现与交互 |
| --- | --- |
| 表头和层级 | 原四层列头；组织合并展示；组织、科目分别展开/收起；恢复默认视图 |
| 业务导航 | 下钻、上钻、面包屑；全数据搜索；原业务维度 JSON 精确定位，自动展开隐藏路径及显示目标月份 |
| 列与行 | 年度月份折叠并保留全年合计；列显示管理；冻结表头；行高、列宽拖动调整；按当前可视内容适配列宽 |
| 编辑 | 双击、Enter、F2、直接输入；金额校验；公式；汇总和明细均可编辑 |
| 选区 | 矩形框选、Shift 扩选、整行及全选；键盘导航；跨虚拟页定位 |
| 剪贴板 | 复制、剪切、粘贴、清空；Excel TSV 与 HTML；引号和换行；只读校验；整次事务提交 |
| 拖拽 | 填充柄、Ctrl/⌘ + D/R 填充、Alt 拖动移动；边缘自动滚动 |
| 历史 | 整次撤销与重做；依赖公式联动纳入同一事务；单元格修改历史；保留最近 100 次有效修改 |
| 附加信息 | 按业务单元格关联的批注、附件、数据追踪；附件预览、下载、删除及原大小/类型/数量校验 |
| 统计 | 全选区 SUM、COUNT、AVG、MIN、MAX 与原三种自定义表达式，包含未加载数据 |
| 工作台 | 全屏；窄屏布局；明确的加载、错误、重试状态；快捷键与数据说明 |

宽视口冻结前 3 个业务列；表格可用宽度低于 760px 时保留组织列，低于 560px 时保留行号。金额列始终能够通过水平滚动访问。组织的合并区域按当前可视区裁剪，滚动到长组织块中间时仍展示名称和展开按钮。

## 10 万行的分批加载

压力模式为 **100,000 条明细 + 1,100 条独立汇总 = 101,100 行**。服务端只保存约 1,100 个科目分段和组织元数据，收到分页请求后才构造对应记录，不在浏览器生成或一次获取全量源记录。

1. `project` 根据组织展开、科目展开、下钻状态返回总行数、投影 ID 和页大小。
2. `page` 固定返回最多 **200 行**。客户端请求当前视口相关页并预取下一页。
3. TanStack Virtual 只挂载视口和上下各 8 行缓冲；TanStack Table 仅接收这些行槽位。
4. 客户端按页去重请求，LRU 最多 **10 页 / 2,000 行**。切换数据集或层级会取消请求并丢弃旧响应。
5. `search`、`locate`、`position`、`statistics` 在服务端执行。搜索缓存使用按记录压缩的命中索引，不把所有匹配明细传到浏览器。
6. 用户主动复制或粘贴跨页选区时，`range` 继续按 200 行分批读取；整次修改原子提交。校验失败不写入任何单元格。

复制单次最多 200,000 格；修改单次最多 20,000 格。超过限制明确报错，不静默截断。全选统计不受这些编辑/复制限制影响。

## 模块边界与后端接入

- `index.tsx`：菜单页面、工具栏和布局。
- `components/budget-grid.tsx`：TanStack Table / Virtual、单元格交互及可视合并。
- `components/inspector.tsx`：批注、附件、历史、追踪和统计。
- `core/use-budget-data.ts`：分页、缓存、取消和重试。
- `core/use-budget-controller.ts`：选区、编辑、事务、剪贴板和业务操作。
- `core/gateway.ts` / `core/types.ts`：可替换的数据网关及接口类型。
- `server/budget-service.ts`：投影、分页、搜索、统计、公式及原子事务。
- `server/budget-api.ts`：演示会话与请求分发。
- `mock/tanstackBudget.ts`：开发接口。
- `server/budget-server.ts`：构建产物及演示 API 服务。

HTTP 请求均为 `POST /api/tanstack-budget/<action>`，通过 `X-Budget-Session` 区分演示会话；成功响应 `{ data }`，失败响应 `{ error }` 并返回对应 HTTP 状态码。

| action | 请求字段 | 返回 |
| --- | --- | --- |
| project | query | 投影 ID、行数、pageSize、面包屑和层级计数 |
| page | id, offset | projectionId、offset、rows，最多 200 行 |
| search | mode, query, index | total、index、单个命中业务坐标 |
| locate | mode, dimension | 精确命中业务坐标或 null |
| position | id, recordId | 当前投影内的行号，不可见时 -1 |
| statistics | id, range, columns | 完整选区统计 |
| range | id, range, columns, offset | rows、nextOffset；分批读取主动选区 |
| write | id, writes, source | 原子事务及原业务修改载荷；expected 用于并发值校验 |
| replay | mode, transaction, direction | 服务端保存的事务重放结果，不信任客户端传回的修改内容 |

接入已有后端时，可替换 `BudgetGateway`，通过 `useBudgetController({ gateway })` 注入；组件无需改动。后端保留原业务数据树，将查询投影和业务写回放在网关适配层。`onBusinessCellChange` 是成功写入后的通知回调；需要持久化、回滚或版本冲突保证的保存逻辑应置于 `gateway.write`，不能仅依靠通知回调。

演示服务以当前会话内存保存金额、公式和事务，刷新页面会创建新会话，重启服务也会清空。批注、附件保存在当前页面内存，沿用原 Demo 的生命周期。正式业务上线需要把这些接口接到现有数据库和文件服务，并使用现有登录态、权限和版本控制；`X-Budget-Session` 仅用于本地 Demo 隔离，不是身份认证。

## 公式说明

支持 `=SUM(E1:P1)`、`=ROUND(E1*1.1,2)`、单元格、范围、相对/绝对引用与解析器支持的函数。金额公式必须返回 0 至 10 亿之间的有限数字。非法公式、循环引用、超范围引用和外部工作簿引用会拒绝整个事务。

公式引用绑定到录入时投影对应的业务记录，折叠、下钻后保持结果；内部复制、填充会调整相对引用。此页实现预算场景的公式功能，并非任意 SpreadJS/Excel 函数、宏或工作簿文件的完整兼容层。不包含原页面没有的 Excel 文件导入/导出流程；Excel 互通使用剪贴板。

## 回归覆盖

核心测试覆盖原数据契约、压力分页与尾页、校验原子性、业务修改协议、公式重算与事务回放、隐藏层级定位、跨页统计、Excel TSV、宽命中搜索和无变化保存的历史保护。

浏览器测试覆盖菜单、表头、冻结、编辑、校验、撤销重做、剪贴板、层级、定位、列显隐、批注、附件、拖拽、压力数据、缓存限制、网络失败及旧响应、窄屏、右键、行高、全屏、自定义统计、保存后刷新失败，以及 205 行跨页粘贴和 161.76 万格全选统计。失败时 Playwright 保存截图和 trace 至被 Git 忽略的 `test-results/`。

### 本次验收记录（2026-09-07）

- `typecheck:tanstack`、`typecheck:spreadjs`：通过。
- `test:tanstack`：8 / 8 通过。
- `pnpm build`：通过；原多表格演示工程仍会提示部分依赖包体积较大。
- 最终生产构建的 `test:tanstack:e2e`：15 / 15 通过，耗时 45.6 秒，所有用例均检查未捕获的浏览器运行错误。
- 实测覆盖 101,100 行、最多 200 行/请求、最多 2,000 行缓存、少于 100 个挂载行、205 行跨页粘贴、1,617,600 格全选统计；确认新页面不请求 SpreadJS 引擎脚本。
- 桌面和 620px 窄屏截图已目视确认；截图、失败 trace 和 HTML 报告位于忽略提交的 `test-results/`、`playwright-report/`。
