---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.1
---

# 联动表达式引擎语法规范

> ⚠️ 本文档描述的是全协议中**唯一涉及"类代码"逻辑**的部分。
> 为了保证后端写的是"数据"而非"代码"，本表达式引擎的能力被严格收敛。
> 生成配置的开发者或 AI 助手必须严格遵守本文档的白名单，**不得**自行扩展语法。

## 1. 使用位置

仅出现在 Node 的 `reactions[].when` 字段中，详见 [01-node-protocol.md §3.5](./01-node-protocol.md#35-reactions可选)。

## 2. 变量命名空间（白名单）

| 变量 | 含义 | 示例 |
|---|---|---|
| `$deps.<字段名>` | `dependencies` 数组中声明的依赖字段的当前值 | `$deps.orderType` |
| `$self` | 当前字段自身的当前值 | `$self` |

**禁止事项：**
- ❌ 不允许访问 `dependencies` 之外未声明的字段。
- ❌ 不允许访问全局对象、window、任何宿主环境变量。
- ❌ 不允许函数调用（包括 `Date.now()`、自定义函数等）。

## 3. 运算符白名单

| 类别 | 支持的运算符 |
|---|---|
| 比较 | `==` `!=` `>` `>=` `<` `<=` |
| 逻辑 | `&&` `\|\|` `!` |
| 分组 | `(` `)` |

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
