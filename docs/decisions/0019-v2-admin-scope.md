---
status: accepted
date: 2026-07-18
applies_to: schema-ui-protocol v2.0
---

# ADR-0019: v2.0 Admin 协议范围

## 决策

v2.0 核心协议定义基础 Admin 页面共享契约：布局、展示、列表/分页、搜索筛选、基础表单、上传、声明式 RowAction request、权限显隐和声明式联动。

以下能力明确不属于 v2.0 核心协议，不能被描述为已支持能力，也不能要求每个 Renderer 通过私有 handler 猜测实现：

- 页面级 Toolbar/ActionTrigger；
- 标准记录详情和编辑导航；
- 编辑记录加载、initialValues 和表单回填；
- 标准 recordView/details 组件；
- 批量操作和完整权限继承。

这些能力若需要跨项目互操作，必须新增协议字段、Schema、capability、ADR 和 versioned fixtures；在此之前它们是明确的后续协议范围，而不是当前 v2.0 页面契约的未实现部分。

后续执行轨道（优先级、分阶段目标、版本策略与成功标准）见 [`11-next-admin-lifecycle-goals.md`](../11-next-admin-lifecycle-goals.md)。该文档不改变本 ADR 对 v2.0 范围的裁决。

## 后果

“通用 Admin”在本协议中指可互操作的基础页面协议，不等于覆盖所有 CRUD 生命周期。生产 Renderer 可通过 Host Extension 提供额外能力，但该能力不属于核心页面的跨实现保证。
