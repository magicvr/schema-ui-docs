---
status: accepted
date: 2026-07-07
---

# ADR-0003: `$context` 命名空间与 `visibleWhen` 节点级条件渲染

## 状态

已接受(Accepted)—— 已合并入 `01-node-protocol.md` / `02-reaction-expression.md`。

## 背景

现有协议(ADR-0001、ADR-0002)中,联动表达式(`reactions`)的作用域被限定为"表单内字段的简单声明式判断",变量只来自表单自身的字段值。

审计报告 §2.3、§5.1 提出两个诉求:

1. 节点(Node)需要一种**独立于表单联动**的、更轻量的条件渲染能力 `visibleWhen`,用于控制整个节点(而非字段)是否展示。
2. 页面级上下文(如当前用户信息、功能开关)需要被联动/渲染表达式读取,即 `$context.user`、`$context.features` 等。

这两点合在一起,实际上是在问一个更根本的问题:**联动表达式引擎的"输入变量"是否可以超出表单自身,扩展到外部注入的上下文?** 这直接触及 ADR-0001/0002 划定的边界,因此需要单独决策,而不是顺手加个字段了事。

同时,审计报告 §3.2 的 `permissions`(权限控制)在判定逻辑上依赖 `$context.user`,两者应在同一份 ADR 中一并设计,避免先定 `$context` 之后 `permissions` 被迫迁就。

## 决策

### D1. `$context` 的数据来源与注入时机

- `$context` 是**宿主环境(前端运行时)在渲染每个页面/表单实例时,一次性注入的只读快照**,不是响应式订阅的实时数据源。
  - 理由:如果 `$context` 是响应式的(比如用户权限中途变化就重新求值全部联动表达式),会把"简单声明式判断"变成"隐式响应式系统",大幅增加联动引擎的实现复杂度和调试难度,且协议层难以约束"什么时候该重新求值"。
  - 折衷:若未来确有"运行中用户切换角色需要立即变化显隐"的场景,由宿主环境主动触发一次**整页重新挂载**来刷新 `$context` 快照,而不是在协议层引入响应式语义。
- `$context` 的结构在协议中**预定义为白名单命名空间**,v0.2 起草阶段只开放两个子命名空间:
  - `$context.user`:当前用户身份信息(如 `id`、`roles`、`name`),字段集合由具体项目扩展,但协议只规定"这是一个只读对象,不规定其内部字段",内部字段的语义由业务层自行约定。
  - `$context.features`:功能开关(feature flag)映射表,值为布尔或简单枚举。
  - 不在白名单内的 `$context.*` 路径,解析器应报错而非静默返回 `undefined`,避免拼写错误导致的隐性 bug。
- 注入时机:协议约定宿主环境必须在**表达式引擎初始化之前**完成 `$context` 的构造和挂载,联动/渲染表达式的求值过程中不再重新拉取或修改 `$context`。

### D1a. `$context` 缺失/注入失败的容错策略

- 若宿主环境未注入 `$context`(如旧版本运行时、测试环境、协议降级场景),协议约定:
  - 所有白名单命名空间路径(`$context.user`、`$context.features`)返回 `undefined`;
  - 表达式中对 `undefined` 值的比较运算隐式转为 `false`(不抛出运行时异常),使节点优雅降级为"不满足条件"。
  - 这条规则是协议层约定,具体实现是否抛出告警日志由宿主环境自行决定,但**渲染流程不得因此中断**。
- 理由:容错策略的优先级是"页面可渲染 > 表达式正确性"。在 `$context` 确实不存在的前提下,让不依赖 `$context` 的节点正常展示、依赖的节点安全降级,比硬性报错拒绝渲染更符合用户体验预期。
- **属性链容错(补充)**:上述容错规则不仅适用于命名空间顶层(`$context.user` 本身缺失),也必须适用于**任意深度的属性链访问**。表达式引擎对 `$context.*` 的属性访问采用等价于"可选链"的语义:
  - 若访问路径中任意一环为 `undefined`(如 `$context.user` 本身缺失,或 `$context.user.roles` 缺失),后续的属性访问和方法调用(如 `.roles`、`contains(...)`)一律短路返回 `undefined`,不抛出运行时异常;
  - 参与比较运算或布尔判断时,该 `undefined` 结果按 D1a 主规则转为 `false`。
  - 理由:D1a 主规则若只覆盖命名空间顶层,而 `permissions`/`visibleWhen` 中的实际表达式(如 `$context.user.roles contains 'admin'`)普遍是多级属性链,一旦 `$context.user` 缺失但规则本身没有显式覆盖属性链传播,容错承诺在实际场景中就会落空、被绕过。此处补充是为了让 D1a 的容错保证在真实表达式复杂度下依然成立。

### D1b. 白名单扩展流程

- `$context` 的白名单命名空间是协议级约束,不是项目级配置。新增命名空间必须通过以下流程:
  - 提出新 ADR,论证新命名空间的必要性(是否确实无法被现有 `user`/`features` 承载);
  - ADR 通过后同步更新 `02-reaction-expression.md` 的变量命名空间表;
  - **禁止**接入方在项目层面自行扩展白名单之外的 `$context.*` 路径——如果确有项目专有上下文需求,应在渲染接入层建立一个项目级映射层,将项目专有数据映射到 `$context.user` 或 `$context.features` 之下,而不是绕过白名单直接注入新的根级命名空间。
- 理由:防止不同接入方各自扩展导致 `$context` 结构碎片化,最终削弱"一种表达式语法,多个挂载点使用"的协议价值。

### D2. 安全边界:`$context` 是否可被前端环境篡改

- **协议明确 `$context` 不是安全边界,只是渲染边界。**
  - 即:`visibleWhen`/`permissions` 控制的是"是否渲染/是否展示某个操作入口",本质上是**用户体验层面的收敛**,不能替代后端的真实鉴权。
  - 协议文档中必须显式声明这一点,并要求接入方在文档里同样向下游标注:"前端 `$context.user.roles` 判断得出的显隐结果,后端必须独立校验,不能信任前端传来的任何身份声明"。
- 这样设计的理由:如果试图在协议层保证 `$context` "不可篡改",要么需要引入签名/校验机制(超出一个声明式协议该管的范围),要么只是自我安慰式的伪安全。与其含糊地暗示"这是安全的",不如直接、清楚地说明白它不是,把责任边界画清楚,防止误用。

### D3. `visibleWhen` 与现有 `reactions` 的关系

- **复用同一套白名单表达式解析器**,不为 `visibleWhen` 单独造语法。
  - 理由:两套解析器意味着两套语义、两套安全校验逻辑要长期维护,且用户需要分别学习,维护成本和心智负担都不划算。协议的价值之一就是"一种表达式语法,多个挂载点使用"。
- `visibleWhen` 作为 Node 结构的第 6 个可选字段(归入 `01-node-protocol.md`),其表达式的**可用变量作用域**是:
  - 当前节点所属表单的字段值(与 `reactions` 一致的 `$deps` 语义);
  - `$context.*`(本 ADR 新增)。
  - 不包含 `$row`(行级作用域,由 ADR-0004 单独决策,两者互不下沉)。
- `visibleWhen` **与 `reactions` 是并列关系,不是包含关系**:`reactions` 描述"字段值变化 → 字段级副作用(显隐/赋值/校验)",`visibleWhen` 描述"给定当前状态 → 该节点是否渲染"的静态判断,两者共享解析器但语义定位不同,不应互相调用或嵌套。

### D3a. `visibleWhen` 的依赖声明机制

- `visibleWhen` **必须有显式的 `dependencies` 声明字段**,与 `reactions` 保持一致,不允许隐式捕获全部表单字段值。
  - 理由:第一,保持"声明式可审计"原则,使静态分析工具能准确知道某个 `visibleWhen` 表达式依赖于哪些字段;第二,隐式捕获在深层次 Node 树中性能不可控(每层都要遍历所有字段)。
- `visibleWhen` 结构如下:

```yaml
visibleWhen:
  dependencies: [string]     # 显式声明依赖的字段名
  when: string                 # 与 reactions[].when 同语法的白名单表达式
```

- `dependencies` 字段名改为与 `reactions.dependencies` 保持一致,不引入别名。解析器在执行 `visibleWhen.when` 时,以 `dependencies` 声明的字段注入 `$deps`,未声明的字段不可访问。
- 若节点不处于表单上下文中(例如布局容器 `section`/`grid`),`visibleWhen` 的 `dependencies` 可省略,此时 `when` 中只允许使用 `$context.*` 变量,不允许出现 `$deps`。
- **静态校验规则(补充)**:若节点未声明 `dependencies`(即处于非表单上下文),但其 `when` 表达式中出现了 `$deps.*`,协议要求解析器在**静态校验阶段直接拒绝**该协议(视为格式错误),而不是运行时静默返回 `undefined` 或视为合法但取不到值。理由:静默容错在这里反而有害——`$deps` 出现在不该出现的位置几乎总是配置错误(拼写误用、复制粘贴遗留),直接拒绝能在问题发生的第一时间暴露,而不是让开发者花时间排查"为什么这个条件永远不满足"。

### D3b. `visibleWhen` 与 `reactions` 在字段节点上的求值顺序与冲突仲裁

当一个节点同时包含 `visibleWhen` 和 `reactions` 时,两者可能在 `visible` 状态上产生冲突——`visibleWhen` 返回 false 但 `reactions` 的 `fulfill.visible` 为 true。

**仲裁规则:**

1. **`reactions` 始终求值**,不因 `visibleWhen` 结果而跳过。理由:字段被 `visibleWhen` 隐藏后,若存在"隐藏时清空值"这类依赖 `reactions` 求值才能触发的副作用规则,跳过会导致隐藏字段残留脏值。始终求值保证所有 `reactions` 副作用(如赋值/校验)按声明正常执行。
2. **节点最终 `visible` 状态** = `visibleWhen.when` 的结果(若声明) **AND** `reactions` 计算出的 `visible` 结果(若声明):
   - `visibleWhen` **只能强制隐藏,不能强制显示**——即使 `visibleWhen` 为 true,`reactions` 仍可能将 `visible` 设为 false。
   - 当两者均未声明 `visible` 相关规则时,节点默认可见。
3. 协议**不提供**"隐藏时自动清空值"的隐式行为。如需该行为,由业务方显式编写对应的 `reactions` 规则(如 `fulfill.value: null`),在"reactions 始终求值"的模型下必然生效。

> 本节仅解决 `visibleWhen` 与 `reactions` 两者的组合;三者(含 `permissions.view`)的完整优先级见 D3d。

### D3c. 容器节点显隐级联

容器类节点(`section`/`grid`/`form` 等)的最终 `visible` 状态为 false 时:

- 其整个子树在渲染层面不展示(由渲染层统一处理级联隐藏,协议不要求逐层显式声明)。
- 子树内各节点自身的 `reactions` **仍按各自声明正常求值**(与字段级原则一致,不因祖先隐藏而跳过求值)。理由:容器隐藏不改变子节点业务规则的有效性;若某子节点定义了"依赖字段 X → 设置 value",该规则在容器隐藏时仍应生效,否则子节点恢复可见时处于未定义状态。
- 子节点自身若未声明 `visibleWhen`,不需要、也不应该自行判断祖先可见性——级联隐藏是渲染层职责,不上升为协议层逐层声明负担。
- 性能优化(如对大型隐藏子树实施懒求值或批量跳过 `reactions` 求值)由宿主运行时自行决定,协议只约束**可观测行为等价**,不约束具体求值时机。

> **`permissions.view=false` 与容器级联的关系:** 容器节点的 `permissions.view=false` 与 `visibleWhen=false` 在此处的级联行为完全一致——子树不展示、但子树内 `reactions` 仍正常求值。两种隐藏入口共享同一套级联规则,不产生新的语义分支。

### D3d. 最终可见性的完整优先级公式(`permissions.view` × `visibleWhen` × `reactions.visible`)

D3b 只定义了 `visibleWhen` 与 `reactions.visible` 两者的组合,但节点最终是否渲染实际上受**三个独立信号**共同影响,必须给出统一公式和优先级,否则三者两两拼接容易产生未定义的冲突场景(例如 `permissions.view=false` 但某条 `reactions` 把 `visible` 设为 `true` 时该如何仲裁)。

**统一公式:**

```
最终 visible =
  permissions.view (若声明,优先级最高)
  AND visibleWhen.when (若声明,次优先级)
  AND reactions 计算出的 visible (若声明,最低优先级)
```

**优先级顺序:`permissions.view` > `visibleWhen` > `reactions.visible`。**

- 三者均为 **AND 语义、只能收紧不能放宽**:任一环节判定为 `false`,后续环节即使判定为 `true` 也无法"救回"该节点的可见性。
- 优先级的设计理由:`permissions.view` 代表"用户是否有权限看",这是最外层的硬约束,不应被内层的业务联动规则(`visibleWhen`/`reactions`)绕过或覆盖——否则会出现"业务逻辑意外让无权限用户看到内容"的安全隐患(即便只是渲染层隐患,也应在协议层堵死);`visibleWhen` 代表"该节点在当前业务状态下是否有意义展示",逻辑上先于字段级联动的 `reactions.visible` 生效。
- 三者均未声明时,节点默认可见(与 D3b 规则一致)。
- 与 D3b 第 1 条(`reactions` 始终求值,不因其他信号跳过)保持一致:即使 `permissions.view` 或 `visibleWhen` 已判定为不可见,`reactions` 仍需正常求值(以保证其赋值/校验等副作用生效),只是其计算出的 `visible` 结果在最终 AND 公式中不再能改变已经判定为不可见的结果。

### D4. `$context` 的只读约束

- `$context` **只读**,协议明确规定:
  - `$context.*` 不允许出现在 `reactions` 的 `fulfill`/`otherwise` 赋值目标(左值)中;
  - 表达式解析器在静态校验阶段(而非运行时)即可拦截"试图给 `$context.*` 赋值"的非法协议,作为协议格式错误直接拒绝。
- 理由:`$context` 的语义是"外部只读快照",一旦允许写入,就变成了联动表达式和页面上下文之间的双向通道,表达式的副作用范围会从"改自己表单的字段"扩散到"改全局状态",这正是 ADR-0001/0002 想要避免的复杂度扩张,没有必要在这个阶段开这个口子。

### D5. `permissions` 与 `$context` 的关系

- `permissions` 的判定表达式**复用与 `visibleWhen` 相同的解析器和 `$context.user` 命名空间**,不引入独立的权限 DSL。
- `permissions` 的值类型为**按动作分组的映射表**,允许按操作入口粒度定义权限条件:

```yaml
permissions:
  view: "$context.user.roles contains 'admin'"       # 可见性
  edit: "$context.user.roles contains 'editor'"       # 可编辑/可操作
  delete: "$context.user.roles contains 'superadmin'" # 可删除
```

协议层预定义三个标准动作键:`view`/`edit`/`delete`。接入方可在 `component-registry.json` 的组件契约中按需扩展自定义动作键(如 `approve`/`export`),扩展逻辑见 `03-component-registry.md`。

- **静态校验规则(补充,原为建议性约束,现提升为强制规则)**:`permissions.*` 的表达式中**禁止出现 `$deps.*`**,只允许使用 `$context.*`。解析器在静态校验阶段拦截违反该规则的协议,直接拒绝而非运行时警告。
  - 理由:此前该约束只是"建议实践上只用 `$context.user`",不具备强制力,意味着 `permissions.edit: "$deps.status == 'closed'"` 这类写法语法上完全合法,会导致权限判断和业务状态判断混在一起,长期造成职责不清、难以审计"这个权限判断到底依不依赖用户身份"。既然这条规则已经被明确认为是应当遵守的设计原则,协议就应该用静态校验去保障它,而不是停留在文档建议层面。

- `permissions` 与 `visibleWhen` 的定位区别:
  - `visibleWhen` 回答"要不要渲染这个节点"(通常是业务状态 + 上下文的组合判断);
  - `permissions` 回答"当前用户能不能对这个节点/操作做某件事"(纯粹基于 `$context.user`,不掺杂业务字段状态,虽然协议不强制禁止,但**建议实践上只使用 `$context.user`**,避免权限判断和业务显隐判断混在一起导致职责不清)。
- `permissions` 求值为 false 与 `visibleWhen` 求值为 false 的渲染差异:
  - `visibleWhen=false`:节点不应存在于 DOM 中(条件不满足);
  - `permissions.view=false`:节点不应存在于 DOM 中(用户无权限);
  - `permissions.edit=false`(但 `view` 未限制):节点渲染为**只读/禁用态**,而非从 DOM 中移除。
  - 这种区分使权限控制可以表达"能看到但不能操作"的用户体验粒度。
  - 三者共同决定最终可见性时的优先级公式见 D3d。
- 是否拆分独立 ADR:**不拆分**。`permissions` 的设计直接在本 ADR 中一并落定,因为其判定逻辑对 `$context.user` 的依赖是本质性的,拆开决策容易造成两份文档互相引用、维护成本更高。

### D5a. 运算符白名单扩展:新增 `contains`

- D5 的权限判定示例(`"$context.user.roles contains 'admin'"`)依赖数组包含判断,但现有 `02-reaction-expression.md` 的运算符白名单(比较、逻辑、分组三类)中**不存在 `contains`**,导致该示例实际上无法被现有解析器执行。
- **决策:将 `contains` 正式加入运算符白名单**,语义定义为:左操作数为数组,右操作数为字面量,判断数组是否包含该值(等价于 `Array.prototype.includes`),返回布尔值;若左操作数不是数组(如为 `undefined`,见 D1a 属性链容错),按 D1a 规则短路返回 `false`,不抛异常。
- **优先级与结合性**:`contains` 与 `==`/`!=` 等比较运算符**归入同一优先级档**,不单独新增一档优先级。理由:`contains` 本质上是"数组是否包含某值"的比较操作,语义上与 `==` 同属"比较运算"这一类,直接并入现有比较运算符档位即可,不需要在协议已有的"比较 / 逻辑 / 分组"三层优先级体系之外再引入新的层级,避免运算符优先级规则不必要地复杂化。`contains` 是二元、非链式运算符(不存在 `a contains b contains c` 这种连续使用的场景),因此不需要额外定义结合性规则。
- 理由:数组包含判断在权限场景(角色数组、权限标签数组)中是刚需,不属于"表达式引擎能力膨胀",而是补齐 D5 已经依赖、但此前遗漏在白名单之外的基础能力。

## 合并清单 (Merge Checklist)

本 ADR 的决策内容在执行合并入正式协议文档时,需按以下条目逐项落实:

| # | 内容 | 目标文档 | 对应章节 |
|---|---|---|---|
| M1 | `visibleWhen` 的 `dependencies` + `when` 结构,作为 Node 第 6 个可选字段 | `01-node-protocol.md` §3 | D3, D3a |
| M2 | `visibleWhen` 与 `reactions` 求值顺序与冲突仲裁规则(reactions 始终求值;visibleWhen 只能隐藏不能强制显示) | `01-node-protocol.md` §3.5 或 `02-reaction-expression.md` §9 | D3b |
| M3 | 容器节点显隐级联规则(子树不展示但子树内 reactions 仍正常求值) | `01-node-protocol.md` §3.4 或新节 | D3c |
| M4 | `$context` 命名空间定义(白名单、只读约束、缺失容错、属性链容错) | `02-reaction-expression.md` §2 | D1, D1a, D4 |
| M5 | `$context` 白名单扩展流程 | `02-reaction-expression.md` 新增章节或协议治理文档 | D1b |
| M6 | `permissions` 的 Map 值类型(`view`/`edit`/`delete` + 组件级扩展动作键机制,含对 `03-component-registry.md` 的引用) | `01-node-protocol.md` §3 | D5 |
| M7 | `$context` 非安全边界的显式声明 | `01-node-protocol.md` 或独立安全指引 | D2 |
| M8 | `permissions` 表达式语法复用声明(指向 `02-reaction-expression.md`) | `01-node-protocol.md` §3 | D5 |
| M9 | 最终可见性完整优先级公式(`permissions.view` > `visibleWhen` > `reactions.visible`,AND 语义) | `01-node-protocol.md` §3.5 或 `02-reaction-expression.md` §9 | D3d |
| M10 | 运算符白名单新增 `contains`(数组包含判断,含 `undefined` 短路规则) | `02-reaction-expression.md` §3(运算符白名单) | D5a |
| M11 | `visibleWhen` 非表单上下文下出现 `$deps.*` 的静态校验拒绝规则 | `02-reaction-expression.md`(静态校验规则章节) | D3a |
| M12 | `permissions.*` 表达式禁止出现 `$deps.*` 的静态校验规则 | `02-reaction-expression.md`(静态校验规则章节) | D5 |
| M13 | 变量可见性矩阵(各使用位置 `$deps`/`$self`/`$context`/`$row`/`$parentRow` 可用性一览) | `02-reaction-expression.md` 新增附录 | 见 ADR-0004 联合审阅报告 §4.3 |

## 后果(Consequences)

**正面:**
- 表达式引擎只需维护一套语义和一套安全校验逻辑,`visibleWhen`/`permissions`/`reactions` 三处复用,长期维护成本低。
- `$context` 只读 + 白名单的约束,使得表达式引擎的"输入面"可枚举、可静态校验,不会因为引入上下文而变成不可预测的动态系统。
- 明确"`$context` 不是安全边界"避免未来误用协议做真实鉴权。
- 三路可见性信号(`permissions.view`/`visibleWhen`/`reactions.visible`)有统一公式和明确优先级,不会因分散决策产生未定义的冲突场景。

**负面 / 待权衡:**
- `$context` 快照式注入意味着"用户角色中途变化"无法被联动表达式实时感知,需要整页重新挂载才能刷新,这在某些实时性要求高的场景可能不够用——若未来出现该需求,需要新开 ADR 讨论响应式 `$context` 的可行性,而不是在本 ADR 基础上修补。
- `$context.user` 内部字段协议不做规定,意味着不同项目间字段命名可能不一致,跨项目复用联动表达式时需要额外的字段映射层——这是有意识的取舍(避免协议层过度设计业务身份模型),但需要在文档中提醒使用者。
- 三路 AND 语义意味着任一环节收紧都无法被后续环节放宽,业务方若误以为可以用 `reactions` "覆盖"权限判断的隐藏结果,会得到与预期不符的行为——需要在协议文档中用示例明确演示这一点,降低误用概率。

## 遗留问题

以下为**尚未决策、留给未来讨论**的开放问题,与合并清单(M1–M9)中"已决策仅待抄写"的执行项性质不同:

- `$context.features` 的开关粒度(单个 flag vs 分组)暂不在本 ADR 中细化,留待实际接入时按需扩展命名空间内容,不影响协议结构本身。
- 若未来出现"页面运行中需要感知上下文变化"的真实需求,另开 ADR 讨论响应式方案,不在本 ADR 范围内。
- `permissions.edit=false` 加在容器节点上时,子节点是否连带级联为只读/禁用态,本 ADR 未作决策(D3c 仅明确了 `permissions.view` 与 `visibleWhen` 的级联行为一致,未覆盖 `edit`/`delete` 等其他动作键的级联规则)。若未来出现容器级批量禁用的真实需求,需另行决策是否级联、以及级联的具体语义。
- **三路 AND 公式(D3d)内部的求值时序问题未定义**:若某个字段同时被 `visibleWhen` 引用,又被同节点或其他节点的 `reactions.fulfill.value` 修改,`visibleWhen` 读到的值是变更前还是变更后的快照,D3d 未回答这个问题——D3b/D3d 解决的是"多个可见性信号之间该如何仲裁",而这里问的是"同一渲染周期内,读操作和写操作谁先谁后"，属于更底层的求值模型问题,范围超出本 ADR,留待专门讨论表达式引擎的求值时序模型时再处理,不在本次合并中强制解决。
- **`$context.features` 与 `$context.user` 的刷新粒度耦合**:两者当前被捆绑在同一个 `$context` 快照中一次性注入(见 D1),但实践中功能开关(features)的数据源、变更频率往往与用户身份(user)不同,将二者强制绑定意味着即使只有 features 变化也必须触发整页重新挂载才能刷新。本 ADR 暂不解决,先按统一快照处理;若未来出现"仅刷新 features 而不影响 user"的真实需求,再评估是否需要拆分两者的刷新时机,不预先在协议层引入额外的复杂度。