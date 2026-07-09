import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { searchProtocol } from '../src/core/search.js';
import { DOC_MAP, getDoc } from '../src/core/protocol-index.js';

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
    } finally {
      DOC_MAP[0]!.absolutePath = originalPath;
      fs.writeFileSync(originalPath, originalContent, 'utf8');
      fs.unlinkSync(tempPath);
    }
  });

  it('searches row scope content with stable protocol docs first', () => {
    const results = searchProtocol('scope row', 10).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(result => result.path === 'docs/02-reaction-expression.md')).toBe(true);
    expect(results[0]).toMatchObject({ path: 'docs/02-reaction-expression.md' });
  });
});
