---
status: stable
owner: 前端架构组
last_updated: 2026-07-11
applies_to: schema-ui-protocol v0.3
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
  protocolVersion: string   # 必填（since 0.2）。当前 RC 使用 "0.3"，Renderer 版本兼容锚点
  requiredCapabilities: [string] # 可选（since 0.2.6）。PATCH 级执行能力协商，如 actions.upload / actions.row.request

datasources:     # 【可选】页面级预声明数据源，供 body 内节点通过 ref 引用；仅允许 source: api 或 source: static，禁止 source: ref（引用链会导致递归风险）
  <sourceId>: DatasourceDeclaration

body: Node        # 页面主体，根 Node

actions:          # 【可选】页面级可复用动作定义（完整契约见 07-actions-contract.md）
  <actionId>: ActionDef
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `meta` | 是 | 页面元信息；其中 `pageId`、`title`、`protocolVersion` 必填，`description`、`requiredCapabilities` 可选 |
| `datasources` | 否 | 页面级数据源声明，仅允许 `source: api` / `source: static`，见 [04-datasource-contract.md](./04-datasource-contract.md) |
| `body` | 是 | 页面主体的根 Node |
| `actions` | 否 | 供 Node 内按钮/表单提交等引用的动作定义，完整契约见 [07-actions-contract.md](./07-actions-contract.md) |

> **`meta.protocolVersion`（since 0.2）：** 必填字符串，格式为 MAJOR.MINOR（当前 RC 使用 `"0.3"`），**不含 PATCH 或预发布标识**。Renderer 据此判断按哪套解析规则处理页面文档，是协议后续演进做版本兼容判断的锚点。同一 MAJOR.MINOR 的补丁或 RC 包共享该值；Renderer 的兼容性判断基于支持的 MAJOR.MINOR，不依赖包 PATCH。旧 `v0.1` 文档缺少该字段时仅可由显式 legacy adapter 处理；新建或修改的文档必须显式声明。

> **`meta.requiredCapabilities`（可选，since 0.2.6）：** 字符串数组，声明页面依赖的 Renderer 执行能力，用于补足 PATCH 级能力协商。`protocolVersion` 仍只表达结构版本；当 PATCH 版本新增需要 Renderer 执行支持的能力时，页面必须通过 `requiredCapabilities` 显式声明。Renderer 若不支持其中任一能力，应在静态校验阶段拒绝渲染，而不是进入运行时后部分失效。当前协议预定义能力键：`actions.upload`（使用 `actions[].type: upload` 或 `upload.props.actionRef` 时必填）、`actions.row.request`（使用 `table.props.actions[].actionRef` 时必填）。

## 3. Node 结构（核心）

一个 Node 只包含以下字段，不允许出现协议之外的自定义字段（前端可拒绝解析）：

```yaml
type: string            # 必填。渲染成什么组件
id: string               # 可选（since 0.2）。页面内唯一标识
props: map               # 可选。业务级配置参数
data: DataRef             # 可选。数据来源描述
children: [Node]           # 可选。子节点数组
reactions: [Reaction]       # 可选。声明式联动规则（支持 reactions 的组件位置见组件注册表）
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
  method: GET | POST | PUT | DELETE | PATCH  # source=api 时可选，缺省为 GET
  params: map        # 【可选】query 参数映射（不因 method 改变）；非空 key，值仅允许标量或完整单个 $deps.*（禁止对象/数组/模板拼接），见 ADR-0010 与 04 §3.1
  responseMapping: map # 【可选，since 0.2.4】响应字段名映射，见 04-datasource-contract.md §4.1.1
```

| source | 含义 |
|---|---|
| `static` | 值直接写死在 YAML 里 |
| `ref` | 引用页面级 `datasources` 中预声明的数据源，避免重复声明 |
| `api` | Node 独立发起一次请求（表格、图表等常用） |

各来源形态的字段集合互斥：`source: static` 仅携带 `value`；`source: api` 可携带 `url`、`method`、`params` 与 `responseMapping`；`source: ref` 仅携带 `ref`，并可在引用目标为 API 数据源时携带本地 `responseMapping` 覆盖响应解析。`source: ref` 不得混入 `url`、`method`、`params` 或 `value`，避免同一 `DataRef` 同时表现为引用和内联请求。

`source: api` 时 `method` **可选**，缺省为 `GET`。示例与生成配置可省略 `method`；Renderer 与静态校验均按 `GET` 解释缺省值。

`source: api` 的 `params` 对所有 method 均编码为 URL query 参数。`POST` / `PUT` / `PATCH` / `DELETE` 不会把 `params` 隐式改写为请求体；v0.2 的 DataRef 不定义请求体字段。需要携带 JSON body 的命令式请求应使用 Action，未来若数据加载确需请求体，应通过 ADR 增加独立字段。

`responseMapping` 仅用于 `source: api` 或引用到 API 数据源的响应解析，声明位置与 `params` 同级，不属于请求参数。协议禁止将 `responseMapping` 放入 `params`，也禁止在引用静态 datasource 的 `source: ref` 节点上声明本地 `responseMapping`；后者由能解析引用目标的 L2 校验执行。

### 3.4 `children`（可选）

子节点数组，仅布局类容器（`grid`/`section`/`form` 等）使用。
> **注意（since 0.2）：** `tabs` 的内容由 `items[].content` 承载，不再使用 `children`，见 `03-component-registry.md` 中 `tabs` 的定义。
子节点本身也是完整的 Node，因此可以任意深度嵌套。

### 3.5 `reactions`（可选）

声明式联动规则数组，仅允许出现在组件注册表标注支持 `reactions` 的位置：

| 挂载位置 | 默认/要求的 `scope` | 典型用途 |
|---|---|---|
| 表单字段类 Node（如 `input` / `select`） | `scope: form`（默认） | 字段间显隐/必填/禁用/赋值联动 |
| 表格 `columns[]` | 使用 `$row.*` 或列级 `$self` 时必须显式 `scope: row`；仅使用 `$deps.*` / `$context.*` 时可使用 `scope: form`（默认；表格须位于 form 上下文） | 行内单元格显隐/禁用 |
| 表格 `actions[]` | 使用 `$row.*` 时必须显式 `scope: row`；**任意 scope 禁止 `$self`**；仅使用 `$deps.*` / `$context.*` 时可使用 `scope: form`（默认；表格须位于 form 上下文） | 行内操作显隐/禁用 |

完整语法见 [02-reaction-expression.md](./02-reaction-expression.md)，结构如下：

```yaml
reactions:
  - dependencies: [string]     # form：依赖的表单字段名；row：`$row.` 之后的完整点路径（无 `$row.` 前缀，如 canRefund / user.id）
    when: string                 # 条件表达式
    fulfill: StateMap             # 条件为真时应用的状态
    otherwise: StateMap             # 【可选】条件为假时应用的状态
    scope: form | row              # 【可选，since 0.2】表达式求值作用域，form（默认）或 row
```

`StateMap` 只能包含以下语义级状态键：`visible`、`required`、`disabled`、`value`。
不允许声明组件私有 props 或任何样式相关的键。表格 `columns[]` / `actions[]` 上的 reactions（**无论** `scope`）以及任何 `scope: row` 的 reactions，其 `fulfill`/`otherwise` 仅允许 `visible` / `disabled`，`required` / `value` 由静态校验拒绝（见 [02-reaction-expression.md §9.3](./02-reaction-expression.md#93-fulfillotherwise-状态键的作用域限制)）。

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

对不支持 `states` 的组件（即 `component-registry.json` 中 `supportsStates` 不为 `true` 的全部组件）声明该字段时，Renderer 与 CI 校验应直接拒绝，而不是静默忽略。

> **校验实现说明：** `node.schema.json` 中 `states` 为通用可选字段，不包含基于 `supportsStates` 的条件约束。因此 L1（Node 结构校验）无法自动拒绝非支持组件上的 `states` 声明——此校验需要由 L2（组件契约校验）或 CI 自定义脚本实现，检查 `component-registry.json` 中该组件的 `supportsStates` 值。

### 3.8 `visibleWhen`（节点级条件渲染，可选，since 0.2）

控制整个节点（而非字段）是否渲染，独立于 `reactions` 的字段级联动。任何 Node 类型均可声明。

```yaml
visibleWhen:
  scope: form | row          # 【可选，since 0.2】表达式求值作用域，form（默认）或 row
  dependencies: [string]   # 显式声明的依赖字段名（无 $deps./$row. 前缀：form 为字段名，row 为 $row. 后缀完整点路径如 canRefund / user.id；可空数组；禁止带前缀字符串）。表单上下文中必填，非表单上下文可省略
  when: string               # 白名单表达式（与 reactions[].when 同语法）
```

- **表单上下文**（节点位于 `form` 内部）：`dependencies` 必填，表达式中可访问 `$deps.*`（声明字段）和 `$context.user.*` / `$context.features.*`；**不得**使用 `$self`、`$row.*` 或 `$parentRow.*`（`visibleWhen` 不是字段 `reactions`，无 `$self` 注入语义）。
- **非表单上下文**（如布局容器 `section`/`grid`）：`dependencies` 可省略，此时 `when` 中**仅**允许 `$context.user.*` / `$context.features.*`；出现 `$deps.*`、`$self`、`$row.*` 或 `$parentRow.*` 时静态校验拒绝。
- 表单上下文中的条件必填由能感知 Node 树位置的 L2 校验执行；即使表达式只读取 `$context.*`，也必须显式写 `dependencies: []`。
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

协议层不限制扩展动作键名；接入方可按需使用自定义动作键（如 `approve`/`export`），并通过项目级 CI/Review 约束其命名与适用范围。

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

> **注意：** `visibleWhen.when` 和 `reactions[].when` 中使用的 `$deps.*` 变量必须在对应位置的 `dependencies` 数组中显式声明；`scope: row` 下使用的 `$row.*` 必须将 **`$row.` 之后的完整点路径**（如 `canRefund`、`user.id`、`__index`）写入 `dependencies`，**不得**写 `"$row.canRefund"`。详见 [02-reaction-expression.md §8](./02-reaction-expression.md#8-校验建议)。
>
> **求值时序（since 0.2.4）：** 表达式引擎采用稳定快照模型。每一轮求值开始时，Renderer 冻结当前表单状态作为输入快照；本轮内 `visibleWhen`、`permissions` 与 `reactions.when` 都读取该快照。`reactions.fulfill.value` / `otherwise.value` 产生的写入在本轮结束时批量提交，不会影响同轮其他表达式读取；若写入改变了字段值，Renderer 在下一轮求值中读取新值。完整规则见 [02-reaction-expression.md §14](./02-reaction-expression.md#14-表达式求值时序模型since-024) 与 [decisions/0006](./decisions/0006-expression-evaluation-order.md)。

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
  protocolVersion: "0.3"

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
