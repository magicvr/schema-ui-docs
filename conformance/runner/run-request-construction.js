#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildRequest } = require('../reference-js/request-construction');

const fixturePath = path.resolve(__dirname, '../fixtures/request-construction/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    buildRequest(fixture.input),
    fixture.expected,
    `Request construction fixture failed: ${fixture.id}`,
  );
}

console.log(`Request construction conformance: ${suite.cases.length} fixtures passed.`);