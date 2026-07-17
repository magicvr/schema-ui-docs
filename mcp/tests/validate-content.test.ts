import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_ROOT, VALIDATOR_ROOT } from '../src/core/paths.js';
import {
  setLayerScriptExecutorForTest,
  setTempDirCreatorForTest,
  setTempDirRemoverForTest,
  validateContent,
} from '../src/core/validation-runner.js';
import { handleValidateContent } from '../src/tools/validate-content.js';
import type { ValidateContentResult } from '../src/types.js';
import {
  chartRefResponseMappingInheritedMissingListYaml,
  chartRefResponseMappingLocalOverrideOkYaml,
  danglingDataRefYaml,
  datasourceParamsResponseMappingYaml,
  invalidTargetTableYaml,
  missingRowRequestCapabilityYaml,
  missingRowScopeYaml,
  missingSubmitActionTargetYaml,
  missingUploadCapabilityYaml,
  nodeParamsResponseMappingOnlyYaml,
  nodeParamsResponseMappingYaml,
  nodePermissionSelfYaml,
  formVisibleWhenSelfYaml,
  tableActionFormScopeSelfYaml,
  tableActionPermissionSelfYaml,
  tableRefResponseMappingInheritedCompleteYaml,
  tableRefResponseMappingInheritedMissingListYaml,
  tableRefResponseMappingMissingListYaml,
  tableFormScopeReactionForbiddenStateYaml,
  tableRowReactionForbiddenStateYaml,
  tableVisibleWhenMissingWhenYaml,
  unknownContextNamespaceYaml,
  uploadActionRefWrongTypeYaml,
  validAllReferencesYaml,
} from './test-utils.js';

type OfficialScenariosModule = {
  OFFICIAL_SCENARIO_PATHS: string[];
  readOfficialScenario: (protocolRoot: string, relativePath: string) => string;
};

const require = createRequire(import.meta.url);
const { OFFICIAL_SCENARIO_PATHS, readOfficialScenario } = require('../../scripts/official-scenarios.js') as OfficialScenariosModule;

describe('validate_content', () => {
  afterEach(() => {
    setLayerScriptExecutorForTest(null);
    setTempDirCreatorForTest(null);
    setTempDirRemoverForTest(null);
    vi.restoreAllMocks();
  });

  it.each(OFFICIAL_SCENARIO_PATHS)('passes official scenario %s', relativePath => {
    const result = validateContent({
      content: readOfficialScenario(PROTOCOL_ROOT, relativePath),
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

  it('rejects required/value on table column and action reactions even with scope form', () => {
    const result = validateContent({
      content: tableFormScopeReactionForbiddenStateYaml,
      format: 'yaml',
      filename: 'table-form-scope-reaction.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.required' }),
      expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.value' }),
      expect.objectContaining({ path: 'body.props.actions[0].reactions[0].fulfill.value' }),
    ]));
  });

  it.each([
    ['string', 'not-a-node'],
    ['null', null],
    ['boolean', false],
    ['number', 0],
    ['array', []],
  ])('rejects %s tabs content as a non-Node value', (_label, content) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'tabs-content', title: 'Tabs content', protocolVersion: '0.2' },
        body: {
          type: 'tabs',
          props: { items: [{ key: 'main', label: 'Main', content }] },
        },
      }),
      format: 'json',
      filename: 'tabs-content.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.items[0].content' }),
    ]));
    expect(result.parseError).toBeNull();
  });

  it('validates a complete Node nested in tabs content', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'tabs-node', title: 'Tabs Node', protocolVersion: '0.2' },
        body: {
          type: 'tabs',
          props: {
            items: [{
              key: 'main',
              label: 'Main',
              content: { type: 'input', props: { field: 'name' } },
            }],
          },
        },
      }),
      format: 'json',
      filename: 'tabs-node.json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'body.props.items[0].content.props',
        message: expect.stringContaining('label 或 labelKey'),
      }),
    ]));
  });

  it.each([
    ['null', null],
    ['string', 'invalid'],
    ['array', []],
  ])('keeps %s props as a structural violation instead of a parse error', (_label, props) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'invalid-props', title: 'Invalid props', protocolVersion: '0.2' },
        body: { type: 'grid', props, children: [] },
      }),
      format: 'json',
      filename: 'invalid-props.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
  });

  it.each([
    ['columns object', { columns: {} }],
    ['columns string', { columns: 'invalid' }],
    ['columns null', { columns: null }],
    ['actions object', { actions: {} }],
    ['actions string', { actions: 'invalid' }],
    ['actions null', { actions: null }],
  ])('keeps invalid table %s as a structural violation instead of a parse error', (_label, tableProps) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'invalid-table-array', title: 'Invalid table array', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            ...tableProps,
          },
        },
      }),
      format: 'json',
      filename: 'invalid-table-array.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers['L0/L1'].length + result.layers.L2.length).toBeGreaterThan(0);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
  });

  it('maps layered violations to the caller filename', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'filename-test', title: 'Filename test', protocolVersion: '0.2' },
        body: { type: 'unknown', props: { color: 'red' } },
      }),
      format: 'json',
      filename: 'pages/caller.json',
    });

    expect(result.layers.L2[0]?.file).toBe('pages/caller.json');
    expect(result.layers.L4[0]?.file).toBe('pages/caller.json');
    expect(JSON.stringify(result.layers)).not.toContain('schema-ui-mcp-');
  });

  it('omits internal temporary paths when filename is absent', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'filename-test', title: 'Filename test', protocolVersion: '0.2' },
        body: { type: 'unknown', props: {} },
      }),
      format: 'json',
    });

    expect(result.layers.L2[0]?.file).toBeUndefined();
    expect(JSON.stringify(result.layers)).not.toContain('schema-ui-mcp-');
  });

  it.each([
    ['$row.', ['$row.']],
    ['$row..status', ['status']],
  ])('rejects malformed row variable %s regardless of dependencies', (expression, dependencies) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'malformed-row', title: 'Malformed row', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{
              field: 'id',
              label: 'ID',
              visibleWhen: { scope: 'row', dependencies, when: `${expression} == 'ok'` },
            }],
          },
        },
      }),
      format: 'json',
      filename: 'malformed-row.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'SYNTAX' }),
    ]));
  });

  it('rejects source api datasources carrying static value', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'api-value', title: 'API value', protocolVersion: '0.2' },
        datasources: { badApi: { source: 'api', url: '/api/value', value: 1 } },
        body: { type: 'text', props: { content: 'Value' } },
      }),
      format: 'json',
      filename: 'api-value.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers['L0/L1'].length).toBeGreaterThan(0);
  });

  it('rejects row scope on ordinary nodes and undeclared row dependencies', () => {
    const ordinaryNode = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'row-mount', title: 'Row mount', protocolVersion: '0.2' },
        body: {
          type: 'input',
          props: { field: 'status', label: 'Status' },
          reactions: [{
            scope: 'row',
            dependencies: ['status'],
            when: "$row.status == 'ok'",
            fulfill: { visible: true },
          }],
        },
      }),
      format: 'json',
      filename: 'row-mount.json',
    });
    const missingDependency = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'row-dependency', title: 'Row dependency', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{
              field: 'id',
              label: 'ID',
              visibleWhen: { scope: 'row', dependencies: [], when: "$row.status == 'ok'" },
            }],
          },
        },
      }),
      format: 'json',
      filename: 'row-dependency.json',
    });

    expect(ordinaryNode.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'ROW_SCOPE_MOUNT' }),
    ]));
    expect(missingDependency.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'UNDECLARED_ROW_DEP' }),
    ]));
  });

  it('rejects unknown form dependency roots in nested children and tabs content', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'unknown-form-deps', title: 'Unknown form deps', protocolVersion: '0.2' },
        actions: { submit: { type: 'request', method: 'POST', url: '/submit' } },
        body: {
          type: 'form',
          props: { title: 'Form', submitAction: 'submit' },
          children: [
            { type: 'input', props: { field: 'known', label: 'Known' } },
            {
              type: 'input',
              props: { field: 'child', label: 'Child' },
              visibleWhen: { dependencies: ['typo'], when: '$deps.typo == true' },
            },
            {
              type: 'tabs',
              props: {
                items: [{
                  key: 'details',
                  label: 'Details',
                  content: {
                    type: 'input',
                    props: { field: 'nested', label: 'Nested' },
                    visibleWhen: { dependencies: ['missing'], when: '$deps.missing == true' },
                  },
                }],
              },
            },
          ],
        },
      }),
      format: 'json',
      filename: 'unknown-form-deps.json',
    });

    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[1].visibleWhen.when', rule: 'UNKNOWN_FORM_FIELD' }),
      expect.objectContaining({ path: 'body.children[2].props.items[0].content.visibleWhen.when', rule: 'UNKNOWN_FORM_FIELD' }),
    ]));
  });

  it('uses exact nested row dependency paths', () => {
    const makePage = (dependencies: string[]) => JSON.stringify({
      meta: { pageId: 'nested-row-dep', title: 'Nested row dependency', protocolVersion: '0.2' },
      body: {
        type: 'table',
        props: {
          rowKey: 'id',
          pagination: { mode: 'none' },
          columns: [{
            field: 'id',
            label: 'ID',
            visibleWhen: {
              scope: 'row',
              dependencies,
              when: "$row.customer.status == 'active'",
            },
          }],
        },
      },
    });
    const exact = validateContent({ content: makePage(['customer.status']), format: 'json' });
    const parentOnly = validateContent({ content: makePage(['customer']), format: 'json' });

    expect(exact.passed).toBe(true);
    expect(parentOnly.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'UNDECLARED_ROW_DEP' }),
    ]));
  });

  it('allows only context variables in non-form visibleWhen', () => {
    const makePage = (when: string) => JSON.stringify({
      meta: { pageId: 'non-form-visible', title: 'Non-form visible', protocolVersion: '0.2' },
      body: { type: 'text', props: { content: 'Status' }, visibleWhen: { when } },
    });
    const valid = validateContent({ content: makePage('$context.features.beta == true'), format: 'json' });
    const invalidExpressions = [
      '$self == true',
      '$deps.status == true',
      '$row.status == true',
      '$parentRow.status == true',
    ];

    expect(valid.passed).toBe(true);
    for (const expression of invalidExpressions) {
      const invalid = validateContent({ content: makePage(expression), format: 'json' });
      expect(invalid.layers.L3a).toEqual(expect.arrayContaining([
        expect.objectContaining({ rule: 'NON_FORM_VISIBLEWHEN' }),
      ]));
    }
  });

  it('rejects $self in form-context visibleWhen', () => {
    const result = validateContent({
      content: formVisibleWhenSelfYaml,
      format: 'yaml',
      filename: 'form-visiblewhen-self.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'FORM_VISIBLEWHEN_VARS' }),
    ]));
  });

  it('rejects $self on table actions with scope form', () => {
    const result = validateContent({
      content: tableActionFormScopeSelfYaml,
      format: 'yaml',
      filename: 'table-action-form-self.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'TABLE_ACTION_NO_SELF' }),
    ]));
  });

  it('rejects composite query params before variable evaluation', () => {
    const makePage = (owners: unknown) => JSON.stringify({
      meta: { pageId: 'params-array', title: 'Params array', protocolVersion: '0.2' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type: 'table',
          props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
          data: { source: 'api', url: '/orders', params: { owners } },
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });
    const arrayValue = validateContent({ content: makePage(['$deps.ownerId', 'fixed']), format: 'json' });
    const nestedDatasourceKey = validateContent({
      content: makePage({ 'datasources.fake': { nested: '$row.id' } }),
      format: 'json',
    });

    expect(arrayValue.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(nestedDatasourceKey.layers['L0/L1'].length).toBeGreaterThan(0);

    const optionsSource = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'options-array', title: 'Options array', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'select',
            props: {
              field: 'owner',
              label: 'Owner',
              optionsSource: {
                url: '/owners',
                params: { ids: ['$row.id'] },
                labelField: 'name',
                valueField: 'id',
              },
            },
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
    });
    const optionsSourceTemplate = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'options-template', title: 'Options template', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'select',
            props: {
              field: 'owner',
              label: 'Owner',
              optionsSource: {
                url: '/owners',
                params: { keyword: 'prefix-$deps.owner' },
                labelField: 'name',
                valueField: 'id',
              },
            },
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
    });
    const datasource = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'datasource-array', title: 'Datasource array', protocolVersion: '0.2' },
        datasources: { owners: { source: 'api', url: '/owners', params: { ids: ['$deps.owner'] } } },
        body: { type: 'text', props: { content: 'Owners' } },
      }),
      format: 'json',
    });
    const datasourceTemplate = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'datasource-template', title: 'Datasource template', protocolVersion: '0.2' },
        datasources: { owners: { source: 'api', url: '/owners', params: { keyword: 'prefix-$deps.owner' } } },
        body: { type: 'text', props: { content: 'Owners' } },
      }),
      format: 'json',
    });

    expect(optionsSource.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.optionsSource.params.ids' }),
    ]));
    expect(optionsSourceTemplate.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'body.children[0].props.optionsSource.params.keyword',
        rule: 'DATA_PARAMS_VARIABLE',
      }),
    ]));
    expect(datasource.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(datasourceTemplate.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'datasources.owners.params.keyword',
        rule: 'DATA_PARAMS_VARIABLE',
        message: expect.stringContaining('datasources'),
      }),
    ]));
  });

  it('enforces scalar query maps for options and row actions', () => {
    const optionsPage = (params: Record<string, unknown>) => JSON.stringify({
      meta: { pageId: 'options-query-scalars', title: 'Options query scalars', protocolVersion: '0.3' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type: 'select',
          props: {
            field: 'owner',
            label: 'Owner',
            optionsSource: { url: '/owners', params, labelField: 'name', valueField: 'id' },
          },
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });
    const validOptions = validateContent({
      content: optionsPage({ text: '', count: 1.5, enabled: false, empty: null, owner: '$deps.owner' }),
      format: 'json',
    });
    const objectOptions = validateContent({ content: optionsPage({ filter: { status: 'open' } }), format: 'json' });
    const emptyKeyOptions = validateContent({ content: optionsPage({ '': 'value' }), format: 'json' });

    const rowPage = (queryYaml: string) => `
meta:
  pageId: row-query-scalars
  title: Row query scalars
  protocolVersion: "0.3"
  requiredCapabilities: [actions.row.request]
actions:
  load:
    type: request
    method: GET
    url: /items
body:
  type: table
  props:
    rowKey: id
    pagination: { mode: none }
    columns: [{ field: id, label: ID }]
    actions:
      - key: load
        label: Load
        actionRef: load
        requestMapping:
          query:
${queryYaml}
  data: { source: static, value: [] }
`;
    const validRow = validateContent({
      content: rowPage('            text: ""\n            count: 1.5\n            enabled: true\n            empty: null\n            id: $row.id'),
      format: 'yaml',
    });
    const arrayRow = validateContent({ content: rowPage('            ids: [1, 2]'), format: 'yaml' });
    const infiniteRow = validateContent({ content: rowPage('            count: .inf'), format: 'yaml' });

    expect(validOptions.passed).toBe(true);
    expect(objectOptions.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.optionsSource.params.filter' }),
    ]));
    expect(emptyKeyOptions.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.optionsSource.params.' }),
    ]));
    expect(validRow.passed).toBe(true);
    expect(arrayRow.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.actions[0].requestMapping.query.ids' }),
    ]));
    expect(infiniteRow.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.actions[0].requestMapping.query.count' }),
    ]));
  });

  it('allows dateRangePicker self properties and rejects them on other components', () => {
    const makePage = (type: string, expression: string) => JSON.stringify({
      meta: { pageId: 'self-property', title: 'Self property', protocolVersion: '0.2' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type,
          props: type === 'dateRangePicker'
            ? { startField: 'from', endField: 'to', label: 'Range' }
            : { field: 'from', label: 'From' },
          reactions: [{
            dependencies: [],
            when: expression,
            fulfill: { visible: true },
          }],
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });

    const valid = validateContent({
      content: makePage('dateRangePicker', "$self.start < '2026-01-01' && $self.end != null"),
      format: 'json',
      filename: 'date-range-self.json',
    });
    const unknownProperty = validateContent({
      content: makePage('dateRangePicker', '$self.unknown != null'),
      format: 'json',
      filename: 'date-range-unknown-self.json',
    });
    const wrongComponent = validateContent({
      content: makePage('input', '$self.start != null'),
      format: 'json',
      filename: 'input-self-property.json',
    });
    const fakeNamespace = validateContent({
      content: makePage('input', '$selfish != null'),
      format: 'json',
      filename: 'fake-self-namespace.json',
    });

    expect(valid.passed).toBe(true);
    expect(unknownProperty.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'SELF_PROPERTY_SCOPE' }),
    ]));
    expect(wrongComponent.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'SELF_PROPERTY_SCOPE' }),
    ]));
    expect(fakeNamespace.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'UNKNOWN_VARIABLE' }),
    ]));
  });

  it('requires visibleWhen dependencies only inside form context', () => {
    const formMissingDependencies = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'form-visible', title: 'Form visible', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'input',
            props: { field: 'name', label: 'Name' },
            visibleWhen: { when: '$context.features.beta == true' },
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
      filename: 'form-visible.json',
    });
    const formEmptyDependencies = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'form-visible-empty', title: 'Form visible empty', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'input',
            props: { field: 'name', label: 'Name' },
            visibleWhen: { dependencies: [], when: '$context.features.beta == true' },
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
      filename: 'form-visible-empty.json',
    });
    const nonForm = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'page-visible', title: 'Page visible', protocolVersion: '0.2' },
        body: {
          type: 'text',
          props: { content: 'Beta' },
          visibleWhen: { when: '$context.features.beta == true' },
        },
      }),
      format: 'json',
      filename: 'page-visible.json',
    });
    const embeddedTable = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'form-table-visible', title: 'Form table visible', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { mode: 'search', targetTable: 'orders' },
          children: [{
            type: 'table',
            id: 'orders',
            props: {
              rowKey: 'id',
              pagination: { mode: 'none' },
              columns: [{
                field: 'id',
                label: 'ID',
                visibleWhen: { when: '$context.features.beta == true' },
              }],
            },
          }],
        },
      }),
      format: 'json',
      filename: 'form-table-visible.json',
    });

    expect(formMissingDependencies.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].visibleWhen.dependencies' }),
    ]));
    expect(formEmptyDependencies.passed).toBe(true);
    expect(nonForm.passed).toBe(true);
    expect(embeddedTable.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.columns[0].visibleWhen.dependencies' }),
    ]));
  });

  it('rejects parentRow expressions until a nested table mount is defined', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'parent-row', title: 'Parent row', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{
              field: 'id',
              label: 'ID',
              visibleWhen: {
                scope: 'row',
                dependencies: ['status'],
                when: "$parentRow.status == 'active'",
              },
            }],
          },
        },
      }),
      format: 'json',
      filename: 'parent-row.json',
    });

    expect(result.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'PARENT_ROW_UNSUPPORTED' }),
    ]));
  });

  it('rejects chained comparisons but allows comparisons separated by logic', () => {
    const makePage = (expression: string) => JSON.stringify({
      meta: { pageId: 'comparison-chain', title: 'Comparison chain', protocolVersion: '0.2' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type: 'input',
          props: { field: 'roles', label: 'Roles' },
          reactions: [{
            dependencies: ['roles'],
            when: expression,
            fulfill: { visible: true },
          }],
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });

    const chained = validateContent({
      content: makePage("$deps.roles contains 'admin' contains true"),
      format: 'json',
      filename: 'comparison-chain.json',
    });
    const logical = validateContent({
      content: makePage("$deps.roles contains 'admin' && $deps.roles != null"),
      format: 'json',
      filename: 'comparison-logic.json',
    });

    expect(chained.layers.L3a).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'SYNTAX', message: expect.stringContaining('不支持链式使用') }),
    ]));
    expect(logical.passed).toBe(true);
  });

  it('requires a literal right operand for contains', () => {
    const makePage = (expression: string) => JSON.stringify({
      meta: { pageId: 'contains-operand', title: 'Contains operand', protocolVersion: '0.2' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type: 'input',
          props: { field: 'roles', label: 'Roles' },
          reactions: [{
            dependencies: ['roles', 'targetRole'],
            when: expression,
            fulfill: { visible: true },
          }],
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });

    for (const expression of [
      "$deps.roles contains 'admin'",
      '$deps.roles contains 1',
      '$deps.roles contains true',
      '$deps.roles contains null',
    ]) {
      const result = validateContent({ content: makePage(expression), format: 'json' });
      expect(result.passed).toBe(true);
    }

    for (const expression of [
      '$deps.roles contains $deps.targetRole',
      '$deps.roles contains ($deps.targetRole)',
    ]) {
      const result = validateContent({ content: makePage(expression), format: 'json' });
      expect(result.layers.L3a).toEqual(expect.arrayContaining([
        expect.objectContaining({
          rule: 'SYNTAX',
          message: expect.stringContaining('contains 的右操作数必须'),
        }),
      ]));
    }
  });

  it('treats tagMap keys as data while still scanning mapping entries', () => {
    const makePage = (mappingEntry: object) => JSON.stringify({
      meta: { pageId: 'tag-map', title: 'Tag map', protocolVersion: '0.2' },
      body: {
        type: 'table',
        props: {
          rowKey: 'id',
          pagination: { mode: 'none' },
          columns: [{
            field: 'status',
            label: 'Status',
            format: 'tag',
            tagMap: { color: mappingEntry, width: { text: 'Wide', tone: 'info' } },
          }],
        },
      },
    });

    const valid = validateContent({
      content: makePage({ text: 'Color', tone: 'neutral' }),
      format: 'json',
      filename: 'tag-map-valid.json',
    });
    const invalidEntry = validateContent({
      content: makePage({ text: 'Color', tone: 'neutral', color: 'red' }),
      format: 'json',
      filename: 'tag-map-invalid.json',
    });

    expect(valid.passed).toBe(true);
    expect(invalidEntry.layers.L4).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.columns[0].tagMap.color.color' }),
    ]));
  });

  it('treats request parameter map keys as business data in L4', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'business-map', title: 'Business map', protocolVersion: '0.2' },
        body: {
          type: 'select',
          props: {
            field: 'theme',
            label: 'Theme',
            optionsSource: { url: '/themes', params: { color: 'red', width: 100 } },
          },
        },
      }),
      format: 'json',
      filename: 'business-map.json',
    });

    expect(result.layers.L4).toEqual([]);
  });

  it('treats select option values as opaque business data in L4', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'option-value', title: 'Option value', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'select',
            props: {
              field: 'theme',
              label: 'Theme',
              options: [{ label: 'Red', value: { color: 'red', width: 10 } }],
            },
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
    });

    expect(result.passed).toBe(true);
    expect(result.layers.L4).toEqual([]);
  });

  it('rejects missing nested required component fields and duplicate node ids', () => {
    const missingPaginationMode = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'nested-required', title: 'Nested required', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: { rowKey: 'id', pagination: {}, columns: [{ field: 'id', label: 'ID' }] },
        },
      }),
      format: 'json',
      filename: 'nested-required.json',
    });
    const duplicateId = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'duplicate-id', title: 'Duplicate ID', protocolVersion: '0.2' },
        body: {
          type: 'grid',
          props: { columns: 2 },
          children: [
            { type: 'text', id: 'same', props: { content: 'A' } },
            { type: 'text', id: 'same', props: { content: 'B' } },
          ],
        },
      }),
      format: 'json',
      filename: 'duplicate-id.json',
    });

    expect(missingPaginationMode.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.pagination.mode' }),
    ]));
    expect(duplicateId.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[1].id' }),
    ]));
  });

  it('supports table titleKey and validates real ISO date boundaries', () => {
    const table = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'table-title-key', title: 'Table title key', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: {
            titleKey: 'orders.title',
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{ field: 'id', label: 'ID' }],
          },
        },
      }),
      format: 'json',
    });
    const validDate = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'valid-date', title: 'Valid date', protocolVersion: '0.2' },
        body: { type: 'datePicker', props: { field: 'due', label: 'Due', min: '2024-02-29' } },
      }),
      format: 'json',
    });
    const invalidDate = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'invalid-date', title: 'Invalid date', protocolVersion: '0.2' },
        body: {
          type: 'dateRangePicker',
          props: { startField: 'from', endField: 'to', label: 'Range', max: '2026-02-30' },
        },
      }),
      format: 'json',
    });

    expect(table.passed).toBe(true);
    expect(validDate.passed).toBe(true);
    expect(invalidDate.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.max', message: expect.stringContaining('YYYY-MM-DD') }),
    ]));
  });

  it.each(['2026/01/01', '2026-13-01', '2026-02-30', '2023-02-29'])(
    'rejects invalid ISO date boundary %s',
    boundary => {
      const result = validateContent({
        content: JSON.stringify({
          meta: { pageId: 'invalid-boundary', title: 'Invalid boundary', protocolVersion: '0.2' },
          body: { type: 'datePicker', props: { field: 'due', label: 'Due', min: boundary } },
        }),
        format: 'json',
      });
      expect(result.layers.L2).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'body.props.min' }),
      ]));
    },
  );

  it.each([
    ['pagination', {
      type: 'table',
      props: {
        rowKey: 'id',
        pagination: { mode: 'none', unexpected: true },
        columns: [{ field: 'id', label: 'ID' }],
      },
    }, 'body.props.pagination.unexpected'],
    ['tabs item', {
      type: 'tabs',
      props: {
        items: [{
          key: 'summary',
          label: 'Summary',
          content: { type: 'text', props: { content: 'Summary' } },
          unexpected: true,
        }],
      },
    }, 'body.props.items[0].unexpected'],
    ['select option', {
      type: 'form',
      props: { submitAction: 'save' },
      children: [{
        type: 'select',
        props: {
          field: 'kind',
          label: 'Kind',
          options: [{ label: 'A', value: 'a', unexpected: true }],
        },
      }],
    }, 'body.children[0].props.options[0].unexpected'],
  ])('rejects unknown fields in closed nested DSL object %s', (_name, body, expectedPath) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'closed-nested', title: 'Closed nested', protocolVersion: '0.2' },
        body,
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
      filename: 'closed-nested.json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expectedPath }),
    ]));
  });

  it('supports i18n labels for fixed select options', () => {
    const makePage = (options: unknown[]) => JSON.stringify({
      meta: { pageId: 'select-i18n', title: 'Select i18n', protocolVersion: '0.2' },
      body: {
        type: 'form',
        props: { submitAction: 'save' },
        children: [{
          type: 'select',
          props: { field: 'kind', label: 'Kind', options },
        }],
      },
      actions: { save: { type: 'request', method: 'POST', url: '/save' } },
    });

    for (const options of [
      [{ label: 'Retail', value: 'retail' }],
      [{ labelKey: 'options.retail', value: 'retail' }],
      [{ label: 'Retail', labelKey: 'options.retail', value: 'retail' }],
    ]) {
      expect(validateContent({ content: makePage(options), format: 'json' }).passed).toBe(true);
    }

    const missingLabel = validateContent({
      content: makePage([{ value: 'retail' }]),
      format: 'json',
    });
    expect(missingLabel.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.options[0].props' }),
    ]));
  });

  it.each([
    ['prefix-$row.id', '模板拼接'],
    ['$parentRow.id', '嵌套表格'],
  ])('rejects invalid top-level row request mapping %s', (mappingValue, messageFragment) => {
    const result = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'request-mapping',
          title: 'Request mapping',
          protocolVersion: '0.2',
          requiredCapabilities: ['actions.row.request'],
        },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{ field: 'id', label: 'ID' }],
            actions: [{
              key: 'go',
              label: 'Go',
              actionRef: 'go',
              requestMapping: { path: { id: mappingValue } },
            }],
          },
        },
        actions: { go: { type: 'request', method: 'POST', url: '/go/{id}' } },
      }),
      format: 'json',
      filename: 'request-mapping.json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining(messageFragment) }),
    ]));
  });

  it('rejects datasource reference declarations and non-string body mappings', () => {
    const datasourceRef = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'datasource-ref', title: 'Datasource ref', protocolVersion: '0.2' },
        datasources: { loop: { source: 'ref', ref: 'loop' } },
        body: { type: 'text', props: { content: 'Value' } },
      }),
      format: 'json',
      filename: 'datasource-ref.json',
    });
    const bodyMapping = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'body-mapping', title: 'Body mapping', protocolVersion: '0.2' },
        body: { type: 'form', props: { submitAction: 'save' } },
        actions: {
          save: {
            type: 'request',
            method: 'POST',
            url: '/save',
            bodyMapping: { source: { nested: 'target' } },
          },
        },
      }),
      format: 'json',
      filename: 'body-mapping.json',
    });

    expect(datasourceRef.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(bodyMapping.layers['L0/L1']).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'must be string' }),
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

  it('rejects responseMapping when source ref targets a static datasource', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'static-ref-mapping', title: 'Static ref mapping', protocolVersion: '0.2' },
        datasources: { rows: { source: 'static', value: [] } },
        body: {
          type: 'table',
          props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
          data: { source: 'ref', ref: 'rows', responseMapping: { list: 'result.items' } },
        },
      }),
      format: 'json',
      filename: 'static-ref-mapping.json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.responseMapping' }),
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

  it('rejects GET for form submitAction without affecting row GET query requests', () => {
    const formGet = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'form-get', title: 'Form GET', protocolVersion: '0.2' },
        body: { type: 'form', props: { submitAction: 'search' } },
        actions: { search: { type: 'request', method: 'GET', url: '/search' } },
      }),
      format: 'json',
      filename: 'form-get.json',
    });
    const rowGet = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'row-get',
          title: 'Row GET',
          protocolVersion: '0.2',
          requiredCapabilities: ['actions.row.request'],
        },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{ field: 'id', label: 'ID' }],
            actions: [{
              key: 'view',
              label: 'View',
              actionRef: 'viewOrder',
              requestMapping: { query: { orderId: '$row.id' } },
            }],
          },
        },
        actions: { viewOrder: { type: 'request', method: 'GET', url: '/orders' } },
      }),
      format: 'json',
      filename: 'row-get.json',
    });

    expect(formGet.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'body.props.submitAction',
        message: expect.stringContaining('不得引用 GET request'),
      }),
    ]));
    expect(rowGet.passed).toBe(true);
  });

  it('rejects mutating DataRef methods and non-relative protocol URLs', () => {
    const mutatingDataRef = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'mutating-data-ref', title: 'Mutating DataRef', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
          data: { source: 'api', method: 'POST', url: '/orders' },
        },
      }),
      format: 'json',
      filename: 'mutating-data-ref.json',
    });
    const absoluteDataUrl = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'absolute-data-url', title: 'Absolute Data URL', protocolVersion: '0.2' },
        body: {
          type: 'table',
          props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
          data: { source: 'api', url: 'https://api.example.com/orders' },
        },
      }),
      format: 'json',
      filename: 'absolute-data-url.json',
    });
    const absoluteOptionsUrl = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'absolute-options-url', title: 'Absolute Options URL', protocolVersion: '0.2' },
        body: {
          type: 'form',
          children: [{
            type: 'select',
            props: {
              field: 'owner',
              label: 'Owner',
              optionsSource: {
                url: 'https://api.example.com/owners',
                labelField: 'name',
                valueField: 'id',
              },
            },
          }],
        },
      }),
      format: 'json',
      filename: 'absolute-options-url.json',
    });

    expect(mutatingDataRef.passed).toBe(false);
    expect(Object.values(mutatingDataRef.layers).flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.method' }),
    ]));
    expect(absoluteDataUrl.passed).toBe(false);
    expect(Object.values(absoluteDataUrl.layers).flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.url' }),
    ]));
    expect(absoluteOptionsUrl.passed).toBe(false);
    expect(absoluteOptionsUrl.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].props.optionsSource.url' }),
    ]));
  });

  it('rejects reserved RowAction prototype paths', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'reserved-row-path',
          title: 'Reserved Row Path',
          protocolVersion: '0.2',
          requiredCapabilities: ['actions.row.request'],
        },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{ field: 'id', label: 'ID' }],
            actions: [{
              key: 'inspect',
              label: 'Inspect',
              actionRef: 'inspect',
              requestMapping: { body: { payload: '$row.__proto__' } },
            }],
          },
        },
        actions: { inspect: { type: 'request', method: 'POST', url: '/inspect' } },
      }),
      format: 'json',
      filename: 'reserved-row-path.json',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.actions[0].requestMapping.body.payload' }),
    ]));
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('allows %s request for form submitAction', method => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: `form-${method}`, title: `Form ${method}`, protocolVersion: '0.2' },
        body: { type: 'form', props: { submitAction: 'save' } },
        actions: { save: { type: 'request', method, url: '/save' } },
      }),
      format: 'json',
    });

    expect(result.passed).toBe(true);
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

  it('requires search targetTable to resolve to an API datasource', () => {
    const makePage = (tableData?: object, datasources?: object) => JSON.stringify({
      meta: { pageId: 'search-target-data', title: 'Search target data', protocolVersion: '0.2' },
      ...(datasources ? { datasources } : {}),
      body: {
        type: 'section',
        children: [
          { type: 'form', props: { mode: 'search', targetTable: 'orders' } },
          {
            type: 'table',
            id: 'orders',
            ...(tableData ? { data: tableData } : {}),
            props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
          },
        ],
      },
    });

    const invalidTargets = [
      makePage(),
      makePage({ source: 'static', value: [] }),
      makePage({ source: 'ref', ref: 'ordersData' }, { ordersData: { source: 'static', value: [] } }),
    ].map(content => validateContent({ content, format: 'json' }));
    const validTargets = [
      makePage({ source: 'api', url: '/orders' }),
      makePage({ source: 'ref', ref: 'ordersData' }, { ordersData: { source: 'api', url: '/orders' } }),
    ].map(content => validateContent({ content, format: 'json' }));

    invalidTargets.forEach(result => {
      expect(result.layers.L2).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'body.children[0].props.targetTable' }),
      ]));
    });
    validTargets.forEach(result => expect(result.passed).toBe(true));
  });

  it('rejects reserved pagination and sort names in table params and search fields', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'reserved-query-params', title: 'Reserved query params', protocolVersion: '0.3' },
        datasources: {
          orders: { source: 'api', url: '/orders?tenant=acme', params: { pageSize: 100 } },
        },
        body: {
          type: 'section',
          children: [
            {
              type: 'form',
              props: { mode: 'search', targetTable: 'ordersTable' },
              children: [
                { type: 'input', props: { field: 'sort', label: 'Sort' } },
                {
                  type: 'dateRangePicker',
                  props: { startField: 'page', endField: 'pageSize', label: 'Range' },
                },
              ],
            },
            {
              type: 'table',
              id: 'ordersTable',
              props: {
                rowKey: 'id',
                pagination: { mode: 'server', pageSize: 20 },
                columns: [{ field: 'id', label: 'ID' }],
              },
              data: { source: 'ref', ref: 'orders', params: { page: 2 } },
            },
          ],
        },
      }),
      format: 'json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'datasources.orders.params.pageSize' }),
      expect.objectContaining({ path: 'body.children[0].children[0].props.field' }),
      expect.objectContaining({ path: 'body.children[0].children[1].props.startField' }),
      expect.objectContaining({ path: 'body.children[0].children[1].props.endField' }),
      expect.objectContaining({ path: 'body.children[1].data.params.page' }),
    ]));

    const independentRequests = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'independent-reserved-query-names',
          title: 'Independent reserved query names',
          protocolVersion: '0.3',
          requiredCapabilities: ['actions.row.request'],
        },
        actions: {
          load: { type: 'request', method: 'GET', url: '/items' },
          save: { type: 'request', method: 'POST', url: '/save' },
        },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [
            {
              type: 'input',
              props: { field: 'page', label: 'Business page' },
            },
            {
              type: 'select',
              props: {
                field: 'owner',
                label: 'Owner',
                optionsSource: {
                  url: '/owners',
                  params: { page: 1 },
                  labelField: 'name',
                  valueField: 'id',
                },
              },
            },
            {
              type: 'table',
              props: {
                rowKey: 'id',
                pagination: { mode: 'none' },
                columns: [{ field: 'id', label: 'ID' }],
                actions: [{
                  key: 'load',
                  label: 'Load',
                  actionRef: 'load',
                  requestMapping: { query: { sort: '$row.id' } },
                }],
              },
              data: { source: 'static', value: [] },
            },
          ],
        },
      }),
      format: 'json',
    });

    expect(independentRequests.passed).toBe(true);
  });

  it('rejects dateRangePicker reaction value writes', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'date-range-value', title: 'Date range value', protocolVersion: '0.2' },
        body: {
          type: 'form',
          props: { submitAction: 'save' },
          children: [{
            type: 'dateRangePicker',
            props: { startField: 'from', endField: 'to', label: 'Range' },
            reactions: [{
              dependencies: [],
              when: 'true == true',
              fulfill: { value: null },
              otherwise: { value: { start: null, end: null } },
            }],
          }],
        },
        actions: { save: { type: 'request', method: 'POST', url: '/save' } },
      }),
      format: 'json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.children[0].reactions[0].fulfill.value' }),
      expect.objectContaining({ path: 'body.children[0].reactions[0].otherwise.value' }),
    ]));
  });

  it('uses upload Action as the sole upload constraint source with actionRef', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'upload-constraints',
          title: 'Upload constraints',
          protocolVersion: '0.2',
          requiredCapabilities: ['actions.upload'],
        },
        body: {
          type: 'upload',
          props: {
            field: 'file',
            label: 'File',
            actionRef: 'uploadFile',
            accept: '.pdf',
            maxSize: 10,
            multiple: true,
          },
        },
        actions: {
          uploadFile: { type: 'upload', url: '/upload', maxSize: 20 },
        },
      }),
      format: 'json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.accept' }),
      expect.objectContaining({ path: 'body.props.maxSize' }),
      expect.objectContaining({ path: 'body.props.multiple' }),
    ]));
  });

  it('ignores submitAction references in search mode', () => {
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'search-ignored-action', title: 'Search ignored action', protocolVersion: '0.2' },
        body: {
          type: 'section',
          children: [
            { type: 'form', props: { mode: 'search', targetTable: 'orders', submitAction: 'missing' } },
            {
              type: 'table',
              id: 'orders',
              data: { source: 'api', url: '/orders' },
              props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
            },
          ],
        },
      }),
      format: 'json',
    });

    expect(result.passed).toBe(true);
  });

  it.each([
    '/orders/{order-id}',
    '/orders/{123}',
    '/orders/{}',
    '/orders/{{id}}',
    '/orders/{id',
    '/orders/id}',
  ])('rejects malformed RowAction URL placeholder %s', url => {
    const result = validateContent({
      content: JSON.stringify({
        meta: {
          pageId: 'invalid-url-template',
          title: 'Invalid URL template',
          protocolVersion: '0.2',
          requiredCapabilities: ['actions.row.request'],
        },
        body: {
          type: 'table',
          props: {
            rowKey: 'id',
            pagination: { mode: 'none' },
            columns: [{ field: 'id', label: 'ID' }],
            actions: [{
              key: 'open',
              label: 'Open',
              actionRef: 'openOrder',
              requestMapping: { query: { audit: true } },
            }],
          },
        },
        actions: { openOrder: { type: 'request', method: 'GET', url } },
      }),
      format: 'json',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'actions.openOrder.url' }),
    ]));
  });

  it('rejects negative upload component maxSize', () => {
    const negative = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'negative-upload-size', title: 'Negative upload size', protocolVersion: '0.2' },
        body: {
          type: 'upload',
          props: { field: 'file', label: 'File', action: '/upload', maxSize: -1 },
        },
      }),
      format: 'json',
    });
    const zero = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'zero-upload-size', title: 'Zero upload size', protocolVersion: '0.2' },
        body: {
          type: 'upload',
          props: { field: 'file', label: 'File', action: '/upload', maxSize: 0 },
        },
      }),
      format: 'json',
    });

    expect(negative.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.props.maxSize' }),
    ]));
    expect(zero.passed).toBe(true);
  });

  it.each([
    ['.nan', 'NaN'],
    ['.inf', 'Infinity'],
    ['-.inf', '-Infinity'],
  ])('rejects non-finite DSL number %s', (yamlNumber, actualValue) => {
    const result = validateContent({
      content: `
meta:
  pageId: non-finite-number
  title: Non-finite number
  protocolVersion: "0.2"
body:
  type: grid
  props:
    columns: ${yamlNumber}
  children: []
`,
      format: 'yaml',
      filename: 'non-finite.yaml',
    });

    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'body.props.columns',
        message: expect.stringContaining(actualValue),
      }),
    ]));
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

  it('reports node-level data.params.responseMapping through L2', () => {
    const result = validateContent({
      content: nodeParamsResponseMappingYaml,
      format: 'yaml',
      filename: 'node-params-rm.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.params.responseMapping' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/01-node-protocol.md');
  });

  it('reports datasources-level params.responseMapping through L2', () => {
    const result = validateContent({
      content: datasourceParamsResponseMappingYaml,
      format: 'yaml',
      filename: 'ds-params-rm.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'datasources.orders.params.responseMapping' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/01-node-protocol.md');
  });

  it('reports node-level params.responseMapping even without valid responseMapping at top level', () => {
    const result = validateContent({
      content: nodeParamsResponseMappingOnlyYaml,
      format: 'yaml',
      filename: 'node-params-rm-only.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.layers.L2).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'body.data.params.responseMapping' }),
    ]));
    expect(result.suggestedDocs).toContain('docs/01-node-protocol.md');
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

  it.each([
    ['null', 'json'],
    ['[]', 'json'],
    ['"text"', 'json'],
    ['', 'yaml'],
  ] as const)('classifies valid non-object root %s as L0/L1 instead of parseError', (content, format) => {
    const result = validateContent({ content, format, filename: `root.${format}` });

    expect(result.passed).toBe(false);
    expect(result.parseError).toBeNull();
    expect(result.internalError).toBeNull();
    expect(result.layers['L0/L1'].length).toBeGreaterThan(0);
    expect(result.layers.L2).toEqual([]);
    expect(result.layers.L3a).toEqual([]);
    expect(result.layers.L4).toEqual([]);
  });

  it('keeps high-cardinality validate_content tool text within 20KB', () => {
    const response = handleValidateContent({
      content: JSON.stringify({
        meta: { pageId: 'many-errors', title: 'Many errors', protocolVersion: '0.2' },
        body: {
          type: 'grid',
          props: { columns: 1 },
          children: Array.from({ length: 300 }, (_, index) => ({ type: `unknown_${index}`, props: {} })),
        },
      }),
      format: 'json',
      filename: 'many-errors.json',
    });
    const text = response.content[0].text;
    const result = JSON.parse(text) as ValidateContentResult;

    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(20 * 1024);
    expect(result.truncated).toBe(true);
    expect(result.layerStats?.L2.total).toBe(300);
    expect(result.layerStats?.L2.omitted).toBeGreaterThan(0);
    expect(result.layers.L2.length).toBeGreaterThan(0);
  });

  it('preserves real L2 violations beyond the default child-process buffer size', async () => {
    const content = JSON.stringify({
      meta: { pageId: 'large-l2-output', title: 'Large L2 output', protocolVersion: '0.2' },
      body: {
        type: 'section',
        children: Array.from({ length: 6500 }, (_, index) => ({ type: `unknown_${index}` })),
      },
    });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-ui-large-l2-'));
    const filePath = path.join(tempDir, 'large-l2.json');
    fs.writeFileSync(filePath, content, 'utf8');
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          process.execPath,
          [path.join(VALIDATOR_ROOT, 'scripts', 'validate-l2-components.js'), filePath, '--json'],
          {
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
            env: { ...process.env, SCHEMA_UI_PROTOCOL_ROOT: PROTOCOL_ROOT },
          },
          (error, childStdout) => {
            if (error && !childStdout) reject(error);
            else resolve(childStdout);
          },
        );
      });
      const parsed = JSON.parse(stdout) as { violations: unknown[] };
      expect(Buffer.byteLength(stdout, 'utf8')).toBeGreaterThan(1024 * 1024);
      expect(parsed.violations).toHaveLength(6500);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 60_000);

  it('budgets multi-layer violations with UTF-8 messages', () => {
    setLayerScriptExecutorForTest((_scriptName, _filePath, layer) => JSON.stringify({
      violations: Array.from({ length: 120 }, (_, index) => ({
        path: `body.children[${index}].中文字段`,
        rule: `${layer}_RULE`,
        message: `第 ${index} 条中文校验消息：字段不符合协议要求`,
      })),
    }));
    const response = handleValidateContent({
      content: JSON.stringify({
        meta: { pageId: 'multi-layer', title: 'Multi layer', protocolVersion: '0.2' },
        body: { type: 'text', props: { content: 'Value' } },
      }),
      format: 'json',
      filename: '中文页面.json',
    });
    const text = response.content[0].text;
    const result = JSON.parse(text) as ValidateContentResult;

    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(20 * 1024);
    expect(result.truncated).toBe(true);
    expect(result.layerStats?.L2.total).toBe(120);
    expect(result.layerStats?.L3a.total).toBe(120);
    expect(result.layerStats?.L4.total).toBe(120);
    expect(result.layers.L2.length).toBeGreaterThan(0);
    expect(result.layers.L3a.length).toBeGreaterThan(0);
    expect(result.layers.L4.length).toBeGreaterThan(0);
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

  it('classifies child-process buffer overflow without parsing truncated JSON', () => {
    setLayerScriptExecutorForTest(() => {
      throw Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' });
    });
    const result = validateContent({
      content: JSON.stringify({
        meta: { pageId: 'buffer-overflow', title: 'Buffer overflow', protocolVersion: '0.2' },
        body: { type: 'text', props: { content: 'Value' } },
      }),
      format: 'json',
    });

    expect(result.internalError?.message).toContain('校验脚本输出超过 16MB 内部上限');
    expect(result.internalError?.message).not.toContain('无法解析');
  });

  it('returns internalError when the temporary directory cannot be created', () => {
    setTempDirCreatorForTest(() => {
      throw new Error('ENOENT: C:\\internal\\temp\\schema-ui-mcp');
    });

    const result = validateContent({
      content: readOfficialScenario(PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
      format: 'yaml',
      filename: 'data-table.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.internalError).toEqual({ message: '无法创建校验临时目录' });
    expect(result.summary).toContain('校验内部错误');
  });

  it('warns without changing the result when temporary directory cleanup fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTempDirRemoverForTest((tempDir) => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw new Error('cleanup failed');
    });

    const result = validateContent({
      content: readOfficialScenario(PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
      format: 'yaml',
      filename: 'data-table.yaml',
    });

    expect(result.passed).toBe(true);
    expect(result.internalError).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('临时目录清理失败: cleanup failed'));
  });

  it('returns internalError when a layer script emits non-json output', () => {
    setLayerScriptExecutorForTest((scriptName) => {
      if (scriptName === 'validate-l2-components.js') return 'not json';
      return JSON.stringify({ violations: [], parseErrors: [] });
    });

    const result = validateContent({
      content: readOfficialScenario(PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
      format: 'yaml',
      filename: 'data-table.yaml',
    });

    expect(result.passed).toBe(false);
    expect(result.internalError).toMatchObject({ message: '[L2] 无法解析校验脚本 JSON 输出' });
    expect(result.layers.L2).toHaveLength(0);
    expect(result.summary).toContain('校验内部错误');
  });
});
