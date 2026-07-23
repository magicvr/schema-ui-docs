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

/** Conformance scenario suite 允许的路径：官方六场景 + Admin 生命周期扩展示例（不进 release 六场景门禁）。 */
const CONFORMANCE_SCENARIO_PATHS = [
  ...OFFICIAL_SCENARIO_PATHS,
  'docs/05-scenarios/admin-list-edit-lifecycle.md',
];

function extractAllYamlFences(markdown) {
  return Array.from(markdown.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g), match => match[1]);
}

function extractFirstYamlFence(markdown, relativePath) {
  const fences = extractAllYamlFences(markdown);
  if (fences.length === 0) throw new Error(`No yaml fence found in ${relativePath}`);
  return fences[0];
}

function readOfficialScenario(protocolRoot, relativePath) {
  const markdown = fs.readFileSync(path.join(protocolRoot, relativePath), 'utf8');
  return extractFirstYamlFence(markdown, relativePath);
}

/**
 * 读取场景 Markdown 中与 pageId 匹配的 YAML 页面（支持多 fence 文档）。
 * pageId 缺省时返回第一段 YAML（兼容既有官方场景）。
 */
function readScenarioPageYaml(protocolRoot, relativePath, pageId) {
  const markdown = fs.readFileSync(path.join(protocolRoot, relativePath), 'utf8');
  const fences = extractAllYamlFences(markdown);
  if (fences.length === 0) throw new Error(`No yaml fence found in ${relativePath}`);
  if (pageId === undefined || pageId === null || pageId === '') {
    return fences[0];
  }
  const yaml = require('js-yaml');
  for (const fence of fences) {
    const page = yaml.load(fence);
    if (page && page.meta && page.meta.pageId === pageId) {
      return fence;
    }
  }
  // Align with executeScenario mismatch code so fixtures can assert a single error token.
  throw new Error(`SCENARIO_METADATA_MISMATCH: ${relativePath}#${pageId}`);
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
  CONFORMANCE_SCENARIO_PATHS,
  extractAllYamlFences,
  extractFirstYamlFence,
  readOfficialScenario,
  readScenarioPageYaml,
  writeOfficialScenarios,
};