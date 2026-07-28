import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function defaultLocalImageTag() {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`mcp/package.json missing version (read from ${packageJsonPath})`);
  }
  return `schema-ui-mcp:${version}`;
}

// Prefer explicit argv (CI/CD and GHCR pulls). Bare `npm run smoke:docker` follows mcp package version
// so the default cannot lag across MINOR bumps (审计 0078 / V373；历史 0036).
const image = process.argv[2] ?? defaultLocalImageTag();
const dockerCommand = process.env.DOCKER_COMMAND ?? 'docker';

const client = new Client({ name: 'schema-ui-mcp-docker-smoke', version: '0.0.0' });
// V341: inject external-root env vars; production image must still use built-in roots.
const transport = new StdioClientTransport({
  command: dockerCommand,
  args: [
    'run',
    '--rm',
    '-i',
    '-e', 'SCHEMA_UI_PROTOCOL_ROOT=/tmp/schema-ui-does-not-exist',
    '-e', 'SCHEMA_UI_VALIDATOR_ROOT=/tmp/schema-ui-does-not-exist',
    image,
  ],
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

  const appManifest = await client.callTool({
    name: 'protocol.get_doc',
    arguments: { docId: 'app-manifest' },
  });
  const appManifestText = appManifest.content?.[0]?.text ?? '';
  if (!String(appManifestText).includes('应用级清单') && !String(appManifestText).includes('app-manifest')) {
    throw new Error('protocol.get_doc(app-manifest) failed under injected external-root env (V340/V341)');
  }

  console.log(JSON.stringify({
    image,
    tools: names,
    externalRootEnvIgnored: true,
    appManifestDocOk: true,
  }, null, 2));
} finally {
  await client.close();
}
