#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8'));
const versionMatch = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(packageJson.version);
assert.ok(versionMatch, `Unsupported package version: ${packageJson.version}`);
const protocolVersion = `${versionMatch[1]}.${versionMatch[2]}`;
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/fixture-suite.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const fixturesRoot = path.join(root, 'fixtures');

/** Legacy array-format fixture files still allowed under G1–G3 (not versioned suites). */
const ALLOWED_ARRAY_FIXTURE_RELATIVE = new Set([
  'fixtures/query-serialization/cases.json',
]);

const suitePaths = [];
const arrayPaths = [];

for (const entry of fs.readdirSync(fixturesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const filePath = path.join(fixturesRoot, entry.name, 'cases.json');
  if (!fs.existsSync(filePath)) continue;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(parsed)) {
    arrayPaths.push(filePath);
  } else {
    suitePaths.push(filePath);
  }
}

assert.ok(suitePaths.length > 0, 'No versioned fixture suites found');

for (const suitePath of suitePaths) {
  const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
  assert.ok(validate(suite), `${path.relative(root, suitePath)}: ${JSON.stringify(validate.errors)}`);
  const ids = new Set();
  for (const fixture of suite.cases) {
    assert.equal(fixture.category, suite.category, `${fixture.id}: category must match suite category`);
    assert.ok(!ids.has(fixture.id), `${fixture.id}: duplicate fixture id`);
    ids.add(fixture.id);

    // Non-historical suites must declare the current protocol MINOR on each case.
    // version-negotiation retains 0.3 (and other) historical page versions as inputs.
    if (suite.category !== 'version-negotiation') {
      assert.equal(
        fixture.protocolVersion,
        protocolVersion,
        `${fixture.id}: protocolVersion must be "${protocolVersion}" for suite ${suite.category}`,
      );
    }
  }
}

for (const arrayPath of arrayPaths) {
  const relative = path.relative(root, arrayPath).replaceAll('\\', '/');
  assert.ok(
    ALLOWED_ARRAY_FIXTURE_RELATIVE.has(relative),
    `${relative}: array-format fixtures are not on the allowlist; migrate to fixtureVersion suite or add to ALLOWED_ARRAY_FIXTURE_RELATIVE`,
  );
  const fixtures = JSON.parse(fs.readFileSync(arrayPath, 'utf8'));
  assert.ok(Array.isArray(fixtures) && fixtures.length > 0, `${relative}: array fixtures must be non-empty`);
  const ids = new Set();
  for (const fixture of fixtures) {
    assert.equal(typeof fixture.id, 'string', `${relative}: fixture missing string id`);
    assert.ok(fixture.id.length > 0, `${relative}: empty fixture id`);
    assert.ok(!ids.has(fixture.id), `${relative}: duplicate fixture id ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(fixture.input !== undefined, `${relative}/${fixture.id}: missing input`);
    assert.ok(fixture.expected !== undefined, `${relative}/${fixture.id}: missing expected`);
  }
}

// Detect stray cases.json under fixtures that are neither suites nor allowlisted arrays
const discovered = new Set(
  [...suitePaths, ...arrayPaths].map(p => path.relative(root, p).replaceAll('\\', '/')),
);
for (const entry of fs.readdirSync(fixturesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const rel = `fixtures/${entry.name}/cases.json`;
  const abs = path.join(fixturesRoot, entry.name, 'cases.json');
  if (fs.existsSync(abs)) {
    assert.ok(discovered.has(rel), `Unexpected fixture file not validated: ${rel}`);
  }
}

console.log(
  `Fixture suite validation: ${suitePaths.length} versioned suites passed;`
  + ` ${arrayPaths.length} allowlisted array fixture file(s) checked.`,
);
