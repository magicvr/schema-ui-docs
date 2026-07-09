#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { handleGetComponent, handleListComponents, getComponentInputSchema } from './tools/components.js';
import { handleGetDoc, getDocInputSchema } from './tools/docs.js';
import { handleSearch, searchInputSchema } from './tools/search.js';
import { handleValidateContent, validateContentInputSchema } from './tools/validate-content.js';
import packageJson from '../package.json' with { type: 'json' };

export function createServer(): McpServer {
  const server = new McpServer({ name: 'schema-ui-mcp', version: packageJson.version }, {
    instructions: 'Schema-UI protocol read-only query and content validation tools. This server does not read caller project files.',
  });

  server.registerTool('protocol.search', {
    title: 'Search Schema-UI protocol docs',
    description: 'Search Schema-UI protocol documents, scenarios, ADRs, and schema descriptions by keyword substring.',
    inputSchema: searchInputSchema,
  }, handleSearch);

  server.registerTool('protocol.get_doc', {
    title: 'Get Schema-UI protocol document',
    description: 'Read a whitelisted Schema-UI protocol document by docId, optionally limited to a section heading.',
    inputSchema: getDocInputSchema,
  }, handleGetDoc);

  server.registerTool('protocol.list_components', {
    title: 'List Schema-UI components',
    description: 'List all component types in the current Schema-UI component registry.',
  }, handleListComponents);

  server.registerTool('protocol.get_component', {
    title: 'Get Schema-UI component contract',
    description: 'Return a component contract from docs/schemas/component-registry.json, preserving raw DSL fields and adding derived prop lists.',
    inputSchema: getComponentInputSchema,
  }, handleGetComponent);

  server.registerTool('protocol.validate_content', {
    title: 'Validate Schema-UI page content',
    description: 'Validate caller-provided YAML or JSON page content without reading caller project files.',
    inputSchema: validateContentInputSchema,
  }, handleValidateContent);

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
