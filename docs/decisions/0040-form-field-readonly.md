---
status: accepted
date: 2026-08-14
applies_to: schema-ui-protocol v2.9
---

# ADR-0040: 表单字段 `readOnly` 声明

## 状态

**Accepted（2026-08-14，审计 0082 A-001 self + A-002 grok 独立复核后）。** 本 ADR 增补表单字段只读声明（P-2 同批，下游 GOAL-015「dictKey
字段只读、显示类型名、提交仍传类型键」所需）。随 v2.9.0 MINOR 发布，capability
`form.controls.readonly`。

## 背景

### 缺口

协议表单控件**没有**字段级只读/禁用声明：

- `disabled` 仅存在于 `table.toolbar[]` 与 `actionButton`（ADR-0020/0022）；
- 表单字段的 `disabled` **状态**仅能由 reactions 写入（`fulfill.otherwise` 状态键
  `disabled`，`03` §字段 reactions），且该状态在提交投影中**排除该字段**
  （reference `buildFormActionRequest`：`field.disabled !== true` 过滤；fixture
  `form-action-projection-excludes-hidden-disabled-upload-error` 锁定）；
- 官方编辑场景的「只读可见字段携带 id/version」（ADR-0021 D4b 推荐写法、
  `05-scenarios/admin-list-edit-lifecycle.md`）实际只是**注释**——schema 中没有表达
  "只读但值参与提交"的机制，字段在协议层面仍可编辑；
- 下游 `schema-ui-core` 已用私有 renderer 扩展（FormControls `disabled` prop）实现
  "禁用但值仍进 values"，属于 Host 私货，不可互操作。

「只读但值仍提交」与「禁用且排除提交」是两种不同语义（HTML `readonly` vs `disabled`），
协议已有后者（reaction 状态 + 提交投影排除），**前者缺失**。本 ADR 补齐前者。

### 场景

- 主键/外键只读可见：编辑页 `orderId` / `version` 只读展示但必须进入 `bodyMapping`；
- 上下文字段只读：字典条目内页 create 表单 `dictKey` 由路由注入、只读展示类型键、
  提交仍传类型键（下游 GOAL-015）；
- 派生/回填字段只读：`recordSource` 回填或 reactions 写入的值不可由用户修改。

## 决策

### D1. 声明面

有 `field` 的**表单字段控件**新增可选 `props.readOnly: boolean`（since 2.9，缺省 `false`）：
`input` / `inputNumber` / `textarea` / `switch` / `checkbox` / `radio` / `select` /
`datePicker` / `dateRangePicker` / `upload` / `cascader` / `checkboxGroup` / `richText` /
`password`。容器/非字段组件不适用；`recordView.fields[]` 天然只读，不声明该 prop。

### D2. 语义

`readOnly: true` 的字段：

1. **用户不可编辑**：不提供编辑/选择/上传等交互入口，呈现为只读形态（含 `switch` /
   `checkbox` 等非文本控件，以只读形态展示当前值）；
2. **值仍参与提交投影**：字段值照常进入 `values` → `bodyMapping`（未声明 bodyMapping 时
   照常全量提交）。与 reaction 驱动的 `disabled` 状态（排除提交投影）语义**明确区分**；
3. **协议写入不受限**：`defaultValue`（S1）、`recordSource` 回填（S2）、reactions
   `fulfill.value` / `otherwise.value`（S3）照常写入 `readOnly` 字段——`readOnly` 只约束
   **用户编辑**，不约束协议驱动的值写入；
4. **校验照常**：`required` 校验仍应用于 `readOnly` 字段（值缺失时仍阻断提交，
   fail-closed；页面生产方须保证值源：defaultValue / recordSource / reaction / 路由注入）。

### D3. 与权限/联动的合成

- 静态 `readOnly: true` 与 `permissions.edit=false` / permissionCascade 的只读/禁用呈现
  **按 OR 合成**（任一生效即只读呈现，沿 ADR-0023 OQ-23-7「隐藏/禁用呈现合成」精神）；
- form 级 `edit=false` 的「提交不可执行」语义（ADR-0023）不受静态 `readOnly` 影响——
  静态 `readOnly` 不改变提交可执行性；
- search form 允许 `readOnly` 字段（值为固定筛选参数时；语义与既有 search 字段一致）。

### D4. 门控（L2 双重门控，fail-closed）

任一表单字段声明 `readOnly` ⇒

- `meta.protocolVersion >= "2.9"`；
- `meta.requiredCapabilities` 含 **`form.controls.readonly`**。

capability 登记 `capability-registry.json`：`sinceProtocolVersion: "2.9"`、`dependsOn: []`、
`mandatorySuites: ["component-format"]`。

### D5. 非目标

- **`type: hidden`**：不新增（ADR-0021 OQ-21-3 保持拒绝；隐藏字段与提交投影强耦合，
  单独设计才安全）；
- **静态 `disabled` prop**：不新增（与 reaction 驱动的 `disabled` 状态及提交投影排除语义
  重叠，且「禁用但提交」与「禁用且排除」的歧义需独立 ADR 裁决）；
- **表达式型 `readOnly`**：不新增（动态只读可由 permissions / reactions 组合表达；
  静态布尔保持最小面）；
- 不改 `recordView`（天然只读）与 `permissions` 语义。

## 后果

**正面：**

- 「只读可见且参与提交」成为一等声明，官方编辑场景的注释写法落地为机器契约；
- 下游 GOAL-015「dictKey 只读、提交传类型键」可声明式实现，消除 Host 私货分叉；
- 与既有 `disabled`（reaction 状态 + 投影排除）语义互补，无歧义叠加。

**负面 / 取舍：**

- 新增 capability 与版本下限门控；
- `readOnly` 是呈现/交互约束，跨 Renderer 的可观测差异主要在"是否提供编辑入口"，
  conformance 以结构（component-format）与门控（L2）为主，交互细节归组件库呈现层。

## 验收

- `03` 表单控件表新增 `readOnly` 行；`component-registry.json` 全部字段控件 props 同步；
- `06` L2 行、`08` 渲染义务同步；`02` §11.3 不涉及（readOnly 不是表达式）；
- L2 双重门控（版本 + capability）落盘；负例（2.8 页面声明 readOnly / 缺 capability）拒绝；
- component-format fixtures 增加 readOnly 形状用例；
- `capability-registry.json` 登记 `form.controls.readonly`；迁移 `2.8-to-2.9`、
  CHANGELOG、release-goals `v2.9.md` 原子交付。
