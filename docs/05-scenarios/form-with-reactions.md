---
status: example
protocol_version: v0.2
last_updated: 2026-07-10
---

# 场景示例：表单 + 基础联动

对应组件：`form` / `input` / `select` / `inputNumber`，字段说明见
[03-component-registry.md](../03-component-registry.md)；联动语法见
[02-reaction-expression.md](../02-reaction-expression.md)；`actions` 完整契约见
[07-actions-contract.md](../07-actions-contract.md)。

> **v0.2 变更提示：** `createOrder` 动作补充了 `onSuccess`/`onError` 语义级行为声明。

```yaml
meta:
  pageId: order_create
  title: 新建订单
  protocolVersion: "0.3"

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
        placeholder: 请输入客户名称

    - type: select
      props:
        field: orderType
        label: 订单类型
        description: 决定是否需要填写批发折扣
        options:
          - { label: 零售, value: retail }
          - { label: 批发, value: wholesale }

    - type: inputNumber
      props:
        field: wholesaleDiscount
        label: 批发折扣
        tooltip: 折扣范围 0~1，如 0.85 表示 8.5 折
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
    onSuccess:
      behavior: toast
      message: 订单创建成功
    onError:
      behavior: toast
      message: 创建失败，请检查表单后重试
```

## 联动效果说明

- 默认（零售）：不展示"批发折扣"字段。
- 当"订单类型"切换为"批发"：自动展示"批发折扣"字段并置为必填。
- 切回"零售"：自动隐藏该字段并取消必填。

## `onSuccess`/`onError` 说明（B3）

`createOrder` 提交成功后执行 `toast`（提示成功文案）；提交失败则执行 `toast` 展示错误提示。
完整的 `behavior` 取值范围和字段契约见 [07-actions-contract.md](../07-actions-contract.md)。

## 提交契约

`POST /api/orders`，请求体为表单各字段 `field` 组成的 JSON：

```json
{ "customerName": "张三", "orderType": "wholesale", "wholesaleDiscount": 0.85 }
```
