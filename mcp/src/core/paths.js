"use strict";
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
exports.PROTOCOL_ROOT = void 0;
exports.findProtocolRoot = findProtocolRoot;
exports.protocolPath = protocolPath;
exports.toProtocolRelative = toProtocolRelative;
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var node_fs_1 = require("node:fs");
var sourceDir = node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url));
function findProtocolRoot() {
    var candidates = [
        node_path_1.default.resolve(sourceDir, '../../..'),
        node_path_1.default.resolve(process.cwd(), '..'),
        process.cwd(),
    ];
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var candidate = candidates_1[_i];
        if (!candidate || candidate === node_path_1.default.dirname(candidate))
            continue;
        if (node_path_1.default.basename(candidate) === 'mcp' || !node_path_1.default.isAbsolute(candidate))
            continue;
        var docsDir = node_path_1.default.join(candidate, 'docs');
        var scriptsDir = node_path_1.default.join(candidate, 'scripts');
        if (node_fs_1.default.existsSync(docsDir) && node_fs_1.default.statSync(docsDir).isDirectory()
            && node_fs_1.default.existsSync(scriptsDir) && node_fs_1.default.statSync(scriptsDir).isDirectory()) {
            return candidate;
        }
    }
    return node_path_1.default.resolve(sourceDir, '../../..');
}
exports.PROTOCOL_ROOT = findProtocolRoot();
function protocolPath() {
    var segments = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        segments[_i] = arguments[_i];
    }
    return node_path_1.default.join.apply(node_path_1.default, __spreadArray([exports.PROTOCOL_ROOT], segments, false));
}
function toProtocolRelative(filePath) {
    return node_path_1.default.relative(exports.PROTOCOL_ROOT, filePath).split(node_path_1.default.sep).join('/');
}
