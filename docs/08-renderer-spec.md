---
status: stable
owner: 前端架构组
last_updated: 2026-07-09
applies_to: schema-ui-protocol v0.2
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
- `$deps.*` 的引用声明在 `data.params` 中的结构与 `reactions` 的依赖机制复用同一套解析器，但**仅做值替换，不做条件判断**。
- **空值省略规则：** 当 `params` 中某个值引用的 `$deps.*` 在运行时为 `null` 或 `undefined` 时，该参数从最终请求的 query/body 中整体省略（与 `select.optionsSource.params` 的空值规则保持一致，详见 [04-datasource-contract.md §3.1](./04-datasource-contract.md#31-dataparams--optionssourceparams-中-deps-的空值省略规则)）。
- **作用域边界：** `$deps.*` 在 `data.params` 中的引用仅在表单上下文有效。非表单上下文（独立 `table`/`chart`）的 `data.params` 中出现 `$deps.*` 时，静态校验直接拒绝，与 `visibleWhen` 的非表单约束一致（详见 [04-datasource-contract.md §3.2](./04-datasource-contract.md#32-dataparams-中-deps-的作用域边界)）。

### 2.4 加载状态管理

- 每个声明 `data.source: api` 的 Node 应独立维护自己的加载状态。
- 并行加载期间，已加载完成的 Node 立即渲染，不等待尚未完成的 Node。
- 支持 `states.loading.text` 的组件在加载期间展示加载态文案；不支持的组件由 Renderer 提供统一的轻量加载指示（如骨架屏），具体实现由宿主环境决定。

### 2.5 响应字段名映射 `responseMapping`（since 0.2.4）

Renderer 在 API 请求成功后、组件消费数据前，应先应用 `data.responseMapping`：

```yaml
data:
  source: api
  url: /api/orders
  responseMapping:
    list: result.records
    total: result.totalCount
```

- `responseMapping` 与 `params` 同级，只参与响应解析，不得作为请求参数发送给后端。
- 映射值是响应 JSON 对象中的点路径字符串，不执行表达式、函数或数组过滤。
- 未声明 `responseMapping` 时，Renderer 按协议默认字段名解析：列表数据读取 `list`，服务端分页总数读取 `total`。
- 若映射路径不存在或结果类型不符合组件预期，Renderer 应将该 Node 视为数据加载失败，进入节点级错误态；开发环境日志应包含缺失路径、Node `id`（若有）和组件 `type`。

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
  supportedVersions: ["0.2"],   // 支持的协议版本列表
  supportedCapabilities: ["actions.upload"], // 支持的 PATCH 级执行能力（可选）
  // 可选：最低兼容版本（低于此版本拒绝渲染）
  minCompatibleVersion: "0.1"
})
```

### 3.2 版本匹配规则

| 页面 `protocolVersion` | Renderer 行为 |
|---|---|
| 在 `supportedVersions` 中 | 按该版本规则正常解析渲染 |
| 低于 `minCompatibleVersion` | 拒绝渲染，在页面展示明确错误信息（含期望版本和实际版本） |
| 不在 `supportedVersions` 中但 >= `minCompatibleVersion` | 尝试按最接近的已知版本解析，输出兼容性警告 |
| 缺失（v0.1 旧文档） | 视为 `"0.1"`，按兼容模式处理 |

### 3.3 执行能力匹配规则（since 0.2.6）

页面可在 `meta.requiredCapabilities` 中声明所需执行能力。Renderer 初始化时可声明 `supportedCapabilities`，用于判断当前运行时是否具备这些能力。

| 页面 `requiredCapabilities` | Renderer 行为 |
|---|---|
| 为空或缺失 | 仅按 `protocolVersion` 做版本匹配 |
| 全部包含在 `supportedCapabilities` 中 | 继续解析渲染 |
| 存在任一缺失能力 | 拒绝渲染，在页面展示明确错误信息（含缺失能力键） |

能力键由协议或接入方白名单定义。Renderer 不认识的能力键视为不支持，不得静默忽略。当前协议预定义能力键：`actions.upload`。

### 3.4 版本或能力不匹配时的错误信息格式

当 Renderer 拒绝渲染时，应在页面展示位置和浏览器控制台同时输出以下信息：

```
[Schema-UI] 协议版本不匹配：页面版本 "0.3"，Renderer 支持版本 ["0.2"]，最小兼容版本 "0.1"
[Schema-UI] Renderer 缺少必需能力：页面要求 ["actions.upload"]，Renderer 支持 []
```

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

1. **白名单解析器**（推荐）：使用 `expr-eval` 或类似的白名单解析库，只支持 §3 运算符白名单中的运算符和白名单中的变量命名空间。
2. **自研 mini-parser**：手写递归下降解析器，只识别白名单中的运算符和变量前缀（`$deps`/`$self`/`$context`/`$row`/`$parentRow`）。

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
  // $self / $row / $parentRow 由调用方按表达式位置注入 options，
  // 并必须先通过 02-reaction-expression.md 的变量可见性矩阵校验。
  const prepared = normalized
    .replace(/\$deps\.(\w+)/g, (_, key) => {
      if (!dependencies || !dependencies.includes(key)) {
        throw new Error(`未声明的依赖字段: ${key}`);
      }
      return JSON.stringify(context.deps[key]);
    })
    .replace(/\$context\.(\w+)\.?(\w+)?/g, (_, ns, key) => {
      const val = key ? context?.context?.[ns]?.[key] : context?.context?.[ns];
      return JSON.stringify(val !== undefined ? val : undefined);
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

同一目标字段出现多处 `value` 写入时，按文档中 Node 的深度优先遍历顺序后写优先；开发环境应输出警告。

### 5.4 安全约束

| 规则 | 说明 |
|---|---|
| 禁止 `eval` / `new Function` | 在任何场景下均不得使用 |
| 禁止访问全局对象 | 表达式引擎不应暴露 `window`/`global`/`globalThis`/`process` 等 |
| 变量名白名单 | 只允许 `$deps.*` / `$self` / `$context.*` / `$row.*` / `$parentRow.*` |
| 运算符白名单 | `==` `!=` `>` `>=` `<` `<=` `contains` `&&` `\|\|` `!` `(` `)` |
| 禁止函数调用 | 不允许任何函数调用；`contains` 是二元运算符而非函数 |

### 5.5 静态校验（L3）

Renderer 在加载页面配置时，应执行以下静态校验（见 [06-validation.md §1](./06-validation.md#1-校验层级) L3）：

- 所有 `when` 表达式中的 `$deps.*` 变量必须在对应位置的 `dependencies` 声明中。
- `permissions.*` 表达式中不能出现 `$deps.*`。
- 非表单上下文的 `visibleWhen` 中不能出现 `$deps.*`。
- 无法通过的配置直接拒绝渲染，并在开发环境给出明确的校验错误信息。

---

## 6. 环境变量 / baseURL 管理

### 6.1 baseURL 约定

- YAML 中 `data.url` 和 `actions[].url` 写**相对路径**（如 `/api/orders`）。
- Renderer 在初始化时接收 `baseURL` 参数，自动拼接：

```javascript
const renderer = new Renderer({
  baseURL: 'https://api.example.com',  // 不含尾部斜杠
  supportedVersions: ["0.2"]
});
```

- 拼接规则：`${baseURL}${url}`（baseURL 去除尾部 `/`，url 以 `/` 开头）。
- 允许 YAML 中写完整绝对 URL（以 `http://` 或 `https://` 开头），此时 Renderer 不拼接 baseURL，直接使用该完整 URL。

### 6.2 环境切换

业务方通过在不同环境中传入不同的 `baseURL` 实现环境切换：

| 环境 | baseURL |
|---|---|
| development | `https://dev-api.example.com` |
| staging | `https://staging-api.example.com` |
| production | `https://api.example.com` |

---

## 附录 A：Renderer 初始化参数一览

```javascript
interface RendererOptions {
  baseURL?: string;                          // API 基础地址（默认：''）
  supportedVersions: string[];               // 支持的协议版本列表
  supportedCapabilities?: string[];          // 支持的 PATCH 级执行能力（默认：[]）
  minCompatibleVersion?: string;             // 最低兼容版本（默认：'0.1'）
  context?: {                                // $context 注入（见 02-reaction-expression.md §2）
    user?: Record<string, any>;
    features?: Record<string, boolean | string>;
  };
  onError?: (error: RendererError) => void;  // 全局错误回调
}
```
