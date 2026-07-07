# Schema-Driven UI 协议文档

配置驱动 UI（Schema-Driven UI）系统的工程化文档，供同事与 AI 助手查阅。

**入口：从 [`docs/00-overview.md`](./docs/00-overview.md) 开始阅读。**

```
docs/
├── 00-overview.md              # 总纲、术语表（第一个要读的文件）
├── 01-node-protocol.md         # 核心协议规范
├── 02-reaction-expression.md   # 联动表达式语法规范
├── 03-component-registry.md    # 组件类型注册表
├── 04-datasource-contract.md   # 数据源/API 契约规范
├── 05-scenarios/                # 可复制的完整场景示例
│   ├── grid-dashboard.md
│   ├── data-table.md
│   └── form-with-reactions.md
├── 06-validation.md            # 校验规则与工具链
├── 07-actions-contract.md      # Action 行为契约（since 0.2）
├── 08-renderer-spec.md         # Renderer 实现规范（since 0.2.1）
├── schemas/                     # 机器可读 JSON Schema
│   ├── page.schema.json
│   ├── node.schema.json
│   ├── reaction.schema.json
│   ├── action.schema.json
│   └── component-registry.json
├── decisions/                   # 架构决策记录（ADR）
│   ├── 0001-why-single-node-tree.md
│   ├── 0002-why-not-two-schema-uischema.md
│   ├── 0003-context-namespace-and-visible-when.md
│   └── 0004-row-level-scope.md
├── audit/                       # 过程性审计与迭代记录（详见 audit/README.md）
│   ├── README.md                # 活跃清单 + 编号规则
│   └── archived/                # 已归档历史审计（详见 archived/README.md）
└── CHANGELOG.md
```
