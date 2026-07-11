---
status: accepted
date: 2026-07-11
---

# ADR-0010: Query 标量类型与字节级序列化

## 状态

已接受（Accepted）。本 ADR 关闭 v1.0 门禁 G2，统一 `data.params`、`datasources.*.params`、`optionsSource.params` 与 `requestMapping.query` 的最终 URL 序列化。

## 背景

当前协议允许 params 中出现递归对象和数组，却没有规定对象展开、数组表示、重复 key、已有 URL query 合并、空值和百分号编码。JavaScript 的 `URLSearchParams`、Java、.NET 和服务端框架默认算法并不一致，同一配置可能产生不同 URL 字节。

## 决策

### D1. v1.0 query 最终值只允许标量

四类 query 来源的配置值只允许：

- string；
- finite number；
- boolean；
- `null`；
- `data.params` / `optionsSource.params` 中完整单个 `$deps.<path>`；
- `requestMapping.query` 中完整单个 `$row.<path>`。

变量引用求值后的最终值也必须是上述标量或 `undefined`。对象、数组、`NaN`、正负 `Infinity` 均拒绝；不定义隐式 `String(value)`、JSON 字符串化或键展开。

参数 key 必须是非空字符串。复杂 query 结构留给后续 MINOR ADR，不进入 v1.0 RC。

### D2. 标量转文本规则

| 值 | 结果 |
|---|---|
| string | 原字符串，空字符串保留；必须是合法 Unicode scalar value 序列，拒绝孤立 surrogate |
| finite number | RFC 8785/JCS 的 IEEE-754 最短十进制表示；`-0` 规范化为 `0` |
| boolean | 小写 `true` / `false` |
| `null` | 删除该 key，不发送 |
| `undefined` | 删除该 key，不发送 |

`null` / `undefined` 是 tombstone：不仅不新增参数，还会删除更早来源或已有 URL 中的同名 key。这样“最终值为空则省略”在存在已有 query 时仍只有一种结果。

所有实现必须使用 RFC 8785/JCS 的 number serialization，而不是语言默认的 decimal formatter。这样指数阈值、指数符号和最短往返表示在 JavaScript、Java 与 .NET 中保持一致。

### D3. 来源合并与重复 key

公共序列化器接收 `baseUrl` 和按协议调用场景排列的 query 来源。G3 负责定义搜索、静态 params 和 Renderer 状态的具体来源顺序；本 ADR 只定义通用规则：

1. 先解析 `baseUrl` 已有 query；
2. 再按调用方传入的来源数组从前到后应用；
3. 后来源同名 key 整体覆盖前来源；
4. 同一来源出现重复 key 时最后一个值生效；
5. `null` / `undefined` 删除当前已合并结果中的同名 key；
6. 最终 URL 每个 key 最多出现一次。

已有 query 按 `&` 分段，按首个 `=` 分隔 key/value；没有 `=` 的 segment 视为空字符串值。空 segment 忽略。已有重复 key 最后一个生效。

### D4. 解码、排序和编码

已有 query 的 key/value 先做严格百分号解码：

- `%HH` 按字节还原并严格解码为 UTF-8；
- `+` 是字面量加号，不解释为空格；
- 非法 `%` 转义或非法 UTF-8 以 `INVALID_BASE_URL_QUERY` 拒绝；
- 解码后的空 key 以 `INVALID_QUERY_KEY` 拒绝。

合并后按解码后 key 的 Unicode code point 序列做升序词典排序。每个 key/value 以 UTF-8 编码，再按 RFC 3986 percent-encode：仅 `A-Z a-z 0-9 - . _ ~` 保持原字节，其余使用大写 `%HH`。空格必须是 `%20`，不得使用 `+`。

每个参数固定输出 `encodedKey=encodedValue`；空字符串因此输出 `key=`。最终 query 以 `&` 连接。

### D5. URL query 与 fragment

`baseUrl` 以首个 `#` 分为请求部分和 fragment，fragment 不参与 query 解析，最终逐字节附回。请求部分以首个 `?` 分为路径和已有 query。

- 最终没有参数时不输出 `?`；
- 最终有参数时输出一个 `?`；
- fragment 的内容与是否为空均保持不变；
- 本 ADR 不解析 scheme、host 或 path，也不规范化 path 字节。

### D6. 单一公共算法

DataRef、远程选项和行级 Action 必须调用同一 `serializeQuery(baseUrl, sources)` 算法。各调用点只负责解析变量和确定来源顺序，不得自定义数组展开、空值、排序或编码分支。

框架无关测试向量位于 `conformance/fixtures/query-serialization/cases.json`。JavaScript reference 和后端消费者必须对每个向量产生完全相同的 URL 字符串或结构化错误码。

## 后果

**正面：**

- URL 可按字节跨语言比较；
- 不依赖对象插入顺序、框架 query parser 或 form encoding 默认值；
- 空值和已有 URL 冲突有唯一结果；
- v1.0 无需承担对象/数组展开的复杂兼容面。

**负面 / 取舍：**

- 此前被 Schema 接受的对象/数组 params 将变为非法，需要迁移到后端适配或多个标量参数；
- 已有 query 会被重新排序和规范化编码；
- `+` 不再作为空格输入，原 URL 若需要空格必须使用 `%20`。