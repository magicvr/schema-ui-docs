---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.7
track: docs/release-goals/v2.7.md
---

# ADR-0030: 多选框组 `checkboxGroup`

## 状态

**Accepted（已接受，随 v2.7.0 发布）。** 使用时声明 `meta.protocolVersion: "2.7"` 与 `form.controls.advanced`。

**Supersede** [ADR-0028](./0028-form-control-surface.md) D4.5 / D9 中「不引入 checkbox 组、多值用 F1d」对 **未来协议表面** 的限制：v2.7 起提供一等公民 `checkboxGroup`。**不**改写 2.6 历史（2.6 仍无该 type）。

## 背景

勾选框组与多选下拉在 UI 上不同，但提交常同为「选项 value 数组」。OBJECTIVE 要求 checkbox 组为 **first-class multi-value surface**，不得仅依赖 Host 把 multi-select 画成勾选组。

## 决策

### D1. 注册与门控

| 项 | 值 |
|---|---|
| `type` | `checkboxGroup` |
| capability | `form.controls.advanced` |
| `protocolVersion` 下限 | `"2.7"` |

### D2. Wire（与 multi-select **同构**，入口不同）

| 项 | 值 |
|---|---|
| wire | **JSON 数组**，元素为选项 `value` 标量 |
| 空值 | `[]` |
| `required: true` | length ≥ 1 |
| 选项 | MVP **仅静态** `options[]`：`{ label|labelKey, value }`（无 `optionsSource`） |

与 `select.mode: multiple`：

- **wire 相同**（数组 of option values）；
- **type 不同**：页面可显式声明勾选组语义，Renderer 不得将 `checkboxGroup` 降级为未知 type 或私有别名。
- 二者可并存；L2 不强制互斥。

**不是**多个独立 `checkbox` boolean 字段的语法糖；一组对应 **一个** `field`。

### D3. 提交 / 回填 / reactions

与 multi-select 对齐：`bodyMapping` 重命名；回填数组 wire 校验；`$self` 为 array；`fulfill.value` 整数组替换；`contains` 可用。

### D4. Search 禁止

search form 子树禁止 `checkboxGroup`（`CHECKBOX_GROUP_IN_SEARCH`）。

### D5. 非目标

- 与 multi-select 合并为单一 type（保留展示语义入口）。
- 半选 / 全选 indeterminate 协议态。

## 后果

- 多端 YAML 可直接写 `checkboxGroup` 而不依赖 Host 私有 type。
- 实现方可复用 multi-select 投影代码路径，但 registry 须独立注册。
