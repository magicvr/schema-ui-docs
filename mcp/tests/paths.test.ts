import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  externalRootOverridesAllowed,
  findProtocolRoot,
  findValidatorRoot,
  PROTOCOL_ROOT,
  VALIDATOR_ROOT,
} from '../src/core/paths.js';

describe('MCP path roots (V341)', () => {
  it('allows external overrides outside production by default', () => {
    expect(externalRootOverridesAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(externalRootOverridesAllowed({ NODE_ENV: 'test' })).toBe(true);
    expect(externalRootOverridesAllowed({})).toBe(true);
  });

  it('blocks external overrides in production unless explicit allow flag is set', () => {
    expect(externalRootOverridesAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(externalRootOverridesAllowed({
      NODE_ENV: 'production',
      SCHEMA_UI_ALLOW_EXTERNAL_ROOTS: '1',
    })).toBe(true);
    expect(externalRootOverridesAllowed({
      NODE_ENV: 'production',
      SCHEMA_UI_ALLOW_EXTERNAL_ROOTS: 'true',
    })).toBe(true);
  });

  it('ignores SCHEMA_UI_PROTOCOL_ROOT under production without allow flag', () => {
    const bundled = findProtocolRoot({ NODE_ENV: 'production', SCHEMA_UI_PROTOCOL_ROOT: path.parse(process.cwd()).root });
    expect(bundled).toBe(PROTOCOL_ROOT);
  });

  it('ignores SCHEMA_UI_VALIDATOR_ROOT under production without allow flag', () => {
    const bundled = findValidatorRoot({ NODE_ENV: 'production', SCHEMA_UI_VALIDATOR_ROOT: path.parse(process.cwd()).root });
    expect(bundled).toBe(VALIDATOR_ROOT);
  });
});
