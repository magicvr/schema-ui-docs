---
status: example
protocol_version: v0.1
last_updated: 2026-07-07
---

# 场景示例：数据表格（自动分页 + 格式化）

对应组件：`table`，字段说明见 [03-component-registry.md](../03-component-registry.md)。

```yaml
meta:
  pageId: order_list
  title: 订单列表

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
  data:
    source: api
    method: GET
    url: /api/orders
```

## 对应后端接口契约

`GET /api/orders?page=1&pageSize=20`：

```json
{
  "list": [
    { "orderId": "1001", "customerName": "张三", "amount": 99.5, "status": "PAID", "createdAt": "2026-07-01T10:00:00Z" }
  ],
  "total": 128
}
```

分页参数、响应体结构详见 [04-datasource-contract.md](../04-datasource-contract.md)。
