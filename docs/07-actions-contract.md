---
status: stable
owner: 前端架构组
last_updated: 2026-07-23
applies_to: schema-ui-protocol v2.3
---

# Action 完整契约（since 0.2）

> 本文档定义顶层 `actions` 中每个动作的完整结构。机器可读版本见
> [`schemas/action.schema.json`](./schemas/action.schema.json)。

## 1. 使用位置

顶层文档结构中的 `actions` 字段（详见 [01-node-protocol.md §2](./01-node-protocol.md#2-顶层文档结构)），
供 `form.props.submitAction`、`upload.props.actionRef`、`table.props.actions[].actionRef`、`table.props.toolbar[].actionRef`、`actionButton.props.actionRef` 等按 id 引用。

> **说明：** `table.props.actions[].key` 与 ActionTrigger/`actionButton` 的 `key` 是入口本地标识，不引用顶层 `actions`。行级 request 见 [ADR-0008](./decisions/0008-row-action-backend-request.md) / §3.1；行级 navigate 见 [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) / §3.2；页面级入口见 [ADR-0020](./decisions/0020-page-action-trigger.md)。

```yaml
actions:
  createOrder:
    type: request
    method: POST
    url: /api/orders
```

## 2. `type` 枚举

| type | 含义 |
|---|---|
| `request` | 发起一次 HTTP 请求 |
| `navigate` | 跳转到指定地址 |
| `modal` | 打开前端预注册的弹窗 |
| `upload` | 发起文件上传请求（`multipart/form-data`） |
| `custom` | 调用前端白名单预注册的处理函数（**不接受任意代码/表达式**，仅传函数名引用） |

`custom` 类型的边界与联动表达式引擎的原则一致（见 [02-reaction-expression.md](./02-reaction-expression.md)）：
协议只传递"意图声明"，具体实现始终由前端代码掌控，避免后端配置里出现"类代码"内容。

## 3. `request` 类型完整字段

```yaml
type: request
method: GET | POST | PUT | DELETE | PATCH
url: string                  # baseURL 下的单斜杠相对路径
bodyMapping:            # 【可选】表单字段名 → 请求体字段名的映射
  customerName: name
retryPolicy: never | idempotent # 【可选，默认 never】逻辑调用的重试策略
onSuccess: OutcomeBehavior   # 【可选】
onError: OutcomeBehavior     # 【可选】
```

- `bodyMapping` 缺省时，提交投影中的字段按原字段名组成请求体；一旦声明 mapping，只能映射投影中存在的字段。提交投影默认包含已 mounted、visible、非 disabled 且 uploadStatus 不是 `error` 的字段；hidden、disabled、unmounted 和上传失败字段不参与 required 校验或请求体。同一 form 的字段名必须唯一，`bodyMapping` 的目标字段名也必须唯一；L2 在页面 Node 树中静态校验这两个命名空间。`bodyMapping` 缺省时，表单各字段按原字段名直接组成请求体 JSON；一旦声明（包括空对象），它就是请求体字段白名单，只发送明确列出的源字段，未列字段不发送。运行时若映射 source 在提交 form 中不存在，或其值为 `undefined`，整个 Action 必须失败且不得发出部分请求。值必须为字符串，不允许嵌套对象、数组或数字。

假设表单值为 `{ customerName: "A", orderType: "normal", remark: "..." }`：

| `bodyMapping` | 请求体 |
|---|---|
| 缺省 | `{ "customerName": "A", "orderType": "normal", "remark": "..." }` |
| `{ customerName: name }` | `{ "name": "A" }` |
| `{ customerName: name, orderType: type }` | `{ "name": "A", "type": "normal" }` |
| `{}` | `{}` |

- 普通表单通过 `form.props.submitAction` 提交字段时不得引用 `method: GET` 的 request；浏览器请求不能为 GET 携带该 JSON 请求体。v0.2 不为普通表单定义隐式 query 映射，请使用 `POST` / `PUT` / `PATCH` / `DELETE`。该限制不影响行级 Action 使用 `requestMapping.query` 构造 GET 请求。
- `retryPolicy` 缺省为 `never`。`never` 表示 Renderer 不自动重发同一逻辑调用；超时或网络中断的结果为 `unknown`，用户重新提交会创建新的逻辑调用。`idempotent` 表示 Renderer 为一次逻辑调用生成一个不透明的 invocation id，并在所有重试中发送相同的 `Idempotency-Key` 请求头；后端必须按 Action、方法、目标 URL 和该 key 去重并复用最终结果。
- `retryPolicy: idempotent` 不允许配置静态 key。invocation id 由 Renderer 在一次用户触发时生成，不能跨逻辑调用复用；conformance harness 使用 `input.invocationId` 表示该运行时值。
- `onSuccess` / `onError` 缺省时，Renderer 使用默认行为（如 `toast` 展示通用成功/失败提示）。

### 3.1 行级后端请求绑定（since 0.2.7）

表格行内按钮若需要直接调用后端接口，应在 `RowAction` 上声明 `actionRef`，引用顶层 `type: request` action，并通过 `requestMapping` 绑定当前行数据。使用该能力时，页面必须声明 `meta.requiredCapabilities: [actions.row.request]`。

```yaml
meta:
  pageId: order_approval
  title: 订单审批
  protocolVersion: "2.0"
  requiredCapabilities:
    - actions.row.request

actions:
  approveOrder:
    type: request
    method: POST
    url: /api/orders/{orderId}/approve
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 审批失败，请重试

body:
  type: table
  props:
    rowKey: orderId
    pagination:
      mode: server
    columns:
      - field: orderId
        label: 订单号
    actions:
      - key: approve
        label: 通过
        confirm: 确认审批通过？
        actionRef: approveOrder
        requestMapping:
          path:
            orderId: $row.orderId
```

`requestMapping` 属于 `RowAction`，不属于顶层 `ActionDef`。它描述“当前行如何绑定到这次请求”：

| 字段 | 说明 |
|---|---|
| `path` | 扁平 key-value map，替换 `action.url` 中的 `{name}` 占位符 |
| `query` | 非空 key 的扁平 map，生成 URL query 参数；使用 ADR-0010 公共字节级序列化算法 |
| `body` | 扁平 key-value map，生成 JSON 请求体 |

映射值只允许字面量或单个行上下文点路径：

```yaml
requestMapping:
  path:
    orderId: $row.orderId
  query:
    source: list
  body:
    status: APPROVED
    version: $row.version
```

规则：

- `actionRef` 只能引用顶层 `actions` 中的 `type: request` action。
- `action.url` 中的路径占位符只允许完整 `{name}` 形式，其中 name 匹配 `[A-Za-z_][A-Za-z0-9_]*`；空、数字开头、连字符、嵌套、孤立或未闭合花括号均非法。每个合法 `{name}` 都必须在 `requestMapping.path.<name>` 中声明。
- `requestMapping.path` 不得声明 URL 中不存在的 key。
- `requestMapping` key 必须非空，值只允许 string / finite number / boolean / null 或单个 `$row.*` 点路径。字符串中**任意位置**出现 `$` 时，整段必须是合法 `$row.*` 引用（L2 精确匹配）；拒绝 `$parentRow.*`、模板拼接（如 `prefix-$row.id`）以及字面量中夹带 `$` 的值。v0.2 静态拒绝嵌套表格及 `$parentRow.*`，也不允许 `$deps.*`、`$context.*`、表达式或函数。
- `requestMapping.path` / `query` / `body` 不支持嵌套对象或数组值；需要复杂结构时应由后端适配，或使用前端预注册 handler。
- `requestMapping.query` 的已有 URL 合并、重复 key、空值删除、排序和百分号编码统一遵循 [ADR-0010](./decisions/0010-query-serialization.md)，不得使用调用框架的默认 query encoder。
- `GET` / `DELETE` 行级请求不得声明 `requestMapping.body`；请使用 `path` 或 `query` 传递当前行标识。
- `confirm` 保留在 `RowAction` 层声明，因为确认文案属于按钮触发入口，而不是后端请求定义。

Renderer 执行时先判定 `visibleWhen` / `permissions` / `disabled` 等状态；按钮可点击后再展示 `confirm`，确认通过后构造请求。`onSuccess.behavior: reload` 表示重新加载触发该动作的表格数据。

### 3.2 行级导航绑定（since 2.1 / ADR-0021）

`RowAction.actionRef` 可引用顶层 `type: navigate` action，并通过 `navigateMapping` 绑定当前行到目标 URL。使用时页面必须声明 `meta.requiredCapabilities: [actions.row.navigate]`。

```yaml
actions:
  openEdit:
    type: navigate
    url: /orders/edit

# table.props.actions:
- key: edit
  label: 编辑
  actionRef: openEdit
  navigateMapping:
    query:
      orderId: $row.orderId
```

规则：

- 不得与 `requestMapping` 同时出现；
- 仅 `path` / `query`（无 `body`）；值纪律与 §3.1 的 `$row.*` / 字面量规则相同；
- `path` 与 url `{name}` 占位符双向对齐；query 序列化遵循 ADR-0010；
- path 映射结果为 `null`/`undefined` 时拒绝导航；
- **运行时路径应用 fail-closed（审计 0062 / V267）：** 有效 URL 占位符集合与 `path` mapping 键集合必须完全相等；缺失键返回 `MISSING_PATH_BINDING`，多余键返回 `EXTRA_PATH_BINDING`，不得保留未解析的 `{name}` 片段继续导航或发请求。该规则同样适用于行级 `requestMapping.path`、`recordSource.path` 与 `batchMapping.path`；
- 执行序：可见可点 → confirm → 解析 mapping → 宿主导航到最终相对 URL。

### 3.3 页面级 ActionTrigger（since 2.1 / ADR-0020）

`actionButton` 与 `table.props.toolbar[]` 通过 `actionRef` 引用顶层 `request` | `navigate` | `modal`（禁止 `upload`/`custom`）。使用时声明 `actions.page.trigger`。

- 无行上下文，无 Trigger 级 `requestMapping`；
- 引用 `request` 时 method 仅 `POST`/`PUT`/`PATCH`/`DELETE`（禁止 GET）；url 不得含未绑定 `{name}` 模板；**MVP 请求 body 恒为 `null`**（不跑 form 投影、不读 Action `bodyMapping`；RequestAction **无**静态 body 字段；审计 0064 / V286）；
- 引用 `navigate` 时 url 为静态相对路径（不得含未绑定 `{name}`；L2 与 request 对称拒绝，V283）；引用 `modal` 时至少提供 `modalId` 或 `content`；
- toolbar Trigger 的 `visibleWhen` / `permissions` 仅允许 `$context.*`（L3a 遍历 `table.props.toolbar[]`，见审计 0062 / V268）；
- 执行序与行级类似：`visibleWhen` → effective/local permissions → `disabled`（并与 `requiresSelection` OR 合成）→ confirm → 执行 Action → OutcomeBehavior。`confirm` 为非空字符串时，用户取消必须取消后续 request/navigate/modal，不得部分执行（conformance：`CONFIRM_REJECTED`）。

### 3.3.1 权限继承与操作入口（since 2.3 / ADR-0023）

当入口声明 `permissionIntent: edit | delete` 时，Renderer 对该键使用 [01 §3.9.1](./01-node-protocol.md) 的祖先 cascade AND 与入口本地 `permissions`；RowAction、`table.props.toolbar[]` 和 `actionButton.props` 是唯一允许的挂载点。未声明 intent 的入口仍只适用它本地既有 `permissions`，不得从 `key`、`actionRef`、HTTP method、URL 或文案猜测意图。`table.props.columns[]` 从不参与此计算。

default form 的 `submitAction` 是隐式 `edit` 入口，不写 `permissionIntent`；search form 没有该入口。所有四类可操作入口必须在 **构造 confirm、request、navigate、modal 或 submit 前** 按下列顺序 fail-closed：

1. 计算 `visibleWhen`；
2. 计算 effective permission（参与 cascade）或既有本地 permission（其余目标）；
3. 合成静态 `disabled` 与 `requiresSelection`；
4. 任一条件拒绝时停止，不展示 confirm，也不构造或发送动作；
5. 仅在通过前四步后展示 confirm，并在确认后执行动作。

### 3.4 表单记录加载（since 2.1 / ADR-0021）

编辑表单通过 `form.props.recordSource` 在挂载时 GET 记录并回填，见 [03-component-registry.md](./03-component-registry.md) 与 [ADR-0021](./decisions/0021-record-navigation-and-form-load.md)。提交仍使用本节 `request` + `bodyMapping` 与表单提交投影，不经 `recordSource`。

### 3.5 批量请求绑定（since 2.2 / ADR-0022）

`table.props.toolbar[]` 上的 ActionTrigger 可声明 `batchMapping`，将**当前页选中键**绑定到 `type: request` action。使用时声明 `actions.batch.request`（及通常的 `table.selection` + `actions.page.trigger`）。

```yaml
batchMapping:
  body:
    orderIds: $selection.keys   # 仅 body 整值
  query:
    count: $selection.count     # 可选标量
```

规则摘要：

- 选中数为 0 时不发请求；`requiresSelection: true` 时按钮 disabled。  
- **声明 `batchMapping` 的 toolbar Trigger 要求同一 table 配置 `props.selection.mode: multiple`（L2 / V269）**；`requiresSelection: true` 仍为可选 UX 字段（运行时 `EMPTY_SELECTION` 仍拒绝 count===0）。  
- `$selection.keys` **仅 body**；path 仅字面量，且与 url `{name}` 双向对齐（运行时同 V267）。  
- method：POST/PUT/PATCH/DELETE（含 DELETE+body）；禁止 GET。  
- 一次点击 = 一次 HTTP；成功 `reload` 清空选中。  
- 筛选/翻页/排序/reload 清空选中（ADR-0022 D2）。  
- 选中键仅 string / finite number / boolean；去重保序；`count === keys.length`（V271）。  
- **batch 构造入口**对 selection 再执行同一规范化并重算 `count`（V274 / V281）；规范化后为空 → `EMPTY_SELECTION`。

完整规则见 [ADR-0022](./decisions/0022-table-selection-and-batch-request.md)。

## 4. `navigate` 类型

```yaml
type: navigate
url: string
```

## 5. `modal` 类型

```yaml
type: modal
modalId: string   # 【可选】引用前端预注册的弹窗模板（尺寸/位置/关闭行为）
content: Node     # 【可选】直接描述弹窗内容（since 0.2.1），见下方说明
```

### 5.1 `content` 与 `modalId` 的关系

- `modalId` 提供弹窗的**模板属性**（尺寸、位置、关闭行为、动画等），可引用前端预注册的弹窗模板。
- `content`（since 0.2.1）提供弹窗的**内容**（一个完整的 Node，如 `form`/`text`/`table` 等），使弹窗内容不再依赖前端硬编码。
- `modalId` 和 `content` **可共存**——`modalId` 控制弹窗壳子，`content` 控制弹窗内容。
- 二者至少提供一个。若只提供 `content` 而不提供 `modalId`，Renderer 使用默认弹窗模板（居中、可关闭）。

```yaml
# 示例：弹窗内容 Node 化
confirmRefund:
  type: modal
  modalId: medium-dialog          # 可选，引用预注册的"中等尺寸弹窗"模板
  content:
    type: form
    props:
      title: 确认退款
      submitAction: doRefund
    children:
      - type: text
        props:
          content: 确认对该订单发起退款？
      - type: input
        props:
          field: reason
          label: 退款原因
          placeholder: 请输入退款原因
```

## 6. `custom` 类型

```yaml
type: custom
handler: string   # 仅允许引用前端白名单预注册的处理函数名
```

前端必须维护一份白名单，`handler` 值若不在白名单中，Renderer 应拒绝执行并报错。

## 7. `upload` 类型（since 0.2.5）

用于定义可复用的文件上传行为。`upload` 组件若需要复用顶层 action，应通过 `props.actionRef` 引用该 action；使用该能力时页面必须声明 `meta.requiredCapabilities: [actions.upload]`。既有 `props.action` 字段仍表示上传接口 URL，不作为 action id 解析。

```yaml
type: upload
url: string                    # 上传接口地址（单斜杠相对路径，Renderer 自动拼接 baseURL）
method: POST | PUT             # 默认 POST
retryPolicy: never | idempotent # 【可选，默认 never】每个文件逻辑调用的重试策略
fieldName: string              # 【可选】multipart 中的文件字段名，默认 "file"
accept: string                 # 【可选】允许的 MIME 类型或扩展名，如 "image/*" 或 ".pdf,.docx"
maxSize: number                # 【可选】单文件大小上限，单位字节，默认不限制
multiple: boolean              # 【可选】是否允许多文件，默认 false
onSuccess: OutcomeBehavior     # 【可选】上传成功后的行为
onError: OutcomeBehavior       # 【可选】上传失败后的行为
```

### 7.1 上传请求格式

Renderer 以 `multipart/form-data` 方式发送请求，文件字段名由 `fieldName` 指定（默认 `file`）。宿主应用注入的认证 header（见 [04-datasource-contract.md §5](./04-datasource-contract.md#5-认证约定since-025)）同样适用于上传请求。

每个文件对应一个 multipart 请求；`multiple: true` 时按选择顺序逐文件串行上传。任一文件失败则停止后续请求，当前批次不提交部分字段值；全部成功后才一次性提交按选择顺序排列的字符串数组并执行一次 `onSuccess`。完整约束、`accept` 匹配和失败原子性见 [ADR-0012](./decisions/0012-upload-execution.md)。

### 7.2 上传响应体契约

后端上传接口应返回 `200` + 以下结构，Renderer 将 `url`（或 `id`）写入对应表单字段的值：

```json
{
  "url": "https://cdn.example.com/files/abc123.pdf",
  "id": "abc123",
  "name": "合同文件.pdf",
  "size": 204800
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | 与 `id` 至少一个 | 文件访问地址（CDN 或 OSS 直链） |
| `id` | string | 与 `url` 至少一个 | 文件在后端存储系统中的 ID |
| `name` | string | 否 | 原始文件名（用于 UI 展示） |
| `size` | number | 否 | 文件大小（字节），用于校验展示 |

若表单字段使用 `upload` 组件（见 [03-component-registry.md](./03-component-registry.md)），并通过 `props.actionRef` 引用本 action，上传完成后字段值默认取 `url`（若存在），否则取 `id`。`multiple: true` 时字段值为数组。

`url` / `id` 必须是非空 string；两者同时存在时固定优先取 `url`。多文件数组顺序与用户选择顺序一致，不按请求完成顺序重排。

使用 `props.actionRef` 时，`accept` / `maxSize` / `multiple` 以本 UploadAction 为唯一来源，upload 组件 props 不得重复声明这三项；L2 对重复配置静态拒绝。使用组件 `props.action` 直接 URL 时，这三项仍由组件 props 控制。

### 7.3 错误处理

上传失败时，后端应返回标准错误响应体（见 [04-datasource-contract.md §6.2](./04-datasource-contract.md#62-通用错误响应体结构)）。常见的语义化 `code` 值供参考（不强制）：

| code | 建议语义 |
|---|---|
| `FILE_TOO_LARGE` | 文件超过服务端大小限制 |
| `UNSUPPORTED_FILE_TYPE` | 文件类型不被允许 |
| `STORAGE_UNAVAILABLE` | 存储服务暂时不可用 |

> **注意：** `accept`/`maxSize` 的客户端校验由 `upload` 组件在选择文件时完成（前端拦截）；服务端仍应独立做文件类型和大小校验，不依赖前端声明。

当组件使用 `actionRef` 时，“由 upload 组件完成”指组件 UI 执行客户端拦截，约束值读取自被引用的 UploadAction，而不是组件上的重复 props。

## 8. `OutcomeBehavior`（`onSuccess` / `onError` 通用结构）

```yaml
onSuccess:
  behavior: toast | navigate | reload | closeModal
  message: string     # behavior: toast 时的提示文案
  url: string          # behavior: navigate 时的 baseURL 下单斜杠相对目标地址
```

| behavior | 含义 | 必填附加字段 |
|---|---|---|
| `toast` | 展示轻提示 | `message` |
| `navigate` | 跳转到 baseURL 下的单斜杠相对地址 | `url` |
| `reload` | 重新加载当前数据（如刷新表格） | — |
| `closeModal` | 关闭当前弹窗 | — |

不允许出现协议未列出的行为类型或任意脚本回调。

### 8.1 `onError` 与标准 HTTP 错误处理顺序

Action 请求失败时，Renderer 先执行 [04-datasource-contract.md §5-§6](./04-datasource-contract.md#5-认证约定since-025) 的协议级状态处理，再执行不冲突的 `onError`：

- `401` / `403`：触发 `onAuthFailure` 并进入规定错误态，忽略 Action `onError` 和任何 `states.error.fallbackText`；401 不展示具体文案，403 使用固定无权限占位。
- `400` 且存在 `errors`：始终回填字段错误；忽略 `navigate` / `reload` / `closeModal`，保留用户修正入口。若 `onError.behavior: toast`，只展示配置的 toast message；否则展示响应 `message`，避免双重 toast。
- `400` 无字段错误、`404`、其他 `4xx`、`5xx` 及网络错误：先确定协议规定的安全错误信息，再执行 `onError`。若 `onError.behavior: toast`，配置 message 替代默认/响应 message；其他行为在错误状态记录完成后执行。超时和网络错误的 Action 结果为 `unknown`，不得当作“服务端未提交”处理。
- `onError` 缺省时，仅执行标准 HTTP 错误处理。

## 9. 完整示例

```yaml
actions:
  createOrder:
    type: request
    method: POST
    url: /api/orders
    bodyMapping:
      customerName: name
    onSuccess:
      behavior: toast
      message: 创建成功
    onError:
      behavior: toast
      message: 创建失败，请重试

  goToOrderList:
    type: navigate
    url: /orders

  confirmRefund:
    type: modal
    modalId: refund-confirm-dialog
```

完整表单联动场景见 [05-scenarios/form-with-reactions.md](./05-scenarios/form-with-reactions.md)。
