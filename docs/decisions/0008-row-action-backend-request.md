---
status: accepted
date: 2026-07-09
---

# ADR-0008: 表格行级后端请求动作绑定

## 状态

已接受(Accepted)。本 ADR 标准化表格行内按钮直接调用后端接口的声明式模型，并明确它与既有 `RowAction.key` 本地分发模型的关系。

> **0039 / V120 修订：** `requestMapping` 的 `$row.*` 与字面量绑定继续有效；因 v0.2 没有嵌套表格挂载结构，原 `$parentRow.*` 分支暂缓并由 L2 拒绝。

## 背景

中后台列表页中，行级的“退款 / 审批 / 删除 / 启停 / 重试 / 下架”等操作非常普遍。这类操作通常需要：

1. 根据当前行数据拼接接口路径或请求参数；
2. 弹出二次确认；
3. 调用后端接口；
4. 成功后刷新当前表格或展示提示；
5. 失败时使用统一错误处理。

v0.2.6 之前，`RowAction.key` 已被明确为前端预注册处理器的本地分发标识，不引用顶层 `actions`。这个边界避免了误把 `key` 当作 action id，但也导致行级后端请求没有协议级标准。若 Renderer、生成器和业务项目各自约定，会出现字段名、参数映射、刷新行为与错误处理口径不一致的问题。

因此需要在保持兼容的前提下，把行级后端请求标准化为协议能力。

## 决策

### D1. 保留 `RowAction.key`，新增 `RowAction.actionRef`

`RowAction.key` 继续作为本地行内操作类型标识，供前端预注册 handler、埋点或测试选择器使用；它不引用顶层 `actions`，语义不变。

新增可选字段 `RowAction.actionRef`，用于引用顶层 `actions` 中的 `type: request` action：

```yaml
actions:
  approveOrder:
    type: request
    method: POST
    url: /api/orders/{orderId}/approve
    onSuccess:
      behavior: reload

body:
  type: table
  props:
    actions:
      - key: approve
        label: 审批通过
        actionRef: approveOrder
        requestMapping:
          path:
            orderId: $row.orderId
```

约束：

- `actionRef` 只能引用顶层 `actions` 中存在的 action；
- 被引用 action 的 `type` 必须是 `request`；
- `upload` / `custom` 不作为 `RowAction.actionRef` 的标准目标；需要这些行为时继续使用前端预注册 handler 或后续 ADR；
- **`type: navigate` 行级绑定由 [ADR-0021](./0021-record-navigation-and-form-load.md) 扩展**（`navigateMapping` + capability `actions.row.navigate`）；本 ADR 原文「仅 request」在 0021 接受后以 0021 为准；
- 未声明 `actionRef` 的 RowAction 仍按 v0.2.6 的本地分发模型处理。

理由：

- 不破坏既有 `key` 语义和已接入项目；
- 顶层 `actions` 继续承载“请求是什么”，RowAction 承载“这一行如何触发它”；
- Renderer 与生成器可以通过 `actionRef` 明确区分本地 handler 和协议标准请求。

### D2. `requestMapping` 放在 RowAction 层，而不是 Action 层

新增 `RowAction.requestMapping`，用于描述当前行上下文如何绑定到被引用 request action：

```yaml
requestMapping:
  path:
    orderId: $row.orderId
  query:
    source: list
  body:
    version: $row.version
    decision: APPROVED
```

正式规则为：

```yaml
requestMapping:
  path:  # 替换 action.url 中的 {name} 占位符
    <name>: $row.<field> | literal
  query: # 生成 query string
    <name>: $row.<field> | literal
  body:  # 生成 JSON 请求体
    <name>: $row.<field> | literal
```

`requestMapping` 放在 RowAction 层的原因是：同一个 `request` action 可以被不同表格或不同按钮以不同的行字段绑定触发；行上下文是触发点上下文，不是 action 本身的全局属性。

### D3. `requestMapping` 值只允许字面量或单个行上下文点路径

`requestMapping` 的值只允许：

- 字符串、数字、布尔、`null` 字面量；
- 单个 `$row.*` 点路径；
- `$parentRow.*` 在 v0.2 中静态拒绝；未来需在嵌套表格挂载结构完成 ADR 后再讨论恢复。

`requestMapping.path` / `query` / `body` 都是扁平 key-value map，不支持嵌套对象或数组值。

不允许：

- 表达式，如 `$row.amount > 100`；
- 模板字符串，如 `/api/orders/${$row.id}`；
- 函数调用、数组过滤、算术运算；
- `$deps.*` 或 `$context.*`。
- 嵌套对象，如 `body.audit.operatorId: $row.operatorId`。

不合法示例：

```yaml
requestMapping:
  body:
    operatorId: $context.user.id   # 不允许：不得从 $context 注入用户身份
    nextVersion: $row.version + 1  # 不允许：不得写表达式
    audit:                         # 不允许：不得嵌套对象
      reason: manual
```

理由：行级请求映射是“字段绑定”，不是计算逻辑。权限、显隐和是否可点击继续由 `visibleWhen` / `permissions` / `reactions` 处理；用户身份和认证信息由宿主应用的请求拦截器注入，不应由页面配置把 `$context.user.*` 拼进请求体来伪造。

### D4. URL path 参数必须显式绑定

request action 的 `url` 可以使用 `{name}` 形式声明路径占位符：

```yaml
url: /api/orders/{orderId}/refund
```

若被 `RowAction.actionRef` 引用：

- `url` 中每个 `{name}` 必须在 `requestMapping.path.<name>` 中声明；
- `requestMapping.path` 中不得出现 URL 中不存在的 key；
- path 映射结果必须可安全编码为 URL path segment；若运行时解析为 `null` / `undefined`，Renderer 应拒绝执行该动作并进入动作级错误处理。

`query` 生成 URL 查询参数；`body` 生成 JSON 请求体。`GET` / `DELETE` 行级请求不得声明 `body`，应使用 `path` 或 `query` 传递当前行标识。

### D5. 成功、失败与刷新行为复用 `OutcomeBehavior`

行级 request action 的 `onSuccess` / `onError` 继续使用既有 `OutcomeBehavior`：

| behavior | 行级动作语义 |
|---|---|
| `toast` | 展示轻提示 |
| `navigate` | 跳转到指定地址 |
| `reload` | 重新加载触发该动作的表格数据 |
| `closeModal` | 若动作发生在弹窗内，关闭当前弹窗；普通表格行按钮中无效果或降级为 no-op |

`confirm` 仍保留在 RowAction 层，因为二次确认属于触发入口的用户交互语义，而不是后端请求本身。

### D6. 新增 PATCH 级能力键 `actions.row.request`

使用 `RowAction.actionRef` 的页面必须声明：

```yaml
meta:
  protocolVersion: "0.2"
  requiredCapabilities:
    - actions.row.request
```

Renderer 只有在 `supportedCapabilities` 中包含 `actions.row.request` 时，才可以执行该页面。旧 Renderer 应在加载前拒绝，而不是把 `actionRef` 当成未知字段忽略。

### D7. 安全边界

行级后端请求不改变认证与权限边界：

- 前端显隐、禁用和 `permissions` 只是交互层控制，不能替代后端鉴权；
- 后端必须对退款、审批、删除等接口独立鉴权；
- Renderer 继续通过宿主应用 `requestInterceptor` 注入认证信息；
- 页面配置不得携带 token、用户身份声明或任意脚本；
- 危险动作应声明 `confirm`，但后端不能依赖前端确认作为安全保证。

## 被否决方案

### A. 让 `RowAction.key` 直接等于顶层 action id

否决。这样会破坏 v0.2.6 已明确的 `key` 本地分发语义，也会让既有 `key: view/refund/edit` 的本地 handler 与顶层 action id 混淆。

### B. 把 `$row` 表达式直接写进 action.url

否决。URL 模板会鼓励字符串拼接和表达式扩展，难以静态校验，也容易出现编码和注入问题。使用 `{param}` + `requestMapping.path` 可以让占位符、映射字段和编码规则都保持结构化。

### C. 让 RowAction 引用任意 action 类型

否决。`navigate`、`modal`、`custom` 的行级语义各不相同，过早合并会扩大 Renderer 复杂度。当前 ADR 只解决最高频、最需要统一的后端 request 动作。

## 合并清单

| # | 内容 | 目标文档 / 文件 |
|---|---|---|
| M1 | `RowAction` 新增 `actionRef` / `requestMapping` | `03-component-registry.md`、`schemas/component-registry.json` |
| M2 | `Action` 契约补充行级 request 绑定规则 | `07-actions-contract.md` |
| M3 | Renderer 规范补充 `actions.row.request` 能力与执行流程 | `08-renderer-spec.md` |
| M4 | L2 校验器检查能力声明、引用存在性、request action 类型、path 占位符和映射值 | `scripts/validate-l2-components.js` |
| M5 | 新增端到端场景示例 | `05-scenarios/row-backend-actions.md` |

## 后果

**正面：**

- 覆盖中后台最常见的行级后端操作；
- 保留本地 handler 逃生口，兼容既有实现；
- 请求映射结构化、可静态校验；
- 成功刷新、错误处理、认证注入复用既有协议。

**负面 / 取舍：**

- 暂不覆盖行级弹窗流程中的复杂表单提交；这类场景可用 `modal.content` + 表单 `submitAction` 表达，或后续 ADR 进一步标准化；
- 暂不支持批量行操作；批量选择、批量确认和批量错误回填需要单独设计；
- `requestMapping` 不支持表达式，复杂转换需要后端适配或前端预注册 handler。