"""
Host bootstrap document semantic validator (B1, Python reference).

Mirrors the deterministic bootstrap lifecycle of ADR-0035 / spec 10 §2.3.
Output is fully deterministic and byte-comparable with the JavaScript
reference (host-bootstrap.js).
"""

import re

# v2.8: segments may contain hyphens (host.failure-recovery) — ADR-0034 grammar widening.
CAPABILITY_PATTERN = re.compile(r"^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$")

AVAILABILITY_MODES = ("normal", "maintenance", "upgrade-required", "degraded")
AUTH_STATES = ("anonymous", "authenticated", "reauth-required", "locked")
FETCH_CLASSIFICATIONS = ("rate-limited", "timeout", "offline", "unavailable", "protocol")


def _is_object(value):
    return isinstance(value, dict)


def _is_unique_string_list(value, pattern, allow_empty):
    return (
        isinstance(value, list)
        and (allow_empty or len(value) > 0)
        and all(
            isinstance(item, str)
            and (pattern.fullmatch(item) if pattern is not None else len(item) > 0)
            for item in value
        )
        and len(set(value)) == len(value)
    )


def _build_result(code, result, phase, **extra):
    output = {
        "code": code,
        "result": result,
        "phase": phase,
        "fetchClassification": None,
        "missingCapabilities": [],
        "effectiveCapabilities": None,
        "context": None,
    }
    output.update(extra)
    return output


def _resolve_context(auth):
    if auth.get("state") == "authenticated":
        principal = auth.get("principal") if _is_object(auth.get("principal")) else {}
        return {
            "user": {
                "id": principal.get("id") if isinstance(principal.get("id"), str) else "",
                "name": principal.get("name") if isinstance(principal.get("name"), str) else "",
                "roles": [
                    role for role in principal.get("roles", [])
                    if isinstance(role, str)
                ] if isinstance(principal.get("roles"), list) else [],
            }
        }
    # anonymous sentinel: satisfies $context.user minimal shape, is not an
    # identity and must never act as a server authorization subject.
    return {"user": {"id": "", "name": "", "roles": []}}


def _run_fallback_path(host_support, auth, manifest):
    if auth.get("state") == "locked":
        return _build_result("OK", "ACCOUNT_LOCKED", "auth-resolution")
    if auth.get("state") == "reauth-required":
        return _build_result("OK", "REAUTH_REQUIRED", "auth-resolution")
    if auth.get("state") not in AUTH_STATES:
        return _build_result("INVALID_BOOTSTRAP_DOCUMENT", "BOOTSTRAP_DOCUMENT_FAILED", "auth-resolution")
    supported_capabilities = (
        host_support.get("supportedCapabilities")
        if isinstance(host_support.get("supportedCapabilities"), list)
        else []
    )
    manifest_required = (
        manifest.get("requiredCapabilities")
        if _is_object(manifest) and isinstance(manifest.get("requiredCapabilities"), list)
        else []
    )
    supported_set = set(supported_capabilities)
    missing_capabilities = [
        capability for capability in manifest_required if capability not in supported_set
    ]
    if missing_capabilities:
        return _build_result(
            "MISSING_REQUIRED_CAPABILITY",
            "MANIFEST_CAPABILITY_REJECTED",
            "manifest-validation",
            missingCapabilities=missing_capabilities,
        )
    return _build_result("OK", "READY", "ready", context=_resolve_context(auth))


def evaluate_bootstrap(input_value):
    """input: {document, fetch, hostSupport, auth, manifest, integrity, capabilityRegistry}."""
    input_value = input_value if _is_object(input_value) else {}
    document = input_value.get("document") if _is_object(input_value.get("document")) else None
    fetch = input_value.get("fetch") if _is_object(input_value.get("fetch")) else {}
    host_support = input_value.get("hostSupport") if _is_object(input_value.get("hostSupport")) else {}
    auth = input_value.get("auth") if _is_object(input_value.get("auth")) else {}
    manifest = input_value.get("manifest") if _is_object(input_value.get("manifest")) else None
    integrity = input_value.get("integrity") if _is_object(input_value.get("integrity")) else None
    registry = input_value.get("capabilityRegistry") if _is_object(input_value.get("capabilityRegistry")) else {}
    registry_capabilities = registry.get("capabilities") if _is_object(registry.get("capabilities")) else {}

    # Stage 1-2: discovery result. A parsed document is authoritative; when it
    # is absent, fetch.status decides between the 404/410 fallback path and a
    # document failure with its transport classification.
    if document is None:
        if fetch.get("status") == "not-provided":
            return _run_fallback_path(host_support, auth, manifest)
        classification = (
            fetch.get("classification")
            if fetch.get("classification") in FETCH_CLASSIFICATIONS
            else "unavailable"
        )
        return _build_result(
            "BOOTSTRAP_DOCUMENT_FAILED",
            "BOOTSTRAP_DOCUMENT_FAILED",
            "bootstrap-discovery",
            fetchClassification=classification,
        )

    # Stage 2: bootstrap-validation (structure first, then Host support
    # validity, version match, capability list validity and membership).
    if document.get("bootstrapVersion") != "1.0":
        return _build_result("INVALID_BOOTSTRAP_DOCUMENT", "BOOTSTRAP_DOCUMENT_FAILED", "bootstrap-validation")

    supported_bootstrap_versions = host_support.get("supportedBootstrapVersions")
    if not _is_unique_string_list(supported_bootstrap_versions, None, False):
        return _build_result("INVALID_HOST_SUPPORT", "BOOTSTRAP_NEGOTIATION_REJECTED", "bootstrap-validation")
    if document.get("bootstrapVersion") not in supported_bootstrap_versions:
        return _build_result("UNSUPPORTED_BOOTSTRAP_VERSION", "BOOTSTRAP_NEGOTIATION_REJECTED", "bootstrap-validation")

    required_capabilities = document.get("requiredCapabilities")
    first_version_requires_host_bootstrap = (
        isinstance(required_capabilities, list) and "host.bootstrap" in required_capabilities
    )
    if not _is_unique_string_list(required_capabilities, CAPABILITY_PATTERN, False) or not first_version_requires_host_bootstrap:
        return _build_result("INVALID_REQUIRED_CAPABILITIES", "BOOTSTRAP_NEGOTIATION_REJECTED", "bootstrap-validation")

    supported_capabilities = (
        host_support.get("supportedCapabilities")
        if isinstance(host_support.get("supportedCapabilities"), list)
        else []
    )
    if not _is_unique_string_list(supported_capabilities, CAPABILITY_PATTERN, True):
        return _build_result("INVALID_HOST_SUPPORT", "BOOTSTRAP_NEGOTIATION_REJECTED", "bootstrap-validation")

    supported_set = set(supported_capabilities)
    missing_capabilities = [
        capability for capability in required_capabilities if capability not in supported_set
    ]
    if missing_capabilities:
        return _build_result(
            "MISSING_REQUIRED_CAPABILITY",
            "BOOTSTRAP_NEGOTIATION_REJECTED",
            "bootstrap-validation",
            missingCapabilities=missing_capabilities,
        )

    # Stage 3: availability-gate.
    availability = document.get("availability") if _is_object(document.get("availability")) else {}
    mode = availability.get("mode")
    if mode == "maintenance":
        return _build_result("OK", "MAINTENANCE", "availability-gate")
    if mode == "upgrade-required":
        return _build_result("OK", "UPGRADE_REQUIRED", "availability-gate")
    if mode not in AVAILABILITY_MODES:
        return _build_result("INVALID_BOOTSTRAP_DOCUMENT", "BOOTSTRAP_DOCUMENT_FAILED", "availability-gate")

    disabled_capabilities = []
    if mode == "degraded":
        disabled_capabilities = (
            availability.get("disabledCapabilities")
            if isinstance(availability.get("disabledCapabilities"), list)
            else []
        )
        unregistered = [
            capability for capability in disabled_capabilities
            if capability not in registry_capabilities
        ]
        if unregistered:
            return _build_result("INVALID_BOOTSTRAP_DOCUMENT", "BOOTSTRAP_DOCUMENT_FAILED", "bootstrap-validation")

    # Stage 4: auth-resolution.
    if auth.get("state") == "locked":
        return _build_result("OK", "ACCOUNT_LOCKED", "auth-resolution")
    if auth.get("state") == "reauth-required":
        return _build_result("OK", "REAUTH_REQUIRED", "auth-resolution")
    if auth.get("state") not in AUTH_STATES:
        return _build_result("INVALID_BOOTSTRAP_DOCUMENT", "BOOTSTRAP_DOCUMENT_FAILED", "auth-resolution")

    # Stage 6: manifest-integrity (only when the document declared sha256).
    manifest_decl = document.get("manifest") if _is_object(document.get("manifest")) else {}
    if isinstance(manifest_decl.get("sha256"), str):
        declared = manifest_decl.get("sha256")
        computed = integrity.get("computedSha256") if integrity is not None else None
        if not isinstance(computed, str) or computed != declared:
            return _build_result("MANIFEST_INTEGRITY_FAILED", "MANIFEST_INTEGRITY_FAILED", "manifest-integrity")

    # Stage 7: manifest-validation capability narrowing (D5 / §2.5).
    effective_capabilities = [
        capability for capability in supported_capabilities
        if capability not in disabled_capabilities
    ]
    manifest_required = (
        manifest.get("requiredCapabilities")
        if manifest is not None and isinstance(manifest.get("requiredCapabilities"), list)
        else []
    )
    effective_set = set(effective_capabilities)
    missing_after_narrowing = [
        capability for capability in manifest_required if capability not in effective_set
    ]
    if missing_after_narrowing:
        return _build_result(
            "MISSING_REQUIRED_CAPABILITY",
            "MANIFEST_CAPABILITY_REJECTED",
            "manifest-validation",
            missingCapabilities=missing_after_narrowing,
            effectiveCapabilities=effective_capabilities,
        )

    # Stage 8-9: context-resolution + ready.
    context = _resolve_context(auth)
    if mode == "degraded":
        return _build_result(
            "OK",
            "READY_DEGRADED",
            "ready",
            context=context,
            effectiveCapabilities=effective_capabilities,
        )
    return _build_result("OK", "READY", "ready", context=context)
