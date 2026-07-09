#!/usr/bin/env node
/**
 * L4 禁用词 lint 脚本
 *
 * 校验页面配置（JSON/YAML）中是否在 props 或 reactions[].fulfill 里混入了
 * CSS 样式属性名。深度递归扫描，覆盖 L1（node.schema.json not.anyOf）无法
 * 检查到的嵌套场景。
 *
 * 用法：
 *   node scripts/lint-l4-banned-props.js <file-or-glob> [--json]
 *
 * 退出码：
 *   0 — 全部通过
 *   1 — 存在违规
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// ---------------------------------------------------------------------------
// L4 禁用词清单（必须与 node.schema.json props.not.anyOf 保持一致）
// ---------------------------------------------------------------------------
const BANNED_PROPS = new Set([
  'margin', 'padding', 'color', 'background', 'fontSize', 'fontWeight',
  'border', 'borderRadius', 'width', 'height', 'minWidth', 'maxWidth',
  'minHeight', 'maxHeight', 'zIndex', 'boxShadow',
  'lineHeight', 'letterSpacing', 'textAlign',
]);

// ---------------------------------------------------------------------------
// YAML/JSON 解析
// ---------------------------------------------------------------------------
function parseFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return JSON.parse(raw);
  }
  if (ext === '.yaml' || ext === '.yml') {
    // 运行时 require js-yaml（不硬依赖，给出友好提示）
    let yaml;
    try {
      yaml = require('js-yaml');
    } catch {
      console.error(
        '[L4] 解析 YAML 文件需要安装 js-yaml：npm install js-yaml\n' +
        '      若只有 JSON 文件可直接跳过。',
      );
      process.exit(2);
    }
    return yaml.load(raw);
  }
  throw new Error(`不支持的文件格式: ${ext}`);
}

// ---------------------------------------------------------------------------
// 核心扫描函数
// ---------------------------------------------------------------------------

/**
 * 扫描单个 Node 树，收集所有违规项。
 *
 * @param {object} node   - Node 对象
 * @param {string} nodePath - 用于错误定位的 JSON 路径字符串
 * @param {Array}  violations - 结果收集数组
 */
function scanNode(node, nodePath, violations) {
  if (!node || typeof node !== 'object') return;

  // --- 检查 props ---
  if (node.props && typeof node.props === 'object') {
    checkObjectForBannedKeys(node.props, `${nodePath}.props`, violations);
  }

  // --- 检查 reactions[].fulfill / reactions[].otherwise ---
  if (Array.isArray(node.reactions)) {
    node.reactions.forEach((reaction, idx) => {
      if (reaction && reaction.fulfill) {
        checkObjectForBannedKeys(
          reaction.fulfill,
          `${nodePath}.reactions[${idx}].fulfill`,
          violations,
        );
      }
      if (reaction && reaction.otherwise) {
        checkObjectForBannedKeys(
          reaction.otherwise,
          `${nodePath}.reactions[${idx}].otherwise`,
          violations,
        );
      }
    });
  }

  // --- 递归 children ---
  if (Array.isArray(node.children)) {
    node.children.forEach((child, idx) => {
      scanNode(child, `${nodePath}.children[${idx}]`, violations);
    });
  }

  // --- tabs 组件内嵌 content ---
  if (node.props && Array.isArray(node.props.items)) {
    node.props.items.forEach((item, idx) => {
      if (item && item.content) {
        scanNode(item.content, `${nodePath}.props.items[${idx}].content`, violations);
      }
    });
  }
}

/**
 * 递归检查一个对象（以及其所有嵌套属性）是否含有禁用键。
 */
function checkObjectForBannedKeys(obj, objPath, violations) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    // 数组：对每个元素继续递归（不在键名上报违规，只在嵌套值里检查）
    obj.forEach((item, idx) => {
      checkObjectForBannedKeys(item, `${objPath}[${idx}]`, violations);
    });
    return;
  }
  for (const key of Object.keys(obj)) {
    if (BANNED_PROPS.has(key)) {
      violations.push({ path: `${objPath}.${key}`, key });
    }
    // 深度递归：嵌套对象和数组都要检查
    if (obj[key] && typeof obj[key] === 'object') {
      checkObjectForBannedKeys(obj[key], `${objPath}.${key}`, violations);
    }
  }
}

/**
 * 扫描页面顶层文档 body 与 actions[].type: modal 的 content Node。
 * page-level actions 里的 payload 不属于 props，不在 L4 范围内。
 */
function scanPage(doc, fileLabel) {
  const violations = [];
  if (doc.body) {
    scanNode(doc.body, 'body', violations);
  }

  // --- 遍历 actions[].type: modal 的 content Node ---
  if (doc.actions && typeof doc.actions === 'object' && !Array.isArray(doc.actions)) {
    for (const [actionId, actionDef] of Object.entries(doc.actions)) {
      if (actionDef && actionDef.type === 'modal' && actionDef.content) {
        scanNode(actionDef.content, `actions.${actionId}.content`, violations);
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
    console.error('用法: node scripts/lint-l4-banned-props.js <file-or-glob> [--json]');
    process.exit(2);
  }

  const files = patterns.flatMap(p => {
    // 如果直接是文件就直接用，否则走 glob
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return [p];
    return globSync(p, { cwd: process.cwd() });
  });

  if (files.length === 0) {
    console.error(`[L4] 未找到匹配文件：${patterns.join(', ')}`);
    process.exit(2);
  }

  let allViolations = [];
  const fileErrors = [];

  for (const file of files) {
    try {
      const doc = parseFile(file);
      const violations = scanPage(doc, file);
      allViolations = allViolations.concat(violations);
    } catch (err) {
      fileErrors.push({ file, error: err.message });
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ violations: allViolations, parseErrors: fileErrors }, null, 2));
  } else {
    if (fileErrors.length > 0) {
      fileErrors.forEach(e => console.error(`[L4] 解析失败 ${e.file}: ${e.error}`));
    }
    if (allViolations.length > 0) {
      console.error(`[L4] 发现 ${allViolations.length} 处禁用 CSS 属性：`);
      allViolations.forEach(v => {
        console.error(`  ${v.file}  →  ${v.path}  (${v.key})`);
      });
    } else {
      console.log(`[L4] 通过：${files.length} 个文件未发现禁用 CSS 属性。`);
    }
  }

  process.exit(allViolations.length > 0 || fileErrors.length > 0 ? 1 : 0);
}

main();
