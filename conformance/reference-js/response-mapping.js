'use strict';

function failure(code, path) {
  return { ok: false, code, path };
}

function readPath(response, path) {
  let current = response;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current) || !(segment in current)) {
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

function mapResponse(input) {
  const mapping = Object.hasOwn(input, 'localMapping')
    ? input.localMapping
    : input.datasourceMapping;
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