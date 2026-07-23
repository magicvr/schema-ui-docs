'use strict';

const { serializeQuery } = require('./query-serialization');

const ROW_REFERENCE = /^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
const ROUTE_REFERENCE = /^\$context\.route\.(query|params)\.([A-Za-z_][A-Za-z0-9_]*)$/;
const PROTOCOL_RELATIVE_URL = /^\/(?!\/)[^\s\\]*$/;
const RESERVED_ROW_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const INVOCATION_ID = /^[\x21-\x7e]{1,200}$/;
const PAGE_TRIGGER_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

function resolveRouteValue(value, route) {
  if (typeof value !== 'string') return { found: true, value };
  const match = ROUTE_REFERENCE.exec(value);
  if (!match) return { found: true, value };
  const bag = route && typeof route === 'object' ? route[match[1]] : undefined;
  if (bag === null || typeof bag !== 'object' || !Object.prototype.hasOwnProperty.call(bag, match[2])) {
    return { found: false };
  }
  return { found: true, value: bag[match[2]] };
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

function resolveMapping(mapping, row, section, pathPrefix = 'requestMapping') {
  const output = [];
  for (const [key, configuredValue] of Object.entries(mapping || {})) {
    const fieldPath = `${pathPrefix}.${section}.${key}`;
    if (typeof configuredValue === 'string' && configuredValue.includes('$') && !ROW_REFERENCE.test(configuredValue)) {
      return failure('INVALID_MAPPING_VALUE', fieldPath);
    }
    const rowReference = typeof configuredValue === 'string' ? ROW_REFERENCE.exec(configuredValue) : null;
    if (rowReference && rowReference[1].split('.').some(segment => RESERVED_ROW_PATH_SEGMENTS.has(segment))) {
      return failure('UNSAFE_ROW_PATH', fieldPath);
    }
    const resolved = resolveRowValue(configuredValue, row);
    if (!resolved.found || resolved.value === undefined) {
      return failure('UNRESOLVED_ROW_VALUE', fieldPath);
    }
    if (!isScalar(resolved.value)) return failure('INVALID_ROW_VALUE', fieldPath);
    output.push([key, resolved.value]);
  }
  return { ok: true, entries: output };
}

function resolveRouteMapping(mapping, route, section) {
  const output = [];
  for (const [key, configuredValue] of Object.entries(mapping || {})) {
    const fieldPath = `recordSource.${section}.${key}`;
    if (typeof configuredValue === 'string' && configuredValue.includes('$') && !ROUTE_REFERENCE.test(configuredValue)) {
      return failure('INVALID_MAPPING_VALUE', fieldPath);
    }
    const resolved = resolveRouteValue(configuredValue, route);
    if (!resolved.found || resolved.value === undefined) {
      return failure('UNRESOLVED_ROUTE_VALUE', fieldPath);
    }
    if (!isScalar(resolved.value)) return failure('INVALID_ROUTE_VALUE', fieldPath);
    output.push([key, resolved.value]);
  }
  return { ok: true, entries: output };
}

function extractUrlPathParams(url) {
  if (typeof url !== 'string') return [];
  return Array.from(url.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g), match => match[1]);
}

function hasInvalidUrlTemplate(url) {
  if (typeof url !== 'string') return false;
  return url.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '').includes('{')
    || url.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '').includes('}');
}

/**
 * Fail-closed path application (V267): URL placeholders and path mapping keys must be equal sets.
 * Missing placeholder → MISSING_PATH_BINDING; extra mapping key → EXTRA_PATH_BINDING;
 * invalid brace syntax → INVALID_URL_TEMPLATE; residual template after apply → UNRESOLVED_PATH_TEMPLATE.
 */
function applyPathParams(url, pathEntries, pathPrefix) {
  if (hasInvalidUrlTemplate(url)) {
    return failure('INVALID_URL_TEMPLATE', pathPrefix);
  }
  const placeholders = extractUrlPathParams(url);
  const placeholderSet = new Set(placeholders);
  const mappingKeys = pathEntries.map(([key]) => key);
  const mappingKeySet = new Set(mappingKeys);

  for (const placeholder of placeholderSet) {
    if (!mappingKeySet.has(placeholder)) {
      return failure('MISSING_PATH_BINDING', `${pathPrefix}.${placeholder}`);
    }
  }
  for (const key of mappingKeys) {
    if (!placeholderSet.has(key)) {
      return failure('EXTRA_PATH_BINDING', `${pathPrefix}.${key}`);
    }
  }

  let nextUrl = url;
  for (const [key, value] of pathEntries) {
    if (value === null || value === undefined) {
      return failure('NULL_PATH_VALUE', `${pathPrefix}.${key}`);
    }
    const encoded = encodePathValue(value);
    if (encoded === null) return failure('INVALID_PATH_VALUE', `${pathPrefix}.${key}`);
    nextUrl = nextUrl.replaceAll(`{${key}}`, encoded);
  }
  // Residual valid or invalid braces after substitution are protocol failures.
  if (/[{}]/.test(nextUrl)) {
    return failure('UNRESOLVED_PATH_TEMPLATE', pathPrefix);
  }
  return { ok: true, url: nextUrl };
}

function requestQuery(url) {
  const requestPart = url.split('#', 1)[0];
  const queryIndex = requestPart.indexOf('?');
  return queryIndex === -1 ? '' : requestPart.slice(queryIndex + 1);
}

function applyRequestInterceptor(request, interceptor) {
  if (interceptor === undefined) return { ok: true, request };
  const candidate = { ...request, ...interceptor };
  if (request.method === 'GET' && (candidate.method !== 'GET'
    || (candidate.body !== null && candidate.body !== undefined)
    || typeof candidate.url !== 'string'
    || requestQuery(candidate.url) !== requestQuery(request.url))) {
    return failure('INTERCEPTOR_VIOLATION', 'requestInterceptor');
  }
  return { ok: true, request: candidate };
}
function buildDataRefRequest(dataRef) {
  const method = dataRef.method === undefined ? 'GET' : dataRef.method;
  if (method !== 'GET') return failure('DATA_REF_METHOD_NOT_READ_ONLY', 'dataRef.method');
  const urlError = validateProtocolUrl(dataRef.url, 'dataRef.url');
  if (urlError) return urlError;
  const serialized = serializeQuery(dataRef.url, [Object.entries(dataRef.params || {})]);
  if (!serialized.ok) return serialized;
  const request = {
    method,
    url: serialized.url,
    body: null,
  };
  const intercepted = applyRequestInterceptor(request, dataRef.requestInterceptor);
  if (!intercepted.ok) return intercepted;
  return {
    ok: true,
    request: intercepted.request,
  };
}

function buildRowActionRequest(input) {
  const method = input.action.method === undefined ? 'GET' : input.action.method;
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  const mapping = input.requestMapping || {};
  if (['GET', 'DELETE'].includes(method) && mapping.body && Object.keys(mapping.body).length > 0) {
    return failure('REQUEST_BODY_NOT_ALLOWED', 'requestMapping.body');
  }
  const pathValues = resolveMapping(mapping.path, input.row, 'path');
  if (!pathValues.ok) return pathValues;
  const queryValues = resolveMapping(mapping.query, input.row, 'query');
  if (!queryValues.ok) return queryValues;
  const bodyValues = resolveMapping(mapping.body, input.row, 'body');
  if (!bodyValues.ok) return bodyValues;

  const withPath = applyPathParams(input.action.url, pathValues.entries, 'requestMapping.path');
  if (!withPath.ok) return withPath;

  const serialized = serializeQuery(withPath.url, [queryValues.entries]);
  if (!serialized.ok) return serialized;
  const metadata = requestMetadata(input.action, input.invocationId);
  if (!metadata.ok) return metadata;
  return {
    ok: true,
    request: addRequestMetadata({
      method,
      url: serialized.url,
      body: bodyValues.entries.length === 0 ? null : Object.fromEntries(bodyValues.entries),
    }, metadata),
  };
}

function buildRowNavigate(input) {
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  const mapping = input.navigateMapping || {};
  if (mapping.body !== undefined) {
    return failure('NAVIGATE_BODY_NOT_ALLOWED', 'navigateMapping.body');
  }
  const hasPath = mapping.path && Object.keys(mapping.path).length > 0;
  const hasQuery = mapping.query && Object.keys(mapping.query).length > 0;
  if (!hasPath && !hasQuery) {
    return failure('EMPTY_NAVIGATE_MAPPING', 'navigateMapping');
  }
  const pathValues = resolveMapping(mapping.path, input.row, 'path', 'navigateMapping');
  if (!pathValues.ok) return pathValues;
  const queryValues = resolveMapping(mapping.query, input.row, 'query', 'navigateMapping');
  if (!queryValues.ok) return queryValues;
  const withPath = applyPathParams(input.action.url, pathValues.entries, 'navigateMapping.path');
  if (!withPath.ok) return withPath;
  const serialized = serializeQuery(withPath.url, [queryValues.entries]);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    navigation: {
      url: serialized.url,
    },
  };
}

function buildRecordSourceRequest(input) {
  const recordSource = input.recordSource || {};
  // V270: method is required (matches component DSL / L2); do not default to GET.
  if (recordSource.method === undefined) {
    return failure('MISSING_RECORD_SOURCE_METHOD', 'recordSource.method');
  }
  if (recordSource.method !== 'GET') {
    return failure('RECORD_SOURCE_METHOD_NOT_GET', 'recordSource.method');
  }
  const urlError = validateProtocolUrl(recordSource.url, 'recordSource.url');
  if (urlError) return urlError;
  if (recordSource.ref !== undefined || recordSource.source !== undefined) {
    return failure('RECORD_SOURCE_REF_NOT_ALLOWED', 'recordSource');
  }
  const responseMapping = recordSource.responseMapping;
  if (responseMapping === undefined || responseMapping === null
    || typeof responseMapping !== 'object' || Array.isArray(responseMapping)
    || Object.keys(responseMapping).length === 0) {
    return failure('EMPTY_RESPONSE_MAPPING', 'recordSource.responseMapping');
  }
  for (const [field, pathExpr] of Object.entries(responseMapping)) {
    if (typeof field !== 'string' || field.length === 0
      || typeof pathExpr !== 'string' || pathExpr.length === 0) {
      return failure('INVALID_RESPONSE_MAPPING', `recordSource.responseMapping.${field}`);
    }
  }
  const pathValues = resolveRouteMapping(recordSource.path, input.route, 'path');
  if (!pathValues.ok) return pathValues;
  const queryValues = resolveRouteMapping(recordSource.query, input.route, 'query');
  if (!queryValues.ok) return queryValues;
  const withPath = applyPathParams(recordSource.url, pathValues.entries, 'recordSource.path');
  if (!withPath.ok) return withPath;
  const serialized = serializeQuery(withPath.url, [queryValues.entries]);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    request: {
      method: 'GET',
      url: serialized.url,
      body: null,
    },
  };
}

/**
 * Shared confirm gate for page-level ActionTrigger (V272 / ADR-0020 D4).
 * When `confirm` is a non-empty string, `confirmAccepted` must be true or the invocation is cancelled.
 */
function applyConfirmGate(input) {
  const confirm = input.confirm;
  if (confirm === undefined || confirm === null || confirm === '') return null;
  if (typeof confirm !== 'string') {
    return failure('INVALID_CONFIRM', 'confirm');
  }
  if (input.confirmAccepted !== true) {
    return failure('CONFIRM_REJECTED', 'confirm');
  }
  return null;
}

function buildPageTriggerRequest(input) {
  const confirmError = applyConfirmGate(input);
  if (confirmError) return confirmError;
  const method = input.action.method;
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  if (!PAGE_TRIGGER_METHODS.has(method)) {
    return failure('PAGE_TRIGGER_METHOD_NOT_ALLOWED', 'action.method');
  }
  if (/[{}]/.test(input.action.url || '')) {
    return failure('UNBOUND_URL_TEMPLATE', 'action.url');
  }
  const serialized = serializeQuery(input.action.url, []);
  if (!serialized.ok) return serialized;
  const metadata = requestMetadata(input.action, input.invocationId);
  if (!metadata.ok) return metadata;
  return {
    ok: true,
    request: addRequestMetadata({
      method,
      url: serialized.url,
      body: null,
    }, metadata),
  };
}

/** Page ActionTrigger → type:navigate (static url; no row mapping). V272. */
function buildPageTriggerNavigate(input) {
  const confirmError = applyConfirmGate(input);
  if (confirmError) return confirmError;
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  if (/[{}]/.test(input.action.url || '')) {
    return failure('UNBOUND_URL_TEMPLATE', 'action.url');
  }
  const serialized = serializeQuery(input.action.url, []);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    navigation: {
      url: serialized.url,
    },
  };
}

/** Page ActionTrigger → type:modal. Observable open only (no DOM). V272. */
function buildPageTriggerModal(input) {
  const confirmError = applyConfirmGate(input);
  if (confirmError) return confirmError;
  const action = input.action || {};
  if (action.modalId === undefined && action.content === undefined) {
    return failure('INVALID_MODAL_ACTION', 'action');
  }
  const modal = {};
  if (action.modalId !== undefined) modal.modalId = action.modalId;
  if (action.content !== undefined) modal.hasContent = true;
  return {
    ok: true,
    modalOpen: modal,
  };
}

function resolveBatchMappingValue(configuredValue, selection, fieldPath) {
  if (configuredValue === '$selection.keys') {
    return { ok: true, value: [...(selection.keys || [])] };
  }
  if (configuredValue === '$selection.count') {
    return { ok: true, value: selection.count };
  }
  if (typeof configuredValue === 'string' && configuredValue.includes('$')) {
    return failure('INVALID_MAPPING_VALUE', fieldPath);
  }
  if (!isScalar(configuredValue)) {
    return failure('INVALID_MAPPING_VALUE', fieldPath);
  }
  return { ok: true, value: configuredValue };
}

function resolveBatchSection(mappingSection, selection, sectionName) {
  const output = [];
  for (const [key, configuredValue] of Object.entries(mappingSection || {})) {
    const fieldPath = `batchMapping.${sectionName}.${key}`;
    if (configuredValue === '$selection.keys' && sectionName !== 'body') {
      return failure('SELECTION_KEYS_BODY_ONLY', fieldPath);
    }
    if (configuredValue === '$selection.count' && sectionName === 'path') {
      return failure('INVALID_MAPPING_VALUE', fieldPath);
    }
    const resolved = resolveBatchMappingValue(configuredValue, selection, fieldPath);
    if (!resolved.ok) return resolved;
    output.push([key, resolved.value]);
  }
  return { ok: true, entries: output };
}

function buildBatchRequest(input) {
  const confirmError = applyConfirmGate(input);
  if (confirmError) return confirmError;
  const keys = Array.isArray(input.selection?.keys) ? input.selection.keys : [];
  const count = input.selection?.count !== undefined ? input.selection.count : keys.length;
  const selection = { keys, count };
  if (keys.length === 0 || count === 0) {
    return failure('EMPTY_SELECTION', 'selection');
  }
  const method = input.action.method;
  if (!PAGE_TRIGGER_METHODS.has(method)) {
    return failure('PAGE_TRIGGER_METHOD_NOT_ALLOWED', 'action.method');
  }
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  const mapping = input.batchMapping || {};
  const pathValues = resolveBatchSection(mapping.path, selection, 'path');
  if (!pathValues.ok) return pathValues;
  const queryValues = resolveBatchSection(mapping.query, selection, 'query');
  if (!queryValues.ok) return queryValues;
  const bodyValues = resolveBatchSection(mapping.body, selection, 'body');
  if (!bodyValues.ok) return bodyValues;
  const withPath = applyPathParams(input.action.url, pathValues.entries, 'batchMapping.path');
  if (!withPath.ok) return withPath;
  const serialized = serializeQuery(withPath.url, [queryValues.entries]);
  if (!serialized.ok) return serialized;
  const metadata = requestMetadata(input.action, input.invocationId);
  if (!metadata.ok) return metadata;
  const body = bodyValues.entries.length === 0 ? null : Object.fromEntries(bodyValues.entries);
  return {
    ok: true,
    request: addRequestMetadata({
      method,
      url: serialized.url,
      body,
    }, metadata),
    selectionAfterSuccessReload: { keys: [], count: 0 },
  };
}

function buildFormActionRequest(input) {
  const method = input.action.method;
  const urlError = validateProtocolUrl(input.action.url, 'action.url');
  if (urlError) return urlError;
  if (method === 'GET') return failure('FORM_GET_NOT_ALLOWED', 'action.method');
  if (/[{}]/.test(input.action.url)) return failure('UNBOUND_URL_TEMPLATE', 'action.url');
  const formValues = input.formValues || {};
  const formProjection = input.formProjection;
  const effectiveValues = formProjection === undefined || formProjection === null
    ? formValues
    : Object.fromEntries(Object.entries(formProjection).filter(([, field]) => field && field.mounted !== false
      && field.visible !== false && field.disabled !== true && field.uploadStatus !== 'error'
      && Object.prototype.hasOwnProperty.call(field, 'value'))
      .map(([name, field]) => [name, field.value]));
  let body;
  if (input.action.bodyMapping) {
    body = {};
    for (const [source, target] of Object.entries(input.action.bodyMapping)) {
      if (!Object.prototype.hasOwnProperty.call(effectiveValues, source)
        || effectiveValues[source] === undefined) {
        return failure('UNRESOLVED_FORM_VALUE', `bodyMapping.${source}`);
      }
      body[target] = effectiveValues[source];
    }
  } else {
    body = { ...effectiveValues };
  }
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
  if (input.kind === 'rowNavigate') return buildRowNavigate(input);
  if (input.kind === 'recordSource') return buildRecordSourceRequest(input);
  if (input.kind === 'pageTriggerRequest') return buildPageTriggerRequest(input);
  if (input.kind === 'pageTriggerNavigate') return buildPageTriggerNavigate(input);
  if (input.kind === 'pageTriggerModal') return buildPageTriggerModal(input);
  if (input.kind === 'batchRequest') return buildBatchRequest(input);
  if (input.kind === 'formAction') return buildFormActionRequest(input);
  return failure('INVALID_REQUEST_KIND', 'kind');
}

module.exports = { buildRequest };
