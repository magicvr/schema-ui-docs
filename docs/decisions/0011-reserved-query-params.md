---
status: accepted
date: 2026-07-11
---

# ADR-0011: 表格保留 Query 参数与状态优先级

## 状态

已接受（Accepted）。本 ADR 关闭 v1.0 门禁 G3，定义搜索表单、表格静态 params 与 Renderer 分页/排序状态如何共同构造表格 API 请求。

## 背景

协议已经使用 `page`、`pageSize`、`sort` 表示服务端分页和排序，但搜索字段与静态 params 仍可声明同名 key。若各 Renderer 采用不同覆盖顺序，提交搜索、翻页或排序会产生不同请求，已有 URL query 也可能意外覆盖当前 UI 状态。

## 决策

### D1. Renderer 保留参数

`page`、`pageSize`、`sort` 是表格 API 请求的 Renderer 保留 query 参数。L2 必须拒绝：

- `data.params` 中的保留 key；
- `datasources.*.params` 中的保留 key；
- `form.mode: search` 导出的 `field`、`startField` 或 `endField` 使用保留名。

该禁令不适用于 `optionsSource.params` 和行级 `requestMapping.query`；它们构造独立请求，不与目标表格的分页/排序状态合并。普通提交表单的字段也不受本 ADR 限制。

### D2. 唯一来源顺序

表格 API 请求必须调用 ADR-0010 的 `serializeQuery(baseUrl, sources)`，来源顺序固定为：

1. `baseUrl` 已有 query；
2. 表格有效 API 数据源的静态 params；
3. 关联搜索表单的当前筛选字段；
4. Renderer 当前分页/排序状态。

后来源覆盖前来源，`null` / `undefined` 按 ADR-0010 删除同名 key。即使非法页面绕过静态校验，Renderer 状态也必须最终覆盖同名参数；标准入口仍必须先通过 L2，不得把覆盖行为当作接受冲突配置的理由。

内联 `data.source: api` 使用 `data.params`。`data.source: ref` 使用被引用 API datasource 的 params，再应用节点本地 `data.params`；节点本地值覆盖 datasource 值。二者都属于第 2 层静态 params，不得声明保留 key。

### D3. 初始状态

服务端分页表格初始 `page` 为 `1`。`pageSize` 取 `table.props.pagination.pageSize`；协议未声明时由 Renderer 产品默认值决定，但该值必须在首次请求前成为显式状态并发送。未选择排序时 `sort` 为 `null` tombstone，不发送该 key。

`sort` 的非空格式为 `field:asc` 或 `field:desc`。可排序字段能力不在本 ADR 扩展；Renderer 只能从表格已允许的排序交互产生该值。

### D4. 状态转换

| 事件 | 筛选状态 | `page` | `pageSize` | `sort` |
|---|---|---:|---:|---|
| 搜索提交 | 以本次表单快照整体替换 | 重置为 `1` | 保留 | 保留 |
| 清空筛选 | 置为空对象 | 重置为 `1` | 保留 | 保留 |
| 翻页 | 保留 | 改为目标页 | 保留 | 保留 |
| 排序或清除排序 | 保留 | 重置为 `1` | 保留 | 改为新值或 `null` |

搜索提交是快照替换，不是与旧筛选做增量合并。空字段若求值为 `null` / `undefined`，按 ADR-0010 tombstone 删除；空字符串仍发送为 `key=`。

### D5. 可执行一致性向量

框架无关向量位于 `conformance/fixtures/table-query-state/cases.json`。每个消费者必须比较事件后的完整状态和最终 URL。最终 URL 使用 ADR-0010 的公共序列化器，不得另写编码、排序或空值逻辑。

## 后果

**正面：** 同一页面状态只有一个请求结果；用户翻页不会丢失筛选和排序；搜索或排序变化不会停留在可能已不存在的旧页码。

**负面 / 取舍：** 既有页面若把 `page`、`pageSize`、`sort` 当业务筛选字段，需要重命名；后端若使用其他分页命名，需要在协议边界外适配。