---
status: stable
owner: 前端架构组
last_updated: 2026-07-08
applies_to: schema-ui-protocol v0.2
---

# Action 完整契约（since 0.2）

> 本文档定义顶层 `actions` 中每个动作的完整结构。机器可读版本见
> [`schemas/action.schema.json`](./schemas/action.schema.json)。

## 1. 使用位置

顶层文档结构中的 `actions` 字段（详见 [01-node-protocol.md §2](./01-node-protocol.md#2-顶层文档结构)），
供 `form.props.submitAction`、`table.props.actions[].key` 等按 id 引用。

```yaml
actions:
  createOrder:
    type: request
    method: POST
    url: /api/orders
```

## 2. `type` 枚举

| type | 含义 |
|---|---|
| `request` | 发起一次 HTTP 请求 |
| `navigate` | 跳转到指定地址 |
| `modal` | 打开前端预注册的弹窗 |
| `upload` | 发起文件上传请求（`multipart/form-data`） |
| `custom` | 调用前端白名单预注册的处理函数（**不接受任意代码/表达式**，仅传函数名引用） |

`custom` 类型的边界与联动表达式引擎的原则一致（见 [02-reaction-expression.md](./02-reaction-expression.md)）：
协议只传递"意图声明"，具体实现始终由前端代码掌控，避免后端配置里出现"类代码"内容。

## 3. `request` 类型完整字段

```yaml
type: request
method: GET | POST | PUT | DELETE | PATCH
url: string
bodyMapping:            # 【可选】表单字段名 → 请求体字段名的映射
  customerName: name
onSuccess: OutcomeBehavior   # 【可选】
onError: OutcomeBehavior     # 【可选】
```

- `bodyMapping` 缺省时，表单各字段按原字段名直接组成请求体 JSON。
- `onSuccess` / `onError` 缺省时，Renderer 使用默认行为（如 `toast` 展示通用成功/失败提示）。

## 4. `navigate` 类型

```yaml
type: navigate
url: string
```

## 5. `modal` 类型

```yaml
type: modal
modalId: string   # 【可选】引用前端预注册的弹窗模板（尺寸/位置/关闭行为）
content: Node     # 【可选】直接描述弹窗内容（since 0.2.1），见下方说明
```

### 5.1 `content` 与 `modalId` 的关系

- `modalId` 提供弹窗的**模板属性**（尺寸、位置、关闭行为、动画等），可引用前端预注册的弹窗模板。
- `content`（since 0.2.1）提供弹窗的**内容**（一个完整的 Node，如 `form`/`text`/`table` 等），使弹窗内容不再依赖前端硬编码。
- `modalId` 和 `content` **可共存**——`modalId` 控制弹窗壳子，`content` 控制弹窗内容。
- 二者至少提供一个。若只提供 `content` 而不提供 `modalId`，Renderer 使用默认弹窗模板（居中、可关闭）。

```yaml
# 示例：弹窗内容 Node 化
confirmRefund:
  type: modal
  modalId: medium-dialog          # 可选，引用预注册的"中等尺寸弹窗"模板
  content:
    type: form
    props:
      title: 确认退款
      submitAction: doRefund
    children:
      - type: text
        props:
          content: 确认对该订单发起退款？
      - type: input
        props:
          field: reason
          label: 退款原因
          placeholder: 请输入退款原因
```

## 6. `custom` 类型

```yaml
type: custom
handler: string   # 仅允许引用前端白名单预注册的处理函数名
```

前端必须维护一份白名单，`handler` 值若不在白名单中，Renderer 应拒绝执行并报错。

## 7. `upload` 类型（since 0.2.5）

用于定义可复用的文件上传行为。`upload` 组件若需要复用顶层 action，应通过 `props.actionRef` 引用该 action；既有 `props.action` 字段仍表示上传接口 URL，不作为 action id 解析。

```yaml
type: upload
url: string                    # 上传接口地址（相对路径，Renderer 自动拼接 baseURL）
method: POST | PUT             # 默认 POST
fieldName: string              # 【可选】multipart 中的文件字段名，默认 "file"
accept: string                 # 【可选】允许的 MIME 类型或扩展名，如 "image/*" 或 ".pdf,.docx"
maxSize: number                # 【可选】单文件大小上限，单位字节，默认不限制
multiple: boolean              # 【可选】是否允许多文件，默认 false
onSuccess: OutcomeBehavior     # 【可选】上传成功后的行为
onError: OutcomeBehavior       # 【可选】上传失败后的行为
```

### 7.1 上传请求格式

Renderer 以 `multipart/form-data` 方式发送请求，文件字段名由 `fieldName` 指定（默认 `file`）。宿主应用注入的认证 header（见 [04-datasource-contract.md §5](./04-datasource-contract.md#5-认证约定since-025)）同样适用于上传请求。

### 7.2 上传响应体契约

后端上传接口应返回 `200` + 以下结构，Renderer 将 `url`（或 `id`）写入对应表单字段的值：

```json
{
  "url": "https://cdn.example.com/files/abc123.pdf",
  "id": "abc123",
  "name": "合同文件.pdf",
  "size": 204800
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | 与 `id` 至少一个 | 文件访问地址（CDN 或 OSS 直链） |
| `id` | string | 与 `url` 至少一个 | 文件在后端存储系统中的 ID |
| `name` | string | 否 | 原始文件名（用于 UI 展示） |
| `size` | number | 否 | 文件大小（字节），用于校验展示 |

若表单字段使用 `upload` 组件（见 [03-component-registry.md](./03-component-registry.md)），并通过 `props.actionRef` 引用本 action，上传完成后字段值默认取 `url`（若存在），否则取 `id`。`multiple: true` 时字段值为数组。

### 7.3 错误处理

上传失败时，后端应返回标准错误响应体（见 [04-datasource-contract.md §6.2](./04-datasource-contract.md#62-通用错误响应体结构)）。常见的语义化 `code` 值供参考（不强制）：

| code | 建议语义 |
|---|---|
| `FILE_TOO_LARGE` | 文件超过服务端大小限制 |
| `UNSUPPORTED_FILE_TYPE` | 文件类型不被允许 |
| `STORAGE_UNAVAILABLE` | 存储服务暂时不可用 |

> **注意：** `accept`/`maxSize` 的客户端校验由 `upload` 组件在选择文件时完成（前端拦截）；服务端仍应独立做文件类型和大小校验，不依赖前端声明。

## 8. `OutcomeBehavior`（`onSuccess` / `onError` 通用结构）

```yaml
onSuccess:
  behavior: toast | navigate | reload | closeModal
  message: string     # behavior: toast 时的提示文案
  url: string          # behavior: navigate 时的目标地址
```

| behavior | 含义 | 必填附加字段 |
|---|---|---|
| `toast` | 展示轻提示 | `message` |
| `navigate` | 跳转到指定地址 | `url` |
| `reload` | 重新加载当前数据（如刷新表格） | — |
| `closeModal` | 关闭当前弹窗 | — |

不允许出现协议未列出的行为类型或任意脚本回调。

## 9. 完整示例

```yaml
actions:
  createOrder:
    type: request
    method: POST
    url: /api/orders
    bodyMapping:
      customerName: name
    onSuccess:
      behavior: toast
      message: 创建成功
    onError:
      behavior: toast
      message: 创建失败，请重试

  goToOrderList:
    type: navigate
    url: /orders

  confirmRefund:
    type: modal
    modalId: refund-confirm-dialog
```

完整表单联动场景见 [05-scenarios/form-with-reactions.md](./05-scenarios/form-with-reactions.md)。
