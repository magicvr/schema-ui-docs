import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { searchProtocol } from '../src/core/search.js';
import { DOC_MAP, getDoc } from '../src/core/protocol-index.js';
import { handleGetDoc } from '../src/tools/docs.js';

describe('protocol docs', () => {
  it('returns whitelisted docs by docId', () => {
    const doc = getDoc('overview');
    expect(doc.path).toBe('docs/00-overview.md');
    expect(doc.content).toContain('Schema-Driven UI');
  });

  it('returns available sections when a large doc is truncated', () => {
    const tempPath = path.join(os.tmpdir(), 'schema-ui-mcp-large-doc.md');
    const originalPath = DOC_MAP[0]!.absolutePath;
    const originalContent = fs.readFileSync(originalPath, 'utf8');
    const largeContent = `# 临时大文档\n\n## 第一章\n${'A'.repeat(12 * 1024)}\n\n## 第二章\n${'B'.repeat(12 * 1024)}\n`;

    fs.writeFileSync(tempPath, largeContent, 'utf8');
    DOC_MAP[0]!.absolutePath = tempPath;

    try {
      const doc = getDoc(DOC_MAP[0]!.docId);
      expect(doc.truncated).toBe(true);
      expect(doc.availableSections).toBeDefined();
      expect(doc.availableSections).toContain('第一章');
      expect(doc.availableSections).toContain('第二章');
      expect(doc.content).toContain('availableSections');
      expect(Buffer.byteLength(doc.content, 'utf8')).toBeLessThanOrEqual(20 * 1024);
      expect(doc.content).not.toContain('\uFFFD');
      const toolText = handleGetDoc({ docId: DOC_MAP[0]!.docId }).content[0]!.text;
      expect(Buffer.byteLength(toolText, 'utf8')).toBeLessThanOrEqual(20 * 1024);
      expect(toolText).not.toContain('\uFFFD');
    } finally {
      DOC_MAP[0]!.absolutePath = originalPath;
      fs.writeFileSync(originalPath, originalContent, 'utf8');
      fs.unlinkSync(tempPath);
    }
  });

  it('truncates multibyte content by UTF-8 bytes', () => {
    const tempPath = path.join(os.tmpdir(), 'schema-ui-mcp-multibyte-doc.md');
    const originalPath = DOC_MAP[0]!.absolutePath;
    const largeContent = `# 临时中文文档\n\n## 第一章\n${'中'.repeat(8 * 1024)}\n`;

    fs.writeFileSync(tempPath, largeContent, 'utf8');
    DOC_MAP[0]!.absolutePath = tempPath;

    try {
      const doc = getDoc(DOC_MAP[0]!.docId);
      expect(doc.truncated).toBe(true);
      expect(Buffer.byteLength(doc.content, 'utf8')).toBeLessThanOrEqual(20 * 1024);
      expect(doc.content).not.toContain('\uFFFD');
      expect(doc.availableSections).toContain('第一章');
      const toolText = handleGetDoc({ docId: DOC_MAP[0]!.docId }).content[0]!.text;
      expect(Buffer.byteLength(toolText, 'utf8')).toBeLessThanOrEqual(20 * 1024);
      expect(toolText).not.toContain('\uFFFD');
    } finally {
      DOC_MAP[0]!.absolutePath = originalPath;
      fs.unlinkSync(tempPath);
    }
  });

  it.each(['component-registry', 'renderer-spec'])('limits complete get_doc tool text for %s', docId => {
    const toolText = handleGetDoc({ docId }).content[0]!.text;
    const parsed = JSON.parse(toolText);

    expect(Buffer.byteLength(toolText, 'utf8')).toBeLessThanOrEqual(20 * 1024);
    expect(parsed.truncated).toBe(true);
    expect(parsed.availableSections.length).toBeGreaterThan(0);
    expect(parsed.content).toContain('availableSections');
    expect(parsed.content).not.toContain('\uFFFD');
  });

  it('marks the result truncated when metadata alone pushes tool text over budget', () => {
    const tempPath = path.join(os.tmpdir(), 'schema-ui-mcp-metadata-budget.md');
    const originalPath = DOC_MAP[0]!.absolutePath;
    const content = `# Metadata budget\n\n## Body\n${'A'.repeat((20 * 1024) - 40)}`;

    fs.writeFileSync(tempPath, content, 'utf8');
    DOC_MAP[0]!.absolutePath = tempPath;

    try {
      expect(getDoc(DOC_MAP[0]!.docId).truncated).toBe(false);
      const toolText = handleGetDoc({ docId: DOC_MAP[0]!.docId }).content[0]!.text;
      const parsed = JSON.parse(toolText);
      expect(Buffer.byteLength(toolText, 'utf8')).toBeLessThanOrEqual(20 * 1024);
      expect(parsed.truncated).toBe(true);
      expect(parsed.availableSections).toContain('Body');
      expect(parsed.content).toContain('availableSections');
    } finally {
      DOC_MAP[0]!.absolutePath = originalPath;
      fs.unlinkSync(tempPath);
    }
  });

  it('searches content from the document preamble', () => {
    const results = searchProtocol('唯一涉及 类代码', 10).results;
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'docs/02-reaction-expression.md', section: '导言' }),
    ]));
  });

  it('searches row scope content with stable protocol docs first', () => {
    const results = searchProtocol('scope row', 10).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(result => result.path === 'docs/02-reaction-expression.md')).toBe(true);
    expect(results[0]).toMatchObject({ path: 'docs/02-reaction-expression.md' });
  });
});
