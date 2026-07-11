'use strict';

const { serializeQuery } = require('./query-serialization');

function entries(value) {
  return Object.entries(value || {});
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
    default:
      throw new Error(`Unknown table query event: ${event.type}`);
  }
}

function buildTableQuery(input) {
  const state = applyTableQueryEvent(input.state, input.event);
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
  return { state, url: serialized.url };
}

module.exports = { applyTableQueryEvent, buildTableQuery };