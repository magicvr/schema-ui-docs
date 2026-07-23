---
status: accepted
date: 2026-07-23
applies_to: schema-ui-protocol v2.1+ (capability-gated; packaging target MINOR 2.2)
track: docs/11-next-admin-lifecycle-goals.md Phase C / P1
---

# ADR-0022: 表格当前页多选与批量 request

## 状态

**Accepted（已接受）。** 字段与执行语义以本 ADR 及同步更新的 `03` / `07` / `08` / Schema / L2 / conformance 为准。使用时页面应声明 `meta.requiredCapabilities` 含 `table.selection` 与/或 `actions.batch.request`。制品打包目标为 **MINOR `2.2`**；在 `protocolVersion: "2.2"` 正式发布前，合法页面可继续声明 `protocolVersion: "2.1"` 并依赖 capability 协商。开放问题见文末裁决表，已并入 D2–D5。

轨道依据：[11-next-admin-lifecycle-goals.md](../11-next-admin-lifecycle-goals.md)、[ADR-0019](./0019-v2-admin-scope.md)、[ADR-0020](./0020-page-action-trigger.md)、[ADR-0008](./0008-row-action-backend-request.md)。

**本 ADR 不包含**容器权限继承（另开 ADR）；**不包含**跨页全选、筛选结果全集、批量部分成功。

## 背景

列表运营页常见路径：

```text
筛选 / 翻页 → 勾选若干行 → 工具栏「批量删除 / 改状态 / 导出」→ 确认 → 一次（或明确策略下的）后端请求 → 刷新列表
```

v2.1 已有：

| 能力 | 覆盖 | 缺口 |
|---|---|---|
| `table.props.actions[]` + `requestMapping` | 单行 request | 无多行 |
| `table.props.toolbar` + ActionTrigger | 页面级按钮 | 无选中集合绑定 |
| ADR-0011 表格 query 状态 | page / pageSize / sort / 筛选 | 无 selection 状态机 |

若不标准化，各项目会用 Host handler 发明 `selectedIds`、`rowSelection`、跨页语义不一致，破坏互操作。

## 业务锚点（MVP）

第一刀只服务：

1. **订单列表当前页多选 → 批量删除**（`DELETE` 或 `POST` + ids body）；  
2. **当前页多选 → 批量改状态**（`POST` + ids + 字面量 status）；  
3. 工具栏批量按钮在 **选中数为 0** 时禁用；成功后 `reload` 表格并**清空选中**。

明确不做（本 ADR）：跨页勾选、全选当前筛选结果、导出文件流、部分成功行回填、树表勾选。

## 决策（提案）

### D1. 两个 capability（可独立声明）

| capability | 用途 |
|---|---|
| `table.selection` | 表格启用多选 UI 与选中态 |
| `actions.batch.request` | 工具栏/按钮将选中键绑定到 `type: request` |

- 仅多选展示、无批量请求：可只声明 `table.selection`（例如 Host 读选中态——**非**本 ADR 标准互操作出口；MVP **不**定义 Host 读 API）。  
- 有批量 request：两者都要声明。  
- 页面使用对应字段时必须声明；未声明则 L2 拒绝。  
- 建议页面 `meta.protocolVersion: "2.2"`。

### D2. `table.props.selection`（选择模型）

```yaml
type: table
props:
  rowKey: orderId
  selection:
    mode: multiple          # MVP 仅 multiple；single 另议
    # 无其它字段：MVP 不提供 preserveSelected / crossPage
  toolbar:
    - key: batchDelete
      label: 批量删除
      actionRef: deleteOrders
      confirm: 确认删除所选订单？
      requiresSelection: true   # 见 D4
  columns: [...]
```

规则：

1. **`selection.mode: multiple`（MVP 唯一合法值）。** 缺省 `selection` = 无协议级多选（与 v2.1 一致）。  
2. **选中键**取当前行 `rowKey` 字段的**标量**值（string / number / boolean）；`null`/`undefined`/非标量行不得进入选中集，开发环境可告警。  
3. **作用域：仅当前页数据**（本次表格数据请求返回的 `list` 行）。不维护跨页集合。  
4. **与 ADR-0011 状态机交互（唯一策略）：**  
   - 用户 **提交搜索**、**清空筛选**、**改变 sort**、**改变 page**、**改变 pageSize**、**表格 data reload 成功** → **清空全部选中**。  
   - 理由：跨页保留未标准化；当前页集合在筛选/翻页后语义漂移。  
5. **全选当前页**：Renderer 可提供「全选本页」控件；协议只要求结果是「本页全部合法 rowKey 进入集合」，不规定 DOM。  
6. **不**把 selection 写入 URL query（非 `page`/`pageSize`/`sort`）；selection 是 Renderer 会话态。

### D3. 选中集合的运行时表示（可观测）

为 fixtures / reference 定义最小可观测形状（不暴露给页面 YAML 为任意表达式语言）：

```json
{
  "keys": ["ORD-1", "ORD-2"],
  "count": 2
}
```

- `keys`：有序数组，顺序 = 用户勾选顺序（稳定；全选本页时按当前 `list` 顺序）。  
- `count`：`keys.length`。  
- 同一 `rowKey` 不得重复。

页面配置 **不得** 用 `$selection` 写在普通 reactions 里（MVP）；仅 **batchMapping** 白名单位置可读选中集（D5）。

### D4. 扩展 ActionTrigger：`requiresSelection`

在 [ADR-0020](./0020-page-action-trigger.md) 的 `ActionTrigger` 上新增可选字段：

```yaml
requiresSelection: boolean   # 默认 false
```

- `true`：当 `count === 0` 时按钮 **disabled**（不可点）；与静态 `disabled: true` 为 OR。  
- 仅当 Trigger 挂在 **声明了 `selection` 的同一 table 的 `toolbar[]`** 上时合法；`actionButton` 上出现 `requiresSelection` → L2 拒绝（MVP 无「关联 table id」字段）。  
- 使用 `requiresSelection: true` 的页面必须同时具备 `table.selection`。

### D5. `batchMapping`（批量请求绑定）

批量 Trigger 引用 `type: request` 时，在 Trigger 上声明 **`batchMapping`**（与行级 `requestMapping` 平行，但读选中集）：

```yaml
actions:
  deleteOrders:
    type: request
    method: POST
    url: /api/orders/batch-delete
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 批量删除失败

# table.toolbar:
- key: batchDelete
  label: 批量删除
  actionRef: deleteOrders
  requiresSelection: true
  confirm: 确认删除所选订单？
  batchMapping:
    body:
      orderIds: $selection.keys
```

#### D5a. 结构

```yaml
batchMapping:
  path:   # 可选；替换 action.url 中 {name}；MVP 值仅允许字面量（不推荐用 keys 拼 path）
  query:  # 可选；ADR-0010 序列化；值：字面量 | $selection.count（见下）
  body:   # 可选；JSON 对象
```

#### D5b. 允许的值（严格）

| 值 | 含义 | 可用段 |
|---|---|---|
| 字面量 string / finite number / boolean / null | 常量 | path / query / body |
| `$selection.keys` | 当前选中键数组（有序） | **仅 body** 的某个 key 的整值 |
| `$selection.count` | 选中个数（number） | query 或 body 的标量字段 |

禁止：

- `$row.*`、`$deps.*`、`$context.*`（含 `$context.route`）；  
- 模板拼接、表达式、嵌套对象/数组字面量结构（body 本身是一层 map；**值**若为 `$selection.keys` 则该字段的运行时值是数组）；  
- path/query 使用 `$selection.keys`（避免把数组塞进 path/query 的未定义序列化）；  
- 与 `requestMapping` / `navigateMapping` 同时出现在同一 Trigger。

#### D5c. 与顶层 Action

- `actionRef` 仅 `type: request`（MVP；批量 navigate/modal 不做）。  
- method 允许 `POST` / `PUT` / `PATCH` / `DELETE`；**禁止 GET**（与页面 Trigger 纪律一致）。  
- url 不得含未绑定 `{name}`；若有 path 占位，必须在 `batchMapping.path` 用**字面量**绑完。  
- 成功 / 失败复用 `OutcomeBehavior`；`reload` = 重新加载**该 table** 数据，并按 D2 **清空选中**。

#### D5d. 执行顺序

1. `permissions` / `visibleWhen`（toolbar：仅 `$context.*`，同 ADR-0020）；  
2. `requiresSelection` / `disabled`；  
3. `confirm`（若有）；  
4. 若 `count === 0`（竞态）：拒绝执行，不发请求；  
5. 构造 request（batchMapping）；  
6. 发出请求；  
7. `onSuccess` / `onError`；成功且 `reload` 时清空选中。

#### D5e. 失败策略（MVP：整批）

- 协议将一次批量 Trigger 点击视为 **一次逻辑 HTTP 调用**。  
- **不**定义部分成功 JSON 形状，也**不**逐行打勾回滚。  
- HTTP 4xx/5xx / unknown 按既有 Action 错误序；选中集 **保留**（用户可改选后重试），除非页面 `onSuccess` 已 reload（失败不会 reload）。

### D6. 与现有概念关系

| 概念 | 关系 |
|---|---|
| `RowAction` + `requestMapping` | 单行；不变 |
| `ActionTrigger`（ADR-0020） | 扩展 `requiresSelection` + 可选 `batchMapping` |
| 普通 toolbar request（无 batchMapping） | 仍按 ADR-0020（无选中绑定） |
| ADR-0011 | selection 清空时机见 D2；不进入 query 合并链 |
| 表单 submit | 无关 |

### D7. 非目标

- `selection.mode: single`；  
- 跨页选择、半选、排除列表、全选筛选结果；  
- `$selection` 出现在 reactions / visibleWhen；  
- 批量 upload / navigate / modal；  
- 部分成功、进度条、分块多次 HTTP；  
- 权限继承 / 容器级联；  
- 把选中行完整对象数组打进 body（仅 keys；需要更多字段时由后端按 id 再查或后续 ADR）。

## 端到端示意（非规范）

```yaml
meta:
  pageId: order_list_batch
  title: 订单列表
  protocolVersion: "2.2"
  requiredCapabilities:
    - actions.page.trigger
    - table.selection
    - actions.batch.request

actions:
  deleteOrders:
    type: request
    method: POST
    url: /api/orders/batch-delete
    onSuccess:
      behavior: reload
    onError:
      behavior: toast
      message: 批量删除失败

body:
  type: table
  id: orderTable
  props:
    rowKey: orderId
    selection:
      mode: multiple
    pagination:
      mode: server
      pageSize: 20
    toolbar:
      - key: batchDelete
        label: 批量删除
        actionRef: deleteOrders
        requiresSelection: true
        confirm: 确认删除所选订单？
        batchMapping:
          body:
            orderIds: $selection.keys
    columns:
      - field: orderId
        label: 订单号
  data:
    source: api
    url: /api/orders
    method: GET
    responseMapping:
      list: data.list
      total: data.total
```

## 后果

**正面：**

- 列表批量成为可互操作能力，复用 toolbar 与 OutcomeBehavior；  
- 选择范围与清空规则唯一，避免翻页脏选中；  
- 与单行 `requestMapping` 标量模型隔离，数组仅出现在明确的 `$selection.keys`。

**负面 / 取舍：**

- 无跨页全选，重度运营台仍可能要 Host 或后续 ADR；  
- body 只能带 keys，不能直接带行快照；  
- `actionButton` MVP 不能 `requiresSelection`（必须挂 table.toolbar）。

## 落地清单（接受时原子完成）

| 项 | 产物 |
|---|---|
| M1 | 本 ADR → `accepted`；更新 0020 Trigger 字段表 |
| M2 | `03` selection / batchMapping / requiresSelection；`07` 批量执行序 |
| M3 | `08` capability：`table.selection`、`actions.batch.request` |
| M4 | L2：mode 枚举、mapping 纪律、挂载点、capability |
| M5 | fixtures：选中清空状态机、batch body keys、count=0 拒绝、reload 清空 |
| M6 | 官方或扩展示例场景 + CHANGELOG + `2.1→2.2` 迁移短文 |

## 开放问题裁决（已关闭）

| ID | 问题 | 裁决 | 理由 |
|---|---|---|---|
| **OQ-22-1** | 翻页/筛选是否允许「保留跨页选中」开关？ | **否。** MVP 在筛选/清空/排序/翻页/pageSize/reload 成功时**一律清空**选中。 | 跨页集合未标准化；开关会引入第二套状态机与 fixtures。 |
| **OQ-22-2** | `$selection.keys` 是否允许出现在 query？ | **否。** 仅允许作为 **body** 某字段的整值（数组）。 | 数组 query 序列化未在 ADR-0010 定义为批量语义；避免重复 key 互操作分叉。 |
| **OQ-22-3** | `DELETE` + body 是否允许？ | **允许。** 协议要求构造带 JSON body 的 DELETE（若配置了 body 映射）。 | 批量删除常见；与「页面 Trigger 禁止 GET」不冲突。宿主 HTTP 栈若不能发 DELETE body，属实现限制，须在 Renderer 文档声明，不得静默改 method。 |
| **OQ-22-4** | keys 是否统一为 string？ | **否。** 保持 `rowKey` 字段运行时标量类型。 | 避免 number id 被强制字符串化导致后端类型错误。 |
| **OQ-22-5** | 是否需要 `maxSelection`？ | **否（MVP）。** | 限流由后端与产品负责；需要时另开字段。 |

以上裁决已并入 D2–D5；接受本 ADR 时无需再议，除非有新的互操作反例推翻。

## 与权限继承的关系

容器级 `permissions` 级联 **不在** 本 ADR。批量按钮的 `permissions` 仍仅 `$context.*` 表达式（同 toolbar Trigger）。级联规则另开 ADR，可与 2.2 同发或随后。
