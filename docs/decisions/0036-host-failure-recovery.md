---
status: accepted
date: 2026-08-12
last_updated: 2026-08-13
applies_to: schema-ui-protocol v2.8
track: Host/App interoperability
---

# ADR-0036: Host failure result 与恢复语义

## 状态

**Accepted（2026-08-13，H1 评审通过）。** 依赖 [ADR-0034](./0034-host-app-interoperability-boundary.md)，并消费
[ADR-0035](./0035-host-bootstrap-lifecycle.md) 的阶段/结果。本文不替代 API、manifest 或 Action 的既有错误结构。
accept 不宣称生产支持；机器契约与生产 evidence 门禁见 H2–H4。（2026-08-13 发布后注记：
H2–H4 已闭合，`v2.8.0` 已发布，本段为 accept 时点状态。）

## 背景

当前协议分别定义节点错误、`{code,message}` API 错误、Action outcome 与 manifest 稳定码，却没有 Host
级结果来区分启动失败、auth lost、route not found、rate limit、offline 或 renderer crash。Host 因而会按
后端私有码做程序化分支，造成跨实现漂移并可能泄露诊断详情。

## 决策

### D1. Host failure 是归一化结果，不是新的后端 envelope

Host 只从 D3 提升谓词列出的 bootstrap、Host-level HTTP、manifest/page-schema、router 或 runtime 异常构造
下列封闭对象；Node DataRef 与 Action 结果不进入本对象：

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

固定对象全部 `additionalProperties: false`。后端 `code` 保持 opaque 调试字段；Host **不得**把任意后端
`code` 复制为 `hostCode` 或据此执行未登记动作。

`failureId` 必填，是应用实例内每次 primary failure occurrence 的唯一可打印字符串；同一 failure surface 的
倒计时、重绘和手动 retry 保持该 ID，恢复后发生的新 failure 必须生成新 ID。它不等于后端 request ID，
不含用户数据，也不要求跨实例全局唯一。

### D2. 分类与稳定码

| `kind` | `hostCode` | 典型来源 |
|---|---|---|
| `maintenance` | `HOST_MAINTENANCE` | ADR-0035 maintenance |
| `upgrade-required` | `HOST_UPGRADE_REQUIRED` | ADR-0035 upgrade-required 或 HTTP 426 adapter |
| `authentication-required` | `HOST_AUTH_REQUIRED` | anonymous 打开需认证入口、Host-level 401 |
| `reauth-required` | `HOST_REAUTH_REQUIRED` | auth-lost、session adapter reauth-required |
| `account-locked` | `HOST_ACCOUNT_LOCKED` | session adapter locked；不得进入 ready |
| `forbidden` | `HOST_FORBIDDEN` | 403；不得转为登录 |
| `not-found` | `HOST_ROUTE_NOT_FOUND` | 应用 route 未命中；页内 resource 404 不提升 |
| `rate-limited` | `HOST_RATE_LIMITED` | Host-level HTTP 429 |
| `timeout` | `HOST_TIMEOUT` | Host-level request timeout |
| `offline` | `HOST_OFFLINE` | transport 明确不可达；不是任意 5xx |
| `protocol-rejected` | `HOST_PROTOCOL_REJECTED` | version/capability/schema/integrity fail-closed |
| `render-failed` | `HOST_RENDER_FAILED` | Host/Renderer 未捕获异常边界 |
| `unavailable` | `HOST_UNAVAILABLE` | 其它可安全归类的 5xx/transport failure |

`scope` 为 `bootstrap`、`manifest`、`page`、`auth`、`route`、`runtime`。同一底层失败只产生一个
primary failure。`403` 永远优先并唯一映射 forbidden；其余优先级为 auth/reauth/account-locked →
protocol rejection → explicit Host-level HTTP class → Host-level transport → runtime。

### D3. 不改变既有错误处理

- `401` 继续触发 `onAuthFailure(401)`，不展示后端具体文案；只有下表列出的 Host-level 来源或 session
  adapter 明确 auth-lost 才归一化为 auth/reauth result；
- `403` 继续是 forbidden 且不跳转登录；
- `400 + errors` 继续字段回填，不能被 Host failure 吞掉；
- Action `onError` 的顺序与允许行为不变，不新增隐式 navigate/reload/closeModal；
- manifest 稳定码保留在 `diagnostics.protocolCode`，primary `hostCode` 仅表达 Host 恢复类别；
- backend `{code,message}` 不因本 ADR 变为程序化协议。

Host failure 的**提升谓词**是封闭的：仅以下事件生成本 ADR 的全局 result/surface：

| 来源 | 是否提升 |
|---|---|
| ADR-0035 terminal bootstrap/auth/availability 结果 | 是，按 0035 D7 映射 |
| manifest 或顶层 page schema 获取/校验失败 | 是；page `scope` 只指页面 schema 根，不含 Node DataRef |
| 应用 router 未命中注册 route，且也未命中 D3a Host-owned path | 是，`HOST_ROUTE_NOT_FOUND` |
| bootstrap/manifest/page-schema Host-level fetch 在 anonymous/未认证状态返回 401 | 是，`HOST_AUTH_REQUIRED` |
| session adapter 明确 auth-lost，或上述 Host-level fetch 在 authenticated 状态返回 401 | 是，`HOST_REAUTH_REQUIRED` |
| Host/Renderer 未捕获 runtime crash | 是，`HOST_RENDER_FAILED` |
| Node DataRef/options/recordSource 的 401/403/404/409/422/429/5xx/timeout/offline/cancel | 否，继续 `04`/`08` 节点语义与 `onAuthFailure` hook；不生成全局 Host result |
| Action 的任意 HTTP/transport/cancel 结果 | 否，继续 `07` outcome、字段错误和 retryPolicy |
| 其它业务 API `4xx` | 否，继续既有节点/Action 语义；不推断 Host kind |

因此 `scope` 不含 `action`。`HOST_TIMEOUT`、`HOST_OFFLINE`、`HOST_RATE_LIMITED`、`HOST_UNAVAILABLE` 只在
bootstrap/manifest/page-schema 的 Host-level fetch 命中，绝不把局部请求提升为全局 failure。

#### D3a. Host-owned path 排除

Host 在 router 初始化时建立封闭的 `hostOwnedPaths`：

1. manifest `navigation` 中每个 `url` 的应用内 path；
2. Host 显式配置的登录、回调、登出落地和其它宿主页 path；
3. 空 `pages` 壳的 Host router 已注册 path。

D4a 未命中 manifest route 但精确命中 `hostOwnedPaths` 时交给 Host router，不生成协议 404。该列表只接受
应用内 path 模板，不能用通配符吞掉未知路径；同一 path 同时命中 manifest route 与 Host path 时，manifest
route 优先。两者均未命中才产生 `HOST_ROUTE_NOT_FOUND`。

### D4. Retry 语义

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

### D5. 安全消息、诊断与 correlation

- `message` 至少含 `messageKey`；可含 primitive `params`，禁止 HTML；Host 词典未命中使用安全通用文案；
- `diagnostics` 只允许 `phase`、`protocolCode`、`hostVersion`、`protocolVersion`、`manifestSha256`；
- `correlation` 只允许 `requestId`、`traceId`，均为 Host 已验证的可打印短字符串；不得包含 header dump、URL
  query、token、principal、stack、请求/响应 body；
- stack 和原始异常只进受控日志，永不进入用户可复制的 failure result；
- `support` 动作若带 URL，只允许同源应用 path 或无 userinfo 的 `https:` URL，打开外链须 `noopener` /
  `noreferrer`；return intent 只能是同一应用根下的 path/query，不接受绝对 URL。

### D6. Recovery actions 与 return intent

`recoveryActions` 是封闭对象数组，每项 `type` 为 `retry`、`reauth`、`home`、`back`、`reload`、`support`；
仅 `support` 允许可选 `url`，其它类型出现 `url` 均结构拒绝。Host 必须按 kind 过滤：

- forbidden 与 account-locked 不得提供 `reauth`，无例外；account-locked 只允许 `home` / `support`；
  同一事件同时观察到 403 与 adapter reauth-required 时仍以
  forbidden 为唯一 primary result，不跳转登录；
- protocol-rejected 不得提供“继续渲染”；
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
query 值为 string。首版协议 allowlist 保留 `tab`、`view`、`page`、`pageSize`、`sort`，以及 manifest
对当前注册页声明的 `returnIntentQueryKeys`（H1 评审 F-4 钉死落点与门控）：

- `returnIntentQueryKeys` 是 app manifest **`pages[]` 注册表项**上的可选字段（对当前注册页生效），
  值为无重复 query key 数组；
- 出现该字段的清单必须声明 `host.failure-recovery` capability（沿 ADR-0025 M1 门控模式：出现字段但
  未声明 capability → M1 拒绝，不得部分消费）；
- 未声明 `host.failure-recovery` 的 Host 不得消费该字段扩展 allowlist；Host 实现声明该 capability 后，
  该字段进入其 return intent allowlist 的来源之一，Host 只能进一步收窄，不能扩张。

Host 必须永久拒绝大小写不敏感的 `token`、
`access_token`、`id_token`、`code`、`state`、`session`、`redirect`、`returnTo`，即使误被声明；未列 key
一律丢弃，Host 只能进一步收窄，不能扩张。成功消费一次后 nonce 作废，不得重放。普通 deep link 不受此
恢复意图 allowlist 影响。

### D7. A11y 最低义务

Host 显示全局 failure surface 时必须：

1. 使用 `main` landmark 内的唯一错误标题；
2. 首次进入 terminal failure 后把 focus 移到标题或容器，重试中的短暂状态不重复抢焦点；
3. auth/protocol/render terminal failure 使用 assertive announcement；maintenance/rate-limit/retry countdown 使用 polite；
4. 相同 `failureId` 的重绘不重复播报；新 `failureId` 必须重新播报；
5. recovery actions 可键盘到达，执行后 focus 落到新 surface 的标题或恢复页面主标题。

仅声明 `host.failure-recovery` 的 Host/Renderer 承担以下增量义务：对既有 `400 + errors` 继续字段回填；
提交失败后必须把 focus 移到第一个可聚焦的错误字段，
若只有 form-level error 则移到 form error summary，并通过 assertive live region 播报一次。此义务不把字段
错误升级为全局 Host failure，也不回溯改变未声明该 capability 的 v2.7 Renderer。

这些是 Host behavioral conformance；不规定 DOM id、CSS 或具体组件库。

## 明确非目标

- 不定义 notification center、toast 历史、后台 job、telemetry 上传或审计数据库；
- 不定义错误页面视觉、support vendor、日志格式或 crash report endpoint；
- 不用 failure result 替代页面节点 loading/empty/error 或表单字段错误；
- 不允许业务后端通过 `hostCode` 驱动 Host 任意命令。

## Accept 原子交付

- Host failure JSON Schema、分类/优先级/retry/return-intent fixtures；
- app manifest `returnIntentQueryKeys` 字段、capability 门控与敏感 key 反例；
- 401/403、400 field errors、manifest rejection、route/resource 404、429、offline、crash 正反向量；
- JS/Python reference 与 browser-level focus/live-region tests；
- capability `host.failure-recovery`、生产 Host evidence、migration/CHANGELOG/release goal/manifest 更新。

## 开放问题

无。
