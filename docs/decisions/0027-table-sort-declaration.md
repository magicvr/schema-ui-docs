---
status: accepted
date: 2026-07-27
applies_to: schema-ui-protocol v2.5
track: 页面级 Admin 补齐（列表排序声明面；wire 形态沿 ADR-0011）
---

# ADR-0027: 表格排序声明（sortable / defaultSort）

## 状态

**Accepted。** 自 `schema-ui-protocol v2.5` 起生效。补齐 ADR-0011 刻意留下的「可排序字段」声明面；**不**改动
`sort` 保留 query 的格式与搜索/翻页状态机。与应用级清单（ADR-0025/0026）独立：本 ADR 是
**页面 table 协议**，不依赖 manifest。

## 背景

列表三件套中，分页与筛选已有完整声明面：

| 能力 | 声明面 | 请求/状态面 |
|---|---|---|
| 分页 | `pagination.mode` / `pageSize` | 保留 query `page` / `pageSize`（ADR-0011） |
| 筛选 | `form.mode: search` + `targetTable` | 搜索字段合并进表格 query（ADR-0011） |
| 排序 | **无**（ColumnDef 无 `sortable`） | 保留 query `sort=field:asc\|desc`（ADR-0011） |

ADR-0011 D3 原文：「**可排序字段能力不在本 ADR 扩展**；Renderer 只能从表格已允许的排序交互产生该值。」
结果是：请求长什么样协议有，**哪些列可点、默认按谁排、展示 field 与 sort key 是否同名**只能私约
或 Renderer 猜测——与「任意前端 × 任意后端」冲突，且与分页/筛选声明完整度不对称。

`release-goals/next-admin-lifecycle.md` 将「列表分页排序」记为 v2.0 已覆盖，指的是 **wire + 状态机**；
本 ADR 补的是遗漏的 **声明面**，不否定 0011。

## 业务锚点（MVP）

| 锚点 | 用户路径 | 协议落点 |
|---|---|---|
| A. 可点列 | 用户点击「创建时间」列表头 → 升/降序切换 → 表格带 `sort` 重新请求 | `columns[].sortable` + ADR-0011 D4 |
| B. 默认序 | 首次进入列表即按创建时间降序，无需用户先点一次 | `table.props.defaultSort` |
| C. 字段映射 | 列展示 `createdAt`，后端 sort key 为 `created_at` | `columns[].sortField` |

验收叙事：同一列表 YAML 在任意合规 Renderer 上，可排序列集合、初始 `sort` query、点击后的
`field:asc|desc` 形态完全一致——零列排序私约。

## 决策

### D1. capability 与版本

| 项 | 值 |
|---|---|
| capability | `table.sort` |
| 版本下限 | 页面使用本 ADR 任一字段时须 `meta.protocolVersion: "2.5"` 且声明 `table.sort`（L2 字段集→版本下限，沿审计 0064） |
| 与 0011 | **additive**：不修改 `sort` 字符串格式、保留名禁令、四层合并序、D4 状态表 |

未声明 `table.sort` 的既有页面：行为与 v2.4 完全一致（无声明面；宿主不得把未知列当可排序——标准入口无本字段则无协议级排序 UI 义务）。

### D2. 列级声明（`columns[]`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sortable` | boolean | — | 缺省 **`false`**（fail-closed：未声明不可点）。`true` 时表头可触发排序交互 |
| `sortField` | string | — | 写入 `sort` 左半段的后端字段名；**仅当 `sortable: true` 时允许出现**（L2）。缺省 = 该列 `field` |

规则：

1. `sortable: false` 或缺省：该列不得产生排序交互；表头不展示可排序 affordance（呈现细节归主题，协议只禁「点了发 sort」）。
2. 用户激活某可排序列时，Renderer 将表格状态 `sort` 设为 `{sortKey}:{asc|desc}`，其中
   `sortKey = sortField ?? field`；方向切换与清除规则见 D4。
3. **单列单 key**：同一 `sortKey` 被多列声明为可排序 → L2 拒绝（避免两列抢同一 sort 状态）。
4. `sortField` / `field` 不得为保留名 `page` / `pageSize` / `sort`（与 ADR-0011 搜索字段禁令同纪律，L2）。

### D3. 表级默认排序（`table.props.defaultSort`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `defaultSort` | object | — | `{ field: string, order: "asc" \| "desc" }`；仅初始状态 |

| 规则 | 说明 |
|---|---|
| `field` 含义 | 等于某列的 **sortKey**（`sortField ?? field`），且该列 `sortable: true`；否则 L2 拒绝 |
| 初始状态 | 表格实例创建时，若声明了 `defaultSort`，则 `sort` 初始为 `field:order`（非 null）；否则沿 ADR-0011：`sort = null` 不发送 |
| 仅初始 | 用户清除排序后变为 `null`，**不**在每次搜索提交时强制恢复 default（搜索保留当前 sort，沿 0011 D4） |
| client / none | MVP：**仅** `pagination.mode: server` 允许 `defaultSort` 与可排序交互产生服务端 `sort` query。`client` / `none` 使用本字段 → L2 拒绝（本地排序另议，非目标） |

### D4. 与 ADR-0011 状态机的接缝

不改 D4 事件表，只钉死「排序交互」如何改 `sort` 值。

**三态以当前 `sort` 状态为输入**（不是「用户点击次数」；审计 0069 / V326）：若
`defaultSort: { field, order: desc }` 使初始为 `{sortKey}:desc`，则用户**首次**点击该列 → `null`
（走「已是 desc → 清除」），而非切到 asc。

| 用户动作 | 结果 `sort` | `page` |
|---|---|---|
| 点击当前未排序列（或其它列）（当前 `sort` 为 null，或 sortKey 不同） | `{sortKey}:asc`（MVP 从无序切入固定 **asc**；若产品要默认 desc，用 `defaultSort` 表达**初始**，不引入 per-column initialOrder） | 重置 `1` |
| 再次点击同一列（当前已是该 sortKey 的 asc） | `{sortKey}:desc` | 重置 `1` |
| 再次点击同一列（当前已是该 sortKey 的 desc） | `null`（清除排序） | 重置 `1` |
| 搜索提交 / 清空筛选 / 翻页 | 沿 ADR-0011 D4（保留或重置 page；**不**改 sort 语义） | 同 0011 |

- 非空 `sort` 格式仍严格为 `field:asc` 或 `field:desc`（唯一 `:`，order 仅两枚举）。
- **`TABLE_SORT_FIELD_UNKNOWN`（审计 0069 / V317 方案 A）**：仅当当前表格状态 `sort` **非 null**，
  且其 `sortKey`（`:` 左侧）**不是**任一 `sortable: true` 列的 `sortField ?? field` 时，在
  **构造表格 API 请求之前**必须失败，错误码 `TABLE_SORT_FIELD_UNKNOWN`——**不得**发出请求，
  **不得**静默改写为 `null` 后继续。合法状态来源仅：用户点击可排序列，或实例创建时的
  `defaultSort`（已由 L2 保证 sortKey 可命中）。L2 已拒绝的配置不在运行时再报此码。
- 与选择清空：排序变化仍清空当前页选中（沿 ADR-0022 / 0011 交互，已有 fixtures 口径）。

### D5. 明确非目标（MVP）

- 多列排序（`sort` 数组或 `field1:asc,field2:desc`）；
- `client` / `none` 分页下的协议级本地排序；
- 列 `initialOrder` / 每列默认方向（只用表级 `defaultSort`）；
- 将排序状态写入**浏览器路由** query 或依赖前进/后退恢复表格 sort（属宿主路由同步，非本 ADR）。
  **注意：** 这与 ADR-0011 表格 **API** 请求上的保留 query `sort` **不是同一件事**——声明了排序时，
  表格数据请求仍按 0011 发送 `sort`（审计 0069 / V329）；
- 后端 sort 白名单协商、排序与权限联动。

## 校验与 conformance（原子交付清单）

- Schema：`component-registry` ColumnDef 增加 `sortable` / `sortField`；`table.props` 增加 `defaultSort`；
  `additionalProperties: false` 保持；
- L2：`table.sort` capability 门控；`sortField` 仅 sortable；sortKey 唯一；`defaultSort.field` 命中可排序
  sortKey；server-only；保留名拒绝；版本下限 `"2.5"`；
- 规范：`03` ColumnDef / table props、`04` 引用本 ADR、**`08` §3.4** 预定义 capability 表增加
  `table.sort`、`01`/`00` capability 列表；
- **稳定错误码** `TABLE_SORT_FIELD_UNKNOWN` 登记于 `docs/03` 或 `docs/04` 表格错误码表（与实现一致；
  审计 0069 / V318）；
- conformance：扩展 `search-table`（或新 suite `table-sort`）——defaultSort 初始 URL、三态点击
  （含 defaultSort desc 时首次点击该列 → 清除）、sortField 映射、不可排序列不产生 sort、
  未知 sortKey → `TABLE_SORT_FIELD_UNKNOWN` 且不发请求、与 search 保留 sort / 重置 page 交叉向量、
  与 `table.selection` 排序清空选中；
- CHANGELOG + migration（v2.4 → v2.5 additive：旧页无字段则无排序 UI 义务）；
- **与 ADR-0011 原子性（审计 0069 / V324）**：本 ADR 与 0011 D3 声明面指针同一 `v2.5` 制品落地；
  已纳入 `protocol-manifest.json` authority。

## 对消费者的影响

- 后端/页面生产方：需要可排序时显式 `sortable: true`（及可选 `sortField` / `defaultSort`），并声明
  `table.sort` + `protocolVersion: "2.5"`。
- 前端：声明 `table.sort` 才须实现 D2–D4；未声明的 Renderer 加载含本字段的页面 → 版本/capability
  协商失败（fail-closed），不得半实现。
- ADR-0011 消费者：仅 wire 测试向量不变；新增声明面向量。

## 与相邻 ADR 的关系

| ADR | 关系 |
|---|---|
| [0011](./0011-reserved-query-params.md) | wire + 状态机权威；本 ADR 补声明面与排序点击语义；accept 原子性见交付清单 |
| [0022](./0022-table-selection-and-batch-request.md) | 排序变化清空选中——沿既有交互，不新开规则 |
| [0025](./0025-app-manifest.md) / [0026](./0026-app-navigation.md) | 无依赖；应用级轨道不包含本能力 |

## 开放问题（评审裁决点）

无。MVP 已固定（含审计 **0069**）：缺省不可排序、三态以当前状态为输入、从无序切入固定 asc、
仅 server 分页、单 sort key、`TABLE_SORT_FIELD_UNKNOWN` 触发集收紧（V317 方案 A）。
