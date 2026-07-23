# Changelog

本协议遵循语义化版本（MAJOR.MINOR.PATCH）：
- MAJOR：不兼容的协议结构变更
- MINOR：新增字段/组件类型，向后兼容
- PATCH：文档修订、示例补充；在 `0.x` 阶段，也可承载不改变 `meta.protocolVersion` 的向后兼容契约补齐（如补充既有场景的错误处理、认证钩子、机器可读 Schema 同步）

## Unreleased

- 发布流程：明确 **merge `main` 只 CI、不发资产、不自动打 tag**；协议 `v*` 与 MCP `mcp-v*` **独立 tag**。见 [`RELEASE.md`](./RELEASE.md)。
- MCP CD：镜像发布目标从 Docker Hub 改为 **GitHub Container Registry**（`ghcr.io/<owner>/schema-ui-mcp`，稳定版含 `latest` / minor 别名）。更新 [`.github/workflows/mcp-cd.yml`](../.github/workflows/mcp-cd.yml) 与 [`mcp/README.md`](./mcp/README.md)。
- 协议 Release：notes 优先摘录 `CHANGELOG` 对应版本节，并附 content/fixture digests。

## v2.1.0 — 2026-07-23（Admin 生命周期 P0）

> **版本说明：** MINOR 发布。页面使用 `meta.protocolVersion: "2.1"`。未使用新字段的 `2.0` 页面可继续由同时支持 `2.0` 的 Renderer 消费。正式协议制品为 `schema-ui-protocol-2.1.0.tar.gz`。

**协议变更（capability 门控）：**
- 新增 `actions.page.trigger`：`actionButton`、`table.props.toolbar`（ADR-0020）。
- 新增 `actions.row.navigate`：行级 `navigate` + `navigateMapping`（ADR-0021）。
- 新增 `form.record.load`：`form.props.recordSource` 记录 GET 与必填 `responseMapping`（ADR-0021）。
- 新增 `$context.route` 只读路由快照（MVP 用于 recordSource 绑定）。
- 同步核心规范、Schema、L2；扩展示例 `admin-list-edit-lifecycle`；迁移 [`2.0-to-2.1.md`](./migrations/2.0-to-2.1.md)；发布目标 [`12-v2.1-release-goals.md`](./12-v2.1-release-goals.md)。

**Conformance：**
- `request-construction`：`rowNavigate` / `recordSource` / `pageTriggerRequest`。
- `response-mapping`：`formRecord`。
- `version-negotiation`：`2.1` 接受/拒绝与 Admin capability 向量。
- `scenarios`：列表导航 + 编辑加载提交步进；`CONFORMANCE_SCENARIO_PATHS` 与六场景 release 清单分离。
- 算法类 fixtures `protocolVersion` 统一为 `"2.1"`（12 套 suite，153 cases）。

**轨道文档：**
- [`11-next-admin-lifecycle-goals.md`](./11-next-admin-lifecycle-goals.md) 记录 P1+ 后续（批量等）。

## v2.0.0 — 2026-07-16（协议升级候选）

> **版本说明：** 本候选版本把 0059/V236–V240 的协议边界收紧作为 MAJOR 发布：页面使用 `meta.protocolVersion: "2.0"`，v1.0 页面不能直接进入 v2.0 标准 Renderer。正式发布前需在匹配的 `v2.0.0` tag 上完成独立协议制品发布门禁；MCP 使用独立 `mcp-v<version>` tag。

**协议变更：**
- DataRef 和页面级 API datasource 只允许 `GET`，`params` 只进入 query；写操作或 body-based command 使用 Action。
- Action/Upload 增加 `retryPolicy: never | idempotent`、稳定 `Idempotency-Key` 和 `unknown` 结果语义。
- RowAction 的 `$row.*` 只允许标量 own-property 值，并拒绝 `__proto__`、`prototype`、`constructor` 路径。
- 请求、上传、远程选项和导航 URL 统一为 baseURL 下的单斜杠相对路径。
- 新增 [`1.0-to-2.0.md`](./migrations/1.0-to-2.0.md) 迁移指南，并新增 v2.0 版本协商正反 fixtures。

**协议核心化：**
- 新增根 `PROJECT_CHARTER.md` 和 `protocol-manifest.json`，明确规范/ADR、机器结构契约、行为 fixtures、验证器/reference、MCP 的权威层级与单向依赖。
- 新增确定性 `schema-ui-protocol-2.0.0.tar.gz` 构建、内容 digest、制品 SHA-256 和双构建复现门禁；审计、MCP、验证器与 reference 不进入协议制品。
- 协议与 MCP 版本、tag 和 CI/CD 生命周期解耦；MCP 通过 `schemaUiProtocol` 显式声明捆绑协议版本。
- 根 CLI 与 MCP 共用 Ajv 装配；L4 从 `node.schema.json` 派生禁用字段；MCP 从组件 DSL 读取分类，不再从 Markdown 反向推导机器契约。

## v1.0.0 — 2026-07-11（首个稳定协议）

> **发布说明：** 页面协议、Renderer 支持版本、根协议包与 MCP 包统一切换到 `1.0` / `1.0.0`。不可变 tag `v1.0.0` 指向提交 `d2f0fc0877dc6550c9fe7e3635b25c7ec72b4ddd`；MCP CD run `29154389128` 完成远端镜像发布与 smoke，镜像 digest 为 `sha256:190453685beded5872f24336c9b1ca1051960602f7d66d67bad6d42de40f997e`。

**稳定版：**
- G1-G4 发布目标全部关闭：严格版本协商、确定性 query 序列化、保留参数优先级及跨实现执行一致性均具备机器可执行门禁。
- 8 类共 65 个 `fixtureVersion: "1.0"` fixtures 由 JavaScript 与 Python reference 直接消费并逐字段一致；React 与 Go 生产消费者直接消费固定协议提交的同一 fixtures，远端 CI 全绿。
- 六个官方场景、核心规范示例和 Renderer `supportedVersions` 统一使用 `meta.protocolVersion: "1.0"`。
- 根协议包、MCP 包、两个 lockfile、本地 Docker 构建与 smoke 默认 tag 统一为 `1.0.0`。
- 发布 `0.2` / `0.3` 到 `1.0` 的迁移说明；标准 Renderer 对旧版本 fail-closed，旧页面只能通过调用方显式启用的 legacy adapter 进入。
- CD 仅接受匹配的 `v1.0.0` tag，并发布 `1.0.0`、`1.0`、`latest` 与 Git SHA 镜像 tag；发布后从 Docker Hub 重新拉取版本及 SHA 镜像执行 smoke 并核对 digest。

## v0.3.0-rc.1 — 2026-07-11（前后端 MVP 候选契约）

> **版本说明：** 本候选版本吸收此前尚未发布的 `0.2.x` 契约收敛修订，将页面 `meta.protocolVersion` 提升为 `"0.3"`，并冻结前后端 MVP 的组件与业务能力范围。到 `v1.0.0` 前只处理互操作歧义、契约错误、机器校验和一致性测试缺口；发布门禁见 [`09-v1-release-goals.md`](./09-v1-release-goals.md)。

**候选版：**
- 根协议包与 MCP 工作区包版本统一为 `0.3.0-rc.1`；已发布稳定 MCP 镜像仍为 `0.2.8`，候选镜像需单独构建和发布。
- 核心规范、Renderer 示例与六个官方场景切换到 `meta.protocolVersion: "0.3"`。
- 新增 `09-v1-release-goals.md`，跟踪严格版本协商、query 线级序列化、保留参数冲突、跨实现一致性套件及发布工程门禁。
- CI 校验根包、MCP 包与两个 lockfile 的版本一致性；CD 仅从匹配包版本的 `v<version>` Git tag 发布，预发布版本不更新 minor 或 `latest` 镜像别名。

**修复：**
- 审计 `0055 / V223`：新增统一 `release:check`，校验协议版本、根/MCP package 与 lockfile、65 个版本化 fixtures、迁移指南及 CHANGELOG，并输出 fixture digest；CI/CD 复用同一门禁，tag 发布后重新拉取固定版本与 Git SHA 镜像分别 smoke，核对并记录 commit、fixture、构建与远端镜像 digest；新增 `0.2` / `0.3` 到 `1.0` 迁移指南。真实远端制品证据待下一次 tag 发布产生，尚未切换 `1.0.0`。
- 审计 `0055 / V221` 批次 1-6：建立 `fixtureVersion: "1.0"` 的统一 suite Schema 与自动校验 runner；完成版本协商 14 个、请求构造 7 个、responseMapping 8 个、搜索状态 5 个、reaction 调度 5 个、Action/错误时序 11 个、上传执行 9 个、六场景执行 6 个版本化 fixtures。JavaScript 与 Python reference 直接消费相同输入并逐字段通过，CI/CD 运行全部双端 runner。仓库内 G4 fixture 类别已覆盖；生产 Renderer/后端消费者接入仍待负责人确认，V221 未关闭。
- 审计 `0055 / V220`：新增 ADR-0011，将 `page` / `pageSize` / `sort` 定为 Renderer 保留参数；L2 拒绝静态 params 与搜索字段冲突；固定已有 query、静态 params、搜索字段、Renderer 状态的覆盖顺序，以及提交、清空、翻页、排序的页码转换；新增 5 个可执行状态 fixtures 并接入 CI/CD。
- 审计 `0055 / V219`：新增 ADR-0010，四类 query 来源收紧为非空 key 的标量-only；统一已有 query、重复 key、空值 tombstone、Unicode key 排序、UTF-8/RFC 3986 编码与 fragment 规则；JavaScript 和 Python reference 直接消费同一 16 个字节级 fixtures，并接入 CI/CD。
- 审计 `0055 / V224`：移除 `mcp/src` / `mcp/tests` 中会遮蔽 TypeScript 源码并导致 Vitest 加载 CommonJS 的旧同目录 `.js` 编译产物，`.gitignore` 阻止其再次生成到源码树；标准构建产物仍只写入 `mcp/dist/`。
- 审计 `0055 / V218`：新增 ADR-0009，Renderer 版本协商改为精确 MAJOR.MINOR fail-closed，删除 `minCompatibleVersion` 与最近版本 fallback；缺失版本仅允许显式 legacy adapter；新增 14 个框架无关版本/capability fixtures、JavaScript reference 和 CI/CD runner。
- 审计 `0055 / V222`：新增六个官方场景公共 YAML fence 提取器与 `npm run validate:scenarios`，使根 L0-L4 可独立校验 Markdown 场景；MCP tests 复用同一提取入口；CI 使用独立协议 job，CD 在镜像发布前执行同一门禁。
- 审计 `0054 / V213`：修正 L3a `scanDataParams()` 由三类扫描入口传入固定 `paramsLabel` 并在递归中保持，`datasources.*.params` 违规不再误标为 `data.params`，业务键名也不会反向污染挂载面标签；文件头注释列出三类扫描面；MCP tests 锁定 datasources 与嵌套 `data.params` 标签。
- 审计 `0054 / V214`：`02` §10.7 标题/正文与 `04` §1/§3.1–§3.2 纳入页面级 `datasources.*.params` 三面 params；附录 A 增补 `datasources.*.params` 行；§2 交叉引用达闭合。
- 审计 `0054 / V215`：同步 `node.schema.json` `VisibleWhen.dependencies.description` 与 `01` §3.8 YAML 注释——无 `$deps.`/`$row.` 前缀完整点路径规则（V209 VisibleWhen 侧残留）。
- 审计 `0054 / V216`：`07` §3.1、L2 requestMapping message、L3a 文件头与 `PARENT_ROW_UNSUPPORTED` message 统一「暂不支持」→「静态拒绝」（V211 残留）。
- 审计 `0054 / V217`：MCP `validation-runner.ts` finally 中临时目录清理失败时发 `console.warn` 本地警告，与 ADR-0007 一致；补自动化测试确认告警不改变校验结果结构。
- 审计 `0053 / V207`：修正 `02` §2 将 `$context.*` 标为「所有位置」的入口误导，改为条件表达式挂载点并明确不含 params 值替换。
- 审计 `0053 / V208`：将 `contains` 右操作数字面量约束写入 `02` §3 / 新增 §10.8 与 `08` §5.5，与 `06` / L3a（V205）对齐。
- 审计 `0053 / V209`：同步 `reaction.schema.json` `dependencies.description` 为无 `$deps.` / `$row.` 前缀的完整点路径声明规则，并明确未引用二者时可使用空数组（V164 残留）。
- 审计 `0053 / V210`：修正 `docs/mcp/README.md` 将 CHANGELOG 误指为仓库根路径，改为 `docs/CHANGELOG.md`。
- 审计 `0053 / V211`：`03` / `component-registry.json` 将 `$parentRow.*`「暂不支持」统一为 v0.2 静态拒绝。
- 审计 `0053 / V212`：`02` §1 数据请求参数主链改为 `04` §3.1（整值替换），并保留 §3.2 作用域链接。
- 审计 `0052 / V206`：修正 Accepted ADR-0003 的属性链容错表述，删除将中缀 `contains` 描述为方法调用及使用 `contains(...)` 形式的残留，明确 `undefined` 参与比较时按 D1a 转为 `false`。
- 审计 `0051 / V204`：L3a 对非数组 `table.props.columns/actions` 跳过表达式扫描，保持页面内部类型错误为结构违规，不再误报 `parseError`；补 object/string/null MCP 回归。
- 审计 `0051 / V205`：L3a 执行 `contains` 右操作数字面量约束，拒绝变量与分组表达式，保留字符串、数字、布尔和 `null` 正例。
- 审计 `0050 / V202`：同步 `page.schema.json` DatasourceDeclaration.params 描述为完整单个 `$deps.*` 整值替换、禁止模板拼接，并注明页面级无 form 上下文。
- 审计 `0050 / V203`：修正 `08` §5.2 expr-eval 示例，按完整点路径读取 `$deps` / `$context`，dependencies 校验取字段首段。
- 审计 `0049 / V199`：同步 `03` OptionsSource.params、`04` §9、`01` data.params 注释与 `node.schema.json` / `component-registry.json` 描述，与 V197「完整单个 `$deps.*` 整值替换、禁止模板拼接」口径一致。
- 审计 `0049 / V200`：CHANGELOG Unreleased 文件清单补 `04` 与 0048/0049 审计路径。
- 审计 `0049 / V201`：`04-datasource-contract.md` `last_updated` 同步为 2026-07-11。
- 审计 `0048 / V197`：L3a 将 `data.params` / `optionsSource.params` / `datasources.*.params` 中的 `$deps.*` 收紧为完整单个值替换，拒绝模板拼接；同步 `02`/`04`/`06`/`08` 说明。
- 审计 `0048 / V198`：修复 `04-datasource-contract.md` 指向表达式 §10.1 的失效 Markdown fragment。
- 审计 `0038 / V114`：澄清最新已发布版本与当前工作区未发布修订的关系，避免继续让最新 PATCH 说明落后于仓库状态。
- 审计 `0038 / V115`：修正 `README.md` 与 `00-overview.md` 对 `docs/schemas/` 的入口层描述，明确其中同时包含标准 JSON Schema 与组件注册 DSL。
- 审计 `0038 / V116`：固定 `mcp/package.json` 中 `@modelcontextprotocol/sdk` 的依赖版本策略，避免继续使用 `latest`。
- 审计 `0039 / V117-V121`：收敛 `$self.start/end`、表单内 `visibleWhen.dependencies`、`tagMap` L4 扫描、`$parentRow` 暂缓策略与非链式比较校验。
- 审计 `0039 / V122-V124`：统一 `$context` 为实例初始化快照，补齐 Renderer 请求初始化接口，并将 MCP `get_doc` 20KB 预算施加到完整工具文本。
- 审计 `0040 / V125-V127`：封闭组件 DSL 的固定嵌套对象，补齐 MCP 临时目录创建异常边界，并恢复编译产物对所声明 Node 18 下限的兼容性。
- 审计 `0040 / V128-V129`：回填早期归档清单终态并修复归档报告的失效相对链接。
- 审计 `0041 / V130-V137`：闭合普通表单 GET 请求语义，修复表达式/params/L4/responseMapping 校验边界，并补齐 table `titleKey` 与日期边界机器校验。
- 审计 `0041 / V138-V141`：为 `validate_content` 增加完整 20KB 响应预算和根标量错误分类，补齐 0011 归档索引并修复 0002 章节锚点。
- 审计 `0042 / V142`：统一 DataRef `params` 的传输语义，对所有 HTTP method 均编码为 URL query，不隐式生成请求体。
- 审计 `0042 / V143-V151`：要求搜索目标表格具有有效 API 数据源，闭合 dateRangePicker/upload/bodyMapping/HTTP 错误处理语义，并修复 search submitAction、option value、RowAction URL 模板和 upload maxSize 校验边界。
- 审计 `0042 / V152`：L2/L3a/L4 输出结构化 JSON 后改用 `process.exitCode` 自然冲刷 stdout，修复 Linux 管道中 `process.exit(1)` 截断大 JSON；MCP 父进程改用 `spawnSync`、设置显式 16MB 上限并区分 `ENOBUFS`，最终 20KB 裁剪保持不变。
- 审计 `0042 / V153-V154`：为历史 V1-V4 冲突建立 `NNNN/Vn` 复合引用规则，并统一 Windows 绝对反斜杠 glob 在 AJV/L2/L3a/L4 的匹配行为。
- 审计 `0043 / V155-V156`：执行 `tabs.items[].content` 的完整 Node L2 契约，并保持页面内部合法 JSON 结构错误为 L0/L1 违规，不再误报 `parseError`。
- 审计 `0043 / V157-V159`：拒绝 YAML 非有限数值，支持固定 select 选项使用 `labelKey`，并让统一校验入口保留调用错误退出码 `2`。
- 审计 `0043 / V160-V161`：修正 0042 plan 的归档索引范围，并将历史冲突 V1-V4 在归档入口统一改用 `NNNN/Vn` 复合引用。
- 审计 `0044 / V162`：对齐 `08-renderer-spec` 的 `value` 冲突规则与 `02` §14.1 / ADR-0006（同字段数组顺序后写优先，禁止跨 Node 深度优先合并）。
- 审计 `0044 / V163-V164`：修正表格列/操作 scope 强制措辞，并将 `$row` dependencies（无 `$row.` 前缀的完整点路径）写入 `01`/`02`/`06` 权威说明。
- 审计 `0044 / V165-V166`：总纲区分已发布与 Unreleased；补齐 `input` 能力页脚。
- 审计 `0044 / V167`：表格 `columns[]`/`actions[]` 上 reactions 无论 scope 均禁止 `required`/`value`，L2 执行。
- 审计 `0044 / V168-V171`：更新 ADR-0005 执行层标注；新增 search/upload 场景；修复 `06` blockquote；附录 A 补 actions form-scope。
- 审计 `0044 / V172-V174`：根 `package.json` 版本对齐 0.2.8；调整 CHANGELOG 历史排序；注明 v0.2.7 `$parentRow` 表述已由 0039/V120 取代。
- 审计 `0045 / V175-V176`：L3a 拒绝表单 `visibleWhen` 与表格 `actions`（任意 scope）中的 `$self`。
- 审计 `0045 / V177-V179` / `V190`：删除表单字段 `scope: row` 死路径表述；对齐 `requestMapping` 的 `$` 判定与非表单 `visibleWhen` 白名单；§10 收录 `ROW_SCOPE_MOUNT`。
- 审计 `0045 / V180`：MCP 官方场景回归覆盖 search/upload 场景。
- 审计 `0045 / V181-V183`：ADR-0004/0006 与 `06` 自检清单同步 V164/V167/V171。
- 审计 `0045 / V184-V189`：CHANGELOG 审计路径、lock 版本、场景 BOM/文案、L4 文档范围、MCP 实施计划目录树。
- 审计 `0046 / V191`：修复 `02-reaction-expression.md` 第 10 节重复的 `10.6` 小节编号（顺延为 `10.1`–`10.7`）。
- 审计 `0047 / V192-V193`：闭合 V176 后 `$self` 口径残留——`02` §2 与 `00`/`01` 明确表格 `actions` **任意 scope** 禁止 `$self`，并拆分 columns/actions 概括。
- 审计 `0047 / V194-V196`：对齐 L3a 文件头注释、补齐 CHANGELOG/归档索引卫生项，同步 `07` `last_updated`。

**说明（`$parentRow`）：** v0.2.7 F2 等历史条目中的 `$parentRow` 描述记录当时设计；当前协议以 0039/V120 为准，v0.2 **全面拒绝** `$parentRow.*`。

**涉及的文档、包与配置：**
- 入口文档：`README.md`、`docs/00-overview.md`、根 `package.json`、根 `package-lock.json`
- 版本记录：`docs/CHANGELOG.md`
- MCP 包：`mcp/package.json`、`mcp/package-lock.json`
- MCP 说明：`docs/mcp/README.md`、`docs/mcp/v1-implementation-plan.md`
- 协议与 ADR：`docs/01-node-protocol.md`、`docs/02-reaction-expression.md`、`docs/03-component-registry.md`、`docs/04-datasource-contract.md`、`docs/06-validation.md`、`docs/07-actions-contract.md`、`docs/08-renderer-spec.md`、`docs/decisions/0003-0008`
- 场景示例：`docs/05-scenarios/*`
- 校验与 MCP 实现：`scripts/*.js`、`mcp/src/tools/docs.ts`、`mcp/src/tools/validate-content.ts`、`mcp/src/core/validation-runner.ts`、`mcp/tests/*.test.ts`
- 机器可读契约：`docs/schemas/page.schema.json`、`docs/schemas/node.schema.json`、`docs/schemas/reaction.schema.json`、`docs/schemas/component-registry.json`
- 审计：`docs/audit/archived/0044-2026-07-11-*`、`docs/audit/archived/0045-2026-07-11-*`、`docs/audit/archived/0046-2026-07-11-*`、`docs/audit/archived/0047-2026-07-11-*`、`docs/audit/archived/0048-2026-07-11-*`、`docs/audit/archived/0049-2026-07-11-*`、`docs/audit/archived/0050-2026-07-11-*`、`docs/audit/archived/0051-2026-07-11-*`
- 审计：`docs/audit/archived/0052-2026-07-11-review.md`、`docs/audit/archived/0052-2026-07-11-checklist.md`
- 审计：`docs/audit/archived/0053-2026-07-11-review.md`、`docs/audit/archived/0053-2026-07-11-checklist.md`
- 审计：`docs/audit/archived/0054-2026-07-11-review.md`、`docs/audit/archived/0054-2026-07-11-checklist.md`

## v0.2.8 — 2026-07-10（引用完整性 & 继承 responseMapping 补丁）

> **版本说明：** v0.2.8 基于审计 0034–0035 发现的引用完整性校验缺口与继承 `responseMapping` 语义校验缺口的修补。不改变 `meta.protocolVersion`。

**修复（基于审计 0034 / 0035）：**
- **V85：** L2 校验器新增 `form.props.submitAction` / `upload.props.actionRef` 引用存在性与 action 类型校验。
- **V86：** L2 校验器新增 `data.ref` 引用存在性及 `form.mode: search` 的 `targetTable` 引用存在性与类型校验。
- **V88：** `source: ref` 节点解析继承的 `datasources.*.responseMapping`，并对生效映射执行列表/分页条件必填；本地声明优先覆盖。

**涉及的文档、Schema 与脚本：**
- 协议文档：`docs/06-validation.md`
- 校验脚本：`scripts/validate-l2-components.js`
- MCP 测试：`mcp/tests/validate-content.test.ts`、`mcp/tests/test-utils.ts`

## v0.2.0 — 2026-07-07

**破坏性变更：**
- **A3：** `valueField` 从 `data.valueField` 迁移至 `props.valueField`（`statCard` / `text`）。
- **B2（方案A）：** `tabs` 内容改为 `items[].content` 内嵌，`tabs` 自身不再支持 `children`。

**新增：**
- **B1：** Node 新增可选 `id` 字段（页面内唯一标识）。
- **B3：** 新增 `actions` 完整契约（`request` / `navigate` / `modal` / `custom`），含 `onSuccess`/`onError` 语义级行为。新增 `docs/07-actions-contract.md` + `schemas/action.schema.json`。
- **B4：** `span` 提升为通用 props，任何 `grid` 直接子节点均可声明。
- **B5：** 表单字段新增 `placeholder` / `description` / `tooltip` 可选字段。
- **B6：** i18n `xxxKey` 约定：`label`/`title`/`content` 等文案字段均可用 `xxxKey` 替代。
- **B7：** `select` 支持远程动态选项 `optionsSource`，含 `$deps.*` 参数引用及空值省略规则。
- **B8：** 组件级 `states`（空态/加载态/错误态文案定制），仅对 `supportsStates: true` 的组件生效。
- **B9：** `component-registry.json` 增加 `deprecated` / `deprecatedMessage` / `since` 元信息标注能力。
- **B10：** 表格行级操作显隐 `visibleField`，数据驱动不引入表达式。
- **A4：** 补充 `datasources` + `data.source: ref` 完整示例。
- **A5：** `meta` 新增必填字段 `protocolVersion`（如 `"0.2"`）。

**修复：**
- **A1：** 修复 JSON Schema CSS 禁用词校验为 `not.anyOf` 逐一拦截（双轨策略：L1 Schema + L4 lint）。
- **A2：** 修复 `text` 组件 `data` 支持说明矛盾，明确支持 `data.source: static/ref/api`。

**涉及的文档与 Schema：**
- 协议文档：`00` / `01` / `03` / `04` / `06` / 新增 `07`
- JSON Schema：`node.schema.json` / `component-registry.json` / 新增 `action.schema.json`
- 场景示例：全部三个场景已更新至 v0.2 结构

## v0.2.1 — 2026-07-07（与 v0.2.0 同一天）

> **版本说明：** v0.2.1 是基于历史 0003 审计发现的 MVP 阻断项紧急补发的就绪度补丁，与 v0.2.0 在同一天完成。内容为 Renderer 实现规范、缺失组件、校验工具链等操作性约定，不改变 v0.2.0 已定义的 Node 结构和表达式语法。

**MVP 就绪度补丁（基于 0003 审计）。**

**新增：**
- **R1：** 前端 Renderer 组件注册机制规范（运行时注册，全局单例）。
- **R2：** 数据加载协调策略规范（默认并行、失败隔离、`$deps.*` 数据依赖、加载状态管理）。
- **R3：** 节点级错误边界策略（单个 Node 失败不阻断兄弟节点/整页）。
- **R4：** 表达式引擎沙箱实现指引（推荐 `expr-eval`，禁止 `eval`/`new Function`，含最小集成示例）。
- **G2：** 版本协商规范（Renderer `supportedVersions` 宣告、版本匹配规则、不匹配时错误信息格式）。
- **G3：** 环境变量 / baseURL 管理（相对路径由 Renderer 自动拼接 baseURL，环境切换通过不同 baseURL）。
- **datePicker / dateRangePicker：** 新增两个日期选择组件到组件注册表。
- **inputNumber：** 新增 `min`/`max`/`step`/`precision` 可选字段（数值范围、步长、精度控制）。
- **弹窗内容 Node 化：** `actions[].type: modal` 新增可选 `content: Node` 字段，与 `modalId` 可共存。
- **searchForm：** `form` 新增 `mode: search` + `targetTable`，搜索模式下提交行为变为刷新目标表格，字段值自动合并为表格 API 参数。
- **upload：** 新增文件上传组件（`field`/`label`/`accept`/`maxSize`/`multiple`/`action`），支持 reactions，上传完成后字段值设为后端返回的文件 URL/ID。
- **G1：** 后端开发者本地校验指南（`ajv-cli`、VS Code YAML Schema 关联、CI 集成示例）。

**已合并的 ADR：**
- `decisions/0003-context-namespace-and-visible-when.md`（`$context` 命名空间、`visibleWhen`、`permissions`、`contains` 运算符）。
- `decisions/0004-row-level-scope.md`（`$row` 作用域、`scope: row`/`scope: form`、`visibleField` 语法糖、嵌套表格 `$parentRow`）。

**涉及的文档与 Schema：**
- 协议文档：`01`（§3.8 visibleWhen、§3.9 permissions、§3.10 可见性公式） / `02`（`$context` 命名空间、`contains` 运算符、变量可见性矩阵、静态校验规则） / `03`（datePicker、dateRangePicker、searchForm mode、upload） / `06`（§5 本地校验指南） / `07`（§5 modal.content） / 新增 `08-renderer-spec.md`
- JSON Schema：`node.schema.json`（新增 VisibleWhen + Permissions 定义） / `action.schema.json`（modal 新增 content）
- `schemas/component-registry.json`（新增 datePicker、dateRangePicker、upload；form 新增 mode/targetTable）

## v0.2.2 — 2026-07-07（文档一致性补丁）

> **版本说明：** v0.2.2 是基于第五轮审计（0005）发现的文档/Schema 一致性问题进行的修补，不改变 v0.2.1 已定义的 Node 结构和表达式语法。

**修复（基于第五轮审计）：**
- **F1：** `component-registry.json` 中 `form.props` 补充 `additionalProperties: false`（与其他组件约束力度统一）。
- **F2：** `component-registry.json` 中 `tabs.props.items` 的 `required` 数组补充 `content`（与文档必填声明一致）。
- **F3：** `01-node-protocol.md §2` 顶层结构 YAML 中 `DataSourceDef` 统一为 `DataRef`（与 `node.schema.json` 定义名一致）。
- **F4：** `06-validation.md` L4 校验行补充说明：本仓库仅提供规范，不包含可执行 lint 脚本。
- **F5：** `01-node-protocol.md §3.10` 求值时序警告完善：增加具体规避建议和跟踪状态说明。
- **F6：** `00-overview.md` 版本声明增加 `v0.2.1` 补丁版本说明，消除读者困惑。
- **F7：** `03-component-registry.md` 中 `dateRangePicker` 增加搜索模式下参数传递行为的交叉引用。
- **F8：** `04-datasource-contract.md §4.1` `responseMapping` 跟踪条目增加临时变通方案说明。

## v0.2.3 — 2026-07-08（组件契约补丁）

> **版本说明：** v0.2.3 是基于第七轮审计（0007）发现的组件契约完备性与文档内部一致性问题的修补，不改变 v0.2.2 已定义的 Node 结构和表达式语法。

**修复（基于第七轮审计）：**
- **S1：** `03-component-registry.md` 及 `component-registry.json` 中 `select` 组件补充 `required` 和 `defaultVisible` 字段（与其他表单字段组件保持一致）。
- **S2：** `03-component-registry.md` 中 `dateRangePicker` 章节补充 `reactions` 注意事项表格，明确定义 `$deps` 引用规则和 `$self` 语义。
- **S3：** `02-reaction-expression.md` §10.4 措辞修正：`"reactions/otherwise"` → `"fulfill/otherwise"`。
- **S4：** `04-datasource-contract.md` 新增 §3.2 `data.params` 中 `$deps.*` 的作用域边界章节，明确非表单上下文中静态校验拒绝。
- **S5：** `03-component-registry.md` 搜索模式示例结构修正：`form` 与 `table` 包裹在 `section` 容器内作为 `body` 的 `children`。
- **S6：** `CHANGELOG.md` v0.2.1 措辞清理：移除"（方案 A）"后缀避免歧义。
- **S7：** `component-registry.json` 中 `datePicker`/`dateRangePicker`/`upload` 的 `placeholder` 字段补充 `since` 标注。
- **S8：** 新增 `05-scenarios/README.md` 目录索引文件，包含文件列表表格与阅读顺序建议。

## v0.2.4 — 2026-07-08（ADR 决策补丁）

> **版本说明：** v0.2.4 基于审计 0012 的 ADR 决策缺口补齐两个已成熟的协议决策：响应字段名映射与表达式读写求值时序。A3-A6 保持未来触发型议题，未提前扩展核心协议能力。

**新增 / 决策：**
- **D1：** 新增 `decisions/0005-response-mapping.md`，正式标准化 `data.responseMapping`。映射声明与 `params` 同级，仅用于响应解析，不作为请求参数发送。
- **D2：** `schemas/node.schema.json` 的 `DataRef` 增加 `responseMapping`，支持 `list` / `total` 点路径映射。
- **D3：** 新增 `decisions/0006-expression-evaluation-order.md`，表达式引擎采用稳定快照模型：本轮读旧快照，本轮末尾批量提交写入，下一轮读取新值。
- **D4：** `08-renderer-spec.md` 增加 `responseMapping` 应用阶段、表达式批量提交与循环保护要求。

**修订：**
- `04-datasource-contract.md` 将 `responseMapping` 从 planned 状态改为正式契约。
- `01-node-protocol.md` 删除“求值时序未定义”限制，改为引用 ADR-0006 的确定性模型。
- `02-reaction-expression.md` 新增表达式求值时序章节。

**涉及的文档与 Schema：**
- 协议文档：`01-node-protocol.md`（删除"求值时序未定义"限制，改为引用 ADR-0006）/`02-reaction-expression.md`（新增 §13 求值时序模型）/`04-datasource-contract.md`（`responseMapping` 升为正式契约）/`08-renderer-spec.md`（增加 `responseMapping` 处理与批量提交/循环保护要求）
- JSON Schema：`schemas/node.schema.json`（`DataRef` 增加 `responseMapping` 字段）
- 新增决策：`decisions/0005-response-mapping.md`、`decisions/0006-expression-evaluation-order.md`

## v0.2.5 — 2026-07-08（前后端契约完备性补丁）

> **版本说明：** v0.2.5 基于前后端契约完备性评估，补充了此前协议空白的四个方向：认证约定、完整错误响应体结构、`$context` 最小字段集、`upload` action 类型。不改变 v0.2.4 已定义的 Node 结构和表达式语法。使用 `actions[].type: upload` 或 `upload.props.actionRef` 的页面需要 Renderer 实现 v0.2.5 的 action 枚举与上传执行能力；旧 v0.2 Renderer 应在静态校验阶段拒绝未知 action 类型。

**新增：**
- **C1：** `04-datasource-contract.md` 新增 §5 认证约定——Renderer 通过宿主应用注入的 `requestInterceptor` 钩子携带认证信息，协议层不感知具体认证方案；明确 `401`/`403` 的处理规则与 `onAuthFailure` 钩子语义。
- **C2：** `04-datasource-contract.md` 原 §5 错误约定重构为 §6，拆分为 §6.1 HTTP 状态码矩阵（补充 `400`/`401`/`403`/`404` 独立语义）、§6.2 通用错误响应体（原有约定正式化）、§6.3 字段级验证错误（`400` + `errors` 数组契约，含字段路径与多条错误约定）、§6.4 网络超时与中断处理规则。
- **C3：** `02-reaction-expression.md` 新增 §11 `$context` 最小字段集——`$context.user` 明确协议级必须字段（`id`/`name`/`roles`）及项目扩展约定；`$context.features` 明确仅含项目注入字段、值类型约束（`boolean` 或简单枚举）及缺失时降级为 `false` 的规则。
- **C4：** `07-actions-contract.md` 新增 §7 `upload` action 类型——`multipart/form-data` 上传协议，含请求格式约定、响应体契约（`url`/`id`/`name`/`size`）、客户端与服务端双重校验要求、常见错误 `code` 建议值；`type` 枚举表同步增加 `upload` 条目；`upload` 组件新增 `props.actionRef` 用于引用顶层 upload action，既有 `props.action` 继续表示上传 URL。

**涉及的文档：**
- `04-datasource-contract.md`（§5 认证约定新增；§5-§8 重编号为 §6-§9；§6 错误约定重构）
- `02-reaction-expression.md`（新增 §11 `$context` 最小字段集；§11-§12 白名单扩展/缺失容错重编号为 §12-§13；§13 求值时序重编号为 §14）
- `07-actions-contract.md`（§2 枚举表增加 `upload`；新增 §7 upload 类型；§7-§8 原有章节重编号为 §8-§9）
- `03-component-registry.md` / `schemas/component-registry.json`（`upload.props.actionRef` 新增；`action` 与 `actionRef` 二选一）

## v0.2.6 — 2026-07-09（能力协商与校验收敛补丁）

> **版本说明：** v0.2.6 基于审计 0024 的 MVP 协议稳定性复查，补齐 PATCH 级执行能力协商，并修复 L3a 表格行级表达式 scope 校验缺口。不改变既有 v0.2 Node 主结构；未使用 PATCH 级执行能力的旧页面无需新增字段。

**新增 / 修订：**
- **E1：** `meta` 新增可选 `requiredCapabilities` 数组，用于声明页面依赖的 Renderer 执行能力。当前预定义能力键：`actions.upload`。
- **E2：** Renderer 规范新增 `supportedCapabilities` 与能力匹配规则；页面声明了 Renderer 不支持的能力时，Renderer 应在加载前拒绝渲染并输出缺失能力。
- **E3：** L2 校验器新增能力约束：使用 `actions[].type: upload` 或 `upload.props.actionRef` 时，页面必须声明 `meta.requiredCapabilities: [actions.upload]`。
- **E4：** L3a 校验器修复表格列/行内操作表达式默认作用域，省略 `scope` 时不再隐式允许 `$row.*`，与 `03-component-registry.md` / ADR-0004 的“显式 `scope: row`”规则一致。
- **E5：** `text` 组件文档与 DSL 描述澄清：`content` / `contentKey` 仍为必填，声明 `data` 时作为加载前/无数据时的兜底文案。
- **E6：** `RowAction.key` 执行边界澄清：仅供前端预注册行内处理器本地分发，不自动绑定顶层 `actions`；后端请求型行操作需另行标准化。

**涉及的文档、Schema 与脚本：**
- 协议文档：`00-overview.md` / `01-node-protocol.md` / `03-component-registry.md` / `08-renderer-spec.md`
- JSON Schema / DSL：`schemas/page.schema.json` / `schemas/component-registry.json`
- 校验脚本：`scripts/validate-l2-components.js` / `scripts/validate-l3a-expressions.js`
- 审计记录：`docs/audit/archived/0024-2026-07-09-*`

## v0.2.7 — 2026-07-09（行级后端动作补丁）

> **版本说明：** v0.2.7 基于 ADR-0008 标准化表格行内按钮直接调用后端接口的声明式模型。不改变 `meta.protocolVersion`，使用该能力的页面必须声明 `meta.requiredCapabilities: [actions.row.request]`。

**新增 / 决策：**
- **F1：** 新增 `decisions/0008-row-action-backend-request.md`，明确 `RowAction.key` 继续作为本地分发标识，新增 `RowAction.actionRef` 引用顶层 `type: request` action。
- **F2：** `RowAction` 新增 `requestMapping`，用于把 `$row.*` / `$parentRow.*` 或字面量绑定到 request action 的 `path` / `query` / `body`。
- **F3：** 新增 PATCH 级能力键 `actions.row.request`；使用 `table.props.actions[].actionRef` 时必须声明该能力。
- **F4：** Renderer 规范补充行级 request action 执行流程：解析映射、替换 URL 占位符、复用统一请求通道、`onSuccess.reload` 刷新触发表格。
- **F5：** L2 校验器新增 `RowAction.actionRef` 引用、能力声明、request action 类型、URL 占位符与 `requestMapping` 值规则校验。
- **F6：** 新增行级后端动作端到端场景示例。

**涉及的文档、Schema 与脚本：**
- 协议文档：`00-overview.md` / `01-node-protocol.md` / `03-component-registry.md` / `06-validation.md` / `07-actions-contract.md` / `08-renderer-spec.md`
- JSON Schema / DSL：`schemas/page.schema.json` / `schemas/component-registry.json`
- 校验脚本：`scripts/validate-l2-components.js`
- 场景示例：`05-scenarios/row-backend-actions.md`

## v0.1.0 — 2026-07-07

初版发布。

**新增：**
- 核心 Node 协议：`type` / `props` / `data` / `children` / `reactions`
- 联动表达式引擎（`when` 白名单语法）
- 组件类型：`grid`、`section`、`tabs`、`statCard`、`chart`、`text`、`table`、`form`、`input`、`inputNumber`、`select`
- 数据源契约：`static` / `ref` / `api` 三种模式，`table` 分页契约
- 三个基础场景示例：网格看板、数据表格、表单联动
- JSON Schema 校验文件：`node.schema.json` / `reaction.schema.json` / `component-registry.json`
