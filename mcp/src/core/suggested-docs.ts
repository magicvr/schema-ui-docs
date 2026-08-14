import type { ValidateContentResult, ValidationLayer } from '../types.js';

const DOCS_BY_SOURCE: Record<ValidationLayer | 'parseError' | 'actions.upload' | 'actions.row.request', string[]> = {
  'L0/L1': ['docs/01-node-protocol.md', 'docs/schemas/page.schema.json', 'docs/schemas/node.schema.json'],
  L2: ['docs/03-component-registry.md', 'docs/schemas/component-registry.json'],
  L3a: ['docs/02-reaction-expression.md', 'docs/03-component-registry.md'],
  L4: ['docs/06-validation.md', 'docs/01-node-protocol.md'],
  parseError: ['docs/01-node-protocol.md', 'docs/06-validation.md'],
  'actions.upload': ['docs/01-node-protocol.md', 'docs/07-actions-contract.md', 'docs/08-renderer-spec.md'],
  'actions.row.request': ['docs/03-component-registry.md', 'docs/07-actions-contract.md', 'docs/08-renderer-spec.md'],
};

export function buildSuggestedDocs(result: Pick<ValidateContentResult, 'layers' | 'parseError'>): string[] {
  const docs: string[] = [];

  if (result.parseError) append(docs, DOCS_BY_SOURCE.parseError);

  for (const layer of Object.keys(result.layers) as ValidationLayer[]) {
    if (result.layers[layer].length > 0) append(docs, DOCS_BY_SOURCE[layer]);
  }

  const hasUploadCapabilityIssue = result.layers.L2.some(item => item.message.includes('actions.upload'));
  if (hasUploadCapabilityIssue) append(docs, DOCS_BY_SOURCE['actions.upload']);

  const hasRowRequestCapabilityIssue = result.layers.L2.some(item => item.message.includes('actions.row.request'));
  if (hasRowRequestCapabilityIssue) append(docs, DOCS_BY_SOURCE['actions.row.request']);

  // ADR-0039/0040（v2.9）：params 路由绑定与 readOnly 门禁指向数据源契约 / 表单控件文档
  const hasRouteBindingIssue = result.layers.L2.some(
    item => item.message.includes('data.route-binding') || item.message.includes('route binding'),
  );
  if (hasRouteBindingIssue) {
    append(docs, ['docs/04-datasource-contract.md', 'docs/08-renderer-spec.md']);
  }

  const hasReadOnlyIssue = result.layers.L2.some(item => item.message.includes('form.controls.readonly'));
  if (hasReadOnlyIssue) {
    append(docs, ['docs/03-component-registry.md', 'docs/08-renderer-spec.md']);
  }

  return docs;
}

function append(target: string[], docs: string[]): void {
  for (const doc of docs) {
    if (!target.includes(doc)) target.push(doc);
  }
}
