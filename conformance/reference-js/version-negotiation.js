'use strict';

const VERSION_PATTERN = /^[0-9]+\.[0-9]+$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;

function isUniqueStringList(value, pattern, allowEmpty) {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(item => typeof item === 'string' && pattern.test(item))
    && new Set(value).size === value.length;
}

function buildResult(accepted, code, pageVersion, supportedVersions, missingCapabilities = []) {
  return {
    accepted,
    code,
    pageVersion,
    supportedVersions,
    missingCapabilities,
  };
}

function negotiateProtocol(pageMeta, rendererSupport) {
  const pageVersion = typeof pageMeta?.protocolVersion === 'string'
    ? pageMeta.protocolVersion
    : null;
  const supportedVersions = Array.isArray(rendererSupport?.supportedVersions)
    ? [...rendererSupport.supportedVersions]
    : [];

  if (pageVersion === null) {
    return buildResult(false, 'MISSING_PROTOCOL_VERSION', null, supportedVersions);
  }
  if (!VERSION_PATTERN.test(pageVersion)) {
    return buildResult(false, 'INVALID_PROTOCOL_VERSION', pageVersion, supportedVersions);
  }
  if (!isUniqueStringList(rendererSupport?.supportedVersions, VERSION_PATTERN, false)) {
    return buildResult(false, 'INVALID_RENDERER_SUPPORT', pageVersion, supportedVersions);
  }
  if (!supportedVersions.includes(pageVersion)) {
    return buildResult(false, 'UNSUPPORTED_PROTOCOL_VERSION', pageVersion, supportedVersions);
  }

  const requiredCapabilities = pageMeta?.requiredCapabilities ?? [];
  if (!isUniqueStringList(requiredCapabilities, CAPABILITY_PATTERN, true)) {
    return buildResult(false, 'INVALID_REQUIRED_CAPABILITIES', pageVersion, supportedVersions);
  }

  const supportedCapabilities = rendererSupport?.supportedCapabilities ?? [];
  if (!isUniqueStringList(supportedCapabilities, CAPABILITY_PATTERN, true)) {
    return buildResult(false, 'INVALID_RENDERER_SUPPORT', pageVersion, supportedVersions);
  }

  const supportedCapabilitySet = new Set(supportedCapabilities);
  const missingCapabilities = requiredCapabilities.filter(capability => !supportedCapabilitySet.has(capability));
  if (missingCapabilities.length > 0) {
    return buildResult(
      false,
      'MISSING_REQUIRED_CAPABILITY',
      pageVersion,
      supportedVersions,
      missingCapabilities,
    );
  }

  return buildResult(true, 'OK', pageVersion, supportedVersions);
}

module.exports = { negotiateProtocol };