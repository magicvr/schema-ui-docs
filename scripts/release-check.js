#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { OFFICIAL_SCENARIO_PATHS, readOfficialScenario } = require('./official-scenarios');
const { buildProtocolArtifact } = require('./build-protocol-artifact');

const root = path.resolve(__dirname, '..');
const releaseMode = process.argv.includes('--release');

/**
 * Hard gate for fixture tree integrity (V225 / V223).
 * Algorithm: sorted relative paths under conformance/fixtures/**, for each file
 * hash.update(relativePath + '\\0' + canonicalUtf8FileBytes + '\\0'), then sha256 hex.
 * Text fixture line endings are canonicalized to LF before hashing.
 * When any fixture bytes change, recompute with `npm run release:check` (after
 * temporarily updating this constant if needed) and bump EXPECTED_FIXTURE_DIGEST
 * in the same commit. CI fails if printed digest ≠ this value.
 */
const EXPECTED_FIXTURE_DIGEST =
  'sha256:f1190a63cca3be04441bcb889d8f53f94f4628754884f6dad6abaea7158dbdfe';

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

function readCanonicalFixtureBytes(filePath) {
  // GitHub Actions checks out LF while Windows may materialize CRLF. The
  // release digest must represent the committed text, not the local checkout.
  return Buffer.from(fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function fixtureDigest() {
  const fixturesRoot = path.join(root, 'conformance', 'fixtures');
  const files = collectFiles(fixturesRoot).sort((left, right) => left.localeCompare(right, 'en'));
  const hash = crypto.createHash('sha256');
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
    hash.update(relativePath, 'utf8');
    hash.update('\0');
    hash.update(readCanonicalFixtureBytes(filePath));
    hash.update('\0');
  }
  return { digest: hash.digest('hex'), fileCount: files.length };
}

const rootPackage = readJson('package.json');
const rootLock = readJson('package-lock.json');
const protocolManifest = readJson('protocol-manifest.json');
const versions = [
  rootPackage.version,
  rootLock.version,
  rootLock.packages[''].version,
  protocolManifest.artifactVersion,
];
assert.ok(versions.every(version => version === rootPackage.version), `Package version mismatch: ${versions.join(', ')}`);

const semverMatch = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(rootPackage.version);
assert.ok(semverMatch, `Unsupported release version: ${rootPackage.version}`);
const majorVersion = Number(semverMatch[1]);
const minorVersion = Number(semverMatch[2]);
const protocolVersion = `${semverMatch[1]}.${semverMatch[2]}`;
const releaseTargets = {
  '1.0': {
    releaseGoalsPath: 'docs/09-v1-release-goals.md',
    migrationPath: 'docs/migrations/0.2-0.3-to-1.0.md',
    migrationRequiredTopics: ['protocolVersion', 'legacy adapter', 'query', 'pageSize', 'requestMapping', 'actions.upload'],
  },
  '2.0': {
    releaseGoalsPath: 'docs/10-v2-release-goals.md',
    migrationPath: 'docs/migrations/1.0-to-2.0.md',
    migrationRequiredTopics: ['protocolVersion', 'legacy adapter', 'query', 'pageSize', 'requestMapping', 'actions.upload'],
  },
  '2.1': {
    releaseGoalsPath: 'docs/12-v2.1-release-goals.md',
    migrationPath: 'docs/migrations/2.0-to-2.1.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'actions.page.trigger',
      'form.record.load',
    ],
  },
  '2.2': {
    releaseGoalsPath: 'docs/13-v2.2-release-goals.md',
    migrationPath: 'docs/migrations/2.1-to-2.2.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'table.selection',
      'actions.batch.request',
      'actions.page.trigger',
      'ALLOW_22_FIELDS_ON_21',
    ],
  },
  '2.3': {
    releaseGoalsPath: 'docs/14-v2.3-release-goals.md',
    migrationPath: 'docs/migrations/2.2-to-2.3.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'permissions.inheritance',
      'permissionCascade',
      'permissionIntent',
    ],
  },
};
const releaseTarget = releaseTargets[protocolVersion];
assert.ok(releaseTarget, `Missing release target definition for protocolVersion ${protocolVersion}`);
assert.equal(protocolManifest.protocolVersion, protocolVersion, 'Protocol manifest protocolVersion mismatch');
const componentRegistry = readJson('docs/schemas/component-registry.json');
for (const [type, definition] of Object.entries(componentRegistry.components)) {
  assert.ok(typeof definition.category === 'string' && definition.category.trim(), `${type}: missing component category`);
}

for (const relativePath of OFFICIAL_SCENARIO_PATHS) {
  const page = yaml.load(readOfficialScenario(root, relativePath));
  assert.equal(page.meta.protocolVersion, protocolVersion, `${relativePath}: expected protocolVersion ${protocolVersion}`);
}

const readme = readText('README.md');
const overview = readText('docs/00-overview.md');
const changelog = readText('docs/CHANGELOG.md');
assert.ok(
  [
    `当前稳定版本为 \`${rootPackage.version}\``,
    `当前协议版本为 \`${rootPackage.version}\``,
    `当前协议升级候选版本为 \`${rootPackage.version}\``,
    `当前发布候选版本为 \`${rootPackage.version}\``,
  ].some(needle => readme.includes(needle)),
  'README current version is out of sync',
);
assert.ok(readme.includes(`meta.protocolVersion: "${protocolVersion}"`), 'README protocol version is out of sync');
assert.ok(overview.includes(`协议版本：\`v${rootPackage.version}\``), 'Overview current version is out of sync');
assert.ok(overview.includes(`meta.protocolVersion: "${protocolVersion}"`), 'Overview protocol version is out of sync');
assert.ok(changelog.includes(`## v${rootPackage.version} `), `CHANGELOG is missing v${rootPackage.version} section`);
const firstChangelogVersion = changelog.match(/^## v([^ ]+) /m)?.[1];
assert.equal(firstChangelogVersion, rootPackage.version, 'CHANGELOG first release section must match package version');

const migrationPath = releaseTarget.migrationPath;
assert.ok(fs.existsSync(path.join(root, migrationPath)), `Missing migration guide: ${migrationPath}`);
const migration = readText(migrationPath);
for (const requiredText of releaseTarget.migrationRequiredTopics) {
  assert.ok(migration.includes(requiredText), `Migration guide is missing required topic: ${requiredText}`);
}

const expectedCategories = new Set([
  'version-negotiation',
  'request-construction',
  'response-mapping',
  'component-format',
  'search-table',
  'reactions',
  'request-lifecycle',
  'runtime-defaults',
  'static-data',
  'actions',
  'uploads',
  'scenarios',
  'permissions-inheritance',
]);
let versionedCaseCount = 0;
for (const category of expectedCategories) {
  const suite = readJson(`conformance/fixtures/${category}/cases.json`);
  assert.equal(suite.fixtureVersion, '1.0', `${category}: fixtureVersion must be 1.0`);
  assert.equal(suite.category, category, `${category}: suite category mismatch`);
  assert.ok(Array.isArray(suite.cases) && suite.cases.length > 0, `${category}: fixture suite is empty`);
  for (const fixtureCase of suite.cases) {
    // Algorithm suites target the stable protocol MINOR. version-negotiation keeps
    // historical page versions (0.3, etc.) as negotiation inputs (V227).
    if (category !== 'version-negotiation') {
      assert.equal(
        fixtureCase.protocolVersion,
        protocolVersion,
        `${category}/${fixtureCase.id}: protocolVersion must be ${protocolVersion}`,
      );
    }
  }
  versionedCaseCount += suite.cases.length;
}
// Count is recomputed each MINOR when algorithm fixtures grow; keep in sync with suites.
const expectedVersionedCaseCountByProtocol = {
  '1.0': 65,
  '2.0': 128,
  '2.1': 186,
  '2.2': 189,
  '2.3': 206,
};
const expectedVersionedCaseCount = expectedVersionedCaseCountByProtocol[protocolVersion];
assert.ok(
  expectedVersionedCaseCount !== undefined,
  `No expectedVersionedCaseCount for protocolVersion ${protocolVersion}`,
);
assert.equal(
  versionedCaseCount,
  expectedVersionedCaseCount,
  `Expected ${expectedVersionedCaseCount} versioned fixtures, received ${versionedCaseCount}`,
);

// Core specs must declare applies_to for the current major.minor (V231).
const coreSpecPaths = [
  'docs/01-node-protocol.md',
  'docs/02-reaction-expression.md',
  'docs/03-component-registry.md',
  'docs/04-datasource-contract.md',
  'docs/06-validation.md',
  'docs/07-actions-contract.md',
  'docs/08-renderer-spec.md',
];
const appliesToNeedle = `applies_to: schema-ui-protocol v${protocolVersion}`;
for (const relativePath of coreSpecPaths) {
  const text = readText(relativePath);
  assert.ok(
    text.includes(appliesToNeedle),
    `${relativePath}: frontmatter must include ${appliesToNeedle}`,
  );
  assert.ok(
    !/applies_to:\s*schema-ui-protocol\s+v0\.3\b/.test(text),
    `${relativePath}: stale applies_to v0.3`,
  );
}

if (majorVersion >= 1) {
  const releaseGoals = readText(releaseTarget.releaseGoalsPath);
  const g1ToG4 = releaseGoals.slice(releaseGoals.indexOf('### G1.'), releaseGoals.indexOf('## 3. 发布工程门禁'));
  assert.ok(!g1ToG4.includes('- [ ]'), `G1-G4 must be fully closed for protocolVersion ${protocolVersion}`);
}

if (releaseMode) {
  const expectedRef = `refs/tags/v${rootPackage.version}`;
  assert.equal(process.env.GITHUB_REF, expectedRef, `Release must run from ${expectedRef}`);
}

const fixture = fixtureDigest();
const actualDigest = `sha256:${fixture.digest}`;
assert.equal(
  actualDigest,
  EXPECTED_FIXTURE_DIGEST,
  `fixtureDigest mismatch: got ${actualDigest}, expected ${EXPECTED_FIXTURE_DIGEST}. `
  + 'If the change is intentional, update EXPECTED_FIXTURE_DIGEST in scripts/release-check.js in the same commit.',
);
const protocolArtifact = buildProtocolArtifact();

const result = {
  version: rootPackage.version,
  protocolVersion,
  fixtureVersion: '1.0',
  versionedCaseCount,
  fixtureFileCount: fixture.fileCount,
  fixtureDigest: actualDigest,
  expectedFixtureDigest: EXPECTED_FIXTURE_DIGEST,
  protocolContentDigest: protocolArtifact.contentDigest,
  protocolArtifactDigest: protocolArtifact.artifactDigest,
  protocolArtifactFileCount: protocolArtifact.fileCount,
  gitSha: process.env.GITHUB_SHA || null,
  releaseMode,
};
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-version=${result.protocolVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `fixture-digest=${result.fixtureDigest}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-content-digest=${result.protocolContentDigest}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-artifact-digest=${result.protocolArtifactDigest}\n`);
}
