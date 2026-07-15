#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeOfficialScenarios } = require('./official-scenarios');
const { WORKSPACE_ROOT, protocolRoot } = require('./protocol-paths');

const protocolSourceRoot = protocolRoot();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-ui-scenarios-'));

try {
  writeOfficialScenarios(protocolSourceRoot, tempDir);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'validate-all.js'), path.join(tempDir, '*.yaml')],
    { cwd: WORKSPACE_ROOT, stdio: 'inherit', env: process.env },
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
