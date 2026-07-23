---
status: planning
owner: 前后端架构组
last_updated: 2026-07-23
applies_to: schema-ui-protocol v2.0 (next track)
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

| 优先级 | 能力包（工作名） | 业务问题 | 建议 capability 方向 |
|---|---|---|---|
| **P0** | 页面级动作入口 | 新建、导入、页面工具栏按钮如何声明式触发 Action | 如 `actions.page.trigger` |
| **P0** | 记录导航与编辑回填 | 列表进详情/编辑；加载记录并回填表单 | 如 `actions.record.navigate`、`form.record.load` |
| **P1** | 表格选择与批量操作 | 多选、批量确认、批量 request、成功刷新 | 如 `table.selection`、`actions.batch.request` |
| **P1** | 权限继承补齐 | 容器级 edit/delete 等与子节点/操作级联 | 扩展既有 `permissions` 语义（需独立 ADR） |
| **P2** | 标准详情组件 | 只读 record view / details，非 table 非 form | 如 `recordView` 组件 + capability |
| **P2** | 运营增强 | 导入导出向导、异步任务结果、树表、行内编辑等 | 按真实需求单独立项 |

工作名与 capability 键仅为轨道规划用语；正式名称以后续 ADR 采纳结果为准。

### 3.3 明确非目标（本轨道默认不做）

- 不提供生产 Renderer、组件库皮肤或业务后端；
- 不把 Host 私有批量/回填实现回写成 v2.0「已支持」；
- 不在第一包支持跨页全选当前筛选全集、部分成功行级回填、嵌套子表 `$parentRow`、单元格行内编辑（可在后续 ADR 单独立项）；
- 不把工作流引擎、权限中台、主题 token、列宽用户偏好等业务/呈现层能力塞进核心页面协议。

## 4. 分阶段目标

### Phase A — 立项与边界（文档阶段，当前）

- [x] 以 ADR-0019 确认完整 Admin 生命周期不属于 v2.0 核心。
- [x] 本文档确立下一步目标、优先级与版本策略。
- [ ] 选定第一包 MVP 的真实业务锚点（至少 1–2 个页面形态：列表工具栏新建 + 行进编辑，或列表多选批量）。
- [ ] 为 P0 能力包起草候选 ADR（可先 informal 提纲，再正式 `decisions/00xx`）。

### Phase B — P0：页面入口 + 记录读写闭环

目标：标准 Renderer 能互操作地表达「列表页工具栏动作」与「打开/编辑一条记录」。

候选范围（ADR 可收窄，不可在无 ADR 时扩张）：

1. **页面级 Action 入口**
   - 工具栏 / ActionTrigger / 标准 button 与顶层 `actions` 的引用关系；
   - 与 `form.submitAction`、`RowAction.actionRef` 的职责划分；
   - 可见性 / 权限 / disabled 的挂载点。
2. **记录导航**
   - 行级或工具栏触发的详情/编辑跳转；
   - 记录标识如何进入目标页（query / path 占位等），且不破坏 ADR-0010 URL 边界。
3. **编辑加载与回填**
   - 记录 GET、映射到 form 初始值；
   - 与现有 `responseMapping`、提交投影、reactions baseline 的关系；
   - 加载失败、空记录、并发编辑的最小错误语义。

门禁（该 Phase 发布前必须全部勾选）：

- [ ] 已接受 ADR 覆盖字段、执行顺序、错误与非目标；
- [ ] Schema / 组件 DSL / L2（及必要的 L3a）与规范一致；
- [ ] JS 与 Python reference 消费同一套 versioned fixtures；
- [ ] 至少 1 个官方场景；
- [ ] `requiredCapabilities` 键写入 `08-renderer-spec` 预定义表；
- [ ] CHANGELOG 与（若需要）迁移说明已更新。

### Phase C — P1：选择、批量与权限继承

目标：列表页可声明「当前页多选 + 批量 request」，并补齐容器权限级联的最小可互操作子集。

候选 MVP（建议第一刀保持保守）：

1. **选择模型**
   - 默认仅**当前页**多选；跨页选择 / 全选筛选结果另开 ADR；
   - 选中键与 `rowKey` 对齐；清空筛选、翻页时的选中态策略必须唯一。
2. **批量 request**
   - 将选中键集合映射到 request（例如 body 中的 id 数组）；扩展点不得破坏现有单行 `requestMapping` 标量规则的默认语义；
   - 确认文案、执行中禁用、成功 `reload`；
   - 第一刀采用**全有或全无**（整批失败不部分提交 UI 状态）；部分成功另开 ADR。
3. **权限继承**
   - 明确容器 `permissions.edit` / 自定义动作键是否级联；
   - 与子节点显式 `permissions` 的仲裁顺序。

门禁同 Phase B 清单，并额外要求：

- [ ] 与搜索分页排序状态机（ADR-0011）的交互有 fixtures；
- [ ] 批量与行级 request 的 capability 可独立声明，互不隐式耦合。

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

1. `2.1` — Phase B（页面入口 + 记录闭环）中通过门禁的子集；
2. `2.2` — Phase C（选择/批量，及权限继承若已就绪）；
3. 更后 MINOR 或 MAJOR — Phase D。

具体 `protocolVersion` 数字以发布时 `protocol-manifest.json` 与迁移文档为准。

## 6. 成功标准

当且仅当：

1. ADR-0019 列出的缺口中，**P0 + P1** 已有已接受 ADR 与可运行 fixtures；
2. 至少两个独立实现（或 JS/Python reference + 一个生产 Renderer）对同一页面配置给出一致行为；
3. 未声明对应 capability 的 v2.0 页面行为与现网 v2.0 **完全不变**；
4. 官方场景覆盖「工具栏新建 / 行进编辑 / 当前页批量」中的已交付子集；

本轨道的 **P0/P1 目标** 视为达成。P2 不纳入该成功标准的阻断条件。

## 7. 与现有文档的关系

| 文档 | 关系 |
|---|---|
| [`10-v2-release-goals.md`](./10-v2-release-goals.md) | v2.0 **当前**发布门禁；本文件不替代它 |
| [`decisions/0019-v2-admin-scope.md`](./decisions/0019-v2-admin-scope.md) | 界定 v2.0 不含完整 Admin；本文件是其后续执行轨道 |
| [`decisions/0008-row-action-backend-request.md`](./decisions/0008-row-action-backend-request.md) | 已覆盖单行 request；批量由其「后果」中 defer，在本轨道 Phase C 接续 |
| [`PROJECT_CHARTER.md`](../PROJECT_CHARTER.md) | 变更门禁与权威层级；本轨道交付必须遵守 |
| `docs/audit/` | 过程记录；轨道结论应沉淀回规范/ADR/本文件/CHANGELOG，审计本身不是协议权威 |

## 8. 当前状态

| 项 | 状态 |
|---|---|
| 协议制品 / 页面协议 | `2.0.0` / `2.0`（见 `protocol-manifest.json`） |
| 本轨道 | **planning**（已确立目标与优先级，尚未开始正式 ADR 编号落地） |
| 下一步具体动作 | 完成 Phase A 剩余项：选定 MVP 业务锚点，起草 P0 候选 ADR |

---

**维护说明：** 当某一 Phase 的 capability 合入协议时，应把对应门禁勾选为完成，并在 `CHANGELOG` 与（如需要）新的 `1x-*-release-goals.md` 中留下该 MINOR 的发布门禁；本文件保留轨道级视图，避免与单一版本门禁文档混淆。
