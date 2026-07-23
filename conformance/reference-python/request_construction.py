import math
import re
from urllib.parse import quote

from query_serialization import jcs_number, serialize_query


ROW_REFERENCE = re.compile(r"^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$")
ROUTE_REFERENCE = re.compile(r"^\$context\.route\.(query|params)\.([A-Za-z_][A-Za-z0-9_]*)$")
PROTOCOL_RELATIVE_URL = re.compile(r"^/(?!/)[^\s\\]*$")
RESERVED_ROW_PATH_SEGMENTS = {"__proto__", "prototype", "constructor"}
INVOCATION_ID = re.compile(r"^[\x21-\x7e]{1,200}$")
PAGE_TRIGGER_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_MISSING = object()


def failure(code, path):
    return {"ok": False, "code": code, "path": path}


def validate_protocol_url(url, path):
    if isinstance(url, str) and PROTOCOL_RELATIVE_URL.fullmatch(url):
        return None
    return failure("INVALID_PROTOCOL_URL", path)


def is_scalar(value):
    return (
        value is None
        or isinstance(value, str)
        or isinstance(value, bool)
        or (isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value))
    )


def request_metadata(action, invocation_id):
    retry_policy = action.get("retryPolicy", "never")
    if retry_policy not in ("never", "idempotent"):
        return failure("INVALID_RETRY_POLICY", "action.retryPolicy")
    if retry_policy == "never":
        return {"ok": True, "headers": None}
    if not isinstance(invocation_id, str) or INVOCATION_ID.fullmatch(invocation_id) is None:
        return failure("MISSING_INVOCATION_ID", "invocationId")
    return {"ok": True, "headers": {"Idempotency-Key": invocation_id}}


def add_request_metadata(request, metadata):
    if metadata["headers"] is not None:
        request["headers"] = metadata["headers"]
    return request


def resolve_row_value(value, row):
    if not isinstance(value, str):
        return True, value
    match = ROW_REFERENCE.fullmatch(value)
    if match is None:
        return True, value
    current = row
    for segment in match.group(1).split("."):
        if not isinstance(current, dict) or segment not in current:
            return False, _MISSING
        current = current[segment]
    return True, current


def resolve_route_value(value, route):
    if not isinstance(value, str):
        return True, value
    match = ROUTE_REFERENCE.fullmatch(value)
    if match is None:
        return True, value
    bag = route.get(match.group(1)) if isinstance(route, dict) else None
    if not isinstance(bag, dict) or match.group(2) not in bag:
        return False, _MISSING
    return True, bag[match.group(2)]


def encode_path_value(value):
    if isinstance(value, str):
        text = value
    elif isinstance(value, bool):
        text = "true" if value else "false"
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        text = jcs_number(value)
        if text is None:
            return None
    else:
        return None
    return quote(text, safe="-._~")


def resolve_mapping(mapping, row, section, path_prefix="requestMapping"):
    output = []
    for key, configured_value in (mapping or {}).items():
        field_path = f"{path_prefix}.{section}.{key}"
        if isinstance(configured_value, str) and "$" in configured_value and ROW_REFERENCE.fullmatch(configured_value) is None:
            return failure("INVALID_MAPPING_VALUE", field_path)
        row_reference = ROW_REFERENCE.fullmatch(configured_value) if isinstance(configured_value, str) else None
        if row_reference and any(segment in RESERVED_ROW_PATH_SEGMENTS for segment in row_reference.group(1).split(".")):
            return failure("UNSAFE_ROW_PATH", field_path)
        found, value = resolve_row_value(configured_value, row)
        if not found or value is _MISSING:
            return failure("UNRESOLVED_ROW_VALUE", field_path)
        if not is_scalar(value):
            return failure("INVALID_ROW_VALUE", field_path)
        output.append([key, value])
    return {"ok": True, "entries": output}


def resolve_route_mapping(mapping, route, section):
    output = []
    for key, configured_value in (mapping or {}).items():
        field_path = f"recordSource.{section}.{key}"
        if isinstance(configured_value, str) and "$" in configured_value and ROUTE_REFERENCE.fullmatch(configured_value) is None:
            return failure("INVALID_MAPPING_VALUE", field_path)
        found, value = resolve_route_value(configured_value, route)
        if not found or value is _MISSING:
            return failure("UNRESOLVED_ROUTE_VALUE", field_path)
        if not is_scalar(value):
            return failure("INVALID_ROUTE_VALUE", field_path)
        output.append([key, value])
    return {"ok": True, "entries": output}


def extract_url_path_params(url):
    if not isinstance(url, str):
        return []
    return re.findall(r"\{([A-Za-z_][A-Za-z0-9_]*)\}", url)


def has_invalid_url_template(url):
    if not isinstance(url, str):
        return False
    stripped = re.sub(r"\{[A-Za-z_][A-Za-z0-9_]*\}", "", url)
    return "{" in stripped or "}" in stripped


def apply_path_params(url, path_entries, path_prefix):
    """Fail-closed path application (V267): placeholders and path keys must match exactly."""
    if has_invalid_url_template(url):
        return failure("INVALID_URL_TEMPLATE", path_prefix)
    placeholders = extract_url_path_params(url)
    placeholder_set = set(placeholders)
    mapping_keys = [key for key, _ in path_entries]
    mapping_key_set = set(mapping_keys)

    for placeholder in placeholder_set:
        if placeholder not in mapping_key_set:
            return failure("MISSING_PATH_BINDING", f"{path_prefix}.{placeholder}")
    for key in mapping_keys:
        if key not in placeholder_set:
            return failure("EXTRA_PATH_BINDING", f"{path_prefix}.{key}")

    next_url = url
    for key, value in path_entries:
        if value is None:
            return failure("NULL_PATH_VALUE", f"{path_prefix}.{key}")
        encoded = encode_path_value(value)
        if encoded is None:
            return failure("INVALID_PATH_VALUE", f"{path_prefix}.{key}")
        next_url = next_url.replace(f"{{{key}}}", encoded)
    if "{" in next_url or "}" in next_url:
        return failure("UNRESOLVED_PATH_TEMPLATE", path_prefix)
    return {"ok": True, "url": next_url}


def request_query(url):
    request_part = url.split("#", 1)[0]
    return request_part.split("?", 1)[1] if "?" in request_part else ""


def apply_request_interceptor(request, interceptor):
    if interceptor is None:
        return {"ok": True, "request": request}
    candidate = dict(request)
    candidate.update(interceptor)
    if request["method"] == "GET" and (
        candidate.get("method") != "GET"
        or candidate.get("body") is not None
        or not isinstance(candidate.get("url"), str)
        or request_query(candidate["url"]) != request_query(request["url"])
    ):
        return failure("INTERCEPTOR_VIOLATION", "requestInterceptor")
    return {"ok": True, "request": candidate}



def build_data_ref_request(data_ref):
    if data_ref.get("method", "GET") != "GET":
        return failure("DATA_REF_METHOD_NOT_READ_ONLY", "dataRef.method")
    url_error = validate_protocol_url(data_ref["url"], "dataRef.url")
    if url_error:
        return url_error
    params = [[key, value] for key, value in (data_ref.get("params") or {}).items()]
    serialized = serialize_query(data_ref["url"], [params])
    if not serialized["ok"]:
        return serialized
    request = {
        "method": data_ref.get("method", "GET"),
        "url": serialized["url"],
        "body": None,
    }
    intercepted = apply_request_interceptor(request, data_ref.get("requestInterceptor"))
    if not intercepted["ok"]:
        return intercepted
    return {"ok": True, "request": intercepted["request"]}


def build_row_action_request(input_value):
    action = input_value["action"]
    method = action.get("method", "GET")
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    mapping = input_value.get("requestMapping") or {}
    if method in ("GET", "DELETE") and isinstance(mapping.get("body"), dict) and mapping["body"]:
        return failure("REQUEST_BODY_NOT_ALLOWED", "requestMapping.body")
    path_values = resolve_mapping(mapping.get("path"), input_value["row"], "path")
    if not path_values["ok"]:
        return path_values
    query_values = resolve_mapping(mapping.get("query"), input_value["row"], "query")
    if not query_values["ok"]:
        return query_values
    body_values = resolve_mapping(mapping.get("body"), input_value["row"], "body")
    if not body_values["ok"]:
        return body_values

    with_path = apply_path_params(input_value["action"]["url"], path_values["entries"], "requestMapping.path")
    if not with_path["ok"]:
        return with_path

    serialized = serialize_query(with_path["url"], [query_values["entries"]])
    if not serialized["ok"]:
        return serialized
    metadata = request_metadata(input_value["action"], input_value.get("invocationId"))
    if not metadata["ok"]:
        return metadata
    body = dict(body_values["entries"]) if body_values["entries"] else None
    request = add_request_metadata({
        "method": method,
        "url": serialized["url"],
        "body": body,
    }, metadata)
    return {
        "ok": True,
        "request": request,
    }


def build_row_navigate(input_value):
    action = input_value["action"]
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    mapping = input_value.get("navigateMapping") or {}
    if "body" in mapping:
        return failure("NAVIGATE_BODY_NOT_ALLOWED", "navigateMapping.body")
    has_path = isinstance(mapping.get("path"), dict) and len(mapping["path"]) > 0
    has_query = isinstance(mapping.get("query"), dict) and len(mapping["query"]) > 0
    if not has_path and not has_query:
        return failure("EMPTY_NAVIGATE_MAPPING", "navigateMapping")
    path_values = resolve_mapping(mapping.get("path"), input_value["row"], "path", "navigateMapping")
    if not path_values["ok"]:
        return path_values
    query_values = resolve_mapping(mapping.get("query"), input_value["row"], "query", "navigateMapping")
    if not query_values["ok"]:
        return query_values
    with_path = apply_path_params(action["url"], path_values["entries"], "navigateMapping.path")
    if not with_path["ok"]:
        return with_path
    serialized = serialize_query(with_path["url"], [query_values["entries"]])
    if not serialized["ok"]:
        return serialized
    return {"ok": True, "navigation": {"url": serialized["url"]}}


def build_record_source_request(input_value):
    record_source = input_value.get("recordSource") or {}
    # V270: method is required (matches component DSL / L2); do not default to GET.
    if "method" not in record_source:
        return failure("MISSING_RECORD_SOURCE_METHOD", "recordSource.method")
    method = record_source.get("method")
    if method != "GET":
        return failure("RECORD_SOURCE_METHOD_NOT_GET", "recordSource.method")
    url_error = validate_protocol_url(record_source.get("url"), "recordSource.url")
    if url_error:
        return url_error
    if "ref" in record_source or "source" in record_source:
        return failure("RECORD_SOURCE_REF_NOT_ALLOWED", "recordSource")
    response_mapping = record_source.get("responseMapping")
    if not isinstance(response_mapping, dict) or len(response_mapping) == 0:
        return failure("EMPTY_RESPONSE_MAPPING", "recordSource.responseMapping")
    for field, path_expr in response_mapping.items():
        if not isinstance(field, str) or not field or not isinstance(path_expr, str) or not path_expr:
            return failure("INVALID_RESPONSE_MAPPING", f"recordSource.responseMapping.{field}")
    path_values = resolve_route_mapping(record_source.get("path"), input_value.get("route"), "path")
    if not path_values["ok"]:
        return path_values
    query_values = resolve_route_mapping(record_source.get("query"), input_value.get("route"), "query")
    if not query_values["ok"]:
        return query_values
    with_path = apply_path_params(record_source["url"], path_values["entries"], "recordSource.path")
    if not with_path["ok"]:
        return with_path
    serialized = serialize_query(with_path["url"], [query_values["entries"]])
    if not serialized["ok"]:
        return serialized
    return {
        "ok": True,
        "request": {
            "method": "GET",
            "url": serialized["url"],
            "body": None,
        },
    }


def apply_confirm_gate(input_value):
    """Shared confirm gate for page-level ActionTrigger (V272 / ADR-0020 D4)."""
    confirm = input_value.get("confirm")
    if confirm is None or confirm == "":
        return None
    if not isinstance(confirm, str):
        return failure("INVALID_CONFIRM", "confirm")
    if input_value.get("confirmAccepted") is not True:
        return failure("CONFIRM_REJECTED", "confirm")
    return None


def build_page_trigger_request(input_value):
    confirm_error = apply_confirm_gate(input_value)
    if confirm_error:
        return confirm_error
    action = input_value["action"]
    method = action.get("method")
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    if method not in PAGE_TRIGGER_METHODS:
        return failure("PAGE_TRIGGER_METHOD_NOT_ALLOWED", "action.method")
    if "{" in action["url"] or "}" in action["url"]:
        return failure("UNBOUND_URL_TEMPLATE", "action.url")
    serialized = serialize_query(action["url"], [])
    if not serialized["ok"]:
        return serialized
    metadata = request_metadata(action, input_value.get("invocationId"))
    if not metadata["ok"]:
        return metadata
    request = add_request_metadata({
        "method": method,
        "url": serialized["url"],
        "body": None,
    }, metadata)
    return {"ok": True, "request": request}


def build_page_trigger_navigate(input_value):
    confirm_error = apply_confirm_gate(input_value)
    if confirm_error:
        return confirm_error
    action = input_value["action"]
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    if "{" in action["url"] or "}" in action["url"]:
        return failure("UNBOUND_URL_TEMPLATE", "action.url")
    serialized = serialize_query(action["url"], [])
    if not serialized["ok"]:
        return serialized
    return {"ok": True, "navigation": {"url": serialized["url"]}}


def build_page_trigger_modal(input_value):
    confirm_error = apply_confirm_gate(input_value)
    if confirm_error:
        return confirm_error
    action = input_value.get("action") or {}
    if "modalId" not in action and "content" not in action:
        return failure("INVALID_MODAL_ACTION", "action")
    modal = {}
    if "modalId" in action:
        modal["modalId"] = action["modalId"]
    if "content" in action:
        modal["hasContent"] = True
    return {"ok": True, "modalOpen": modal}


def resolve_batch_mapping_value(configured_value, selection, field_path):
    if configured_value == "$selection.keys":
        return {"ok": True, "value": list(selection.get("keys") or [])}
    if configured_value == "$selection.count":
        return {"ok": True, "value": selection.get("count", 0)}
    if isinstance(configured_value, str) and "$" in configured_value:
        return failure("INVALID_MAPPING_VALUE", field_path)
    if not is_scalar(configured_value):
        return failure("INVALID_MAPPING_VALUE", field_path)
    return {"ok": True, "value": configured_value}


def resolve_batch_section(mapping_section, selection, section_name):
    output = []
    for key, configured_value in (mapping_section or {}).items():
        field_path = f"batchMapping.{section_name}.{key}"
        if configured_value == "$selection.keys" and section_name != "body":
            return failure("SELECTION_KEYS_BODY_ONLY", field_path)
        if configured_value == "$selection.count" and section_name == "path":
            return failure("INVALID_MAPPING_VALUE", field_path)
        resolved = resolve_batch_mapping_value(configured_value, selection, field_path)
        if not resolved["ok"]:
            return resolved
        output.append([key, resolved["value"]])
    return {"ok": True, "entries": output}


def build_batch_request(input_value):
    confirm_error = apply_confirm_gate(input_value)
    if confirm_error:
        return confirm_error
    keys = list((input_value.get("selection") or {}).get("keys") or [])
    count = (input_value.get("selection") or {}).get("count", len(keys))
    selection = {"keys": keys, "count": count}
    if len(keys) == 0 or count == 0:
        return failure("EMPTY_SELECTION", "selection")
    action = input_value["action"]
    method = action.get("method")
    if method not in PAGE_TRIGGER_METHODS:
        return failure("PAGE_TRIGGER_METHOD_NOT_ALLOWED", "action.method")
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    mapping = input_value.get("batchMapping") or {}
    path_values = resolve_batch_section(mapping.get("path"), selection, "path")
    if not path_values["ok"]:
        return path_values
    query_values = resolve_batch_section(mapping.get("query"), selection, "query")
    if not query_values["ok"]:
        return query_values
    body_values = resolve_batch_section(mapping.get("body"), selection, "body")
    if not body_values["ok"]:
        return body_values
    with_path = apply_path_params(action["url"], path_values["entries"], "batchMapping.path")
    if not with_path["ok"]:
        return with_path
    serialized = serialize_query(with_path["url"], [query_values["entries"]])
    if not serialized["ok"]:
        return serialized
    metadata = request_metadata(action, input_value.get("invocationId"))
    if not metadata["ok"]:
        return metadata
    body = dict(body_values["entries"]) if body_values["entries"] else None
    request = add_request_metadata({
        "method": method,
        "url": serialized["url"],
        "body": body,
    }, metadata)
    return {
        "ok": True,
        "request": request,
        "selectionAfterSuccessReload": {"keys": [], "count": 0},
    }


def build_form_action_request(input_value):
    action = input_value["action"]
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    if action["method"] == "GET":
        return failure("FORM_GET_NOT_ALLOWED", "action.method")
    if "{" in action["url"] or "}" in action["url"]:
        return failure("UNBOUND_URL_TEMPLATE", "action.url")
    form_values = input_value.get("formValues") or {}
    form_projection = input_value.get("formProjection")
    if form_projection is None:
        effective_values = form_values
    else:
        effective_values = {
            name: field["value"]
            for name, field in form_projection.items()
            if isinstance(field, dict)
            and field.get("mounted", True)
            and field.get("visible", True)
            and not field.get("disabled", False)
            and field.get("uploadStatus") != "error"
            and "value" in field
        }
    if action.get("bodyMapping") is not None:
        body = {}
        for source, target in action["bodyMapping"].items():
            if source not in effective_values or effective_values[source] is _MISSING:
                return failure("UNRESOLVED_FORM_VALUE", f"bodyMapping.{source}")
            body[target] = effective_values[source]
    else:
        body = dict(effective_values)
    serialized = serialize_query(action["url"], [])
    if not serialized["ok"]:
        return serialized
    metadata = request_metadata(action, input_value.get("invocationId"))
    if not metadata["ok"]:
        return metadata
    request = add_request_metadata({
        "method": action["method"],
        "url": serialized["url"],
        "body": body,
    }, metadata)
    return {
        "ok": True,
        "request": request,
    }


def build_request(input_value):
    if input_value.get("kind") == "dataRef":
        return build_data_ref_request(input_value["dataRef"])
    if input_value.get("kind") == "rowAction":
        return build_row_action_request(input_value)
    if input_value.get("kind") == "rowNavigate":
        return build_row_navigate(input_value)
    if input_value.get("kind") == "recordSource":
        return build_record_source_request(input_value)
    if input_value.get("kind") == "pageTriggerRequest":
        return build_page_trigger_request(input_value)
    if input_value.get("kind") == "pageTriggerNavigate":
        return build_page_trigger_navigate(input_value)
    if input_value.get("kind") == "pageTriggerModal":
        return build_page_trigger_modal(input_value)
    if input_value.get("kind") == "batchRequest":
        return build_batch_request(input_value)
    if input_value.get("kind") == "formAction":
        return build_form_action_request(input_value)
    return failure("INVALID_REQUEST_KIND", "kind")
