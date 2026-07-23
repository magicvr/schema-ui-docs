---
status: living-document
owner: 前端组件库团队
last_updated: 2026-07-13
applies_to: schema-ui-protocol v2.1
---

# 组件类型（type）注册表

> [`schemas/component-registry.json`](./schemas/component-registry.json) 是组件字段、能力和分类的机器可读结构契约；
> 本文档补充组件语义、示例和设计说明，不得另行定义与机器契约冲突的字段。
> 验证器和工具只读取机器契约。新增语义仍需先更新协议正文或 ADR，再更新机器契约和 conformance。
>
> **关于 `schemas/component-registry.json` 的格式说明：** 该文件使用**自定义 DSL 格式**（非标准 JSON Schema），`$schema` 标识为 `component-registry-dsl#`。其结构以自造键 `components` 组织组件目录、使用内联布尔值 `"required": true` 表达必填性——这些均非标准 JSON Schema 语法，不应使用 `ajv` 等标准校验器直接验证。与之对比，协议中实际的 JSON Schema 文件（`node.schema.json`/`page.schema.json`/`action.schema.json`/`reaction.schema.json`）均为合法标准格式。
>
> **DSL 约束关键字白名单：** 该 DSL 允许在组件级或 `props` 对象内借用以下 JSON Schema 风格组合约束关键字：`anyOf`、`oneOf`、`allOf`、`if`、`then`、`else`、`properties`、`const`、数组形式 `required`、`additionalProperties`。数值字段还可使用 `minimum`；`type: number` 只接受有限数，不接受 YAML `.nan` / `.inf` / `-.inf`。这些关键字仅用于表达组件字段之间的组合关系，不代表整个文件可作为标准 JSON Schema 处理。实现 L2 组件契约校验时，必须同时处理字段表和这些组合约束。
>
> **嵌套对象封闭性：** 具有固定协议字段表的嵌套对象必须显式声明 `additionalProperties: false`，例如 `tabs.props.items[]`、`table.props.pagination`、`table.props.columns[]` / `actions[]`、`select.props.options[]` 与 `optionsSource`。只有业务字典才允许动态键，例如 `tagMap` 的键来自后端数据值；其映射项本身仍是封闭对象。
>
> **两种 `required` 语义：** 字段定义中的布尔值 `required: true/false` 表示该字段在普通情况下是否必填；组合约束中的数组形式 `required: ["field"]` 表示当前 `anyOf` / `oneOf` / `if` / `then` / `else` 分支要求这些字段存在。若二者同时出现，以更具体的组合约束分支决定条件必填关系，例如 `form.mode=search` 时要求 `targetTable`，默认模式要求 `submitAction`。
>
> **v0.2 变更说明：** 本次更新涉及多处破坏性/新增字段；历史细节保留在仓库审计记录中，不属于协议制品。表格中新增字段标注 `(since 0.2)`。

## 如何阅读本表

每个组件类型包含：`type` 标识、用途、`props` 字段清单、是否支持 `children`、是否支持 `data`、是否支持 `reactions`（联动表达式，见 [02-reaction-expression.md](./02-reaction-expression.md)）、是否支持 `states`（空态/加载态/错误态，见 [01-node-protocol.md §3.7](./01-node-protocol.md#37-states可选since-02)）。

- `visibleField` 只能是合法的 row path（`A-Za-z_` 开头，后续为字母、数字、下划线和点），解析为 `$row.<path> == true`；不得写表达式、模板或包含 `$`。
- `grid.columns`、所有 `span` 和 server `pagination.pageSize` 必须是正整数；直接子节点的 `span` 不得超过父 grid 的 `columns`。


---

## 布局类

### `grid`
两栏/多栏网格容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `columns` | number | 是 | 栏数（语义级，非像素） |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

支持 `children`：是。支持 `data`：否。支持 `reactions`：否。支持 `states`：否。

### `section`
带标题的分区容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` / `titleKey` | string | 否 | 分区标题 |
| `span` | number | 否 | 在父级 grid 中占几栏 |

支持 `children`：是。支持 `data`：否。支持 `reactions`：否。支持 `states`：否。

### `tabs`
标签页容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `items` | array\<TabItem\> | 是 | 各标签页定义，见下 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

**TabItem（since 0.2）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 标签页标识 |
| `label` / `labelKey` | string | 是 | 标签页标题 |
| `content` | Node | 是 | 该标签页的内容节点（完整 Node，可任意嵌套） |

> **v0.2 变更：** `tabs` 的内容改为 `items[].content` 内嵌，不再依赖顶层 `children` 按 `key` 做归属匹配。`tabs` 自身**不再支持 `children`**（旧版 `supportsChildren: true` 已废弃）。

```yaml
type: tabs
props:
  items:
    - key: overview
      label: 概览
      content: { type: section, children: [...] }
    - key: detail
      label: 详情
      content: { type: table, ... }
```

支持 `children`：否（since 0.2，内容改由 `items[].content` 承载）。支持 `data`：否。支持 `reactions`：否。支持 `states`：否。

---

## 展示类

### `statCard`
统计数字卡片。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `label` / `labelKey` | string | 是 | 卡片标题 |
| `unit` | string | 否 | 单位文案 |
| `format` | enum: `plain`\|`currency`\|`percent` | 否 | 数值展示格式；currency/percent 要求 finite JSON number，类型不匹配返回 `COMPONENT_DATA_TYPE_MISMATCH`，不得强制转换 |
| `valueField` | string | 是（since 0.2） | 指定从 API 响应中取哪个字段作为展示值 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

> **v0.2 变更（A3，破坏性）：** `valueField` 从 `data.valueField` 迁移至 `props.valueField`，与 `table.columns[].field`、`chart.xField/yField` 的取值方式保持一致。

```yaml
# v0.2 写法
type: statCard
props:
  label: 今日订单数
  valueField: total
data:
  source: api
  url: /api/stats/order-count
```

支持 `children`：否。支持 `data`：是。支持 `reactions`：否。支持 `states`：是（since 0.2）。

### `chart`
图表。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `chartType` | enum: `line`\|`bar`\|`pie` | 是 | 图表类型 |
| `xField` | string | 是 | 横轴取值字段 |
| `yField` | string | 是 | 纵轴取值字段 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

支持 `children`：否。支持 `data`：是（返回值应为数组）。支持 `reactions`：否。支持 `states`：是（since 0.2）。

### `text`
纯文本展示。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` / `contentKey` | string | 是 | 静态文本内容；声明 `data` 时作为加载前/无数据时的兜底文案 |
| `valueField` | string | 否（since 0.2） | `data.source: api` 时，指定取哪个字段作为展示文本。未指定时 Renderer 默认取响应体的第一个字段值 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

> **v0.2 变更（A2）：** 修复 `supportsData` 说明矛盾，`text` 组件**支持 `data`**（`data.source: static/ref/api`）。`content` / `contentKey` 仍为必填，用作静态文本或数据加载前/无数据时的兜底文案；静态数据场景优先取 `data.value`，API 场景通过 `props.valueField` 指定取值字段（与 `statCard` 一致）。`valueField` 为可选，未指定时由 Renderer 取响应体第一个字段值作为展示文本。

支持 `children`：否。支持 `data`：是（since 0.2，原文档误标 `false`）。支持 `reactions`：否。支持 `states`：是（since 0.2）。

---

## 数据类

### `table`
数据表格，自动分页。完整契约见 [04-datasource-contract.md](./04-datasource-contract.md)。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` / `titleKey` | string | 否 | 表格标题；`titleKey` 可替代 `title` 提供 i18n key |
| `rowKey` | string | 是 | 行唯一标识字段名 |
| `pagination.mode` | enum: `server`\|`client`\|`none` | 是 | 分页模式 |
| `pagination.pageSize` | integer | server 模式必填 | 服务端分页首次请求使用的正整数页大小；client/none 模式不使用 |
| `columns` | array\<ColumnDef\> | 是 | 列定义，见下 |
| `actions` | array\<RowAction\> | 否 | 行内操作，见下 |
| `selection` | object | 否（since 2.2 / ADR-0022） | 多选；`mode: multiple`（MVP 唯一值）；使用时声明 `table.selection`；当前页选中，筛选/翻页/排序/reload 清空 |
| `toolbar` | array\<ActionTrigger\> | 否（since 2.1 / ADR-0020） | 表格工具栏入口；使用时声明 `actions.page.trigger`；可含 `requiresSelection` / `batchMapping`（ADR-0022） |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

**ColumnDef：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `field` | string | 对应数据字段名 |
| `label` / `labelKey` | string | 列标题（i18n：`labelKey` 可替代 `label`） |
| `format` | enum: `plain`\|`currency`\|`datetime`\|`tag` | 展示格式（默认 `plain`）；currency 要求 finite JSON number，datetime 要求 string，类型不匹配返回 `COMPONENT_DATA_TYPE_MISMATCH` |
| `tagMap` | map | `format: tag` 时，值 → `{text, tone}` 的映射。`tone` 可选值：`warning`\|`success`\|`neutral`\|`info`\|`danger` |
| `visibleWhen` | object | 可选（since 0.2.1）。列条件渲染；读取 `$row.*` 时必须 `scope: row`；仅 `$context.*`（或表格位于 `form` 内时的 `$deps.*`）可用默认 `scope: form`。语法见 [02-reaction-expression.md](./02-reaction-expression.md) |
| `reactions` | array | 可选（since 0.2.1）。列联动规则；读取 `$row.*` 或列级 `$self` 时必须 `scope: row`；`fulfill`/`otherwise` **无论 scope 仅允许** `visible`/`disabled` |
| `permissions` | map | 可选（since 0.2.1）。列级权限控制，表达式仅允许 `$context.*` |

**RowAction（since 0.2.1 重构）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 操作标识；仅供前端识别行内操作类型，不引用顶层 `actions` |
| `actionRef` | string | 否（since 0.2.7） | 引用顶层 `type: request`（须 `actions.row.request`）或 `type: navigate`（须 `actions.row.navigate`，ADR-0021） |
| `requestMapping` | object | 否（since 0.2.7） | 引用 **request** 时必填非空；`path`/`query`/`body`；值仅字面量或 `$row.*`；不得与 `navigateMapping` 并存；见 [07 §3.1](./07-actions-contract.md#31-行级后端请求绑定since-027) |
| `navigateMapping` | object | 否（since 2.1 / ADR-0021） | 引用 **navigate** 时必填非空；仅 `path`/`query`；值仅字面量或 `$row.*`；不得与 `requestMapping` 并存；见 [07 §3.2](./07-actions-contract.md#32-行级导航绑定since-21-adr-0021) |
| `label` / `labelKey` | string | 是 | 操作文案 |
| `confirm` | string | 否 | 二次确认文案；行级后端请求中仅在 `visibleWhen` / `permissions` / `disabled` 判定通过后、构造请求前展示 |
| `visibleField` | string | 否 | 行级显隐语法糖（`visibleWhen` 的简化写法），取行数据中同名字段的布尔值作为显隐依据。解析阶段等价展开为 `{ scope: row, dependencies: [field], when: "$row.<field> == true" }`，展开后纳入 [01-node-protocol.md §3.10](./01-node-protocol.md#310-最终可见性优先级公式) 公式 |
| `visibleWhen` | object | 否（since 0.2.1） | 操作条件渲染；读取 `$row.*` 时必须 `scope: row`；仅 `$context.*`（或表格位于 `form` 内时的 `$deps.*`）可用默认 `scope: form`。语法见 [02-reaction-expression.md](./02-reaction-expression.md) |
| `reactions` | array | 否（since 0.2.1） | 操作联动规则；读取 `$row.*` 时必须 `scope: row`；`fulfill`/`otherwise` **无论 scope 仅允许** `visible`/`disabled` |
| `permissions` | map | 否（since 0.2.1） | 操作级权限控制，表达式仅允许 `$context.*` |

> **行内操作执行边界：** 未声明 `actionRef` 时，`RowAction.key` 只用于 Renderer 将点击事件分发给前端预注册的行内操作处理器，并由该处理器接收当前行上下文。声明 `actionRef` 且目标为 `request` 时，按 [ADR-0008](./decisions/0008-row-action-backend-request.md) / [07 §3.1](./07-actions-contract.md#31-行级后端请求绑定since-027) 执行；目标为 `navigate` 时按 [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) / [07 §3.2](./07-actions-contract.md#32-行级导航绑定since-21-adr-0021) 执行。`key` 仍为入口标识，不是顶层 action id。

**ActionTrigger（since 2.1 / ADR-0020）：** 页面级动作入口，无行上下文。用于 `table.props.toolbar[]` 与组件 `actionButton`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 入口标识（埋点/测试）；不引用顶层 `actions` |
| `label` / `labelKey` | string | 是（其一） | 文案 |
| `actionRef` | string | 是 | 引用顶层 `request` \| `navigate` \| `modal`；禁止 `upload`/`custom` |
| `confirm` | string | 否 | 二次确认 |
| `disabled` | boolean | 否 | 静态禁用 |
| `requiresSelection` | boolean | 否（since 2.2） | 仅 `table.toolbar`；`true` 时选中数为 0 则 disabled；要求同 table 有 `selection.mode: multiple` |
| `batchMapping` | object | 否（since 2.2） | 仅 `table.toolbar` + `type: request`；**要求同 table `selection.mode: multiple`**；`body` 可用 `$selection.keys`；见 [ADR-0022](./decisions/0022-table-selection-and-batch-request.md) / [07 §3.5](./07-actions-contract.md#35-批量请求绑定since-22-adr-0022) |
| `visibleWhen` / `permissions` | object | 否 | toolbar 项上 `visibleWhen` 仅 `$context.*`；`actionButton` 作 Node 时遵循普通 Node 规则 |

页面级 Trigger 触发的 `request` **禁止 GET**（仅 POST/PUT/PATCH/DELETE）。完整规则见 [ADR-0020](./decisions/0020-page-action-trigger.md)。批量见 [ADR-0022](./decisions/0022-table-selection-and-batch-request.md)。

**作用域说明（since 0.2.1）：** 列/操作内的 `visibleWhen`/`reactions` 可通过 `scope` 属性声明求值作用域；`permissions` 固定仅允许 `$context.*`，不参与 `scope` 语义：
- `scope: form`（默认）：表达式在表单级求值，可访问 `$deps.*`（表单字段），不可访问 `$row.*`。**注意：仅当表格本身位于 `form.children` 内（如搜索表单嵌入表格场景）时，`$deps.*` 才合法；独立表格的列/操作中即使声明 `scope: form`，`$deps.*` 仍被静态校验拒绝（见 [02-reaction-expression.md §9.1](./02-reaction-expression.md#91-作用域隔离规则)）。
- `scope: row`（显式声明）：表达式在行级求值，可访问 `$row.*`（当前行数据），不可访问 `$deps.*`；`$context.*` 两种作用域下均可访问。
- **状态键限制（列/操作 reactions）：** 表格 `columns[]` / `actions[]` 上的 `fulfill`/`otherwise` **无论 `scope`** 仅允许 `visible`/`disabled`，禁止 `required`/`value`（列与操作不是表单字段，无必填/回写语义）。

> **`visibleField` 与 `visibleWhen` 关系：** `visibleField` 是 `scope: row` 的 `visibleWhen` 的语法糖。同时声明两者时，以显式 `visibleWhen` 为准，`visibleField` 被忽略。

```yaml
# 推荐新写法（$row 表达式）
actions:
  - key: refund
    label: 退款
    actionRef: refundOrder
    requestMapping:
      path:
        orderId: $row.orderId
    visibleWhen:
      scope: row
      dependencies: [canRefund]
      when: "$row.canRefund == true"

# 等价语法糖（兼容写法）
actions:
  - key: refund
    label: 退款
    visibleField: canRefund
```

支持 `children`：否。支持 `data`：是（契约见 04 文档）。支持 `reactions`：否。支持 `states`：是（since 0.2）。

### `actionButton`（since 2.1 / ADR-0020）

页面级动作按钮 Node，结构为 ActionTrigger 字段 + 可选 `span`。使用时声明 `actions.page.trigger`。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 入口标识 |
| `label` / `labelKey` | string | 是（其一） | 文案 |
| `actionRef` | string | 是 | 顶层 `request` \| `navigate` \| `modal` |
| `confirm` | string | 否 | 二次确认 |
| `disabled` | boolean | 否 | 静态禁用 |
| `span` | number | 否 | 父级 grid 栏数 |

支持 `children`：否。支持 `data`：否。支持 `reactions`：否。支持 `states`：否。Node 级 `visibleWhen` / `permissions` 可用。

---

## 表单类

### `form`
表单容器。支持两种模式：
- **默认模式**（`mode` 未指定或 `mode: default`）：提交时执行 `submitAction` 动作（发请求/导航等）。
- **搜索模式**（`mode: search`）：作为表格的筛选条件区，提交时触发表格刷新（带当前表单字段值作为请求参数），不执行 `submitAction`。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` / `titleKey` | string | 否 | 表单标题 |
| `submitAction` | string | 默认模式下是 | 引用顶层 `actions` 中的动作 id。搜索模式下不需要（`mode: search` 时忽略此字段） |
| `mode` | enum: `default` \| `search` | 否（since 0.2.1） | 表单模式。`search` 模式将表单用作筛选器 |
| `targetTable` | string | 搜索模式下是 | `mode: search` 时必填，声明关联表格的 Node `id`，提交时触发表格重新请求 |
| `recordSource` | object | 否（since 2.1 / ADR-0021） | 编辑记录 GET 加载；默认模式可用，**search 禁止**；使用时声明 `form.record.load`；见下 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

**`recordSource`（ADR-0021）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `method` | `GET` | 是 | 只读加载；**必填**，不得省略（审计 0062 / V270） |
| `url` | string | 是 | baseURL 下单斜杠相对路径；可含 `{name}`；**仅内联**，不得 ref datasources |
| `path` / `query` | object | 否 | 扁平 map；值 = 字面量或 `$context.route.query.*` / `$context.route.params.*` |
| `responseMapping` | object | 是（非空） | form `field` → 响应 JSON 点路径；禁止缺省同名自动映射 |

挂载后自动 GET 一次；成功后按 mapping 回填字段并重置 reactions baseline；失败进入错误态且不提交。映射源路径缺失时该字段可观测值为 JSON `null`（等价空初始值，不中止整次回填；ADR-0021 D5a / V273）。提交仍走 `submitAction` + 提交投影；id/version 等须映射到**仍参与提交投影**的字段（推荐只读可见字段）。

```yaml
# 搜索表单示例（form + table 包裹在 section 中作为 body 的单一 Node）
body:
  type: section
  children:
    - type: form
      props:
        mode: search
        targetTable: orderTable
      children:
        - type: dateRangePicker
          props:
            startField: dateFrom
            endField: dateTo
            label: 下单日期
        - type: select
          props:
            field: status
            label: 订单状态
            options:
              - { label: 全部, value: '' }
              - { label: 待处理, value: pending }
              - { label: 已完成, value: completed }
        - type: input
          props:
            field: keyword
            label: 关键词
            placeholder: 订单号/客户名

    - type: table
      id: orderTable
      data:
        source: api
        url: /api/orders
      props:
        rowKey: id
        pagination:
          mode: server
          pageSize: 20
        columns:
          - field: orderNo
            label: 订单号
          - field: date
            label: 下单日期
          - field: status
            label: 状态
            format: tag
```

> **搜索模式下数据流：** 搜索表单字段值 → Renderer 收集为 query 参数 → 附加到 `targetTable` 的有效 API 数据源 → 将 `page` 重置为 `1` 并重新请求。有效数据源必须是目标 table 的内联 `data.source: api`，或 `data.source: ref` 最终指向的 API datasource；无 `data`、静态数据或静态引用由 L2 拒绝。表格原有静态 params 与搜索表单参数自动合并，搜索参数优先级更高，Renderer 分页/排序状态最后覆盖。`page`、`pageSize`、`sort` 是保留名，搜索表单的 `field` / `startField` / `endField` 不得使用。`mode: search` 下的 `dateRangePicker` 以 `startField`/`endField` 作为两个独立参数传递；其他字段类组件以各自的 `field` 值作为参数名。清空筛选、翻页与排序状态转换见 [ADR-0011](./decisions/0011-reserved-query-params.md)。
>
> **搜索模式与 actions 的关系：** `mode: search` 时 `submitAction` 被忽略。搜索表单不需要独立的动作定义——提交行为被协议层定义为"刷新目标表格"，不经过 `actions` 路由。

支持 `children`：是（字段类 Node）。支持 `data`：否。支持 `reactions`：否。支持 `states`：否。

### `input`
文本输入控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API）。支持 `reactions`：是。支持 `states`：否。

### `inputNumber`
数字输入控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `min` | number | 否（since 0.2.1） | 最小值 |
| `max` | number | 否（since 0.2.1） | 最大值 |
| `step` | number | 否（since 0.2.1） | 步长 |
| `precision` | number | 否（since 0.2.1） | 保留小数位数 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

```yaml
type: inputNumber
props:
  field: age
  label: 年龄
  min: 1
  max: 150
  required: true
```

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API）。支持 `reactions`：是。支持 `states`：否。

### `upload`
文件上传控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key，提交时值为已上传文件的 URL 或文件 ID 数组） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `accept` | string | 否 | 接受的文件类型（MIME，如 `image/*,.pdf`） |
| `maxSize` | number | 否 | 最大文件大小，单位字节且必须 ≥ 0（如 `5242880` 表示 5MB） |
| `multiple` | boolean | 否 | 是否支持多文件上传（默认 `false`） |
| `action` | string | 与 `actionRef` 二选一 | 上传接口地址（相对路径，baseURL 由 Renderer 拼接） |
| `actionRef` | string | 与 `action` 二选一（since 0.2.5） | 引用顶层 `actions` 中 `type: upload` 的动作 id；使用时页面必须声明 `meta.requiredCapabilities: [actions.upload]` |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

```yaml
type: upload
props:
  field: contractFiles
  label: 合同附件
  accept: .pdf,.doc,.docx
  maxSize: 10485760    # 10MB
  multiple: true
  action: /api/files/upload
  required: true
```

> **上传流程：** Renderer 在文件选择后自动发起上传请求。若声明 `action`，请求发送到该 URL，`accept` / `maxSize` / `multiple` 由组件 props 控制；若声明 `actionRef`，请求和这三项上传约束均以对应顶层 `upload` action 为唯一来源，组件不得重复声明。上传成功后，`field` 的值设置为后端返回的文件 URL 或文件 ID。提交表单时（通过 `submitAction`），该字段值随表单一起提交，不再重新上传文件。
>
> **数据格式：** 单文件上传时值为字符串，多文件上传时值为字符串数组。每文件一个 multipart 请求，多文件按选择顺序串行；全部成功后一次性提交数组，任一失败不提交部分值。响应优先取非空 `url`，否则取非空 `id`。完整规则见 [ADR-0012](./decisions/0012-upload-execution.md)。

支持 `children`：否。支持 `data`：否。支持 `reactions`：是。支持 `states`：否。

### `select`
下拉选择控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `options` | array\<{label/labelKey,value}\> | 与 `optionsSource` 二选一 | 固定选项列表；选项文案可使用 `labelKey` 国际化，`label` / `labelKey` 至少提供一个 |
| `optionsSource` | OptionsSource | 与 `options` 二选一（since 0.2） | 远程动态选项，见下 |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

**OptionsSource（since 0.2）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | 是 | baseURL 下的单斜杠相对远程选项接口地址 |
| `params` | object | 否 | 请求参数。key 必须非空，值仅允许 string / finite number / boolean / null，或**完整单个** `$deps.<path>` 整值替换；禁止对象、数组和模板拼接。`null`/`undefined` 删除最终 query 中的同名 key；序列化见 [ADR-0010](./decisions/0010-query-serialization.md) / [04 §3.1](./04-datasource-contract.md#31-dataparams--optionssourceparams--datasourcesparams-中-deps-的空值省略规则) |
| `labelField` | string | 是 | 响应数据中作为选项文案的字段 |
| `valueField` | string | 是 | 响应数据中作为选项值的字段 |
| `searchable` | boolean | 否 | 是否支持远程搜索；为 true 时 Renderer 追加保留 query `keyword`，空值删除该参数 |

```yaml
type: select
props:
  field: cityId
  label: 城市
  optionsSource:
    url: /api/options/cities
    params:
      provinceId: $deps.provinceId
    labelField: name
    valueField: id
    searchable: true
```

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API，远程选项通过 `optionsSource` 单独处理）。支持 `reactions`：是。支持 `states`：否。

### `datePicker`
日期选择控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `format` | string | 否 | 日期展示格式（仅控制前端展示，如 `YYYY/MM/DD`）；数据格式统一使用 ISO 8601（`YYYY-MM-DD`） |
| `min` | string | 否 | 可选最小日期（有效的 ISO 8601 日历日期，严格 `YYYY-MM-DD`） |
| `max` | string | 否 | 可选最大日期（有效的 ISO 8601 日历日期，严格 `YYYY-MM-DD`） |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

```yaml
type: datePicker
props:
  field: orderDate
  label: 订单日期
  format: YYYY/MM/DD
  min: "2024-01-01"
  required: true
```

支持 `children`：否。支持 `data`：否。支持 `reactions`：是。支持 `states`：否。

### `dateRangePicker`
日期范围选择控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `startField` | string | 是 | 起始日期字段名（表单提交时的 key） |
| `endField` | string | 是 | 结束日期字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |
| `min` | string | 否 | 可选最小日期（有效的 ISO 8601 日历日期，严格 `YYYY-MM-DD`） |
| `max` | string | 否 | 可选最大日期（有效的 ISO 8601 日历日期，严格 `YYYY-MM-DD`） |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

```yaml
type: dateRangePicker
props:
  startField: dateFrom
  endField: dateTo
  label: 日期范围
  required: true
```

支持 `children`：否。支持 `data`：否。支持 `reactions`：是。支持 `states`：否。

> **reactions 注意事项：** `dateRangePicker` 拥有 `startField` / `endField` 两个字段值，其 `reactions` 语义与单字段组件不同，需注意以下约定：
>
> | 场景 | 约定 |
> |---|---|
> | 其他字段如何依赖 `dateRangePicker`？ | 在 `dependencies` 中填写 `startField` 和/或 `endField` 的**值**（而非组件 `id`）。`$deps.<startField>` 取起始日期（ISO 8601 字符串），`$deps.<endField>` 取结束日期（ISO 8601 字符串） |
> | `dateRangePicker` 自身的 `reactions` 中 `$self` 代表什么？ | `$self` 在此处代表一个 `{ start: string, end: string }` 对象（两个字段均为 ISO 8601 字符串或 `null`），可通过 `$self.start` / `$self.end` 分别访问。`$self` 的单个字段值变化即触发联动求值 |
> | `dateRangePicker` 自身 `reactions` 中能否引用自己的 `startField`/`endField`？ | 可以，在自己的 `dependencies` 中也填写 `startField`/`endField` 的值，通过 `$deps.<startField>` / `$deps.<endField>` 访问，语义与外部引用一致 |
> | `dateRangePicker` 自身 `reactions` 能否写入 `value`？ | v0.2 禁止。该组件绑定两个字段，没有单一写入目标；`fulfill` / `otherwise` 仅使用 `visible` / `required` / `disabled` |
>
> ```yaml
> # 示例：当日期范围起始日期早于 2026-01-01 时，隐藏备注字段
> - type: dateRangePicker
>   props:
>     startField: dateFrom
>     endField: dateTo
>     label: 日期范围
> - type: input
>   props:
>     field: remark
>     label: 备注
>   reactions:
>     - dependencies: [dateFrom]       # ← 使用 startField 的值，而非组件 id
>       when: "$deps.dateFrom < '2026-01-01'"  # ← $deps.dateFrom 是 ISO 8601 字符串
>       fulfill:
>         visible: false
> ```

> **搜索模式行为差异：** 当 `dateRangePicker` 位于 `mode: search` 的 `form` 中时，Renderer 将 `startField` 和 `endField` 分别作为**两个独立查询参数**传递给目标表格（参数名分别为 `startField` 和 `endField` 的值），而非合并为一个参数。这与普通表单提交的行为不同——普通表单中 `dateRangePicker` 作为表单字段按 `startField`/`endField` 分别提交，搜索模式下则是将这两个值作为表格 API 的 query 参数。详见 [form 组件搜索模式说明](#form)。

---

## 组件生命周期标注（since 0.2，B9）

`schemas/component-registry.json` 中每个组件/字段可携带以下元信息，用于开发环境输出迁移警告：

| 字段 | 说明 |
|---|---|
| `deprecated` | `boolean`，标注该组件/字段已废弃 |
| `deprecatedMessage` | 废弃说明及迁移建议 |
| `since` | 该组件/字段引入的协议版本（如 `"0.2"`） |

## 新增组件类型的流程

1. 用协议正文或 ADR 定义组件语义、跨端影响和版本策略。
2. 更新 [`schemas/component-registry.json`](./schemas/component-registry.json) 的字段、能力与分类。
3. 在本文档补充不与机器契约重复的使用语义和示例。
4. 增加正反场景或 conformance，并在 [CHANGELOG.md](./CHANGELOG.md) 中记录新增的 `type`。
