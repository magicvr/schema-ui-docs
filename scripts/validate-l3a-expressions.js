#!/usr/bin/env node
/**
 * L3a 表达式静态校验器
 *
 * 对页面配置中所有出现表达式的位置（reactions[].when、visibleWhen.when、
 * permissions.*）进行静态校验：
 *
 *   1. 语法合法性 —— 仅允许白名单运算符，禁止函数调用、算术运算
 *   2. 变量命名空间 —— 只允许 $deps.* / $self / $row.* / $context.*；
 *      dateRangePicker 自身 reactions 额外允许 $self.start / $self.end；
 *      表单 visibleWhen 禁 $self/$row；表格 actions 任意 scope 禁 $self
 *   3. 作用域隔离规则（02-reaction-expression.md §9、§10）
 *      - scope:row 不能出现 $deps.*
 *      - scope:form 不能出现 $row.*
 *      - v0.2 暂不支持 $parentRow.*（组件 DSL 尚无嵌套表格挂载结构）
 *      - permissions.* 不能出现 $deps.*（仅 $context.user.* / $context.features.*）
 *      - 非表单 visibleWhen 按 Node 树位置判定，仅允许 $context.user.* / $context.features.*
 *      - 表格 actions 任意 scope 不能出现 $self
 *      - 表格列/操作 scope:form 使用 $deps.* 时要求表格位于 form 上下文
 *      - data.params / optionsSource.params 中 $deps.* 仅允许出现在表单上下文，且不支持其他变量
 *   4. $deps.* 中使用的字段必须在 dependencies 中声明
 *
 * 用法：
 *   node scripts/validate-l3a-expressions.js <file-or-glob> [--json]
 *
 * 退出码：
 *   0 — 全部通过
 *   1 — 存在违规
 *   2 — 调用错误
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { expandFilePatterns } = require('./file-patterns');

// ---------------------------------------------------------------------------
// YAML / JSON 解析
// ---------------------------------------------------------------------------
function parseFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.yaml' || ext === '.yml') {
    let yaml;
    try { yaml = require('js-yaml'); } catch {
      console.error('[L3a] 解析 YAML 需要 js-yaml：npm install js-yaml'); process.exit(2);
    }
    return yaml.load(raw);
  }
  throw new Error(`不支持的文件格式: ${ext}`);
}

// ---------------------------------------------------------------------------
// Token 类型
// ---------------------------------------------------------------------------
const TT = {
  VAR: 'VAR',         // $deps.x  $self  $row.y  $context.z  $parentRow.z
  IDENT: 'IDENT',     // 裸字母标识符（关键字 contains / true / false / null 或非法标识符）
  OP: 'OP',           // 比较/逻辑运算符
  LPAREN: 'LPAREN',   // (
  RPAREN: 'RPAREN',   // )
  NOT: 'NOT',         // !
  STRING: 'STRING',   // 'xxx' or "xxx"
  NUMBER: 'NUMBER',   // 123 / 0.5
  INVALID: 'INVALID', // 无法识别的字符（算术运算符、? 等）
};

// 允许作为裸 IDENT 的关键字
const ALLOWED_KEYWORDS = new Set(['contains', 'true', 'false', 'null']);
// 变量命名空间前缀白名单
const ALLOWED_NS_PREFIXES = ['$deps.', '$self', '$row.', '$parentRow.', '$context.'];
const COMPARISON_OPERATORS = new Set(['==', '!=', '>', '>=', '<', '<=', 'contains']);
const ALLOWED_CONTEXT_ROOTS = new Set(['user', 'features']);

/**
 * 把表达式字符串拆成 token 列表。
 * 遇到无法识别的字符产出一个 INVALID token（保留原字符）。
 * 返回 Array<{type, value}>
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    // 跳过空白
    if (/\s/.test(expr[i])) { i++; continue; }

    // 字符串字面量
    if (expr[i] === "'" || expr[i] === '"') {
      const quote = expr[i];
      let j = i + 1;
      while (j < expr.length && expr[j] !== quote) {
        if (expr[j] === '\\') j++; // 简单转义跳过
        j++;
      }
      if (j >= expr.length) {
        // 没找到闭合引号 → INVALID
        tokens.push({ type: TT.INVALID, value: expr.slice(i) });
        i = expr.length;
      } else {
        tokens.push({ type: TT.STRING, value: expr.slice(i, j + 1) });
        i = j + 1;
      }
      continue;
    }

    // 数字（含畸形数字检测：超过一个小数点 → INVALID）
    if (/[0-9]/.test(expr[i]) || (expr[i] === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      const numStr = expr.slice(i, j);
      const dotCount = (numStr.match(/\./g) || []).length;
      if (dotCount > 1) {
        tokens.push({ type: TT.INVALID, value: numStr });
      } else {
        tokens.push({ type: TT.NUMBER, value: numStr });
      }
      i = j;
      continue;
    }

    // 多字符运算符：==, !=, >=, <=, &&, ||
    const two = expr.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      tokens.push({ type: TT.OP, value: two });
      i += 2;
      continue;
    }

    // 单字符运算符/符号
    if (expr[i] === '(') { tokens.push({ type: TT.LPAREN, value: '(' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: TT.RPAREN, value: ')' }); i++; continue; }
    if (expr[i] === '!') { tokens.push({ type: TT.NOT,    value: '!' }); i++; continue; }
    if (expr[i] === '>') { tokens.push({ type: TT.OP,     value: '>' }); i++; continue; }
    if (expr[i] === '<') { tokens.push({ type: TT.OP,     value: '<' }); i++; continue; }

    // 变量或裸标识符（含 $ 前缀）
    if (/[A-Za-z_$]/.test(expr[i])) {
      let j = i;
      // 变量允许点路径（$deps.x.y、$context.user.roles 等）
      while (j < expr.length && /[A-Za-z0-9_$.]/.test(expr[j])) j++;
      const word = expr.slice(i, j);

      // 变量路径词法检查：$ 开头的变量路径中不能有空段（如 ..）、结尾点（如 $row.）
      // 或连续两点；命名空间前缀后必须有合法标识符或续段
      if (word.startsWith('$') && word !== '$self') {
        const nsMatch = ALLOWED_NS_PREFIXES.find(prefix =>
          prefix === '$self' ? word.startsWith('$self.') : word.startsWith(prefix),
        );
        if (nsMatch) {
          const suffix = word.startsWith('$self.')
            ? word.slice('$self.'.length)
            : word.slice(nsMatch.length);
          // 后缀不能为空段、连续点或非法起始字符
          if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(suffix)) {
            tokens.push({ type: TT.INVALID, value: word });
            i = j;
            continue;
          }
        } else {
          // 不在白名单命名空间中的 $ 变量 → 交给命名空间校验处理
          // 这里不做额外处理，validateExpression 会报 UNKNOWN_VARIABLE
        }
      }

      if (word.startsWith('$')) {
        tokens.push({ type: TT.VAR, value: word });
      } else {
        tokens.push({ type: TT.IDENT, value: word });
      }
      i = j;
      continue;
    }

    // 其他：算术运算符、? 等不合法字符
    tokens.push({ type: TT.INVALID, value: expr[i] });
    i++;
  }
  return tokens;
}

/**
 * 校验 token 流的语法结构（逐 token 状态机）：
 *   - INVALID token → 报错
 *   - 裸 IDENT 不在 ALLOWED_KEYWORDS 中 → 报错
 *   - 函数调用 → 报错
 *   - 括号必须匹配
 *   - 操作数/操作符交替序列：
 *       期望操作数时遇到操作符 → 报错（包含尾部多余操作符，如 "$deps.x =="）
 *       期望操作符时遇到操作数 → 报错
 *   `contains` 关键字被视为二元运算符（出现在操作符位置）
 *
 * 返回 Array<string>（错误信息列表）
 */
function checkTokenSyntax(tokens) {
  const errors = [];
  let depth = 0;
  const comparisonSeenByDepth = new Map();

  // 状态：'OPERAND'（当前位置期望操作数）或 'OPERATOR'（期望操作符或表达式结束）
  // 表达式从期望操作数开始；若 tokens 为空则合法（空串由外层拦截）
  let expecting = 'OPERAND';

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];

    // --- 无论何时，先处理非法 token ---
    if (tok.type === TT.INVALID) {
      errors.push(`非法字符 "${tok.value}"（不允许算术运算符或三元表达式符号）`);
      continue;
    }

    // --- 函数调用检测（下一个 token 是左括号即为调用）---
    if ((tok.type === TT.VAR || tok.type === TT.IDENT) && next && next.type === TT.LPAREN) {
      errors.push(`禁止函数调用：${tok.value}(...)`);
      // 不再做序列校验，跳过本 token
      continue;
    }

    // --- 裸 IDENT 白名单 ---
    if (tok.type === TT.IDENT) {
      if (!ALLOWED_KEYWORDS.has(tok.value)) {
        errors.push(`非法标识符 "${tok.value}"（裸变量必须使用 $xxx 前缀，关键字只允许：${[...ALLOWED_KEYWORDS].join(', ')}）`);
        continue;
      }
    }

    // --- 括号深度 ---
    if (tok.type === TT.LPAREN) {
      depth++;
      comparisonSeenByDepth.set(depth, false);
      // 左括号出现在操作数位置：合法（开始一个分组）
      if (expecting !== 'OPERAND') {
        errors.push('语法错误：操作符后面不能直接出现操作数（在 "(" 之前）');
      }
      // 左括号内重新期望操作数，expecting 保持 OPERAND
      expecting = 'OPERAND';
      continue;
    }
    if (tok.type === TT.RPAREN) {
      comparisonSeenByDepth.delete(depth);
      depth--;
      if (depth < 0) { errors.push('括号不匹配：多余的 ")"'); depth = 0; }
      // 右括号出现在操作数位置说明括号里是空的或已经有多余操作符
      if (expecting === 'OPERAND') {
        errors.push('语法错误：括号内表达式不完整或括号为空');
      }
      // 右括号后期望操作符
      expecting = 'OPERATOR';
      continue;
    }

    // --- NOT 一元运算符：只允许在操作数位置 ---
    if (tok.type === TT.NOT) {
      if (expecting !== 'OPERAND') {
        errors.push('语法错误："!" 只能出现在操作数位置（操作符之后或表达式开头）');
      }
      // NOT 之后仍期望操作数
      expecting = 'OPERAND';
      continue;
    }

    // --- 二元操作符（OP）或 `contains` 关键字（充当中缀操作符）---
    const isBinaryOp = tok.type === TT.OP
      || (tok.type === TT.IDENT && tok.value === 'contains');
    if (isBinaryOp) {
      if (expecting !== 'OPERATOR') {
        errors.push(`语法错误：在 "${tok.value}" 处期望操作数，但遇到操作符`);
      }
      if (COMPARISON_OPERATORS.has(tok.value)) {
        if (comparisonSeenByDepth.get(depth)) {
          errors.push(`语法错误：比较运算符 "${tok.value}" 不支持链式使用，请用逻辑运算符拆分为独立比较`);
        }
        comparisonSeenByDepth.set(depth, true);
      } else if (tok.value === '&&' || tok.value === '||') {
        comparisonSeenByDepth.set(depth, false);
      }
      expecting = 'OPERAND';
      continue;
    }

    // --- 操作数（VAR / 非 contains 的 IDENT / STRING / NUMBER）---
    const isOperand = tok.type === TT.VAR
      || tok.type === TT.STRING
      || tok.type === TT.NUMBER
      || (tok.type === TT.IDENT && ALLOWED_KEYWORDS.has(tok.value) && tok.value !== 'contains');
    if (isOperand) {
      if (expecting !== 'OPERAND') {
        errors.push(`语法错误：在 "${tok.value}" 处期望操作符，但遇到操作数`);
      }
      expecting = 'OPERATOR';
      continue;
    }
  }

  // 表达式结尾必须处于期望操作符的位置（即已读完一个完整操作数）
  if (expecting === 'OPERAND' && tokens.filter(t => t.type !== TT.INVALID).length > 0) {
    errors.push('语法错误：表达式末尾缺少操作数（可能有多余的操作符）');
  }

  if (depth > 0) errors.push('括号不匹配：缺少 ")"');
  return errors;
}

/**
 * 从 token 列表中提取所有 VAR token 的值
 */
function extractVarTokens(tokens) {
  return tokens.filter(t => t.type === TT.VAR).map(t => t.value);
}

/**
 * 校验单个表达式字符串，返回 violations 数组（每项含 rule + message）
 */
function validateExpression(expr, exprPath, context) {
  /*
   * context 结构：
   * {
   *   scope: 'form' | 'row' | undefined,
   *   dependencies: string[],          // reactions/visibleWhen 声明的 deps
  *   location: 'reaction' | 'visibleWhen' | 'permission' | 'tableAction' | 'tableColumn',
  *   hasFormContext: boolean,          // 节点是否处于 form 上下文（type===form 或其 form 子孙）
  *   componentType: string | undefined, // 普通 Node reactions 所属组件类型
   * }
   */
  const { scope = 'form', dependencies = [], location, hasFormContext = true, componentType } = context;
  const violations = [];

  if (typeof expr !== 'string' || !expr.trim()) {
    violations.push({ path: exprPath, rule: 'SYNTAX', message: '表达式不能为空' });
    return violations;
  }

  // 1. Token 化 + 语法结构检查
  const tokens = tokenize(expr);
  const syntaxErrors = checkTokenSyntax(tokens);
  for (const err of syntaxErrors) {
    violations.push({ path: exprPath, rule: 'SYNTAX', message: err });
  }
  // 语法错误不继续做语义检查，避免噪音
  if (syntaxErrors.length > 0) return violations;

  const vars = extractVarTokens(tokens);
  const depsFields = vars
    .filter(v => v.startsWith('$deps.'))
    .map(v => v.slice('$deps.'.length).split('.')[0]); // 取第一段字段名

  const rowDepFields = vars
    .filter(v => v.startsWith('$row.'))
    .map(v => v.slice('$row.'.length));
  // 1a. scope: row 仅允许在表格 columns/actions 表达式中使用
  if (scope === 'row' && !['tableColumn', 'tableAction'].includes(location)) {
    violations.push({
      path: exprPath,
      rule: 'ROW_SCOPE_MOUNT',
      message: 'scope: row 仅允许在表格 columns/actions 的表达式中使用，普通 Node reactions/visibleWhen 不可声明 scope: row',
    });
  }

  // 2. 变量命名空间白名单
  for (const variableName of vars) {
    // $self 精确匹配，单独处理
    if (variableName === '$self') continue;
    if (variableName.startsWith('$self.')) {
      const isDateRangeSelf = location === 'reaction'
        && componentType === 'dateRangePicker'
        && ['$self.start', '$self.end'].includes(variableName);
      if (!isDateRangeSelf) {
        violations.push({
          path: exprPath,
          rule: 'SELF_PROPERTY_SCOPE',
          message: '$self 属性路径仅允许 dateRangePicker 自身 reactions 使用 $self.start 或 $self.end',
        });
      }
      continue;
    }
    const allowed = ALLOWED_NS_PREFIXES.some(prefix =>
      prefix === '$self' ? variableName.startsWith('$self.') : variableName.startsWith(prefix),
    );
    if (!allowed) {
      violations.push({
        path: exprPath,
        rule: 'UNKNOWN_VARIABLE',
        message: `未知变量命名空间 "${variableName}"，只允许：${ALLOWED_NS_PREFIXES.join(', ')}`,
      });
      continue;
    }

    if (variableName.startsWith('$context.')) {
      const contextRoot = variableName.slice('$context.'.length).split('.')[0];
      if (!ALLOWED_CONTEXT_ROOTS.has(contextRoot)) {
        violations.push({
          path: exprPath,
          rule: 'UNKNOWN_CONTEXT_NAMESPACE',
          message: `未知 $context 根命名空间 "${contextRoot}"，只允许：${[...ALLOWED_CONTEXT_ROOTS].join(', ')}`,
        });
      }
    }
  }

  // 3. $deps.* 字段必须在 dependencies 中声明
  for (const field of depsFields) {
    if (!dependencies.includes(field)) {
      violations.push({
        path: exprPath,
        rule: 'UNDECLARED_DEP',
        message: `$deps.${field} 未在 dependencies 中声明`,
      });
    }
  }

  // 3a. scope: row 时 $row.* 字段必须在 dependencies 中声明
  if (scope === 'row') {
    for (const field of rowDepFields) {
      if (!dependencies.includes(field)) {
        violations.push({
          path: exprPath,
          rule: 'UNDECLARED_ROW_DEP',
          message: `$row.${field} 未在 dependencies 中声明（scope: row 的 dependencies 应列出行字段路径）`,
        });
      }
    }
  }

  const hasDepRef = vars.some(v => v.startsWith('$deps.'));
  const hasRowRef = vars.some(v => v.startsWith('$row.'));
  const hasParentRowRef = vars.some(v => v.startsWith('$parentRow.'));
  const hasSelfRef = vars.some(v => v === '$self' || v.startsWith('$self.'));

  // 4. 作用域隔离：scope:row 不能用 $deps.*
  if (scope === 'row' && hasDepRef) {
    violations.push({
      path: exprPath,
      rule: 'SCOPE_ISOLATION',
      message: 'scope:row 的表达式中不能出现 $deps.*（与 $row.* 互斥）',
    });
  }

  // 5. 作用域隔离：scope:form 不能用 $row.* / $parentRow.*
  if (scope === 'form' && (hasRowRef || hasParentRowRef)) {
    violations.push({
      path: exprPath,
      rule: 'SCOPE_ISOLATION',
      message: 'scope:form 的表达式中不能出现 $row.* / $parentRow.*（需要行数据请使用 scope:row）',
    });
  }

  // 5a. v0.2 的组件 DSL 没有嵌套表格挂载结构，保守拒绝 $parentRow.*
  if (hasParentRowRef) {
    violations.push({
      path: exprPath,
      rule: 'PARENT_ROW_UNSUPPORTED',
      message: 'v0.2 暂不支持 $parentRow.*；待嵌套表格挂载结构通过后续 ADR 定义后再开放',
    });
  }

  // 6. permissions.* 仅允许 $context.*（§10.2 + 附录 A）
  if (location === 'permission' && vars.some(variableName => !variableName.startsWith('$context.'))) {
    violations.push({
      path: exprPath,
      rule: 'PERM_CONTEXT_ONLY',
      message: 'permissions.* 表达式中只允许使用 $context.*',
    });
  }

  // 7. 非表单节点 visibleWhen 只允许 $context.*（§10.1）
  if (location === 'visibleWhen' && !hasFormContext && vars.some(variableName => !variableName.startsWith('$context.'))) {
    violations.push({
      path: exprPath,
      rule: 'NON_FORM_VISIBLEWHEN',
      message: '非表单节点的 visibleWhen 中只允许使用 $context.*，不得使用 $deps.*、$self、$row.* 或 $parentRow.*',
    });
  }

  // 7b. 表单上下文 visibleWhen 不允许 $self / $row.* / $parentRow.*（§2 附录 A / 01 §3.8）
  // visibleWhen 不是字段 reactions，无 $self 注入语义
  if (location === 'visibleWhen' && hasFormContext && (hasSelfRef || hasRowRef || hasParentRowRef)) {
    violations.push({
      path: exprPath,
      rule: 'FORM_VISIBLEWHEN_VARS',
      message: '表单上下文的 visibleWhen 中只允许使用 $deps.* 与 $context.*，不得使用 $self、$row.* 或 $parentRow.*',
    });
  }

  // 8. 表格 actions 任意 scope 不能用 $self（§10.3 / ADR-0004 D2b）
  if (location === 'tableAction' && hasSelfRef) {
    violations.push({
      path: exprPath,
      rule: 'TABLE_ACTION_NO_SELF',
      message: '表格 actions 的表达式中禁止使用 $self（行内操作无当前单元格概念；任意 scope）',
    });
  }

  // 9. 表格列 scope:form 不能用 $self（§10.5）
  if (location === 'tableColumn' && scope === 'form' && hasSelfRef) {
    violations.push({
      path: exprPath,
      rule: 'TABLE_COL_FORM_NO_SELF',
      message: '表格列 scope:form 表达式中禁止使用 $self，需要访问单元格值时请使用 scope:row',
    });
  }

  // 10. 独立表格（非 form 上下文）的列/操作 scope:form 不能用 $deps.*
  if ((location === 'tableColumn' || location === 'tableAction') && scope === 'form' && !hasFormContext && hasDepRef) {
    violations.push({
      path: exprPath,
      rule: 'NON_FORM_TABLE_DEPS',
      message: '独立表格（非 form 上下文）的列/操作在 scope:form 下不能使用 $deps.*；仅当表格位于 form.children 内时才允许',
    });
  }

  // 11. 非 form 上下文的字段级 reactions 不能用 $deps.*
  if (location === 'reaction' && !hasFormContext && hasDepRef) {
    violations.push({
      path: exprPath,
      rule: 'NON_FORM_REACTION_DEPS',
      message: '非 form 上下文的 reactions 中不能出现 $deps.*；仅 form 字段（type===form 或其子孙）允许',
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// 节点遍历
// ---------------------------------------------------------------------------

/**
 * 判断节点是否开启表单上下文（仅 type === form）。
 * 子节点通过 scanNode 的 parentIsForm 继承，不得用节点自身 reactions.dependencies 推断。
 */
function isFormContext(node) {
  return node.type === 'form';
}

function scanNode(node, nodePath, violations, parentIsForm) {
  if (!node || typeof node !== 'object') return;

  const inFormCtx = parentIsForm || isFormContext(node);

  // --- data.params 中的变量值替换 ---
  if (node.data && node.data.params && typeof node.data.params === 'object') {
    scanDataParams(node.data.params, `${nodePath}.data.params`, violations, inFormCtx);
  }

  // --- select.optionsSource.params 中的变量值替换 ---
  if (
    node.props &&
    node.props.optionsSource &&
    node.props.optionsSource.params &&
    typeof node.props.optionsSource.params === 'object'
  ) {
    scanDataParams(
      node.props.optionsSource.params,
      `${nodePath}.props.optionsSource.params`,
      violations,
      inFormCtx,
    );
  }

  // --- reactions[].when ---
  if (Array.isArray(node.reactions)) {
    node.reactions.forEach((reaction, idx) => {
      if (!reaction) return;
      const scope = reaction.scope || 'form';
      const deps = Array.isArray(reaction.dependencies) ? reaction.dependencies : [];
      const exprPath = `${nodePath}.reactions[${idx}].when`;
      if (reaction.when !== undefined && reaction.when !== null) {
        const vs = validateExpression(String(reaction.when), exprPath, {
          scope, dependencies: deps, location: 'reaction', hasFormContext: inFormCtx, componentType: node.type,
        });
        violations.push(...vs);
      }
    });
  }

  // --- visibleWhen.when ---
  if (node.visibleWhen && node.visibleWhen.when !== undefined && node.visibleWhen.when !== null) {
    const scope = node.visibleWhen.scope || 'form';
    const deps = Array.isArray(node.visibleWhen.dependencies) ? node.visibleWhen.dependencies : [];
    const vs = validateExpression(
      String(node.visibleWhen.when),
      `${nodePath}.visibleWhen.when`,
      { scope, dependencies: deps, location: 'visibleWhen', hasFormContext: inFormCtx },
    );
    violations.push(...vs);
  }

  // --- permissions.* ---
  if (node.permissions && typeof node.permissions === 'object') {
    for (const [key, expr] of Object.entries(node.permissions)) {
      if (typeof expr !== 'string') continue;
      const vs = validateExpression(expr, `${nodePath}.permissions.${key}`, {
        scope: 'form', dependencies: [], location: 'permission', hasFormContext: false,
      });
      violations.push(...vs);
    }
  }

  // --- 表格列/actions 内表达式 ---
  if (node.type === 'table' && node.props) {
    const { columns = [], actions = [] } = node.props;
    columns.forEach((col, ci) => {
      if (!col) return;
      const colBase = `${nodePath}.props.columns[${ci}]`;
      if (col.visibleWhen && col.visibleWhen.when !== undefined && col.visibleWhen.when !== null) {
        const scope = col.visibleWhen.scope || 'form';
        const deps = Array.isArray(col.visibleWhen.dependencies) ? col.visibleWhen.dependencies : [];
        violations.push(...validateExpression(String(col.visibleWhen.when), `${colBase}.visibleWhen.when`, {
          scope, dependencies: deps, location: 'tableColumn', hasFormContext: inFormCtx,
        }));
      }
      if (Array.isArray(col.reactions)) {
        col.reactions.forEach((r, ri) => {
          if (r && r.when !== undefined && r.when !== null) {
            const scope = r.scope || 'form';
            const deps = Array.isArray(r.dependencies) ? r.dependencies : [];
            violations.push(...validateExpression(String(r.when), `${colBase}.reactions[${ri}].when`, {
              scope, dependencies: deps, location: 'tableColumn', hasFormContext: inFormCtx,
            }));
          }
        });
      }
      if (col.permissions) {
        for (const [k, expr] of Object.entries(col.permissions)) {
          if (typeof expr !== 'string') continue;
          violations.push(...validateExpression(expr, `${colBase}.permissions.${k}`, {
            scope: 'form', dependencies: [], location: 'permission', hasFormContext: false,
          }));
        }
      }
    });

    actions.forEach((action, ai) => {
      if (!action) return;
      const actBase = `${nodePath}.props.actions[${ai}]`;
      if (action.visibleWhen && action.visibleWhen.when !== undefined && action.visibleWhen.when !== null) {
        const scope = action.visibleWhen.scope || 'form';
        const deps = Array.isArray(action.visibleWhen.dependencies) ? action.visibleWhen.dependencies : [];
        violations.push(...validateExpression(String(action.visibleWhen.when), `${actBase}.visibleWhen.when`, {
          scope, dependencies: deps, location: 'tableAction', hasFormContext: inFormCtx,
        }));
      }
      if (Array.isArray(action.reactions)) {
        action.reactions.forEach((r, ri) => {
          if (r && r.when !== undefined && r.when !== null) {
            const scope = r.scope || 'form';
            const deps = Array.isArray(r.dependencies) ? r.dependencies : [];
            violations.push(...validateExpression(String(r.when), `${actBase}.reactions[${ri}].when`, {
              scope, dependencies: deps, location: 'tableAction', hasFormContext: inFormCtx,
            }));
          }
        });
      }
      if (action.permissions) {
        for (const [permissionKey, expr] of Object.entries(action.permissions)) {
          if (typeof expr !== 'string') continue;
          violations.push(...validateExpression(expr, `${actBase}.permissions.${permissionKey}`, {
            scope: 'form', dependencies: [], location: 'permission', hasFormContext: false,
          }));
        }
      }
    });
  }

  // --- 递归 children ---
  if (Array.isArray(node.children)) {
    node.children.forEach((child, idx) => {
      scanNode(child, `${nodePath}.children[${idx}]`, violations, inFormCtx);
    });
  }

  // --- tabs 内嵌 content ---
  if (node.props && Array.isArray(node.props.items)) {
    node.props.items.forEach((item, idx) => {
      if (item && item.content) {
        scanNode(item.content, `${nodePath}.props.items[${idx}].content`, violations, inFormCtx);
      }
    });
  }
}

function scanDataParams(params, paramsPath, violations, hasFormContext) {
  const isOptionsSource = paramsPath.includes('optionsSource.params');
  const paramsLabel = isOptionsSource ? 'optionsSource.params' : 'data.params';

  for (const [key, value] of Object.entries(params)) {
    const valuePath = Array.isArray(params) ? `${paramsPath}[${key}]` : `${paramsPath}.${key}`;
    if (value && typeof value === 'object') {
      scanDataParams(value, valuePath, violations, hasFormContext);
      continue;
    }

    if (typeof value !== 'string') continue;

    const refs = value.match(/\$(?:deps|row|parentRow|context)(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*|\$self\b/g) || [];
    for (const ref of refs) {
      if (ref.startsWith('$deps.')) {
        if (!hasFormContext) {
          violations.push({
            path: valuePath,
            rule: 'NON_FORM_DATA_PARAMS',
            message: `非表单上下文的 ${paramsLabel} 中不能出现 $deps.*`,
          });
        }
        continue;
      }

      violations.push({
        path: valuePath,
        rule: 'DATA_PARAMS_VARIABLE',
        message: `${paramsLabel} 仅允许字面量或 $deps.* 值替换，不允许使用 $row.*、$parentRow.*、$self 或 $context.*`,
      });
    }
  }
}

function validatePage(doc, fileLabel) {
  const violations = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return violations;
  if (doc.body) scanNode(doc.body, 'body', violations, false);

  // --- datasources.*.params 中的 $deps.* 值替换（页面级预声明，永远非 form 上下文）---
  if (doc.datasources && typeof doc.datasources === 'object' && !Array.isArray(doc.datasources)) {
    for (const [sourceId, dataRef] of Object.entries(doc.datasources)) {
      if (dataRef && dataRef.params && typeof dataRef.params === 'object') {
        scanDataParams(dataRef.params, `datasources.${sourceId}.params`, violations, false);
      }
    }
  }

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`, violations, false);
      }
    }
  }

  return violations.map(v => ({ file: fileLabel, ...v }));
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const patterns = args.filter(a => !a.startsWith('--'));

  if (patterns.length === 0) {
    console.error('用法: node scripts/validate-l3a-expressions.js <file-or-glob> [--json]');
    process.exit(2);
  }

  const files = expandFilePatterns(patterns);

  if (files.length === 0) {
    console.error(`[L3a] 未找到匹配文件：${patterns.join(', ')}`); process.exit(2);
  }

  let allViolations = [];
  const fileErrors = [];

  for (const file of files) {
    try {
      const doc = parseFile(file);
      allViolations = allViolations.concat(validatePage(doc, file));
    } catch (err) {
      fileErrors.push({ file, error: err.message });
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ violations: allViolations, parseErrors: fileErrors }, null, 2));
  } else {
    fileErrors.forEach(e => console.error(`[L3a] 解析失败 ${e.file}: ${e.error}`));
    if (allViolations.length > 0) {
      console.error(`[L3a] 发现 ${allViolations.length} 处表达式违规：`);
      allViolations.forEach(v => {
        console.error(`  ${v.file}  →  ${v.path}  [${v.rule}]: ${v.message}`);
      });
    } else {
      console.log(`[L3a] 通过：${files.length} 个文件未发现表达式违规。`);
    }
  }

  process.exitCode = allViolations.length > 0 || fileErrors.length > 0 ? 1 : 0;
}

main();
