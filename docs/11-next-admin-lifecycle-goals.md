---
status: active
owner: 前后端架构组
last_updated: 2026-07-23
applies_to: schema-ui-protocol v2.3 (post-v2.3 track)
---

# 下一步目标：Admin 生命周期协议轨道

本文档确立 **v2.0 之后** 的协议演进方向，把 [ADR-0019](./decisions/0019-v2-admin-scope.md) 已明确排除的「完整 Admin 生命周期」落成可执行的目标与优先级。

它**不是**当前 `2.0` 的发布门禁，也不改变 v2.0 合法页面语义。v2.0 的完成定义仍以 [`10-v2-release-goals.md`](./10-v2-release-goals.md) 为准。在对应 capability、ADR、Schema 与 versioned fixtures 原子落地之前，下列能力**不得**被描述为协议已支持，也不得要求标准 Renderer 通过私有 handler 猜测实现。

## 1. 背景与动机

v2.0 已收敛为可互操作的**基础 Admin 页面**契约：布局、展示、列表/分页、搜索筛选、基础表单、上传、声明式行级 request、权限显隐与联动。

生产中后台列表页还普遍依赖以下一等能力，它们在业务上高频，但 v2.0 **刻意不覆盖**：

- 页面级工具栏 / 动作入口（新建、导入、批量按钮挂载点）；
- 表格多选与批量操作；
- 列表 → 详情 / 编辑导航与记录上下文传递；
- 编辑记录加载、`initialValues` 与表单回填；
- 标准详情 / record view；
- 容器级权限继承与操作键级联。

若继续仅用 Host Extension 承载上述能力，多 Renderer / 多后端页面生产方将产生不可互操作的私货分叉。下一步目标是把其中共识最高的部分升为 **v2.x 可选 capability**，而不是立刻开破坏性 MAJOR。

## 2. 轨道原则

1. **底座不回退：** 不削弱 v2.0 的版本协商、query 序列化、DataRef 只读、Action 重试与行级 request 语义。
2. **优先 MINOR + capability：** 新增字段与执行能力通过 `meta.requiredCapabilities` / Renderer `supportedCapabilities` 协商；默认不强制所有 v2.0 Renderer 同日支持。
3. **禁止伪装支持：** Host Extension 可以继续服务单项目，但不得写入核心规范示例，也不得进入跨实现 conformance 正例。
4. **原子交付：** 每项能力包必须同时更新 ADR、核心规范、Schema/DSL、L2/L3a、JS/Python fixtures、官方场景与 CHANGELOG；见根 [`PROJECT_CHARTER.md`](../PROJECT_CHARTER.md)。
5. **先定边界再写字段：** 每个 capability 的 ADR 必须写清 MVP 范围、明确非目标、失败策略与迁移影响，再进入 Schema。
6. **MAJOR 仅用于破坏：** 仅当必须改变 v2.0 合法输入、默认值或可观测结果时，才评估下一 MAJOR。

## 3. 范围总览

### 3.1 v2.0 已覆盖（本轨道不重复建设）

| 能力 | 主要锚点 |
|---|---|
| 布局 / 展示 / 列表分页排序 | `03` / `04` / ADR-0011 |
| 搜索表单筛选表格 | `form.mode: search` |
| 行内本地 handler 与声明式行级 request | ADR-0008 / `actions.row.request` |
| 基础表单提交、上传、联动表达式 | `07` / ADR-0012 / `02` |
| 节点与列/操作级权限显隐 | `permissions` / ADR-0003 |

### 3.2 本轨道目标能力（完整 Admin 生命周期）

| 优先级 | 能力包（工作名） | 业务问题 | 候选 ADR / capability |
|---|---|---|---|
| **P0** | 页面级动作入口 | 新建、导入、页面工具栏按钮如何声明式触发 Action | [ADR-0020](./decisions/0020-page-action-trigger.md) · `actions.page.trigger` |
| **P0** | 记录导航与编辑回填 | 列表进详情/编辑；加载记录并回填表单 | [ADR-0021](./decisions/0021-record-navigation-and-form-load.md) · `actions.row.navigate`、`form.record.load` |
| **P1** | 表格选择与批量操作 | 多选、批量确认、批量 request、成功刷新 | [ADR-0022](./decisions/0022-table-selection-and-batch-request.md)（**accepted**）· `table.selection`、`actions.batch.request` |
| **P1** | 权限继承补齐 | 容器级 edit/delete 等与子节点/操作级联 | [ADR-0023](./decisions/0023-container-permission-inheritance.md)（**accepted**，`permissions.inheritance`，v2.3） |
| **P2** | 标准详情组件 | 只读 record view / details，非 table 非 form | 待起草 · 如 `recordView` |
| **P2** | 运营增强 | 导入导出向导、异步任务结果、树表、行内编辑等 | 按真实需求单独立项 |

P0 capability 键以候选 ADR 正文为准；**Accepted 之前不进入** `08-renderer-spec` 预定义表与 Schema。

### 3.3 明确非目标（本轨道默认不做）

- 不提供生产 Renderer、组件库皮肤或业务后端；
- 不把 Host 私有批量/回填实现回写成 v2.0「已支持」；
- 不在第一包支持跨页全选当前筛选全集、部分成功行级回填、嵌套子表 `$parentRow`、单元格行内编辑（可在后续 ADR 单独立项）；
- 不把工作流引擎、权限中台、主题 token、列宽用户偏好等业务/呈现层能力塞进核心页面协议。

## 4. 分阶段目标

### Phase A — 立项与边界（文档阶段）

- [x] 以 ADR-0019 确认完整 Admin 生命周期不属于 v2.0 核心。
- [x] 本文档确立下一步目标、优先级与版本策略。
- [x] 选定第一包 MVP 业务锚点（见 §4.1）。
- [x] 为 P0 起草候选 ADR：[0020](./decisions/0020-page-action-trigger.md)、[0021](./decisions/0021-record-navigation-and-form-load.md)。

### 4.1 已锁定的 MVP 业务锚点

第一包（建议合入目标 **`2.1`**）只服务下列页面形态；批量与跨页选择**不在**本包：

| 锚点 | 用户路径 | 协议落点（候选） |
|---|---|---|
| A. 列表工具栏新建 | 列表 → 工具栏「新建」→ 创建页或创建弹窗 | ADR-0020：`table.toolbar` / `actionButton` → `navigate` \| `modal` |
| B. 行进编辑 | 列表行「编辑」→ 带 id 的编辑页 | ADR-0021：`RowAction` + `navigateMapping` → `$context.route` |
| C. 编辑回填提交 | 编辑页加载记录 → 改字段 → 提交 | ADR-0021：`form.recordSource` + 既有 `submitAction` |

验收叙事（官方场景草稿目标）：**同一订单域**下 A+B+C 可描述为两页 YAML（list + edit），无需 Host 私有按钮或私有回填。

非本包（明确推迟）：当前页/跨页多选批量、权限容器级联、`recordView`、行内编辑、导入导出。

### Phase B — P0：页面入口 + 记录读写闭环（下一步）

目标：标准 Renderer 能互操作地表达「列表页工具栏动作」与「打开/编辑一条记录」。

范围以候选 ADR 为准（可在接受前收窄，不可无 ADR 扩张）：

1. **页面级 Action 入口** — [ADR-0020](./decisions/0020-page-action-trigger.md)  
   - `ActionTrigger`、`actionButton`、`table.props.toolbar`；  
   - capability `actions.page.trigger`；  
   - 与 `form.submitAction`、`RowAction` 职责划分。
2. **记录导航** — [ADR-0021](./decisions/0021-record-navigation-and-form-load.md)  
   - 行级 `navigate` + `navigateMapping`；  
   - `$context.route.query|params`；  
   - capability `actions.row.navigate`。
3. **编辑加载与回填** — 同 ADR-0021  
   - `form.props.recordSource`（GET + path/query 绑定 + responseMapping）；  
   - 回填后 reactions baseline；  
   - capability `form.record.load`。

门禁（该 Phase **完整制品发布**前必须全部勾选）：

- [x] ADR-0020 / 0021 开放问题已关闭；
- [x] ADR-0020 / 0021 状态为 `accepted`；
- [x] Schema / 组件 DSL / L2 与规范一致（capability 门控；使用 2.1 字段时页面须 `protocolVersion: "2.1"`，L2 V282 强制下限）；
- [x] JS 与 Python reference 消费同一套 versioned fixtures（request-construction / response-mapping / version-negotiation 已扩展 P0 向量）；
- [x] 扩展示例场景覆盖锚点 A+B+C（`05-scenarios/admin-list-edit-lifecycle.md`；尚未进六场景 release 清单）；
- [x] scenarios conformance 步进（列表加载+行导航、编辑加载回填+提交+navigate 成功）；
- [x] `requiredCapabilities` 键写入 `08-renderer-spec` 预定义表；
- [x] CHANGELOG 与迁移说明草稿 [`migrations/2.0-to-2.1-admin-lifecycle.md`](./migrations/2.0-to-2.1-admin-lifecycle.md) 已更新；
- [x] 协议制品版本升至 `2.1.0` / 页面 `protocolVersion: "2.1"` 与 release 门禁（见 `12-v2.1-release-goals.md`）。

### Phase C — P1：选择与批量（已发布）

目标：列表页可声明「**当前页**多选 + 批量 request」。

- [x] 候选 ADR：[0022](./decisions/0022-table-selection-and-batch-request.md)。
- [x] 关闭 0022 开放问题并 `accepted`。
- [x] Schema / L2 / `08` capability / fixtures / reference。
- [x] 官方扩展示例场景（`admin-list-batch.md` + `_samples/order-list-batch.yaml`）+ [`2.1-to-2.2`](./migrations/2.1-to-2.2.md) 迁移短文。
- [x] `2.2.0` 制品打包（按 [13-v2.2-release-goals.md](./13-v2.2-release-goals.md) / V275：`ALLOW_22_FIELDS_ON_21=false`，样例/fixtures 升 `"2.2"`）。

MVP 摘要（以 0022 正文为准）：

1. **选择模型** — `table.props.selection.mode: multiple`；键 = `rowKey` 标量；仅当前页；筛选/翻页/排序/reload **清空**选中。  
2. **批量 request** — toolbar Trigger：`requiresSelection` + `batchMapping`（`$selection.keys` 仅 body）；整批一次 HTTP；成功 reload 并清空选中。  
3. **权限继承** — **不在 0022**；由独立 [ADR-0023](./decisions/0023-container-permission-inheritance.md) 随 v2.3 作为 `permissions.inheritance` 交付。

门禁额外要求：

- [x] 与搜索分页排序状态机（ADR-0011）的交互有 fixtures（search-table / table-query-state selection 清空向量）；
- [x] `table.selection` 与 `actions.batch.request` 可独立声明，互不隐式耦合（version-negotiation + L2）。

### Phase C.1 — P1 补齐：权限继承（已随 v2.3 发布）

目标：将 ADR-0003 明确保留的容器 `edit` / `delete` 级联问题以跨 Renderer 的确定性规则交付，同时不追溯改变 v2.2 页面语义。

- [x] 起草 `ADR-0023`（仓库工作树 `docs/decisions/0023-container-permission-inheritance.md`）：显式容器边界、单调 AND、显式操作意图与旧页兼容原则。
- [x] 协议可接受性评审：审计 0065（协议制品外过程记录，V287–V294）已通过 ADR 裁决与用户接受决议关闭。
- [x] ADR-0023 的 OQ-23-1–7 均已关闭，ADR 状态为 `accepted` 并进入 `protocol-manifest.json` 的 `authority.semanticSpecs`。
- [x] 用户确认 OQ-23-1 的范围：`table.props.columns[]` 不参与权限级联，仅 `table.props.actions[]` / `table.props.toolbar[]` 参与；列仍只适用本地 `permissions`。
- [x] 用户接受 ADR-0023，并授权以 `2.3.0` / `2.3` 的新 MINOR 原子同步 Schema/DSL、L2/L3a、fixtures、场景、迁移、CHANGELOG 与发布目标（M1–M6）。
- [x] v2.3 发布门禁见 [`14-v2.3-release-goals.md`](./14-v2.3-release-goals.md)；迁移见 [`migrations/2.2-to-2.3.md`](./migrations/2.2-to-2.3.md)。

### Phase D — P2 与运营增强

在 P0/P1 稳定后按需启动，不阻塞前两阶段发布：

- 标准 `recordView` / details 组件；
- 导入导出、异步任务中心；
- 树表、可展开行、行内编辑；
- 批量部分成功与跨页全选。

## 5. 版本与发布策略

| 变化类型 | 版本建议 | 说明 |
|---|---|---|
| 文档轨道、ADR 草案、本文件修订 | 不升协议 `protocolVersion` | 不改变合法页面 |
| 新增兼容字段 + capability，旧页面仍合法 | **MINOR**（如 `2.1`、`2.2`） | 页面按需声明 `requiredCapabilities` |
| 文档勘误、示例、fixtures 补齐且不改结果 | **PATCH** | 遵循 `10-v2-release-goals.md` §4 |
| 破坏 v2.0 合法输入、默认值或可观测结果 | **下一 MAJOR** | 需独立发布目标文档与迁移指南 |

推荐节奏（可按业务压力调整，但勿合并为单次「大爆炸」）：

1. `2.1` — Phase B：**已发布**（ADR-0020 + ADR-0021）。
2. `2.2` — Phase C：表格选择 + 批量 request（ADR-0022，已发布）。
3. `2.3` — Phase C.1：容器权限继承与显式操作 intent（ADR-0023，已发布）。
4. 更后 MINOR 或 MAJOR — Phase D。

具体 `protocolVersion` 数字以发布时 `protocol-manifest.json` 与迁移文档为准。

## 6. 成功标准

当且仅当：

1. ADR-0019 列出的 P0 与 P1（批量和权限继承）已有已接受 ADR、可运行 fixtures 与对应发布门禁；
2. 至少两个独立实现（或 JS/Python reference + 一个生产 Renderer）对同一页面配置给出一致行为；
3. 未声明对应 capability 的 v2.0 页面行为与现网 v2.0 **完全不变**；
4. 官方场景覆盖「工具栏新建 / 行进编辑 / 当前页批量」中的已交付子集；

本轨道的 **P0 与 P1（选择/批量、权限继承）** 已达成。P2 不纳入该成功标准的阻断条件。

## 7. 与现有文档的关系

| 文档 | 关系 |
|---|---|
| [`10-v2-release-goals.md`](./10-v2-release-goals.md) | v2.0 **当前**发布门禁；本文件不替代它 |
| [`decisions/0019-v2-admin-scope.md`](./decisions/0019-v2-admin-scope.md) | 界定 v2.0 不含完整 Admin；本文件是其后续执行轨道 |
| [`decisions/0020-page-action-trigger.md`](./decisions/0020-page-action-trigger.md) | P0：页面级 ActionTrigger（**accepted**，v2.1） |
| [`decisions/0021-record-navigation-and-form-load.md`](./decisions/0021-record-navigation-and-form-load.md) | P0：记录导航与 form 加载回填（**accepted**，v2.1） |
| [`decisions/0022-table-selection-and-batch-request.md`](./decisions/0022-table-selection-and-batch-request.md) | P1：表格选择与批量 request（**accepted**，v2.2） |
| [`decisions/0023-container-permission-inheritance.md`](./decisions/0023-container-permission-inheritance.md) | P1：容器权限继承与显式操作 intent（**accepted**，v2.3） |
| [`13-v2.2-release-goals.md`](./13-v2.2-release-goals.md) | 2.2 历史发布门禁与 V275 版本策略 |
| [`14-v2.3-release-goals.md`](./14-v2.3-release-goals.md) | 2.3 发布门禁与 ADR-0023 交付证据 |
| [`decisions/0008-row-action-backend-request.md`](./decisions/0008-row-action-backend-request.md) | 已覆盖单行 request；批量由其「后果」中 defer，在本轨道 Phase C 接续 |
| [`PROJECT_CHARTER.md`](../PROJECT_CHARTER.md) | 变更门禁与权威层级；本轨道交付必须遵守 |
| `docs/audit/` | 过程记录；轨道结论应沉淀回规范/ADR/本文件/CHANGELOG，审计本身不是协议权威 |

## 8. 当前状态

| 项 | 状态 |
|---|---|
| 协议制品 / 页面协议 | `2.3.0` / `2.3`（见 `protocol-manifest.json`） |
| 本轨道 | **Phase C 与 C.1 已随 2.2.0 / 2.3.0 发布**（ADR-0022 / ADR-0023 + 场景 + 迁移 + 制品） |
| P0 ADR | [0020](./decisions/0020-page-action-trigger.md)、[0021](./decisions/0021-record-navigation-and-form-load.md)（**accepted**，v2.1） |
| P1 批量 | [0022](./decisions/0022-table-selection-and-batch-request.md)（**accepted**，v2.2） |
| 权限继承 | [ADR-0023](./decisions/0023-container-permission-inheritance.md)（**accepted**，v2.3；旧 v2.2 页面不追溯开启继承） |
| 下一步具体动作 | Phase D 按真实需求单独立项；不得以 Host 私有约定扩张已交付的 v2.3 边界 |

---

**维护说明：** 当某一 Phase 的 capability 合入协议时，应把对应门禁勾选为完成，并在 `CHANGELOG` 与（如需要）新的 `1x-*-release-goals.md` 中留下该 MINOR 的发布门禁；本文件保留轨道级视图，避免与单一版本门禁文档混淆。未来 proposed ADR 在 `accepted` 前不得进入 `protocol-manifest.json` 的 `authority.semanticSpecs`。
