---
status: accepted
date: 2026-07-18
applies_to: schema-ui-protocol v2.0
---

# ADR-0017: 运行时默认值、baseURL 与必填属性

## 决策

1. JSON Schema 的 `default` 只描述协议默认值，不要求 Schema validator 修改输入；Renderer 在执行时物化默认值。
2. 当前执行默认值为：DataRef method `GET`、UploadAction method `POST`、retryPolicy `never`、upload fieldName `file`、upload multiple `false`、credentials `same-origin`、requestTimeout `10000ms`。
3. 页面包含任何网络 DataRef、optionsSource、Action、UploadAction 或 navigate URL 时，Renderer 初始化必须提供非空 `baseURL`；缺失时在发出请求前返回 `MISSING_BASE_URL`，不得猜测 same-origin 或拼接空字符串。
4. 缺少组件 Registry 标记的必填 props、或运行时未通过组件契约校验的 Node，必须进入结构化 `INVALID_COMPONENT` 占位状态；Renderer 不得猜测业务默认值继续执行。
5. 非必填字段的默认值只在对应组件契约或 ADR 中声明；宿主不得从 Markdown 示例推导额外默认值。

## 验收

协议文档、Schema descriptions、L2 和 Renderer 实现指南必须使用同一默认值表；网络请求入口必须覆盖 `MISSING_BASE_URL`。
