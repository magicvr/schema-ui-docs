"""
Host failure result semantic validator (F1, Python reference).

Implements ADR-0036 / spec 10 §3. Outputs are deterministic and
byte-comparable with the JavaScript reference (host-failure.js).
"""

import re
from datetime import datetime, timezone

KIND_HOST_CODE = {
    "maintenance": "HOST_MAINTENANCE",
    "upgrade-required": "HOST_UPGRADE_REQUIRED",
    "authentication-required": "HOST_AUTH_REQUIRED",
    "reauth-required": "HOST_REAUTH_REQUIRED",
    "account-locked": "HOST_ACCOUNT_LOCKED",
    "forbidden": "HOST_FORBIDDEN",
    "not-found": "HOST_ROUTE_NOT_FOUND",
    "rate-limited": "HOST_RATE_LIMITED",
    "timeout": "HOST_TIMEOUT",
    "offline": "HOST_OFFLINE",
    "protocol-rejected": "HOST_PROTOCOL_REJECTED",
    "render-failed": "HOST_RENDER_FAILED",
    "unavailable": "HOST_UNAVAILABLE",
}

SCOPE_KINDS = {
    "bootstrap": ["maintenance", "upgrade-required", "rate-limited", "timeout", "offline", "unavailable", "protocol-rejected"],
    "manifest": ["protocol-rejected", "rate-limited", "timeout", "offline", "unavailable", "authentication-required", "reauth-required", "forbidden"],
    "page": ["protocol-rejected", "rate-limited", "timeout", "offline", "unavailable", "authentication-required", "reauth-required", "forbidden"],
    "auth": ["authentication-required", "reauth-required", "account-locked", "forbidden"],
    "route": ["not-found"],
    "runtime": ["render-failed"],
}

PERMANENT_REJECTED_QUERY_KEYS = {
    "token", "access_token", "id_token", "code", "state", "session", "redirect", "returnto",
}
PROTOCOL_RETURN_INTENT_ALLOWLIST = ["tab", "view", "page", "pageSize", "sort"]
RETURN_INTENT_KEY_PATTERN = re.compile(r"^[a-z][a-zA-Z0-9_]*$")
HTML_PATTERN = re.compile(r"</?[a-zA-Z]")
RFC3339_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")


def _is_object(value):
    return isinstance(value, dict)


def classify_host_fetch(input_value):
    """Host-level fetch classification (spec 10 §2.7 priority 1-2)."""
    input_value = input_value if _is_object(input_value) else {}
    scope = input_value.get("scope")
    status = input_value.get("status")
    auth_state = input_value.get("authState")
    transport = input_value.get("transport")
    if scope not in ("bootstrap", "manifest", "page"):
        return None
    if status == 403:
        return {"scope": scope, "kind": "forbidden", "hostCode": "HOST_FORBIDDEN"}
    if status == 401:
        if auth_state == "authenticated":
            return {"scope": scope, "kind": "reauth-required", "hostCode": "HOST_REAUTH_REQUIRED"}
        return {"scope": scope, "kind": "authentication-required", "hostCode": "HOST_AUTH_REQUIRED"}
    if status == 426:
        return {"scope": scope, "kind": "upgrade-required", "hostCode": "HOST_UPGRADE_REQUIRED"}
    if status == 429:
        return {"scope": scope, "kind": "rate-limited", "hostCode": "HOST_RATE_LIMITED"}
    if transport == "timeout":
        return {"scope": scope, "kind": "timeout", "hostCode": "HOST_TIMEOUT"}
    if transport == "offline":
        return {"scope": scope, "kind": "offline", "hostCode": "HOST_OFFLINE"}
    if isinstance(status, int) and 500 <= status <= 599:
        return {"scope": scope, "kind": "unavailable", "hostCode": "HOST_UNAVAILABLE"}
    return None


def map_bootstrap_result(input_value):
    """Bootstrap stable result → Host failure triple (ADR-0035 D7 / spec 10 §2.7)."""
    input_value = input_value if _is_object(input_value) else {}
    result = input_value.get("result")
    fetch_classification = input_value.get("fetchClassification")
    by_result = {
        "MAINTENANCE": {"scope": "bootstrap", "kind": "maintenance", "hostCode": "HOST_MAINTENANCE"},
        "UPGRADE_REQUIRED": {"scope": "bootstrap", "kind": "upgrade-required", "hostCode": "HOST_UPGRADE_REQUIRED"},
        "REAUTH_REQUIRED": {"scope": "auth", "kind": "reauth-required", "hostCode": "HOST_REAUTH_REQUIRED"},
        "ACCOUNT_LOCKED": {"scope": "auth", "kind": "account-locked", "hostCode": "HOST_ACCOUNT_LOCKED"},
        "BOOTSTRAP_NEGOTIATION_REJECTED": {"scope": "bootstrap", "kind": "protocol-rejected", "hostCode": "HOST_PROTOCOL_REJECTED"},
        "MANIFEST_CAPABILITY_REJECTED": {"scope": "manifest", "kind": "protocol-rejected", "hostCode": "HOST_PROTOCOL_REJECTED"},
        "MANIFEST_INTEGRITY_FAILED": {"scope": "manifest", "kind": "protocol-rejected", "hostCode": "HOST_PROTOCOL_REJECTED"},
    }
    if result in by_result:
        return by_result[result]
    if result == "BOOTSTRAP_DOCUMENT_FAILED":
        by_classification = {
            "rate-limited": {"scope": "bootstrap", "kind": "rate-limited", "hostCode": "HOST_RATE_LIMITED"},
            "timeout": {"scope": "bootstrap", "kind": "timeout", "hostCode": "HOST_TIMEOUT"},
            "offline": {"scope": "bootstrap", "kind": "offline", "hostCode": "HOST_OFFLINE"},
            "unavailable": {"scope": "bootstrap", "kind": "unavailable", "hostCode": "HOST_UNAVAILABLE"},
            "protocol": {"scope": "bootstrap", "kind": "protocol-rejected", "hostCode": "HOST_PROTOCOL_REJECTED"},
        }
        if fetch_classification in by_classification:
            return by_classification[fetch_classification]
    return None


def validate_failure(failure):
    """Validates a produced failure result against the semantic invariants."""
    errors = []
    if not _is_object(failure):
        return {"valid": False, "errors": ["failure must be an object"]}

    pair = KIND_HOST_CODE.get(failure.get("kind"))
    if pair is None:
        errors.append("unknown kind")
    elif failure.get("hostCode") != pair:
        errors.append(
            "hostCode %s does not match kind %s (expected %s)"
            % (failure.get("hostCode"), failure.get("kind"), pair)
        )

    allowed_kinds = SCOPE_KINDS.get(failure.get("scope"))
    if allowed_kinds is None:
        errors.append("unknown scope %s" % failure.get("scope"))
    elif pair is not None and failure.get("kind") not in allowed_kinds:
        errors.append("kind %s is not valid in scope %s" % (failure.get("kind"), failure.get("scope")))

    retry = failure.get("retry")
    if retry is not None:
        if retry.get("mode") == "after" and not isinstance(retry.get("afterSeconds"), int):
            errors.append("retry mode after requires positive integer afterSeconds")
        if failure.get("kind") == "render-failed" and retry.get("mode") == "after":
            errors.append("render-failed must not auto-loop reload (retry mode after forbidden)")

    message = failure.get("message")
    if not _is_object(message) or not isinstance(message.get("messageKey"), str) or len(message.get("messageKey", "")) == 0:
        errors.append("message.messageKey is required")
    elif _is_object(message.get("params")):
        for value in message.get("params", {}).values():
            if isinstance(value, str) and HTML_PATTERN.search(value):
                errors.append("message.params must not contain HTML")

    actions = failure.get("recoveryActions") if isinstance(failure.get("recoveryActions"), list) else []
    for action in actions:
        if not _is_object(action):
            continue
        if failure.get("kind") == "forbidden" and action.get("type") == "reauth":
            errors.append("forbidden must not offer reauth")
        if failure.get("kind") == "account-locked":
            if action.get("type") == "reauth":
                errors.append("account-locked must not offer reauth")
            if action.get("type") not in ("home", "support"):
                errors.append("account-locked only allows home/support recovery actions")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_return_intent(intent, options=None):
    """Validates a recoverable auth return intent (ADR-0036 D6 / spec 10 §3.7)."""
    options = options if _is_object(options) else {}
    registered_keys = options.get("registeredKeys") if isinstance(options.get("registeredKeys"), list) else []
    now_iso = options.get("nowIso")
    errors = []
    rejected_keys = []
    dropped_keys = []
    kept_query = {}

    if not _is_object(intent):
        return {"valid": False, "keptQuery": kept_query, "droppedKeys": dropped_keys,
                "rejectedKeys": rejected_keys, "reason": "intent must be an object"}

    path = intent.get("path")
    if not isinstance(path, str) or not path.startswith("/") or "#" in path or "://" in path or "\\" in path:
        errors.append("path must be an absolute in-app path without scheme, authority, fragment or backslash")
    if not isinstance(intent.get("nonce"), str) or len(intent.get("nonce", "")) == 0:
        errors.append("nonce is required")
    expires_at = intent.get("expiresAt")
    if not isinstance(expires_at, str) or RFC3339_PATTERN.fullmatch(expires_at) is None:
        errors.append("expiresAt must be RFC 3339 UTC")
    elif now_iso:
        expires_value = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        now_value = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        if expires_value.timestamp() <= now_value.timestamp():
            errors.append("intent has expired")

    host_extensions = [
        key for key in registered_keys if RETURN_INTENT_KEY_PATTERN.fullmatch(key)
    ]
    allowlist = set(PROTOCOL_RETURN_INTENT_ALLOWLIST + host_extensions)

    query = intent.get("query") if _is_object(intent.get("query")) else None
    if query is not None:
        for key, value in query.items():
            if not isinstance(value, str):
                errors.append("query value for %s must be a string" % key)
                continue
            lowered = key.lower()
            if lowered in PERMANENT_REJECTED_QUERY_KEYS:
                rejected_keys.append(key)
                continue
            if key not in allowlist:
                dropped_keys.append(key)
                continue
            kept_query[key] = value

    return {
        "valid": len(errors) == 0,
        "keptQuery": kept_query,
        "droppedKeys": dropped_keys,
        "rejectedKeys": rejected_keys,
        "reason": "; ".join(errors) if errors else None,
    }


def execute(input_value):
    """Fixture dispatch facade: operation selects the semantic entry point."""
    input_value = input_value if _is_object(input_value) else {}
    operation = input_value.get("operation")
    if operation == "classify":
        return classify_host_fetch(input_value)
    if operation == "mapBootstrapResult":
        return map_bootstrap_result(input_value)
    if operation == "validateFailure":
        return validate_failure(input_value.get("failure"))
    if operation == "validateReturnIntent":
        return validate_return_intent(input_value.get("intent"), input_value.get("options"))
    raise ValueError("Unknown operation: %s" % operation)
