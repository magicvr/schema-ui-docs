#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { CONFORMANCE_SCENARIO_PATHS, extractAllYamlFences } = require('./official-scenarios');
const { WORKSPACE_ROOT, protocolRoot } = require('./protocol-paths');

const protocolSourceRoot = protocolRoot();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-ui-scenarios-'));

try {
  // 官方六场景 + 扩展场景：逐段 YAML fence 提取为独立页面文件，统一过 L0–L4。
  // （审计 0082 / F-002：扩展场景此前从未进入 L0–L4，非法形态可静默通过。）
  const pageFiles = [];
  for (const relativePath of CONFORMANCE_SCENARIO_PATHS) {
    const markdown = fs.readFileSync(path.join(protocolSourceRoot, relativePath), 'utf8');
    const fences = extractAllYamlFences(markdown);
    if (fences.length === 0) {
      throw new Error(`No yaml fence found in ${relativePath}`);
    }
    fences.forEach((fence, index) => {
      const pageId = extractPageId(fence);
      // 无 meta.pageId 的 fence 是插图性片段（非独立页面），跳过（官方六场景含此类片段）。
      if (pageId === undefined) return;
      const fileName = `${relativePath.replace(/[/\\]/g, '_')}__${pageId}.yaml`;
      fs.writeFileSync(path.join(tempDir, fileName), `${fence}\n`, 'utf8');
      pageFiles.push(path.join(tempDir, fileName));
    });
  }

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'validate-all.js'), ...pageFiles],
    { cwd: WORKSPACE_ROOT, stdio: 'inherit', env: process.env },
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function extractPageId(fence) {
  try {
    const yaml = require('js-yaml');
    const doc = yaml.load(fence);
    return doc && doc.meta && typeof doc.meta.pageId === 'string' ? doc.meta.pageId : undefined;
  } catch {
    return undefined;
  }
}
