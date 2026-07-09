---
status: draft
date: 2026-07-09
based_on: ../decisions/0007-mcp-protocol-reader-validator.md
---

# Schema-UI MCP v1 设计说明

## 1. 目标

MCP v1 面向 AI 工具提供两个能力：

1. 只读查询 Schema-UI 协议知识；
2. 校验调用方传入的页面配置内容。

MCP v1 不生成页面、不修改文件、不读取宿主项目目录、不访问网络。协议知识与校验规则的权威源仍是本仓库的 `docs/`、`docs/schemas/` 与 `scripts/`。

## 2. 运行形态

| 项 | 决策 |
|---|---|
| 技术栈 | Node.js >= 18 + TypeScript |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Transport | stdio |
| 官方分发 | Docker 镜像 |
| 本地开发 | npm / node 辅助运行 |
| 文件系统访问 | 不读取宿主业务项目文件系统 |
| 校验模型 | 调用方传入内容，MCP 内部校验 |

Docker 镜像内置协议文档、Schema、组件注册 DSL、校验脚本、Node 运行时与依赖。镜像不要求挂载业务项目目录。

## 3. 工具清单

### 3.1 `protocol.search`

用途：按关键词搜索协议文档、场景示例和关键 Schema 描述。

输入：

```json
{
  "query": "scope row",
  "limit": 10
}
```

规则：

- `query` 必填，最大 200 字符；
- `limit` 可选，默认 10，最大 10；
- v1 使用无索引关键词子串匹配；
- 不支持正则、向量检索或外部搜索；
- 排序：标题/章节命中 > 正文命中；完全词命中 > 部分子串命中；同级按文档地图顺序。

实现时应将匹配与排序拆成纯函数，并在单元测试中固定输入与输出顺序，避免不同调用时返回结果漂移。

输出：

```json
{
  "results": [
    {
      "title": "联动表达式引擎语法规范",
      "path": "docs/02-reaction-expression.md",
      "section": "作用域（scope）规则",
      "snippet": "scope: row 的表达式中不能出现 $deps.*...",
      "reason": "正文命中 scope row"
    }
  ]
}
```

### 3.2 `protocol.get_doc`

用途：获取指定协议文档全文或章节。

输入：

```json
{
  "docId": "02-reaction-expression",
  "section": "作用域"
}
```

规则：

- `docId` 必填；
- `section` 可选；
- v1 支持固定文档 id 白名单，不接受任意路径；
- `section` 至少支持二级标题匹配（`##` + `###`）；匹配到 `##` 时返回该章节及其子章节，匹配到 `###` 时返回该子章节内容；多个标题命中时返回文档顺序中的第一个，并在结果中标明实际命中的标题；
- 单次返回建议不超过 20KB，超出时返回截断提示和章节建议。

### 3.3 `protocol.list_components`

用途：列出当前组件注册表中的全部组件。

输出字段：

```json
{
  "components": [
    {
      "type": "table",
      "category": "data",
      "supportsChildren": false,
      "supportsData": true,
      "supportsReactions": false,
      "supportsStates": true
    }
  ]
}
```

分类由 MCP 根据 `03-component-registry.md` 的章节和 `component-registry.json` 组件顺序派生。分类仅用于导航，不作为协议校验依据。

### 3.4 `protocol.get_component`

用途：返回指定组件的结构化契约。

输入：

```json
{
  "type": "table"
}
```

输出必须保留原始 DSL 约束信息，并可补充派生字段：

```json
{
  "type": "table",
  "supportsChildren": false,
  "supportsData": true,
  "supportsReactions": false,
  "supportsStates": true,
  "props": {},
  "anyOf": [],
  "oneOf": [],
  "allOf": [],
  "requiredProps": ["rowKey", "pagination", "columns"],
  "optionalProps": ["title", "actions", "span"],
  "i18nProps": ["titleKey"]
}
```

MCP 不得丢弃 `component-registry.json` 中的原始字段、组合约束或说明文本。派生字段只用于 AI 消费便利，不作为新的协议源头。

`component-registry.json` 是自定义 DSL，不是标准 JSON Schema。输出中的 `$ref` 仅表示协议文档/DSL 内部引用，不承诺可由通用 JSON Schema 解析器直接解析。AI 消费方应把它视为组件契约描述，而不是独立 schema 文件。

### 3.5 `protocol.validate_content`

用途：校验调用方传入的 YAML/JSON 页面配置内容。

输入：

```json
{
  "content": "meta:\n  pageId: order_list\n  title: 订单列表\n  protocolVersion: \"0.2\"\nbody:\n  type: table\n  ...",
  "format": "yaml",
  "filename": "pages/order-list.yaml"
}
```

字段规则：

| 字段 | 必填 | 说明 |
|---|---|---|
| `content` | 是 | YAML/JSON 内容，最大 1MB |
| `format` | 是 | `yaml` 或 `json` |
| `filename` | 否 | 仅用于错误展示，不读取该路径 |

输出：

```json
{
  "passed": false,
  "layers": {
    "L0/L1": [],
    "L2": [],
    "L3a": [
      {
        "path": "body.props.columns[0].visibleWhen.when",
        "rule": "SCOPE_ISOLATION",
        "message": "scope:form 的表达式中不能出现 $row.*（需要行数据请使用 scope:row）"
      }
    ],
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

## 4. 校验适配设计

MCP v1 复用现有校验规则与子脚本，不重写 L0-L4 规则，也不把 `scripts/validate-all.js` 作为内部强制入口。`validate-all.js` 保留为 CI 与人工本地校验的统一入口；MCP 内部可以用更直接的结构化适配方式生成 `layers`。

适配流程：

1. 检查 `content` 大小与 `format`；
2. 先用 `js-yaml` 或 `JSON.parse` 做输入解析，解析失败直接返回 `parseError`；
3. 在 `os.tmpdir()` 下创建 UUID 临时目录；
4. 按 `format` 写入 `.yaml` 或 `.json` 临时文件，编码为无 BOM UTF-8；
5. 使用 `docs/schemas/page.schema.json` 及其 `$ref` 子 schema 通过 AJV API 执行 L0/L1；
6. 分别调用 `validate-l2-components.js`、`validate-l3a-expressions.js`、`lint-l4-banned-props.js` 的 `--json` 输出；
7. 将 AJV errors 与各子脚本 `violations` 归一化为 MCP `layers`；
8. 按固定映射生成 `suggestedDocs`；
9. 清理临时目录。

临时目录清理失败时，只输出本地警告，不改变校验结果。Docker 镜像必须内置 MCP 运行时依赖和 L0/L1 所需的 AJV 运行库；不要求镜像额外支持手动运行 `scripts/validate-all.js`，除非后续把它列为单独调试能力。

MCP 不得直接透传 AJV 或子脚本的原始输出。MCP 需要的是按层归一化后的违规数组，因此实现必须确认 AJV errors 与各子脚本 `--json` 输出 schema，再建立转换映射：

| 来源 | MCP `layers` 映射 |
|---|---|
| `validate-l2-components.js --json` | `violations` → `layers.L2`，`parseErrors` → `parseError` 或 `layers.L2` 的解析项 |
| `validate-l3a-expressions.js --json` | `violations` → `layers.L3a`，保留 `path` / `rule` / `message` |
| `lint-l4-banned-props.js --json` | `violations` → `layers.L4`，保留 `path` / `key` 并生成 `message` |
| AJV API L0/L1 | AJV errors → `layers["L0/L1"]`，转换 `instancePath` / `keyword` / `message` |

传给校验脚本的临时文件路径应使用单文件路径而非 glob；如实现内部必须使用 glob，应统一转为正斜杠路径，避免 Windows 反斜杠与 `globSync` 匹配行为不一致。

## 5. 文档与组件读取设计

### 5.1 文档 id 白名单

`protocol.get_doc` 使用固定白名单，避免任意路径读取：

| docId | 文件 |
|---|---|
| `overview` | `docs/00-overview.md` |
| `node-protocol` | `docs/01-node-protocol.md` |
| `reaction-expression` | `docs/02-reaction-expression.md` |
| `component-registry` | `docs/03-component-registry.md` |
| `datasource-contract` | `docs/04-datasource-contract.md` |
| `validation` | `docs/06-validation.md` |
| `actions-contract` | `docs/07-actions-contract.md` |
| `renderer-spec` | `docs/08-renderer-spec.md` |
| `changelog` | `docs/CHANGELOG.md` |

场景示例通过 `protocol.search` 可被检索；如后续需要稳定场景接口，可另行增加 `protocol.get_scenario`。

`protocol.search` 的索引范围必须包含主协议文档、`05-scenarios/**/*.md`、`decisions/**/*.md` 与关键 Schema/DSL 描述；`protocol.get_doc` 的白名单范围较窄，不代表 search 的索引范围。

### 5.2 组件契约来源

`protocol.list_components` 与 `protocol.get_component` 读取 `docs/schemas/component-registry.json`。该文件是自定义 DSL，不是标准 JSON Schema。MCP 输出可以做规范化，但必须保留原始约束字段，避免把 MCP 输出变成第二套组件契约。

## 6. `suggestedDocs` 映射

v1 使用固定映射：

| 来源 | 建议文档 |
|---|---|
| `L0/L1` | `docs/01-node-protocol.md`, `docs/schemas/page.schema.json`, `docs/schemas/node.schema.json` |
| `L2` | `docs/03-component-registry.md`, `docs/schemas/component-registry.json` |
| `L3a` | `docs/02-reaction-expression.md`, `docs/03-component-registry.md` |
| `L4` | `docs/06-validation.md`, `docs/01-node-protocol.md` |
| `parseError` | `docs/01-node-protocol.md`, `docs/06-validation.md` |
| `actions.upload` capability | `docs/01-node-protocol.md`, `docs/07-actions-contract.md`, `docs/08-renderer-spec.md` |
| `actions.row.request` capability | `docs/03-component-registry.md`, `docs/07-actions-contract.md`, `docs/08-renderer-spec.md` |

实现可以按具体 rule 增加更精确文档，但必须保持确定性。

## 7. 安全与隐私

- 不读取宿主项目文件系统；
- 不写文件到业务项目；
- 不执行用户传入命令；
- 不访问网络；
- 不持久化 `content`；
- 不上传遥测；
- 临时文件仅用于校验适配，校验完成后删除；
- 工具返回值不包含 Node.js 原始堆栈。

## 8. Docker 镜像

镜像内容：

- 编译后的 MCP server；
- `docs/`；
- `docs/schemas/`；
- `scripts/`；
- `node_modules` 运行依赖；
- Node.js 运行时。

镜像入口为 stdio MCP server。使用示例：

```bash
docker run --rm -i schema-ui-mcp:0.2.7
```

不需要 `-v` 挂载业务项目目录。

Docker smoke test 应可自动化执行：启动镜像，发送 MCP `initialize` 请求，再发送 `tools/list` 请求，断言返回包含 `protocol.search`、`protocol.get_doc`、`protocol.list_components`、`protocol.get_component`、`protocol.validate_content` 五个工具。

## 9. 验收用例

| 编号 | 用例 | 期望 |
|---|---|---|
| M1 | `protocol.get_doc({ docId: "overview" })` | 返回总纲内容 |
| M2 | `protocol.list_components()` | 包含 `table` / `form` / `upload` |
| M3 | `protocol.get_component({ type: "table" })` | 返回结构化表格契约 |
| M4 | 官方完整场景传入 `validate_content` | `passed: true` |
| M5 | `$row.*` 缺少 `scope: row` | `passed: false`，L3a 报错 |
| M6 | upload action 缺少 `actions.upload` capability | `passed: false`，L2 报错 |
| M7 | RowAction.actionRef 缺少 `actions.row.request` capability | `passed: false`，L2 报错 |
| M8 | 非法 YAML | `passed: false`，返回 `parseError` |
| M9 | Docker stdio smoke test | MCP 可启动并响应工具列表 |