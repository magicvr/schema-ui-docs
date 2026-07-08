import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

const client = new Client({ name: 'schema-ui-mcp-smoke', version: '0.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/server.js'],
  cwd: packageDir,
  stderr: 'pipe',
});

try {
  await client.connect(transport);
  const result = await client.listTools();
  const names = result.tools.map(tool => tool.name).sort();
  const expected = [
    'protocol.get_component',
    'protocol.get_doc',
    'protocol.list_components',
    'protocol.search',
    'protocol.validate_content',
  ];

  for (const name of expected) {
    if (!names.includes(name)) {
      throw new Error(`Missing tool: ${name}. Got: ${names.join(', ')}`);
    }
  }

  console.log(JSON.stringify({ tools: names }, null, 2));
} finally {
  await client.close();
}
