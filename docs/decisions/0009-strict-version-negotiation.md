---
status: accepted
date: 2026-07-11
---

# ADR-0009: 严格版本与 capability 协商

## 状态

已接受（Accepted）。本 ADR 关闭 v1.0 门禁 G1，取代 Renderer 早期的最低兼容版本和“最接近版本”推断规则。

## 背景

页面通过 `meta.protocolVersion` 声明 MAJOR.MINOR，Renderer 通过 `supportedVersions` 声明自己实现的协议版本。旧规则还允许配置 `minCompatibleVersion`，并对未显式支持但高于最低版本的页面尝试使用“最接近的已知版本”。缺失版本的旧页面也会被隐式视为 `0.1`。

这两条 fallback 无法跨实现保持一致：不同 Renderer 可能拥有不同版本集合、不同的“最接近”定义和不同的旧页面假设。同一输入因此可能被一个实现接受、另一个实现拒绝，或按不同规则执行。

## 决策

### D1. 只接受精确声明的 MAJOR.MINOR

标准 Renderer 入口必须接收非空、无重复的 `supportedVersions` 列表。页面 `meta.protocolVersion` 只有与列表中的某一项逐字相等时才通过版本匹配。

- 不支持的 MAJOR：拒绝；
- 同一 MAJOR 下未显式支持的 MINOR：拒绝；
- 不做数值范围推断、向前兼容猜测、向后兼容猜测或最近版本选择；
- 删除 `minCompatibleVersion` 初始化参数。

版本字符串统一匹配 `^[0-9]+\.[0-9]+$`。Schema 负责提交前格式校验，Renderer 仍必须在运行时入口 fail-closed，防止调用方绕过 CI。

### D2. 固定判定顺序和结构化结果

协商按以下顺序执行，命中拒绝后立即返回，不继续检查后续条件：

1. 页面版本是否存在且格式合法；
2. Renderer 的 `supportedVersions` 是否为合法、非空、无重复列表；
3. 页面版本是否精确包含在 `supportedVersions`；
4. 页面 `requiredCapabilities` 是否为合法、无重复字符串列表；
5. Renderer 是否支持页面要求的全部 capability。

参考结果结构：

```json
{
  "accepted": false,
  "code": "UNSUPPORTED_PROTOCOL_VERSION",
  "pageVersion": "0.4",
  "supportedVersions": ["1.0"],
  "missingCapabilities": []
}
```

稳定错误码：

| code | 条件 |
|---|---|
| `MISSING_PROTOCOL_VERSION` | 页面缺失 `meta.protocolVersion` |
| `INVALID_PROTOCOL_VERSION` | 页面版本不是 MAJOR.MINOR |
| `INVALID_RENDERER_SUPPORT` | `supportedVersions` 非法、为空或重复 |
| `UNSUPPORTED_PROTOCOL_VERSION` | 页面版本未被精确声明支持 |
| `INVALID_REQUIRED_CAPABILITIES` | 页面 capability 列表非法或重复 |
| `MISSING_REQUIRED_CAPABILITY` | Renderer 缺少至少一个页面要求的 capability |
| `OK` | 版本和 capability 全部匹配 |

`missingCapabilities` 按页面 `requiredCapabilities` 的声明顺序返回。`supportedCapabilities` 缺失时按空列表处理；其中未知 capability 不报单独错误，只要页面要求它且 Renderer 未声明支持，就归入 `MISSING_REQUIRED_CAPABILITY`。

### D3. 缺失版本只能由显式 legacy adapter 处理

标准 Renderer 入口不得把缺失 `protocolVersion` 的页面隐式视为 `0.1`。宿主若仍需读取旧页面，必须在调用 Renderer 前显式选择并调用 legacy adapter：

```javascript
const migratedPage = legacyAdapters.v01.toVersion("0.3", legacyPage);
renderer.render(migratedPage);
```

adapter 契约：

- adapter 名称必须标识源格式和目标 MAJOR.MINOR；
- 输出必须显式包含目标 `meta.protocolVersion`；
- 输出必须重新通过目标版本的 L0-L4 校验和标准协商；
- adapter 失败时返回迁移错误，不得把原始页面继续交给 Renderer；
- Renderer 不自动发现、选择或串联 adapter；
- 本 ADR 不要求仓库提供 v0.1 adapter 实现，只定义接入边界。

### D4. capability 在版本匹配后检查

`protocolVersion` 表达结构版本，`requiredCapabilities` 表达同一结构版本内页面依赖的执行能力。只有版本精确匹配后才检查 capability，避免把结构不兼容误报为能力缺失。

页面没有 `requiredCapabilities` 时按空列表处理。Renderer 支持页面要求的全部 capability 才可继续解析和渲染；任何缺失能力都必须在加载前拒绝。

### D5. 一致性 fixtures 是规范的一部分

`conformance/fixtures/version-negotiation/` 中的输入和期望输出是本 ADR 的机器可执行示例。JavaScript reference、前端 Renderer 和后端消费者必须直接消费同一 fixtures，并产生逐字段相同的结果。

fixtures 至少覆盖：支持版本、未知 MINOR、未知 MAJOR、缺失版本、畸形版本、非法 Renderer 支持列表、缺失 capability 和未知 capability。

## 后果

**正面：**

- 任意页面与 Renderer 支持声明只有一个接受或拒绝结果；
- Renderer 不再因本地版本集合不同而选择不同 fallback；
- 旧页面迁移成为显式、可测试的边界；
- 结构版本错误和 capability 错误可以稳定分类。

**负面 / 取舍：**

- Renderer 必须逐个声明支持的 MINOR，不能依赖范围表达式；
- 旧页面不能直接进入标准入口，接入方需要维护明确的 adapter；
- 即使某个未知 MINOR 在实践中看似兼容，也必须先升级 Renderer 的支持声明和一致性测试。