# SpreadJS 经营数据表 Demo

基于 SpreadJS 19.1 的前端业务表格组件 Demo，对应需求截图中的 20 项能力。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/`。

## 功能入口

- 工具栏：撤销 / 重做、矩形选区复制、快速搜索、列显隐、行列分组、自动列宽。
- 双行树：左侧 `rowTree`（品类 → 子品类）与中间 `extensionRows`（区域 → 城市）可分别展开/收起。
- 列树：顶部三层列表头和原生 Column Outline 支持指标组展开/收起。
- 面包屑：大区 → 省份 → 门店的下钻与上钻。
- 侧边面板：自定义统计、简单批注、单元格值历史、计算血缘、附件说明。
- 右键单元格：打开批注、历史、血缘、附件和下钻业务菜单。
- `10 万行模式`：切换到 100,000 行 × 18 列的压力数据集。
- 表格单元格：下拉状态、日期选择、复选框和原生 FileUpload 附件单元格。

## 代码结构

- `app/page.tsx`：页面布局与交互入口。
- `app/spreadsheet/use-spreadsheet-controller.ts`：SpreadJS 生命周期、命令、搜索、分组及压力数据分页。
- `app/spreadsheet/model.ts`：业务字段、多层表头、行列分组、样例数据及纯函数。
- `app/spreadsheet/clipboard.ts`：复制和粘贴回调桥接。
- `app/components/spreadsheet-ui.tsx`：搜索、列管理、状态栏、抽屉和消息提示。

## SpreadJS 许可证

未配置许可证时，SpreadJS 评估版仅适合在 localhost 使用，并会显示评估水印。正式部署前设置：

```bash
NEXT_PUBLIC_SPREADJS_LICENSE_KEY=你的许可证密钥
```

## 验证

```bash
npm run lint
npm test
```

`npm test` 会执行生产构建和功能契约测试。
