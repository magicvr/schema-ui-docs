---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.7
track: docs/release-goals/v2.7.md
---

# ADR-0032: 密码字段 `password`

## 状态

**Accepted（已接受，随 v2.7.0 发布）。** 使用时声明 `meta.protocolVersion: "2.7"` 与 `form.controls.advanced`。

**Supersede** ADR-0028 D9「password 用 input + 宿主呈现、不进本包」的 **未来边界**；不改写 2.6 历史。

## 背景

密码输入 wire 与 `input` 同为 string，但 OBJECTIVE 要求 **专用 type**，以便多端识别遮罩与回显策略，而不仅依赖 Host 约定。

## 决策

### D1. 注册与门控

| 项 | 值 |
|---|---|
| `type` | `password` |
| capability | `form.controls.advanced` |
| `protocolVersion` 下限 | `"2.7"` |

### D2. Wire

| 项 | 值 |
|---|---|
| wire | **string**（与 `input` 相同） |
| 空值 | `""` |
| `required: true` | 非空字符串 |

### D3. 呈现与安全（Host 义务，协议可观测边界）

1. Host **必须**以遮罩控件呈现（不得默认明文 `input`）。
2. Host **不得**在协议诊断日志中输出该字段明文（实现责任；conformance 不测浏览器）。
3. **回填：** `recordSource` 映射到 `password` 时，若值为 string 则写入 values（wire 合法）；Host **不得**把回填明文显示给用户（保持遮罩空或占位）。类型不匹配仍跳过。
4. 协议 **不**保证传输加密、存储哈希或 autocomplete 策略——属传输层 / Host。

### D4. reactions

- `$self` 为 string；`fulfill.value` 仅 string 或清空。
- 比较与其它 string 字段相同（ADR-0016）。

### D5. 非目标

- 密码强度 meter、双次确认控件、OAuth。
- 改变 wire 为 hashed 或 object。

## 后果

- 页面可声明 `type: password` 获得跨 Renderer 识别；安全仍靠 Host + 传输。
- 提交投影与 `input` 无异，便于复用 formAction fixtures。
