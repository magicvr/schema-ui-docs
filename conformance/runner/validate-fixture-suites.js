#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/fixture-suite.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const fixturesRoot = path.join(root, 'fixtures');
const suitePaths = fs.readdirSync(fixturesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(fixturesRoot, entry.name, 'cases.json'))
  .filter(filePath => fs.existsSync(filePath))
  .filter(filePath => !Array.isArray(JSON.parse(fs.readFileSync(filePath, 'utf8'))));

assert.ok(suitePaths.length > 0, 'No versioned fixture suites found');
for (const suitePath of suitePaths) {
  const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
  assert.ok(validate(suite), `${path.relative(root, suitePath)}: ${JSON.stringify(validate.errors)}`);
  const ids = new Set();
  for (const fixture of suite.cases) {
    assert.equal(fixture.category, suite.category, `${fixture.id}: category must match suite category`);
    assert.ok(!ids.has(fixture.id), `${fixture.id}: duplicate fixture id`);
    ids.add(fixture.id);
  }
}

console.log(`Fixture suite validation: ${suitePaths.length} versioned suites passed.`);