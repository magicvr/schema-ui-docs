---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.1
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

datasources:     # 【可选】页面级预声明数据源，供 body 内节点通过 ref 引用
  <sourceId>: DataSourceDef

body: Node        # 页面主体，根 Node

actions:          # 【可选】页面级可复用动作定义
  <actionId>: ActionDef
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `meta` | 是 | 页面元信息，`pageId` 全局唯一 |
| `datasources` | 否 | 见 [04-datasource-contract.md](./04-datasource-contract.md) |
| `body` | 是 | 页面主体的根 Node |
| `actions` | 否 | 供 Node 内按钮/表单提交等引用的动作定义 |

## 3. Node 结构（核心）

一个 Node 只有以下 5 个字段，不允许出现协议之外的自定义字段（前端可拒绝解析）：

```yaml
type: string          # 必填。渲染成什么组件
props: map             # 可选。业务级配置参数
data: DataRef           # 可选。数据来源描述
children: [Node]         # 可选。子节点数组
reactions: [Reaction]     # 可选。联动规则数组（仅字段类 Node 可用）
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
  url: string        # source=api 时，独立请求的地址（method/params 见 04 文档）
  method: GET | POST
```

| source | 含义 |
|---|---|
| `static` | 值直接写死在 YAML 里 |
| `ref` | 引用页面级 `datasources` 中预声明的数据源，避免重复声明 |
| `api` | Node 独立发起一次请求（表格、图表等常用） |

### 3.4 `children`（可选）

子节点数组，仅布局类容器（`grid`/`section`/`tabs`/`form` 等）使用。
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
```

`StateMap` 只能包含以下语义级状态键：`visible`、`required`、`disabled`、`value`。
不允许声明组件私有 props 或任何样式相关的键。

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
