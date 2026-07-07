---
status: example
protocol_version: v0.2
last_updated: 2026-07-07
---

# 场景示例：两列网格看板（统计卡片 + 图表）

对应组件：`grid` / `section` / `statCard` / `chart`，字段说明见
[03-component-registry.md](../03-component-registry.md)。

> **v0.2 变更提示：** `valueField` 已从 `data.valueField` 迁移至 `props.valueField`（见审计 §2.1 / 计划 A3），
> 本示例同时演示 `datasources` + `data.source: ref` 的预声明引用方式（见计划 A4）。

```yaml
meta:
  pageId: dashboard_sales
  title: 销售看板
  protocolVersion: "0.2"

datasources:
  orderCountStats:
    source: api
    method: GET
    url: /api/stats/order-count

body:
  type: grid
  props:
    columns: 2
  children:
    - type: section
      props:
        title: 核心指标
        span: 1
      children:
        - type: statCard
          props:
            label: 今日订单数
            unit: 单
            valueField: total
          data:
            source: ref
            ref: orderCountStats
        - type: statCard
          props:
            label: 今日成交额
            unit: 元
            format: currency
            valueField: amount
          data:
            source: api
            url: /api/stats/gmv

    - type: section
      props:
        title: 近7日趋势
        span: 1
      children:
        - type: chart
          props:
            chartType: line
            xField: date
            yField: value
          data:
            source: api
            url: /api/stats/trend
            params:
              range: "7d"
```

## `datasources` + `ref` 引用说明（A4）

上例中 `orderCountStats` 在页面级 `datasources` 中预声明了一次 `GET /api/stats/order-count`，
第一个 `statCard` 通过 `data.source: ref` + `data.ref: orderCountStats` 引用它，而不是像第二个
`statCard` 那样在节点内直接声明 `data.source: api`。当同一接口需要被多个节点复用时，优先使用
`datasources` 预声明，避免重复声明同一个请求。

## 对应后端接口契约

- `GET /api/stats/order-count` → `{ "total": 328 }`
- `GET /api/stats/gmv` → `{ "amount": 88234.5 }`
- `GET /api/stats/trend?range=7d` → `[{ "date": "2026-07-01", "value": 120 }, ...]`

详见 [04-datasource-contract.md](../04-datasource-contract.md)。
