---
status: active
owner: 前后端架构组
last_updated: 2026-08-13
applies_to: schema-ui-protocol vNext (candidate track)
---

# 下一步目标：Host/App 互操作协议轨道

本文档是 **informative 演化轨道**，不改变 v2.7.0 语义，不是发布门禁，也不授权生产消费者提前实现。
语义候选以 proposed [ADR-0034](../decisions/0034-host-app-interoperability-boundary.md)–[0037](../decisions/0037-host-conformance-claim.md)
为准；在 ADR accepted、规范/Schema/fixtures 原子落地并发布新制品前，不得声明协议已支持。

## 1. 目标

让同一 App 制品在两个独立 Host 上获得可核验的一致结果：

- 启动顺序、manifest identity 与 maintenance/upgrade/degraded 终态一致；
- Host 级失败分类、恢复动作、安全诊断和无障碍最低行为一致；
- Host 对版本/capability 的支持声明能够绑定协议制品、fixtures、suite 与 evidence。

## 2. 范围

| 能力包 | ADR | 候选 capability | 状态 |
|---|---|---|---|
| Host bootstrap lifecycle | [0035](../decisions/0035-host-bootstrap-lifecycle.md) | `host.bootstrap` | proposed |
| Host failure/recovery | [0036](../decisions/0036-host-failure-recovery.md) | `host.failure-recovery` | proposed |
| Host conformance claim | [0037](../decisions/0037-host-conformance-claim.md) | `host.conformance-claim` | proposed |

公共 branding/profile、download/job/realtime、tenant/context、telemetry/audit、完整 accessibility preferences
均不在首批。候选目录的逐项 adopt/reserve/out 裁定见 ADR-0034 D10。

## 3. 版本策略

- 仅新增可选 document/字段/capability，且旧页面、旧 manifest、现有 401/403 与 Action 可观测结果不变：
  目标为下一个 MINOR；
- 改变 ADR-0025 一次性 manifest snapshot、未知字段 fail-closed、既有错误优先级或合法输入：评估下一
  MAJOR，禁止静默改写 v2.7；
- proposed ADR、本文与项目边界说明均不触发版本变更。

## 4. 阶段与门禁

### H0 — 提案边界冻结

- [x] umbrella ADR 明确薄 Host/App 层与协议外事项；
- [x] 95 个候选均获得 `adopt-now` / `reserve-extension` / `explicitly-out` 处置；
- [x] 三个能力包拆成独立 proposed ADR；
- [x] 独立审计无 P0/P1 阻断（2026-08-13 Grok Build 最终复核：`BLOCKING_COUNT=0`；
  本轮 cross 审计落盘见消费者仓 GOAL-004 `03-audit/A-002`，复核轮 `03-audit/A-003` pass）；
- [x] 消费者候选目录同步 ADR-0034 D10 的 H0/S2 标签语义，不以 deferred 冒充已保留 capability
  （2026-08-13：消费者仓 `schema-ui-core` 目录附件新增 §1b/§1c/§6 同步说明，
  commit `c0c7bc1`（目录引入）+ `473be5f`（self 审计 A-001 与台账）；95/95 处置与 D10 逐字核对一致，
  self 审计 A-001 pass，independent 审计 A-002 conditional / A-003 pass，BLOCKING_COUNT=0）；
- [x] 维护者确认进入 accept 设计阶段（2026-08-13 维护者确认）。

### H1 — ADR accept

- [ ] 0034–0037 的结构、算法、错误码、安全和非目标完成评审；
- [ ] 至少两个独立 Host/App 消费者证据，或明确接受单消费者 residual；
- [ ] 确定目标协议版本与 migration 策略；
- [ ] accepted ADR 同一变更集更新核心规范交叉引用，但尚未宣称生产支持。

### H2 — 机器契约与行为向量

- [ ] bootstrap/failure/claim 封闭 JSON Schema；
- [ ] capability registry 与 dependency contract；
- [ ] semantic validator、稳定错误码与正反 fixtures；
- [ ] JS/Python reference 逐字段一致；
- [ ] 旧 2.7 page/manifest conformance 全部回归。

### H3 — 生产 Host evidence

- [ ] 至少一个生产 Host 从真实入口消费新协议对象；
- [ ] claim 绑定同一协议 artifact digest、fixture digest 与 build ID；
- [ ] browser-level failure focus/live-region 与 recovery 测试；
- [ ] 消费者不得以 fixture adapter、mock 或私有 allowlist 冒充生产支持。

### H4 — 发布闭环

- [ ] 新版本 release goal、migration、CHANGELOG 与 `protocol-manifest.json` 原子更新；
- [ ] 完整本地/CI conformance、artifact reproducibility、MCP/validator compatible range；
- [ ] 人工 tag 后的 release asset/digest 与消费者 pin 可核对；
- [ ] 正式证据产生前不关闭发布门禁。

## 5. 防漂移规则

1. 不建立平行 branding、navigation、permission、Action 或 backend error 权威；
2. bootstrap document 不携带 session/secret，不内嵌 manifest/page；
3. Host failure 不按任意后端 `code` 驱动动作；
4. conformance claim 不允许 partial/skip/allowlist 冒充 capability；
5. `reserve-extension` 不生成空 schema、空 capability 或核心正例；
6. proposed ADR 在 accepted 前不得进入 `protocol-manifest.json` `authority.semanticSpecs`。

## 6. 当前结论

H0 提案阶段全部六项已闭合（2026-08-13），维护者已确认进入 **H1 · ADR accept 设计阶段**。H1 的四项
门禁（0034～0037 评审、独立消费者证据、目标协议版本与 migration 策略、accepted ADR 更新核心规范
交叉引用）尚未完成。v2.7.0 制品、页面协议与 app manifest 不变；消费者项目可以继续用私有 Host
adapter，但只能把实现作为设计证据，不能据此宣称新协议到手或进入协议驱动的实现整改。
