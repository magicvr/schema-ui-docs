'use strict';

const { serializeQuery } = require('./query-serialization');

function entries(value) {
  return Object.entries(value || {});
}

/**
 * ADR-0022 / V271: selection keys are string | finite number | boolean only.
 * Drop null/undefined/object/array/NaN/Infinity; dedupe while preserving first-seen order.
 * Equality is SameValueZero-compatible for numbers (Object.is except +0/-0), and type-strict
 * so string "1" and number 1 remain distinct.
 */
function isSelectionKey(value) {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function selectionKeyToken(value) {
  if (typeof value === 'number') {
    // Normalize -0 to 0 for stable identity while keeping finite numbers.
    return `number:${Object.is(value, -0) ? 0 : value}`;
  }
  if (typeof value === 'boolean') return `boolean:${value}`;
  return `string:${value}`;
}

function normalizeKeys(rawKeys) {
  if (!Array.isArray(rawKeys)) return [];
  const seen = new Set();
  const keys = [];
  for (const key of rawKeys) {
    if (!isSelectionKey(key)) continue;
    const token = selectionKeyToken(key);
    if (seen.has(token)) continue;
    seen.add(token);
    keys.push(typeof key === 'number' && Object.is(key, -0) ? 0 : key);
  }
  return keys;
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') {
    return { keys: [], count: 0 };
  }
  const keys = normalizeKeys(selection.keys);
  return { keys, count: keys.length };
}

function applyTableQueryEvent(state, event) {
  if (event === null) return { ...state, filters: { ...state.filters } };
  switch (event.type) {
    case 'submitSearch':
      return { ...state, filters: { ...event.filters }, page: 1 };
    case 'clearSearch':
      return { ...state, filters: {}, page: 1 };
    case 'changePage':
      return { ...state, page: event.page };
    case 'changeSort':
      return { ...state, page: 1, sort: event.sort };
    case 'changePageSize':
      return { ...state, page: 1, pageSize: event.pageSize };
    case 'reloadSuccess':
      return { ...state };
    default:
      throw new Error(`Unknown table query event: ${event.type}`);
  }
}

/** ADR-0022: any table query transition clears current-page selection. */
function clearsSelection(event) {
  return event !== null && event !== undefined;
}

function applySelectionEvent(selection, selectionEvent) {
  let next = normalizeSelection(selection);
  if (!selectionEvent) return next;
  switch (selectionEvent.type) {
    case 'setKeys': {
      const keys = normalizeKeys(selectionEvent.keys);
      return { keys, count: keys.length };
    }
    case 'clear':
      return { keys: [], count: 0 };
    default:
      throw new Error(`Unknown selection event: ${selectionEvent.type}`);
  }
}

function buildTableQuery(input) {
  const state = applyTableQueryEvent(input.state, input.event);
  let selection = normalizeSelection(input.selection);
  if (clearsSelection(input.event)) {
    selection = { keys: [], count: 0 };
  }
  if (input.selectionEvent) {
    selection = applySelectionEvent(selection, input.selectionEvent);
  }
  const rendererState = [
    ['page', state.page],
    ['pageSize', state.pageSize],
    ['sort', state.sort],
  ];
  const serialized = serializeQuery(input.baseUrl, [
    entries(input.staticParams),
    entries(state.filters),
    rendererState,
  ]);
  if (!serialized.ok) return serialized;
  const result = { state, url: serialized.url };
  // Only surface selection when the fixture participates in selection (ADR-0022).
  if (input.selection !== undefined || input.selectionEvent !== undefined) {
    result.selection = selection;
  }
  return result;
}

module.exports = { applyTableQueryEvent, applySelectionEvent, buildTableQuery, clearsSelection };
