#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  OFFICIAL_SCENARIO_PATHS,
  CONFORMANCE_SCENARIO_PATHS,
  extractAllYamlFences,
  readOfficialScenario,
} = require('./official-scenarios');
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
  'sha256:89baddbc2879b0c183bcb50fbc730257df5786eee316b645e8238876fe0ca3e7';

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
    releaseGoalsPath: 'docs/release-goals/v1.0.md',
    migrationPath: 'docs/migrations/0.2-0.3-to-1.0.md',
    migrationRequiredTopics: ['protocolVersion', 'legacy adapter', 'query', 'pageSize', 'requestMapping', 'actions.upload'],
  },
  '2.0': {
    releaseGoalsPath: 'docs/release-goals/v2.0.md',
    migrationPath: 'docs/migrations/1.0-to-2.0.md',
    migrationRequiredTopics: ['protocolVersion', 'legacy adapter', 'query', 'pageSize', 'requestMapping', 'actions.upload'],
  },
  '2.1': {
    releaseGoalsPath: 'docs/release-goals/v2.1.md',
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
    releaseGoalsPath: 'docs/release-goals/v2.2.md',
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
    releaseGoalsPath: 'docs/release-goals/v2.3.md',
    migrationPath: 'docs/migrations/2.2-to-2.3.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'permissions.inheritance',
      'permissionCascade',
      'permissionIntent',
    ],
  },
  '2.4': {
    releaseGoalsPath: 'docs/release-goals/v2.4.md',
    migrationPath: 'docs/migrations/2.3-to-2.4.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'record.view.load',
      'recordView',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
    ],
  },
  '2.5': {
    releaseGoalsPath: 'docs/release-goals/v2.5.md',
    migrationPath: 'docs/migrations/2.4-to-2.5.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'app.manifest',
      'app.navigation',
      'table.sort',
      'sortable',
      'defaultSort',
    ],
  },
  '2.6': {
    releaseGoalsPath: 'docs/release-goals/v2.6.md',
    migrationPath: 'docs/migrations/2.5-to-2.6.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'form.controls.extended',
      'textarea',
      'select.mode',
      'multiple',
    ],
  },
  '2.7': {
    releaseGoalsPath: 'docs/release-goals/v2.7.md',
    migrationPath: 'docs/migrations/2.6-to-2.7.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'form.controls.advanced',
      'cascader',
      'checkboxGroup',
      'richText',
      'password',
      'defaultValue',
    ],
  },
  '2.8': {
    releaseGoalsPath: 'docs/release-goals/v2.8.md',
    migrationPath: 'docs/migrations/2.7-to-2.8.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'host.bootstrap',
      'host.failure-recovery',
      'host.conformance-claim',
      'returnIntentQueryKeys',
      'bootstrap',
    ],
  },
  '2.9': {
    releaseGoalsPath: 'docs/release-goals/v2.9.md',
    migrationPath: 'docs/migrations/2.8-to-2.9.md',
    migrationRequiredTopics: [
      'protocolVersion',
      'legacy adapter',
      'query',
      'pageSize',
      'requestMapping',
      'actions.upload',
      'data.route-binding',
      '$context.route',
      'readOnly',
      'form.controls.readonly',
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
  'table-sort',
  'app-manifest',
  'app-navigation',
  'host-bootstrap',
  'host-failure',
  'host-conformance-claim',
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
  // 2.4: base 213（0067 前）+1 record-view-empty-mapping-rejected = 214
  '2.4': 214,
  // 2.5: 282 base (v2.5.0) +1 app-manifest floor +5 nav M3a +4 D1b base matrix = 292 (审计 0071)
  '2.5': 292,
  // 2.6: 292 +3 request-construction +2 response-mapping +4 version-negotiation +2 reactions = 303
  '2.6': 303,
  // 2.7: 303 +3 request-construction +2 response-mapping +3 runtime-defaults +1 reactions +4 version-negotiation = 316
  '2.7': 316,
  // 2.8: 316 +4 app-manifest (returnIntentQueryKeys) +5 version-negotiation
  //      +23 host-bootstrap +43 host-failure +30 host-conformance-claim = 421
  '2.8': 421,
  // 2.9: 421 +6 request-construction (5 dataRef route binding + 1 readonly projection)
  //      +6 version-negotiation (2.9 版本/capability 向量) +1 scenarios (route-filter 内页) = 434
  '2.9': 434,
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
// Include overview + app-manifest (v2.5 authority) so semanticSpecs stay gated (审计 0072 / V346).
const coreSpecPaths = [
  'docs/00-overview.md',
  'docs/01-node-protocol.md',
  'docs/02-reaction-expression.md',
  'docs/03-component-registry.md',
  'docs/04-datasource-contract.md',
  'docs/06-validation.md',
  'docs/07-actions-contract.md',
  'docs/08-renderer-spec.md',
  'docs/09-app-manifest.md',
  'docs/10-host-interoperability.md',
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

// Scenario frontmatter version must match YAML meta.protocolVersion (审计 0071 / V342).
// Accept either `applies_to: schema-ui-protocol vX.Y` or `protocol_version: vX.Y`.
const scenarioDocsForFrontmatter = [
  ...new Set([
    ...CONFORMANCE_SCENARIO_PATHS,
    ...OFFICIAL_SCENARIO_PATHS,
    'docs/05-scenarios/admin-list-batch.md',
    'docs/05-scenarios/permission-inheritance.md',
    // 审计 0075 / V360：v2.6 F1 扩展示例与 batch/permission 同级 frontmatter 门禁
    'docs/05-scenarios/form-controls-extended.md',
    // v2.7 advanced form controls 扩展示例
    'docs/05-scenarios/form-controls-advanced.md',
  ]),
];
for (const relativePath of scenarioDocsForFrontmatter) {
  const text = readText(relativePath);
  const appliesMatch = text.match(/^applies_to:\s*schema-ui-protocol\s+v([0-9]+\.[0-9]+)\s*$/m);
  const protocolVersionMatch = text.match(/^protocol_version:\s*v([0-9]+\.[0-9]+)\s*$/m);
  const frontmatterVersion = (appliesMatch && appliesMatch[1]) || (protocolVersionMatch && protocolVersionMatch[1]);
  assert.ok(
    frontmatterVersion,
    `${relativePath}: missing frontmatter applies_to or protocol_version MAJOR.MINOR`,
  );
  const fences = extractAllYamlFences(text);
  assert.ok(fences.length > 0, `${relativePath}: no yaml fence for version check`);
  let sawPageMetaVersion = false;
  for (const fence of fences) {
    // Prefer regex over full YAML parse: some scenario fences are illustrative fragments.
    const metaVersionMatch = fence.match(/^\s*protocolVersion:\s*["']?([0-9]+\.[0-9]+)["']?\s*$/m);
    if (!metaVersionMatch) continue;
    sawPageMetaVersion = true;
    assert.equal(
      metaVersionMatch[1],
      frontmatterVersion,
      `${relativePath}: frontmatter v${frontmatterVersion} != YAML meta.protocolVersion ${metaVersionMatch[1]}`,
    );
  }
  assert.ok(
    sawPageMetaVersion,
    `${relativePath}: no YAML meta.protocolVersion found to compare with frontmatter`,
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
