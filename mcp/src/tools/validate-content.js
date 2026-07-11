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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContentInputSchema = void 0;
exports.handleValidateContent = handleValidateContent;
var v4_1 = require("zod/v4");
var validation_runner_js_1 = require("../core/validation-runner.js");
exports.validateContentInputSchema = {
    content: v4_1.z.string().max(1024 * 1024),
    format: v4_1.z.enum(['yaml', 'json']),
    filename: v4_1.z.string().max(260).optional(),
};
var MAX_TOOL_TEXT_BYTES = 20 * 1024;
var LAYERS = ['L0/L1', 'L2', 'L3a', 'L4'];
function truncateUtf8(value, maxBytes) {
    var buffer = Buffer.from(value, 'utf8');
    if (buffer.length <= maxBytes)
        return value;
    var end = maxBytes;
    while (end > 0 && (buffer[end] & 0xc0) === 0x80)
        end--;
    return "".concat(buffer.subarray(0, end).toString('utf8'), "...");
}
function compactViolation(violation) {
    return Object.fromEntries(Object.entries(violation).map(function (_a) {
        var key = _a[0], value = _a[1];
        return [
            key,
            typeof value === 'string' ? truncateUtf8(value, 256) : value,
        ];
    }));
}
function compactError(error) {
    if (!error)
        return error;
    return __assign(__assign({}, error), { message: truncateUtf8(error.message, 1024), filename: error.filename === undefined ? undefined : truncateUtf8(error.filename, 260) });
}
function serializeWithinBudget(result) {
    var totals = Object.fromEntries(LAYERS.map(function (layer) { return [layer, result.layers[layer].length]; }));
    var layers = Object.fromEntries(LAYERS.map(function (layer) { return [layer, __spreadArray([], result.layers[layer], true)]; }));
    var build = function (compact) {
        if (compact === void 0) { compact = false; }
        var returnedLayers = Object.fromEntries(LAYERS.map(function (layer) { return [
            layer,
            compact ? layers[layer].map(compactViolation) : layers[layer],
        ]; }));
        var layerStats = Object.fromEntries(LAYERS.map(function (layer) { return [layer, {
                total: totals[layer],
                returned: returnedLayers[layer].length,
                omitted: totals[layer] - returnedLayers[layer].length,
            }]; }));
        return __assign(__assign({}, result), { layers: returnedLayers, layerStats: layerStats, truncated: LAYERS.some(function (layer) { return layerStats[layer].omitted > 0; }), summary: compact ? truncateUtf8(result.summary, 1024) : result.summary, parseError: compact ? compactError(result.parseError) : result.parseError, internalError: compact ? compactError(result.internalError) : result.internalError });
    };
    var serialize = function (compact) {
        if (compact === void 0) { compact = false; }
        return JSON.stringify(build(compact), null, 2);
    };
    var text = serialize();
    while (Buffer.byteLength(text, 'utf8') > MAX_TOOL_TEXT_BYTES) {
        var removable = LAYERS
            .filter(function (layer) { return layers[layer].length > 1; })
            .sort(function (left, right) { return layers[right].length - layers[left].length; })[0];
        if (!removable)
            break;
        layers[removable].pop();
        text = serialize();
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_TOOL_TEXT_BYTES)
        text = serialize(true);
    return text;
}
function handleValidateContent(args) {
    return { content: [{ type: 'text', text: serializeWithinBudget((0, validation_runner_js_1.validateContent)(args)) }] };
}
