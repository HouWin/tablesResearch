# 企业级表格组件调研与 Demo

基于 Umi Max 4 和 React 18 的企业级 Web 表格能力验证项目。项目用可运行的业务场景对比多种表格引擎，重点验证大数据、层级数据、编辑、审计、附件与业务扩展能力。

## 页面导航

| 路由 | 方案 | 场景 |
| --- | --- | --- |
| `/spreadjs-demo/business` | SpreadJS 19.1 | 可交互的费用预算工作台，包含双维层级、编辑审计和 10 万行模式 |
| `/univerTable` | Univer | 企业表格扩展能力 |
| `/ag-grid` | AG Grid | 数据网格与预算场景 |
| `/antv-s2` | AntV S2 | 多维分析表格 |
| `/handsontable/big-data` | Handsontable | 大数据示例 |
| `/jspreadsheet/demo` | Jspreadsheet | 大数据与扩展能力 |
| `/vtable` | VTable | 基础能力验证 |

SpreadJS 费用预算表是当前完成度最高的交付页面。它的业务模型、交互说明和验收清单见 [`src/pages/SpreadJSDemo/README.md`](./src/pages/SpreadJSDemo/README.md)。

## 本地运行

环境要求：Node.js 18+，推荐使用 pnpm（仓库已提交 `pnpm-lock.yaml`）。

```bash
pnpm install
pnpm dev
```

开发服务器默认由 Umi 输出本地访问地址。费用预算表入口为：

```text
http://localhost:8000/spreadjs-demo/business
```

如果端口被占用，Umi 会自动选择下一个可用端口，请以终端输出为准。

## SpreadJS 许可证

未配置许可证时，费用预算表可以在 localhost 上用于评估，但会显示 SpreadJS 评估水印。正式环境必须配置合法许可证：

```bash
cp .env.example .env.local
```

然后在 `.env.local` 中填写：

```dotenv
UMI_APP_SPREADJS_LICENSE_KEY=your-license-key
```

`.env.local` 已被忽略，请勿提交许可证密钥。

## 质量检查

```bash
# 只检查费用预算表及其模块，启用未使用代码检查
pnpm typecheck:spreadjs

# 完整生产构建
pnpm build
```

完整仓库仍保留若干用于横向调研的实验页面，因此交付费用预算表时应优先运行上面的定向类型检查，再执行全量生产构建。

## 项目结构

```text
src/pages/SpreadJSDemo/
├── components/       # 页头、工具栏、工作区、弹层与检查面板
├── spreadsheet/      # 业务模型、列模型、坐标转换与 SpreadJS 控制器
├── index.tsx         # 页面装配与全屏状态
├── index.less        # 页面级视觉与响应式样式
└── README.md         # 费用预算表架构、集成与验收说明
```

其他表格方案均保持页面级隔离，避免不同引擎的样式和运行时状态互相影响。
