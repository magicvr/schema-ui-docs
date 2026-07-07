# 已归档审计记录

> 审计文件完成所有跟踪条目的修复后，移入本目录归档。
> 最新归档靠前排列。

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
