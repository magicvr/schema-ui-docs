'use strict';

const path = require('node:path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function protocolRoot() {
  return path.resolve(process.env.SCHEMA_UI_PROTOCOL_ROOT || WORKSPACE_ROOT);
}

function protocolPath(...segments) {
  return path.join(protocolRoot(), ...segments);
}

module.exports = { WORKSPACE_ROOT, protocolRoot, protocolPath };
