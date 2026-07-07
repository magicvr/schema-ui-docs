# 已归档审计记录

> 审计文件完成所有跟踪条目的修复后，移入本目录归档。
> 最新归档靠前排列。

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
