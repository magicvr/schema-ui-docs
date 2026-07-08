# Changelog

本协议遵循语义化版本（MAJOR.MINOR.PATCH）：
- MAJOR：不兼容的协议结构变更
- MINOR：新增字段/组件类型，向后兼容
- PATCH：文档修订、示例补充；在 `0.x` 阶段，也可承载不改变 `meta.protocolVersion` 的向后兼容契约补齐（如补充既有场景的错误处理、认证钩子、机器可读 Schema 同步）

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

> **版本说明：** v0.2.1 是基于 [0003 审计](./audit/archived/0003-2026-07-07-review.md) 发现的 MVP 阻断项紧急补发的就绪度补丁，与 v0.2.0 在同一天完成。内容为 Renderer 实现规范、缺失组件、校验工具链等操作性约定，不改变 v0.2.0 已定义的 Node 结构和表达式语法。

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
- **searchForm：** `form` 新增 `mode: search` + `targetTable`，搜索模式下提交行为变为刷新目标表格，字段值自动合并为表格 API 参数。
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

## v0.2.3 — 2026-07-08（组件契约补丁）

> **版本说明：** v0.2.3 是基于第七轮审计（0007）发现的组件契约完备性与文档内部一致性问题的修补，不改变 v0.2.2 已定义的 Node 结构和表达式语法。

**修复（基于第七轮审计）：**
- **S1：** `03-component-registry.md` 及 `component-registry.json` 中 `select` 组件补充 `required` 和 `defaultVisible` 字段（与其他表单字段组件保持一致）。
- **S2：** `03-component-registry.md` 中 `dateRangePicker` 章节补充 `reactions` 注意事项表格，明确定义 `$deps` 引用规则和 `$self` 语义。
- **S3：** `02-reaction-expression.md` §10.4 措辞修正：`"reactions/otherwise"` → `"fulfill/otherwise"`。
- **S4：** `04-datasource-contract.md` 新增 §3.2 `data.params` 中 `$deps.*` 的作用域边界章节，明确非表单上下文中静态校验拒绝。
- **S5：** `03-component-registry.md` 搜索模式示例结构修正：`form` 与 `table` 包裹在 `section` 容器内作为 `body` 的 `children`。
- **S6：** `CHANGELOG.md` v0.2.1 措辞清理：移除"（方案 A）"后缀避免歧义。
- **S7：** `component-registry.json` 中 `datePicker`/`dateRangePicker`/`upload` 的 `placeholder` 字段补充 `since` 标注。
- **S8：** 新增 `05-scenarios/README.md` 目录索引文件，包含文件列表表格与阅读顺序建议。

## v0.2.4 — 2026-07-08（ADR 决策补丁）

> **版本说明：** v0.2.4 基于审计 0012 的 ADR 决策缺口补齐两个已成熟的协议决策：响应字段名映射与表达式读写求值时序。A3-A6 保持未来触发型议题，未提前扩展核心协议能力。

**新增 / 决策：**
- **D1：** 新增 `decisions/0005-response-mapping.md`，正式标准化 `data.responseMapping`。映射声明与 `params` 同级，仅用于响应解析，不作为请求参数发送。
- **D2：** `schemas/node.schema.json` 的 `DataRef` 增加 `responseMapping`，支持 `list` / `total` 点路径映射。
- **D3：** 新增 `decisions/0006-expression-evaluation-order.md`，表达式引擎采用稳定快照模型：本轮读旧快照，本轮末尾批量提交写入，下一轮读取新值。
- **D4：** `08-renderer-spec.md` 增加 `responseMapping` 应用阶段、表达式批量提交与循环保护要求。

**修订：**
- `04-datasource-contract.md` 将 `responseMapping` 从 planned 状态改为正式契约。
- `01-node-protocol.md` 删除“求值时序未定义”限制，改为引用 ADR-0006 的确定性模型。
- `02-reaction-expression.md` 新增表达式求值时序章节。

**涉及的文档与 Schema：**
- 协议文档：`01-node-protocol.md`（删除"求值时序未定义"限制，改为引用 ADR-0006）/`02-reaction-expression.md`（新增 §13 求值时序模型）/`04-datasource-contract.md`（`responseMapping` 升为正式契约）/`08-renderer-spec.md`（增加 `responseMapping` 处理与批量提交/循环保护要求）
- JSON Schema：`schemas/node.schema.json`（`DataRef` 增加 `responseMapping` 字段）
- 新增决策：`decisions/0005-response-mapping.md`、`decisions/0006-expression-evaluation-order.md`

## v0.2.5 — 2026-07-08（前后端契约完备性补丁）

> **版本说明：** v0.2.5 基于前后端契约完备性评估，补充了此前协议空白的四个方向：认证约定、完整错误响应体结构、`$context` 最小字段集、`upload` action 类型。不改变 v0.2.4 已定义的 Node 结构和表达式语法。使用 `actions[].type: upload` 或 `upload.props.actionRef` 的页面需要 Renderer 实现 v0.2.5 的 action 枚举与上传执行能力；旧 v0.2 Renderer 应在静态校验阶段拒绝未知 action 类型。

**新增：**
- **C1：** `04-datasource-contract.md` 新增 §5 认证约定——Renderer 通过宿主应用注入的 `requestInterceptor` 钩子携带认证信息，协议层不感知具体认证方案；明确 `401`/`403` 的处理规则与 `onAuthFailure` 钩子语义。
- **C2：** `04-datasource-contract.md` 原 §5 错误约定重构为 §6，拆分为 §6.1 HTTP 状态码矩阵（补充 `400`/`401`/`403`/`404` 独立语义）、§6.2 通用错误响应体（原有约定正式化）、§6.3 字段级验证错误（`400` + `errors` 数组契约，含字段路径与多条错误约定）、§6.4 网络超时与中断处理规则。
- **C3：** `02-reaction-expression.md` 新增 §11 `$context` 最小字段集——`$context.user` 明确协议级必须字段（`id`/`name`/`roles`）及项目扩展约定；`$context.features` 明确仅含项目注入字段、值类型约束（`boolean` 或简单枚举）及缺失时降级为 `false` 的规则。
- **C4：** `07-actions-contract.md` 新增 §7 `upload` action 类型——`multipart/form-data` 上传协议，含请求格式约定、响应体契约（`url`/`id`/`name`/`size`）、客户端与服务端双重校验要求、常见错误 `code` 建议值；`type` 枚举表同步增加 `upload` 条目；`upload` 组件新增 `props.actionRef` 用于引用顶层 upload action，既有 `props.action` 继续表示上传 URL。

**涉及的文档：**
- `04-datasource-contract.md`（§5 认证约定新增；§5-§8 重编号为 §6-§9；§6 错误约定重构）
- `02-reaction-expression.md`（新增 §11 `$context` 最小字段集；§11-§12 白名单扩展/缺失容错重编号为 §12-§13；§13 求值时序重编号为 §14）
- `07-actions-contract.md`（§2 枚举表增加 `upload`；新增 §7 upload 类型；§7-§8 原有章节重编号为 §8-§9）
- `03-component-registry.md` / `schemas/component-registry.json`（`upload.props.actionRef` 新增；`action` 与 `actionRef` 二选一）
