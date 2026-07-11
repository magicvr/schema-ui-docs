#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOfficialScenario } = require('../../scripts/official-scenarios');
const { executeScenario } = require('../reference-js/scenario-execution');

const protocolRoot = path.resolve(__dirname, '../..');
const fixturePath = path.resolve(__dirname, '../fixtures/scenarios/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  const actual = executeScenario(
    fixture.input,
    relativePath => readOfficialScenario(protocolRoot, relativePath),
  );
  assert.deepStrictEqual(actual, fixture.expected, `Scenario fixture failed: ${fixture.id}`);
}

console.log(`Official scenario execution conformance: ${suite.cases.length} fixtures passed.`);