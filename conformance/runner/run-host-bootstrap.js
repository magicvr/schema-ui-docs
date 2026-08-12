#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateBootstrap } = require('../reference-js/host-bootstrap');

const fixturePath = path.resolve(__dirname, '../fixtures/host-bootstrap/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  const actual = evaluateBootstrap(fixture.input);
  assert.deepStrictEqual(actual, fixture.expected, `Host bootstrap fixture failed: ${fixture.id}`);
}

console.log(`Host bootstrap conformance: ${suite.cases.length} fixtures passed.`);
