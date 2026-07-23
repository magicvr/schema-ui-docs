#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildProtocolArtifact } = require('./build-protocol-artifact');

const root = path.resolve(__dirname, '..');
const releaseMode = process.argv.includes('--release');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

/** @returns {string} MAJOR.MINOR from MAJOR.MINOR or full SemVer */
function majorMinor(version) {
  const match = /^(\d+)\.(\d+)(?:\.|$|-)/.exec(String(version || ''));
  assert.ok(match, `version must start with MAJOR.MINOR: ${version}`);
  return `${match[1]}.${match[2]}`;
}

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

// Line alignment: MCP MAJOR.MINOR === protocol line (protocolVersion and artifact MAJOR.MINOR).
// PATCH may diverge so MCP can ship program-only fixes on the same protocol line.
const mcpLine = majorMinor(mcpPackage.version);
const protocolLine = protocolManifest.protocolVersion;
const artifactLine = majorMinor(protocolManifest.artifactVersion);
assert.equal(
  protocolLine,
  artifactLine,
  'protocolVersion must equal artifactVersion MAJOR.MINOR',
);
assert.equal(
  mcpLine,
  protocolLine,
  `MCP MAJOR.MINOR (${mcpLine}) must match bundled protocol line (${protocolLine}); `
    + 'PATCH may evolve independently (e.g. MCP 2.4.1 with protocol 2.4.0)',
);

if (releaseMode) {
  const expectedRef = `refs/tags/mcp-v${mcpPackage.version}`;
  assert.equal(process.env.GITHUB_REF, expectedRef, `MCP release must run from ${expectedRef}`);
}

const artifact = buildProtocolArtifact();
const result = {
  mcpVersion: mcpPackage.version,
  mcpProtocolLine: mcpLine,
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
