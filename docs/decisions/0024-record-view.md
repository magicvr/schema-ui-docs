---
status: accepted
date: 2026-07-24
applies_to: schema-ui-protocol v2.4
track: docs/11-next-admin-lifecycle-goals.md Phase D / P2 (recordView only)
---

# ADR-0024: 标准只读详情组件（recordView）

## 状态

**Accepted（已接受，随 v2.4.0 发布）。** 字段与执行语义以本 ADR 及 `02` / `03` / `08` / Schema / L2 为准。使用时声明 `meta.protocolVersion: "2.4"` 与 `record.view.load`。

轨道依据：[11-next-admin-lifecycle-goals.md](../11-next-admin-lifecycle-goals.md)、[ADR-0019](./0019-v2-admin-scope.md)、[ADR-0021](./0021-record-navigation-and-form-load.md)。

## 背景

列表表格通常只展示部分列；业务高频需要「列表 → 只读详情」查阅完整记录。v2.1 已具备：

- 行级 `navigate` + `navigateMapping`（`actions.row.navigate`）；
- `$context.route` 路由快照；
- `form.recordSource` GET 加载 + 显式 `responseMapping`（`form.record.load`）。

但 **详情页** 与 **编辑表单** 语义不同：无 `submitAction`、无可写字段、展示模型是「标签 + 值」字段表而非控件树。ADR-0021 允许用 `text` / 禁用 form **凑合**，并明确 **不** 引入 `recordView`（P2）。

若继续仅用 Host 私有详情组件，多 Renderer / 多页面生产方无法对「标准只读详情」互操作。

## 业务锚点（MVP）

| 锚点 | 用户路径 | 协议落点 |
|---|---|---|
| D. 列表行「详情」 | 列表行 → 带 id 的详情页 | 既有 `actions.row.navigate` + 本 ADR `recordView` |
| E. 详情加载展示 | 详情页 GET 记录 → 按字段表只读展示 | `recordView.props.recordSource` + `fields[]` |

验收叙事：同一订单域下，列表页可声明「详情」行导航，详情页单页 YAML 用 `recordView` 加载并展示；无需 Host 私有详情组件，也无需把编辑 form 伪装成只读。

## 决策

### D1. 新组件类型 `recordView` + capability `record.view.load`

| 项 | 值 |
|---|---|
| `type` | `recordView` |
| capability | `record.view.load` |
| `protocolVersion` 下限 | `"2.4"`（L2 字段集下限；仅有 capability 不够） |

使用该组件时页面必须声明 `meta.requiredCapabilities` 含 `record.view.load`，且 `meta.protocolVersion >= "2.4"`。

**不** 复用 `form.record.load`：详情与编辑回填是不同执行能力；只实现编辑加载的 Renderer 不得被强制实现详情组件，反之亦然。两者可共享 GET / path 绑定 / `responseMapping` **算法**。

### D2. `recordSource` 与 form 同构

`recordView.props.recordSource` 形状与语义对齐 [ADR-0021](./0021-record-navigation-and-form-load.md) D4：

```yaml
recordSource:
  method: GET                 # 必填，仅 GET
  url: /api/orders/{orderId}  # 协议相对路径；可含 {name}
  path:
    orderId: $context.route.query.orderId
  query: {}                   # 可选
  responseMapping:            # 必填非空；展示键 → 响应点路径
    orderId: orderId
    customerName: customer.name
    status: status
    amount: amount
```

规则：

- 不得 `ref` / `source` 引用 `datasources`；
- path/query 值仅允许字面量或单个 `$context.route.query.*` / `$context.route.params.*`；
- path 键集与 url `{name}` 双向对齐；
- 成功映射：缺失响应路径 → 该键可观测 `null`，**不**中止整次填充（与 formRecord 一致）；
- 加载生命周期：挂载触发一次 GET；loading / error 走 Node `states`；401/403 全局认证边界不变；
- **无** submit、无 dirty、无 reactions baseline 重置要求（无表单字段）。

### D3. `fields[]` 只读字段表

```yaml
fields:
  - key: orderId            # 必填；必须是 responseMapping 的键
    label: 订单号           # 与 labelKey 至少一个
    format: plain           # 可选：plain | currency | datetime | tag（默认 plain）
  - key: status
    label: 状态
    format: tag
    tagMap:
      paid: { text: 已支付, tone: success }
      pending: { text: 待支付, tone: warning }
  - key: amount
    label: 金额
    format: currency
```

| 约束 | 说明 |
|---|---|
| `fields` | 必填数组，至少一项 |
| `key` | 非空；在 `fields[]` 内唯一；**必须**出现在 `responseMapping` |
| `label` / `labelKey` | 至少一个 |
| `format` | 可选；`tag` 时 `tagMap` 必填；非 `tag` 时禁止 `tagMap` |
| `responseMapping` 多余键 | 允许（可不展示）；展示值取映射结果中的 `fields[].key` |

`format` / `tagMap` 的呈现语义对齐 table 列：类型不匹配时节点可降级为 plain 字符串展示或节点错误态（与 table/statCard 既有 fail-closed 习惯一致）；conformance 对映射结果以 `values` 为准，format 属呈现层。

### D4. 组件能力边界

| 能力 | 值 |
|---|---|
| `supportsChildren` | **否** |
| `supportsData` | **否**（加载走 `recordSource`，不是 DataRef） |
| `supportsReactions` | **否** |
| `supportsStates` | **是**（loading / error / empty 可选） |
| 权限 | 仅 Node 本地 `permissions`（如 `visible`）；**不是** ADR-0023 cascade 容器，也不参与 form `edit` 目标 |
| 操作按钮 | MVP **不** 内嵌 toolbar；「返回列表 / 去编辑」用同页 `actionButton` 或布局兄弟节点（须既有 page.trigger） |

### D5. `$context.route` 绑定位置扩展

在 [02 §11.3](../02-reaction-expression.md#113-contextroute-最小字段集since-21--adr-0021) 中，将允许的整值绑定从「仅 `form.props.recordSource`」扩展为：

- `form.props.recordSource.path|query`
- `recordView.props.recordSource.path|query`

仍禁止出现在 `reactions` / `visibleWhen` / `permissions`（L3a `FORBIDDEN_CONTEXT_NAMESPACE`）。

### D6. 与既有能力的关系

| 既有 | 关系 |
|---|---|
| `actions.row.navigate` | 列表进详情仍用行级 navigate；本 ADR 不新增导航字段 |
| `form.record.load` | 编辑页继续用 form；详情页用 `recordView`，**不要** 用禁用 form 伪装详情作为跨实现正例 |
| DataRef | 详情主数据 **必须** `recordSource`；同页其他卡片仍可用 DataRef |
| `permissions.inheritance` | 无交叉；`recordView` 不进 cascade 白名单 |

### D7. 明确非目标（本 ADR / v2.4 不做）

- 行内编辑、可编辑详情、详情内嵌 form；
- 导入导出、异步任务、树表、可展开行；
- 跨页全选、批量部分成功；
- `recordView` 内嵌 toolbar / 行级 actions 数组；
- `recordSource` 引用页面 `datasources` ref；
- 自动「返回列表」或自动「编辑」按钮生成；
- 嵌套子记录 / 子表 `$parentRow`；
- 将 `recordView` 回写成 v2.3「已支持」。

上述能力可在后续 Phase D 单项 ADR 中立项。

## 端到端 MVP 示意（非规范示例）

```yaml
# ----- 列表页（既有 2.1+ 能力）-----
meta:
  pageId: order_list_with_detail
  protocolVersion: "2.4"
  requiredCapabilities:
    - actions.row.navigate

actions:
  openDetail:
    type: navigate
    url: /orders/detail

body:
  type: table
  id: orderTable
  props:
    rowKey: orderId
    pagination: { mode: server, pageSize: 20 }
    columns:
      - { field: orderId, label: 订单号 }
      - { field: customerName, label: 客户 }
    actions:
      - key: detail
        label: 详情
        actionRef: openDetail
        navigateMapping:
          query:
            orderId: $row.orderId
  data:
    source: api
    url: /api/orders
    method: GET
    responseMapping: { list: data.list, total: data.total }

# ----- 详情页 -----
meta:
  pageId: order_detail
  protocolVersion: "2.4"
  requiredCapabilities:
    - record.view.load
    - actions.page.trigger   # 可选：返回/编辑按钮

actions:
  backToList:
    type: navigate
    url: /orders
  openEdit:
    type: navigate
    url: /orders/edit

body:
  type: section
  props:
    title: 订单详情
  children:
    - type: actionButton
      props:
        key: back
        label: 返回列表
        actionRef: backToList
    - type: actionButton
      props:
        key: edit
        label: 编辑
        actionRef: openEdit
      # Host 可在 url 上带同源 query；MVP 示例省略 navigate 模板，生产页用静态 url + 宿主补 query 或另开扩展
    - type: recordView
      props:
        title: 基本信息
        recordSource:
          method: GET
          url: /api/orders/{orderId}
          path:
            orderId: $context.route.query.orderId
          responseMapping:
            orderId: orderId
            customerName: customer.name
            status: status
            amount: amount
        fields:
          - { key: orderId, label: 订单号 }
          - { key: customerName, label: 客户 }
          - key: status
            label: 状态
            format: tag
            tagMap:
              paid: { text: 已支付, tone: success }
              pending: { text: 待支付, tone: warning }
          - { key: amount, label: 金额, format: currency }
```

> 注：`actionButton` 打开编辑页若需把 `orderId` 写入目标 URL，页面级 Trigger 的 path 绑定规则以 ADR-0020 为准；MVP 详情组件本身不负责该映射。

## 失败策略（fail-closed）

| 条件 | 错误 / 行为 |
|---|---|
| 缺 `record.view.load` | 版本协商 `MISSING_REQUIRED_CAPABILITY` |
| `protocolVersion < "2.4"` 却使用 `recordView` | L2 `PROTOCOL_VERSION_TOO_LOW` |
| `recordSource.method` 缺失 / 非 GET | `MISSING_RECORD_SOURCE_METHOD` / `RECORD_SOURCE_METHOD_NOT_GET` |
| 空或非法 `responseMapping` | 结构拒绝 / `INVALID_RESPONSE_MAPPING` |
| `fields` 空、key 重复、key 不在 mapping | L2 拒绝 |
| `format: tag` 无 `tagMap` | L2 拒绝 |
| path 占位与 binding 不一致 | 既有 path 绑定错误码 |
| HTTP 失败 | 节点 error 态；不渲染字段值 |

## 后果

- 标准 Renderer 可对「列表列不全 → 详情查阅」给出跨实现一致的声明式配置。
- v2.3 及更早页面行为不变；opt-in 双重门控（版本 + capability）。
- Phase D 其余运营增强（导入导出、异步任务、树表、行内编辑、跨页全选等）**仍待独立 ADR**，见轨道文档。

## 开放问题

无。MVP 范围与非目标已闭合。
