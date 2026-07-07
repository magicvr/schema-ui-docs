---
status: example
protocol_version: v0.2
last_updated: 2026-07-07
---

# 场景示例：数据表格（自动分页 + 格式化）

对应组件：`table`，字段说明见 [03-component-registry.md](../03-component-registry.md)。

> **v0.2 变更提示：** `actions[].visibleField`（见计划 B10）演示"数据驱动显隐"——由后端在行数据中下发
> 语义化布尔字段（如 `canRefund`），前端据此判断行内操作是否展示，不引入 `$row` 表达式。

```yaml
meta:
  pageId: order_list
  title: 订单列表
  protocolVersion: "0.2"

body:
  type: table
  props:
    title: 订单列表
    rowKey: orderId
    pagination:
      mode: server
      pageSize: 20
    columns:
      - field: orderId
        label: 订单号
      - field: customerName
        label: 客户名称
      - field: amount
        label: 订单金额
        format: currency
      - field: status
        label: 状态
        format: tag
        tagMap:
          PENDING: { text: 待付款, tone: warning }
          PAID: { text: 已付款, tone: success }
          CANCELED: { text: 已取消, tone: neutral }
      - field: createdAt
        label: 创建时间
        format: datetime
    actions:
      - key: view
        label: 查看
      - key: refund
        label: 退款
        confirm: 确认发起退款吗？
        visibleField: canRefund
  data:
    source: api
    method: GET
    url: /api/orders
```

## `visibleField` 行级显隐说明（B10）

`refund` 操作仅在当前行数据的 `canRefund` 字段为 `true` 时展示，后端需要在列表接口的每一行数据中
下发该字段（见下方接口契约）。这是数据驱动显隐，不依赖 `reactions`/`when` 表达式，也不引入 `$row`
变量；行级表达式联动（`$row`）仍在 ADR 评审中（见 [decisions/](../decisions/) 及计划 C3）。

## 对应后端接口契约

`GET /api/orders?page=1&pageSize=20`：

```json
{
  "list": [
    { "orderId": "1001", "customerName": "张三", "amount": 99.5, "status": "PAID", "createdAt": "2026-07-01T10:00:00Z", "canRefund": true }
  ],
  "total": 128
}
```

分页参数、响应体结构详见 [04-datasource-contract.md](../04-datasource-contract.md)。
