---
status: accepted
date: 2026-07-08
---

# ADR-0005: `responseMapping` 响应体字段名映射

## 状态

已接受(Accepted)—— 已合并入 `01-node-protocol.md`、`04-datasource-contract.md`、`08-renderer-spec.md` 与 `schemas/node.schema.json`。

## 背景

`04-datasource-contract.md` 当前要求列表类接口返回固定结构：

```json
{
  "list": [],
  "total": 0
}
```

但遗留系统常见返回结构包括：

```json
{ "data": [], "count": 128 }
{ "items": [], "totalCount": 128 }
{ "result": { "records": [], "total": 128 } }
```

此前文档把 `responseMapping` 标记为 planned，并曾提到可放在 `data.params` 中。但 `params` 是请求参数，`responseMapping` 是响应解析配置，将二者混在同一对象会导致语义污染：Renderer 可能误把映射配置发给后端，后端也无法区分这是查询参数还是前端解析指令。

因此需要将 `responseMapping` 标准化为数据源契约的一等字段。

## 决策

### D1. `responseMapping` 归属 `DataRef`，不放入 `params`

`responseMapping` 是 `DataRef` 的可选字段，与 `source`、`url`、`method`、`params` 同级：

```yaml
data:
  source: api
  url: /api/orders
  method: GET
  params:
    status: $deps.status
  responseMapping:
    list: result.records
    total: result.total
```

协议明确禁止把 `responseMapping` 放入 `data.params`。若 `data.params.responseMapping` 出现，静态校验应拒绝或至少在 L3/L4 阶段报错。

理由：请求参数与响应解析配置属于两个方向的契约，必须分离。`params` 只描述发给服务端的参数；`responseMapping` 只描述 Renderer 如何从服务端响应中取值。

### D2. 映射值只允许点路径，不允许表达式

`responseMapping` 的值是响应 JSON 对象内的点路径字符串，例如：

```yaml
responseMapping:
  list: result.records
  total: result.totalCount
```

不支持函数调用、条件表达式、数组过滤、模板字符串或任意脚本。路径按对象属性逐级读取；若路径不存在，Renderer 视为响应格式错误。

理由：字段名映射是结构适配，不是数据转换。复杂转换应放在后端适配层、BFF 或自定义 Renderer 扩展中，而不是扩展协议表达式能力。

### D3. 标准键仅包含 `list` 与 `total`

v0.2.x 仅标准化两个语义键：

| 键 | 语义 | 适用场景 |
|---|---|---|
| `list` | 当前数据数组 | `table`、需要数组数据的 `chart`、未来复用 `DataRef` 的列表组件 |
| `total` | 总条数 | `table.props.pagination.mode: server` |

`total` 仅在服务端分页表格中必需；若组件不需要总数，可不声明。`statCard` / `text` 的取值字段继续使用既有 `props.valueField`，不新增 `responseMapping.value`。

理由：协议已有 `valueField`、`xField`、`yField`、`labelField` 等组件级字段映射机制，`responseMapping` 只解决“响应包裹层字段名不同”的问题，不重复承担组件内部字段选择。

### D4. 默认行为保持向后兼容

未声明 `responseMapping` 时：

- `table` 列表接口继续按 `{ list, total }` 解析；服务端分页模式下缺少 `total` 为格式错误。
- `chart` 继续默认期望响应体为裸数组。
- `statCard` / `text` 继续默认读取响应对象，并通过 `props.valueField` 选择展示字段。
- `select.optionsSource` 继续默认期望响应体为裸数组；若未来需要对 `optionsSource` 的包裹响应做映射，应在 `optionsSource` 契约中另行标准化，不复用 `data.responseMapping`。

### D5. Renderer 失败处理

若声明了 `responseMapping`，但路径不存在或映射结果类型不符合组件预期：

- Renderer 应把该节点视为数据加载失败，进入节点级错误态；
- 开发环境日志应包含缺失路径、节点 `id`（若有）和组件 `type`；
- 生产环境只展示错误态，不暴露响应细节。

该行为与 `08-renderer-spec.md` 的节点级错误边界、失败隔离策略保持一致。

## 合并清单

| # | 内容 | 目标文档 |
|---|---|---|
| M1 | `DataRef` 增加可选 `responseMapping` 字段 | `01-node-protocol.md` |
| M2 | 替换 `04-datasource-contract.md` 中 planned 段落为正式字段说明 | `04-datasource-contract.md` |
| M3 | Renderer 数据加载后增加响应映射阶段 | `08-renderer-spec.md` |
| M4 | `node.schema.json` 的 `DataRef` 增加 `responseMapping` 结构 | `schemas/node.schema.json` |
| M5 | 更新 0012 审计 checklist 与 `audit/README.md` 跟踪项 | `docs/audit/` |

## 后果

**正面：**
- 兼容遗留系统响应字段名，不要求所有后端立即改成 `list` / `total`。
- 请求参数与响应解析配置分离，避免 `params` 语义混乱。
- 映射能力保持为结构化点路径，不扩大表达式引擎能力边界。

**负面 / 取舍：**
- 不支持复杂响应转换。需要聚合、过滤、改名、计算时，仍需后端适配或 Renderer 扩展。
- `select.optionsSource` 暂不复用该字段，避免把 Node `data` 契约和组件私有远程选项契约混在一起。
