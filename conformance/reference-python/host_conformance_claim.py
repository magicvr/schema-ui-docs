"""
Host conformance claim validator (C1, Python reference).

Implements ADR-0037 / spec 10 §4. Outputs are deterministic and
byte-comparable with the JavaScript reference (host-conformance-claim.js).
"""

import hashlib
import json
import re

VERSION_PATTERN = re.compile(r"^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$")
# v2.8: segments may contain hyphens (host.failure-recovery) — ADR-0034 grammar widening.
CAPABILITY_PATTERN = re.compile(r"^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$")
SUITE_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")


def _is_object(value):
    return isinstance(value, dict)


def compare_version(left, right):
    """Numeric MAJOR.MINOR comparison."""
    left_major, left_minor = (int(part) for part in left.split("."))
    right_major, right_minor = (int(part) for part in right.split("."))
    if left_major != right_major:
        return -1 if left_major < right_major else 1
    if left_minor != right_minor:
        return -1 if left_minor < right_minor else 1
    return 0


def _is_string_array(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _is_object_array(value):
    return isinstance(value, list) and all(_is_object(item) for item in value)


def canonicalize(value):
    """Canonical serialization (D1a / §4.3).

    Number support is restricted to integers: valid claims contain no numeric
    fields (C0), and JS/Python float exponent formatting differs
    (1e-7 vs 1e-07), which would break cross-language digest equality.
    """
    if _is_object(value):
        parts = []
        for key in sorted(value.keys()):
            parts.append(json.dumps(key, ensure_ascii=False, separators=(",", ":"))
                         + ":" + canonicalize(value[key]))
        return "{" + ",".join(parts) + "}"
    if isinstance(value, list):
        items = value
        if _is_string_array(items):
            items = sorted(items)
        elif _is_object_array(items):
            items = sorted(items, key=lambda item: canonicalize(item))
        return "[" + ",".join(canonicalize(item) for item in items) + "]"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def claim_digest(claim):
    """SHA-256 (lowercase hex) over the canonical UTF-8 bytes."""
    return hashlib.sha256(canonicalize(claim).encode("utf-8")).hexdigest()


def validate_registry(registry):
    """Registry validation (§4.4): closed entries, precise versions, DAG acyclic."""
    errors = []
    if not _is_object(registry) or not _is_object(registry.get("capabilities")):
        return {"valid": False, "errors": ["registry.capabilities must be an object"]}
    capabilities = registry["capabilities"]
    ids = list(capabilities.keys())

    for capability_id in ids:
        if CAPABILITY_PATTERN.fullmatch(capability_id) is None:
            errors.append("invalid capabilityId: %s" % capability_id)
            continue
        entry = capabilities[capability_id]
        if not _is_object(entry):
            errors.append("%s: entry must be an object" % capability_id)
            continue
        allowed_keys = {"sinceProtocolVersion", "dependsOn", "mandatorySuites", "deprecatedSince", "removedIn"}
        for key in entry.keys():
            if key not in allowed_keys:
                errors.append("%s: unknown key %s" % (capability_id, key))
        if not isinstance(entry.get("sinceProtocolVersion"), str) or VERSION_PATTERN.fullmatch(entry.get("sinceProtocolVersion", "")) is None:
            errors.append("%s: sinceProtocolVersion must be a precise MAJOR.MINOR" % capability_id)
        for version_key in ("deprecatedSince", "removedIn"):
            value = entry.get(version_key)
            if value is not None and (not isinstance(value, str) or VERSION_PATTERN.fullmatch(value) is None):
                errors.append("%s: %s must be MAJOR.MINOR or null" % (capability_id, version_key))
        if entry.get("removedIn") is not None:
            if entry.get("deprecatedSince") is None:
                errors.append("%s: removedIn requires deprecatedSince" % capability_id)
            elif compare_version(entry["removedIn"], entry["deprecatedSince"]) <= 0:
                errors.append("%s: removedIn must be strictly later than deprecatedSince" % capability_id)
        depends_on = entry.get("dependsOn")
        if not _is_string_array(depends_on) or len(set(depends_on)) != len(depends_on):
            errors.append("%s: dependsOn must be a unique string array" % capability_id)
        else:
            for dependency in depends_on:
                if dependency not in capabilities:
                    errors.append("%s: dependsOn references unregistered capability %s" % (capability_id, dependency))
        mandatory_suites = entry.get("mandatorySuites")
        if not isinstance(mandatory_suites, list) or len(mandatory_suites) == 0 \
                or not all(isinstance(suite, str) and SUITE_ID_PATTERN.fullmatch(suite) for suite in mandatory_suites) \
                or len(set(mandatory_suites)) != len(mandatory_suites):
            errors.append("%s: mandatorySuites must be a non-empty unique suite-id array" % capability_id)

    # Dependency graph must be acyclic.
    visiting = set()
    visited = set()

    def visit(node, chain):
        if node in visited:
            return
        if node in visiting:
            errors.append("dependency cycle detected: %s" % " -> ".join(chain + [node]))
            return
        visiting.add(node)
        entry = capabilities.get(node)
        if _is_object(entry) and isinstance(entry.get("dependsOn"), list):
            for dependency in entry.get("dependsOn", []):
                if dependency in capabilities:
                    visit(dependency, chain + [node])
        visiting.discard(node)
        visited.add(node)

    for capability_id in ids:
        visit(capability_id, [])

    return {"valid": len(errors) == 0, "errors": errors}


def validate_claim(claim, options=None):
    """Claim validation in the §4.8 order."""
    options = options if _is_object(options) else {}
    registry = options.get("registry") if _is_object(options.get("registry")) and _is_object(options.get("registry", {}).get("capabilities")) else None
    artifact_content_sha256 = options.get("artifactContentSha256")
    fixture_sha256 = options.get("fixtureSha256")
    evidence_states = options.get("evidenceStates") if isinstance(options.get("evidenceStates"), list) else []

    def invalid(code):
        return {"code": code}

    if not _is_object(claim):
        return invalid("INVALID_CLAIM")
    if not _is_object(claim.get("host")) or not _is_object(claim.get("protocolArtifact")) \
            or not _is_object(claim.get("support")) or not _is_object(claim.get("conformance")) \
            or not isinstance(claim.get("evidence"), list):
        return invalid("INVALID_CLAIM")

    support = claim["support"]
    page_versions = support.get("pageVersions")
    manifest_versions = support.get("manifestVersions")
    capabilities = support.get("capabilities")
    for version_list in (page_versions, manifest_versions):
        if not isinstance(version_list, list) or len(version_list) == 0 or not _is_string_array(version_list) \
                or any(VERSION_PATTERN.fullmatch(version) is None for version in version_list) \
                or len(set(version_list)) != len(version_list):
            return invalid("INVALID_CLAIM")
    if not isinstance(capabilities, list) or len(capabilities) == 0 or not _is_string_array(capabilities) \
            or any(CAPABILITY_PATTERN.fullmatch(capability) is None for capability in capabilities) \
            or len(set(capabilities)) != len(capabilities):
        return invalid("INVALID_CLAIM")

    conformance = claim["conformance"]
    protocol_artifact = claim["protocolArtifact"]
    sha256_pattern = re.compile(r"^[0-9a-f]{64}$")
    if not isinstance(conformance.get("fixtureSha256"), str) or sha256_pattern.fullmatch(conformance.get("fixtureSha256", "")) is None \
            or not isinstance(protocol_artifact.get("contentSha256"), str) or sha256_pattern.fullmatch(protocol_artifact.get("contentSha256", "")) is None:
        return invalid("INVALID_CLAIM")
    if not isinstance(conformance.get("suites"), list) or len(conformance.get("suites", [])) == 0:
        return invalid("INVALID_CLAIM")
    if len(claim["evidence"]) == 0:
        return invalid("INVALID_CLAIM")
    if not isinstance(claim["host"].get("buildId"), str) or len(claim["host"].get("buildId", "")) == 0:
        return invalid("INVALID_CLAIM")

    if claim.get("claimVersion") != "1.0":
        return invalid("UNKNOWN_CLAIM_VERSION")
    if registry is None:
        return invalid("INVALID_CLAIM")

    registry_capabilities = registry["capabilities"]
    listed_versions = page_versions + manifest_versions
    for capability in capabilities:
        entry = registry_capabilities.get(capability)
        if entry is None:
            return invalid("UNKNOWN_CLAIM_CAPABILITY")
        if entry.get("removedIn") is not None:
            for version in listed_versions:
                if compare_version(entry["removedIn"], version) <= 0:
                    return invalid("UNKNOWN_CLAIM_CAPABILITY")

    listed = set(capabilities)
    for capability in capabilities:
        pending = list(registry_capabilities[capability].get("dependsOn", []))
        while pending:
            dependency = pending.pop()
            if dependency not in listed:
                return invalid("INCOMPLETE_CAPABILITY_DEPENDENCY")
            dependency_entry = registry_capabilities.get(dependency)
            if dependency_entry is not None and isinstance(dependency_entry.get("dependsOn"), list):
                pending.extend(dependency_entry["dependsOn"])

    if protocol_artifact.get("contentSha256") != artifact_content_sha256:
        return invalid("CLAIM_ARTIFACT_MISMATCH")
    if conformance.get("fixtureVersion") != "1.0" or conformance.get("fixtureSha256") != fixture_sha256:
        return invalid("CLAIM_FIXTURE_MISMATCH")

    suite_results = {suite.get("suiteId"): suite for suite in conformance["suites"]}
    for capability in capabilities:
        for suite_id in registry_capabilities[capability].get("mandatorySuites", []):
            suite = suite_results.get(suite_id)
            if suite is None or suite.get("result") != "pass":
                return invalid("CLAIM_SUITE_INCOMPLETE")

    for evidence in claim["evidence"]:
        if not _is_object(evidence) or evidence.get("subjectBuildId") != claim["host"]["buildId"]:
            return invalid("CLAIM_EVIDENCE_BUILD_MISMATCH")

    for index in range(len(claim["evidence"])):
        state = evidence_states[index] if index < len(evidence_states) else "verifiable"
        if state == "unverifiable":
            return invalid("CLAIM_EVIDENCE_UNVERIFIABLE")

    return invalid("CLAIM_OK")


def execute(input_value):
    """Fixture dispatch facade: operation selects the semantic entry point."""
    input_value = input_value if _is_object(input_value) else {}
    operation = input_value.get("operation")
    if operation == "canonicalize":
        return {"canonical": canonicalize(input_value.get("value"))}
    if operation == "claimDigest":
        return {"digest": claim_digest(input_value.get("claim"))}
    if operation == "validateRegistry":
        return validate_registry(input_value.get("registry"))
    if operation == "validateClaim":
        return validate_claim(input_value.get("claim"), input_value.get("options"))
    raise ValueError("Unknown operation: %s" % operation)
