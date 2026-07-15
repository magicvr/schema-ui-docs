---
status: stable
owner: 前端架构组
last_updated: 2026-07-13
applies_to: schema-ui-protocol v2.0
---

# Renderer（前端渲染器）实现规范

> 本文档定义协议的前端消费端——Renderer——的核心行为约定。
> 后端配置生成方（或 AI 助手）无需深入理解 Renderer 内部实现，
> 但需了解本文档约定的行为以保证前后端对页面加载/渲染行为的预期一致。
>
> 本文档不规定 Renderer 的具体框架选型（React/Vue/Angular），
> 只规定协议层面的行为契约。

---

## 1. 组件注册机制

### 1.1 运行时注册

Renderer 维护一个**全局单例注册表**，将 `type` 字符串映射到对应的组件实现：

```
Renderer.register(type: string, component: ComponentDefinition): void
```

- 核心组件（`grid`/`section`/`tabs`/`statCard`/`chart`/`text`/`table`/`form`/`input`/`inputNumber`/`select` 等）由前端组件库在 Renderer 初始化时自动注册，无需业务方手动操作。
- 业务方可通过 `Renderer.register()` API 扩展自定义组件（如 `businessChart`/`customWidget`）。
- 注册表不允许同名 `type` 重复注册——若已存在同名 `type`，Renderer 应在开发环境输出警告，并以**首次注册**的组件为准（防止加载顺序不当导致覆盖）。

### 1.2 组件契约验证

Renderer 在解析 Node 时，对已知 `type` 的 `props` 做运行时校验（非必须，但建议开发环境开启）：
- 未知 `props` 字段应输出开发警告（`console.warn`），但不应阻断渲染。
- 缺失必填 `props` 字段应输出开发警告，Renderer 使用合理的默认值（若存在）或渲染兜底占位。

> **职责边界：** 本节描述的运行时校验是**兜底防线**，主要用于开发环境告警和生产降级。**CI / 提交前校验**（`06-validation.md §1` L0–L2）应阻断不合法配置的合并，确保进入 Renderer 的配置已通过结构性校验。两者互为补充而非替代。

### 1.3 未知 type 处理

当 Node 的 `type` 不在注册表中时，Renderer 应：
1. 渲染一个明显的"未识别组件"占位（如带红色边框的占位区块，标明 `type` 名称），而不是静默失败或渲染为空白。
2. 在控制台输出 `console.error`，包含完整的 `type` 值和 Node `id`（若有）。

---

## 2. 数据加载协调策略

### 2.1 默认并行加载

当页面中包含多个声明 `data.source: api` 的 Node 时，Renderer **默认并行发起所有独立 API 请求**。

```yaml
# 以下三个 Node 的 API 请求默认并行发起
body:
  type: grid
  props:
    columns: 3
  children:
    - type: statCard
      props: { label: 今日订单数, valueField: total }
      data: { source: api, url: /api/stats/order-count }
    - type: statCard
      props: { label: 今日收入, valueField: amount }
      data: { source: api, url: /api/stats/revenue }
    - type: chart
      props: { chartType: bar, xField: date, yField: sales }
      data: { source: api, url: /api/stats/sales-trend }
```

### 2.1.1 `source: ref` 的请求协调（since 0.2.1）

当 Node 声明 `data.source: ref` 时，Renderer 应读取页面级预声明 `datasources[data.ref]` 中的请求配置：

```yaml
meta:
  pageId: order-stats
  title: 订单统计
  protocolVersion: "2.0"
datasources:
  orderStats:
    source: api
    method: GET
    url: /api/stats/order-count
    params:
      range: 7d
body:
  type: section
  children:
    - type: statCard
      props: { label: 今日订单数, valueField: total }
      data:
        source: ref
        ref: orderStats
```

**解析规则：**
- Renderer 从 `datasources[data.ref]` 读取 `url` / `method` / `params` 等请求配置，作为该 Node 的完整请求描述。
- Node 本地声明与 `datasources` 预声明的关系：
  - `url` / `method` / `params`：**仅使用 `datasources` 中的值**，Node 本地不得重复声明（由 L1 Schema 的 `oneOf` 约束强制）。
  - `responseMapping`：本地 `data.responseMapping` 优先覆盖，否则继承 `datasources[data.ref].responseMapping`（见 §2.5）。
  - 本地 `data.params` 被 L1 Schema 禁止（`source: ref` 不可携带 `params`），所有参数统一在 `datasources` 中声明。

**同 `ref` 的请求协调策略（默认约定）：**
- 同一页面中多个 Node 引用同一个 `data.ref` 时，Renderer **默认共享同一进行中的请求结果**：首个引用触发请求，后续引用等待该请求完成并复用其响应。
- 请求失败时，所有引用该 `ref` 的 Node 各自独立进入节点级错误态（见 §2.2），互不影响。
- 若未来需要"同 ref 各自独立请求"的行为，需通过独立 ADR 设计显式标识。

**加载态 / 错误态：**
- 加载态与 `source: api` 等价：每个消费该 `data` 的 Node 独立维护加载状态。
- 错误归属消费该 `data` 的 Node，错误态行为同 §2.2。
- 完整使用示例见 [05-scenarios/grid-dashboard.md](./05-scenarios/grid-dashboard.md)。

### 2.2 失败隔离（stale-while-render）

单个 Node 的数据加载失败**不应阻断兄弟节点的渲染或页面整体展示**。

- 成功加载的 Node 正常渲染。
- 失败的 Node 展示其 `states.error.fallbackText`（若已配置）或默认错误提示。
- 错误信息通过 `console.error` 输出，并在开发环境中以可视方式标记错误节点。

### 2.3 数据依赖声明

当某个 Node 的 API 参数依赖另一个表单/筛选组件的值时，通过 `$deps.*` 机制声明数据依赖（无需在 `data.url` 中硬编码参数值）。`$deps.*` 在 `data.params` 中的引用**仅在表单上下文有效**——Node 必须是 `form` 的子节点，方可引用同表单中其他字段的当前值：

```yaml
body:
  type: form
  props:
    submitAction: applyOrderFilters
  children:
    - type: select
      props:
        field: orderStatusFilter
        label: 订单状态
        options:
          - { label: 全部, value: '' }
          - { label: 待处理, value: pending }
          - { label: 已完成, value: completed }
    - type: dateRangePicker
      props:
        startField: dateFrom
        endField: dateTo
        label: 下单日期
    - type: table
      props:
        rowKey: orderId
        pagination:
          mode: server
          pageSize: 20
        columns:
          - field: orderId
            label: 订单号
          - field: status
            label: 状态
      data:
        source: api
        url: /api/orders
        method: GET
        params:
          status: $deps.orderStatusFilter
          dateFrom: $deps.dateFrom
          dateTo: $deps.dateTo
```

- Renderer 在 `$deps.*` 值变化时自动重新请求该 Node 的数据。
- 多参数依赖的情形下，Renderer 对同一 Node 的多次参数变化应做**去抖处理**（建议 300ms），避免高频触发 API 请求。
- `$deps.*` 的引用声明在 `data.params` 中的结构与 `reactions` 的依赖机制复用同一套解析器，但**仅做完整单个参数值替换，不做条件判断**；禁止字符串模板拼接。
- **传输位置与序列化规则：** `data.params` 对所有 method 均编码为 URL query，不隐式生成请求体。key 必须非空，最终值只允许 string / finite number / boolean / null；对象和数组静态拒绝。`null` / `undefined` 删除最终 query 中的同名 key。已有 query、排序、UTF-8 与 RFC 3986 编码统一遵循 [04-datasource-contract.md §3.1.1](./04-datasource-contract.md#311-query-字节级序列化) / [ADR-0010](./decisions/0010-query-serialization.md)。
- **作用域边界：** `$deps.*` 在 `data.params` 中的引用仅在表单上下文有效，且必须是完整单个 `$deps.*` 值。非表单上下文（独立 `table`/`chart`）的 `data.params` 中出现 `$deps.*` 时，静态校验直接拒绝，与 `visibleWhen` 的非表单约束一致（详见 [04-datasource-contract.md §3.2](./04-datasource-contract.md#32-dataparams--optionssourceparams-中-deps-的作用域边界)）。

### 2.4 表格搜索、分页与排序状态

服务端分页表格的请求状态由筛选快照、从 1 开始的 `page`、`pageSize` 和可空 `sort` 组成。`page`、`pageSize`、`sort` 是 Renderer 保留 query 名；标准入口必须拒绝静态 params 或搜索字段的同名冲突。

Renderer 按已有 URL query < 静态 params < 搜索字段 < 分页/排序状态调用 ADR-0010 公共序列化器。搜索提交整体替换筛选快照并将 `page` 重置为 `1`；清空筛选清除快照并重置页码；翻页保留筛选和排序；排序变化保留筛选并重置页码。完整规则与可执行向量见 [ADR-0011](./decisions/0011-reserved-query-params.md) 和 [`../conformance/fixtures/search-table/cases.json`](../conformance/fixtures/search-table/cases.json)。

### 2.4.1 加载状态管理

- 每个声明 `data.source: api` 的 Node 应独立维护自己的加载状态。
- 并行加载期间，已加载完成的 Node 立即渲染，不等待尚未完成的 Node。
- 支持 `states.loading.text` 的组件在加载期间展示加载态文案；不支持的组件由 Renderer 提供统一的轻量加载指示（如骨架屏），具体实现由宿主环境决定。

### 2.5 响应字段名映射 `responseMapping`（since 0.2.4）

Renderer 在 API 请求成功后、组件消费数据前，应先应用**生效的 `responseMapping`**。生效映射解析顺序如下：

1. **节点本地 `data.responseMapping` 优先**（若存在直接使用）；
2. **否则当 `data.source: ref` 时，继承 `datasources[data.ref].responseMapping`**；
3. **无任何映射时**沿用协议默认字段名语义（`table` 列表数据读取 `list`，服务端分页总数读取 `total`；`chart` 默认期望响应体为裸数组）。

```yaml
data:
  source: api
  url: /api/orders
  responseMapping:
    list: result.records
    total: result.totalCount
```

```yaml
# source: ref 继承 datasources 上的预声明映射
datasources:
  orders:
    source: api
    url: /api/orders
    responseMapping:
      list: result.items
      total: result.totalCount
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: name
        label: 名称
  data:
    source: ref
    ref: orders
    # 没有本地 responseMapping，生效映射 = datasources.orders.responseMapping
```

- `responseMapping` 与 `params` 同级，只参与响应解析，**不得作为请求参数发送给后端**。继承的映射同样遵守此禁令。
- 映射值是响应 JSON 对象中的点路径字符串，不执行表达式、函数或数组过滤。
- 生效映射存在时，`table` 与 `chart` 这类数组消费组件必须提供 `list`，服务端分页 `table` 还必须提供 `total`。
- 若映射路径不存在或结果类型不符合组件预期，Renderer 应将该 Node 视为数据加载失败，进入节点级错误态；开发环境日志应包含缺失路径、Node `id`（若有）和组件 `type`。

> 继承映射的校验规则详见 [06-validation.md](./06-validation.md#1-校验层级) v0.2.8 变更与 [04-datasource-contract.md §4.1.1](./04-datasource-contract.md#411-响应字段名映射-responsemappingsince-024)。

### 2.6 请求初始化配置（since 0.2.5）

Renderer 初始化时可接收宿主应用提供的请求配置，用于统一处理认证、超时与鉴权失败回调：

```typescript
type RendererRequestConfig = {
  baseURL?: string;
  credentials?: "omit" | "same-origin" | "include";
  requestTimeout?: number;
  requestInterceptor?: (request: RequestInit & { url: string }) => RequestInit & { url: string } | Promise<RequestInit & { url: string }>;
  onAuthFailure?: (status: 401 | 403, context: { url: string; nodeId?: string; actionId?: string }) => void | Promise<void>;
};
```

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `baseURL` | 宿主应用决定 | 相对路径 API 的拼接基准，与 v0.2.1 环境变量 / baseURL 管理约定一致 |
| `credentials` | `same-origin` | 传给 `fetch` 的跨域凭据策略；如需携带跨域 Cookie，宿主应用显式配置为 `include` |
| `requestTimeout` | `10000` | 单次请求超时时间，单位 ms；超时后的节点行为见 [04-datasource-contract.md §6.4](./04-datasource-contract.md#64-网络超时与中断) |
| `requestInterceptor` | 无 | 每次请求发出前调用，可同步或异步返回修改后的请求对象；常用于注入 `Authorization` header |
| `onAuthFailure` | 无 | 收到 `401` / `403` 后调用，供宿主应用刷新 token、跳转登录或记录审计日志 |

`requestInterceptor` 只允许修改请求 URL、header、credentials、body 等传输层信息，不应改写 Node 配置或组件状态。`onAuthFailure` 的返回值不改变协议默认错误态：`401` 节点进入错误态且不展示具体错误文案，`403` 节点渲染"无权限访问"占位（见 [04-datasource-contract.md §5.1](./04-datasource-contract.md#51-401--403-的处理规则)）。

---

## 3. 版本协商规范

### 3.1 Renderer 支持版本宣告

Renderer 在初始化时宣告自身支持的协议版本范围：

```javascript
const renderer = new Renderer({
  supportedVersions: ["2.0"],   // 支持的协议版本列表
  supportedCapabilities: ["actions.upload", "actions.row.request"] // 支持的 PATCH 级执行能力（可选）
})
```

`supportedVersions` 必须是非空、无重复的 MAJOR.MINOR 字符串列表。每个值都表示 Renderer 已完整实现并通过一致性 fixtures 的协议版本；不支持范围表达式或最低兼容版本。

### 3.2 版本匹配规则

| 页面 `protocolVersion` | Renderer 行为 |
|---|---|
| 格式不是 MAJOR.MINOR | 以 `INVALID_PROTOCOL_VERSION` 拒绝渲染 |
| 精确包含在 `supportedVersions` 中 | 继续执行 capability 匹配 |
| 同一 MAJOR 下的未知 MINOR | 以 `UNSUPPORTED_PROTOCOL_VERSION` 拒绝渲染 |
| 未知 MAJOR | 以 `UNSUPPORTED_PROTOCOL_VERSION` 拒绝渲染 |
| 缺失（v0.1 旧文档） | 标准入口以 `MISSING_PROTOCOL_VERSION` 拒绝；仅可在入口前显式调用 legacy adapter |

Renderer 不得按版本大小、距离或列表顺序猜测兼容性。即使页面版本看似低于某个受支持版本，也只有被 `supportedVersions` 精确列出的版本才能加载。完整判定顺序和错误码见 [ADR-0009](./decisions/0009-strict-version-negotiation.md)。

### 3.3 legacy adapter 边界

旧 v0.1 页面缺失 `protocolVersion` 时，宿主应用必须在调用标准 Renderer 前显式选择 adapter。adapter 输出必须包含目标 MAJOR.MINOR，并重新通过目标版本 L0-L4 与标准协商；转换失败时不得把原页面继续交给 Renderer。

Renderer 不自动发现、选择或串联 adapter。本协议只定义 adapter 接入边界，不要求标准 Renderer 内置 v0.1 adapter。

### 3.4 执行能力匹配规则（since 0.2.6）

页面可在 `meta.requiredCapabilities` 中声明所需执行能力。Renderer 初始化时可声明 `supportedCapabilities`，用于判断当前运行时是否具备这些能力。

| 页面 `requiredCapabilities` | Renderer 行为 |
|---|---|
| 为空或缺失 | 仅按 `protocolVersion` 做版本匹配 |
| 全部包含在 `supportedCapabilities` 中 | 继续解析渲染 |
| 存在任一缺失能力 | 拒绝渲染，在页面展示明确错误信息（含缺失能力键） |

能力键由协议或接入方白名单定义。Renderer 不认识的能力键视为不支持，不得静默忽略。当前协议预定义能力键：`actions.upload`、`actions.row.request`。

### 3.5 协商结果与错误信息格式

Renderer 应先产生与一致性 fixtures 相同的结构化协商结果，再由宿主将其转换为界面和日志文案：

```json
{
  "accepted": false,
  "code": "UNSUPPORTED_PROTOCOL_VERSION",
  "pageVersion": "0.4",
  "supportedVersions": ["2.0"],
  "missingCapabilities": []
}
```

当 Renderer 拒绝渲染时，应在页面展示位置和浏览器控制台同时输出明确错误信息，例如：

```
[Schema-UI] 协议版本不匹配：页面版本 "0.4"，Renderer 支持版本 ["0.3"]
[Schema-UI] Renderer 缺少必需能力：页面要求 ["actions.row.request"]，Renderer 支持 []
```

机器可执行输入和期望输出见 [`../conformance/fixtures/version-negotiation/cases.json`](../conformance/fixtures/version-negotiation/cases.json)。

---

## 4. 错误边界策略

### 4.1 节点级错误边界

Renderer 应实现**每个 Node 独立的错误边界**（Error Boundary），确保：

- 单个 Node 渲染/数据加载失败时，**仅该 Node** 降级展示错误状态。
- 兄弟节点和祖先节点不受影响，继续正常渲染。
- 子树的错误不会传播到整棵树。

### 4.2 错误展示

1. 若失败 Node 定义了 `states.error.fallbackText`，优先展示该文案。
2. 若未定义 `states.error`，Renderer 使用默认错误提示（如"渲染失败"图标 + 文案）。
3. 开发环境下，错误边界应输出完整错误堆栈到 `console.error`。
4. 生产环境下，仅展示 fallback UI，不暴露具体错误信息。

### 4.3 错误恢复

Renderer 应提供错误节点的重试机制（如点击错误占位重新加载/渲染），具体交互由宿主环境实现。

---

## 5. 表达式引擎沙箱实现指引

### 5.1 推荐方案

**禁止使用 `eval` 或 `new Function` 执行表达式。** 建议以下方式：

1. **白名单解析器**（推荐）：使用 `expr-eval` 或类似的白名单解析库，只支持 [02-reaction-expression.md §3](./02-reaction-expression.md#3-运算符白名单) 运算符白名单中的运算符和白名单中的变量命名空间。
2. **自研 mini-parser**：手写递归下降解析器，只识别白名单中的运算符和变量前缀（`$deps`/`$self`/`$context`/`$row`）。

### 5.2 最小集成示例（expr-eval）

```javascript
import { Parser } from 'expr-eval';

const parser = new Parser({
  operators: {
    // 仅启用白名单运算符
    comparison: true,   // == != > >= < <=
    logical: true,      // && || !
    // 关闭算术、三元、函数调用等
    concatenate: false,
    conditional: false,
    assignment: false
  }
});

// contains 是协议级二元运算符（a contains b），不是 contains(a, b) 函数。
// 若底层库不原生支持该运算符，应在解析前将其编译为受控的内部比较节点，
// 不应向协议暴露任何函数调用语法。

function evaluateWhen(expression, context, dependencies, options = {}) {
  // 1. 静态扫描：检查表达式中的变量是否在允许范围内
  validateVariables(expression, dependencies, options);

  // 2. 将协议运算符适配到底层解析器能力
  const normalized = compileContainsOperator(expression);

  // 3. 替换变量为实际值。本示例覆盖 form/context 场景；
  // $self / $row 由调用方按表达式位置注入 options，
  // 并必须先通过 02-reaction-expression.md 的变量可见性矩阵校验。
  // form 的 dependencies 写字段名（无 $deps. 前缀）；表达式可访问 $deps.<field>.… 子路径。
  // dependencies 校验取路径首段；值读取沿完整点路径从 context.deps 下钻。
  const prepared = normalized
    .replace(/\$deps\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)/g, (_, path) => {
      const rootField = path.split('.')[0];
      if (!dependencies || !dependencies.includes(rootField)) {
        throw new Error(`未声明的依赖字段: ${rootField}`);
      }
      const val = path.split('.').reduce(
        (acc, segment) => (acc == null ? undefined : acc[segment]),
        context.deps,
      );
      return JSON.stringify(val);
    })
    .replace(/\$context\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)/g, (_, path) => {
      // 仅允许 user / features 根；完整点路径下钻（如 user.roles、features.newDashboard）
      const segments = path.split('.');
      const ns = segments[0];
      if (ns !== 'user' && ns !== 'features') {
        throw new Error(`未知 $context 根命名空间: ${ns}`);
      }
      const val = segments.reduce(
        (acc, segment) => (acc == null ? undefined : acc[segment]),
        context?.context,
      );
      return JSON.stringify(val);
    });

  // 4. 使用沙箱化解析器求值
  return parser.evaluate(prepared);
}
```

### 5.3 表达式调度与批量提交（since 0.2.4）

Renderer 的表达式调度必须遵循稳定快照模型：

1. 每轮求值开始时冻结当前表单字段值、节点状态、`$context` 和行数据上下文。
2. 本轮所有 `permissions.*`、`visibleWhen.when`、`reactions[].when` 都读取该快照。
3. `reactions.fulfill.value` / `otherwise.value` 在本轮只记录待提交写入，不得立即改变同轮其他表达式读取到的值。
4. 本轮结束时批量提交状态变更；若字段值发生实际变化，再安排下一轮求值。
5. Renderer 必须设置循环保护，连续求值轮次超过实现上限（建议 10 轮）时停止求值并进入错误态。

`fulfill.value` / `otherwise.value` 仅作用于声明该 `reactions` 的当前字段，不支持跨字段、跨 Node 写入。同一字段上若有多条 `reactions` 写入 `value`，按该字段 `reactions` **数组顺序**后写优先（与 [02-reaction-expression.md §14.1](./02-reaction-expression.md#141-同一字段的多条-value-写入冲突) / [ADR-0006 D3](./decisions/0006-expression-evaluation-order.md) 一致），不得依赖组件树深度优先遍历顺序；开发环境应输出警告。

### 5.4 安全约束

| 规则 | 说明 |
|---|---|
| 禁止 `eval` / `new Function` | 在任何场景下均不得使用 |
| 禁止访问全局对象 | 表达式引擎不应暴露 `window`/`global`/`globalThis`/`process` 等 |
| 变量名白名单 | 一般表达式允许 `$deps.*` / `$self` / `$context.*` / `$row.*`；`dateRangePicker` 自身 reactions 额外允许 `$self.start` / `$self.end`；v0.2 拒绝 `$parentRow.*`；`permissions.*` 额外受限为仅 `$context.user.*` / `$context.features.*` |
| 运算符白名单 | `==` `!=` `>` `>=` `<` `<=` `contains` `&&` `\|\|` `!` `(` `)` |
| 禁止函数调用 | 不允许任何函数调用；`contains` 是二元运算符而非函数 |

### 5.5 静态校验（L3）

Renderer 在加载页面配置时，应覆盖 [02-reaction-expression.md §10](./02-reaction-expression.md#10-静态校验规则) 与附录 A、以及 [06-validation.md §1](./06-validation.md#1-校验层级) L3a 中列出的当前完整静态校验边界。至少包括：

- 所有 `when` 表达式中的 `$deps.*` 变量必须在对应位置的 `dependencies` 声明中。
- `scope: row` 表达式中禁止 `$deps.*`，`scope: form` 表达式中禁止 `$row.*`。
- v0.2 尚未定义嵌套表格挂载结构，所有 `$parentRow.*` 使用均静态拒绝。
- `permissions.*` 表达式中不能出现 `$deps.*`、`$self`、`$row.*`、`$parentRow.*`，只允许 `$context.user.*` / `$context.features.*`；禁止未登记的 `$context` 根命名空间（如 `$context.tenant.*`）。
- 非表单上下文的 `visibleWhen` 中**仅**允许 `$context.user.*` / `$context.features.*`，不得出现 `$deps.*`、`$self`、`$row.*` 或 `$parentRow.*`。
- 表单上下文的 `visibleWhen` 中只允许 `$deps.*` 与 `$context.user.*` / `$context.features.*`，不得使用 `$self` / `$row.*` / `$parentRow.*`。
- 表格 `actions` 的表达式（**任意** `scope`）禁止 `$self`；表格列 `scope: form` 表达式中也禁止 `$self`。
- `scope: row` **仅**允许挂载在表格 `columns[]` / `actions[]` 的表达式上；普通表单字段 Node 声明 `scope: row` 时静态拒绝（`ROW_SCOPE_MOUNT`）。
- 独立表格（非 `form.children` 上下文）的列/操作在 `scope: form` 下不能使用 `$deps.*`。
- 表格 `columns[]` / `actions[]` 上的 `reactions`（无论 `scope: form` 或 `scope: row`）其 `fulfill` / `otherwise` 仅允许 `visible` / `disabled`，禁止 `required` / `value`。
- `data.params`、`select.props.optionsSource.params` 与页面级 `datasources.*.params` 仅允许非空 key 和 string / finite number / boolean / null 标量，或完整单个 `$deps.*` 值替换（禁止对象、数组和模板拼接）；非表单上下文中的 `$deps.*` 必须静态拒绝，且不得使用 `$row.*` / `$parentRow.*` / `$self` / `$context.*`。
- `contains` 的右操作数仅允许字符串、数字、布尔或 `null` 字面量，拒绝变量与分组表达式（见 [02-reaction-expression.md §10.8](./02-reaction-expression.md#108-contains-右操作数字面量约束)）。

其中，`table.props.columns[]` / `actions[]` 内嵌的 `visibleWhen` / `reactions` / `permissions` 对象属于组件 DSL 内的协议结构，CI 的 L2 校验应先保证其结构合法；Renderer 的 L3a 校验再检查表达式语法、变量声明与作用域隔离。无法通过的配置直接拒绝渲染，并在开发环境给出明确的校验错误信息。

---

## 6. 环境变量 / baseURL 管理

### 6.1 baseURL 约定

- YAML 中 DataRef、Action、上传和导航相关 URL 写**单斜杠相对路径**（如 `/api/orders`）；协议不接受 `http://`、`https://` 或 `//host/path` 形式的页面级 URL。
- Renderer 在初始化时接收 `baseURL` 参数，自动拼接：

```javascript
const renderer = new Renderer({
  baseURL: 'https://api.example.com',  // 不含尾部斜杠
  supportedVersions: ["2.0"]
});
```

- 拼接规则：`${baseURL}${url}`（baseURL 去除尾部 `/`，url 以 `/` 开头）。
- 页面配置中的完整绝对 URL 不属于 v2.0 协议；跨系统跳转或外部资源由宿主预注册能力处理，不通过页面 URL 字段表达。

### 6.2 环境切换

业务方通过在不同环境中传入不同的 `baseURL` 实现环境切换：

| 环境 | baseURL |
|---|---|
| development | `https://dev-api.example.com` |
| staging | `https://staging-api.example.com` |
| production | `https://api.example.com` |

---

## 7. Action 执行策略

普通表单提交时，Renderer 根据 `form.props.submitAction` 读取顶层 Action。若目标为 `type: request`，`bodyMapping` 缺省时全部表单字段按原名组成 JSON；一旦声明，mapping 作为源字段白名单，只发送列出的字段并按 value 重命名。普通表单不得引用 `method: GET` 的 request，配置加载时应由 L2 拒绝。v0.2 不为普通表单隐式生成 query 参数。`POST` / `PUT` / `PATCH` / `DELETE` 按上述 JSON 请求体规则执行。`retryPolicy` 缺省为 `never`；`idempotent` 时一次逻辑调用生成一个 invocation id，并在重试中复用同一个 `Idempotency-Key`，超时/网络失败状态为 `unknown`。

Action 失败时先执行协议级 HTTP 状态处理，再执行不冲突的 `onError`。`401`/`403` 忽略 Action `onError`；`400 + errors` 必须保留字段错误并抑制 navigate/reload/closeModal；toast message 与其他状态的详细优先级见 [07-actions-contract.md §8.1](./07-actions-contract.md#81-onerror-与标准-http-错误处理顺序)。

### 7.1 行级后端请求动作（since 0.2.7）

当 `table.props.actions[]` 声明 `actionRef` 时，Renderer 按以下流程执行：

1. 确认页面已通过 `actions.row.request` 能力匹配；
2. 确认 `actionRef` 指向顶层 `actions` 中的 `type: request` action；
3. 按当前行上下文对 `requestMapping.path` / `query` / `body` 做简单取值替换；
4. 用 `requestMapping.path` 替换 `action.url` 中的 `{name}` 占位符，并对 path segment 做 URL 编码；
5. 将 `requestMapping.query` 交给 ADR-0010 公共 query 序列化器；
6. 对非 `GET` / `DELETE` 请求，将 `requestMapping.body` 序列化为 JSON 请求体；
7. 通过统一请求通道发送请求，继续应用 `baseURL`、`requestInterceptor`、`requestTimeout` 和 `onAuthFailure`；
8. 根据 `onSuccess` / `onError` 执行结果行为。

点击行内按钮时，Renderer 的交互时序必须是：`visibleWhen` 判定 → `permissions` 判定 → `disabled` 状态判定 → 展示 `confirm`（若声明）→ 构造请求 → 发送请求。不可见、无权限或禁用状态下不得展示确认框，也不得构造请求。

`requestMapping.path` / `query` / `body` 都是非空 key 的扁平 key-value map。映射值只允许 string / finite number / boolean / null 或单个 `$row.*` 点路径引用，不调用表达式引擎，也不读取 `$deps.*`、`$context.*` 或 `$parentRow.*`，不支持嵌套对象或数组值。路径占位符取值为 `null` / `undefined` 时，Renderer 应拒绝执行该动作并进入动作级错误处理；query 中的 `null` / `undefined` 按 ADR-0010 删除同名 key；body 字段取值失败时，开发环境应输出包含 action id、RowAction key 和字段路径的错误信息。

`onSuccess.behavior: reload` 在行级动作中表示重新加载触发该动作的表格数据；若该表格使用 `data.source: api`，Renderer 按当前分页、排序、筛选参数重新请求。单个行级动作失败不应影响页面其他节点。

---

## 附录 A：Renderer 初始化参数一览

```javascript
interface RendererOptions extends RendererRequestConfig {
  supportedVersions: string[];               // 支持的协议版本列表
  supportedCapabilities?: string[];          // 支持的 PATCH 级执行能力（默认：[]）
  context?: {                                // $context 注入（见 02-reaction-expression.md §2）
    user?: Record<string, any>;
    features?: Record<string, boolean | string>;
  };
  onError?: (error: RendererError) => void;  // 全局错误回调
}
```

`RendererRequestConfig` 由 §2.6 定义，包含 `baseURL`、`credentials`、`requestTimeout`、`requestInterceptor` 与 `onAuthFailure`。`context` 是实例初始化时的一次性只读快照；宿主需要更新 context 时应销毁并重挂载 Renderer，不提供隐式的实例内响应式更新。
