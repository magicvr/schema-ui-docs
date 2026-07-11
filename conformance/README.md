# Schema-UI 跨实现一致性套件

本目录保存框架无关的协议输入与期望输出，以及用于验证规范算法的 JavaScript 参考实现。fixtures 是协议发布制品的一部分，不绑定 React、Vue、Java 或 .NET。

## 当前覆盖

| 分类 | Fixtures | Reference | 命令 |
|---|---|---|---|
| 严格版本与 capability 协商 | `fixtures/version-negotiation/cases.json` | `reference-js/version-negotiation.js` | `npm run test:conformance:version` |
| Query 字节级序列化 | `fixtures/query-serialization/cases.json` | `reference-js/query-serialization.js`、`reference-python/query_serialization.py` | `npm run test:conformance:query`、`npm run test:conformance:query:python` |

## 消费规则

- 前端 Renderer、JavaScript reference 和后端实现必须直接消费同一版本的 fixture 文件；
- 独立仓库通过 commit SHA 固定并下载本目录制品，不复制后维护私有期望结果；
- 每个消费者必须逐字段比较实际输出和 `expected`；
- 不允许按实现添加 skip、allowlist 或改写期望；
- fixture 语义变更必须同步协议版本、ADR、CHANGELOG 和所有消费者。

## 目录约定

```text
conformance/
  fixtures/       # 框架无关 JSON 输入与期望输出
  reference-js/   # JavaScript 参考算法，不包含 UI 框架代码
  runner/         # 本仓库可执行验证入口
```

版本协商规则见 `docs/decisions/0009-strict-version-negotiation.md` 与 `docs/08-renderer-spec.md` §3；query 规则见 `docs/decisions/0010-query-serialization.md` 与 `docs/04-datasource-contract.md` §3.1.1。