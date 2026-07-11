'use strict';

const { serializeQuery } = require('./query-serialization');

const ROW_REFERENCE = /^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

function failure(code, path) {
  return { ok: false, code, path };
}

function resolveRowValue(value, row) {
  if (typeof value !== 'string') return { found: true, value };
  const match = ROW_REFERENCE.exec(value);
  if (!match) return { found: true, value };
  let current = row;
  for (const segment of match[1].split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function encodePathValue(value) {
  if (typeof value === 'string') {
    return encodeURIComponent(value).replace(/[!'()*]/g, character =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function resolveMapping(mapping, row, section) {
  const output = [];
  for (const [key, configuredValue] of Object.entries(mapping || {})) {
    const resolved = resolveRowValue(configuredValue, row);
    if (!resolved.found) return failure('UNRESOLVED_ROW_VALUE', `requestMapping.${section}.${key}`);
    output.push([key, resolved.value]);
  }
  return { ok: true, entries: output };
}

function buildDataRefRequest(dataRef) {
  const serialized = serializeQuery(dataRef.url, [Object.entries(dataRef.params || {})]);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    request: { method: dataRef.method || 'GET', url: serialized.url, body: null },
  };
}

function buildRowActionRequest(input) {
  const mapping = input.requestMapping || {};
  const pathValues = resolveMapping(mapping.path, input.row, 'path');
  if (!pathValues.ok) return pathValues;
  const queryValues = resolveMapping(mapping.query, input.row, 'query');
  if (!queryValues.ok) return queryValues;
  const bodyValues = resolveMapping(mapping.body, input.row, 'body');
  if (!bodyValues.ok) return bodyValues;

  let url = input.action.url;
  for (const [key, value] of pathValues.entries) {
    if (value === null || value === undefined) {
      return failure('NULL_PATH_VALUE', `requestMapping.path.${key}`);
    }
    const encoded = encodePathValue(value);
    if (encoded === null) return failure('INVALID_PATH_VALUE', `requestMapping.path.${key}`);
    url = url.replaceAll(`{${key}}`, encoded);
  }

  const serialized = serializeQuery(url, [queryValues.entries]);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    request: {
      method: input.action.method || 'GET',
      url: serialized.url,
      body: bodyValues.entries.length === 0 ? null : Object.fromEntries(bodyValues.entries),
    },
  };
}

function buildFormActionRequest(input) {
  const body = input.action.bodyMapping
    ? Object.fromEntries(Object.entries(input.action.bodyMapping).map(([source, target]) => [target, input.formValues[source]]))
    : { ...input.formValues };
  const serialized = serializeQuery(input.action.url, []);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    request: {
      method: input.action.method,
      url: serialized.url,
      body,
    },
  };
}

function buildRequest(input) {
  if (input.kind === 'dataRef') return buildDataRefRequest(input.dataRef);
  if (input.kind === 'rowAction') return buildRowActionRequest(input);
  if (input.kind === 'formAction') return buildFormActionRequest(input);
  return failure('INVALID_REQUEST_KIND', 'kind');
}

module.exports = { buildRequest };