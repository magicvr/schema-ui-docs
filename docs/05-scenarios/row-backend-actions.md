---
status: example
protocol_version: v2.2
last_updated: 2026-07-09
---

# 场景示例：表格行级后端动作

对应组件：`table` + 顶层 `actions`。本示例覆盖列表页中常见的“退款 / 审批 / 删除”行内按钮直接调用后端接口的场景。

关键点：

- 使用 `meta.requiredCapabilities: [actions.row.request]` 声明 Renderer 必须支持行级后端请求能力。
- `RowAction.key` 仍是操作标识；`RowAction.actionRef` 才引用顶层 `actions`。
- `RowAction.requestMapping` 负责把当前行 `$row.*` 映射到请求路径、query 或 body。
- 成功后使用 `onSuccess.behavior: reload` 刷新当前表格数据。

```yaml
meta:
  pageId: order_operations
  title: 订单操作台
  protocolVersion: "2.2"
  requiredCapabilities:
    - actions.row.request

actions:
  refundOrder:
    type: request
    method: POST
    url: /api/orders/{orderId}/refund
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 退款失败，请重试

  approveOrder:
    type: request
    method: POST
    url: /api/orders/{orderId}/approve
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 审批失败，请重试

  deleteOrder:
    type: request
    method: DELETE
    url: /api/orders/{orderId}
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 删除失败，请重试

body:
  type: table
  id: order_table
  props:
    title: 订单操作台
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
          PENDING: { text: 待审批, tone: warning }
          APPROVED: { text: 已通过, tone: success }
          PAID: { text: 已付款, tone: info }
          REFUNDED: { text: 已退款, tone: neutral }
      - field: updatedAt
        label: 更新时间
        format: datetime
    actions:
      - key: approve
        label: 通过
        confirm: 确认审批通过该订单？
        actionRef: approveOrder
        requestMapping:
          path:
            orderId: $row.orderId
          body:
            version: $row.version
            decision: APPROVED
        visibleWhen:
          scope: row
          dependencies: [canApprove]
          when: "$row.canApprove == true"

      - key: refund
        label: 退款
        confirm: 确认发起退款？
        actionRef: refundOrder
        requestMapping:
          path:
            orderId: $row.orderId
          body:
            amount: $row.refundableAmount
            source: order_list
        visibleWhen:
          scope: row
          dependencies: [canRefund]
          when: "$row.canRefund == true"

      - key: delete
        label: 删除
        confirm: 确认删除该订单？
        actionRef: deleteOrder
        requestMapping:
          path:
            orderId: $row.orderId
        visibleWhen:
          scope: row
          dependencies: [canDelete]
          when: "$row.canDelete == true"
  data:
    source: api
    method: GET
    url: /api/orders
```

## 对应后端接口契约

表格数据接口 `GET /api/orders?page=1&pageSize=20`：

```json
{
  "list": [
    {
      "orderId": "1001",
      "customerName": "张三",
      "amount": 199.5,
      "refundableAmount": 199.5,
      "status": "PAID",
      "updatedAt": "2026-07-09T10:00:00Z",
      "version": 3,
      "canApprove": false,
      "canRefund": true,
      "canDelete": false
    }
  ],
  "total": 128
}
```

行级动作接口：

| 接口 | 触发按钮 | 请求来源 |
|---|---|---|
| `POST /api/orders/{orderId}/approve` | `approve` | `requestMapping.path.orderId` + `requestMapping.body.version/decision` |
| `POST /api/orders/{orderId}/refund` | `refund` | `requestMapping.path.orderId` + `requestMapping.body.amount/source` |
| `DELETE /api/orders/{orderId}` | `delete` | `requestMapping.path.orderId` |

后端必须独立校验当前用户是否有权限执行对应操作，不能只依赖前端的 `visibleWhen` 或 `canXxx` 字段。