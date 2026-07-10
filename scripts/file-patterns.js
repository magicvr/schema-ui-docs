'use strict';

const fs = require('fs');
const { globSync } = require('glob');

function normalizeGlobPattern(pattern) {
  return process.platform === 'win32' ? pattern.replace(/\\/g, '/') : pattern;
}

function expandFilePatterns(patterns, cwd = process.cwd()) {
  return patterns.flatMap(pattern => {
    if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) return [pattern];
    return globSync(normalizeGlobPattern(pattern), { cwd });
  });
}

module.exports = { expandFilePatterns, normalizeGlobPattern };