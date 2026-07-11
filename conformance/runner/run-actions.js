#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { processActionOutcome } = require('../reference-js/action-outcome');

const fixturePath = path.resolve(__dirname, '../fixtures/actions/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    processActionOutcome(fixture.input),
    fixture.expected,
    `Action fixture failed: ${fixture.id}`,
  );
}

console.log(`Action conformance: ${suite.cases.length} fixtures passed.`);