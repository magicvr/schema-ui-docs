'use strict';

function failure(code) {
  return { ok: false, code };
}

function resolveStaticValue(input) {
  if (input.data.source === 'static') return { ok: true, value: input.data.value };
  if (input.data.source !== 'ref') return failure('STATIC_DATA_REF_INVALID');
  const target = input.datasources?.[input.data.ref];
  if (!target || target.source !== 'static') return failure('STATIC_DATA_REF_INVALID');
  if (input.data.responseMapping !== undefined || target.responseMapping !== undefined) {
    return failure('STATIC_RESPONSE_MAPPING_NOT_ALLOWED');
  }
  return { ok: true, value: target.value };
}

function resolveStaticData(input) {
  if (input.data.responseMapping !== undefined) return failure('STATIC_RESPONSE_MAPPING_NOT_ALLOWED');
  const resolved = resolveStaticValue(input);
  if (!resolved.ok) return resolved;
  const value = resolved.value;
  if ((input.component === 'table' || input.component === 'chart') && !Array.isArray(value)) {
    return failure('STATIC_DATA_SHAPE_MISMATCH');
  }
  if (input.component === 'statCard' || input.component === 'text') {
    const scalarOrObject = value !== null && !Array.isArray(value)
      && (typeof value !== 'object' || Object.getPrototypeOf(value) === Object.prototype);
    if (!scalarOrObject) return failure('STATIC_DATA_SHAPE_MISMATCH');
    if (input.props?.valueField) {
      if (typeof value !== 'object'
        || !Object.prototype.hasOwnProperty.call(value, input.props.valueField)) {
        return failure('STATIC_DATA_SHAPE_MISMATCH');
      }
      return { ok: true, value: value[input.props.valueField], network: false };
    }
  }
  return { ok: true, value, network: false };
}

module.exports = { resolveStaticData };
