import math


def validate_component_format(input_value):
    format_value = input_value["format"]
    value = input_value.get("value")
    if format_value in ("currency", "percent"):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return {"ok": False, "code": "COMPONENT_DATA_TYPE_MISMATCH"}
    elif format_value == "datetime" and not isinstance(value, str):
        return {"ok": False, "code": "COMPONENT_DATA_TYPE_MISMATCH"}
    return {"ok": True, "value": value}
