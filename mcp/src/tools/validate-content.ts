import { z } from 'zod/v4';
import { validateContent } from '../core/validation-runner.js';
import type { LayerViolation, ToolResponse, ValidateContentResult, ValidationLayer } from '../types.js';

export const validateContentInputSchema = {
  content: z.string().max(1024 * 1024),
  format: z.enum(['yaml', 'json']),
  filename: z.string().max(260).optional(),
};

const MAX_TOOL_TEXT_BYTES = 20 * 1024;
const LAYERS: ValidationLayer[] = ['L0/L1', 'L2', 'L3a', 'L4'];

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) return value;
  let end = maxBytes;
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--;
  return `${buffer.subarray(0, end).toString('utf8')}...`;
}

function compactViolation(violation: LayerViolation): LayerViolation {
  return Object.fromEntries(
    Object.entries(violation).map(([key, value]) => [
      key,
      typeof value === 'string' ? truncateUtf8(value, 256) : value,
    ]),
  ) as LayerViolation;
}

function compactError<T extends ValidateContentResult['parseError'] | ValidateContentResult['internalError']>(error: T): T {
  if (!error) return error;
  return {
    ...error,
    message: truncateUtf8(error.message, 1024),
    filename: error.filename === undefined ? undefined : truncateUtf8(error.filename, 260),
  } as T;
}

function serializeWithinBudget(result: ValidateContentResult): string {
  const totals = Object.fromEntries(LAYERS.map(layer => [layer, result.layers[layer].length])) as Record<ValidationLayer, number>;
  const layers = Object.fromEntries(LAYERS.map(layer => [layer, [...result.layers[layer]]])) as ValidateContentResult['layers'];
  const build = (compact = false): ValidateContentResult => {
    const returnedLayers = Object.fromEntries(LAYERS.map(layer => [
      layer,
      compact ? layers[layer].map(compactViolation) : layers[layer],
    ])) as ValidateContentResult['layers'];
    const layerStats = Object.fromEntries(LAYERS.map(layer => [layer, {
      total: totals[layer],
      returned: returnedLayers[layer].length,
      omitted: totals[layer] - returnedLayers[layer].length,
    }])) as NonNullable<ValidateContentResult['layerStats']>;
    return {
      ...result,
      layers: returnedLayers,
      layerStats,
      truncated: LAYERS.some(layer => layerStats[layer].omitted > 0),
      summary: compact ? truncateUtf8(result.summary, 1024) : result.summary,
      parseError: compact ? compactError(result.parseError) : result.parseError,
      internalError: compact ? compactError(result.internalError) : result.internalError,
    };
  };
  const serialize = (compact = false) => JSON.stringify(build(compact), null, 2);

  let text = serialize();
  while (Buffer.byteLength(text, 'utf8') > MAX_TOOL_TEXT_BYTES) {
    const removable = LAYERS
      .filter(layer => layers[layer].length > 1)
      .sort((left, right) => layers[right].length - layers[left].length)[0];
    if (!removable) break;
    layers[removable].pop();
    text = serialize();
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_TOOL_TEXT_BYTES) text = serialize(true);
  return text;
}

export function handleValidateContent(args: { content: string; format: 'yaml' | 'json'; filename?: string }): ToolResponse {
  return { content: [{ type: 'text', text: serializeWithinBudget(validateContent(args)) }] };
}
