import { describe, expect, it } from 'vitest';
import { searchProtocol } from '../src/core/search.js';
import { getDoc } from '../src/core/protocol-index.js';

describe('protocol docs', () => {
  it('returns whitelisted docs by docId', () => {
    const doc = getDoc('overview');
    expect(doc.path).toBe('docs/00-overview.md');
    expect(doc.content).toContain('Schema-Driven UI');
  });

  it('searches row scope content with stable protocol docs first', () => {
    const results = searchProtocol('scope row', 10).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(result => result.path === 'docs/02-reaction-expression.md')).toBe(true);
    expect(results[0]).toMatchObject({ path: 'docs/02-reaction-expression.md' });
  });
});
