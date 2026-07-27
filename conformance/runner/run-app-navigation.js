#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateAppNavigation } = require('../reference-js/app-navigation');

const fixturePath = path.resolve(__dirname, '../fixtures/app-navigation/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    evaluateAppNavigation(fixture.input),
    fixture.expected,
    `App navigation fixture failed: ${fixture.id}`,
  );
}

console.log(`App navigation conformance: ${suite.cases.length} fixtures passed.`);
