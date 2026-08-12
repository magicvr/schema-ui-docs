'use strict';

/**
 * Host conformance claim validator (C1).
 *
 * Implements ADR-0037 / spec 10 §4: canonical serialization and reproducible
 * digest (D1a / §4.3), capability registry validation with dependency DAG
 * (§4.4), removedIn handling, and the claim validation order of §4.8.
 * Outputs are deterministic and byte-comparable with the Python reference
 * (host_conformance_claim.py).
 */

const crypto = require('node:crypto');

const VERSION_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
// v2.8: segments may contain hyphens (host.failure-recovery) — ADR-0034 grammar widening.
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const SUITE_ID_PATTERN = /^[a-z0-9-]+$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Numeric MAJOR.MINOR comparison (null-safe: null versions compare as absent). */
function compareVersion(left, right) {
  const [leftMajor, leftMinor] = left.split('.').map(Number);
  const [rightMajor, rightMinor] = right.split('.').map(Number);
  if (leftMajor !== rightMajor) return leftMajor < rightMajor ? -1 : 1;
  if (leftMinor !== rightMinor) return leftMinor < rightMinor ? -1 : 1;
  return 0;
}

/** Array of strings sorted by UTF-8 byte order (=== codepoint order). */
function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isObjectArray(value) {
  return Array.isArray(value) && value.every(item => isObject(item));
}

/**
 * Canonical serialization (D1a / §4.3): object keys byte-ascending, string
 * arrays byte-ascending, object arrays sorted by canonical bytes, minimal
 * RFC 8259 escaping, no whitespace.
 *
 * Number support is restricted to integers: valid claims contain no numeric
 * fields (C0), and JS/Python float exponent formatting differs
 * (1e-7 vs 1e-07), which would break cross-language digest equality.
 */
function canonicalize(value) {
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const key of keys) {
      parts.push(`${JSON.stringify(key)}:${canonicalize(value[key])}`);
    }
    return `{${parts.join(',')}}`;
  }
  if (Array.isArray(value)) {
    let items = value;
    if (isStringArray(items)) {
      items = [...items].sort();
    } else if (isObjectArray(items)) {
      items = [...items].sort((left, right) => {
        const leftBytes = canonicalize(left);
        const rightBytes = canonicalize(right);
        return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
      });
    }
    return `[${items.map(item => canonicalize(item)).join(',')}]`;
  }
  return JSON.stringify(value);
}

/** SHA-256 (lowercase hex) over the canonical UTF-8 bytes. */
function claimDigest(claim) {
  return crypto.createHash('sha256').update(canonicalize(claim), 'utf8').digest('hex');
}

/**
 * Registry validation (§4.4): closed entries, precise MAJOR.MINOR or null
 * versions, removedIn strictly after deprecatedSince, existing dependency
 * targets, unique IDs and an acyclic dependency graph.
 */
function validateRegistry(registry) {
  const errors = [];
  if (!isObject(registry) || !isObject(registry.capabilities)) {
    return { valid: false, errors: ['registry.capabilities must be an object'] };
  }
  const capabilities = registry.capabilities;
  const ids = Object.keys(capabilities);

  for (const id of ids) {
    if (!CAPABILITY_PATTERN.test(id)) {
      errors.push(`invalid capabilityId: ${id}`);
      continue;
    }
    const entry = capabilities[id];
    if (!isObject(entry)) {
      errors.push(`${id}: entry must be an object`);
      continue;
    }
    const allowedKeys = new Set([
      'sinceProtocolVersion', 'dependsOn', 'mandatorySuites', 'deprecatedSince', 'removedIn',
    ]);
    for (const key of Object.keys(entry)) {
      if (!allowedKeys.has(key)) errors.push(`${id}: unknown key ${key}`);
    }
    for (const versionKey of ['sinceProtocolVersion']) {
      if (typeof entry[versionKey] !== 'string' || !VERSION_PATTERN.test(entry[versionKey])) {
        errors.push(`${id}: ${versionKey} must be a precise MAJOR.MINOR`);
      }
    }
    for (const versionKey of ['deprecatedSince', 'removedIn']) {
      const value = entry[versionKey];
      if (value !== null && (typeof value !== 'string' || !VERSION_PATTERN.test(value))) {
        errors.push(`${id}: ${versionKey} must be MAJOR.MINOR or null`);
      }
    }
    if (entry.removedIn !== null && entry.removedIn !== undefined) {
      if (entry.deprecatedSince === null || entry.deprecatedSince === undefined) {
        errors.push(`${id}: removedIn requires deprecatedSince`);
      } else if (compareVersion(entry.removedIn, entry.deprecatedSince) <= 0) {
        errors.push(`${id}: removedIn must be strictly later than deprecatedSince`);
      }
    }
    if (!Array.isArray(entry.dependsOn) || !isStringArray(entry.dependsOn)
      || new Set(entry.dependsOn).size !== entry.dependsOn.length) {
      errors.push(`${id}: dependsOn must be a unique string array`);
    } else {
      for (const dependency of entry.dependsOn) {
        if (!Object.prototype.hasOwnProperty.call(capabilities, dependency)) {
          errors.push(`${id}: dependsOn references unregistered capability ${dependency}`);
        }
      }
    }
    if (!Array.isArray(entry.mandatorySuites) || entry.mandatorySuites.length === 0
      || !entry.mandatorySuites.every(suite => typeof suite === 'string' && SUITE_ID_PATTERN.test(suite))
      || new Set(entry.mandatorySuites).size !== entry.mandatorySuites.length) {
      errors.push(`${id}: mandatorySuites must be a non-empty unique suite-id array`);
    }
  }

  // Dependency graph must be acyclic.
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, chain) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      errors.push(`dependency cycle detected: ${[...chain, id].join(' -> ')}`);
      return;
    }
    visiting.add(id);
    const entry = capabilities[id];
    if (isObject(entry) && Array.isArray(entry.dependsOn)) {
      for (const dependency of entry.dependsOn) {
        if (Object.prototype.hasOwnProperty.call(capabilities, dependency)) {
          visit(dependency, [...chain, id]);
        }
      }
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id, []);

  return { valid: errors.length === 0, errors };
}

/**
 * Claim validation in the §4.8 order:
 * INVALID_CLAIM → UNKNOWN_CLAIM_VERSION → UNKNOWN_CLAIM_CAPABILITY (incl.
 * removedIn) → INCOMPLETE_CAPABILITY_DEPENDENCY → CLAIM_ARTIFACT_MISMATCH →
 * CLAIM_FIXTURE_MISMATCH → CLAIM_SUITE_INCOMPLETE → CLAIM_EVIDENCE_BUILD_MISMATCH
 * → CLAIM_EVIDENCE_UNVERIFIABLE → CLAIM_OK.
 *
 * @param {object} claim
 * @param {object} options
 * @param {object} options.registry capability-registry.json object
 * @param {string} options.artifactContentSha256 hex digest of the protocol artifact content the build consumed
 * @param {string} options.fixtureSha256 hex digest declared by the protocol artifact for the versioned fixtures
 * @param {string[]} [options.evidenceStates] per-evidence 'verifiable' | 'unverifiable' (default all verifiable)
 */
function validateClaim(claim, options = {}) {
  const registry = isObject(options.registry) && isObject(options.registry.capabilities)
    ? options.registry
    : null;
  const artifactContentSha256 = options.artifactContentSha256;
  const fixtureSha256 = options.fixtureSha256;
  const evidenceStates = Array.isArray(options.evidenceStates) ? options.evidenceStates : [];

  const invalid = (code) => ({ code });

  if (!isObject(claim)) return invalid('INVALID_CLAIM');
  if (!isObject(claim.host) || !isObject(claim.protocolArtifact)
    || !isObject(claim.support) || !isObject(claim.conformance)
    || !Array.isArray(claim.evidence)) {
    return invalid('INVALID_CLAIM');
  }
  const { pageVersions, manifestVersions, capabilities } = claim.support;
  for (const list of [pageVersions, manifestVersions]) {
    if (!Array.isArray(list) || list.length === 0 || !isStringArray(list)
      || list.some(version => !VERSION_PATTERN.test(version)) || new Set(list).size !== list.length) {
      return invalid('INVALID_CLAIM');
    }
  }
  if (!Array.isArray(capabilities) || capabilities.length === 0 || !isStringArray(capabilities)
    || capabilities.some(id => !CAPABILITY_PATTERN.test(id)) || new Set(capabilities).size !== capabilities.length) {
    return invalid('INVALID_CLAIM');
  }
  if (typeof claim.conformance.fixtureSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(claim.conformance.fixtureSha256)
    || typeof claim.protocolArtifact.contentSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(claim.protocolArtifact.contentSha256)) {
    return invalid('INVALID_CLAIM');
  }
  if (!Array.isArray(claim.conformance.suites) || claim.conformance.suites.length === 0) {
    return invalid('INVALID_CLAIM');
  }
  if (claim.evidence.length === 0) return invalid('INVALID_CLAIM');
  if (typeof claim.host.buildId !== 'string' || claim.host.buildId.length === 0) {
    return invalid('INVALID_CLAIM');
  }

  if (claim.claimVersion !== '1.0') return invalid('UNKNOWN_CLAIM_VERSION');
  if (!registry) return invalid('INVALID_CLAIM');

  // Capability registration + removedIn per listed version (D2 / §4.2, §4.4).
  const registryCapabilities = registry.capabilities;
  const listedVersions = [...pageVersions, ...manifestVersions];
  for (const capability of capabilities) {
    const entry = registryCapabilities[capability];
    if (!entry) return invalid('UNKNOWN_CLAIM_CAPABILITY');
    if (entry.removedIn !== null && entry.removedIn !== undefined) {
      for (const version of listedVersions) {
        if (compareVersion(entry.removedIn, version) <= 0) {
          return invalid('UNKNOWN_CLAIM_CAPABILITY');
        }
      }
    }
  }

  // Dependency closure (D2 / §4.2).
  const listed = new Set(capabilities);
  for (const capability of capabilities) {
    const pending = [...registryCapabilities[capability].dependsOn];
    while (pending.length > 0) {
      const dependency = pending.pop();
      if (!listed.has(dependency)) return invalid('INCOMPLETE_CAPABILITY_DEPENDENCY');
      const dependencyEntry = registryCapabilities[dependency];
      if (dependencyEntry && Array.isArray(dependencyEntry.dependsOn)) {
        pending.push(...dependencyEntry.dependsOn);
      }
    }
  }

  if (claim.protocolArtifact.contentSha256 !== artifactContentSha256) {
    return invalid('CLAIM_ARTIFACT_MISMATCH');
  }
  if (claim.conformance.fixtureVersion !== '1.0' || claim.conformance.fixtureSha256 !== fixtureSha256) {
    return invalid('CLAIM_FIXTURE_MISMATCH');
  }

  // Mandatory suite coverage (D4 / §4.6): union over listed capabilities.
  const suiteResults = new Map();
  for (const suite of claim.conformance.suites) {
    suiteResults.set(suite.suiteId, suite);
  }
  for (const capability of capabilities) {
    for (const suiteId of registryCapabilities[capability].mandatorySuites) {
      const suite = suiteResults.get(suiteId);
      if (!suite || suite.result !== 'pass') return invalid('CLAIM_SUITE_INCOMPLETE');
    }
  }

  // Evidence build binding (D5 / §4.7).
  for (const evidence of claim.evidence) {
    if (!isObject(evidence) || evidence.subjectBuildId !== claim.host.buildId) {
      return invalid('CLAIM_EVIDENCE_BUILD_MISMATCH');
    }
  }

  for (let index = 0; index < claim.evidence.length; index += 1) {
    const state = index < evidenceStates.length ? evidenceStates[index] : 'verifiable';
    if (state === 'unverifiable') return invalid('CLAIM_EVIDENCE_UNVERIFIABLE');
  }

  return invalid('CLAIM_OK');
}

/** Fixture dispatch facade: operation selects the semantic entry point. */
function execute(input) {
  const operation = input && input.operation;
  if (operation === 'canonicalize') return { canonical: canonicalize(input.value) };
  if (operation === 'claimDigest') return { digest: claimDigest(input.claim) };
  if (operation === 'validateRegistry') return validateRegistry(input.registry);
  if (operation === 'validateClaim') return validateClaim(input.claim, input.options);
  throw new Error(`Unknown operation: ${operation}`);
}

module.exports = { execute, canonicalize, claimDigest, validateRegistry, validateClaim };
