---
status: stable
owner: 后端架构组
last_updated: 2026-07-08
applies_to: schema-ui-protocol v0.2
---

# 数据源 / API 契约规范

> 本文档面向后端开发者：只要接口按本文档的契约返回数据，
> 前端 Renderer 就能自动完成请求、分页、加载态、错误态处理，后端无需关心这些前端行为。

## 1. `datasources` 声明（页面级预声明）

```yaml
datasources:
  orderStats:
    source: api
    method: GET
    url: /api/stats/order-count
    params:
      range: 7d
```

Node 内通过 `data.source: ref` + `data.ref: orderStats` 引用，避免同一接口在多个节点中重复声明。完整使用示例见 [05-scenarios/grid-dashboard.md](./05-scenarios/grid-dashboard.md)。

## 2. 节点内直接声明（`data.source: api`）

```yaml
data:
  source: api
  method: GET
  url: /api/orders
```

## 3. 通用请求约定

前端 Renderer 会自动附加以下标准 query 参数，后端接口需要支持：

| 参数 | 说明 |
|---|---|
| `page` | 当前页码，从 1 开始 |
| `pageSize` | 每页条数 |
| `sort` | 排序字段，格式 `field:asc` / `field:desc` |

### 3.1 `data.params` / `optionsSource.params` 中 `$deps.*` 的空值省略规则

`data.params` 和 `select.optionsSource.params` 中引用的 `$deps.*` 值在运行时为 `null` 或 `undefined` 时，该参数**从最终请求的 query 中整体省略**（不传空字符串、不传字面量 `"null"`）。目的是让后端能明确区分"参数未提供"与"参数值为空字符串"两种不同语义：

```yaml
data:
  source: api
  url: /api/orders
  method: GET
  params:
    status: $deps.statusFilter
    # 当 statusFilter 为 null 时，实际请求为 GET /api/orders（不带 status 参数）
    # 而不是 GET /api/orders?status= 或 ?status=null
```

> 此规则对 `data.params`（`data.source: api` 通用场景）和 `select.optionsSource.params`（见 §8）统一适用。

### 3.2 `data.params` 中 `$deps.*` 的作用域边界

`data.params` 中的 `$deps.*` 引用**仅在表单上下文有效**，语义为「取当前表单中同名 `field` 的当前值」。非表单上下文（独立 `table`/`chart` 等节点的 `data.params`）中出现 `$deps.*` 时，Renderer 的静态校验应直接拒绝——与 `visibleWhen` 的非表单约束（[02-reaction-expression.md §10.1](./02-reaction-expression.md#101-deps-出现在非表单-visiblewhen-中)）保持一致。

| 上下文 | `$deps.*` 在 `data.params` 中 | 说明 |
|---|---|---|
| 表单内（`form` 子节点） | ✅ 允许 | 搜索表单字段值驱动 API 参数是核心使用场景 |
| 表单外（独立 `table`/`chart`） | ❌ 静态校验拒绝 | 无表单字段可依赖，`$deps.*` 永远是 `undefined`，属于配置错误 |

> **设计理由：** 不存在跨组件数据依赖的场景——如果未来需要「一个 `chart` 依赖另一个 `chart` 的筛选结果」，应通过独立的 ADR 设计专门的参数传递机制，而非复用表单字段的 `$deps` 语义。此处保持与 `visibleWhen`、`permissions.*` 一致的策略：在不该出现 `$deps` 的位置使用它就是错误，在解析阶段暴露优于静默忽略。

## 4. 响应体契约

### 4.1 列表类接口（配合 `table`/`select` 远程数据源）

```json
{
  "list": [ { "orderId": "1001", "amount": 99.5, "status": "PAID" } ],
  "total": 128
}
```

- `list`：当前页数据数组，字段名需与 Node 的 `columns[].field` / `valueField` 对应。
- `total`：总条数，用于前端计算总页数。

### 4.1.1 响应字段名映射 `responseMapping`（since 0.2.4）

若后端无法使用 `list` / `total` 作为响应体字段名（如遗留系统使用 `data` / `items` / `count`），可在 `data.responseMapping` 中声明字段名映射。`responseMapping` 与 `params` 同级，不属于请求参数，Renderer 不得将其发送给后端。

```yaml
data:
  source: api
  url: /api/orders
  method: GET
  responseMapping:
    list: result.records
    total: result.totalCount
```

映射值为响应 JSON 对象内的点路径字符串，不支持表达式、函数调用、数组过滤或模板语法。未声明 `responseMapping` 时，Renderer 按协议默认字段名解析：列表数据读取 `list`，服务端分页总数读取 `total`。

| 映射键 | 含义 | 是否必填 |
|---|---|---|
| `list` | 当前页数据数组 | 对列表类接口必填（未声明映射时默认读取响应体 `list`） |
| `total` | 总条数 | `table.props.pagination.mode: server` 时必填（未声明映射时默认读取响应体 `total`） |

若映射路径不存在，或映射结果类型不符合组件预期，Renderer 应将该节点视为数据加载失败并进入节点级错误态。详见 [08-renderer-spec.md §2.5](./08-renderer-spec.md#25-响应字段名映射-responsemappingsince-024) 与 [decisions/0005](./decisions/0005-response-mapping.md)。

### 4.2 单值类接口（配合 `statCard` / `text`）

```json
{ "total": 328 }
```

> **v0.2 变更（A3）：** 取值字段声明位置从 `data.valueField` 迁移至 `props.valueField`（`statCard`）/ `props.valueField`（`text`，见 A2），指定取哪个字段（如 `total`）作为展示值。

### 4.3 数组类接口（配合 `chart`）

```json
[
  { "date": "2026-07-01", "value": 120 },
  { "date": "2026-07-02", "value": 156 }
]
```

字段名需与 `chart.props.xField` / `yField` 对应。

## 5. 认证约定（since 0.2.5）

Renderer 发出的所有 API 请求均**不在协议层携带身份凭据**——认证由宿主应用层统一处理，Renderer 通过 HTTP 拦截器（axios interceptor、fetch wrapper 等）注入 `Authorization` header 或管理 Cookie，协议层不感知具体认证方案。

| 约定事项 | 说明 |
|---|---|
| 凭据注入方式 | 宿主应用在 Renderer 初始化时提供 `requestInterceptor` 钩子，统一注入 `Authorization: Bearer <token>` 或其他 scheme |
| Token 刷新 | Token 刷新逻辑由宿主应用层（非 Renderer）管理；Renderer 收到 `401` 后触发 `onAuthFailure` 钩子，由宿主应用决定重新刷新还是跳转登录 |
| 跨域凭据 | 是否携带 Cookie（`credentials: include`）由宿主初始化配置决定，协议默认 `credentials: same-origin` |
| 安全边界 | `$context.user.*` 仅用于前端渲染层的显隐判断，**不可替代后端鉴权**；后端必须对每个接口独立做身份校验，不能信任前端传来的任何身份声明 |

### 5.1 `401` / `403` 的处理规则

| 状态码 | 语义 | Renderer 行为 |
|---|---|---|
| `401 Unauthorized` | 未认证（token 缺失或已过期） | 触发 `onAuthFailure(401)` 钩子；节点进入错误态但**不展示具体错误文案**（避免泄露信息）；宿主应用负责跳转登录页或刷新 token |
| `403 Forbidden` | 已认证但无权限 | 触发 `onAuthFailure(403)` 钩子；节点渲染"无权限访问"占位；不跳转登录页 |

> **设计理由：** `401`/`403` 的后续动作（跳转 vs 占位）属于应用层业务决策，协议层只定义"触发钩子 + 节点进入错误态"，不规定跳转目标 URL，避免协议层与具体路由方案耦合。

## 6. 错误约定（since 0.2.5 更新）

### 6.1 HTTP 状态码与前端行为

| HTTP 状态码 | 前端行为 |
|---|---|
| `200` | 正常渲染 |
| `400` | 展示后端返回的 `message` 字段；若存在 `errors` 数组（字段级验证错误），Renderer 将错误回填到对应表单字段 |
| `401` | 见 §5.1：触发 `onAuthFailure(401)`，节点进入错误态 |
| `403` | 见 §5.1：触发 `onAuthFailure(403)`，节点渲染"无权限访问"占位 |
| `404` | 展示"资源不存在"占位（节点级，不影响其他节点） |
| 其他 `4xx` | 展示后端返回的 `message` 字段作为错误提示 |
| `5xx` | 展示统一的"系统异常，请稍后重试"文案，不透出后端错误细节 |

### 6.2 通用错误响应体结构

所有非 `2xx` 响应均应返回以下结构：

```json
{
  "code": "ORDER_NOT_FOUND",
  "message": "订单不存在"
}
```

> **`code` 字段说明：** `code` 字段目前**仅用于调试日志和错误追踪**，前端 Renderer 不会据此做程序化判断（如跳转登录页、显示特定 UI）——此类逻辑属于应用层业务逻辑，不应由协议层的 Renderer 处理。后端仍应返回有业务意义的 `code` 值以便排查问题；若后续需要前端据此做程序化处理，建议通过场景 ADR 另行约定。

### 6.3 字段级验证错误（`400` + `errors`）

当请求参数未通过后端校验时（如表单提交），后端应在 `errors` 数组中返回字段级错误，供 Renderer 回填到对应表单字段下方展示：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数校验失败",
  "errors": [
    { "field": "email", "message": "邮箱格式不正确" },
    { "field": "phone", "message": "手机号不能为空" }
  ]
}
```

- `errors[].field`：对应表单字段的 `props.field` 值（路径分隔符为 `.`，如 `address.city`）。
- `errors[].message`：展示在该字段下方的错误文案。
- `errors` 不存在时，`message` 以全局 toast 形式展示。
- `errors` 存在时，Renderer 将每条错误回填到对应字段，并将全局 `message` 以 toast 形式展示（若 `message` 非空）。

> **后端推荐实践：** 同一字段若有多条校验错误，每条错误对应独立的数组项（同 `field` 可重复）；Renderer 只展示第一条，多余的输出到控制台日志。

### 6.4 网络超时与中断

| 情形 | Renderer 行为 |
|---|---|
| 请求超时（> `requestTimeout` 配置，默认 10s） | 节点进入错误态，展示"请求超时，请稍后重试"，支持重试 |
| 网络中断（`fetch` 抛出 `TypeError: Failed to fetch`） | 节点进入错误态，展示"网络异常，请检查网络连接"，支持重试 |
| 用户主动离开页面导致请求被中断（`AbortError`） | 静默处理，不进入错误态，不输出日志 |

## 7. 分页模式说明（对应 `table.props.pagination.mode`）

| 模式 | 后端行为 |
|---|---|
| `server` | 后端必须支持 `page`/`pageSize` 参数并返回 `total` |
| `client` | 后端一次性返回全量 `list`，前端本地分页，无需支持分页参数 |
| `none` | 不分页，直接展示 `list` 全部内容 |

## 8. 静态数据（`data.source: static`）

用于无需请求接口、由后端直接内嵌少量数据的场景（如下拉选项的固定值）：

```yaml
data:
  source: static
  value:
    - { label: 零售, value: retail }
    - { label: 批发, value: wholesale }
```

## 9. `select.optionsSource` 远程动态选项契约（since 0.2，B7）

配合 `select` 组件的 `props.optionsSource`（见 [03-component-registry.md](./03-component-registry.md)）使用。

**请求：** `GET <optionsSource.url>?<params>`，`params` 中的值可引用 `$deps.*`（表单内其他字段的当前值）。

**空值省略规则（关键约定）：** 当 `params` 中某个值引用的 `$deps.*` 在运行时为 `null` 或 `undefined` 时，该参数**从最终请求的 query 中整体省略**，不传空字符串、不传字面量 `"null"`。这与 `table`/`chart` 等其他场景下 `$deps` 参数的处理方式保持统一，目的是让后端能明确区分"参数未提供"与"参数值为空字符串"两种不同语义。

```yaml
# 前端字段 provinceId 尚未选择（值为 null）时：
# 实际请求为 GET /api/options/cities（不带 provinceId 参数）
# 而不是 GET /api/options/cities?provinceId= 或 ?provinceId=null
```

**响应体：** 返回裸数组（无需 `list`/`total` 包装），每项至少包含 `optionsSource.labelField` 与 `optionsSource.valueField` 指定的两个字段：

```json
[
  { "id": 1, "name": "广东省" },
  { "id": 2, "name": "浙江省" }
]
```

若 `searchable: true`，前端会额外附加标准查询参数 `keyword`，后端需支持按该参数做模糊搜索。
