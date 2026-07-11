"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSuggestedDocs = buildSuggestedDocs;
var DOCS_BY_SOURCE = {
    'L0/L1': ['docs/01-node-protocol.md', 'docs/schemas/page.schema.json', 'docs/schemas/node.schema.json'],
    L2: ['docs/03-component-registry.md', 'docs/schemas/component-registry.json'],
    L3a: ['docs/02-reaction-expression.md', 'docs/03-component-registry.md'],
    L4: ['docs/06-validation.md', 'docs/01-node-protocol.md'],
    parseError: ['docs/01-node-protocol.md', 'docs/06-validation.md'],
    'actions.upload': ['docs/01-node-protocol.md', 'docs/07-actions-contract.md', 'docs/08-renderer-spec.md'],
    'actions.row.request': ['docs/03-component-registry.md', 'docs/07-actions-contract.md', 'docs/08-renderer-spec.md'],
};
function buildSuggestedDocs(result) {
    var docs = [];
    if (result.parseError)
        append(docs, DOCS_BY_SOURCE.parseError);
    for (var _i = 0, _a = Object.keys(result.layers); _i < _a.length; _i++) {
        var layer = _a[_i];
        if (result.layers[layer].length > 0)
            append(docs, DOCS_BY_SOURCE[layer]);
    }
    var hasUploadCapabilityIssue = result.layers.L2.some(function (item) { return item.message.includes('actions.upload'); });
    if (hasUploadCapabilityIssue)
        append(docs, DOCS_BY_SOURCE['actions.upload']);
    var hasRowRequestCapabilityIssue = result.layers.L2.some(function (item) { return item.message.includes('actions.row.request'); });
    if (hasRowRequestCapabilityIssue)
        append(docs, DOCS_BY_SOURCE['actions.row.request']);
    return docs;
}
function append(target, docs) {
    for (var _i = 0, docs_1 = docs; _i < docs_1.length; _i++) {
        var doc = docs_1[_i];
        if (!target.includes(doc))
            target.push(doc);
    }
}
