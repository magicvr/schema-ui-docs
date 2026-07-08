export type ToolContent = {
  type: 'text';
  text: string;
};

export type ToolResponse = {
  content: ToolContent[];
  isError?: boolean;
};

export type JsonObject = Record<string, unknown>;

export type ValidationLayer = 'L0/L1' | 'L2' | 'L3a' | 'L4';

export type LayerViolation = {
  path: string;
  message: string;
  file?: string;
  rule?: string;
  key?: string;
  keyword?: string;
};

export type ParseError = {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
};

export type ValidateContentResult = {
  passed: boolean;
  layers: Record<ValidationLayer, LayerViolation[]>;
  summary: string;
  parseError: ParseError | null;
  internalError: string | null;
  suggestedDocs: string[];
};
