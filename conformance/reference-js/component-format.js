'use strict';

function validateComponentFormat(input) {
  const { format, value } = input;
  if (format === 'currency' || format === 'percent') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, code: 'COMPONENT_DATA_TYPE_MISMATCH' };
    }
  } else if (format === 'datetime' && typeof value !== 'string') {
    return { ok: false, code: 'COMPONENT_DATA_TYPE_MISMATCH' };
  }
  return { ok: true, value };
}

module.exports = { validateComponentFormat };
