---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.2
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
| 节点条件渲染 | `visibleWhen.when` | [01-node-protocol.md §3.8](./01-node-protocol.md#38-visiblewhen-节点级条件渲染可选since-02) |
| 权限判定 | `permissions.*` | [01-node-protocol.md §3.9](./01-node-protocol.md#39-permissions-权限控制可选since-02) |
| 表格列/行内操作 | `columns[].{visibleWhen,reactions}.when` | [03-component-registry.md](./03-component-registry.md) `table` 组件章节 |
| 远程选项参数 | `props.optionsSource.params`（仅值替换，不做条件判断） | [03-component-registry.md](./03-component-registry.md) `select` 组件章节 |

## 2. 变量命名空间（白名单）

| 变量 | 含义 | 可用位置 | 示例 |
|---|---|---|---|
| `$deps.<字段名>` | `dependencies` 中声明的依赖字段的当前值 | `reactions`、`visibleWhen`(表单内)、`scope: form` 表达式 | `$deps.orderType` |
| `$self` | 当前字段自身的当前值（字段级）；当前列对应单元格的原始数据值（`scope: row` 列表达式） | 表单字段 `reactions`、表格列 `scope: row` 表达式 | `$self` |
| `$context.user.*` | 当前用户身份信息（只读快照，字段集合由项目扩展） | 所有位置 | `$context.user.roles` |
| `$context.features.*` | 功能开关映射表（只读快照，值为布尔或简单枚举） | 所有位置 | `$context.features.newDashboard` |
| `$row.<字段名>` | 当前行的原始数据对象（未经格式化处理） | 表格 `columns`/`actions` 中 `scope: row` 表达式 | `$row.level` |
| `$row.__index` | 当前行在数据集中的序号（从 0 开始） | 同上 | `$row.__index` |
| `$row.__key` | 当前行的唯一标识（取表格 `rowKey` 字段值） | 同上 | `$row.__key` |
| `$parentRow.<字段名>` | 直接父级表格的当前行数据（仅嵌套表格场景） | 嵌套表格内 `scope: row` 表达式 | `$parentRow.status` |

**禁止事项：**
- ❌ 不允许访问 `dependencies` 之外未声明的字段。
- ❌ 不允许访问全局对象、window、任何宿主环境变量。
- ❌ 不允许函数调用（包括 `Date.now()`、自定义函数等）。
- ❌ 不允许在 `scope: row` 表达式中访问 `$deps.*`（与 `$row.*` 互斥，见 §9.1）。
- ❌ 不允许在 `scope: form` 表达式中访问 `$row.*`。
- ❌ 不允许在 `permissions.*` 表达式中访问 `$deps.*`（静态校验拒绝，见 §9.3）。
- ❌ 不允许在非表单节点的 `visibleWhen` 中访问 `$deps.*`（静态校验拒绝，见 §9.2）。
- ❌ 不允许在表格 `actions` 的 `scope: row` 表达式中使用 `$self`（不适用，见 §9.4）。

## 3. 运算符白名单

| 类别 | 支持的运算符 |
|---|---|
| 比较 | `==` `!=` `>` `>=` `<` `<=` `contains` |
| 逻辑 | `&&` `\|\|` `!` |
| 分组 | `(` `)` |

> `contains` 归入 **比较** 优先级档（与 `==`/`!=` 同级）。

`contains` 为数组包含判断运算符，语义定义为：左操作数为数组时判断是否包含右操作数字面量（等价于 `Array.prototype.includes`），返回布尔值；若左操作数不是数组（如为 `undefined`），短路返回 `false`，不抛异常。`contains` 与 `==`/`!=` 等比较运算符归入同一优先级档，不单独新增优先级层级。`contains` 是二元、非链式运算符（不存在 `a contains b contains c` 的连续使用场景），无需定义结合性。

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

## 9. 作用域（`scope`）规则

自 v0.2 起，表达式引擎支持两种作用域，通过显式 `scope` 属性声明：

| 作用域 | `scope` 值 | 可用变量 | 默认场景 |
|---|---|---|---|
| 表单级 | `form`（默认） | `$deps.*`、`$self`、`$context.*` | 表单 `reactions`、页面 `visibleWhen` |
| 行级 | `row` | `$row.*`、`$self`（列表达式）、`$context.*` | 表格 `columns`/`actions` 内表达式 |

### 9.1 作用域隔离规则

- **`$row` 与 `$deps` 互斥**：`scope: row` 的表达式中不能出现 `$deps.*`；`scope: form` 的表达式中不能出现 `$row.*`。违反该规则的配置由静态校验直接拒绝（见 §10.1）。
- **`$context` 跨作用域可访问**：`$context.*` 在两种作用域下均可访问，不受隔离规则限制。
- **跨作用域联合判断不支持**：若业务需要同时依赖表单级字段和行内字段（如"表单审批模式为严格且当前行金额超阈值"），v0.2 **不提供协议级语法支持**。该场景无法通过现有表达式机制在协议层实现变通，应由后端预计算为行数据字段（如行数据中增加 `canHighlight` 布尔字段），或通过 ADR 新增标准机制。

### 9.2 `$self` 的作用域语义

- `scope: form`（表单字段 `reactions`）：`$self` 指当前字段自身的当前值（与 v0.1 一致）。
- `scope: row`（表格列表达式）：`$self` 指**当前列对应单元格的原始数据值**（即 `$row[column.field]`，未经 `format` 处理的原始值）。`$self` 在表格 `actions` 的 `scope: row` 中不适用（无"当前单元格"概念），静态校验拒绝。

### 9.3 `fulfill`/`otherwise` 状态键的作用域限制

`reactions` 的 `fulfill`/`otherwise` 支持四个状态键，但在 `scope: row` 下并非全部适用：

| 状态键 | `scope: form` | `scope: row` | 说明 |
|---|---|---|---|
| `visible` | ✅ 允许 | ✅ 允许 | 控制当前单元格/行内操作是否可见 |
| `disabled` | ✅ 允许 | ✅ 允许 | 控制当前单元格/操作是否禁用 |
| `required` | ✅ 允许 | ❌ 静态校验禁止 | 表格列/行内操作不存在"必填"语义 |
| `value` | ✅ 允许 | ❌ 静态校验禁止 | v0.2 暂不支持行内数据回写，留待后续讨论 |

## 10. 静态校验规则

以下规则由解析器在静态校验阶段（非运行时）执行，违反即视为协议格式错误、直接拒绝。

### 10.1 `$deps` 出现在非表单 `visibleWhen` 中

若节点未声明 `dependencies`（即处于非表单上下文），但其 `when` 表达式中出现了 `$deps.*`，静态校验直接拒绝。理由：`$deps` 出现在不该出现的位置几乎总是配置错误（拼写误用、复制粘贴遗留），直接拒绝能在问题发生的第一时间暴露。

### 10.2 `$deps` 出现在 `permissions.*` 中

`permissions.*` 的表达式中禁止出现 `$deps.*`，只允许使用 `$context.*`。理由：权限判断只应依赖用户身份，不应混入业务字段状态，避免职责不清、难以审计。

### 10.3 `scope: row` 下 `$self` 出现在 `actions` 中

表格 `actions` 的 `scope: row` 表达式中禁止使用 `$self`（行内操作按钮不对应具体某一列，无"当前单元格"概念）。

### 10.4 `scope: row` 下 `fulfill` 出现 `required`/`value`

`scope: row` 的 `fulfill`/`otherwise` 中禁止声明 `required` 或 `value` 状态键（仅允许 `visible` 和 `disabled`）。

## 11. `$context` 白名单扩展流程

`$context` 的白名单命名空间（`user`、`features`）是协议级约束，不是项目级配置。新增命名空间必须通过以下流程：

1. 提出新 ADR，论证新命名空间的必要性（是否确实无法被现有 `user`/`features` 承载）；
2. ADR 通过后同步更新本文档 §2 的变量命名空间表；
3. **禁止**接入方在项目层面自行扩展白名单之外的 `$context.*` 路径。如果确有项目专有上下文需求，应在渲染接入层建立项目级映射层，将项目专有数据映射到 `$context.user` 或 `$context.features` 之下，而不是绕过白名单直接注入新的根级命名空间。

理由：防止不同接入方各自扩展导致 `$context` 结构碎片化，最终削弱"一种表达式语法，多个挂载点使用"的协议价值。

## 12. `$context` 缺失容错

若宿主环境未注入 `$context`（如旧版本运行时、测试环境、协议降级场景）：

- 所有白名单命名空间路径（`$context.user`、`$context.features`）返回 `undefined`。
- 表达式中对 `undefined` 值的比较运算隐式转为 `false`，使节点降级为"不满足条件"。
- **属性链容错**：任意深度的属性链访问中（如 `$context.user.roles contains 'admin'`），若某环为 `undefined`，后续访问短路返回 `undefined`，不抛异常；参与布尔判断时转 `false`。
- 渲染流程不得因此中断。具体实现是否抛出告警日志由宿主环境自行决定。

> **安全边界声明**：`$context` 不是安全边界，只是渲染边界。`visibleWhen`/`permissions` 控制的是渲染层面的显隐，不能替代后端的真实鉴权。前端 `$context.user.roles` 判断得出的显隐结果，后端必须独立校验，不能信任前端传来的任何身份声明。

## 附录 A：变量可见性矩阵

下表汇总各使用位置可访问的变量，是 §2（变量命名空间）与 §9（作用域规则）的交叉对照。合并入 `02-reaction-expression.md` 时作为独立附录。

| 使用位置 | `$deps.*` | `$self` | `$context.*` | `$row.*` | `$parentRow.*` |
|---|---|---|---|---|---|
| 表单字段 `reactions` | ✅ | ✅ | ✅ | ❌ | ❌ |
| 表单字段 `visibleWhen` | ✅ | ❌ | ✅ | ❌ | ❌ |
| 非表单节点 `visibleWhen` | ❌（静态校验拒绝） | ❌ | ✅ | ❌ | ❌ |
| 节点 `permissions.*` | ❌（静态校验拒绝） | ❌ | ✅ | ❌ | ❌ |
| 表格列 `scope: form` 表达式 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 表格列 `scope: row` 表达式 | ❌ | ✅（单元格原始值） | ✅ | ✅ | ❌ |
| 表格列 `scope: row`（嵌套表格内） | ❌ | ✅ | ✅ | ✅ | ✅（仅直接父级） |
| 表格 `actions`（`scope: row`） | ❌ | ❌（不适用） | ✅ | ✅ | ❌ |
| 表格 `actions`（`scope: row`,嵌套表格内） | ❌ | ❌（不适用） | ✅ | ✅ | ✅（仅直接父级） |

此矩阵仅描述协议允许出现哪些变量，不重复各变量的取值语义（原始值/格式化值、只读约束等），具体语义以各节正文为准。
