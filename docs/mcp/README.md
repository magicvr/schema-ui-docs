# Schema-UI MCP 服务文档

本目录记录 Schema-UI MCP 服务的设计、实施计划与后续交付说明。MCP 服务的职责边界以 [ADR-0007](../decisions/0007-mcp-protocol-reader-validator.md) 为准：v1 仅提供协议只读查询与 `validate_content` 内容校验，不读取宿主项目文件系统，不生成或修改页面配置。

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