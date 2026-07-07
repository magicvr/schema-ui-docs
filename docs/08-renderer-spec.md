---
status: draft
owner: 前端架构组
date: 2026-07-07
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

当某个 Node 的 API 参数依赖另一个表单/筛选组件的值时，通过 `$deps.*` 机制声明数据依赖（无需在 `data.url` 中硬编码参数值）：

```yaml
type: table
data:
  source: api
  url: /api/orders
  method: GET
  params:
    status: $deps.orderStatusFilter
    dateFrom: $deps.dateRange
```

- Renderer 在 `$deps.*` 值变化时自动重新请求该 Node 的数据。
- 多参数依赖的情形下，Renderer 对同一 Node 的多次参数变化应做**去抖处理**（建议 300ms），避免高频触发 API 请求。
- `$deps.*` 的引用声明在 `data.params` 中的结构与 `reactions` 的依赖机制复用同一套解析器，但**仅做值替换，不做条件判断**。

### 2.4 加载状态管理

- 每个声明 `data.source: api` 的 Node 应独立维护自己的加载状态。
- 并行加载期间，已加载完成的 Node 立即渲染，不等待尚未完成的 Node。
- 支持 `states.loading.text` 的组件在加载期间展示加载态文案；不支持的组件由 Renderer 提供统一的轻量加载指示（如骨架屏），具体实现由宿主环境决定。

---

## 3. 版本协商规范

### 3.1 Renderer 支持版本宣告

Renderer 在初始化时宣告自身支持的协议版本范围：

```javascript
const renderer = new Renderer({
  supportedVersions: ["0.2"],   // 支持的协议版本列表
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

### 3.3 版本不匹配时的错误信息格式

当 Renderer 拒绝渲染时，应在页面展示位置和浏览器控制台同时输出以下信息：

```
[Schema-UI] 协议版本不匹配：页面版本 "0.3"，Renderer 支持版本 ["0.2"]，最小兼容版本 "0.1"
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
    assignment: false,
    // contains 通过自定义函数实现
  }
});

// 注册 contains 运算符
parser.functions.contains = (arr, val) => {
  return Array.isArray(arr) ? arr.includes(val) : false;
};

function evaluateWhen(expression, context, dependencies) {
  // 1. 静态扫描：检查表达式中的变量是否在允许范围内
  validateVariables(expression, dependencies);

  // 2. 替换变量为实际值
  const prepared = expression
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

  // 3. 使用沙箱化解析器求值
  return parser.evaluate(prepared);
}
```

### 5.3 安全约束

| 规则 | 说明 |
|---|---|
| 禁止 `eval` / `new Function` | 在任何场景下均不得使用 |
| 禁止访问全局对象 | 表达式引擎不应暴露 `window`/`global`/`globalThis`/`process` 等 |
| 变量名白名单 | 只允许 `$deps.*` / `$self` / `$context.*` / `$row.*` / `$parentRow.*` |
| 运算符白名单 | `==` `!=` `>` `>=` `<` `<=` `contains` `&&` `\|\|` `!` `(` `)` |
| 禁止函数调用 | 除 `contains` 外不允许任何函数调用 |

### 5.4 静态校验（L3）

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
  minCompatibleVersion?: string;             // 最低兼容版本（默认：'0.1'）
  context?: {                                // $context 注入（见 02-reaction-expression.md §2）
    user?: Record<string, any>;
    features?: Record<string, boolean | string>;
  };
  onError?: (error: RendererError) => void;  // 全局错误回调
}
```
