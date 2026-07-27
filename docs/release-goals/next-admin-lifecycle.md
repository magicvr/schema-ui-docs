---
status: active
owner: 前后端架构组
last_updated: 2026-07-28
applies_to: schema-ui-protocol v2.5 (post-v2.5 track; Phase D.1 backlog)
---

# 下一步目标：Admin 生命周期协议轨道

本文档确立 **v2.0 之后** 的协议演进方向，把 [ADR-0019](../decisions/0019-v2-admin-scope.md) 已明确排除的「完整 Admin 生命周期」落成可执行的目标与优先级，并记录 **v2.5 之后仍待升格的一等公民 backlog**。

它**不是**任一版本的发布门禁，也不改变已发布页面/清单的合法语义。在对应 capability、ADR、Schema 与 versioned fixtures 原子落地之前，下列能力**不得**被描述为协议已支持，也不得要求标准 Renderer 通过私有 handler 猜测实现。

历史门禁：[`v2.0.md`](./v2.0.md) … [`v2.5.md`](./v2.5.md)。应用级清单/导航为**平行轨道**（ADR-0025/0026，规范 [`09-app-manifest.md`](../09-app-manifest.md)），不并入本文件的页面 Admin Phase 编号，但在 §8 状态表中交叉记录。

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

**v2.1–v2.5 已交付**上表中的主 CRUD 生命周期与应用壳（见 §4 / §8）。当前缺口转向：**表单表达力**、**运营批处理闭环**与少数结构化列表增强（见 §4 Phase D.1）。

## 2. 轨道原则

1. **底座不回退：** 不削弱 v2.0 的版本协商、query 序列化、DataRef 只读、Action 重试与行级 request 语义。
2. **优先 MINOR + capability：** 新增字段与执行能力通过 `meta.requiredCapabilities` / Renderer `supportedCapabilities` 协商；默认不强制所有 v2.0 Renderer 同日支持。
3. **禁止伪装支持：** Host Extension 可以继续服务单项目，但不得写入核心规范示例，也不得进入跨实现 conformance 正例。
4. **原子交付：** 每项能力包必须同时更新 ADR、核心规范、Schema/DSL、L2/L3a、JS/Python fixtures、官方场景与 CHANGELOG；见根 [`PROJECT_CHARTER.md`](../../PROJECT_CHARTER.md)。
5. **先定边界再写字段：** 每个 capability 的 ADR 必须写清 MVP 范围、明确非目标、失败策略与迁移影响，再进入 Schema。
6. **MAJOR 仅用于破坏：** 仅当必须改变既有合法输入、默认值或可观测结果时，才评估下一 MAJOR。

## 3. 范围总览

### 3.1 已交付底座（本轨道不重复建设）

| 能力 | 主要锚点 | 制品 |
|---|---|---|
| 布局 / 展示 / 列表分页 | `03` / `04` / ADR-0011 | ≤2.0 |
| 搜索表单筛选表格 | `form.mode: search` | ≤2.0 |
| 行内声明式 request | ADR-0008 / `actions.row.request` | ≤2.0 |
| 基础表单提交、上传、联动 | `07` / ADR-0012 / `02` | ≤2.0 |
| 节点与列/操作级权限显隐 | `permissions` / ADR-0003 | ≤2.0 |
| 页面工具栏 / actionButton | ADR-0020 | 2.1 |
| 行导航 + form 记录回填 | ADR-0021 | 2.1 |
| 当前页多选 + 批量 request | ADR-0022 | 2.2 |
| 容器权限继承 | ADR-0023 | 2.3 |
| 只读 `recordView` | ADR-0024 | 2.4 |
| 应用清单 / 导航 / 表排序声明 | ADR-0025 / 0026 / 0027 · [`09`](../09-app-manifest.md) | 2.5 |

### 3.2 本轨道目标能力（完整 Admin 生命周期）

| 优先级 | 能力包（工作名） | 业务问题 | 状态 |
|---|---|---|---|
| **P0** | 页面级动作入口 | 新建、页面工具栏声明式 Action | **已交付** [0020](../decisions/0020-page-action-trigger.md) |
| **P0** | 记录导航与编辑回填 | 列表进编辑；加载并回填 | **已交付** [0021](../decisions/0021-record-navigation-and-form-load.md) |
| **P1** | 表格选择与批量 | 当前页多选、批量 request | **已交付** [0022](../decisions/0022-table-selection-and-batch-request.md) |
| **P1** | 权限继承 | 容器 edit/delete 级联 | **已交付** [0023](../decisions/0023-container-permission-inheritance.md) |
| **P2** | 标准详情 | 只读 record view | **已交付** [0024](../decisions/0024-record-view.md) |
| **P2+** | 待增补一等公民 | 表单控件面、子表、导入导出、异步任务、树表等 | **backlog**（§4 Phase D.1；**未立项**） |

**Accepted 之前**的候选 **不进入** `08-renderer-spec` 预定义 capability 表与 Schema。

### 3.3 明确非目标（本轨道默认不做）

- 不提供生产 Renderer、组件库皮肤或业务后端；
- 不把 Host 私有实现回写成「协议已支持」；
- 不把登录 / OAuth / token、权限中台、工作流引擎、主题 token、列宽用户偏好等塞进核心页面协议（章程非目标或呈现层）；
- 应用壳增强（面包屑、菜单 badge、第二侧边栏、logout 动作类型等）默认留在应用级平行轨道，见 [v2.5.md](./v2.5.md) §1.4，**不**因本文件 D.1 自动立项。

## 4. 分阶段目标

### Phase A — 立项与边界（文档阶段）

- [x] 以 ADR-0019 确认完整 Admin 生命周期不属于 v2.0 核心。
- [x] 本文档确立下一步目标、优先级与版本策略。
- [x] 选定第一包 MVP 业务锚点（见 §4.1）。
- [x] 为 P0 起草候选 ADR：[0020](../decisions/0020-page-action-trigger.md)、[0021](../decisions/0021-record-navigation-and-form-load.md)。

### 4.1 已锁定的 MVP 业务锚点（历史，2.1）

第一包只服务下列页面形态；批量与跨页选择**不在**本包：

| 锚点 | 用户路径 | 协议落点 |
|---|---|---|
| A. 列表工具栏新建 | 列表 → 工具栏「新建」→ 创建页或创建弹窗 | ADR-0020：`table.toolbar` / `actionButton` → `navigate` \| `modal` |
| B. 行进编辑 | 列表行「编辑」→ 带 id 的编辑页 | ADR-0021：`RowAction` + `navigateMapping` → `$context.route` |
| C. 编辑回填提交 | 编辑页加载记录 → 改字段 → 提交 | ADR-0021：`form.recordSource` + 既有 `submitAction` |

### Phase B — P0：页面入口 + 记录读写闭环（已发布 2.1）

- [x] ADR-0020 / 0021 `accepted`；Schema / L2 / fixtures / 扩展示例 / `2.1.0` 制品。详见 [`v2.1.md`](./v2.1.md)。

### Phase C — P1：选择与批量（已发布 2.2）

- [x] ADR-0022：当前页多选 + 批量 request。详见 [`v2.2.md`](./v2.2.md)。

### Phase C.1 — P1 补齐：权限继承（已发布 2.3）

- [x] ADR-0023：`permissionCascade` / `permissionIntent`。详见 [`v2.3.md`](./v2.3.md)。

### Phase D — P2 与运营增强

#### D.0 标准只读详情（已发布 2.4）

- [x] ADR-0024 · `record.view.load`。详见 [`v2.4.md`](./v2.4.md)。

#### D.0b 平行轨道：应用壳与表排序（已发布 2.5，非本 Phase 编号）

- [x] ADR-0025 / 0026 / 0027 · `app.manifest` / `app.navigation` / `table.sort`。详见 [`v2.5.md`](./v2.5.md)、[`09-app-manifest.md`](../09-app-manifest.md)。

#### D.1 待增补一等公民（backlog；**当前不立项、不写 Schema、不进 conformance 正例**）

> **权威说明：** 下表是 **informative 规划清单**，不是语义规范。实现方可继续用 Host Extension，但**不得**伪装为协议已支持。立项时必须：独立 ADR（MVP + 非目标 + 失败策略）→ Schema/L2/fixtures 原子交付 → MINOR + capability。  
> 优先级反映「中小型软件项目典型 admin」覆盖缺口（2026-07 评估），可按真实生产痛点重排；**不得**因本表存在而跳过 ADR。

##### D.1.1 建议优先（高频、少 Host 即难撑完整 CRUD 表单）

| ID | 候选 | 业务问题 | 与现状关系 | 建议触发条件 |
|---|---|---|---|---|
| **F1** | 表单控件面扩展 | 备注、布尔开关、单选、多选、级联等 | 现仅 `input` / `inputNumber` / `select` / `datePicker` / `dateRangePicker` / `upload` | 多实现要对齐同一套字段 type 与提交投影；避免各 Host 私有 type 分叉 |
| F1a | `textarea` | 长文本、驳回原因、描述 | 无 | 可与 F1 同包最小交付 |
| F1b | `switch` / `checkbox` | 启用禁用、布尔配置 | 无 | 提交值为 boolean 的 wire 需写清 |
| F1c | `radio` / 按钮组 | 少量互斥枚举 | 可用 `select` 凑合 | 展示语义需与 select 区分时 |
| F1d | 多选 `select` / tag | 角色、标签、多类目 | `select` 现为单值 | 数组提交与 query 序列化边界需 ADR |
| F1e | 级联选择 | 省市区、类目树 | 无 | 选项树数据契约与 path 取值需独立定 |
| **F2** | 嵌套 / 子表单（array of objects） | 订单明细行、多联系人、SKU 规格 | `bodyMapping` 与字段模型偏扁平标量 | 出现跨实现一致的可重复区块 / 行编辑提交需求 |
| **F3** | 导入向导 | 批量导入、行级校验失败回显 | 仅有单文件 `upload` | 多实现要对齐步骤、错误表与部分成功策略 |
| **F4** | 导出（当前筛选） | 按列表筛选导出文件/任务 | 无标准「导出当前 query」 | 与 search-table 状态机、长任务（F5）边界需先划清 |
| **F5** | 异步任务 / 长操作结果 | 大导出、批量改价、重建索引 | 一次 HTTP Action 不够 | 出现可声明的任务 id / 进度 / 结果回跳跨页契约 |

建议落地节奏（非门禁）：**F1（可先 F1a–F1c）→ F2 → F3/F4（可拆 capability）→ F5**。每一项单独 MINOR，禁止「表单大爆炸」单 PR 吞并。

##### D.1.2 按域触发（一类业务会卡，非每个项目都要）

| ID | 候选 | 业务问题 | 与现状关系 | 建议触发条件 |
|---|---|---|---|---|
| **L1** | 树表 / 可展开行 | 组织、类目、菜单、权限树 | 无 `$parentRow`、无嵌套挂载 | 需要标准父子行与嵌套结构 |
| **L2** | 行内编辑 | 列表直接改状态/排序值 | 须进编辑页或 row request 凑 | 高频且与 form 生命周期边界清晰 |
| **L3** | 跨页全选当前筛选全集 | 「全选匹配筛选的 N 条再批量」 | ADR-0022 仅当前页；筛选/翻页清空 | 与 0022 键模型冲突，必须新 ADR |
| **L4** | 批量部分成功 | 整批中部分行失败需行级回显 | 0022 整批一次 HTTP | 与整批语义冲突，需新 outcome 模型 |
| **L5** | 多步向导 / Steps | 开户、上架、复杂创建 | 无 step 容器与跨步状态 | 多页拼凑成本高且要互操作 |
| **L6** | 标准抽屉 / 侧滑详情 | 列表不离页看详情 | 有 `modal`；drawer 路由库非目标 | 仅当 modal 不足以对齐多实现 |
| **L7** | `recordView` 操作条 | 详情「编辑 / 作废 / 复制」 | 可用同页 `actionButton` 拼 | 先观察 actionButton 是否足够；不够再立挂载点 |

##### D.1.3 体验打磨（默认可后置；多数属呈现或应用壳）

| ID | 候选 | 说明 |
|---|---|---|
| U1 | 面包屑 / 菜单 badge / 第二侧栏 | 应用级；v2.5 明确非目标 |
| U2 | 多列排序 / client 本地排序 | 0027 MVP 仅单列 server sort |
| U3 | 列设置 / 密度 / 用户偏好 | 呈现层，默认不进核心协议 |
| U4 | 主题 token / 皮肤 | 章程非目标 |

##### D.1.4 继续留在 Host / 章程非目标（不要升一等公民）

| 项 | 理由 |
|---|---|
| 登录 / OAuth / token 刷新 | 章程非目标；协议只消费宿主注入的身份快照 |
| 权限中台 / RBAC 配置 UI | `$context.user` + 后端鉴权即可；中台是另一产品 |
| 工作流引擎编排 | 超出页面协议；可用行级 request 表达单步动作 |
| 任意 `custom` handler 升格为标准按钮目标 | 破坏「意图声明、实现在前端」边界（见 ADR-0020） |

门禁原则不变：每项须独立 ADR → Schema/L2/fixtures 原子交付 → MINOR + capability。**本 §D.1 的勾选完成，不构成任何 `protocolVersion` 升版。**

## 5. 版本与发布策略

| 变化类型 | 版本建议 | 说明 |
|---|---|---|
| 文档轨道、本 backlog 修订、ADR 草案 | 不升协议 `protocolVersion` | 不改变合法页面/清单 |
| 新增兼容字段 + capability，旧输入仍合法 | **MINOR** | 按需 `requiredCapabilities` |
| 文档勘误、示例、fixtures 补齐且不改结果 | **PATCH** | |
| 破坏既有合法输入、默认值或可观测结果 | **下一 MAJOR** | 需独立发布目标与迁移 |

已发布节奏（历史）：

1. `2.1` — Phase B（0020 + 0021）
2. `2.2` — Phase C（0022）
3. `2.3` — Phase C.1（0023）
4. `2.4` — Phase D.0（0024）
5. `2.5` — 平行轨道：应用清单/导航 + `table.sort`（0025–0027）
6. 更后 MINOR — Phase D.1 按 §4 D.1 单独立项

## 6. 成功标准

**主 CRUD 轨道（P0 / P1 / D.0）已达成**，当且仅当（历史门禁均已勾选）：

1. ADR-0019 列出的 P0 与 P1 已有已接受 ADR、fixtures 与对应发布门禁；
2. 至少两个独立实现（或 JS/Python reference + 一个生产 Renderer）对同一配置给出一致行为；
3. 未声明对应 capability 的旧 MINOR 页面行为不变；
4. 官方/扩展示例覆盖工具栏新建、行进编辑、当前页批量、详情、权限继承中的已交付子集。

**D.1 backlog 不纳入上述阻断条件。** 单条候选的成功标准在其 ADR / `vX.Y.md` 门禁中定义。

## 7. 与现有文档的关系

| 文档 | 关系 |
|---|---|
| [`v2.0.md`](./v2.0.md) … [`v2.5.md`](./v2.5.md) | 各 MINOR 历史/当前发布门禁；本文件不替代它们 |
| [`decisions/0019-v2-admin-scope.md`](../decisions/0019-v2-admin-scope.md) | 界定 v2.0 不含完整 Admin；本文件是其后续执行轨道 |
| [0020](../decisions/0020-page-action-trigger.md) … [0024](../decisions/0024-record-view.md) | 页面 Admin 生命周期已接受 ADR |
| [0025](../decisions/0025-app-manifest.md) / [0026](../decisions/0026-app-navigation.md) / [0027](../decisions/0027-table-sort-declaration.md) | 应用级与表排序；平行于本轨道 |
| [`09-app-manifest.md`](../09-app-manifest.md) | 应用级规范正文（原短暂编号 `17`，现与 `00`–`08` 连续） |
| [`PROJECT_CHARTER.md`](../../PROJECT_CHARTER.md) | 变更门禁与权威层级 |
| `docs/audit/` | 过程记录；结论须沉淀回规范/ADR/本文件/CHANGELOG |

## 8. 当前状态

| 项 | 状态 |
|---|---|
| 协议制品 / 协议线 | `2.5.2` / `"2.5"`（见 `protocol-manifest.json`） |
| 页面 Admin 主路径 | **Phase B / C / C.1 / D.0 已发布**（2.1–2.4） |
| 应用壳 + 表排序 | **2.5 已发布**（0025–0027；规范 `09`） |
| Phase D.1 | **backlog 已登记**（§4 D.1.1–D.1.4）；**无一候选已立项** |
| 建议下一步 | 按真实痛点从 **F1 表单控件面** 或 **F3/F4 导入导出** 中择一起草 ADR；不得以 Host 私货扩张已交付边界 |

---

**维护说明：** 当某一 D.1 候选合入协议时：勾选/移出 backlog 表 → 新 `docs/release-goals/vX.Y.md` 门禁 → `CHANGELOG`；本文件保留轨道级视图。proposed ADR 在 `accepted` 前不得进入 `protocol-manifest.json` 的 `authority.semanticSpecs`。
