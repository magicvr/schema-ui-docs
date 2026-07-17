'use strict';

const yaml = require('js-yaml');
const { processActionOutcome } = require('./action-outcome');
const { buildRequest } = require('./request-construction');
const { mapResponse } = require('./response-mapping');
const { buildTableQuery } = require('./table-query-state');
const { executeUpload } = require('./upload-execution');

function executeStep(step) {
  if (step.kind === 'request') return buildRequest(step.input);
  if (step.kind === 'responseMapping') return mapResponse(step.input);
  if (step.kind === 'searchTable') return buildTableQuery(step.input);
  if (step.kind === 'action') return processActionOutcome(step.input);
  if (step.kind === 'upload') return executeUpload(step.input);
  throw new Error(`Unknown scenario step: ${step.kind}`);
}

const OFFICIAL_SCENARIO_PATHS = new Set([
  'docs/05-scenarios/data-table.md',
  'docs/05-scenarios/form-with-reactions.md',
  'docs/05-scenarios/grid-dashboard.md',
  'docs/05-scenarios/row-backend-actions.md',
  'docs/05-scenarios/search-form-table.md',
  'docs/05-scenarios/form-with-upload.md',
]);

function executeScenario(input, readScenario) {
  if (!OFFICIAL_SCENARIO_PATHS.has(input.scenarioPath)) {
    throw new Error(`UNKNOWN_SCENARIO_PATH: ${input.scenarioPath}`);
  }
  const page = yaml.load(readScenario(input.scenarioPath));
  if (page.meta.pageId !== input.scenarioMeta.pageId || page.meta.protocolVersion !== input.scenarioMeta.protocolVersion) {
    throw new Error(`SCENARIO_METADATA_MISMATCH: ${input.scenarioPath}`);
  }
  return {
    pageId: page.meta.pageId,
    protocolVersion: page.meta.protocolVersion,
    steps: input.steps.map(executeStep),
  };
}

module.exports = { executeScenario, executeStep };