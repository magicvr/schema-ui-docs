---
status: example
protocol_version: v2.6
last_updated: 2026-08-14
capabilities:
  - form.controls.extended
  - form.record.load
---

# 场景示例：扩展表单控件面（F1）

对应能力：[ADR-0028](../decisions/0028-form-control-surface.md)。演示 `textarea`、`switch`、`checkbox`、`radio` 与 `select.mode: multiple` 的声明与提交投影。

使用前 Renderer 须支持 `form.controls.extended`，页面 `meta.protocolVersion: "2.6"`。

```yaml
meta:
  pageId: user_profile_edit
  title: 编辑用户资料
  protocolVersion: "2.6"
  requiredCapabilities:
    - form.controls.extended
    - form.record.load

actions:
  saveProfile:
    type: request
    method: PUT
    url: /api/users/update
    bodyMapping:
      userId: id
      bio: bio
      active: active
      newsletter: newsletter
      tier: tier
      roleIds: roles
    onSuccess:
      behavior: toast
      message: 已保存
    onError:
      behavior: toast
      message: 保存失败

body:
  type: form
  props:
    title: 用户资料
    submitAction: saveProfile
    recordSource:
      method: GET
      url: /api/users/{userId}
      path:
        userId: $context.route.query.userId
      responseMapping:
        userId: id
        bio: bio
        active: active
        newsletter: newsletter
        tier: tier
        roleIds: roleIds
  children:
    - type: input
      props:
        field: userId
        label: 用户 ID
    - type: textarea
      props:
        field: bio
        label: 简介
        required: true
    - type: switch
      props:
        field: active
        label: 启用账号
    - type: checkbox
      props:
        field: newsletter
        label: 订阅通知
    - type: radio
      props:
        field: tier
        label: 等级
        options:
          - { label: 标准, value: standard }
          - { label: 专业, value: pro }
    - type: select
      props:
        field: roleIds
        label: 角色
        mode: multiple
        options:
          - { label: 管理员, value: admin }
          - { label: 运营, value: ops }
          - { label: 只读, value: reader }
```

## 说明

- `switch`/`checkbox` 提交值为 boolean；`roleIds` 为字符串数组。
- `mode: multiple` **不得**放在 `form.mode: search` 中（L2 拒绝）。
- 机器可读样例：[`_samples/user-profile-extended.yaml`](./_samples/user-profile-extended.yaml)。
