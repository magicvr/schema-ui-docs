import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/core/validation-runner.js';
import {
  extractFirstYamlFence,
  missingRowRequestCapabilityYaml,
  missingRowScopeYaml,
  missingUploadCapabilityYaml,
} from './test-utils.js';

describe('validate_content', () => {
  it.each([
    'docs/05-scenarios/data-table.md',
    'docs/05-scenarios/form-with-reactions.md',
    'docs/05-scenarios/grid-dashboard.md',
    'docs/05-scenarios/row-backend-actions.md',
  ])('passes official scenario %s', relativePath => {
    const result = validateContent({
      content: extractFirstYamlFence(relativePath),
      format: 'yaml',
      filename: relativePath,
    });

    expect(result.passed).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
  });

  it('reports L3a scope isolation when $row is used without scope row', () => {
    const result = validateContent({ content: missingRowScopeYaml, format: 'yaml', filename: 'bad-row.yaml' });

    expect(result.passed).toBe(false);
    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'SCOPE_ISOLATION' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/02-reaction-expression.md');
  });

  it('reports missing actions.upload capability', () => {
    const result = validateContent({ content: missingUploadCapabilityYaml, format: 'yaml', filename: 'upload.yaml' });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'meta.requiredCapabilities' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/07-actions-contract.md');
  });

  it('reports missing actions.row.request capability', () => {
    const result = validateContent({ content: missingRowRequestCapabilityYaml, format: 'yaml', filename: 'row-request.yaml' });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'meta.requiredCapabilities' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/03-component-registry.md');
    expect(result.suggestedDocs).toContain('docs/07-actions-contract.md');
  });

  it('maps AJV schema errors into L0/L1', () => {
    const result = validateContent({
      content: `meta:\n  pageId: missing_title\n  protocolVersion: "0.2"\nbody:\n  type: text\n  props:\n    content: Hello\n`,
      format: 'yaml',
      filename: 'missing-title.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(result.suggestedDocs).toContain('docs/01-node-protocol.md');
  });

  it('returns structured parseError for invalid YAML', () => {
    const result = validateContent({ content: 'meta:\n  pageId: [', format: 'yaml', filename: 'broken.yaml' });

    expect(result.passed).toBe(false);
    expect(result.parseError).toMatchObject({ filename: 'broken.yaml' });
    expect(result.layers.L2).toHaveLength(0);
  });
});
