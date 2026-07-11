#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { OFFICIAL_SCENARIO_PATHS, readOfficialScenario } = require('./official-scenarios');

const root = path.resolve(__dirname, '..');
const releaseMode = process.argv.includes('--release');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
    });
}

function fixtureDigest() {
  const fixturesRoot = path.join(root, 'conformance', 'fixtures');
  const files = collectFiles(fixturesRoot).sort((left, right) => left.localeCompare(right, 'en'));
  const hash = crypto.createHash('sha256');
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
    hash.update(relativePath, 'utf8');
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }
  return { digest: hash.digest('hex'), fileCount: files.length };
}

const rootPackage = readJson('package.json');
const rootLock = readJson('package-lock.json');
const mcpPackage = readJson('mcp/package.json');
const mcpLock = readJson('mcp/package-lock.json');
const versions = [
  rootPackage.version,
  rootLock.version,
  rootLock.packages[''].version,
  mcpPackage.version,
  mcpLock.version,
  mcpLock.packages[''].version,
  mcpLock.packages['..'].version,
];
assert.ok(versions.every(version => version === rootPackage.version), `Package version mismatch: ${versions.join(', ')}`);

const semverMatch = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(rootPackage.version);
assert.ok(semverMatch, `Unsupported release version: ${rootPackage.version}`);
const protocolVersion = `${semverMatch[1]}.${semverMatch[2]}`;

for (const relativePath of OFFICIAL_SCENARIO_PATHS) {
  const page = yaml.load(readOfficialScenario(root, relativePath));
  assert.equal(page.meta.protocolVersion, protocolVersion, `${relativePath}: expected protocolVersion ${protocolVersion}`);
}

const readme = readText('README.md');
const overview = readText('docs/00-overview.md');
const changelog = readText('docs/CHANGELOG.md');
assert.ok(readme.includes(`当前版本为 \`${rootPackage.version}\``), 'README current version is out of sync');
assert.ok(readme.includes(`meta.protocolVersion: "${protocolVersion}"`), 'README protocol version is out of sync');
assert.ok(overview.includes(`协议版本：\`v${rootPackage.version}\``), 'Overview current version is out of sync');
assert.ok(overview.includes(`meta.protocolVersion: "${protocolVersion}"`), 'Overview protocol version is out of sync');
assert.ok(changelog.includes(`## v${rootPackage.version} `), `CHANGELOG is missing v${rootPackage.version} section`);
const firstChangelogVersion = changelog.match(/^## v([^ ]+) /m)?.[1];
assert.equal(firstChangelogVersion, rootPackage.version, 'CHANGELOG first release section must match package version');

const migrationPath = 'docs/migrations/0.2-0.3-to-1.0.md';
assert.ok(fs.existsSync(path.join(root, migrationPath)), `Missing migration guide: ${migrationPath}`);
const migration = readText(migrationPath);
for (const requiredText of [
  'protocolVersion',
  'legacy adapter',
  'query',
  'pageSize',
  'requestMapping',
  'actions.upload',
]) {
  assert.ok(migration.includes(requiredText), `Migration guide is missing required topic: ${requiredText}`);
}

const expectedCategories = new Set([
  'version-negotiation',
  'request-construction',
  'response-mapping',
  'search-table',
  'reactions',
  'actions',
  'uploads',
  'scenarios',
]);
let versionedCaseCount = 0;
for (const category of expectedCategories) {
  const suite = readJson(`conformance/fixtures/${category}/cases.json`);
  assert.equal(suite.fixtureVersion, '1.0', `${category}: fixtureVersion must be 1.0`);
  assert.equal(suite.category, category, `${category}: suite category mismatch`);
  assert.ok(Array.isArray(suite.cases) && suite.cases.length > 0, `${category}: fixture suite is empty`);
  versionedCaseCount += suite.cases.length;
}
assert.equal(versionedCaseCount, 65, `Expected 65 versioned fixtures, received ${versionedCaseCount}`);

if (Number(semverMatch[1]) >= 1) {
  const releaseGoals = readText('docs/09-v1-release-goals.md');
  const g1ToG4 = releaseGoals.slice(releaseGoals.indexOf('### G1.'), releaseGoals.indexOf('## 3. 发布工程门禁'));
  assert.ok(!g1ToG4.includes('- [ ]'), 'G1-G4 must be fully closed for a 1.x release');
}

if (releaseMode) {
  const expectedRef = `refs/tags/v${rootPackage.version}`;
  assert.equal(process.env.GITHUB_REF, expectedRef, `Release must run from ${expectedRef}`);
}

const fixture = fixtureDigest();
const result = {
  version: rootPackage.version,
  protocolVersion,
  fixtureVersion: '1.0',
  versionedCaseCount,
  fixtureFileCount: fixture.fileCount,
  fixtureDigest: `sha256:${fixture.digest}`,
  gitSha: process.env.GITHUB_SHA || null,
  releaseMode,
};
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-version=${result.protocolVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `fixture-digest=${result.fixtureDigest}\n`);
}