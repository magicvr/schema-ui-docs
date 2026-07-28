'use strict';

function emptyForWire(wire) {
  if (wire === 'boolean') return false;
  if (wire === 'array') return [];
  if (wire === 'number') return null;
  return '';
}

/** ADR-0033 form field init: S0 empty → S1 defaultValue → S2 recordValues → S3 reactionWrites */
function initFormFieldValues(input) {
  const fields = Array.isArray(input.fields) ? input.fields : null;
  if (!fields) return { ok: false, code: 'INVALID_RUNTIME_DEFAULT_INPUT' };
  const values = {};
  for (const fieldDef of fields) {
    if (!fieldDef || typeof fieldDef.field !== 'string' || fieldDef.field.length === 0) {
      return { ok: false, code: 'INVALID_RUNTIME_DEFAULT_INPUT' };
    }
    const wire = fieldDef.wire || 'string';
    values[fieldDef.field] = emptyForWire(wire);
    if (Object.prototype.hasOwnProperty.call(fieldDef, 'defaultValue') && fieldDef.defaultValue !== undefined) {
      values[fieldDef.field] = fieldDef.defaultValue;
    }
  }
  if (input.recordValues && typeof input.recordValues === 'object' && !Array.isArray(input.recordValues)) {
    for (const [key, value] of Object.entries(input.recordValues)) {
      if (Object.prototype.hasOwnProperty.call(values, key)) values[key] = value;
    }
  }
  if (Array.isArray(input.reactionWrites)) {
    for (const write of input.reactionWrites) {
      if (!write || typeof write.field !== 'string') continue;
      if (Object.prototype.hasOwnProperty.call(values, write.field)) {
        values[write.field] = write.value;
      }
    }
  }
  return { ok: true, values };
}

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
  if (input.kind === 'formFieldInit') {
    return initFormFieldValues(input);
  }
  return { ok: false, code: 'INVALID_RUNTIME_DEFAULT_INPUT' };
}

module.exports = { validateRuntimeDefaults };
