import type { ToolResponse } from '../types.js';

export function jsonResponse(value: unknown): ToolResponse {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(value, null, 2),
    }],
  };
}

export function errorResponse(message: string): ToolResponse {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}
