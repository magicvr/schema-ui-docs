#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { serializeQuery } = require('../reference-js/query-serialization');

const fixturePath = path.resolve(__dirname, '../fixtures/query-serialization/cases.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function decodeFixtureValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && value.$undefined === true
    ? undefined
    : value;
}

for (const fixture of fixtures) {
  const sources = fixture.input.sources.map(source =>
    source.map(([key, value]) => [key, decodeFixtureValue(value)]),
  );
  const actual = serializeQuery(fixture.input.baseUrl, sources);
  assert.deepStrictEqual(actual, fixture.expected, `Query serialization fixture failed: ${fixture.id}`);
}

console.log(`Query serialization conformance: ${fixtures.length} fixtures passed.`);