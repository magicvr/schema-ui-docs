---
status: accepted
date: 2026-07-18
applies_to: schema-ui-protocol v2.0
---

# ADR-0015: 数据请求生命周期与 latest-wins

## 决策

1. 每个数据消费 Node 维护单调递增的 request generation，首次请求为 `1`。
2. 会改变该 Node 最终请求的筛选、分页、排序、`$deps` 或数据源配置变化，必须先递增 generation，再发起新请求。
3. 只有响应 generation 等于当前 Node generation，且 Node 仍处于 mounted/active 状态时，才允许提交数据、loading 结束态或错误态。
4. 旧请求应尽力取消；取消失败不改变第 3 条的提交条件。旧响应必须静默丢弃，不得覆盖新数据或错误态。
5. Node hidden 时不再提交其旧响应；是否立即取消由 Renderer 实现决定。Node unmounted 后必须取消或丢弃其所有未完成响应。
6. 同一 `source: ref` 的共享请求以实际请求 generation 为准；不同消费 Node 各自维护 active 状态，某一 Node 的隐藏或卸载不得使其他仍 active 的引用失效。

## 结果

该规则只定义可观测提交边界，不规定 AbortController、缓存或请求库。实现可取消请求，也可让请求自然完成，但不得让过期响应产生可见状态变化。

## 验收

`conformance/fixtures/request-lifecycle/cases.json` 覆盖顺序响应、乱序响应、隐藏和卸载；JS/Python reference 必须逐字段一致。
