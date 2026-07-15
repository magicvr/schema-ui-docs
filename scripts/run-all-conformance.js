#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = Object.keys(packageJson.scripts)
  .filter(name => name.startsWith('test:conformance:') && name !== 'test:conformance:all')
  .sort((left, right) => left.localeCompare(right, 'en'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const script of scripts) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(npmCommand, ['run', script], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nAll ${scripts.length} conformance entries passed.`);
