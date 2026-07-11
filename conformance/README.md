# Schema-UI 跨实现一致性套件

本目录保存框架无关的协议输入与期望输出，以及用于验证规范算法的 JavaScript 参考实现。fixtures 是协议发布制品的一部分，不绑定 React、Vue、Java 或 .NET。

## 当前覆盖

| 分类 | Fixtures | Reference | 命令 |
|---|---|---|---|
| 严格版本与 capability 协商 | `fixtures/version-negotiation/cases.json` | `reference-js/version-negotiation.js` | `npm run test:conformance:version` |
| Query 字节级序列化 | `fixtures/query-serialization/cases.json` | `reference-js/query-serialization.js`、`reference-python/query_serialization.py` | `npm run test:conformance:query`、`npm run test:conformance:query:python` |
| 表格搜索/分页/排序状态 | `fixtures/table-query-state/cases.json` | `reference-js/table-query-state.js` | `npm run test:conformance:table-state` |
| DataRef / 行级 Action 请求构造 | `fixtures/request-construction/cases.json` | `reference-js/request-construction.js`、`reference-python/request_construction.py` | `npm run test:conformance:request`、`npm run test:conformance:request:python` |
| DataRef 响应映射 | `fixtures/response-mapping/cases.json` | `reference-js/response-mapping.js`、`reference-python/response_mapping.py` | `npm run test:conformance:response`、`npm run test:conformance:response:python` |
| 搜索/分页/排序状态 | `fixtures/search-table/cases.json` | `reference-js/table-query-state.js`、`reference-python/table_query_state.py` | `npm run test:conformance:search-table`、`npm run test:conformance:search-table:python` |

版本化 G4 suite 使用 `schemas/fixture-suite.schema.json`，统一以 `fixtureVersion: "1.0"`、suite `category` 和 `cases[]` 封装。运行 `npm run validate:conformance` 会自动发现这些 suite，并检查 Schema、case/suite 分类一致性和 suite 内 id 唯一性。G1-G3 早期 fixtures 暂保留数组格式，其期望语义不因 G4 基础设施迁移而改变。

## 消费规则

- 前端 Renderer、JavaScript reference 和后端实现必须直接消费同一版本的 fixture 文件；
- 独立仓库通过 commit SHA 固定并下载本目录制品，不复制后维护私有期望结果；
- 每个消费者必须逐字段比较实际输出和 `expected`；
- 不允许按实现添加 skip、allowlist 或改写期望；
- fixture 语义变更必须同步协议版本、ADR、CHANGELOG 和所有消费者。

JavaScript 与 Python 当前都是本仓库 reference，用于证明算法可跨语言实现；它们不替代生产 Renderer 或生产后端消费者。G4 只有在两类生产消费者均直接消费同一版本化 fixtures 并回报全绿后才能关闭。

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