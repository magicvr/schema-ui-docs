# Schema-Driven UI 协议文档

配置驱动 UI（Schema-Driven UI）系统的工程化文档，供前/后端开发者与 AI 助手查阅。

**入口：从 [`docs/00-overview.md`](./docs/00-overview.md) 开始阅读。**

本仓库当前包含两部分交付物：

- `docs/`：Schema-UI 协议、场景示例、标准 JSON Schema、组件注册 DSL、ADR 与校验说明。
- `conformance/`：框架无关的一致性 fixtures、JavaScript 参考算法与 runner。
- `mcp/`：Schema-UI MCP stdio 服务实现，提供协议只读查询与内容校验工具。

当前稳定版本为 `1.0.0`，页面配置使用 `meta.protocolVersion: "1.0"`。发布目标与门禁完成记录见 [`docs/09-v1-release-goals.md`](./docs/09-v1-release-goals.md)。

## MCP 服务

MCP 服务当前**已发布稳定镜像**为 `1.0.0`。源码安装、校验工具链与 MCP 运行时要求 Node.js `>=20.19.0`；这是当前 `vitest` 测试链使用的 Vite 7 所支持的最低 Node 版本，避免继续声明未经标准构建与测试路径验证的 Node 18。CI 同时验证最低版本 `20.19.0` 和 Node 24，官方 Docker 镜像固定使用 Node 24。服务只读取本仓库内置的协议文档、Schema 与校验脚本；不会读取调用方项目文件系统，也不会生成或修改页面配置。

### 使用 Docker Hub 镜像

CD 工作流会将 MCP 镜像推送到 Docker Hub：

```text
<dockerhub-namespace>/schema-ui-mcp:1.0.0
<dockerhub-namespace>/schema-ui-mcp:1.0
<dockerhub-namespace>/schema-ui-mcp:latest
<dockerhub-namespace>/schema-ui-mcp:<commit-sha>
```

CD 仅在推送与包版本一致的 Git tag（当前为 `v1.0.0`）时发布，手工触发也必须选择该 tag。预发布版本只推送完整版本 tag 和 commit SHA，不更新 minor 或 `latest`；稳定版本才更新 minor 和 `latest` 别名。

团队接入建议固定使用 PATCH tag，例如 `1.0.0`，避免无意跟随 `latest` 升级。

拉取并启动 stdio MCP server：

```bash
docker pull <dockerhub-namespace>/schema-ui-mcp:1.0.0
docker run --rm -i <dockerhub-namespace>/schema-ui-mcp:1.0.0
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
                "<dockerhub-namespace>/schema-ui-mcp:1.0.0"
            ]
    }
    }
}
```

这个镜像不需要挂载业务项目目录。调用 `protocol.validate_content` 时，由 MCP 客户端读取页面 YAML/JSON 内容后传入工具；MCP 服务只校验传入内容，不读取本地路径。

接入后可以让 AI 客户端查询协议、读取组件契约或校验当前页面配置内容。典型用法包括：搜索 `table pagination` 的协议说明、读取 `table` 组件契约、校验一段页面 YAML 是否符合 L0-L4 规则。

已暴露工具：

| 工具 | 用途 |
|---|---|
| `protocol.search` | 搜索协议文档、场景示例、ADR 与 Schema 描述 |
| `protocol.get_doc` | 按 `docId` 读取白名单协议文档，可选章节 |
| `protocol.list_components` | 列出当前组件注册表中的组件类型与能力标记 |
| `protocol.get_component` | 返回指定组件的结构化契约 |
| `protocol.validate_content` | 校验调用方传入的 YAML/JSON 页面配置内容 |

### 本地开发与验证

```bash
npm install
npm install --prefix mcp
npm run validate -- "<page-file-or-glob>"
npm run validate:scenarios
npm run validate:conformance
npm run check:links
npm run release:check
npm run test:conformance:version
npm run test:conformance:version:python
npm run test:conformance:query
npm run test:conformance:query:python
npm run test:conformance:actions
npm run test:conformance:actions:python
npm run test:conformance:reactions
npm run test:conformance:reactions:python
npm run test:conformance:table-state
npm run test:conformance:request
npm run test:conformance:request:python
npm run test:conformance:response
npm run test:conformance:response:python
npm run test:conformance:search-table
npm run test:conformance:search-table:python
npm run test:conformance:scenarios
npm run test:conformance:scenarios:python
npm run test:conformance:uploads
npm run test:conformance:uploads:python
npm --prefix mcp run build
npm --prefix mcp run test
npm --prefix mcp run smoke:tools
```

其中 `npm run validate` 用于校验调用方提供的页面 YAML/JSON 文件，例如 `npm run validate -- "pages/**/*.yaml"`。

`npm run check:links` 检查 `README.md`、`docs/**/*.md` 与 `conformance/**/*.md` 中 Markdown/HTML 的仓库内相对链接是否存在；外部 URL、纯锚点、代码块、行内代码与普通说明文字不作为链接目标扫描。

本地启动 stdio server：

```bash
npm --prefix mcp start
```

本地 Docker 构建与 smoke test：

```bash
docker build -f mcp/Dockerfile -t schema-ui-mcp:1.0.0 .
docker run --rm -i schema-ui-mcp:1.0.0
npm --prefix mcp run smoke:docker -- schema-ui-mcp:1.0.0
```

更多 MCP 设计与边界说明见 [`docs/mcp/README.md`](./docs/mcp/README.md) 与 [`docs/decisions/0007-mcp-protocol-reader-validator.md`](./docs/decisions/0007-mcp-protocol-reader-validator.md)。

从 `0.2` / `0.3` 升级时请按 [`docs/migrations/0.2-0.3-to-1.0.md`](./docs/migrations/0.2-0.3-to-1.0.md) 迁移页面、Renderer 与后端接口；正式 tag 流程使用 `npm run release:check:tag`。

## 目录结构

```
.
├── package.json                  # 根协议文档与校验脚本依赖
├── mcp/                          # MCP stdio 服务实现
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   └── tests/
├── scripts/                      # 协议校验脚本
├── conformance/                  # 跨实现 fixtures、JavaScript reference 与 runner
└── docs/
    ├── 00-overview.md              # 总纲、术语表（第一个要读的文件）
    ├── 01-node-protocol.md         # 核心协议规范
    ├── 02-reaction-expression.md   # 联动表达式语法规范
    ├── 03-component-registry.md    # 组件类型注册表
    ├── 04-datasource-contract.md   # 数据源/API 契约规范
    ├── 05-scenarios/               # 可复制的完整场景示例
    │   ├── README.md
    │   ├── grid-dashboard.md
    │   ├── data-table.md
    │   ├── form-with-reactions.md
    │   ├── row-backend-actions.md
    │   ├── search-form-table.md
    │   └── form-with-upload.md
    ├── 06-validation.md            # 校验规则与工具链
    ├── 07-actions-contract.md      # Action 行为契约（since 0.2）
    ├── 08-renderer-spec.md         # Renderer 实现规范（since 0.2.1）
    ├── 09-v1-release-goals.md      # v1.0 发布目标、阻断门禁与版本纪律
    ├── mcp/                        # MCP 服务设计与实施计划
    │   ├── README.md
    │   ├── v1-design.md
    │   └── v1-implementation-plan.md
    ├── schemas/                    # 标准 JSON Schema（page/node/action/reaction）+ 组件注册 DSL（component-registry）
    │   ├── page.schema.json
    │   ├── node.schema.json
    │   ├── reaction.schema.json
    │   ├── action.schema.json
    │   └── component-registry.json
    ├── decisions/                  # 架构决策记录（ADR）
    │   ├── 0001-why-single-node-tree.md
    │   ├── 0002-why-not-two-schema-uischema.md
    │   ├── 0003-context-namespace-and-visible-when.md
    │   ├── 0004-row-level-scope.md
    │   ├── 0005-response-mapping.md
    │   ├── 0006-expression-evaluation-order.md
    │   ├── 0007-mcp-protocol-reader-validator.md
    │   ├── 0008-row-action-backend-request.md
    │   ├── 0009-strict-version-negotiation.md
    │   ├── 0010-query-serialization.md
    │   ├── 0011-reserved-query-params.md
    │   └── 0012-upload-execution.md
    ├── audit/                      # 过程性审计与迭代记录（详见 audit/README.md）
    │   ├── README.md               # 活跃清单 + 编号规则
    │   └── archived/               # 已归档历史审计（详见 archived/README.md）
    └── CHANGELOG.md
```
