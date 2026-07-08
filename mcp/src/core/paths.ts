import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

export function findProtocolRoot(): string {
  const candidates = [
    path.resolve(sourceDir, '../../..'),
    path.resolve(process.cwd(), '..'),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    if (!candidate || candidate === path.dirname(candidate)) continue;
    if (path.basename(candidate) === 'mcp' || !path.isAbsolute(candidate)) continue;

    const docsDir = path.join(candidate, 'docs');
    const scriptsDir = path.join(candidate, 'scripts');
    if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()
      && fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
      return candidate;
    }
  }

  return path.resolve(sourceDir, '../../..');
}

export const PROTOCOL_ROOT = findProtocolRoot();

export function protocolPath(...segments: string[]): string {
  return path.join(PROTOCOL_ROOT, ...segments);
}

export function toProtocolRelative(filePath: string): string {
  return path.relative(PROTOCOL_ROOT, filePath).split(path.sep).join('/');
}
