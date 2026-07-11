'use strict';

function failure(code) {
  return { ok: false, code };
}

function isValidUnicodeScalarString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function compareUnicodeCodePoints(left, right) {
  const leftPoints = Array.from(left, character => character.codePointAt(0));
  const rightPoints = Array.from(right, character => character.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function percentEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeBaseQueryComponent(value) {
  try {
    const decoded = decodeURIComponent(value);
    return isValidUnicodeScalarString(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function scalarToText(value) {
  if (value === null || value === undefined) return { tombstone: true };
  if (typeof value === 'string') {
    return isValidUnicodeScalarString(value) ? { text: value } : null;
  }
  if (typeof value === 'boolean') return { text: value ? 'true' : 'false' };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { text: Object.is(value, -0) ? '0' : JSON.stringify(value) };
  }
  return null;
}

function serializeQuery(baseUrl, sources) {
  if (typeof baseUrl !== 'string' || !Array.isArray(sources)) {
    return failure('INVALID_QUERY_INPUT');
  }

  const fragmentIndex = baseUrl.indexOf('#');
  const requestPart = fragmentIndex === -1 ? baseUrl : baseUrl.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? '' : baseUrl.slice(fragmentIndex);
  const queryIndex = requestPart.indexOf('?');
  const path = queryIndex === -1 ? requestPart : requestPart.slice(0, queryIndex);
  const baseQuery = queryIndex === -1 ? '' : requestPart.slice(queryIndex + 1);
  const merged = new Map();

  for (const segment of baseQuery.split('&')) {
    if (segment === '') continue;
    const equalsIndex = segment.indexOf('=');
    const encodedKey = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
    const encodedValue = equalsIndex === -1 ? '' : segment.slice(equalsIndex + 1);
    const key = decodeBaseQueryComponent(encodedKey);
    const value = decodeBaseQueryComponent(encodedValue);
    if (key === null || value === null) return failure('INVALID_BASE_URL_QUERY');
    if (key.length === 0) return failure('INVALID_QUERY_KEY');
    merged.set(key, value);
  }

  for (const source of sources) {
    if (!Array.isArray(source)) return failure('INVALID_QUERY_INPUT');
    for (const entry of source) {
      if (!Array.isArray(entry) || entry.length !== 2) return failure('INVALID_QUERY_INPUT');
      const [key, value] = entry;
      if (typeof key !== 'string' || key.length === 0 || !isValidUnicodeScalarString(key)) {
        return failure('INVALID_QUERY_KEY');
      }
      const scalar = scalarToText(value);
      if (scalar === null) return failure('INVALID_QUERY_VALUE');
      if (scalar.tombstone) merged.delete(key);
      else merged.set(key, scalar.text);
    }
  }

  const query = [...merged.entries()]
    .sort(([left], [right]) => compareUnicodeCodePoints(left, right))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&');

  return { ok: true, url: `${path}${query === '' ? '' : `?${query}`}${fragment}` };
}

module.exports = { serializeQuery };