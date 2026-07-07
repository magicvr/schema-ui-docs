---
status: stable
owner: 前端架构组
last_updated: 2026-07-07
applies_to: schema-ui-protocol v0.2
---

# Action 完整契约（since 0.2）

> 本文档定义顶层 `actions` 中每个动作的完整结构。机器可读版本见
> [`schemas/action.schema.json`](./schemas/action.schema.json)。对应审计条目 §2.5，计划条目 B3。

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
modalId: string   # 引用前端预注册的弹窗标识
```

## 6. `custom` 类型

```yaml
type: custom
handler: string   # 仅允许引用前端白名单预注册的处理函数名
```

前端必须维护一份白名单，`handler` 值若不在白名单中，Renderer 应拒绝执行并报错。

## 7. `OutcomeBehavior`（`onSuccess` / `onError` 通用结构）

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

## 8. 完整示例

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
