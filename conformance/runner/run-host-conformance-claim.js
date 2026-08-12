#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execute } = require('../reference-js/host-conformance-claim');

const fixturePath = path.resolve(__dirname, '../fixtures/host-conformance-claim/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  const actual = execute(fixture.input);
  assert.deepStrictEqual(actual, fixture.expected, `Host conformance claim fixture failed: ${fixture.id}`);
}

console.log(`Host conformance claim conformance: ${suite.cases.length} fixtures passed.`);
