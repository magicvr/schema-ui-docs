---
status: accepted
date: 2026-07-23
applies_to: schema-ui-protocol v2.1
track: docs/11-next-admin-lifecycle-goals.md Phase B / P0
---

# ADR-0021: 记录导航与编辑表单加载回填

## 状态

**Accepted（已接受，随 v2.1.0 发布）。** 字段与执行语义以本 ADR 及 `02` / `03` / `07` / `08` / Schema / L2 为准。使用时声明 `meta.protocolVersion: "2.1"`，并分别声明 `actions.row.navigate` 与/或 `form.record.load`。开放问题裁决见文末，已并入 D1 / D4–D7。

轨道依据：[11-next-admin-lifecycle-goals.md](../11-next-admin-lifecycle-goals.md)、[ADR-0019](./0019-v2-admin-scope.md)。

## 背景

标准 Admin CRUD 的主干路径是：

```text
列表 →（行）详情 / 编辑 → 加载记录 → 回填表单 → 提交 → 返回或刷新列表
```

v2.0 已具备碎片能力，但**未串成可互操作闭环**：

| 已有 | 缺口 |
|---|---|
| `actions.type: navigate` + 静态 `url` | 不能把 `$row.orderId` 安全写入目标 URL/query |
| `RowAction` + `requestMapping` 仅服务 `type: request` | 行级不能声明式 `navigate` |
| form + `submitAction` + `bodyMapping` | 创建可做；**编辑无标准加载与 initialValues** |
| DataRef `responseMapping` | 面向组件 `data`，不是「整表单初始值」 |
| `$context.user` / `features` | **无**页面路由/query 只读快照，编辑页不知 `orderId` 从何而来 |

结果是：各项目用 Host 注入路由、手写回填、或私有组件完成编辑页，协议层无法保证一致行为。

## 业务锚点（MVP）

1. **列表行「编辑」** → 导航到 `/orders/edit?orderId=…`（或 path `/orders/{orderId}/edit`）；  
2. **编辑页挂载** → 用页面 query/path 中的 id **GET** 记录 → 映射为 form 字段初始值 → 用户修改后 `submitAction` 提交；  
3. **列表行「详情」**（可选同构）→ 导航到只读页；只读页 MVP 可用 `text`/禁用字段 form 凑合，**不**引入 `recordView` 组件（P2）。

「新建」页不加载记录，仅空表单 + submit；与 ADR-0020 工具栏入口配合。

## 决策（提案）

### D1. 两个 capability（互不合并）

| capability | 用途 |
|---|---|
| `actions.row.navigate` | 行级触发 `type: navigate`（及 navigate 参数映射） |
| `form.record.load` | 表单声明记录加载源与初始值映射 |

页面用到对应字段时必须声明相应 capability；可只声明其一。建议与 `actions.page.trigger` 同属 2.1 轨道，但 Renderer 可独立实现。

**不**把行级 navigate 并入 `actions.row.request`，也**不**重命名为笼统的 `actions.row.action`（裁决 OQ-21-4）：已实现行级 request 的 Renderer 不得被强制实现导航；页面只声明所需能力。

### D2. 扩展 `$context.route`（只读页面路由快照）

在 [ADR-0003](./0003-context-namespace-and-visible-when.md) 白名单中**新增**命名空间（接受本 ADR 时同步改 `02`）：

```yaml
$context.route:
  path: string              # 当前页 path（baseURL 之后的应用路径，是否含 query 由宿主定义时写清；提案：path 不含 query）
  query: map<string, string>  # 当前页 query；值一律字符串；缺失键为 undefined
  params: map<string, string> # 可选；宿主路由 path 参数（如 /orders/:orderId）
```

规则：

- 与 `$context.user` 相同：**实例初始化只读快照**；路由变化必须重挂载 Renderer；  
- 仅允许出现在**明确列出的**绑定位置（见 D4/D5），**默认仍禁止**写入 `data.params` / 普通 reactions，除非该位置的规范显式放开；  
- MVP 绑定位置只放开：`form.props.recordSource` 的 path/query 映射值、以及后续只读展示表达式若需要可再开；  
- `$context.route` **不是安全边界**（同 ADR-0003 D2）；id 必须服务端鉴权。

不引入 `$context.route` 之外的新根命名空间。

### D3. 行级 Navigate：复用 `actionRef`，扩展允许类型与映射

#### D3a. `RowAction.actionRef` 允许 `type: navigate`

在 ADR-0008 D1「仅 request」基础上扩展（破坏面：旧文档表述；兼容面：旧页面仍只写 request）：

- `actionRef` 可引用 `type: request` **或** `type: navigate`；  
- 仍不可引用 `modal` / `upload` / `custom`（modal 行级流程后续另议）；  
- 引用 `navigate` 时页面必须声明 `actions.row.navigate`（可与 `actions.row.request` 并存）。

#### D3b. `navigateMapping`（仅用于 navigate）

```yaml
actions:
  editOrder:
    type: navigate
    url: /orders/edit          # 静态 base 路径；query 由 mapping 合并
    # 或 url: /orders/{orderId}/edit  + path 映射

# table row:
actions:
  - key: edit
    label: 编辑
    actionRef: editOrder
    navigateMapping:
      path:
        orderId: $row.orderId
      query:
        orderId: $row.orderId
        from: list
```

规则对齐 `requestMapping` 纪律（ADR-0008 / ADR-0010）：

- 扁平 map；值 = 字面量或单个 `$row.*` 点路径；标量 own-property；拒绝原型污染路径；  
- 禁止 `$deps.*`、`$context.*`、表达式、模板拼接、嵌套对象/数组；  
- `path` 替换 `url` 中 `{name}`；`query` 按 ADR-0010 合并进最终导航 URL；  
- **不得**与 `requestMapping` 同时出现在同一 RowAction；  
- `type: request` 的 RowAction 继续只用 `requestMapping`；`type: navigate` 只用 `navigateMapping`；  
- path 映射结果为 `null`/`undefined` 时拒绝导航并走动作级错误处理（与 request path 失败一致）。

行级「编辑」MVP **推荐** query 传 id（实现简单）；path 传 id 为等价选项。

### D4. 表单记录加载：`form.props.recordSource`

仅当 `form` 为默认模式（非 `mode: search`）时允许：

```yaml
type: form
props:
  title: 编辑订单
  submitAction: updateOrder
  recordSource:
    method: GET                 # 固定 GET；写操作仍走 submitAction
    url: /api/orders/{orderId}
    path:
      orderId: $context.route.query.orderId
      # 或 $context.route.params.orderId
    query:                      # 可选；附加 query，ADR-0010 序列化
      verbose: "true"
    responseMapping:            # 必填（裁决 OQ-21-1）；同 DataRef 点路径映射纪律
      customerName: customer.name
      amount: amount
      version: version
  # 未映射到的响应字段默认不进表单；见 D5
```

规则：

1. 使用 `recordSource` 时必须声明 `form.record.load`；  
2. **`method` 必填且只允许 `GET`**（与 ADR-0013 DataRef 只读一致）；参考实现与 Renderer **不得**对缺失 method 默认 `GET`（审计 0062 / V270 → `MISSING_RECORD_SOURCE_METHOD`）；  
3. `url` 为 baseURL 下单斜杠相对路径；**MVP 仅允许内联 url**，不得 `source: ref` 引用页面 `datasources`（裁决 OQ-21-2）；  
4. `path` / `query` 映射值只允许：字面量，或单个 `$context.route.query.*` / `$context.route.params.*` 点路径（MVP 不开放 `$context.user`）；  
5. **`responseMapping` 必填**且为非空对象（裁决 OQ-21-1）；L2 对缺省或 `{}` 拒绝；  
6. **`path` 与 url `{name}` 双向对齐**，运行时 fail-closed：`MISSING_PATH_BINDING` / `EXTRA_PATH_BINDING`，不得请求未解析模板 URL（审计 0062 / V267）；  
7. 加载时机：form 节点挂载且 `recordSource` 合法后 **自动发起一次**；遵循 latest-wins（ADR-0015）若快速重挂载；  
8. 加载中：form 进入 loading 态（若 `supportsStates` 或 Renderer 统一 loading）；字段在成功前不得视为用户已编辑的脏数据；  
9. 加载失败：节点错误态 + 安全错误文案；**不**执行 `submitAction`；`401`/`403` 走全局认证钩子；  
10. `mode: search` 的 form **禁止** `recordSource`（L2）。

### D5. 初始值合并与提交

#### D5a. 回填

- 成功响应**仅**按显式 `responseMapping` 写入表单字段：mapping 目标为 form `field` 名，源为响应 JSON 点路径（纪律对齐 DataRef `responseMapping`）；  
- **不做**缺省「扁平同名自动映射」，**不做**嵌套对象自动展开（裁决 OQ-21-1）；  
- 映射目标 field 不在表单符号表中：忽略该键，开发环境可告警；  
- 映射源路径缺失 / 运行时 `undefined`：该字段的 **conformance 可观测值** 为 JSON **`null`**（审计 0063 / V273）；运行时语义等价于「空初始值」——**不中止整次回填**，其余已映射字段照常写入，并作为 reactions 新 baseline。受控表单实现须把该 `null` 当作与未填字段相同的空值处理，**不得**因单字段缺失中止提交投影中其它已映射字段；显式 JSON `null` 与路径缺失在 formRecord 映射结果中同为 `null`。开发环境可对缺失路径告警；  

- 写入字段值作为 reactions 的 **新 baseline**（用户未改前的基线），对齐 ADR-0006：回填完成后触发一轮 Snapshot/Evaluate/Commit；  
- `upload` 字段：若 mapping 结果为字符串（url/id），写入字段值；数组规则与既有 upload 字段值形状一致。

#### D5b. 提交

- 仍走既有 `submitAction` + 提交投影 + `bodyMapping`；  
- 乐观锁与主键（如 `version`、`orderId`）经 `responseMapping` 写入**仍参与提交投影**的字段（裁决 OQ-21-3：本 ADR **不**新增 `type: hidden`）；  
- 官方场景与示例优先使用**只读且可见**的字段组件承载 id/version，避免 `visibleWhen: false` 把字段踢出提交投影；  
- Renderer **不得**在提交时私自把已不可见字段或 `$context.route` 塞进 body；  
- MVP **不**自动把 route id 注入 submit body；**Action url 保持静态**，id 仅通过 body 字段传递（由回填提供）。

#### D5c. 创建页

- 无 `recordSource` = 当前 v2.0 空表单行为；  
- 禁止用空 `recordSource` 对象占位。

### D6. 与 DataRef / 页面 datasources 的关系

- `recordSource` **不是** `data.source: api` 的别名；它专用于「form 初始值生命周期」；  
- 同一编辑页其他组件仍可用 DataRef；  
- **不得** `recordSource.ref` / 引用 `datasources.*`（裁决 OQ-21-2）；需要共享 URL 时由后端页面生成器重复内联字符串，后续若要 DRY 再开 ref 扩展；  
- 不共享 DataRef 的 ref 缓存键空间（避免与列表缓存串味）；实现可自建 `recordSource:` 缓存键。

### D7. 非目标

- 标准 `recordView` 详情组件（P2）；  
- `type: hidden` 一等组件（裁决 OQ-21-3；可另开 PATCH/MINOR 小 ADR）；  
- `recordSource` 引用页面 `datasources` ref（裁决 OQ-21-2）；  
- 抽屉内嵌编辑的专用壳；  
- **`modal.content` 内 `recordSource` 的路由注入互操作（审计 0063 / V280）：** 允许在 modal 内容树中声明 `recordSource`，但 **modal 内 route 注入不是 2.1/2.2 互操作门禁**，无独立 conformance 形状。Host 若在 modal 中使用 `$context.route.*` 绑定，**应**提供与整页相同的只读快照形状（`path` / `query.*` / 可选 `params.*`，query 值一律字符串）；MVP **推荐** modal 内 `recordSource` 仅用字面量 path/query，避免依赖 Host 私有注入。协议不定义抽屉路由库；  
- 多记录批量编辑、向导多步表单状态机；  
- 客户端路由库绑定、浏览器 History API 细节；  
- 自动生成「返回列表」按钮（可用 ADR-0020 `actionButton` + navigate）；  
- 行级 `modal` 编辑流标准化；  
- `$context.route` 响应式更新而不重挂载。

## 端到端 MVP 示意（非规范示例）

```yaml
# ----- 列表页 -----
meta:
  pageId: order_list
  protocolVersion: "2.1"
  requiredCapabilities:
    - actions.page.trigger
    - actions.row.navigate

actions:
  openCreate:
    type: navigate
    url: /orders/create
  openEdit:
    type: navigate
    url: /orders/edit

body:
  type: table
  props:
    rowKey: orderId
    toolbar:
      - key: create
        label: 新建
        actionRef: openCreate
    columns:
      - field: orderId
        label: 单号
    actions:
      - key: edit
        label: 编辑
        actionRef: openEdit
        navigateMapping:
          query:
            orderId: $row.orderId

# ----- 编辑页 -----
meta:
  pageId: order_edit
  protocolVersion: "2.1"
  requiredCapabilities:
    - form.record.load

actions:
  updateOrder:
    type: request
    method: PUT
    url: /api/orders/update
    bodyMapping:
      orderId: orderId
      customerName: customerName
      version: version

body:
  type: form
  props:
    title: 编辑订单
    submitAction: updateOrder
    recordSource:
      method: GET
      url: /api/orders/{orderId}
      path:
        orderId: $context.route.query.orderId
      responseMapping:
        orderId: orderId
        customerName: customer.name
        version: version
  children:
    - type: input
      props:
        field: orderId
        label: 单号
    # ...
```

## 后果

**正面：**

- CRUD 主干路径可在协议内描述；  
- 行级 navigate 与 request 对称，降低 Host 分叉；  
- `$context.route` 最小扩展，避免每项目私有「取 query」表达式。

**负面 / 取舍：**

- `$context` 白名单扩展有全局影响，必须严格限制可用挂载点；  
- 默认要求显式 `responseMapping` 增加编辑页配置量，但避免隐式嵌套展开；  
- 与 ADR-0020 解耦：可先实现导航+回填、工具栏仍用 Host（不推荐长期）。

## 落地清单（接受时原子完成）

| 项 | 产物 |
|---|---|
| M1 | 本 ADR → `accepted`；更新 ADR-0003 / ADR-0008 交叉引用 |
| M2 | `02` 增加 `$context.route`；`03` form.recordSource；`07` 行级 navigate |
| M3 | `08` capability：`actions.row.navigate`、`form.record.load` |
| M4 | L2/L3a：映射纪律、search form 禁止 recordSource、action 类型匹配 |
| M5 | fixtures：navigateMapping 序列化、record 加载成功/404/403、回填 baseline |
| M6 | 官方场景：列表编辑闭环（可与 0020 工具栏新建合并为一个场景文） |
| M7 | CHANGELOG + 2.0→2.1 迁移短文 |

## 开放问题裁决（已关闭）

| ID | 问题 | 裁决 | 理由 |
|---|---|---|---|
| **OQ-21-1** | `responseMapping` 缺省时是否允许扁平同名自动映射？ | **否。** `recordSource.responseMapping` **必填且非空**。 | 静默同名映射在嵌套 DTO、字段改名、多余响应键时产生不可测回填；与 DataRef 可缺省 mapping 的「整对象进组件 data」场景不同——form 需要**字段级白名单**。多写几行 mapping 换可静态审计与跨实现一致。 |
| **OQ-21-2** | `recordSource` 是否可 `ref` 页面 `datasources`？ | **否（MVP）。** 仅内联 `url` + path/query。 | 减少与 DataRef 缓存、method 约束、responseMapping 归属的交叉语义；页面生成器重复字符串可接受。共享 datasource 留待有真实 DRY 痛点时再开 ADR。 |
| **OQ-21-3** | 是否新增 `type: hidden`？ | **本 ADR 不新增。** 官方示例用只读可见字段携带 `orderId`/`version`。 | 隐藏字段与提交投影（visible/disabled/unmounted）强耦合，单独设计才安全；用 `visibleWhen: false` 会掉出投影导致提交丢 id。不阻塞 0021 接受，但场景与文档必须展示安全写法；`type: hidden` 可作为 2.1 内后续小 ADR。 |
| **OQ-21-4** | 是否合并 `actions.row.request` 与 navigate 为单一 capability？ | **否。** 保持 `actions.row.request` 与 `actions.row.navigate` 分立。 | 实现面不同（HTTP request vs 宿主导航）；合并会迫使「只会打行级 API」的 Renderer 声明虚假导航能力，或迫使页面多声明用不到的能力。细粒度更符合既有 `actions.upload` 模式。 |

以上裁决已写入 D1 / D4 / D5 / D6 / D7；接受本 ADR 时无需再议，除非有新的互操作反例推翻。
