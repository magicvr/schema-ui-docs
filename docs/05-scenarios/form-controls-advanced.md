---
status: example
protocol_version: v2.8
last_updated: 2026-07-28
capabilities:
  - form.controls.advanced
  - form.record.load
---

# 场景示例：进阶表单控件面（v2.7）

对应能力：[ADR-0029](../decisions/0029-cascader.md)–[0033](../decisions/0033-form-default-value.md)。演示 `cascader`、`checkboxGroup`、`richText`、`password` 与静态 `defaultValue`。

使用前 Renderer 须支持 `form.controls.advanced`，页面 `meta.protocolVersion: "2.8"`。

```yaml
meta:
  pageId: user_profile_advanced
  title: 进阶用户资料
  protocolVersion: "2.8"
  requiredCapabilities:
    - form.controls.advanced
    - form.record.load

actions:
  saveAdvanced:
    type: request
    method: PUT
    url: /api/users/advanced
    bodyMapping:
      regionPath: region
      perms: permissions
      about: aboutMd
      newPassword: password
      displayName: name
    onSuccess:
      behavior: toast
      message: 已保存
    onError:
      behavior: toast
      message: 保存失败

body:
  type: form
  props:
    title: 进阶资料
    submitAction: saveAdvanced
    recordSource:
      method: GET
      url: /api/users/{userId}
      path:
        userId: $context.route.query.userId
      responseMapping:
        regionPath: region.path
        perms: permissions
        about: aboutMd
        displayName: name
  children:
    - type: input
      props:
        field: displayName
        label: 显示名
        defaultValue: 新用户
    - type: cascader
      props:
        field: regionPath
        label: 地区
        options:
          - label: 华东
            value: east
            children:
              - label: 上海
                value: shanghai
                children:
                  - { label: 浦东, value: pudong }
    - type: checkboxGroup
      props:
        field: perms
        label: 权限
        defaultValue: [read]
        options:
          - { label: 读, value: read }
          - { label: 写, value: write }
          - { label: 管理, value: admin }
    - type: richText
      props:
        field: about
        label: 简介
        defaultValue: "## 简介\n\n请填写。"
    - type: password
      props:
        field: newPassword
        label: 新密码
```

## 说明

- `regionPath` 提交为 path 数组；`perms` 为 value 数组。
- `about` 为 Markdown string；Host 负责展示消毒。
- `newPassword` 为 string；Host 遮罩，不在日志回显。
- 创建时 `defaultValue` 生效；`recordSource` 回填覆盖同名字段。
- 机器可读样例：[`_samples/user-profile-advanced.yaml`](./_samples/user-profile-advanced.yaml)。
