---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.7
track: docs/release-goals/v2.7.md
---

# ADR-0033: 表单字段静态 `defaultValue`

## 状态

**Accepted（已接受，随 v2.7.0 发布）。** 任一表单字段声明 `props.defaultValue` 时，页面须 `meta.protocolVersion: "2.7"` 与 `form.controls.advanced`。

**Supersede** ADR-0028 D9「不做静态 defaultValue」的 **未来边界**；不改写 2.6 历史（2.6 字段无该 props）。

## 背景

创建页常需静态初值。仅靠 reaction `fulfill.value` 或后端默认会增加样板，且初值与 `recordSource` / reactions 优先级未写清。

## 决策

### D1. 声明面

- 在 **单字段** 表单控件 props 上增加可选 `defaultValue`（since 2.7）。
- 适用 type（有 `field`）：`input`、`inputNumber`、`textarea`、`switch`、`checkbox`、`radio`、`select`、`datePicker`、`upload`、`cascader`、`checkboxGroup`、`richText`、`password`。
- **不适用：** `dateRangePicker`（双 field；另案）、容器 / 非字段组件。
- 字面量类型 **必须** 匹配该字段 wire（L2 静态拒绝不匹配；错误码 `DEFAULT_VALUE_WIRE_MISMATCH`）。

| wire | `defaultValue` 允许 |
|---|---|
| string | JSON string |
| number | finite number |
| boolean | boolean |
| 单选标量 | 与 options value 同型标量 |
| array（multiple / cascader / checkboxGroup） | 数组（元素为合法标量） |

### D2. 初值算法（可 conformance）

对每个字段 `field`，Renderer 按序构造 `values[field]`：

| 步骤 | 时机 | 规则 |
|---|---|---|
| **S0** | 字段挂载 | 类型空值：boolean → `false`；array → `[]`；string 类 → `""`；number / 未定标量 → 视为未设（不写入或 `null`，实现须与「无 defaultValue 且无回填」的既有可观测一致） |
| **S1** |  thr 后立即 | 若声明 `defaultValue`，写入该字面量（覆盖 S0） |
| **S2** | `recordSource` 成功映射后 | 对每个映射成功的键：**覆盖** 当前值；wire 不匹配跳过（保留 S1/S0） |
| **S3** | reactions 批次 | `fulfill.value` / `otherwise.value` 按既有 ADR-0006 顺序 **覆盖** |
| **S4** | 用户编辑 | 覆盖当前值 |

要点：

1. **`recordSource` 优先于静态 `defaultValue`**（编辑回填不得被创建默认值盖住）。
2. **reactions 在 record 回填之后**仍可写值（与既有 reaction 时机一致；不因 defaultValue 改变 0006）。
3. 无 `recordSource` 的创建表：S1 即用户可见初值。
4. search form **允许** `defaultValue`（标量/boolean 进入 query 的既有规则不变）；**数组** default 仍受 search 禁止控件约束（若控件本身禁止出现在 search，则其 defaultValue 亦不可达）。

### D3. 门控

- 出现任一 `defaultValue` ⇒ `protocolVersion >= "2.7"` 且 `form.controls.advanced`。
- 合法无 `defaultValue`、无 2.7 新 type 的 v2.6 页行为不变。

### D4. 非目标

- 表达式型 default（仍用 reactions）。
- 按路由/权限切换多套 default 配置对象。
- 改变 `bodyMapping` 或 upload 生命周期。

## 后果

- 创建页样板减少；编辑页回填语义清晰。
- runtime-defaults / form-init fixtures 可锁定 S1–S3 覆盖序。
