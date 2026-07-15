#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildProtocolArtifact } = require('./build-protocol-artifact');

const root = path.resolve(__dirname, '..');
const releaseMode = process.argv.includes('--release');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const protocolPackage = readJson('package.json');
const protocolManifest = readJson('protocol-manifest.json');
const mcpPackage = readJson('mcp/package.json');
const mcpLock = readJson('mcp/package-lock.json');
const validatorPackage = readJson('validator/package.json');

assert.match(mcpPackage.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'MCP version must be SemVer');
assert.equal(mcpLock.version, mcpPackage.version, 'MCP lockfile version mismatch');
assert.equal(mcpLock.packages[''].version, mcpPackage.version, 'MCP lockfile root package version mismatch');
assert.equal(protocolManifest.artifactVersion, protocolPackage.version, 'Protocol package and manifest version mismatch');
assert.equal(
  mcpPackage.schemaUiProtocol?.artifactVersion,
  protocolManifest.artifactVersion,
  'MCP bundled protocol artifactVersion mismatch',
);
assert.equal(mcpPackage.schemaUiValidator?.version, validatorPackage.version, 'MCP bundled validator version mismatch');
assert.equal(
  mcpPackage.schemaUiProtocol?.protocolVersion,
  protocolManifest.protocolVersion,
  'MCP bundled protocol protocolVersion mismatch',
);

if (releaseMode) {
  const expectedRef = `refs/tags/mcp-v${mcpPackage.version}`;
  assert.equal(process.env.GITHUB_REF, expectedRef, `MCP release must run from ${expectedRef}`);
}

const artifact = buildProtocolArtifact();
const result = {
  mcpVersion: mcpPackage.version,
  bundledProtocolArtifactVersion: protocolManifest.artifactVersion,
  protocolVersion: protocolManifest.protocolVersion,
  protocolContentDigest: artifact.contentDigest,
  protocolArtifactDigest: artifact.artifactDigest,
  bundledValidatorVersion: validatorPackage.version,
  releaseMode,
};
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `mcp-version=${result.mcpVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-version=${result.bundledProtocolArtifactVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protocol-content-digest=${result.protocolContentDigest}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `validator-version=${result.bundledValidatorVersion}\n`);
}
