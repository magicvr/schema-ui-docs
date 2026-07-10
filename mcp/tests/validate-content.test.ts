import { afterEach, describe, expect, it } from 'vitest';
import { setLayerScriptExecutorForTest, validateContent } from '../src/core/validation-runner.js';
import {
  chartRefResponseMappingInheritedMissingListYaml,
  chartRefResponseMappingLocalOverrideOkYaml,
  danglingDataRefYaml,
  extractFirstYamlFence,
  invalidTargetTableYaml,
  missingRowRequestCapabilityYaml,
  missingRowScopeYaml,
  missingSubmitActionTargetYaml,
  missingUploadCapabilityYaml,
  nodePermissionSelfYaml,
  tableActionPermissionSelfYaml,
  tableRefResponseMappingInheritedCompleteYaml,
  tableRefResponseMappingInheritedMissingListYaml,
  tableRefResponseMappingMissingListYaml,
  tableRowReactionForbiddenStateYaml,
  tableVisibleWhenMissingWhenYaml,
  unknownContextNamespaceYaml,
  uploadActionRefWrongTypeYaml,
  validAllReferencesYaml,
} from './test-utils.js';

describe('validate_content', () => {
  afterEach(() => {
    setLayerScriptExecutorForTest(null);
  });

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

  it('reports source ref responseMapping semantic errors through L2', () => {
    const result = validateContent({
      content: tableRefResponseMappingMissingListYaml,
      format: 'yaml',
      filename: 'table-ref-response-mapping.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.responseMapping.list' }),
    ]));
  });

  it('reports inherited datasources.responseMapping missing list for table source:ref through L2', () => {
    const result = validateContent({
      content: tableRefResponseMappingInheritedMissingListYaml,
      format: 'yaml',
      filename: 'table-ref-inherited-missing-list.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.responseMapping.list' }),
    ]));
  });

  it('reports inherited datasources.responseMapping missing list for chart source:ref through L2', () => {
    const result = validateContent({
      content: chartRefResponseMappingInheritedMissingListYaml,
      format: 'yaml',
      filename: 'chart-ref-inherited-missing-list.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.responseMapping.list' }),
    ]));
  });

  it('passes table source:ref with complete inherited datasources.responseMapping', () => {
    const result = validateContent({
      content: tableRefResponseMappingInheritedCompleteYaml,
      format: 'yaml',
      filename: 'table-ref-inherited-complete.yaml',
    });

    expect(result.passed).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
  });

  it('passes chart source:ref with local responseMapping override', () => {
    const result = validateContent({
      content: chartRefResponseMappingLocalOverrideOkYaml,
      format: 'yaml',
      filename: 'chart-ref-local-override.yaml',
    });

    expect(result.passed).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
  });

  it('reports permissions variables outside $context and unknown context roots through L3a', () => {
    const actionPermission = validateContent({
      content: tableActionPermissionSelfYaml,
      format: 'yaml',
      filename: 'table-action-permission.yaml',
    });
    const nodePermission = validateContent({
      content: nodePermissionSelfYaml,
      format: 'yaml',
      filename: 'node-permission.yaml',
    });
    const unknownContext = validateContent({
      content: unknownContextNamespaceYaml,
      format: 'yaml',
      filename: 'unknown-context.yaml',
    });

    expect(actionPermission.passed).toBe(false);
    expect(actionPermission.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.actions[0].permissions.view', rule: 'PERM_CONTEXT_ONLY' }),
    ]));
    expect(nodePermission.passed).toBe(false);
    expect(nodePermission.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.permissions.view', rule: 'PERM_CONTEXT_ONLY' }),
    ]));
    expect(unknownContext.passed).toBe(false);
    expect(unknownContext.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.permissions.view', rule: 'UNKNOWN_CONTEXT_NAMESPACE' }),
    ]));
  });

  it('reports missing submitAction target through L2', () => {
    const result = validateContent({
      content: missingSubmitActionTargetYaml,
      format: 'yaml',
      filename: 'missing-submit-action.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.submitAction' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/03-component-registry.md');
  });

  it('reports upload actionRef pointing to non-upload action type', () => {
    const result = validateContent({
      content: uploadActionRefWrongTypeYaml,
      format: 'yaml',
      filename: 'upload-wrong-type.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.actionRef' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/03-component-registry.md');
  });

  it('reports dangling data.ref through L2', () => {
    const result = validateContent({
      content: danglingDataRefYaml,
      format: 'yaml',
      filename: 'dangling-data-ref.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.ref' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/03-component-registry.md');
  });

  it('reports invalid targetTable through L2', () => {
    const result = validateContent({
      content: invalidTargetTableYaml,
      format: 'yaml',
      filename: 'invalid-target-table.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.targetTable' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/03-component-registry.md');
  });

  it('passes valid all references YAML', () => {
    const result = validateContent({
      content: validAllReferencesYaml,
      format: 'yaml',
      filename: 'valid-all-refs.yaml',
    });

    expect(result.passed).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
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

  it('returns internalError when a layer script emits non-json output', () => {
    setLayerScriptExecutorForTest((scriptName) => {
      if (scriptName === 'validate-l2-components.js') return 'not json';
      return JSON.stringify({ violations: [], parseErrors: [] });
    });

    const result = validateContent({
      content: extractFirstYamlFence('docs/05-scenarios/data-table.md'),
      format: 'yaml',
      filename: 'data-table.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.internalError).toMatchObject({ message: '[L2] 无法解析校验脚本 JSON 输出' });
    expect(result.layers.L2).toHaveLength(0);
    expect(result.summary).toContain('校验内部错误');
  });
});
