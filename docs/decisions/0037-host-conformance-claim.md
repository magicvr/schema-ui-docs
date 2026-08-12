---
status: accepted
date: 2026-08-12
last_updated: 2026-08-13
applies_to: schema-ui-protocol v2.8
track: Host/App interoperability
---

# ADR-0037: Host conformance claim 与 evidence 制品

## 状态

**Accepted（2026-08-13，H1 评审通过）。** 依赖 [ADR-0034](./0034-host-app-interoperability-boundary.md)。本文定义
可核验声明格式；它不让自报声明成为安全信任根，也不改变 ADR-0009 的 runtime 协商。accept 不宣称生产
支持；机器契约与生产 evidence 门禁见 H2–H4。（2026-08-13 发布后注记：H2–H4 已闭合，
`v2.8.0` 已发布，本段为 accept 时点状态。）

## 背景

当前 Host 可以声称“支持 2.7”或列出 capability，但协议没有 claim scope、suite identity、fixture digest、
partial-support 禁止项或 evidence 格式。消费者因此可能把编译成功、fixture adapter 或一个布尔值误当成
生产 conformance。

## 决策

### D1. Claim 是构建生成的静态 JSON

claim 可以嵌入 Host bundle，或从显式/同源 URL 加载；无论载体如何，验证对象都是同一组不可变 bytes。
禁止运行时根据当前 App 动态扩张 supported versions/capabilities。

候选结构：

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

固定对象全部 `additionalProperties: false`；集合非空、无重复并按字节升序输出，确保可复现 digest。

### D1a. 规范化序列化（可复现 digest 的唯一权威，H1 评审 F-3）

claim 的 digest 只对规范化序列化后的 UTF-8 bytes 计算 SHA-256。规范化规则固定为：

1. 对象键按 UTF-8 字节升序输出；
2. 字符串数组按元素 UTF-8 字节升序；
3. 对象数组按每个元素规范化序列化后的字节升序（`suites` 即按整个 suite 对象字节序，`evidence` 同理）；
4. JSON 字符串转义只保留 RFC 8259 必转字符（`"`、`\` 与控制字符），`/` 与其它可打印字符不转义；
5. 数字、布尔、`null` 按 JSON 常规输出；禁止多余空白。

同一组不可变 bytes 无论来自内嵌 bundle 还是 URL 加载，必须产出同一 digest。claim builder 与 verifier
必须消费同一规范化实现（以 reference 实现为准）。

### D2. Support scope 必须精确

- `pageVersions` 与 `manifestVersions` 是独立列表，元素必须精确 `MAJOR.MINOR`；
- 每个列出的版本表示完整实现该版本的 mandatory behavior，不允许版本范围、`latest`、`compatible` 或
  “最近版本”推断；
- capability 只允许协议 registry 已登记 ID；未知 ID 使 claim 无效；
- capability 依赖必须闭包，例如 `app.navigation` 必须同时列 `app.manifest`；
- runtime 仍对具体 page/manifest 执行 ADR-0009 协商。Claim 不能让不匹配输入通过。

capability registry 是独立、机器可读、进入协议制品的封闭对象。每项至少包含：

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

`deprecatedSince`/`removedIn` 必须是精确 MAJOR.MINOR 或 `null`；`removedIn` 若非空必须晚于
`deprecatedSince`。registry ID 唯一，依赖图必须无环。claim 校验时，对 claim `support.pageVersions` /
`support.manifestVersions` 的每个元素 `v`，任一被列出 capability 的 `removedIn` 非空且 `removedIn ≤ v`，
即视为该版本已移除 → 该 capability 在该 claim 中按未登记处理（`UNKNOWN_CLAIM_CAPABILITY`）。

### D3. 禁止 partial support 冒充 capability

claim 不提供 `partial: true`、百分比、skip 或 allowlist 字段。Host 只有在完成该 capability 的全部 mandatory
fixtures 与 behavioral obligations 后才能列出 capability。

未完成能力可在非协议 issue/roadmap 中跟踪，不得放入 claim。fixture-only adapter、storybook、mock、
开发开关或未进入生产入口的代码均不是 capability evidence。

### D4. Suite 与 digest 绑定

- `protocolArtifact.contentSha256` 必须等于 Host 构建实际消费的协议制品内容摘要；
- `fixtureSha256` 必须等于该制品声明的 versioned fixture digest；
- `suites[]` 至少覆盖 support 列表所需的全部 mandatory suite；`result` 首版只允许 `pass`；
- suite 未运行、skip、xfail、过期版本或 digest 不符时，相关 capability/版本不得进入 claim；
- reference runner 通过只能证明 reference；Host evidence 必须来自生产入口或等价 build 的测试运行。

### D5. Evidence 是可核对引用，不是信任替代

`evidence.kind` 首版允许 `ci-artifact`、`signed-attestation`、`local-report`：

- `uri` 必须是同源 path、`https:` 或构建内相对 artifact path，禁止凭据/userinfo；
- `subjectBuildId` 必填，必须与 `host.buildId` 逐字相等；不等即 `CLAIM_EVIDENCE_BUILD_MISMATCH`；
- `sha256` 绑定 evidence bytes；远端不可用时 claim 仍可解析，但审计状态为 unverifiable，不得宣称已独立证明；
- evidence bytes 的格式由 `kind` 对应 profile 校验；`local-report` / `ci-artifact` 首版报告 Schema 也必须含
  同一 `subjectBuildId`，远端 bytes 取回后逐字核对并验证 digest，不能只信 claim 外壳；
- 签名/供应链信任不是本 ADR 首版门禁，未来可扩展为独立 attestation profile。

### D6. Claim 校验结果

| code | 条件 |
|---|---|
| `CLAIM_OK` | 结构、版本、registry、依赖、digest 与 suite coverage 均通过 |
| `INVALID_CLAIM` | 结构/封闭对象/集合/格式错误 |
| `UNKNOWN_CLAIM_VERSION` | `claimVersion` 不支持 |
| `UNKNOWN_CLAIM_CAPABILITY` | capability 未登记 |
| `INCOMPLETE_CAPABILITY_DEPENDENCY` | capability 依赖未闭包 |
| `CLAIM_ARTIFACT_MISMATCH` | artifact digest 与运行构建不一致 |
| `CLAIM_FIXTURE_MISMATCH` | fixture digest/version 不一致 |
| `CLAIM_SUITE_INCOMPLETE` | mandatory suite 缺失或非 pass |
| `CLAIM_EVIDENCE_BUILD_MISMATCH` | evidence 外壳或报告 bytes 的 build ID 与 `host.buildId` 不同 |
| `CLAIM_EVIDENCE_UNVERIFIABLE` | claim 可解析但 evidence 当前不可核对；不得升级为 `CLAIM_OK` |

检查顺序按表从结构、claim version、registry/dependency、artifact、fixture、suite、evidence 执行，首个失败即返回。

### D7. App 如何使用 claim

- 默认情况下 claim 是审计与诊断制品，不是 App 输入；App 只通过 manifest required capabilities 请求行为；
- 若未来 App 必须要求可出示 claim，可声明 `host.conformance-claim` capability；缺失时按
  `MISSING_REQUIRED_CAPABILITY` fail-closed；
- App 不得引用特定 Host ID、CI vendor 或 evidence URL 作为业务渲染条件；
- claim 不包含 principal、tenant、feature flag、token、endpoint credential 或运行时请求日志。

## 明确非目标

- 不定义认证签名、SLSA level、CI vendor API 或公共 transparency log；
- 不让 claim 代替 runtime validation、生产授权或安全审计；
- 不接受“代码存在”“TypeScript 类型通过”“reference pass”作为生产 Host 完整支持证据；
- 不把 proposed ADR 的 capability 写进稳定 claim。

## Accept 原子交付

- capability registry 与 dependency machine contract；
- claim JSON Schema、validator、稳定错误码和正反 fixtures；
- mandatory suite → version/capability coverage 映射；
- reproducible claim builder、JS/Python verifier、生产 Host evidence；
- migration、CHANGELOG、目标 release goal 与 `protocol-manifest.json` 原子更新。

## 开放问题

无。签名 attestation 明确后续 profile。
