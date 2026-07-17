#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateRuntimeDefaults } = require('../reference-js/runtime-defaults');

const suite = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/runtime-defaults/cases.json'), 'utf8'));
for (const fixture of suite.cases) {
  assert.deepStrictEqual(validateRuntimeDefaults(fixture.input), fixture.expected, `Runtime defaults fixture failed: ${fixture.id}`);
}
console.log(`Runtime defaults conformance: ${suite.cases.length} fixtures passed.`);
