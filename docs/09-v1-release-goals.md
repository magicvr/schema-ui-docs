---
status: stable
owner: 前后端架构组
last_updated: 2026-07-11
applies_to: schema-ui-protocol v1.0
---

# v1.0 发布目标与门禁

本文档跟踪 `v0.3.0-rc.1` 到 `v1.0.0` 的收敛工作。RC 已冻结前后端 MVP 的组件与业务能力范围；完成本文件全部门禁前，不发布 `v1.0.0`。

缺口审视、分阶段计划与原始发布证据保留在仓库历史审计 0055 中；它们不进入协议制品，本文件保留稳定的发布结论。

## 1. RC 范围冻结

RC 期间只接受以下变更：

- 消除会导致两个独立实现产生不同结果的协议歧义；
- 修复文档、Schema、组件 DSL、校验脚本或 MCP 之间的不一致；
- 增加一致性测试、错误分类和发布自动化；
- 修复安全问题或无法实现的契约。

RC 期间不新增组件类型、Action 类型、表达式能力、变量命名空间或业务场景。确有新增需求时，记录为 `v1.x` 候选 ADR，不并入当前 RC。

## 2. `v1.0.0` 阻断门禁

### G1. 严格版本协商

**目标：** Renderer 对未知协议版本采用 fail-closed 行为，不猜测兼容性。

- [x] 不支持的 MAJOR 版本必须拒绝渲染；
- [x] 同一 MAJOR 下，只有 Renderer 显式声明支持的 MINOR 才可加载；
- [x] 删除“按最接近的已知版本尝试解析”的规则；
- [x] 将缺失 `protocolVersion` 的 `v0.1` 页面限定到显式 legacy adapter；
- [x] 增加支持版本、未知 MINOR、未知 MAJOR、缺失版本的正反例测试。

**验收：** 规范、Renderer 参考行为和一致性测试对每个输入给出唯一的接受或拒绝结果。已由 [ADR-0009](./decisions/0009-strict-version-negotiation.md) 和 [`conformance/fixtures/version-negotiation/cases.json`](../conformance/fixtures/version-negotiation/cases.json) 的 14 个向量关闭。

### G2. Query 线级序列化

**目标：** 前端构造的 URL 与后端解析结果在不同语言和框架中一致。

需要通过 ADR 在以下方案中确定一种：

1. **已选定的 RC 保守方案：** `data.params`、`datasources.*.params`、`optionsSource.params` 和 `requestMapping.query` 的最终值仅允许标量；
2. 扩展方案：保留数组和对象，并规定唯一的键展开、数组、`null`、空值及百分号编码算法。

无论选择哪一种，都必须完成：

- [x] 定义 string / number / boolean / `null` / `undefined` 的编码或省略规则；
- [x] 定义已有 URL query 与协议参数的合并规则；
- [x] 定义重复 key、参数顺序和 UTF-8 百分号编码规则；
- [x] 对 DataRef、远程选项和行级 Action 使用同一套公共算法；
- [x] 提供输入对象到最终 URL 的字节级测试向量。

**验收：** JavaScript 参考实现与至少一个后端语言实现对全部测试向量产生相同结果。已由 [ADR-0010](./decisions/0010-query-serialization.md) 与 16 个共享 fixtures 关闭；JavaScript 和 Python 3.11 reference 均逐字段通过。

### G3. 保留请求参数与冲突优先级

**目标：** 搜索字段、静态 params 与 Renderer 自动分页参数不会互相覆盖出不同结果。

- [x] 明确 `page`、`pageSize`、`sort` 是否为保留参数；
- [x] 明确搜索字段、`data.params`、当前分页/排序状态三者的合并优先级；
- [x] 对冲突配置增加 L2 静态校验，或定义唯一覆盖结果；
- [x] 增加搜索提交、翻页、排序及清空筛选的请求测试向量。

**验收：** 同一页面状态只能构造出一个确定的请求参数集合。已由 [ADR-0011](./decisions/0011-reserved-query-params.md)、L2 保留名拒绝和 5 个表格状态 fixtures 关闭。

### G4. 跨实现一致性套件

**目标：** 将当前“配置是否合法”的测试扩展为“合法配置应如何执行”的框架无关测试。

一致性 fixtures 至少覆盖：

- [x] 页面版本与 capability 协商；
- [x] DataRef 请求构造、参数合并和 `responseMapping`；
- [x] 搜索表单提交、服务端分页和排序；
- [x] 表达式快照、批量提交、冲突及循环保护；
- [x] 普通 Action、行级 Action 和 OutcomeBehavior 时序；
- [x] `400` 字段错误、`401`/`403` hook、`404`、`5xx`、超时和中断；
- [x] 单文件与多文件上传请求和响应取值；
- [x] 六个官方场景的端到端期望结果。

fixtures 应为与框架无关的 JSON/YAML 输入及期望输出，不绑定 React、Vue、Java 或 .NET。至少一个前端 Renderer 和一个 mock/reference backend 必须消费同一套 fixtures。

**验收：** 两端 CI 使用同一 fixtures 全部通过，且没有项目私有解释分支。

## 3. 发布工程门禁

- [x] 将本文件 G1-G4 全部关闭，并为协议决策补充 ADR；
- [x] 全量执行 L0-L4、MCP tests、build、tools smoke 和 Docker smoke；
- [x] 六个官方场景通过配置校验和跨实现一致性测试；
- [x] 将 `meta.protocolVersion`、Schema 描述、示例和 Renderer 支持版本统一为 `"1.0"`；
- [x] 根包、MCP 包、lockfile、Docker tag 与文档版本统一为 `1.0.0`；
- [x] 发布 `0.2` / `0.3` 到 `1.0` 的迁移说明；
- [x] 从 CHANGELOG 清空待发布内容，记录不可变 Git tag `v1.0.0` 与 commit `d2f0fc0877dc6550c9fe7e3635b25c7ec72b4ddd`；
- [x] 发布固定 `1.0.0` MCP 镜像并完成从干净环境拉取后的 Docker smoke；CD run `29154389128` 成功，版本与 SHA tag 均解析到 `sha256:190453685beded5872f24336c9b1ca1051960602f7d66d67bad6d42de40f997e`。

## 4. 发布制品完整性（fixture digest）

`npm run release:check` 对 `conformance/fixtures/**` 计算确定性 `fixtureDigest`（路径 + 字节，`sha256:` 前缀），并与脚本内嵌常量 `EXPECTED_FIXTURE_DIGEST` **硬断言**。digest 不匹配时命令失败（非仅打印），避免错误发布证据随 CI 绿灯残留。

- 有意变更 fixtures 时：在同一 commit 中更新 fixtures 与 `scripts/release-check.js` 中的 `EXPECTED_FIXTURE_DIGEST`。
- 失败用例：改任一 fixture 字节但不更新期望 digest → `release:check` 以 assertion 退出非 0。
- v1.0.0 tag 树（修正后的历史证据）对应 `sha256:fa480baf15bab7c3f05b9c505298e574754e5d86a199519c9866d2982631175c`；后续审计 0056 起因 fixture 内容修订会滚动到新 digest。

## 5. `1.x` 版本纪律

`v1.0.0` 发布后采用以下约束：

| 变更 | 版本级别 |
|---|---|
| 纯文字勘误，不改变合法性或运行结果 | PATCH |
| 新增可选组件、字段、能力或行为 | MINOR |
| 新增必填字段、收紧既有合法输入、改变默认值或执行结果 | MAJOR |

这是 v1.0 发布时采用的同版本策略。自 v2.0 的协议核心化改造起，核心规范、Schema、组件 DSL 和测试 fixtures 作为协议制品原子发布；校验器与 MCP 使用独立版本并声明兼容协议。PATCH 仍不得让此前合法配置变为非法，也不得改变同一输入的请求或渲染结果。

## 6. 完成定义

只有同时满足以下条件，才可将 RC 提升为 `v1.0.0`：

1. G1-G4 和发布工程门禁全部完成；
2. 前端 Renderer 与参考后端基于同一套 fixtures 验证通过；
3. RC 冻结期间没有未决的互操作歧义或未发布修订；
4. 版本 tag、构建产物、文档和机器契约可由 commit SHA 完整复现。
