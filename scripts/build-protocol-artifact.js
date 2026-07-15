#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { globSync } = require('glob');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SOURCE_MANIFEST_PATH = path.join(WORKSPACE_ROOT, 'protocol-manifest.json');
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yaml', '.yml']);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function canonicalFileBytes(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (!TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function expandGroup(patterns) {
  const files = patterns.flatMap(pattern => {
    const normalized = pattern.replaceAll('\\', '/');
    if (!/[*?\[\]{}]/.test(normalized)) return [normalized];
    return globSync(normalized, { cwd: WORKSPACE_ROOT, nodir: true })
      .map(filePath => filePath.replaceAll('\\', '/'))
      .sort();
  });
  return [...new Set(files)].sort((left, right) => left.localeCompare(right, 'en'));
}

function collectManifestFiles(sourceManifest) {
  const groups = [
    ['semantic-spec', sourceManifest.authority.semanticSpecs],
    ['structural-contract', sourceManifest.authority.structuralContracts],
    ['behavioral-contract', sourceManifest.authority.behavioralContracts],
    ['scenario', sourceManifest.informative.scenarios],
    ['release-metadata', sourceManifest.informative.releaseMetadata],
  ];
  const roles = new Map();
  for (const [role, patterns] of groups) {
    for (const relativePath of expandGroup(patterns)) {
      if (roles.has(relativePath)) throw new Error(`协议清单文件重复归类: ${relativePath}`);
      roles.set(relativePath, role);
    }
  }
  const selected = [...roles.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([relativePath, role]) => ({ relativePath, role }));
  const excluded = new Set(expandGroup(sourceManifest.excluded ?? []));
  for (const entry of selected) {
    if (excluded.has(entry.relativePath)) throw new Error(`协议清单同时包含并排除文件: ${entry.relativePath}`);
  }
  return selected;
}

function writeOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0');
  buffer.write(text.slice(-(length - 1)), offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function tarHeader(name, size) {
  const nameBytes = Buffer.from(name, 'utf8');
  if (nameBytes.length > 100) throw new Error(`协议制品路径超过 tar name 上限: ${name}`);
  const header = Buffer.alloc(512, 0);
  nameBytes.copy(header, 0);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, '0');
  header.write(checksumText, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function createTar(entries, prefix) {
  const chunks = [];
  for (const entry of entries) {
    const archivePath = `${prefix}/${entry.path}`;
    chunks.push(tarHeader(archivePath, entry.bytes.length));
    chunks.push(entry.bytes);
    const remainder = entry.bytes.length % 512;
    if (remainder) chunks.push(Buffer.alloc(512 - remainder, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

function buildProtocolArtifact(options = {}) {
  const outputRoot = path.resolve(options.outputRoot || path.join(WORKSPACE_ROOT, 'dist'));
  const sourceManifest = JSON.parse(fs.readFileSync(SOURCE_MANIFEST_PATH, 'utf8'));
  const rootPackage = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8'));
  if (rootPackage.version !== sourceManifest.artifactVersion) {
    throw new Error(`协议制品版本不一致: package=${rootPackage.version}, manifest=${sourceManifest.artifactVersion}`);
  }

  const selected = collectManifestFiles(sourceManifest);
  const fileEntries = selected.map(({ relativePath, role }) => {
    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`协议清单文件不存在: ${relativePath}`);
    const bytes = canonicalFileBytes(absolutePath);
    return { path: relativePath, role, bytes, sha256: sha256(bytes) };
  });
  const contentHash = crypto.createHash('sha256');
  for (const entry of fileEntries) {
    contentHash.update(entry.path, 'utf8');
    contentHash.update('\0');
    contentHash.update(entry.sha256, 'ascii');
    contentHash.update('\0');
  }

  const generatedManifest = {
    manifestVersion: sourceManifest.manifestVersion,
    name: sourceManifest.name,
    artifactVersion: sourceManifest.artifactVersion,
    protocolVersion: sourceManifest.protocolVersion,
    authority: sourceManifest.authority,
    informative: sourceManifest.informative,
    excluded: sourceManifest.excluded,
    contentDigest: `sha256:${contentHash.digest('hex')}`,
    files: fileEntries.map(({ path: filePath, role, bytes, sha256: digest }) => ({
      path: filePath,
      role,
      bytes: bytes.length,
      sha256: digest,
    })),
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(generatedManifest, null, 2)}\n`, 'utf8');
  const archiveEntries = [
    ...fileEntries.map(entry => ({ path: entry.path, bytes: entry.bytes })),
    { path: 'manifest.json', bytes: manifestBytes },
  ].sort((left, right) => left.path.localeCompare(right.path, 'en'));

  fs.mkdirSync(outputRoot, { recursive: true });
  const expandedRoot = path.join(outputRoot, 'protocol');
  fs.rmSync(expandedRoot, { recursive: true, force: true });
  for (const entry of archiveEntries) {
    const target = path.join(expandedRoot, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.bytes);
  }

  const baseName = `${sourceManifest.name}-${sourceManifest.artifactVersion}`;
  const tar = createTar(archiveEntries, baseName);
  const archiveBytes = zlib.gzipSync(tar, { level: 9, mtime: 0 });
  archiveBytes[9] = 255; // Normalize gzip OS byte across Windows/Linux builders.
  const archivePath = path.join(outputRoot, `${baseName}.tar.gz`);
  fs.rmSync(archivePath, { force: true });
  fs.rmSync(`${archivePath}.sha256`, { force: true });
  fs.writeFileSync(archivePath, archiveBytes);
  const artifactDigest = `sha256:${sha256(archiveBytes)}`;
  fs.writeFileSync(`${archivePath}.sha256`, `${artifactDigest.slice(7)}  ${path.basename(archivePath)}\n`, 'utf8');

  return {
    artifactVersion: sourceManifest.artifactVersion,
    protocolVersion: sourceManifest.protocolVersion,
    contentDigest: generatedManifest.contentDigest,
    artifactDigest,
    fileCount: fileEntries.length,
    archivePath,
    expandedRoot,
  };
}

if (require.main === module) {
  const outputArg = process.argv.find(argument => argument.startsWith('--output='));
  const result = buildProtocolArtifact({ outputRoot: outputArg?.slice('--output='.length) });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { buildProtocolArtifact, collectManifestFiles };
