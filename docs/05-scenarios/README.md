# 场景示例索引

本目录包含 Schema-UI 协议的端到端配置示例，演示组件组合使用方式。

## 文件列表

| 文件 | 对应组件 | 说明 | 涉及协议特性 |
|---|---|---|---|
| [`grid-dashboard.md`](./grid-dashboard.md) | `grid` / `section` / `statCard` / `chart` | 两列网格看板，含统计卡片与图表 | `datasources` 预声明、`data.source: ref`、`valueField`、布局 |
| [`data-table.md`](./data-table.md) | `table` | 数据表格，自动分页与格式化 | 分页契约、列格式（`tag`/`currency`/`datetime`）、`visibleField` 行级显隐 |
| [`form-with-reactions.md`](./form-with-reactions.md) | `form` / `input` / `select` / `inputNumber` | 表单与基础字段联动 | `reactions` 联动表达式、`onSuccess`/`onError`、`actions` 契约 |

## 阅读顺序

建议按以下顺序阅读，难度递增：

1. **`form-with-reactions.md`** — 表单 + 联动，最常用的基础场景
2. **`data-table.md`** — 数据表格，展示分页与格式化
3. **`grid-dashboard.md`** — 组合布局，展示多组件协同与数据预声明

## 相关文档

- 组件注册表：[`03-component-registry.md`](../03-component-registry.md)
- 联动表达式：[`02-reaction-expression.md`](../02-reaction-expression.md)
- 数据源契约：[`04-datasource-contract.md`](../04-datasource-contract.md)
- 动作契约：[`07-actions-contract.md`](../07-actions-contract.md)
