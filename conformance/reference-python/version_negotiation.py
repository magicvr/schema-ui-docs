import re


VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")
CAPABILITY_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$")


def is_unique_string_list(value, pattern, allow_empty):
    return (
        isinstance(value, list)
        and (allow_empty or len(value) > 0)
        and all(isinstance(item, str) and pattern.fullmatch(item) for item in value)
        and len(set(value)) == len(value)
    )


def build_result(accepted, code, page_version, supported_versions, missing_capabilities=None):
    return {
        "accepted": accepted,
        "code": code,
        "pageVersion": page_version,
        "supportedVersions": supported_versions,
        "missingCapabilities": missing_capabilities or [],
    }


def negotiate_protocol(page_meta, renderer_support):
    page_meta = page_meta if isinstance(page_meta, dict) else {}
    renderer_support = renderer_support if isinstance(renderer_support, dict) else {}
    page_version = page_meta.get("protocolVersion") if isinstance(page_meta.get("protocolVersion"), str) else None
    configured_versions = renderer_support.get("supportedVersions")
    supported_versions = list(configured_versions) if isinstance(configured_versions, list) else []

    if page_version is None:
        return build_result(False, "MISSING_PROTOCOL_VERSION", None, supported_versions)
    if VERSION_PATTERN.fullmatch(page_version) is None:
        return build_result(False, "INVALID_PROTOCOL_VERSION", page_version, supported_versions)
    if not is_unique_string_list(configured_versions, VERSION_PATTERN, False):
        return build_result(False, "INVALID_RENDERER_SUPPORT", page_version, supported_versions)
    if page_version not in supported_versions:
        return build_result(False, "UNSUPPORTED_PROTOCOL_VERSION", page_version, supported_versions)

    required_capabilities = page_meta.get("requiredCapabilities")
    if required_capabilities is None:
        required_capabilities = []
    if not is_unique_string_list(required_capabilities, CAPABILITY_PATTERN, True):
        return build_result(False, "INVALID_REQUIRED_CAPABILITIES", page_version, supported_versions)

    supported_capabilities = renderer_support.get("supportedCapabilities")
    if supported_capabilities is None:
        supported_capabilities = []
    if not is_unique_string_list(supported_capabilities, CAPABILITY_PATTERN, True):
        return build_result(False, "INVALID_RENDERER_SUPPORT", page_version, supported_versions)

    supported_set = set(supported_capabilities)
    missing_capabilities = [
        capability
        for capability in required_capabilities
        if capability not in supported_set
    ]
    if missing_capabilities:
        return build_result(
            False,
            "MISSING_REQUIRED_CAPABILITY",
            page_version,
            supported_versions,
            missing_capabilities,
        )
    return build_result(True, "OK", page_version, supported_versions)