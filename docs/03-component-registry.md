---
status: living-document
owner: 前端组件库团队
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.1
---

# 组件类型（type）注册表

> 本文档是**活文档**，应随前端组件库的迭代持续更新。
> 建议由 CI 从组件的 TypeScript Props 类型定义自动生成骨架，防止文档与实现漂移。
> 每次新增/修改一个 `type`，必须同步更新本文档 + [`schemas/component-registry.json`](./schemas/component-registry.json)。

## 如何阅读本表

每个组件类型包含：`type` 标识、用途、`props` 字段清单、是否支持 `children`、是否支持 `data`。

---

## 布局类

### `grid`
两栏/多栏网格容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `columns` | number | 是 | 栏数（语义级，非像素） |

支持 `children`：是。支持 `data`：否。

### `section`
带标题的分区容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 分区标题 |
| `span` | number | 否 | 在父级 grid 中占几栏 |

支持 `children`：是。支持 `data`：否。

### `tabs`
标签页容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `items` | array\<{key,label}\> | 是 | 各标签页的 key/label，实际内容通过 children 中同 key 的子节点匹配 |

支持 `children`：是。支持 `data`：否。

---

## 展示类

### `statCard`
统计数字卡片。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `label` | string | 是 | 卡片标题 |
| `unit` | string | 否 | 单位文案 |
| `format` | enum: `plain`\|`currency`\|`percent` | 否 | 数值展示格式 |

`data` 契约：`data.valueField` 指定从 API 响应中取哪个字段作为展示值。

支持 `children`：否。支持 `data`：是。

### `chart`
图表。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `chartType` | enum: `line`\|`bar`\|`pie` | 是 | 图表类型 |
| `xField` | string | 是 | 横轴取值字段 |
| `yField` | string | 是 | 纵轴取值字段 |

支持 `children`：否。支持 `data`：是（返回值应为数组）。

### `text`
纯文本展示。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | string | 是 | 文本内容 |

支持 `children`：否。支持 `data`：否（如需动态文本用 `data.value`）。

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
| `actions` | array\<RowAction\> | 否 | 行内操作 |

**ColumnDef：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `field` | string | 对应数据字段名 |
| `label` | string | 列标题 |
| `format` | enum: `plain`\|`currency`\|`datetime`\|`tag` | 展示格式 |
| `tagMap` | map | `format: tag` 时，值 → `{text, tone}` 的映射 |

支持 `children`：否。支持 `data`：是（契约见 04 文档）。

---

## 表单类

### `form`
表单容器。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 表单标题 |
| `submitAction` | string | 是 | 引用顶层 `actions` 中的动作 id |

支持 `children`：是（字段类 Node）。支持 `data`：否。

### `input` / `inputNumber` / `select`
表单字段控件。

| props 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `field` | string | 是 | 字段名（表单提交时的 key） |
| `label` | string | 是 | 字段标签 |
| `required` | boolean | 否 | 是否必填 |
| `defaultVisible` | boolean | 否 | 初始是否可见（配合 `reactions` 使用） |
| `options` | array\<{label,value}\> | `select` 必填 | 下拉选项 |

支持 `children`：否。支持 `data`：否（表单字段不直接绑定 API）。支持 `reactions`：是。

---

## 新增组件类型的流程

1. 前端组件库中实现对应组件，并导出明确的 Props 类型定义。
2. 在本文档追加一节，字段表格与代码中的 Props 类型保持一致。
3. 同步更新 [`schemas/component-registry.json`](./schemas/component-registry.json)。
4. 在 [CHANGELOG.md](./CHANGELOG.md) 中记录新增的 `type`。
