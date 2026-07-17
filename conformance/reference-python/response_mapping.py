import math


def failure(code, path):
    return {"ok": False, "code": code, "path": path}


def read_path(response, path):
    current = response
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            return False, None
        current = current[segment]
    return True, current


def resolve_mapped_value(response, path):
    found, value = read_path(response, path)
    if not found:
        return failure("RESPONSE_MAPPING_PATH_MISSING", path)
    return {"found": True, "value": value}


def map_response(input_value):
    mapping_is_present = "localMapping" in input_value or "datasourceMapping" in input_value
    mapping = (
        input_value["localMapping"]
        if "localMapping" in input_value
        else input_value.get("datasourceMapping")
    )
    if mapping_is_present and (mapping is None or not isinstance(mapping, dict) or not mapping):
        return failure("INVALID_RESPONSE_MAPPING", "localMapping")
    if input_value["component"] in ("statCard", "text") and mapping is not None:
        return failure("RESPONSE_MAPPING_NOT_SUPPORTED", "localMapping")
    if input_value["component"] == "chart" and mapping is None:
        if isinstance(input_value["response"], list):
            return {"ok": True, "data": {"list": input_value["response"]}}
        return failure("RESPONSE_MAPPING_TYPE_MISMATCH", "$")

    list_path = (mapping or {}).get("list", "list")
    list_value = resolve_mapped_value(input_value["response"], list_path)
    if not list_value.get("found"):
        return list_value
    if not isinstance(list_value["value"], list):
        return failure("RESPONSE_MAPPING_TYPE_MISMATCH", list_path)

    data = {"list": list_value["value"]}
    if input_value["component"] == "table" and input_value.get("paginationMode") == "server":
        total_path = (mapping or {}).get("total", "total")
        total_value = resolve_mapped_value(input_value["response"], total_path)
        if not total_value.get("found"):
            return total_value
        total = total_value["value"]
        if isinstance(total, bool) or not isinstance(total, (int, float)) or not math.isfinite(total):
            return failure("RESPONSE_MAPPING_TYPE_MISMATCH", total_path)
        data["total"] = total
    return {"ok": True, "data": data}