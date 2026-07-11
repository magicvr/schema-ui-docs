import re
from urllib.parse import quote

from query_serialization import jcs_number, serialize_query


ROW_REFERENCE = re.compile(r"^\$row\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$")


def failure(code, path):
    return {"ok": False, "code": code, "path": path}


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
        found, value = resolve_row_value(configured_value, row)
        if not found:
            return failure("UNRESOLVED_ROW_VALUE", f"requestMapping.{section}.{key}")
        output.append([key, value])
    return {"ok": True, "entries": output}


def build_data_ref_request(data_ref):
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
    body = dict(body_values["entries"]) if body_values["entries"] else None
    return {
        "ok": True,
        "request": {
            "method": input_value["action"].get("method", "GET"),
            "url": serialized["url"],
            "body": body,
        },
    }


def build_request(input_value):
    if input_value.get("kind") == "dataRef":
        return build_data_ref_request(input_value["dataRef"])
    if input_value.get("kind") == "rowAction":
        return build_row_action_request(input_value)
    return failure("INVALID_REQUEST_KIND", "kind")