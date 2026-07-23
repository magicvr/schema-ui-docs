---
status: example
protocol_version: v2.4
last_updated: 2026-07-23
capabilities:
  - actions.page.trigger
  - actions.row.navigate
  - form.record.load
---

# 场景示例：列表工具栏新建 + 行进编辑 + 记录回填

对应能力：[ADR-0020](../decisions/0020-page-action-trigger.md)、[ADR-0021](../decisions/0021-record-navigation-and-form-load.md)。

本示例拆成**两个页面文档**（列表 + 编辑），覆盖轨道 MVP 锚点 A/B/C。使用前 Renderer 须支持相应 `requiredCapabilities`。页面声明 `meta.protocolVersion: "2.4"` 与对应 capability；`2.1.0` 制品已发布，不再建议用 `"2.0"` 承载本场景字段。

端到端可观测步骤见 conformance：`admin-lifecycle-list-row-navigate`、`admin-lifecycle-edit-load-submit`（`conformance/fixtures/scenarios/cases.json`）。

## 列表页

```yaml
meta:
  pageId: order_list_lifecycle
  title: 订单列表
  protocolVersion: "2.4"
  requiredCapabilities:
    - actions.page.trigger
    - actions.row.navigate

actions:
  openCreate:
    type: navigate
    url: /orders/create
  openEdit:
    type: navigate
    url: /orders/edit

body:
  type: table
  id: orderTable
  props:
    rowKey: orderId
    pagination:
      mode: server
      pageSize: 20
    toolbar:
      - key: create
        label: 新建
        actionRef: openCreate
    columns:
      - field: orderId
        label: 订单号
      - field: customerName
        label: 客户
    actions:
      - key: edit
        label: 编辑
        actionRef: openEdit
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

## 编辑页

```yaml
meta:
  pageId: order_edit_lifecycle
  title: 编辑订单
  protocolVersion: "2.4"
  requiredCapabilities:
    - form.record.load

actions:
  updateOrder:
    type: request
    method: PUT
    url: /api/orders/update
    bodyMapping:
      orderId: orderId
      customerName: customerName
      version: version
    onSuccess:
      behavior: navigate
      url: /orders
    onError:
      behavior: toast
      message: 保存失败，请重试

body:
  type: form
  props:
    title: 编辑订单
    submitAction: updateOrder
    recordSource:
      method: GET
      url: /api/orders/{orderId}
      path:
        orderId: $context.route.query.orderId
      responseMapping:
        orderId: orderId
        customerName: customer.name
        version: version
  children:
    - type: input
      props:
        field: orderId
        label: 订单号
        # 只读可见，确保进入提交投影（勿用 visibleWhen:false 隐藏主键）
    - type: input
      props:
        field: customerName
        label: 客户名称
    - type: input
      props:
        field: version
        label: 版本
```

> **宿主职责：** 导航到编辑页时注入 `$context.route.query.orderId`；列表与编辑为两个页面文档，由路由壳负责挂载对应 YAML。
