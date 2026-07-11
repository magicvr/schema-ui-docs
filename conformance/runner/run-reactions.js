#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runReactionSchedule } = require('../reference-js/reaction-scheduler');

const fixturePath = path.resolve(__dirname, '../fixtures/reactions/cases.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const fixture of suite.cases) {
  assert.deepStrictEqual(
    runReactionSchedule(fixture.input),
    fixture.expected,
    `Reaction fixture failed: ${fixture.id}`,
  );
}

console.log(`Reaction conformance: ${suite.cases.length} fixtures passed.`);