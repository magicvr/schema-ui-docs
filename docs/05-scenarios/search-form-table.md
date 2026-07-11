---
status: example
protocol_version: v0.2
last_updated: 2026-07-11
---

# 场景示例：搜索表单 + 服务端分页表格

对应组件：`form`（`mode: search`）+ `table`。字段说明见 [03-component-registry.md](../03-component-registry.md)；分页契约见 [04-datasource-contract.md](../04-datasource-contract.md)。

关键点：

- `form.mode: search` + `targetTable` 指向表格 Node `id`。
- 目标表格必须具备有效 API 数据源（内联 `data.source: api` 或 `ref` 到 API datasource）。
- 搜索模式下 `submitAction` 被忽略；提交即刷新目标表格并合并 query 参数。

```yaml
meta:
  pageId: order_search
  title: 订单搜索
  protocolVersion: "0.3"

body:
  type: section
  children:
    - type: form
      props:
        title: 筛选条件
        mode: search
        targetTable: orderTable
      children:
        - type: input
          props:
            field: keyword
            label: 关键词
            placeholder: 订单号/客户名
        - type: select
          props:
            field: status
            label: 状态
            options:
              - { label: 全部, value: "" }
              - { label: 待付款, value: PENDING }
              - { label: 已付款, value: PAID }
        - type: dateRangePicker
          props:
            startField: dateFrom
            endField: dateTo
            label: 下单日期

    - type: table
      id: orderTable
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
          - field: status
            label: 状态
            format: tag
            tagMap:
              PENDING: { text: 待付款, tone: warning }
              PAID: { text: 已付款, tone: success }
          - field: createdAt
            label: 创建时间
            format: datetime
      data:
        source: api
        method: GET
        url: /api/orders
```

## 数据流说明

1. 用户填写筛选条件并提交搜索表单。
2. Renderer 收集表单字段值为 query 参数（如 `keyword`、`status`、`dateFrom`、`dateTo`）。
3. 参数合并到 `orderTable` 的 API 请求，触发重新加载当前页数据。
4. `mode: search` 不经过顶层 `actions`，无需声明 `submitAction`。

## 对应后端接口

`GET /api/orders?page=1&pageSize=20&keyword=...&status=...&dateFrom=...&dateTo=...`：

```json
{
  "list": [
    { "orderId": "1001", "customerName": "张三", "status": "PAID", "createdAt": "2026-07-01T10:00:00Z" }
  ],
  "total": 128
}
```
