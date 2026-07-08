import { z } from 'zod/v4';
import { getComponent, listComponents } from '../core/component-registry.js';
import { jsonResponse } from './utils.js';

export const getComponentInputSchema = {
  type: z.string().min(1).max(80),
};

export function handleListComponents() {
  return jsonResponse(listComponents());
}

export function handleGetComponent(args: { type: string }) {
  return jsonResponse(getComponent(args.type));
}
