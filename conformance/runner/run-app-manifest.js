#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateAppManifest } = require('../reference-js/app-manifest');

const fixturePath = path.resolve(__dirname, '../fixtures/app-manifest/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    evaluateAppManifest(fixture.input),
    fixture.expected,
    `App manifest fixture failed: ${fixture.id}`,
  );
}

console.log(`App manifest conformance: ${suite.cases.length} fixtures passed.`);
