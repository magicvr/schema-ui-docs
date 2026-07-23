'use strict';

const yaml = require('js-yaml');
const { processActionOutcome } = require('./action-outcome');
const { buildRequest } = require('./request-construction');
const { mapResponse } = require('./response-mapping');
const { buildTableQuery } = require('./table-query-state');
const { executeUpload } = require('./upload-execution');
const { CONFORMANCE_SCENARIO_PATHS } = require('../../scripts/official-scenarios');

function executeStep(step) {
  if (step.kind === 'request') return buildRequest(step.input);
  if (step.kind === 'responseMapping') return mapResponse(step.input);
  if (step.kind === 'searchTable') return buildTableQuery(step.input);
  if (step.kind === 'action') return processActionOutcome(step.input);
  if (step.kind === 'upload') return executeUpload(step.input);
  throw new Error(`Unknown scenario step: ${step.kind}`);
}

const ALLOWED_SCENARIO_PATHS = new Set(CONFORMANCE_SCENARIO_PATHS);

function executeScenario(input, readScenarioYaml) {
  if (!ALLOWED_SCENARIO_PATHS.has(input.scenarioPath)) {
    throw new Error(`UNKNOWN_SCENARIO_PATH: ${input.scenarioPath}`);
  }
  const pageId = input.scenarioMeta?.pageId;
  const yamlText = readScenarioYaml(input.scenarioPath, pageId);
  const page = yaml.load(yamlText);
  if (!page?.meta
    || page.meta.pageId !== input.scenarioMeta.pageId
    || page.meta.protocolVersion !== input.scenarioMeta.protocolVersion) {
    throw new Error(`SCENARIO_METADATA_MISMATCH: ${input.scenarioPath}`);
  }
  return {
    pageId: page.meta.pageId,
    protocolVersion: page.meta.protocolVersion,
    steps: input.steps.map(executeStep),
  };
}

module.exports = { executeScenario, executeStep, ALLOWED_SCENARIO_PATHS };
