'use strict';

const { serializeQuery } = require('./query-serialization');

const ROW_REFERENCE = /^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
const PROTOCOL_RELATIVE_URL = /^\/(?!\/)[^\s\\]*$/;
const RESERVED_ROW_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const INVOCATION_ID = /^[\x21-\x7e]{1,200}$/;

function failure(code, path) {
  return { ok: false, code, path };
}

function validateProtocolUrl(url, path) {
  return typeof url === 'string' && PROTOCOL_RELATIVE_URL.test(url)
    ? null
    : failure('INVALID_PROTOCOL_URL', path);
}

function isScalar(value) {
  return value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function requestMetadata(action, invocationId) {
  const retryPolicy = action.retryPolicy === undefined ? 'never' : action.retryPolicy;
  if (!['never', 'idempotent'].includes(retryPolicy)) {
    return failure('INVALID_RETRY_POLICY', 'action.retryPolicy');
  }
  if (retryPolicy === 'never') return { ok: true, headers: null };
  if (typeof invocationId !== 'string' || !INVOCATION_ID.test(invocationId)) {
    return failure('MISSING_INVOCATION_ID', 'invocationId');
  }
  return { ok: true, headers: { 'Idempotency-Key': invocationId } };
}

function addRequestMetadata(request, metadata) {
  if (metadata.headers) request.headers = metadata.headers;
  return request;
}

function resolveRowValue(value, row) {
  if (typeof value !== 'string') return { found: true, value };
  const match = ROW_REFERENCE.exec(value);
  if (!match) return { found: true, value };
  let current = row;
  for (const segment of match[1].split('.')) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
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
    const rowReference = typeof configuredValue === 'string' ? ROW_REFERENCE.exec(configuredValue) : null;
    if (rowReference && rowReference[1].split('.').some(segment => RESERVED_ROW_PATH_SEGMENTS.has(segment))) {
      return failure('UNSAFE_ROW_PATH', `requestMapping.${section}.${key}`);
    }
    const resolved = resolveRowValue(configuredValue, row);
    if (!resolved.found) return failure('UNRESOLVED_ROW_VALUE', `requestMapping.${section}.${key}`);
    if (section !== 'query' || resolved.value !== undefined) {
      if (!isScalar(resolved.value)) return failure('INVALID_ROW_VALUE', `requestMapping.${section}.${key}`);
    }
    output.push([key, resolved.value]);
  }
  return { ok: true, entries: output };
}

function buildDataRefRequest(dataRef) {
  const method = dataRef.method === undefined ? 'GET' : dataRef.method;
  if (method !== 'GET') return failure('DATA_REF_METHOD_NOT_READ_ONLY', 'dataRef.method');
  const urlError = validateProtocolUrl(dataRef.url, 'dataRef.url');
  if (urlError) return urlError;
  const serialized = serializeQuery(dataRef.url, [Object.entries(dataRef.params || {})]);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    request: { method, url: serialized.url, body: null },
  };
}

function buildRowActionRequest(input) {
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
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
  const metadata = requestMetadata(input.action, input.invocationId);
  if (!metadata.ok) return metadata;
  return {
    ok: true,
    request: addRequestMetadata({
      method: input.action.method === undefined ? 'GET' : input.action.method,
      url: serialized.url,
      body: bodyValues.entries.length === 0 ? null : Object.fromEntries(bodyValues.entries),
    }, metadata),
  };
}

function buildFormActionRequest(input) {
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  const body = input.action.bodyMapping
    ? Object.fromEntries(Object.entries(input.action.bodyMapping).map(([source, target]) => [target, input.formValues[source]]))
    : { ...input.formValues };
  const serialized = serializeQuery(input.action.url, []);
  if (!serialized.ok) return serialized;
  const metadata = requestMetadata(input.action, input.invocationId);
  if (!metadata.ok) return metadata;
  return {
    ok: true,
    request: addRequestMetadata({
      method: input.action.method,
      url: serialized.url,
      body,
    }, metadata),
  };
}

function buildRequest(input) {
  if (input.kind === 'dataRef') return buildDataRefRequest(input.dataRef);
  if (input.kind === 'rowAction') return buildRowActionRequest(input);
  if (input.kind === 'formAction') return buildFormActionRequest(input);
  return failure('INVALID_REQUEST_KIND', 'kind');
}

module.exports = { buildRequest };
