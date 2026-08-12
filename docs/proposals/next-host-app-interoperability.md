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

- [x] 0034–0037 的结构、算法、错误码、安全和非目标完成评审（2026-08-13；self 评审修正 4 项：
      F-1 P1 跨 ADR 分类冲突、F-2/F-3/F-4 P2，全部落入 ADR 文本；见 ADR-0034 §H1 评审与 accept 记录）；
- [x] 至少两个独立 Host/App 消费者证据，或明确接受单消费者 residual（`schema-ui-core` 的
      `apps/web` Host 与 `apps/api` App 侧两个独立实现；维护者显式接受单组织 residual，跨组织第二
      Host 不设为本批 accept 门禁）；
- [x] 确定目标协议版本与 migration 策略（2.8.0 / `2.8`，additive + capability 门控，无强制迁移；
      见 ADR-0034 D9）；
- [x] accepted ADR 同一变更集更新核心规范交叉引用，但尚未宣称生产支持（新增
      [10-host-interoperability.md](../10-host-interoperability.md) 规范投影；`08` §3.4 登记三个
      capability；`09` 增补 `pages[].returnIntentQueryKeys`；`protocol-manifest.json` 按计划随 H4
      变更集原子更新，保持 v2.7.0 制品可复现。commit `3936cf9`）。

### H2 — 机器契约与行为向量

- [x] bootstrap/failure/claim 封闭 JSON Schema（B0 `host-bootstrap.schema.json`、F0
      `host-failure.schema.json`、C0 `host-conformance-claim.schema.json`，全部
      `additionalProperties: false` + 条件字段 if/then；commit `453008d`）；
- [x] capability registry 与 dependency contract（`capability-registry.json` 17 项登记、
      依赖闭包、DAG 无环、removedIn 规则；C1 按 §4.8 顺序执行）；
- [x] semantic validator、稳定错误码与正反 fixtures（B1 §2.8 诊断码、F1 分类/过滤、C1 校验码；
      host-bootstrap 23 / host-failure 43 / host-conformance-claim 30 正反 fixtures，
      app-manifest +4 returnIntentQueryKeys 用例）；
- [x] JS/Python reference 逐字段一致（全部新 suite 双语言通过；claim 规范化 digest 跨语言
      交叉验证一致）；
- [x] 旧 2.7 page/manifest conformance 全部回归（2.7 线全量通过后随 H4 版本线推进到 2.8；
      41 条 conformance 条目 JS/Python 全绿）。

### H3 — 生产 Host evidence

- [x] 至少一个生产 Host 从真实入口消费新协议对象（消费者 `schema-ui-core` `apps/web` 生产
      boot 路径消费 Go API 真实 bootstrap document（同字节组装，`manifest.sha256` 真实核验）；
      GOAL-004 E-004）；
- [x] claim 绑定同一协议 artifact digest、fixture digest 与 build ID（构建生成
      `conformance-claim.json`，绑定上游制品 contentDigest、fixture 树 digest 与
      `git:<buildId>`，`claim-artifact.test` 门禁：C0/C1 `CLAIM_OK` + evidence sha256 绑定；
      2.8.0 正式发布后已重 pin 最终 digest）；
- [x] browser-level failure focus/live-region 与 recovery 测试（Playwright 4 tests：
      maintenance 终态 manifest 未获取 + polite + focus、protocol-rejected assertive、
      route not-found home 恢复 + focus 回主标题、真实入口正常 boot；全量 e2e 7 通过）；
- [x] 消费者不得以 fixture adapter、mock 或私有 allowlist 冒充生产支持（生产模块直接消费
      上游 fixtures：host 三 suite 99 cases 零排除；app-manifest/app-navigation 零排除；
      已登记 residual 与候选绑定性质记录在 E-004，不冒充）。

### H4 — 发布闭环

- [x] 新版本 release goal、migration、CHANGELOG 与 `protocol-manifest.json` 原子更新
      （`release-goals/v2.8.md` G0–G4 闭合、`migrations/2.7-to-2.8.md`、CHANGELOG `v2.8.0`、
      `semanticSpecs` 增补 10-host-interoperability 与 ADR-0034–0037；commit `593f625`）；
- [x] 完整本地/CI conformance、artifact reproducibility、MCP/validator compatible range
      （421 versioned cases；release:check / release:check:mcp / release:check:validator 全绿；
      制品 build/verify 双一致；MCP 134 tests；链接检查通过）；
- [x] 人工 tag 后的 release asset/digest 与消费者 pin 可核对（tag `v2.8.0`；
      contentDigest `sha256:40690917…` / artifactDigest `sha256:594207e0…` / fixture 树
      `sha256:7aacf133…`；消费者仓重 pin `593f625` 并重生成 claim，可逐字核对）；
- [x] 正式证据产生前不关闭发布门禁（H3 evidence 与消费者 E-004 先于本变更集落盘；
      发布门禁随证据关闭）。

## 5. 防漂移规则

1. 不建立平行 branding、navigation、permission、Action 或 backend error 权威；
2. bootstrap document 不携带 session/secret，不内嵌 manifest/page；
3. Host failure 不按任意后端 `code` 驱动动作；
4. conformance claim 不允许 partial/skip/allowlist 冒充 capability；
5. `reserve-extension` 不生成空 schema、空 capability 或核心正例；
6. proposed ADR 在 accepted 前不得进入 `protocol-manifest.json` `authority.semanticSpecs`。

## 6. 当前结论

H0–H4 全部闭合（2026-08-13）：ADR 0034–0037 accepted（`3936cf9`）→ H2 机器契约落地
（`453008d`）→ H3 生产 Host evidence 与浏览器级测试（消费者仓 GOAL-004 E-004）→ H4 发布闭环
（`593f625`，tag `v2.8.0`）。正式制品 `schema-ui-protocol-2.8.0` 已发布：contentDigest
`sha256:40690917b7b83f54936453b5851c87320f5ed878b517eab7d1558d12fe506a31`、artifactDigest
`sha256:594207e06ed7ecbb97515c3bc7add985c7b8b81ec74e678f4a12d270909bd18b`；消费者仓已按正式
digest 重 pin。三个能力包均为可选 capability，未声明的 Host 零行为变化。
