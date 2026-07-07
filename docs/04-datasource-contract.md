---
status: stable
owner: 后端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.1
---

# 数据源 / API 契约规范

> 本文档面向后端开发者：只要接口按本文档的契约返回数据，
> 前端 Renderer 就能自动完成请求、分页、加载态、错误态处理，后端无需关心这些前端行为。

## 1. `datasources` 声明（页面级预声明）

```yaml
datasources:
  orderStats:
    type: api
    method: GET
    url: /api/stats/order-count
    params:
      range: 7d
```

Node 内通过 `data.source: ref` + `data.ref: orderStats` 引用，避免同一接口在多个节点中重复声明。

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

### 4.2 单值类接口（配合 `statCard`）

```json
{ "total": 328 }
```

`statCard.data.valueField` 指定取哪个字段（如 `total`）。

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
