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
exports.setLayerScriptExecutorForTest = setLayerScriptExecutorForTest;
exports.setTempDirCreatorForTest = setTempDirCreatorForTest;
exports.setTempDirRemoverForTest = setTempDirRemoverForTest;
exports.validateContent = validateContent;
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var js_yaml_1 = require("js-yaml");
var ajv_1 = require("ajv");
var paths_js_1 = require("./paths.js");
var suggested_docs_js_1 = require("./suggested-docs.js");
var MAX_CONTENT_BYTES = 1024 * 1024;
var MAX_LAYER_SCRIPT_OUTPUT_BYTES = 16 * 1024 * 1024;
var emptyLayers = function () { return ({
    'L0/L1': [],
    L2: [],
    L3a: [],
    L4: [],
}); };
var layerScriptExecutor = defaultLayerScriptExecutor;
var tempDirCreator = node_fs_1.default.mkdtempSync;
var tempDirRemover = defaultTempDirRemover;
function setLayerScriptExecutorForTest(executor) {
    layerScriptExecutor = executor !== null && executor !== void 0 ? executor : defaultLayerScriptExecutor;
}
function setTempDirCreatorForTest(creator) {
    tempDirCreator = creator !== null && creator !== void 0 ? creator : node_fs_1.default.mkdtempSync;
}
function setTempDirRemoverForTest(remover) {
    tempDirRemover = remover !== null && remover !== void 0 ? remover : defaultTempDirRemover;
}
function validateContent(input) {
    var _a, _b;
    var baseResult = {
        passed: false,
        layers: emptyLayers(),
        summary: '',
        parseError: null,
        internalError: null,
        suggestedDocs: [],
    };
    if (!['yaml', 'json'].includes(input.format)) {
        return finalize(__assign(__assign({}, baseResult), { internalError: { message: 'format 必须是 yaml 或 json' } }));
    }
    if (Buffer.byteLength(input.content, 'utf8') > MAX_CONTENT_BYTES) {
        return finalize(__assign(__assign({}, baseResult), { internalError: { message: 'content 超过 1MB 限制' } }));
    }
    var parsedInput = parseInput(input.content, input.format, input.filename);
    if (parsedInput.error) {
        return finalize(__assign(__assign({}, baseResult), { parseError: parsedInput.error }));
    }
    var ext = input.format === 'json' ? 'json' : 'yaml';
    var tempDir = null;
    try {
        tempDir = tempDirCreator(node_path_1.default.join(node_os_1.default.tmpdir(), 'schema-ui-mcp-'));
        var tempFile = node_path_1.default.join(tempDir, "page-".concat(node_crypto_1.default.randomUUID(), ".").concat(ext));
        node_fs_1.default.writeFileSync(tempFile, input.content, { encoding: 'utf8' });
        var layers = emptyLayers();
        var ajvResult = runAjv(tempFile);
        layers['L0/L1'] = ajvResult;
        if (!isPlainObject(parsedInput.value)) {
            return finalize(__assign(__assign({}, baseResult), { layers: layers }));
        }
        var l2 = runLayerScript('validate-l2-components.js', tempFile, 'L2', input.filename);
        var l3a = runLayerScript('validate-l3a-expressions.js', tempFile, 'L3a', input.filename);
        var l4 = runLayerScript('lint-l4-banned-props.js', tempFile, 'L4', input.filename);
        layers.L2 = l2.violations;
        layers.L3a = l3a.violations;
        layers.L4 = l4.violations;
        var internalError = (_b = (_a = l2.internalError) !== null && _a !== void 0 ? _a : l3a.internalError) !== null && _b !== void 0 ? _b : l4.internalError;
        if (internalError) {
            return finalize(__assign(__assign({}, baseResult), { layers: layers, internalError: internalError }));
        }
        var scriptParseError = firstParseError([l2.parseErrors, l3a.parseErrors, l4.parseErrors], input.filename);
        return finalize(__assign(__assign({}, baseResult), { layers: layers, parseError: scriptParseError }));
    }
    catch (error) {
        return finalize(__assign(__assign({}, baseResult), { internalError: {
                message: tempDir === null
                    ? '无法创建校验临时目录'
                    : error instanceof Error ? error.message : String(error),
            } }));
    }
    finally {
        if (tempDir) {
            try {
                tempDirRemover(tempDir);
            }
            catch (cleanupError) {
                // ADR-0007 D5：清理失败应发本地警告，不改变返回结构
                console.warn("[validation-runner] \u4E34\u65F6\u76EE\u5F55\u6E05\u7406\u5931\u8D25: ".concat(cleanupError instanceof Error ? cleanupError.message : String(cleanupError)));
            }
        }
    }
}
function defaultTempDirRemover(tempDir) {
    node_fs_1.default.rmSync(tempDir, { recursive: true, force: true });
}
function parseInput(content, format, filename) {
    try {
        return {
            value: format === 'json' ? JSON.parse(content) : js_yaml_1.default.load(content),
            error: null,
        };
    }
    catch (error) {
        var message = error instanceof Error ? error.message : String(error);
        var mark = typeof error === 'object' && error !== null && 'mark' in error
            ? error.mark
            : undefined;
        return {
            error: {
                message: message,
                line: (mark === null || mark === void 0 ? void 0 : mark.line) === undefined ? undefined : mark.line + 1,
                column: (mark === null || mark === void 0 ? void 0 : mark.column) === undefined ? undefined : mark.column + 1,
                filename: filename,
            },
        };
    }
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function runAjv(filePath) {
    var _a;
    var document = parseFileForAjv(filePath);
    var pageSchema = readJsonSchema('docs/schemas/page.schema.json');
    var nodeSchema = readJsonSchema('docs/schemas/node.schema.json');
    var actionSchema = readJsonSchema('docs/schemas/action.schema.json');
    var reactionSchema = readJsonSchema('docs/schemas/reaction.schema.json');
    var ajv = new ajv_1.Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
    ajv.addSchema(nodeSchema, 'node.schema.json');
    ajv.addSchema(actionSchema, 'action.schema.json');
    ajv.addSchema(reactionSchema, 'reaction.schema.json');
    var validate = ajv.compile(pageSchema);
    if (validate(document))
        return [];
    return ((_a = validate.errors) !== null && _a !== void 0 ? _a : []).map(mapAjvError);
}
function parseFileForAjv(filePath) {
    var raw = node_fs_1.default.readFileSync(filePath, 'utf8');
    var ext = node_path_1.default.extname(filePath).toLowerCase();
    return ext === '.json' ? JSON.parse(raw) : js_yaml_1.default.load(raw);
}
function readJsonSchema(relativePath) {
    return JSON.parse(node_fs_1.default.readFileSync((0, paths_js_1.protocolPath)(relativePath), 'utf8'));
}
function mapAjvError(error) {
    var _a;
    return {
        path: jsonPointerToPath(error.instancePath),
        keyword: error.keyword,
        message: (_a = error.message) !== null && _a !== void 0 ? _a : 'schema 校验失败',
    };
}
function runLayerScript(scriptName, filePath, layer, callerFilename) {
    var _a, _b;
    var raw = '';
    try {
        raw = layerScriptExecutor(scriptName, filePath, layer);
    }
    catch (error) {
        if (isChildBufferOverflow(error)) {
            return {
                violations: [],
                parseErrors: [],
                internalError: { message: "[".concat(layer, "] \u6821\u9A8C\u811A\u672C\u8F93\u51FA\u8D85\u8FC7 16MB \u5185\u90E8\u4E0A\u9650") },
            };
        }
        var childOutput = getChildOutput(error, 'stdout') || getChildOutput(error, 'stderr');
        if (!childOutput.trim()) {
            return {
                violations: [],
                parseErrors: [],
                internalError: { message: "[".concat(layer, "] \u6821\u9A8C\u811A\u672C\u6267\u884C\u5931\u8D25") },
            };
        }
        raw = childOutput;
    }
    var parsed;
    try {
        parsed = raw.trim() ? JSON.parse(raw) : {};
    }
    catch (_c) {
        return {
            violations: [],
            parseErrors: [],
            internalError: { message: "[".concat(layer, "] \u65E0\u6CD5\u89E3\u6790\u6821\u9A8C\u811A\u672C JSON \u8F93\u51FA") },
        };
    }
    return {
        violations: ((_a = parsed.violations) !== null && _a !== void 0 ? _a : []).map(function (item) { return mapScriptViolation(item, layer, callerFilename); }),
        parseErrors: ((_b = parsed.parseErrors) !== null && _b !== void 0 ? _b : []).map(function (item) {
            var _a;
            return ({
                message: (_a = item.error) !== null && _a !== void 0 ? _a : '解析失败',
                filename: callerFilename !== null && callerFilename !== void 0 ? callerFilename : item.file,
            });
        }),
        internalError: null,
    };
}
function defaultLayerScriptExecutor(scriptName, filePath) {
    var scriptPath = (0, paths_js_1.protocolPath)('scripts', scriptName);
    var result = (0, node_child_process_1.spawnSync)(process.execPath, [scriptPath, filePath, '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: MAX_LAYER_SCRIPT_OUTPUT_BYTES,
    });
    if (result.error)
        throw result.error;
    if (result.status !== 0 && !result.stdout.trim()) {
        throw Object.assign(new Error(result.stderr || "\u6821\u9A8C\u811A\u672C\u9000\u51FA\u7801 ".concat(result.status)), {
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
        });
    }
    return result.stdout;
}
function mapScriptViolation(item, layer, callerFilename) {
    var pathValue = stringValue(item.path) || '';
    var message = layer === 'L4'
        ? "\u7981\u7528 CSS \u5C5E\u6027 \"".concat(stringValue(item.key) || pathValue, "\"")
        : stringValue(item.message) || '校验失败';
    // 使用调用方 filename 替换子脚本的临时路径；未提供时省略 file 字段
    var file = callerFilename !== null && callerFilename !== void 0 ? callerFilename : undefined;
    return {
        file: file,
        path: pathValue,
        rule: stringValue(item.rule),
        key: stringValue(item.key),
        message: message,
    };
}
function jsonPointerToPath(pointer) {
    if (!pointer || pointer === '/')
        return '';
    return pointer
        .split('/')
        .filter(Boolean)
        .map(function (segment) { return segment.replace(/~1/g, '/').replace(/~0/g, '~'); })
        .map(function (segment) { return /^\d+$/.test(segment) ? "[".concat(segment, "]") : ".".concat(segment); })
        .join('')
        .replace(/^\./, '');
}
function firstParseError(parseErrors, filename) {
    for (var _i = 0, parseErrors_1 = parseErrors; _i < parseErrors_1.length; _i++) {
        var group = parseErrors_1[_i];
        var first = group[0];
        if (first)
            return __assign(__assign({}, first), { filename: filename !== null && filename !== void 0 ? filename : first.filename });
    }
    return null;
}
function finalize(result) {
    var hasViolations = Object.values(result.layers).some(function (items) { return items.length > 0; });
    var passed = !hasViolations && result.parseError === null && result.internalError === null;
    var finalized = __assign(__assign({}, result), { passed: passed, summary: summarize(passed, result) });
    return __assign(__assign({}, finalized), { suggestedDocs: (0, suggested_docs_js_1.buildSuggestedDocs)(finalized) });
}
function summarize(passed, result) {
    if (passed)
        return '校验通过，未发现协议违规';
    if (result.parseError)
        return "\u89E3\u6790\u5931\u8D25\uFF1A".concat(result.parseError.message);
    if (result.internalError)
        return "\u6821\u9A8C\u5185\u90E8\u9519\u8BEF\uFF1A".concat(result.internalError.message);
    var parts = Object.entries(result.layers)
        .filter(function (_a) {
        var items = _a[1];
        return items.length > 0;
    })
        .map(function (_a) {
        var layer = _a[0], items = _a[1];
        return "".concat(layer, " ").concat(items.length, " \u5904");
    });
    return "\u53D1\u73B0 ".concat(parts.join('，'), " \u534F\u8BAE\u8FDD\u89C4");
}
function getChildOutput(error, key) {
    if (typeof error === 'object' && error !== null && key in error) {
        var value = error[key];
        if (Buffer.isBuffer(value))
            return value.toString('utf8');
        if (typeof value === 'string')
            return value;
    }
    return '';
}
function isChildBufferOverflow(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    return error.code === 'ENOBUFS';
}
function stringValue(value) {
    return typeof value === 'string' ? value : undefined;
}
