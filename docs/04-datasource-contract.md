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

## 5. 错误约定

| HTTP 状态码 | 前端行为 |
|---|---|
| `200` | 正常渲染 |
| `4xx` | 展示后端返回的 `message` 字段作为错误提示 |
| `5xx` | 展示统一的"系统异常，请稍后重试"文案，不透出后端错误细节 |

错误响应体统一约定：

```json
{ "code": "ORDER_NOT_FOUND", "message": "订单不存在" }
```

> **`code` 字段说明：** `code` 字段目前**仅用于调试日志和错误追踪**，前端 Renderer 不会据此做程序化判断（如跳转登录页、显示特定 UI）——此类逻辑属于应用层业务逻辑，不应由协议层的 Renderer 处理。后端仍应返回有业务意义的 `code` 值以便排查问题；若后续需要前端据此做程序化处理，建议通过场景 ADR 另行约定。

## 6. 分页模式说明（对应 `table.props.pagination.mode`）

| 模式 | 后端行为 |
|---|---|
| `server` | 后端必须支持 `page`/`pageSize` 参数并返回 `total` |
| `client` | 后端一次性返回全量 `list`，前端本地分页，无需支持分页参数 |
| `none` | 不分页，直接展示 `list` 全部内容 |

## 7. 静态数据（`data.source: static`）

用于无需请求接口、由后端直接内嵌少量数据的场景（如下拉选项的固定值）：

```yaml
data:
  source: static
  value:
    - { label: 零售, value: retail }
    - { label: 批发, value: wholesale }
```

## 8. `select.optionsSource` 远程动态选项契约（since 0.2，B7）

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
