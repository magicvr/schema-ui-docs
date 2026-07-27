---
status: proposed
date: 2026-07-27
applies_to: schema-ui-protocol v2.5 (draft)
track: 应用级协议（依赖 ADR-0025 应用级清单）
---

# ADR-0026: 应用导航结构（navigation）——菜单槽位、分组与权限过滤

## 状态

**Proposed（草案，待评审）。** 依赖 [ADR-0025](./0025-app-manifest.md)（清单容器与页面注册表）；
独立 capability，可与 `app.manifest` 分离实现（只发现不导航的嵌入式宿主合法）。

## 背景

协议对「页面如何组织成菜单」零表达：全库对 menu/侧边栏/面包屑的唯一提及是 ADR-0020 把
「下拉菜单式更多操作」列为非目标；`meta` 无图标、无分组、无槽位、无排序字段。消费侧的直接后果：
后端每新增一页，每个前端都要手改菜单配置——「最小配置对接」在应用层不成立（实证见 ADR-0025 背景）。

菜单还有一个页面协议管不到的语义：**同一批页面在不同 UI 位置（顶栏 / 用户菜单 / 侧边栏）以不同
分组呈现**。这是纯应用级信息，必须由页面生产方声明、前端消费，否则不可互操作。

## 业务锚点（MVP）

| 锚点 | 用户路径 | 协议落点 |
|---|---|---|
| F. 主导航 | 用户在侧边栏看到按业务域分组的页面入口 | `sidebar` 槽位 + 分组 |
| G. 顶栏入口 | 高频页面平铺在顶栏 | `top` 槽位 |
| H. 用户菜单 | 头像下拉：个人设置、退出等 | `user` 槽位 |
| I. 按角色裁剪 | viewer 看不到管理入口 | 菜单项 `visibleWhen`/`permissions` 过滤 |

验收叙事：同一后端换任意合规前端，菜单结构、分组、可见性完全一致；后端加页面 = 只改清单
（新清单在前端**重新引导（重建应用实例）后**生效——清单是一次性快照，沿 ADR-0025 D1，不承诺运行时热更新）。

## 决策

### D1. capability 与门控

| 项 | 值 |
|---|---|
| capability | `app.navigation` |
| 载体 | ADR-0025 清单顶层 `navigation` 键 |
| 门控 | 清单出现 `navigation` 则其 `requiredCapabilities` 必须含 `app.navigation`（且须含 `app.manifest`），且清单 `protocolVersion` 满足字段集下限 `"2.5"`（M1 校验；M 系列层级定义见 ADR-0025「校验层级命名」，沿 `docs/06` 审计 0064 字段集→版本下限纪律） |

- 仅声明 `app.manifest`、不声明 `app.navigation` 的宿主：必须忽略（不得部分解析）`navigation` 键——
  若清单仍含 `navigation` 却未声明 capability，属生产方 M1 错误；合规清单在无导航能力时不应包含该键。
- 清单版本与页面版本解耦沿 ADR-0025 D1a：导航能力不迫使注册页升级 `meta.protocolVersion`。

### D2. 槽位（slot）——封闭枚举

```yaml
navigation:
  top:     [ ...items ]   # 顶栏主导航
  sidebar: [ ...items ]   # 侧边栏主导航
  user:    [ ...items ]   # 用户（头像）菜单
```

- 三槽位均可选；`navigation` 为 `additionalProperties: false`——**未知槽位 = 结构错误**（fail-closed），
  不做「自定义槽位字符串」扩展点。
- **左/右是呈现不是语义**：`sidebar` 渲染在左还是右由前端主题/RTL 决定，协议不表达（与 CSS 边界一致）。
  需要第二侧边栏的诉求列非目标，出现真实场景再走新 ADR。

### D3. 菜单项与分组（一层分组封顶）

`items[]` 元素二选一（`oneOf`，形状互斥）：

**link 项**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pageRef` | string | 与 `url` 二选一 | **主路径**：指向 ADR-0025 注册表 `pageId`（M1 引用完整性校验） |
| `url` | string | 与 `pageRef` 二选一 | **逃逸口**：应用内 path（正则沿 navigate url；**不**经 API `baseURL` 拼 HTTP，口径同 ADR-0025 D1b 的 `route`）；用于未注册的宿主页（如宿主自有设置页、登出落地 path） |
| `label` / `labelKey` | string | `pageRef` 缺省取注册表 title；`url` 项至少一 | i18n 双轨 |
| `icon` | string | — | **语义名**（`^[a-z][a-z0-9-]*$`，如 `orders`、`settings`），非资源 URL |
| `visibleWhen` | VisibleWhen | — | 复用 `node.schema.json#/definitions/VisibleWhen`；非表单上下文——仅 `$context.user.*` / `$context.features.*`（既有规则原样适用） |
| `permissions` | object | — | 仅允许 `view` 键（M1 校验），值语义沿 ADR-0003 / ADR-0023 的 view 可见性（只收紧） |

约束与口径：

- **`pageRef` 是发现面主路径**：可互操作的业务页应先注册于 `pages[]`，再用 `pageRef` 挂菜单；
  `url` 不得成为「绕过注册表挂业务页」的常规做法（规范正文须写清；M1 不禁止 `url`，conformance
  以 `pageRef` 用例为主向量）。
- **`url` 不做协议级动作语义**：例如「退出登录」若需出现在 `user` 槽位，用 `url` 指向宿主约定
  path（或由宿主在该 path 上执行登出）；协议**不**定义 logout 动作类型、不解析特殊 url scheme。
- **不设 `disabled`**：不可用入口应通过 `visibleWhen` / `permissions.view` 过滤掉；灰置是主题层
  呈现策略，不进协议（避免与「隐藏 vs 禁用」双语义漂移）。

**group 项**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `label` / `labelKey` | string | 至少一 | 组标题 |
| `icon` | string | — | 同上 |
| `items` | link[] | ✅ ≥1 | **仅 link 项**——组不嵌组（结构层强制，深嵌列非目标） |
| `visibleWhen` / `permissions` | 同 link | — | 组级过滤，与组内项过滤 AND 叠加 |

### D4. 确定性呈现算法（conformance 向量化）

1. **顺序**：数组序即呈现序，无 `order` 字段（少一个可漂移的自由度）；
2. **过滤**：对每项求 `permissions.view AND visibleWhen`（沿 `docs/01` §3.10 只收紧公式）；
   表达式静态非法 → 该项 fail-closed 隐藏并按 **M3a** 报告（规则原样复用 L3a 非表单上下文规则，
   仅作用域为清单制品，见 ADR-0025「校验层级命名」），不得整树崩溃；
3. **空组剪枝**：过滤后 `items` 为空的组必须整组不渲染；
4. **图标降级**：`icon` 语义名在前端图标注册表无映射 → **省略图标、正常渲染文本**（图标是呈现提示，
   非语义，此处显式偏离 fail-closed 并以本条为准）；
5. **当前项高亮**（匹配权威在 ADR-0025 D4a，本条只定义如何落到 link 项）：
   - 输入：当前应用内 path `P`（不含 query，同 `$context.route.path`）；
   - `pageRef` 项：取注册表对应 `route` 模板，用 D4a 判断是否命中该模板（**单项匹配**——不把其他
     `pages[]` 模板纳入候选；即高亮问的是「当前 path 是否匹配本 link 指向的页」，不是「全局谁最长」）；
   - `url` 项：**整 path 精确相等**（与 `P` 全等），**禁止**前缀匹配（避免 `/orders` 高亮误伤
     `/orders/detail`）；
   - 同一槽位多个 link 同时为真时：全部可标为 active（允许）；样式归主题层；
   - query **不参与**高亮匹配。

### D5. 菜单可见 ≠ 访问控制

菜单过滤是**呈现裁剪**：隐藏入口不构成权限边界，页面自身 `permissions` 与后端鉴权照常独立生效
（分层 fail-closed，与 ADR-0023 精神一致）。规范正文必须显式写明，防止消费方以菜单过滤替代鉴权。

### D6. 与清单基址 / 版本的关系（引用）

- `pageRef` 导航目标的 schema 获取、route 深链接，全部沿 ADR-0025 D1b / D4 / D4a；本 ADR 不重复定义。
- `url` 项只表达应用内 path，解析口径同 `pages[].route`（应用路由根），**不是** API 资源 URL。

## 校验与 conformance（原子交付清单）

- schema：并入 `app-manifest.schema.json`（`navigation` definitions）；
- M1 语义校验：槽位封闭、`pageRef` 引用完整性、`pageRef`/`url` 互斥、组不嵌组、`permissions` 仅 `view`、
  label/labelKey 至少一、`url` 路径正则、capability 门控（有 `navigation` ⇒ `app.navigation`）；
- conformance 新 suite `app-navigation`：三槽位解析、分组、权限/`visibleWhen` 过滤（含 roles contains 正负例）、
  空组剪枝、数组序稳定性、未知槽位拒绝、图标降级、当前项匹配（`pageRef` 单项 D4a、`url` 精确相等、
  query 不参与、多 active 允许）；
- 规范正文 `docs/16`（或专节）附 **icon 语义名建议词表**（informative，非规范）：至少覆盖
  `home`、`orders`、`users`、`settings`、`dashboard`、`report`、`help`、`logout` 等常见 Admin 入口；
  未在词表中的合法语义名仍须按 D4 降级规则处理，不得拒绝；
- CHANGELOG + migration（additive，无迁移动作）。

## 明确非目标（MVP）

- 面包屑（可由「注册表 + 当前路由」推导，观察真实需求后再议）；
- 徽标/红点（badge）、菜单项计数；
- 用户自定义菜单、收藏/置顶、折叠状态持久化；
- 运行时菜单推送/增量变更（清单快照口径，刷新 = 宿主重建实例）；
- 第二侧边栏槽位、横向二级菜单、mega menu；
- 图标资产分发（语义名 → 图形的映射完全归前端图标库/主题层）；
- 协议级「退出登录」动作类型 / 特殊 url scheme；
- link 项 `disabled` / 灰置语义。

## 对消费者的影响

- 后端：在清单上加 `navigation` 即获得跨前端一致的菜单；不加则前端自行组织（现状不变）。
- 前端：声明 `app.navigation` 才须实现 D4 算法；仅实现 `app.manifest` 的嵌入式宿主不受影响。

## 开放问题（评审裁决点）

无。下列原开放问题已在本修订中裁决并写入正文：

| 原问题 | 裁决 |
|---|---|
| `user` 槽位是否需要协议级「退出登录」语义项 | **否**——登出属宿主鉴权域；可用 `url` 指向宿主 path（D3） |
| link 项是否允许 `disabled` | **否**——不可用入口直接过滤；灰置归主题（D3） |
| icon 语义名是否给建议词表 | **是**——informative 附录，非规范（交付清单） |
