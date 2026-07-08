import { z } from 'zod/v4';
import { validateContent } from '../core/validation-runner.js';
import { jsonResponse } from './utils.js';

export const validateContentInputSchema = {
  content: z.string().max(1024 * 1024),
  format: z.enum(['yaml', 'json']),
  filename: z.string().max(260).optional(),
};

export function handleValidateContent(args: { content: string; format: 'yaml' | 'json'; filename?: string }) {
  return jsonResponse(validateContent(args));
}
