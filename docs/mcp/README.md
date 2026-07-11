# Schema-UI MCP 服务文档

本目录记录 Schema-UI MCP 服务的设计、实施计划与后续交付说明。MCP 服务的职责边界以 [ADR-0007](../decisions/0007-mcp-protocol-reader-validator.md) 为准：v1 仅提供协议只读查询与 `validate_content` 内容校验，不读取宿主项目文件系统，不生成或修改页面配置。

> 当前工作区 MCP 包版本为 `1.0.0`，已发布稳定 Docker 镜像示例仍为 `0.2.8`。只有匹配的 `v1.0.0` tag 完成 CD、远端拉取与 Docker smoke 后才能声明新镜像已发布；版本状态以 [`docs/CHANGELOG.md`](../CHANGELOG.md) 为准。

## 文档列表

| 文档 | 用途 |
|---|---|
| [v1-design.md](./v1-design.md) | MCP v1 设计说明：工具接口、返回结构、模块边界、安全约束、Docker 形态 |
| [v1-implementation-plan.md](./v1-implementation-plan.md) | MCP v1 实施计划：任务拆分、验收标准、发布步骤 |

## 入口原则

- 协议权威源仍是 `docs/`、`docs/schemas/`、`scripts/`。
- MCP 不复制协议规则，只读取或打包同版本协议文件。
- v1 校验入口只有 `protocol.validate_content`，调用方传入 YAML/JSON 内容。
- Docker 镜像内置协议知识和校验运行时，不要求挂载业务项目目录。

## 本地开发

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

## Docker 分发

### 使用已发布镜像

CD 工作流会将镜像推送到 Docker Hub 仓库：

```text
<dockerhub-namespace>/schema-ui-mcp
```

当前版本示例：

```bash
docker pull <dockerhub-namespace>/schema-ui-mcp:0.2.8
docker run --rm -i <dockerhub-namespace>/schema-ui-mcp:0.2.8
```

MCP 客户端配置示例：

```json
{
  "mcpServers": {
    "schema-ui": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "<dockerhub-namespace>/schema-ui-mcp:0.2.8"
      ]
    }
  }
}
```

镜像 tag 策略：

| Tag | 用途 |
|---|---|
| `0.2.8` | 固定 PATCH 版本，推荐团队接入使用 |
| `0.2` | 当前 `0.2.x` 最新 PATCH |
| `latest` | 最新发布版本，不建议写入稳定接入示例 |
| `<commit-sha>` | 精确追踪一次 CD 构建产物 |

CD 仅接受与 `mcp/package.json` 版本完全一致的 `v<version>` Git tag。预发布版本只生成完整版本 tag 与 commit SHA，不更新 minor 或 `latest`；无预发布标识的稳定版本才更新这两个别名。`workflow_dispatch` 也必须从匹配的 Git tag 触发，不能从普通分支覆盖已发布版本。

MCP 使用 stdio transport，Docker 启动参数需要保留 `-i`，不需要 `-t`。镜像不要求挂载业务项目目录；`protocol.validate_content` 校验的是调用方传入的 YAML/JSON 字符串，不读取 `filename` 对应的本地文件。

接入后，AI 客户端可以直接调用 `protocol.search`、`protocol.get_doc`、`protocol.list_components`、`protocol.get_component` 和 `protocol.validate_content`。常见使用方式是先用 `protocol.search` 或 `protocol.get_component` 查询协议约束，再把页面配置内容传给 `protocol.validate_content` 做 L0-L4 分层校验。

### 本地构建镜像

从仓库根目录构建镜像：

```bash
docker build -f mcp/Dockerfile -t schema-ui-mcp:1.0.0 .
```

作为 stdio MCP server 启动：

```bash
docker run --rm -i schema-ui-mcp:1.0.0
```

Docker smoke test：

```bash
npm --prefix mcp run smoke:docker -- schema-ui-mcp:1.0.0
```

正式发布完成前，已发布镜像接入示例仍固定使用稳定 tag `0.2.8`，本地发布构建使用 `1.0.0`，均不使用 `latest`。`mcp/package.json` 中的 MCP SDK 依赖也应固定为明确版本，而不是使用 `latest` 作为包清单策略，避免后续刷新 lockfile 时无意引入 SDK 行为漂移。
