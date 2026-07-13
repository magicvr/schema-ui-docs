#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function collectMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectMarkdownFiles(absolutePath);
      }
      return entry.isFile() && entry.name.endsWith('.md') ? [absolutePath] : [];
    });
}

function maskText(text) {
  return text.replace(/[^\n]/g, ' ');
}

function maskCodeAndComments(markdown) {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, maskText);
  const lines = withoutComments.match(/.*(?:\n|$)/g) ?? [];
  let fence = null;

  const withoutFences = lines.map(line => {
    const content = line.endsWith('\n') ? line.slice(0, -1) : line;
    const newline = line.endsWith('\n') ? '\n' : '';

    if (fence) {
      const closingFence = new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`);
      if (closingFence.test(content)) {
        fence = null;
      }
      return maskText(content) + newline;
    }

    const openingFence = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (openingFence) {
      fence = {
        character: openingFence[1][0],
        length: openingFence[1].length,
      };
      return maskText(content) + newline;
    }

    return content.replace(/(`+)(.*?)\1/g, maskText) + newline;
  }).join('');

  return withoutFences;
}

function extractDestination(rawDestination) {
  const trimmed = rawDestination.trim();
  if (trimmed.startsWith('<')) {
    const closingBracket = trimmed.indexOf('>');
    return closingBracket === -1 ? trimmed : trimmed.slice(1, closingBracket);
  }
  return trimmed.split(/\s+/, 1)[0].replaceAll('\\ ', ' ');
}

function isRelativeDestination(destination) {
  return destination
    && !destination.startsWith('#')
    && !destination.startsWith('/')
    && !destination.startsWith('//')
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination);
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

const markdownFiles = [
  path.join(root, 'README.md'),
  ...collectMarkdownFiles(path.join(root, 'docs')),
  ...collectMarkdownFiles(path.join(root, 'conformance')),
].filter(fs.existsSync).sort((left, right) => left.localeCompare(right, 'en'));

const missingLinks = [];
let checkedLinkCount = 0;

for (const markdownPath of markdownFiles) {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const scannableMarkdown = maskCodeAndComments(markdown);
  const candidates = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(([^)\n]+)\)/g,
    /^ {0,3}\[[^\]\n]+\]:\s*(\S+)/gm,
    /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of scannableMarkdown.matchAll(pattern)) {
      candidates.push({ destination: extractDestination(match[1]), index: match.index });
    }
  }

  for (const candidate of candidates) {
    if (!isRelativeDestination(candidate.destination)) {
      continue;
    }

    checkedLinkCount += 1;
    const pathWithoutAnchor = candidate.destination.split('#', 1)[0].split('?', 1)[0];
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathWithoutAnchor);
    } catch {
      decodedPath = pathWithoutAnchor;
    }
    const resolvedPath = path.resolve(path.dirname(markdownPath), decodedPath);

    if (!fs.existsSync(resolvedPath)) {
      missingLinks.push({
        source: path.relative(root, markdownPath).replaceAll('\\', '/'),
        line: lineNumberAt(scannableMarkdown, candidate.index),
        destination: candidate.destination,
        resolved: path.relative(root, resolvedPath).replaceAll('\\', '/'),
      });
    }
  }
}

if (missingLinks.length > 0) {
  for (const missingLink of missingLinks) {
    console.error(
      `${missingLink.source}:${missingLink.line}: ${missingLink.destination} -> missing ${missingLink.resolved}`,
    );
  }
  console.error(`Relative link check failed: ${missingLinks.length} missing target(s).`);
  process.exitCode = 1;
} else {
  console.log(
    `Relative link check passed: ${markdownFiles.length} Markdown files, ${checkedLinkCount} relative links.`,
  );
}
