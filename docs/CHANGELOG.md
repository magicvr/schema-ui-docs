# Changelog

本协议遵循语义化版本（MAJOR.MINOR.PATCH）：
- MAJOR：不兼容的协议结构变更
- MINOR：新增字段/组件类型，向后兼容
- PATCH：文档修订、示例补充

## v0.1.0 — 2026-07-07

初版发布。

**新增：**
- 核心 Node 协议：`type` / `props` / `data` / `children` / `reactions`
- 联动表达式引擎（`when` 白名单语法）
- 组件类型：`grid`、`section`、`tabs`、`statCard`、`chart`、`text`、`table`、`form`、`input`、`inputNumber`、`select`
- 数据源契约：`static` / `ref` / `api` 三种模式，`table` 分页契约
- 三个基础场景示例：网格看板、数据表格、表单联动
- JSON Schema 校验文件：`node.schema.json` / `reaction.schema.json` / `component-registry.json`

## v0.2.0 — 2026-07-07

**破坏性变更：**
- **A3：** `valueField` 从 `data.valueField` 迁移至 `props.valueField`（`statCard` / `text`）。
- **B2（方案A）：** `tabs` 内容改为 `items[].content` 内嵌，`tabs` 自身不再支持 `children`。

**新增：**
- **B1：** Node 新增可选 `id` 字段（页面内唯一标识）。
- **B3：** 新增 `actions` 完整契约（`request` / `navigate` / `modal` / `custom`），含 `onSuccess`/`onError` 语义级行为。新增 `docs/07-actions-contract.md` + `schemas/action.schema.json`。
- **B4：** `span` 提升为通用 props，任何 `grid` 直接子节点均可声明。
- **B5：** 表单字段新增 `placeholder` / `description` / `tooltip` 可选字段。
- **B6：** i18n `xxxKey` 约定：`label`/`title`/`content` 等文案字段均可用 `xxxKey` 替代。
- **B7：** `select` 支持远程动态选项 `optionsSource`，含 `$deps.*` 参数引用及空值省略规则。
- **B8：** 组件级 `states`（空态/加载态/错误态文案定制），仅对 `supportsData: true` 的组件生效。
- **B9：** `component-registry.json` 增加 `deprecated` / `deprecatedMessage` / `since` 元信息标注能力。
- **B10：** 表格行级操作显隐 `visibleField`，数据驱动不引入表达式。
- **A1：** 修复 JSON Schema CSS 禁用词校验为 `not.anyOf` 逐一拦截（双轨策略：L1 Schema + L4 lint）。
- **A2：** 修复 `text` 组件 `data` 支持说明矛盾，明确支持 `data.source: static/ref/api`。
- **A4：** 补充 `datasources` + `data.source: ref` 完整示例。
- **A5：** `meta` 新增必填字段 `protocolVersion`（如 `"0.2"`）。

**涉及的文档与 Schema：**
- 协议文档：`00` / `01` / `03` / `04` / `06` / 新增 `07`
- JSON Schema：`node.schema.json` / `component-registry.json` / 新增 `action.schema.json`
- 场景示例：全部三个场景已更新至 v0.2 结构
