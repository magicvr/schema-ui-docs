'use strict';

const { serializeQuery } = require('./query-serialization');

function entries(value) {
  return Object.entries(value || {});
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') {
    return { keys: [], count: 0 };
  }
  const keys = Array.isArray(selection.keys) ? [...selection.keys] : [];
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
    case 'setKeys':
      next = {
        keys: Array.isArray(selectionEvent.keys) ? [...selectionEvent.keys] : [],
        count: 0,
      };
      next.count = next.keys.length;
      return next;
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
