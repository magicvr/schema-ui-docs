import math
import re
from urllib.parse import quote

from query_serialization import jcs_number, serialize_query


ROW_REFERENCE = re.compile(r"^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$")
PROTOCOL_RELATIVE_URL = re.compile(r"^/(?!/)[^\s\\]*$")
RESERVED_ROW_PATH_SEGMENTS = {"__proto__", "prototype", "constructor"}
INVOCATION_ID = re.compile(r"^[\x21-\x7e]{1,200}$")


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
            return False, None
        current = current[segment]
    return True, current


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


def resolve_mapping(mapping, row, section):
    output = []
    for key, configured_value in (mapping or {}).items():
        row_reference = ROW_REFERENCE.fullmatch(configured_value) if isinstance(configured_value, str) else None
        if row_reference and any(segment in RESERVED_ROW_PATH_SEGMENTS for segment in row_reference.group(1).split(".")):
            return failure("UNSAFE_ROW_PATH", f"requestMapping.{section}.{key}")
        found, value = resolve_row_value(configured_value, row)
        if not found:
            return failure("UNRESOLVED_ROW_VALUE", f"requestMapping.{section}.{key}")
        if section != "query" or value is not None:
            if not is_scalar(value):
                return failure("INVALID_ROW_VALUE", f"requestMapping.{section}.{key}")
        output.append([key, value])
    return {"ok": True, "entries": output}


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
    return {
        "ok": True,
        "request": {
            "method": data_ref.get("method", "GET"),
            "url": serialized["url"],
            "body": None,
        },
    }


def build_row_action_request(input_value):
    url_error = validate_protocol_url(input_value["action"]["url"], "action.url")
    if url_error:
        return url_error
    mapping = input_value.get("requestMapping") or {}
    path_values = resolve_mapping(mapping.get("path"), input_value["row"], "path")
    if not path_values["ok"]:
        return path_values
    query_values = resolve_mapping(mapping.get("query"), input_value["row"], "query")
    if not query_values["ok"]:
        return query_values
    body_values = resolve_mapping(mapping.get("body"), input_value["row"], "body")
    if not body_values["ok"]:
        return body_values

    url = input_value["action"]["url"]
    for key, value in path_values["entries"]:
        if value is None:
            return failure("NULL_PATH_VALUE", f"requestMapping.path.{key}")
        encoded = encode_path_value(value)
        if encoded is None:
            return failure("INVALID_PATH_VALUE", f"requestMapping.path.{key}")
        url = url.replace(f"{{{key}}}", encoded)

    serialized = serialize_query(url, [query_values["entries"]])
    if not serialized["ok"]:
        return serialized
    metadata = request_metadata(input_value["action"], input_value.get("invocationId"))
    if not metadata["ok"]:
        return metadata
    body = dict(body_values["entries"]) if body_values["entries"] else None
    request = add_request_metadata({
        "method": input_value["action"].get("method", "GET"),
        "url": serialized["url"],
        "body": body,
    }, metadata)
    return {
        "ok": True,
        "request": request,
    }


def build_form_action_request(input_value):
    action = input_value["action"]
    url_error = validate_protocol_url(action["url"], "action.url")
    if url_error:
        return url_error
    if action.get("bodyMapping") is not None:
        body = {
            target: input_value["formValues"].get(source)
            for source, target in action["bodyMapping"].items()
        }
    else:
        body = dict(input_value["formValues"])
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
    if input_value.get("kind") == "formAction":
        return build_form_action_request(input_value)
    return failure("INVALID_REQUEST_KIND", "kind")
