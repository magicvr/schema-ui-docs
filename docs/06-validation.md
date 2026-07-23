---
status: stable
owner: 前端架构组
last_updated: 2026-07-24
applies_to: schema-ui-protocol v2.4
---

# 校验规则与工具链

## 1. 校验层级

| 层级 | 工具 | 时机 | 校验内容 |
|---|---|---|---|
| L0 页面结构校验 | [`schemas/page.schema.json`](./schemas/page.schema.json) | 后端 CI / 提交前 | 顶层文档结构（`meta` + `datasources` + `body` + `actions`）合法性；校验 `meta.protocolVersion` 为 MAJOR.MINOR 格式；`datasources.*.params` 只允许非空 key 与 query 标量 |
| L1 Node 结构校验 | [`schemas/node.schema.json`](./schemas/node.schema.json) | 后端 CI / 提交前 | Node 结构是否合法（字段名、类型）；`data.params` 只允许非空 key 与 query 标量。L1 只能校验 `data.responseMapping` 的键名、点路径格式和最小字段数，不能单独判断列表类接口必须声明 `list`、服务端分页表格必须声明 `total` 等依赖组件类型和 props 的语义条件 |
| L2 组件契约校验 | [`schemas/component-registry.json`](./schemas/component-registry.json) + 辅助实现 `scripts/validate-l2-components.js` | 后端 CI | `type` 是否存在、`props` 是否符合该组件的字段契约；同时补充依赖组件语义的校验，如 `source: api` / `source: ref` 生效 `responseMapping`（本地优先，否则继承）条件必填、PATCH 级能力声明、Action/数据引用完整性、RowAction URL 模板和 `requestMapping` 规则；搜索 form 的 targetTable 必须最终解析到 API 数据源，search 模式忽略 submitAction，并拒绝 `data.params`、`datasources.*.params` 或搜索字段使用 Renderer 保留名 `page` / `pageSize` / `sort`；upload actionRef 模式禁止组件重复声明上传约束；dateRangePicker reactions 禁止 value 写入。拒绝 `data.params.responseMapping` 与 `datasources.*.params.responseMapping`（`responseMapping` 不属于请求参数，ADR-0005 D1）。对组件 DSL 内 `$ref` 到完整 Node、`VisibleWhen` / `Reaction` / `Permissions` 的字段，L2 必须执行等价结构校验和 Node 递归，包括 `tabs.items[].content` 必须为普通对象、`when` / `fulfill` 必填、额外字段拒绝，以及 `scope: row` 与表格 `columns[]`/`actions[]` 上（任意 scope）的 `fulfill` / `otherwise` 仅允许 `visible` / `disabled`。固定协议结构的嵌套对象（如 `tabs.items[]`、`pagination`、`select.options[]`）必须通过 `additionalProperties: false` 拒绝字段表之外的属性；固定 select 选项的 `label` / `labelKey` 至少提供一个；`tagMap` 等业务字典仅开放动态映射键，映射项本身仍封闭。L2 还按 Node 树位置执行 `visibleWhen.dependencies` 条件必填：表单上下文必须显式声明（无字段依赖时写 `[]`），非表单上下文可省略。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node。该文件是自定义 DSL，校验器必须按 `03-component-registry.md` 的关键字白名单处理字段表、组合约束、有限数、数值 `minimum` 和受控 `$ref`，不能只读取 props 字段表，也不能直接当作标准 JSON Schema 交给 AJV |
| L3a 表达式静态校验 | [`schemas/reaction.schema.json`](./schemas/reaction.schema.json) + 辅助实现 `scripts/validate-l3a-expressions.js` | Renderer 加载页面配置时 / CI 可选前置 | 表达式语法合法性、变量是否在 `dependencies` 声明范围内、作用域规则（`$deps`/`$row`/`$self` 等）静态检查；`contains` 右操作数仅允许字符串、数字、布尔或 `null` 字面量，拒绝变量和分组表达式；`scope: row` 仅允许表格 columns/actions 的表达式声明，且 `$row.*` 须将 `$row.` 之后的完整点路径（无 `$row.` 前缀，如 `canRefund` / `user.id` / `__index`）在 `dependencies` 中精确声明；非表单 `visibleWhen` 仅允许 `$context.user.*` / `$context.features.*`；表单 `visibleWhen` 仅允许 `$deps.*` 与 `$context.user.*` / `$context.features.*`（禁 `$self`/`$row`）；表格 `actions` 任意 scope 禁 `$self`；`dateRangePicker` 自身 reactions 仅额外允许 `$self.start` / `$self.end`；v0.2 全面拒绝 `$parentRow.*`；拒绝空 `when`、畸形变量路径和链式比较表达式。同时检查 `permissions.*` 仅使用 `$context.user.*` / `$context.features.*`；在 L0/L1/L2 已保证 params 为标量后，扫描 `data.params`、`select.props.optionsSource.params`、`datasources.*.params` 的字符串值，要求变量只能是完整单个 `$deps.*`（禁止模板拼接），且 `$deps.*` 仅出现在表单上下文，不允许 `$row.*` / `$context.*` 等变量。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node |
| L3b 表达式运行时求值 | Renderer 表达式引擎 | 交互/数据变化时 | 仅在已通过 L3a 校验的表达式上执行实际求值 |
| L4 语义禁用词校验 | 辅助实现 `scripts/lint-l4-banned-props.js` | CI | `props`/`fulfill` 中是否混入禁止的 CSS 属性名（如 `color`/`margin`），可覆盖 Schema 表达力之外的场景（如深层嵌套结构）。扫描必须区分协议字段、开放业务字典和不透明业务值：`tagMap` 的映射键以及 DataRef/optionsSource params、RowAction requestMapping 的开放业务键不按 CSS 名称判定；`select.options[].value` 的内部载荷完全不解释；封闭协议对象和 tagMap 映射项内部仍继续扫描。校验遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node。该辅助实现从 `node.schema.json` 派生禁用字段，不拥有独立规则。 |

> **v0.2 变更（A1，双轨策略）：** L1（`node.schema.json` 的 `not`+`anyOf`）与 L4（lint 脚本）是**两层独立防线**，但只使用一份协议字段清单：
> - **L1** 通过 JSON Schema 的 `not: { anyOf: [...] }` 逐一禁止每个 CSS 属性名单独出现在 `props` 中，随 CI 自动挂载生效，无需额外配置，是**自动生效的基础防线**。
> - **L4** 是更细致的深度补充，可覆盖 Schema 表达力之外的场景（如嵌套对象内部、`reactions[].fulfill` 中的禁用词），但需要团队额外接入 lint 流程才会生效。
> - **单一来源：** L4 在运行时直接读取 `node.schema.json` 的 `props.not.anyOf`，不得在脚本中复制禁用词清单。

> **v0.2.4 变更（`responseMapping` 条件必填）：** `schemas/node.schema.json` 只能表达 `responseMapping` 的结构下限，不能仅凭 `DataRef` 判断组件消费数据的语义。校验器必须在 L2、L4 或人工 review 中结合组件类型和 `props` 补充检查：`table` / `chart` 这类数组消费组件在 `source: api` 或 `source: ref` 的生效 `responseMapping` 时必须提供 `list`；`table.props.pagination.mode: server` 时必须提供 `total`。生效映射解析规则：节点本地 `data.responseMapping` 优先，否则当 `data.source: ref` 时继承 `datasources[data.ref].responseMapping`；无任何映射时不强制（沿用默认字段名语义）。这两条规则与 `04-datasource-contract.md` §4.1.1 和 ADR-0005 保持一致。

> **v0.2.7 变更（行级后端请求，0039 修订）：** 使用 `table.props.actions[].actionRef` 指向 `type: request` 时，页面必须声明 `meta.requiredCapabilities: [actions.row.request]`。L2 校验器还应检查 `actionRef` 是否存在、是否同时声明非空 `requestMapping`、path 与 URL `{param}` 对齐、映射值只使用字面量或单个 `$row.*`。`$parentRow.*` 静态拒绝。

> **Admin 生命周期 P0（ADR-0020 / 0021）：** `actionButton` / `table.toolbar` → `actions.page.trigger`；行级 `navigate` + `navigateMapping` → `actions.row.navigate`；`form.recordSource` → `form.record.load`（`method` 必填 GET，`responseMapping` 必填非空，search 模式禁止）。页面级 Trigger 的 request 禁止 GET；navigate 与 request 的 url 均不得含未绑定 `{name}`（L2 / V283）。

> **审计 0062 收敛：** L3a 遍历 `table.props.toolbar[]` 的 `visibleWhen` / `permissions`（仅 `$context.*`）；L2 在 `batchMapping` 时要求同 table `selection.mode: multiple`；request-construction 对 path 占位符与 mapping 键 fail-closed，并覆盖 page Trigger navigate/modal/confirm。

> **审计 0064 收敛：** L2 强制字段集→`protocolVersion` 下限（2.1 字段 ≥ `"2.1"`；2.2 字段 ≥ `"2.2"`，`ALLOW_22_FIELDS_ON_21=false`）；page Trigger navigate 模板与 request 对称静态拒绝。

> **v2.3 / ADR-0023 权限继承：** L1 接受封闭的 Node `permissionCascade: { keys: [edit|delete] }` 形状；组件 DSL 只在 RowAction、toolbar Trigger 和 `actionButton.props` 接受 `permissionIntent`。L2 必须 fail-closed：cascade 仅能挂在 `section` / `grid` / `form` / `tabs` / `table`，`keys` 非空去重且每项有同 Node 的 `permissions.<key>` string 来源；intent 仅为 `edit` / `delete`，columns、顶层 actions、form submit 与其它挂载点均拒绝。任何 cascade/intent 都要求 `meta.protocolVersion >= "2.3"` 和 `meta.requiredCapabilities` 中的 `permissions.inheritance`。L3a 继续扫描所有实际 `permissions.*` 来源，故继承新增的表达式不获得额外的变量命名空间或语法豁免。

> **v2.4 / ADR-0024 只读详情：** `type: recordView` 要求 `meta.protocolVersion >= "2.4"` 与 `record.view.load`（权威字段纪律亦见 `01` `meta.protocolVersion`；双重门控两端均须出现）。L2 校验 `recordSource`（与 form 同构：method 必填 GET、responseMapping 非空、path 占位对齐）及 `fields[]`（非空、key 唯一且 ⊆ responseMapping、`format: tag` 时 tagMap 必填）。**`fields[].key ⊆ responseMapping` 为跨字段约束，L0/L1 JSON Schema 无法表达，仅 L2 为权威执行点**（审计 0067 V306）。`$context.route` 可绑定 `recordView.props.recordSource` 的 path/query，仍禁止出现在普通表达式挂载点。双重门控 L2 负例（`2.3`+recordView、`2.4` 缺 capability + recordView）见 `docs/05-scenarios/_samples/audit-0067-*.yaml` 与 MCP `validate_content` 测试（审计 0067 V303）。

> **v0.2.8 变更（引用完整性 & 继承 responseMapping 校验 & params.responseMapping 禁令 & Node id 唯一性 & 行级 requestMapping 模板禁令）：** L2 校验器增加以下规则：
> - `form.props.submitAction` 必须引用顶层 `actions` 中已声明的动作 id；引用 `type: request` 时不得使用 GET，普通表单字段只按 JSON 请求体提交。
> - `upload.props.actionRef` 必须引用顶层 `actions` 中已声明的动作 id，且该动作的 `type` 必须为 `upload`。
> - `data.source: ref` 时，`data.ref` 必须引用顶层 `datasources` 中已声明的 key。
> - `form.mode: search` 时，`form.props.targetTable` 必须在页面 Node 树中存在 `id` 匹配且 `type` 为 `table` 的节点。
> - `source: ref` 节点解析继承的 `datasources.*.responseMapping`，并对生效映射（本地优先，否则继承）执行 `table`/`chart` 的 `list` 条件必填和 `table` 服务端分页的 `total` 条件必填。
> - `source: ref` 指向静态 datasource 时不得声明本地 `responseMapping`；响应映射仅适用于 API 数据源。
> - 拒绝 `data.params.responseMapping` 与 `datasources.*.params.responseMapping`（`responseMapping` 不属于请求参数，ADR-0005 D1）。
> - 以上校验的遍历范围包括 `body`、`tabs.items[].content` 以及 `actions[].type: modal` 的 `content` Node。
> - 校验页面内 Node `id` 唯一性，重复 id 报错并标明首次出现与重复路径。
> - 行级 `requestMapping` 字符串只要包含 `$` 就必须整体匹配合法 `$row.*` 引用，拒绝 `$parentRow.*` 和模板拼接（如 `prefix-$row.id`）。

> **0042 收敛：** L2 进一步要求搜索 `targetTable` 最终解析到 API 数据源；`mode: search` 完全忽略 `submitAction`；`dateRangePicker` reactions 禁止双字段目标不明确的 `value`；upload `actionRef` 模式以 UploadAction 为 `accept/maxSize/multiple` 唯一来源；RowAction URL 中所有花括号必须是合法 `{identifier}`；组件 DSL 的数值 `minimum` 由 L2 执行，upload `maxSize` 不得为负。

> **0044 收敛：** 表格 `columns[]`/`actions[]` 上的 reactions 无论 scope 均禁止 `fulfill.required` / `fulfill.value`；`$row` dependencies 权威规则写入 `02` §8.1；`08` value 冲突规则对齐 ADR-0006 数组顺序后写优先。

## 2. CI 建议流程

```
提交 YAML
  → L0 [`page.schema.json`](./schemas/page.schema.json) 顶层文档结构校验
  → L1 [`node.schema.json`](./schemas/node.schema.json) Node 结构校验
  → L2 组件契约校验（辅助实现 scripts/validate-l2-components.js）
  → L4 禁用词扫描（辅助实现 scripts/lint-l4-banned-props.js）
  → 通过后允许合并
  ↓
加载配置时（Renderer）
  → L3a 表达式静态校验（辅助实现 scripts/validate-l3a-expressions.js）
  ↓
运行时（前端交互/数据变化时）
  → L3b 表达式运行时求值（仅在通过 L3a 的表达式上执行）
```

统一入口：`npm run validate`（或直接 `node scripts/validate-all.js`），按 `--skip-l0l1` 控制是否跳过 L0/L1 步骤。

**L0/L1 单一实现、多入口：** 根辅助 CLI `scripts/validate-all.js` 与 MCP `validation-runner` 共用 `scripts/lib/schema-validator.js` 的 Ajv 装配，并读取同一协议制品中的 Schema。同一非法页面在两侧应报告同一套关键字集合。

统一入口和各分层脚本使用相同退出码：`0` 表示全部通过，`1` 表示输入内容存在协议违规，`2` 表示调用错误（如缺少文件 pattern、glob 无匹配或校验工具未安装）。聚合器只要收到任一分层的调用错误，就必须保留退出码 `2`，不得降级为普通内容违规。

文件 pattern 由统一 helper 解析。在 Windows 上，绝对 glob 可使用反斜杠或正斜杠；进入 AJV、L2、L3a、L4 前会统一规范为正斜杠。直接文件路径不经 glob 改写。仍建议在跨平台 CI 和文档示例中使用正斜杠。

## 3. L4 禁用词来源

完整清单以 [`schemas/node.schema.json`](./schemas/node.schema.json) 的 `props.not.anyOf` 为唯一机器来源。
任何 `props`（含深层嵌套）、`reactions[].fulfill` 或 `reactions[].otherwise` 中出现这些键名，CI 直接判定失败。
L4 还会递归扫描表格 `columns[]` / `actions[]` 等内嵌协议结构，但不能新增 Schema 中不存在的禁用字段。

## 4. 给 AI 助手生成配置时的建议提示词片段

如果使用 AI 助手辅助生成本协议的 YAML 配置，建议在 prompt 中附带：

> 请严格参照 `01-node-protocol.md` 的 Node 结构和 `03-component-registry.md` 的组件契约生成配置，
> `props` 中不得出现任何 CSS 样式属性，联动表达式必须符合 `02-reaction-expression.md` 的白名单语法，
> 生成后请对照 `schemas/node.schema.json` 自检结构合法性。

## 5. 后端开发者本地校验指南

### 5.1 使用根 CLI / 进程内 Ajv（Node.js）

如果你的机器安装了 Node.js，可在仓库根目录使用统一校验入口（依赖 `ajv`，**不**依赖有漏洞的 `ajv-cli` 链）：

```bash
# 全链路校验（L0+L1+L2+L3a+L4，需要先 npm install）
npm run validate -- "pages/**/*.yaml"

# 跳过 L0/L1（仅跑 L2–L4）
npm run validate -- "pages/**/*.yaml" --skip-l0l1
```

L0/L1 由辅助 CLI `scripts/validate-all.js` 在进程内加载 `docs/schemas/page.schema.json` 及 `$ref` 子 schema，并以 `allErrors: true` 收集全部违规；MCP 复用同一装配模块。

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

若使用 Windows PowerShell，可直接调用统一入口：

```powershell
npm run validate -- "pages/**/*.yaml"
```

### 5.4 CI 集成

在 CI 流程中挂载校验步骤（以 GitHub Actions 为例）：

```yaml
- name: Validate Schema-UI YAML
  run: npm run validate -- "pages/**/*.yaml"
```

> 统一入口在进程内注册 `$ref` 子 schema 并以 `allErrors` 收集 L0/L1 违规，与 MCP 工具链一致。

## 6. 自检清单（人工 Review 用）

- [ ] 每个 Node 是否都有必填的 `type`？
- [ ] `props` 中是否混入了 CSS 属性？
- [ ] `data.source` 是否为三选一之一，且对应字段齐全？
- [ ] `reactions[].dependencies` 是否覆盖了 `when` 中用到的所有 `$deps.*` 变量？`scope: row` 下 `$row.*` 是否将 **`$row.` 之后的完整点路径**（无 `$row.` 前缀）写入 `dependencies`？
- [ ] `contains` 的右操作数是否为字符串、数字、布尔或 `null` 字面量，而不是变量或分组表达式？
- [ ] 表格 `columns`/`actions` 中的表达式是否正确地声明了 `scope: form` 或 `scope: row`？`scope: row` 是否**仅**出现在表格列/操作上（普通表单字段不得声明）？
- [ ] 表格 `actions` 的表达式（任意 scope）是否误用了 `$self`（`$self` 仅列级 `scope: row` 可用；`actions` 应使用 `$row` / `$context` / 合法 `$deps`）？
- [ ] 表格 `columns[]`/`actions[]` 上（**任意 scope**）的 `fulfill`/`otherwise` 是否误用了 `required`/`value`（仅允许 `visible`/`disabled`）？
- [ ] 表单上下文的 `visibleWhen` 是否只使用 `$deps.*` / `$context.*`，没有误用 `$self` 或 `$row.*`？
- [ ] `permissions.*` 表达式是否只使用 `$context.user.*` / `$context.features.*`，没有混入 `$deps.*`、`$self`、`$row.*` 或未登记的 `$context` 根命名空间？
- [ ] 非表单节点的 `visibleWhen` 是否只使用 `$context.user.*` / `$context.features.*`，没有误用 `$deps.*`、`$self` 或行上下文？
- [ ] `data.source: api` 的节点是否在 `data.params` 中正确声明了请求参数？
- [ ] `data.responseMapping` 是否与 `params` 同级，且未误放入 `data.params`？
- [ ] `data.responseMapping.list` / `total` 是否为合法点路径，且映射结果类型符合组件预期？
- [ ] `table` / `chart` 这类数组消费组件的生效 `responseMapping`（本地或继承自 `datasources.*`）是否提供了 `list`？
- [ ] `table.props.pagination.mode: server` 时，生效 `responseMapping` 是否提供了 `total`？
- [ ] 表格类 Node 的 `columns[].field` 是否与后端响应体字段名一致？
- [ ] 行级 `actionRef` → request 时是否声明 `actions.row.request` 与合法 `requestMapping`？→ navigate 时是否声明 `actions.row.navigate` 与合法 `navigateMapping`？
- [ ] 使用 `actionButton` / `table.toolbar` 时是否声明 `actions.page.trigger`，且 Trigger 的 request 非 GET、navigate/request url 无未绑定 `{name}`？
- [ ] 使用 `form.recordSource` 时是否声明 `form.record.load`，且 `method: GET` **必填**（缺失与非法 method 分码）、`responseMapping` 非空、非 search 模式？
- [ ] 使用 `table.props.selection` / `requiresSelection` / `batchMapping` 时是否声明 `table.selection` 与/或 `actions.batch.request`，同 table `selection.mode: multiple`，且 `$selection.keys` 仅出现在 `batchMapping.body`？
- [ ] 使用 2.1 字段时 `protocolVersion` 是否 ≥ `"2.1"`；使用 2.2 字段（`selection` / `requiresSelection` / `batchMapping`）时是否为 `"2.2"`（V282）？
- [ ] `form.props.submitAction` 是否引用了顶层 `actions` 中存在的动作 id，且 request action 不是 GET？
- [ ] `upload.props.actionRef` 是否引用了顶层 `actions` 中 `type: upload` 的动作？
- [ ] `data.source: ref` 时，`data.ref` 是否存在于顶层 `datasources`？
- [ ] `form.mode: search` 时，`form.props.targetTable` 是否对应页面 Node 树中 `id` 匹配且 `type: table` 的节点？
