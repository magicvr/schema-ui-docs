---
status: accepted
date: 2026-08-12
last_updated: 2026-08-13
applies_to: schema-ui-protocol v2.8
track: Host/App interoperability
---

# ADR-0034: Host/App 互操作边界与 vNext 增补范围

## 状态

**Accepted（2026-08-13，H1 accept 设计阶段评审通过）。** 自 `schema-ui-protocol v2.8` 起进入实现轨道；
[ADR-0035](./0035-host-bootstrap-lifecycle.md) / [0036](./0036-host-failure-recovery.md) /
[0037](./0037-host-conformance-claim.md) 同步 accepted。accept 只裁定边界与候选 wire 设计，
**不宣称生产支持**：H2 机器契约、H3 生产 Host evidence 与 H4 发布闭环门禁完成并发布新制品前，
不得声明协议已支持；消费者仓在 S3 固定前不得按新协议整改实现。
（2026-08-13 发布后注记：H2–H4 已全部闭合，`v2.8.0`（tag `v2.8.0` @ `593f625`）已发布，
本段为 accept 时点状态，不再构成当前限制。）

输入证据来自消费者仓的
`I-HOST-APP-001-protocol-gap-catalog.md`（2026-08-12）。该目录是需求输入，不是协议权威；
其中每个候选仍须由后续 ADR 以真实跨实现用例、数据形状、失败语义和 fixtures 单独裁定。

## 背景

Schema-UI 当前已经定义两层互操作契约：

1. 页面协议：Node 树、DataRef、Action、表单、表格与 Renderer 可观测行为；
2. 应用级清单：应用元信息、页面发现、路由匹配和 `top` / `sidebar` / `user` 导航。

消费者项目已经在生产 Host 中实现会话恢复、公开 branding、manifest 缓存、全局错误页、上传下载等能力，
但这些实现混合了三类不同问题：

- 现有协议已经定义，消费者只需修正或证明 conformance；
- 多个独立 Host 与 App 生产方确实需要一致，但当前协议没有可观测契约；
- 认证供应商、凭据存储、租户平台、通知中心等产品或部署能力，并不因单个 Host 已实现就自动成为
  Schema-UI 核心协议职责。

若全部保持私约，Host 启动、失败恢复和支持能力声明无法跨实现核验；若把候选目录整体升格，协议会越过
“页面语义与应用发现”的边界，绑定具体身份系统、运维平台和产品功能。两者都不可接受。

## 决策

### D1. 需要增补，但采用薄的 Host/App 互操作层

新增协议面的判据是：同一 App 制品交给两个独立 Host 时，某项差异会改变 App 能否启动、页面是否可安全
装载，或失败结果是否可被一致识别。满足该判据的行为属于 Host/App 接缝，可以进入协议设计。

协议只定义跨实现可观测的输入、状态、结果和安全不变量；不规定某个前端框架、认证供应商、数据库、
日志平台或部署拓扑。

### D2. vNext 首批只设计三个原子能力包

本 ADR 接受以下问题进入设计。数据形状分别由 proposed ADR-0035、0036、0037 给出；三篇均未接受，
禁止以一个“Host 大对象”一次性合并。

| 能力包 | 首批范围 | 主要目录锚点 |
|---|---|---|
| [Host bootstrap](./0035-host-bootstrap-lifecycle.md) | 确定性阶段与 ready 判定、manifest 来源与 provenance、缓存身份、maintenance / upgrade-required / degraded 终态 | `BOOT-001`、`BOOT-002`–`005` 的缺失增量、`BOOT-007` |
| [Host failure and recovery](./0036-host-failure-recovery.md) | Host 级稳定错误结果、transport 分类、correlation、重试提示、安全诊断摘要、auth-lost/forbidden/not-found 的可区分结果、focus/live-region 最低义务 | `ERROR-001`–`005`、`ERROR-007`–`009`、`OBS-001`、`SEC-001` / `002`、`A11Y-001` / `002` |
| [Host conformance claim](./0037-host-conformance-claim.md) | Host 支持的协议版本与 capability、测试套件版本、证据制品、partial-support 禁止项、未知输入 fail-closed | `GOV-001`、`GOV-003` / `004` 的 Host 增量、`GOV-007` |

三个能力包可以进入同一候选 MINOR 的规划，但必须分别通过 ADR、Schema、semantic validator 与 versioned
fixtures 门禁。任一包未就绪，不得用 TypeScript interface、服务端 struct 或消费者测试替代协议定义。

### D3. 复用现有权威，不重复发明协议

以下事项已有规范或 ADR，默认不是新协议缺口：

- app manifest 版本、`requiredCapabilities`、页面注册表、well-known/显式入口、严格版本协商；
- `top` / `sidebar` / `user` 导航槽位、一层分组、数组顺序、路由模板匹配和 deep link 注入；
- `labelKey` 优先、字面 `label` fallback 的 i18n 双轨；
- app `name` / `nameKey`、light/dark logo 及受限 URL 形态；
- 页面/清单固定对象的 `additionalProperties: false` 和未知字段 fail-closed；
- `$context.user` / `$context.features` 是呈现快照，不替代服务端授权；
- Node 级 loading/empty/error、字段错误映射、Action toast/navigate/reload/closeModal 与 upload 执行。

后续 ADR 只能补这些规则没有覆盖的 Host 级增量，不得建立第二套 manifest、navigation、i18n、权限或
Action 语义。

### D4. 认证只定义接缝结果，不定义身份系统

页面协议继续不携带凭据。OAuth/OIDC/SAML、MFA、密码恢复、token/cookie 存储、refresh rotation、CSRF、
设备管理、模拟身份和管理员撤销属于 Host、身份服务或部署安全 profile，不进入 Schema-UI 核心 wire
协议。

Host failure/recovery 能力包可以定义 Renderer 可观察的最小结果，例如：

- anonymous、authenticated、reauth-required、forbidden；
- principal 快照是否可注入以及其 provenance；
- auth-lost 后是否允许恢复一个经过 Host 校验的 return intent；
- 401 与 403 的稳定区分、循环阻断和清理后的可观测结果。

协议不得定义登录端点、token 字段、IdP 参数或客户端 secret，也不得要求所有 Host 采用同一种凭据
transport。若未来多个独立实现确需共享某个 transport profile，必须另立非核心 profile ADR，并以
capability 显式协商。

### D5. 公共 branding 与 preference 先复用 manifest，再评估最小增量

`app.name` / `nameKey` 与 light/dark logo 已由应用清单定义，不新增平行 `/branding` 权威对象。
消费者可继续提供私有 `/api/branding`，但跨实现声明必须投影到 manifest 或后续被接受的 manifest
增量。

favicon、默认 locale/theme/timezone、资产 alt/fallback 与配置失效通知可以作为独立的
`app.profile` 候选能力评审。接受前须证明它们必须在页面装载前跨 Host 一致，并明确缓存 key、URL 安全、
invalid fallback 与匿名访问边界。tenant branding、邮件/PDF 品牌 profile 保留为后续扩展，不进入首批。

### D6. 目录中的实现候选按以下方式裁定

| 候选 | 草案裁定 | 理由 |
|---|---|---|
| `IMP-001` Settings PATCH 未拒绝未知字段 | **不是现行协议偏离** | 该 PATCH 是消费者业务 API，不是 Schema-UI 已定义的 request object。若未来协议定义 branding/config mutation，其对象再按封闭规则执行。 |
| `IMP-002` provider `Label` 与 manifest `label`/`labelKey` 双源 | **实现/projection 问题** | 最终 manifest 是消费权威；现有规范已规定 `*Key` 命中优先、字面量 fallback。provider 不得在消费阶段覆写最终清单语义。 |
| `IMP-003` 只靠 interface/struct 约束 | **首批 conformance 问题** | 对本 ADR D2 新增的协议对象，生产入口必须执行结构和语义校验，并消费同一 fixtures。 |
| `IMP-004` row selection 自动打开 detail/drawer | **保留独立 ADR** | 现有 `table.selection` 与 `recordView` 不蕴含 overlay ownership。只有出现两个独立 Renderer 的相同需求时，才设计 row context、target 与 modal/drawer 生命周期。 |

### D7. 其余候选的处置原则

- **单独立项，不并入首批：** download、background job、notification、realtime、optimistic concurrency、
  tenant/context switch、preferences persistence、breadcrumb/title、unsaved-change guard、global search。
  这些能力可能有价值，但彼此没有共同状态机，必须按真实互操作痛点逐项 ADR。
- **保留扩展位置：** MFA/SSO/recovery/device/delegation、offline、white-label、preview/scan/resumable upload、
  audit link、client telemetry、RTL/contrast/motion。保留不等于声明 capability 已存在；未定义 payload 前不得
  出现在核心正例或 conformance claim。
- **明确留在 Host/产品层：** 身份供应商编排、token/CSRF 实现、权限中台、license 计费、日志后端、
  工作流引擎、邮件/PDF 模板、远程插件市场、具体 Shell 布局与视觉 token。

### D8. 不建立通用 `extensions` 逃逸口

ADR-0025 已裁定 app manifest 顶层未知字段 fail-closed 且不预留 `extensions`。本 ADR 不推翻该决定。

新的跨实现能力必须使用已登记的字段与 capability；项目私有 Host Extension 可继续存在，但不得写入核心
manifest 正例、不得声称标准 Host 支持，也不得通过“忽略未知字段”获得隐式兼容。

### D9. 版本与交付门禁

目标版本经 H1 评审确定为下一个 MINOR **2.8.0**（`protocolVersion` `2.8`）：本批只新增可选
document/字段/capability，且旧清单与旧页面的合法输入、默认值和可观测结果不变，符合 MINOR 判据。
若需要改变 ADR-0025 的一次性 snapshot、既有 401/403 行为或未知字段规则，必须评估下一 MAJOR 或
提供显式新 capability，禁止静默改写 2.7。

**Migration 策略（H1 裁定）：** 纯 additive、capability 门控、无强制迁移动作。

1. 未声明 `host.bootstrap` / `host.failure-recovery` / `host.conformance-claim` 的既有 Host
   行为完全不变：不请求 bootstrap document、不生成 Host failure result、不产生 claim；
2. 提供新 document 的 App 不改变既有 manifest 语义；bootstrap 默认入口 `404/410` 即回退
   ADR-0025 装载路径，旧 Host 与旧 App 的对接路径零改动；
3. 升级动作只存在于「选择声明新 capability 的 Host」一侧，且必须先通过对应 capability 的
   全部机器契约与 evidence 门禁；App 侧唯一增量是可选 bootstrap document、可选 manifest
   `pages[].returnIntentQueryKeys` 与可选 claim；
4. v2.7 既有错误优先级、401/403 语义、未知字段 fail-closed 规则原样保留。

每个被接受的能力包必须原子交付：

1. 独立 accepted ADR 与核心规范投影；
2. 封闭 Schema、稳定错误码和字段集版本下限；
3. 正反 semantic/behavioral fixtures；
4. JS/Python reference 与至少一个生产 Host 的同向证据；
5. migration、CHANGELOG、release goal 与 `protocol-manifest.json` 更新；
6. conformance claim 中记录测试套件版本、协议制品 digest 和 capability 范围。

在上述门禁完成前，消费者仓现有实现只能作为设计证据，不能作为协议已支持或 S3 “新协议到手”的证据。

### D10. 候选目录逐项处置

下表沿用消费者目录的三个标签，但在 H0 提案阶段与消费者 S2 出口的含义不同：

| 标签 | 本 ADR H0 含义 | 消费者目录 S2 对齐动作 |
|---|---|---|
| `adopt-now` | 已由现有权威或 0035–0037 提案裁定；若只覆盖核心子集，行内明确残余 reserve/out | 只有对应 ADR accepted 且 shape/state/security/fixtures 齐备后，才能在目录中保持 `adopt-now` |
| `reserve-extension` | 认可独立问题域，但不创建空 capability/extension point | 消费者暂记“上游 deferred”；未来 ADR 给出稳定 capability/extension point 后才满足其 S2 定义 |
| `explicitly-out` | Schema-UI 核心明确不负责，并指出 Host/身份/安全/产品层 | 可直接同步为目录 `explicitly-out` |

因此本表是上游评估结论，不声称已经满足消费者附件第 21–29 行的 S2 出口；两边标签定义必须在 S2 前
同步，禁止用空 capability 让 checklist 表面闭合。表中“复用”不新增 2.7 语义。

#### Auth、Identity 与 Session

| ID | 处置 | 裁定 |
|---|---|---|
| `AUTH-001` | `reserve-extension` | 可发现认证方式需要独立 auth profile；首批不定义 provider wire。 |
| `AUTH-002` | `adopt-now` | 0035 定义 Host 归一化 auth state 与 principal snapshot；不定义 session endpoint。 |
| `AUTH-003` | `explicitly-out` | token refresh、rotation、replay 与 clock skew 属 Host/身份平台。 |
| `AUTH-004` | `explicitly-out` | login/logout/revoke command 与设备 scope 属身份服务。 |
| `AUTH-005` | `adopt-now` | 0036 定义 same-app return intent、固定 query allowlist、有效期和循环阻断。 |
| `AUTH-006` | `reserve-extension` | MFA/step-up challenge 需独立安全 profile。 |
| `AUTH-007` | `reserve-extension` | OIDC/SAML redirect/callback 需独立安全 profile。 |
| `AUTH-008` | `reserve-extension` | 密码、邀请与账号恢复需独立身份 profile。 |
| `AUTH-009` | `reserve-extension` | session/device projection 与 revoke action 后续立项。 |
| `AUTH-010` | `reserve-extension` | delegation/impersonation 需审计和安全 profile。 |
| `AUTH-011` | `explicitly-out` | Cookie/Bearer/CSRF/CORS 为部署安全 profile；页面协议继续不携带凭据。 |

#### Bootstrap、Discovery、Branding 与 Shell

| ID | 处置 | 裁定 |
|---|---|---|
| `BOOT-001` | `adopt-now` | 0035 定义阶段顺序、ready、取消和手动/定时重试入口。 |
| `BOOT-002` | `adopt-now` | 复用 manifest discovery，并在 0035 增加可选 bootstrap discovery。 |
| `BOOT-003` | `adopt-now` | 复用严格版本/capability 协商，不支持 partial support。 |
| `BOOT-004` | `adopt-now` | 0035 定义 manifest source/raw-byte digest identity；commit/bundle provenance 留给 0037 evidence。 |
| `BOOT-005` | `adopt-now` | 0035 定义 ETag/cache partition 和完整实例重建；runtime invalidation event 仍 `reserve-extension`。 |
| `BOOT-006` | `reserve-extension` | build/environment/region identity 后续 profile；不得含 secret。 |
| `BOOT-007` | `adopt-now` | 0035 定义 maintenance/upgrade-required/degraded 终态。 |
| `BOOT-008` | `reserve-extension` | tenant/workspace preselection 与 context 轨道一并立项。 |
| `BOOT-009` | `reserve-extension` | feature provenance 需独立 profile，且不得替代 permission。 |
| `BOOT-010` | `reserve-extension` | offline/cached-read/mutation policy 后续立项。 |
| `BRAND-001` | `adopt-now` | 复用 manifest `app.name/nameKey/logo`；favicon/alt/empty 增量仍 `reserve-extension`。 |
| `BRAND-002` | `adopt-now` | 复用现有 logo scheme 约束；0035/0036 对新 URL 字段补 CSP-safe 形态与失败回退。MIME/尺寸/比例仍 `reserve-extension`。 |
| `BRAND-003` | `reserve-extension` | locale/theme/timezone default 归 `app.profile` 候选。 |
| `BRAND-004` | `reserve-extension` | tenant branding 与 tenant context 一并立项。 |
| `BRAND-005` | `reserve-extension` | typed legal/support/footer links 后续 app profile。 |
| `BRAND-006` | `reserve-extension` | config-change event 与 BOOT-005 invalidation 一并立项。 |
| `BRAND-007` | `reserve-extension` | email/export/print channel profile 不进首批。 |
| `SHELL-001` | `adopt-now` | 复用 `top/sidebar/user`；footer/custom/responsive ownership 不进入核心。 |
| `SHELL-002` | `adopt-now` | 复用 `labelKey` 命中优先、字面 fallback；provider 只可生成最终 manifest。 |
| `SHELL-003` | `adopt-now` | 复用一层 group 与数组序；badge/live order 仍 `reserve-extension`。 |
| `SHELL-004` | `adopt-now` | 复用应用内 path 与既有 `https:` asset 约束；通用 external link policy 后续立项。 |
| `SHELL-005` | `adopt-now` | 复用 route/deep link/唯一匹配，0036 补 global 404；旧 URL redirect rules 仍 `reserve-extension`。 |
| `SHELL-006` | `reserve-extension` | title/breadcrumb ownership 独立立项。 |
| `SHELL-007` | `adopt-now` | 复用 `user` slot；profile/logout command 仍由 Host path/profile 负责。 |
| `SHELL-008` | `reserve-extension` | context switcher 与 tenancy 轨道一并立项。 |
| `SHELL-009` | `reserve-extension` | global search/command provider 独立立项。 |
| `SHELL-010` | `reserve-extension` | dirty signal/guard 与 action lifecycle 独立立项。 |
| `SHELL-011` | `reserve-extension` | update/safe reload 与 build identity 独立立项。 |
| `SHELL-012` | `explicitly-out` | 不建立通用 Host extension namespace；未知核心字段继续 fail-closed。 |

#### Preferences、Error 与 UX

| ID | 处置 | 裁定 |
|---|---|---|
| `PREF-001` | `reserve-extension` | locale/theme/timezone precedence 归 `app.profile`。 |
| `PREF-002` | `reserve-extension` | preference persistence/sync/conflict 后续 profile。 |
| `PREF-003` | `reserve-extension` | catalog discovery/version/fallback 后续 profile。 |
| `PREF-004` | `reserve-extension` | date/number/currency format source 后续 profile。 |
| `PREF-005` | `reserve-extension` | RTL/direction capability 后续 profile。 |
| `PREF-006` | `reserve-extension` | density/contrast/motion/font preference 后续 profile。 |
| `ERROR-001` | `adopt-now` | 0036 定义 Host failure result；不替代 backend `{code,message}`。 |
| `ERROR-002` | `adopt-now` | 0036 定义 Host-level transport/HTTP 提升矩阵；局部 409/422/其它 4xx/cancel 复用既有语义，不进入 Host result。 |
| `ERROR-003` | `adopt-now` | 0035/0036 定义 bootstrap/protocol terminal failure。 |
| `ERROR-004` | `adopt-now` | 0036 定义 auth/reauth/forbidden/return-intent，保持 401/403 既有顺序。 |
| `ERROR-005` | `adopt-now` | 0036 区分 route 404 与 resource 404。 |
| `ERROR-006` | `adopt-now` | 复用现有字段错误映射；0036 只补 Host focus/announce 义务。 |
| `ERROR-007` | `adopt-now` | 0036 定义 retry hint/Retry-After；实际 mutation retry 复用既有 policy。 |
| `ERROR-008` | `adopt-now` | 0036 定义 crash boundary 的安全 fallback/diagnostic/recovery。 |
| `ERROR-009` | `adopt-now` | 0035 用 capability 收窄表达 degraded；通用 read-only 业务模式后续立项。 |
| `UX-001` | `adopt-now` | 复用 toast outcome；duration/dedupe/actionable 生命周期仍 `reserve-extension`。 |
| `UX-002` | `adopt-now` | 复用 modal/closeModal；drawer/stack/deep-link ownership 仍 `reserve-extension`。 |
| `UX-003` | `adopt-now` | 复用 confirm；prompt/required-input 增量后续立项。 |
| `UX-004` | `reserve-extension` | notification center 独立产品/协议包。 |
| `UX-005` | `reserve-extension` | clipboard/share/print/export 分别按命令与敏感数据边界立项。 |
| `UX-006` | `reserve-extension` | background job 状态/transport 独立立项。 |
| `UX-007` | `reserve-extension` | global operation identity/cancel/blocking 独立立项。 |

#### Files、Realtime、Tenancy、Observability 与 Security

| ID | 处置 | 裁定 |
|---|---|---|
| `FILE-001` | `adopt-now` | 复用 ADR-0012 upload；scan/processing 不回写现有 upload 成功语义。 |
| `FILE-002` | `reserve-extension` | download Action、authz、filename/range 需独立 ADR。 |
| `FILE-003` | `reserve-extension` | preview/media sandbox 与 fallback download 独立 profile。 |
| `FILE-004` | `reserve-extension` | malware scan/quarantine 状态机独立 profile。 |
| `FILE-005` | `reserve-extension` | resumable session/chunks/checksum 独立 profile。 |
| `RT-001` | `reserve-extension` | SSE/WebSocket discovery/auth/resume 独立 transport profile。 |
| `RT-002` | `reserve-extension` | cache/data invalidation event 与 BOOT-005/BRAND-006 一并立项。 |
| `RT-003` | `reserve-extension` | optimistic concurrency/conflict 独立 data/action ADR。 |
| `TENANT-001` | `reserve-extension` | tenant/org discovery 与选择独立 app profile。 |
| `TENANT-002` | `reserve-extension` | context switch 原子 invalidation 独立 lifecycle。 |
| `TENANT-003` | `reserve-extension` | entitlement/license provenance 独立且不得伪装 permission。 |
| `TENANT-004` | `reserve-extension` | region/data residency context 独立隐私 profile。 |
| `OBS-001` | `adopt-now` | 0036 定义可安全展示的 correlation refs；不定义日志后端。 |
| `OBS-002` | `reserve-extension` | telemetry envelope/sampling/consent 独立 profile。 |
| `OBS-003` | `reserve-extension` | actor/resource/session audit link 独立审计 profile。 |
| `SEC-001` | `adopt-now` | 0035/0036 约束新 URL/return intent；全局既有字段 trusted URL 统一仍 `reserve-extension`。 |
| `SEC-002` | `adopt-now` | 0035/0036 定义新对象 no-secret/cache partition/redaction；全局数据分类后续 profile。 |
| `SEC-003` | `adopt-now` | 复用现有“UI visibility 不替代服务端授权”规则。 |
| `A11Y-001` | `adopt-now` | 0036 定义 Host failure landmark/focus/restore 最低义务。 |
| `A11Y-002` | `adopt-now` | 0036 定义 Host failure/retry live-region；通用 job/loading 另案。 |
| `A11Y-003` | `reserve-extension` | 完整 menu/table/drawer keyboard contract 后续评审。 |
| `A11Y-004` | `reserve-extension` | contrast/motion/direction capability 后续评审。 |

#### Governance 与实现候选

| ID | 处置 | 裁定 |
|---|---|---|
| `GOV-001` | `adopt-now` | 0037 定义 machine-readable capability registry/依赖与 claim support。 |
| `GOV-002` | `explicitly-out` | 不开放通用扩展命名空间；跨实现扩展走登记字段 + capability。 |
| `GOV-003` | `adopt-now` | 0037 registry 定义 since/deprecated/removed 与 suite mapping；迁移按版本轨道交付。 |
| `GOV-004` | `adopt-now` | 0037 将 structural/semantic/behavioral suite coverage 绑定 claim。 |
| `GOV-005` | `adopt-now` | 协议固定对象继续封闭；业务 API 是否封闭不由 Schema-UI 反向裁定。 |
| `GOV-006` | `adopt-now` | 复用 manifest `*Key` 命中优先、字面 fallback；禁止消费阶段双源覆写。 |
| `GOV-007` | `adopt-now` | 0037 定义 claim、suite/digest 与 evidence 制品。 |
| `IMP-001` | `explicitly-out` | 当前 Settings PATCH 是消费者业务 API，不是现行协议 request object。 |
| `IMP-002` | `adopt-now` | 按 manifest `*Key`/fallback 单一最终投影修复，不新增 provider 消费权威。 |
| `IMP-003` | `adopt-now` | 0035–0037 新对象的生产入口必须执行结构/语义验证并消费同一 fixtures。 |
| `IMP-004` | `reserve-extension` | row selection 到 drawer/detail 的 ownership 需要独立 overlay ADR。 |

## 后果

**正面：**

- 承认 Host 启动与全局失败确有跨实现接缝，不再全部依赖私约；
- 保持页面、manifest、navigation、i18n 与权限规则的单一权威；
- 避免把 95 个候选一次性变成一个不可评审、不可版本化的 Host 超级协议；
- 消费者实现可以明确区分“协议偏离”“协议缺口”和“产品能力”。

**负面 / 取舍：**

- 首批不会标准化完整登录、租户、通知、实时和偏好平台；
- 消费者需要继续维护部分 Host 私约，直到对应独立 ADR 被接受；
- vNext 至少需要三个能力包及配套 fixtures，不能只新增一个 JSON Schema 文件完成。

## H1 评审与 accept 记录（2026-08-13）

H1 门禁四项评审结论：

1. **结构/算法/错误码/安全/非目标评审完成**。self 评审发现并修正 4 项（F-1 P1、F-2/F-3/F-4 P2）：
   - **F-1（P1，跨 ADR 分类冲突）**：0035 D7 原将 bootstrap/manifest 获取失败一律映射
     `protocol-rejected`，与 0036 D2/D3「429/timeout/offline/5xx 只在 bootstrap/manifest/page-schema
     的 Host-level fetch 命中」冲突。已在 0035 D7 写入分类优先级：401/403 → 传输/HTTP 类别 →
     校验类失败，0035 与 0036 现无分歧；
   - **F-2（P2）**：0035 D3 阶段 2 的 diagnostics code 映射不明确（ADR-0009 无 bootstrap 版本码），
     已在 0035 明确 `UNSUPPORTED_BOOTSTRAP_VERSION` 等码并保留 ADR-0009 码的复用范围；
   - **F-3（P2）**：0037 D1 集合排序未定义对象数组的排序键，已补 D1a 规范化序列化规则；
   - **F-4（P2）**：0036 D6 `returnIntentQueryKeys` 的 manifest 落点与 capability 门控未钉死，
     已明确为 `pages[]` 注册表项字段并沿 ADR-0025 M1 门控。
2. **消费者证据**：`schema-ui-core` 的 `apps/web`（Host，React/TS）与 `apps/api`（App 侧，Go）
   两个独立程序实现作为本批消费者证据（均已在生产实现清单装载、启动顺序、全局错误页与认证恢复等
   接缝行为，gap catalog 即来自其实证）。独立性口径为「实现独立」；**维护者显式接受单组织
   residual**：跨组织第二个 Host 消费者不设为本批 accept 门禁，留给后续版本，出现前 `app.profile`
   等候选继续保留扩展位。
3. **目标协议版本与 migration 策略**：`2.8.0` / `2.8`，additive + capability 门控（见 D9）。
4. **核心规范交叉引用**：accepted 同一变更集新增 [10-host-interoperability.md](../10-host-interoperability.md)
   并在 `08` §3.4 登记三个 capability、`09` 增补 `pages[].returnIntentQueryKeys`；`protocol-manifest.json`
   的 `authority.semanticSpecs` 与版本号随 H4 发布变更集原子更新，本变更集不触碰，以保持 v2.7.0
   制品可复现。

独立审计：H1 变更集经 grok build（grok 4.5，reasoning high）独立审计复核，阻断性意见 0 条
（见 `docs/audit` 本轮审计记录）。

**H2 追加说明（2026-08-13，capability ID 机读语法增宽）：** H2 落地 `capability-registry.json` 与
B0/C0 Schema 时发现：既有 capability ID 机读语法 `^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$`
（page/manifest Schema 与 JS/Python reference）不允许段内连字符，而本 ADR D2 接受的
`host.failure-recovery` 含连字符。为使 accepted 的 capability ID 可表达，v2.8 将语法增宽为
`^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$`（段内允许连字符，段首仍须小写字母）。该增宽是 additive
的：此前合法的 ID 全部不变，此前因连字符被拒的 ID 变为合法；未知 ID 仍 fail-closed，且 claim 中的
capability 仍以 registry 登记为唯一权威。同步更新 `page.schema.json`、`app-manifest.schema.json`、
新 B0/C0 Schema 与全部 JS/Python reference。

## 已裁定的原开放问题

1. **Bootstrap 使用独立公开 document。** 不扩展现有 manifest 承载 session；404/410 才回退现有
   manifest 入口，详见 ADR-0035。
2. **Failure 使用 Host 归一化结果。** 它不替代后端 `{code,message}`、manifest 错误码或 Action outcome，
   详见 ADR-0036。
3. **Claim 是构建生成的静态 JSON 制品。** runtime 可注入或从同源 URL 读取，但 claim 必须绑定 suite
   digest 与可核对 evidence，详见 ADR-0037。
4. **`app.profile` 暂缓。** 缺少第二个独立消费者前只保留扩展位置，不进入首批。

本 umbrella ADR 无未裁定开放问题；0035–0037 已于同一 H1 评审中 accepted，各自的 H2 机器契约与
H3 evidence 门禁仍须独立满足。
