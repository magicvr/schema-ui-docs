---
status: proposed
date: 2026-07-27
applies_to: schema-ui-protocol v2.5 (draft)
track: 应用级协议（新轨道；本 ADR D0 含章程范围声明修正）
---

# ADR-0025: 应用级清单（app manifest）——页面发现与应用元信息

## 状态

**Proposed（草案，待评审）。** 本 ADR 是「应用级协议」新轨道的第一篇；导航结构（菜单槽位/分组）拆分在 [ADR-0026](./0026-app-navigation.md)，依赖本 ADR 的页面注册表。

## 背景

现行协议自限于**单页**：`page.schema.json` 描述一棵 body Node 树，`meta` 仅有
`pageId/title/description/protocolVersion/requiredCapabilities` 五字段。页与页之间如何组织成一个应用，
协议完全留白（`docs/08` §11 甚至明示跨系统跳转「由宿主预注册能力处理」）。

消费侧实证（allinme.web-client 渲染器 + mock demo，13 屏全场景跑通后盘点）表明：一个全新的前端拿着
协议制品可以渲染任何单页，但**无法对接成一个应用**——以下每一条都只能靠双边私约：

1. **页面发现**：后端有哪些页、schema 从哪取（私约 `GET /api/schema/<screen>` + 前端硬编码屏列表）；
2. **页面 URL 形态**：深链接/路由样式（私约 `/screens/<screen>?query`）；
3. **应用元信息**：应用名、logo 等品牌位（无任何协议表达）。

这与项目初衷「任意前端与任意后端以最小配置对接使用」直接冲突：页面级互操作已达成，应用级互操作从未定义。
私约每多一条，「任意×任意」就塌缩为「一对一」。

## D0. 章程范围声明修正（前置）

章程使命现文为「前端 Renderer 与后端**页面生产方**共同遵守的协议」。本 ADR 被接受即意味着：

> 协议覆盖两层：**页面协议**（既有，零改动）与**应用级清单协议**（本轨道新增）。
> 应用级清单描述「页面如何被发现、组织为应用」，不描述任何单页内部结构。

`PROJECT_CHARTER.md` 使命节须随本 ADR 原子更新（一句话范围声明）。依赖方向不变：应用级清单
位于「核心规范 / ADR」层，同样经 Schema、conformance、验证器向下游投影。

## 业务锚点（MVP）

| 锚点 | 用户路径 | 协议落点 |
|---|---|---|
| A. 应用引导 | 前端仅凭 API `baseURL`（或显式 manifest URL）启动 → 获知应用身份与页面清单 | D1 清单获取 + D3 应用元信息 |
| B. 页面发现 | 前端按清单懒取任意页 schema 并渲染 | D4 页面注册表 |
| C. 深链接 | 用户直开 `/orders/detail?orderId=1001` → 前端定位注册页并按既有 `$context.route` 语义注入参数 | D4 route 模板 + ADR-0021 |

验收叙事：一个从未见过该后端的合规 Renderer，配置 API `baseURL` 后即可列出全部页面、逐页渲染、支持深链接——
零硬编码页面知识。

## 决策

### D1. 清单获取与协商

| 项 | 值 |
|---|---|
| 端点 | 默认 `GET {baseURL}/.well-known/schema-ui/app-manifest.json`；宿主可显式覆盖完整 URL（覆盖即唯一入口） |
| 方法 | 仅 GET（沿 ADR-0013 只读纪律） |
| capability | `app.manifest` |
| 版本声明 | 清单顶层 `protocolVersion`（MAJOR.MINOR），沿 ADR-0009 严格协商：未精确列出即 `UNSUPPORTED_PROTOCOL_VERSION`，缺失即 `MISSING_PROTOCOL_VERSION` |

- 清单获取失败（网络/非 2xx/解析失败）→ 应用级 fail-closed：Renderer 不得凭猜测渲染任何页面；
  错误码 `MANIFEST_LOAD_FAILED`（401/403 见 D6）。
- 清单是**一次性快照**：实例生命周期内不重新拉取；刷新须由宿主重建实例（沿 ADR-0003 `$context` 快照口径）。
- **well-known 路径说明**：默认路径使用 RFC 8615 风格的 `/.well-known/...` 前缀，但
  `schema-ui/app-manifest.json` **不是** IANA 注册的 well-known URI。本协议将其定为**约定默认入口**，
  不是互联网通用发现标准；生产环境可通过显式 manifest URL 完全绕过该路径。

### D1a. 清单版本与页面版本解耦

清单顶层 `protocolVersion` **只协商应用级清单能力**（本 ADR + ADR-0026），**不**约束、**不**暗示
注册表内各页 schema 的 `meta.protocolVersion`。

| 制品 | 协商对象 | 失败影响 |
|---|---|---|
| 清单 | 清单 `protocolVersion` + 清单 `requiredCapabilities` | 应用级 fail-closed，不进入任何页 |
| 单页 schema | 该页 `meta.protocolVersion` + 该页 `requiredCapabilities` | 仅该页拒绝；其他已协商页不受影响 |

因此合法：清单为 `"2.5"`，注册页分别为 `"2.1"` / `"2.4"` / `"2.5"`。装载 2.5 清单**不**要求全站页面升级。
页面协商算法与错误码沿 ADR-0009 / `docs/08`，本 ADR 零修改。

### D1b. 三类路径的解析基址（钉死）

清单字段里的「相对路径」**不是**同一基址。MVP 只允许下列形态，禁止混用猜测：

| 字段 | 形态 | 解析基址 / 用途 | 禁止 |
|---|---|---|---|
| 清单入口（默认） | `/.well-known/schema-ui/app-manifest.json` | 拼在 Renderer 的 **API `baseURL`** 之后（规则同 `docs/08` §6.1：`${baseURL}` 去尾 `/` + 以 `/` 开头的 path） | 不得改写为前端路由 |
| `pages[].schemaUrl` | 站内相对 path，可含 `{name}` | 同上，**API `baseURL`**；用于 GET 页 schema | 不得当作前端路由；不得发未解析 `{name}` |
| `pages[].route` | 站内相对 path 模板，可含 `{name}` | **应用路由根**（前端路由 path，**不**经 API `baseURL` 拼 HTTP） | 不得用于构造 schema/API 请求 |
| `app.logo.light` / `dark` | **二选一**（无占位符）：① 站内相对 path；② `https:` 绝对 URL | ① 拼 **API `baseURL`** 后加载；② **原样**作为图片 URL 加载（CDN / 对象存储） | `http:`、`data:`、其它 scheme；相对 path 不得含 `{name}` |

补充：

- **API `baseURL`**：即既有 Renderer 初始化参数 `baseURL`（`docs/08` §6.1），本 ADR 不新增第二套 API 基址字段。
- **应用路由根**：由宿主路由系统解释；协议只规定 `route` 模板与当前 path 的匹配算法（D4a），不规定 history 模式、hash 模式或部署子路径如何剥离——宿主须保证交给匹配算法的 path 已是「应用内 path」（与 ADR-0021 `$context.route.path` 口径一致：baseURL 之后的应用路径）。
- **API 与前端不同源**是合法部署：清单与 `schemaUrl`、以及相对形态的 `logo` 走 API 域；`https:` logo 可指向 CDN；`route` 只参与前端路由，从不拼到 API host。
- 站内相对路径正则沿 navigate / DataRef 纪律：`^/(?!/)[^\s\\]*$`（`route`/`schemaUrl` 在占位符形态下允许 `{name}` 段，见 D4）。
- **`logo` URL 形态（M0）**：相对 path 同上（且无 `{` `}`）；绝对 URL 须匹配 `^https://[^\s\\]+$`（字面 `https://` 前缀；不在协议层做 DNS/证书校验）。
### D2. 清单顶层结构

```yaml
protocolVersion: "2.5"
requiredCapabilities: [app.manifest]   # 清单自身消费所需；navigation 见 ADR-0026
app:        { ... }                    # D3
pages:      [ ... ]                    # D4
navigation: { ... }                    # ADR-0026（可选；出现则须声明 app.navigation）
```

顶层 `additionalProperties: false`。`navigation` 在本 ADR 中仅预留键名。

- **不预留 `extensions` / 宿主私有字段命名空间**：未知顶层字段一律 fail-closed（沿「不认识即不支持」纪律）；
  确有扩展诉求走新 MINOR 评审，不开旁路。
- **`requiredCapabilities` 自指与门控（M1）**：
  - 清单必须声明 `app.manifest`（与页面 `meta.requiredCapabilities` 模式对称；对「已取到清单」的
    消费方是结构自检，不是运行时新信息）。
  - 出现 `navigation` 键时必须同时声明 `app.navigation`，且 `protocolVersion` 精确为 Renderer
    已支持的清单版本（字段集→版本下限 `"2.5"`，沿审计 0064 纪律）。
  - 缺 `app.manifest`、或有 `navigation` 无 `app.navigation` → M1 拒绝，不得部分消费。

### D3. 应用元信息（`app`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `appId` | string | ✅ | 应用稳定标识；pattern `^[a-z][a-z0-9_-]*$`（清单侧独立约束——现行页面协议对 `meta.pageId` 无命名约束，本 ADR 不反向收紧页面协议） |
| `name` / `nameKey` | string | 至少一 | 应用显示名（i18n 双轨；清单侧规则见交付清单，语义对齐 `docs/01` §6） |
| `logo` | object | — | `{ light: url, dark: url }`，`dark` 可缺省回退 `light`；url 为站内相对 path **或** `https:` 绝对 URL，解析见 D1b |
| `description` / `descriptionKey` | string | — | 说明文案 |

- `logo` 是**资源引用元数据**，不是样式：不触碰 node props 的 CSS 禁令（该禁令针对 Node，本表不在 Node 树中）。
- 允许 `https:` 是为 CDN / 对象存储品牌资源；**不**因此开放跨系统 navigate 或其它绝对 URL 字段。
- 明确不做：favicon、多主题多尺寸 logo 矩阵、内联 `data:` / base64、`http:` logo（皆列非目标）。

### D4. 页面注册表（`pages[]`）

每项：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pageId` | string | ✅ | 全清单唯一（M1 校验）；**须等于**该页 schema `meta.pageId`（字符串相等，无格式约束——页面侧 `pageId` 仍为普通 string），不等 → 运行时 `MANIFEST_PAGE_ID_MISMATCH` |
| `title` / `titleKey` | string | 至少一 | 列表/标题展示用；页面自身 `meta.title` 渲染时优先 |
| `schemaUrl` | string | ✅ | GET 该页 schema 的站内相对路径（API `baseURL`，D1b）；可含 `{name}` 占位 |
| `route` | string | ✅ | 前端路由 path 模板（应用路由根，D1b）；可含 `{name}`；深链接与 navigate 的对接锚点 |

- **路由参数语义**：`route` 中 `{name}` 命中的实参进入 `$context.route.params.<name>`，query 进入
  `$context.route.query.*` ——完全沿 ADR-0021 既有快照语义，本 ADR 不新增表达式能力。
- **`schemaUrl` 占位绑定**：两条规则作用点不同——
  **静态（M1）**：`schemaUrl` 的 `{name}` 集合必须 ⊆ `route` 的 `{name}` 集合；
  **运行时**：构造 schema 请求前，`schemaUrl` 的每个 `{name}` 必须已由当前路由实参解析，任一未解析
  即拒绝请求（fail-closed，语义对齐 `docs/07` §3.2 的 `MISSING_PATH_BINDING`；不得保留未解析
  `{name}` 片段发请求。多余绑定不可能出现——实参仅来自 route 匹配结果，故不涉及 `EXTRA_PATH_BINDING`）。
- **无 `hidden` 字段（决策）**：注册表项不进入任何导航槽位即自然「只可发现、不进菜单」——导航（ADR-0026）
  只引用要展示的页，`hidden` 是冗余自由度，不设。
- **navigate 接缝**：既有 `type:navigate` 的 `url` **不强制**命中注册表（保持 v2.x 兼容）；若 url 的 path
  部分能按 D4a 命中某注册 `route`，宿主**宜**按注册表打开并填充 `$context.route`（conformance 覆盖
  「命中则注入」正例，但不把「未命中则拒绝 navigate」列为错误）。是否升级为强制命中留待后续 MAJOR
  评估（非目标）。
- 注册表是**发现面不是权限面**：清单列出某页 ≠ 当前用户可访问；页面自身权限与后端鉴权照常生效（fail-closed 分层）。

### D4a. 路由模板匹配算法（MVP 确定性规则）

本算法是深链接定位、`$context.route.params` 注入、以及 ADR-0026 当前菜单项高亮的**唯一权威**。
输入：应用内 path 字符串 `P`（不含 query；与 `$context.route.path` 同口径）与注册表
`pages[].route` 模板集合。输出：至多一个命中项 + params 映射，或未命中。

**模板语法（M1 强制）：**

1. `route` 必须以 `/` 开头；按 `/` 分段（首空段丢弃；不允许空段，即禁止 `//`）。
2. 每一段要么是**字面量**（不得含 `{` `}`），要么是**命名参数** `{name}`，其中
   `name` 匹配 `^[a-zA-Z_][a-zA-Z0-9_]*$`。
3. **不允许**：可选段、通配 `*`、正则段、尾部可选斜杠语法、query 写进 `route` 模板。
4. 同一 `route` 模板内 `{name}` 不得重复；全清单 `route` 模板字符串不得重复（M1）。

**匹配步骤：**

1. 将 `P` 按 `/` 分段（同样禁止因规范化产生的空段；比较前不对 `P` 做 Unicode 折叠；**不**自动去尾 `/`，
   故 `/orders` 与 `/orders/` 是不同 path——生产方应统一不生成尾 `/`，或显式注册需要的形态）。
2. 候选 = 所有「段数与 `P` 相同」的 `route` 模板。
3. 对每个候选逐段比较：字面量段必须全等；`{name}` 段消费 `P` 对应段（解码后的 path 段字符串，
   作为 `params[name]`；空字符串段不合法，该候选失败）。
4. 多候选同时成功时：**最长模板优先**——以模板字符串长度（字符数）降序；仍并列则取
   `pages[]` **声明序更靠前**者。conformance 必须覆盖并列与声明序。
   **不**在 M1 做「可重叠模板对」静态互斥（配置灵活优先；消歧规则短且可测）。
5. query **不参与** path 匹配；query 原样进入 `$context.route.query`（值一律字符串，沿 ADR-0021）。

**生产方宜避免可重叠模板**（informative，非 M1 错误）：例如同时注册 `/orders/{id}` 与
`/orders/new` 时，应依赖「最长优先」得到确定性结果，或改写为不重叠的字面量路径。重叠时
行为以本算法为准，不得由各 Renderer 自行选择。

**未命中：** 深链接无法定位注册页 → 宿主按自身 404/兜底策略处理；协议不规定 404 UI。
不得回退猜测「最接近」模板（与 ADR-0009 不做最近版本推断同纪律）。

### D5. `$context` 衔接（引用，非新增）

`$context.user` 最小字段集（`id`/`name`/`roles`）、`$context.features`、`$context.route` 均已由
ADR-0003 / ADR-0021 / `docs/02` §11 定义，本 ADR **零新增、零修改**；仅补一条生产方义务：
清单驱动的页面被打开时，宿主必须按 D4 / D4a 路由语义填充 `$context.route`
（`path` / `params` / `query`）。

### D6. 鉴权与错误语义（清单级）

- 清单或页 schema 获取遇 `401/403`：处理序对齐 `docs/07` §8.1（认证失败优先、吞掉其余 outcome）；
  Renderer 不得渲染部分应用骨架后悬挂。
- 错误码新增：`MANIFEST_LOAD_FAILED`、`MANIFEST_PAGE_ID_MISMATCH`、`UNKNOWN_MANIFEST_FIELD`、
  `MANIFEST_ROUTE_AMBIGUOUS`（仅当实现未按 D4a 消歧而检测到无法决断时的防御码；合规实现按 D4a
  消歧后不应在正常路径抛出）、`MISSING_PATH_BINDING`（schemaUrl 占位未解析，对齐 `docs/07`）。
- `UNKNOWN_MANIFEST_FIELD` 与 D2 的 `additionalProperties: false` 是**两道防线，不重复定义**：
  CI/生产方侧由 M0 结构校验拒绝；未前置校验的 Renderer 在运行时解析清单遇未知顶层字段时以该码
  fail-closed 兜底（与页面管线 L0 + Renderer 兜底的分层一致）。
- token 如何获取/刷新是宿主职责（章程非目标：不提供鉴权），协议只定可观测失败行为。

## 校验层级命名（M 系列，本轨道权威定义）

清单是独立于页面文档的制品，其校验管线以 **M 系列**命名，与页面管线 L0–L4（`docs/06` §1）平行、
互不混用；页面管线定义零改动：

| 层级 | 对应页面管线 | 工具 | 校验内容 |
|---|---|---|---|
| M0 清单结构校验 | L0 | `schemas/app-manifest.schema.json`（AJV） | 顶层结构、字段类型、`additionalProperties: false`、`protocolVersion` 格式 |
| M1 清单语义校验 | L2 | 辅助实现（脚本） | 唯一性、引用完整性、url 正则、占位符集合关系、route 模板语法、字段集→版本下限、capability 门控等跨字段规则 |
| M3a 清单表达式静态校验 | L3a | 复用 L3a 规则实现 | `navigation` 各项 `visibleWhen` / `permissions` 的静态合法性（ADR-0026；**规则原样复用 L3a 非表单上下文规则**，仅作用域改为清单制品） |

## 校验与 conformance（原子交付清单）

- 新 `docs/schemas/app-manifest.schema.json`（M0）+ 规范正文 `docs/16-app-manifest.md`
  （含上表 M 系列层级定义、D1b 基址表、D4a 匹配算法正式入档）；
- M1 语义校验：`pageId` 唯一、`appId` pattern、`schemaUrl`/`route` 路径正则、
  `logo.*` 相对 path 或 `https:` 形态、route 模板语法、`route` 模板字符串唯一、
  占位符集合包含关系、`title`/`titleKey` 至少一、`requiredCapabilities` 含 `app.manifest`、
  有 `navigation` 则含 `app.navigation`、顶层未知字段拒绝；
- `docs/16` 须**显式定义**清单字段的 i18n 双轨（词典查询 + fallback 规则，语义同 `docs/01` §6）——
  §6 现文自限于 Node `props`，对清单字段不能仅以引用带过；
- conformance 新 suite `app-manifest`：版本协商正负例、清单/页面版本解耦、注册表解析、
  pageId 不匹配、D4a 深链接匹配（字面量、命名参数、最长优先、声明序并列、尾 `/` 不自动归一）、
  schemaUrl 基址与占位绑定、logo 相对 path 拼接与 `https:` 原样加载、`http:`/`data:` logo 拒绝、
  获取失败 fail-closed；
- CHANGELOG + migration（v2.4 → v2.5 additive，无迁移动作）+ 章程使命节修正（D0）。

## 明确非目标（MVP）

- 页面 schema 内嵌于清单（仅懒取）、schema 缓存/ETag 策略、清单增量更新与运行时推送；
- 多应用聚合/工作台、租户切换、favicon、logo 资产分发与尺寸矩阵、`http:` / `data:` logo；
- 后端鉴权协议（token 获取/刷新）、登录页规范；
- `navigate` url 强制命中注册表（兼容性保留）；
- route 可选段 / 通配 / 正则 / 尾斜杠自动归一；
- route 可重叠模板的 M1 静态互斥（运行时按 D4a 消歧）；
- 面包屑（见 ADR-0026 非目标）。

## 对消费者的影响

- 后端：可选实现——不提供清单则一切照旧（页面级对接不受影响）；提供即获得「零私约应用对接」。
- 前端：声明 `app.manifest` capability 才须实现；未声明的既有 Renderer 完全不受影响（MINOR + capability 双重门控，沿 `docs/06` 版本下限纪律，字段集下限 `"2.5"`）。

## 开放问题（评审裁决点）

无。下列问题已在评审中裁决并写入正文：

| 问题 | 裁决 |
|---|---|
| well-known 默认路径 | **采用** `/.well-known/schema-ui/app-manifest.json`，并注明非 IANA 注册约定（D1） |
| `pages[]` 是否设 `hidden` | **否**——注册不进导航是自然状态（D4） |
| 是否预留 `extensions` | **否**——未知顶层字段 fail-closed（D2） |
| 清单版本与页面版本 | **解耦**（D1a） |
| 三类路径解析基址 | 见 D1b；`logo` 允许相对 path 或 `https:` |
| `logo` 是否允许绝对 URL | **允许 `https:`**；禁 `http:` / `data:`（D1b / D3） |
| route 多候选消歧 | **最长模板优先，并列取 `pages[]` 声明序**；不做 M1 静态互斥；宜避免重叠（D4a） |
