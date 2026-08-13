---
status: stable
owner: 前后端架构组
last_updated: 2026-08-13
---

# 发布门禁与演进轨道（非核心协议）

本目录存放 **版本 accept / 发布门禁** 与 **演进轨道** 文档。

它们属于协议制品中的 **informative release metadata**（见根 `protocol-manifest.json`），**不是** 协议语义权威：

| 要回答的问题 | 请看 |
|---|---|
| 字段语义、默认值、能力边界 | `docs/00`–`10`、已接受 ADR |
| JSON/YAML 结构 | `docs/schemas/` |
| 可观测算法结果 | `conformance/fixtures/` |
| 版本升级怎么改配置 | `docs/migrations/` |
| 某次发布曾要求关闭哪些门禁 | **本目录** |

实现 Renderer、后端生产方或校验工具时，**不得**把本目录勾选清单当作新增语义来源。门禁结论若影响协议，必须已沉淀到核心规范、ADR、Schema 或 fixtures。

## 文件一览

| 文件 | 说明 |
|---|---|
| [v1.0.md](./v1.0.md) | `v1.0.0` 历史发布门禁 |
| [v2.0.md](./v2.0.md) | `v2.0.0` MAJOR 发布门禁 |
| [v2.1.md](./v2.1.md) | `v2.1.0` MINOR 发布门禁 |
| [v2.2.md](./v2.2.md) | `v2.2.0` MINOR 发布门禁 |
| [v2.3.md](./v2.3.md) | `v2.3.0` MINOR 发布门禁 |
| [v2.4.md](./v2.4.md) | `v2.4` 线 MINOR 发布门禁 |
| [v2.5.md](./v2.5.md) | `v2.5` accept / 发布门禁（已发布线） |
| [v2.6.md](./v2.6.md) | `v2.6` accept / 发布门禁（F1 表单控件面 A+B） |
| [v2.7.md](./v2.7.md) | `v2.7` accept / 发布门禁（表单进阶：cascader / checkboxGroup / richText / password / defaultValue） |
| [v2.8.md](./v2.8.md) | `v2.8` accept / 发布门禁（Host/App 互操作：bootstrap / failure-recovery / conformance-claim；**当前线**） |
| [next-admin-lifecycle.md](./next-admin-lifecycle.md) | Admin 生命周期轨道：已交付 2.1–2.7、残留 D.1 backlog（规划，非语义权威；Host/App 平行轨道见 `v2.8.md`） |

历史发布门禁路径曾为 `docs/09-…`–`docs/16-…`（与核心规范同级编号）。自整理起统一放在本目录，避免被误读为协议章节。应用级规范正文现为连续编号的 [`docs/09-app-manifest.md`](../09-app-manifest.md)（v2.5 发布时曾短暂使用 `17-app-manifest.md`）。
