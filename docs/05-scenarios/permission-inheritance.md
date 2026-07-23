---
status: stable
applies_to: schema-ui-protocol v2.4
---

# 扩展示例：编辑与删除权限继承

本示例把订单编辑表单、行级删除、工具栏删除与页面级新建置于一个明确的容器边界内。表格列只保留本地 `permissions`；只有 actions / toolbar 和 `actionButton` 的显式 `permissionIntent` 接收祖先 cascade。

```yaml
meta:
  pageId: order_permission_boundary
  title: 订单权限边界
  protocolVersion: "2.4"
  requiredCapabilities:
    - permissions.inheritance
    - actions.page.trigger

actions:
  saveOrder:
    type: request
    method: PUT
    url: /api/orders/current
  deleteSelected:
    type: request
    method: DELETE
    url: /api/orders
  createOrder:
    type: navigate
    url: /orders/new

body:
  type: section
  id: orderAdmin
  permissions:
    edit: "$context.user.roles contains 'editor'"
    delete: "$context.user.roles contains 'admin'"
  permissionCascade:
    keys: [edit, delete]
  children:
    - type: form
      id: orderForm
      props:
        title: 编辑订单
        submitAction: saveOrder
      children:
        - type: input
          props:
            field: customerName
            label: 客户名称
        - type: select
          props:
            field: status
            label: 订单状态
            options:
              - { label: 草稿, value: draft }
              - { label: 已确认, value: confirmed }

    - type: table
      id: orderTable
      data:
        source: static
        value: []
      props:
        rowKey: id
        pagination:
          mode: client
        columns:
          - field: orderNo
            label: 订单号
            permissions:
              view: "$context.features.showOrderNumber == true"
          - field: status
            label: 状态
        actions:
          - key: delete
            label: 删除
            permissionIntent: delete
        toolbar:
          - key: deleteAll
            label: 批量删除
            actionRef: deleteSelected
            permissionIntent: delete

    - type: actionButton
      props:
        key: create
        label: 新建订单
        actionRef: createOrder
        permissionIntent: edit
```

默认 form 的字段和 `saveOrder` 提交入口是隐式 `edit` 目标。`delete` 与 `deleteAll` 只有在管理员权限 source 为真时才可执行；`create` 以 `edit` intent 参与同一容器边界。`orderNo` 列不因祖先 delete/edit 值改变，继续独立求值其本地 `permissions.view`。
