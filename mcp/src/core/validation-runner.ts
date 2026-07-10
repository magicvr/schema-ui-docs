import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { Ajv, type ErrorObject } from 'ajv';
import { protocolPath } from './paths.js';
import { buildSuggestedDocs } from './suggested-docs.js';
import type { LayerViolation, ParseError, ToolError, ValidateContentResult, ValidationLayer } from '../types.js';

const MAX_CONTENT_BYTES = 1024 * 1024;

const emptyLayers = (): Record<ValidationLayer, LayerViolation[]> => ({
  'L0/L1': [],
  L2: [],
  L3a: [],
  L4: [],
});

type ScriptJson = {
  violations?: Array<Record<string, unknown>>;
  parseErrors?: Array<{ file?: string; error?: string }>;
};

type RunnerInput = {
  content: string;
  format: 'yaml' | 'json';
  filename?: string;
};

type LayerScriptResult = {
  violations: LayerViolation[];
  parseErrors: ParseError[];
  internalError: ToolError | null;
};

type LayerScriptExecutor = (scriptName: string, filePath: string, layer: ValidationLayer) => string;
type TempDirCreator = (prefix: string) => string;

let layerScriptExecutor: LayerScriptExecutor = defaultLayerScriptExecutor;
let tempDirCreator: TempDirCreator = fs.mkdtempSync;

export function setLayerScriptExecutorForTest(executor: LayerScriptExecutor | null): void {
  layerScriptExecutor = executor ?? defaultLayerScriptExecutor;
}

export function setTempDirCreatorForTest(creator: TempDirCreator | null): void {
  tempDirCreator = creator ?? fs.mkdtempSync;
}

export function validateContent(input: RunnerInput): ValidateContentResult {
  const baseResult: ValidateContentResult = {
    passed: false,
    layers: emptyLayers(),
    summary: '',
    parseError: null,
    internalError: null,
    suggestedDocs: [],
  };

  if (!['yaml', 'json'].includes(input.format)) {
    return finalize({
      ...baseResult,
      internalError: { message: 'format 必须是 yaml 或 json' },
    });
  }

  if (Buffer.byteLength(input.content, 'utf8') > MAX_CONTENT_BYTES) {
    return finalize({
      ...baseResult,
      internalError: { message: 'content 超过 1MB 限制' },
    });
  }

  const parseError = parseInput(input.content, input.format, input.filename);
  if (parseError) {
    return finalize({
      ...baseResult,
      parseError,
    });
  }

  const ext = input.format === 'json' ? 'json' : 'yaml';
  let tempDir: string | null = null;

  try {
    tempDir = tempDirCreator(path.join(os.tmpdir(), 'schema-ui-mcp-'));
    const tempFile = path.join(tempDir, `page-${crypto.randomUUID()}.${ext}`);
    fs.writeFileSync(tempFile, input.content, { encoding: 'utf8' });

    const layers = emptyLayers();
    const ajvResult = runAjv(tempFile);
    layers['L0/L1'] = ajvResult;

    const l2 = runLayerScript('validate-l2-components.js', tempFile, 'L2', input.filename);
    const l3a = runLayerScript('validate-l3a-expressions.js', tempFile, 'L3a', input.filename);
    const l4 = runLayerScript('lint-l4-banned-props.js', tempFile, 'L4', input.filename);

    layers.L2 = l2.violations;
    layers.L3a = l3a.violations;
    layers.L4 = l4.violations;

    const internalError = l2.internalError ?? l3a.internalError ?? l4.internalError;
    if (internalError) {
      return finalize({
        ...baseResult,
        layers,
        internalError,
      });
    }

    const scriptParseError = firstParseError([l2.parseErrors, l3a.parseErrors, l4.parseErrors], input.filename);
    return finalize({
      ...baseResult,
      layers,
      parseError: scriptParseError,
    });
  } catch (error) {
    return finalize({
      ...baseResult,
      internalError: {
        message: tempDir === null
          ? '无法创建校验临时目录'
          : error instanceof Error ? error.message : String(error),
      },
    });
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

function parseInput(content: string, format: 'yaml' | 'json', filename?: string): ParseError | null {
  try {
    if (format === 'json') JSON.parse(content);
    else yaml.load(content);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const mark = typeof error === 'object' && error !== null && 'mark' in error
      ? (error as { mark?: { line?: number; column?: number } }).mark
      : undefined;
    return {
      message,
      line: mark?.line === undefined ? undefined : mark.line + 1,
      column: mark?.column === undefined ? undefined : mark.column + 1,
      filename,
    };
  }
}

function runAjv(filePath: string): LayerViolation[] {
  const document = parseFileForAjv(filePath);
  const pageSchema = readJsonSchema('docs/schemas/page.schema.json');
  const nodeSchema = readJsonSchema('docs/schemas/node.schema.json');
  const actionSchema = readJsonSchema('docs/schemas/action.schema.json');
  const reactionSchema = readJsonSchema('docs/schemas/reaction.schema.json');

  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  ajv.addSchema(nodeSchema, 'node.schema.json');
  ajv.addSchema(actionSchema, 'action.schema.json');
  ajv.addSchema(reactionSchema, 'reaction.schema.json');

  const validate = ajv.compile(pageSchema);
  if (validate(document)) return [];
  return (validate.errors ?? []).map(mapAjvError);
}

function parseFileForAjv(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.json' ? JSON.parse(raw) : yaml.load(raw);
}

function readJsonSchema(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(protocolPath(relativePath), 'utf8')) as Record<string, unknown>;
}

function mapAjvError(error: ErrorObject): LayerViolation {
  return {
    path: jsonPointerToPath(error.instancePath),
    keyword: error.keyword,
    message: error.message ?? 'schema 校验失败',
  };
}

function runLayerScript(scriptName: string, filePath: string, layer: ValidationLayer, callerFilename?: string): {
  violations: LayerViolation[];
  parseErrors: ParseError[];
  internalError: ToolError | null;
} {
  let raw = '';

  try {
    raw = layerScriptExecutor(scriptName, filePath, layer);
  } catch (error) {
    const childOutput = getChildOutput(error, 'stdout') || getChildOutput(error, 'stderr');
    if (!childOutput.trim()) {
      return {
        violations: [],
        parseErrors: [],
        internalError: { message: `[${layer}] 校验脚本执行失败` },
      };
    }
    raw = childOutput;
  }

  let parsed: ScriptJson;
  try {
    parsed = raw.trim() ? JSON.parse(raw) as ScriptJson : {};
  } catch {
    return {
      violations: [],
      parseErrors: [],
      internalError: { message: `[${layer}] 无法解析校验脚本 JSON 输出` },
    };
  }

  return {
    violations: (parsed.violations ?? []).map(item => mapScriptViolation(item, layer, callerFilename)),
    parseErrors: (parsed.parseErrors ?? []).map(item => ({
      message: item.error ?? '解析失败',
      filename: callerFilename ?? item.file,
    })),
    internalError: null,
  };
}

function defaultLayerScriptExecutor(scriptName: string, filePath: string): string {
  const scriptPath = protocolPath('scripts', scriptName);
  return execFileSync(process.execPath, [scriptPath, filePath, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function mapScriptViolation(item: Record<string, unknown>, layer: ValidationLayer, callerFilename?: string): LayerViolation {
  const pathValue = stringValue(item.path) || '';
  const message = layer === 'L4'
    ? `禁用 CSS 属性 "${stringValue(item.key) || pathValue}"`
    : stringValue(item.message) || '校验失败';

  // 使用调用方 filename 替换子脚本的临时路径；未提供时省略 file 字段
  const file = callerFilename ?? undefined;

  return {
    file,
    path: pathValue,
    rule: stringValue(item.rule),
    key: stringValue(item.key),
    message,
  };
}

function jsonPointerToPath(pointer: string): string {
  if (!pointer || pointer === '/') return '';
  return pointer
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map(segment => /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`)
    .join('')
    .replace(/^\./, '');
}

function firstParseError(parseErrors: ParseError[][], filename?: string): ParseError | null {
  for (const group of parseErrors) {
    const first = group[0];
    if (first) return { ...first, filename: filename ?? first.filename };
  }
  return null;
}

function finalize(result: ValidateContentResult): ValidateContentResult {
  const hasViolations = Object.values(result.layers).some(items => items.length > 0);
  const passed = !hasViolations && result.parseError === null && result.internalError === null;
  const finalized = {
    ...result,
    passed,
    summary: summarize(passed, result),
  };
  return {
    ...finalized,
    suggestedDocs: buildSuggestedDocs(finalized),
  };
}

function summarize(passed: boolean, result: ValidateContentResult): string {
  if (passed) return '校验通过，未发现协议违规';
  if (result.parseError) return `解析失败：${result.parseError.message}`;
  if (result.internalError) return `校验内部错误：${result.internalError.message}`;

  const parts = Object.entries(result.layers)
    .filter(([, items]) => items.length > 0)
    .map(([layer, items]) => `${layer} ${items.length} 处`);
  return `发现 ${parts.join('，')} 协议违规`;
}

function getChildOutput(error: unknown, key: 'stdout' | 'stderr'): string {
  if (typeof error === 'object' && error !== null && key in error) {
    const value = (error as Record<string, unknown>)[key];
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    if (typeof value === 'string') return value;
  }
  return '';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
