---
status: accepted
date: 2026-07-16
applies_to: schema-ui-protocol v2.0
---

# ADR-0013: DataRef 只读请求边界

## 状态

已接受（Accepted）。本 ADR 关闭 V236/V239，统一 DataRef 的执行方法和请求体语义。

## 背景

DataRef 用于页面加载、表格、图表和远程选项等读取场景，但旧契约允许 `POST`、`PUT`、`PATCH`、`DELETE`，并规定所有 `params` 都进入 URL query。这样一个自动加载 Node 可以触发业务写操作，且 body-based read API 没有统一表达方式。

## 决策

1. `source: api` 的 DataRef 只允许 `GET`；省略 `method` 等价于 `GET`。
2. 页面级 `datasources.*` 的 API 声明同样只允许 `GET`。
3. DataRef 不定义请求体字段。`data.params`、页面 datasource params 和 `optionsSource.params` 继续按 ADR-0010 进入 query；实现不得把它们隐式改写为 body。
4. `POST`、`PUT`、`PATCH`、`DELETE` 等命令式或写请求必须使用 Action，并遵守 Action 的重试和幂等契约。
5. 显式非 `GET` DataRef 使用标准错误码 `DATA_REF_METHOD_NOT_READ_ONLY` 拒绝；Schema、L2 和 reference executor 必须保持一致。
6. 若未来需要 body-based read API，必须通过新的 ADR 定义独立字段、允许方法、JSON 类型、空值和重试语义，不得复用 `params` 的旧含义。

## 后果

- 页面加载型协议不会隐式拥有写副作用。
- 需要请求体的读取接口必须显式扩展协议，不再由不同 Renderer 自行猜测。
- 旧配置中使用非 `GET` DataRef 的页面需要迁移到 Action 或新的协议版本。

## 验收

- Node/Page Schema 只接受 DataRef `GET`；
- L2 拒绝显式非 `GET` DataRef；
- JS/Python request construction 对相同非法输入返回相同错误码；
- 官方场景和 request fixtures 不包含非 `GET` DataRef。
