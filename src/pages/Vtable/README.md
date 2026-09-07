# VTable 费用预算表

入口：现有 **Vtable** 菜单，路由 `/vtable`。

使用 MIT 开源的 `@visactor/vtable@1.26.7` Canvas 表格和 `fast-formula-parser`，无需 SpreadJS 授权。原 SpreadJS 页面保留用于对照。

## 运行

```bash
pnpm install --frozen-lockfile
pnpm dev
# http://localhost:8000/vtable

# 生产构建 + 演示 API
pnpm build
pnpm serve:budget
# http://127.0.0.1:8010/vtable
```

修改 `server/` 后需重启开发服务。生产页面需要同时提供预算 API，不能仅部署静态 `dist/`。可用 `BUDGET_PORT=8012 pnpm serve:budget` 修改端口。本项目的开发编译器会清理 `dist/`，生产验收时先停止 `pnpm dev`，再构建及启动生产服务。

## 原数据与编辑回调

`BUSINESS_DATA`、`BUSINESS_COLUMN_DATA` 及其源码保持不变；VTable 表头从原列树转换，服务端从原业务树建立分页投影。常规完整视图为 36 行、16 列。分页响应的索引、合并跨度和公式信息仅属于内部视图元数据，不改变业务数据结构。

汇总与明细独立保存，编辑明细不会自动改汇总，编辑汇总不会分摊明细。

`index.tsx` 的 `handleBusinessCellChange` 沿用原 `BusinessCellChangePayload`，每次成功变更输出一条日志：

```text
[VTable Budget][单元格修改]
{ 两空格缩进的完整 JSON }
```

- 金额：`type, recordId, oldValue, newValue, dimension: { row, column }`。
- 属性：`type, recordId, oldValue, newValue, row, attribute: { code, owner }`。
- 撤销、重做按实际变化输出相同结构的新旧值；校验失败不输出成功回调；生产构建也会打印。
- 公式独立保存，数值变更回调继续输出计算后的金额，不增加公式字段。

此回调是写入成功后的通知。正式保存应接入 `BudgetGateway.write`，将事务、持久化及版本校验放在后端；不应把通知回调当成唯一保存接口。

## 功能

| 功能 | 交互 |
| --- | --- |
| 表头与层级 | 原四层表头、组织纵向合并、组织与科目独立展开/收起、全部展开/收起、恢复默认视图 |
| 导航 | 全量搜索及前后命中、业务维度 JSON 定位、自动显示隐藏路径/月份、下钻/上钻/面包屑 |
| 行列 | 冻结表头及左列、列显隐、年度月份折叠、拖动行高/列宽、双击列边界或工具栏适配列宽 |
| 编辑 | 双击、Enter、F2、直接输入、中文输入法、金额校验、公式及依赖重算 |
| 选区 | 矩形框选、Shift 扩选、整行/整列/全选、方向键、Home/End、PageUp/PageDown、Ctrl/⌘+Home/End |
| 数据操作 | 复制、剪切、粘贴、清空、拖拽填充、Ctrl/⌘+D/R 填充、Alt 拖动移动、整次事务撤销/重做 |
| Excel 剪贴板 | 复制提供 TSV 和 HTML；粘贴读取 TSV，支持引号、换行；内部复制/填充调整相对公式引用 |
| 附加信息 | 批注增改删、附件预览/下载/删除、修改历史、业务数据追踪；按稳定业务 ID 关联 |
| 统计 | 服务端完整选区 SUM/COUNT/AVG/MIN/MAX 及原自定义表达式，包含未加载页 |
| 工作台 | 右键菜单、全屏、窄屏布局、加载/保存状态、错误提示、分页重试、帮助说明 |

宽度足够时冻结前 3 个业务列；可用宽度低于 760px 时冻结组织列，低于 560px 时只冻结行号，金额始终可通过水平滚动访问。编辑中的滚轮先提交当前编辑，非法输入保留并提示。

预算公式支持单元格、范围、相对/绝对引用和解析器函数，例如 `=SUM(E2:P2)`、`=ROUND(E2*1.1,2)`；引用绑定业务记录，折叠/钻取不改变计算结果。拒绝循环、越界、外部工作簿引用及非有限金额。金额范围为 0 至 10 亿。这里不包含任意 Excel 宏或工作簿文件格式的兼容实现。

## 十万行按批加载

压力模式包含 **100,000 条明细 + 1,100 条独立汇总 = 101,100 行**。

1. `project` 只返回视图 ID、总行数和层级元数据。
2. 首次及滚动后的 `page` 请求每批最多 **200 行**，预取当前视口之后的一批。
3. 页请求去重，LRU 最多 **10 页 / 2,000 行**；切换模式/层级时取消在途请求并丢弃过期响应。
4. VTable 的 `CachedDataSource` 只同步读取这个页缓存；缺页先显示占位。没有传入十万条 `records`，没有再创建无上限的异步数据缓存。
5. 搜索、定位、统计在服务端执行；跨页剪贴板/填充通过 `range` 继续以 200 行分批读取，事务统一校验和提交。
6. 大选区的业务范围完整保留，但仅同步可视切片给 Canvas。避免 VTable 1.26.7 在结束选区时遍历整个范围检查合并单元格；全选统计不会因此下载或扫描十万行前端数据。
7. 组织合并元数据独立保存，不持有已淘汰分页记录；分页返回后只重建可视图元。

单次复制最多 200,000 格、单次修改最多 20,000 格，超过会明确提示且不写入部分数据；全选区统计不受这两个限制影响。全量统计/搜索等待期间页面仍可交互，并显示计算状态。

## 模块与后端

- `index.tsx`：VTable 页面入口、原结构回调。
- `budget-grid.tsx`：Canvas 实例、可视分页、合并、选区同步、尺寸与拖拽生命周期。
- `grid-model.ts`：原列树到 VTable 的纯转换、坐标映射与图标。
- `grid-editor.tsx` / `grid-keyboard.ts` / `grid-context-menu.tsx`：编辑、键盘、右键。
- `../TanStackBudget/components/budget-workbench.tsx`：两个开源表格共用的工具栏、弹窗和布局，通过 Grid 属性注入渲染器；VTable 页面不加载 TanStack Table/Virtual 渲染器。
- `../TanStackBudget/core/`：共用业务控制器、分页、剪贴板和网关。
- `server/budget-service.ts` / `server/budget-api.ts`：共用服务端投影、分页、查询、公式与原子事务。

接口仍为 `POST /api/tanstack-budget/<action>`，具体协议见 [共用网关说明](../TanStackBudget/README.md#模块边界与后端接入)。保留现有接口名便于直接复用服务，不影响菜单使用。

演示金额/公式/事务保存在服务端会话内存；刷新页面会创建新会话。批注和附件保存在当前页面内存，与原 Demo 生命周期一致。接入正式业务时替换网关并对接已有数据库、文件服务和登录态。

## 回归

```bash
pnpm typecheck:vtable
pnpm typecheck:tanstack
pnpm typecheck:spreadjs
pnpm test:tanstack

# 默认测试生产演示服务 8010 端口
pnpm test:vtable:e2e
pnpm test:tanstack:e2e

# 指定服务
VTABLE_BASE_URL=http://127.0.0.1:8000 pnpm test:vtable:e2e
```

浏览器测试直接操作 Canvas 坐标、真实输入框、键盘和网络，覆盖常规与十万行模式；每例检查未捕获的运行错误。失败截图/trace、桌面/窄屏截图、性能记录位于 Git 忽略的 `test-results/` 和 `playwright-report/`。

### 验收记录（2026-09-07）

- `typecheck:vtable`、`typecheck:tanstack`、`typecheck:spreadjs`：通过。
- 共用业务层 `test:tanstack`：8 / 8 通过。
- `pnpm build`：通过。原多表格研究项目仍有大体积依赖的构建提示，VTable 路由不加载 SpreadJS 引擎脚本。
- 最终生产构建 `test:vtable:e2e`：17 / 17 通过，41.3 秒；每项均检查未捕获的浏览器错误。
- 已目视确认桌面、620px 窄屏和十万行尾页；覆盖 205 行跨页粘贴、连续大幅滚动、缓存上限、慢请求切换、分页重试、编辑/撤销回调、公式、中文输入、拖拽、附件下载和 1,617,600 格完整统计。
- 本机 Chrome，1600 × 1000，无 CPU / 网络节流：切换十万行 436ms，尾页定位 194ms，尾页保存 199ms，完整选区统计 1311ms。该流程只发送 4 个分页请求，行数依次为 200、200、100、100（保存后刷新尾页）；没有全量下载。
- 从压力模式切换到统计完成，最长主线程任务 201ms，出现在初始化；全选阶段无超过 50ms 的主线程任务。耗时是此次本机测试记录，不是所有设备和网络的固定上限。
- 共用工作台提取后的原 TanStack 页面回归：15 / 15 通过（开发服务，38.5 秒）；同时修正了虚拟行切换时测试过早读取焦点 ID 的时序问题。
- 交付时已恢复 `http://localhost:8000/vtable` 开发预览。生产构建回归完成后不同时保留依赖 `dist/` 的预览服务。
