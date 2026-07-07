---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.2
---

# 核心协议规范：Node 结构定义

> 本文档是整套体系中被引用频率最高的文档。任何字段的语义以本文档为准；
> 如与其他文档冲突，以本文档为准。机器可读版本见 [`schemas/node.schema.json`](./schemas/node.schema.json)。

## 1. Node 是什么

Node 是协议的最小单元：一个 YAML/JSON 对象，代表页面上的一个"东西"——可以是一个
布局容器（如网格、分区），也可以是一个具体控件（如统计卡片、表格、输入框）。

一个页面 = 一棵由 Node 组成的树。前端 Renderer 从根节点开始递归解析，按 `type`
分发到组件注册表中对应的组件实现（详见 [03-component-registry.md](./03-component-registry.md)）。

## 2. 顶层文档结构

```yaml
meta:            # 页面元信息
  pageId: string
  title: string
  description: string
  protocolVersion: string   # 必填（since 0.2）。如 "0.2"，Renderer 版本兼容锚点

datasources:     # 【可选】页面级预声明数据源，供 body 内节点通过 ref 引用
  <sourceId>: DataSourceDef

body: Node        # 页面主体，根 Node

actions:          # 【可选】页面级可复用动作定义（完整契约见 07-actions-contract.md）
  <actionId>: ActionDef
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `meta` | 是 | 页面元信息；其中 `pageId`、`title`、`protocolVersion` 必填，`description` 可选 |
| `datasources` | 否 | 见 [04-datasource-contract.md](./04-datasource-contract.md) |
| `body` | 是 | 页面主体的根 Node |
| `actions` | 否 | 供 Node 内按钮/表单提交等引用的动作定义，完整契约见 [07-actions-contract.md](./07-actions-contract.md) |

> **`meta.protocolVersion`（since 0.2）：** 必填字符串（如 `"0.2"`），Renderer 据此判断按哪套解析规则处理该页面文档，是协议后续演进做版本兼容判断的锚点。旧文档（v0.1）缺少该字段时，Renderer 应视为 `"0.1"` 并按兼容模式处理，但新建/修改的文档必须显式声明。

## 3. Node 结构（核心）

一个 Node 只包含以下字段，不允许出现协议之外的自定义字段（前端可拒绝解析）：

```yaml
type: string            # 必填。渲染成什么组件
id: string               # 可选（since 0.2）。页面内唯一标识
props: map               # 可选。业务级配置参数
data: DataRef             # 可选。数据来源描述
children: [Node]           # 可选。子节点数组
reactions: [Reaction]       # 可选。联动规则数组（仅字段类 Node 可用）
states: StatesMap          # 可选（since 0.2）。空态/加载态/错误态定制
visibleWhen: VisibleWhen   # 可选（since 0.2）。节点级条件渲染，见 §3.8
permissions: Permissions   # 可选（since 0.2）。权限控制，见 §3.9
```

### 3.1 `type`（必填）

字符串，对应组件注册表中的一个 key。前端组件库负责维护这张注册表并保证：
- 每个 `type` 都有明确的 `props` 参数契约（见 [03-component-registry.md](./03-component-registry.md)）。
- 未知 `type` 时，前端应渲染一个明显的"未识别组件"占位，而不是静默失败。

### 3.2 `props`（可选）

业务级配置参数，语义由 `type` 决定。**硬性约束：**
- 不允许出现 CSS 属性名（`margin`/`padding`/`color`/`fontSize` 等）。
- 允许出现语义级枚举（如 `format: currency`、`tone: warning`、`span: 1`）。
- `span`（占比）、`columns`（栏数）等布局参数是**语义级**的相对值，不是像素值。

### 3.3 `data`（可选）

描述该 Node 的数据来源，三选一：

```yaml
data:
  source: static | ref | api
  value: any        # source=static 时的字面量
  ref: string        # source=ref 时，指向 datasources 中的 key
  url: string        # source=api 时，独立请求的地址
  method: GET | POST
  params: map        # 【可选】请求参数映射，值可引用 $deps.*，空值规则见 04-datasource-contract.md §8
```

| source | 含义 |
|---|---|
| `static` | 值直接写死在 YAML 里 |
| `ref` | 引用页面级 `datasources` 中预声明的数据源，避免重复声明 |
| `api` | Node 独立发起一次请求（表格、图表等常用） |

### 3.4 `children`（可选）

子节点数组，仅布局类容器（`grid`/`section`/`form` 等）使用。
> **注意（since 0.2）：** `tabs` 的内容由 `items[].content` 承载，不再使用 `children`，见 `03-component-registry.md` 中 `tabs` 的定义。
子节点本身也是完整的 Node，因此可以任意深度嵌套。

### 3.5 `reactions`（可选）

仅表单场景内的字段类 Node 使用，用于表达"当依赖字段满足某条件时，本字段的状态如何变化"。
完整语法见 [02-reaction-expression.md](./02-reaction-expression.md)，结构如下：

```yaml
reactions:
  - dependencies: [string]     # 依赖的字段名（同表单内的兄弟/祖先字段）
    when: string                 # 条件表达式
    fulfill: StateMap             # 条件为真时应用的状态
    otherwise: StateMap             # 【可选】条件为假时应用的状态
    scope: form | row              # 【可选，since 0.2】表达式求值作用域，form（默认）或 row
```

`StateMap` 只能包含以下语义级状态键：`visible`、`required`、`disabled`、`value`。
不允许声明组件私有 props 或任何样式相关的键。

### 3.6 `id`（可选，since 0.2）

页面内唯一标识，用于滚动定位、埋点、增量更新/局部 patch 的锚点。Renderer 侧需对同一页面内的重复 `id` 做校验并报错。

```yaml
type: statCard
id: order_count_card
props:
  label: 今日订单数
```

### 3.7 `states`（可选，since 0.2）

组件级空态/加载态/错误态定制，仅对组件注册表中标注 `supportsStates: true` 的组件有效（详见 [03-component-registry.md](./03-component-registry.md)）。仅允许语义级文案/插画标识，不允许样式类字段：

```yaml
states:
  loading:
    text: 加载中...              # 加载态使用 text
  empty:
    text: 暂无数据                # 空态使用 text
    illustration: empty-box       # 可选，语义级插画标识
  error:
    fallbackText: 加载失败，请重试  # 错误态使用 fallbackText（区别于 text，强调"可恢复操作提示"而非纯展示文案）
```

> **语义区分：** `loading` 和 `empty` 使用 `text` 字段展示状态文案；`error` 使用 `fallbackText` 字段展示可操作的错误提示（如带重试按钮的引导文案）。`illustration` 为可选插画标识，三种状态下均可使用。Schema 定义中三个状态共享 `StateContent` 结构，但各状态下字段的**语义侧重点不同**，Renderer 实现时应按上述约定区分对待。

对不支持 `states` 的组件（如 `section`/`grid`/`tabs`）声明该字段时，Renderer 与 CI 校验应直接拒绝，而不是静默忽略。

> **校验实现说明：** `node.schema.json` 中 `states` 为通用可选字段，不包含基于 `supportsStates` 的条件约束。因此 L1（Node 结构校验）无法自动拒绝非支持组件上的 `states` 声明——此校验需要由 L2（组件契约校验）或 CI 自定义脚本实现，检查 `component-registry.json` 中该组件的 `supportsStates` 值。

### 3.8 `visibleWhen`（节点级条件渲染，可选，since 0.2）

控制整个节点（而非字段）是否渲染，独立于 `reactions` 的字段级联动。任何 Node 类型均可声明。

```yaml
visibleWhen:
  dependencies: [string]   # 显式声明的依赖字段名（表单上下文中必填，非表单上下文可省略）
  when: string               # 白名单表达式（与 reactions[].when 同语法）
```

- **表单上下文**（节点位于 `form` 内部）：`dependencies` 必填，表达式中可访问 `$deps.*`（声明字段）和 `$context.*`。
- **非表单上下文**（如布局容器 `section`/`grid`）：`dependencies` 可省略，此时 `when` 中仅允许 `$context.*`，出现 `$deps.*` 为静态校验拒绝。
- 表达式语法复用 [02-reaction-expression.md](./02-reaction-expression.md) 白名单解析器。

> `visibleWhen` 与 `reactions` 是并列关系，不是包含关系。`reactions` 描述"字段值变化 → 字段级副作用"；`visibleWhen` 描述"给定当前状态 → 该节点是否渲染"的静态判断。

### 3.9 `permissions`（权限控制，可选，since 0.2）

按用户身份控制节点/操作的可用性。值类型为按动作分组的映射表：

```yaml
permissions:
  view: string     # 可见性条件（$context.* 表达式）
  edit: string     # 可编辑/可操作条件（$context.* 表达式）
  delete: string   # 可删除条件（$context.* 表达式）
```

协议层预定义三个标准动作键：

| 动作键 | 表达式结果为 false 时的行为 |
|---|---|
| `view` | 节点不应存在于 DOM 中（用户无权限） |
| `edit` | 节点渲染为只读/禁用态，而非从 DOM 中移除 |
| `delete` | 对应操作按钮禁用/隐藏 |

接入方可在 `component-registry.json` 的组件契约中按需扩展自定义动作键（如 `approve`/`export`）。

> **权限判定语法**：`permissions.*` 的表达式复用与 `visibleWhen` 相同的解析器，但**仅允许使用 `$context.*`，禁止出现 `$deps.*`**（静态校验拒绝）。理由：权限判断只应依赖用户身份，不应混入业务字段状态。

### 3.10 最终可见性优先级公式

节点最终是否渲染由三个独立信号共同决定，按以下优先级 AND 计算：

```
最终 visible =
  permissions.view（若声明，优先级最高）
  AND visibleWhen.when（若声明，次优先级）
  AND reactions 计算出的 visible（若声明，最低优先级）
```

**规则：**
1. 三者均为 AND 语义，只能收紧不能放宽——任一环节为 `false`，后续环节即使为 `true` 也无法"救回"可见性。
2. `reactions` 始终求值，不因 `permissions.view` 或 `visibleWhen` 结果为 `false` 而跳过（保证赋值/校验等副作用正常执行）。
3. 三者均未声明时，节点默认可见。

> **注意：** `visibleWhen.when` 和 `reactions[].when` 中使用的 `$deps.*` 变量必须在对应位置的 `dependencies` 数组中显式声明，否则表达式无法正确求值。详见 [02-reaction-expression.md §8](./02-reaction-expression.md#8-校验建议)。
>
> **⚠️ 求值时序未定义问题：** 当某个字段同时被 `visibleWhen`（或 `permissions`）引用、又被同节点或其他节点的 `reactions.fulfill.value` 修改时，`visibleWhen` 读到的是变更前还是变更后的值——当前协议版本**未定义这个求值时序**。具体场景：A 字段的 `reactions.fulfill.value` 修改了 B 字段的值，而 B 字段的 `visibleWhen` 在同一渲染周期内读取该值。如果实际配置中遇到此类"同时读写"的场景，建议通过拆分表达式或将写入操作改为异步回调来规避时序歧义。此问题的正式解决方案留待后续版本讨论（详见 [ADR-0003](./decisions/0003-context-namespace-and-visible-when.md) 遗留问题章节）。

**容器节点级联**：容器（`section`/`grid`/`form` 等）最终 `visible` 为 `false` 时，其子树不展示，但子树内各节点的 `reactions` 仍按各自声明正常求值。子节点无需、也不应自行判断祖先可见性——级联隐藏是渲染层职责。

> `permissions.view=false` 与 `visibleWhen=false` 在容器级联行为上完全一致，共享同一套规则。

## 4. 与参考协议的概念对照

| 本协议 | Formily | RJSF | 说明 |
|---|---|---|---|
| `type` | `x-component` | `ui:widget` | 组件映射标识 |
| `props` | `x-component-props` | `ui:options` | 组件业务参数 |
| `reactions` | `x-reactions` | （无原生支持，需自定义） | 我们只保留 `dependencies`+`when`+`fulfill`，去掉 Formily 中 `effects`/`scope` 等运行时注入概念 |
| 单棵 Node 树 | schema 树 + `x-*` 内嵌 | `schema` 与 `uiSchema` 两棵平行树 | 我们选择单棵树而非两棵平行树，原因见 [decisions/0002](./decisions/0002-why-not-two-schema-uischema.md) |

## 5. 完整示例（最小可用页面）

```yaml
meta:
  pageId: hello_page
  title: 示例页面

body:
  type: section
  props:
    title: 你好
  children:
    - type: text
      props:
        content: 这是一个最小示例
```

更多完整场景请见 [05-scenarios/](./05-scenarios/)。

## 6. 国际化（i18n）字段约定（since 0.2）

`props` 中语义为展示文案的字段（如 `label`/`title`/`content`）均可用对应的 `xxxKey` 形式替代（如 `labelKey`/`titleKey`/`contentKey`）：

```yaml
type: input
props:
  field: customerName
  labelKey: form.customerName.label   # 替代 label
```

Renderer 优先按 `xxxKey` 查询 i18n 词典，查不到时 fallback 到未加 `Key` 后缀的原字段（若同时提供）。`xxxKey` 与原字段互为可选，二者至少提供一个。具体哪些字段支持 `xxxKey` 形式，见各组件在 [03-component-registry.md](./03-component-registry.md) 中的契约说明。
