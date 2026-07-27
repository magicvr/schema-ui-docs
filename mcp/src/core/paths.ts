import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * External protocol/validator root overrides are development-only.
 * Production Docker (NODE_ENV=production) ignores SCHEMA_UI_PROTOCOL_ROOT /
 * SCHEMA_UI_VALIDATOR_ROOT unless SCHEMA_UI_ALLOW_EXTERNAL_ROOTS=1 is set
 * explicitly (V341 / ADR-0007 D9).
 */
export function externalRootOverridesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.SCHEMA_UI_ALLOW_EXTERNAL_ROOTS;
  if (flag === '1' || flag === 'true') return true;
  return env.NODE_ENV !== 'production';
}

export function findProtocolRoot(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const workspaceRoot = path.resolve(sourceDir, '../../..');
  const envRoot = externalRootOverridesAllowed(env) ? env.SCHEMA_UI_PROTOCOL_ROOT : undefined;
  const candidates = [
    envRoot,
    path.join(workspaceRoot, 'dist', 'protocol'),
    path.resolve(cwd, 'dist', 'protocol'),
    workspaceRoot,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const absoluteCandidate = path.resolve(candidate);
    if (absoluteCandidate === path.dirname(absoluteCandidate)) continue;

    const docsDir = path.join(absoluteCandidate, 'docs');
    if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()
      && fs.existsSync(path.join(absoluteCandidate, 'manifest.json'))) {
      return absoluteCandidate;
    }
  }

  throw new Error('未找到构建后的 Schema-UI 协议制品；请先运行 npm run build:protocol');
}

export function findValidatorRoot(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const workspaceRoot = path.resolve(sourceDir, '../../..');
  const envRoot = externalRootOverridesAllowed(env) ? env.SCHEMA_UI_VALIDATOR_ROOT : undefined;
  const candidates = [envRoot, workspaceRoot, cwd];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absoluteCandidate = path.resolve(candidate);
    if (fs.existsSync(path.join(absoluteCandidate, 'scripts', 'validate-l2-components.js'))) {
      return absoluteCandidate;
    }
  }
  throw new Error('未找到 Schema-UI 辅助验证器目录');
}

export const PROTOCOL_ROOT = findProtocolRoot();
export const VALIDATOR_ROOT = findValidatorRoot();

export function protocolPath(...segments: string[]): string {
  return path.join(PROTOCOL_ROOT, ...segments);
}

export function validatorPath(...segments: string[]): string {
  return path.join(VALIDATOR_ROOT, ...segments);
}

export function toProtocolRelative(filePath: string): string {
  return path.relative(PROTOCOL_ROOT, filePath).split(path.sep).join('/');
}
