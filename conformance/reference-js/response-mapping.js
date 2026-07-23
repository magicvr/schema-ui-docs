'use strict';

function failure(code, path) {
  return { ok: false, code, path };
}

function readPath(response, path) {
  let current = response;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)
      || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function resolveMappedValue(response, path) {
  const resolved = readPath(response, path);
  return resolved.found ? resolved : failure('RESPONSE_MAPPING_PATH_MISSING', path);
}

function mapFormRecord(input) {
  const mapping = input.responseMapping;
  if (mapping === undefined || mapping === null || typeof mapping !== 'object'
    || Array.isArray(mapping) || Object.keys(mapping).length === 0) {
    return failure('INVALID_RESPONSE_MAPPING', 'responseMapping');
  }
  const values = {};
  for (const [field, pathExpr] of Object.entries(mapping)) {
    if (typeof field !== 'string' || field.length === 0
      || typeof pathExpr !== 'string' || pathExpr.length === 0) {
      return failure('INVALID_RESPONSE_MAPPING', `responseMapping.${field}`);
    }
    const resolved = readPath(input.response, pathExpr);
    // ADR-0021 D5a / V273: missing path does not abort the whole fill.
    // Conformance-observable value is JSON null (equivalent empty initial; not undefined).
    values[field] = resolved.found ? resolved.value : null;
  }
  return { ok: true, values };
}

function mapResponse(input) {
  if (input.component === 'formRecord') {
    return mapFormRecord(input);
  }
  const mapping = Object.hasOwn(input, 'localMapping')
    ? input.localMapping
    : input.datasourceMapping;
  if (mapping !== undefined && (mapping === null || typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length === 0)) {
    return failure('INVALID_RESPONSE_MAPPING', 'localMapping');
  }
  if ((input.component === 'statCard' || input.component === 'text') && mapping !== undefined) {
    return failure('RESPONSE_MAPPING_NOT_SUPPORTED', 'localMapping');
  }
  if (input.component === 'chart' && mapping === undefined) {
    return Array.isArray(input.response)
      ? { ok: true, data: { list: input.response } }
      : failure('RESPONSE_MAPPING_TYPE_MISMATCH', '$');
  }

  const listPath = mapping?.list || 'list';
  const list = resolveMappedValue(input.response, listPath);
  if (!list.found) return list;
  if (!Array.isArray(list.value)) return failure('RESPONSE_MAPPING_TYPE_MISMATCH', listPath);

  const data = { list: list.value };
  if (input.component === 'table' && input.paginationMode === 'server') {
    const totalPath = mapping?.total || 'total';
    const total = resolveMappedValue(input.response, totalPath);
    if (!total.found) return total;
    if (typeof total.value !== 'number' || !Number.isFinite(total.value)) {
      return failure('RESPONSE_MAPPING_TYPE_MISMATCH', totalPath);
    }
    data.total = total.value;
  }
  return { ok: true, data };
}

module.exports = { mapResponse };