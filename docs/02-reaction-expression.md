---
status: stable
owner: 前端架构组
last_updated: 2026-07-23
applies_to: schema-ui-protocol v2.3
---

# 联动表达式引擎语法规范

> ⚠️ 本文档描述的是全协议中**唯一涉及"类代码"逻辑**的部分。
> 为了保证后端写的是"数据"而非"代码"，本表达式引擎的能力被严格收敛。
> 生成配置的开发者或 AI 助手必须严格遵守本文档的白名单，**不得**自行扩展语法。

## 1. 使用位置

表达式引擎在以下位置共享同一套语法和解析器（详见各文档对应章节）：

| 使用位置 | 所属字段 | 目标文档 |
|---|---|---|
| 表单字段联动 | `reactions[].when` | [01-node-protocol.md §3.5](./01-node-protocol.md#35-reactions可选) |
| 节点条件渲染 | `visibleWhen.when` | [01-node-protocol.md §3.8](./01-node-protocol.md#38-visiblewhen节点级条件渲染可选since-02) |
| 权限判定 | `permissions.*` | [01-node-protocol.md §3.9](./01-node-protocol.md#39-permissions权限控制可选since-02) |
| 表格列/行内操作 | `columns[].{visibleWhen,reactions}.when` | [03-component-registry.md](./03-component-registry.md) `table` 组件章节 |
| 数据请求参数 | `data.params`（仅整值替换，禁止模板拼接，不做条件判断） | [04-datasource-contract.md §3.1](./04-datasource-contract.md#31-dataparams--optionssourceparams-中-deps-的空值省略规则)（作用域见 [§3.2](./04-datasource-contract.md#32-dataparams--optionssourceparams-中-deps-的作用域边界)） |
| 远程选项参数 | `props.optionsSource.params`（仅整值替换，禁止模板拼接，不做条件判断） | [03-component-registry.md](./03-component-registry.md) `select` 组件章节 |

## 2. 变量命名空间（白名单）

| 变量 | 含义 | 可用位置 | 示例 |
|---|---|---|---|
| `$deps.<字段名>` | `dependencies` 中声明的依赖字段的当前值；在 `data.params` / `optionsSource.params` 中表示同表单字段的当前值，不需要额外 `dependencies` 数组 | `reactions`、`visibleWhen`(表单内)、`scope: form` 表达式、表单上下文内的参数值替换 | `$deps.orderType` |
| `$self` | 当前字段自身的当前值（字段级）；`dateRangePicker` 自身 reactions 中可受控访问 `$self.start` / `$self.end`；当前列对应单元格的原始数据值（`scope: row` 列表达式） | 表单字段 `reactions`、表格列 `scope: row` 表达式 | `$self` |
| `$context.user.*` | 当前用户身份信息（只读快照，最小字段集见 §11.1） | 条件表达式挂载点：`reactions` / `visibleWhen` / `permissions` / 表格列与操作表达式；**不含** `data.params` / `optionsSource.params` / `datasources.*.params` 值替换（见附录 A / §10.7） | `$context.user.roles` |
| `$context.features.*` | 功能开关映射表（只读快照，最小字段集见 §11.2） | 同上（条件表达式挂载点，不含 params 值替换） | `$context.features.newDashboard` |
| `$context.route.*` | 当前页路由只读快照（§11.3，since 2.1 / ADR-0021） | **已知** `$context` 根；**禁止**出现在普通 `reactions` / `visibleWhen` / `permissions`（L3a：`FORBIDDEN_CONTEXT_NAMESPACE`，非「未知根」；审计 0063 / V279）。MVP 仅用于 `form.props.recordSource` 的 path/query 整值绑定 | `$context.route.query.orderId` |
| `$selection.keys` | 当前页选中 rowKey 有序数组（since 2.2 / ADR-0022） | **仅** `table.toolbar[].batchMapping.body` 某字段的整值；**禁止** reactions / visibleWhen / permissions / params（L3a 视为未知变量；L2 另约束 batchMapping） | `$selection.keys` |
| `$selection.count` | 规范化后选中个数（= `keys.length`） | **仅** `batchMapping.query` 或 `body` 的标量字段；禁止 path 与表达式挂载点 | `$selection.count` |
| `$row.<字段名>` | 当前行的原始数据对象（未经格式化处理） | 表格 `columns`/`actions` 中 `scope: row` 表达式 | `$row.level` |
| `$row.__index` | 当前行在数据集中的序号（从 0 开始） | 同上 | `$row.__index` |
| `$row.__key` | 当前行的唯一标识（取表格 `rowKey` 字段值） | 同上 | `$row.__key` |

> **v0.2 边界（审计 0039 / V120）：** 当前组件 DSL 没有嵌套表格 Node 挂载结构，因此 `$parentRow.*` 不属于 v0.2 可用变量，L2/L3a 静态拒绝。未来若通过 ADR 定义可校验的嵌套表格结构，可再同步恢复该变量。

**禁止事项：**
- ❌ 不允许访问 `dependencies` 之外未声明的字段。
- ❌ 不允许访问全局对象、window、任何宿主环境变量。
- ❌ 不允许函数调用（包括 `Date.now()`、自定义函数等）。
- ❌ 不允许在 `scope: row` 表达式中访问 `$deps.*`（与 `$row.*` 互斥，见 §9.1）。
- ❌ 不允许在 `scope: form` 表达式中访问 `$row.*`。
- ❌ 不允许在 `permissions.*` 表达式中访问 `$deps.*`（静态校验拒绝，见 §10.2）。
- ❌ 不允许在非表单节点的 `visibleWhen` 中访问 `$deps.*`（静态校验拒绝，见 §10.1）。
- ❌ 不允许在表格 `actions` 的表达式（**任意** `scope`）中使用 `$self`（不适用，见 §10.3）。
- ❌ 不允许使用 `$parentRow.*`；v0.2 静态拒绝（无嵌套表格挂载结构）。
- ❌ 不允许在 `reactions` / `visibleWhen` / `permissions` 中使用 `$selection.*`；选中集仅经 `batchMapping` 读取（ADR-0022 / 审计 0064 / V285）。

## 3. 运算符白名单

| 类别 | 支持的运算符 |
|---|---|
| 比较 | `==` `!=` `>` `>=` `<` `<=` `contains` |
| 逻辑 | `&&` `\|\|` `!` |
| 分组 | `(` `)` |

> `contains` 归入 **比较** 优先级档（与 `==`/`!=` 同级）。

`contains` 为数组包含判断运算符，语义定义为：左操作数为数组时判断是否包含右操作数字面量（等价于 `Array.prototype.includes`），返回布尔值；若左操作数不是数组（如为 `undefined`），短路返回 `false`，不抛异常。右操作数**必须**是 §4 所列字面量类型之一：字符串、数字、布尔或 `null`；不得为变量（如 `$deps.x` / `$context.user.id`）或分组表达式（如 `('a')`）。`contains` 与 `==`/`!=` 等比较运算符归入同一优先级档，不单独新增优先级层级。`contains` 是二元、非链式运算符（不存在 `a contains b contains c` 的连续使用场景），无需定义结合性。

所有比较运算符均不得链式连续使用；需要多个比较时必须通过 `&&` / `||` 拆分为独立比较表达式。

不支持算术运算符（`+` `-` `*` `/`）、三元表达式、字符串拼接、正则匹配。
如果一个联动场景需要用到这些能力，说明它已经超出"简单显隐/必填联动"的范畴，
应该改为后端直接下发不同的 Node 结构（例如用两套表单节点配合 `data.source: api` 按条件渲染），
而不是继续扩展表达式引擎能力（原因见 [decisions/0001](./decisions/0001-why-single-node-tree.md)）。

## 4. 字面量

- 字符串：单引号或双引号，如 `'wholesale'`
- 数字：`123`、`0.5`
- 布尔：`true` / `false`
- `null`

## 5. 语法示例

```yaml
when: "$deps.orderType == 'wholesale'"
when: "$deps.age >= 18 && $deps.hasLicense == true"
when: "!($deps.status == 'draft')"
```

## 6. `fulfill` / `otherwise` 允许的状态键

```yaml
fulfill:
  visible: true      # 是否显示
  required: true      # 是否必填
  disabled: false      # 是否禁用
  value: null         # 强制设置字段值（谨慎使用，仅用于清空等场景）
```

不允许出现协议未列出的键（如 `style`、`className`、组件私有 props）。
前端 Renderer 在解析时应对未知键报错，而不是静默忽略——这能第一时间暴露误用。

## 7. 多依赖 / 一对多联动

```yaml
reactions:
  - dependencies: [orderType, customerLevel]
    when: "$deps.orderType == 'wholesale' && $deps.customerLevel == 'vip'"
    fulfill:
      visible: true
```

一个字段可以有多条 `reactions`，按数组顺序依次求值，后一条的 `fulfill`/`otherwise`
会覆盖前一条对同一状态键的设置（后写优先）。

## 8. 校验建议

建议前端在解析阶段对 `when` 表达式做静态扫描：
- 使用白名单解析器（如自研 mini-parser 或 `expr-eval` 之类的沙箱化库），**禁止使用 `eval`/`new Function`**。
- 扫描表达式中出现的标识符，如果不在 `dependencies` 声明范围内，直接拒绝渲染并报错，
  防止后端误写了未声明依赖导致联动"看起来生效但实际读不到值"。

### 8.1 `dependencies` 声明规则（form / row）

| 作用域 | 表达式变量 | `dependencies` 中应写的内容 | 正例 | 反例 |
|---|---|---|---|---|
| `scope: form`（默认） | `$deps.<field>` | 表单字段名（无 `$deps.` 前缀） | `dependencies: [orderType]` + `when: "$deps.orderType == 'x'"` | `dependencies: ["$deps.orderType"]` |
| `scope: row` | `$row.<path>` | **`$row.` 之后的完整点路径**（无 `$row.` 前缀） | `dependencies: [canRefund]` + `when: "$row.canRefund == true"` | `dependencies: ["$row.canRefund"]` |
| `scope: row` | `$row.user.id`（嵌套） | 完整后缀路径 | `dependencies: ["user.id"]` | `dependencies: [user]`（不完整） |
| `scope: row` | `$row.__index` / `$row.__key` | 保留字段名本身 | `dependencies: ["__index"]` | `dependencies: ["$row.__index"]` |

L3a 对 `$deps.*` 做精确包含匹配：`dependencies` 必须声明所引用字段的根字段名；点路径的后续段可用于读取对象属性。除声明匹配外，L3a 还必须将根字段解析到当前 form 的字段符号表；未知根字段即使写入 `dependencies` 也必须拒绝。`$context.*` 不需要写入 `dependencies`。

## 9. 作用域（`scope`）规则

自 v0.2 起，表达式引擎支持两种作用域，通过显式 `scope` 属性声明：

| 作用域 | `scope` 值 | 可用变量 | 默认场景 |
|---|---|---|---|
| 表单级 | `form`（默认） | `$deps.*`、`$context.*`；`$self` **仅**表单字段 `reactions` | 表单字段 `reactions`；表单内 `visibleWhen`（无 `$self`） |
| 行级 | `row` | `$row.*`、`$context.*`；`$self` **仅**列表达式 | 表格 `columns`/`actions`（`actions` 无 `$self`；仅 columns/actions 可挂载） |

### 9.1 作用域隔离规则

- **`$row` 与 `$deps` 互斥**：`scope: row` 的表达式中不能出现 `$deps.*`；`scope: form` 的表达式中不能出现 `$row.*`。违反该规则的配置由静态校验直接拒绝（见 §10 静态校验规则）。
- **`$context` 跨作用域可访问**：`$context.*` 在两种作用域下均可访问，不受隔离规则限制。
- **非表单节点 `visibleWhen` 只能访问 `$context.*`**：非表单节点不绑定表单字段，即使其表达式默认属于 `scope: form`，也不得访问 `$deps.*`、`$self`、`$row.*` 或 `$parentRow.*`。
- **表单 `visibleWhen` 不得使用 `$self`**：节点级条件渲染无字段自身值注入；仅允许 `$deps.*` 与 `$context.user.*` / `$context.features.*`（见 §10.1）。
- **跨作用域联合判断不支持**：若业务需要同时依赖表单级字段和行内字段（如"表单审批模式为严格且当前行金额超阈值"），v0.2 **不提供协议级语法支持**。该场景无法通过现有表达式机制在协议层实现变通，应由后端预计算为行数据字段（如行数据中增加 `canHighlight` 布尔字段），或通过 ADR 新增标准机制。

### 9.2 `$self` 的作用域语义

- `scope: form`（表单字段 `reactions`）：`$self` 指当前字段自身的当前值（与 v0.1 一致）。
- `scope: row`（表格列表达式）：`$self` 指**当前列对应单元格的原始数据值**（即 `$row[column.field]`，未经 `format` 处理的原始值）。`$self` 在表格 `actions` 的表达式中不适用（无"当前单元格"概念，**任意 scope**），静态校验拒绝。

### 9.3 `fulfill`/`otherwise` 状态键的作用域限制

`reactions` 的 `fulfill`/`otherwise` 支持四个状态键，但按挂载位置收窄：

| 状态键 | 表单字段（`scope: form`，默认） | 表格 `columns[]`/`actions[]`（任意 scope） | 说明 |
|---|---|---|---|
| `visible` | ✅ 允许 | ✅ 允许 | 控制字段/单元格/操作是否可见 |
| `disabled` | ✅ 允许 | ✅ 允许 | 控制字段/单元格/操作是否禁用 |
| `required` | ✅ 允许 | ❌ 静态校验禁止 | 表格列/操作无"必填"语义 |
| `value` | ✅ 允许 | ❌ 静态校验禁止 | 列/操作不是表单字段，无单一回写目标；v0.2 不支持行内回写 |

> **0044 / V167：** 表格列与行操作不是表单字段，即使声明 `scope: form`，也不得使用 `required`/`value`。L2 对 `table.props.columns[]` / `actions[]` 上的 reactions 一律仅允许 `visible`/`disabled`。
>
> **0045 / V177：** `scope: row` **仅**允许挂载在表格 `columns[]` / `actions[]` 上；普通表单字段 Node 不得声明 `scope: row`（L3a `ROW_SCOPE_MOUNT`）。上表因此不再包含「表单字段 `scope: row`」列。

## 10. 静态校验规则

以下规则由解析器在静态校验阶段（非运行时）执行，违反即视为协议格式错误、直接拒绝。

### 10.1 非表单 / 表单 `visibleWhen` 的变量白名单

节点所处的表单上下文由 Node 树位置决定（节点位于 `type: form` 子树中即为表单上下文）。

- **非表单上下文**：`dependencies` 可省略，`when` 中**仅**允许 `$context.user.*` / `$context.features.*`；出现 `$deps.*`、`$self`、`$row.*` 或 `$parentRow.*` 时静态校验直接拒绝。
- **表单上下文**：`dependencies` 必填（无字段依赖时写 `[]`），`when` 中只允许 `$deps.*`（须声明）与 `$context.user.*` / `$context.features.*`；**不得**使用 `$self`、`$row.*` 或 `$parentRow.*`（`visibleWhen` 不是字段 `reactions`，无 `$self` 注入语义）。

注意：表单上下文内缺失 `dependencies` 是配置错误，不会因此变成非表单上下文。

### 10.2 `$deps` 出现在 `permissions.*` 中

`permissions.*` 的表达式中禁止出现 `$deps.*`，只允许使用 `$context.*`。理由：权限判断只应依赖用户身份，不应混入业务字段状态，避免职责不清、难以审计。

### 10.3 表格 `actions` 表达式中出现 `$self`

表格 `actions` 的表达式（`visibleWhen` / `reactions`，**任意** `scope`）中禁止使用 `$self`（行内操作按钮不对应具体某一列，无"当前单元格"概念；只能使用 `$row.*` / `$context.*`，或 form-scope 下的 `$deps.*` / `$context.*`）。

### 10.4 表格列/操作上 `fulfill` 出现 `required`/`value`

表格 `columns[]` / `actions[]` 上的 reactions（**无论** `scope: form` 或 `scope: row`）的 `fulfill`/`otherwise` 中禁止声明 `required` 或 `value`（仅允许 `visible` 和 `disabled`）。

> 注：历史上曾写「任意 `scope: row` 的 reactions」；因 `scope: row` 仅允许挂载在表格列/操作上（见 §10.6），该表述与上列等价。

### 10.5 表格列 `scope: form` 表达式中出现 `$self`

表格列在 `scope: form` 下没有当前行/当前单元格上下文，也不是表单字段，因此 `$self` 没有绑定对象。该场景中出现 `$self` 时，静态校验直接拒绝；需要访问单元格原始值时应使用 `scope: row`。

### 10.6 `scope: row` 挂载点限制（`ROW_SCOPE_MOUNT`）

`scope: row` **仅**允许出现在表格 `columns[]` / `actions[]` 的 `visibleWhen` 或 `reactions` 上。普通 Node（含表单字段）声明 `scope: row` 时，L3a 以 `ROW_SCOPE_MOUNT` 静态拒绝。需要行数据时，应把表达式挂在对应列或行操作上。

### 10.7 `$deps` 出现在非表单 `data.params` / `optionsSource.params` / `datasources.*.params` 中

`data.params`、`select.props.optionsSource.params` 与页面级 `datasources.*.params` 中的 `$deps.*` 仅用于读取当前表单字段值并做**完整单个参数值替换**，规则完全一致：参数值要么是不含 `$` 的普通字面量，要么整段精确匹配单个 `$deps.<path>`；禁止 `prefix-$deps.ownerId` 一类模板拼接。若节点不处于表单上下文（或 `datasources.*.params`——页面级声明永远非表单上下文），出现 `$deps.*` 时，静态校验直接拒绝。三者都不是条件表达式，不支持 `$row.*`、`$parentRow.*`、`$self` 或 `$context.*`，也不要求声明 `dependencies` 数组。规则递归作用于对象和数组中的所有值，不能通过数组元素绕过变量限制。字符串中任意位置出现 `$` 却不能完整匹配单个 `$deps.*` 时，以 `DATA_PARAMS_VARIABLE` 拒绝。

### 10.8 `contains` 右操作数字面量约束

`contains` 的右操作数必须是 §4 所列字面量类型之一：字符串、数字、布尔或 `null`。静态校验拒绝：

- 变量作为右操作数（如 `$deps.role`、`$context.user.id`、`$row.tag`、`$self`）；
- 分组或其他表达式作为右操作数（如 `('admin')`、`('a' == 'a')` 的子表达式形态）。

正例：`$context.user.roles contains 'admin'`、`$deps.tags contains 1`、`$deps.flags contains true`、`$deps.values contains null`。
违反时 L3a 以语法错误拒绝（与 `06-validation.md` L3a 行一致）。

## 11. `$context` 最小字段集（since 0.2.5）

### 11.1 `$context.user` 最小字段集

以下字段是协议级最小集，所有接入方**必须**提供，Renderer 在 `permissions.*` 表达式中保证这些路径可被安全访问：

| 字段 | 类型 | 说明 |
|---|---|---|
| `$context.user.id` | `string` | 当前用户唯一标识（如数据库主键或 UUID） |
| `$context.user.name` | `string` | 当前用户显示名（用于界面展示，不用于权限判断） |
| `$context.user.roles` | `string[]` | 当前用户所属角色数组（如 `["admin", "editor"]`），配合 `contains` 运算符做权限表达式 |

```yaml
# 权限表达式示例：仅 admin 可见
permissions:
  view: "$context.user.roles contains 'admin'"
```

> **项目扩展约定：** 接入方可通过 Renderer 初始化时的 `context.user` 注入追加项目专有字段（如 `department`、`tenantId`），这些字段在协议层不做约束，仅在项目范围内有效。最小字段集必须始终存在，项目字段不得覆盖最小字段集的名称。

### 11.2 `$context.features` 最小字段集

`$context.features` 是功能开关命名空间，没有协议级强制字段——其全部内容由接入方在 Renderer 初始化时注入。

**约定：**
- 字段值只允许 `boolean` 或简单枚举字符串，不允许对象或数组。
- 字段名使用 `camelCase`，如 `newDashboard`、`betaTableSort`。
- 缺失的功能开关视为 `false`（未启用）。

```yaml
# 功能开关表达式示例
visibleWhen:
  when: "$context.features.newDashboard == true"
```

### 11.3 `$context.route` 最小字段集（since 2.1 / ADR-0021）

> **L3a 报错语义（V279）：** `route` 属于协议白名单根命名空间。在 expression 挂载点（`reactions` / `visibleWhen` / `permissions` / toolbar 条件）使用 `$context.route.*` 时，校验器须报「本挂载点禁止 / 仅 recordSource 绑定」，**不得**报「未知 $context 根」。未知根（非 `user`/`features`/`route`）仍使用 `UNKNOWN_CONTEXT_NAMESPACE`。


宿主在 Renderer 实例初始化时注入的**只读路由快照**（与 `user`/`features` 相同：路由变化须重挂载）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `$context.route.path` | `string` | 当前页 path（不含 query；是否含应用 base 由宿主约定） |
| `$context.route.query.<name>` | `string` | 当前页 query；值一律字符串；缺失键为 `undefined` |
| `$context.route.params.<name>` | `string` | 可选；宿主路由 path 参数（如 `/orders/:orderId`） |

**MVP 使用边界：**

- 允许作为 `form.props.recordSource.path` / `query` 映射值中的**整值替换**（单个 `$context.route.query.*` 或 `$context.route.params.*`）；
- **默认禁止**出现在普通 `reactions` / `visibleWhen` / `permissions` / `data.params`（L2/L3a 若遇到应拒绝，直至后续 ADR 放开）；
- 不是安全边界；记录 id 必须由后端鉴权。

完整加载回填语义见 [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) 与 [03-component-registry.md](./03-component-registry.md) `form.recordSource`。

## 12. `$context` 白名单扩展流程

`$context` 的白名单命名空间（`user`、`features`、`route`）是协议级约束，不是项目级配置。新增命名空间必须通过以下流程：

1. 提出新 ADR，论证新命名空间的必要性（是否确实无法被现有 `user`/`features`/`route` 承载）；
2. ADR 通过后同步更新本文档 §2 的变量命名空间表；
3. **禁止**接入方在项目层面自行扩展白名单之外的 `$context.*` 路径。如果确有项目专有上下文需求，应在渲染接入层建立项目级映射层，将项目专有数据映射到已有白名单命名空间之下，而不是绕过白名单直接注入新的根级命名空间。

理由：防止不同接入方各自扩展导致 `$context` 结构碎片化，最终削弱"一种表达式语法，多个挂载点使用"的协议价值。

## 13. `$context` 缺失容错

若宿主环境未注入 `$context`（如旧版本运行时、测试环境、协议降级场景）：

- 所有白名单命名空间路径（`$context.user`、`$context.features`、`$context.route`）返回 `undefined`。
- 表达式中对 `undefined` 值的比较运算隐式转为 `false`，使节点降级为"不满足条件"。
- **属性链容错**：任意深度的属性链访问中（如 `$context.user.roles contains 'admin'`），若某环为 `undefined`，后续访问短路返回 `undefined`，不抛异常；参与布尔判断时转 `false`。
- 渲染流程不得因此中断。具体实现是否抛出告警日志由宿主环境自行决定。
- `form.recordSource` 绑定的 route 键为 `undefined` 时，按 [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) 拒绝构造加载请求并进入错误态（不得用空 id 请求）。

> **安全边界声明**：`$context` 不是安全边界，只是渲染边界。`visibleWhen`/`permissions` 控制的是渲染层面的显隐，不能替代后端的真实鉴权。前端 `$context.user.roles` 判断得出的显隐结果，后端必须独立校验，不能信任前端传来的任何身份声明。

## 14. 表达式求值时序模型（since 0.2.4）

表达式引擎采用稳定快照模型。Renderer mount 时必须先执行一次初始 Snapshot/Evaluate/Commit。每个状态键的 baseline 是组件/字段首次挂载时的协议值；若未另行声明，baseline 就是该字段的初始值。条件变为 false 且没有 `otherwise` 时恢复 baseline；`otherwise` 存在时使用其显式状态。baseline 不会被后续 reaction 写入覆盖。之后每一轮由用户输入、数据加载或显式重新求值触发的表达式求值，都按以下阶段执行。`$context` 在 Renderer 实例初始化时一次性注入；宿主需要更新 context 时必须重挂载并创建新实例，新实例的首次 Snapshot 才读取新值。

1. **Snapshot**：冻结当前表单字段值、节点状态、`$context`、行数据上下文，形成本轮 `inputSnapshot`。
2. **Evaluate**：本轮所有 `permissions.*`、`visibleWhen.when`、`reactions[].when` 均只读取 `inputSnapshot`。`reactions.fulfill.value` / `otherwise.value` 只产生待提交写入，不会立刻改变同轮其他表达式读取到的值。
3. **Commit**：Renderer 一次性提交本轮产生的 `visible`、`required`、`disabled`、`value` 变更。
4. **Next tick**：若 Commit 阶段改变了字段值，并且该字段又是其他表达式依赖，Renderer 安排下一轮求值；下一轮的 Snapshot 才能读到新值。

因此，同一轮内的规则是：**本轮读旧快照，本轮末尾批量写入，下一轮读取新值**。这条规则用于消除 `visibleWhen` / `permissions` 读取字段值与 `reactions.fulfill.value` 写字段值之间的时序歧义。

### 14.1 同一字段的多条 `value` 写入冲突

`fulfill.value` / `otherwise.value` 仅作用于当前字段（即声明该 `reactions` 的字段自身），不支持跨字段写入。同一字段上若有多条 `reactions` 写入 `value`，采用确定性的后写优先规则：

- 同一字段上的多条 `reactions` 按数组顺序求值，后一条对 `value` 覆盖前一条。
- Renderer 在开发环境应输出警告，提示存在多处写同一字段 `value` 的配置，建议合并规则或拆分字段。

### 14.2 循环保护

若 Commit 阶段产生的 `value` 写入触发下一轮求值，Renderer 必须设置循环保护：

- 若连续求值轮次超过实现上限（建议 10 轮），Renderer 应停止继续求值，将相关节点置为错误态，并在开发环境输出包含依赖链的错误日志。
- 若某轮 Commit 后状态没有实际变化（新值与旧值深相等），不得继续触发下一轮。

`scope: row` 下仍禁止 `value` 状态键；行内字段回写若未来需要支持，必须另开 ADR 决策。

`dateRangePicker` 虽处于表单 scope，但由 `startField` / `endField` 绑定两个独立字段，没有单一“当前字段”写入目标。因此 v0.2 禁止其 `reactions[].fulfill.value` / `otherwise.value`；仍可使用 `visible`、`required` 和 `disabled`。未来若需要范围回写，必须通过 ADR 定义完整 `{ start, end }` 结构、部分更新和空值规则。

## 附录 A：变量可见性矩阵

下表汇总各使用位置可访问的变量，是 §2（变量命名空间）与 §9（作用域规则）的交叉对照。合并入 `02-reaction-expression.md` 时作为独立附录。

| 使用位置 | `$deps.*` | `$self` | `$context.*` | `$row.*` |
|---|---|---|---|---|
| 表单字段 `reactions` | ✅ | ✅（`dateRangePicker` 额外允许 `.start` / `.end`） | ✅ | ❌ |
| 表单字段 `visibleWhen` | ✅ | ❌ | ✅ | ❌ |
| 表单上下文内 `data.params` | ✅（仅值替换） | ❌ | ❌ | ❌ |
| 非表单上下文 `data.params` | ❌（静态校验拒绝） | ❌ | ❌ | ❌ |
| 表单上下文内 `optionsSource.params` | ✅（仅值替换，同 `data.params`） | ❌ | ❌ | ❌ |
| 非表单上下文 `optionsSource.params` | ❌（静态校验拒绝） | ❌ | ❌ | ❌ |
| 页面级 `datasources.*.params` | ❌（静态校验拒绝，永远非表单上下文） | ❌ | ❌ | ❌ |
| 非表单节点 `visibleWhen` | ❌（静态校验拒绝） | ❌ | ✅ | ❌ |
| 节点 `permissions.*` | ❌（静态校验拒绝） | ❌ | ✅ | ❌ |
| 表格列 `scope: form` 表达式（仅表格位于 `form.children` 内） | ✅ | ❌（无绑定对象） | ✅ | ❌ |
| 独立表格列 `scope: form` 表达式 | ❌（静态校验拒绝 `$deps.*`） | ❌（无绑定对象） | ✅ | ❌ |
| 表格列 `scope: row` 表达式 | ❌ | ✅（单元格原始值） | ✅ | ✅ |
| 表格 `actions` · `scope: form`（仅表格位于 `form.children` 内） | ✅ | ❌（不适用） | ✅ | ❌ |
| 独立表格 `actions` · `scope: form` | ❌（静态校验拒绝 `$deps.*`） | ❌（不适用） | ✅ | ❌ |
| 表格 `actions`（`scope: row`） | ❌ | ❌（不适用） | ✅ | ✅ |

此矩阵仅描述协议允许出现哪些变量，不重复各变量的取值语义（原始值/格式化值、只读约束等），具体语义以各节正文为准。
