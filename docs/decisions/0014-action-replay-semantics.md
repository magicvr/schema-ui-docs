---
status: accepted
date: 2026-07-16
applies_to: schema-ui-protocol v2.0
---

# ADR-0014: Action 重试与幂等语义

## 状态

已接受（Accepted）。本 ADR 关闭 V237 的协议语义缺口。

## 背景

请求超时或网络中断时，客户端无法知道服务端是否已完成变更。旧契约只返回可重试错误态，没有定义重试是否属于同一次逻辑调用，也没有规定后端如何去重。

## 决策

1. `type: request` 和 `type: upload` 支持可选 `retryPolicy`：`never` 或 `idempotent`，缺省为 `never`。
2. `never` 表示 Renderer 不自动重发同一逻辑调用。超时/网络中断的结果为 `unknown`；用户重新提交会创建新的逻辑调用。
3. `idempotent` 表示 Renderer 为一次用户触发生成一个新的 invocation id，并将其作为 `Idempotency-Key` 请求头发送。该 key 在同一逻辑调用的所有重试中保持不变，不得由页面配置静态指定。
4. 后端必须按 Action 标识、HTTP method、目标 URL 和 `Idempotency-Key` 对同一逻辑调用去重，并复用第一次完成的成功或失败结果。相同 key 用于不同 Action、方法或 URL 时属于冲突，不能静默合并。
5. `AbortError` 代表用户主动离开页面，不产生可重试结果；HTTP 业务错误不是网络重放，按既有 HTTP 错误契约处理。
6. conformance harness 使用 `input.invocationId` 表示 Renderer 已生成的运行时 invocation id；页面 DSL 不携带该运行时值。

## 后果

- 前端可以区分“业务失败”和“服务端结果未知”；
- 后端拥有确定的去重键和冲突边界；
- 默认 `never` 不会改变现有请求体或 URL，只关闭未声明策略的自动重试；
- 生产 Renderer 和后端仍需直接消费同一套幂等 fixtures。

## 验收

- Action Schema、文档和 reference executor 支持 `retryPolicy`；
- idempotent 请求在 JS/Python reference 中产生相同的 `Idempotency-Key` 元数据；
- timeout/network fixture 标记 `unknown`；
- 缺少 invocation id、重复 key 和策略非法的输入均有稳定错误码。
