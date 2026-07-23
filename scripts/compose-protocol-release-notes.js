#!/usr/bin/env node
'use strict';

/**
 * Build dist/RELEASE_NOTES.md for GitHub Protocol Release:
 * CHANGELOG section for the current artifact version + digest lines.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'protocol-manifest.json'), 'utf8'));
const version = manifest.artifactVersion;
const protocolVersion = manifest.protocolVersion;
const changelog = fs.readFileSync(path.join(root, 'docs', 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');

function extractChangelogSection(text, artifactVersion) {
  const lines = text.split('\n');
  const headingPrefix = `## v${artifactVersion}`;
  const start = lines.findIndex(line => line.startsWith(headingPrefix));
  if (start < 0) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

let body = extractChangelogSection(changelog, version);
if (!body) {
  body = `Schema-UI protocol artifact \`${version}\` (page protocol \`${protocolVersion}\`).`;
}

const shaFile = `schema-ui-protocol-${version}.tar.gz.sha256`;
const shaPath = path.join(root, 'dist', shaFile);
let artifactShaLine = '(sha256 file not found under dist/)';
if (fs.existsSync(shaPath)) {
  artifactShaLine = fs.readFileSync(shaPath, 'utf8').trim();
}

const notes = [
  body,
  '',
  '## Digests',
  '',
  `- Artifact: \`${shaFile}\``,
  `- SHA-256: \`${artifactShaLine}\``,
  `- Page protocolVersion: \`${protocolVersion}\``,
  `- Git tag: \`v${version}\``,
  '',
  'Consumers should pin the Git tag or the tar.gz SHA-256. See `docs/RELEASE.md`.',
  '',
].join('\n');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const outPath = path.join(root, 'dist', 'RELEASE_NOTES.md');
fs.writeFileSync(outPath, notes);
console.log(`Wrote ${path.relative(root, outPath)} (${notes.length} chars)`);
