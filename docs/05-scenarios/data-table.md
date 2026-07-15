---
status: example
protocol_version: v2.0
last_updated: 2026-07-09
---

# 场景示例：数据表格（自动分页 + 格式化）

对应组件：`table`，字段说明见 [03-component-registry.md](../03-component-registry.md)。

> **v0.2 变更提示：** `actions[].visibleField` 演示兼容语法糖：解析阶段等价展开为 `scope: row` 的 `visibleWhen`；
> 新项目推荐直接使用 `$row` 表达式写法。

```yaml
meta:
  pageId: order_list
  title: 订单列表
  protocolVersion: "2.0"

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

> **说明：** 此处 `actions[].key`（如 `view` / `refund`）仅为行内操作标识，不引用顶层 `actions`；当前示例无需额外声明页面级 `actions` 定义。

## 行级显隐说明

### 推荐写法：`$row` 表达式（since 0.2，ADR-0004）

使用 `visibleWhen` + `scope: row` + `$row` 表达式，可读性更强且支持更复杂的条件判断：

```yaml
actions:
  - key: refund
    label: 退款
    confirm: 确认发起退款吗？
    visibleWhen:
      scope: row
      dependencies: [canRefund]
      when: "$row.canRefund == true"
```

### 兼容写法：`visibleField` 语法糖（B10）

`visibleField` 是上述 `$row` 表达式的语法糖——解析阶段等价展开为 `{ scope: row, dependencies: [canRefund], when: "$row.canRefund == true" }`。
`refund` 操作仅在当前行数据的 `canRefund` 字段为 `true` 时展示，后端需要在列表接口的每一行数据中
下发该字段（见下方接口契约）。`visibleField` 今后进入维护模式，新项目建议直接使用 `$row` 表达式写法（推荐写法）。

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
