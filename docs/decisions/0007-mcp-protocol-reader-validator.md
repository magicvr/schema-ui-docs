---
status: accepted
date: 2026-07-09
---

# ADR-0007: Schema-UI MCP 服务的定位、边界与分发方式

## 状态

已接受(Accepted)。本 ADR 定义第一版 MCP 服务的职责边界、技术栈、分发方式、工具接口、安全约束与后续扩展原则。

## 背景

Schema-UI 协议已经具备面向 MVP 的核心文档、JSON Schema、组件注册 DSL、场景示例与 L0-L4 校验脚本。前/后端工程师在使用 AI 工具生成、修改或审查页面配置时，需要 AI 能够稳定读取协议知识，并能用同一套校验工具判断配置是否合法。

因此需要为协议仓库提供一个 MCP 服务，使 AI 工具可以通过标准接口访问协议内容与校验能力。同时，MCP 服务不应成为新的协议源头，也不应在第一版引入写文件、生成配置、远程鉴权或业务接口推断等额外复杂度。

## 决策

### D1. MCP 的定位

MCP v1 是 Schema-UI 协议的 AI 消费入口，职责仅限于：

1. 提供协议内容的只读查询；
2. 对调用方传入的页面配置内容执行格式与语义校验。

协议权威源仍然是本仓库中的：

- `docs/`：人类可读协议文档与场景示例；
- `docs/schemas/`：JSON Schema 与组件注册 DSL；
- `scripts/`：L0-L4 校验脚本。

MCP 不在服务内部硬编码第二份协议规则，不复制组件契约，不改写协议文档。协议更新后，MCP 应读取或打包同一版本的上述文件，而不是维护独立知识库。

### D2. v1 工具清单

MCP v1 冻结以下工具名：

```text
protocol.search
protocol.get_doc
protocol.list_components
protocol.get_component
protocol.validate_content
```

工具语义：

| 工具 | 说明 |
|---|---|
| `protocol.search` | 在协议文档、场景示例和关键 Schema 描述中按关键词搜索，返回匹配片段与来源 |
| `protocol.get_doc` | 按文档 id 获取指定协议文档全文或章节 |
| `protocol.list_components` | 返回组件类型列表、分类和能力标记（children/data/reactions/states） |
| `protocol.get_component` | 按 `type` 返回结构化组件契约，来源为 `component-registry.json` |
| `protocol.validate_content` | 校验调用方传入的 YAML/JSON 页面配置内容，返回 L0-L4 分层结果 |

v1 不提供 `validate_file`。校验接口不读取宿主项目文件系统，调用方需要先读取文件内容，再将内容传入 `protocol.validate_content`。这样本地 Docker、stdio 与未来远程部署可以共用同一个稳定接口。

### D3. `protocol.validate_content` 输入协议

`protocol.validate_content` 的输入为：

```json
{
  "content": "meta:\n  pageId: order_list\n  ...",
  "format": "yaml",
  "filename": "pages/order-list.yaml"
}
```

字段规则：

| 字段 | 必填 | 说明 |
|---|---|---|
| `content` | 是 | YAML 或 JSON 字符串，最大 1MB |
| `format` | 是 | `yaml` 或 `json` |
| `filename` | 否 | 仅用于错误展示与上下文提示，不作为文件读取路径 |

MCP 不根据 `filename` 读取文件，不访问宿主项目目录，不要求 Docker 挂载业务项目目录。

### D4. 校验输出格式

`protocol.validate_content` 返回结构化结果，而不是原样返回终端文本：

```json
{
  "passed": false,
  "layers": {
    "L0/L1": [],
    "L2": [],
    "L3a": [],
    "L4": []
  },
  "summary": "发现 1 处 L3a 表达式作用域违规",
  "parseError": null,
  "internalError": null,
  "suggestedDocs": [
    "docs/02-reaction-expression.md",
    "docs/03-component-registry.md"
  ]
}
```

返回字段兼容策略：已发布字段不得删除或改变含义；未来扩展只能新增字段。这样 AI 工具集成后，不会因为 MCP 版本升级而破坏既有调用逻辑。

`suggestedDocs` 在 v1 中由固定映射表生成，而不是从模型推断或从终端文本自由解析。例如：L0/L1 指向 `docs/01-node-protocol.md` 与 `docs/schemas/`，L2 指向 `docs/03-component-registry.md`，L3a 指向 `docs/02-reaction-expression.md`，L4 指向 `docs/06-validation.md`。具体错误可按规则补充更精确文档，但必须来自确定性映射。

### D5. 校验实现方式

MCP v1 必须复用现有校验工具链，不重新实现 L0-L4 规则。

实现可以通过临时文件或内存适配调用现有脚本，但对外语义必须等价于：

```bash
node scripts/validate-all.js <page-file>
```

要求：

- L0/L1 使用 `page.schema.json` 及其 `$ref` 子 schema；
- L2 使用 `component-registry.json` 和 `validate-l2-components.js`；
- L3a 使用 `validate-l3a-expressions.js`；
- L4 使用 `lint-l4-banned-props.js`；
- 校验结果必须与 CI 中的同版本脚本保持一致；
- 临时文件写入必须使用无 BOM UTF-8，避免 Windows PowerShell 编码问题影响结果。
- 若实现采用临时文件适配现有脚本，临时文件必须位于 `os.tmpdir()` 下的独立临时目录，目录名和文件名使用 UUID 或等价随机标识，避免并发调用冲突；
- 校验完成后必须清理临时目录；清理失败时只允许输出本地警告，不得影响校验结果结构；
- Docker 镜像必须预装运行 L0/L1 所需的 `ajv-cli` 与 `ajv-formats`，不得依赖宿主环境提供这些命令；
- 临时文件扩展名必须与 `format` 保持一致（`.yaml` / `.json`），使现有脚本的解析路径与 CI 一致。

### D6. 技术栈

MCP v1 使用 Node.js + TypeScript 实现，运行时要求 Node.js >= 18。

MCP SDK 使用官方 npm 包 `@modelcontextprotocol/sdk`。除非该 SDK 无法满足 stdio MCP v1 的基础需求，不应引入其他 MCP 框架或自定义协议适配层。

理由：

- 当前仓库已经使用 Node.js 脚本实现校验工具链；
- 现有依赖（`js-yaml`、`glob`、`ajv-cli`、`ajv-formats`）可直接复用；
- TypeScript 生态中 MCP SDK 支持成熟；
- 避免引入 Python/Go/Rust 等第二套运行时导致维护分叉。

### D7. 传输与部署形态

MCP v1 使用 stdio transport。

官方分发方式提供 Docker 镜像，镜像内置同版本的：

- 协议文档；
- JSON Schema；
- 组件注册 DSL；
- 校验脚本；
- Node.js 运行时与依赖。

工程师使用时不需要 clone 协议仓库，也不需要本地安装 Node.js 依赖。Docker 镜像只作为协议知识与校验运行时的封装，不读取宿主业务文件系统。

本地 npm / node 运行方式仅作为 MCP 开发、调试与 CI smoke test 的辅助方式保留，不作为团队消费的主要入口。

### D8. Docker 镜像版本策略

镜像 tag 与协议版本对齐：

```text
schema-ui-mcp:0.2.6
schema-ui-mcp:0.2
schema-ui-mcp:latest
```

约定：

- 文档示例必须使用 PATCH tag（如 `0.2.6`），避免工程师无意跟随 `latest` 升级；
- `0.2` 可指向当前最新 `0.2.x`；
- `latest` 可发布，但不作为接入示例；
- 每次协议 PATCH 发布时，同步发布对应 MCP 镜像；
- 镜像内置内容必须与 tag 对应的协议文档、Schema 和脚本一致。

### D9. 安全与隐私边界

MCP v1 的安全边界如下：

- 不读取宿主项目文件系统；
- 不写入任何业务项目文件；
- 不执行用户传入命令；
- 不访问网络；
- 不调用外部 API；
- 不持久化 `validate_content.content` 原文；
- 不上传日志或遥测；
- 只执行内置协议查询和固定校验逻辑。

若未来远程部署 MCP 服务，也必须延续 `validate_content` 的内容传入模型；服务端不得要求访问调用者本地路径。远程部署若需要鉴权、租户隔离、请求审计或日志采集，必须另开 ADR。

### D10. 查询返回粒度

只读查询工具返回规则：

- `protocol.get_doc`：按文档 id 返回全文；可选章节参数返回指定章节；
- `protocol.search`：返回最多 10 条匹配片段，每条包含标题、路径、片段与匹配原因；
- `protocol.list_components`：返回组件 key、分类、支持能力标记；
- `protocol.get_component`：返回结构化 JSON，而不是 Markdown 表格；v1 返回基于 `component-registry.json` 的规范化对象，保留原始 DSL 字段（如 `supportsChildren`、`supportsData`、`supportsReactions`、`supportsStates`、`props`、`anyOf`、`oneOf`、`allOf`），并可补充派生字段（如 `type`、`requiredProps`、`optionalProps`、`i18nProps`）以便 AI 消费；不得丢弃原始约束信息。

`protocol.search` 的 v1 实现采用无索引的关键词子串匹配，不支持正则查询、语义向量检索或外部搜索服务。排序规则固定为：文档标题/章节标题命中优先于正文命中；完全词命中优先于部分子串命中；同等优先级下按文档地图顺序排序。该策略保证实现简单、确定、可解释，并与“不引入全文索引/向量库”的 v1 边界一致。

单次工具返回内容建议不超过 20KB。若未来文档规模扩大，需要分页或索引检索时另行扩展。

### D11. 错误处理协议

`protocol.validate_content` 必须区分三类失败：

| 失败类型 | 输出方式 |
|---|---|
| 输入解析失败（非法 YAML/JSON） | `passed: false`，`parseError` 填入错误对象，`layers` 为空数组集合 |
| 校验不通过 | `passed: false`，`parseError: null`，对应 L0-L4 层填入违规项 |
| MCP 内部异常（脚本缺失、依赖缺失、临时目录不可写等） | `passed: false`，`internalError` 填入错误对象，`summary` 说明服务内部错误 |

`parseError` 与 `internalError` 的最小结构为：

```json
{
  "message": "bad indentation of a mapping entry",
  "line": 12,
  "column": 5
}
```

`line` / `column` 无法获得时可省略。MCP 不得把未结构化的 Node 堆栈直接返回给 AI；开发调试日志可以输出到 stderr，但工具返回值必须保持上述结构。

### D12. 发布与验收

MCP 镜像发布前必须通过以下验收：

1. `protocol.get_doc` 能返回协议总纲；
2. `protocol.list_components` 能列出组件注册表中的全部组件；
3. `protocol.get_component` 能返回 `table` / `form` / `upload` 的结构化契约；
4. `protocol.validate_content` 能通过三个官方完整场景示例；
5. `protocol.validate_content` 能拒绝表格 `$row.*` 缺少 `scope: row` 的反例；
6. `protocol.validate_content` 能拒绝使用 upload 但缺少 `meta.requiredCapabilities: [actions.upload]` 的反例；
7. `protocol.validate_content` 能对非法 YAML 返回 `parseError`；
8. Docker 镜像通过 stdio 启动 smoke test。

## 明确不做

MCP v1 不提供以下能力：

- 自动生成页面配置；
- 自动修复 YAML/JSON；
- 写入文件；
- 本地路径校验（`validate_file`）；
- 业务接口推断；
- Renderer 代码生成；
- 协议迁移工具；
- HTTP/SSE 远程服务；
- 数据库、向量库或持久索引；
- 遥测或内容日志采集。

## 后续扩展原则

以下能力若未来需要，必须另开 ADR：

- `validate_file` 或任何本地文件系统访问；
- 远程 HTTP/SSE MCP 服务；
- 自动生成、修复或迁移页面配置；
- 多协议版本同时查询；
- 文档全文索引、向量检索或数据库缓存；
- 遥测、远程日志或请求审计；
- 行级后端请求动作的协议生成/校验辅助工具。

## 后果

**正面：**

- AI 工具可以通过稳定接口读取协议知识并执行校验；
- Docker 镜像降低团队接入成本；
- `validate_content` 模型兼容本地与未来远程部署；
- MCP 不读取宿主文件系统，安全边界简单；
- 校验逻辑复用现有脚本，避免协议规则漂移。

**负面 / 取舍：**

- AI 客户端需要先读取待校验文件内容，再调用 MCP；
- v1 不提供 `validate_file`，本地使用少一个便捷入口；
- 只读搜索不引入索引，文档规模很大时可能需要后续优化；
- Docker 分发需要协议发布流程同步 build/push 镜像。