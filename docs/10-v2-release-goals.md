---
status: candidate
owner: 前后端架构组
last_updated: 2026-07-16
applies_to: schema-ui-protocol v2.0
---

# v2.0 发布目标与门禁

本文档记录 v1.0 到 v2.0 的协议边界升级。v2.0 保留 v1.0 的组件、表达式和 query 序列化能力，但把 0059/V236–V240 已完成的安全和互操作收紧作为新的 MAJOR 版本原子发布。v1.0 页面不能直接进入 v2.0 标准 Renderer；迁移规则见 [`migrations/1.0-to-2.0.md`](./migrations/1.0-to-2.0.md)。

## 1. v1.0 到 v2.0 的边界

- v2.0 页面必须声明 `meta.protocolVersion: "2.0"`。
- Renderer 通过精确的 `supportedVersions` 协商版本，不做 v1.0 到 v2.0 的隐式兼容猜测。
- v1.0 页面继续由 v1.0 Renderer 消费，或由调用方显式执行迁移 adapter；adapter 输出必须重新通过 v2.0 的 L0–L4 和版本协商。
- DataRef 只允许 `GET`，其 `params` 继续只编码为 query；写操作和 body-based command 使用 Action。
- Action/Upload 的 `retryPolicy`、幂等 key 和 `unknown` 结果语义以 ADR-0014 为准。
- RowAction 只允许标量 own-property 值，并拒绝原型保留路径。
- 请求、上传、选项加载和导航 URL 只允许 baseURL 下单斜杠相对路径。

## 2. v2.0 阻断门禁

### G1. 严格版本协商

- [x] v2.0 页面、Renderer 支持列表和 version-negotiation reference 使用精确 `2.0` 向量。
- [x] v1.0 页面被 v2.0 标准 Renderer 明确拒绝；迁移 adapter 边界写入文档。
- [x] 未知 MAJOR/MINOR、缺失版本、畸形列表和 capability 错误仍按 ADR-0009 的固定顺序拒绝。

### G2. 请求和数据加载边界

- [x] DataRef 及页面 datasource 的非 GET 方法由 Schema、L2 和 JS/Python reference 一致拒绝。
- [x] DataRef、optionsSource 和 requestMapping.query 的 query 序列化继续使用同一套标量算法。
- [x] URL grammar 在请求、上传、选项和导航路径上统一收紧。

### G3. Action 执行语义

- [x] `retryPolicy: never | idempotent`、稳定 `Idempotency-Key` 和 `unknown` 结果在 request/upload/outcome fixtures 中逐字段一致。
- [x] RowAction 的 scalar、own-property 和原型保留路径边界在 L2、JS/Python reference 中一致。
- [x] HTTP 业务错误、主动中断、超时和网络中断保持可区分结果。

### G4. 跨实现发布制品

- [x] 8 个 versioned suites、官方场景、JS/Python reference 和辅助验证器统一消费 v2.0 协议 fixtures。
- [x] 核心规范、Schema、fixtures、场景、版本协商和迁移文档进入独立协议制品；MCP 仅声明捆绑版本。
- [x] `release:check` 对版本、迁移、fixture digest、协议内容 digest 和可复现 tar.gz 执行硬校验。

## 3. 发布工程门禁

- [x] `package.json`、`protocol-manifest.json`、lockfile 和核心文档统一为协议制品 `2.0.0` / 页面协议 `2.0`。
- [x] `1.0` 到 `2.0` 迁移指南覆盖 DataRef、query、pageSize、requestMapping、actions.upload、URL 和 Action 重试语义。
- [x] 官方场景和 algorithm fixtures 的 `protocolVersion` 全部更新为 `2.0`；历史版本协商反例保留并单独标识。
- [x] 版本协商正反例至少覆盖 v2.0 接受和 v1.0 页面被 v2.0 Renderer 拒绝。
- [x] 全部协议 conformance、场景校验、协议制品复现、链接检查和 release check 通过；MCP 由独立 CI 验证。

## 4. 版本纪律

v2.0 之后，继续遵守语义化版本：不改变 v2.0 合法输入和执行结果的文档勘误属于 PATCH；新增兼容字段或 capability 属于 MINOR；收紧合法输入、改变默认值或改变执行结果属于下一 MAJOR。核心规范、Schema、fixtures 和迁移文档必须作为同一协议版本原子发布。reference、验证器和 MCP 使用独立版本，只需显式更新支持或捆绑的协议制品版本。

## 5. 完成定义

只有 G1–G4、发布工程门禁和迁移证据同时满足，才能把当前 v2.0 发布物视为完成。v1.0 历史发布证据保留在 [`09-v1-release-goals.md`](./09-v1-release-goals.md)，不与 v2.0 的当前门禁混用。
