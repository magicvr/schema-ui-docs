#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildTableQuery } = require('../reference-js/table-query-state');

const fixturePath = path.resolve(__dirname, '../fixtures/search-table/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    buildTableQuery(fixture.input),
    fixture.expected,
    `Search table fixture failed: ${fixture.id}`,
  );
}

console.log(`Search table conformance: ${suite.cases.length} fixtures passed.`);