'use strict';

function validateRuntimeDefaults(input) {
  if (input.kind === 'requestConfig') {
    if (input.requiresNetwork === true && (typeof input.baseURL !== 'string' || input.baseURL.trim().length === 0)) {
      return { ok: false, code: 'MISSING_BASE_URL' };
    }
    return { ok: true };
  }
  if (input.kind === 'component') {
    const installed = new Set(input.installedTypes || []);
    if (!installed.has(input.type)) return { ok: false, code: 'UNKNOWN_COMPONENT_TYPE' };
    for (const requiredProp of input.requiredProps || []) {
      if (!Object.prototype.hasOwnProperty.call(input.props || {}, requiredProp)) {
        return { ok: false, code: 'INVALID_COMPONENT', path: `props.${requiredProp}` };
      }
    }
    return { ok: true };
  }
  if (input.kind === 'defaults') {
    const value = input.value || {};
    if (input.target === 'dataRef') return { ok: true, value: { ...value, method: value.method ?? 'GET' } };
    if (input.target === 'uploadAction') {
      return {
        ok: true,
        value: {
          ...value,
          method: value.method ?? 'POST',
          retryPolicy: value.retryPolicy ?? 'never',
          fieldName: value.fieldName ?? 'file',
          multiple: value.multiple ?? false,
        },
      };
    }
  }
  return { ok: false, code: 'INVALID_RUNTIME_DEFAULT_INPUT' };
}

module.exports = { validateRuntimeDefaults };
