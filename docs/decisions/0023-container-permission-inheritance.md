---
status: proposed
date: 2026-07-23
applies_to: schema-ui-protocol post-v2.2 (unreleased)
track: docs/11-next-admin-lifecycle-goals.md Phase C.1 / P1 complement
---

# ADR-0023: 容器权限继承与操作级联

## 状态

**Proposed（待接受）。** 本文是对 [ADR-0003](./0003-context-namespace-and-visible-when.md) 遗留问题的候选裁决，尚未改变任何已发布页面的合法性或可观测行为。

在本 ADR 被接受并按“落地门禁”原子交付前：

- `permissionCascade`、`permissionIntent` 与 `permissions.inheritance` 都不是 v2.2 的合法协议字段或 capability；
- 本文不得进入 `protocol-manifest.json` 的 `authority.semanticSpecs`；
- Renderer 不得因本提案改变既有 `permissions` 的解释，也不得通过 Host 私有扩展把本提案描述为标准协议支持。

## 背景

ADR-0003 已确定两条相邻但不同的规则：

1. 容器 `permissions.view=false` 与 `visibleWhen=false` 一样，隐藏整个子树；
2. `permissions.edit=false` 或 `permissions.delete=false` 放在容器上时，是否影响子节点、表格操作和页面 Trigger，当时明确留作未决问题。

现有 `permissions` 可出现在 Node、表格列、RowAction 和 toolbar Trigger。若不定义跨这些挂载点的继承边界，各 Renderer 会分别用 `key`、HTTP method、URL 或 Host 私有字段猜测“编辑/删除”意图，既不能互操作，也容易把展示层权限误用为后端鉴权。

本提案只解决容器到其子树内既有标准权限键的**单调收紧**。后端仍必须独立鉴权；`$context` 仍只是 Renderer 的只读快照，不是安全边界。

## 业务锚点（候选 MVP）

1. 编辑页的 `form` 容器对当前用户只读时，其表单字段和提交入口均不可写，但页面仍可查看；
2. 订单列表的一个管理分区禁止删除时，明确标注为删除操作的行级和工具栏入口不可执行；
3. 子节点可以继续增加更严格的本地 `permissions`，但不能用本地规则放宽祖先限制。

不以“角色中途变化”“跨页选择”或完整权限中台作为本 ADR 的业务锚点。

## 候选决策

### D1. 保持 `view` 的既有级联，不追溯修改 v2.2

`permissions.view` 继续遵循 ADR-0003：容器最终不可见时，整棵子树不展示，子树内 `reactions` 仍按既有规则求值。本 ADR 不为 `view` 增加字段、capability 或新的 DOM 语义。

新能力只作用于显式标注的 `edit` / `delete` 继承边界。仅在 v2.2 页面上给容器写已有 `permissions.edit` 或 `permissions.delete`，不应被新 Renderer 追溯解释为开启继承。

### D2. 采用显式容器边界，而非隐式全局继承

候选新 Node 字段如下；示例仅说明目标形状，**在本 ADR 接受前不是合法页面配置**：

```yaml
type: form
permissions:
  edit: "$context.user.roles contains 'editor'"
permissionCascade:
  keys: [edit]
children:
  - type: input
    props:
      field: customerName
      label: 客户名称
```

#### D2a. 权限结构树与祖先路径

权限结构树以页面 `body` Node 为根，边集合固定如下：

| 边 | 目标 | 祖先关系 |
|---|---|---|
| Node 嵌套边 | `children[]` 中的 Node | 父 Node 是目标祖先 |
| Tabs 内容边 | `tabs.props.items[].content` 中的 Node | `tabs` Node 是内容根的祖先 |
| 表格操作挂载边 | `table.props.actions[]`、`table.props.toolbar[]` | 承载它们的 `table` Node 是挂载项祖先 |
| 表单提交边 | 默认模式 `form.props.submitAction` 的隐式提交入口 | 承载它的 `form` Node 是提交入口祖先 |

`actionButton` 是普通 Node；它的操作入口沿 Node 嵌套边取得祖先。顶层 `actions` 定义不是权限结构树节点，不能声明 `permissionCascade`。`actions[].type: modal` 的 `content` 以及 `navigate` 进入的新页面均是**新根**，不继承触发入口的祖先边界；modal 内部从自身 Node 开始重新计算。

`table.props.columns[]` **不在**权限结构树上、也**不是** cascade 目标：列没有 `permissionIntent`，不是 D4a 的 `edit` 目标，也不因祖先 `permissionCascade` 的 `edit`/`delete` 改变可观测行为。列继续只适用其自身声明的既有 `permissions`（与 v2.2 相同）；未声明则不额外限制。需要限制行/工具栏操作时，在 `actions[]` / `toolbar[]` 上使用 `permissionIntent` 或本地 `permissions`。

当前允许声明 `permissionCascade` 的 Node `type` 白名单为：`section`、`grid`、`form`、`tabs`、`table`。其中 `table` 因拥有表格操作挂载边、`tabs` 因拥有 Tabs 内容边而在白名单内；`actionButton` 不能声明该字段。未来新增可承载上述边的 type，必须先更新 ADR、组件 DSL 和 L2 白名单。

候选约束：

- `permissionCascade` 只能出现在上述白名单 Node 上；操作挂载项、列、顶层 Action 和 modal content 新根不得声明；
- `keys` 是非空、去重的 `edit` / `delete` 数组；MVP 不接收自定义动作键；
- 容器必须为 `keys` 中的每一个键声明同名 `permissions.<key>`，否则 L2 拒绝；
- 页面出现 `permissionCascade` 或 `permissionIntent` 任一字段时，必须声明候选 capability `permissions.inheritance`，并使用该能力发布时规定的下一个 MINOR `protocolVersion`。

显式边界避免把现有容器 `permissions` 的未定义行为悄悄改成继承，也让页面生产方能审计一项限制究竟从哪一级开始生效。

### D3. 有效权限只能收紧

对**参与 cascade 求值**的目标 `t` 和标准键 `k ∈ {edit, delete}`，候选有效权限为：

```text
effectivePermission(t, k) =
  AND(从根到 t 的路径上、每个声明了 k ∈ permissionCascade.keys 的祖先，其 permissions[k] 的求值结果)
  AND(t.permissions[k]，若 t 自身声明)
```

未声明的祖先边界和未声明的目标本地键都按 `true` 处理。任何祖先或本地表达式为 `false` 时，后代不能通过另一条表达式重新授权。所有表达式继续只读取 `$context.user.*` / `$context.features.*`，复用 ADR-0003 的快照与 L3a 规则。

#### D3a. 没有 `permissionCascade` 时只作用于本地

容器上的既有 `permissions.edit` / `permissions.delete` 在没有同名 `permissionCascade.keys` 时，只作用于该挂载点自身的既有语义，不向后代传递。若当前 type 没有对应的本地编辑/删除语义，则该声明对后代是 **no-op**，仍保持 v2.2 行为：

```yaml
type: section
permissions:
  edit: "false"       # 只限制 section 自身；不限制子 input
children:
  - type: input
    props: { field: name }
```

需要影响子树时必须显式声明 `permissionCascade: { keys: [edit] }`，不得把“容器上出现 `permissions.edit`”解释为历史隐式继承。`permissions.view` 的既有容器级联仍由 D1 约束，不受本节的 `edit` / `delete` opt-in 规则影响。

#### D3b. 谁参与 cascade 求值（与公式合用）

下列目标在键 `k` 上使用上一节的 `effectivePermission`（含祖先 cascade AND）：

| 目标 | 参与的 `k` | 条件 |
|---|---|---|
| default form 内 D4a 白名单字段 | `edit` | 字段位于 `form.mode` 缺省或 `default` 子树 |
| default form 的隐式提交入口 | `edit` | 见 D4a；无 `permissionIntent` 字段 |
| RowAction / toolbar Trigger / actionButton | `edit` 或 `delete` | 且 `permissionIntent` 等于该 `k` |

下列目标**不**把祖先 `permissionCascade` 计入有效权限（仅本地 `permissions`，与 v2.2 相同）：

- `table.props.columns[]`（任何键；列不在权限结构树上，见 D2a）；
- 未标注 `permissionIntent` 的操作入口（对 `edit`/`delete`）；
- `form.mode=search` 子树内的字段与搜索提交；
- 非 D4a 白名单的展示类 Node（如 `text` / `statCard` / `chart`）。

对不参与 cascade 的目标，Renderer 不得根据祖先 `permissionCascade` 改变其呈现或可执行性；本地 `permissions` 仍按既有规则求值。

### D4. `edit` 目标与操作意图必须显式闭合

#### D4a. 表单 `edit` 目标白名单

MVP 的可编辑表单字段 type 固定为当前组件注册表中的：`input`、`inputNumber`、`datePicker`、`dateRangePicker`、`select`、`upload`。只有这些字段及其未来经 ADR/DSL 明确加入的同类字段属于 `edit` 目标；`text`、`statCard`、`chart` 以及 `table.props.columns[]` 等纯展示内容不因 `edit` 继承改变（列规则见 D2a / D3b）。

- 仅 `form.mode` 缺省或 `mode: default` 的表单参与 `edit` 继承；`mode: search` 是筛选器，不参与 `edit` 级联，字段仍按既有筛选/禁用规则处理；
- 默认模式 `form.props.submitAction` 是隐式 `edit` 操作目标，不需要也不允许另加 `permissionIntent`；`mode: search` 没有该目标；
- `effectivePermission(t, edit)=false` 时，字段沿用既有 `permissions.edit=false` 的只读/禁用呈现，且默认表单提交入口不可执行，不得发出 Action 请求；静态 `disabled` 与有效权限按 OR 合成；
- `recordSource` 只负责 GET 回填，不改变字段是否属于 `edit` 目标；回填后的字段仍按有效 `edit` 权限处理。

#### D4b. `permissionIntent` 挂载点与 Action 类型矩阵

`permissionIntent` 只能写在下表列出的操作挂载点；它描述入口的业务意图，与 `actionRef` 的 HTTP/type 解耦：

| 挂载点 | 字段位置 | 允许的 `permissionIntent` | Action 关系 |
|---|---|---|---|
| RowAction | `table.props.actions[]` 直接字段 | `edit` / `delete` | `request`、`navigate` 或无 `actionRef` 的本地 `key` 均可；`navigate` 到编辑页可标 `edit` |
| toolbar Trigger | `table.props.toolbar[]` 直接字段 | `edit` / `delete` | `request`、`navigate`、`modal`；批量 request 仍受 ADR-0022 约束 |
| actionButton | `actionButton.props.permissionIntent` | `edit` / `delete` | `request`、`navigate`、`modal`，沿 ADR-0020 |
| form 默认提交 | 无字段，隐式目标 | 仅 `edit` | `form.mode=default` 的 `submitAction`；不允许再声明 `permissionIntent` |
| table columns / 顶层 actions | 不允许 | 不允许 | 列不在权限结构树、不吃 cascade（D2a/D3b）；顶层 Action 只是定义，不是入口 |

未在白名单位置出现 `permissionIntent` 时 L2 必须拒绝；未标注 intent 的操作入口不参与 `edit` / `delete` 继承，仍只适用其自身现有 `permissions`（D3b）。

示例（`navigate` 入口明确表达编辑意图）：

```yaml
actions:
  editOrder:
    type: navigate
    url: /orders/edit

body:
  type: table
  permissionCascade:
    keys: [edit]
  permissions:
    edit: "$context.user.roles contains 'editor'"
  props:
    actions:
      - key: edit
        label: 编辑
        actionRef: editOrder
        permissionIntent: edit
```

Renderer 必须在构造确认框、请求、导航或 modal 前应用有效权限；拒绝后的入口不可执行。是否以隐藏或禁用表现仍由对应组件的既有呈现契约决定，但不能出现可点击后仍发送动作的降级路径。

不得从 `RowAction.key`、`actionRef` 名称、HTTP method、URL 或文案推断操作意图：这些都不是稳定的协议语义。未标注 `permissionIntent` 的操作入口不参与 `edit` / `delete` 继承，仍只适用其自身现有 `permissions`。

### D4c. 统一执行时序与 fail-closed

`effectivePermission` 替换并扩展现有的 `permissions` 判定步骤，且**仅**对 D3b 中参与 cascade 求值的目标使用含祖先 AND 的公式；其余目标第 2 步退化为既有本地 `permissions` 判定。对 RowAction、toolbar Trigger、actionButton 和默认表单提交，统一执行顺序为：

1. `visibleWhen`（若声明）；
2. `effectivePermission` 或本地 `permissions`（按 D3b）；
3. `disabled`，并与 `requiresSelection` 按 OR 合成；
4. 若不可见、无有效权限或 disabled，立即停止，**不得**展示 `confirm`，不得构造或发送 request/navigate/modal/submit；
5. 展示 `confirm`（若声明），用户取消则停止；
6. 构造并执行 Action 或 form submit，随后执行既有 OutcomeBehavior。

因此，`permissions.inheritance` 只改变第 2 步中**参与 cascade 的目标**的有效值，不改变既有 `visibleWhen` 优先级、确认语义或请求通道。`requiresSelection` 仍然是独立的 disabled 来源；任何来源为 false/disabled 都不能被其它来源放宽。

呈现与可执行性分离：`edit=false` 沿现有契约显示为只读/禁用；`delete=false` 推荐在支持禁用的入口显示 disabled，不支持时可以隐藏。跨 Renderer 的强制不变量只有“不可执行”：隐藏或禁用不得成为第二个权限通道，也不得在确认前后绕过第 4 步。

### D5. 明确的非目标

- 不增加新的 `$context` 根命名空间、角色模型或后端鉴权机制；
- 不让自定义权限键自动继承；若真实需求出现，另开 ADR 定义其跨 Renderer 语义；
- 不把权限结果写入 URL、表单值、`$selection`、`reactions` 或 Action 请求体；
- 不支持跨页面、跨 modal 根节点或 Host 私有子树的隐式权限传播；
- 不改变 `permissions.view`、`visibleWhen`、`reactions` 的现有求值顺序和 AND 公式。

## 兼容性与版本影响

该能力新增 Node / 组件 DSL 字段和 Renderer 执行语义，接受后应作为**新的 MINOR**，而非 v2.2 补丁。旧页面不声明 `permissionCascade`、`permissionIntent` 或 `permissions.inheritance` 时，必须保持 v2.2 行为不变。

新 Renderer 可以同时支持旧版本与新 MINOR；但不得根据自身支持能力自动为旧页面开启继承。页面需要以 `meta.protocolVersion` 和 `meta.requiredCapabilities` 双重声明选择该语义。

## 落地门禁（接受时原子完成）

| 项 | 产物 |
|---|---|
| M1 | 本 ADR 状态改为 `accepted`，并写入 `protocol-manifest.json` 的 `authority.semanticSpecs` |
| M2 | `01-node-protocol.md` 定义 `permissionCascade`、有效权限公式、结构树边界与 v2.2 兼容规则 |
| M3 | `03-component-registry.md` 与组件 DSL 定义可参与 `edit` 的表单目标及各操作挂载点的 `permissionIntent` |
| M4 | Node Schema、组件 DSL、L2 与 L3a 校验：容器位置、键白名单、同名源权限、Intent 挂载点、capability 和版本下限全部 fail-closed |
| M5 | Renderer 规范与 JS/Python conformance fixtures：嵌套边界、祖先/本地 AND、旧页不变、表单禁用、删除入口拒绝、未标注意图不继承 |
| M6 | 官方或扩展示例、迁移说明、下一个 MINOR 发布目标、CHANGELOG、制品版本和 release gate 同步完成 |

## 接受前复核点

接受本 ADR 前应至少用一个表单只读场景和一个表格删除场景验证以下问题：

1. 组件注册表能否无歧义地区分可编辑表单目标与纯展示 Node；
2. `permissionIntent` 是否覆盖当前所有可操作挂载点，而不需要根据 Host 实现猜测；
3. 隐藏与禁用差异是否只影响呈现，不会让拒绝后的动作进入确认或请求构造；
4. 新 MINOR 的 Schema、L2、L3a 与跨语言 fixtures 能否用同一组向量表达上述规则。

若任一项不能形成跨 Renderer 的确定性行为，应收窄本 ADR 的 MVP，而不是以 Host 私有约定补足。

## 开放问题裁决（审计 0065 响应）

> 来源：[审计 0065](../audit/archived/0065-2026-07-23-review.md)（`0065/V287`–`V294`）。下表是**提案层裁决**，关闭的是可接受性歧义，不代表用户已接受 ADR，也不提前授权 Schema/L2/fixtures 落地。

| ID | 审计项 | 状态 | 裁决 |
|---|---|---|---|
| **OQ-23-1** | `0065/V287` 结构路径 | **Closed（提案层）** | 权限结构树固定为 Node `children`、`tabs.props.items[].content`、table 的 **actions/toolbar** 操作挂载边与 default form 提交边；**`columns[]` 不在树上、不吃 cascade**（仅本地 `permissions`）；`permissionCascade` 只允许 `section` / `grid` / `form` / `tabs` / `table`；table 是操作挂载祖先；modal content 与新页面是新根并切断祖先。D3b 写明 cascade 参与集合。 |
| **OQ-23-2** | `0065/V288` 表单 edit 目标 | **Closed（提案层）** | 可编辑 type 白名单为 `input` / `inputNumber` / `datePicker` / `dateRangePicker` / `select` / `upload`；只对 default form 生效；search form 不参与；default `submitAction` 是隐式 edit 目标；有效 edit=false 时字段只读/禁用且不提交。 |
| **OQ-23-3** | `0065/V289` intent 矩阵 | **Closed（提案层）** | `permissionIntent` 仅允许 RowAction、toolbar Trigger、`actionButton.props`；RowAction 可用于 request/navigate/local key，toolbar 可用于 request/navigate/modal，actionButton 可用于 request/navigate/modal；form submit 不写 intent；columns、顶层 actions 和其它位置由 L2 拒绝。 |
| **OQ-23-4** | `0065/V290` 无 cascade 语义 | **Closed（提案层）** | 容器上的 `permissions.edit/delete` 没有同名 `permissionCascade` 时只作用于自身既有语义，不传后代；无自效应时对后代为 no-op。需要传播必须显式 opt-in。 |
| **OQ-23-5** | `0065/V292` 执行时序 | **Closed（提案层）** | `effectivePermission` 替换现有 permissions 步骤，位于 `visibleWhen` 之后、`disabled`/`requiresSelection` OR 合成之前；不可见、无权或 disabled 均在 confirm 与构造请求前 fail-closed。接受后同步 `08`。 |
| **OQ-23-6** | `0065/V293` capability 门控 | **Closed（提案层）** | 出现 `permissionCascade` 或 `permissionIntent` 任一字段即要求 `permissions.inheritance` 与新 MINOR 版本下限；只有 intent、没有祖先 cascade 时仍合法但不改变有效权限；只有 cascade、没有 intent 时也合法。 |
| **OQ-23-7** | `0065/V294` 隐藏/禁用 | **Closed（提案层）** | 跨 Renderer 只约束“不可执行”：不得 confirm、构造或发送动作；隐藏/禁用不是第二权限通道。`edit` 推荐只读/禁用，`delete` 推荐 disabled，不支持 disabled 的组件可隐藏；接受后在 `03` 写回呈现建议。 |

## 审计结论（0065 响应，2026-07-23）

- V287–V294 已写回本 ADR 的裁决表；本提案仍保持 `proposed`，没有把审计意见或候选字段提升为 v2.2 权威。
- 0065 的“不可直接 accepted”条件已通过文档裁决消除，但 **接受决议仍未作出**；不得据此勾选路线图的 accepted 项或写入 `protocol-manifest.json`。
- 接受后仍须按 M1–M6 原子落地，并由新的发布审计验证 Schema、L2/L3a、fixtures、Renderer 规范和新 MINOR 制品。
- 细节与原始问题证据见 [`docs/audit/archived/0065-2026-07-23-review.md`](../audit/archived/0065-2026-07-23-review.md)。
