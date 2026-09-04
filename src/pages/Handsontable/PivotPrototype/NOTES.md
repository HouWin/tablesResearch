# 透视表 v8 NOTES（开发记录）

> 任务文档：`docs/PivotPrototype.md`（v8）；需求文档：`docs/PivotPrototype-Requirements.md`（v2）。
> v8 为**全量重写**（非 v7 增量修改）：行 = 组织 × 科目全节点交叉、列 = 期间树 + 指标尾。

## v8 结构与语义要点

1. **行 = 组织树节点 × 科目树节点 全交叉**（含 (集团, 费用汇总) 父×父合计行；demo 全展开 3×4=12 行）；组织节点行块跨全部科目行（合并），科目节点每组织块各占一行。
2. **科目折叠 = 组织块局部（方案 1，用户确认）**：折叠键 = `${组织节点key}|${科目节点key}`，每个组织块内的科目树独立折叠/展开，互不影响；组织折叠仍是全局（隐藏后代组织块）。全部折叠 = 每个组织块内各自折叠。
3. **列 = 维度层（期间 Q→月，对称/非对称任意形状）+ 指标尾**（预算数/实际数/完成率，挂在每月下）。值列 key = `期间节点key:指标`（如 `period:Q1:1月:预算数`）；Q 折叠聚合列 key = `period:Q1:预算数`。
4. **折叠规则**：组织/科目节点可折叠（保留自身行块/行）；**列维度层仅 Q 可折叠**（方案 a：折叠 → 各指标聚合列 = 该 Q 各月之和）；月份（子级=指标）与指标层**不可折叠**。不同 Q 的同名月份是独立节点（key 带父路径）。
5. **对称/非对称** = 期间树分支形状（Q1/Q2 子月集合），结构切换时后端重建树与明细、前端全量重拉。
6. **属性格式支持 'none'（无属性）**：`AttrFormat = 'none' | 'date' | 'text' | 'dropdown'`；'none' holder 属性格显示为空且只读（`cells` 回调返回 `readOnly`）。demo：费用汇总（科目父级汇总节点）属性 = none。

6.1 **属性作用域 = holder（方案 2，用户确认）**：属性不再挂在维度节点上，而是挂在 holder 上——
   - 组织属性 holder = 组织节点 key（组织列按块合并 → 天然每组织一个）
   - 科目属性 holder = `${组织key}|${科目key}`（科目树按组织块重复出现，每 (组织,科目) 组合独立，改一处不影响其他组织块；demo 各组织给不同日期：集团→办公费 02月 / 本部→05月 / 华晶→08月 等）
   - 契约 dump 中 `attrs` 为顶层对象（holder → Attr），不再嵌在节点上

## 沿用 v7 的关键决策（防坑清单）

- **编辑来源白名单** `EDIT_SOURCES = ['edit','Autofill.fill','paste']`：react-wrapper 每次 React 重渲染会 `updateSettings({data})` → 核心 reload → `afterChange('loadData'/'updateSettings')`，未过滤会整表标脏并死循环。
- **数据命令式驱动**：`data/columns/nestedHeaders/mergeCells` 不走 props，由 `rebuildFromRefs` 直接 `hot.updateSettings + hot.loadData`（`loadData` 会写 `tableMeta.data`，后续无 data 的 updateSettings 不会清空，已核对核心源码）。
- **脏标记方案 B**：等值变更不标脏；以首次编辑前值为基准，改回原值自动消脏。
- **type 展开覆盖 renderer**：`cells` 回调设置 `type` 时必须在同层显式声明 `renderer`（attrRenderer），否则脏角标不渲染；属性列 renderer 渲染**行数据值**（非重建快照）。
- **按指标规则引擎**：mock 加权规则 = Σ(amount×w)/Σw（w 按指标：预算 1.2/实际 1.0/完成率 0.8），演示"前端与规则无关"。
- 打印约定：`[pivot-data]`（结构/矩阵/行数据，初始化一次）、`[pivot-edit]`（每次修改/还原，载荷=保存结构）、`[pivot-save]`（提交载荷与返回 delta/错误）。

## 与 v8 任务文档的偏差

- 无（任务文档 v8 即按本实现规格撰写；如实现中发现文档不符，在此记录并修订文档）。
