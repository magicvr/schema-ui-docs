#!/usr/bin/env node
/**
 * L2 组件契约校验器
 *
 * 按 component-registry.json 的自定义 DSL 校验每个 Node 的：
 *   1. type 是否在注册表中
 *   2. props 字段是否合法（required 字段、字段类型、enum 值、额外字段）
 *   3. supportsChildren / supportsData / supportsReactions / supportsStates 约束
 *   4. 组件级 anyOf / oneOf / allOf 约束
 *   5. responseMapping 生效映射语义规则（本地优先，否则继承 datasources[ref].responseMapping）：
 *      - table / chart 使用 API/ref 数据且生效的 responseMapping 存在时，必须声明 responseMapping.list
 *      - table.props.pagination.mode === 'server' 且生效的 responseMapping 存在时，必须声明 responseMapping.total
 *      - 生效映射解析顺序：本地 data.responseMapping 优先，否则当 source: ref 时继承 datasources[ref].responseMapping；无映射时不强制
 *   9. params.responseMapping 禁令（ADR-0005 D1）：
 *      - responseMapping 不属于请求参数，禁止放入 data.params 或 datasources.*.params
 *   6. 执行能力与行级/页面 action 引用规则：
 *      - RowAction.actionRef → type:request 须 actions.row.request + requestMapping
 *      - RowAction.actionRef → type:navigate 须 actions.row.navigate + navigateMapping（ADR-0021）
 *      - actionButton / table.toolbar 须 actions.page.trigger（ADR-0020）
 *      - form.recordSource 须 form.record.load；search 模式禁止；responseMapping 必填非空（ADR-0021）
 *   7. 页面级 action 引用完整性校验：
 *      - form.props.submitAction 必须存在于 doc.actions
 *      - upload.props.actionRef 必须存在于 doc.actions 且 type 必须为 upload
 *      - ActionTrigger.actionRef 仅允许 request|navigate|modal；request 禁止 GET
 *   8. datasource / targetTable 引用存在性校验：
 *      - data.source: ref 时，data.ref 必须存在于 doc.datasources
 *      - form.mode: search 的 targetTable 必须在页面 Node 树中存在 id 匹配且 type: table 的节点
 *
 * 用法：
 *   node scripts/validate-l2-components.js <file-or-glob> [--json]
 *
 * 退出码：
 *   0 — 全部通过
 *   1 — 存在违规
 *   2 — 调用方式错误
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { expandFilePatterns } = require('./file-patterns');
const { protocolPath } = require('./protocol-paths');

// ---------------------------------------------------------------------------
// 加载 component-registry.json
// ---------------------------------------------------------------------------
const REGISTRY_PATH = protocolPath('docs', 'schemas', 'component-registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const components = registry.components; // { [type]: ComponentDef }

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
      console.error('[L2] 解析 YAML 需要 js-yaml：npm install js-yaml'); process.exit(2);
    }
    return yaml.load(raw);
  }
  throw new Error(`不支持的文件格式: ${ext}`);
}

// ---------------------------------------------------------------------------
// 辅助：从 DSL props 定义中提取校验元数据
// ---------------------------------------------------------------------------

/** 从 component-registry DSL props 对象中提取 additionalProperties 规则 */
function allowsAdditionalProps(propsSpec) {
  return propsSpec.additionalProperties !== false;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const PROTOCOL_RELATIVE_URL = /^\/(?!\/)[^\s\\]*$/;
const RESERVED_ROW_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function isValidUnicodeScalarString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function validateExistingUrlQuery(url, fieldPath, violations) {
  const requestPart = url.split('#', 1)[0];
  const queryIndex = requestPart.indexOf('?');
  if (queryIndex === -1) return;
  const query = requestPart.slice(queryIndex + 1);
  for (const segment of query.split('&')) {
    if (segment === '') continue;
    const equalsIndex = segment.indexOf('=');
    const encodedKey = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
    const encodedValue = equalsIndex === -1 ? '' : segment.slice(equalsIndex + 1);
    let key;
    let value;
    try {
      key = decodeURIComponent(encodedKey);
      value = decodeURIComponent(encodedValue);
    } catch {
      violations.push({ path: fieldPath, message: 'URL 中已有 query 必须使用合法的百分号编码和 UTF-8（INVALID_BASE_URL_QUERY）' });
      return;
    }
    if (!isValidUnicodeScalarString(key) || !isValidUnicodeScalarString(value) || key.length === 0) {
      violations.push({ path: fieldPath, message: 'URL 中已有 query 必须使用合法的 Unicode scalar 和非空 key（INVALID_BASE_URL_QUERY）' });
      return;
    }
  }
}

function validateProtocolUrl(value, fieldPath, violations) {
  if (typeof value !== 'string' || !PROTOCOL_RELATIVE_URL.test(value)) {
    violations.push({
      path: fieldPath,
      message: 'URL 必须是 baseURL 下的单斜杠相对路径；不允许绝对 URL、协议相对 URL、空白或反斜杠',
    });
    return;
  }
  validateExistingUrlQuery(value, fieldPath, violations);
}

/** 判断字段是否在 DSL props 中显式声明 */
function getDeclaredFields(propsSpec) {
  const reserved = new Set(['additionalProperties', 'allOf', 'anyOf', 'oneOf']);
  return Object.keys(propsSpec).filter(k => !reserved.has(k));
}

/** 简单类型检查：仅针对 string / number / boolean / array / object */
function checkType(value, expectedType, fieldPath, violations) {
  if (expectedType === 'string' && typeof value !== 'string') {
    violations.push({ path: fieldPath, message: `期望 string，实际 ${typeof value}` });
  } else if (expectedType === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    const actual = typeof value !== 'number'
      ? typeof value
      : Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity';
    violations.push({ path: fieldPath, message: `期望有限 number，实际 ${actual}` });
  } else if (expectedType === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
    violations.push({ path: fieldPath, message: `期望 integer，实际 ${typeof value === 'number' ? value : typeof value}` });
  } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
    violations.push({ path: fieldPath, message: `期望 boolean，实际 ${typeof value}` });
  } else if (expectedType === 'array' && !Array.isArray(value)) {
    violations.push({ path: fieldPath, message: `期望 array，实际 ${typeof value}` });
  } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
    violations.push({ path: fieldPath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
  }
}

function checkNumberBounds(value, spec, fieldPath, violations) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  if (typeof spec.minimum === 'number' && value < spec.minimum) {
    violations.push({ path: fieldPath, message: `值 ${value} 小于最小值 ${spec.minimum}` });
  }
}

/** 检查 enum 约束 */
function checkEnum(value, enumValues, fieldPath, violations) {
  if (!enumValues.includes(value)) {
    violations.push({ path: fieldPath, message: `值 "${value}" 不在枚举 [${enumValues.join(', ')}] 中` });
  }
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateQueryScalarMap(params, paramsPath, violations, allowedVariablePattern) {
  if (params === undefined) return;
  if (!isPlainObject(params)) {
    violations.push({ path: paramsPath, message: 'query params 必须是对象' });
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    const valuePath = `${paramsPath}.${key}`;
    if (key.length === 0 || !isValidUnicodeScalarString(key)) {
      violations.push({
        path: valuePath,
        message: 'query 参数 key 必须是非空且合法的 Unicode scalar 字符串',
      });
    }

    const isScalar = value === null
      || typeof value === 'string'
      || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value));
    if (!isScalar) {
      const valueType = Array.isArray(value)
        ? 'array'
        : typeof value === 'number' ? (Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity')
          : typeof value;
      violations.push({
        path: valuePath,
        message: `query 参数值只能是 string/finite number/boolean/null 标量，实际为 ${valueType}`,
      });
      continue;
    }

    if (typeof value === 'string' && !isValidUnicodeScalarString(value)) {
      violations.push({
        path: valuePath,
        message: 'query 参数 key/value 必须是合法的 Unicode scalar 字符串',
      });
      continue;
    }

    if (typeof value === 'string' && value.includes('$') && !allowedVariablePattern.test(value)) {
      violations.push({
        path: valuePath,
        message: 'query 参数变量必须是当前挂载点允许的完整单个点路径引用，禁止模板拼接或其他变量命名空间',
      });
    }
  }
}

function validateStringArray(value, fieldPath, violations) {
  if (!Array.isArray(value)) {
    violations.push({ path: fieldPath, message: '期望 array，实际 ' + (value === null ? 'null' : typeof value) });
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      violations.push({ path: `${fieldPath}[${index}]`, message: `期望 string，实际 ${typeof item}` });
    }
  });
}

/** 表格 columns[] / actions[] 上的 reaction 状态挂载点（无表单字段语义） */
function isTableColumnOrActionReactionPath(path) {
  return /\.props\.(columns|actions)\[\d+\]\.reactions\[\d+\]\.(fulfill|otherwise)$/.test(path);
}

function validateStateMap(value, statePath, violations, scope) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    violations.push({ path: statePath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }

  const allowedKeys = new Set(['visible', 'required', 'disabled', 'value']);
  for (const [key, stateValue] of Object.entries(value)) {
    if (!allowedKeys.has(key)) {
      violations.push({ path: `${statePath}.${key}`, message: `不允许的额外字段 "${key}"` });
      continue;
    }
    if (['visible', 'required', 'disabled'].includes(key) && typeof stateValue !== 'boolean') {
      violations.push({ path: `${statePath}.${key}`, message: `期望 boolean，实际 ${typeof stateValue}` });
    }
  }

  // 表格列/操作 reactions（任意 scope）与 scope:row：仅允许 visible/disabled
  const restrictToVisibleDisabled = scope === 'row' || isTableColumnOrActionReactionPath(statePath);
  if (restrictToVisibleDisabled) {
    for (const forbiddenKey of ['required', 'value']) {
      if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) {
        const reason = isTableColumnOrActionReactionPath(statePath)
          ? '表格 columns/actions 的 fulfill/otherwise 中禁止声明 required 或 value（仅允许 visible 和 disabled）'
          : 'scope: row 的 fulfill/otherwise 中禁止声明 required 或 value（仅允许 visible 和 disabled）';
        violations.push({
          path: `${statePath}.${forbiddenKey}`,
          message: reason,
        });
      }
    }
  }
}

function validateDependencyArray(value, fieldPath, violations) {
  validateStringArray(value, fieldPath, violations);
  if (!Array.isArray(value)) return;
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string') return;
    const itemPath = `${fieldPath}[${index}]`;
    const validPath = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(item);
    if (!validPath || item.startsWith('$deps.') || item.startsWith('$row.')) {
      violations.push({ path: itemPath, message: 'dependencies 必须是无 $deps./$row. 前缀的合法字段路径' });
    }
    if (seen.has(item)) {
      violations.push({ path: itemPath, message: `dependencies 不能重复声明 "${item}"` });
    }
    seen.add(item);
  });
}

function validateVisibleWhen(value, valuePath, violations) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    violations.push({ path: valuePath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }

  const allowedKeys = new Set(['scope', 'dependencies', 'when']);
  if (value.when === undefined) {
    violations.push({ path: `${valuePath}.when`, message: '必填字段 "when" 缺失' });
  } else if (typeof value.when !== 'string') {
    violations.push({ path: `${valuePath}.when`, message: `期望 string，实际 ${typeof value.when}` });
  }
  if (value.scope !== undefined) {
    checkType(value.scope, 'string', `${valuePath}.scope`, violations);
    if (typeof value.scope === 'string') checkEnum(value.scope, ['form', 'row'], `${valuePath}.scope`, violations);
  }
  if (value.dependencies !== undefined) {
    validateDependencyArray(value.dependencies, `${valuePath}.dependencies`, violations);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      violations.push({ path: `${valuePath}.${key}`, message: `不允许的额外字段 "${key}"` });
    }
  }
}

function validateReaction(value, valuePath, violations) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    violations.push({ path: valuePath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }

  const allowedKeys = new Set(['dependencies', 'when', 'scope', 'fulfill', 'otherwise']);
  const scope = value.scope || 'form';
  if (value.dependencies === undefined) {
    violations.push({ path: `${valuePath}.dependencies`, message: '必填字段 "dependencies" 缺失' });
  } else {
    validateDependencyArray(value.dependencies, `${valuePath}.dependencies`, violations);
  }
  if (value.when === undefined) {
    violations.push({ path: `${valuePath}.when`, message: '必填字段 "when" 缺失' });
  } else if (typeof value.when !== 'string') {
    violations.push({ path: `${valuePath}.when`, message: `期望 string，实际 ${typeof value.when}` });
  }
  if (value.scope !== undefined) {
    checkType(value.scope, 'string', `${valuePath}.scope`, violations);
    if (typeof value.scope === 'string') checkEnum(value.scope, ['form', 'row'], `${valuePath}.scope`, violations);
  }
  if (value.fulfill === undefined) {
    violations.push({ path: `${valuePath}.fulfill`, message: '必填字段 "fulfill" 缺失' });
  } else {
    validateStateMap(value.fulfill, `${valuePath}.fulfill`, violations, scope);
  }
  if (value.otherwise !== undefined) {
    validateStateMap(value.otherwise, `${valuePath}.otherwise`, violations, scope);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      violations.push({ path: `${valuePath}.${key}`, message: `不允许的额外字段 "${key}"` });
    }
  }
}

function validatePermissions(value, valuePath, violations) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    violations.push({ path: valuePath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }
  if (Object.keys(value).length === 0) {
    violations.push({ path: valuePath, message: 'permissions 至少需要一个动作键' });
  }
  for (const [key, expr] of Object.entries(value)) {
    if (typeof expr !== 'string') {
      violations.push({ path: `${valuePath}.${key}`, message: `期望 string，实际 ${typeof expr}` });
    }
  }
}

function validateKnownRef(value, ref, valuePath, violations) {
  if (ref === 'node.schema.json') {
    if (!isPlainObject(value)) {
      violations.push({
        path: valuePath,
        message: `完整 Node 必须是 object，实际 ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`,
      });
    }
  } else if (ref === 'node.schema.json#/definitions/VisibleWhen') {
    validateVisibleWhen(value, valuePath, violations);
  } else if (ref === 'reaction.schema.json') {
    validateReaction(value, valuePath, violations);
  } else if (ref === 'node.schema.json#/definitions/Permissions') {
    validatePermissions(value, valuePath, violations);
  }
}

/**
 * 递归校验嵌套 object 的 properties / required / additionalProperties。
 * spec 是 DSL 中字段规格（含 properties / required / additionalProperties）。
 */
function validateNestedObject(obj, spec, objPath, violations) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const props = spec.properties || {};
  // required 列表（防御：DSL 里 required 有时为字符串或缺失）
  const reqList = Array.isArray(spec.required) ? spec.required : [];
  for (const rf of reqList) {
    if (obj[rf] === undefined) {
      violations.push({ path: `${objPath}.${rf}`, message: `必填字段 "${rf}" 缺失` });
    }
  }
  // 字段级布尔 required: true（嵌套 DSL 写法）
  for (const [fieldName, fieldSpec] of Object.entries(props)) {
    if (fieldSpec && typeof fieldSpec === 'object' && fieldSpec.required === true && obj[fieldName] === undefined) {
      violations.push({ path: `${objPath}.${fieldName}`, message: `必填字段 "${fieldName}" 缺失` });
    }
  }
  // 字段类型 + enum
  for (const [k, v] of Object.entries(obj)) {
    const fs = props[k];
    if (!fs || typeof fs !== 'object') continue;
    if (fs.$ref) validateKnownRef(v, fs.$ref, `${objPath}.${k}`, violations);
    if (fs.type) checkType(v, fs.type, `${objPath}.${k}`, violations);
    if (fs.enum && v !== undefined) checkEnum(v, fs.enum, `${objPath}.${k}`, violations);
    checkNumberBounds(v, fs, `${objPath}.${k}`, violations);
    // 再深一层：有 properties 或 additionalProperties schema 的 object 都递归
    if (fs.type === 'object' && v && typeof v === 'object' && !Array.isArray(v) &&
        (fs.properties || (fs.additionalProperties && typeof fs.additionalProperties === 'object'))) {
      validateNestedObject(v, fs, `${objPath}.${k}`, violations);
    }
    if (fs.type === 'array' && fs.items && Array.isArray(v)) {
      v.forEach((item, index) => {
        if (fs.items.$ref) {
          validateKnownRef(item, fs.items.$ref, `${objPath}.${k}[${index}]`, violations);
        }
        if (item && typeof item === 'object' && !Array.isArray(item) &&
            (fs.items.properties || (fs.items.additionalProperties && typeof fs.items.additionalProperties === 'object'))) {
          validateNestedObject(item, fs.items, `${objPath}.${k}[${index}]`, violations);
        }
      });
    }
  }
  // additionalProperties: false → 拒绝未声明字段
  if (spec.additionalProperties === false) {
    for (const k of Object.keys(obj)) {
      if (!(k in props)) {
        violations.push({ path: `${objPath}.${k}`, message: `不允许的额外字段 "${k}"` });
      }
    }
  }
  // additionalProperties 为对象 schema → 对所有不在 properties 中的 key 按该 schema 校验值
  if (spec.additionalProperties && typeof spec.additionalProperties === 'object') {
    const addlSpec = spec.additionalProperties;
    for (const k of Object.keys(obj)) {
      if (k in props) continue; // 已由 properties 覆盖
      const v = obj[k];
      if (addlSpec.type) checkType(v, addlSpec.type, `${objPath}.${k}`, violations);
      checkNumberBounds(v, addlSpec, `${objPath}.${k}`, violations);
      if (addlSpec.properties && v && typeof v === 'object' && !Array.isArray(v)) {
        validateNestedObject(v, addlSpec, `${objPath}.${k}`, violations);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// anyOf / oneOf 辅助（仅检查 required 字段出现与否，不做深度校验）
// ---------------------------------------------------------------------------
function checkAnyOf(props, anyOfList, nodePath, violations) {
  const satisfied = anyOfList.some(cond => {
    if (!cond.required) return true;
    return cond.required.every(k => props[k] !== undefined);
  });
  if (!satisfied) {
    const options = anyOfList
      .filter(c => c.required)
      .map(c => c.required.join('+'))
      .join(' 或 ');
    violations.push({ path: `${nodePath}.props`, message: `anyOf 约束不满足，需要提供以下字段之一：${options}` });
  }
}

function checkOneOf(props, oneOfList, nodePath, violations) {
  const matched = oneOfList.filter(cond => {
    if (!cond.required) return false;
    return cond.required.every(k => props[k] !== undefined);
  });
  if (matched.length !== 1) {
    const options = oneOfList
      .filter(c => c.required)
      .map(c => c.required.join('+'))
      .join(' / ');
    violations.push({
      path: `${nodePath}.props`,
      message: `oneOf 约束不满足（${matched.length} 个匹配，期望 1）：${options}`,
    });
  }
}

// ---------------------------------------------------------------------------
// 核心：校验单个 Node
// ---------------------------------------------------------------------------
function validateNode(node, nodePath, violations, doc, parentIsForm = false) {
  if (!isPlainObject(node)) return;

  const { type, children, reactions, data, states } = node;
  const props = isPlainObject(node.props) ? node.props : {};
  const inFormContext = parentIsForm || type === 'form';

  // --- type 存在性 ---
  if (!type) {
    violations.push({ path: `${nodePath}.type`, message: '缺少必填字段 type' });
    return; // 没有 type 无法继续
  }
  const compDef = components[type];
  if (!compDef) {
    violations.push({ path: `${nodePath}.type`, message: `未知组件类型 "${type}"` });
    // 未知 type 仍继续递归子节点
  } else {
    // --- supportsChildren ---
    if (!compDef.supportsChildren && Array.isArray(children) && children.length > 0) {
      violations.push({
        path: `${nodePath}.children`,
        message: `组件 "${type}" 不支持 children（supportsChildren: false）`,
      });
    }

    // --- supportsData ---
    if (!compDef.supportsData && data !== undefined) {
      violations.push({
        path: `${nodePath}.data`,
        message: `组件 "${type}" 不支持 data（supportsData: false）`,
      });
    }

    // --- supportsReactions ---
    if (!compDef.supportsReactions && Array.isArray(reactions) && reactions.length > 0) {
      violations.push({
        path: `${nodePath}.reactions`,
        message: `组件 "${type}" 不支持 reactions（supportsReactions: false）`,
      });
    }

    // --- supportsStates ---
    if (!compDef.supportsStates && states !== undefined) {
      violations.push({
        path: `${nodePath}.states`,
        message: `组件 "${type}" 不支持 states（supportsStates: false）`,
      });
    }

    // --- props 校验 ---
    validateProps(props, compDef, type, nodePath, violations);

    if (data?.source === 'api') {
      if (data.method !== undefined && data.method !== 'GET') {
        violations.push({
          path: `${nodePath}.data.method`,
          message: 'DataRef 只允许 GET；写操作必须使用 Action（DATA_REF_METHOD_NOT_READ_ONLY）',
        });
      }
      if (data.url !== undefined) {
        validateProtocolUrl(data.url, `${nodePath}.data.url`, violations);
      }
    }

    if (type === 'dateRangePicker' && props.startField === props.endField && typeof props.startField === 'string') {
      violations.push({
        path: `${nodePath}.props.endField`,
        message: 'dateRangePicker 的 startField 与 endField 必须不同',
      });
    }

    if (type === 'table' && props.pagination?.mode === 'server'
      && (typeof props.pagination.pageSize !== 'number' || !Number.isInteger(props.pagination.pageSize)
        || props.pagination.pageSize < 1)) {
      violations.push({
        path: `${nodePath}.props.pagination.pageSize`,
        message: 'server 分页的 pageSize 必须是正整数',
      });
    }

    if (type === 'grid' && (typeof props.columns !== 'number' || !Number.isInteger(props.columns) || props.columns < 1)) {
      violations.push({ path: `${nodePath}.props.columns`, message: 'grid.columns 必须是正整数' });
    }
    if (props.span !== undefined && (typeof props.span !== 'number' || !Number.isInteger(props.span) || props.span < 1)) {
      violations.push({ path: `${nodePath}.props.span`, message: 'span 必须是正整数' });
    }

    if (type === 'grid' && Array.isArray(children)) {
      children.forEach((child, index) => {
        const childSpan = child?.props?.span;
        if (childSpan !== undefined && typeof childSpan === 'number' && Number.isInteger(childSpan)
          && childSpan > props.columns) {
          violations.push({ path: `${nodePath}.children[${index}].props.span`, message: '子节点 span 不得超过父 grid.columns' });
        }
      });
    }

    if (type === 'table' && Array.isArray(props.actions)) {
      props.actions.forEach((action, index) => {
        if (action?.visibleField !== undefined
          && (typeof action.visibleField !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(action.visibleField))) {
          violations.push({ path: `${nodePath}.props.actions[${index}].visibleField`, message: 'visibleField 必须是合法 row path，不得包含表达式或模板' });
        }
      });
    }

    if (type === 'select' && props.optionsSource?.url !== undefined) {
      validateProtocolUrl(props.optionsSource.url, `${nodePath}.props.optionsSource.url`, violations);
    }
    if (type === 'upload' && props.action !== undefined) {
      validateProtocolUrl(props.action, `${nodePath}.props.action`, violations);
    }

    if (type === 'datePicker' || type === 'dateRangePicker') {
      for (const dateBoundary of ['min', 'max']) {
        if (props[dateBoundary] !== undefined && !isValidIsoDate(props[dateBoundary])) {
          violations.push({
            path: `${nodePath}.props.${dateBoundary}`,
            message: `${type}.${dateBoundary} 必须是有效的 ISO 日期 YYYY-MM-DD`,
          });
        }
      }
    }

    if (type === 'select' && props.optionsSource?.params !== undefined) {
      validateQueryScalarMap(
        props.optionsSource.params,
        `${nodePath}.props.optionsSource.params`,
        violations,
        /^\$deps\.[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/,
      );
      if (props.optionsSource.searchable === true && Object.prototype.hasOwnProperty.call(props.optionsSource.params, 'keyword')) {
        violations.push({ path: `${nodePath}.props.optionsSource.params.keyword`, message: 'searchable optionsSource 的 keyword 由 Renderer 保留，不能在 params 中声明' });
      }
    }

    // --- responseMapping 语义规则（传入 doc 以支持 source:ref 继承解析） ---
    validateStaticDataShape(node, type, nodePath, doc, violations);
    validateResponseMapping(node, type, compDef, nodePath, violations, doc);
  }

  if (node.visibleWhen && inFormContext && node.visibleWhen.dependencies === undefined) {
    violations.push({
      path: `${nodePath}.visibleWhen.dependencies`,
      message: '表单上下文中的 visibleWhen 必须显式声明 dependencies（无字段依赖时使用空数组）',
    });
  }

  if (type === 'table' && inFormContext) {
    for (const [collectionName, entries] of [
      ['columns', props.columns],
      ['actions', props.actions],
    ]) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, index) => {
        if (
          entry?.visibleWhen
          && (entry.visibleWhen.scope || 'form') === 'form'
          && entry.visibleWhen.dependencies === undefined
        ) {
          violations.push({
            path: `${nodePath}.props.${collectionName}[${index}].visibleWhen.dependencies`,
            message: '表单上下文中 scope: form 的 visibleWhen 必须显式声明 dependencies（无字段依赖时使用空数组）',
          });
        }
      });
    }
  }

  // --- 递归 children ---
  if (Array.isArray(children)) {
    children.forEach((child, idx) => {
      validateNode(child, `${nodePath}.children[${idx}]`, violations, doc, inFormContext);
    });
  }

  // --- tabs 内嵌 content ---
  if (props && Array.isArray(props.items)) {
    props.items.forEach((item, idx) => {
      if (isPlainObject(item) && Object.prototype.hasOwnProperty.call(item, 'content')) {
        validateNode(item.content, `${nodePath}.props.items[${idx}].content`, violations, doc, inFormContext);
      }
    });
  }
}

function validateProps(props, compDef, type, nodePath, violations) {
  const propsSpec = compDef.props || {};
  const declaredFields = new Set(getDeclaredFields(propsSpec));

  // --- required 字段检查 ---
  for (const field of declaredFields) {
    const spec = propsSpec[field];
    if (!spec || typeof spec !== 'object') continue;
    if (spec.required === true && props[field] === undefined) {
      violations.push({
        path: `${nodePath}.props.${field}`,
        message: `必填字段 "${field}" 缺失`,
      });
    }
  }

  // --- 字段类型 + enum 检查（含嵌套 object/array 递归）---
  for (const [key, value] of Object.entries(props)) {
    const fieldSpec = propsSpec[key];
    if (!fieldSpec || typeof fieldSpec !== 'object') continue;
    if (fieldSpec.type) {
      checkType(value, fieldSpec.type, `${nodePath}.props.${key}`, violations);
    }
    if (fieldSpec.enum && value !== undefined) {
      checkEnum(value, fieldSpec.enum, `${nodePath}.props.${key}`, violations);
    }
    checkNumberBounds(value, fieldSpec, `${nodePath}.props.${key}`, violations);
    // 嵌套 object：递归校验其 properties / required / additionalProperties（含只有 additionalProperties schema 的对象）
    if (fieldSpec.type === 'object' && value && typeof value === 'object' && !Array.isArray(value) &&
        (fieldSpec.properties || (fieldSpec.additionalProperties && typeof fieldSpec.additionalProperties === 'object'))) {
      validateNestedObject(value, fieldSpec, `${nodePath}.props.${key}`, violations);
    }
    // 嵌套 array：校验每个元素的 properties / required / anyOf（如 columns[]）
    if (fieldSpec.type === 'array' && fieldSpec.items && Array.isArray(value)) {
      value.forEach((item, idx) => {
        const itemSpec = fieldSpec.items;
        if (itemSpec.$ref) {
          validateKnownRef(item, itemSpec.$ref, `${nodePath}.props.${key}[${idx}]`, violations);
        }
        if (item && typeof item === 'object' &&
            (itemSpec.properties || (itemSpec.additionalProperties && typeof itemSpec.additionalProperties === 'object'))) {
          validateNestedObject(item, itemSpec, `${nodePath}.props.${key}[${idx}]`, violations);
        }
        if (itemSpec.required) {
          itemSpec.required.forEach(rf => {
            if (!item || item[rf] === undefined) {
              violations.push({ path: `${nodePath}.props.${key}[${idx}].${rf}`, message: `数组项必填字段 "${rf}" 缺失` });
            }
          });
        }
        if (itemSpec.anyOf && item) {
          checkAnyOf(item, itemSpec.anyOf, `${nodePath}.props.${key}[${idx}]`, violations);
        }
      });
    }
  }

  // --- additionalProperties: false 检查 ---
  if (!allowsAdditionalProps(propsSpec)) {
    for (const key of Object.keys(props)) {
      if (!declaredFields.has(key)) {
        violations.push({
          path: `${nodePath}.props.${key}`,
          message: `不允许的额外字段 "${key}"（组件 "${type ?? '?'}" 的 props 不接受额外属性）`,
        });
      }
    }
  }

  // --- 组件级 anyOf ---
  if (compDef.anyOf) {
    checkAnyOf(props, compDef.anyOf, nodePath, violations);
  }

  // --- 组件级 oneOf ---
  if (compDef.oneOf) {
    checkOneOf(props, compDef.oneOf, nodePath, violations);
  }

  // --- 组件级 allOf（每个 allOf 条目视作独立 anyOf/oneOf 子约束） ---
  if (Array.isArray(compDef.allOf)) {
    compDef.allOf.forEach((clause, idx) => {
      if (clause.anyOf) checkAnyOf(props, clause.anyOf, `${nodePath}[allOf[${idx}]]`, violations);
      if (clause.oneOf) checkOneOf(props, clause.oneOf, `${nodePath}[allOf[${idx}]]`, violations);
    });
  }

  // --- props 内部的 allOf（如 form.props.allOf） ---
  if (propsSpec.allOf) {
    propsSpec.allOf.forEach((clause, idx) => {
      if (!clause.if || !clause.then) return;
      // 评估 if 条件
      const ifReq = clause.if.required || [];
      const ifPropConditions = clause.if.properties || {};
      const ifMet = ifReq.every(k => props[k] !== undefined) &&
        Object.entries(ifPropConditions).every(([k, cond]) => {
          if (cond.const !== undefined) return props[k] === cond.const;
          return true;
        });
      if (ifMet && clause.then.required) {
        clause.then.required.forEach(reqField => {
          if (props[reqField] === undefined) {
            violations.push({
              path: `${nodePath}.props.${reqField}`,
              message: `条件必填字段 "${reqField}" 缺失（allOf[${idx}] 条件满足时必填）`,
            });
          }
        });
      }
      if (!ifMet && clause.else && clause.else.required) {
        clause.else.required.forEach(reqField => {
          if (props[reqField] === undefined) {
            violations.push({
              path: `${nodePath}.props.${reqField}`,
              message: `条件必填字段 "${reqField}" 缺失（allOf[${idx}] else 分支）`,
            });
          }
        });
      }
    });
  }
}

/**
 * 解析生效的 responseMapping：本地声明优先，否则继承 datasources[ref] 的预声明映射。
 */
function getEffectiveResponseMapping(node, doc) {
  const { data } = node;
  if (!data || !['api', 'ref'].includes(data.source)) return undefined;

  // 本地声明优先
  if (data.responseMapping !== undefined) {
    return data.responseMapping;
  }

  // source: ref 时继承 datasources 上的预声明映射
  if (data.source === 'ref' && data.ref && doc && doc.datasources && doc.datasources[data.ref]) {
    return doc.datasources[data.ref].responseMapping;
  }

  return undefined;
}

/**
 * responseMapping 语义规则（ADR-0005 + 04-datasource-contract.md §4.1.1）
 *
 * 规则：
 *   - table 与 chart 是数组消费类接口；使用 API / ref 的生效映射存在时必须有 list。
 *     其他 supportsData 组件（statCard / text）是单值/聚合数据，不强制要求 list。
 *   - table.props.pagination.mode === 'server' 时，若生效映射存在，则必须有 responseMapping.total。
 *
 * 生效映射解析顺序：本地 data.responseMapping 优先，否则继承 doc.datasources[data.ref].responseMapping。
 */
function validateStaticDataShape(node, type, nodePath, doc, violations) {
  if (!node?.data || !['static', 'ref'].includes(node.data.source)) return;
  let value;
  if (node.data.source === 'static') {
    value = node.data.value;
  } else {
    const target = doc.datasources?.[node.data.ref];
    if (!target || target.source !== 'static') return;
    value = target.value;
  }
  if (type === 'table' || type === 'chart') {
    if (!Array.isArray(value)) {
      violations.push({ path: `${nodePath}.data.value`, message: `${type} 的 static/ref 数据必须是数组` });
    }
    return;
  }
  if (type === 'statCard' || type === 'text') {
    if (value === null || Array.isArray(value)
      || (typeof value !== 'object' && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')) {
      violations.push({ path: `${nodePath}.data.value`, message: `${type} 的 static/ref 数据必须是标量或 JSON object` });
      return;
    }
    if (node.props?.valueField && (!value || typeof value !== 'object' || Array.isArray(value)
      || !Object.prototype.hasOwnProperty.call(value, node.props.valueField))) {
      violations.push({ path: `${nodePath}.props.valueField`, message: `${type}.valueField 不存在于 static/ref 数据对象中` });
    }
  }
}
function validateResponseMapping(node, type, compDef, nodePath, violations, doc) {
  const { data, props = {} } = node;
  if (!data || !['api', 'ref'].includes(data.source)) return;

  const effectiveRm = getEffectiveResponseMapping(node, doc);

  if ((type === 'statCard' || type === 'text') && effectiveRm !== undefined) {
    violations.push({
      path: `${nodePath}.data.responseMapping`,
      message: `${type} 不支持 responseMapping；请使用 props.valueField（ADR-0005）`,
    });
  }

  // 数组消费类接口：table / chart 的生效映射存在时必须有 list
  if ((type === 'table' || type === 'chart') && effectiveRm !== undefined && !effectiveRm?.list) {
    violations.push({
      path: `${nodePath}.data.responseMapping.list`,
      message: `${type} 组件使用 API/ref 数据且生效的 responseMapping 存在时，必须提供 responseMapping.list（本地或继承）`,
    });
  }

  // table 服务端分页：生效映射存在时必须有 total
  if (type === 'table' && props.pagination && props.pagination.mode === 'server') {
    if (effectiveRm !== undefined && !effectiveRm?.total) {
      violations.push({
        path: `${nodePath}.data.responseMapping.total`,
        message: 'table 使用 pagination.mode=server 且生效的 responseMapping 存在时，必须在 responseMapping 中声明 total（本地或继承）',
      });
    }
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function extractUrlPathParams(url) {
  if (typeof url !== 'string') return [];
  return Array.from(url.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g), match => match[1]);
}

function hasInvalidUrlTemplate(url) {
  if (typeof url !== 'string') return false;
  return url.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '').includes('{')
    || url.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '').includes('}');
}

function hasNonEmptyRequestMapping(mapping) {
  if (!isPlainObject(mapping)) return false;
  return ['path', 'query', 'body'].some(section =>
    isPlainObject(mapping[section]) && Object.keys(mapping[section]).length > 0,
  );
}

const ROW_REF_PATTERN = /^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
const ROUTE_REF_PATTERN = /^\$context\.route\.(query|params)\.([A-Za-z_][A-Za-z0-9_]*)$/;

function validateFlatMappingValues(mappingSection, sectionPath, violations, options) {
  const {
    label,
    variableMessage,
    variablePattern,
    allowVariables = true,
  } = options;
  if (mappingSection === undefined) return;
  if (!isPlainObject(mappingSection)) {
    violations.push({ path: sectionPath, message: `${label} 的 path/query/body 段必须是对象` });
    return;
  }

  for (const [mappingKey, mappingValue] of Object.entries(mappingSection)) {
    const valuePath = `${sectionPath}.${mappingKey}`;
    if (mappingKey.length === 0 || !isValidUnicodeScalarString(mappingKey)) {
      violations.push({ path: valuePath, message: `${label} key 必须是非空且合法的 Unicode scalar 字符串` });
    }
    const valueType = mappingValue === null ? 'null' : Array.isArray(mappingValue) ? 'array' : typeof mappingValue;
    if (!['string', 'number', 'boolean', 'null'].includes(valueType) || (typeof mappingValue === 'number' && !Number.isFinite(mappingValue))) {
      violations.push({
        path: valuePath,
        message: `${label} 必须是扁平 key-value map；值只能是 string/finite number/boolean/null 或单个允许的上下文引用，实际为 ${valueType}`,
      });
      continue;
    }
    if (typeof mappingValue === 'string') {
      if (!isValidUnicodeScalarString(mappingValue)) {
        violations.push({
          path: valuePath,
          message: `${label} 字符串值必须是合法的 Unicode scalar 字符串`,
        });
        continue;
      }
      if (mappingValue.includes('$')) {
        if (!allowVariables || !variablePattern.test(mappingValue)) {
          violations.push({
            path: valuePath,
            message: variableMessage,
          });
          continue;
        }
        const rowRefMatch = ROW_REF_PATTERN.exec(mappingValue);
        if (rowRefMatch && rowRefMatch[1].split('.').some(segment => RESERVED_ROW_PATH_SEGMENTS.has(segment))) {
          violations.push({
            path: valuePath,
            message: `${label} 不允许通过 $row.* 读取原型链保留路径 __proto__、prototype 或 constructor`,
          });
        }
      }
    }
  }
}

function validateRequestMappingValues(mappingSection, sectionPath, violations) {
  validateFlatMappingValues(mappingSection, sectionPath, violations, {
    label: 'requestMapping',
    variablePattern: ROW_REF_PATTERN,
    variableMessage: '行级 requestMapping 仅允许单个 $row.* 点路径引用；静态拒绝 $parentRow.*，也不得使用 $deps.*、$context.*、模板拼接或表达式',
  });
}

function validateNavigateMappingValues(mappingSection, sectionPath, violations) {
  validateFlatMappingValues(mappingSection, sectionPath, violations, {
    label: 'navigateMapping',
    variablePattern: ROW_REF_PATTERN,
    variableMessage: '行级 navigateMapping 仅允许单个 $row.* 点路径引用；不得使用 $deps.*、$context.*、模板拼接或表达式',
  });
}

function validateRecordSourceMappingValues(mappingSection, sectionPath, violations) {
  validateFlatMappingValues(mappingSection, sectionPath, violations, {
    label: 'recordSource',
    variablePattern: ROUTE_REF_PATTERN,
    variableMessage: 'recordSource.path/query 值仅允许字面量或单个 $context.route.query.* / $context.route.params.* 引用',
  });
}

function hasNonEmptyNavigateMapping(mapping) {
  if (!isPlainObject(mapping)) return false;
  return ['path', 'query'].some(section =>
    isPlainObject(mapping[section]) && Object.keys(mapping[section]).length > 0,
  );
}

function validatePathPlaceholderBinding(url, mappingPath, mappingPathField, actionPath, violations) {
  if (hasInvalidUrlTemplate(url)) {
    violations.push({
      path: `${actionPath}.url`,
      message: 'url 路径参数只允许完整的 {identifier} 占位符；禁止空、数字开头、连字符、嵌套、孤立或未闭合花括号',
    });
    return;
  }
  const placeholders = new Set(extractUrlPathParams(url));
  const pathMapping = isPlainObject(mappingPath) ? mappingPath : {};
  for (const placeholder of placeholders) {
    if (pathMapping[placeholder] === undefined) {
      violations.push({
        path: `${mappingPathField}.${placeholder}`,
        message: `url 中的路径参数 {${placeholder}} 必须在映射 path 中声明`,
      });
    }
  }
  for (const mappingKey of Object.keys(pathMapping)) {
    if (!placeholders.has(mappingKey)) {
      violations.push({
        path: `${mappingPathField}.${mappingKey}`,
        message: `path.${mappingKey} 没有对应的 url 路径参数 {${mappingKey}}`,
      });
    }
  }
}

function validateActionUrls(doc, violations) {
  if (!isPlainObject(doc.actions)) return;
  for (const [actionId, action] of Object.entries(doc.actions)) {
    if (!isPlainObject(action)) continue;
    if (action.url !== undefined) {
      validateProtocolUrl(action.url, `actions.${actionId}.url`, violations);
    }
    for (const behaviorName of ['onSuccess', 'onError']) {
      const behavior = action[behaviorName];
      if (behavior?.behavior === 'navigate' && behavior.url !== undefined) {
        validateProtocolUrl(behavior.url, `actions.${actionId}.${behaviorName}.url`, violations);
      }
    }
  }
}

function validateRowRequestAction(rowAction, rowActionPath, actionDef, actionPath, violations) {
  if (rowAction.navigateMapping !== undefined) {
    violations.push({
      path: `${rowActionPath}.navigateMapping`,
      message: 'type: request 的 RowAction 不得声明 navigateMapping',
    });
  }
  if (!hasNonEmptyRequestMapping(rowAction.requestMapping)) {
    violations.push({
      path: `${rowActionPath}.requestMapping`,
      message: 'RowAction.actionRef 引用 type: request 时必须同时声明非空 requestMapping，以显式绑定当前行数据',
    });
    return;
  }

  const mapping = rowAction.requestMapping;
  validateRequestMappingValues(mapping.path, `${rowActionPath}.requestMapping.path`, violations);
  validateRequestMappingValues(mapping.query, `${rowActionPath}.requestMapping.query`, violations);
  validateRequestMappingValues(mapping.body, `${rowActionPath}.requestMapping.body`, violations);
  validatePathPlaceholderBinding(
    actionDef.url,
    mapping.path,
    `${rowActionPath}.requestMapping.path`,
    actionPath,
    violations,
  );

  if (['GET', 'DELETE'].includes(actionDef.method) && isPlainObject(mapping.body) && Object.keys(mapping.body).length > 0) {
    violations.push({
      path: `${rowActionPath}.requestMapping.body`,
      message: `${actionDef.method} 行级请求不得声明 body；请使用 path 或 query 传递当前行标识`,
    });
  }
}

function validateRowNavigateAction(rowAction, rowActionPath, actionDef, actionPath, violations) {
  if (rowAction.requestMapping !== undefined) {
    violations.push({
      path: `${rowActionPath}.requestMapping`,
      message: 'type: navigate 的 RowAction 不得声明 requestMapping；请使用 navigateMapping',
    });
  }
  if (!hasNonEmptyNavigateMapping(rowAction.navigateMapping)) {
    violations.push({
      path: `${rowActionPath}.navigateMapping`,
      message: 'RowAction.actionRef 引用 type: navigate 时必须同时声明非空 navigateMapping（path 与/或 query）',
    });
    return;
  }
  if (rowAction.navigateMapping && rowAction.navigateMapping.body !== undefined) {
    violations.push({
      path: `${rowActionPath}.navigateMapping.body`,
      message: 'navigateMapping 不得声明 body',
    });
  }

  const mapping = rowAction.navigateMapping;
  validateNavigateMappingValues(mapping.path, `${rowActionPath}.navigateMapping.path`, violations);
  validateNavigateMappingValues(mapping.query, `${rowActionPath}.navigateMapping.query`, violations);
  validatePathPlaceholderBinding(
    actionDef.url,
    mapping.path,
    `${rowActionPath}.navigateMapping.path`,
    actionPath,
    violations,
  );
  if (actionDef.url !== undefined) {
    validateProtocolUrl(actionDef.url, `${actionPath}.url`, violations);
  }
}

const SELECTION_KEYS = '$selection.keys';
const SELECTION_COUNT = '$selection.count';

function validateBatchMappingValues(mappingSection, sectionPath, sectionName, violations) {
  if (mappingSection === undefined) return;
  if (!isPlainObject(mappingSection)) {
    violations.push({ path: sectionPath, message: 'batchMapping 的 path/query/body 必须是对象' });
    return;
  }
  for (const [mappingKey, mappingValue] of Object.entries(mappingSection)) {
    const valuePath = `${sectionPath}.${mappingKey}`;
    if (mappingKey.length === 0 || !isValidUnicodeScalarString(mappingKey)) {
      violations.push({ path: valuePath, message: 'batchMapping key 必须是非空且合法的 Unicode scalar 字符串' });
    }
    if (mappingValue === SELECTION_KEYS) {
      if (sectionName !== 'body') {
        violations.push({
          path: valuePath,
          message: '$selection.keys 仅允许作为 batchMapping.body 某字段的整值（ADR-0022 OQ-22-2）',
        });
      }
      continue;
    }
    if (mappingValue === SELECTION_COUNT) {
      if (sectionName === 'path') {
        violations.push({
          path: valuePath,
          message: '$selection.count 不得用于 batchMapping.path',
        });
      }
      continue;
    }
    const valueType = mappingValue === null ? 'null' : Array.isArray(mappingValue) ? 'array' : typeof mappingValue;
    if (!['string', 'number', 'boolean', 'null'].includes(valueType)
      || (typeof mappingValue === 'number' && !Number.isFinite(mappingValue))) {
      violations.push({
        path: valuePath,
        message: `batchMapping 值只能是字面量、$selection.keys（仅 body）或 $selection.count（query/body），实际为 ${valueType}`,
      });
      continue;
    }
    if (typeof mappingValue === 'string' && mappingValue.includes('$')) {
      violations.push({
        path: valuePath,
        message: 'batchMapping 字符串中含 $ 时必须整段为 $selection.keys 或 $selection.count；禁止模板拼接与其它变量',
      });
    }
  }
}

function validateBatchMapping(trigger, triggerPath, actionDef, actionRef, violations) {
  const mapping = trigger.batchMapping;
  if (!isPlainObject(mapping)) {
    violations.push({ path: `${triggerPath}.batchMapping`, message: 'batchMapping 必须是对象' });
    return;
  }
  if (actionDef.type !== 'request') {
    violations.push({
      path: `${triggerPath}.batchMapping`,
      message: 'batchMapping 仅可用于 actionRef 指向 type: request 的 Trigger',
    });
    return;
  }
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(actionDef.method)) {
    violations.push({
      path: `${triggerPath}.actionRef`,
      message: `批量 request 不得使用 method "${actionDef.method}"；仅允许 POST/PUT/PATCH/DELETE`,
    });
  }
  const hasAny = ['path', 'query', 'body'].some(
    section => isPlainObject(mapping[section]) && Object.keys(mapping[section]).length > 0,
  );
  if (!hasAny) {
    violations.push({
      path: `${triggerPath}.batchMapping`,
      message: 'batchMapping 必须至少声明非空 path、query 或 body 之一',
    });
  }
  validateBatchMappingValues(mapping.path, `${triggerPath}.batchMapping.path`, 'path', violations);
  validateBatchMappingValues(mapping.query, `${triggerPath}.batchMapping.query`, 'query', violations);
  validateBatchMappingValues(mapping.body, `${triggerPath}.batchMapping.body`, 'body', violations);
  if (actionDef.url !== undefined) {
    validateProtocolUrl(actionDef.url, `actions.${actionRef}.url`, violations);
    validatePathPlaceholderBinding(
      actionDef.url,
      mapping.path,
      `${triggerPath}.batchMapping.path`,
      `actions.${actionRef}`,
      violations,
    );
  }
}

/**
 * @param {object} options
 * @param {boolean} [options.tableToolbar] - Trigger is on table.toolbar
 * @param {boolean} [options.hasTableSelection] - parent table declares selection
 */
function validateActionTrigger(trigger, triggerPath, actions, violations, options = {}) {
  const tableToolbar = options.tableToolbar === true;
  const hasTableSelection = options.hasTableSelection === true;
  if (!isPlainObject(trigger)) return;
  if (typeof trigger.key !== 'string' || trigger.key.length === 0) {
    violations.push({ path: `${triggerPath}.key`, message: 'ActionTrigger.key 必填且必须为非空字符串' });
  }
  if (trigger.label === undefined && trigger.labelKey === undefined) {
    violations.push({ path: triggerPath, message: 'ActionTrigger 必须提供 label 或 labelKey' });
  }
  if (trigger.requiresSelection === true && !tableToolbar) {
    violations.push({
      path: `${triggerPath}.requiresSelection`,
      message: 'requiresSelection 仅允许在 table.props.toolbar 上声明（ADR-0022）',
    });
  }
  if (trigger.requiresSelection === true && tableToolbar && !hasTableSelection) {
    violations.push({
      path: `${triggerPath}.requiresSelection`,
      message: 'requiresSelection: true 要求同一 table 声明 props.selection.mode: multiple（ADR-0022）',
    });
  }
  if (trigger.batchMapping !== undefined && !tableToolbar) {
    violations.push({
      path: `${triggerPath}.batchMapping`,
      message: 'batchMapping 仅允许在 table.props.toolbar 上声明（ADR-0022）',
    });
  }
  // V269: batchMapping requires a protocol selection model on the same table.
  // requiresSelection remains optional (runtime EMPTY_SELECTION still rejects count===0).
  if (trigger.batchMapping !== undefined && tableToolbar && !hasTableSelection) {
    violations.push({
      path: `${triggerPath}.batchMapping`,
      message: 'batchMapping 要求同一 table 声明 props.selection.mode: multiple（ADR-0022 / V269）',
    });
  }
  const actionRef = trigger.actionRef;
  if (typeof actionRef !== 'string') {
    violations.push({ path: `${triggerPath}.actionRef`, message: 'ActionTrigger.actionRef 必填且必须为字符串' });
    return;
  }
  const actionDef = actions[actionRef];
  if (!actionDef) {
    violations.push({
      path: `${triggerPath}.actionRef`,
      message: `ActionTrigger.actionRef 引用了不存在的顶层 action "${actionRef}"`,
    });
    return;
  }
  if (!['request', 'navigate', 'modal'].includes(actionDef.type)) {
    violations.push({
      path: `${triggerPath}.actionRef`,
      message: `ActionTrigger.actionRef 仅可引用 type: request|navigate|modal，当前为 "${actionDef.type}"`,
    });
    return;
  }
  if (trigger.batchMapping !== undefined) {
    validateBatchMapping(trigger, triggerPath, actionDef, actionRef, violations);
    return;
  }
  if (actionDef.type === 'request') {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(actionDef.method)) {
      violations.push({
        path: `${triggerPath}.actionRef`,
        message: `页面级 ActionTrigger 引用的 request 不得使用 method "${actionDef.method}"；仅允许 POST/PUT/PATCH/DELETE（ADR-0020 OQ-20-1）`,
      });
    }
    if (actionDef.url !== undefined) {
      validateProtocolUrl(actionDef.url, `actions.${actionRef}.url`, violations);
      if (/[{}]/.test(actionDef.url || '')) {
        violations.push({
          path: `actions.${actionRef}.url`,
          message: '页面级 ActionTrigger 引用的 request URL 不得包含未绑定的路径模板',
        });
      }
    }
  }
  if (actionDef.type === 'navigate' && actionDef.url !== undefined) {
    validateProtocolUrl(actionDef.url, `actions.${actionRef}.url`, violations);
  }
}

function validateRecordSource(formNode, nodePath, violations) {
  const recordSource = formNode.props?.recordSource;
  if (recordSource === undefined) return;
  if (formNode.props?.mode === 'search') {
    violations.push({
      path: `${nodePath}.props.recordSource`,
      message: 'mode: search 的 form 禁止声明 recordSource',
    });
    return;
  }
  if (!isPlainObject(recordSource)) {
    violations.push({ path: `${nodePath}.props.recordSource`, message: 'recordSource 必须是对象' });
    return;
  }
  if (recordSource.method !== 'GET') {
    violations.push({
      path: `${nodePath}.props.recordSource.method`,
      message: 'recordSource.method 只允许 GET',
    });
  }
  if (typeof recordSource.url !== 'string') {
    violations.push({ path: `${nodePath}.props.recordSource.url`, message: 'recordSource.url 必填' });
  } else {
    validateProtocolUrl(recordSource.url, `${nodePath}.props.recordSource.url`, violations);
  }
  if (!isPlainObject(recordSource.responseMapping) || Object.keys(recordSource.responseMapping).length === 0) {
    violations.push({
      path: `${nodePath}.props.recordSource.responseMapping`,
      message: 'recordSource.responseMapping 必填且必须为非空对象（ADR-0021 OQ-21-1）',
    });
  } else {
    for (const [field, pathExpr] of Object.entries(recordSource.responseMapping)) {
      if (typeof field !== 'string' || field.length === 0 || typeof pathExpr !== 'string' || pathExpr.length === 0) {
        violations.push({
          path: `${nodePath}.props.recordSource.responseMapping.${field}`,
          message: 'responseMapping 的键与值必须是非空字符串（form field → 响应点路径）',
        });
      }
    }
  }
  if (recordSource.ref !== undefined || recordSource.source !== undefined) {
    violations.push({
      path: `${nodePath}.props.recordSource`,
      message: 'recordSource 不得引用 datasources ref；MVP 仅允许内联 url（ADR-0021 OQ-21-2）',
    });
  }
  validateRecordSourceMappingValues(recordSource.path, `${nodePath}.props.recordSource.path`, violations);
  validateRecordSourceMappingValues(recordSource.query, `${nodePath}.props.recordSource.query`, violations);
  if (typeof recordSource.url === 'string') {
    validatePathPlaceholderBinding(
      recordSource.url,
      recordSource.path,
      `${nodePath}.props.recordSource.path`,
      `${nodePath}.props.recordSource`,
      violations,
    );
  }
}

function validateRowActionRefs(doc, violations) {
  const actions = isPlainObject(doc.actions) ? doc.actions : {};

  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'table' && node.props) {
      // Only mode: multiple counts as a usable selection model (V269).
      const hasTableSelection = isPlainObject(node.props.selection)
        && node.props.selection.mode === 'multiple';
      if (node.props.selection !== undefined) {
        if (!isPlainObject(node.props.selection) || node.props.selection.mode !== 'multiple') {
          violations.push({
            path: `${nodePath}.props.selection.mode`,
            message: 'table.props.selection.mode 仅允许 "multiple"（ADR-0022）',
          });
        }
      }
      if (Array.isArray(node.props.toolbar)) {
        const toolbarKeys = new Set();
        node.props.toolbar.forEach((trigger, index) => {
          const triggerPath = `${nodePath}.props.toolbar[${index}]`;
          if (trigger && typeof trigger.key === 'string') {
            if (toolbarKeys.has(trigger.key)) {
              violations.push({
                path: `${triggerPath}.key`,
                message: `table.toolbar 内 key "${trigger.key}" 重复`,
              });
            }
            toolbarKeys.add(trigger.key);
          }
          validateActionTrigger(trigger, triggerPath, actions, violations, {
            tableToolbar: true,
            hasTableSelection,
          });
        });
      }

      if (Array.isArray(node.props.actions)) {
        node.props.actions.forEach((rowAction, rowActionIndex) => {
          if (!rowAction) return;

          const rowActionPath = `${nodePath}.props.actions[${rowActionIndex}]`;
          if (rowAction.requestMapping !== undefined && rowAction.actionRef === undefined) {
            violations.push({
              path: `${rowActionPath}.requestMapping`,
              message: 'RowAction.requestMapping 只能与 actionRef 一起使用；本地 handler 模式不接受 requestMapping',
            });
          }
          if (rowAction.navigateMapping !== undefined && rowAction.actionRef === undefined) {
            violations.push({
              path: `${rowActionPath}.navigateMapping`,
              message: 'RowAction.navigateMapping 只能与 actionRef 一起使用',
            });
          }

          if (rowAction.actionRef === undefined) return;

          const actionRef = rowAction.actionRef;
          if (typeof actionRef !== 'string') return;

          const actionDef = actions[actionRef];
          if (!actionDef) {
            violations.push({
              path: `${rowActionPath}.actionRef`,
              message: `RowAction.actionRef 引用了不存在的顶层 action "${actionRef}"`,
            });
            return;
          }

          if (actionDef.type === 'request') {
            validateRowRequestAction(rowAction, rowActionPath, actionDef, `actions.${actionRef}`, violations);
            return;
          }
          if (actionDef.type === 'navigate') {
            validateRowNavigateAction(rowAction, rowActionPath, actionDef, `actions.${actionRef}`, violations);
            return;
          }

          violations.push({
            path: `${rowActionPath}.actionRef`,
            message: `RowAction.actionRef 仅可引用 type: request 或 type: navigate，当前为 "${actionDef.type}"`,
          });
        });
      }
    }

    if (node.type === 'actionButton' && node.props) {
      validateActionTrigger(node.props, `${nodePath}.props`, actions, violations);
    }

    if (node.type === 'form' && node.props) {
      validateRecordSource(node, nodePath, violations);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child, childIndex) => scanNode(child, `${nodePath}.children[${childIndex}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, itemIndex) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${itemIndex}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');

  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

function collectFormFields(formNode, formPath, violations) {
  const fields = new Map();
  const fieldTypes = new Set(['input', 'inputNumber', 'datePicker', 'upload', 'select']);

  const addField = (name, nodePath, ownerType, propName) => {
    if (typeof name !== 'string' || name.length === 0) {
      violations.push({
        path: `${nodePath}.props.${propName}`,
        message: '表单字段名必须是非空字符串',
      });
      return;
    }
    if (fields.has(name)) {
      violations.push({
        path: `${nodePath}.props.${propName}`,
        message: `表单字段名 "${name}" 与 ${fields.get(name).path} 冲突`,
      });
      return;
    }
    fields.set(name, { path: `${nodePath}.props.${propName}`, ownerType });
  };

  const scan = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    if (node !== formNode && node.type === 'form') return;
    if (fieldTypes.has(node.type)) addField(node.props?.field, nodePath, node.type, 'field');
    if (node.type === 'dateRangePicker') {
      addField(node.props?.startField, nodePath, node.type, 'startField');
      addField(node.props?.endField, nodePath, node.type, 'endField');
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => scan(child, `${nodePath}.children[${index}]`));
    }
    if (Array.isArray(node.props?.items)) {
      node.props.items.forEach((item, index) => {
        if (item?.content) scan(item.content, `${nodePath}.props.items[${index}].content`);
      });
    }
  };

  scan(formNode, formPath);
  return fields;
}

function validateFormFieldBindings(node, nodePath, doc, violations) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'form' && node.props?.mode !== 'search') {
    const fields = collectFormFields(node, nodePath, violations);
    const actionId = node.props?.submitAction;
    const action = typeof actionId === 'string' ? doc.actions?.[actionId] : undefined;
    if (action?.type === 'request' && isPlainObject(action.bodyMapping)) {
      const targets = new Map();
      for (const [source, target] of Object.entries(action.bodyMapping)) {
        if (!fields.has(source)) {
          violations.push({
            path: `actions.${actionId}.bodyMapping.${source}`,
            message: `bodyMapping source "${source}" 不属于提交 form 的字段命名空间`,
          });
        }
        if (targets.has(target)) {
          violations.push({
            path: `actions.${actionId}.bodyMapping.${source}`,
            message: `bodyMapping target "${target}" 与 source "${targets.get(target)}" 冲突，目标字段必须唯一`,
          });
        } else {
          targets.set(target, source);
        }
      }
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => validateFormFieldBindings(child, `${nodePath}.children[${index}]`, doc, violations));
  }
  if (Array.isArray(node.props?.items)) {
    node.props.items.forEach((item, index) => {
      if (item?.content) validateFormFieldBindings(item.content, `${nodePath}.props.items[${index}].content`, doc, violations);
    });
  }
}

function validateModalFormFieldBindings(doc, violations) {
  if (!isPlainObject(doc.actions)) return;
  for (const [actionId, action] of Object.entries(doc.actions)) {
    if (action?.type === 'modal' && action.content) {
      validateFormFieldBindings(action.content, `actions.${actionId}.content`, doc, violations);
    }
  }
}

/**
 * 校验页面级 action 引用完整性（V85）
 *
 * 规则：
 *   - form.props.submitAction 必须存在于 doc.actions；request action 不得使用 GET
 *   - upload.props.actionRef 必须存在于 doc.actions，且 type 必须为 upload
 */
function validatePageActionRefs(doc, violations) {
  const actions = isPlainObject(doc.actions) ? doc.actions : {};

  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;

    // --- form.props.submitAction ---
    if (
      node.type === 'form'
      && node.props
      && node.props.mode !== 'search'
      && node.props.submitAction !== undefined
    ) {
      const submitAction = node.props.submitAction;
      if (typeof submitAction === 'string') {
        const actionDef = actions[submitAction];
        if (!actionDef) {
          violations.push({
            path: `${nodePath}.props.submitAction`,
            message: `submitAction 引用了不存在的顶层 action "${submitAction}"`,
          });
        } else if (actionDef.type === 'request' && actionDef.method === 'GET') {
          violations.push({
            path: `${nodePath}.props.submitAction`,
            message: `普通表单 submitAction 不得引用 GET request "${submitAction}"；表单字段按 JSON 请求体提交，请使用 POST、PUT、PATCH 或 DELETE`,
          });
        } else if (actionDef.type === 'request' && /[{}]/.test(actionDef.url || '')) {
          violations.push({
            path: `actions.${submitAction}.url`,
            message: '普通表单 request Action URL 不得包含未绑定的路径模板；URL 模板仅可用于 RowAction.actionRef',
          });
        }
      }
    }

    // --- upload.props.actionRef ---
    if (node.type === 'upload' && node.props && node.props.actionRef !== undefined) {
      const actionRef = node.props.actionRef;
      if (typeof actionRef === 'string') {
        const actionDef = actions[actionRef];
        if (!actionDef) {
          violations.push({
            path: `${nodePath}.props.actionRef`,
            message: `upload.props.actionRef 引用了不存在的顶层 action "${actionRef}"`,
          });
        } else if (actionDef.type !== 'upload') {
          violations.push({
            path: `${nodePath}.props.actionRef`,
            message: `upload.props.actionRef 仅可引用 type: upload 的 action，当前为 "${actionDef.type}"`,
          });
        } else {
          for (const constraint of ['accept', 'maxSize', 'multiple']) {
            if (node.props[constraint] !== undefined) {
              violations.push({
                path: `${nodePath}.props.${constraint}`,
                message: `使用 actionRef 时 ${constraint} 只能在被引用的 upload action 中声明，避免组件与 Action 约束冲突`,
              });
            }
          }
        }
      }
    }

    if (node.type === 'dateRangePicker' && Array.isArray(node.reactions)) {
      node.reactions.forEach((reaction, reactionIndex) => {
        for (const branch of ['fulfill', 'otherwise']) {
          if (reaction?.[branch] && Object.prototype.hasOwnProperty.call(reaction[branch], 'value')) {
            violations.push({
              path: `${nodePath}.reactions[${reactionIndex}].${branch}.value`,
              message: 'v0.2 的 dateRangePicker 有 startField/endField 两个字段，reactions 不支持 value 写入；仅允许 visible、required、disabled',
            });
          }
        }
      });
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child, childIndex) => scanNode(child, `${nodePath}.children[${childIndex}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, itemIndex) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${itemIndex}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

/**
 * 校验 data.ref / targetTable 引用存在性（V86）
 *
 * 规则：
 *   - data.source: ref 时，data.ref 必须存在于 doc.datasources
 *   - form.mode: search 的 targetTable 必须在页面 Node 树中存在 id 匹配且 type: table 的节点
 */
function validateDataRefsAndTargetTable(doc, violations) {
  const datasources = isPlainObject(doc.datasources) ? doc.datasources : {};

  for (const [datasourceKey, datasource] of Object.entries(datasources)) {
    if (!isPlainObject(datasource) || datasource.source !== 'api') continue;
    if (datasource.method !== undefined && datasource.method !== 'GET') {
      violations.push({
        path: `datasources.${datasourceKey}.method`,
        message: '页面级 DataRef 只允许 GET；写操作必须使用 Action（DATA_REF_METHOD_NOT_READ_ONLY）',
      });
    }
    if (datasource.url !== undefined) {
      validateProtocolUrl(datasource.url, `datasources.${datasourceKey}.url`, violations);
    }
  }

  // First pass：收集 Node 树中所有 id → { type, path }，并检测重复
  const nodeIds = new Map();

  const collectIds = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'string') {
      if (nodeIds.has(node.id)) {
        violations.push({
          path: `${nodePath}.id`,
          message: `重复的 Node id "${node.id}"（首次出现于 ${nodeIds.get(node.id).path}）`,
        });
      } else {
        nodeIds.set(node.id, { type: node.type, path: nodePath, node });
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, childIndex) => collectIds(child, `${nodePath}.children[${childIndex}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, itemIndex) => {
        if (item && item.content) {
          collectIds(item.content, `${nodePath}.props.items[${itemIndex}].content`);
        }
      });
    }
  };

  if (doc.body) collectIds(doc.body, 'body');

  // 也收集 modal content 中的 id
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        collectIds(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }

  // Second pass：校验引用
  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;

    // --- data.source: ref → data.ref 必须存在于 doc.datasources ---
    if (node.data && node.data.source === 'ref' && node.data.ref !== undefined) {
      const ref = node.data.ref;
      if (typeof ref === 'string') {
        const targetDatasource = datasources[ref];
        if (!targetDatasource) {
          violations.push({
            path: `${nodePath}.data.ref`,
            message: `data.ref 引用了不存在的 datasource "${ref}"`,
          });
        } else if (targetDatasource.source === 'static' && node.data.responseMapping !== undefined) {
          violations.push({
            path: `${nodePath}.data.responseMapping`,
            message: `data.ref 引用静态 datasource "${ref}" 时不得声明 responseMapping；响应映射仅适用于 API 数据源`,
          });
        }
      }
    }

    // --- form.mode: search → targetTable 必须存在于 Node 树 ---
    if (node.type === 'form' && node.props && node.props.mode === 'search' && node.props.targetTable !== undefined) {
      const targetTable = node.props.targetTable;
      if (typeof targetTable === 'string') {
        const targetNode = nodeIds.get(targetTable);
        if (!targetNode) {
          violations.push({
            path: `${nodePath}.props.targetTable`,
            message: `targetTable "${targetTable}" 在页面 Node 树中不存在`,
          });
        } else if (targetNode.type !== 'table') {
          violations.push({
            path: `${nodePath}.props.targetTable`,
            message: `targetTable "${targetTable}" 的节点类型为 "${targetNode.type}"，期望 "table"`,
          });
        } else {
          const targetData = targetNode.node.data;
          const effectiveDatasource = targetData?.source === 'ref'
            ? datasources[targetData.ref]
            : targetData;
          if (!effectiveDatasource || effectiveDatasource.source !== 'api') {
            violations.push({
              path: `${nodePath}.props.targetTable`,
              message: `targetTable "${targetTable}" 必须具有有效 API 数据源（内联 source: api，或 source: ref 指向 API datasource）`,
            });
          }
        }
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child, childIndex) => scanNode(child, `${nodePath}.children[${childIndex}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, itemIndex) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${itemIndex}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

function validateRequiredCapabilities(doc, violations) {
  const declared = new Set(
    Array.isArray(doc?.meta?.requiredCapabilities) ? doc.meta.requiredCapabilities : [],
  );

  const requireCapability = (capability, path, reason) => {
    if (declared.has(capability)) return;
    violations.push({
      path: 'meta.requiredCapabilities',
      message: `${path} 使用 ${reason}，必须声明能力 "${capability}"`,
    });
  };

  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'upload') {
        requireCapability('actions.upload', `actions.${actionId}`, 'upload action');
      }
    }
  }

  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'upload' && node.props && node.props.actionRef !== undefined) {
      requireCapability('actions.upload', `${nodePath}.props.actionRef`, 'upload.props.actionRef');
    }
    if (node.type === 'actionButton') {
      requireCapability('actions.page.trigger', `${nodePath}`, 'actionButton');
    }
    if (node.type === 'form' && node.props && node.props.recordSource !== undefined) {
      requireCapability('form.record.load', `${nodePath}.props.recordSource`, 'form.props.recordSource');
    }
    if (node.type === 'table' && node.props) {
      if (node.props.selection !== undefined) {
        requireCapability('table.selection', `${nodePath}.props.selection`, 'table.props.selection');
      }
      if (Array.isArray(node.props.toolbar) && node.props.toolbar.length > 0) {
        requireCapability('actions.page.trigger', `${nodePath}.props.toolbar`, 'table.props.toolbar');
        node.props.toolbar.forEach((trigger, index) => {
          if (trigger && trigger.batchMapping !== undefined) {
            requireCapability(
              'actions.batch.request',
              `${nodePath}.props.toolbar[${index}].batchMapping`,
              'toolbar batchMapping',
            );
          }
          if (trigger && trigger.requiresSelection === true) {
            requireCapability(
              'table.selection',
              `${nodePath}.props.toolbar[${index}].requiresSelection`,
              'toolbar requiresSelection',
            );
          }
        });
      }
      if (Array.isArray(node.props.actions)) {
        const actions = isPlainObject(doc.actions) ? doc.actions : {};
        node.props.actions.forEach((rowAction, rowActionIndex) => {
          if (!rowAction || rowAction.actionRef === undefined) return;
          const actionDef = actions[rowAction.actionRef];
          if (actionDef && actionDef.type === 'navigate') {
            requireCapability(
              'actions.row.navigate',
              `${nodePath}.props.actions[${rowActionIndex}].actionRef`,
              'RowAction.actionRef → navigate',
            );
          } else {
            requireCapability(
              'actions.row.request',
              `${nodePath}.props.actions[${rowActionIndex}].actionRef`,
              'RowAction.actionRef → request',
            );
          }
        });
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, idx) => scanNode(child, `${nodePath}.children[${idx}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, idx) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${idx}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');

  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

/**
 * 校验 params.responseMapping 禁令（ADR-0005 D1）
 *
 * responseMapping 属于响应解析配置，不属于请求参数。
 * 禁止出现在 data.params 或 datasources.*.params 中。
 *
 * 扫描范围：
 *   - body 及子树中所有节点的 data.params.responseMapping
 *   - 顶层 datasources 中所有声明的 datasources.*.params.responseMapping
 */
function validateParamsResponseMappingBan(doc, violations) {
  if (!doc || typeof doc !== 'object') return;

  // 扫描顶层 datasources 中的 params.responseMapping
  if (isPlainObject(doc.datasources)) {
    for (const [dsKey, dsDef] of Object.entries(doc.datasources)) {
      if (isPlainObject(dsDef) && isPlainObject(dsDef.params) && dsDef.params.responseMapping !== undefined) {
        violations.push({
          path: `datasources.${dsKey}.params.responseMapping`,
          message: 'responseMapping 禁止放入 params——它不属于请求参数，应声明在 datasources 顶级字段中',
        });
      }
    }
  }

  // 扫描节点树中的 data.params.responseMapping
  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    if (node.data && isPlainObject(node.data.params) && node.data.params.responseMapping !== undefined) {
      violations.push({
        path: `${nodePath}.data.params.responseMapping`,
        message: 'responseMapping 禁止放入 params——它不属于请求参数，应声明在 data 顶级字段中',
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, idx) => scanNode(child, `${nodePath}.children[${idx}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, idx) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${idx}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');

  // 遍历 actions[].type: modal 的 content Node
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

const RESERVED_TABLE_QUERY_PARAMS = new Set(['page', 'pageSize', 'sort']);

function validateReservedTableQueryParams(doc, violations) {
  if (!doc || typeof doc !== 'object') return;

  const validateParams = (params, paramsPath) => {
    if (!isPlainObject(params)) return;
    for (const key of Object.keys(params)) {
      if (RESERVED_TABLE_QUERY_PARAMS.has(key)) {
        violations.push({
          path: `${paramsPath}.${key}`,
          message: `query 参数 "${key}" 由 Renderer 分页/排序状态保留，静态 params 不得声明`,
        });
      }
    }
  };

  if (isPlainObject(doc.datasources)) {
    for (const [datasourceKey, datasource] of Object.entries(doc.datasources)) {
      validateParams(datasource?.params, `datasources.${datasourceKey}.params`);
    }
  }

  const scanSearchFields = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    for (const propName of ['field', 'startField', 'endField']) {
      const fieldName = node.props?.[propName];
      if (typeof fieldName === 'string' && RESERVED_TABLE_QUERY_PARAMS.has(fieldName)) {
        violations.push({
          path: `${nodePath}.props.${propName}`,
          message: `搜索字段名 "${fieldName}" 由 Renderer 分页/排序状态保留`,
        });
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => scanSearchFields(child, `${nodePath}.children[${index}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, index) => {
        if (item && item.content) {
          scanSearchFields(item.content, `${nodePath}.props.items[${index}].content`);
        }
      });
    }
  };

  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;
    validateParams(node.data?.params, `${nodePath}.data.params`);
    if (node.type === 'form' && node.props?.mode === 'search') {
      if (Array.isArray(node.children)) {
        node.children.forEach((child, index) => scanSearchFields(child, `${nodePath}.children[${index}]`));
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => scanNode(child, `${nodePath}.children[${index}]`));
    }
    if (node.props && Array.isArray(node.props.items)) {
      node.props.items.forEach((item, index) => {
        if (item && item.content) {
          scanNode(item.content, `${nodePath}.props.items[${index}].content`);
        }
      });
    }
  };

  if (doc.body) scanNode(doc.body, 'body');
  if (isPlainObject(doc.actions)) {
    for (const [actionId, action] of Object.entries(doc.actions)) {
      if (action?.type === 'modal' && action.content) {
        scanNode(action.content, `actions.${actionId}.content`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 扫描整个页面文档
// ---------------------------------------------------------------------------
function validatePage(doc, fileLabel) {
  const violations = [];
  if (!isPlainObject(doc)) return violations;
  if (doc.body) {
    validateNode(doc.body, 'body', violations, doc);
  }

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        validateNode(actionDef.content, `actions.${actionId}.content`, violations, doc);
      }
    }
  }

  validateRowActionRefs(doc, violations);
  validatePageActionRefs(doc, violations);
  if (doc.body) validateFormFieldBindings(doc.body, 'body', doc, violations);
  validateModalFormFieldBindings(doc, violations);
  validateDataRefsAndTargetTable(doc, violations);
  validateActionUrls(doc, violations);
  validateRequiredCapabilities(doc, violations);
  validateParamsResponseMappingBan(doc, violations);
  validateReservedTableQueryParams(doc, violations);
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
    console.error('用法: node scripts/validate-l2-components.js <file-or-glob> [--json]');
    process.exit(2);
  }

  const files = expandFilePatterns(patterns);

  if (files.length === 0) {
    console.error(`[L2] 未找到匹配文件：${patterns.join(', ')}`); process.exit(2);
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
    fileErrors.forEach(e => console.error(`[L2] 解析失败 ${e.file}: ${e.error}`));
    if (allViolations.length > 0) {
      console.error(`[L2] 发现 ${allViolations.length} 处组件契约违规：`);
      allViolations.forEach(v => {
        console.error(`  ${v.file}  →  ${v.path}：${v.message}`);
      });
    } else {
      console.log(`[L2] 通过：${files.length} 个文件未发现组件契约违规。`);
    }
  }

  process.exitCode = allViolations.length > 0 || fileErrors.length > 0 ? 1 : 0;
}

main();
