#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyRequestLifecycle } = require('../reference-js/request-lifecycle');

const fixturePath = path.resolve(__dirname, '../fixtures/request-lifecycle/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    applyRequestLifecycle(fixture.input),
    fixture.expected,
    `Request lifecycle fixture failed: ${fixture.id}`,
  );
}

console.log(`Request lifecycle conformance: ${suite.cases.length} fixtures passed.`);
