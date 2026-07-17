#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateComponentFormat } = require('../reference-js/component-format');

const suite = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/component-format/cases.json'), 'utf8'));
for (const fixture of suite.cases) {
  assert.deepStrictEqual(validateComponentFormat(fixture.input), fixture.expected, `Component format fixture failed: ${fixture.id}`);
}
console.log(`Component format conformance: ${suite.cases.length} fixtures passed.`);
