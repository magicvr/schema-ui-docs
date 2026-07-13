#!/usr/bin/env node
/**
 * Thin wrapper over search-table suite.
 * Authority for table search/pagination/sort state fixtures is
 * `conformance/fixtures/search-table/cases.json` (versioned suite).
 * This script exists for backward-compatible npm script
 * `test:conformance:table-state` and CI step names.
 */
'use strict';

require('./run-search-table.js');
