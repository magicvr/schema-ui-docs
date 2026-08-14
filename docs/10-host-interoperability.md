---
status: stable
owner: 前后端架构组
last_updated: 2026-08-14
applies_to: schema-ui-protocol v2.9
based_on: ADR-0034–0037（accepted，2026-08-13）
---

# Host/App 互操作协议（bootstrap / failure / claim）

本文是 `schema-ui-protocol v2.8` 的新增规范面，投影已 accepted 的
[ADR-0034](./decisions/0034-host-app-interoperability-boundary.md) /
[0035](./decisions/0035-host-bootstrap-lifecycle.md) /
[0036](./decisions/0036-host-failure-recovery.md) /
[0037](./decisions/0037-host-conformance-claim.md)。三个能力包分别由 `host.bootstrap`、
`host.failure-recovery`、`host.conformance-claim` capability 门控；全部为可选能力，
未声明对应 capability 的 Host 不受本文任何条款约束。

## 1. 范围与能力门控

| capability | 面 | 权威 ADR |
|---|---|---|
| `host.bootstrap` | bootstrap document、确定性启动生命周期、auth 归一化、manifest identity/缓存 | ADR-0035 |
| `host.failure-recovery` | Host failure result、分类/优先级、retry、return intent、A11y 最低义务 | ADR-0036 |
| `host.conformance-claim` | conformance claim、capability registry、evidence 制品 | ADR-0037 |

- 全部为**可选能力**：未声明的 Host 零行为变化（不请求 bootstrap document、不产生 failure result、
  不产生 claim），继续按 [09](./09-app-manifest.md) 与 [08](./08-renderer-spec.md) 装载。
- 三个包不改变 ADR-0025 一次性 manifest 快照、既有 401/403 语义、未知字段 fail-closed 或 Action 结果。
- 本面只定义跨实现可观测的输入、状态、结果与安全不变量；不规定框架、认证供应商、数据库或部署拓扑。

## 2. Bootstrap document 与启动生命周期（`host.bootstrap`）

### 2.1 发现与获取

默认入口：

```text
GET {baseURL}/.well-known/schema-ui/host-bootstrap.json
```

- Host 显式配置完整 bootstrap URL 时，该 URL 是唯一 bootstrap 入口；未显式配置时，仅 `404` 或 `410`
  表示「未提供新 document」，Host 回退 [09](./09-app-manifest.md) 的 manifest 默认入口；
- 请求使用 `credentials: omit`，不得携带 Cookie、Authorization 或其它身份凭据；
- 任何 `3xx` 均 fail-closed，不跟随 redirect；成功响应 `Content-Type` 去除参数并 ASCII 小写后只允许
  `application/json` 或 `application/schema-ui+json`；
- 仅 `200` 是无条件成功；有同 cache partition 已验证 bytes 时，conditional GET 的 `304` 才成功并复用
  该 bytes；其它 `2xx`、`3xx`、网络错误、Content-Type/解析/校验失败均 fail-closed，不得回退
  （`404`/`410` 仅在默认入口上触发回退，显式 URL 上属于 document 失败）；
- document 必须公开可读且不得含 principal、session、token、cookie、secret 或租户成员列表；
- 相对 URL 以 API `baseURL` 解析；绝对 URL 仅允许 `https:`，禁止 userinfo、`http:`、`data:` 与脚本 scheme。

### 2.2 结构

```json
{
  "bootstrapVersion": "1.0",
  "requiredCapabilities": ["host.bootstrap"],
  "manifest": {
    "url": "/.well-known/schema-ui/app-manifest.json",
    "sha256": "<64 lowercase hex>"
  },
  "availability": {
    "mode": "normal",
    "messageKey": "app.available"
  }
}
```

顶层和所有固定对象均 `additionalProperties: false`。

| 字段 | 规则 |
|---|---|
| `bootstrapVersion` | 必填，独立 document 版本；首版精确为 `1.0`，不得与页面/manifest 版本混用。 |
| `requiredCapabilities` | 必填、非空、无重复；首版必须含 `host.bootstrap`；全部元素均参与 2.3 协商。 |
| `manifest.url` | 必填；相对 API path（`^/(?!/)[^\s\\]*$`）或安全 `https:` URL。跨 API `baseURL` origin 时必须同时声明 `sha256`。 |
| `manifest.sha256` | 可选；对成功 `200` manifest 响应原始 bytes 计算 SHA-256，小写 hex 精确比较。 |
| `availability.mode` | `normal`、`maintenance`、`upgrade-required`、`degraded` 四选一。 |
| `availability.messageKey` | 可选显示 key；Host 词典未命中时使用自身安全通用文案，不回显服务端原文。 |
| `availability.retryAfterSeconds` | 仅 `maintenance` 可用，正整数；缺失表示仅手动重试。 |
| `availability.minimumHostVersion` | 仅 `upgrade-required` 可用；opaque 非空字符串，只展示/诊断，不做 SemVer 猜测。 |
| `availability.disabledCapabilities` | 仅 `degraded` 可用；无重复、已登记 capability ID；与 manifest required capability 的冲突在 2.5 裁定。 |

### 2.3 确定性启动算法

每次应用实例创建执行一次，阶段严格为：

1. `bootstrap-discovery`：读取显式 URL，或尝试默认 bootstrap URL；
2. `bootstrap-validation`：结构校验；`bootstrapVersion` 与 Host `supportedBootstrapVersions`
   （非空、无重复字符串列表）精确匹配；按 [ADR-0009](./decisions/0009-strict-version-negotiation.md)
   的列表合法性、声明序缺项结果对 `requiredCapabilities` **全集**协商，任一缺失即
   `MISSING_REQUIRED_CAPABILITY`；不得只检查 `host.bootstrap`；
3. `availability-gate`：`maintenance` / `upgrade-required` → 终态，不获取 manifest；
   `normal` / `degraded` → 继续；
4. `auth-resolution`：Host session adapter 产生 2.4 归一化状态；`locked` / `reauth-required`
   立即进入终态；
5. `manifest-load`：`anonymous` / `authenticated` 才继续；按 document 声明的 `manifest.url` 获取
   （未提供 document、走 404/410 fallback 时按 [09](./09-app-manifest.md) 默认入口获取）；
6. `manifest-integrity`：若声明 `sha256`，先核验原始 bytes；不一致终止；
7. `manifest-validation`：完全复用 M0/M1/M3a、严格版本/capability 协商与稳定错误码（[09](./09-app-manifest.md) §9）；
8. `context-resolution`：按 2.4 注入一次性 `$context.user` / `$context.features` 快照；
9. `ready`：生成 immutable manifest/context snapshot；`degraded` 同时应用 2.5 限制。

任一较早阶段失败后不得执行后续阶段。应用实例重建会取消前一次尚未完成的 bootstrap；迟到结果必须丢弃，
不得覆盖新实例。未声明 `host.bootstrap` 的 Host 不进入本算法。

### 2.4 Host 归一化 auth state

认证仍由 Host adapter 完成。`context-resolution` 只接收下列归一化输入：

```json
{
  "state": "authenticated",
  "principal": {
    "id": "u-123",
    "name": "Ada",
    "roles": ["admin"]
  },
  "expiresAt": "2026-08-12T18:30:00Z",
  "provenance": "host-session-adapter"
}
```

- `state` 为 `anonymous`、`authenticated`、`reauth-required`、`locked`；
- 仅 `authenticated` 允许且要求 `principal`，其最小形状复用 `$context.user`；
- `anonymous` 可以继续装载公开 manifest，并注入固定空快照 `{ "id": "", "name": "", "roles": [] }`；
  该 sentinel 只为满足现有 `$context.user` 最小形状，不表示身份且不得作为服务端授权主体；
- `reauth-required` 与 `locked` 禁止进入 manifest-load/ready，也禁止注入过期 principal；分别映射 2.7
  的 `REAUTH_REQUIRED` / `ACCOUNT_LOCKED`；
- `expiresAt` 可选 RFC 3339 UTC，仅用于 Host 提前重建/reauth，不暴露 token；
- `provenance` 首版固定为 `host-session-adapter`；
- adapter endpoint、refresh、cookie/Bearer、CSRF 与 IdP 仍在协议外。

### 2.5 `degraded` 只做 capability 收窄

`degraded` 不是允许 Host 猜测只读 UI 的通用开关。Host 计算：

```text
effectiveCapabilities = supportedCapabilities - disabledCapabilities
```

`supportedCapabilities` 是 Host 传给既有 [ADR-0009](./decisions/0009-strict-version-negotiation.md)
runtime 协商入口的同一列表；不得从 ADR-0037 claim 反向读取或动态扩张。随后仍按 manifest
`requiredCapabilities` fail-closed。若被禁用项是 manifest required capability，bootstrap 失败为
`MISSING_REQUIRED_CAPABILITY`（结果码 `MANIFEST_CAPABILITY_REJECTED`），不得部分渲染。只有 App 自身把
相关能力声明为 optional 时，Host 才可在收窄后的集合上进入 `ready`。

### 2.6 Manifest identity 与缓存

一次成功启动记录以下不可变 identity：

```json
{
  "sourceUrl": "https://example.test/api/.well-known/schema-ui/app-manifest.json",
  "protocolVersion": "2.7",
  "contentSha256": "<64 lowercase hex>",
  "etag": "optional opaque response validator"
}
```

- `contentSha256` 始终由 Host 对原始 `200` bytes 计算；不能由服务端自报替代；
- `ETag`/HTTP cache 可用于下一次实例创建的 conditional GET。对既有 2.7 manifest 入口，只有 `200`
  才是传给 ADR-0025/09 装载契约的成功响应；`304` 只能由 Host 在同 cache partition 内复用已验证的 `200`
  bytes 后归一化为本地缓存命中，不得作为 manifest 协议成功码或改变 `MANIFEST_LOAD_FAILED` 的 HTTP 判定；
- 实例生命周期内仍不自动重拉 manifest；配置失效通知若未来标准化，只能触发完整实例重建；
- auth-bound response 不得与 anonymous partition 共享缓存；Host 必须遵循响应 `Cache-Control`/`Vary`；
- identity 可进入诊断与 conformance evidence，不得包含 credential 或完整用户数据。

### 2.7 稳定 bootstrap 结果

| 结果 | 条件 |
|---|---|
| `READY` | normal 且全部门禁通过 |
| `READY_DEGRADED` | degraded、capability 收窄后全部门禁通过 |
| `MAINTENANCE` | availability mode 为 maintenance |
| `UPGRADE_REQUIRED` | availability mode 为 upgrade-required |
| `REAUTH_REQUIRED` | session adapter 在启动期返回 reauth-required |
| `ACCOUNT_LOCKED` | session adapter 返回 locked |
| `BOOTSTRAP_DOCUMENT_FAILED` | bootstrap 获取失败（按下方分类）或 Content-Type/解析/结构失败，且不是默认入口 404/410 |
| `BOOTSTRAP_NEGOTIATION_REJECTED` | bootstrap version/support/capability 协商拒绝；保留原 diagnostics code |
| `MANIFEST_CAPABILITY_REJECTED` | effective capabilities 缺少 manifest required capability |
| `MANIFEST_INTEGRITY_FAILED` | manifest raw bytes 与声明 digest 不一致 |

manifest 自身失败继续使用 [09](./09-app-manifest.md) §11 与 ADR-0009 已有错误码；本表不重命名它们。

**映射到 Host failure（§3）的唯一规则：**

| bootstrap 结果 | Host failure `(scope, kind, hostCode)` |
|---|---|
| `MAINTENANCE` | `(bootstrap, maintenance, HOST_MAINTENANCE)` |
| `UPGRADE_REQUIRED` | `(bootstrap, upgrade-required, HOST_UPGRADE_REQUIRED)` |
| `REAUTH_REQUIRED` | `(auth, reauth-required, HOST_REAUTH_REQUIRED)` |
| `ACCOUNT_LOCKED` | `(auth, account-locked, HOST_ACCOUNT_LOCKED)` |
| `BOOTSTRAP_DOCUMENT_FAILED`（获取失败） | 429 → `(bootstrap, rate-limited, HOST_RATE_LIMITED)`；超时 → `(bootstrap, timeout, HOST_TIMEOUT)`；传输明确不可达 → `(bootstrap, offline, HOST_OFFLINE)`；其它可安全归类的 5xx/传输失败 → `(bootstrap, unavailable, HOST_UNAVAILABLE)` |
| `BOOTSTRAP_DOCUMENT_FAILED`（Content-Type/解析/结构失败） | `(bootstrap, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `BOOTSTRAP_NEGOTIATION_REJECTED` | `(bootstrap, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `MANIFEST_CAPABILITY_REJECTED` | `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `MANIFEST_INTEGRITY_FAILED` | `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)` |

`READY` / `READY_DEGRADED` 不产生 failure。

**manifest / 顶层 page schema 的 Host-level 获取分类优先级（与 §3.3 一致）：**

1. anonymous/未认证状态的 `401` → `(scope, authentication-required, HOST_AUTH_REQUIRED)`；
   authenticated 状态的 `401` → `(scope, reauth-required, HOST_REAUTH_REQUIRED)`；
   任意 `403` → `(scope, forbidden, HOST_FORBIDDEN)`；均保留既有 `onAuthFailure`/forbidden 语义；
2. 排除了 401/403 后，按传输/HTTP 类别：429 → `rate-limited`、请求超时 → `timeout`、传输明确不可达
   → `offline`、其它可安全归类的 5xx/传输失败 → `unavailable`；
3. 排除了 401/403 与传输/HTTP 类别之后，manifest 既有稳定错误（`MANIFEST_LOAD_FAILED` 中的解析/结构
   失败、`MISSING_PROTOCOL_VERSION`、`UNSUPPORTED_PROTOCOL_VERSION`、`MISSING_REQUIRED_CAPABILITY`）
   才映射 `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)`，原码保留在 `diagnostics.protocolCode`。

Node DataRef、Action 与局部业务请求不适用本分类（见 §3.3 提升谓词）。

### 2.8 Bootstrap diagnostics code

| code | 条件 |
|---|---|
| `INVALID_HOST_SUPPORT` | Host `supportedBootstrapVersions` 非法/为空/重复 |
| `INVALID_REQUIRED_CAPABILITIES` | document `requiredCapabilities` 列表非法或重复（沿 ADR-0009） |
| `UNSUPPORTED_BOOTSTRAP_VERSION` | `bootstrapVersion` 未被 Host 精确支持 |
| `INVALID_BOOTSTRAP_DOCUMENT` | document 结构/封闭对象/字段格式失败 |
| `MISSING_REQUIRED_CAPABILITY` | document 或 manifest 要求的 capability 有缺失（沿 ADR-0009） |

`INVALID_BOOTSTRAP_DOCUMENT` 对应结果 `BOOTSTRAP_DOCUMENT_FAILED`；`INVALID_HOST_SUPPORT` /
`UNSUPPORTED_BOOTSTRAP_VERSION` / `INVALID_REQUIRED_CAPABILITIES` / `MISSING_REQUIRED_CAPABILITY`
（document 协商）对应 `BOOTSTRAP_NEGOTIATION_REJECTED`；原码保留在 Host failure 的
`diagnostics.protocolCode`。

## 3. Host failure result（`host.failure-recovery`）

### 3.1 对象结构

Host 只从 3.3 提升谓词列出的 bootstrap、Host-level HTTP、manifest/page-schema、router 或 runtime 异常
构造下列封闭对象；Node DataRef 与 Action 结果不进入本对象：

```json
{
  "failureVersion": "1.0",
  "failureId": "hf-000042",
  "scope": "bootstrap",
  "kind": "maintenance",
  "hostCode": "HOST_MAINTENANCE",
  "retry": { "mode": "after", "afterSeconds": 120 },
  "message": { "messageKey": "host.maintenance" },
  "correlation": { "requestId": "req-123" },
  "diagnostics": { "phase": "availability-gate" },
  "recoveryActions": [
    { "type": "retry" },
    { "type": "support", "url": "https://support.example.test/status" }
  ]
}
```

固定对象全部 `additionalProperties: false`。字段规则：

| 字段 | 必填 | 规则 |
|---|---|---|
| `failureVersion` | 是 | 首版精确 `1.0` |
| `failureId` | 是 | 应用实例内每次 primary failure occurrence 的唯一可打印字符串；同一 failure surface 的倒计时、重绘和手动 retry 保持该 ID，恢复后新 failure 必须生成新 ID；不等于后端 request ID，不含用户数据，不要求跨实例全局唯一 |
| `scope` | 是 | `bootstrap`、`manifest`、`page`、`auth`、`route`、`runtime` |
| `kind` | 是 | 3.2 稳定码表 |
| `hostCode` | 是 | 3.2 稳定码表；Host **不得**把任意后端 `code` 复制为 `hostCode` 或据此执行未登记动作 |
| `retry` | 否 | 3.5 语义；缺失时按 kind 默认值 |
| `message` | 是 | 至少含 `messageKey`；可含 primitive `params`，禁止 HTML；Host 词典未命中使用安全通用文案 |
| `correlation` | 否 | 仅 `requestId`、`traceId`，均为 Host 已验证的可打印短字符串 |
| `diagnostics` | 否 | 仅 `phase`、`protocolCode`、`hostVersion`、`protocolVersion`、`manifestSha256` |
| `recoveryActions` | 否 | 3.7 封闭对象数组 |

后端 `code` 保持 opaque 调试字段。stack 和原始异常只进受控日志，永不进入用户可复制的 failure result。

### 3.2 分类与稳定码

| `kind` | `hostCode` | 典型来源 |
|---|---|---|
| `maintenance` | `HOST_MAINTENANCE` | bootstrap maintenance |
| `upgrade-required` | `HOST_UPGRADE_REQUIRED` | bootstrap upgrade-required 或 HTTP 426 adapter |
| `authentication-required` | `HOST_AUTH_REQUIRED` | anonymous 打开需认证入口、Host-level 401 |
| `reauth-required` | `HOST_REAUTH_REQUIRED` | auth-lost、session adapter reauth-required |
| `account-locked` | `HOST_ACCOUNT_LOCKED` | session adapter locked；不得进入 ready |
| `forbidden` | `HOST_FORBIDDEN` | 403；不得转为登录 |
| `not-found` | `HOST_ROUTE_NOT_FOUND` | 应用 route 未命中；页内 resource 404 不提升 |
| `rate-limited` | `HOST_RATE_LIMITED` | bootstrap/manifest/page-schema Host-level fetch 429 |
| `timeout` | `HOST_TIMEOUT` | 上述 fetch 的请求超时 |
| `offline` | `HOST_OFFLINE` | 传输明确不可达；不是任意 5xx |
| `protocol-rejected` | `HOST_PROTOCOL_REJECTED` | version/capability/schema/integrity fail-closed |
| `render-failed` | `HOST_RENDER_FAILED` | Host/Renderer 未捕获异常边界 |
| `unavailable` | `HOST_UNAVAILABLE` | 其它可安全归类的 5xx/transport failure |

分类优先级：`403` 永远优先并唯一映射 forbidden；其余优先级为
auth/reauth/account-locked → protocol rejection → explicit Host-level HTTP class → Host-level transport
→ runtime。同一底层失败只产生一个 primary failure。

### 3.3 提升谓词（封闭）

仅以下事件生成本协议的全局 result/surface：

| 来源 | 是否提升 |
|---|---|
| 2.7 的 terminal bootstrap/auth/availability 结果 | 是，按 2.7 映射 |
| manifest 或顶层 page schema 获取/校验失败 | 是；page `scope` 只指页面 schema 根，不含 Node DataRef |
| 应用 router 未命中注册 route，且也未命中 3.4 Host-owned path | 是，`HOST_ROUTE_NOT_FOUND` |
| bootstrap/manifest/page-schema Host-level fetch 在 anonymous/未认证状态返回 401 | 是，`HOST_AUTH_REQUIRED` |
| session adapter 明确 auth-lost，或上述 Host-level fetch 在 authenticated 状态返回 401 | 是，`HOST_REAUTH_REQUIRED` |
| Host/Renderer 未捕获 runtime crash | 是，`HOST_RENDER_FAILED` |
| Node DataRef/options/recordSource 的 401/403/404/409/422/429/5xx/timeout/offline/cancel | 否，继续 `04`/`08` 节点语义与 `onAuthFailure` hook；不生成全局 Host result |
| Action 的任意 HTTP/transport/cancel 结果 | 否，继续 `07` outcome、字段错误和 retryPolicy |
| 其它业务 API `4xx` | 否，继续既有节点/Action 语义；不推断 Host kind |

`scope` 不含 `action`。`HOST_TIMEOUT`、`HOST_OFFLINE`、`HOST_RATE_LIMITED`、`HOST_UNAVAILABLE` 只在
bootstrap/manifest/page-schema 的 Host-level fetch 命中，绝不把局部请求提升为全局 failure。

不改变既有错误处理：

- `401` 继续触发 `onAuthFailure(401)`，不展示后端具体文案；只有上表列出的 Host-level 来源或 session
  adapter 明确 auth-lost 才归一化为 auth/reauth result；
- `403` 继续是 forbidden 且不跳转登录；
- `400 + errors` 继续字段回填，不能被 Host failure 吞掉；
- Action `onError` 的顺序与允许行为不变，不新增隐式 navigate/reload/closeModal；
- manifest 稳定码保留在 `diagnostics.protocolCode`，primary `hostCode` 仅表达 Host 恢复类别；
- backend `{code,message}` 不因本协议变为程序化协议。

### 3.4 Host-owned path 排除

Host 在 router 初始化时建立封闭的 `hostOwnedPaths`：

1. manifest `navigation` 中每个 `url` 的应用内 path；
2. Host 显式配置的登录、回调、登出落地和其它宿主页 path；
3. 空 `pages` 壳的 Host router 已注册 path。

3.3 未命中 manifest route 但精确命中 `hostOwnedPaths` 时交给 Host router，不生成协议 404。该列表只接受
应用内 path 模板，不能用通配符吞掉未知路径；同一 path 同时命中 manifest route 与 Host path 时，manifest
route 优先。两者均未命中才产生 `HOST_ROUTE_NOT_FOUND`。

### 3.5 Retry 语义

```json
{ "mode": "none" }
{ "mode": "manual" }
{ "mode": "after", "afterSeconds": 30 }
```

- `afterSeconds` 仅 `after` 允许，正整数；优先来自合法 `Retry-After` delta-seconds，HTTP-date 由 Host
  相对当前时钟换算并向上取整为非负秒；过去日期归零后转 `manual`；
- 非幂等 mutation 不得自动 retry；`after` 只表示 UI 可显示倒计时，计时结束仍由既有 request/action
  retry policy 决定是否发送；
- offline、timeout 默认 `manual`；forbidden、protocol-rejected 默认 `none`；
- bootstrap maintenance 可以 `after`，但重试必须重建完整应用实例。

### 3.6 安全消息、诊断与 correlation

- `message` 见 3.1；`diagnostics` 只允许 `phase`、`protocolCode`、`hostVersion`、`protocolVersion`、
  `manifestSha256`；`correlation` 只允许 `requestId`、`traceId`，不得包含 header dump、URL query、token、
  principal、stack、请求/响应 body；
- `support` 动作若带 URL，只允许同源应用 path 或无 userinfo 的 `https:` URL，打开外链须 `noopener` /
  `noreferrer`；return intent 只能是同一应用根下的 path/query，不接受绝对 URL。

### 3.7 Recovery actions 与 return intent

`recoveryActions` 是封闭对象数组，每项 `type` 为 `retry`、`reauth`、`home`、`back`、`reload`、`support`；
仅 `support` 允许可选 `url`，其它类型出现 `url` 均结构拒绝。Host 必须按 kind 过滤：

- forbidden 与 account-locked 不得提供 `reauth`，无例外；account-locked 只允许 `home` / `support`；
  同一事件同时观察到 403 与 adapter reauth-required 时仍以 forbidden 为唯一 primary result，不跳转登录；
- protocol-rejected 不得提供「继续渲染」；
- route not found 可 `home/back`；resource not found 留在页内时不强制全局导航；
- render-failed 可 `reload/support`，不得自动循环 reload。

可恢复认证意图：

```json
{
  "path": "/orders/123",
  "query": { "tab": "history" },
  "expiresAt": "2026-08-12T18:30:00Z",
  "nonce": "host-local-opaque"
}
```

Host 只接受应用内绝对 path；拒绝 scheme、authority、fragment、登录/回调 path 自循环与超过有效期的意图；
query 值为 string。首版协议 allowlist 保留 `tab`、`view`、`page`、`pageSize`、`sort`，以及 manifest 对
当前注册页声明的 `pages[].returnIntentQueryKeys`（见 [09](./09-app-manifest.md) §6）。Host 必须永久拒绝
大小写不敏感的 `token`、`access_token`、`id_token`、`code`、`state`、`session`、`redirect`、`returnTo`，
即使误被声明；未列 key 一律丢弃，Host 只能进一步收窄，不能扩张。成功消费一次后 nonce 作废，不得重放。
普通 deep link 不受此恢复意图 allowlist 影响。

### 3.8 A11y 最低义务

Host 显示全局 failure surface 时必须：

1. 使用 `main` landmark 内的唯一错误标题；
2. 首次进入 terminal failure 后把 focus 移到标题或容器，重试中的短暂状态不重复抢焦点；
3. auth/protocol/render terminal failure 使用 assertive announcement；maintenance/rate-limit/retry
   countdown 使用 polite；
4. 相同 `failureId` 的重绘不重复播报；新 `failureId` 必须重新播报；
5. recovery actions 可键盘到达，执行后 focus 落到新 surface 的标题或恢复页面主标题。

仅声明 `host.failure-recovery` 的 Host/Renderer 承担以下增量义务：对既有 `400 + errors` 继续字段回填；
提交失败后必须把 focus 移到第一个可聚焦的错误字段，若只有 form-level error 则移到 form error summary，
并通过 assertive live region 播报一次。此义务不把字段错误升级为全局 Host failure，也不回溯改变未声明
该 capability 的 v2.7 Renderer。

这些是 Host behavioral conformance；不规定 DOM id、CSS 或具体组件库。

## 4. Host conformance claim（`host.conformance-claim`）

### 4.1 Claim 结构与加载

claim 是构建生成的静态 JSON。可以嵌入 Host bundle，或从显式/同源 URL 加载；无论载体如何，验证对象都是
同一组不可变 bytes。禁止运行时根据当前 App 动态扩张 supported versions/capabilities。

```json
{
  "claimVersion": "1.0",
  "host": {
    "hostId": "schema-ui-web",
    "hostVersion": "4.2.0",
    "buildId": "git:abc123"
  },
  "protocolArtifact": {
    "artifactVersion": "2.8.0",
    "contentSha256": "<64 lowercase hex>"
  },
  "support": {
    "pageVersions": ["2.7", "2.8"],
    "manifestVersions": ["2.5", "2.8"],
    "capabilities": ["app.manifest", "app.navigation", "host.bootstrap"]
  },
  "conformance": {
    "fixtureVersion": "1.0",
    "fixtureSha256": "<64 lowercase hex>",
    "suites": [
      { "suiteId": "version-negotiation", "suiteVersion": "1.0", "result": "pass" }
    ]
  },
  "evidence": [
    {
      "kind": "ci-artifact",
      "subjectBuildId": "git:abc123",
      "uri": "https://ci.example.test/run/123",
      "sha256": "<64 lowercase hex>"
    }
  ]
}
```

固定对象全部 `additionalProperties: false`；集合非空、无重复并按 4.3 规范化输出，确保可复现 digest。

### 4.2 Support scope 必须精确

- `pageVersions` 与 `manifestVersions` 是独立列表，元素必须精确 `MAJOR.MINOR`；
- 每个列出的版本表示完整实现该版本的 mandatory behavior，不允许版本范围、`latest`、`compatible` 或
  「最近版本」推断；
- capability 只允许协议 registry（4.4）已登记 ID；未知 ID 使 claim 无效；
- capability 依赖必须闭包，例如 `app.navigation` 必须同时列 `app.manifest`；
- runtime 仍对具体 page/manifest 执行 ADR-0009 协商。Claim 不能让不匹配输入通过。

### 4.3 规范化序列化与 digest

claim 的 digest 只对规范化序列化后的 UTF-8 bytes 计算 SHA-256：

1. 对象键按 UTF-8 字节升序输出；
2. 字符串数组按元素 UTF-8 字节升序；
3. 对象数组按每个元素规范化序列化后的字节升序（`suites` 即按整个 suite 对象字节序，`evidence` 同理）；
4. JSON 字符串转义只保留 RFC 8259 必转字符（`"`、`\` 与控制字符），`/` 与其它可打印字符不转义；
5. 数字、布尔、`null` 按 JSON 常规输出；禁止多余空白。

同一组不可变 bytes 无论来自内嵌 bundle 还是 URL 加载，必须产出同一 digest。claim builder 与 verifier
必须消费同一规范化实现（以 reference 实现为准）。

### 4.4 Capability registry 与依赖

registry 是独立、机器可读、进入协议制品的封闭对象。每项至少包含：

```json
{
  "capabilityId": "host.bootstrap",
  "sinceProtocolVersion": "2.8",
  "dependsOn": ["app.manifest"],
  "mandatorySuites": ["host-bootstrap"],
  "deprecatedSince": null,
  "removedIn": null
}
```

- `deprecatedSince`/`removedIn` 必须是精确 MAJOR.MINOR 或 `null`；`removedIn` 若非空必须晚于
  `deprecatedSince`；
- registry ID 唯一，依赖图必须无环；
- claim 校验时，对 claim `support.pageVersions` / `support.manifestVersions` 的每个元素 `v`，任一被列出
  capability 的 `removedIn` 非空且 `removedIn ≤ v`，即视为该版本已移除 → 该 capability 在该 claim 中按
  未登记处理（`UNKNOWN_CLAIM_CAPABILITY`）。

### 4.5 禁止 partial support 冒充 capability

claim 不提供 `partial: true`、百分比、skip 或 allowlist 字段。Host 只有在完成该 capability 的全部
mandatory fixtures 与 behavioral obligations 后才能列出 capability。

未完成能力可在非协议 issue/roadmap 中跟踪，不得放入 claim。fixture-only adapter、storybook、mock、
开发开关或未进入生产入口的代码均不是 capability evidence。

### 4.6 Suite 与 digest 绑定

- `protocolArtifact.contentSha256` 必须等于 Host 构建实际消费的协议制品内容摘要；
- `fixtureSha256` 必须等于该制品声明的 versioned fixture digest；
- `suites[]` 至少覆盖 support 列表所需的全部 mandatory suite；`result` 首版只允许 `pass`；
- suite 未运行、skip、xfail、过期版本或 digest 不符时，相关 capability/版本不得进入 claim；
- reference runner 通过只能证明 reference；Host evidence 必须来自生产入口或等价 build 的测试运行。

### 4.7 Evidence 是可核对引用，不是信任替代

`evidence.kind` 首版允许 `ci-artifact`、`signed-attestation`、`local-report`：

- `uri` 必须是同源 path、`https:` 或构建内相对 artifact path，禁止凭据/userinfo；
- `subjectBuildId` 必填，必须与 `host.buildId` 逐字相等；不等即 `CLAIM_EVIDENCE_BUILD_MISMATCH`；
- `sha256` 绑定 evidence bytes；远端不可用时 claim 仍可解析，但审计状态为 unverifiable，不得宣称已
  独立证明；
- evidence bytes 的格式由 `kind` 对应 profile 校验；`local-report` / `ci-artifact` 首版报告 Schema 也
  必须含同一 `subjectBuildId`，远端 bytes 取回后逐字核对并验证 digest，不能只信 claim 外壳；
- 签名/供应链信任不是首版门禁，未来可扩展为独立 attestation profile。

### 4.8 Claim 校验结果

| code | 条件 |
|---|---|
| `CLAIM_OK` | 结构、版本、registry、依赖、digest 与 suite coverage 均通过 |
| `INVALID_CLAIM` | 结构/封闭对象/集合/格式错误 |
| `UNKNOWN_CLAIM_VERSION` | `claimVersion` 不支持 |
| `UNKNOWN_CLAIM_CAPABILITY` | capability 未登记或已在该 claim 覆盖的版本移除 |
| `INCOMPLETE_CAPABILITY_DEPENDENCY` | capability 依赖未闭包 |
| `CLAIM_ARTIFACT_MISMATCH` | artifact digest 与运行构建不一致 |
| `CLAIM_FIXTURE_MISMATCH` | fixture digest/version 不一致 |
| `CLAIM_SUITE_INCOMPLETE` | mandatory suite 缺失或非 pass |
| `CLAIM_EVIDENCE_BUILD_MISMATCH` | evidence 外壳或报告 bytes 的 build ID 与 `host.buildId` 不同 |
| `CLAIM_EVIDENCE_UNVERIFIABLE` | claim 可解析但 evidence 当前不可核对；不得升级为 `CLAIM_OK` |

检查顺序按表从结构、claim version、registry/dependency、artifact、fixture、suite、evidence 执行，
首个失败即返回。

### 4.9 App 如何使用 claim

- 默认情况下 claim 是审计与诊断制品，不是 App 输入；App 只通过 manifest required capabilities 请求行为；
- 若未来 App 必须要求可出示 claim，可声明 `host.conformance-claim` capability；缺失时按
  `MISSING_REQUIRED_CAPABILITY` fail-closed；
- App 不得引用特定 Host ID、CI vendor 或 evidence URL 作为业务渲染条件；
- claim 不包含 principal、tenant、feature flag、token、endpoint credential 或运行时请求日志。

## 5. 校验层级与行为向量

三个能力包各走独立门禁，命名不混用页面管线（L0–L4）与清单管线（M 系列）：

| 能力包 | 结构 | 语义 | 行为向量 |
|---|---|---|---|
| bootstrap | `B0`：`host-bootstrap.schema.json`（Ajv，封闭） | `B1`：bootstrap validator（2.3 算法与 2.7 结果/映射） | `conformance/fixtures/host-bootstrap`（正反 cases，JS/Python 双 reference） |
| failure | `F0`：`host-failure.schema.json`（Ajv，封闭） | `F1`：failure validator（3.2 分类优先级、3.3 提升谓词、3.5/3.7 过滤） | `conformance/fixtures/host-failure`（正反 cases，JS/Python 双 reference） |
| claim | `C0`：`host-conformance-claim.schema.json` + `capability-registry.json`（Ajv，封闭） | `C1`：claim validator（4.3 规范化、4.4 依赖/移除、4.8 校验顺序） | `conformance/fixtures/host-conformance-claim`（正反 cases，JS/Python 双 reference） |

fixture suite 仍沿用 `fixture-suite.schema.json`（`fixtureVersion: "1.0"`），category 新增
`host-bootstrap` / `host-failure` / `host-conformance-claim`。JS/Python reference 必须消费同一 fixtures
并逐字段产生一致结果。

## 6. 与既有权威的关系

- 复用：manifest discovery/装载（ADR-0025）、严格版本/capability 协商（ADR-0009）、`$context` 快照
  （ADR-0003/0021）、导航与路由匹配（ADR-0026/0025 D4a）、字段错误映射与 Action 结果（`07`）、
  节点错误（`04`/`08`）。
- 禁止：第二套 manifest/navigation/i18n/权限/Action 语义；bootstrap document 内嵌 manifest、页面
  schema、任意扩展对象或 executable URL；bootstrap document 携带 session/secret；Host failure 按任意
  后端 `code` 驱动动作；claim 的 partial/skip/allowlist 冒充 capability；`reserve-extension` 候选生成
  空 schema、空 capability 或核心正例。
