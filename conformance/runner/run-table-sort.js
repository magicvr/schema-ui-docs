#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateTableSort } = require('../reference-js/table-sort');

const fixturePath = path.resolve(__dirname, '../fixtures/table-sort/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    evaluateTableSort(fixture.input),
    fixture.expected,
    `Table sort fixture failed: ${fixture.id}`,
  );
}

console.log(`Table sort conformance: ${suite.cases.length} fixtures passed.`);
