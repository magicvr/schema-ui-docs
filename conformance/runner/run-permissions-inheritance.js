#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluatePermissionInheritance } = require('../reference-js/permission-inheritance');

const fixturePath = path.resolve(__dirname, '../fixtures/permissions-inheritance/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    evaluatePermissionInheritance(fixture.input),
    fixture.expected,
    `Permission inheritance fixture failed: ${fixture.id}`,
  );
}

console.log(`Permission inheritance conformance: ${suite.cases.length} fixtures passed.`);
