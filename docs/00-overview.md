---
status: stable
owner: 前端架构组
last_updated: 2026-08-14
applies_to: schema-ui-protocol v2.9
---

# Schema-Driven UI 协议总纲

## 1. 这是什么

一套配置驱动 UI（Schema-Driven UI）协议，用于中后台系统的页面渲染。

**核心分工原则：**

> 页面生产方定义页面的**语义、数据和结构**（通过 YAML/JSON）；
> 前端（Renderer 与组件库）负责编写**解析器（Renderer）、核心组件库、皮肤样式**。

页面生产方完全不需要感知 CSS、DOM 布局、低级前端事件，只需要回答三个问题：
- 我要展示什么数据？（`data`）
- 用什么形式呈现？（`type` / `props`）
- 在哪呈现，结构如何组织？（`children`）

## 2. 文档地图

项目使命、权威层级、依赖方向和版本边界先以根 [`PROJECT_CHARTER.md`](../PROJECT_CHARTER.md) 为准；
协议发布文件清单由根 [`protocol-manifest.json`](../protocol-manifest.json) 定义。

| 文档 | 面向读者 | 用途 |
|---|---|---|
| [00-overview.md](./00-overview.md) | 所有人 / AI | 总纲、术语表（本文档） |
| [01-node-protocol.md](./01-node-protocol.md) | 页面生产方 / Renderer 实现者 / AI | **核心协议规范**，Node 结构定义 |
| [02-reaction-expression.md](./02-reaction-expression.md) | 页面生产方 / AI | 联动表达式语法规范 |
| [03-component-registry.md](./03-component-registry.md) | 页面生产方 / 组件库实现者 / AI | 组件类型（`type`）注册表 |
| [04-datasource-contract.md](./04-datasource-contract.md) | 页面生产方 / 业务 API 实现方 / AI | API 数据契约（分页、响应结构） |
| [05-scenarios/](./05-scenarios/) | 所有人 / AI | 可复制的完整场景示例 |
| [06-validation.md](./06-validation.md) | 页面生产方 / Renderer 实现者 / AI | 校验规则与工具链 |
| [07-actions-contract.md](./07-actions-contract.md) | 页面生产方 / Renderer 实现者 / AI | Action 行为契约（since 0.2） |
| [08-renderer-spec.md](./08-renderer-spec.md) | Renderer 实现者 / AI | Renderer 实现规范（since 0.2.1） |
| [09-app-manifest.md](./09-app-manifest.md) | manifest 生产方 / Host 实现者 | 应用级清单与导航规范（ADR-0025/0026） |
| [10-host-interoperability.md](./10-host-interoperability.md) | Host/App 开发者 / AI | Host/App 互操作：bootstrap 生命周期、Host failure result、conformance claim（ADR-0034–0037，since 2.8） |
| [schemas/](./schemas/) | 工具 / AI | 标准 JSON Schema（`page/node/action/reaction`）与组件注册 DSL（`component-registry.json`） |
| [decisions/](./decisions/) | 维护者 / AI | 架构决策记录（ADR），解释"为什么这么设计" |
| [migrations/](./migrations/) | 各消费方 | 版本间升级路径（informative） |
| [release-goals/](./release-goals/) | 维护者 | **非核心协议**：版本 accept / 发布门禁与演进轨道（informative） |
| [RELEASE.md](./RELEASE.md) | 维护者 | 发布流程：main 只 CI、独立 tag、协议资产与 MCP GHCR |
| `audit/` | 维护者 | 非协议制品的过程记录；完成结论应沉淀到规范、ADR、迁移或 CHANGELOG |
| [CHANGELOG.md](./CHANGELOG.md) | 所有人 | 协议版本变更记录 |

**阅读建议：**
- 第一次接触本协议 → 先读本文档，再读 `01-node-protocol.md`。
- 只想抄一个现成配置 → 直接看 `05-scenarios/`。
- 要给协议写校验工具 → 先读项目章程，再直接消费 `schemas/*.json` 与 `conformance/fixtures/`，不得从现有验证器反推新语义。
- 想扩展协议、新增字段 → 先读 `decisions/`，确认没有历史上被否决过的类似方案。
- 查阅历史审计证据 → 查看 `audit/`；它不是协议权威来源，也不进入协议制品。
- 想了解版本变更历史 → 直接看 `CHANGELOG.md`；升级步骤看 `migrations/`。
- 维护或发布某 MINOR → 对照 [`release-goals/`](./release-goals/) 下对应 `vX.Y.md`（当前线：[`v2.9.md`](./release-goals/v2.9.md)，G0–G4 已闭合；前序 [`v2.6.md`](./release-goals/v2.6.md)）。**门禁不是语义权威。**
- 规划后续 Admin 能力 / 待增补一等公民 → 读 [`release-goals/next-admin-lifecycle.md`](./release-goals/next-admin-lifecycle.md)（**informative** backlog；P0–D.0 与 D.1 中 F1/进阶已随 v2.6/v2.7 交付，残留 F2+ 等见该文 §4 / §8）。

## 3. 术语表（权威定义，其余文档不得与本表冲突）

| 术语 | 定义 |
|---|---|
| **Node（节点）** | 协议的最小单元，一个 YAML 对象，代表页面上的一个"东西"（可以是容器、也可以是具体控件） |
| **type** | Node 上表示"渲染成什么组件"的字段，前端按此字段做组件注册表查找分发 |
| **props** | Node 上表示"业务级配置参数"的字段，只包含语义信息，不含任何 CSS/DOM 细节 |
| **data** | Node 上表示"数据来源"的字段，描述值是静态的、引用页面数据源的、还是来自独立 API 请求的 |
| **children** | Node 的子节点数组，用于表达树形嵌套结构（布局容器场景） |
| **reactions** | 声明式联动规则数组；主要挂载在表单字段 Node（默认 `scope: form`）上，也可挂载在表格 `columns[]` / `actions[]`。列表达式使用 `$row.*` 或列级 `$self` 时需 `scope: row`；行操作 `actions` **任意 scope 禁止 `$self`**（仅 `$row.*` / `$context.*`，或 form 上下文下的 `$deps.*`）。`fulfill` 在列/操作上仅允许 `visible`/`disabled`；仅使用 `$deps.*` / `$context.*` 时可使用默认 `scope: form`（表格须位于 form 上下文） |
| **Renderer（渲染器）** | 前端负责递归解析 Node 树、按 `type` 分发到具体组件的核心模块 |
| **组件注册表** | 前端维护的 `type` → 组件实现 的映射表，是协议与具体 UI 实现之间的唯一桥梁 |
| **页面生产方** | 编写页面 YAML/JSON（Node 树、`datasources`、`actions`、`meta` 声明）并承担生产方 CI 校验的一方（ADR-0038） |
| **业务 API 实现方** | 实现页面引用的 HTTP API（DataRef / optionsSource / recordSource / Action / 上传端点），负责鉴权、错误响应结构与幂等去重的一方（ADR-0038） |
| **manifest 生产方** | 提供 `app-manifest.json`（及可选的 bootstrap document）的一方（ADR-0038） |
| **Host（宿主应用）** | 装配 Renderer、注入 `baseURL` / `$context` / 认证、提供 UI 壳与运行环境的一方；可选择声明 `10` 的可选能力（ADR-0038） |
| **组件库/皮肤系统** | 维护 `type` → 具体组件实现映射，决定视觉与交互呈现的一方（ADR-0038） |

## 4. 协议边界（不做什么）

本协议**不**描述以下内容，这些完全由前端组件库和皮肤系统决定：

- ❌ 颜色、字号、间距、圆角等具体样式值
- ❌ DOM 结构、CSS 类名
- ❌ 低级 DOM 事件（onClick 的具体回调实现）
- ❌ 动画、过渡效果
- ❌ 响应式断点的具体像素值

页面生产方在 `props` 中只能使用**语义级**枚举（如 `tone: warning`、`format: currency`），
具体这些语义在视觉上如何呈现，是前端主题系统的职责，页面生产方不应该也不需要关心。

### 4.1 消费方职责矩阵（ADR-0038）

下游阅读任何一条契约时，按下表确认"这条约束管我"以及"我的自由区在哪"：

| 角色 | 生产/拥有 | 必须遵循 | 自行决定 |
|---|---|---|---|
| 页面生产方 | 页面 YAML/JSON（Node 树、`datasources`、`actions`、`meta` 声明） | `01`/`02`/`03` 页面侧契约、`06` 校验层级（L0–L2 生产方 CI）、`08` §3 版本与 capability 声明 | 页面文件组织、生产方内部评审流程、选用哪些场景与组件 |
| 业务 API 实现方 | 页面引用的 HTTP API（DataRef / optionsSource / recordSource / Action / 上传端点） | `04` 数据契约（保留参数、错误响应结构、分页、响应映射）、`07` §3 业务 API 义务（幂等去重、错误结构） | 鉴权机制（`04` §5）、实现语言与框架、`sort` 结果排序语义 |
| manifest 生产方 | `app-manifest.json` 与可选的 bootstrap document | `09`/`10` 结构、路由模板、capability 声明、未知字段 fail-closed | 清单内容编排、是否提供 bootstrap document（可选能力） |
| Renderer | 组件注册表与解析执行 | `08` 行为契约、conformance fixtures 逐字段一致、`09`/`10` 消费侧义务 | 框架选型（React/Vue/…）、内部实现结构、表达式引擎实现方式 |
| Host（宿主应用） | 装配 Renderer、注入 `baseURL` / `$context` / 认证、UI 壳 | `08` §2.6/§3 初始化契约、`09` 宿主义务、`10` 可选能力（声明后才生效） | 认证供应商、UI 壳与主题、路由框架、是否声明 `10` 的能力 |
| 组件库/皮肤系统 | `type` → 具体组件实现 | `03` 组件 props 契约的语义面（wire 类型、必填、组合约束） | 视觉样式、主题、交互形态（§4 的五个不） |

`06` 的校验责任分配：L0/L1/L2 由页面生产方 CI 保证，L3a/L3b 由 Renderer 加载时兜底（CI 侧 L3a 可选）；
部分规则仅 L2 为权威执行点。生产方与消费者各守其位，验证器通过不替代协议评审。

## 5. 版本与稳定性

当前协议版本：`v2.9.0`，页面通过 `meta.protocolVersion: "2.9"` 声明 MAJOR.MINOR。`1.0` 页面不得直接进入 v2 标准 Renderer；必须继续由 v1 Renderer 消费，或由调用方显式执行迁移 adapter 后再交给 v2。标准 Renderer 入口不做版本猜测。v2.9 发布门禁见 [release-goals/v2.9.md](./release-goals/v2.9.md)；从 2.8 升级见 [migrations/2.8-to-2.9.md](./migrations/2.8-to-2.9.md)；v2.6 见 [release-goals/v2.6.md](./release-goals/v2.6.md) 与 [migrations/2.5-to-2.6.md](./migrations/2.5-to-2.6.md)；v2.5 见 [release-goals/v2.5.md](./release-goals/v2.5.md) 与 [migrations/2.4-to-2.5.md](./migrations/2.4-to-2.5.md)。

PATCH 或 RC 修订若包含需要 Renderer 执行支持的能力，页面应通过 `meta.requiredCapabilities` 显式声明（如 `actions.upload`、`actions.row.request`、`actions.page.trigger`、`actions.row.navigate`、`form.record.load`、`table.selection`、`actions.batch.request`、`permissions.inheritance`、`record.view.load`、`table.sort`、`app.manifest`、`app.navigation`、`form.controls.extended`、`form.controls.advanced`、`data.route-binding`、`form.controls.readonly`），Renderer 在加载前按自身 `supportedCapabilities` 做能力匹配。这样 `protocolVersion` 继续保持结构兼容锚点，同时避免同一 MAJOR.MINOR 下的新旧 Renderer 对执行能力产生误判。L2 另强制字段集→`protocolVersion` 下限（2.1 字段不得挂在 `"2.0"`；2.2 字段须 `"2.2"`；`permissionCascade` / `permissionIntent` 须 `"2.3"` 且声明 `permissions.inheritance`；`recordView` 须 `"2.4"` 且声明 `record.view.load`；`sortable` / `sortField` / `defaultSort` 须 `"2.5"` 且声明 `table.sort`；`textarea` / `switch` / `checkbox` / `radio` / `select.mode: multiple` 须 `"2.6"` 且声明 `form.controls.extended`；`cascader` / `checkboxGroup` / `richText` / `password` / `defaultValue` 须 `"2.7"` 且声明 `form.controls.advanced`；params 路由绑定须 `"2.9"` 且声明 `data.route-binding`；表单字段 `readOnly` 须 `"2.9"` 且声明 `form.controls.readonly`）。

**Admin 生命周期 P0**（页面工具栏、行级导航、编辑回填）已由 [ADR-0020](./decisions/0020-page-action-trigger.md) / [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) 接受；**当前页多选与批量 request** 由 [ADR-0022](./decisions/0022-table-selection-and-batch-request.md) 随 `2.2.0` 制品正式发布；**容器权限继承与操作 intent** 由 [ADR-0023](./decisions/0023-container-permission-inheritance.md) 随 `2.3.0` 制品正式发布；**标准只读详情 `recordView`** 由 [ADR-0024](./decisions/0024-record-view.md) 随 `2.4.0` 制品正式发布；**应用级清单 / 导航 / 表格排序声明** 由 [ADR-0025](./decisions/0025-app-manifest.md) / [0026](./decisions/0026-app-navigation.md) / [0027](./decisions/0027-table-sort-declaration.md) 随 `2.5.0` 制品正式发布；**表单控件面扩展（F1 A+B）** 由 [ADR-0028](./decisions/0028-form-control-surface.md)（`textarea` / `switch` / `checkbox` / `radio` / `select.mode: multiple`，capability `form.controls.extended`）随 `2.6.0` 制品正式发布；**表单控件面进阶（F1e + checkbox 组 + 富文本 + password + defaultValue）** 由 [ADR-0029](./decisions/0029-cascader.md)–[0033](./decisions/0033-form-default-value.md)（capability `form.controls.advanced`）随 `2.7.0` 制品正式发布；**数据源路由绑定与表单字段只读** 由 [ADR-0039](./decisions/0039-data-source-route-binding.md)（`data.route-binding`）/ [0040](./decisions/0040-form-field-readonly.md)（`form.controls.readonly`）随 `2.9.0` 制品正式发布。未使用对应字段的合法旧 MINOR 页面行为不变。演进轨道见 [release-goals/next-admin-lifecycle.md](./release-goals/next-admin-lifecycle.md)（非语义权威）。

本协议场景示例覆盖：网格布局、数据表格、表单联动、表格行级后端动作、搜索表单筛选表格、文件上传、列表编辑闭环与批量多选、扩展/进阶表单控件面（扩展示例）。后续新增场景类型时，
应遵循同一套 Node 结构（`type`/`props`/`data`/`children`/`reactions`），
不应引入平行的、结构不一致的新概念。如需引入新概念，请先在 `decisions/` 下补充 ADR。
