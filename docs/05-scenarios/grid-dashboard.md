---
status: example
protocol_version: v0.1
last_updated: 2026-07-07
---

# 场景示例：两列网格看板（统计卡片 + 图表）

对应组件：`grid` / `section` / `statCard` / `chart`，字段说明见
[03-component-registry.md](../03-component-registry.md)。

```yaml
meta:
  pageId: dashboard_sales
  title: 销售看板

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
          data:
            source: api
            url: /api/stats/order-count
            valueField: total
        - type: statCard
          props:
            label: 今日成交额
            unit: 元
            format: currency
          data:
            source: api
            url: /api/stats/gmv
            valueField: amount

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
            url: /api/stats/trend?range=7d
```

## 对应后端接口契约

- `GET /api/stats/order-count` → `{ "total": 328 }`
- `GET /api/stats/gmv` → `{ "amount": 88234.5 }`
- `GET /api/stats/trend?range=7d` → `[{ "date": "2026-07-01", "value": 120 }, ...]`

详见 [04-datasource-contract.md](../04-datasource-contract.md)。
