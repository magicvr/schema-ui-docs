# 已归档审计记录

> 审计文件完成所有跟踪条目的修复后，移入本目录归档。
> 最新归档靠前排列。
> 历史 0010、0013、0014 曾重复使用 V1-V4；引用冲突项时使用 `NNNN/Vn` 复合标识（如 `0013/V1`），不改写历史报告原文。

---

## 0068 — 2026-07-24 — v2.4 发布后 digest 身份与入口卫生

**主题：** 同一 `2.4.0` 多 contentDigest（Release vs main/MCP）、README 迁移入口、conformance 白名单文案、CHANGELOG Unreleased 边界（V309–V312）。  
**性质：** 1×P1 + 3×P2 全部关闭。V309 选定 **方案 A**：协议 PATCH `2.4.1` + MCP `2.4.1` 跟发；**未**改写 `v2.4.0` tag / Release。

| 文件 | 说明 |
|---|---|
| [0068-2026-07-24-review.md](./0068-2026-07-24-review.md) | 审计报告 — V309–V312（全部关闭） |
| [0068-2026-07-24-checklist.md](./0068-2026-07-24-checklist.md) | 跟踪清单 — 修复、发版与归档门禁 |

**关闭证据：** PR [#22](https://github.com/magicvr/schema-ui-docs/pull/22) → `main` `6c5998d`；tag `v2.4.1` Protocol Release [run 30084558106](https://github.com/magicvr/schema-ui-docs/actions/runs/30084558106)；tag `mcp-v2.4.1` MCP Release [run 30084621748](https://github.com/magicvr/schema-ui-docs/actions/runs/30084621748)；正式 contentDigest `sha256:d6852ee6…` / artifact `sha256:c027fa6c…`；fixtureDigest 与 2.4.0 基线一致 `474a3c09…`（机器契约未变）。

---

## 0067 — 2026-07-24 — v2.4 recordView 交付原子一致性

**主题：** ADR-0024 `recordView` / `record.view.load` 双重门控与权威链一致性（V300–V308）。  
**性质：** 2×P0 + 2×P1 + 4×P2 + 1×P3 全部关闭。权威 `01`/`page.schema` 锚点与 2.4 制品对齐；registry `required` 键冲突修复；L2 双重门控与 key⊆mapping 负例进入 CI；文档/场景/manifest 信息项补齐。

| 文件 | 说明 |
|---|---|
| [0067-2026-07-24-review.md](./0067-2026-07-24-review.md) | 审计报告 — V300–V308（全部关闭） |
| [0067-2026-07-24-checklist.md](./0067-2026-07-24-checklist.md) | 跟踪清单 — 修复与归档门禁 |

**关闭证据：** `release:check` / `verify:protocol-artifact` 通过（versionedCaseCount **214**，artifactDigest `sha256:ea1f0b6f…`）；`test:conformance:all` 29 入口全绿；MCP validate-content/components 118 passed。

---

## 0066 — 2026-07-24 — 协议演进完成度与发布闭环复审

**主题：** Admin 轨道 P0/P1（2.1–2.3）能力完成度 vs Git tag / `main` / 提交闭环（V295–V299）。
**性质：** 无 P0；2×P1 + 3×P2 全部关闭。`v2.2.0` / `v2.3.0` 已按两阶段方案合入绿色 `main` 并发布；Protocol Release 远端 tar SHA-256 已核验。

| 文件 | 说明 |
|---|---|
| [0066-2026-07-24-review.md](./0066-2026-07-24-review.md) | 审计报告 — V295–V299（全部关闭） |
| [0066-2026-07-24-checklist.md](./0066-2026-07-24-checklist.md) | 跟踪清单 — 发布闭环与归档门禁 |

**关闭证据：** PR #18 / #19 合入 `main` 为 `e234baf` / `4e51b8`；tag `v2.2.0` / `v2.3.0`；Protocol Release runs `30030740748` / `30032479183`；artifact SHA-256 `a09fd94c…` / `b536f527…`；关闭时 `release:check` / `verify:protocol-artifact` / conformance / links / scenarios 通过。

---

## 0065 — 2026-07-23 — ADR-0023 权限继承提案可接受性响应

**主题：** 容器权限结构树、表单 `edit` 目标、`permissionIntent` 挂载矩阵、fail-closed 时序与 capability 门控（V287–V294）。
**性质：** 4 项 P1 + 4 项 P2 的可接受性歧义均已写回 ADR-0023，并关闭为**提案层裁决**；方向可接受，但 ADR 仍为 `proposed`，未进入 v2.2 制品或 `protocol-manifest.json`。

| 文件 | 说明 |
|---|---|
| [0065-2026-07-23-review.md](./0065-2026-07-23-review.md) | 审计报告 — V287–V294（响应已写回 ADR，接受决议仍未作出） |
| [0065-2026-07-23-checklist.md](./0065-2026-07-23-checklist.md) | 跟踪清单 — 提案层裁决与归档门禁 |

**后续门禁：** 只有用户独立接受 ADR-0023 后，才按 M1–M6 以新的 MINOR 原子落地 Schema/DSL、L2/L3a、fixtures、Renderer 规范与发布制品；本轮不启动实现。

---

## 0064 — 2026-07-23 — 2.1/2.2 协议纪律补强

**主题：** 字段集→`protocolVersion` 下限 L2 门禁、page Trigger navigate 模板对称、文档/清单/$selection/body 文案（V282–V286）。
**性质：** 1 项 P1 + 4 项 P2 全部关闭；`ALLOW_22_FIELDS_ON_21` 在 `2.2.0` tag 时关闭。

| 文件 | 说明 |
|---|---|
| [0064-2026-07-23-review.md](./0064-2026-07-23-review.md) | 审计报告 — V282–V286（全部关闭） |
| [0064-2026-07-23-checklist.md](./0064-2026-07-23-checklist.md) | 跟踪清单 — 整改与归档门禁 |

**关闭证据：** L2 负例按期望失败；正例样例通过；`validate:scenarios` / `check:links` / `test:conformance:all` / `release:check` 以关闭时工作区为准。

---

## 0063 — 2026-07-23 — 协议 2.1/2.2 残留语义与发布就绪复审

**主题：** formRecord 可观测值、batch selection 不变量、2.2 版本/迁移叙事及文档/诊断残留（V273–V281）。
**性质：** 3 项 P1 + 6 项 P2 全部关闭；`2.2.0` 制品 tag 按 `13-v2.2-release-goals` 择机。

| 文件 | 说明 |
|---|---|
| [0063-2026-07-23-review.md](./0063-2026-07-23-review.md) | 审计报告 — V273–V281（全部关闭） |
| [0063-2026-07-23-checklist.md](./0063-2026-07-23-checklist.md) | 跟踪清单 — 整改与归档门禁 |

**关闭证据：** 12 套 versioned suite、186 个 case、27 个 JS/Python conformance 入口；fixture digest `sha256:0775cc6f3a93646f3412d8c1f1ee7ca5f76552e5dfad8f56a2eadd825a016e98`；`release:check` / `validate:scenarios` / `check:links` 通过。

---

## 0062 — 2026-07-23 — 协议 2.1/2.2 互操作性复审

**主题：** 闭合 Admin 生命周期与 ADR-0022 批量能力的 reference/L2/L3a/fixtures 互操作缺口（V267–V272）。
**性质：** 5 项 P1 + 1 项 P2 全部关闭；capability 门控下 `protocolVersion: "2.1"` 继续承载 2.2 字段为有意设计。

| 文件 | 说明 |
|---|---|
| [0062-2026-07-23-review.md](./0062-2026-07-23-review.md) | 审计报告 — V267–V272（全部关闭） |
| [0062-2026-07-23-checklist.md](./0062-2026-07-23-checklist.md) | 跟踪清单 — 修复与归档门禁 |

**关闭证据：** 12 套 versioned suite、183 个 case、27 个 JS/Python conformance 入口；fixture digest `sha256:c78c732fc941612075c2e9ebc3da35180df54e85219d441d51901e24b177cf4e`；`release:check` / `validate:scenarios` / `check:links` 通过。

---

## 0061 — 2026-07-18 — 前后端共享协议互操作性与语义闭合复审

**主题：** 闭合 Form/RowAction、request lifecycle、static/ref、reaction、interceptor、运行时默认值与组件格式等跨实现协议边界（V242–V266）。
**性质：** 25 项 P1/P2 全部关闭；完整 Admin 生命周期按 ADR-0019 明确为 v2.0 后续范围。

| 文件 | 说明 |
|---|---|
| [0061-2026-07-18-review.md](./0061-2026-07-18-review.md) | 审计报告 — V242–V266（全部关闭） |
| [0061-2026-07-18-checklist.md](./0061-2026-07-18-checklist.md) | 跟踪清单 — 修复、复核与归档门禁 |

**关闭证据：** 12 套 versioned suite、128 个 case、27 个 JS/Python conformance 入口、123 项 MCP 回归；fixture digest `sha256:5a5095799f2d4af10df1ef89c56b9aa2969af1c250efae8a6bb853c99b34cb7e`；60 文件协议制品可复现。

---

## 0056–0060 — 2026-07-13 至 2026-07-16 — v1 健康复审与 v2 边界闭环

**主题：** fixture 完整性、根 CLI/MCP 校验一致性、链接与 Node 矩阵修复，以及 DataRef、Action 重试、RowAction 标量和 URL grammar 的 v2.0 边界复审（V225–V241）。
**性质：** 五轮连续复审均已关闭；规范结论已沉淀到 v2 核心文档、ADR-0013/0014、Schema、fixtures、迁移和 CHANGELOG。

| 编号 | 文件 |
|---|---|
| 0060 | [review](./0060-2026-07-16-review.md) · [checklist](./0060-2026-07-16-checklist.md) |
| 0059 | [review](./0059-2026-07-16-review.md) · [checklist](./0059-2026-07-16-checklist.md) |
| 0058 | [review](./0058-2026-07-13-review.md) · [checklist](./0058-2026-07-13-checklist.md) |
| 0057 | [review](./0057-2026-07-13-review.md) · [checklist](./0057-2026-07-13-checklist.md) |
| 0056 | [review](./0056-2026-07-13-review.md) · [checklist](./0056-2026-07-13-checklist.md) |

---

## 0055 — 2026-07-11 — v1.0 执行一致性与可复现发布

**主题：** 关闭严格版本协商、query 线级序列化、保留参数冲突、React/Go 跨实现一致性、独立场景门禁、可复现发布与 MCP 源码树卫生（V218–V224）。
**性质：** Schema-UI `v1.0.0` 正式发布闭环。

| 文件 | 说明 |
|---|---|
| [0055-2026-07-11-review.md](./0055-2026-07-11-review.md) | 审视报告 — V218–V224（全部关闭） |
| [0055-2026-07-11-checklist.md](./0055-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0055-2026-07-11-plan.md](./0055-2026-07-11-plan.md) | 分阶段实施与发布计划 |

**关键证据：**
- `v1.0.0` → `d2f0fc0877dc6550c9fe7e3635b25c7ec72b4ddd`
- 8 类 65 fixtures，digest `sha256:fa480baf15bab7c3f05b9c505298e574754e5d86a199519c9866d2982631175c`
- React `6527bbff9aad1faf70e985988d4573afc7ae2e03` 与 Go `d31d358f1e3c3a733ab3a7ad4282078f310d8a8f` 生产消费者远端 CI 通过
- MCP CD run `29154389128` 发布 `1.0.0` / `1.0` / `latest` / Git SHA 镜像；远端 digest `sha256:190453685beded5872f24336c9b1ca1051960602f7d66d67bad6d42de40f997e`，版本与 SHA 镜像 smoke 通过

---

## 0054 — 2026-07-11 — L3a params 标签 + 三面 params 文档 + VisibleWhen dependencies + parentRow/MCP 卫生

**主题：** 修正 L3a `datasources.*.params` 违规文案误标为 `data.params`（V213🟡）、闭合三面 params 文档与 §2 交叉引用（V214🟡）、对齐 VisibleWhen.dependencies 无前缀路径描述（V215🟡）、统一 `$parentRow` 静态拒绝措辞（V216🟢）、MCP 临时目录清理失败发本地警告（V217🟢）。
**性质：** 表达式文案标签校正 + 权威文档三面 params 补齐 + Schema 入口注释同步 + 措辞卫生 + 可观测性。

| 文件 | 说明 |
|---|---|
| [0054-2026-07-11-review.md](./0054-2026-07-11-review.md) | 审视报告 — V213–V217（3🟡 + 2🟢） |
| [0054-2026-07-11-checklist.md](./0054-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V213: `scanDataParams()` 按 `paramsPath` 派生标签，`datasources.*.params` 不再误标为 `data.params`；文件头注释列出三类扫描面；MCP tests 新增 message 断言
- V214: `02` §10.7 与 `04` §1/§3.1–§3.2 纳入 `datasources.*.params`；附录 A 增补对应行
- V215: `node.schema.json` 与 `01` §3.8 写清无 `$deps.`/`$row.` 前缀完整点路径规则
- V216: `07` §3.1、L2/L3a message、「暂不支持」→「静态拒绝」
- V217: `validation-runner.ts` finally 中 `rmSync` 失败时 `console.warn`
- MCP build + **115** 项测试全部通过

---

## 0053 — 2026-07-11 — `$context` 位置 + `contains` 静态规则 + Schema 描述卫生

**主题：** 闭合 `$context.*` 可用位置、`contains` 右操作数静态规则、`dependencies` 无前缀路径描述及文档卫生问题（V207-V212：3🟡 + 3🟢）。
**性质：** 表达式权威正文、Renderer 清单、机器可读 Schema 与文档引用同步。

| 文件 | 说明 |
|---|---|
| [0053-2026-07-11-review.md](./0053-2026-07-11-review.md) | 审视报告 — V207-V212（6 项） |
| [0053-2026-07-11-checklist.md](./0053-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V207-V208: 收窄 `$context.*` 可用位置并将 `contains` 右操作数字面量约束补入表达式与 Renderer 权威规则
- V209: `reaction.schema.json` 明确 `dependencies` 使用无变量前缀的完整路径；未引用 `$deps.*` / `$row.*` 时可为空数组
- V210-V212: 修正 MCP CHANGELOG 路径、`$parentRow.*` 静态拒绝措辞与整值替换章节链接
- `git diff --check`、Schema JSON 解析、L3a 常量表达式探针、MCP build、**115** 项测试与 tools smoke 全部通过

---

## 0052 — 2026-07-11 — ADR-0003 `contains` 函数式语法残留

**主题：** 修正 Accepted ADR-0003 将中缀 `contains` 描述为方法调用并使用 `contains(...)` 形式的残留（V206🟡）。
**性质：** Accepted ADR 与当前表达式语法模型同步。

| 文件 | 说明 |
|---|---|
| [0052-2026-07-11-review.md](./0052-2026-07-11-review.md) | 审视报告 — V206（1 项） |
| [0052-2026-07-11-checklist.md](./0052-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V206: ADR-0003 D1a 仅描述属性路径的可选链式传播，删除方法调用与函数式 `contains(...)` 的合法语法暗示
- 明确 `undefined` 作为 `contains` 等比较运算符的操作数时按 D1a 转为 `false`，且 `contains` 仍使用 `a contains b` 中缀语法
- ADR 日期与 CHANGELOG 同步；MCP build + **115** 项测试 + tools smoke 全部通过

---

## 0051 — 2026-07-11 — L3a 异常分类 + `contains` 操作数约束

**主题：** 修复非数组 `table.props.columns/actions` 导致 L3a 异常并误报 `parseError`（V204🟡），执行 `contains` 右操作数必须为字面量的协议约束（V205🟡）。
**性质：** L3a 结构容错 + 表达式语法边界闭合。

| 文件 | 说明 |
|---|---|
| [0051-2026-07-11-review.md](./0051-2026-07-11-review.md) | 审视报告 — V204-V205（2 项） |
| [0051-2026-07-11-checklist.md](./0051-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V204: L3a 对非数组 table columns/actions 跳过扫描，页面内部类型错误保持为结构违规；补 object/string/null 回归
- V205: `contains` 右操作数仅允许字符串、数字、布尔或 `null` 字面量；拒绝变量与分组表达式
- MCP build + **115** 项测试 + tools smoke 全部通过

---

## 0050 — 2026-07-11 — page.schema datasources.params 残留 + Renderer 嵌套 `$deps` 示例

**主题：** 同步 `page.schema.json` DatasourceDeclaration.params 整值替换口径（V202🟡），修正 `08` §5.2 expr-eval 嵌套 `$deps` / `$context` 路径示例（V203🟡）。
**性质：** V199 Schema 漏项闭合 + Renderer 实现指引示例修复。

| 文件 | 说明 |
|---|---|
| [0050-2026-07-11-review.md](./0050-2026-07-11-review.md) | 审视报告 — V202-V203（2 项） |
| [0050-2026-07-11-checklist.md](./0050-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V202: `page.schema.json` DatasourceDeclaration.params 对齐完整单个 `$deps.*` / 禁模板拼接，并注明页面级无 form 上下文
- V203: `08` §5.2 按完整点路径读取 `$deps` / `$context`，dependencies 校验取字段首段
- CHANGELOG Unreleased 补 `page.schema.json` 与 0050 审计路径
- MCP build + **108** 项测试通过（实现未改行为）

---

## 0049 — 2026-07-11 — V197 后 params 整值替换入口残留 + CHANGELOG/元数据卫生

**主题：** 闭合 V197 后组件表与 Schema 描述残留（V199🟡），补齐 CHANGELOG 文件清单（V200🟢）与 `04` `last_updated`（V201🟢）。
**性质：** V197 入口/Schema 残留收敛 + 发布说明与元数据卫生。

| 文件 | 说明 |
|---|---|
| [0049-2026-07-11-review.md](./0049-2026-07-11-review.md) | 审视报告 — V199-V201（3 项） |
| [0049-2026-07-11-checklist.md](./0049-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V199: 同步 `03` OptionsSource.params、`04` §9、`01` data.params 注释与 `node.schema.json` / `component-registry.json` 为完整单个 `$deps.*`、禁止模板拼接
- V200: CHANGELOG Unreleased 补 `04`、`node.schema.json` 与 0048/0049 审计路径，并记录本轮修复
- V201: `04` `last_updated` → 2026-07-11
- MCP build + **108** 项测试通过（实现未改行为）

---

## 0048 — 2026-07-11 — params `$deps.*` 整值替换边界 + 跨文档 fragment 漂移

**主题：** L3a 将 `data.params` / `optionsSource.params` / `datasources.*.params` 中的 `$deps.*` 收紧为完整单个值替换（V197🟡），并修复 `04` 指向表达式 §10.1 的失效 fragment（V198🟢）。
**性质：** params 值替换互操作边界闭合 + 文档锚点卫生。

| 文件 | 说明 |
|---|---|
| [0048-2026-07-11-review.md](./0048-2026-07-11-review.md) | 审视报告 — V197-V198（2 项） |
| [0048-2026-07-11-checklist.md](./0048-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V197: `scanDataParams()` 要求含 `$` 时整段匹配单个 `$deps.*`；同步 `02`/`04`/`06`/`08`、MCP 测试与 CHANGELOG
- V198: `04` §3.2 链接更新为 `#101-非表单--表单-visiblewhen-的变量白名单`
- MCP build + **108** 项测试通过；L3a 正反例覆盖完整引用、模板拼接与非表单完整 `$deps.*`

---

## 0047 — 2026-07-11 — V176 `$self` 口径残留 + CHANGELOG/元数据卫生

**主题：** 闭合 V176 后文档残留——`02` §2 与 `00`/`01` 明确表格 `actions` 任意 scope 禁 `$self`（V192-V193🟡），对齐 L3a 头注释与 CHANGELOG/归档页脚/`07` last_updated（V194-V196🟢）。
**性质：** V176 入口文档残留收敛 + 审计元数据卫生。

| 文件 | 说明 |
|---|---|
| [0047-2026-07-11-review.md](./0047-2026-07-11-review.md) | 审视报告 — V192-V196（5 项） |
| [0047-2026-07-11-checklist.md](./0047-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V192-V193: `02` §2、`00` 术语表、`01` §3.5 与 L3a/`08` 对齐——表格 `actions` 任意 scope 禁 `$self`，columns/actions 概括拆分
- V194: L3a 文件头注释去掉「无 dependencies」与「仅 scope:row」旧表述
- V195-V196: CHANGELOG 补 0046/0047；归档页脚 → 2026-07-11；`07` last_updated 同步

---

## 0046 — 2026-07-11 — `02-reaction-expression.md` 小节编号重复

**主题：** 修复 `docs/02-reaction-expression.md` 第 10 节重复的 `10.6` 小节编号（V191🟢），消除 `ROW_SCOPE_MOUNT` 与 params 规则的章节引用歧义。
**性质：** 文档编号卫生修复。

| 文件 | 说明 |
|---|---|
| [0046-2026-07-11-review.md](./0046-2026-07-11-review.md) | 审视报告 — V191（1 项） |
| [0046-2026-07-11-checklist.md](./0046-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V191: `02` 第 10 节小节编号顺延为 `10.1`–`10.7`，消除重复的 `10.6`
- 抽查确认当前活跃协议正文未把 params 规则误指为 `§10.6`
- 文本级验证确认 `10.6` 与 `10.7` 各仅出现 1 次

---

## 0045 — 2026-07-11 — L3a `$self` 挂载漏检 + 文档/ADR 残留 + MCP 场景回归 + 元数据卫生

**主题：** 闭合表单 `visibleWhen` 与表格 `actions` 的 `$self` L3a 漏检（V175-V176🟡），清理 `scope: row` 死路径与 requestMapping/`visibleWhen` 口径漂移（V177-V179🟡），补 MCP 官方场景回归与 ADR/自检同步（V180-V183🟡），元数据与文档卫生（V184-V190🟢）。
**性质：** L3a 挂载点闭环 + 文档/ADR 与 V164/V167/V171 残留收敛 + MCP 回归覆盖。

| 文件 | 说明 |
|---|---|
| [0045-2026-07-11-review.md](./0045-2026-07-11-review.md) | 审视报告 — V175-V190（16 项） |
| [0045-2026-07-11-checklist.md](./0045-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V175-V176: L3a 拒绝表单 `visibleWhen` 与表格 `actions`（任意 scope）中的 `$self`；MCP 反例覆盖
- V177/V190: 删除表单字段 `scope: row` 死路径；`02` §10.6 收录 `ROW_SCOPE_MOUNT`
- V178-V179: 对齐 `requestMapping` 含 `$` 判定与非表单/表单 `visibleWhen` 白名单
- V180: MCP 官方场景回归覆盖 search/upload（共 6 个）
- V181-V183: ADR-0004/0006 与 `06` 自检清单同步 V164/V167/V171
- V184-V189: CHANGELOG 路径、lock `0.2.8`、场景 BOM/文案、L4 文档范围、MCP 实施计划目录树
- MCP build + **108** 项测试 + tools smoke 全部通过

---

## 0044 — 2026-07-11 — 表达式冲突语义 + 表格 scope + row dependencies + 版本/场景覆盖

**主题：** 对齐 Renderer `value` 冲突规则与 ADR-0006（V162🔴），修正表格 scope 措辞与 `$row` dependencies 权威文档（V163-V164🟡），闭合表格 form-scope `required`/`value` 并补 search/upload 场景（V167/V169🟡），版本叙事与文档卫生（V165-V166、V168、V170-V174）。
**性质：** 表达式/Renderer 语义一致性 + 表格挂载契约闭合 + 场景与元数据补齐。

| 文件 | 说明 |
|---|---|
| [0044-2026-07-11-review.md](./0044-2026-07-11-review.md) | 审视报告 — V162-V174（13 项） |
| [0044-2026-07-11-checklist.md](./0044-2026-07-11-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V162: `08` §5.3 改为同字段 `reactions` 数组顺序后写优先，禁止跨 Node 深度优先 value 合并
- V163-V164: 列/操作 scope 条件表述；`02` §8.1 明确 `$row` dependencies 无 `$row.` 前缀的完整点路径
- V167: 表格 columns/actions reactions 无论 scope 禁止 `required`/`value`，L2 执行
- V169: 新增 `search-form-table` 与 `form-with-upload` 完整场景
- V165/V168/V170-V174: 总纲版本叙事、ADR-0005 执行层、blockquote、附录 A、根 package 0.2.8、CHANGELOG 排序与 `$parentRow` superseded 注记
- MCP 104 项测试与 6 个官方场景完整 YAML L0-L4 全部通过

---

## 0043 — 2026-07-10 — Node 嵌套挂载 + 校验错误分类 + 数值/i18n 边界 + CLI/审计身份

**主题：** 执行 tabs content 完整 Node 契约并修复嵌套结构错误分类（V155-V156），拒绝非有限数、支持固定选项 i18n、传播调用错误退出码（V157-V159），修正 0042 索引范围和历史复合身份引用（V160-V161）。
**性质：** L2 Node 递归与错误分类闭环 + 组件 DSL 数值/i18n 契约同步 + CLI 退出码和归档证据链修复。

| 文件 | 说明 |
|---|---|
| [0043-2026-07-10-review.md](./0043-2026-07-10-review.md) | 审视报告 — V155-V161（7 项） |
| [0043-2026-07-10-checklist.md](./0043-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V155-V156: `tabs.items[].content` 的完整 Node `$ref` 进入 L2 普通对象检查和递归；页面内部非对象 props 保持为 L0/L1 结构违规，不再误报 `parseError`
- V157-V159: DSL number 只接受有限数；`select.options[]` 支持 `labelKey`；统一入口正确区分通过 0、内容违规 1、调用错误 2
- V160-V161: 0042 plan 索引范围修正为 V142-V154；0010/0013/0014 冲突项统一使用 `NNNN/Vn`；MCP 103 项测试、build 和 tools smoke 全部通过

---

## 0042 — 2026-07-10 — 请求与 Action 语义 + 组件校验边界 + MCP 输出容量 + 审计编号身份

**主题：** 统一 DataRef 与搜索表单请求语义（V142-V143🔴），闭合 dateRangePicker/upload/HTTP 错误/bodyMapping 行为并修复 L2/L4/DSL 边界（V144-V151🟡），修复 MCP 子进程输出容量和历史 V 编号身份（V152-V153🟡），统一 Windows glob（V154🟢）。
**性质：** 请求传输与 Action 运行时语义收敛 + 组件/校验工具链同步 + MCP 容量闭环 + 审计身份和跨平台 CLI 修复。

| 文件 | 说明 |
|---|---|
| [0042-2026-07-10-review.md](./0042-2026-07-10-review.md) | 审视报告 — V142-V154（13 项） |
| [0042-2026-07-10-checklist.md](./0042-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0042-2026-07-10-plan.md](./0042-2026-07-10-plan.md) | 修复计划与 V142-V154 决策记录 |

**关键修复：**
- V142-V147: DataRef params 对所有 method 固定为 query；搜索目标必须解析到 API；禁止 dateRangePicker value 写入；upload Action 作为 actionRef 约束唯一来源；明确 HTTP/onError 时序和 bodyMapping 白名单
- V148-V151: search 模式忽略 submitAction；L4 跳过 option value 业务载荷；L2 拒绝非法 RowAction URL 模板；upload maxSize 不得为负
- V152: MCP 子脚本使用显式 16MB stdout 上限并正确分类 ENOBUFS；真实 6000 条 L2 违规保留统计，最终响应仍不超过 20KB
- V153-V154: 历史 V1-V4 使用 `NNNN/Vn` 复合引用；AJV/L2/L3a/L4 统一 Windows 绝对反斜杠 glob；MCP 90 项测试、tools/Docker smoke 全部通过

---

## 0041 — 2026-07-10 — Action 请求语义 + 校验边界 + MCP 返回契约 + 归档证据链

**主题：** 修复普通表单 GET request 不可执行（V130🔴）、表达式/params/L4/DataRef 与组件 DSL 校验边界（V131-V137🟡）、`validate_content` 返回预算与根值错误分类（V138-V139🟡），以及归档索引和历史章节锚点（V140-V141🟢）。
**性质：** Action 可执行语义收敛 + L2/L3a/L4 与组件 DSL 同步 + MCP 工具契约闭环 + 审计证据链修复。

| 文件 | 说明 |
|---|---|
| [0041-2026-07-10-review.md](./0041-2026-07-10-review.md) | 审视报告 — V130-V141（12 项） |
| [0041-2026-07-10-checklist.md](./0041-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0041-2026-07-10-plan.md](./0041-2026-07-10-plan.md) | 修复计划与 V130/V137/V138 决策记录 |

**关键修复：**
- V130-V135: 普通表单拒绝 GET request；L3a 按上下文和完整路径校验变量并递归 params 数组；L4 区分开放业务 map；静态 datasource 拒绝响应映射
- V136-V137: table DSL 补齐 `titleKey`，datePicker/dateRangePicker 严格校验真实 `YYYY-MM-DD` 日历日期
- V138-V139: `validate_content` 最终工具文本不超过 20KB并返回结构化裁剪统计；合法根标量只进入 L0/L1，不再误报 `parseError`
- V140-V141: 补齐 0011 归档索引，修复 0002 的“错误约定”章节锚点；MCP 76 项测试、官方场景 L0-L4、tools/Docker smoke 全部通过

---

## 0040 — 2026-07-10 — 组件 DSL 嵌套封闭性 + MCP 异常边界与运行时兼容 + 归档证据链

**主题：** 修复组件 DSL 固定嵌套对象放行未知字段（V125🟡）、MCP 临时目录创建失败绕过结构化 `internalError`（V128🟡）、Node `>=18` 声明与编译产物语法不兼容（V127🟡）、早期归档清单终态未回填（V128🟢），以及归档报告中的 7 个失效相对链接（V129🟢）。
**性质：** 组件 DSL 封闭性收敛 + MCP 异常与最低运行时兼容修复 + 审计证据链修复。

| 文件 | 说明 |
|---|---|
| [0040-2026-07-10-review.md](./0040-2026-07-10-review.md) | 审视报告 — V125-V129（5 项） |
| [0040-2026-07-10-checklist.md](./0040-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V125: 为 `tabs.items[]`、`pagination`、`select.options[]` 固定对象补齐 `additionalProperties: false`，同步 DSL 文档与反例测试
- V128: 将临时目录创建纳入结构化异常边界，创建失败返回稳定错误消息且不泄露内部路径
- V127: 使用 `createRequire` 替代 JSON import attributes，保留 Node `>=18` 并通过 Node 18.19 tools smoke
- V128-V129: 回填 0001/0002 清单终态，修复 5 份归档报告中的 7 个相对链接

---

## 0039 — 2026-07-10 — 表达式校验边界 + 嵌套表格决策 + Renderer 初始化契约 + MCP 返回预算

**主题：** 修复 `dateRangePicker` `$self.start/end` 与 L3a 冲突（V117🔴）、表单内 `visibleWhen.dependencies` 条件必填缺口（V118🟡）、L4 `tagMap` 业务键误报（V119🟡）、`$parentRow` 不可构造能力（V120🔴）、链式比较放行（V121🟡）、`$context` 生命周期冲突（V122🟡）、Renderer 初始化参数遗漏（V123🟡）及 MCP 完整工具文本超 20KB（V124🟡）。
**性质：** 协议能力保守收敛 + L2/L3a/L4 行为修复 + ADR 生命周期统一 + MCP 工具边界修复。

| 文件 | 说明 |
|---|---|
| [0039-2026-07-10-review.md](./0039-2026-07-10-review.md) | 审视报告 — V117-V124（8 项） |
| [0039-2026-07-10-checklist.md](./0039-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0039-2026-07-10-plan.md](./0039-2026-07-10-plan.md) | 修复计划与 V120/V122 决策记录 |

**关键修复：**
- V117-V121: L3a 受控支持 `dateRangePicker` `$self.start/end`，L2 执行表单内 visibleWhen 条件必填，L4 区分 `tagMap` 业务键，v0.2 保守拒绝不可构造的 `$parentRow.*`，并拒绝链式比较
- V122-V123: `$context` 统一为 Renderer 实例初始化时的只读快照，更新通过重挂载生效；`RendererOptions` 组合完整 `RendererRequestConfig`
- V124: `protocol.get_doc` 在最终 JSON 工具文本边界执行 UTF-8 20KB 预算；MCP 51 项测试、tools smoke、镜像构建与 Docker smoke 全部通过

---

## 0038 — 2026-07-10 — 版本说明漂移 + schemas 入口索引误导 + MCP SDK 依赖版本策略

**主题：** 修复最新 PATCH 发布说明落后当前仓库状态（V114🟡）、入口文档将 `docs/schemas/` 笼统写为标准 JSON Schema（V115🟡）、以及 MCP 核心 SDK 依赖仍使用 `latest`（V116🟢）。
**性质：** 发布说明收敛 + 入口索引边界补齐 + MCP 依赖版本策略固化。

| 文件 | 说明 |
|---|---|
| [0038-2026-07-10-review.md](./0038-2026-07-10-review.md) | 审视报告 — V114🟡/V115🟡/V116🟢 |
| [0038-2026-07-10-checklist.md](./0038-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V114: `CHANGELOG.md` 顶部新增 `Unreleased`，并在 `README.md` / `docs/mcp/README.md` 中明确区分已发布版本 `0.2.8` 与当前工作区未发布修订
- V115: `README.md` 与 `docs/00-overview.md` 入口层统一改为“标准 JSON Schema + 组件注册 DSL”，明确 `component-registry.json` 不属于标准 Schema 集合
- V116: `mcp/package.json` / `mcp/package-lock.json` 将 `@modelcontextprotocol/sdk` 固定为 `1.29.0`，并在 MCP README 中补充不使用 `latest` 作为包清单策略的说明

---

## 0037 — 2026-07-10 — 表达式/DSL 校验边界 + 引用与映射约束 + Renderer/ADR 示例 + MCP 文档读取

**主题：** 修复表格 scope 口径与 L3a 表达式边界（V96-V98🔴）、组件 DSL/RowAction/datasource 约束缺口（V99-V103）、Renderer 与 ADR 示例矛盾（V104-V107）、MCP UTF-8 截断/导言搜索/filename 映射（V108-V110），以及锚点、命名和归档元数据（V111-V113）。
**性质：** 协议口径收敛 + L1/L2/L3a enforce + MCP 行为修复 + 文档与审计闭环。

| 文件 | 说明 |
|---|---|
| [0037-2026-07-10-review.md](./0037-2026-07-10-review.md) | 审视报告 — V96-V113（18 项） |
| [0037-2026-07-10-checklist.md](./0037-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V96-V103: 统一表格 scope 口径；L3a 拒绝非法 row scope、未声明行依赖、空/畸形表达式；L2 执行嵌套 required、RowAction parentRow/模板边界和 Node id 唯一性；Schema 禁止 datasource 引用链并约束 bodyMapping
- V104-V107: Renderer source:ref 示例改为完整单根页面并通过 L0-L4；visibleWhen 上下文按 Node 树判断；ADR-0006 改为可表达的当前字段写入；清理 ADR-0004 术语
- V108-V110: `get_doc` 按 UTF-8 字节边界截断且总返回不超 20KB；搜索纳入导言；分层违规映射调用方 filename 并隐藏临时路径
- V111-V113: 修复当前文档锚点、补齐 plan 命名类型、同步归档最后更新时间

---

## 0036 — 2026-07-10 — responseMapping 继承语义写回正文 + params 禁令校验 + Renderer source:ref 规格 + 版本/措辞残留

**主题：** 修复 `responseMapping` 生效映射未写回 04/08（V91🟡）、禁止 `params.responseMapping` 无机器校验（V92🟡）、Renderer 缺少 `source: ref` 请求协调规格（V93🟡）、`smoke-docker` 默认 tag 残留 0.2.7（V94🟢）、以及 L2 文档/注释仍写“本地映射”（V95🟢）。
**性质：** 生效映射正文闭环 + 禁令 enforce + Renderer ref 规格补齐 + 版本/措辞残留清理。

| 文件 | 说明 |
|---|---|
| [0036-2026-07-10-review.md](./0036-2026-07-10-review.md) | 审视报告 — V91🟡/V92🟡/V93🟡/V94🟢/V95🟢 |
| [0036-2026-07-10-checklist.md](./0036-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V91: `04` §4.1.1 / `08` §2.5 写明生效映射（本地优先，否则继承 `datasources`）；验证时修正“字段级继承”误述
- V92: L2 `validateParamsResponseMappingBan()` + Schema `params.not`；`06` 与 MCP 反例同步
- V93: `08` 新增 §2.1.1，默认共享同 ref 进行中请求，错误归属各消费节点
- V94: `smoke-docker.mjs` 默认 tag → `0.2.8`
- V95: `06` L2 总览表与 L2 脚本头注释改为生效映射用语

---

## 0035 — 2026-07-10 — source:ref 继承 responseMapping 校验缺口 + v0.2.8 版本漂移 + Renderer permissions 白名单描述

**主题：** 修复 `source: ref` 未解析继承的 `datasources.*.responseMapping`（V88🟡）、v0.2.8 版本声明未同步到 CHANGELOG/总纲/MCP 包（V89🟡）、以及 `08-renderer-spec.md` §5.5 permissions 白名单描述落后（V90🟢）。
**性质：** L2 生效映射语义收敛 + 协议/MCP 版本闭环 + Renderer 清单同步。

| 文件 | 说明 |
|---|---|
| [0035-2026-07-10-review.md](./0035-2026-07-10-review.md) | 审视报告 — V88🟡/V89🟡/V90🟢 |
| [0035-2026-07-10-checklist.md](./0035-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V88: L2 新增 `getEffectiveResponseMapping()`；`source: ref` 继承 `datasources.*.responseMapping` 后执行 list/total 条件必填；同步 `06-validation.md` 与 MCP 反例
- V89: 新增 CHANGELOG v0.2.8；`00-overview` 最新补丁与 MCP 包/文档示例升至 `0.2.8`
- V90: `08` §5.4/§5.5 将 permissions 白名单收紧为 `$context.user.*` / `$context.features.*`

---

## 0034 — 2026-07-10 — L2 引用完整性校验不对称 + 文档元数据漂移

**主题：** 修复 `form.props.submitAction` / `upload.props.actionRef` 缺少 L2 引用完整性校验（V85🔴）、`data.ref` / `form.props.targetTable` 缺少 L2 引用存在性校验（V86🟡）、以及 0033 触达文档 `last_updated` 未同步（V87🟢）。
**性质：** L2 页面内引用扫描收敛 + 校验文档/MCP 反例同步 + 元数据修复。

| 文件 | 说明 |
|---|---|
| [0034-2026-07-10-review.md](./0034-2026-07-10-review.md) | 审视报告 — V85🔴/V86🟡/V87🟢 |
| [0034-2026-07-10-checklist.md](./0034-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V85: L2 新增 `validatePageActionRefs()`；`submitAction` 必须存在于 `doc.actions`，`upload.actionRef` 必须存在且 `type: upload`；同步 `06-validation.md` 与 MCP 反例
- V86: L2 新增 `validateDataRefsAndTargetTable()`；`data.ref` 必须存在于 `datasources`，`targetTable` 必须对应 `type: table` 节点；同步文档与 MCP 反例
- V87: `03-component-registry.md` / `07-actions-contract.md` 的 `last_updated` 同步为 2026-07-10

---

## 0033 — 2026-07-10 — upload.actionRef 能力声明提示缺失 + permissions 文档表述残留 + MCP get_doc 示例/截断偏差 + v1-design 状态漂移

**主题：** 修复 `upload.props.actionRef` 的 `actions.upload` 能力声明提示未同步到入口文档（V79🟡）、`permissions` 仍被列为可通过 `scope` 声明作用域（V80🟡）、权限扩展键声明机制缺口（V81🟡）、`protocol.get_doc` 示例 docId 与白名单不一致（V82🟡）、`protocol.get_doc` 截断时未返回章节建议（V83🟡）、以及 v1-design.md frontmatter 仍为 draft（V84🟢）。
**性质：** 协议入口文档能力声明提示补齐 + permissions 作用域与扩展键口径统一 + MCP 文档示例与实现同步 + 审计证据链修复。

| 文件 | 说明 |
|---|---|
| [0033-2026-07-10-review.md](./0033-2026-07-10-review.md) | 审视报告 — V79🟡/V80🟡/V81🟡/V82🟡/V83🟡/V84🟢 |
| [0033-2026-07-10-checklist.md](./0033-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V79: `03-component-registry.md`/`component-registry.json`/`07-actions-contract.md` 入口文档补齐 `actions.upload` 能力声明提示
- V80: 组件文档与 ADR-0004 统一 permissions 定位为 `$context.*` 固定权限语义，不再参与 scope 作用域
- V81: 扩展权限键口径统一为"协议层不限制键名，项目侧自行约束"（选项 A）
- V82: `protocol.get_doc` 示例 docId 从 `02-reaction-expression` 修正为 `reaction-expression`
- V83: `getDoc()` 截断时新增 `availableSections` 章节标题数组，同步文档与测试
- V84: v1-design.md frontmatter 从 `draft` 改为 `stable`

---

## 0032 — 2026-07-10 — DataRef/权限静态校验缺口 + MCP 文档/错误分类漂移 + Action 示例不可执行

**主题：** 修复 `source: ref` 本地 `responseMapping` 未进入 L2 条件必填校验（V71🟡）、RowAction `permissions` 未被 L3a 扫描（V72🟡）、`permissions.*` 未完整限制为 `$context.*`（V73🟡）、`$context` 根命名空间白名单未执行（V74🟡）、MCP 子脚本异常误归类为协议违规（V75🟡）、`protocol.list_components.category` 示例漂移（V76🟡）、MCP v1 实施计划状态漂移（V77🟢）、以及 `07-actions-contract.md` 行级后端请求示例不可执行（V78🟡）。
**性质：** DataRef/表达式静态校验收敛 + MCP 错误分类与文档状态同步 + 示例可执行性修复。

| 文件 | 说明 |
|---|---|
| [0032-2026-07-10-review.md](./0032-2026-07-10-review.md) | 审视报告 — V71🟡/V72🟡/V73🟡/V74🟡/V75🟡/V76🟡/V77🟢/V78🟡 |
| [0032-2026-07-10-checklist.md](./0032-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V71: L2 对 `source: api` / `source: ref` 本地 `responseMapping` 统一执行 `list` / `total` 条件必填
- V72-V74: L3a 扫描 RowAction `permissions`，并将权限变量限制为 `$context.user.*` / `$context.features.*`，拒绝未知 `$context` 根命名空间
- V75: MCP 子脚本非 JSON/执行失败返回结构化 `internalError`，正常违规 JSON 仍进入对应 layer
- V76/V77: MCP `category` 示例同步为中文分类，v1 实施计划标记为已落地记录
- V78: `07-actions-contract.md` 行级后端请求示例补齐 table `pagination` / `columns` 并通过 `validate-all`

---

## 0031 — 2026-07-10 — 表格内嵌表达式校验缺口 + Renderer/MCP/审计状态漂移

**主题：** 修复表格 `columns[]` / `actions[]` 内嵌 `visibleWhen` / `reactions` / `permissions` 的 `$ref` 结构约束不被 L2/L3a 实际执行（V67🔴）、Renderer 规范 L3 静态校验清单落后于当前规则（V68🟡）、MCP `internalError` 返回结构与 ADR-0007 不一致（V69🟡）、以及 0030 checklist 归档状态不自洽（V70🟢）。
**性质：** 校验 $ref 解析收敛 + Renderer/MCP 契约同步 + 审计证据链修复。

| 文件 | 说明 |
|---|---|
| [0031-2026-07-10-review.md](./0031-2026-07-10-review.md) | 审视报告 — V67🔴/V68🟡/V69🟡/V70🟢 |
| [0031-2026-07-10-checklist.md](./0031-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V67: L2 受控解析 DSL $ref（VisibleWhen/Reaction/Permissions），表格列/行内表达式的缺 `when` 与 row scope 非法状态键被拒绝
- V68: `08-renderer-spec.md` §5.5 补齐当前 10 条静态校验规则并引用权威规范
- V69: `internalError` 改为结构化对象，MCP validate_content 返回与 ADR-0007 一致
- V70: 0030 checklist V65c 显式记录决策后标记完成

---

## 0030 — 2026-07-10 — modal.content 校验盲区 + datasources.params 作用域缺口 + ADR-0004 附录残留

**主题：** 修复 `actions[].type: modal` 的 `content` Node 完全不进 L2/L3a/L4 的校验盲区（V64🔴）、页面级 `datasources.*.params` 中 `$deps.*` 未被 L3a 扫描的作用域缺口（V65🟡）、以及 ADR-0004 附录矩阵未同步"仅表格位于 form.children 内"前提（V66🟢）。
**性质：** 校验遍历边界收敛 + 脚本/文档一致性补齐 + ADR 附录同步。

| 文件 | 说明 |
|---|---|
| [0030-2026-07-10-review.md](./0030-2026-07-10-review.md) | 审视报告 — V64🔴/V65🟡/V66🟢 |
| [0030-2026-07-10-checklist.md](./0030-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V64: L2/L3a/L4 遍历 `doc.actions[*].type: modal` 的 `content` Node，消除校验盲区
- V65: L3a 扫描 `doc.datasources[*].params` 中 `$deps.*`（固定非 form 上下文）；`06` 文档同步
- V66: ADR-0004 附录矩阵拆分为 form 内 ✅ / 独立表格 ❌ 两行

---

## 0029 — 2026-07-10 — 表达式交叉引用 + reactions 术语边界 + 作用域/校验缺口 + method 缺省语义

**主题：** 修复 `02` §2 禁止事项章节引用漂移（V55🔴）、`reactions`「仅表单」术语与表格行级 reactions 冲突（V56🔴）、ADR-0003 `$context.user` 最小字段集与后果段残留（V57🟡）、表格列 `scope: form` + `$deps.*` 三方不一致（V58🟡）、`optionsSource.params` 未纳入 L3a 且 form 上下文可绕过（V59🟡）、`DataRef.method` / upload `method` 缺省语义缺失（V60🟡/V61🟡）、`08` 运算符白名单章节歧义（V62🟢）以及场景 `last_updated` 漂移（V63🟢）。
**性质：** 表达式交叉引用与术语边界收敛 + L3a 作用域判定收紧 + method 缺省契约补齐 + 元数据同步。

| 文件 | 说明 |
|---|---|
| [0029-2026-07-10-review.md](./0029-2026-07-10-review.md) | 审视报告 — V55🔴/V56🔴/V57🟡/V58🟡/V59🟡/V60🟡/V61🟡/V62🟢/V63🟢 |
| [0029-2026-07-10-checklist.md](./0029-2026-07-10-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V55: `02` §2 禁止事项引用改为 §10.2 / §10.1 / §10.3
- V56: `00` 术语表与 `01` §3.5 统一 `reactions` 挂载点（表单字段 + 表格列/行内）
- V57: ADR-0003 D1 与后果段同步 `$context.user` 最小字段 `id`/`name`/`roles`
- V58: 附录 A 补 form 前提；L3a 新增 `NON_FORM_TABLE_DEPS`
- V59: L3a 扫描 `optionsSource.params`；`isFormContext` 收紧为仅 `type===form`；新增 `NON_FORM_REACTION_DEPS`
- V60/V61: `DataRef.method` 缺省 `GET`、upload `method` 缺省 `POST` 进入正文与 Schema
- V62/V63: `08` 运算符白名单引用修正；场景示例 `last_updated` 同步

---

## 0028 — 2026-07-09 — DataRef 互斥 + data.params 作用域矩阵 + ADR/DSL/Schema 漂移

**主题：** 修复 `DataRef` 三选一来源形态未被 Schema 强制的问题（V49🔴）、`data.params` 中 `$deps.*` 作用域规则未进入表达式矩阵与 L3a 的问题（V50🟡）、ADR-0004 旧 `columns[].key` 字段名残留（V51🟡）、`tagMap` DSL 约束缺口（V52🟡）、Action Schema 类型字段未隔离（V53🟡）、以及 `04-datasource-contract.md` 元数据/章节引用漂移（V54🟢）。
**性质：** 核心 Schema 互斥约束收敛 + 表达式静态校验补齐 + ADR/DSL/元数据同步。

| 文件 | 说明 |
|---|---|
| [0028-2026-07-09-review.md](./0028-2026-07-09-review.md) | 审视报告 — V49🔴/V50🟡/V51🟡/V52🟡/V53🟡/V54🟢 |
| [0028-2026-07-09-checklist.md](./0028-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V49: `DataRef` 改为 `oneOf` 来源分支并补充互斥字段约束；正文明确 `source: ref` 只允许本地覆写 API 响应映射
- V50: `02-reaction-expression.md` / `06-validation.md` 补充 `data.params` 变量规则，L3a 新增非表单 `$deps.*` 检查
- V51: ADR-0004 中列字段名统一为 `field`，`$self` 语义同步为 `$row[column.field]`
- V52: `tagMap` 映射项要求 `text` 且禁止额外字段；缺少 `text` 的样例被 L2 拒绝
- V53: `action.schema.json` 改为按 `type` 分支隔离字段，混合 Action 被 L0/L1 拒绝
- V54: `04-datasource-contract.md` 同步 `last_updated` 并修正 `select.optionsSource.params` 章节引用

---

## 0027 — 2026-07-09 — grid span 契约漂移 + Renderer 示例 + 数据响应契约分类

**主题：** 修复 `grid` 直接子节点通用 `span` 约定与组件 DSL / L2 的冲突（V45🔴）、`08-renderer-spec.md` 数据依赖示例不可执行问题（V46🟡）、`select.optionsSource` 响应体分类矛盾（V47🔴）、以及 `chart` 与 `responseMapping.list` 的适用口径不一致（V48🟡）。
**性质：** 组件 DSL 收敛 + 示例可执行性修复 + 数据响应契约分类统一。

| 文件 | 说明 |
|---|---|
| [0027-2026-07-09-review.md](./0027-2026-07-09-review.md) | 审视报告 — V45🔴/V46🟡/V47🔴/V48🟡 |
| [0027-2026-07-09-checklist.md](./0027-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V45: `component-registry.json` 与 `03-component-registry.md` 为缺失组件补齐 `span`，`grid > form/input(props.span)` 最小样例通过 L2
- V46: `08-renderer-spec.md` §2.3 示例补齐 `form.props.submitAction` 与内层 `table` 必填 props，等价最小页面通过 L2
- V47: `04-datasource-contract.md` 明确 `select.optionsSource` 默认返回裸数组，不属于 `DataRef` 列表响应，也不复用 `data.responseMapping`
- V48: `chart` 支持 `data.responseMapping.list` 的口径落入 `04` / `08` / `06` 与 L2；缺少 `list` 的 chart 映射被拒绝，提供 `list` 的样例通过

---

## 0026 — 2026-07-09 — `$parentRow` 静态校验边界 + 表达式章节引用漂移

**主题：** 修复 L3a 未按变量可见性矩阵拒绝非法 `$parentRow.*` 使用（V43🔴），以及 `01-node-protocol.md` 中表达式求值时序章节仍指向旧 §13 锚点的问题（V44🟢）。
**性质：** 表达式静态校验收敛 + 文档章节引用修复。

| 文件 | 说明 |
|---|---|
| [0026-2026-07-09-review.md](./0026-2026-07-09-review.md) | 审视报告 — V43🔴/V44🟢 |
| [0026-2026-07-09-checklist.md](./0026-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V43: `validate-l3a-expressions.js` 新增 `$parentRow.*` 作用域隔离，非行级位置会报 `SCOPE_ISOLATION` / `PARENT_ROW_SCOPE`；嵌套表格内层 `scope: row` 正例通过
- V44: `01-node-protocol.md` 将表达式求值时序引用从 `02-reaction-expression.md §13` 更新为当前 §14 锚点

---

## 0025 — 2026-07-09 — 入口索引 + 组件 DSL + 链接与元数据漂移

**主题：** 修复根 README 漏列 v0.2.7 行级后端动作示例与 ADR-0008（V39🟡）、`upload.props.placeholder` 正文允许但组件 DSL 未声明导致 L2 拒绝（V40🔴）、`06-validation.md` 脚本链接相对路径错误（V41🟢）、以及 v0.2.7 触达文档 `last_updated` 未同步（V42🟢）。
**性质：** 入口索引同步 + 正文/机器契约一致性修复 + 文档链接与元数据收敛。

| 文件 | 说明 |
|---|---|
| [0025-2026-07-09-review.md](./0025-2026-07-09-review.md) | 审视报告 — V39🟡/V40🔴/V41🟢/V42🟢 |
| [0025-2026-07-09-checklist.md](./0025-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V39: 根 README 目录树补齐 `row-backend-actions.md` 与 ADR-0008，且未展开审计文件清单
- V40: `component-registry.json` 为 `upload.props` 补充 `placeholder`，并用最小页面样例验证全链路校验通过
- V41: `06-validation.md` 中脚本链接目标统一修正为 `../scripts/...`
- V42: `06-validation.md`、`07-actions-contract.md`、`05-scenarios/data-table.md` 的 `last_updated` 同步为 2026-07-09

---

## 0024 — 2026-07-09 — MVP 协议稳定性复查：能力协商 + L3a scope + 组件语义边界

**主题：** 修复 PATCH 级执行能力缺少显式协商机制（V35🔴）、L3a 表格表达式默认 `scope: row` 导致省略显式 scope 仍可使用 `$row.*`（V36🔴），并澄清 `text` 数据兜底语义（V37🟡）与 `RowAction.key` 执行边界（V38🟡）。
**性质：** MVP 协议稳定性修复 + 校验脚本行为收敛 + 组件语义边界澄清。

| 文件 | 说明 |
|---|---|
| [0024-2026-07-09-review.md](./0024-2026-07-09-review.md) | 审视报告 — V35🔴/V36🔴/V37🟡/V38🟡 |
| [0024-2026-07-09-plan.md](./0024-2026-07-09-plan.md) | 处理计划 |
| [0024-2026-07-09-checklist.md](./0024-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V35: 新增 `meta.requiredCapabilities`、Renderer `supportedCapabilities` 与 L2 `actions.upload` 能力声明校验
- V36: L3a 表格表达式默认 scope 改回 `form`，`$row.*` 必须显式声明 `scope: row`
- V37: `text.content/contentKey` 明确为静态文本或数据加载前/无数据兜底文案
- V38: `RowAction.key` 明确仅供前端预注册处理器本地分发，不自动绑定顶层 `actions`

---

## 0023 — 2026-07-09 — 校验工具链执行缺陷——reserved 误杀 + responseMapping 误判 + 文档命令不可用

**主题：** 修复 `validate-l2-components.js` 中 `getDeclaredFields()` 的 `reserved` 集合误杀 6 个表单组件的 `required` 业务字段（V32🔴）、`validateResponseMapping()` 服务端分页检查误报"未声明 responseMapping"的合法默认用法（V33🟡）、以及 `06-validation.md §5` 本地校验指南中 ajv-cli 命令缺少 `-r` 参数和 CI 示例使用不存在的 `--strict-refs=true`（V34🟢）。
**性质：** 校验工具链代码级缺陷修复 + 文档命令同步审计。

| 文件 | 说明 |
|---|---|
| [0023-2026-07-09-review.md](./0023-2026-07-09-review.md) | 审视报告 — V32🔴/V33🟡/V34🟢 |
| [0023-2026-07-09-plan.md](./0023-2026-07-09-plan.md) | 处理计划 |
| [0023-2026-07-09-checklist.md](./0023-2026-07-09-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V32: `getDeclaredFields()` 的 `reserved` 集合移除 `required`，6 个表单组件的 `props.required`（布尔业务字段）不再被误杀
- V33: `validateResponseMapping()` 服务端分页条件从 `!rm || !rm.total` 改为 `rm !== undefined && !rm.total`，未声明 responseMapping 走默认字段名不再误报
- V34: `06-validation.md` §5.1 补充 `-r` 参数和 `--allow-union-types --strict=false` 标志；§5.4 删除无效的 `--strict-refs=true`；所有命令示例与 `scripts/validate-all.js` 保持一致

---

## 0022 — 2026-07-08 — Action 引用语义冲突 + 权限示例键名错误

**主题：** 修复 `07-actions-contract.md` 中 `table.props.actions[].key` 被误写为顶层 `actions` 引用（与 `RowAction` 定义和场景示例冲突），以及 `02-reaction-expression.md` 中权限示例误用 `permissions.visible`（应为 `permissions.view`）。
**性质：** Action 引用语义一致性修复 + 示例键名纠正审计。

| 文件 | 说明 |
|---|---|
| [0022-2026-07-08-review.md](./0022-2026-07-08-review.md) | 审视报告 — V30(🔴)/V31(🟡) |
| [0022-2026-07-08-checklist.md](./0022-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V30: 统一 `RowAction.key` 为本地操作标识，不引用顶层 `actions`；`07-actions-contract.md` §1 删除错误引用说明并补充提示；`03-component-registry.md` `RowAction.key` 补充"不引用顶层 `actions`"限定；`05-scenarios/data-table.md` 补充说明
- V31: `02-reaction-expression.md` §11.1 权限示例 `permissions.visible` → `permissions.view`

---

## 0021 — 2026-07-08 — 表格列作用域描述歧义 + CHANGELOG 格式缺口

**主题：** 修复 `03-component-registry.md` 表格列/操作"作用域说明"中 `scope: form` 缺少"仅限表单上下文"前提限定，以及 `CHANGELOG.md` v0.2.4 条目缺少"涉及的文档与 Schema"段落。
**性质：** 组件注册表文档与表达式规范交叉引用一致性修复 + CHANGELOG 格式补全审计。

| 文件 | 说明 |
|---|---|
| [0021-2026-07-08-review.md](./0021-2026-07-08-review.md) | 审视报告 — V28(🟡)/V29(🟢) |
| [0021-2026-07-08-checklist.md](./0021-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V28: `03-component-registry.md` 中"作用域说明"段落的 `scope: form` 条目补充"仅当表格位于 `form.children` 内时 `$deps.*` 才合法"的前提说明，并交叉引用 `02-reaction-expression.md §9.1`
- V29: `CHANGELOG.md` v0.2.4 条目末尾补充"涉及的文档与 Schema："段落，列出受影响的 4 份协议文档、1 份 JSON Schema 和 2 份新增决策文件

---

## 0020 — 2026-07-08 — 组件注册表文档盲区 + 表达式引用漂移

**主题：** 修复 `upload` 组件 doc 缺失 `placeholder` 字段、`datePicker`/`dateRangePicker` 的 `placeholder` 缺少 `(since 0.2)` 标注、表达式 §9.1 交叉引用漂移、`responseMapping` 章节引用精度问题。
**性质：** 组件注册表文档与 Schema 一致性修复 + 表达式规范交叉引用修复审计。

| 文件 | 说明 |
|---|---|
| [0020-2026-07-08-review.md](./0020-2026-07-08-review.md) | 审视报告 — V24(🟡)/V25(🟢)/V26(🟢)/V27(🟢) |
| [0020-2026-07-08-checklist.md](./0020-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- V24: `03-component-registry.md` 中 `upload` 组件 props 表格补充 `placeholder` 行，与 `input`/`select` 等组件保持一致
- V25: `datePicker`/`dateRangePicker` 的 `placeholder` 行补充 `（since 0.2）` 标注，与 `component-registry.json` 的 `since: "0.2"` 同步
- V26: `02-reaction-expression.md` §9.1 交叉引用从 `§10.1` 修正为 `§10 静态校验规则`
- V27: `01-node-protocol.md` §3.3 中 `responseMapping` 的章节引用从 `§4.1` 修正为 `§4.1.1`

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
| [0014-2026-07-08-review.md](./0014-2026-07-08-review.md) | 审视报告 — 0014/V4(🔴)/V5(🔴)/V6(🟡)/V7(🟡)/V8(🟢) |
| [0014-2026-07-08-checklist.md](./0014-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |
| [0014-2026-07-08-plan.md](./0014-2026-07-08-plan.md) | 处理计划 |

**关键修复：**
- 0014/V4: `archived/0013-checklist.md` 全部子项标记为 `[x]` + O1 决策记录回补 + `audit/README.md` 重复行清理与陈述修正
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
- 0013/V1: `00-overview.md` §5 版本声明 v0.2.3→v0.2.4，`last_updated` 同步
- 0013/V2: `07-actions-contract.md` 代码注释 + `action.schema.json` 描述统一为 `since 0.2.1`
- 0013/V3: `component-registry.json` 7 处 column/action `(since 0.2)`→`(since 0.2.1)`
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

## 0011 — 2026-07-08 — 校验时机与历史措辞残留复查

**主题：** 修复 L3 表达式静态校验时机表述、ADR-0004 跨作用域变通残留、`visibleField` 旧过渡措辞，以及当前规范中的过程性审计编号。
**性质：** 校验阶段边界统一 + accepted ADR 与正文同步 + 历史措辞清理。

| 文件 | 说明 |
|---|---|
| [0011-2026-07-08-review.md](./0011-2026-07-08-review.md) | 审视报告 — 4 项问题（2🟡 + 2🟢） |
| [0011-2026-07-08-checklist.md](./0011-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- W1: 将表达式校验拆分为 L3a 加载时静态校验与 L3b 运行时求值
- W2: ADR-0004 删除未标准化的跨作用域 props 变通，统一为后端预计算或另起 ADR
- W3-W4: 将 `visibleField` 明确为 row visibleWhen 语法糖，并清理当前规范中的过程性审计编号

---

## 0010 — 2026-07-08 — Renderer 示例与规范措辞边界复查

**主题：** Renderer 可复制示例结构、`$deps.*` 作用域边界、跨作用域变通措辞、`tabs` 历史方案残留。
**性质：** 文档语义一致性复查。

| 文件 | 说明 |
|---|---|
| [0010-2026-07-08-review.md](./0010-2026-07-08-review.md) | 审视报告 — 4 项问题（3🟡 + 1🟢） |
| [0010-2026-07-08-checklist.md](./0010-2026-07-08-checklist.md) | 跟踪清单（全部已完成 ✅） |

**关键修复：**
- 0010/V1: `08-renderer-spec.md` §2.1 并行加载示例 `body` 数组 → `grid` 容器包裹
- 0010/V2: `08-renderer-spec.md` §2.3 `$deps.*` 示例改为 `form` 表单上下文
- 0010/V3: `02-reaction-expression.md` §9.1 收紧未定义的跨作用域变通描述
- 0010/V4: `03-component-registry.md` / `component-registry.json` 清理"方案 A"历史措辞

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

> 最后更新：2026-07-11
