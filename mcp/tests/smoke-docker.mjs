import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const image = process.argv[2] ?? 'schema-ui-mcp:2.0.0';
const dockerCommand = process.env.DOCKER_COMMAND ?? 'docker';

const client = new Client({ name: 'schema-ui-mcp-docker-smoke', version: '0.0.0' });
const transport = new StdioClientTransport({
  command: dockerCommand,
  args: ['run', '--rm', '-i', image],
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

  console.log(JSON.stringify({ image, tools: names }, null, 2));
} finally {
  await client.close();
}
