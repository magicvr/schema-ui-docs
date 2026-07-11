'use strict';

const fs = require('fs');
const path = require('path');

const OFFICIAL_SCENARIO_PATHS = [
  'docs/05-scenarios/data-table.md',
  'docs/05-scenarios/form-with-reactions.md',
  'docs/05-scenarios/grid-dashboard.md',
  'docs/05-scenarios/row-backend-actions.md',
  'docs/05-scenarios/search-form-table.md',
  'docs/05-scenarios/form-with-upload.md',
];

function extractFirstYamlFence(markdown, relativePath) {
  const match = markdown.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error(`No yaml fence found in ${relativePath}`);
  return match[1];
}

function readOfficialScenario(protocolRoot, relativePath) {
  const markdown = fs.readFileSync(path.join(protocolRoot, relativePath), 'utf8');
  return extractFirstYamlFence(markdown, relativePath);
}

function writeOfficialScenarios(protocolRoot, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  return OFFICIAL_SCENARIO_PATHS.map(relativePath => {
    const outputPath = path.join(outputDir, `${path.basename(relativePath, '.md')}.yaml`);
    fs.writeFileSync(outputPath, `${readOfficialScenario(protocolRoot, relativePath)}\n`, 'utf8');
    return outputPath;
  });
}

module.exports = {
  OFFICIAL_SCENARIO_PATHS,
  extractFirstYamlFence,
  readOfficialScenario,
  writeOfficialScenarios,
};