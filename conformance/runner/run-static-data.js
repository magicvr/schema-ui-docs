'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveStaticData } = require('../reference-js/static-data');

const suite = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/static-data/cases.json'), 'utf8'));
for (const fixture of suite.cases) {
  assert.deepStrictEqual(resolveStaticData(fixture.input), fixture.expected, `Static data fixture failed: ${fixture.id}`);
}
console.log(`Static data conformance: ${suite.cases.length} fixtures passed.`);
