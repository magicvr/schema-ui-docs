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
 *      - 列表类接口 + 注册了 supportsData 的组件：必须声明 responseMapping.list
 *      - pagination.mode === 'server' 时：必须声明 responseMapping.total
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
  const reserved = new Set(['additionalProperties', 'required', 'allOf', 'anyOf', 'oneOf']);
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
    if (fs.type) checkType(v, fs.type, `${objPath}.${k}`, violations);
    if (fs.enum && v !== undefined) checkEnum(v, fs.enum, `${objPath}.${k}`, violations);
    // 再深一层：有 properties 或 additionalProperties schema 的 object 都递归
    if (fs.type === 'object' && v && typeof v === 'object' && !Array.isArray(v) &&
        (fs.properties || (fs.additionalProperties && typeof fs.additionalProperties === 'object'))) {
      validateNestedObject(v, fs, `${objPath}.${k}`, violations);
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
 *   - 只有 table 是列表类接口；使用 API 数据时若声明了 responseMapping 则必须有 list。
 *     其他 supportsData 组件（statCard / text / chart）是单值/聚合数据，不强制要求 list。
 *   - table.props.pagination.mode === 'server' 时，必须有 responseMapping.total。
 */
function validateResponseMapping(node, type, compDef, nodePath, violations) {
  const { data, props = {} } = node;
  if (!data || data.source !== 'api') return;

  const rm = data.responseMapping;

  // 列表类接口：仅 table，且已声明 responseMapping 时必须有 list
  if (type === 'table' && rm !== undefined && !rm.list) {
    violations.push({
      path: `${nodePath}.data.responseMapping.list`,
      message: 'table 组件使用 API 数据且声明了 responseMapping，必须提供 responseMapping.list',
    });
  }

  // table 服务端分页：必须有 responseMapping 且有 total
  if (type === 'table' && props.pagination && props.pagination.mode === 'server') {
    if (!rm || !rm.total) {
      violations.push({
        path: `${nodePath}.data.responseMapping.total`,
        message: 'table 使用 pagination.mode=server 时，必须在 responseMapping 中声明 total',
      });
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
