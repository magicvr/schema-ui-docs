---
status: accepted
date: 2026-07-23
applies_to: schema-ui-protocol v2.1
track: docs/11-next-admin-lifecycle-goals.md Phase B / P0
---

# ADR-0020: 页面级动作入口（ActionTrigger）

## 状态

**Accepted（已接受，随 v2.1.0 发布）。** 字段与执行语义以本 ADR 及 `03` / `07` / `08` / Schema / L2 为准。使用本能力的页面必须声明 `meta.protocolVersion: "2.1"` 与 `meta.requiredCapabilities: [actions.page.trigger]`。开放问题裁决见文末，已并入 D2–D4。

轨道依据：[11-next-admin-lifecycle-goals.md](../11-next-admin-lifecycle-goals.md)、[ADR-0019](./0019-v2-admin-scope.md)。

## 背景

v2.0 已有三类标准动作挂载点：

| 挂载点 | 能力 | 缺口 |
|---|---|---|
| `form.props.submitAction` | 表单提交 → 顶层 Action | 不能表达「页面工具栏新建」 |
| `upload.props.actionRef` | 上传 → `type: upload` | 专用 |
| `table.props.actions[].actionRef` | 行内 → `type: request` | 绑定当前行，不是页面级 |

列表页上的「新建」「导入」「打开筛选抽屉」等**不依赖当前行**的入口，今天只能：

1. 用 Host 私有 `custom` handler 或私有组件 type；或  
2. 滥用行内 `key` 本地分发；或  
3. 把按钮写死在 Host 壳子里，页面 YAML 无法描述。

这与协议「后端描述页面语义、多 Renderer 互操作」目标冲突。ADR-0019 已将「页面级 Toolbar/ActionTrigger」列为 v2.0 之后范围；本 ADR 给出 **P0 MVP** 裁决草案。

## 业务锚点（MVP）

第一刀只服务以下页面形态，不追求通用设计系统按钮库：

1. **列表页工具栏「新建」** → `navigate` 到创建页，或 `modal` 打开内嵌创建表单；  
2. **列表页工具栏「刷新」类 request**（无 body，成功 `reload` 当前列表所在数据）；  
3. **详情/编辑页顶部「返回列表」「提交」旁的次要入口**（可选，与表单 submit 并存）。

批量按钮挂载点在结构上可复用本 ADR 的 Trigger，但**批量语义**由后续 ADR（选择 + batch request）定义；本 ADR 不引入 selection。

## 决策（提案）

### D1. 新增 capability：`actions.page.trigger`

使用本 ADR 任一正式字段的页面必须声明：

```yaml
meta:
  protocolVersion: "2.1"
  requiredCapabilities:
    - actions.page.trigger
```

未声明 capability 或 Renderer `supportedCapabilities` 不含该键时，按 ADR-0009 / `08-renderer-spec` 在静态校验阶段拒绝，不得部分渲染工具栏。

### D2. 统一结构：`ActionTrigger`

引入与 `RowAction` 平行、但**无行上下文**的触发器结构：

```yaml
ActionTrigger:
  key: string                 # 必填（裁决 OQ-20-2）；本地标识（埋点/测试），不引用顶层 actions
  label / labelKey: string    # 必填其一（与组件 i18n 惯例一致）
  actionRef: string           # 必填；引用顶层 actions 的 id
  confirm: string             # 可选；二次确认文案
  visibleWhen: object         # 可选；默认 scope: form 规则不适用时见 D5
  permissions: map            # 可选；仅 $context.*
  disabled: boolean           # 可选；静态禁用，默认 false
```

约束：

- `key` **必填**，不得省略或默认成 `actionRef`（裁决 OQ-20-2）；  
- `actionRef` **必须**引用顶层 `actions` 中存在的 action；  
- MVP 允许的 action `type`：`request` | `navigate` | `modal`；  
- **不允许** `upload`（继续走 `upload` 组件 + `actions.upload`）；  
- **不允许** `custom`（继续 Host 白名单，避免协议把任意 handler 升为一等按钮）；  
- Trigger **没有** `requestMapping` / 行绑定；`request` 的 path/query/body 只能来自 Action 自身的静态定义或（未来）表单 submit 投影，不得从 `$row` 读取；  
- 需要行数据时仍用 `RowAction`（ADR-0008），不得用页面 Trigger 伪装行操作。

### D3. 挂载点（MVP 仅两个）

#### D3a. 组件 Node：`actionButton`

```yaml
type: actionButton
props:
  # ActionTrigger 字段内联为 props（key/label/actionRef/...）
  key: create
  label: 新建订单
  actionRef: openCreateOrder
  span: 1   # 可选，grid 子项时
```

- `supportsChildren: false`  
- `supportsData: false`  
- `supportsReactions: false`  
- `supportsStates: false`  
- 可出现在 `section` / `grid` 的 `children` 中，与现有布局模型一致。

#### D3b. `table.props.toolbar`

```yaml
type: table
props:
  rowKey: orderId
  toolbar:
    - key: create
      label: 新建
      actionRef: openCreateOrder
    - key: refreshList
      label: 刷新
      actionRef: noopRefresh   # request + onSuccess.reload 等
  columns: [...]
```

- `toolbar` 为 `ActionTrigger[]`，可选，默认缺省 = 无协议级工具栏；  
- 视觉位置（表头上方左侧/右侧）由 Renderer/主题决定，协议只保证**有序列表语义**；  
- 同一 `key` 在同一 `toolbar` 内必须唯一（L2）；  
- **不**在 MVP 引入 `section.props.toolbar`，避免多套挂载同时爆炸；需要页面级非表格工具栏时用 `actionButton` Node 组合；  
- 同一页面可同时存在 `table.toolbar` 与 `actionButton`；协议**不**限制「新建」等业务动作只能声明一次（裁决 OQ-20-3），重复入口是页面配置问题，不是静态非法。

### D4. 执行顺序

与行级 request 对齐的可观测顺序：

1. 求值 `permissions` / `visibleWhen`（不可见或不可用则不可点击）；  
2. 若 `disabled === true`，不可点击；  
3. 用户点击后，若有 `confirm`，先确认；  
4. 确认通过后执行 `actionRef` 指向的 Action；  
5. `onSuccess` / `onError` 完全复用既有 `OutcomeBehavior` 与 HTTP 错误序（`07` §8）。

对 `type: request` 且无表单上下文的 Trigger：

- 不跑 form 提交投影与 `bodyMapping`；  
- **MVP 请求 body 恒为 JSON `null`**（RequestAction **无**静态 body 字段；不得发明 `body: {...}` 私货字段）。需要固定载荷时使用后端固定接口契约，或后续 ADR 扩展；MVP **不**新增 Trigger 级 body 映射（审计 0064 / V286）；  
- **method 只允许 `POST` / `PUT` / `PATCH` / `DELETE`**，**禁止 `GET`**（裁决 OQ-20-1）；无 body 的刷新类命令使用上述方法之一，或仅依赖既有 `onSuccess.behavior: reload` 触发列表重载而无需多余 request；  
- 读数据继续用 DataRef / `form.recordSource`（ADR-0021），不把 GET 伪装成页面级 Action。

对 `type: navigate`：

- 使用 Action 的静态 `url`（不得含未绑定 `{name}`；L2 与 request 对称静态拒绝，审计 0064 / V283）；行相关动态 URL 见 [ADR-0021](./0021-record-navigation-and-form-load.md) 的行级 navigate 映射，**不**在本 ADR 的 Trigger 上做。

对 `type: modal`：

- 打开 `modalId` / `content`；关闭与 `closeModal` outcome 行为不变。

### D5. 表达式与权限

- `permissions`：仅 `$context.*`，与列/行操作一致。  
- `visibleWhen` / 未来 reactions：  
  - 挂在 **独立 `actionButton` Node** 上时，遵循普通 Node 的 `visibleWhen`（`$context.*`；若位于 form 内可 `$deps.*`）；  
  - 挂在 **`table.props.toolbar[]`** 上时，MVP **仅允许** `$context.*`（无 `$row`、无 `$deps`），避免工具栏随行或随搜索字段隐式抖动；需要随筛选变化的禁用留给后续 ADR。  
  - **L3a 必须遍历 `table.props.toolbar[]` 的 `visibleWhen` / `permissions`**（审计 0062 / V268）；即使 table 位于 form 内，toolbar 表达式也不得获得 form `$deps` 上下文。  
- toolbar Trigger **不**支持 `reactions` 数组（MVP）。  
- **可观测执行结果（审计 0062 / V272）：**  
  - `type: request` → 构造 HTTP request（method/url/body/headers）；  
  - `type: navigate` → `{ navigation: { url } }`（静态相对 URL，无未绑定模板）；  
  - `type: modal` → `{ modalOpen: { modalId? , hasContent? } }`；  
  - 非空 `confirm` 且用户未确认 → `CONFIRM_REJECTED`，三种类型均不得继续执行。

### D6. 与现有概念的关系

| 概念 | 关系 |
|---|---|
| `RowAction.key` / `actionRef` | 行级；本 ADR 不修改 |
| `form.submitAction` | 表单主提交；工具栏「保存」若等于提交，MVP 仍推荐用 form 主按钮，不强制 Trigger 替代 |
| `actions.custom` | 不作为 Trigger 目标 |
| Host Extension 按钮 | 可继续存在，但不进入核心场景与 fixtures |

### D7. 非目标（本 ADR 明确不做）

- 表格多选、批量 Action、选中态与 toolbar 联动（Phase C）；  
- 按钮图标、尺寸、主次 type、危险按钮等视觉枚举（主题层）；  
- 下拉菜单式「更多操作」、分组工具栏、溢出菜单；  
- `section`/`page` 级统一 chrome 布局协议；  
- Trigger 级 `requestMapping`、从 `$context.user` 拼 body；  
- 键盘快捷键、权限中台资源码协议。

## 后果

**正面：**

- 列表「新建」等页面级入口可进 YAML，多 Renderer 可互操作；  
- 复用顶层 `actions` 与 OutcomeBehavior，不发明第二套动作系统；  
- capability 隔离，旧 v2.0 页面与 Renderer 零影响。

**负面 / 取舍：**

- 两个挂载点（Node + table.toolbar）有轻微重复，但覆盖「纯布局页按钮」与「列表惯例工具栏」；  
- 无行上下文的 request 能力较弱，复杂参数仍靠后端固定接口或后续表单；  
- 接受前必须补：规范章节、`component-registry`、`action` 引用校验、L2、fixtures、官方场景。

## 落地清单（接受时原子完成）

| 项 | 产物 |
|---|---|
| M1 | 本 ADR → `accepted`；`11` Phase B 勾选对应项 |
| M2 | `03` 增加 `actionButton`；`table.props.toolbar` |
| M3 | `07` / `08` 写执行序与 capability `actions.page.trigger` |
| M4 | Schema + L2：actionRef 存在性、type 白名单、toolbar key 唯一 |
| M5 | conformance fixtures + 官方场景「列表工具栏新建」 |
| M6 | CHANGELOG +（若 `protocolVersion` 升 MINOR）迁移说明一句 |

## 开放问题裁决（已关闭）

| ID | 问题 | 裁决 | 理由 |
|---|---|---|---|
| **OQ-20-1** | 页面级 Trigger 触发的 `type: request` 是否允许 `GET`？ | **否。** 仅 `POST` / `PUT` / `PATCH` / `DELETE`。 | 与「读用 DataRef / recordSource、写用 Action」边界一致；GET Action 易与缓存、幂等和「是否有 body」纠缠。列表刷新优先 `onSuccess.reload` 或无 body 的 POST 命令接口。若未来要「按钮触发只读查询并写回某 Node」，另开 ADR，不塞进 Trigger MVP。 |
| **OQ-20-2** | `actionButton` / toolbar 项是否可省略 `key`？ | **否。** `key` 必填。 | 与 `RowAction.key` 对称，服务测试选择器、埋点与无障碍标签稳定 id；`actionRef` 是动作身份，`key` 是**入口**身份，二者不可混用。L2 缺 `key` 即拒绝。 |
| **OQ-20-3** | 同一页 toolbar 与 `actionButton` 是否禁止重复业务入口？ | **不禁止。** 协议不做跨挂载点去重。 | 重复「新建」属于产品/配置质量，不是结构非法；强制去重需要语义等价判定（label/actionRef/可见性），成本高且易误伤合法双入口（如桌面工具栏 + 空态 CTA）。实现与 lint 工具可提供**非阻断**告警，但不进 L2 硬错误。 |

以上裁决已写入 D2 / D3b / D4；接受本 ADR 时无需再议，除非有新的互操作反例推翻。
