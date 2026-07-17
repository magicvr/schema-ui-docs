def failure(code):
    return {"ok": False, "code": code}


def resolve_static_value(input_value):
    data = input_value["data"]
    if data["source"] == "static":
        return {"ok": True, "value": data["value"]}
    if data["source"] != "ref":
        return failure("STATIC_DATA_REF_INVALID")
    target = input_value.get("datasources", {}).get(data.get("ref"))
    if not isinstance(target, dict) or target.get("source") != "static":
        return failure("STATIC_DATA_REF_INVALID")
    if "responseMapping" in data or "responseMapping" in target:
        return failure("STATIC_RESPONSE_MAPPING_NOT_ALLOWED")
    return {"ok": True, "value": target.get("value")}


def resolve_static_data(input_value):
    if "responseMapping" in input_value["data"]:
        return failure("STATIC_RESPONSE_MAPPING_NOT_ALLOWED")
    resolved = resolve_static_value(input_value)
    if not resolved["ok"]:
        return resolved
    value = resolved["value"]
    component = input_value["component"]
    if component in ("table", "chart") and not isinstance(value, list):
        return failure("STATIC_DATA_SHAPE_MISMATCH")
    value_field = input_value.get("props", {}).get("valueField")
    if component in ("statCard", "text"):
        if value is None or isinstance(value, list) or not isinstance(value, (dict, str, int, float, bool)):
            return failure("STATIC_DATA_SHAPE_MISMATCH")
        if value_field:
            if not isinstance(value, dict) or value_field not in value:
                return failure("STATIC_DATA_SHAPE_MISMATCH")
            return {"ok": True, "value": value[value_field], "network": False}
    return {"ok": True, "value": value, "network": False}
