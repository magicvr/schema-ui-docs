---
status: example
protocol_version: v0.1
last_updated: 2026-07-07
---

# 场景示例：表单 + 基础联动

对应组件：`form` / `input` / `select` / `inputNumber`，字段说明见
[03-component-registry.md](../03-component-registry.md)；联动语法见
[02-reaction-expression.md](../02-reaction-expression.md)。

```yaml
meta:
  pageId: order_create
  title: 新建订单

body:
  type: form
  props:
    title: 新建订单
    submitAction: createOrder
  children:
    - type: input
      props:
        field: customerName
        label: 客户名称
        required: true

    - type: select
      props:
        field: orderType
        label: 订单类型
        options:
          - { label: 零售, value: retail }
          - { label: 批发, value: wholesale }

    - type: inputNumber
      props:
        field: wholesaleDiscount
        label: 批发折扣
        defaultVisible: false
      reactions:
        - dependencies: [orderType]
          when: "$deps.orderType == 'wholesale'"
          fulfill:
            visible: true
            required: true
          otherwise:
            visible: false
            required: false

actions:
  createOrder:
    type: request
    method: POST
    url: /api/orders
```

## 联动效果说明

- 默认（零售）：不展示"批发折扣"字段。
- 当"订单类型"切换为"批发"：自动展示"批发折扣"字段并置为必填。
- 切回"零售"：自动隐藏该字段并取消必填。

## 提交契约

`POST /api/orders`，请求体为表单各字段 `field` 组成的 JSON：

```json
{ "customerName": "张三", "orderType": "wholesale", "wholesaleDiscount": 0.85 }
```
