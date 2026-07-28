---
status: accepted
date: 2026-07-28
applies_to: schema-ui-protocol v2.6
track: docs/release-goals/next-admin-lifecycle.md Phase D.1.0 / F1 → release-goals/v2.6.md
---

# ADR-0028: 表单控件面扩展（F1：textarea / 布尔 / radio / 多选 / 级联）

## 状态

**Accepted（已接受，随 v2.6.0 发布）。** 字段与执行语义以本 ADR 及 `02` / `03` / `07` / `08` / Schema / L2 为准。使用时声明 `meta.protocolVersion: "2.6"` 与 `form.controls.extended`。

**交付范围：** 批次 **A+B**（F1a–F1d）。批次 **C**（`cascader` / F1e）**明确 defer**，不进入 2.6.0 制品与核心正例。

轨道依据：[`next-admin-lifecycle.md`](../release-goals/next-admin-lifecycle.md) §4 D.1.0 F1；发布门禁：[`v2.6.md`](../release-goals/v2.6.md)。

## 背景

v2.0–v2.5 已收敛 **Admin 生命周期骨架**（列表工具栏、行导航、记录回填、批量、权限继承、详情、应用壳、表排序）。表单字段 type 仍仅：

| 已有 | 提交值形态（wire） |
|---|---|
| `input` | string |
| `inputNumber` | finite number |
| `select` | 单值标量（选项 `value`） |
| `datePicker` | ISO 8601 date string |
| `dateRangePicker` | 两字段 date string |
| `upload` | string 或 string[]（文件 url/id） |

生产中后台表单几乎总会用到：长文本、布尔开关、单选按钮组、多选标签、省市区/类目级联。继续用 Host 私有 type 会导致多 Renderer / 多后端页面生产方 **字段 type 与提交投影分叉**，与「任意前端 × 任意后端」冲突。

`next-admin-lifecycle.md` 将本包登记为 **F1（建议优先）**；前后台 demo 与中小型 admin 的真实痛点已足够触发立项。本 ADR **不**吞并 F2 子表、F3/F4 导入导出、F5 异步任务。

## 业务锚点（MVP）

| ID | 锚点 | 用户路径 | 协议落点 |
|---|---|---|---|
| F1a | 长文本 | 备注、描述、驳回原因 | 新 type `textarea` |
| F1b | 布尔 | 启用/禁用、是否公开 | 新 type `switch`、`checkbox` |
| F1c | 互斥枚举（按钮组） | 少量状态/类型 | 新 type `radio` |
| F1d | 多选 | 角色、标签、多类目 | 扩展 `select.props.mode: multiple` |
| F1e | 级联 | 省市区、类目树 | **v2.6 defer**（不注册 `cascader`） |

验收叙事：同一订单/用户编辑 YAML 在任意合规 Renderer 上，上述字段的 **type 识别、提交 JSON 投影、recordSource 回填、reactions `$deps`/`$self` 类型** 一致——无需 Host 私有字段 type。

## 决策

### D0. 版本包与交付批次

| 批次 | 范围 | v2.6 门禁 |
|---|---|---|
| **A（阻断）** | F1a `textarea` + F1b `switch`/`checkbox` + F1c `radio` | **已纳入** `2.6.0` |
| **B（同 MINOR 交付）** | F1d `select` `mode: multiple` | **已纳入** `2.6.0` |
| **C（defer）** | F1e `cascader` | **不进入** `2.6.0`；后续 MINOR 另立 |

禁止「表单大爆炸」单 PR 无门禁吞并 F2+。本 ADR 只覆盖 F1；v2.6 仅 A+B。

### D1. capability 与版本门控

| 项 | 值 |
|---|---|
| capability | `form.controls.extended` |
| `protocolVersion` 下限 | `"2.6"`（L2 字段集下限；仅有 capability 不够） |

**出现即要求**（页面须同时满足版本 + capability）：

- 任一新 type：`textarea` / `switch` / `checkbox` / `radio`（**不含** deferred `cascader`）；
- 或既有 `select` 上声明 `mode: multiple`（F1d）。

未使用上述字段的合法 **v2.5** 页面语义不变；Renderer 可同时支持 `"2.5"` 与 `"2.6"`。

**不**为每个 type 拆 capability（避免组合爆炸）；**不**把本包并入 `form.record.load`。

### D2. 公共字段契约（与既有表单控件对齐）

下列 props 与 `input` 对齐（除非组件专节另述）：

| props | 说明 |
|---|---|
| `field` | 必填；表单字段名；同 form 内唯一 |
| `label` / `labelKey` | 至少一个 |
| `required` | 可选 boolean |
| `defaultVisible` | 可选 |
| `placeholder` / `description` / `tooltip` | 可选（`switch` 可不提供 placeholder） |
| `span` | 可选 |

- 支持 `reactions`：是；支持 `data`：否；支持 `children`：否（`cascader` 选项不走 Node children）。
- 提交投影：沿既有规则——已 mounted、visible、非 disabled、upload 非 error 的字段进入投影；`bodyMapping` 仍为源字段白名单。
- `form.recordSource.responseMapping` 目标键可映射到本包字段；回填值类型必须符合该字段 wire（D3–D6），类型不匹配时 **不得**隐式 coercion 写入（与 ADR-0016 精神一致）。**OQ-1 裁决：** 跳过该键（不写入 values；可观测 `skipped.<field>=FIELD_WIRE_TYPE_MISMATCH`），**不**中止整次 record load；缺失路径仍为 JSON `null`。

### D3. F1a — `textarea`

| 项 | 值 |
|---|---|
| `type` | `textarea` |
| wire | **string**（与 `input` 相同） |
| 空值 | 未填为 `""` 或未设；`required: true` 时空串不通过客户端必填 |

- **不**引入 `rows` / `maxLength` 等呈现或宿主校验字段（呈现层；宿主可本地增强但不得进核心 props）。
- reactions：`$self` / `$deps.<field>` 为 string；`fulfill.value` 只允许 string 或 null 清空（与 input 对齐的既有 value 写入规则，accept 时对照 `02`）。

### D4. F1b — `switch` 与 `checkbox`

| 项 | 值 |
|---|---|
| `type` | `switch` \| `checkbox` |
| wire | **boolean**（仅 JSON `true` / `false`） |
| 缺省未交互 | `false`（与「未勾选」一致；**不**使用 `null` 三态） |

| 差异 | 说明 |
|---|---|
| `switch` | 语义：开/关配置；UI 由 Renderer 映射为开关 |
| `checkbox` | 语义：是否同意/是否选中；UI 映射为勾选框 |
| wire | **相同**；协议不因 UI 形态改变提交类型 |

规则：

1. **禁止**用 string `"true"`/`"false"` 或 number `1`/`0` 作为协议 wire；回填与提交均为 boolean。
2. `required: true`：提交前值必须为 **`true`**（常见「必须勾选同意」）；值为 `false` 视为未满足必填。若业务只要「布尔存在即可」，不要设 `required`。
3. search 模式：boolean 进入表格 query 时沿 **ADR-0010** 序列化为小写 `true`/`false`。
4. reactions：`$self` 为 boolean；`==` / `!=` 按 ADR-0016；`fulfill.value` 只允许 boolean（或协议已有的清空语义，若有）。
5. **不**在本包引入 `checkbox.group`（多选框组）；多值用 F1d。

### D5. F1c — `radio`

| 项 | 值 |
|---|---|
| `type` | `radio` |
| wire | **单个选项 `value` 标量**（与单选 `select` 同构） |
| 选项 | `options[]`：`{ label|labelKey, value }`；**MVP 不提供** `optionsSource`（动态选项继续用 `select`） |

- 互斥：同一 `field` 仅一值；未选时按空/未设，`required` 与 `select` 对齐。
- 与 `select` 的差异是 **展示语义**（按钮组 vs 下拉），不是 wire。
- reactions / 提交 / 回填与单选 `select` 对齐。

### D6. F1d — `select` 多选

扩展既有 `select`（**不**新 type）：

```yaml
type: select
props:
  field: roleIds
  label: 角色
  mode: multiple          # 缺省 single（或省略）；single 行为与 v2.5 完全一致
  options: [...]          # 或 optionsSource（仍允许）
```

| 项 | `mode` 缺省 / `single` | `mode: multiple` |
|---|---|---|
| wire | 单标量（现状） | **JSON 数组**，元素为选项 value 标量；无选中为 `[]` |
| `required` | 有值 | 数组 length ≥ 1 |
| 选项 value | 既有 | 元素类型一致；禁止在同一 options 混用异型 value（L2 可检静态 options） |

**提交（default form → request body）：**

- 投影中该字段值为数组；`bodyMapping` 仍只做 **字段名重命名**，不展开数组元素为多 key。
- 这与「`bodyMapping` 值必须为字符串」的 **映射目标名** 约束不冲突；冲突点是历史叙述若暗示「请求体值皆标量」——accept 时须在 `07` 写明：**表单投影值允许本 ADR 定义的数组字段**；`bodyMapping` 的 map **值**仍是源 field 名字符串。

**搜索表单（`form.mode: search`）——MVP 边界（D6a）：**

ADR-0010 规定 query 最终值 **只允许标量**，且每个 key 最多一次。多选数组不能无 ADR 地进入 search query。

**MVP 裁决：L2 拒绝** `mode: multiple` 的 `select` 出现在 `mode: search` 的 form 子树中（错误码提案：`SELECT_MULTIPLE_IN_SEARCH`）。

- 多选筛选留待后续 MINOR（重复 key、CSV 或新 query 编码）独立扩展 0010；
- 避免 v2.6 破坏 0010 字节级稳定性。

**reactions：**

- `$self` / `$deps.<field>` 在 multiple 下为 **array**；
- `contains` 左操作数可为该数组（既有 `contains` 语义，ADR-0016）；
- `fulfill.value`：multiple 时只允许数组或清空；元素必须为选项 value 合法标量。

**optionsSource + multiple：** 允许；远程选项仍是「选项列表」，选中值仍是 value 数组。

### D7. F1e — `cascader`（批次 C — **v2.6 defer**）

**不进入 v2.6.0。** 不注册 `cascader` 组件；树选项 / path 数组 wire 留待后续 MINOR。标准入口对未知 type 仍 `UNKNOWN_COMPONENT_TYPE`。

### D8. L2 / 未知 type / 协商

1. 使用 D1 字段集 ⇒ `meta.protocolVersion >= "2.6"` 且 `requiredCapabilities` 含 `form.controls.extended`；否则 L2 fail-closed。
2. 未声明能力的 Renderer：标准入口对未知 type → `UNKNOWN_COMPONENT_TYPE`（既有）；不得降级为 `input`。
3. `select.mode` 仅允许 `single` \| `multiple`；未知值 L2 拒绝。
4. v2.5 页面不得出现本包 type / `mode: multiple`（版本字段集下限）。

### D9. 明确非目标（本 ADR / v2.6 不做）

- F2 嵌套子表 / array of objects 行编辑；
- F3/F4 导入导出向导、F5 异步任务；
- `checkbox` 组、可搜索 radio、富文本、代码编辑器、评分、滑条、颜色选择；
- `password` 专用 type（可用 `input` + 宿主呈现；不进本包）；
- 静态 `defaultValue` 字段（创建页默认值仍可用 reaction `fulfill.value` 或后端默认；另案）；
- 修改 ADR-0010 的「query 单 key 单标量」总规则（多选 search 另案）；
- 主题、密度、控件尺寸等呈现 props；
- **`cascader` / F1e**（本 MINOR defer）。

## 后果

### 对页面生产方

- 常用表单可去掉 Host 私有 `textarea`/`switch`/多选 type，改为标准 type + `form.controls.extended`。
- 多选 **不能** 用于 search form（MVP）；筛选多值需后端约定或等后续 query 扩展。

### 对 Renderer

- 实现 A+B 控件与 boolean/array 投影；
- `supportedCapabilities` 增加 `form.controls.extended`；`supportedVersions` 含 `"2.6"`；
- 布尔与数组不得按字符串凑合。

### 对协议仓库

- 原子更新：`03` / 组件 DSL / `02` / `07` / `08` capability 表 / L2 / fixtures / 场景 / 迁移 / CHANGELOG / 制品 `2.6.0`。

## 开放问题（已全部裁决）

| ID | 问题 | 裁决 |
|---|---|---|
| OQ-1 | recordSource 回填类型不匹配 | **跳过该键** + `skipped` 诊断；不中止整表 |
| OQ-2 | checkbox/switch + required | **必须为 true**（D4） |
| OQ-3 | F1d 是否同发 | **同发**（批次 B） |
| OQ-4 | F1e 是否同发 | **defer**（不进 2.6.0） |
| OQ-5 | multiple fulfill.value | **仅整数组替换** |
| OQ-6 | cascader wire | N/A（C defer） |

## 验收

- [x] 本 ADR 为 `accepted`；`applies_to: schema-ui-protocol v2.6`。
- [x] [`v2.6.md`](../release-goals/v2.6.md) G0–G4 与工程门禁关闭（A+B；C = N/A defer）。
- [x] JS/Python conformance 覆盖 textarea/boolean 提交、multiple 数组投影、wire mismatch skip、版本/capability 协商。
- [x] 扩展示例 `form-controls-extended`。
- [x] 合法无本包字段的 v2.5 页行为不变（opt-in）。


## Supersession（v2.7）

下列 **D9 非目标** 在 **v2.7** 由独立 ADR **接受为协议表面**（不改写本 ADR 对 v2.6.0 制品的历史结论）：

| 项 | v2.7 ADR |
|---|---|
| `cascader` / F1e | [0029](./0029-cascader.md) |
| checkbox 组 | [0030](./0030-checkbox-group.md) |
| 富文本 | [0031](./0031-rich-text.md) |
| password 专用 type | [0032](./0032-password.md) |
| 静态 `defaultValue` | [0033](./0033-form-default-value.md) |

v2.6 页面与制品仍不含上述字段；使用须升至 `"2.7"` + `form.controls.advanced`。
