# 架构决策状态

本目录同时保存已接受与未接受的 ADR。只有同时满足以下条件的 ADR 才是当前协议语义权威：

1. front matter `status: accepted`；
2. 已列入根 `protocol-manifest.json` 的 `authority.semanticSpecs`；
3. 与对应核心规范、Schema 和 conformance fixtures 原子一致。

`status: proposed` 的 ADR 只是评审材料，不改变当前协议版本，不得作为生产 capability、字段或行为已支持的
证据。提案若附带 `Accept 原子交付`，其中未完成条目是未来门禁，不是当前事实。
