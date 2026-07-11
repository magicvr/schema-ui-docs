#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { executeUpload } = require('../reference-js/upload-execution');

const fixturePath = path.resolve(__dirname, '../fixtures/uploads/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    executeUpload(fixture.input),
    fixture.expected,
    `Upload fixture failed: ${fixture.id}`,
  );
}

console.log(`Upload conformance: ${suite.cases.length} fixtures passed.`);