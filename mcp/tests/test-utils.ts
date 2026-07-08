import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL_ROOT } from '../src/core/paths.js';

export function extractFirstYamlFence(relativePath: string): string {
  const markdown = fs.readFileSync(path.join(PROTOCOL_ROOT, relativePath), 'utf8');
  const match = markdown.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error(`No yaml fence found in ${relativePath}`);
  return match[1];
}

export const missingRowScopeYaml = `
meta:
  pageId: bad_row_scope
  title: Bad Row Scope
  protocolVersion: "0.2"
body:
  type: table
  props:
    rowKey: id
    pagination:
      mode: server
    columns:
      - field: id
        label: ID
        visibleWhen:
          when: "$row.id == '1'"
  data:
    source: api
    url: /api/items
`;

export const missingUploadCapabilityYaml = `
meta:
  pageId: upload_page
  title: Upload Page
  protocolVersion: "0.2"
body:
  type: upload
  props:
    label: Attachment
    actionRef: uploadAttachment
actions:
  uploadAttachment:
    type: upload
    method: POST
    url: /api/upload
`;
