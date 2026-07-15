# 贡献与协议变更治理

所有变更先遵守 [`PROJECT_CHARTER.md`](./PROJECT_CHARTER.md) 的权威层级和单向依赖。

## 变更分类

每个 PR 必须选择一个主分类：

- **规范语义：** 字段语义、默认值、能力边界或执行结果；
- **机器结构：** JSON Schema、组件注册 DSL；
- **行为契约：** conformance fixture 的输入或 expected；
- **说明材料：** 示例、迁移、CHANGELOG，不改变合法输入或执行结果；
- **辅助工具：** validator、reference、MCP、Docker、CI；
- **过程记录：** audit，仅记录过程，不能承载最终协议结论。

## 协议变更

规范语义、机器结构或行为契约变化必须：

1. 指出规范条款或新增 ADR；
2. 给出 SemVer 判断；
3. 同步受影响的 Schema、fixtures、迁移和 CHANGELOG；
4. 说明前端 Renderer 与后端生产方的影响；
5. 运行 Protocol CI，并提供至少一个前端和一个后端消费者对同一协议制品的验证证据后再发布。

机器投影之间出现冲突时必须停止发布并修复，不能用 validator/reference 当前输出裁决语义。

## 工具变更

辅助工具变更必须引用已有协议需求。validator、reference 和 MCP 不得首先引入新的接受/拒绝规则。

只修改工具时：

- 不修改 `protocol-manifest.json` 的版本；
- `npm run build:protocol` 的 `contentDigest` 应保持不变；
- MCP 版本可独立变化，`schemaUiProtocol` 仅在捆绑新协议制品时更新；
- validator 版本由 `validator/package.json` 独立维护，协议兼容范围必须显式声明；
- 新 MCP 写入、生成、网络或宿主文件访问能力必须另开 ADR，且默认不进入 `protocol.*` 工具集合。

## 审计记录

优先使用 issue、PR review、CI 和 conformance 记录问题。确需创建 `docs/audit` 时，同时最多保留一轮活跃审计；
关闭时必须把有效结论沉淀到规范、ADR、Schema、fixture、迁移或 CHANGELOG，并立即归档。

## 本地门禁

```bash
npm ci
npm run check:links
npm run release:check
npm run verify:protocol-artifact
npm run check:protocol-artifact-links
npm run validate:scenarios
npm run validate:conformance
npm run test:conformance:all
npm ci --prefix mcp
npm run release:check:mcp
npm run release:check:validator
npm --prefix mcp run build
npm --prefix mcp test
npm --prefix mcp run smoke:tools
```
