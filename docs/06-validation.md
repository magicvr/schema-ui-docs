---
status: stable
owner: 前端架构组
last_updated: 2026-07-10
applies_to: schema-ui-protocol v0.2
---

# 校验规则与工具链

## 1. 校验层级

| 层级 | 工具 | 时机 | 校验内容 |
|---|---|---|---|
| L0 页面结构校验 | [`schemas/page.schema.json`](./schemas/page.schema.json) | 后端 CI / 提交前 | 顶层文档结构（`meta` + `datasources` + `body` + `actions`）合法性；校验 `meta.protocolVersion` 为 MAJOR.MINOR 格式 |
| L1 Node 结构校验 | [`schemas/node.schema.json`](./schemas/node.schema.json) | 后端 CI / 提交前 | Node 结构是否合法（字段名、类型）。L1 只能校验 `data.responseMapping` 的键名、点路径格式和最小字段数，不能单独判断列表类接口必须声明 `list`、服务端分页表格必须声明 `total` 等依赖组件类型和 props 的语义条件 |
| L2 组件契约校验 | [`schemas/component-registry.json`](./schemas/component-registry.json) + [`scripts/validate-l2-components.js`](../scripts/validate-l2-components.js) | 后端 CI | `type` 是否存在、`props` 是否符合该组件的字段契约；同时补充依赖组件语义的校验，如 `responseMapping` 条件必填、PATCH 级能力声明、`RowAction.actionRef` 引用和行级 `requestMapping` 规则。对组件 DSL 内 `$ref` 到 `VisibleWhen` / `Reaction` / `Permissions` 的字段（如 `table.props.columns[]` / `actions[]` 内嵌表达式对象），L2 必须执行等价结构校验，包括 `when` / `fulfill` 必填、额外字段拒绝，以及 `scope: row` 下 `fulfill` / `otherwise` 仅允许 `visible` / `disabled`。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node。该文件是自定义 DSL，校验器必须按 `03-component-registry.md` 的关键字白名单处理字段表、组合约束和受控 `$ref`，不能只读取 props 字段表，也不能直接当作标准 JSON Schema 交给 AJV |
| L3a 表达式静态校验 | [`schemas/reaction.schema.json`](./schemas/reaction.schema.json) + [`scripts/validate-l3a-expressions.js`](../scripts/validate-l3a-expressions.js) | Renderer 加载页面配置时 / CI 可选前置 | 表达式语法合法性、变量是否在 `dependencies` 声明范围内、作用域规则（`$deps`/`$row`/`$self` 等）静态检查；同时检查 `data.params`、`select.props.optionsSource.params`、`datasources.*.params` 中 `$deps.*` 仅出现在表单上下文，且参数值替换不使用 `$row.*` / `$context.*` 等表达式变量；表格列/操作在 `scope: form` 下使用 `$deps.*` 时要求表格位于 `form` 上下文内。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node |
| L3b 表达式运行时求值 | Renderer 表达式引擎 | 交互/数据变化时 | 仅在已通过 L3a 校验的表达式上执行实际求值 |
| L4 语义禁用词校验 | [`scripts/lint-l4-banned-props.js`](../scripts/lint-l4-banned-props.js) | CI | `props`/`fulfill` 中是否混入禁止的 CSS 属性名（如 `color`/`margin`），可覆盖 Schema 表达力之外的场景（如深层嵌套结构）。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node。**注意：本仓库已在 `scripts/lint-l4-banned-props.js` 中提供可执行 lint 脚本，各接入方可直接使用；也可复用 L1（JSON Schema `not.anyOf`）作为基础防线。** |

> **v0.2 变更（A1，双轨策略）：** L1（`node.schema.json` 的 `not`+`anyOf`）与 L4（lint 脚本）是**两层独立防线**，而非同一规则的重复实现：
> - **L1** 通过 JSON Schema 的 `not: { anyOf: [...] }` 逐一禁止每个 CSS 属性名单独出现在 `props` 中，随 CI 自动挂载生效，无需额外配置，是**自动生效的基础防线**。
> - **L4** 是更细致的深度补充，可覆盖 Schema 表达力之外的场景（如嵌套对象内部、`reactions[].fulfill` 中的禁用词），但需要团队额外接入 lint 流程才会生效。
> - **同步要求：** L1 的 `anyOf` 清单与 L4 的禁用词清单必须保持一致，任一方新增禁用词时需同步更新另一方，避免两层防线出现漂移。

> **v0.2.4 变更（`responseMapping` 条件必填）：** `schemas/node.schema.json` 只能表达 `responseMapping` 的结构下限，不能仅凭 `DataRef` 判断组件消费数据的语义。校验器必须在 L2、L4 或人工 review 中结合组件类型和 `props` 补充检查：`table` / `chart` 这类数组消费组件声明 `responseMapping` 时必须提供 `list`；`table.props.pagination.mode: server` 时必须提供 `total`。这两条规则与 `04-datasource-contract.md` §4.1.1 和 ADR-0005 保持一致。

> **v0.2.7 变更（行级后端请求）：** 使用 `table.props.actions[].actionRef` 时，页面必须声明 `meta.requiredCapabilities: [actions.row.request]`。L2 校验器还应检查 `actionRef` 是否存在、是否引用 `type: request` action、是否同时声明非空 `requestMapping`、`requestMapping.path` 是否与 URL `{param}` 占位符一致、映射值是否只使用字面量或单个 `$row.*` / `$parentRow.*` 点路径。

## 2. CI 建议流程

```
提交 YAML
  → L0 [`page.schema.json`](./schemas/page.schema.json) 顶层文档结构校验
  → L1 [`node.schema.json`](./schemas/node.schema.json) Node 结构校验
  → L2 组件契约校验（node_modules）[`scripts/validate-l2-components.js`](../scripts/validate-l2-components.js)
  → L4 禁用词扫描（防止 CSS 属性混入）[`scripts/lint-l4-banned-props.js`](../scripts/lint-l4-banned-props.js)
  → 通过后允许合并
  ↓
加载配置时（Renderer）
  → L3a 表达式静态校验（语法、作用域、变量声明）[`scripts/validate-l3a-expressions.js`](../scripts/validate-l3a-expressions.js)
  ↓
运行时（前端交互/数据变化时）
  → L3b 表达式运行时求值（仅在通过 L3a 的表达式上执行）
```

统一入口：`npm run validate`（或直接 `node scripts/validate-all.js`），按 `--skip-l0l1` 控制是否跳过 AJV 步骤。

## 3. L4 禁用词清单（示例，需持续维护）

```
margin, padding, color, background, fontSize, fontWeight,
border, borderRadius, width, height, minWidth, maxWidth,
minHeight, maxHeight, zIndex, boxShadow,
lineHeight, letterSpacing, textAlign
```

任何 `props` 或 `reactions[].fulfill` 中出现以上键名，CI 直接判定失败。该清单必须与 `schemas/node.schema.json` 中 `props.not.anyOf` 声明的字段列表保持一致（见 §1 双轨策略说明）。

## 4. 给 AI 助手生成配置时的建议提示词片段

如果使用 AI 助手辅助生成本协议的 YAML 配置，建议在 prompt 中附带：

> 请严格参照 `01-node-protocol.md` 的 Node 结构和 `03-component-registry.md` 的组件契约生成配置，
> `props` 中不得出现任何 CSS 样式属性，联动表达式必须符合 `02-reaction-expression.md` 的白名单语法，
> 生成后请对照 `schemas/node.schema.json` 自检结构合法性。

## 5. 后端开发者本地校验指南

### 5.1 使用 `ajv-cli`（Node.js）

如果你的机器安装了 Node.js，可在仓库根目录使用统一校验入口：

```bash
# 全链路校验（L0+L1+L2+L3a+L4，需要先 npm install）
npm run validate -- "pages/**/*.yaml"

# 跳过 L0/L1（当 AJV 不可用时）
npm run validate -- "pages/**/*.yaml" --skip-l0l1
```

如需仅校验 L0/L1（JSON Schema 层），也可以用 `ajv-cli`：

```bash
# 全局安装 ajv-cli
npm install -g ajv-cli ajv-formats

# 校验单个页面文件（需显式注册被 $ref 引用的子 schema）
npx ajv validate -s docs/schemas/page.schema.json \
  --allow-union-types --strict=false \
  -r docs/schemas/node.schema.json \
  -r docs/schemas/action.schema.json \
  -r docs/schemas/reaction.schema.json \
  -d my-page.yaml

# 校验目录下所有 yaml 文件
npx ajv validate -s docs/schemas/page.schema.json \
  --allow-union-types --strict=false \
  -r docs/schemas/node.schema.json \
  -r docs/schemas/action.schema.json \
  -r docs/schemas/reaction.schema.json \
  -d "pages/**/*.yaml"
```

`page.schema.json` 通过 `$ref` 依赖 `node.schema.json`、`action.schema.json`、`reaction.schema.json`；
直接调用 `ajv-cli` 时，需要用 `-r` 显式注册这些子 schema。上面的参数与仓库内 [`scripts/validate-all.js`](../scripts/validate-all.js) 保持一致。

### 5.2 使用 VS Code YAML Schema 关联（推荐）

1. 安装 VS Code 扩展 [`YAML` (redhat.vscode-yaml)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)。
2. 在项目根目录创建 `.vscode/settings.json`：

```json
{
  "yaml.schemas": {
    "docs/schemas/page.schema.json": ["pages/**/*.yaml", "pages/**/*.yml"]
  }
}
```

3. 此后编辑 `pages/` 目录下的 YAML 文件时，VS Code 自动提供：
   - 字段自动补全（根据 Schema 定义）
   - 实时校验（红色波浪线标出不合法的字段）
   - 鼠标悬停查看字段说明

### 5.3 Windows PowerShell 用户

若使用 Windows PowerShell，可配合 `Get-ChildItem` 批量校验：

```powershell
Get-ChildItem -Path pages -Filter *.yaml -Recurse | ForEach-Object {
  npx ajv validate -s docs/schemas/page.schema.json --allow-union-types --strict=false -r docs/schemas/node.schema.json -r docs/schemas/action.schema.json -r docs/schemas/reaction.schema.json -d $_.FullName
}
```

### 5.4 CI 集成

在 CI 流程中挂载校验步骤（以 GitHub Actions 为例）：

```yaml
- name: Validate Schema-UI YAML
  run: |
    npm install -g ajv-cli ajv-formats
    npx ajv validate -s docs/schemas/page.schema.json --allow-union-types --strict=false -r docs/schemas/node.schema.json -r docs/schemas/action.schema.json -r docs/schemas/reaction.schema.json -d "pages/**/*.yaml"
```

> 也可以直接复用仓库自带的 `npm run validate -- "pages/**/*.yaml"`，其内部已按同样方式注册 `$ref` 子 schema。

## 6. 自检清单（人工 Review 用）

- [ ] 每个 Node 是否都有必填的 `type`？
- [ ] `props` 中是否混入了 CSS 属性？
- [ ] `data.source` 是否为三选一之一，且对应字段齐全？
- [ ] `reactions[].dependencies` 是否覆盖了 `when` 中用到的所有 `$deps.*` 变量？
- [ ] 表格 `columns`/`actions` 中的表达式是否正确地声明了 `scope: form` 或 `scope: row`？
- [ ] `scope: row` 下 `actions` 中是否误用了 `$self`（`$self` 仅 `columns` 中可用，`actions` 中应使用 `$row`）？
- [ ] `scope: row` 的 `fulfill`/`otherwise` 中是否误用了 `required`/`value`（仅允许 `visible`/`disabled`）？
- [ ] `permissions.*` 表达式中是否混入了 `$deps.*`（只应使用 `$context.*`）？
- [ ] 非表单节点的 `visibleWhen` 中是否误用了 `$deps.*`？
- [ ] `data.source: api` 的节点是否在 `data.params` 中正确声明了请求参数？
- [ ] `data.responseMapping` 是否与 `params` 同级，且未误放入 `data.params`？
- [ ] `data.responseMapping.list` / `total` 是否为合法点路径，且映射结果类型符合组件预期？
- [ ] `table` / `chart` 这类数组消费组件声明 `data.responseMapping` 时，是否提供了 `responseMapping.list`？
- [ ] `table.props.pagination.mode: server` 时，是否提供了 `responseMapping.total`？
- [ ] 表格类 Node 的 `columns[].field` 是否与后端响应体字段名一致？
- [ ] 使用 `table.props.actions[].actionRef` 时，是否声明了 `actions.row.request` 能力，并提供了合法的 `requestMapping`？
