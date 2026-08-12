---
status: proposed
date: 2026-08-12
applies_to: schema-ui-protocol vNext (candidate)
track: Host/App interoperability
---

# ADR-0035: Host bootstrap document 与确定性启动生命周期

## 状态

**Proposed（草案，未接受）。** 依赖 [ADR-0034](./0034-host-app-interoperability-boundary.md)。本 ADR
定义候选 wire 与算法，不修改 v2.7 app manifest 的一次性快照、默认入口或合法输入。

## 背景

ADR-0025 已定义 Host 如何发现、校验和装载 app manifest，但在 manifest 之前没有标准位置表达维护、
强制升级、受控降级或 manifest identity。生产 Host 因而用私有 endpoint、HTTP 状态和启动顺序拼装，
相同 App 在不同 Host 上可能得到不同 ready/failed 结果。

## 决策

### D1. 新增可选公开 bootstrap document

候选默认入口为：

```text
GET {baseURL}/.well-known/schema-ui/host-bootstrap.json
```

- Host 显式配置完整 bootstrap URL 时，该 URL 是唯一 bootstrap 入口；
- 未显式配置时，仅 `404` 或 `410` 表示“未提供新 document”，Host 回退 ADR-0025 的 manifest 默认入口；
- 请求使用 `credentials: omit`，不得携带 Cookie、Authorization 或其它身份凭据；
- 任何 `3xx` 均 fail-closed，不跟随 redirect；成功响应 `Content-Type` 去除参数并 ASCII 小写后只允许
  `application/json` 或 `application/schema-ui+json`；
- 仅 `200` 是无条件成功；有同 cache partition 已验证 bytes 时，conditional GET 的 `304` 才成功并复用
  该 bytes；其它 `2xx`、`3xx`、网络错误、Content-Type/解析/校验失败均 fail-closed，不得回退；
- document 必须公开可读且不得含 principal、session、token、cookie、secret 或租户成员列表；
- 相对 URL 以 API `baseURL` 解析；绝对 URL 仅允许 `https:`，禁止 userinfo、`http:`、`data:` 与脚本 scheme。

### D2. 候选结构

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

顶层和所有固定对象均 `additionalProperties: false`。字段：

| 字段 | 规则 |
|---|---|
| `bootstrapVersion` | 必填，独立 document 版本；首版精确为 `1.0`，不得与页面/manifest 版本混用。 |
| `requiredCapabilities` | 必填、非空、无重复；首版必须含 `host.bootstrap`；全部元素均参与 D3 协商。 |
| `manifest.url` | 必填；相对 API path或安全 `https:` URL。跨 API `baseURL` origin 时必须同时声明 `sha256`。 |
| `manifest.sha256` | 可选；对成功 `200` manifest 响应原始 bytes 计算 SHA-256，小写 hex 精确比较。 |
| `availability.mode` | `normal`、`maintenance`、`upgrade-required`、`degraded` 四选一。 |
| `availability.messageKey` | 可选显示 key；Host 词典未命中时使用自身安全通用文案，不回显服务端原文。 |
| `availability.retryAfterSeconds` | 仅 `maintenance` 可用，正整数；缺失表示仅手动重试。 |
| `availability.minimumHostVersion` | 仅 `upgrade-required` 可用；opaque 非空字符串，只展示/诊断，不做 SemVer 猜测。 |
| `availability.disabledCapabilities` | 仅 `degraded` 可用；无重复、已登记 capability ID；与 manifest required capability 的冲突只在 D5 裁定。 |

### D3. 确定性启动算法

每次应用实例创建执行一次，阶段严格为：

1. `bootstrap-discovery`：读取显式 URL，或尝试默认 bootstrap URL；
2. `bootstrap-validation`：结构校验；`bootstrapVersion` 与 Host `supportedBootstrapVersions` 精确匹配；按
   ADR-0009 的列表合法性、声明序缺项结果对 `requiredCapabilities` **全集**协商，任一缺失即
   `MISSING_REQUIRED_CAPABILITY`；不得只检查 `host.bootstrap`。非法 Host 支持列表、非法 document
   capability 列表、版本不支持分别保留 ADR-0009 对应 diagnostics code，并进入 D7
   `BOOTSTRAP_NEGOTIATION_REJECTED`；
3. `availability-gate`：
   - `maintenance` → 终态，不获取 manifest；
   - `upgrade-required` → 终态，不获取 manifest；
   - `normal` / `degraded` → 继续；
4. `auth-resolution`：Host session adapter 产生 D4 归一化状态；`locked` / `reauth-required` 立即进入终态；
5. `manifest-load`：`anonymous` / `authenticated` 才继续；按 document URL，或 404/410 fallback 时按
   ADR-0025 入口获取；
6. `manifest-integrity`：若声明 `sha256`，先核验原始 bytes；不一致终止；
7. `manifest-validation`：完全复用 M0/M1/M3a、严格版本/capability 协商与稳定错误码；
8. `context-resolution`：按 D4 注入一次性 `$context.user` / `$context.features` 快照；
9. `ready`：生成 immutable manifest/context snapshot；`degraded` 同时应用 D5 限制。

任一较早阶段失败后不得执行后续阶段。应用实例重建会取消前一次尚未完成的 bootstrap；迟到结果必须丢弃，
不得覆盖新实例。

### D4. Host 归一化 auth state

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
- `anonymous` 可以继续装载公开 manifest，并注入固定空快照
  `{ "id": "", "name": "", "roles": [] }`；该 sentinel 只为满足现有 `$context.user` 最小形状，
  不表示身份且不得作为服务端授权主体；
- `reauth-required` 与 `locked` 禁止进入 manifest-load/ready，也禁止注入过期 principal；分别映射 D7
  `REAUTH_REQUIRED` / `ACCOUNT_LOCKED`；
- `expiresAt` 可选 RFC 3339 UTC，仅用于 Host 提前重建/reauth，不暴露 token；
- `provenance` 首版固定为 `host-session-adapter`，明确数据不是 manifest 权威；
- adapter endpoint、refresh、cookie/Bearer、CSRF 与 IdP 仍在协议外。

### D5. `degraded` 只做 capability 收窄

`degraded` 不是允许 Host 猜测只读 UI 的通用开关。Host 计算：

```text
effectiveCapabilities = supportedCapabilities - disabledCapabilities
```

`supportedCapabilities` 是 Host 传给现有 ADR-0009 runtime 协商入口的同一列表；不得从 ADR-0037 claim
反向读取或动态扩张。随后仍按 manifest `requiredCapabilities` fail-closed。若被禁用项是 manifest required capability，bootstrap
失败为 `MISSING_REQUIRED_CAPABILITY`，不得部分渲染。只有 App 自身把相关能力声明为 optional 时，Host
才可在收窄后的集合上进入 `ready`。

### D6. Manifest identity 与缓存

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

### D7. 稳定 bootstrap 结果

| 结果 | 条件 |
|---|---|
| `READY` | normal 且全部门禁通过 |
| `READY_DEGRADED` | degraded、capability 收窄后全部门禁通过 |
| `MAINTENANCE` | availability mode 为 maintenance |
| `UPGRADE_REQUIRED` | availability mode 为 upgrade-required |
| `REAUTH_REQUIRED` | session adapter 在启动期返回 reauth-required |
| `ACCOUNT_LOCKED` | session adapter 返回 locked |
| `BOOTSTRAP_DOCUMENT_FAILED` | bootstrap 获取/Content-Type/解析/结构失败，且不是默认入口 404/410 |
| `BOOTSTRAP_NEGOTIATION_REJECTED` | bootstrap version/support/capability 协商拒绝；保留原 diagnostics code |
| `MANIFEST_CAPABILITY_REJECTED` | effective capabilities 缺少 manifest required capability |
| `MANIFEST_INTEGRITY_FAILED` | manifest raw bytes 与声明 digest 不一致 |

manifest 自身失败继续使用 ADR-0025/0009 已有错误码；本表不重命名它们。

与 ADR-0036 的唯一映射：

| bootstrap 结果 | Host failure `(scope, kind, hostCode)` |
|---|---|
| `MAINTENANCE` | `(bootstrap, maintenance, HOST_MAINTENANCE)` |
| `UPGRADE_REQUIRED` | `(bootstrap, upgrade-required, HOST_UPGRADE_REQUIRED)` |
| `REAUTH_REQUIRED` | `(auth, reauth-required, HOST_REAUTH_REQUIRED)` |
| `ACCOUNT_LOCKED` | `(auth, account-locked, HOST_ACCOUNT_LOCKED)` |
| `BOOTSTRAP_DOCUMENT_FAILED` | `(bootstrap, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `BOOTSTRAP_NEGOTIATION_REJECTED` | `(bootstrap, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `MANIFEST_CAPABILITY_REJECTED` | `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)` |
| `MANIFEST_INTEGRITY_FAILED` | `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)` |

`READY` / `READY_DEGRADED` 不产生 failure。对 manifest 或顶层 page schema 的 Host-level 获取，先按
ADR-0036 D3 的认证优先级处理：anonymous/未认证状态的 `401` 只能映射
`HOST_AUTH_REQUIRED`，authenticated 状态的 `401` 只能映射 `HOST_REAUTH_REQUIRED`，任意 `403` 只能映射
`HOST_FORBIDDEN`；这些结果仍保留既有
`onAuthFailure`/forbidden 语义。排除上述全部 `401`/`403` 映射后，manifest 既有稳定错误（包括
`MANIFEST_LOAD_FAILED`、`MISSING_PROTOCOL_VERSION`、`UNSUPPORTED_PROTOCOL_VERSION` 与
`MISSING_REQUIRED_CAPABILITY`）才映射 `(manifest, protocol-rejected, HOST_PROTOCOL_REJECTED)`，原码保留在
diagnostics；Node DataRef、Action 与局部业务请求不适用本条。

## 明确非目标

- 不定义 branding/profile、locale/theme/timezone、tenant 或 offline document；
- 不定义 session/login/refresh endpoint 或 credential transport；
- 不允许 bootstrap document 内嵌 manifest、页面 schema、任意扩展对象或 executable URL；
- 不改变 v2.7 Host 直接从 manifest 启动的合法行为。

## Accept 原子交付

- 新 bootstrap 核心规范与封闭 JSON Schema；
- discovery/404 fallback、availability、integrity、auth state、cache/304 的正反 fixtures；
- JS/Python reference 逐字段一致；
- Host claim capability `host.bootstrap` 与至少一个生产 Host evidence；
- migration、CHANGELOG、目标 MINOR release goal 与 `protocol-manifest.json` 原子更新。

## 开放问题

无。字段命名可在 Schema 落地时做不改变本 ADR 语义的编辑修订。
