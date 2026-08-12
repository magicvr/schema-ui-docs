'use strict';

/**
 * Host bootstrap document semantic validator (B1).
 *
 * Mirrors the deterministic bootstrap lifecycle of ADR-0035 / spec 10 §2.3:
 * negotiation (stage 2), availability gate (3), auth gate (4), manifest
 * integrity (6) and manifest capability narrowing (D5 / §2.5). HTTP fetching
 * and byte I/O stay in Host plumbing; fixtures feed the parsed document plus
 * the fetch/transport classification.
 *
 * Output is fully deterministic and byte-comparable with the Python
 * reference (host_bootstrap.py).
 */

// v2.8: segments may contain hyphens (host.failure-recovery) — ADR-0034 grammar widening.
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

const AVAILABILITY_MODES = ['normal', 'maintenance', 'upgrade-required', 'degraded'];
const AUTH_STATES = ['anonymous', 'authenticated', 'reauth-required', 'locked'];
const FETCH_CLASSIFICATIONS = ['rate-limited', 'timeout', 'offline', 'unavailable', 'protocol'];

function isUniqueStringList(value, pattern, allowEmpty) {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(item => typeof item === 'string' && (pattern ? pattern.test(item) : item.length > 0))
    && new Set(value).size === value.length;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function buildResult(code, result, phase, extra = {}) {
  return {
    code,
    result,
    phase,
    fetchClassification: null,
    missingCapabilities: [],
    effectiveCapabilities: null,
    context: null,
    ...extra,
  };
}

/**
 * @param {object} input
 * @param {object|null} input.document parsed bootstrap document (null when fetch failed or entry not provided)
 * @param {object} input.fetch { status: 'ok' | 'not-provided' | 'failed', classification: string|null }
 * @param {object} input.hostSupport { supportedBootstrapVersions: string[], supportedCapabilities: string[] }
 * @param {object} input.auth { state, principal?, expiresAt?, provenance }
 * @param {object|null} input.manifest parsed manifest meta { protocolVersion, requiredCapabilities }
 * @param {object|null} input.integrity { declaredSha256, computedSha256 }
 * @param {object} input.capabilityRegistry capability-registry.json object
 */
function evaluateBootstrap(input) {
  const document = isObject(input?.document) ? input.document : null;
  const fetch = isObject(input?.fetch) ? input.fetch : {};
  const hostSupport = isObject(input?.hostSupport) ? input.hostSupport : {};
  const auth = isObject(input?.auth) ? input.auth : {};
  const manifest = isObject(input?.manifest) ? input.manifest : null;
  const integrity = isObject(input?.integrity) ? input.integrity : null;
  const registry = isObject(input?.capabilityRegistry) ? input.capabilityRegistry : {};
  const registryCapabilities = isObject(registry.capabilities) ? registry.capabilities : {};

  // Stage 1–2: discovery result. A parsed document is authoritative; when it
  // is absent, fetch.status decides between the 404/410 fallback path and a
  // document failure with its transport classification.
  if (document === null) {
    if (fetch.status === 'not-provided') {
      // Fallback: continue with the ADR-0025 manifest entry (no document gates).
      return runFallbackPath({ hostSupport, auth, manifest, integrity });
    }
    const classification = FETCH_CLASSIFICATIONS.includes(fetch.classification)
      ? fetch.classification
      : 'unavailable';
    return buildResult(
      'BOOTSTRAP_DOCUMENT_FAILED',
      'BOOTSTRAP_DOCUMENT_FAILED',
      'bootstrap-discovery',
      { fetchClassification: classification },
    );
  }

  // Stage 2: bootstrap-validation (structure first, then Host support
  // validity, version match, capability list validity and membership —
  // mirroring ADR-0009's check order).
  if (document.bootstrapVersion !== '1.0') {
    // B0's const rejects non-1.0 documents; surfacing it here keeps B1
    // self-contained for consumers that skip B0.
    return buildResult('INVALID_BOOTSTRAP_DOCUMENT', 'BOOTSTRAP_DOCUMENT_FAILED', 'bootstrap-validation');
  }
  const supportedBootstrapVersions = hostSupport.supportedBootstrapVersions;
  if (!isUniqueStringList(supportedBootstrapVersions, null, false)) {
    return buildResult('INVALID_HOST_SUPPORT', 'BOOTSTRAP_NEGOTIATION_REJECTED', 'bootstrap-validation');
  }
  if (!supportedBootstrapVersions.includes(document.bootstrapVersion)) {
    return buildResult('UNSUPPORTED_BOOTSTRAP_VERSION', 'BOOTSTRAP_NEGOTIATION_REJECTED', 'bootstrap-validation');
  }

  const requiredCapabilities = document.requiredCapabilities;
  const firstVersionRequiresHostBootstrap = Array.isArray(requiredCapabilities)
    && requiredCapabilities.includes('host.bootstrap');
  if (!isUniqueStringList(requiredCapabilities, CAPABILITY_PATTERN, false) || !firstVersionRequiresHostBootstrap) {
    return buildResult('INVALID_REQUIRED_CAPABILITIES', 'BOOTSTRAP_NEGOTIATION_REJECTED', 'bootstrap-validation');
  }

  const supportedCapabilities = Array.isArray(hostSupport.supportedCapabilities)
    ? hostSupport.supportedCapabilities
    : [];
  if (!isUniqueStringList(supportedCapabilities, CAPABILITY_PATTERN, true)) {
    return buildResult('INVALID_HOST_SUPPORT', 'BOOTSTRAP_NEGOTIATION_REJECTED', 'bootstrap-validation');
  }

  const supportedSet = new Set(supportedCapabilities);
  const missingCapabilities = requiredCapabilities.filter(capability => !supportedSet.has(capability));
  if (missingCapabilities.length > 0) {
    return buildResult(
      'MISSING_REQUIRED_CAPABILITY',
      'BOOTSTRAP_NEGOTIATION_REJECTED',
      'bootstrap-validation',
      { missingCapabilities },
    );
  }

  // Stage 3: availability-gate.
  const availability = isObject(document.availability) ? document.availability : {};
  const mode = availability.mode;
  if (mode === 'maintenance') {
    return buildResult('OK', 'MAINTENANCE', 'availability-gate');
  }
  if (mode === 'upgrade-required') {
    return buildResult('OK', 'UPGRADE_REQUIRED', 'availability-gate');
  }
  if (!AVAILABILITY_MODES.includes(mode)) {
    return buildResult('INVALID_BOOTSTRAP_DOCUMENT', 'BOOTSTRAP_DOCUMENT_FAILED', 'availability-gate');
  }

  let disabledCapabilities = [];
  if (mode === 'degraded') {
    disabledCapabilities = Array.isArray(availability.disabledCapabilities)
      ? availability.disabledCapabilities
      : [];
    const unregistered = disabledCapabilities.filter(
      capability => !Object.prototype.hasOwnProperty.call(registryCapabilities, capability),
    );
    if (unregistered.length > 0) {
      // disabledCapabilities must be registered capability IDs (D2 / §2.2).
      return buildResult('INVALID_BOOTSTRAP_DOCUMENT', 'BOOTSTRAP_DOCUMENT_FAILED', 'bootstrap-validation');
    }
  }

  // Stage 4: auth-resolution.
  if (auth.state === 'locked') {
    return buildResult('OK', 'ACCOUNT_LOCKED', 'auth-resolution');
  }
  if (auth.state === 'reauth-required') {
    return buildResult('OK', 'REAUTH_REQUIRED', 'auth-resolution');
  }
  if (!AUTH_STATES.includes(auth.state)) {
    return buildResult('INVALID_BOOTSTRAP_DOCUMENT', 'BOOTSTRAP_DOCUMENT_FAILED', 'auth-resolution');
  }

  // Stage 6: manifest-integrity (only when the document declared sha256).
  if (document.manifest && typeof document.manifest.sha256 === 'string') {
    const declared = document.manifest.sha256;
    const computed = integrity ? integrity.computedSha256 : null;
    if (typeof computed !== 'string' || computed !== declared) {
      return buildResult('MANIFEST_INTEGRITY_FAILED', 'MANIFEST_INTEGRITY_FAILED', 'manifest-integrity');
    }
  }

  // Stage 7: manifest-validation capability narrowing (D5 / §2.5).
  const effectiveCapabilities = supportedCapabilities.filter(
    capability => !disabledCapabilities.includes(capability),
  );
  const manifestRequired = manifest && Array.isArray(manifest.requiredCapabilities)
    ? manifest.requiredCapabilities
    : [];
  const effectiveSet = new Set(effectiveCapabilities);
  const missingAfterNarrowing = manifestRequired.filter(capability => !effectiveSet.has(capability));
  if (missingAfterNarrowing.length > 0) {
    return buildResult(
      'MISSING_REQUIRED_CAPABILITY',
      'MANIFEST_CAPABILITY_REJECTED',
      'manifest-validation',
      { missingCapabilities: missingAfterNarrowing, effectiveCapabilities },
    );
  }

  // Stage 8–9: context-resolution + ready.
  const context = resolveContext(auth);
  const result = mode === 'degraded' ? 'READY_DEGRADED' : 'READY';
  const extra = { context };
  if (mode === 'degraded') extra.effectiveCapabilities = effectiveCapabilities;
  return buildResult('OK', result, 'ready', extra);
}

/**
 * Fallback path (bootstrap document not provided, 404/410 on the default
 * entry): ADR-0025 manifest load continues; no bootstrap gates apply, but the
 * auth gate, integrity (no declared sha256 without a document) and manifest
 * capability narrowing (no disabledCapabilities) still run.
 */
function runFallbackPath({ hostSupport, auth, manifest, integrity }) {
  if (auth.state === 'locked') {
    return buildResult('OK', 'ACCOUNT_LOCKED', 'auth-resolution');
  }
  if (auth.state === 'reauth-required') {
    return buildResult('OK', 'REAUTH_REQUIRED', 'auth-resolution');
  }
  if (!AUTH_STATES.includes(auth.state)) {
    return buildResult('INVALID_BOOTSTRAP_DOCUMENT', 'BOOTSTRAP_DOCUMENT_FAILED', 'auth-resolution');
  }
  const supportedCapabilities = Array.isArray(hostSupport.supportedCapabilities)
    ? hostSupport.supportedCapabilities
    : [];
  const manifestRequired = manifest && Array.isArray(manifest.requiredCapabilities)
    ? manifest.requiredCapabilities
    : [];
  const supportedSet = new Set(supportedCapabilities);
  const missingCapabilities = manifestRequired.filter(capability => !supportedSet.has(capability));
  if (missingCapabilities.length > 0) {
    return buildResult(
      'MISSING_REQUIRED_CAPABILITY',
      'MANIFEST_CAPABILITY_REJECTED',
      'manifest-validation',
      { missingCapabilities },
    );
  }
  const context = resolveContext(auth);
  return buildResult('OK', 'READY', 'ready', { context });
}

/** Normalized auth snapshot → one-shot $context.user projection (D4 / §2.4). */
function resolveContext(auth) {
  if (auth.state === 'authenticated') {
    const principal = isObject(auth.principal) ? auth.principal : {};
    return {
      user: {
        id: typeof principal.id === 'string' ? principal.id : '',
        name: typeof principal.name === 'string' ? principal.name : '',
        roles: Array.isArray(principal.roles) ? principal.roles.filter(role => typeof role === 'string') : [],
      },
    };
  }
  // anonymous sentinel: satisfies $context.user minimal shape, is not an
  // identity and must never act as a server authorization subject.
  return { user: { id: '', name: '', roles: [] } };
}

module.exports = { evaluateBootstrap };
