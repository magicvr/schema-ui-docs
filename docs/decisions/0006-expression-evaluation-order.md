---
status: accepted
date: 2026-07-08
---

# ADR-0006: 表达式读写求值时序模型

## 状态

已接受(Accepted)—— 已合并入 `01-node-protocol.md`、`02-reaction-expression.md` 与 `08-renderer-spec.md`。

## 背景

ADR-0003 已经定义：

```text
最终 visible = permissions.view AND visibleWhen.when AND reactions.visible
```

并且 `reactions` 始终求值，不因节点不可见而跳过。这个规则解决了可见性信号之间的仲裁，但没有回答更底层的问题：当同一渲染周期内既有表达式读取字段值，又有 `reactions.fulfill.value` 写字段值时，读取方看到的是写入前还是写入后的值。

典型例子：

```yaml
- type: input
  props: { field: status }
  reactions:
    - dependencies: [status]
      when: "$deps.status == 'archived'"
      fulfill:
        value: 'closed'  # 将 status 规范化。fulfill.value 仅作用于当前字段

- type: input
  props: { field: closeReason }
  visibleWhen:
    dependencies: [status]
    when: "$deps.status == 'closed'"
```

如果 `visibleWhen` 与 `reactions.fulfill.value` 在同一轮内交错执行，不同 Renderer 可能给出不同结果：用户将 status 设为 `archived` 后，closeReason 的 `visibleWhen` 看到的是旧值 `archived`（不等于 `closed`），还是 reaction 刚写入的新值 `closed`？稳定快照模型保证同轮读旧值，下一轮读新值。

## 决策

### D1. 每轮求值使用稳定输入快照

Renderer 在一次表达式求值轮次开始时，必须冻结当前表单状态作为 `inputSnapshot`。本轮内所有表达式读取 `$deps.*` 与 `$self` 时，都读取该快照，而不是读取本轮中其他 reaction 刚写入的临时值。

这意味着：

- `visibleWhen.when` 读取本轮开始前的字段值；
- `permissions.*` 只读取 `$context.*` 快照，不受字段写入影响；
- `reactions[].when` 读取本轮开始前的字段值；
- `reactions.fulfill.value` / `otherwise.value` 产生的是待提交写入，不会立刻影响同轮其他表达式读取。

理由：稳定快照模型最容易调试，也最容易跨不同前端框架实现。它避免了“数组顺序 / 组件树遍历顺序 / 框架批处理时机”影响协议行为。

### D2. 一轮分为“读与计算”与“提交”两个阶段

每次由用户输入、数据加载或显式重新求值触发的表达式求值轮次，按以下阶段执行。依据 ADR-0003 D1 及审计 0039/V122，`$context` 在实例内不响应式刷新；宿主更新 context 时通过重挂载创建新 Renderer 实例，新实例再开始新的求值生命周期。

1. **Snapshot 阶段**：冻结当前表单字段值、节点状态、`$context`、行数据上下文。
2. **Evaluate 阶段**：基于快照求值 `permissions`、`visibleWhen`、`reactions.when`，计算出本轮的状态变更集合。
3. **Commit 阶段**：一次性提交本轮产生的状态变更，包括 `visible`、`required`、`disabled`、`value`。
4. **Next-tick 阶段**：若 Commit 阶段改变了字段值，并且这些字段又是其他表达式的依赖，Renderer 安排下一轮求值；下一轮的快照才能读到这些新值。

### D3. 同一字段的多条 `value` 写入采用后写优先

`fulfill.value` / `otherwise.value` 仅作用于当前字段（即声明该 `reactions` 的字段自身），不支持跨字段写入。同一字段上若有多条 `reactions` 写入 `value`，冲突处理规则如下：

1. 同一字段上的多条 `reactions` 按数组顺序求值，后一条对 `value` 覆盖前一条。
2. Renderer 在开发环境应输出警告，提示存在多处写同一字段 `value` 的配置，建议合并规则或拆分字段。

理由：协议需要给出确定性结果。协议当前不提供跨字段写入语法，若未来确有需求，应通过独立 ADR 设计显式声明语法，而非依赖后写覆盖的行为语义。

### D4. 防止无限求值循环

若 Commit 阶段产生的 `value` 写入会触发下一轮求值，Renderer 必须设置循环保护：

- 若连续求值轮次达到 10 轮且仍需要下一轮，Renderer 必须停止继续求值，返回结构化 `REACTION_LOOP_LIMIT`，并将相关节点置为错误态。第 10 轮仍可提交其已计算的状态变更，但不得开始第 11 轮。
- 下一轮仅由实际状态变化触发：reaction value commit 的字段值发生深相等变化，或宿主产生新的外部字段更新。没有实际变化不得继续触发下一轮。

理由：声明式协议不应允许隐藏的无限循环拖垮页面。循环保护是 Renderer 的安全阀，不改变正常配置的可观测行为。

### D5. 表格列/操作与 `scope: row` 不引入 `value` 写入

本 ADR 只定义**表单字段**级 `reactions.fulfill.value` / `otherwise.value` 的求值时序。

ADR-0004 D2a（0044/V167 修订）已决策：表格 `columns[]` / `actions[]` 上的 reactions **无论** `scope: form` 或 `scope: row`，均禁止 `required`/`value`，仅允许 `visible`/`disabled`。`scope: row` 本身也仅允许挂载在表格列/操作上。该限制保持不变。

如果未来要支持行内字段回写，必须另开 ADR，并显式说明是否复用本 ADR 的快照 / 批量提交模型、如何处理分页和远程数据刷新后的本地状态。

## 合并清单

| # | 内容 | 目标文档 |
|---|---|---|
| M1 | 将 `01-node-protocol.md` §3.10 的“求值时序未定义”替换为稳定快照模型 | `01-node-protocol.md` |
| M2 | 在表达式规范中新增求值轮次、快照、提交、循环保护规则 | `02-reaction-expression.md` |
| M3 | 在 Renderer 规范中补充表达式调度要求 | `08-renderer-spec.md` |
| M4 | 更新 0012 审计 checklist | `docs/audit/` |

## 后果

**正面：**
- 同轮读写行为确定，Renderer 之间不会因遍历顺序或框架批处理差异产生不同结果。
- `value` 写入不会在同轮中影响可见性判断，调试时只需理解“本轮读旧值，下一轮读新值”。
- 与 ADR-0003 的“reactions 始终求值”兼容。

**负面 / 取舍：**
- 某些配置希望“写入后立刻影响同轮 visibleWhen”，现在必须等待下一轮求值。这是有意识的取舍：确定性优先于同步联动的表面即时性。
- 多处写同一字段虽然有确定性结果，但仍是低质量配置，Renderer 只能警告，无法完全阻止所有语义冲突。
