#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildTableQuery } = require('../reference-js/table-query-state');

const fixturePath = path.resolve(__dirname, '../fixtures/table-query-state/cases.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of fixtures) {
  const actual = buildTableQuery(fixture.input);
  assert.deepStrictEqual(actual, fixture.expected, `Table query state fixture failed: ${fixture.id}`);
}

console.log(`Table query state conformance: ${fixtures.length} fixtures passed.`);