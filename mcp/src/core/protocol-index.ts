import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { protocolPath, toProtocolRelative } from './paths.js';

export type DocEntry = {
  docId: string;
  title: string;
  absolutePath: string;
  relativePath: string;
  order: number;
};

export type Section = {
  title: string;
  level: number;
  content: string;
  start: number;
};

export const DOC_MAP: DocEntry[] = [
  ['overview', 'docs/00-overview.md'],
  ['node-protocol', 'docs/01-node-protocol.md'],
  ['reaction-expression', 'docs/02-reaction-expression.md'],
  ['component-registry', 'docs/03-component-registry.md'],
  ['datasource-contract', 'docs/04-datasource-contract.md'],
  ['validation', 'docs/06-validation.md'],
  ['actions-contract', 'docs/07-actions-contract.md'],
  ['renderer-spec', 'docs/08-renderer-spec.md'],
  ['v1-release-goals', 'docs/09-v1-release-goals.md'],
  ['v2-release-goals', 'docs/10-v2-release-goals.md'],
  ['changelog', 'docs/CHANGELOG.md'],
].map(([docId, relativePath], order) => {
  const absolutePath = protocolPath(relativePath);
  return {
    docId,
    title: docId,
    absolutePath,
    relativePath,
    order,
  };
});

export function readMarkdown(entry: DocEntry): string {
  return fs.readFileSync(entry.absolutePath, 'utf8');
}

export function titleFromMarkdown(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

export function getDocEntry(docId: string): DocEntry | undefined {
  return DOC_MAP.find(entry => entry.docId === docId);
}

export function splitSections(markdown: string): Section[] {
  const headingPattern = /^(##|###)\s+(.+)$/gm;
  const matches = [...markdown.matchAll(headingPattern)];
  if (matches.length === 0) {
    return [{ title: '全文', level: 1, content: markdown.trim(), start: 0 }];
  }

  const sections: Section[] = [];

  // 插入第一个 ## 之前的非空内容作为"导言"区段（含 frontmatter、H1 标题与简介）
  const firstHeadingIndex = matches[0].index ?? 0;
  const preamble = markdown.slice(0, firstHeadingIndex).trim();
  if (preamble) {
    sections.push({ title: '导言', level: 0, content: preamble, start: 0 });
  }

  sections.push(...matches.map((match, index) => {
    const start = match.index ?? 0;
    const level = match[1].length;
    const next = matches.slice(index + 1).find(candidate => candidate[1].length <= level);
    const end = next?.index ?? markdown.length;
    return {
      title: match[2].trim().replace(/`/g, ''),
      level,
      content: markdown.slice(start, end).trim(),
      start,
    };
  }));

  return sections;
}

export function getDoc(docId: string, section?: string): {
  docId: string;
  title: string;
  path: string;
  matchedSection: string | null;
  content: string;
  truncated: boolean;
  availableSections?: string[];
} {
  const entry = getDocEntry(docId);
  if (!entry) {
    throw new Error(`未知 docId: ${docId}`);
  }

  const markdown = readMarkdown(entry);
  const title = titleFromMarkdown(markdown, entry.docId);
  let content = markdown.trim();
  let matchedSection: string | null = null;

  if (section?.trim()) {
    const sectionQuery = normalizeText(section);
    const sections = splitSections(markdown);
    const matched = sections.find(item => normalizeText(item.title).includes(sectionQuery));
    if (!matched) {
      throw new Error(`文档 ${docId} 中未找到章节: ${section}`);
    }
    content = matched.content;
    matchedSection = matched.title;
  }

  const maxBytes = 20 * 1024;
  const truncationNotice = '\n\n[内容已截断，请传入更精确的 section，并参考 availableSections]';
  const byteLength = Buffer.byteLength(content, 'utf8');
  const truncated = byteLength > maxBytes;
  const availableSections = truncated ? splitSections(markdown).map(item => item.title) : undefined;
  if (truncated) {
    const noticeBytes = Buffer.byteLength(truncationNotice, 'utf8');
    const contentBuffer = Buffer.from(content, 'utf8');
    let sliceEnd = maxBytes - noticeBytes;
    while (sliceEnd > 0 && (contentBuffer[sliceEnd] & 0xc0) === 0x80) sliceEnd--;
    content = `${contentBuffer.subarray(0, sliceEnd).toString('utf8')}${truncationNotice}`;
  }

  return {
    docId,
    title,
    path: entry.relativePath,
    matchedSection,
    content,
    truncated,
    availableSections,
  };
}

export function listSearchDocs(): DocEntry[] {
  const coreDocs = DOC_MAP;
  const extraPatterns = [
    'docs/05-scenarios/**/*.md',
    'docs/decisions/**/*.md',
    'docs/schemas/*.json',
    'docs/mcp/*.md',
  ];

  const existing = new Set(coreDocs.map(entry => entry.relativePath));
  const extras = extraPatterns
    .flatMap(pattern => globSync(protocolPath(pattern).split(path.sep).join('/'), { nodir: true }))
    .sort((left, right) => toProtocolRelative(left).localeCompare(toProtocolRelative(right)))
    .map((absolutePath, index) => {
      const relativePath = toProtocolRelative(absolutePath);
      return {
        docId: relativePath,
        title: path.basename(relativePath),
        absolutePath,
        relativePath,
        order: DOC_MAP.length + index,
      } satisfies DocEntry;
    })
    .filter(entry => !existing.has(entry.relativePath));

  return [...coreDocs, ...extras];
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[`*_#>[\]().,:;，。：；（）]/g, ' ').replace(/\s+/g, ' ').trim();
}
