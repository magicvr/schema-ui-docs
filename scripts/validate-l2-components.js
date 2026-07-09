#!/usr/bin/env node
/**
 * L2 组件契约校验器
 *
 * 按 component-registry.json 的自定义 DSL 校验每个 Node 的：
 *   1. type 是否在注册表中
 *   2. props 字段是否合法（required 字段、字段类型、enum 值、额外字段）
 *   3. supportsChildren / supportsData / supportsReactions / supportsStates 约束
 *   4. 组件级 anyOf / oneOf / allOf 约束
 *   5. responseMapping 语义规则：
 *      - table 组件使用 API 数据且声明了 responseMapping 时，必须声明 responseMapping.list
 *      - table.props.pagination.mode === 'server' 且声明了 responseMapping 时，必须声明 responseMapping.total
 *   6. 执行能力与行级 action 引用规则：
 *      - 使用 RowAction.actionRef 时必须声明 actions.row.request 能力
 *      - RowAction.actionRef 必须引用顶层 request action，且 RowAction 必须声明 requestMapping
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
const { globSync } = require('glob');

// ---------------------------------------------------------------------------
// 加载 component-registry.json
// ---------------------------------------------------------------------------
const REGISTRY_PATH = path.resolve(__dirname, '../docs/schemas/component-registry.json');
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

/** 判断字段是否在 DSL props 中显式声明 */
function getDeclaredFields(propsSpec) {
  const reserved = new Set(['additionalProperties', 'allOf', 'anyOf', 'oneOf']);
  return Object.keys(propsSpec).filter(k => !reserved.has(k));
}

/** 简单类型检查：仅针对 string / number / boolean / array / object */
function checkType(value, expectedType, fieldPath, violations) {
  if (expectedType === 'string' && typeof value !== 'string') {
    violations.push({ path: fieldPath, message: `期望 string，实际 ${typeof value}` });
  } else if (expectedType === 'number' && typeof value !== 'number') {
    violations.push({ path: fieldPath, message: `期望 number，实际 ${typeof value}` });
  } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
    violations.push({ path: fieldPath, message: `期望 boolean，实际 ${typeof value}` });
  } else if (expectedType === 'array' && !Array.isArray(value)) {
    violations.push({ path: fieldPath, message: `期望 array，实际 ${typeof value}` });
  } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
    violations.push({ path: fieldPath, message: `期望 object，实际 ${Array.isArray(value) ? 'array' : typeof value}` });
  }
}

/** 检查 enum 约束 */
function checkEnum(value, enumValues, fieldPath, violations) {
  if (!enumValues.includes(value)) {
    violations.push({ path: fieldPath, message: `值 "${value}" 不在枚举 [${enumValues.join(', ')}] 中` });
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

  if (scope === 'row') {
    for (const forbiddenKey of ['required', 'value']) {
      if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) {
        violations.push({
          path: `${statePath}.${forbiddenKey}`,
          message: 'scope: row 的 fulfill/otherwise 中禁止声明 required 或 value（仅允许 visible 和 disabled）',
        });
      }
    }
  }
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
    validateStringArray(value.dependencies, `${valuePath}.dependencies`, violations);
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
    validateStringArray(value.dependencies, `${valuePath}.dependencies`, violations);
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
  if (ref === 'node.schema.json#/definitions/VisibleWhen') {
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
  // 字段类型 + enum
  for (const [k, v] of Object.entries(obj)) {
    const fs = props[k];
    if (!fs || typeof fs !== 'object') continue;
    if (fs.$ref) validateKnownRef(v, fs.$ref, `${objPath}.${k}`, violations);
    if (fs.type) checkType(v, fs.type, `${objPath}.${k}`, violations);
    if (fs.enum && v !== undefined) checkEnum(v, fs.enum, `${objPath}.${k}`, violations);
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
function validateNode(node, nodePath, violations) {
  if (!node || typeof node !== 'object') return;

  const { type, props = {}, children, reactions, data, states } = node;

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

    // --- responseMapping 语义规则 ---
    validateResponseMapping(node, type, compDef, nodePath, violations);
  }

  // --- 递归 children ---
  if (Array.isArray(children)) {
    children.forEach((child, idx) => {
      validateNode(child, `${nodePath}.children[${idx}]`, violations);
    });
  }

  // --- tabs 内嵌 content ---
  if (props && Array.isArray(props.items)) {
    props.items.forEach((item, idx) => {
      if (item && item.content) {
        validateNode(item.content, `${nodePath}.props.items[${idx}].content`, violations);
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
 * responseMapping 语义规则（ADR-0005 + 04-datasource-contract.md §4.1.1）
 *
 * 规则：
 *   - table 与 chart 是数组消费类接口；使用 API / ref 本地映射且声明了 responseMapping 时必须有 list。
 *     其他 supportsData 组件（statCard / text）是单值/聚合数据，不强制要求 list。
 *   - table.props.pagination.mode === 'server' 时，若声明了 responseMapping，则必须有 responseMapping.total。
 */
function validateResponseMapping(node, type, compDef, nodePath, violations) {
  const { data, props = {} } = node;
  if (!data || !['api', 'ref'].includes(data.source)) return;

  const rm = data.responseMapping;

  // 数组消费类接口：table / chart 声明 responseMapping 时必须有 list
  if ((type === 'table' || type === 'chart') && rm !== undefined && !rm?.list) {
    violations.push({
      path: `${nodePath}.data.responseMapping.list`,
      message: `${type} 组件使用 API/ref 数据且声明了 responseMapping，必须提供 responseMapping.list`,
    });
  }

  // table 服务端分页：若声明了 responseMapping，则必须有 total
  if (type === 'table' && props.pagination && props.pagination.mode === 'server') {
    if (rm !== undefined && !rm?.total) {
      violations.push({
        path: `${nodePath}.data.responseMapping.total`,
        message: 'table 使用 pagination.mode=server 且声明了 responseMapping 时，必须在 responseMapping 中声明 total',
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

function hasNonEmptyRequestMapping(mapping) {
  if (!isPlainObject(mapping)) return false;
  return ['path', 'query', 'body'].some(section =>
    isPlainObject(mapping[section]) && Object.keys(mapping[section]).length > 0,
  );
}

function validateRequestMappingValues(mappingSection, sectionPath, violations) {
  if (mappingSection === undefined) return;
  if (!isPlainObject(mappingSection)) {
    violations.push({ path: sectionPath, message: 'requestMapping 的 path/query/body 必须是对象' });
    return;
  }

  const rowRefPattern = /^\$(row|parentRow)\.[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
  for (const [mappingKey, mappingValue] of Object.entries(mappingSection)) {
    const valuePath = `${sectionPath}.${mappingKey}`;
    const valueType = mappingValue === null ? 'null' : Array.isArray(mappingValue) ? 'array' : typeof mappingValue;
    if (!['string', 'number', 'boolean', 'null'].includes(valueType)) {
      violations.push({
        path: valuePath,
        message: `requestMapping 必须是扁平 key-value map；值只能是 string/number/boolean/null 或单个行上下文引用，实际为 ${valueType}`,
      });
      continue;
    }
    if (typeof mappingValue === 'string' && mappingValue.startsWith('$')) {
      if (!rowRefPattern.test(mappingValue)) {
        violations.push({
          path: valuePath,
          message: '行级 requestMapping 仅允许单个 $row.* / $parentRow.* 点路径引用；不得使用 $deps.*、$context.* 或表达式',
        });
      }
    }
  }
}

function validateRowRequestAction(rowAction, rowActionPath, actionDef, actionPath, violations) {
  if (!hasNonEmptyRequestMapping(rowAction.requestMapping)) {
    violations.push({
      path: `${rowActionPath}.requestMapping`,
      message: 'RowAction.actionRef 必须同时声明非空 requestMapping，以显式绑定当前行数据',
    });
    return;
  }

  const mapping = rowAction.requestMapping;
  validateRequestMappingValues(mapping.path, `${rowActionPath}.requestMapping.path`, violations);
  validateRequestMappingValues(mapping.query, `${rowActionPath}.requestMapping.query`, violations);
  validateRequestMappingValues(mapping.body, `${rowActionPath}.requestMapping.body`, violations);

  const placeholders = new Set(extractUrlPathParams(actionDef.url));
  const pathMapping = isPlainObject(mapping.path) ? mapping.path : {};
  for (const placeholder of placeholders) {
    if (pathMapping[placeholder] === undefined) {
      violations.push({
        path: `${rowActionPath}.requestMapping.path.${placeholder}`,
        message: `url 中的路径参数 {${placeholder}} 必须在 requestMapping.path 中声明`,
      });
    }
  }
  for (const mappingKey of Object.keys(pathMapping)) {
    if (!placeholders.has(mappingKey)) {
      violations.push({
        path: `${rowActionPath}.requestMapping.path.${mappingKey}`,
        message: `requestMapping.path.${mappingKey} 没有对应的 url 路径参数 {${mappingKey}}`,
      });
    }
  }

  if (['GET', 'DELETE'].includes(actionDef.method) && isPlainObject(mapping.body) && Object.keys(mapping.body).length > 0) {
    violations.push({
      path: `${rowActionPath}.requestMapping.body`,
      message: `${actionDef.method} 行级请求不得声明 body；请使用 path 或 query 传递当前行标识`,
    });
  }
}

function validateRowActionRefs(doc, violations) {
  const actions = isPlainObject(doc.actions) ? doc.actions : {};

  const scanNode = (node, nodePath) => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'table' && node.props && Array.isArray(node.props.actions)) {
      node.props.actions.forEach((rowAction, rowActionIndex) => {
        if (!rowAction) return;

        const rowActionPath = `${nodePath}.props.actions[${rowActionIndex}]`;
        if (rowAction.requestMapping !== undefined && rowAction.actionRef === undefined) {
          violations.push({
            path: `${rowActionPath}.requestMapping`,
            message: 'RowAction.requestMapping 只能与 actionRef 一起使用；本地 handler 模式不接受 requestMapping',
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

        if (actionDef.type !== 'request') {
          violations.push({
            path: `${rowActionPath}.actionRef`,
            message: `RowAction.actionRef 仅可引用 type: request 的 action，当前为 "${actionDef.type}"`,
          });
          return;
        }

        validateRowRequestAction(rowAction, rowActionPath, actionDef, `actions.${actionRef}`, violations);
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
    if (node.type === 'table' && node.props && Array.isArray(node.props.actions)) {
      node.props.actions.forEach((rowAction, rowActionIndex) => {
        if (rowAction && rowAction.actionRef !== undefined) {
          requireCapability('actions.row.request', `${nodePath}.props.actions[${rowActionIndex}].actionRef`, 'RowAction.actionRef');
        }
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

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 扫描整个页面文档
// ---------------------------------------------------------------------------
function validatePage(doc, fileLabel) {
  const violations = [];
  if (doc.body) {
    validateNode(doc.body, 'body', violations);
  }

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        validateNode(actionDef.content, `actions.${actionId}.content`, violations);
      }
    }
  }

  validateRowActionRefs(doc, violations);
  validateRequiredCapabilities(doc, violations);
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

  const files = patterns.flatMap(p => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return [p];
    return globSync(p, { cwd: process.cwd() });
  });

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

  process.exit(allViolations.length > 0 || fileErrors.length > 0 ? 1 : 0);
}

main();
