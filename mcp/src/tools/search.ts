import { z } from 'zod/v4';
import { searchProtocol } from '../core/search.js';
import { jsonResponse } from './utils.js';

export const searchInputSchema = {
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(10).default(10).optional(),
};

export function handleSearch(args: { query: string; limit?: number }) {
  return jsonResponse(searchProtocol(args.query, args.limit));
}
