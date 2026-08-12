'use strict';

/**
 * Host failure result semantic validator (F1).
 *
 * Implements ADR-0036 / spec 10 §3: kind↔hostCode pairing (§3.2),
 * scope/kind compatibility, Host-level fetch classification priority
 * (§2.7 / §3.3), bootstrap→failure mapping (0035 D7), retry semantics
 * (§3.5), recovery-action filtering (§3.7) and return-intent validation
 * (§3.7). Outputs are deterministic and byte-comparable with the Python
 * reference (host_failure.py).
 */

const KIND_HOST_CODE = {
  'maintenance': 'HOST_MAINTENANCE',
  'upgrade-required': 'HOST_UPGRADE_REQUIRED',
  'authentication-required': 'HOST_AUTH_REQUIRED',
  'reauth-required': 'HOST_REAUTH_REQUIRED',
  'account-locked': 'HOST_ACCOUNT_LOCKED',
  'forbidden': 'HOST_FORBIDDEN',
  'not-found': 'HOST_ROUTE_NOT_FOUND',
  'rate-limited': 'HOST_RATE_LIMITED',
  'timeout': 'HOST_TIMEOUT',
  'offline': 'HOST_OFFLINE',
  'protocol-rejected': 'HOST_PROTOCOL_REJECTED',
  'render-failed': 'HOST_RENDER_FAILED',
  'unavailable': 'HOST_UNAVAILABLE',
};

const SCOPE_KINDS = {
  bootstrap: ['maintenance', 'upgrade-required', 'rate-limited', 'timeout', 'offline', 'unavailable', 'protocol-rejected'],
  manifest: ['protocol-rejected', 'rate-limited', 'timeout', 'offline', 'unavailable', 'authentication-required', 'reauth-required', 'forbidden'],
  page: ['protocol-rejected', 'rate-limited', 'timeout', 'offline', 'unavailable', 'authentication-required', 'reauth-required', 'forbidden'],
  auth: ['authentication-required', 'reauth-required', 'account-locked', 'forbidden'],
  route: ['not-found'],
  runtime: ['render-failed'],
};

const PERMANENT_REJECTED_QUERY_KEYS = new Set([
  'token', 'access_token', 'id_token', 'code', 'state', 'session', 'redirect', 'returnto',
]);
const PROTOCOL_RETURN_INTENT_ALLOWLIST = ['tab', 'view', 'page', 'pageSize', 'sort'];
const RETURN_INTENT_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
const HTML_PATTERN = /<\/?[a-zA-Z]/;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Host-level fetch classification (spec 10 §2.7 priority 1–2).
 *
 * Priority: 403 always wins and uniquely maps to forbidden; then 401 →
 * auth (anonymous → authentication-required, authenticated → reauth-required);
 * then explicit HTTP classes (426, 429); then transport (timeout, offline);
 * then other safely classifiable 5xx → unavailable. Everything else returns
 * null (not elevated; stays in existing node/Action semantics).
 */
function classifyHostFetch({ scope, status, authState, transport } = {}) {
  if (!['bootstrap', 'manifest', 'page'].includes(scope)) return null;
  if (status === 403) return { scope, kind: 'forbidden', hostCode: 'HOST_FORBIDDEN' };
  if (status === 401) {
    if (authState === 'authenticated') return { scope, kind: 'reauth-required', hostCode: 'HOST_REAUTH_REQUIRED' };
    return { scope, kind: 'authentication-required', hostCode: 'HOST_AUTH_REQUIRED' };
  }
  if (status === 426) return { scope, kind: 'upgrade-required', hostCode: 'HOST_UPGRADE_REQUIRED' };
  if (status === 429) return { scope, kind: 'rate-limited', hostCode: 'HOST_RATE_LIMITED' };
  if (transport === 'timeout') return { scope, kind: 'timeout', hostCode: 'HOST_TIMEOUT' };
  if (transport === 'offline') return { scope, kind: 'offline', hostCode: 'HOST_OFFLINE' };
  if (typeof status === 'number' && status >= 500 && status <= 599) {
    return { scope, kind: 'unavailable', hostCode: 'HOST_UNAVAILABLE' };
  }
  return null;
}

/**
 * Bootstrap stable result → Host failure triple (ADR-0035 D7 / spec 10 §2.7).
 * Returns null for READY / READY_DEGRADED (no failure).
 */
function mapBootstrapResult({ result, fetchClassification } = {}) {
  const byResult = {
    MAINTENANCE: { scope: 'bootstrap', kind: 'maintenance', hostCode: 'HOST_MAINTENANCE' },
    UPGRADE_REQUIRED: { scope: 'bootstrap', kind: 'upgrade-required', hostCode: 'HOST_UPGRADE_REQUIRED' },
    REAUTH_REQUIRED: { scope: 'auth', kind: 'reauth-required', hostCode: 'HOST_REAUTH_REQUIRED' },
    ACCOUNT_LOCKED: { scope: 'auth', kind: 'account-locked', hostCode: 'HOST_ACCOUNT_LOCKED' },
    BOOTSTRAP_NEGOTIATION_REJECTED: { scope: 'bootstrap', kind: 'protocol-rejected', hostCode: 'HOST_PROTOCOL_REJECTED' },
    MANIFEST_CAPABILITY_REJECTED: { scope: 'manifest', kind: 'protocol-rejected', hostCode: 'HOST_PROTOCOL_REJECTED' },
    MANIFEST_INTEGRITY_FAILED: { scope: 'manifest', kind: 'protocol-rejected', hostCode: 'HOST_PROTOCOL_REJECTED' },
  };
  if (Object.prototype.hasOwnProperty.call(byResult, result)) return byResult[result];
  if (result === 'BOOTSTRAP_DOCUMENT_FAILED') {
    const byClassification = {
      'rate-limited': { scope: 'bootstrap', kind: 'rate-limited', hostCode: 'HOST_RATE_LIMITED' },
      timeout: { scope: 'bootstrap', kind: 'timeout', hostCode: 'HOST_TIMEOUT' },
      offline: { scope: 'bootstrap', kind: 'offline', hostCode: 'HOST_OFFLINE' },
      unavailable: { scope: 'bootstrap', kind: 'unavailable', hostCode: 'HOST_UNAVAILABLE' },
      protocol: { scope: 'bootstrap', kind: 'protocol-rejected', hostCode: 'HOST_PROTOCOL_REJECTED' },
    };
    if (Object.prototype.hasOwnProperty.call(byClassification, fetchClassification)) {
      return byClassification[fetchClassification];
    }
  }
  return null;
}

/**
 * Validates a produced failure result against the semantic invariants that
 * are expressible without Host runtime state. Structural violations are
 * caught by F0 before this runs; this function checks pairing, scope/kind
 * compatibility, retry rules and per-kind recovery-action filtering.
 */
function validateFailure(failure) {
  const errors = [];
  if (!isObject(failure)) return { valid: false, errors: ['failure must be an object'] };

  const pair = KIND_HOST_CODE[failure.kind];
  if (pair === undefined) {
    errors.push('unknown kind');
  } else if (failure.hostCode !== pair) {
    errors.push(`hostCode ${failure.hostCode} does not match kind ${failure.kind} (expected ${pair})`);
  }

  const allowedKinds = SCOPE_KINDS[failure.scope];
  if (!allowedKinds) {
    errors.push(`unknown scope ${failure.scope}`);
  } else if (pair !== undefined && !allowedKinds.includes(failure.kind)) {
    errors.push(`kind ${failure.kind} is not valid in scope ${failure.scope}`);
  }

  if (failure.retry !== undefined && failure.retry !== null) {
    if (failure.retry.mode === 'after' && !Number.isInteger(failure.retry.afterSeconds)) {
      errors.push('retry mode after requires positive integer afterSeconds');
    }
    if (failure.kind === 'render-failed' && failure.retry.mode === 'after') {
      errors.push('render-failed must not auto-loop reload (retry mode after forbidden)');
    }
  }

  const message = failure.message;
  if (!isObject(message) || typeof message.messageKey !== 'string' || message.messageKey.length === 0) {
    errors.push('message.messageKey is required');
  } else if (isObject(message.params)) {
    for (const value of Object.values(message.params)) {
      if (typeof value === 'string' && HTML_PATTERN.test(value)) {
        errors.push('message.params must not contain HTML');
      }
    }
  }

  const actions = Array.isArray(failure.recoveryActions) ? failure.recoveryActions : [];
  for (const action of actions) {
    if (!isObject(action)) continue;
    if (failure.kind === 'forbidden' && action.type === 'reauth') {
      errors.push('forbidden must not offer reauth');
    }
    if (failure.kind === 'account-locked') {
      if (action.type === 'reauth') errors.push('account-locked must not offer reauth');
      if (action.type !== 'home' && action.type !== 'support') {
        errors.push('account-locked only allows home/support recovery actions');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a recoverable auth return intent (ADR-0036 D6 / spec 10 §3.7).
 *
 * The Host computes its effective allowlist by only narrowing
 * PROTOCOL_RETURN_INTENT_ALLOWLIST + registeredKeys; the validator rejects
 * permanent sensitive keys (case-insensitive), drops unlisted keys and
 * enforces path/expiry/nonce invariants.
 *
 * @param {object} intent { path, query?, expiresAt, nonce }
 * @param {object} options { registeredKeys?: string[], nowIso: string }
 */
function validateReturnIntent(intent, { registeredKeys = [], nowIso } = {}) {
  const errors = [];
  const rejectedKeys = [];
  const droppedKeys = [];
  const keptQuery = {};

  if (!isObject(intent)) return { valid: false, keptQuery, droppedKeys, rejectedKeys, reason: 'intent must be an object' };

  const path = intent.path;
  if (typeof path !== 'string'
    || !path.startsWith('/')
    || path.includes('#')
    || path.includes('://')
    || path.includes('\\')) {
    errors.push('path must be an absolute in-app path without scheme, authority, fragment or backslash');
  }
  if (typeof intent.nonce !== 'string' || intent.nonce.length === 0) {
    errors.push('nonce is required');
  }
  if (typeof intent.expiresAt !== 'string' || !RFC3339_PATTERN.test(intent.expiresAt)) {
    errors.push('expiresAt must be RFC 3339 UTC');
  } else if (nowIso && Date.parse(intent.expiresAt) <= Date.parse(nowIso)) {
    errors.push('intent has expired');
  }

  const hostExtensions = registeredKeys.filter(key => RETURN_INTENT_KEY_PATTERN.test(key));
  const allowlist = new Set([...PROTOCOL_RETURN_INTENT_ALLOWLIST, ...hostExtensions]);

  const query = isObject(intent.query) ? intent.query : null;
  if (query !== null) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value !== 'string') {
        errors.push(`query value for ${key} must be a string`);
        continue;
      }
      const lowered = key.toLowerCase();
      if (PERMANENT_REJECTED_QUERY_KEYS.has(lowered)) {
        rejectedKeys.push(key);
        continue;
      }
      if (!allowlist.has(key)) {
        droppedKeys.push(key);
        continue;
      }
      keptQuery[key] = value;
    }
  }

  return {
    valid: errors.length === 0,
    keptQuery,
    droppedKeys,
    rejectedKeys,
    reason: errors.length > 0 ? errors.join('; ') : null,
  };
}

/** Fixture dispatch facade: operation selects the semantic entry point. */
function execute(input) {
  const operation = input && input.operation;
  if (operation === 'classify') return classifyHostFetch(input);
  if (operation === 'mapBootstrapResult') return mapBootstrapResult(input);
  if (operation === 'validateFailure') return validateFailure(input.failure);
  if (operation === 'validateReturnIntent') return validateReturnIntent(input.intent, input.options);
  throw new Error(`Unknown operation: ${operation}`);
}

module.exports = {
  execute,
  classifyHostFetch,
  mapBootstrapResult,
  validateFailure,
  validateReturnIntent,
  PROTOCOL_RETURN_INTENT_ALLOWLIST,
  PERMANENT_REJECTED_QUERY_KEYS,
};
