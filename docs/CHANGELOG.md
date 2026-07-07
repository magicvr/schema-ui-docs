# Changelog

本协议遵循语义化版本（MAJOR.MINOR.PATCH）：
- MAJOR：不兼容的协议结构变更
- MINOR：新增字段/组件类型，向后兼容
- PATCH：文档修订、示例补充

## v0.1.0 — 2026-07-07

初版发布。

**新增：**
- 核心 Node 协议：`type` / `props` / `data` / `children` / `reactions`
- 联动表达式引擎（`when` 白名单语法）
- 组件类型：`grid`、`section`、`tabs`、`statCard`、`chart`、`text`、`table`、`form`、`input`、`inputNumber`、`select`
- 数据源契约：`static` / `ref` / `api` 三种模式，`table` 分页契约
- 三个基础场景示例：网格看板、数据表格、表单联动
- JSON Schema 校验文件：`node.schema.json` / `reaction.schema.json` / `component-registry.json`
