# 已归档审计记录

> 审计文件完成所有跟踪条目的修复后，移入本目录归档。
> 最新归档靠前排列。

---

## 0019 — 2026-07-08 — 权限表达式 ADR 残留 + protocolVersion 格式校验边界

**主题：** 修复 ADR-0003 中 `permissions.*` 仍保留“协议不强制禁止”的旧建议性措辞，以及 `page.schema.json` 未校验 `meta.protocolVersion` MAJOR.MINOR 格式的问题。
**性质：** 表达式作用域决策一致性 + 页面 Schema 格式约束修复审计。

| 文件 | 说明 |
|---|---|
| [0019-2026-07-08-review.md](./0019-2026-07-08-review.md) | 审视报告 — V22(🟡)/V23(🟡) |
| [0019-2026-07-08-checklist.md](./0019-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V22: `decisions/0003-context-namespace-and-visible-when.md` 将 `permissions` 定位改为仅允许 `$context.*`、不得掺杂 `$deps.*` 等业务字段状态，并确认 `01-node-protocol.md` 与 `02-reaction-expression.md` 已是强制静态校验口径
- V23: `schemas/page.schema.json` 为 `meta.protocolVersion` 增加 MAJOR.MINOR 格式 `pattern`，`06-validation.md` 的 L0 页面结构校验说明同步补充该格式校验能力

---

## 0018 — 2026-07-08 — responseMapping 语义校验边界 + 文档元数据漂移

**主题：** 修复 `responseMapping` 的 `list` / `total` 条件必填语义未落入校验清单的问题，并同步 0017 修复链触达文档的 `last_updated` 元数据。
**性质：** 数据源响应映射语义校验 + 文档元数据修复审计。

| 文件 | 说明 |
|---|---|
| [0018-2026-07-08-review.md](./0018-2026-07-08-review.md) | 审视报告 — V20(🟡)/V21(🟢) |
| [0018-2026-07-08-checklist.md](./0018-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V20: `06-validation.md` 明确 `responseMapping.list` / `total` 的条件必填属于语义校验，不能只靠 L1 Schema 完成，并在自检清单中补充列表类接口和服务端分页表格的检查项
- V21: `03-component-registry.md` 与 `06-validation.md` 的 `last_updated` 同步为 `2026-07-08`

---

## 0017 — 2026-07-08 — 组件注册 DSL 解释边界 + DataRef 交叉引用漂移

**主题：** 修复 `component-registry.json` 自定义 DSL 对 JSON Schema 风格组合关键字的解释边界说明，以及 `DataRef.params` 空值规则的交叉引用章节漂移。
**性质：** 组件注册 DSL 校验语义 + 数据源契约交叉引用修复审计。

| 文件 | 说明 |
|---|---|
| [0017-2026-07-08-review.md](./0017-2026-07-08-review.md) | 审视报告 — V18(🟡)/V19(🟢) |
| [0017-2026-07-08-checklist.md](./0017-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V18: `03-component-registry.md` 补充 DSL 约束关键字白名单和两种 `required` 语义；`06-validation.md` 明确 L2 校验必须处理组件 DSL 组合约束
- V19: `01-node-protocol.md` 将 `DataRef.params` 空值规则引用从 `04-datasource-contract.md §8` 改为 §3.1

---

## 0016 — 2026-07-08 — DSL 必填关系 + 行级依赖语义 + Renderer 表达式示例漂移

**主题：** 修复 `component-registry.json` 中 `text.content` 与 `contentKey` 的二选一约束冲突、`reaction.schema.json` 中 `dependencies` 的 scope 分支描述、Renderer `contains` 运算符示例和完整变量注入边界说明。
**性质：** 组件注册 DSL 约束一致性 + 表达式机器描述 + Renderer 示例语义修复审计。

| 文件 | 说明 |
|---|---|
| [0016-2026-07-08-review.md](./0016-2026-07-08-review.md) | 审视报告 — V14(🔴)/V15(🟡)/V16(🟡)/V17(🟡) |
| [0016-2026-07-08-checklist.md](./0016-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V14: `component-registry.json` 中 `text.props.content.required` 改为 `false`，由组件级 `anyOf` 表达 `content` / `contentKey` 二选一
- V15: `reaction.schema.json` 的 `dependencies.description` 明确 `scope: form` 对应 `$deps.*`，`scope: row` 对应 `$row.*` 行内字段路径
- V16: `08-renderer-spec.md` 将 `contains` 表述为协议级二元运算符，删除函数调用例外
- V17: `08-renderer-spec.md` 补充最小示例的变量覆盖边界，说明 `$self` / `$row` / `$parentRow` 由调用方按表达式位置注入

---

## 0015 — 2026-07-08 — 示例可执行性 + 入口索引漂移 + 表达式作用域残余歧义 + 校验命令路径

**主题：** 修复 `08-renderer-spec.md` 中 `dateRangePicker` 旧式 `$deps.dateRange` 示例、根 README 目录树遗漏、表达式作用域和 `$self` 边界歧义、`06-validation.md` 校验命令路径问题。
**性质：** 示例可执行性 + 文档导航完整性 + 表达式静态校验边界修复审计。

| 文件 | 说明 |
|---|---|
| [0015-2026-07-08-review.md](./0015-2026-07-08-review.md) | 审视报告 — V9(🔴)/V10(🟡)/V11(🟡)/V12(🟡)/V13(🟢) |
| [0015-2026-07-08-checklist.md](./0015-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V9: `08-renderer-spec.md` 示例改为 `dateFrom: $deps.dateFrom` + `dateTo: $deps.dateTo`
- V10: 根 `README.md` 目录树补充 `05-scenarios/README.md`、ADR-0005、ADR-0006
- V11: `02-reaction-expression.md` 收紧 `scope: form` 默认场景，并明确非表单节点 `visibleWhen` 只能访问 `$context.*`
- V12: `02-reaction-expression.md` 将表格列 `scope: form` 下 `$self` 标为不可用，并补充静态校验规则
- V13: `06-validation.md` 校验命令和 VS Code YAML 配置路径统一为仓库根目录下的 `docs/schemas/page.schema.json`

---

## 0014 — 2026-07-08 — 审计证据链自洽性 + 被排查盲区遗漏 + Schema 格式本质矛盾 + ADR 收尾

**主题：** 审计证据链自洽性修复（0013 checklist 回补）、`08-renderer-spec.md` `applies_to` 版本声明盲区修复、`component-registry.json` Schema 方言声明修正、ADR-0005/0006 状态收尾更新、ADR-0005 文字重复修正。
**性质：** 审计流程自洽性 + 排查盲区修复 + Schema 格式声明修正审计。

| 文件 | 说明 |
|---|---|
| [0014-2026-07-08-review.md](./0014-2026-07-08-review.md) | 审视报告 — V4(🔴)/V5(🔴)/V6(🟡)/V7(🟡)/V8(🟢) |
| [0014-2026-07-08-checklist.md](./0014-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0014-2026-07-08-plan.md](./0014-2026-07-08-plan.md) | 处理计划 |

**关键修复：**
- V4: `archived/0013-checklist.md` 全部子项标记为 `[x]` + O1 决策记录回补 + `audit/README.md` 重复行清理与陈述修正
- V5: `08-renderer-spec.md` `applies_to` 版本声明 `v0.2.1`→`v0.2`（统一裸版本号）
- V6: `component-registry.json` `$schema` 改为自定义 DSL 标识 `component-registry-dsl#` + `03-component-registry.md` 补充格式说明
- V7: `decisions/0005`/`0006` 状态行"需合并入"→"已合并入"
- V8: `decisions/0005` 第 82 行 `valueField` 重复删除

---

## 0013 — 2026-07-08 — 版本/since 标注漂移复发与残留修复

**主题：** 审计 0006 M3/M6 同类缺陷复发与残留修复，包括 `00-overview.md` 版本声明同步、`modal.content` since 标注统一、`component-registry.json` 7 处 since 批量更新。
**性质：** 版本/since 标注一致性修复审计。

| 文件 | 说明 |
|---|---|
| [0013-2026-07-08-review.md](./0013-2026-07-08-review.md) | 审视报告 — V1(🔴)/V2(🟡)/V3(🟡)/O1(🟢) |
| [0013-2026-07-08-checklist.md](./0013-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V1: `00-overview.md` §5 版本声明 v0.2.3→v0.2.4，`last_updated` 同步
- V2: `07-actions-contract.md` 代码注释 + `action.schema.json` 描述统一为 `since 0.2.1`
- V3: `component-registry.json` 7 处 column/action `(since 0.2)`→`(since 0.2.1)`
- O1: `01/02/04/08` 四篇文档 `last_updated` 同步为 2026-07-08

---

## 0012 — 2026-07-08 — ADR 决策缺口汇总审视

**主题：** ADR 决策缺口收集与决策收敛，标准化 `responseMapping` 与表达式读写求值时序。
**性质：** 决策缺口审视与 ADR 合入审计。

| 文件 | 说明 |
|---|---|
| [0012-2026-07-08-review.md](./0012-2026-07-08-review.md) | 审视报告 — A1/A2 已产出 ADR，A3-A6 与 B 组保留为未来触发型议题 |
| [0012-2026-07-08-checklist.md](./0012-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- A1: 新增 ADR-0005，标准化 `data.responseMapping`，并同步核心协议、数据源契约、Renderer 规范与 `node.schema.json`
- A2: 新增 ADR-0006，定义表达式稳定快照求值模型，并同步 Node 协议、表达式规范、Renderer 规范与 ADR-0003 遗留说明
- A3-A6 / B1-B7: 明确保持未来触发型，不在缺少真实场景时提前扩展协议

---

## 0010 — 2026-07-08 — Renderer 示例与规范措辞边界复查

**主题：** Renderer 可复制示例结构、`$deps.*` 作用域边界、跨作用域变通措辞、`tabs` 历史方案残留。
**性质：** 文档语义一致性复查。

| 文件 | 说明 |
|---|---|
| [0010-2026-07-08-review.md](./0010-2026-07-08-review.md) | 审视报告 — 4 项问题（3🟡 + 1🟢） |
| [0010-2026-07-08-checklist.md](./0010-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V1: `08-renderer-spec.md` §2.1 并行加载示例 `body` 数组 → `grid` 容器包裹
- V2: `08-renderer-spec.md` §2.3 `$deps.*` 示例改为 `form` 表单上下文
- V3: `02-reaction-expression.md` §9.1 收紧未定义的跨作用域变通描述
- V4: `03-component-registry.md` / `component-registry.json` 清理"方案 A"历史措辞

---

## 0009 — 2026-07-08 — Schema 约束与正文契约复查

**主题：** Schema 约束层级修正、条件必填补齐、描述漂移清理——第九轮正文与机器可读契约一致性复查。
**性质：** 一致性复查审计。

| 文件 | 说明 |
|---|---|
| [0009-2026-07-08-review.md](./0009-2026-07-08-review.md) | 审视报告 — 3 项问题（2🟡 + 1🟢） |
| [0009-2026-07-08-checklist.md](./0009-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- U1: `component-registry.json` `form` 条件必填 allOf 从组件对象层移入 `props` 内
- U2: `action.schema.json` `OutcomeBehavior` 新增 `if/then` 条件必填（toast→message, navigate→url）
- U3: `component-registry.json` `table.props.actions.description` 旧措辞更新为当前语义

---

## 0008 — 2026-07-08 — 残余文档一致性与链接审视

**主题：** 文档断链修复、正文与 Schema 漂移修正、审计元数据一致性更新——第八轮残余问题收敛。
**性质：** 残余一致性审视审计。

| 文件 | 说明 |
|---|---|
| [0008-2026-07-08-review.md](./0008-2026-07-08-review.md) | 审视报告 — 6 项问题（2🟡 + 4🟢） |
| [0008-2026-07-08-checklist.md](./0008-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- T1: `01-node-protocol.md` §3.3 `DataRef.method` 枚举同步（GET/POST → 全量）
- T2: `03-component-registry.md` 与 `CHANGELOG.md` 断链修正
- T3: 归档文件 `0002`/`0004` 历史断链修正
- T4: `component-registry.json` `visibleField.description` 更新为语法糖描述
- T5: `08-renderer-spec.md` §1.2 补充 CI 与运行时校验边界说明
- T6: `audit/README.md` 编号规则示例更新

---

## 0007 — 2026-07-07 — 文档第七轮全面审视

**主题：** 组件契约完备性、表达式作用域边界、文档内部一致性——组件级别与规则级别的全面审查。
**性质：** 全面审视审计。

| 文件 | 说明 |
|---|---|
| [0007-2026-07-07-review.md](./0007-2026-07-07-review.md) | 审视报告 — 8 项问题（3🔴 + 2🟡 + 3🟢） |
| [0007-2026-07-07-checklist.md](./0007-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- S1: `select` 组件补充 `required` / `defaultVisible` 字段
- S2: `dateRangePicker` 补充 `reactions` 注意事项表格
- S3: `02-reaction-expression.md` §10.4 措辞修正
- S4: `04-datasource-contract.md` 新增 `data.params` 作用域边界章节
- S5: `03-component-registry.md` 搜索模式示例结构修正
- S6: `CHANGELOG.md` 措辞清理（移除“方案 A”）
- S7: `component-registry.json` `placeholder` 补充 `since` 标注
- S8: 新增 `05-scenarios/README.md` 目录索引

---

## 0006 — 2026-07-07 — 文档元数据一致性审计

**主题：** CHANGELOG 完整性、版本标注精度、frontmatter 统一性——元数据层面一致性检查。
**性质：** 元数据一致性审计。

| 文件 | 说明 |
|---|---|
| [0006-2026-07-07-review.md](./0006-2026-07-07-review.md) | 审视报告 — 8 项问题（3🔴 + 3🟡 + 2🟢） |
| [0006-2026-07-07-checklist.md](./0006-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- M1: `CHANGELOG.md` B8 字段名 `supportsData` → `supportsStates`
- M2: `CHANGELOG.md` v0.2.1 补充 ADR-0004 合并记录
- M3: `00-overview.md` §5 版本声明同步至 v0.2.2
- M4: `07-actions-contract.md` §5.1 `content` 补充 `(since 0.2.1)` 标注
- M5: `08-renderer-spec.md` frontmatter 修正（`applies_to` + `date` → `last_updated`）
- M6: `03-component-registry.md` 表格字段 `since 0.2` → `since 0.2.1`（5 处）
- M7: `component-registry.json` 废弃标注能力评估（策略 A：接受现状）
- M8: `04-datasource-contract.md` §4.1 嵌套 blockquote 格式优化

---

## 0005 — 2026-07-07 — ajv 实测校验 + 交叉比对发现的隐性缺陷

**主题：** 首次引入 ajv 编译运行实测校验 JSON Schema，发现 `action.schema.json` `additionalProperties` 结构性缺陷（🔴）、最小页面示例缺少 `protocolVersion`（🔴）、CHANGELOG 审计编号断链（🟡）、未定义插值语法孤例（🟢）。
**性质：** 实测校验审计。

| 文件 | 说明 |
|---|---|
| [0005-2026-07-07-review.md](./0005-2026-07-07-review.md) | 审视报告 — M1–M4 四个新发现的问题（2🔴 + 1🟡 + 1🟢） |
| [0005-2026-07-07-checklist.md](./0005-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- M1: `action.schema.json` 中将所有字段提至顶层 `properties`，修复 `additionalProperties: false` 误报
- M2: `01-node-protocol.md §5` 最小可用页面示例补加 `protocolVersion: "0.2"`
- M3: `CHANGELOG.md` v0.2.2 引用断链通过本审计记录弥合
- M4: `07-actions-contract.md §5.1` 示例移除未定义 `#{$deps.*}` 插值语法

---

## 0004 — 2026-07-07 — 残余不一致项修复

**主题：** Schema 与文档同步一致性审计——聚焦"文档说了但 Schema 没写"和"Schema 写了但文档没提"的同步遗漏。
**性质：** 一致性审计。

| 文件 | 说明 |
|---|---|
| [0004-2026-07-07-review.md](./0004-2026-07-07-review.md) | 审视报告 — 8 项残余不一致问题（3🔴 + 3🟡 + 2🟢） |
| [0004-2026-07-07-checklist.md](./0004-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- N1: `tabs.props.items.content` 增加 `$ref: node.schema.json`
- N2: `columns.items.properties` 补充 `labelKey`/`visibleWhen`/`reactions`/`permissions`
- N3: `actions.items` 补充字段 + `required` + `additionalProperties: false`
- N4: `01-node-protocol.md §3.5` reactions 示例增加 `scope`
- N5: `08-renderer-spec.md` 状态 `draft` → `stable`
- N6: `01-node-protocol.md §3.10` 可见性公式增加 `dependencies` 前置条件说明
- N7: `tabs.props.items` 补充 `required: ["key", "label"]`
- N8: `CHANGELOG.md` v0.2.1 增加版本说明脚注

---

## 0003 — 2026-07-07 — MVP 就绪度评估

**主题：** 评估协议是否已足够作为前后端团队共同使用的 MVP 实践约定。
**性质：** 缺口分析（Renderer 规范 / 后端指南 / ADR 等待区 / 缺失组件）。

| 文件 | 说明 |
|---|---|
| [0003-2026-07-07-review.md](./0003-2026-07-07-review.md) | 审视报告 — 四大缺口评估 |
| [0003-2026-07-07-checklist.md](./0003-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键产出：**
- 新增 `docs/08-renderer-spec.md`（R1–R4、G2、G3）
- 新增 `datePicker` / `dateRangePicker` / `searchForm` / `upload` 组件
- `modal` 类型增加 `content: Node` 字段
- `06-validation.md` 追加 §5 本地校验指南
- ADR-0003（`$context` + `visibleWhen` + `permissions`）、ADR-0004（`$row` 作用域）已通过并合并

---

## 0002 — 2026-07-07 — v0.2 修复回归检查

**主题：** 针对 0001 审计修复后的 v0.2 协议做回归检查，验证修复完整性。
**性质：** 回归审计。

| 文件 | 说明 |
|---|---|
| [0002-2026-07-07-review.md](./0002-2026-07-07-review.md) | 审视报告 — 新增 D1–D7 问题 |
| [0002-2026-07-07-checklist.md](./0002-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- D1: `04-datasource-contract.md` 重复 §7 删除
- D2: 新增 `schemas/page.schema.json`
- D3: `01-node-protocol.md §3.4` tabs children 说明修正
- D4: `component-registry.json` 中 `columns` 补充 items 定义
- D5: 错误响应体 `code` 字段语义明确
- D6: `reaction.schema.json` `minItems` 修复
- D7: `DataRef.method` 枚举与 `action.schema.json` 同步

---

## 0001 — 2026-07-07 — 初版协议审视

**主题：** 对 v0.1 协议进行全面设计审视，识别设计缺陷、未覆盖场景、文档问题。
**性质：** 初次全面审计。

| 文件 | 说明 |
|---|---|
| [0001-2026-07-07-review.md](./0001-2026-07-07-review.md) | 审视报告 — 原始问题发现 |
| [0001-2026-07-07-checklist.md](./0001-2026-07-07-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0001-2026-07-07-plan.md](./0001-2026-07-07-plan.md) | v0.2 变更计划（A/B/C/D 分组） |

**关键产出：** v0.2 协议的全部 A/B 组修复（15 项）、C 组 ADR 立项（C1–C4）。

---

> 最后更新：2026-07-07
