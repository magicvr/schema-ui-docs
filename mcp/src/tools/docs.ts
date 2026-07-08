import { z } from 'zod/v4';
import { getDoc } from '../core/protocol-index.js';
import { jsonResponse } from './utils.js';

export const getDocInputSchema = {
  docId: z.string().min(1).max(80),
  section: z.string().min(1).max(200).optional(),
};

export function handleGetDoc(args: { docId: string; section?: string }) {
  return jsonResponse(getDoc(args.docId, args.section));
}
