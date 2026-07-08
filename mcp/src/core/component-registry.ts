import fs from 'node:fs';
import { protocolPath } from './paths.js';

export type ComponentDefinition = {
  supportsChildren?: boolean;
  supportsData?: boolean;
  supportsReactions?: boolean;
  supportsStates?: boolean;
  props?: Record<string, unknown>;
  anyOf?: unknown[];
  oneOf?: unknown[];
  allOf?: unknown[];
  [key: string]: unknown;
};

export type ComponentRegistry = {
  components: Record<string, ComponentDefinition>;
};

export function loadComponentRegistry(): ComponentRegistry {
  return JSON.parse(fs.readFileSync(protocolPath('docs/schemas/component-registry.json'), 'utf8')) as ComponentRegistry;
}

export function listComponents() {
  const registry = loadComponentRegistry();
  const categories = deriveComponentCategories();
  return {
    components: Object.entries(registry.components).map(([type, definition]) => ({
      type,
      category: categories[type] ?? 'uncategorized',
      supportsChildren: Boolean(definition.supportsChildren),
      supportsData: Boolean(definition.supportsData),
      supportsReactions: Boolean(definition.supportsReactions),
      supportsStates: Boolean(definition.supportsStates),
    })),
  };
}

export function getComponent(type: string) {
  const registry = loadComponentRegistry();
  const definition = registry.components[type];
  if (!definition) {
    throw new Error(`未知组件类型: ${type}`);
  }

  return {
    type,
    ...definition,
    requiredProps: deriveRequiredProps(definition),
    optionalProps: deriveOptionalProps(definition),
    i18nProps: deriveI18nProps(definition),
  };
}

function deriveRequiredProps(definition: ComponentDefinition): string[] {
  const props = definition.props ?? {};
  return Object.entries(props)
    .filter(([key, value]) => isPropField(key, value) && (value as { required?: unknown }).required === true)
    .map(([key]) => key);
}

function deriveOptionalProps(definition: ComponentDefinition): string[] {
  const props = definition.props ?? {};
  return Object.entries(props)
    .filter(([key, value]) => isPropField(key, value) && (value as { required?: unknown }).required !== true)
    .map(([key]) => key);
}

function deriveI18nProps(definition: ComponentDefinition): string[] {
  const props = definition.props ?? {};
  return Object.entries(props)
    .filter(([key, value]) => isPropField(key, value) && key.endsWith('Key'))
    .map(([key]) => key);
}

function isPropField(key: string, value: unknown): boolean {
  if (['additionalProperties', 'allOf', 'anyOf', 'oneOf'].includes(key)) return false;
  return value !== null && typeof value === 'object';
}

function deriveComponentCategories(): Record<string, string> {
  const content = fs.readFileSync(protocolPath('docs/03-component-registry.md'), 'utf8');
  const categories: Record<string, string> = {};
  let currentCategory = 'uncategorized';

  for (const line of content.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      currentCategory = normalizeCategory(h2[1]);
      continue;
    }

    const h3 = line.match(/^###\s+`([^`]+)`/);
    if (h3) {
      categories[h3[1]] = currentCategory;
    }
  }

  return categories;
}

function normalizeCategory(title: string): string {
  return title.trim().replace(/类$/, '').toLowerCase();
}
