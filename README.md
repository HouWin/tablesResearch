# 企业级表格组件调研与 Demo

基于 Umi Max 与 React 18 的企业级 Web 表格能力验证项目。各页面保持独立，围绕大数据、层级数据、编辑、审计与业务扩展等真实场景验证不同表格方案。

## 重点页面：SpreadJS 经营数据表

从左侧导航展开「SpreadJS Demo」并点击「经营数据表」，或直接访问 `/spreadjs-demo/business`。业务页默认保留系统导航，右上角可按需切换全屏，是当前完成度最高的产品化 Demo。

核心能力包括：

- 产品层级与区域层级独立展开、收起，并保持各自状态；
- 三级表头、冻结列、列分组、显隐与自动列宽；
- 跨折叠层级搜索、业务维度精确定位、下钻与上钻；
- 金额、数字、下拉、复选框和日期等字段级编辑器；
- 后台列配置驱动的只读策略、输入校验和单字段编辑；
- 撤销、重做、复制、粘贴、批注、历史、附件与数据追踪；
- 选区统计和 10 万条底层记录的压力模式；
- 加载、错误、空结果、操作反馈、键盘焦点与响应式布局。

实现原理、数据协议、扩展方法和回归清单见 [SpreadJS 页面文档](./src/pages/SpreadJSDemo/README.md)。

## 开始使用

环境要求：Node.js 18+、pnpm。请保留并使用仓库中的 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认运行在 `http://localhost:8000`，经营数据表地址为：

```text
http://localhost:8000/spreadjs-demo/business
```

生产构建：

```bash
pnpm build
```

代码格式化：

```bash
pnpm format
```

## SpreadJS 许可证

复制 `.env.example` 为 `.env.local`，再填写许可证：

```text
UMI_APP_SPREADJS_LICENSE_KEY=your-license-key
```

Umi 只会自动向浏览器注入 `UMI_APP_` 前缀的环境变量。不要把真实许可证提交到仓库；未配置时页面会明确显示“评估许可”，并出现 SpreadJS 评估水印。

## 项目结构

```text
.
├── .umirc.ts                    路由与 Umi 配置
├── src/pages/                   各表格方案的独立调研页面
└── src/pages/SpreadJSDemo/
    ├── components/              页头、工具栏、工作区与检查面板
    ├── spreadsheet/             数据模型、列协议和 SpreadJS 控制器
    ├── index.tsx                页面组合入口
    ├── index.less               视觉、布局和响应式规则
    └── README.md                SpreadJS 详细设计文档
```

仓库还包含 AG Grid、AntV S2、Handsontable、Jspreadsheet、UniverTable 与 VTable 页面，具体路由以 `.umirc.ts` 为准。

## Demo 边界

- 经营数据、批注、历史和附件目前都是前端演示数据；刷新后，运行期修改不会持久化。
- 附件只保存在浏览器内存中，未接入对象存储、鉴权、病毒扫描或服务端审计。
- 10 万行模式用于交互和渲染压力验证，不代表真实接口吞吐量。
- 正式接入后端时，应使用稳定的业务行维与列维，不要保存会随折叠和下钻变化的物理行列号。
