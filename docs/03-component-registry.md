---
status: living-document
owner: 前端组件库团队
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.2
---

# 组件类型（type）注册表

> 本文档是**活文档**，应随前端组件库的迭代持续更新。
> 建议由 CI 从组件的 TypeScript Props 类型定义自动生成骨架，防止文档与实现漂移。
> 每次新增/修改一个 `type`，必须同步更新本文档 + [`schemas/component-registry.json`](./schemas/component-registry.json)。
>
> **v0.2 变更说明：** 本次更新涉及多处破坏性/新增字段，详见 [audit/0001-2026-07-07-plan.md](./audit/0001-2026-07-07-plan.md)。表格中新增字段标注 `(since 0.2)`。

## 如何阅读本表

每个组件类型包含：`type` 标识、用途、`props` 字段清单、是否支持 `children`、是否支持 `data`、是否支持 `states`（空态/加载态/错误态，见 [01-node-protocol.md §3.7](./01-node-protocol.md#37-states可选since-02)）。

**通用约定（since 0.2）：**
- 任何作为 `grid` 直接子节点的 Node，均可在自身 `props` 中声明 `span`（语义级占栏数），不再要求包一层 `section`（见 B4）。
- `label`/`title`/`content` 等展示文案字段均可用对应的 `xxxKey` 形式替代（i18n，见 [01-node-protocol.md §6](./01-node-protocol.md#6-国际化i18n字段约定since-02)）。

---

## 布局类

### `grid`
两栏/多栏网格容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `columns` | number | 是 | 栏数（语义级，非像素） |

支持 `children`：是。支持 `data`：否。支持 `states`：否。

### `section`
带标题的分区容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` / `titleKey` | string | 否 | 分区标题 |
| `span` | number | 否 | 在父级 grid 中占几栏 |

支持 `children`：是。支持 `data`：否。支持 `states`：否。

### `tabs`
标签页容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `items` | array\<TabItem\> | 是 | 各标签页定义，见下 |

**TabItem（since 0.2）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 标签页标识 |
| `label` / `labelKey` | string | 是 | 标签页标题 |
| `content` | Node | 是 | 该标签页的内容节点（完整 Node，可任意嵌套） |

> **v0.2 变更（B2，方案 A）：** `tabs` 的内容改为 `items[].content` 内嵌，不再依赖顶层 `children` 按 `key` 做归属匹配。`tabs` 自身**不再支持 `children`**（旧版 `supportsChildren: true` 已废弃）。

```yaml
type: tabs
props:
  items:
    - key: overview
      label: 概览
      content: { type: section, children: [...] }
    - key: detail
      label: 详情
      content: { type: table, ... }
```

支持 `children`：否（since 0.2，内容改由 `items[].content` 承载）。支持 `data`：否。支持 `states`：否。

---

## 展示类

### `statCard`
统计数字卡片。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `label` / `labelKey` | string | 是 | 卡片标题 |
| `unit` | string | 否 | 单位文案 |
| `format` | enum: `plain`\|`currency`\|`percent` | 否 | 数值展示格式 |
| `valueField` | string | 是（since 0.2） | 指定从 API 响应中取哪个字段作为展示值 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

> **v0.2 变更（A3，破坏性）：** `valueField` 从 `data.valueField` 迁移至 `props.valueField`，与 `table.columns[].field`、`chart.xField/yField` 的取值方式保持一致。迁移方式见 [audit/0001-2026-07-07-plan.md §A3](./audit/0001-2026-07-07-plan.md#a3-将-valuefield-从-dataref-移至组件-props)。

```yaml
# v0.2 写法
type: statCard
props:
  label: 今日订单数
  valueField: total
data:
  source: api
  url: /api/stats/order-count
```

支持 `children`：否。支持 `data`：是。支持 `states`：是（since 0.2）。

### `chart`
图表。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `chartType` | enum: `line`\|`bar`\|`pie` | 是 | 图表类型 |
| `xField` | string | 是 | 横轴取值字段 |
| `yField` | string | 是 | 纵轴取值字段 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

支持 `children`：否。支持 `data`：是（返回值应为数组）。支持 `states`：是（since 0.2）。

### `text`
纯文本展示。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` / `contentKey` | string | 是 | 文本内容 |
| `valueField` | string | 否（since 0.2） | `data.source: api` 时，指定取哪个字段作为展示文本 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

> **v0.2 变更（A2）：** 修复 `supportsData` 说明矛盾，`text` 组件**支持 `data`**（`data.source: static/ref/api`），静态场景取 `data.value`，API 场景通过 `props.valueField` 指定取值字段（与 `statCard` 一致）。

支持 `children`：否。支持 `data`：是（since 0.2，原文档误标 `false`）。支持 `states`：是（since 0.2）。

---

## 数据类

### `table`
数据表格，自动分页。完整契约见 [04-datasource-contract.md](./04-datasource-contract.md)。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 表格标题 |
| `rowKey` | string | 是 | 行唯一标识字段名 |
| `pagination.mode` | enum: `server`\|`client`\|`none` | 是 | 分页模式 |
| `pagination.pageSize` | number | 否 | 默认页大小 |
| `columns` | array\<ColumnDef\> | 是 | 列定义，见下 |
| `actions` | array\<RowAction\> | 否 | 行内操作，见下 |
| `span` | number | 否（since 0.2） | 在父级 grid 中占几栏 |

**ColumnDef：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `field` | string | 对应数据字段名 |
| `label` | string | 列标题 |
| `format` | enum: `plain`\|`currency`\|`datetime`\|`tag` | 展示格式 |
| `tagMap` | map | `format: tag` 时，值 → `{text, tone}` 的映射 |

**RowAction：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | 是 | 操作标识 |
| `label` / `labelKey` | string | 是 | 操作文案 |
| `confirm` | string | 否 | 二次确认文案 |
| `visibleField` | string | 否（since 0.2） | 取当前行数据中的同名布尔字段作为显隐依据（数据驱动显隐，不引入 `$row` 表达式，见审计 §3.6 过渡方案） |

```yaml
actions:
  - key: refund
    label: 退款
    visibleField: canRefund   # 行数据中 canRefund: true 时才显示
```

支持 `children`：否。支持 `data`：是（契约见 04 文档）。支持 `states`：是（since 0.2）。

---

## 表单类

### `form`
表单容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` / `titleKey` | string | 否 | 表单标题 |
| `submitAction` | string | 是 | 引用顶层 `actions` 中的动作 id，完整契约见 [07-actions-contract.md](./07-actions-contract.md) |

支持 `children`：是（字段类 Node）。支持 `data`：否。支持 `states`：否。

### `input` / `inputNumber`
表单字段控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API）。支持 `reactions`：是。支持 `states`：否。

### `select`
下拉选择控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` / `labelKey` | string | 是 | 字段标签 |
| `options` | array\<{label,value}\> | 与 `optionsSource` 二选一 | 固定选项列表 |
| `optionsSource` | OptionsSource | 与 `options` 二选一（since 0.2） | 远程动态选项，见下 |
| `placeholder` | string | 否（since 0.2） | 占位提示文案 |
| `description` | string | 否（since 0.2） | 字段说明文案 |
| `tooltip` | string | 否（since 0.2） | 悬浮提示文案 |

**OptionsSource（since 0.2）：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | 是 | 远程选项接口地址 |
| `params` | object | 否 | 请求参数，可引用 `$deps.*`（复用 `reactions` 依赖机制，仅做值替换，不做条件判断）。**空值规则：** 当引用的 `$deps.*` 值为 `null`/`undefined` 时，该参数从请求中整体省略，详见 [04-datasource-contract.md](./04-datasource-contract.md) |
| `labelField` | string | 是 | 响应数据中作为选项文案的字段 |
| `valueField` | string | 是 | 响应数据中作为选项值的字段 |
| `searchable` | boolean | 否 | 是否支持远程搜索 |

```yaml
type: select
props:
  field: cityId
  label: 城市
  optionsSource:
    url: /api/options/cities
    params:
      provinceId: $deps.provinceId
    labelField: name
    valueField: id
    searchable: true
```

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API，远程选项通过 `optionsSource` 单独处理）。支持 `reactions`：是。支持 `states`：否。

---

## 组件生命周期标注（since 0.2，B9）

`schemas/component-registry.json` 中每个组件/字段可携带以下元信息，用于开发环境输出迁移警告：

| 字段 | 说明 |
|---|---|
| `deprecated` | `boolean`，标注该组件/字段已废弃 |
| `deprecatedMessage` | 废弃说明及迁移建议 |
| `since` | 该组件/字段引入的协议版本（如 `"0.2"`） |

## 新增组件类型的流程

1. 前端组件库中实现对应组件，并导出明确的 Props 类型定义。
2. 在本文档追加一节，字段表格与代码中的 Props 类型保持一致。
3. 同步更新 [`schemas/component-registry.json`](./schemas/component-registry.json)。
4. 在 [CHANGELOG.md](./CHANGELOG.md) 中记录新增的 `type`。
