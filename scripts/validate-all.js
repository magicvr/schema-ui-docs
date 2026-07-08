#!/usr/bin/env node
/**
 * CI 统一校验入口
 *
 * 按 06-validation.md §2 的建议流程依次执行：
 *   L0/L1 — ajv-cli（page.schema.json + node.schema.json，外部调用）
 *   L2    — validate-l2-components.js（组件契约）
 *   L3a   — validate-l3a-expressions.js（表达式静态校验）
 *   L4    — lint-l4-banned-props.js（禁用 CSS 属性）
 *
 * 用法：
 *   node scripts/validate-all.js <file-or-glob> [--skip-l0l1] [--json]
 *
 *   --skip-l0l1   跳过 ajv-cli 校验（适用于未安装 ajv-cli 的环境，L1/L0 由独立 CI 步骤保障）
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

const SCRIPTS_DIR = __dirname;

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

function runAjv(patterns, pageSchemaPath) {
  // 检查本地 ajv-cli 是否已安装（devDependencies）
  const ajvCliIndex = path.resolve(SCRIPTS_DIR, '../node_modules/ajv-cli/dist/index.js');
  if (!fs.existsSync(ajvCliIndex)) {
    return {
      passed: false,
      stdout: '',
      stderr: '[L0/L1] ajv-cli 未安装，请运行: npm install\n         或使用 --skip-l0l1 跳过。',
    };
  }
  try {
    const output = execFileSync(
      process.execPath,
      [ajvCliIndex, 'validate', '-s', pageSchemaPath,
       '--allow-union-types', '--strict=false',
       '-r', path.resolve(SCRIPTS_DIR, '../docs/schemas/node.schema.json'),
       '-r', path.resolve(SCRIPTS_DIR, '../docs/schemas/action.schema.json'),
       '-r', path.resolve(SCRIPTS_DIR, '../docs/schemas/reaction.schema.json'),
       '-d', ...patterns],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { passed: true, stdout: output, stderr: '' };
  } catch (err) {
    return { passed: false, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function main() {
  const args = process.argv.slice(2);
  const skipL0L1 = args.includes('--skip-l0l1');
  const jsonMode = args.includes('--json');
  const patterns = args.filter(a => !a.startsWith('--'));

  if (patterns.length === 0) {
    console.error('用法: node scripts/validate-all.js <file-or-glob> [--skip-l0l1] [--json]');
    process.exit(2);
  }

  const PAGE_SCHEMA = path.resolve(SCRIPTS_DIR, '../docs/schemas/page.schema.json');

  const results = {};
  let overallPass = true;

  // -------------------------------------------------------------------------
  // L0 / L1 — ajv-cli
  // -------------------------------------------------------------------------
  if (!skipL0L1) {
    const r = runAjv(patterns, PAGE_SCHEMA);
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
    // 聚合各层的 JSON 输出
    const aggregated = {};
    for (const [layer, res] of Object.entries(results)) {
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

  process.exit(overallPass ? 0 : 1);
}

main();
