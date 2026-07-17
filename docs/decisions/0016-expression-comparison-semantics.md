---
status: accepted
date: 2026-07-18
applies_to: schema-ui-protocol v2.0
---

# ADR-0016: 表达式比较与类型语义

## 决策

1. 表达式禁止宿主语言隐式 coercion。`1 == "1"`、`true == 1` 和 `null == undefined` 均不相等。
2. JSON number 使用数值相等语义，因此 `1`、`1.0` 和 `1e0` 相等；布尔值不属于 number。
3. `==` 仅在两侧均为 null、两侧均为 boolean、两侧均为 string 或两侧均为 number 时比较相等；其他类型组合不相等。`!=` 是上述相等关系的否定，但缺失值参与任何比较时结果固定为 false。
4. `>`、`>=`、`<`、`<=` 只接受两侧均为 number 或两侧均为 string；异型、null、缺失和 boolean 比较固定为 false。字符串按 Unicode code point 顺序比较。
5. `contains` 仅在左侧为数组且右侧为 JSON 字面量时执行，使用与 `==` 相同的元素相等规则；左侧不是数组或任一值缺失时为 false。
6. comparison 的结果必须为 boolean；实现不得依赖 JavaScript、Python 或其他宿主的默认比较转换。

## 验收

reaction fixtures 覆盖数字表示、异型相等、大小比较、null 与缺失值；JS/Python reference 必须逐字段一致。
