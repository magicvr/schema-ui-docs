---
status: stable
owner: 前端架构组
last_updated: 2026-07-09
applies_to: schema-ui-protocol v0.2
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
| [schemas/](./schemas/) | 工具 / AI | 机器可读的 JSON Schema |
| [decisions/](./decisions/) | 维护者 / AI | 架构决策记录（ADR），解释"为什么这么设计" |
| [audit/](./audit/) | 维护者 / AI | 过程性审计与迭代记录，编号规则：`NNNN-YYYY-MM-DD-{review,checklist}` |
| [CHANGELOG.md](./CHANGELOG.md) | 所有人 | 协议版本变更记录 |

**阅读建议：**
- 第一次接触本协议 → 先读本文档，再读 `01-node-protocol.md`。
- 只想抄一个现成配置 → 直接看 `05-scenarios/`。
- 要给协议写校验工具 / 训练 AI 生成配置 → 直接读 `schemas/*.json`。
- 想扩展协议、新增字段 → 先读 `decisions/`，确认没有历史上被否决过的类似方案。
- 查阅审计/迭代记录 → 直接看 `audit/`。
- 想了解版本变更历史 → 直接看 `CHANGELOG.md`。

## 3. 术语表（权威定义，其余文档不得与本表冲突）

| 术语 | 定义 |
|---|---|
| **Node（节点）** | 协议的最小单元，一个 YAML 对象，代表页面上的一个"东西"（可以是容器、也可以是具体控件） |
| **type** | Node 上表示"渲染成什么组件"的字段，前端按此字段做组件注册表查找分发 |
| **props** | Node 上表示"业务级配置参数"的字段，只包含语义信息，不含任何 CSS/DOM 细节 |
| **data** | Node 上表示"数据来源"的字段，描述值是静态的、引用页面数据源的、还是来自独立 API 请求的 |
| **children** | Node 的子节点数组，用于表达树形嵌套结构（布局容器场景） |
| **reactions** | Node 上表示"联动规则"的字段，仅用于表单场景内，字段之间的显隐/必填等状态联动 |
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

当前协议版本：`v0.2`（最新补丁版本 `v0.2.7`，见 [CHANGELOG.md](./CHANGELOG.md)）。`meta.protocolVersion` 仅声明 MAJOR.MINOR（即 `"0.2"`），不含 PATCH 号——因此 `v0.2.0`、`v0.2.1`、`v0.2.2`、`v0.2.3`、`v0.2.4`、`v0.2.5`、`v0.2.6` 与 `v0.2.7` 共享同一 `protocolVersion` 值。

PATCH 版本若新增需要 Renderer 执行支持的能力，页面应通过 `meta.requiredCapabilities` 显式声明（如 `actions.upload`、`actions.row.request`），Renderer 在加载前按自身 `supportedCapabilities` 做能力匹配。这样 `protocolVersion` 继续保持结构兼容锚点，同时避免同为 `"0.2"` 的新旧 Renderer 对执行能力产生误判。

本协议目前覆盖四类场景：网格布局、数据表格、表单联动、表格行级后端动作。后续新增场景类型时，
应遵循同一套 Node 结构（`type`/`props`/`data`/`children`/`reactions`），
不应引入平行的、结构不一致的新概念。如需引入新概念，请先在 `decisions/` 下补充 ADR。
