# 场景示例索引

本目录包含 Schema-UI 协议的端到端配置示例，演示组件组合使用方式。

## 文件列表

| 文件 | 对应组件 | 说明 | 涉及协议特性 |
|---|---|---|---|
| [`grid-dashboard.md`](./grid-dashboard.md) | `grid` / `section` / `statCard` / `chart` | 两列网格看板，含统计卡片与图表 | `datasources` 预声明、`data.source: ref`、`valueField`、布局 |
| [`data-table.md`](./data-table.md) | `table` | 数据表格，自动分页与格式化 | 分页契约、列格式（`tag`/`currency`/`datetime`）、`visibleField` 行级显隐 |
| [`form-with-reactions.md`](./form-with-reactions.md) | `form` / `input` / `select` / `inputNumber` | 表单与基础字段联动 | `reactions` 联动表达式、`onSuccess`/`onError`、`actions` 契约 |
| [`row-backend-actions.md`](./row-backend-actions.md) | `table` + `actions` | 表格行内按钮直接调用后端接口 | `RowAction.actionRef`、`requestMapping`、`actions.row.request`、成功后刷新 |
| [`search-form-table.md`](./search-form-table.md) | `form` + `table` | 搜索表单筛选服务端分页表格 | `mode: search`、`targetTable`、API 数据源合并 query |
| [`form-with-upload.md`](./form-with-upload.md) | `form` / `upload` | 表单内文件上传后随单提交 | `actions.upload`、`actionRef`、UploadAction 约束唯一来源 |
| [`admin-list-edit-lifecycle.md`](./admin-list-edit-lifecycle.md) | `table` + `form` + actions | 工具栏新建、行进编辑、记录加载回填（扩展示例） | `actions.page.trigger`、`actions.row.navigate`、`form.record.load`（ADR-0020/0021） |
| [`admin-list-detail-lifecycle.md`](./admin-list-detail-lifecycle.md) | `table` + `recordView` | 列表行进详情、只读 recordView 加载（扩展示例） | `actions.row.navigate`、`record.view.load`（ADR-0021/0024） |
| [`admin-list-batch.md`](./admin-list-batch.md) | `table` + toolbar batch | 当前页多选与批量 request（扩展示例） | `table.selection`、`actions.batch.request`（ADR-0022） |
| [`permission-inheritance.md`](./permission-inheritance.md) | `section` / `form` / `table` + actions | 容器 edit/delete 继承与显式操作 intent（扩展示例） | `permissionCascade`、`permissionIntent`、`permissions.inheritance`（ADR-0023） |

> `admin-list-edit-lifecycle.md` 为 Admin 生命周期 P0 扩展示例：**已进入** conformance `scenarios` suite（`CONFORMANCE_SCENARIO_PATHS`），**尚未**列入 `OFFICIAL_SCENARIO_PATHS` 六场景 release 门禁清单。  
> `admin-list-batch.md` 为 Phase C 扩展示例：机器可读样例见 `_samples/order-list-batch.yaml`；当前示例按 `2.4` 制品统一声明 `protocolVersion: "2.4"`。
> `permission-inheritance.md` 为 ADR-0023 扩展示例；跨语言可观测规则由 `permissions-inheritance` fixture suite 覆盖。

## 阅读顺序

建议按以下顺序阅读，难度递增：

1. **`form-with-reactions.md`** — 表单 + 联动，最常用的基础场景
2. **`data-table.md`** — 数据表格，展示分页与格式化
3. **`search-form-table.md`** — 搜索表单 + 表格筛选
4. **`form-with-upload.md`** — 上传字段 + 能力声明
5. **`row-backend-actions.md`** — 表格行级后端动作，展示退款/审批/删除类操作
6. **`grid-dashboard.md`** — 组合布局，展示多组件协同与数据预声明
7. **`admin-list-edit-lifecycle.md`** — 完整列表/编辑闭环（需 Renderer 支持新 capability）
8. **`admin-list-detail-lifecycle.md`** — 列表行进详情、只读 `recordView` 加载（ADR-0024）
9. **`admin-list-batch.md`** — 当前页多选与批量 request（ADR-0022）
10. **`permission-inheritance.md`** — 容器权限继承与操作入口意图（ADR-0023）

## 相关文档

- 组件注册表：[`03-component-registry.md`](../03-component-registry.md)
- 联动表达式：[`02-reaction-expression.md`](../02-reaction-expression.md)
- 数据源契约：[`04-datasource-contract.md`](../04-datasource-contract.md)
- 动作契约：[`07-actions-contract.md`](../07-actions-contract.md)
