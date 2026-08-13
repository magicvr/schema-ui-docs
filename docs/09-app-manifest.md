---
status: stable
owner: 前后端架构组
last_updated: 2026-07-28
applies_to: schema-ui-protocol v2.8
---

# 应用级清单（app manifest）与导航

本文档是应用级协议的**规范正文**，投影 [ADR-0025](./decisions/0025-app-manifest.md) 与 [ADR-0026](./decisions/0026-app-navigation.md)。页面协议（`page.schema.json` / Node 树）零改动；本层描述「页面如何被发现、组织为应用」。

机器可读结构契约：[`schemas/app-manifest.schema.json`](./schemas/app-manifest.schema.json)（**M0**）。

---

## 1. 范围与 dual-track

| 制品 | 版本字段 | 协商对象 |
|---|---|---|
| 应用清单 | 顶层 `protocolVersion` | 仅应用级能力（本文件 + ADR-0025/0026） |
| 单页 schema | `meta.protocolVersion` | 沿 [ADR-0009](./decisions/0009-strict-version-negotiation.md) / [08](./08-renderer-spec.md)；与清单**解耦** |

合法：清单 `"2.5"`，注册页分别为 `"2.1"` / `"2.4"` / `"2.5"`。装载 2.5 清单**不**要求全站页面升级。页协商失败只拒该页。

应用清单本身是 **v2.5 字段集**：顶层 `protocolVersion` 必须 `>= "2.5"`（M1 `PROTOCOL_VERSION_TOO_LOW`）。**不得**把「页面可继续为 2.4」误读为「清单也可声明 2.4」。

未提供清单的 manifest 生产方：页面级对接与 v2.4 完全一致（应用级可选）。

### 1.1 Capability

| capability | 何时要求 |
|---|---|
| `app.manifest` | 消费清单；清单 `requiredCapabilities` **必须**含本键 |
| `app.navigation` | 清单出现 `navigation` 键时，`requiredCapabilities` **必须**含本键 |

仅声明 `app.manifest`、不声明 `app.navigation` 的宿主：必须忽略（不得部分解析）`navigation` 键。若清单含 `navigation` 却未声明 capability，属生产方 **M1** 错误。

---

## 2. 清单获取（D1）

| 项 | 值 |
|---|---|
| 默认端点 | `GET {baseURL}/.well-known/schema-ui/app-manifest.json` |
| 覆盖 | 宿主可显式提供完整 manifest URL（覆盖即唯一入口） |
| 方法 | 仅 GET |
| 版本 | 顶层 `protocolVersion` 严格协商；未精确列出 → `UNSUPPORTED_PROTOCOL_VERSION`；缺失 → `MISSING_PROTOCOL_VERSION` |

- 获取失败（网络/非 2xx/解析失败）→ 应用级 fail-closed，错误码 **`MANIFEST_LOAD_FAILED`**；不得凭猜测渲染任何页面。
- 清单是**一次性快照**：实例生命周期内不重新拉取；刷新须由宿主重建实例。
- 默认 well-known 路径是**约定入口**（非 IANA 注册）；拼在 API `baseURL` 之后（同 [08](./08-renderer-spec.md) §6.1）。

---

## 3. 三类路径解析基址（D1b）

| 字段 | 形态 | 解析基址 |
|---|---|---|
| 清单默认入口 | `/.well-known/...` | **API `baseURL`**（`RendererConfig.baseURL`） |
| `pages[].schemaUrl` | 站内相对 path，可含 `{name}` | **API `baseURL`**；GET 页 schema |
| `pages[].route` | 站内相对 path 模板，可含 `{name}` | **应用路由根**（前端 path，**不**经 API `baseURL` 拼 HTTP） |
| `app.logo.light` / `dark` | 相对 path **或** `https:` 绝对 URL | 相对 → API `baseURL`；`https:` → **原样**加载 |
| navigate / nav `url` | 应用内 path | **应用路由根** |

**术语：**

- **API `baseURL`**：既有 Renderer 初始化参数；仅用于 HTTP（清单、schemaUrl、相对 logo、DataRef/Action request）。
- **应用路由根**：`pages[].route`、导航 `url`、`type:navigate` 的 `url`、`$context.route.path` 的解释基准。禁止经 API `baseURL` 拼 host。

站内相对路径正则：`^/(?!/)[^\s\\]*$`。`logo` 相对 path 不得含 `{` `}`；绝对 URL 须 `^https://[^\s\\]+$`（禁 `http:` / `data:`）。

---

## 4. 顶层结构（D2）

```yaml
protocolVersion: "2.5"
requiredCapabilities: [app.manifest]   # 有 navigation 时另含 app.navigation
app: { ... }
pages: [ ... ]
navigation: { ... }                    # 可选；见 §8
```

- `additionalProperties: false`（未知顶层字段 fail-closed）。
- **不**预留 `extensions` 命名空间。
- **M1 capability 门控：** 缺 `app.manifest`，或有 `navigation` 无 `app.navigation` → 拒绝，不得部分消费。

---

## 5. 应用元信息 `app`（D3）

| 字段 | 必填 | 说明 |
|---|---|---|
| `appId` | 是 | pattern `^[a-z][a-z0-9_-]*$` |
| `name` / `nameKey` | 至少一 | 显示名（i18n 双轨，见 §10） |
| `homePageRef` | `pages` 非空时必填 | 等于某 `pages[].pageId` |
| `logo` | 否 | `{ light, dark? }`；`dark` 缺省回退 `light` |
| `description` / `descriptionKey` | 否 | 说明 |

### 5.1 默认落地 `homePageRef`（D3a）

| 规则 | 说明 |
|---|---|
| 引用 | 未知 id → M1 `MANIFEST_HOME_PAGE_UNKNOWN` |
| 无参路由 | 目标 `route` 不得含 `{name}` → M1 `MANIFEST_HOME_ROUTE_PARAMETRIC` |
| 落地 path | 等于该页 `route` 字面量（无 query）；`$context.route.params` 为空对象 |
| 深链接优先 | 用户 path 能按 §7 命中注册表时，以深链接为准 |
| 空 `pages` | 不得声明 `homePageRef` |

---

## 6. 页面注册表 `pages[]`（D4）

| 字段 | 必填 | 说明 |
|---|---|---|
| `pageId` | 是 | 全清单唯一；运行时须等于页 schema `meta.pageId`，否则 `MANIFEST_PAGE_ID_MISMATCH` |
| `title` / `titleKey` | 至少一 | 列表展示；渲染时页 `meta.title` 优先 |
| `schemaUrl` | 是 | GET schema 的 API 相对 path；可含 `{name}` |
| `route` | 是 | 前端路由模板（应用路由根）；可含 `{name}` |
| `returnIntentQueryKeys` | 否 | **v2.8+**；无重复 query key 数组（元素匹配 `^[a-z][a-zA-Z0-9_]*$`）。认证恢复意图 allowlist 扩展（[10](./10-host-interoperability.md) §3.7）：出现该字段的清单必须声明 `host.failure-recovery` capability 且 `protocolVersion >= "2.8"`（M1，否则 `MISSING_REQUIRED_CAPABILITY` / `PROTOCOL_VERSION_TOO_LOW`）；未声明该 capability 的 Host 不得消费此字段扩展 allowlist |

- **schemaUrl 占位：** 静态 M1：`schemaUrl` 的 `{name}` ⊆ `route` 的 `{name}`。运行时未解析 → `MISSING_PATH_BINDING`（对齐 [07](./07-actions-contract.md) §3.2）。
- **空 `pages`：** 合法壳；不得 `homePageRef`；若有 `navigation`，link 项**仅允许** `url`（任何 `pageRef` → M1 失败）。
- **navigate 接缝：** `type:navigate` 的 url **不强制**命中注册表。命中恰好一个 `route` 时，宿主**必须**按 §7 填充 `$context.route`（path/params/query）。未命中：允许导航；`$context.route` **不注入**，`params` 可为空（ADR-0038 明确两条路径的对照）。

注册表是发现面不是权限面。

---

## 7. 路由模板匹配 D4a（唯一权威）

输入：应用内 path `P` 与 `pages[].route` 模板集合。输出：至多一个命中 + params，或未命中。

### 7.1 输入 `P` 前置条件（宿主义务）

1. 以 `/` 开头（应用根为 `/`，不得为空串）。
2. 不得含 query 或 fragment。
3. 已剥离部署 basename，为应用内 path。
4. 不自动去尾 `/`（`/orders` 与 `/orders/` 不同）。

### 7.2 模板语法（M1）

1. 以 `/` 开头；按 `/` 分段；禁止空段（`//`）。
2. 每段：字面量（无 `{` `}`）或 `{name}`，`name` 匹配 `^[a-zA-Z_][a-zA-Z0-9_]*$`。
3. 不允许可选段、通配、正则、query 写入模板。
4. 同模板 `{name}` 不重复；全清单 `route` 模板字符串不重复。

### 7.3 匹配步骤

1. 将 `P` 按 `/` 分段（禁止空段）。
2. 候选 = 段数与 `P` 相同的模板。
3. 逐段：字面量全等（解码后）；`{name}` 取段解码写入 `params[name]`；空段候选失败。
4. **段解码：** 每段独立 UTF-8 percent-decode（RFC 3986）；`+` **字面**；非法 `%` → 该候选失败；不做 Unicode 规范化。
5. 多候选成功时全序取唯一胜者：
   1. 字面量段数量**降序**；
   2. 模板字符串字符数**降序**；
   3. `pages[]` **声明序**更靠前者。
6. query 不参与 path 匹配。

未命中：宿主 404/兜底；不得猜测「最接近」模板。不定义 `MANIFEST_ROUTE_AMBIGUOUS` 稳定码。

---

## 8. 导航 `navigation`（ADR-0026）

```yaml
navigation:
  top: [ ... ]
  sidebar: [ ... ]
  user: [ ... ]
```

- 三槽位均可选；`additionalProperties: false`——**未知槽位 = 结构错误**。
- 左/右呈现归主题；协议不表达第二侧边栏。

### 8.1 菜单项

**link：** `pageRef` 与 `url` **互斥二选一**；`label`/`labelKey`（`pageRef` 缺省可取注册表 title；`url` 项至少一）；可选 `icon`（语义名 `^[a-z][a-z0-9-]*$`）、`visibleWhen`、`permissions`（**仅** `view` 键）。

**group：** `label`/`labelKey` 至少一；`items` 为 **link 数组**（≥1，组不嵌组）；可选组级过滤。

### 8.2 呈现算法

`$context.user` / `$context.features` 取**应用实例 boot** 快照，与清单同生命周期。

1. **顺序：** 数组序即呈现序。
2. **过滤：**
   ```
   可见 = (未声明 permissions.view → true，否则求值)
         AND (未声明 visibleWhen → true，否则求值 when)
   ```
   组与组内 link **AND**。表达式静态非法 → 该项 fail-closed 隐藏并按 **M3a** 报告，不得整树崩溃。
3. **空组剪枝：** 过滤后 items 为空的组不渲染。
4. **图标降级：** 语义名无前端映射 → 省略图标、仍渲染文本。
5. **高亮：** 输入当前应用内 path `P`（无 query）。
   - `pageRef`：取该页 `route`，用 D4a **单项**匹配（不把其他模板纳入候选）。
   - `url`：与 `P` **全等**（禁止前缀匹配）。
   - 多 active 允许；query 不参与。

菜单可见 ≠ 访问控制；页面权限与业务 API 鉴权独立生效。

### 8.3 Icon 语义名建议词表（informative）

非规范。合法名不因不在词表而拒绝。建议至少覆盖：`home`、`orders`、`users`、`settings`、`dashboard`、`report`、`help`、`logout`。

---

## 9. 校验层级（M 系列）

与页面 L0–L4 **平行、不混用**。有意仅定义 M0 / M1 / M3a（**无 M2**）。

| 层级 | 对应页面 | 内容 |
|---|---|---|
| **M0** 结构 | L0 | `app-manifest.schema.json`：顶层结构、类型、`additionalProperties: false`、`protocolVersion` 格式 |
| **M1** 语义 | L2 | 清单 `protocolVersion >= "2.5"`（字段集下限；**不是**页面解耦）、`pageId` 唯一、`appId` pattern、route 模板语法与唯一、占位符 ⊆、`homePageRef` 完整性与无参、空 pages 禁 home/`pageRef`、capability 门控（含 `returnIntentQueryKeys` 出现 ⇒ `protocolVersion >= "2.8"` 且声明 `host.failure-recovery`）、路径/logo 形态、`pageRef`/`url` 互斥、组不嵌组、`permissions` 仅 view |
| **M3a** 表达式 | L3a | 导航 `visibleWhen` / `permissions`：复用 L3a **非表单**规则（仅 `$context.user.*` / `$context.features.*`），作用域为清单制品；静态非法须结构化报告（不得仅靠运行时静默隐藏） |

---

## 10. 清单字段 i18n 双轨

对 `name`/`nameKey`、`title`/`titleKey`、`label`/`labelKey`、`description`/`descriptionKey`：

1. 若存在 `*Key`：用应用 i18n 词典查询；命中则用译文。
2. 查询未命中或无词典：若存在字面量字段（`name`/`title`/`label`/`description`）则用字面量；否则该项展示为空字符串（不得抛未捕获异常）。
3. 语义对齐 [01](./01-node-protocol.md) §6 的 Node props 双轨，但**清单字段不在 Node 树中**——规则在本文件定义，不得仅以引用 `01` §6 带过。

---

## 11. 稳定错误码

| 码 | 含义 |
|---|---|
| `MANIFEST_LOAD_FAILED` | 清单获取/解析失败 |
| `MANIFEST_PAGE_ID_MISMATCH` | 注册 `pageId` ≠ 页 schema `meta.pageId` |
| `UNKNOWN_MANIFEST_FIELD` | 运行时遇未知顶层字段（M0 之外的 Renderer 兜底） |
| `MANIFEST_HOME_PAGE_UNKNOWN` | `homePageRef` 无匹配 `pageId` |
| `MANIFEST_HOME_ROUTE_PARAMETRIC` | home 目标 route 含占位 |
| `MISSING_PATH_BINDING` | `schemaUrl` 占位未解析 |
| `MISSING_PROTOCOL_VERSION` | 清单缺 `protocolVersion` |
| `INVALID_PROTOCOL_VERSION` | 清单 `protocolVersion` 非 MAJOR.MINOR 形态 |
| `PROTOCOL_VERSION_TOO_LOW` | 清单 `protocolVersion < "2.5"`（M1 字段集下限；与页面 meta 解耦无关） |
| `UNSUPPORTED_PROTOCOL_VERSION` | 清单版本不在 Renderer 支持列表（协商阶段） |
| `MISSING_REQUIRED_CAPABILITY` | 清单 requiredCapabilities 有缺失 |

`MANIFEST_ROUTE_AMBIGUOUS` **不是**稳定互操作码。

---

## 12. 与页面协议的边界

- 不定义登录/OAuth/token、面包屑、菜单 badge、第二侧边栏、logout 动作类型。
- 不强制 navigate 命中注册表；命中则必须注入 `$context.route`。
- 主题/CSS/侧栏左右归呈现层。

发布门禁见 [release-goals/v2.5.md](./release-goals/v2.5.md)。迁移见 [migrations/2.4-to-2.5.md](./migrations/2.4-to-2.5.md)。
