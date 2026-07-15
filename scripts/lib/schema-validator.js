'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Ajv } = require('ajv');

function readJsonSchema(protocolRoot, fileName) {
  return JSON.parse(fs.readFileSync(path.join(protocolRoot, 'docs', 'schemas', fileName), 'utf8'));
}

function createPageValidator(protocolRoot) {
  const pageSchema = readJsonSchema(protocolRoot, 'page.schema.json');
  const nodeSchema = readJsonSchema(protocolRoot, 'node.schema.json');
  const actionSchema = readJsonSchema(protocolRoot, 'action.schema.json');
  const reactionSchema = readJsonSchema(protocolRoot, 'reaction.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  ajv.addSchema(nodeSchema, 'node.schema.json');
  ajv.addSchema(actionSchema, 'action.schema.json');
  ajv.addSchema(reactionSchema, 'reaction.schema.json');
  return ajv.compile(pageSchema);
}

module.exports = { createPageValidator, readJsonSchema };
