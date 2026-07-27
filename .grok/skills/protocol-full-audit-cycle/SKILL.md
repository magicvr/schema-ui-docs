---
name: protocol-full-audit-cycle
description: "对 Schema-UI 协议、Schema、校验器、conformance、MCP、CI/CD、发布制品与生产消费者执行全量复审、修复和审计归档闭环。Use when: full audit cycle, protocol audit, release integrity review, conformance/MCP/release/consumers 全量审计, docs/audit 建档与归档, protocol-full-audit-cycle, 发布前复审。"
argument-hint: "可选：focus=protocol|conformance|mcp|release|consumers|all；mode=review-only|to-fix|full；或指定重点路径/版本关注点。归档始终需最终确认"
---

# Protocol Full Audit Cycle

## Single source of truth（强制）

本 skill **不内嵌**审计 runbook 正文。权威流程的**唯一来源**是：

[`.github/prompts/protocol-full-audit-cycle.prompt.md`](../../.github/prompts/protocol-full-audit-cycle.prompt.md)

以后若要修改提示词、步骤、门槛、参数或输出要求，**只改上述 prompt 文件**。本 skill 只做发现入口与加载门闩，避免双源漂移。

## 加载步骤（每次调用必做）

1. 立即用文件读取工具**完整读取** [`.github/prompts/protocol-full-audit-cycle.prompt.md`](../../.github/prompts/protocol-full-audit-cycle.prompt.md)（含 frontmatter 与全部步骤正文）。
2. 将读到的内容视为本任务的完整指令；其优先级高于本 skill 中的任何摘要或记忆。
3. 解析用户参数（`focus` / `mode` / 路径 / 版本关注点）；缺省按 prompt 规定处理。
4. **严格按 prompt 的步骤 1→2→3 执行**，包括启动门槛、建档门槛、步骤确认门控，以及归档前的最终确认。
5. 若 prompt 与本 skill 摘要冲突，**以 prompt 为准**。

## 禁止

- 禁止把 runbook 正文复制进本 `SKILL.md` 或其它 skill/agent 文件。
- 禁止在未读取 prompt 的情况下凭记忆执行审计闭环。
- 禁止在未满足 prompt 启动门槛时创建 `docs/audit` 新编号。
- 禁止在未经用户最终确认时执行归档。

## 发现用摘要（非权威）

仅用于判断是否应加载本 skill；执行细节一律以 prompt 为准：

- 重量级发布一致性审计，不是日常健康检查
- 覆盖：规范、Schema、conformance、MCP、CI/CD、发布制品、生产消费者
- 三步闭环：复审 →（按门槛）建档 → 修复/验证 → 用户确认后归档
- `docs/audit/**` 永不进入 `protocol-manifest.json`、协议制品、MCP 搜索索引或 Docker 运行镜像
