---
status: extended-example
protocol_version: v2.4
capabilities:
  - actions.row.navigate
  - record.view.load
  - actions.page.trigger
related:
  - ADR-0021
  - ADR-0024
  - docs/11-next-admin-lifecycle-goals.md
---

# 扩展示例：列表 → 只读详情（recordView）

本示例覆盖 Phase D 首项：表格只展示部分列时，行进详情页用标准 `recordView` 查阅完整记录。使用前 Renderer 须支持相应 `requiredCapabilities`。页面声明 `meta.protocolVersion: "2.4"`。

权威：[ADR-0024](../decisions/0024-record-view.md)。迁移见 [migrations/2.3-to-2.4.md](../migrations/2.3-to-2.4.md)。

## 列表页（行进详情）

```yaml
meta:
  pageId: order_list_for_detail
  title: 订单列表
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
    pagination:
      mode: server
      pageSize: 20
    columns:
      - field: orderId
        label: 订单号
      - field: customerName
        label: 客户
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
    responseMapping:
      list: data.list
      total: data.total
```

## 详情页（recordView 加载）

```yaml
meta:
  pageId: order_detail_lifecycle
  title: 订单详情
  protocolVersion: "2.4"
  requiredCapabilities:
    - record.view.load
    - actions.page.trigger

actions:
  backToList:
    type: navigate
    url: /orders

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
          - key: orderId
            label: 订单号
          - key: customerName
            label: 客户
          - key: status
            label: 状态
            format: tag
            tagMap:
              paid:
                text: 已支付
                tone: success
              pending:
                text: 待支付
                tone: warning
          - key: amount
            label: 金额
            format: currency
```

## 行为摘要

1. 列表行「详情」→ navigate 到 `/orders/detail?orderId=…`（`actions.row.navigate`）。
2. 详情页 `recordView` 挂载 → GET `/api/orders/{orderId}`，按 `responseMapping` 得到展示值。
3. `fields[]` 只读展示；缺失映射路径为可观测 `null`。
4. 「返回列表」为页面级 `actionButton`（`actions.page.trigger`），非 `recordView` 内嵌能力。
