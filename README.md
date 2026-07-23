# Schema-UI 前后端协议

Schema-UI 是前端 Renderer 与后端页面生产方共同遵守的、框架和语言无关的配置驱动 UI 协议。
协议本身是本仓库的核心交付物；验证器、reference、MCP 和 Docker 镜像都是非规范性辅助工具。

当前协议版本为 `2.4.0`，页面声明使用 `meta.protocolVersion: "2.4"`。

开始阅读：[`PROJECT_CHARTER.md`](./PROJECT_CHARTER.md) → [`docs/00-overview.md`](./docs/00-overview.md)。

## 核心交付物

| 层级 | 内容 | 作用 |
|---|---|---|
| 核心规范 | `docs/00`–`08`、协议 ADR | 定义字段语义、默认值和能力边界 |
| 机器契约 | `docs/schemas/` | 定义 JSON/YAML 结构与组件字段 |
| 行为契约 | `conformance/fixtures/` | 定义跨前后端实现的可观测结果 |
| 协议制品 | `schema-ui-protocol-<version>.tar.gz` | 前后端共同固定和消费的不可变发布单元 |

协议制品文件清单由 [`protocol-manifest.json`](./protocol-manifest.json) 定义。`scripts/`、`mcp/`、
`validator/`、`docs/mcp/`、`docs/audit/` 和 reference 实现不进入协议制品，也不影响协议内容摘要。

## 权威规则

不同问题使用不同的权威投影：

- 字段语义和能力边界：核心规范与已接受的协议 ADR；
- JSON/YAML 结构和组件字段：JSON Schema 与组件注册 DSL；
- 可观测算法结果：versioned conformance fixtures；
- 验证器、reference 和 MCP：只能执行或呈现以上规则，不能新增协议语义。

任意两层冲突都属于发布阻断问题，不能以某个工具当前接受或拒绝作为裁决。完整规则见
[`PROJECT_CHARTER.md`](./PROJECT_CHARTER.md)。

## 前后端消费

构建语言无关协议制品：

```bash
npm ci
npm run build:protocol
npm run verify:protocol-artifact
```

输出：

```text
dist/schema-ui-protocol-2.4.0.tar.gz
dist/schema-ui-protocol-2.4.0.tar.gz.sha256
dist/protocol/manifest.json
```

独立前端和后端仓库应固定协议 tag 或制品 SHA-256，直接消费同一份 Schema 和 fixtures；不得复制后维护
私有期望结果。JavaScript、Python、Java、.NET 等消费者使用同一个制品，不要求安装或运行 MCP。

当前跨实现消费规则与 fixture 分类见 [`conformance/README.md`](./conformance/README.md)。从 `2.2` 升级到
`2.3` 请按 [`docs/migrations/2.2-to-2.3.md`](./docs/migrations/2.2-to-2.3.md) 执行；从 `2.1` 请先按
[`docs/migrations/2.1-to-2.2.md`](./docs/migrations/2.1-to-2.2.md) 执行；从 `2.0` 请先按
[`docs/migrations/2.0-to-2.1.md`](./docs/migrations/2.0-to-2.1.md)。

## 协议验证

协议仓库自身的完整门禁：

```bash
npm run check:links
npm run release:check
npm run verify:protocol-artifact
npm run validate:scenarios
npm run validate:conformance
```

生产消费者至少应运行与自身职责相关的 Schema 校验和 conformance fixtures。根 CLI 是辅助验证器入口：

```bash
npm run validate -- "pages/**/*.yaml"
```

验证器的通过不替代协议评审；每条拒绝规则必须能追溯到核心规范、机器契约或行为契约。

## 版本与发布

完整流程见 [`docs/RELEASE.md`](./docs/RELEASE.md)。摘要：

| 事件 | 行为 |
|---|---|
| 合并到 `main` | 只跑 CI，**不**发布资产、**不**自动打 tag |
| 人工 tag `v*` | 协议 GitHub Release：`tar.gz` + `.sha256` |
| 人工 tag `mcp-v*` | MCP 镜像推到 **GHCR**（`ghcr.io/<owner>/schema-ui-mcp`，含稳定版 `latest`） |

- 协议 tag：`v<protocol-artifact-version>`，例如 `v2.4.0`；
- 页面协议版本：MAJOR.MINOR，例如 `2.3`；
- MCP tag：`mcp-v<mcp-version>`，例如 `mcp-v2.0.0`（与协议 **独立**）；
- MCP 与验证器独立 SemVer；镜像正式源为 GitHub Packages，不是 Docker Hub。

`npm run release:check:tag` 只验证协议 tag。协议工作流生成 tar.gz 和 SHA-256；MCP 工作流不改变协议版本。

## 辅助工具

### 验证器

`scripts/` 提供 L0/L1、L2、L3a、L4 校验实现。当前 validator 版本为 `1.0.0`，支持协议制品 `2.4.0`，
兼容声明见 `validator/package.json`。根 CLI 和 MCP 共用同一个 Ajv 装配模块；L4 的禁止字段
直接从 `node.schema.json` 派生，避免维护第二份规则。使用说明见 [`docs/06-validation.md`](./docs/06-validation.md)。

### MCP

`mcp/` 提供协议只读查询与 `validate_content` 内容校验。它不读取宿主项目文件系统，不生成或修改页面，
也不进入协议权威层。MCP 当前版本为 `2.0.0`，捆绑协议制品 `2.4.0`；两个版本独立演进。正式分发为
`ghcr.io/<owner>/schema-ui-mcp` 上的 stdio Docker 镜像。

安装、Docker、工具接口见 [`docs/mcp/README.md`](./docs/mcp/README.md)；发布流程见
[`docs/RELEASE.md`](./docs/RELEASE.md) 与 [`ADR-0007`](./docs/decisions/0007-mcp-protocol-reader-validator.md)。

## 目录结构

```text
.
├── PROJECT_CHARTER.md             # 项目使命、权威矩阵与防漂移门禁
├── protocol-manifest.json         # 协议制品来源清单与版本
├── docs/                          # 规范、Schema、场景、ADR、迁移和过程记录
├── conformance/                   # 语言无关 fixtures 与非规范性 reference
├── scripts/                       # 辅助验证器与协议制品构建脚本
├── validator/                     # 辅助验证器的独立版本与兼容声明
├── mcp/                           # 非规范性 MCP 消费工具
└── .github/workflows/             # Protocol 与 MCP 分离的 CI/CD
```

协议范围与当前发布门禁见 [`docs/14-v2.3-release-goals.md`](./docs/14-v2.3-release-goals.md)；
发布流程见 [`docs/RELEASE.md`](./docs/RELEASE.md)；
v2.1 历史门禁见 [`docs/12-v2.1-release-goals.md`](./docs/12-v2.1-release-goals.md)；
v2.0 MAJOR 历史见 [`docs/10-v2-release-goals.md`](./docs/10-v2-release-goals.md)；
Admin 后续轨道见 [`docs/11-next-admin-lifecycle-goals.md`](./docs/11-next-admin-lifecycle-goals.md)；
历史版本记录见 [`docs/CHANGELOG.md`](./docs/CHANGELOG.md)。
