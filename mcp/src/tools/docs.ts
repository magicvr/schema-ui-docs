import { z } from 'zod/v4';
import { getDoc, getDocEntry, readMarkdown, splitSections } from '../core/protocol-index.js';
import type { ToolResponse } from '../types.js';

export const getDocInputSchema = {
  docId: z.string().min(1).max(80),
  section: z.string().min(1).max(200).optional(),
};

const MAX_TOOL_TEXT_BYTES = 20 * 1024;
const TRUNCATION_NOTICE = '\n\n[内容已截断，请传入更精确的 section，并参考 availableSections]';

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) return value;

  let sliceEnd = Math.max(0, maxBytes);
  while (sliceEnd > 0 && (buffer[sliceEnd] & 0xc0) === 0x80) sliceEnd--;
  return buffer.subarray(0, sliceEnd).toString('utf8');
}

function serializeWithinBudget(doc: ReturnType<typeof getDoc>): string {
  let budgetedDoc = doc;
  const serialize = (content: string) => JSON.stringify({ ...budgetedDoc, content }, null, 2);
  const initial = serialize(doc.content);
  if (Buffer.byteLength(initial, 'utf8') <= MAX_TOOL_TEXT_BYTES) return initial;

  if (!doc.truncated) {
    const entry = getDocEntry(doc.docId);
    budgetedDoc = {
      ...doc,
      truncated: true,
      availableSections: entry
        ? splitSections(readMarkdown(entry)).map(section => section.title)
        : undefined,
    };
  }

  while (
    budgetedDoc.availableSections?.length
    && Buffer.byteLength(serialize(TRUNCATION_NOTICE.trimStart()), 'utf8') > MAX_TOOL_TEXT_BYTES
  ) {
    budgetedDoc = { ...budgetedDoc, availableSections: budgetedDoc.availableSections.slice(0, -1) };
  }

  const source = budgetedDoc.content.endsWith(TRUNCATION_NOTICE)
    ? budgetedDoc.content.slice(0, -TRUNCATION_NOTICE.length)
    : budgetedDoc.content;
  let low = 0;
  let high = Buffer.byteLength(source, 'utf8');
  let best = serialize(TRUNCATION_NOTICE.trimStart());

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const candidate = serialize(`${truncateUtf8(source, midpoint)}${TRUNCATION_NOTICE}`);
    if (Buffer.byteLength(candidate, 'utf8') <= MAX_TOOL_TEXT_BYTES) {
      best = candidate;
      low = midpoint + 1;
    } else {
      high = midpoint - 1;
    }
  }

  return best;
}

export function handleGetDoc(args: { docId: string; section?: string }): ToolResponse {
  const text = serializeWithinBudget(getDoc(args.docId, args.section));
  return { content: [{ type: 'text', text }] };
}
