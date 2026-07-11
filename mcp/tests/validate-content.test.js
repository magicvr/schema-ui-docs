"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_fs_1 = require("node:fs");
var node_module_1 = require("node:module");
var vitest_1 = require("vitest");
var paths_js_1 = require("../src/core/paths.js");
var validation_runner_js_1 = require("../src/core/validation-runner.js");
var validate_content_js_1 = require("../src/tools/validate-content.js");
var test_utils_js_1 = require("./test-utils.js");
var require = (0, node_module_1.createRequire)(import.meta.url);
var _a = require('../../scripts/official-scenarios.js'), OFFICIAL_SCENARIO_PATHS = _a.OFFICIAL_SCENARIO_PATHS, readOfficialScenario = _a.readOfficialScenario;
(0, vitest_1.describe)('validate_content', function () {
    (0, vitest_1.afterEach)(function () {
        (0, validation_runner_js_1.setLayerScriptExecutorForTest)(null);
        (0, validation_runner_js_1.setTempDirCreatorForTest)(null);
        (0, validation_runner_js_1.setTempDirRemoverForTest)(null);
        vitest_1.vi.restoreAllMocks();
    });
    vitest_1.it.each(OFFICIAL_SCENARIO_PATHS)('passes official scenario %s', function (relativePath) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: readOfficialScenario(paths_js_1.PROTOCOL_ROOT, relativePath),
            format: 'yaml',
            filename: relativePath,
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    (0, vitest_1.it)('reports L3a scope isolation when $row is used without scope row', function () {
        var result = (0, validation_runner_js_1.validateContent)({ content: test_utils_js_1.missingRowScopeYaml, format: 'yaml', filename: 'bad-row.yaml' });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'SCOPE_ISOLATION' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/02-reaction-expression.md');
    });
    (0, vitest_1.it)('reports missing actions.upload capability', function () {
        var result = (0, validation_runner_js_1.validateContent)({ content: test_utils_js_1.missingUploadCapabilityYaml, format: 'yaml', filename: 'upload.yaml' });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'meta.requiredCapabilities' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/07-actions-contract.md');
    });
    (0, vitest_1.it)('reports missing actions.row.request capability', function () {
        var result = (0, validation_runner_js_1.validateContent)({ content: test_utils_js_1.missingRowRequestCapabilityYaml, format: 'yaml', filename: 'row-request.yaml' });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'meta.requiredCapabilities' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/03-component-registry.md');
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/07-actions-contract.md');
    });
    (0, vitest_1.it)('reports invalid table embedded expression objects through L2', function () {
        var missingWhen = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableVisibleWhenMissingWhenYaml,
            format: 'yaml',
            filename: 'table-visiblewhen.yaml',
        });
        var forbiddenState = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableRowReactionForbiddenStateYaml,
            format: 'yaml',
            filename: 'table-reaction.yaml',
        });
        (0, vitest_1.expect)(missingWhen.passed).toBe(false);
        (0, vitest_1.expect)(missingWhen.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.columns[0].visibleWhen.when' }),
        ]));
        (0, vitest_1.expect)(forbiddenState.passed).toBe(false);
        (0, vitest_1.expect)(forbiddenState.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.required' }),
        ]));
    });
    (0, vitest_1.it)('rejects required/value on table column and action reactions even with scope form', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableFormScopeReactionForbiddenStateYaml,
            format: 'yaml',
            filename: 'table-form-scope-reaction.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.required' }),
            vitest_1.expect.objectContaining({ path: 'body.props.columns[0].reactions[0].fulfill.value' }),
            vitest_1.expect.objectContaining({ path: 'body.props.actions[0].reactions[0].fulfill.value' }),
        ]));
    });
    vitest_1.it.each([
        ['string', 'not-a-node'],
        ['null', null],
        ['boolean', false],
        ['number', 0],
        ['array', []],
    ])('rejects %s tabs content as a non-Node value', function (_label, content) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'tabs-content', title: 'Tabs content', protocolVersion: '0.2' },
                body: {
                    type: 'tabs',
                    props: { items: [{ key: 'main', label: 'Main', content: content }] },
                },
            }),
            format: 'json',
            filename: 'tabs-content.json',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.items[0].content' }),
        ]));
        (0, vitest_1.expect)(result.parseError).toBeNull();
    });
    (0, vitest_1.it)('validates a complete Node nested in tabs content', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'body.props.items[0].content.props',
                message: vitest_1.expect.stringContaining('label 或 labelKey'),
            }),
        ]));
    });
    vitest_1.it.each([
        ['null', null],
        ['string', 'invalid'],
        ['array', []],
    ])('keeps %s props as a structural violation instead of a parse error', function (_label, props) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'invalid-props', title: 'Invalid props', protocolVersion: '0.2' },
                body: { type: 'grid', props: props, children: [] },
            }),
            format: 'json',
            filename: 'invalid-props.json',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers['L0/L1'].length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    vitest_1.it.each([
        ['columns object', { columns: {} }],
        ['columns string', { columns: 'invalid' }],
        ['columns null', { columns: null }],
        ['actions object', { actions: {} }],
        ['actions string', { actions: 'invalid' }],
        ['actions null', { actions: null }],
    ])('keeps invalid table %s as a structural violation instead of a parse error', function (_label, tableProps) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'invalid-table-array', title: 'Invalid table array', protocolVersion: '0.2' },
                body: {
                    type: 'table',
                    props: __assign({ rowKey: 'id', pagination: { mode: 'none' } }, tableProps),
                },
            }),
            format: 'json',
            filename: 'invalid-table-array.json',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers['L0/L1'].length + result.layers.L2.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    (0, vitest_1.it)('maps layered violations to the caller filename', function () {
        var _a, _b;
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'filename-test', title: 'Filename test', protocolVersion: '0.2' },
                body: { type: 'unknown', props: { color: 'red' } },
            }),
            format: 'json',
            filename: 'pages/caller.json',
        });
        (0, vitest_1.expect)((_a = result.layers.L2[0]) === null || _a === void 0 ? void 0 : _a.file).toBe('pages/caller.json');
        (0, vitest_1.expect)((_b = result.layers.L4[0]) === null || _b === void 0 ? void 0 : _b.file).toBe('pages/caller.json');
        (0, vitest_1.expect)(JSON.stringify(result.layers)).not.toContain('schema-ui-mcp-');
    });
    (0, vitest_1.it)('omits internal temporary paths when filename is absent', function () {
        var _a;
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'filename-test', title: 'Filename test', protocolVersion: '0.2' },
                body: { type: 'unknown', props: {} },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)((_a = result.layers.L2[0]) === null || _a === void 0 ? void 0 : _a.file).toBeUndefined();
        (0, vitest_1.expect)(JSON.stringify(result.layers)).not.toContain('schema-ui-mcp-');
    });
    vitest_1.it.each([
        ['$row.', ['$row.']],
        ['$row..status', ['status']],
    ])('rejects malformed row variable %s regardless of dependencies', function (expression, dependencies) {
        var result = (0, validation_runner_js_1.validateContent)({
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
                                visibleWhen: { scope: 'row', dependencies: dependencies, when: "".concat(expression, " == 'ok'") },
                            }],
                    },
                },
            }),
            format: 'json',
            filename: 'malformed-row.json',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'SYNTAX' }),
        ]));
    });
    (0, vitest_1.it)('rejects source api datasources carrying static value', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'api-value', title: 'API value', protocolVersion: '0.2' },
                datasources: { badApi: { source: 'api', url: '/api/value', value: 1 } },
                body: { type: 'text', props: { content: 'Value' } },
            }),
            format: 'json',
            filename: 'api-value.json',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers['L0/L1'].length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('rejects row scope on ordinary nodes and undeclared row dependencies', function () {
        var ordinaryNode = (0, validation_runner_js_1.validateContent)({
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
        var missingDependency = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(ordinaryNode.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'ROW_SCOPE_MOUNT' }),
        ]));
        (0, vitest_1.expect)(missingDependency.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'UNDECLARED_ROW_DEP' }),
        ]));
    });
    (0, vitest_1.it)('uses exact nested row dependency paths', function () {
        var makePage = function (dependencies) { return JSON.stringify({
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
                                dependencies: dependencies,
                                when: "$row.customer.status == 'active'",
                            },
                        }],
                },
            },
        }); };
        var exact = (0, validation_runner_js_1.validateContent)({ content: makePage(['customer.status']), format: 'json' });
        var parentOnly = (0, validation_runner_js_1.validateContent)({ content: makePage(['customer']), format: 'json' });
        (0, vitest_1.expect)(exact.passed).toBe(true);
        (0, vitest_1.expect)(parentOnly.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'UNDECLARED_ROW_DEP' }),
        ]));
    });
    (0, vitest_1.it)('allows only context variables in non-form visibleWhen', function () {
        var makePage = function (when) { return JSON.stringify({
            meta: { pageId: 'non-form-visible', title: 'Non-form visible', protocolVersion: '0.2' },
            body: { type: 'text', props: { content: 'Status' }, visibleWhen: { when: when } },
        }); };
        var valid = (0, validation_runner_js_1.validateContent)({ content: makePage('$context.features.beta == true'), format: 'json' });
        var invalidExpressions = [
            '$self == true',
            '$deps.status == true',
            '$row.status == true',
            '$parentRow.status == true',
        ];
        (0, vitest_1.expect)(valid.passed).toBe(true);
        for (var _i = 0, invalidExpressions_1 = invalidExpressions; _i < invalidExpressions_1.length; _i++) {
            var expression = invalidExpressions_1[_i];
            var invalid = (0, validation_runner_js_1.validateContent)({ content: makePage(expression), format: 'json' });
            (0, vitest_1.expect)(invalid.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
                vitest_1.expect.objectContaining({ rule: 'NON_FORM_VISIBLEWHEN' }),
            ]));
        }
    });
    (0, vitest_1.it)('rejects $self in form-context visibleWhen', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.formVisibleWhenSelfYaml,
            format: 'yaml',
            filename: 'form-visiblewhen-self.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'FORM_VISIBLEWHEN_VARS' }),
        ]));
    });
    (0, vitest_1.it)('rejects $self on table actions with scope form', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableActionFormScopeSelfYaml,
            format: 'yaml',
            filename: 'table-action-form-self.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'TABLE_ACTION_NO_SELF' }),
        ]));
    });
    (0, vitest_1.it)('recursively checks variables in params arrays', function () {
        var _a;
        var makePage = function (owners) { return JSON.stringify({
            meta: { pageId: 'params-array', title: 'Params array', protocolVersion: '0.2' },
            body: {
                type: 'form',
                props: { submitAction: 'save' },
                children: [{
                        type: 'table',
                        props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] },
                        data: { source: 'api', url: '/orders', params: { owners: owners } },
                    }],
            },
            actions: { save: { type: 'request', method: 'POST', url: '/save' } },
        }); };
        var valid = (0, validation_runner_js_1.validateContent)({ content: makePage(['$deps.ownerId', 'fixed']), format: 'json' });
        var invalid = (0, validation_runner_js_1.validateContent)({ content: makePage(['$context.user.id']), format: 'json' });
        var templatePrefix = (0, validation_runner_js_1.validateContent)({ content: makePage(['prefix-$deps.ownerId']), format: 'json' });
        var templateSuffix = (0, validation_runner_js_1.validateContent)({ content: makePage(['$deps.ownerId-suffix']), format: 'json' });
        var nestedDatasourceKey = (0, validation_runner_js_1.validateContent)({
            content: makePage([{ 'datasources.fake': { nested: '$row.id' } }]),
            format: 'json',
        });
        (0, vitest_1.expect)(valid.passed).toBe(true);
        (0, vitest_1.expect)(invalid.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].data.params.owners[0]', rule: 'DATA_PARAMS_VARIABLE' }),
        ]));
        (0, vitest_1.expect)(templatePrefix.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].data.params.owners[0]', rule: 'DATA_PARAMS_VARIABLE' }),
        ]));
        (0, vitest_1.expect)(templateSuffix.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].data.params.owners[0]', rule: 'DATA_PARAMS_VARIABLE' }),
        ]));
        (0, vitest_1.expect)(nestedDatasourceKey.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'body.children[0].data.params.owners[0].datasources.fake.nested',
                rule: 'DATA_PARAMS_VARIABLE',
                message: vitest_1.expect.stringContaining('data.params'),
            }),
        ]));
        (0, vitest_1.expect)((_a = nestedDatasourceKey.layers.L3a[0]) === null || _a === void 0 ? void 0 : _a.message).not.toContain('datasources.*.params');
        var optionsSource = (0, validation_runner_js_1.validateContent)({
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
        var optionsSourceTemplate = (0, validation_runner_js_1.validateContent)({
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
        var datasource = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'datasource-array', title: 'Datasource array', protocolVersion: '0.2' },
                datasources: { owners: { source: 'api', url: '/owners', params: { ids: ['$deps.owner'] } } },
                body: { type: 'text', props: { content: 'Owners' } },
            }),
            format: 'json',
        });
        var datasourceTemplate = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'datasource-template', title: 'Datasource template', protocolVersion: '0.2' },
                datasources: { owners: { source: 'api', url: '/owners', params: { keyword: 'prefix-$deps.owner' } } },
                body: { type: 'text', props: { content: 'Owners' } },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(optionsSource.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].props.optionsSource.params.ids[0]' }),
        ]));
        (0, vitest_1.expect)(optionsSourceTemplate.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'body.children[0].props.optionsSource.params.keyword',
                rule: 'DATA_PARAMS_VARIABLE',
            }),
        ]));
        (0, vitest_1.expect)(datasource.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'datasources.owners.params.ids[0]',
                rule: 'NON_FORM_DATA_PARAMS',
                message: vitest_1.expect.stringContaining('datasources'),
            }),
        ]));
        (0, vitest_1.expect)(datasourceTemplate.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'datasources.owners.params.keyword',
                rule: 'DATA_PARAMS_VARIABLE',
                message: vitest_1.expect.stringContaining('datasources'),
            }),
        ]));
    });
    (0, vitest_1.it)('allows dateRangePicker self properties and rejects them on other components', function () {
        var makePage = function (type, expression) { return JSON.stringify({
            meta: { pageId: 'self-property', title: 'Self property', protocolVersion: '0.2' },
            body: {
                type: 'form',
                props: { submitAction: 'save' },
                children: [{
                        type: type,
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
        }); };
        var valid = (0, validation_runner_js_1.validateContent)({
            content: makePage('dateRangePicker', "$self.start < '2026-01-01' && $self.end != null"),
            format: 'json',
            filename: 'date-range-self.json',
        });
        var unknownProperty = (0, validation_runner_js_1.validateContent)({
            content: makePage('dateRangePicker', '$self.unknown != null'),
            format: 'json',
            filename: 'date-range-unknown-self.json',
        });
        var wrongComponent = (0, validation_runner_js_1.validateContent)({
            content: makePage('input', '$self.start != null'),
            format: 'json',
            filename: 'input-self-property.json',
        });
        var fakeNamespace = (0, validation_runner_js_1.validateContent)({
            content: makePage('input', '$selfish != null'),
            format: 'json',
            filename: 'fake-self-namespace.json',
        });
        (0, vitest_1.expect)(valid.passed).toBe(true);
        (0, vitest_1.expect)(unknownProperty.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'SELF_PROPERTY_SCOPE' }),
        ]));
        (0, vitest_1.expect)(wrongComponent.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'SELF_PROPERTY_SCOPE' }),
        ]));
        (0, vitest_1.expect)(fakeNamespace.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'UNKNOWN_VARIABLE' }),
        ]));
    });
    (0, vitest_1.it)('requires visibleWhen dependencies only inside form context', function () {
        var formMissingDependencies = (0, validation_runner_js_1.validateContent)({
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
        var formEmptyDependencies = (0, validation_runner_js_1.validateContent)({
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
        var nonForm = (0, validation_runner_js_1.validateContent)({
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
        var embeddedTable = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(formMissingDependencies.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].visibleWhen.dependencies' }),
        ]));
        (0, vitest_1.expect)(formEmptyDependencies.passed).toBe(true);
        (0, vitest_1.expect)(nonForm.passed).toBe(true);
        (0, vitest_1.expect)(embeddedTable.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].props.columns[0].visibleWhen.dependencies' }),
        ]));
    });
    (0, vitest_1.it)('rejects parentRow expressions until a nested table mount is defined', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'PARENT_ROW_UNSUPPORTED' }),
        ]));
    });
    (0, vitest_1.it)('rejects chained comparisons but allows comparisons separated by logic', function () {
        var makePage = function (expression) { return JSON.stringify({
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
        }); };
        var chained = (0, validation_runner_js_1.validateContent)({
            content: makePage("$deps.roles contains 'admin' contains true"),
            format: 'json',
            filename: 'comparison-chain.json',
        });
        var logical = (0, validation_runner_js_1.validateContent)({
            content: makePage("$deps.roles contains 'admin' && $deps.roles != null"),
            format: 'json',
            filename: 'comparison-logic.json',
        });
        (0, vitest_1.expect)(chained.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ rule: 'SYNTAX', message: vitest_1.expect.stringContaining('不支持链式使用') }),
        ]));
        (0, vitest_1.expect)(logical.passed).toBe(true);
    });
    (0, vitest_1.it)('requires a literal right operand for contains', function () {
        var makePage = function (expression) { return JSON.stringify({
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
        }); };
        for (var _i = 0, _a = [
            "$deps.roles contains 'admin'",
            '$deps.roles contains 1',
            '$deps.roles contains true',
            '$deps.roles contains null',
        ]; _i < _a.length; _i++) {
            var expression = _a[_i];
            var result = (0, validation_runner_js_1.validateContent)({ content: makePage(expression), format: 'json' });
            (0, vitest_1.expect)(result.passed).toBe(true);
        }
        for (var _b = 0, _c = [
            '$deps.roles contains $deps.targetRole',
            '$deps.roles contains ($deps.targetRole)',
        ]; _b < _c.length; _b++) {
            var expression = _c[_b];
            var result = (0, validation_runner_js_1.validateContent)({ content: makePage(expression), format: 'json' });
            (0, vitest_1.expect)(result.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
                vitest_1.expect.objectContaining({
                    rule: 'SYNTAX',
                    message: vitest_1.expect.stringContaining('contains 的右操作数必须'),
                }),
            ]));
        }
    });
    (0, vitest_1.it)('treats tagMap keys as data while still scanning mapping entries', function () {
        var makePage = function (mappingEntry) { return JSON.stringify({
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
        }); };
        var valid = (0, validation_runner_js_1.validateContent)({
            content: makePage({ text: 'Color', tone: 'neutral' }),
            format: 'json',
            filename: 'tag-map-valid.json',
        });
        var invalidEntry = (0, validation_runner_js_1.validateContent)({
            content: makePage({ text: 'Color', tone: 'neutral', color: 'red' }),
            format: 'json',
            filename: 'tag-map-invalid.json',
        });
        (0, vitest_1.expect)(valid.passed).toBe(true);
        (0, vitest_1.expect)(invalidEntry.layers.L4).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.columns[0].tagMap.color.color' }),
        ]));
    });
    (0, vitest_1.it)('treats request parameter map keys as business data in L4', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L4).toEqual([]);
    });
    (0, vitest_1.it)('treats select option values as opaque business data in L4', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.layers.L4).toEqual([]);
    });
    (0, vitest_1.it)('rejects missing nested required component fields and duplicate node ids', function () {
        var missingPaginationMode = (0, validation_runner_js_1.validateContent)({
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
        var duplicateId = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(missingPaginationMode.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.pagination.mode' }),
        ]));
        (0, vitest_1.expect)(duplicateId.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[1].id' }),
        ]));
    });
    (0, vitest_1.it)('supports table titleKey and validates real ISO date boundaries', function () {
        var table = (0, validation_runner_js_1.validateContent)({
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
        var validDate = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'valid-date', title: 'Valid date', protocolVersion: '0.2' },
                body: { type: 'datePicker', props: { field: 'due', label: 'Due', min: '2024-02-29' } },
            }),
            format: 'json',
        });
        var invalidDate = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'invalid-date', title: 'Invalid date', protocolVersion: '0.2' },
                body: {
                    type: 'dateRangePicker',
                    props: { startField: 'from', endField: 'to', label: 'Range', max: '2026-02-30' },
                },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(table.passed).toBe(true);
        (0, vitest_1.expect)(validDate.passed).toBe(true);
        (0, vitest_1.expect)(invalidDate.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.max', message: vitest_1.expect.stringContaining('YYYY-MM-DD') }),
        ]));
    });
    vitest_1.it.each(['2026/01/01', '2026-13-01', '2026-02-30', '2023-02-29'])('rejects invalid ISO date boundary %s', function (boundary) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'invalid-boundary', title: 'Invalid boundary', protocolVersion: '0.2' },
                body: { type: 'datePicker', props: { field: 'due', label: 'Due', min: boundary } },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.min' }),
        ]));
    });
    vitest_1.it.each([
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
    ])('rejects unknown fields in closed nested DSL object %s', function (_name, body, expectedPath) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'closed-nested', title: 'Closed nested', protocolVersion: '0.2' },
                body: body,
                actions: { save: { type: 'request', method: 'POST', url: '/save' } },
            }),
            format: 'json',
            filename: 'closed-nested.json',
        });
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: expectedPath }),
        ]));
    });
    (0, vitest_1.it)('supports i18n labels for fixed select options', function () {
        var makePage = function (options) { return JSON.stringify({
            meta: { pageId: 'select-i18n', title: 'Select i18n', protocolVersion: '0.2' },
            body: {
                type: 'form',
                props: { submitAction: 'save' },
                children: [{
                        type: 'select',
                        props: { field: 'kind', label: 'Kind', options: options },
                    }],
            },
            actions: { save: { type: 'request', method: 'POST', url: '/save' } },
        }); };
        for (var _i = 0, _a = [
            [{ label: 'Retail', value: 'retail' }],
            [{ labelKey: 'options.retail', value: 'retail' }],
            [{ label: 'Retail', labelKey: 'options.retail', value: 'retail' }],
        ]; _i < _a.length; _i++) {
            var options = _a[_i];
            (0, vitest_1.expect)((0, validation_runner_js_1.validateContent)({ content: makePage(options), format: 'json' }).passed).toBe(true);
        }
        var missingLabel = (0, validation_runner_js_1.validateContent)({
            content: makePage([{ value: 'retail' }]),
            format: 'json',
        });
        (0, vitest_1.expect)(missingLabel.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].props.options[0].props' }),
        ]));
    });
    vitest_1.it.each([
        ['prefix-$row.id', '模板拼接'],
        ['$parentRow.id', '嵌套表格'],
    ])('rejects invalid top-level row request mapping %s', function (mappingValue, messageFragment) {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ message: vitest_1.expect.stringContaining(messageFragment) }),
        ]));
    });
    (0, vitest_1.it)('rejects datasource reference declarations and non-string body mappings', function () {
        var datasourceRef = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'datasource-ref', title: 'Datasource ref', protocolVersion: '0.2' },
                datasources: { loop: { source: 'ref', ref: 'loop' } },
                body: { type: 'text', props: { content: 'Value' } },
            }),
            format: 'json',
            filename: 'datasource-ref.json',
        });
        var bodyMapping = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(datasourceRef.layers['L0/L1'].length).toBeGreaterThan(0);
        (0, vitest_1.expect)(bodyMapping.layers['L0/L1']).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ message: 'must be string' }),
        ]));
    });
    (0, vitest_1.it)('reports source ref responseMapping semantic errors through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableRefResponseMappingMissingListYaml,
            format: 'yaml',
            filename: 'table-ref-response-mapping.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.responseMapping.list' }),
        ]));
    });
    (0, vitest_1.it)('rejects responseMapping when source ref targets a static datasource', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.responseMapping' }),
        ]));
    });
    (0, vitest_1.it)('reports inherited datasources.responseMapping missing list for table source:ref through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableRefResponseMappingInheritedMissingListYaml,
            format: 'yaml',
            filename: 'table-ref-inherited-missing-list.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.responseMapping.list' }),
        ]));
    });
    (0, vitest_1.it)('reports inherited datasources.responseMapping missing list for chart source:ref through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.chartRefResponseMappingInheritedMissingListYaml,
            format: 'yaml',
            filename: 'chart-ref-inherited-missing-list.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.responseMapping.list' }),
        ]));
    });
    (0, vitest_1.it)('passes table source:ref with complete inherited datasources.responseMapping', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableRefResponseMappingInheritedCompleteYaml,
            format: 'yaml',
            filename: 'table-ref-inherited-complete.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    (0, vitest_1.it)('passes chart source:ref with local responseMapping override', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.chartRefResponseMappingLocalOverrideOkYaml,
            format: 'yaml',
            filename: 'chart-ref-local-override.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    (0, vitest_1.it)('reports permissions variables outside $context and unknown context roots through L3a', function () {
        var actionPermission = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.tableActionPermissionSelfYaml,
            format: 'yaml',
            filename: 'table-action-permission.yaml',
        });
        var nodePermission = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.nodePermissionSelfYaml,
            format: 'yaml',
            filename: 'node-permission.yaml',
        });
        var unknownContext = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.unknownContextNamespaceYaml,
            format: 'yaml',
            filename: 'unknown-context.yaml',
        });
        (0, vitest_1.expect)(actionPermission.passed).toBe(false);
        (0, vitest_1.expect)(actionPermission.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.actions[0].permissions.view', rule: 'PERM_CONTEXT_ONLY' }),
        ]));
        (0, vitest_1.expect)(nodePermission.passed).toBe(false);
        (0, vitest_1.expect)(nodePermission.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.permissions.view', rule: 'PERM_CONTEXT_ONLY' }),
        ]));
        (0, vitest_1.expect)(unknownContext.passed).toBe(false);
        (0, vitest_1.expect)(unknownContext.layers.L3a).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.permissions.view', rule: 'UNKNOWN_CONTEXT_NAMESPACE' }),
        ]));
    });
    (0, vitest_1.it)('reports missing submitAction target through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.missingSubmitActionTargetYaml,
            format: 'yaml',
            filename: 'missing-submit-action.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.submitAction' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/03-component-registry.md');
    });
    (0, vitest_1.it)('rejects GET for form submitAction without affecting row GET query requests', function () {
        var formGet = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'form-get', title: 'Form GET', protocolVersion: '0.2' },
                body: { type: 'form', props: { submitAction: 'search' } },
                actions: { search: { type: 'request', method: 'GET', url: '/search' } },
            }),
            format: 'json',
            filename: 'form-get.json',
        });
        var rowGet = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(formGet.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'body.props.submitAction',
                message: vitest_1.expect.stringContaining('不得引用 GET request'),
            }),
        ]));
        (0, vitest_1.expect)(rowGet.passed).toBe(true);
    });
    vitest_1.it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows %s request for form submitAction', function (method) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: "form-".concat(method), title: "Form ".concat(method), protocolVersion: '0.2' },
                body: { type: 'form', props: { submitAction: 'save' } },
                actions: { save: { type: 'request', method: method, url: '/save' } },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
    });
    (0, vitest_1.it)('reports upload actionRef pointing to non-upload action type', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.uploadActionRefWrongTypeYaml,
            format: 'yaml',
            filename: 'upload-wrong-type.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.actionRef' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/03-component-registry.md');
    });
    (0, vitest_1.it)('reports dangling data.ref through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.danglingDataRefYaml,
            format: 'yaml',
            filename: 'dangling-data-ref.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.ref' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/03-component-registry.md');
    });
    (0, vitest_1.it)('reports invalid targetTable through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.invalidTargetTableYaml,
            format: 'yaml',
            filename: 'invalid-target-table.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.targetTable' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/03-component-registry.md');
    });
    (0, vitest_1.it)('requires search targetTable to resolve to an API datasource', function () {
        var makePage = function (tableData, datasources) { return JSON.stringify(__assign(__assign({ meta: { pageId: 'search-target-data', title: 'Search target data', protocolVersion: '0.2' } }, (datasources ? { datasources: datasources } : {})), { body: {
                type: 'section',
                children: [
                    { type: 'form', props: { mode: 'search', targetTable: 'orders' } },
                    __assign(__assign({ type: 'table', id: 'orders' }, (tableData ? { data: tableData } : {})), { props: { rowKey: 'id', pagination: { mode: 'none' }, columns: [{ field: 'id', label: 'ID' }] } }),
                ],
            } })); };
        var invalidTargets = [
            makePage(),
            makePage({ source: 'static', value: [] }),
            makePage({ source: 'ref', ref: 'ordersData' }, { ordersData: { source: 'static', value: [] } }),
        ].map(function (content) { return (0, validation_runner_js_1.validateContent)({ content: content, format: 'json' }); });
        var validTargets = [
            makePage({ source: 'api', url: '/orders' }),
            makePage({ source: 'ref', ref: 'ordersData' }, { ordersData: { source: 'api', url: '/orders' } }),
        ].map(function (content) { return (0, validation_runner_js_1.validateContent)({ content: content, format: 'json' }); });
        invalidTargets.forEach(function (result) {
            (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
                vitest_1.expect.objectContaining({ path: 'body.children[0].props.targetTable' }),
            ]));
        });
        validTargets.forEach(function (result) { return (0, vitest_1.expect)(result.passed).toBe(true); });
    });
    (0, vitest_1.it)('rejects dateRangePicker reaction value writes', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.children[0].reactions[0].fulfill.value' }),
            vitest_1.expect.objectContaining({ path: 'body.children[0].reactions[0].otherwise.value' }),
        ]));
    });
    (0, vitest_1.it)('uses upload Action as the sole upload constraint source with actionRef', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.accept' }),
            vitest_1.expect.objectContaining({ path: 'body.props.maxSize' }),
            vitest_1.expect.objectContaining({ path: 'body.props.multiple' }),
        ]));
    });
    (0, vitest_1.it)('ignores submitAction references in search mode', function () {
        var result = (0, validation_runner_js_1.validateContent)({
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
        (0, vitest_1.expect)(result.passed).toBe(true);
    });
    vitest_1.it.each([
        '/orders/{order-id}',
        '/orders/{123}',
        '/orders/{}',
        '/orders/{{id}}',
        '/orders/{id',
        '/orders/id}',
    ])('rejects malformed RowAction URL placeholder %s', function (url) {
        var result = (0, validation_runner_js_1.validateContent)({
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
                actions: { openOrder: { type: 'request', method: 'GET', url: url } },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'actions.openOrder.url' }),
        ]));
    });
    (0, vitest_1.it)('rejects negative upload component maxSize', function () {
        var negative = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'negative-upload-size', title: 'Negative upload size', protocolVersion: '0.2' },
                body: {
                    type: 'upload',
                    props: { field: 'file', label: 'File', action: '/upload', maxSize: -1 },
                },
            }),
            format: 'json',
        });
        var zero = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'zero-upload-size', title: 'Zero upload size', protocolVersion: '0.2' },
                body: {
                    type: 'upload',
                    props: { field: 'file', label: 'File', action: '/upload', maxSize: 0 },
                },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)(negative.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.props.maxSize' }),
        ]));
        (0, vitest_1.expect)(zero.passed).toBe(true);
    });
    vitest_1.it.each([
        ['.nan', 'NaN'],
        ['.inf', 'Infinity'],
        ['-.inf', '-Infinity'],
    ])('rejects non-finite DSL number %s', function (yamlNumber, actualValue) {
        var result = (0, validation_runner_js_1.validateContent)({
            content: "\nmeta:\n  pageId: non-finite-number\n  title: Non-finite number\n  protocolVersion: \"0.2\"\nbody:\n  type: grid\n  props:\n    columns: ".concat(yamlNumber, "\n  children: []\n"),
            format: 'yaml',
            filename: 'non-finite.yaml',
        });
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({
                path: 'body.props.columns',
                message: vitest_1.expect.stringContaining(actualValue),
            }),
        ]));
    });
    (0, vitest_1.it)('passes valid all references YAML', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.validAllReferencesYaml,
            format: 'yaml',
            filename: 'valid-all-refs.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
    });
    (0, vitest_1.it)('reports node-level data.params.responseMapping through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.nodeParamsResponseMappingYaml,
            format: 'yaml',
            filename: 'node-params-rm.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.params.responseMapping' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/01-node-protocol.md');
    });
    (0, vitest_1.it)('reports datasources-level params.responseMapping through L2', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.datasourceParamsResponseMappingYaml,
            format: 'yaml',
            filename: 'ds-params-rm.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'datasources.orders.params.responseMapping' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/01-node-protocol.md');
    });
    (0, vitest_1.it)('reports node-level params.responseMapping even without valid responseMapping at top level', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: test_utils_js_1.nodeParamsResponseMappingOnlyYaml,
            format: 'yaml',
            filename: 'node-params-rm-only.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers.L2).toEqual(vitest_1.expect.arrayContaining([
            vitest_1.expect.objectContaining({ path: 'body.data.params.responseMapping' }),
        ]));
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/01-node-protocol.md');
    });
    (0, vitest_1.it)('maps AJV schema errors into L0/L1', function () {
        var result = (0, validation_runner_js_1.validateContent)({
            content: "meta:\n  pageId: missing_title\n  protocolVersion: \"0.2\"\nbody:\n  type: text\n  props:\n    content: Hello\n",
            format: 'yaml',
            filename: 'missing-title.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.layers['L0/L1'].length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.suggestedDocs).toContain('docs/01-node-protocol.md');
    });
    vitest_1.it.each([
        ['null', 'json'],
        ['[]', 'json'],
        ['"text"', 'json'],
        ['', 'yaml'],
    ])('classifies valid non-object root %s as L0/L1 instead of parseError', function (content, format) {
        var result = (0, validation_runner_js_1.validateContent)({ content: content, format: format, filename: "root.".concat(format) });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.parseError).toBeNull();
        (0, vitest_1.expect)(result.internalError).toBeNull();
        (0, vitest_1.expect)(result.layers['L0/L1'].length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.layers.L2).toEqual([]);
        (0, vitest_1.expect)(result.layers.L3a).toEqual([]);
        (0, vitest_1.expect)(result.layers.L4).toEqual([]);
    });
    (0, vitest_1.it)('keeps high-cardinality validate_content tool text within 20KB', function () {
        var _a, _b;
        var response = (0, validate_content_js_1.handleValidateContent)({
            content: JSON.stringify({
                meta: { pageId: 'many-errors', title: 'Many errors', protocolVersion: '0.2' },
                body: {
                    type: 'grid',
                    props: { columns: 1 },
                    children: Array.from({ length: 300 }, function (_, index) { return ({ type: "unknown_".concat(index), props: {} }); }),
                },
            }),
            format: 'json',
            filename: 'many-errors.json',
        });
        var text = response.content[0].text;
        var result = JSON.parse(text);
        (0, vitest_1.expect)(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(20 * 1024);
        (0, vitest_1.expect)(result.truncated).toBe(true);
        (0, vitest_1.expect)((_a = result.layerStats) === null || _a === void 0 ? void 0 : _a.L2.total).toBe(300);
        (0, vitest_1.expect)((_b = result.layerStats) === null || _b === void 0 ? void 0 : _b.L2.omitted).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.layers.L2.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('preserves real L2 violations beyond the default child-process buffer size', function () {
        var _a;
        var content = JSON.stringify({
            meta: { pageId: 'large-l2-output', title: 'Large L2 output', protocolVersion: '0.2' },
            body: {
                type: 'section',
                children: Array.from({ length: 6000 }, function (_, index) { return ({ type: "unknown_".concat(index) }); }),
            },
        });
        var result = (0, validation_runner_js_1.validateContent)({ content: content, format: 'json', filename: 'large-l2.json' });
        var response = (0, validate_content_js_1.handleValidateContent)({ content: content, format: 'json', filename: 'large-l2.json' });
        var text = response.content[0].text;
        var transportResult = JSON.parse(text);
        (0, vitest_1.expect)(result.internalError).toBeNull();
        (0, vitest_1.expect)(result.layers.L2).toHaveLength(6000);
        (0, vitest_1.expect)(text).not.toContain('无法解析校验脚本 JSON 输出');
        (0, vitest_1.expect)(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(20 * 1024);
        (0, vitest_1.expect)((_a = transportResult.layerStats) === null || _a === void 0 ? void 0 : _a.L2.total).toBe(6000);
    });
    (0, vitest_1.it)('budgets multi-layer violations with UTF-8 messages', function () {
        var _a, _b, _c;
        (0, validation_runner_js_1.setLayerScriptExecutorForTest)(function (_scriptName, _filePath, layer) { return JSON.stringify({
            violations: Array.from({ length: 120 }, function (_, index) { return ({
                path: "body.children[".concat(index, "].\u4E2D\u6587\u5B57\u6BB5"),
                rule: "".concat(layer, "_RULE"),
                message: "\u7B2C ".concat(index, " \u6761\u4E2D\u6587\u6821\u9A8C\u6D88\u606F\uFF1A\u5B57\u6BB5\u4E0D\u7B26\u5408\u534F\u8BAE\u8981\u6C42"),
            }); }),
        }); });
        var response = (0, validate_content_js_1.handleValidateContent)({
            content: JSON.stringify({
                meta: { pageId: 'multi-layer', title: 'Multi layer', protocolVersion: '0.2' },
                body: { type: 'text', props: { content: 'Value' } },
            }),
            format: 'json',
            filename: '中文页面.json',
        });
        var text = response.content[0].text;
        var result = JSON.parse(text);
        (0, vitest_1.expect)(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(20 * 1024);
        (0, vitest_1.expect)(result.truncated).toBe(true);
        (0, vitest_1.expect)((_a = result.layerStats) === null || _a === void 0 ? void 0 : _a.L2.total).toBe(120);
        (0, vitest_1.expect)((_b = result.layerStats) === null || _b === void 0 ? void 0 : _b.L3a.total).toBe(120);
        (0, vitest_1.expect)((_c = result.layerStats) === null || _c === void 0 ? void 0 : _c.L4.total).toBe(120);
        (0, vitest_1.expect)(result.layers.L2.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.layers.L3a.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.layers.L4.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('returns structured parseError for invalid YAML', function () {
        var result = (0, validation_runner_js_1.validateContent)({ content: 'meta:\n  pageId: [', format: 'yaml', filename: 'broken.yaml' });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.parseError).toMatchObject({ filename: 'broken.yaml' });
        (0, vitest_1.expect)(result.layers.L2).toHaveLength(0);
    });
    (0, vitest_1.it)('returns structured internalError objects', function () {
        var result = (0, validation_runner_js_1.validateContent)({ content: 'a'.repeat(1024 * 1024 + 1), format: 'yaml', filename: 'too-large.yaml' });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.internalError).toMatchObject({ message: 'content 超过 1MB 限制' });
        (0, vitest_1.expect)(result.summary).toContain('content 超过 1MB 限制');
    });
    (0, vitest_1.it)('classifies child-process buffer overflow without parsing truncated JSON', function () {
        var _a, _b;
        (0, validation_runner_js_1.setLayerScriptExecutorForTest)(function () {
            throw Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' });
        });
        var result = (0, validation_runner_js_1.validateContent)({
            content: JSON.stringify({
                meta: { pageId: 'buffer-overflow', title: 'Buffer overflow', protocolVersion: '0.2' },
                body: { type: 'text', props: { content: 'Value' } },
            }),
            format: 'json',
        });
        (0, vitest_1.expect)((_a = result.internalError) === null || _a === void 0 ? void 0 : _a.message).toContain('校验脚本输出超过 16MB 内部上限');
        (0, vitest_1.expect)((_b = result.internalError) === null || _b === void 0 ? void 0 : _b.message).not.toContain('无法解析');
    });
    (0, vitest_1.it)('returns internalError when the temporary directory cannot be created', function () {
        (0, validation_runner_js_1.setTempDirCreatorForTest)(function () {
            throw new Error('ENOENT: C:\\internal\\temp\\schema-ui-mcp');
        });
        var result = (0, validation_runner_js_1.validateContent)({
            content: readOfficialScenario(paths_js_1.PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
            format: 'yaml',
            filename: 'data-table.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.internalError).toEqual({ message: '无法创建校验临时目录' });
        (0, vitest_1.expect)(result.summary).toContain('校验内部错误');
    });
    (0, vitest_1.it)('warns without changing the result when temporary directory cleanup fails', function () {
        var warn = vitest_1.vi.spyOn(console, 'warn').mockImplementation(function () { return undefined; });
        (0, validation_runner_js_1.setTempDirRemoverForTest)(function (tempDir) {
            node_fs_1.default.rmSync(tempDir, { recursive: true, force: true });
            throw new Error('cleanup failed');
        });
        var result = (0, validation_runner_js_1.validateContent)({
            content: readOfficialScenario(paths_js_1.PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
            format: 'yaml',
            filename: 'data-table.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(true);
        (0, vitest_1.expect)(result.internalError).toBeNull();
        (0, vitest_1.expect)(warn).toHaveBeenCalledWith(vitest_1.expect.stringContaining('临时目录清理失败: cleanup failed'));
    });
    (0, vitest_1.it)('returns internalError when a layer script emits non-json output', function () {
        (0, validation_runner_js_1.setLayerScriptExecutorForTest)(function (scriptName) {
            if (scriptName === 'validate-l2-components.js')
                return 'not json';
            return JSON.stringify({ violations: [], parseErrors: [] });
        });
        var result = (0, validation_runner_js_1.validateContent)({
            content: readOfficialScenario(paths_js_1.PROTOCOL_ROOT, 'docs/05-scenarios/data-table.md'),
            format: 'yaml',
            filename: 'data-table.yaml',
        });
        (0, vitest_1.expect)(result.passed).toBe(false);
        (0, vitest_1.expect)(result.internalError).toMatchObject({ message: '[L2] 无法解析校验脚本 JSON 输出' });
        (0, vitest_1.expect)(result.layers.L2).toHaveLength(0);
        (0, vitest_1.expect)(result.summary).toContain('校验内部错误');
    });
});
