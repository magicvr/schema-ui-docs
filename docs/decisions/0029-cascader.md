---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.7
track: docs/release-goals/next-admin-lifecycle.md Phase D.1 / F1e → release-goals/v2.7.md
---

# ADR-0029: 级联选择 `cascader`（F1e）

## 状态

**Accepted（已接受，随 v2.7.0 发布）。** 使用时声明 `meta.protocolVersion: "2.7"` 与 `form.controls.advanced`。

本决策 **supersede** [ADR-0028](./0028-form-control-surface.md) D7/D9 中「`cascader` / F1e 不进 2.6」的 **未来交付边界**；**不**改写 v2.6.0 制品历史（2.6 仍无 `cascader`）。

## 背景

省市区、类目树等路径选择在中后台高频出现。v2.6 将 F1e defer，避免与 multi-select 数组 wire 未定边界一并爆炸。生产多端需统一 path 数组投影。

## 决策

### D1. 注册与门控

| 项 | 值 |
|---|---|
| `type` | `cascader` |
| capability | `form.controls.advanced` |
| `protocolVersion` 下限 | `"2.7"` |

### D2. Wire

| 项 | 值 |
|---|---|
| wire | **JSON 数组**：自根到叶的选项 `value` 路径（path array） |
| 空值 / 未选 | `[]` |
| `required: true` | 数组 length ≥ 1 |
| 元素类型 | 与静态 options 的 `value` 同型标量；禁止在同一树混用异型 value（L2 可检静态树） |

**不**采用「仅叶子 id」作为协议默认 wire（Host 可另投影，但标准提交/回填/reactions 以 path 数组为准）。

### D3. 选项

- MVP：**仅静态**嵌套 `options[]`：`{ label|labelKey, value, children? }`；`children` 为同构节点数组。
- **不**提供 `optionsSource`（动态树另案）。
- 选项 **不**走 Node `children`。

### D4. 提交 / 回填 / reactions

- 提交投影：path 数组进入 request body；`bodyMapping` 仅重命名字段。
- `recordSource`：目标值须为数组且元素为合法标量；类型不匹配 → 跳过键（`FIELD_WIRE_TYPE_MISMATCH`），不中止整表。
- reactions：`$self` / `$deps.<field>` 为 **array**；`contains` 可用；`fulfill.value` **仅整数组替换**（或协议清空语义）。

### D5. Search 禁止

`form.mode: search` 子树出现 `cascader` → L2 拒绝（`CASCADER_IN_SEARCH`；数组 query 未定义，与 ADR-0028 D6a / ADR-0010 一致）。

### D6. 非目标

- 异步懒加载树、多选级联、任意深度 UI 呈现 props。
- 修改 ADR-0010 query 标量总规则。

## 后果

- 合规 Renderer 须实现 path 数组投影与 capability `form.controls.advanced`。
- 页面从 Host 私有 cascader 迁到标准 type + `"2.7"`。
