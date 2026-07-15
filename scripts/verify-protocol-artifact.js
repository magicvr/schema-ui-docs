#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildProtocolArtifact } = require('./build-protocol-artifact');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-ui-protocol-repro-'));
try {
  const first = buildProtocolArtifact({ outputRoot: path.join(tempRoot, 'first') });
  const second = buildProtocolArtifact({ outputRoot: path.join(tempRoot, 'second') });
  if (first.artifactDigest !== second.artifactDigest || first.contentDigest !== second.contentDigest) {
    throw new Error(`协议制品不可复现: ${first.artifactDigest} != ${second.artifactDigest}`);
  }
  console.log(JSON.stringify({
    reproducible: true,
    artifactVersion: first.artifactVersion,
    protocolVersion: first.protocolVersion,
    contentDigest: first.contentDigest,
    artifactDigest: first.artifactDigest,
    fileCount: first.fileCount,
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
