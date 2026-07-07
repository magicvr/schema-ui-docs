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
- **B8：** 组件级 `states`（空态/加载态/错误态文案定制），仅对 `supportsStates: true` 的组件生效。
- **B9：** `component-registry.json` 增加 `deprecated` / `deprecatedMessage` / `since` 元信息标注能力。
- **B10：** 表格行级操作显隐 `visibleField`，数据驱动不引入表达式。
- **A4：** 补充 `datasources` + `data.source: ref` 完整示例。
- **A5：** `meta` 新增必填字段 `protocolVersion`（如 `"0.2"`）。

**修复：**
- **A1：** 修复 JSON Schema CSS 禁用词校验为 `not.anyOf` 逐一拦截（双轨策略：L1 Schema + L4 lint）。
- **A2：** 修复 `text` 组件 `data` 支持说明矛盾，明确支持 `data.source: static/ref/api`。

**涉及的文档与 Schema：**
- 协议文档：`00` / `01` / `03` / `04` / `06` / 新增 `07`
- JSON Schema：`node.schema.json` / `component-registry.json` / 新增 `action.schema.json`
- 场景示例：全部三个场景已更新至 v0.2 结构

## v0.2.1 — 2026-07-07（与 v0.2.0 同一天）

> **版本说明：** v0.2.1 是基于 [0003 审计](./docs/audit/0003-2026-07-07-review.md) 发现的 MVP 阻断项紧急补发的就绪度补丁，与 v0.2.0 在同一天完成。内容为 Renderer 实现规范、缺失组件、校验工具链等操作性约定，不改变 v0.2.0 已定义的 Node 结构和表达式语法。

**MVP 就绪度补丁（基于 0003 审计）。**

**新增：**
- **R1：** 前端 Renderer 组件注册机制规范（运行时注册，全局单例）。
- **R2：** 数据加载协调策略规范（默认并行、失败隔离、`$deps.*` 数据依赖、加载状态管理）。
- **R3：** 节点级错误边界策略（单个 Node 失败不阻断兄弟节点/整页）。
- **R4：** 表达式引擎沙箱实现指引（推荐 `expr-eval`，禁止 `eval`/`new Function`，含最小集成示例）。
- **G2：** 版本协商规范（Renderer `supportedVersions` 宣告、版本匹配规则、不匹配时错误信息格式）。
- **G3：** 环境变量 / baseURL 管理（相对路径由 Renderer 自动拼接 baseURL，环境切换通过不同 baseURL）。
- **datePicker / dateRangePicker：** 新增两个日期选择组件到组件注册表。
- **inputNumber：** 新增 `min`/`max`/`step`/`precision` 可选字段（数值范围、步长、精度控制）。
- **弹窗内容 Node 化：** `actions[].type: modal` 新增可选 `content: Node` 字段，与 `modalId` 可共存。
- **searchForm（方案 A）：** `form` 新增 `mode: search` + `targetTable`，搜索模式下提交行为变为刷新目标表格，字段值自动合并为表格 API 参数。
- **upload：** 新增文件上传组件（`field`/`label`/`accept`/`maxSize`/`multiple`/`action`），支持 reactions，上传完成后字段值设为后端返回的文件 URL/ID。
- **G1：** 后端开发者本地校验指南（`ajv-cli`、VS Code YAML Schema 关联、CI 集成示例）。

**已合并的 ADR：**
- `decisions/0003-context-namespace-and-visible-when.md`（`$context` 命名空间、`visibleWhen`、`permissions`、`contains` 运算符）。
- `decisions/0004-row-level-scope.md`（`$row` 作用域、`scope: row`/`scope: form`、`visibleField` 语法糖、嵌套表格 `$parentRow`）。

**涉及的文档与 Schema：**
- 协议文档：`01`（§3.8 visibleWhen、§3.9 permissions、§3.10 可见性公式） / `02`（`$context` 命名空间、`contains` 运算符、变量可见性矩阵、静态校验规则） / `03`（datePicker、dateRangePicker、searchForm mode、upload） / `06`（§5 本地校验指南） / `07`（§5 modal.content） / 新增 `08-renderer-spec.md`
- JSON Schema：`node.schema.json`（新增 VisibleWhen + Permissions 定义） / `action.schema.json`（modal 新增 content）
- `schemas/component-registry.json`（新增 datePicker、dateRangePicker、upload；form 新增 mode/targetTable）

## v0.2.2 — 2026-07-07（文档一致性补丁）

> **版本说明：** v0.2.2 是基于第五轮审计（0005）发现的文档/Schema 一致性问题进行的修补，不改变 v0.2.1 已定义的 Node 结构和表达式语法。

**修复（基于第五轮审计）：**
- **F1：** `component-registry.json` 中 `form.props` 补充 `additionalProperties: false`（与其他组件约束力度统一）。
- **F2：** `component-registry.json` 中 `tabs.props.items` 的 `required` 数组补充 `content`（与文档必填声明一致）。
- **F3：** `01-node-protocol.md §2` 顶层结构 YAML 中 `DataSourceDef` 统一为 `DataRef`（与 `node.schema.json` 定义名一致）。
- **F4：** `06-validation.md` L4 校验行补充说明：本仓库仅提供规范，不包含可执行 lint 脚本。
- **F5：** `01-node-protocol.md §3.10` 求值时序警告完善：增加具体规避建议和跟踪状态说明。
- **F6：** `00-overview.md` 版本声明增加 `v0.2.1` 补丁版本说明，消除读者困惑。
- **F7：** `03-component-registry.md` 中 `dateRangePicker` 增加搜索模式下参数传递行为的交叉引用。
- **F8：** `04-datasource-contract.md §4.1` `responseMapping` 跟踪条目增加临时变通方案说明。
