---
applies_to: schema-ui-protocol v2.9
---

# 扩展示例：列表 → 内页路由过滤 + 只读上下文字段（ADR-0039 / ADR-0040）

> 本示例演示 v2.9 两个新能力的最小闭环：
> 1. **`data.route-binding`（ADR-0039）**——独立 table 的 dataSource 从当前页路由 query
>    读取过滤参数（`$context.route.query.*` 整值绑定）；
> 2. **`form.controls.readonly`（ADR-0040）**——表单字段只读可见、值仍参与提交投影。
>
> 业务锚点：数据字典「条目」内页——从类型列表行进「条目」导航到
> `/dictionary-entries?dictKey=ORDER_STATUS`，内页只展示该类型条目；新建/编辑表单的
> `dictKey` 字段只读（值由路由/记录注入，提交仍传类型键）。

## 列表页（字典类型）

```yaml
meta:
  pageId: dict_types
  title: 数据字典
  protocolVersion: "2.9"
  requiredCapabilities:
    - app.manifest
    - actions.row.navigate

actions:
  openEntries:
    type: navigate
    url: /dictionary-entries

body:
  type: table
  id: dict-types-table
  props:
    rowKey: id
    pagination: { mode: server, pageSize: 20 }
    columns:
      - { field: key, label: 类型键 }
      - { field: name, label: 类型名称 }
    actions:
      - key: entries
        label: 条目
        actionRef: openEntries
        navigateMapping:
          query:
            dictKey: $row.key
  data:
    source: api
    url: /api/data-dictionary/types
    method: GET
```

## 内页（条目列表 + 新建/编辑表单）

```yaml
meta:
  pageId: dict_entries
  title: 字典条目
  protocolVersion: "2.9"
  requiredCapabilities:
    - app.manifest
    - actions.page.trigger
    - actions.row.request
    - data.route-binding
    - form.controls.readonly

actions:
  createEntry:
    type: request
    method: POST
    url: /api/data-dictionary/entries
    bodyMapping:
      dictKey: dictKey
      entryKey: entryKey
      label: label
    onSuccess:
      behavior: reload
  openCreate:
    type: modal
    content:
      type: form
      id: create-entry-form
      props:
        submitAction: createEntry
      children:
        - type: input
          props: { field: dictKey, label: 类型键, readOnly: true }
        - type: input
          props: { field: entryKey, label: 条目键, required: true }
        - type: input
          props: { field: label, label: 标签, required: true }

body:
  type: table
  id: dict-entries-table
  props:
    rowKey: id
    pagination: { mode: server, pageSize: 20 }
    columns:
      - { field: entryKey, label: 条目键 }
      - { field: label, label: 标签 }
    toolbar:
      - key: create
        label: 新建条目
        actionRef: openCreate
  data:
    source: api
    url: /api/data-dictionary/entries
    params:
      dictKey: $context.route.query.dictKey
```

## 关键点

1. **列表 → 内页：** 行 action `openEntries` 用 `navigateMapping.query.dictKey: $row.key`
   导航到 `/dictionary-entries?dictKey=<key>`（既有 `actions.row.navigate`，ADR-0021）。
2. **内页过滤：** 条目表 `data.params.dictKey: $context.route.query.dictKey`（v2.9，
   `data.route-binding`）——请求构造为 `GET /api/data-dictionary/entries?dictKey=…`；
   `dictKey` 缺失时该参数按 tombstone 删除（不过滤）。
3. **只读上下文字段：** 新建表单 `dictKey` 声明 `readOnly: true`（v2.9，
   `form.controls.readonly`）——用户不可编辑，值仍进入 `values` 与 `bodyMapping`
   提交；页面生产方需保证值源（本示例为新建场景，可由 recordSource / defaultValue /
   reactions 注入，或由 Host 在 modal 场景提供；整页场景可经
   `form.props.recordSource` 的 `$context.route.query.*` 绑定回填，见
   `admin-list-edit-lifecycle.md`）。
4. **服务端职责：** `dictKey` 只是筛选参数，业务 API 必须独立鉴权（`$context` 不是
   安全边界，ADR-0003）。

## 可观测算法覆盖

- 路由绑定请求构造：`request-construction` suite（`data-ref-route-*` 用例）；
- 版本/capability 协商：`version-negotiation` suite（`*data-route-binding*` /
  `*form-controls-readonly*` 用例）；
- 只读字段提交投影：`request-construction` suite
  （`form-action-projection-readonly-value-included`）。
