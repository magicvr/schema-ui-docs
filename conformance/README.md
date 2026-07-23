# Schema-UI 跨实现一致性套件

本目录保存框架无关的协议输入与期望输出，以及用于验证规范算法的 JavaScript 参考实现。fixtures 是协议发布制品的一部分，不绑定 React、Vue、Java 或 .NET。

## 当前覆盖

| 分类 | Fixtures | Reference | 命令 |
|---|---|---|---|
| 严格版本与 capability 协商 | `fixtures/version-negotiation/cases.json` | `reference-js/version-negotiation.js`、`reference-python/version_negotiation.py` | `npm run test:conformance:version`、`npm run test:conformance:version:python` |
| Query 字节级序列化 | `fixtures/query-serialization/cases.json`（数组格式，白名单） | `reference-js/query-serialization.js`、`reference-python/query_serialization.py` | `npm run test:conformance:query`、`npm run test:conformance:query:python` |
| DataRef / 行级 Action / 行级 navigate / recordSource / 页面 Trigger 请求构造 | `fixtures/request-construction/cases.json` | `reference-js/request-construction.js`、`reference-python/request_construction.py` | `npm run test:conformance:request`、`npm run test:conformance:request:python` |
| DataRef / formRecord 响应映射 | `fixtures/response-mapping/cases.json` | `reference-js/response-mapping.js`、`reference-python/response_mapping.py` | `npm run test:conformance:response`、`npm run test:conformance:response:python` |
| 组件格式输入类型 | `fixtures/component-format/cases.json` | `reference-js/component-format.js`、`reference-python/component_format.py` | `npm run test:conformance:component-format`、`npm run test:conformance:component-format:python` |
| 搜索/分页/排序状态 | `fixtures/search-table/cases.json`（权威源） | `reference-js/table-query-state.js`、`reference-python/table_query_state.py` | `npm run test:conformance:search-table`、`npm run test:conformance:search-table:python`；兼容别名 `npm run test:conformance:table-state`（thin wrapper） |
| Reaction 快照与调度 | `fixtures/reactions/cases.json` | `reference-js/reaction-scheduler.js`、`reference-python/reaction_scheduler.py` | `npm run test:conformance:reactions`、`npm run test:conformance:reactions:python` |
| 请求 generation / latest-wins | `fixtures/request-lifecycle/cases.json` | `reference-js/request-lifecycle.js`、`reference-python/request_lifecycle.py` | `npm run test:conformance:request-lifecycle`、`npm run test:conformance:request-lifecycle:python` |
| 运行时默认值与组件 fallback | `fixtures/runtime-defaults/cases.json` | `reference-js/runtime-defaults.js`、`reference-python/runtime_defaults.py` | `npm run test:conformance:runtime-defaults`、`npm run test:conformance:runtime-defaults:python` |
| static/ref 同步数据 | `fixtures/static-data/cases.json` | `reference-js/static-data.js`、`reference-python/static_data.py` | `npm run test:conformance:static-data`、`npm run test:conformance:static-data:python` |
| Action / OutcomeBehavior / 错误时序 | `fixtures/actions/cases.json` | `reference-js/action-outcome.js`、`reference-python/action_outcome.py` | `npm run test:conformance:actions`、`npm run test:conformance:actions:python` |
| 单文件/多文件上传 | `fixtures/uploads/cases.json` | `reference-js/upload-execution.js`、`reference-python/upload_execution.py` | `npm run test:conformance:uploads`、`npm run test:conformance:uploads:python` |
| 六个官方场景执行 | `fixtures/scenarios/cases.json` | `reference-js/scenario-execution.js`、`reference-python/scenario_execution.py` | `npm run test:conformance:scenarios`、`npm run test:conformance:scenarios:python` |

### `cases[].protocolVersion` 语义（V227）

- **算法类 suite**（request / response / component-format / search-table / reactions / request-lifecycle / runtime-defaults / static-data / actions / uploads / scenarios）：`protocolVersion` 表示**该 case 适用的协议算法版本**（当前版本为 `"2.0"`），不是历史包版本号。消费者可按 `"2.0"` 过滤跑全量互操作向量。
- **version-negotiation suite**：`protocolVersion` 与 `input.pageMeta.protocolVersion` 对齐，表示**被测页面声明的协议版本**；其中大量 `0.3` / 非法版本 case 为协商拒绝与能力检查的历史对照，**故意保留**，不得批量升为 `2.0`。
- `release:check` 与 `validate:conformance` 对非 version-negotiation suite 强制 case.`protocolVersion === "2.0"`。

版本化 G4 suite 使用 `schemas/fixture-suite.schema.json`，统一以 `fixtureVersion: "1.0"`、suite `category` 和 `cases[]` 封装。运行 `npm run validate:conformance` 会校验全部 versioned suite，并对**白名单**数组 fixtures（当前仅 `query-serialization`）检查 id 唯一与非空。已删除与 `search-table` 重复的 `table-query-state` 目录；`test:conformance:table-state` 仅转发到 search-table runner。

## 消费规则

- 前端 Renderer、JavaScript reference 和后端实现必须直接消费同一版本的 fixture 文件；
- 独立仓库固定协议 tag 或 `schema-ui-protocol-<version>.tar.gz` 的 SHA-256，直接消费制品内 fixtures，不复制后维护私有期望结果；
- 每个消费者必须逐字段比较实际输出和 `expected`；
- 不允许按实现添加 skip、allowlist 或改写期望；
- fixture 语义变更必须同步协议版本、ADR、CHANGELOG 和所有消费者。

JavaScript 与 Python 当前都是本仓库 reference，用于证明算法可跨语言实现；它们不替代生产 Renderer 或生产后端消费者。G4 只有在两类生产消费者均直接消费同一版本化 fixtures 并回报全绿后才能关闭。

Reaction reference 的条件求值器实现当前调度 fixtures 所需的单个 `$deps.<path>` 比较子集，覆盖严格 `==`/`!=`、同型大小比较、`contains`、JSON number（含指数）和 Unicode code point 字符串顺序；它用于隔离验证 ADR-0006/0016 的 Snapshot/Evaluate/Commit/Next-tick 与比较语义，不替代 L3a 的完整逻辑组合、语法和作用域校验。

Action suite 将 HTTP 错误、超时、网络异常、主动中断和认证 hook 作为 transport 事件输入，以有序事件输出验证协议级处理先于 `onError`；错误类别不另复制一套相同期望。

官方场景 suite 以组合步骤复用请求、映射、搜索、Action 和上传 reference。JavaScript 与 Python runner 都从白名单内的 Markdown 官方场景读取 metadata，校验 `scenarioPath`、`pageId` 与 `protocolVersion`，再执行相同后端可观测步骤。

## 目录约定

```text
conformance/
  fixtures/       # 框架无关 JSON 输入与期望输出
  schemas/        # 版本化 fixture suite 的 JSON Schema
  reference-js/   # JavaScript 参考算法，不包含 UI 框架代码
  reference-python/ # 后端语言参考算法，不代表生产消费者
  runner/         # 本仓库可执行验证入口
```

版本协商规则见 `docs/decisions/0009-strict-version-negotiation.md` 与 `docs/08-renderer-spec.md` §3；query 字节规则见 `docs/decisions/0010-query-serialization.md`，表格状态优先级见 `docs/decisions/0011-reserved-query-params.md`。
