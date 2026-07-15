#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const validatorPackage = readJson('validator/package.json');
const protocolManifest = readJson('protocol-manifest.json');

assert.match(validatorPackage.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Validator version must be SemVer');
assert.equal(
  validatorPackage.schemaUiProtocol?.artifactVersion,
  protocolManifest.artifactVersion,
  'Validator supported protocol artifactVersion mismatch',
);
assert.equal(
  validatorPackage.schemaUiProtocol?.protocolVersion,
  protocolManifest.protocolVersion,
  'Validator supported protocol protocolVersion mismatch',
);

console.log(JSON.stringify({
  validatorVersion: validatorPackage.version,
  supportedProtocolArtifactVersion: protocolManifest.artifactVersion,
  protocolVersion: protocolManifest.protocolVersion,
}, null, 2));
