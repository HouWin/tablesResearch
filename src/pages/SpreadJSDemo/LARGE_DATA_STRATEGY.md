# SpreadJS 大数据分批加载方案

## 结论

当前费用预算表继续使用普通 `Worksheet`，以保留合并表头、双层级投影、原生单元格编辑、批注、附件和 Excel 风格交互。大数据接入采用“服务端生成稳定投影 + 游标分页 + 视口按需加载”的方案：前端只声明总行数，在 `TopRowChanged` 后请求当前页并预取下一页，再使用 `setArray` 一次写入 400 行。

如果未来页面变成以远程数据筛选、分组和增删改为主的纯数据网格，可以评估迁移到 SpreadJS TableSheet + Data Manager。Data Manager 原生支持 REST、OData 与 GraphQL 远程源，但 TableSheet 与当前 Worksheet 的合并单元格、双列独立层级投影不是等价模型，不能直接替换。

## 为什么不一次下载 10 万行

一次性响应会同时放大网络传输、JSON 解析、对象分配、业务索引和 Worksheet 写入成本。更大的问题是全表搜索、汇总和定位仍会迫使浏览器持有完整数据，数据增长到百万级后不可持续。

生产环境应拆成四类服务端能力：

1. `manifest`：返回数据集版本、总行数、列定义与组织/科目层级摘要；可编辑的汇总必须作为带稳定记录 ID 的独立数据返回。
2. `page`：按不可解析的游标返回一页当前投影行，并携带 `nextCursor`。
3. `search`：服务端搜索，返回稳定业务坐标与命中总数，不在浏览器扫描全部行。
4. `locate`：根据 `organizationId + subjectId + columnField` 返回目标投影位置或页游标。

明细与汇总编辑都使用现有业务坐标，通过独立 `PATCH` 接口提交，并携带数据集版本或记录版本处理并发冲突。前端不将汇总修改分摊到明细，也不在明细修改后自行重算汇总；如果后台需要联动重算，应在 PATCH 响应或后续版本刷新中返回最新汇总记录。

## 推荐接口

```ts
type BudgetPageRequest = {
  cursor?: string;
  pageSize: number;       // 默认 400，服务端设置上限
  queryVersion: string;   // 筛选、排序、层级状态的版本摘要
  signal?: AbortSignal;
};

type BudgetPageResponse<Row> = {
  items: readonly Row[];
  nextCursor: string | null;
  totalRows: number;
  datasetVersion: string;
};
```

仓库中的 [`spreadsheet/stress-data-source.ts`](./spreadsheet/stress-data-source.ts) 已提供 `BudgetPageGateway` 契约。独立 Demo 使用本地页源模拟 120 ms 网络延迟；切换层级投影时会中止旧请求，并用 `projectionVersion` 丢弃过期响应。

## 前端加载流程

1. 读取 manifest，调用 `sheet.setRowCount(totalRows)` 创建稀疏工作表，不写入全量单元格。
2. 使用 `getViewportTopRow(1)` 和 `getViewportBottomRow(1)` 计算可见页。
3. 请求当前页并预取下一页；快速滚动或层级切换时通过 `AbortController` 取消旧请求。
4. 暂停 paint、event、dirty 与 calc 服务，通过 `setArray` 批量写入，再一次性恢复。
5. 每页加载后只给该页应用样式、编辑器、只读策略、批注和附件标记。
6. 生产实现建议缓存最近 6—10 页；内存紧张时淘汰远离视口的页面。用户编辑的脏页在服务端确认前不得淘汰。

当前 Demo 为保证完全离线可运行，会在浏览器中分块生成 10 万条确定性明细记录、1,100 条独立汇总记录并维护完整搜索索引；这不是生产传输方案。接入真实后端后，应由 `manifest/page/search/locate` 替换本地生成和全量扫描，Worksheet 的视口写入逻辑可以原样保留。

## 性能边界

- 一页建议 200—500 行；当前取 400 行，即最多一次写入 6,400 个单元格。
- 同一页请求需要去重；相邻页最多预取一页，避免快速滚动造成请求风暴。
- 搜索、排序、过滤和跨页统计放到服务端；前端只计算当前选区或已加载页。
- 大批量公式计算可启用 SpreadJS 19 的 CalcWorker；当前预算样例以后台数值为主，暂不额外引入该包。
- Excel/SSJSON 整本导入可使用 `fromJSON({ incrementalLoading })`，但它解决的是大文件解析与加载，不等同于远程数据分页。

## 失败与一致性

- 每个响应必须带 `datasetVersion`；版本不一致时清空页缓存并重新读取 manifest。
- 页请求失败保留占位符，滚动回该区域自动重试，并提供手动重试入口。
- 游标只能表示继续位置，不能承担鉴权；筛选、排序和权限条件变化后旧游标必须失效。
- 后端按稳定、唯一排序生成游标，例如 `fiscalYear + organizationId + subjectId + recordId`。
- 汇总行和明细行都以各自的记录 ID 独立修改；后台如果返回联动更新则同步刷新当前页，并发冲突返回新版本与服务端值，由页面提示用户选择覆盖或刷新。

## 参考资料

- [SpreadJS：Set Large Amounts of Data](https://developer.mescius.com/spreadjs/docs/BestPractices/SettingLargeAmountsofData)——大批量写入优先使用 `setArray`。
- [SpreadJS：Incremental Loading](https://developer.mescius.com/spreadjs/docs/BestPractices/incremental-loading)——适用于 SSJSON/工作簿导入的渐进加载。
- [SpreadJS：Data Manager](https://developer.mescius.com/spreadjs/docs/features/tablesheet/data-manager)——TableSheet 可连接 REST、OData、GraphQL 等远程源。
- [SpreadJS：TopRowChanged](https://developer.mescius.com/spreadjs/api/classes/GC.Spread.Sheets.Events)——监听可视区顶部行变化。
- [Google AIP-158 Pagination](https://google.aip.dev/158)——`page_size`、不透明 `page_token`、`next_page_token` 与一致查询条件规范。
- [MDN：AbortController with Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#canceling_a_request)——取消过期网络请求。
