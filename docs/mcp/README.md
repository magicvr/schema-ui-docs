# Schema-UI MCP 服务文档

本目录记录 Schema-UI MCP 服务的设计、实施计划与后续交付说明。MCP 服务的职责边界以 [ADR-0007](../decisions/0007-mcp-protocol-reader-validator.md) 为准：v1 仅提供协议只读查询与 `validate_content` 内容校验，不读取宿主项目文件系统，不生成或修改页面配置。

> 当前 MCP 版本以 `mcp/package.json` 为准。**MAJOR.MINOR 与捆绑协议线对齐**（如协议 `2.4` → MCP `2.4.x`）；**PATCH 独立演进**。完整协议制品版本见 `schemaUiProtocol.artifactVersion`，validator 见 `schemaUiValidator`。详见 [RELEASE.md](../RELEASE.md) §2。

## 文档列表

| 文档 | 用途 |
|---|---|
| [v1-design.md](./v1-design.md) | MCP v1 设计说明：工具接口、返回结构、模块边界、安全约束、Docker 形态 |
| [v1-implementation-plan.md](./v1-implementation-plan.md) | MCP v1 实施计划：任务拆分、验收标准、发布步骤 |
| [RELEASE.md](../RELEASE.md) | 协议 / MCP 发布流程（main 只 CI、独立 tag、GHCR、线对齐） |

## 入口原则

- 协议权威矩阵见 [`PROJECT_CHARTER.md`](../../PROJECT_CHARTER.md) 和根 [`protocol-manifest.json`](../../protocol-manifest.json)。
- 验证脚本和 MCP 都是非规范性辅助工具；MCP 只读取构建后的协议制品并调用辅助验证器。
- v1 校验入口只有 `protocol.validate_content`，调用方传入 YAML/JSON 内容。
- Docker 镜像**内置**协议知识和校验运行时，不要求挂载业务项目目录；**运行时不自动拉取**远程协议更新。
- **正式分发形态：GitHub Container Registry（`ghcr.io`）上的 stdio Docker 镜像**；协议制品与 MCP 镜像分 tag 发布，但 **MAJOR.MINOR 共线**。

## 本地开发

源码安装、构建、测试和本地运行要求 Node.js `>=20.19.0`。该下限与当前 `vitest` → Vite 7 测试依赖链一致；CI 在 Node `20.19.0` 与 Node 24 上执行完整 MCP 构建、测试和 tools smoke，Docker 分发仍固定使用 Node 24。

```bash
npm install
npm install --prefix mcp
npm --prefix mcp run build
npm --prefix mcp run smoke:tools
```

本地启动 stdio server：

```bash
npm --prefix mcp start
```

## Docker 分发（GHCR）

### 使用已发布镜像

CD 工作流（tag `mcp-v*`）将镜像推送到 **GitHub Packages / GHCR**，仓库名为：

```text
ghcr.io/<github-owner-lowercase>/schema-ui-mcp
```

将 `<github-owner-lowercase>` 换成仓库所有者的小写登录名或 org（例如 `ghcr.io/acme/schema-ui-mcp`）。

当前版本示例（版本号以已发布 MCP tag 为准；应与协议线一致，例如协议 `2.4` → MCP `2.4.x`）：

```bash
docker pull ghcr.io/<owner>/schema-ui-mcp:2.4.1
docker run --rm -i ghcr.io/<owner>/schema-ui-mcp:2.4.1
```

若包为 private，需先登录：

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

公开匿名拉取：在 GitHub → Packages → `schema-ui-mcp` → Package settings 将可见性设为 **Public**（首次发布后需人工设置一次）。

MCP 客户端配置示例（稳定接入请 pin **完整版本**，不要只用 `latest`）：

```json
{
  "mcpServers": {
    "schema-ui": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "ghcr.io/<owner>/schema-ui-mcp:2.4.1"
      ]
    }
  }
}
```

镜像 tag 策略：

| Tag | 用途 |
|---|---|
| `2.4.1` | 固定 PATCH 版本（稳定接入示例；MAJOR.MINOR = 协议线） |
| `2.4` | 当前 `2.4.x` 最新稳定 PATCH（与协议 `2.4` 线对应） |
| `latest` | 最新**稳定**发布；**不建议**写入生产接入配置 |
| `<commit-sha>` | 精确追踪一次 CD 构建产物 |

CD 仅接受与 `mcp/package.json` 版本完全一致的 `mcp-v<version>` Git tag。预发布版本只生成完整版本 tag 与 commit SHA，不更新 minor 或 `latest`；无预发布标识的稳定版本才更新这两个别名。

**协议 `v<version>` tag 只发布协议制品，不触发 MCP 镜像发布。** 协议 MINOR/MAJOR 后须按 [RELEASE.md](../RELEASE.md) **人工跟发** `mcp-v*`，否则 GHCR 内置协议会过时。

MCP 使用 stdio transport，Docker 启动参数需要保留 `-i`，不需要 `-t`。镜像不要求挂载业务项目目录；`protocol.validate_content` 校验的是调用方传入的 YAML/JSON 字符串，不读取 `filename` 对应的本地文件。

接入后，AI 客户端可以直接调用 `protocol.search`、`protocol.get_doc`、`protocol.list_components`、`protocol.get_component` 和 `protocol.validate_content`。常见使用方式是先用 `protocol.search` 或 `protocol.get_component` 查询协议约束，再把页面配置内容传给 `protocol.validate_content` 做 L0-L4 分层校验。

### 本地构建镜像

从仓库根目录构建镜像：

```bash
docker build -f mcp/Dockerfile -t schema-ui-mcp:2.4.1 .
```

作为 stdio MCP server 启动：

```bash
docker run --rm -i schema-ui-mcp:2.4.1
```

Docker smoke test：

```bash
npm --prefix mcp run smoke:docker -- schema-ui-mcp:2.4.1
```

镜像接入示例固定使用完整版本 tag，不使用 `latest`。`mcp/package.json` 中的 MCP SDK 依赖也应固定为明确版本，而不是使用 `latest` 作为包清单策略，避免后续刷新 lockfile 时无意引入 SDK 行为漂移。
