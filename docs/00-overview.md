---
status: stable
owner: 前端架构组
last_updated: 2026-07-23
applies_to: schema-ui-protocol v2.4
---

# Schema-Driven UI 协议总纲

## 1. 这是什么

一套配置驱动 UI（Schema-Driven UI）协议，用于中后台系统的页面渲染。

**核心分工原则：**

> 后端定义页面的**语义、数据和结构**（通过 YAML/JSON）；
> 前端负责编写**解析器（Renderer）、核心组件库、皮肤样式**。

后端完全不需要感知 CSS、DOM 布局、低级前端事件，只需要回答三个问题：
- 我要展示什么数据？（`data`）
- 用什么形式呈现？（`type` / `props`）
- 在哪呈现，结构如何组织？（`children`）

## 2. 文档地图

项目使命、权威层级、依赖方向和版本边界先以根 [`PROJECT_CHARTER.md`](../PROJECT_CHARTER.md) 为准；
协议发布文件清单由根 [`protocol-manifest.json`](../protocol-manifest.json) 定义。

| 文档 | 面向读者 | 用途 |
|---|---|---|
| [00-overview.md](./00-overview.md) | 所有人 / AI | 总纲、术语表（本文档） |
| [01-node-protocol.md](./01-node-protocol.md) | 前后端开发者 / AI | **核心协议规范**，Node 结构定义 |
| [02-reaction-expression.md](./02-reaction-expression.md) | 后端开发者 / AI | 联动表达式语法规范 |
| [03-component-registry.md](./03-component-registry.md) | 前后端开发者 / AI | 组件类型（`type`）注册表 |
| [04-datasource-contract.md](./04-datasource-contract.md) | 后端开发者 / AI | API 数据契约（分页、响应结构） |
| [05-scenarios/](./05-scenarios/) | 所有人 / AI | 可复制的完整场景示例 |
| [06-validation.md](./06-validation.md) | 前后端开发者 / AI | 校验规则与工具链 |
| [07-actions-contract.md](./07-actions-contract.md) | 前后端开发者 / AI | Action 行为契约（since 0.2） |
| [08-renderer-spec.md](./08-renderer-spec.md) | 前端开发者 / AI | Renderer 实现规范（since 0.2.1） |
| [09-v1-release-goals.md](./09-v1-release-goals.md) | 前后端开发者 / 维护者 | `v1.0.0` 历史发布目标与门禁记录 |
| [10-v2-release-goals.md](./10-v2-release-goals.md) | 前后端开发者 / 维护者 | `v2.0.0` 历史 MAJOR 发布目标与门禁 |
| [12-v2.1-release-goals.md](./12-v2.1-release-goals.md) | 前后端开发者 / 维护者 | `v2.1.0` 历史 MINOR 发布目标与门禁 |
| [13-v2.2-release-goals.md](./13-v2.2-release-goals.md) | 前后端开发者 / 维护者 | `v2.2.0` 历史 MINOR 发布目标与门禁 |
| [14-v2.3-release-goals.md](./14-v2.3-release-goals.md) | 前后端开发者 / 维护者 | `v2.3.0` 历史 MINOR 发布目标与门禁 |
| [15-v2.4-release-goals.md](./15-v2.4-release-goals.md) | 前后端开发者 / 维护者 | `v2.4` 线 MINOR 发布目标与门禁（制品当前 `2.4.1`） |
| [RELEASE.md](./RELEASE.md) | 维护者 | 发布流程：main 只 CI、独立 tag、协议资产与 MCP GHCR |
| [11-next-admin-lifecycle-goals.md](./11-next-admin-lifecycle-goals.md) | 前后端开发者 / 维护者 | Admin 生命周期后续轨道（P1+ 规划） |
| [schemas/](./schemas/) | 工具 / AI | 标准 JSON Schema（`page/node/action/reaction`）与组件注册 DSL（`component-registry.json`） |
| [decisions/](./decisions/) | 维护者 / AI | 架构决策记录（ADR），解释"为什么这么设计" |
| `audit/` | 维护者 | 非协议制品的过程记录；完成结论应沉淀到规范、ADR、迁移或 CHANGELOG |
| [CHANGELOG.md](./CHANGELOG.md) | 所有人 | 协议版本变更记录 |

**阅读建议：**
- 第一次接触本协议 → 先读本文档，再读 `01-node-protocol.md`。
- 只想抄一个现成配置 → 直接看 `05-scenarios/`。
- 要给协议写校验工具 → 先读项目章程，再直接消费 `schemas/*.json` 与 `conformance/fixtures/`，不得从现有验证器反推新语义。
- 想扩展协议、新增字段 → 先读 `decisions/`，确认没有历史上被否决过的类似方案。
- 查阅历史审计证据 → 查看 `audit/`；它不是协议权威来源，也不进入协议制品。
- 想了解版本变更历史 → 直接看 `CHANGELOG.md`。
- 维护或发布 `v2.4.x` → 对照 `15-v2.4-release-goals.md`；`14` / `13` / `12` / `10` / `09` 为历史发布证据。
- 规划后续 Admin 能力 → 读 `11-next-admin-lifecycle-goals.md`；P0/P1 见 ADR-0020 / 0021 / 0022 / 0023。

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

## 4. 协议边界（不做什么）

本协议**不**描述以下内容，这些完全由前端组件库和皮肤系统决定：

- ❌ 颜色、字号、间距、圆角等具体样式值
- ❌ DOM 结构、CSS 类名
- ❌ 低级 DOM 事件（onClick 的具体回调实现）
- ❌ 动画、过渡效果
- ❌ 响应式断点的具体像素值

后端在 `props` 中只能使用**语义级**枚举（如 `tone: warning`、`format: currency`），
具体这些语义在视觉上如何呈现，是前端主题系统的职责，后端不应该也不需要关心。

## 5. 版本与稳定性

当前协议版本：`v2.4.1`，页面通过 `meta.protocolVersion: "2.4"` 声明 MAJOR.MINOR。`1.0` 页面不得直接进入 v2 标准 Renderer；必须继续由 v1 Renderer 消费，或由调用方显式执行迁移 adapter 后再交给 v2。标准 Renderer 入口不做版本猜测。v2.4 发布门禁见 [15-v2.4-release-goals.md](./15-v2.4-release-goals.md)；从 2.3 升级见 [migrations/2.3-to-2.4.md](./migrations/2.3-to-2.4.md)；从 2.2 升级见 [migrations/2.2-to-2.3.md](./migrations/2.2-to-2.3.md)。

PATCH 或 RC 修订若包含需要 Renderer 执行支持的能力，页面应通过 `meta.requiredCapabilities` 显式声明（如 `actions.upload`、`actions.row.request`、`actions.page.trigger`、`actions.row.navigate`、`form.record.load`、`table.selection`、`actions.batch.request`、`permissions.inheritance`、`record.view.load`），Renderer 在加载前按自身 `supportedCapabilities` 做能力匹配。这样 `protocolVersion` 继续保持结构兼容锚点，同时避免同一 MAJOR.MINOR 下的新旧 Renderer 对执行能力产生误判。L2 另强制字段集→`protocolVersion` 下限（2.1 字段不得挂在 `"2.0"`；2.2 字段须 `"2.2"`；`permissionCascade` / `permissionIntent` 须 `"2.3"` 且声明 `permissions.inheritance`；`recordView` 须 `"2.4"` 且声明 `record.view.load`）。

**Admin 生命周期 P0**（页面工具栏、行级导航、编辑回填）已由 [ADR-0020](./decisions/0020-page-action-trigger.md) / [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) 接受；**当前页多选与批量 request** 由 [ADR-0022](./decisions/0022-table-selection-and-batch-request.md) 随 `2.2.0` 制品正式发布；**容器权限继承与操作 intent** 由 [ADR-0023](./decisions/0023-container-permission-inheritance.md) 随 `2.3.0` 制品正式发布；**标准只读详情 `recordView`** 由 [ADR-0024](./decisions/0024-record-view.md) 随 `2.4.0` 制品正式发布。未使用对应字段的合法旧 MINOR 页面行为不变。轨道见 [11-next-admin-lifecycle-goals.md](./11-next-admin-lifecycle-goals.md)。

本协议场景示例覆盖：网格布局、数据表格、表单联动、表格行级后端动作、搜索表单筛选表格、文件上传、列表编辑闭环与批量多选（扩展示例）。后续新增场景类型时，
应遵循同一套 Node 结构（`type`/`props`/`data`/`children`/`reactions`），
不应引入平行的、结构不一致的新概念。如需引入新概念，请先在 `decisions/` 下补充 ADR。
