---
status: example
protocol_version: v0.2
last_updated: 2026-07-11
---

# 场景示例：表单内文件上传

对应组件：`form` / `upload` / `input`。上传契约见 [03-component-registry.md](../03-component-registry.md) 与 [07-actions-contract.md](../07-actions-contract.md)。

关键点：

- 使用 `upload.props.actionRef` 引用顶层 `type: upload` action。
- 页面声明 `meta.requiredCapabilities: [actions.upload]`。
- `actionRef` 模式下 `accept` / `maxSize` / `multiple` 以 UploadAction 为唯一来源，组件 props 不得重复声明。

```yaml
meta:
  pageId: contract_upload
  title: 合同附件上传
  protocolVersion: "0.2"
  requiredCapabilities:
    - actions.upload

actions:
  uploadContract:
    type: upload
    url: /api/files/upload
    method: POST
    fieldName: file
    accept: .pdf,.doc,.docx
    maxSize: 10485760
    multiple: true
    onSuccess:
      behavior: toast
      message: 文件上传成功
    onError:
      behavior: toast
      message: 上传失败，请重试
  submitContract:
    type: request
    method: POST
    url: /api/contracts
    onSuccess:
      behavior: toast
      message: 提交成功
    onError:
      behavior: toast
      message: 提交失败

body:
  type: form
  props:
    title: 新建合同
    submitAction: submitContract
  children:
    - type: input
      props:
        field: title
        label: 合同标题
        required: true
    - type: upload
      props:
        field: attachments
        label: 合同附件
        actionRef: uploadContract
        required: true
        description: 支持 PDF/Word，每文件不超过 10MB
```

## 流程说明

1. 用户选择文件后，Renderer 按 `uploadContract` 向 `/api/files/upload` 发起 `multipart/form-data` 请求。
2. 上传成功后，`attachments` 字段值设为后端返回的文件 URL 或 ID（多文件为数组）。
3. 用户提交表单时，`submitContract` 将 `title` 与 `attachments` 作为 JSON 请求体发送，不再重新上传文件。

## 对照：`props.action` 直接 URL 模式

若无需顶层 UploadAction，可改用组件级 URL（此时 `accept`/`maxSize`/`multiple` 写在组件 props 上，且**不必**声明 `actions.upload` 能力）：

```yaml
# 片段：仅展示 upload 节点差异
- type: upload
  props:
    field: attachments
    label: 合同附件
    action: /api/files/upload
    accept: .pdf,.doc,.docx
    maxSize: 10485760
    multiple: true
```
