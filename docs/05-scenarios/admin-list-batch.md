---
status: example
protocol_version: v2.3
last_updated: 2026-07-23
capabilities:
  - actions.page.trigger
  - table.selection
  - actions.batch.request
---

# 场景示例：列表当前页多选 + 批量 request

对应能力：[ADR-0022](../decisions/0022-table-selection-and-batch-request.md)。

本扩展示例覆盖轨道 Phase C MVP：**当前页**多选 → 工具栏批量删除（一次 HTTP）→ 成功 reload 并清空选中。完整 YAML 见 [`_samples/order-list-batch.yaml`](./_samples/order-list-batch.yaml)。

> **版本说明：** 本扩展示例使用 `protocolVersion: "2.3"` 与 batch capabilities（见 [13-v2.2-release-goals.md](../13-v2.2-release-goals.md) 与 [migrations/2.1-to-2.2.md](../migrations/2.1-to-2.2.md)）。

可观测构造向量见 conformance：`batch-request-body-keys`、`batch-request-empty-selection-rejected`、`batch-request-count-keys-mismatch-normalized` 等（`request-construction` suite）。

## 页面配置（摘要）

```yaml
meta:
  pageId: order_list_batch
  title: 订单列表批量
  protocolVersion: "2.3"
  requiredCapabilities:
    - actions.page.trigger
    - table.selection
    - actions.batch.request

actions:
  deleteOrders:
    type: request
    method: POST
    url: /api/orders/batch-delete
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 批量删除失败

body:
  type: table
  id: orderTable
  props:
    rowKey: orderId
    selection:
      mode: multiple
    pagination:
      mode: server
      pageSize: 20
    toolbar:
      - key: batchDelete
        label: 批量删除
        actionRef: deleteOrders
        requiresSelection: true
        confirm: 确认删除所选订单？
        batchMapping:
          body:
            orderIds: $selection.keys
    columns:
      - field: orderId
        label: 订单号
  data:
    source: api
    url: /api/orders
    method: GET
    responseMapping:
      list: data.list
      total: data.total
```

## 行为要点

1. **仅当前页**：筛选 / 翻页 / 排序 / reload 成功后清空选中（ADR-0011 交互）。
2. **键规范化**：非标量丢弃、去重保序；batch 构造入口与状态机同一不变量（V274 / V281）。
3. **空选**：`requiresSelection: true` 时按钮 disabled；运行时仍以 `EMPTY_SELECTION` 兜底。
4. **非目标**：跨页全选、部分成功、body 塞整行对象。

## 相关

- 列表/编辑闭环扩展示例：[admin-list-edit-lifecycle.md](./admin-list-edit-lifecycle.md)
- 动作契约 [07 §3.5](../07-actions-contract.md#35-批量请求绑定since-22-adr-0022)
