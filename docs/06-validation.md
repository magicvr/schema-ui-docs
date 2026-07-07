---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.2
---

# 校验规则与工具链

## 1. 校验层级

| 层级 | 工具 | 时机 | 校验内容 |
|---|---|---|---|
| L0 页面结构校验 | [`schemas/page.schema.json`](./schemas/page.schema.json) | 后端 CI / 提交前 | 顶层文档结构（`meta` + `datasources` + `body` + `actions`）合法性 |
| L1 Node 结构校验 | [`schemas/node.schema.json`](./schemas/node.schema.json) | 后端 CI / 提交前 | Node 结构是否合法（字段名、类型） |
| L2 组件契约校验 | [`schemas/component-registry.json`](./schemas/component-registry.json) | 后端 CI | `type` 是否存在、`props` 是否符合该组件的字段契约 |
| L3 联动表达式校验 | [`schemas/reaction.schema.json`](./schemas/reaction.schema.json) + 白名单解析器 | 前端 Renderer 运行时 | `when` 表达式语法、变量是否在 `dependencies` 声明范围内 |
| L4 语义禁用词校验 | 自定义 lint 脚本 | CI | `props`/`fulfill` 中是否混入禁止的 CSS 属性名（如 `color`/`margin`），可覆盖 Schema 表达力之外的场景（如深层嵌套结构） |

> **v0.2 变更（A1，双轨策略）：** L1（`node.schema.json` 的 `not`+`anyOf`）与 L4（lint 脚本）是**两层独立防线**，而非同一规则的重复实现：
> - **L1** 通过 JSON Schema 的 `not: { anyOf: [...] }` 逐一禁止每个 CSS 属性名单独出现在 `props` 中，随 CI 自动挂载生效，无需额外配置，是**自动生效的基础防线**。
> - **L4** 是更细致的深度补充，可覆盖 Schema 表达力之外的场景（如嵌套对象内部、`reactions[].fulfill` 中的禁用词），但需要团队额外接入 lint 流程才会生效。
> - **同步要求：** L1 的 `anyOf` 清单与 L4 的禁用词清单必须保持一致，任一方新增禁用词时需同步更新另一方，避免两层防线出现漂移。

## 2. CI 建议流程

```
提交 YAML
  → L0 [`page.schema.json`](./schemas/page.schema.json) 顶层文档结构校验
  → L1 [`node.schema.json`](./schemas/node.schema.json) Node 结构校验
  → L2 组件契约校验（type/props 合法性）
  → L4 禁用词扫描（防止 CSS 属性混入）
  → 通过后允许合并
  ↓
运行时（前端）
  → L3 联动表达式沙箱解析（防止表达式注入）
```

## 3. L4 禁用词清单（示例，需持续维护）

```
margin, padding, color, background, fontSize, fontWeight,
border, borderRadius, width, height, zIndex, boxShadow,
lineHeight, letterSpacing, textAlign
```

任何 `props` 或 `reactions[].fulfill` 中出现以上键名，CI 直接判定失败。该清单必须与 `schemas/node.schema.json` 中 `props.not.anyOf` 声明的字段列表保持一致（见 §1 双轨策略说明）。

## 4. 给 AI 助手生成配置时的建议提示词片段

如果使用 AI 助手辅助生成本协议的 YAML 配置，建议在 prompt 中附带：

> 请严格参照 `01-node-protocol.md` 的 Node 结构和 `03-component-registry.md` 的组件契约生成配置，
> `props` 中不得出现任何 CSS 样式属性，联动表达式必须符合 `02-reaction-expression.md` 的白名单语法，
> 生成后请对照 `schemas/node.schema.json` 自检结构合法性。

## 5. 自检清单（人工 Review 用）

- [ ] 每个 Node 是否都有必填的 `type`？
- [ ] `props` 中是否混入了 CSS 属性？
- [ ] `data.source` 是否为三选一之一，且对应字段齐全？
- [ ] `reactions[].dependencies` 是否覆盖了 `when` 中用到的所有 `$deps.*` 变量？
- [ ] 表格类 Node 的 `columns[].field` 是否与后端响应体字段名一致？
