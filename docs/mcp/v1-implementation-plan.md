---
status: implemented
date: 2026-07-09
based_on: ./v1-design.md
---

# Schema-UI MCP v1 实施计划

> 当前状态：v1 已按本计划落地到 `mcp/` 目录，并通过 `mcp/src/**/*.ts`、`mcp/tests/**/*`、`mcp/Dockerfile` 与 `docs/mcp/README.md` 维护实现和使用说明。本文保留为实施记录和验收对照。

## 1. 交付目标

交付一个本地 stdio MCP 服务，官方以 Docker 镜像分发。v1 提供：

- 协议只读查询；
- 组件契约查询；
- 内容传入式页面配置校验；
- 结构化校验错误与建议文档。

v1 不提供文件路径校验、自动生成、自动修复、远程 HTTP/SSE 服务。

## 2. 目录规划

> **以仓库实际结构为准。** 下表为实施完成后的稳定形态（0045 回填）；历史草案中的 `tests/fixtures/` 等路径已废弃。

```text
mcp/
├── package.json
├── package-lock.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── server.ts
│   ├── types.ts
│   ├── tools/
│   │   ├── search.ts
│   │   ├── docs.ts
│   │   ├── components.ts
│   │   ├── validate-content.ts
│   │   └── utils.ts
│   └── core/
│       ├── paths.ts
│       ├── protocol-index.ts
│       ├── component-registry.ts
│       ├── search.ts
│       ├── validation-runner.ts
│       └── suggested-docs.ts
└── tests/
    ├── test-utils.ts
    ├── validate-content.test.ts
    ├── components.test.ts
    ├── search.test.ts
    ├── smoke-tools.mjs
    └── smoke-docker.mjs
```

第一版已将 MCP 代码放在独立 `mcp/` 目录，避免和协议校验脚本混在一起。

## 3. 任务拆分

### P1. 项目脚手架

- [x] 新增 `mcp/package.json`
- [x] 新增 TypeScript 配置
- [x] 安装 `@modelcontextprotocol/sdk`
- [x] 配置 build/start 脚本
- [x] 实现 stdio server 启动入口
- [x] 注册五个 v1 工具集中声明

验收：MCP server 可启动并返回工具列表。

### P2. 协议路径与文档索引

- [x] 建立协议根目录定位逻辑
- [x] 建立 docId 白名单
- [x] 建立 search 索引范围（主协议文档、`05-scenarios/**/*.md`、`decisions/**/*.md`、关键 Schema/DSL 描述）
- [x] 实现 Markdown 文档读取
- [x] 实现二级标题章节切分（`##` + `###`）
- [x] 建立文档地图顺序

验收：`protocol.get_doc` 可返回 `overview` 与 `reaction-expression`。

### P3. 搜索工具

- [x] 实现关键词子串匹配
- [x] 将匹配评分与排序逻辑抽成纯函数
- [x] 实现标题/章节优先排序
- [x] 为完全词/部分子串、标题/正文、文档顺序排序写单元测试
- [x] 实现结果数量限制
- [x] 返回 `title` / `path` / `section` / `snippet` / `reason`

验收：搜索 `scope row` 能返回表达式规范和组件注册表相关片段。

### P4. 组件工具

- [x] 读取 `docs/schemas/component-registry.json`
- [x] 实现 `protocol.list_components`
- [x] 实现 `protocol.get_component`
- [x] 保留原始 DSL 字段
- [x] 派生 `requiredProps` / `optionalProps` / `i18nProps`

验收：`table` / `form` / `upload` 可返回结构化契约。

### P5. `validate_content` 工具

#### P5.0 子脚本与 AJV 输出确认

- [x] 执行 `validate-l2-components.js --json` 的通过/失败样例，记录输出 schema
- [x] 执行 `validate-l3a-expressions.js --json` 的通过/失败样例，记录输出 schema
- [x] 执行 `lint-l4-banned-props.js --json` 的通过/失败样例，记录输出 schema
- [x] 执行 AJV L0/L1 失败样例，记录 AJV errors schema
- [x] 在测试夹具中保存最小样例输出，作为转换逻辑回归基线

#### P5.1 校验适配实现

- [x] 校验输入大小和 `format`
- [x] 实现 YAML/JSON parse 预检查
- [x] 实现 `os.tmpdir()` + UUID 临时目录
- [x] 无 BOM UTF-8 写入临时文件
- [x] 使用 AJV API 执行 L0/L1，读取 `page.schema.json` 及其 `$ref` 子 schema
- [x] 调用 L2/L3a/L4 子脚本并读取 `--json` 输出
- [x] 不直接透传 AJV 或子脚本原始输出，而是转换为 MCP `layers` 数组结构
- [x] 将 L2 `violations` 映射为 `layers.L2`
- [x] 将 L3a `violations` 映射为 `layers.L3a`
- [x] 将 L4 `violations` 映射为 `layers.L4`
- [x] 将 AJV errors 映射为 `layers["L0/L1"]`
- [x] 将子脚本 `parseErrors` 归一化为 `parseError` 或对应层解析项
- [x] 使用单文件路径调用校验脚本；若必须使用 glob，统一转换为正斜杠路径
- [x] 生成 `summary`
- [x] 生成 `suggestedDocs`
- [x] 清理临时目录
- [x] 结构化 `parseError` / `internalError`

验收：官方场景通过；缺 scope、缺 capability、非法 YAML 三类反例返回预期结构。

### P6. Docker 镜像

- [x] 新增 Dockerfile
- [x] 镜像内置 `docs/`、`scripts/`、`docs/schemas/`
- [x] 安装 MCP 运行依赖，确保 AJV API 与 L2/L3a/L4 子脚本可运行
- [x] 不要求镜像支持手动运行 `scripts/validate-all.js`，除非后续作为调试能力单独声明
- [x] 配置 stdio entrypoint
- [x] 编写 Docker 启动示例
- [x] 编写 Docker smoke test 脚本：发送 `initialize` 与 `tools/list`，断言返回五个工具名

验收：`docker run --rm -i schema-ui-mcp:0.2.8` 可作为 stdio MCP 启动。

### P7. 测试与回归

- [x] 官方完整场景 `validate_content` 通过
- [x] `$row.*` 缺少 `scope: row` 反例失败
- [x] upload 缺少 `actions.upload` capability 反例失败
- [x] RowAction.actionRef 缺少 `actions.row.request` capability 反例失败
- [x] 非法 YAML 返回 `parseError`
- [x] `search` 返回稳定顺序
- [x] `get_component` 不丢原始 DSL 约束
- [x] Docker smoke test 自动化脚本已提供；执行状态见发布流水线或本地 `npm --prefix mcp run smoke:docker -- <image>`

## 4. 版本与发布

首个 MCP 镜像 tag 与当前协议 PATCH 对齐：

```text
schema-ui-mcp:0.2.8
```

发布步骤：

1. 跑协议现有 `npm run validate` 场景回归；
2. 跑 MCP 单元测试；
3. 跑 Docker smoke test；
4. 构建镜像；
5. 推送 `0.2.8` tag；
6. 可选更新 `0.2` 和 `latest` tag；
7. 在 `docs/mcp/README.md` 或 CHANGELOG 记录镜像 tag。

文档示例必须使用 PATCH tag，不使用 `latest`。

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 校验输出解析不稳定 | MCP 直接使用 AJV API 和分层脚本 `--json` 输出，避免解析 `validate-all.js` 的聚合 stdout/stderr |
| 临时文件并发冲突 | UUID 临时目录，校验后清理 |
| Windows 临时路径与 glob 不兼容 | 优先使用单文件路径；必须使用 glob 时统一正斜杠 |
| Docker 镜像内容与协议版本漂移 | 镜像构建前校验 tag 与 `00-overview.md` / CHANGELOG 当前版本一致 |
| AI 传入超大内容 | `content` 最大 1MB，超出直接返回 `internalError` 或输入错误 |
| `component-registry.json` DSL 被错误简化 | `get_component` 输出保留原始 DSL 字段，并用测试断言关键字段存在 |

## 6. 不纳入 v1

- `protocol.validate_file`
- 自动生成页面配置
- 自动修复 YAML/JSON
- 远程 HTTP/SSE 服务
- 文件系统挂载读取
- 外部网络访问
- 文档索引/向量库
- 遥测与内容日志

## 7. 完成定义

MCP v1 完成需同时满足：

- ADR-0007 中 D2 工具全部实现；
- `v1-design.md` 中 M1-M9 验收用例全部通过；
- Docker 镜像可通过 stdio 方式启动；
- 官方完整场景校验通过；
- 协议反例（缺 scope、缺 upload capability、缺 row request capability）校验失败且返回建议文档；
- 非法 YAML 返回结构化 `parseError`；
- 文档说明工程师无需挂载业务目录即可使用 Docker MCP。