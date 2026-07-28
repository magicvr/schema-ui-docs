---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.7
track: docs/release-goals/v2.7.md
---

# ADR-0031: 富文本 `richText`（Markdown wire）

## 状态

**Accepted（已接受，随 v2.7.0 发布）。** 使用时声明 `meta.protocolVersion: "2.7"` 与 `form.controls.advanced`。

**Supersede** ADR-0028 D9 将「富文本」列为非目标的 **未来边界**；不改写 2.6 历史。

## 背景

备注/公告等常需富文本。开放 HTML/Delta/私有 JSON 会导致跨实现不可 conformance。须锁定 **单一 wire 格式**，并将 XSS 消毒划为 Host 责任。

## 决策

### D1. 注册与门控

| 项 | 值 |
|---|---|
| `type` | `richText` |
| capability | `form.controls.advanced` |
| `protocolVersion` 下限 | `"2.7"` |

### D2. Wire（锁定）

| 项 | 值 |
|---|---|
| wire | **string** |
| 格式 | **Markdown**（CommonMark 兼容文本；UTF-8） |
| 空值 | `""` |
| `required: true` | 非空字符串（与 `textarea` 一致：空串不满足必填） |

- **禁止**第二 wire 格式（HTML 源、Delta、ProseMirror JSON 等）作为协议默认。
- Host 可将 Markdown **渲染**为 HTML 展示；若后端历史存 HTML，须在进入协议字段前由 **调用方 adapter** 转为 Markdown（不在 Renderer 隐式 coercion）。

### D3. 安全边界

- 协议 **不**实现消毒器；**不**保证 XSS 安全。
- Host / 后端在展示 HTML 时负责 sanitization；协议只保证 string Markdown 的提交与回填一致性。

### D4. 提交 / 回填 / reactions

- 与 `textarea` 同构：string 进 body；回填须 string，否则 `FIELD_WIRE_TYPE_MISMATCH` 跳过。
- reactions：`$self` 为 string；`fulfill.value` 仅 string 或清空。

### D5. 非目标

- 编辑器 UI、工具栏、附件嵌入协议 props。
- `format` 枚举切换（避免双格式）。
- 代码编辑器 / 评分 / 滑条。

## 后果

- 跨实现可对 string Markdown 做字节级 fixture。
- 需要 HTML 往返的系统在边界做 adapter，不污染核心 wire。
