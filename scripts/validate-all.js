#!/usr/bin/env node
/**
 * CI 统一校验入口
 *
 * 按 06-validation.md §2 的建议流程依次执行：
 *   L0/L1 — 进程内 Ajv（page.schema.json + node/action/reaction，$ref；allErrors 与 MCP 对齐）
 *   L2    — validate-l2-components.js（组件契约）
 *   L3a   — validate-l3a-expressions.js（表达式静态校验）
 *   L4    — lint-l4-banned-props.js（禁用 CSS 属性）
 *
 * 用法：
 *   node scripts/validate-all.js <file-or-glob> [--skip-l0l1] [--json]
 *
 *   --skip-l0l1   跳过 L0/L1 校验（适用于仅跑 L2–L4 的场景）
 *   --json        将各层输出聚合为 JSON
 *
 * 退出码：
 *   0 — 全部通过
 *   1 — 存在违规
 *   2 — 调用错误
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Ajv } = require('ajv');
const { expandFilePatterns, normalizeGlobPattern } = require('./file-patterns');

const SCRIPTS_DIR = __dirname;
const ROOT = path.resolve(SCRIPTS_DIR, '..');
const SCHEMA_DIR = path.join(ROOT, 'docs', 'schemas');

function runScript(scriptName, args, jsonMode) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const nodeArgs = [scriptPath, ...args];
  if (jsonMode) nodeArgs.push('--json');

  try {
    const output = execFileSync(process.execPath, nodeArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { passed: true, stdout: output, stderr: '' };
  } catch (err) {
    return {
      passed: false,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.status,
    };
  }
}

function readJsonSchema(fileName) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, fileName), 'utf8'));
}

function parseDocument(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.yaml' || ext === '.yml') return yaml.load(raw);
  throw new Error(`不支持的文件格式: ${ext}`);
}

/** 与 MCP validation-runner 相同的 L0/L1 Ajv 配置（allErrors + strict:false + allowUnionTypes） */
function createPageValidator() {
  const pageSchema = readJsonSchema('page.schema.json');
  const nodeSchema = readJsonSchema('node.schema.json');
  const actionSchema = readJsonSchema('action.schema.json');
  const reactionSchema = readJsonSchema('reaction.schema.json');

  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  ajv.addSchema(nodeSchema, 'node.schema.json');
  ajv.addSchema(actionSchema, 'action.schema.json');
  ajv.addSchema(reactionSchema, 'reaction.schema.json');
  return ajv.compile(pageSchema);
}

function formatAjvError(error) {
  const instancePath = error.instancePath || '';
  const msg = error.message || 'schema 校验失败';
  if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
    return `${instancePath} ${msg} ('${error.params.additionalProperty}')`.trim();
  }
  if (error.keyword === 'required' && error.params?.missingProperty) {
    return `${instancePath} ${msg}`.trim();
  }
  return `${instancePath} ${msg}`.trim();
}

function runL0L1(patterns) {
  let validate;
  try {
    validate = createPageValidator();
  } catch (err) {
    return {
      passed: false,
      stdout: '',
      stderr: `[L0/L1] 无法加载 Schema / Ajv: ${err.message}\n`,
      code: 2,
    };
  }

  const files = expandFilePatterns(patterns);
  if (files.length === 0) {
    return {
      passed: false,
      stdout: '',
      stderr: '[L0/L1] glob 无匹配文件\n',
      code: 2,
    };
  }

  const lines = [];
  let failed = false;
  for (const filePath of files) {
    let document;
    try {
      document = parseDocument(filePath);
    } catch (err) {
      failed = true;
      lines.push(`${filePath} invalid`);
      lines.push(`  parse error: ${err.message}`);
      continue;
    }
    const ok = validate(document);
    if (ok) {
      lines.push(`${filePath} valid`);
      continue;
    }
    failed = true;
    lines.push(`${filePath} invalid`);
    for (const error of validate.errors || []) {
      lines.push(`  ${formatAjvError(error)}`);
    }
  }

  const text = `${lines.join('\n')}\n`;
  return failed
    ? { passed: false, stdout: text, stderr: '', code: 1 }
    : { passed: true, stdout: text, stderr: '' };
}

function main() {
  const args = process.argv.slice(2);
  const skipL0L1 = args.includes('--skip-l0l1');
  const jsonMode = args.includes('--json');
  const patterns = args.filter(a => !a.startsWith('--')).map(normalizeGlobPattern);

  if (patterns.length === 0) {
    console.error('用法: node scripts/validate-all.js <file-or-glob> [--skip-l0l1] [--json]');
    process.exit(2);
  }

  const results = {};
  let overallPass = true;

  // -------------------------------------------------------------------------
  // L0 / L1 — 进程内 Ajv（与 MCP allErrors 对齐）
  // -------------------------------------------------------------------------
  if (!skipL0L1) {
    const r = runL0L1(patterns);
    results['L0/L1'] = r;
    if (!r.passed) overallPass = false;
  }

  // -------------------------------------------------------------------------
  // L2 — 组件契约
  // -------------------------------------------------------------------------
  const l2 = runScript('validate-l2-components.js', patterns, jsonMode);
  results['L2'] = l2;
  if (!l2.passed) overallPass = false;

  // -------------------------------------------------------------------------
  // L3a — 表达式静态校验
  // -------------------------------------------------------------------------
  const l3a = runScript('validate-l3a-expressions.js', patterns, jsonMode);
  results['L3a'] = l3a;
  if (!l3a.passed) overallPass = false;

  // -------------------------------------------------------------------------
  // L4 — 禁用 CSS 属性
  // -------------------------------------------------------------------------
  const l4 = runScript('lint-l4-banned-props.js', patterns, jsonMode);
  results['L4'] = l4;
  if (!l4.passed) overallPass = false;

  // -------------------------------------------------------------------------
  // 输出
  // -------------------------------------------------------------------------
  if (jsonMode) {
    const aggregated = {};
    for (const [layer, res] of Object.entries(results)) {
      if (layer === 'L0/L1') {
        // L0/L1 文本报告；JSON 模式下保留 raw 行，便于对照 MCP layers["L0/L1"]
        aggregated[layer] = {
          passed: res.passed,
          raw: (res.stdout || '') + (res.stderr || ''),
        };
        continue;
      }
      try {
        aggregated[layer] = res.stdout ? JSON.parse(res.stdout) : { raw: res.stderr };
      } catch {
        aggregated[layer] = { raw: res.stdout + res.stderr };
      }
    }
    console.log(JSON.stringify({ passed: overallPass, layers: aggregated }, null, 2));
  } else {
    const PASS = '\u2713';
    const FAIL = '\u2717';
    console.log('\n=== Schema-UI 校验报告 ===\n');
    for (const [layer, res] of Object.entries(results)) {
      const icon = res.passed ? PASS : FAIL;
      console.log(`  [${icon}] ${layer}`);
      if (res.stdout && res.stdout.trim()) {
        res.stdout.trim().split('\n').forEach(l => console.log(`       ${l}`));
      }
      if (res.stderr && res.stderr.trim()) {
        res.stderr.trim().split('\n').forEach(l => console.error(`       ${l}`));
      }
    }
    console.log('');
    if (overallPass) {
      console.log('结果：全部通过 ✓');
    } else {
      const failed = Object.entries(results).filter(([, r]) => !r.passed).map(([k]) => k).join(', ');
      console.error(`结果：校验失败（${failed}）`);
    }
    console.log('');
  }

  const hasCallError = Object.values(results).some(result => result.code === 2);
  process.exitCode = overallPass ? 0 : hasCallError ? 2 : 1;
}

main();
