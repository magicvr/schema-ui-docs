---
status: accepted
date: 2026-07-11
---

# ADR-0012: 上传请求批次与响应取值

## 状态

已接受（Accepted）。本 ADR 关闭 v1.0 G4 上传一致性所需的运行语义缺口，不改变 UploadAction 或 upload 组件的配置结构。

## 背景

协议已经规定上传使用 `multipart/form-data`，默认 `POST`、默认文件字段名 `file`，响应值优先取 `url`、否则取 `id`，`multiple: true` 的表单字段值为字符串数组。但现有响应契约只描述单文件对象，未定义多文件是一次批量请求还是逐文件请求，也未定义部分成功、返回顺序和字段提交时机。

## 决策

### D1. 每个文件对应一个 multipart 请求

单文件和多文件使用同一请求形状：每个请求只包含一个文件 part，part 名取 `fieldName`，未声明时为 `file`。HTTP method 取 UploadAction `method`，未声明时为 `POST`。

`multiple: true` 时，Renderer 按用户选择顺序逐文件串行上传。协议不定义单次请求中重复文件 part，也不定义批量响应数组。这样后端始终只需实现 `07-actions-contract.md` §7.2 的单文件响应对象。

### D2. 客户端约束在请求前执行

Renderer 在构造任何请求前，以 UploadAction（`actionRef` 模式）或组件 props（直接 URL 模式）为唯一约束源检查：

- `multiple: false` 或缺省时最多选择一个文件；
- `maxSize` 对每个文件独立检查；
- `accept` 按逗号分隔 token，忽略 token 两侧 ASCII 空白；`.ext` 匹配文件名扩展名（大小写不敏感），`type/*` 匹配 MIME 主类型，其他 token 精确匹配 MIME（大小写不敏感）。

任一文件不满足约束时整批拒绝，不构造或发送任何请求。服务端仍必须独立校验文件类型和大小。

### D3. 响应取值

每个成功响应必须是对象，并至少包含非空 string `url` 或非空 string `id`。字段值优先取 `url`；没有合法 `url` 时取 `id`。`name` / `size` 仅用于展示，不改变字段取值。

单文件最终字段值为 string；多文件最终字段值为按选择顺序排列的 string 数组，不按网络完成顺序重排。

### D4. 批次失败原子性

多文件批次中任一请求失败或响应缺少合法 `url` / `id` 时，停止后续请求，整批进入错误处理，当前选择产生的字段值不提交。已成功上传的远端文件清理由后端临时对象/业务回收机制处理；协议不定义补偿删除请求。

只有全部文件成功后，Renderer 才一次性提交最终字符串数组并执行一次 `onSuccess`。失败时只执行一次 `onError`，其 HTTP 优先级复用 Action/错误时序 fixtures。

### D5. 一致性向量

框架无关向量位于 `conformance/fixtures/uploads/cases.json`。输入中的文件只记录 `name`、`type`、`size` 和稳定测试内容标识；期望请求记录 method、url、part name 与文件名，不记录 multipart boundary 或原始二进制字节。

## 后果

**正面：** 单文件响应契约可直接复用于多文件；字段数组顺序稳定；部分失败不会把半成品值写入表单。

**负面 / 取舍：** 多文件串行上传吞吐低于并行或单请求批量上传；协议不提供自动补偿删除。未来若需要并行、进度聚合或后端批量接口，必须通过新 ADR 和 capability 明确扩展。