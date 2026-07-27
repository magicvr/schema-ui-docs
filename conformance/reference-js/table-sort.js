'use strict';

const { buildTableQuery, normalizeSelection, applySelectionEvent } = require('./table-query-state');

const RESERVED = new Set(['page', 'pageSize', 'sort']);
const TABLE_SORT_CAPABILITY = 'table.sort';

function versionAtLeast(version, floor) {
  const parsed = /^([0-9]+)\.([0-9]+)$/.exec(version || '');
  if (!parsed) return false;
  const [major, minor] = parsed.slice(1).map(Number);
  const [floorMajor, floorMinor] = floor.split('.').map(Number);
  return major > floorMajor || (major === floorMajor && minor >= floorMinor);
}

function sortableColumns(table) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  return columns.filter(col => col && col.sortable === true);
}

function sortKeyOf(col) {
  if (typeof col.sortField === 'string' && col.sortField.length > 0) return col.sortField;
  return col.field;
}

function usesSortFields(table) {
  if (!table || typeof table !== 'object') return false;
  if (table.defaultSort !== undefined) return true;
  const columns = Array.isArray(table.columns) ? table.columns : [];
  return columns.some(col => col && (col.sortable !== undefined || col.sortField !== undefined));
}

function validateTableSort(meta, table) {
  const errors = [];
  if (!usesSortFields(table)) {
    return { ok: true, errors };
  }

  if (!versionAtLeast(meta?.protocolVersion, '2.5')) {
    errors.push({ code: 'PROTOCOL_VERSION_TOO_LOW', path: 'meta.protocolVersion' });
  }
  const caps = Array.isArray(meta?.requiredCapabilities) ? meta.requiredCapabilities : [];
  if (!caps.includes(TABLE_SORT_CAPABILITY)) {
    errors.push({ code: 'CAPABILITY_REQUIRED', path: 'meta.requiredCapabilities' });
  }

  const columns = Array.isArray(table.columns) ? table.columns : [];
  const sortKeys = new Map();

  columns.forEach((col, index) => {
    if (!col) return;
    if (col.sortField !== undefined && col.sortable !== true) {
      errors.push({ code: 'SORT_FIELD_WITHOUT_SORTABLE', path: `columns[${index}].sortField` });
    }
    if (col.sortable === true) {
      const key = sortKeyOf(col);
      if (typeof key !== 'string' || key.length === 0) {
        errors.push({ code: 'SORT_KEY_INVALID', path: `columns[${index}]` });
        return;
      }
      if (RESERVED.has(key) || RESERVED.has(col.field)) {
        errors.push({ code: 'SORT_KEY_RESERVED', path: `columns[${index}]` });
      }
      if (sortKeys.has(key)) {
        errors.push({ code: 'SORT_KEY_DUPLICATE', path: `columns[${index}]` });
      } else {
        sortKeys.set(key, index);
      }
    }
  });

  const mode = table.pagination?.mode;
  const hasSortable = sortableColumns(table).length > 0;
  if ((hasSortable || table.defaultSort !== undefined) && mode !== 'server') {
    errors.push({ code: 'SORT_REQUIRES_SERVER_PAGINATION', path: 'pagination.mode' });
  }

  if (table.defaultSort !== undefined) {
    const ds = table.defaultSort;
    if (!ds || typeof ds !== 'object' || (ds.order !== 'asc' && ds.order !== 'desc')) {
      errors.push({ code: 'DEFAULT_SORT_INVALID', path: 'defaultSort' });
    } else if (typeof ds.field !== 'string' || !sortKeys.has(ds.field)) {
      errors.push({ code: 'DEFAULT_SORT_FIELD_UNKNOWN', path: 'defaultSort.field' });
    }
  }

  return { ok: errors.length === 0, errors };
}

function allowedSortKeys(table) {
  return new Set(sortableColumns(table).map(sortKeyOf));
}

function initialSort(table) {
  const ds = table?.defaultSort;
  if (ds && typeof ds.field === 'string' && (ds.order === 'asc' || ds.order === 'desc')) {
    return `${ds.field}:${ds.order}`;
  }
  return null;
}

function nextSortAfterClick(currentSort, sortKey) {
  if (currentSort === null || currentSort === undefined) {
    return `${sortKey}:asc`;
  }
  const match = /^([^:]+):(asc|desc)$/.exec(String(currentSort));
  if (!match || match[1] !== sortKey) {
    return `${sortKey}:asc`;
  }
  if (match[2] === 'asc') return `${sortKey}:desc`;
  return null;
}

function resolveClickSortKey(table, field) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const col = columns.find(c => c && c.field === field);
  if (!col || col.sortable !== true) return null;
  return sortKeyOf(col);
}

function parseSortKey(sort) {
  if (sort === null || sort === undefined) return null;
  const match = /^([^:]+):(asc|desc)$/.exec(String(sort));
  return match ? match[1] : null;
}

function evaluateTableSort(input) {
  const meta = input.meta || {};
  const table = input.table || {};
  const operation = input.operation || 'runtime';

  const validation = validateTableSort(meta, table);
  if (operation === 'validate') {
    return validation.ok
      ? { ok: true }
      : {
        ok: false,
        code: validation.errors[0].code,
        path: validation.errors[0].path,
        errors: validation.errors,
      };
  }

  // v2.4 path: no sort declaration fields → no protocol clickSort interaction
  if (!usesSortFields(table)) {
    if (input.event && input.event.type === 'clickSort') {
      const state = {
        filters: { ...(input.state?.filters || {}) },
        page: input.state?.page ?? 1,
        pageSize: input.state?.pageSize ?? 20,
        sort: input.state?.sort ?? null,
      };
      const built = buildTableQuery({
        baseUrl: input.baseUrl || '/orders',
        staticParams: input.staticParams || {},
        state,
        event: null,
        selection: input.selection,
      });
      const result = {
        ok: true,
        protocolSortInteraction: false,
        state: built.state,
        url: built.url,
      };
      if (input.selection !== undefined) result.selection = normalizeSelection(input.selection);
      return result;
    }
    const built = buildTableQuery({
      baseUrl: input.baseUrl || '/orders',
      staticParams: input.staticParams || {},
      state: input.state || { filters: {}, page: 1, pageSize: 20, sort: null },
      event: input.event || null,
      selection: input.selection,
      selectionEvent: input.selectionEvent,
    });
    return { ok: true, protocolSortInteraction: false, ...built };
  }

  if (!validation.ok) {
    return {
      ok: false,
      code: validation.errors[0].code,
      path: validation.errors[0].path,
      errors: validation.errors,
      requestEmitted: false,
    };
  }

  const stateIn = input.state || {};
  let state = {
    filters: { ...(stateIn.filters || {}) },
    page: stateIn.page ?? 1,
    pageSize: stateIn.pageSize ?? table.pagination?.pageSize ?? 20,
    sort: Object.prototype.hasOwnProperty.call(stateIn, 'sort') ? stateIn.sort : null,
  };

  const event = input.event;
  let transition = false;

  if (!event || event.type === 'init') {
    if (!Object.prototype.hasOwnProperty.call(stateIn, 'sort')) {
      state.sort = initialSort(table);
    }
  } else if (event.type === 'clickSort') {
    const sortKey = resolveClickSortKey(table, event.field);
    if (sortKey !== null) {
      state.sort = nextSortAfterClick(state.sort, sortKey);
      state.page = 1;
      transition = true;
    }
  } else if (event.type === 'submitSearch') {
    state.filters = { ...(event.filters || {}) };
    state.page = 1;
    transition = true;
  } else if (event.type === 'clearSearch') {
    state.filters = {};
    state.page = 1;
    transition = true;
  } else if (event.type === 'changePage') {
    state.page = event.page;
    transition = true;
  } else if (event.type === 'changeSort') {
    state.sort = event.sort;
    state.page = 1;
    transition = true;
  }

  const key = parseSortKey(state.sort);
  const allowed = allowedSortKeys(table);
  if (key !== null && !allowed.has(key)) {
    return {
      ok: false,
      code: 'TABLE_SORT_FIELD_UNKNOWN',
      requestEmitted: false,
      state,
    };
  }

  const built = buildTableQuery({
    baseUrl: input.baseUrl || '/orders',
    staticParams: input.staticParams || {},
    state,
    event: null,
  });

  const result = {
    ok: true,
    requestEmitted: true,
    state: built.state,
    url: built.url,
  };

  if (input.selection !== undefined || input.selectionEvent !== undefined) {
    let selection = normalizeSelection(input.selection);
    if (transition) {
      selection = { keys: [], count: 0 };
    }
    if (input.selectionEvent) {
      selection = applySelectionEvent(selection, input.selectionEvent);
    }
    result.selection = selection;
  }

  return result;
}

module.exports = {
  evaluateTableSort,
  validateTableSort,
  nextSortAfterClick,
  initialSort,
  sortKeyOf,
  usesSortFields,
};
