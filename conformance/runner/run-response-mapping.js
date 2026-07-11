#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mapResponse } = require('../reference-js/response-mapping');

const fixturePath = path.resolve(__dirname, '../fixtures/response-mapping/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    mapResponse(fixture.input),
    fixture.expected,
    `Response mapping fixture failed: ${fixture.id}`,
  );
}

console.log(`Response mapping conformance: ${suite.cases.length} fixtures passed.`);