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

  return docs;
}

function append(target: string[], docs: string[]): void {
  for (const doc of docs) {
    if (!target.includes(doc)) target.push(doc);
  }
}
