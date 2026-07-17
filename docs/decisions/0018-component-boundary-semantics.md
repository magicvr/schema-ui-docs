---
status: accepted
date: 2026-07-18
applies_to: schema-ui-protocol v2.0
---

# ADR-0018: 组件边界语义收敛

## 决策

1. `select.optionsSource.searchable: true` 的 `keyword` 是 Renderer 保留参数；optionsSource.params 不得声明 `keyword`。空搜索词以 tombstone 删除 keyword，非空搜索词最后覆盖静态 params。
2. upload 未选择文件是 no-op，不发请求、不清除已有成功字段值；选择后客户端约束失败不发任何请求。多文件每个文件都是独立 invocation，`idempotent` 时每个文件获得独立 key，并在该文件重试中复用。
3. `currency`、`percent`、`datetime` 和 `format` 只定义语义格式，不规定 CSS 或具体 locale。`currency` / `percent` 输入必须是 finite JSON number（boolean 不属于 number），`datetime` 输入必须是 string；类型不匹配时 Renderer 返回 `COMPONENT_DATA_TYPE_MISMATCH` 并进入组件数据错误态，不得进行字符串/数字/布尔强制转换。datetime 字符串的具体日期格式继续由对应字段契约约束，本 ADR 不新增时区解析规则。
4. `grid.columns`、所有 `span`、table `pageSize` 必须为正整数；`span` 不得超过父 grid 的 columns，由 L2 在可确定的 Node 父子关系中拒绝。
5. `visibleField` 只能是合法 row path，等价展开为单个 `$row.<path> == true`，不得包含表达式、模板或 `$`。
6. `accept` token 两侧 ASCII whitespace 按 ADR-0012 处理；空 token 静态拒绝。

## 范围

本 ADR 不定义货币代码、时区数据库、并行上传、进度聚合或批量上传；这些能力需要新的字段和 capability。
