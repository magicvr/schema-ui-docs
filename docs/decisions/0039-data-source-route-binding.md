---
status: accepted
date: 2026-08-14
applies_to: schema-ui-protocol v2.9
---

# ADR-0039: 数据源 params 的 `$context.route` 整值绑定

## 状态

**Accepted（2026-08-14，审计 0082 A-001 self + A-002 grok 独立复核后）。** 本 ADR 为 P-2 协议增补（下游 `schema-ui-core` 工作区 11 目标 15
GOAL-015 D-002 门禁）：「条目页按类型过滤」要求独立 table 的 dataSource 能把当前页路由 query
（`?dictKey=…`）注入请求参数。随 v2.9.0 MINOR 发布，capability `data.route-binding`。

## 背景

### 业务缺口

数据字典「条目」内页（`/dictionary-entries?dictKey=x`）的表格需要只显示当前类型的条目。
导航携带 dictKey 已由行级 `navigateMapping`（ADR-0021，since 2.1）覆盖；服务端 `dictKey`
过滤参数也已就绪；**唯一缺口是 schema 无法声明「dataSource 请求参数来自当前路由 query」**：

- `data.params` / `optionsSource.params` / `datasources.*.params` 的值仅允许字面量或完整单个
  `$deps.*`（仅表单上下文；`02` §10.7 / 附录 A）；
- `$context.route.query.*` / `$context.route.params.*` 目前**仅**允许出现在
  `form.props.recordSource` / `recordView.props.recordSource` 的 path/query 整值绑定
  （`02` §11.3，ADR-0021 D2 / ADR-0024 D5）；
- DataRef 的 `url` 禁止 `?`（`node.schema.json` url pattern + 下游 `DATASOURCE_URL_PATTERN`
  双重约束），无法把过滤直接写进 URL。

`02` §11.3 原文已预留放开口子：「**默认禁止**出现在普通 `reactions` / `visibleWhen` /
`permissions` / `data.params`（L2/L3a 若遇到应拒绝，**直至后续 ADR 放开**）」——本 ADR 只放开
params 值替换位置，不触碰表达式挂载点。

### 替代方案（均已排除，见 `04` §3.2 与下游 GOAL-015 D-002 §4）

| 方案 | 排除原因 |
|---|---|
| DataRef url 直接写 `?dictKey=` | 协议 url pattern 与实现双重禁止 |
| 前端 `q` 模糊搜索代替精确过滤 | 不精确、可能串类型（下游用户已否） |
| 多级动态路由 `/dictionary/:key/entries` | query 参数足够且向后兼容（D-001 已否）；且路径参数同样无法进入 dataSource params |
| search form 隐藏字段预填 | search 状态只来自用户输入 + 静态 params（ADR-0011 D3），无路由初值机制 |

## 决策

### D1. 声明面（值语法扩展，三处统一）

`data.params`、`select.props.optionsSource.params`、页面级 `datasources.*.params` 的参数值
允许三种形态（与 `02` §10.7 既有语法并列）：

1. 不含 `$` 的标量字面量（不变）；
2. 完整单个 `$deps.<path>`（**仅表单上下文**，不变）；
3. **完整单个 `$context.route.query.<name>` 或 `$context.route.params.<name>`**
   （since 2.9，**任意上下文**，含页面级 `datasources.*.params`）。

点路径约束与 recordSource 绑定同正则：`^\$context\.route\.(query|params)\.[A-Za-z_][A-Za-z0-9_]*$`
——仅一段标识符，不开放深层路径。仍禁止任何模板拼接/前缀后缀（`DATA_PARAMS_VARIABLE` 不变）。

### D2. 求值语义（与 `$deps` tombstone 一致，区别于 recordSource fail-closed）

- 运行时以当前页路由快照（`$context.route`）解析绑定；`query`/`params` 值一律字符串。
- **键缺失或值为 `undefined` 时，该参数作为 tombstone 从最终请求 query 中删除**（ADR-0010：
  不传空字符串、不传字面量 `"null"`），与 `$deps.*` 空值删除规则完全一致（`04` §3.1）。
- **不**复用 recordSource 的 `UNRESOLVED_ROUTE_VALUE` fail-closed：params 是筛选参数而非
  记录身份，缺失 = 不过滤，与「search 表单空字段 → tombstone」语义一致（ADR-0011 D4）；
  页面生产方如需 fail-closed（如"无类型不展示条目"），由业务 API 对缺失过滤参数的响应或
  页面级 `visibleWhen` 自行承担。
- `$context` 未注入（如 navigate 未命中注册表、`09` §6）时，绑定一律按缺失处理 → tombstone。

### D3. 合并顺序

路由绑定值属于 ADR-0011 D2 的**来源 2（数据源静态 params 层）**：最终合并顺序不变
（URL 已有 query < 静态 params < 搜索字段 < Renderer 分页/排序），后来源覆盖前来源，
tombstone 删除同名 key 的规则不变。路由绑定与同 key 字面量/`$deps` 绑定互斥由对象键唯一性
天然保证，无新增冲突规则。

### D4. 门控（L2 双重门控，fail-closed）

页面任一 `data.params` / `optionsSource.params` / `datasources.*.params` 值含路由绑定 ⇒

- `meta.protocolVersion >= "2.9"`（字段集下限，沿审计 0064 / V282 纪律）；
- `meta.requiredCapabilities` 含 **`data.route-binding`**。

capability 登记 `capability-registry.json`：`sinceProtocolVersion: "2.9"`、`dependsOn: []`、
`mandatorySuites: ["request-construction"]`。

### D5. L3a 规则更新

params 值扫描（`validate-l3a-expressions.js` `scanDataParams`）放行完整单个路由绑定：

- `$context.route.query.*` / `$context.route.params.*` → 通过（任意上下文）；
- `$deps.*` → 仍仅表单上下文（`NON_FORM_DATA_PARAMS`）；
- `$context.user.*` / `$context.features.*` / `$row.*` / `$self` / `$parentRow.*` →
  仍拒绝（`DATA_PARAMS_VARIABLE`）；
- 含 `$` 但不完整匹配任何合法整值 → 仍拒绝（`DATA_PARAMS_VARIABLE`）。

### D6. 非目标（本 ADR 不放开的边界）

- `$context.route.path` 整值绑定（params 是 query 参数映射，path 无位置语义；如未来确需
  "当前页路径"类参数，另行 ADR）；
- `reactions` / `visibleWhen` / `permissions` / toolbar 条件中的 `$context.route.*`
  （仍 `FORBIDDEN_CONTEXT_NAMESPACE`，`02` §11.3 L3a 报错语义不变）；
- modal 内容树内的路由注入互操作（沿用 ADR-0021 V280：modal 内 route 注入不是互操作门禁，
  本 ADR 不改变该边界；页面级绑定在整页快照下互操作，modal 内推荐字面量）；
- 不改 DataRef url 模板/`?` 禁令；不新增 `type: hidden` 之类字段。

### D7. 安全边界

路由绑定值只是请求筛选参数，**不是权限边界**：`$context` 仍是只读渲染快照（ADR-0003 D4），
业务 API 实现方必须对每个接口独立鉴权（如 dictKey 过滤不构成越权防护）。

## 后果

**正面：**

- 独立 table / chart / statCard 的 dataSource 可声明式读取当前页 query/params 过滤，
  覆盖「列表 → 内页 → 按上下文过滤」的通用模式（下游 GOAL-015 核心需求）；
- 复用 ADR-0010 序列化与 tombstone 语义，与 `$deps` 行为完全一致，无新状态机；
- 语法面最小：只扩值语法，不新增组件 props、不改 DataRef 结构。

**负面 / 取舍：**

- 新增 capability 与版本下限门控，消费方需随 2.9 协商；
- tombstone（缺失即不过滤）对"必须过滤"场景是软约束——由页面生产方与业务 API 契约承担，
  协议不提供强制过滤的声明（保持最小面）。

## 验收

- `02` §2 变量表 / §11.3 / §10.7、`04` §3.1 / §3.2 / §9、`06` L3a 行、`08` §2.3 同步；
- `node.schema.json` DataRef.params 与 `page.schema.json` datasources.params 描述同步；
- L3a 扫描放行路由绑定；L2 双重门控（版本 + capability）落盘；
- request-construction fixtures：路由绑定正例（query/params）、tombstone 缺失例、
  字面量混合例；JS/Python 双 reference 一致；
- `capability-registry.json` 登记 `data.route-binding`；version-negotiation 增加 2.9 向量；
- `03` / `08` capability 表登记；迁移 `2.8-to-2.9`、CHANGELOG、release-goals `v2.9.md` 原子交付。
