import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/core/validation-runner.js';
import {
  extractFirstYamlFence,
  missingRowRequestCapabilityYaml,
  missingRowScopeYaml,
  missingUploadCapabilityYaml,
  tableRowReactionForbiddenStateYaml,
  tableVisibleWhenMissingWhenYaml,
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

  it('reports invalid table embedded expression objects through L2', () => {
    const missingWhen = validateContent({
      content: tableVisibleWhenMissingWhenYaml,
      format: 'yaml',
      filename: 'table-visiblewhen.yaml',
    });
    const forbiddenState = validateContent({
      content: tableRowReactionForbiddenStateYaml,
      format: 'yaml',
      filename: 'table-reaction.yaml',
    });

    expect(missingWhen.passed).toBe(false);
    expect(missingWhen.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.columns[0].visibleWhen.when' }),
    ]));
    expect(forbiddenState.passed).toBe(false);
    expect(forbiddenState.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.required' }),
    ]));
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

  it('returns structured internalError objects', () => {
    const result = validateContent({ content: 'a'.repeat(1024 * 1024 + 1), format: 'yaml', filename: 'too-large.yaml' });

    expect(result.passed).toBe(false);
    expect(result.internalError).toMatchObject({ message: 'content 超过 1MB 限制' });
    expect(result.summary).toContain('content 超过 1MB 限制');
  });
});
