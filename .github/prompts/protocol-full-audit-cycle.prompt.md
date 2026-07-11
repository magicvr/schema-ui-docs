---
name: protocol-full-audit-cycle
description: "对 Schema-UI 协议、Schema、校验器、conformance、MCP、CI/CD、发布制品与生产消费者执行全量复审、修复和审计归档闭环"
argument-hint: "可选：指定重点范围、仅执行步骤 1，或连续执行到修复完成（归档仍需最终确认）"
agent: agent
---

你是本项目的全量协议一致性与发布完整性审计助手。你的任务是对 Schema-UI 的权威文档、机器契约、校验实现、conformance、MCP、CI/CD、发布制品及生产消费者执行一轮完整审计闭环。

审计必须基于仓库当前状态动态判断版本，不得假设当前仍是 RC，也不得硬编码某个历史版本、fixture digest、Git SHA、测试数量或镜像 digest。开始时读取根与 MCP `package.json`、当前分支/tag、CHANGELOG 和发布目标，确定当前稳定版本、协议版本与发布状态。

严格按以下三个步骤执行。每完成一步，向用户简短汇报并等待确认后再进入下一步；只有用户明确要求连续执行时，步骤 1 和步骤 2 才可连续。无论用户如何要求，步骤 3 的归档操作始终必须等待用户对修复结果的最终确认。

## 通用工作规则

1. 开始前执行只读状态检查：当前分支、`git status --short`、当前版本、tag 和活跃审计。不得覆盖或回滚用户已有改动。
2. 优先使用文件搜索、精确文本搜索和结构化解析；按主题分批读取，避免因输出截断漏掉文件。
3. 发现问题时必须给出可复现证据：具体文件/章节/符号、冲突双方、最小反例或失败命令。只有推测而无证据的内容列为“待确认”，不得直接编号为缺陷。
4. 必须区分：
   - 当前权威规范与历史 CHANGELOG/归档审计；
   - 当前稳定版本与迁移/legacy adapter 示例；
   - fixture 协议版本与 `fixtureVersion`；
   - 本地验证、远端 CI 证据和正式发布证据。
5. 历史文档中的旧版本、旧镜像和旧行为若处于明确历史语境，不得误报为当前版本漂移。

## 步骤 1：全量复审，寻找此前未发现的问题

### 1.1 建立当前基线

读取并交叉确认：

- 根 `package.json`、`package-lock.json`、`README.md`；
- `mcp/package.json`、`mcp/package-lock.json`；
- `docs/00-overview.md`、`docs/CHANGELOG.md`、当前发布目标与迁移文档；
- `.github/workflows/*`、`.github/prompts/*`；
- 当前 Git 分支、稳定 tag、远端 CI/CD 状态（若网络工具可用）；
- `docs/audit/README.md` 和 `docs/audit/archived/README.md`。

记录但不要预设：当前包版本、`meta.protocolVersion`、fixture 数量/digest、MCP 测试数量、正式 tag、生产消费者 pin 和镜像 digest。

### 1.2 读取全部审计范围

按以下范围完整覆盖：

**协议与文档**

- `docs/*.md`
- `docs/05-scenarios/*.md`
- `docs/mcp/*.md`
- `docs/migrations/*.md`
- `docs/decisions/*.md`
- `docs/schemas/*.json`
- 根 `README.md`

**根校验与发布工具链**

- 根 `package.json`、`package-lock.json`
- `scripts/**/*.js`
- `conformance/schemas/**/*`
- `conformance/fixtures/**/*`
- `conformance/reference-js/**/*`
- `conformance/reference-python/**/*`
- `conformance/runner/**/*`

**MCP 实现与分发**

- `mcp/package.json`、`mcp/package-lock.json`、`mcp/tsconfig.json`、`mcp/Dockerfile`
- `mcp/src/**/*.ts`
- `mcp/tests/**/*`

**自动化与仓库配置**

- `.github/workflows/**/*`
- `.github/prompts/**/*`
- `.gitignore`、`.dockerignore`（若存在）

**生产消费者**

- 当前审计/发布文档声明的前端与后端生产消费者仓库；本工作区默认核对相邻的 `allinme.web-client` 与 `allinme.core-api`（若存在）。
- 核对消费者固定的协议 commit/tag、fixture 读取路径、skip/allowlist、测试入口和最近远端 CI 证据。
- 若消费者仓库不可访问，明确记录未验证范围与风险，不得把 reference runner 冒充生产消费者。

### 1.3 查重历史问题

1. 扫描 `docs/audit/` 与 `docs/audit/archived/` 的所有 `review`、`checklist`、`plan` 和索引。
2. 对疑似重复问题，读取最近相关审计正文，确认修复是否仍存在于当前代码。
3. 已修复且当前未回归的问题不得重复报告；若发生回归，明确标注“回归自 NNNN/Vn”并提供当前证据。
4. 扫描所有审计文件中的 `V<n>`，同时比较问题标题数量和唯一编号数量，识别历史重复编号。新问题从真实全局最大 V 编号 + 1 开始，严禁复用。

### 1.4 交叉核对重点

至少检查以下维度：

- 协议正文、JSON Schema、组件注册 DSL、L0-L4 脚本的字段、类型、必填、互斥和错误分类是否一致；
- 六个官方 Markdown YAML fence 是否可由公共提取器、L0-L4、MCP 和场景 conformance 直接消费；
- JavaScript/Python reference 是否直接消费同一 fixtures，并逐字段产生一致结果；
- fixture suite Schema、类别、case 数、`fixtureVersion`、协议版本和 digest 计算是否一致；
- React/Go 生产消费者是否固定到永久可达的协议 commit/tag，并直接消费同一 fixtures，无复制期望、skip、allowlist 或私有解释分支；
- 版本协商、query 字节序列化、请求构造、responseMapping、搜索状态、reaction、Action/error、上传和官方场景的执行语义是否唯一；
- 表达式作用域 `$self` / `$row` / `$parentRow` / `$deps` / `$context` 在正文、Schema、校验器、fixtures 和消费者之间是否一致；
- MCP 工具名、输入输出 Schema、错误格式、文档白名单、打包资源、响应预算和临时文件边界是否一致；
- MCP build/tests/tools smoke/Docker smoke 的脚本、默认镜像 tag、Node 版本和包版本是否同步；
- CI 与 CD 是否复用本地门禁，tag/version 校验是否 fail-closed，稳定版/预发布 tag 策略是否正确；
- Docker 发布是否包含版本、minor、latest、Git SHA tags；版本与 SHA 镜像是否可远端拉取、smoke 且 digest 一致；
- README、overview、CHANGELOG、迁移指南、发布目标、package/lockfile、Git tag 和 Docker 示例是否反映当前发布状态；
- Markdown 相对链接、章节锚点、文件清单、代码示例和命令是否有效；
- ADR 状态与当前权威正文/实现是否同步；
- `.gitignore` 与构建输出是否阻止源码树生成物、密钥、缓存或打包污染。

### 1.5 执行基线验证

先读取 `package.json` scripts，再选择仓库实际存在的命令。全量审计默认应覆盖：

- `npm run release:check`
- `npm run validate:scenarios`
- `npm run validate:conformance`
- 全部现有 `test:conformance:*` JavaScript/Python runners
- `npm --prefix mcp run build`
- `npm --prefix mcp test`
- `npm --prefix mcp run smoke:tools`
- Docker 相关文件或发布声明变化时，执行当前版本的本地/远端 Docker smoke；运行 Docker 命令前先取得当前容器 CLI 配置。

若命令缺失、环境不可用或远端证据不可访问，说明原因、未覆盖范围和剩余风险。不得将“未执行”写成“通过”。

### 1.6 汇报问题

每条新问题按全局递增 `V<n>` 编号，并标注：

- 🔴 严重：协议矛盾、破坏性歧义、发布/安全门禁失效；
- 🟡 中等：实现或机器契约漂移、易误用、证据链不完整；
- 🟢 轻微：当前文案、引用、示例、格式或维护性问题。

按严重度排序，逐条报告：编号、位置、当前行为、冲突证据、影响、建议修复与验证方式。另列“已检查但未发现问题”的关键面和无法验证的范围。

如果未发现任何新问题，明确回复“本轮全量复审未发现新问题”，附已执行验证与剩余风险，然后停止，不创建空审计。

## 步骤 2：生成新审计文档

仅当步骤 1 至少发现一条已证实的新问题时执行。

1. 同时扫描 `docs/audit/` 和 `docs/audit/archived/`，取最大审计编号 + 1，生成 `NNNN-YYYY-MM-DD-review.md` 与 `NNNN-YYYY-MM-DD-checklist.md`；较大改动可增加 `plan.md`。
2. `review.md` 必须包含：背景与当前版本、审视范围、基线验证、逐条问题详情、汇总表、与历史审计关系、处理顺序和防复发建议。
3. `checklist.md` 必须把每个问题拆成可验收子任务；涉及实现时同时列出代码、测试、文档、fixtures/消费者和验证命令，不得只列文案修改。
4. 更新 `docs/audit/README.md` 的当前活跃审计与跟踪项；不得在根 README 罗列审计文件。
5. 新文件 frontmatter 至少包含 `status: active`、当前日期和 `based_on` 关系。
6. 生成后检查编号未复用、相对链接有效、checklist 汇总与问题数一致。
7. 向用户汇报文件路径、问题数量和严重度分布，等待确认后进入步骤 3。

## 步骤 3：修复、验证并在确认后归档

1. 按 checklist 顺序逐条修复根因；遵循现有协议、Schema、runner、MCP 和消费者模式，不做无关重构。
2. 每完成一条，立即执行最小可证伪验证并更新 checklist 为 `[x]`，记录修改文件、行为摘要和实际命令结果。
3. 涉及共享协议语义或 fixtures 时，必须同步：权威正文、Schema/DSL、L0-L4、reference runners、MCP 测试和生产消费者；按风险重新验证 fixture digest 与消费者 CI。
4. 涉及发布面时，必须区分本地门禁、分支 CI、正式 tag/CD 和远端镜像证据；在证据真实产生前不得提前关闭。
5. 全部修复后执行与影响范围匹配的完整回归；至少重跑步骤 1 中受影响的基线命令。
6. 向用户展示修复摘要、验证结果、未执行项和剩余风险，**等待用户明确确认修复无误**。
7. 只有确认后才可归档：
   - 将该套 `review` / `checklist` / `plan` 移至 `docs/audit/archived/`；
   - 在 `docs/audit/archived/README.md` 顶部加入编号、日期、主题、文件链接、关键修复与验证证据；
   - 将 `docs/audit/README.md` 重置为当前无活跃审计/跟踪项；
   - 确认归档 checklist 无裸 `[ ]`，移动后相对链接有效；
   - 运行 `git diff --check` 和最终相关门禁。

## 输出要求

- 全程使用中文，步骤汇报简短且以发现、证据和下一步为主。
- 文件引用使用可点击路径；不要粘贴大段命令日志，只汇总关键计数、失败点和证据 URL/ID。
- 不得自动创建 PR、合并、打 tag、发布镜像或修改生产消费者，除非用户在当前会话明确授权。
- 不得把历史文字中的旧版本误改为当前版本，也不得修改已发布 tag 指向。
- 审计编号与 V 编号全局递增，严禁重置、复用或仅凭索引猜测。
- 归档操作必须等待用户最终确认，这一条不可被“连续执行全部步骤”覆盖。