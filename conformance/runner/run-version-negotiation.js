#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { negotiateProtocol } = require('../reference-js/version-negotiation');

const fixturePath = path.resolve(__dirname, '../fixtures/version-negotiation/cases.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of fixtures) {
  const actual = negotiateProtocol(fixture.input.pageMeta, fixture.input.rendererSupport);
  assert.deepStrictEqual(actual, fixture.expected, `Version negotiation fixture failed: ${fixture.id}`);
}

console.log(`Version negotiation conformance: ${fixtures.length} fixtures passed.`);