def _empty_for_wire(wire):
    if wire == "boolean":
        return False
    if wire == "array":
        return []
    if wire == "number":
        return None
    return ""


def _init_form_field_values(input_value):
    """ADR-0033: S0 empty → S1 defaultValue → S2 recordValues → S3 reactionWrites."""
    fields = input_value.get("fields")
    if not isinstance(fields, list):
        return {"ok": False, "code": "INVALID_RUNTIME_DEFAULT_INPUT"}
    values = {}
    for field_def in fields:
        if not isinstance(field_def, dict) or not isinstance(field_def.get("field"), str) or len(field_def["field"]) == 0:
            return {"ok": False, "code": "INVALID_RUNTIME_DEFAULT_INPUT"}
        wire = field_def.get("wire") or "string"
        name = field_def["field"]
        values[name] = _empty_for_wire(wire)
        if "defaultValue" in field_def:
            values[name] = field_def["defaultValue"]
    record_values = input_value.get("recordValues")
    if isinstance(record_values, dict):
        for key, value in record_values.items():
            if key in values:
                values[key] = value
    reaction_writes = input_value.get("reactionWrites")
    if isinstance(reaction_writes, list):
        for write in reaction_writes:
            if not isinstance(write, dict):
                continue
            field = write.get("field")
            if isinstance(field, str) and field in values:
                values[field] = write.get("value")
    return {"ok": True, "values": values}


def validate_runtime_defaults(input_value):
    kind = input_value["kind"]
    if kind == "requestConfig":
        if input_value.get("requiresNetwork") is True and not isinstance(input_value.get("baseURL"), str):
            return {"ok": False, "code": "MISSING_BASE_URL"}
        if input_value.get("requiresNetwork") is True and len(input_value["baseURL"].strip()) == 0:
            return {"ok": False, "code": "MISSING_BASE_URL"}
        return {"ok": True}
    if kind == "component":
        if input_value["type"] not in input_value.get("installedTypes", []):
            return {"ok": False, "code": "UNKNOWN_COMPONENT_TYPE"}
        props = input_value.get("props", {})
        for required_prop in input_value.get("requiredProps", []):
            if required_prop not in props:
                return {"ok": False, "code": "INVALID_COMPONENT", "path": f"props.{required_prop}"}
        return {"ok": True}
    if kind == "defaults":
        value = dict(input_value.get("value", {}))
        if input_value["target"] == "dataRef":
            value.setdefault("method", "GET")
            return {"ok": True, "value": value}
        if input_value["target"] == "uploadAction":
            value.setdefault("method", "POST")
            value.setdefault("retryPolicy", "never")
            value.setdefault("fieldName", "file")
            value.setdefault("multiple", False)
            return {"ok": True, "value": value}
    if kind == "formFieldInit":
        return _init_form_field_values(input_value)
    return {"ok": False, "code": "INVALID_RUNTIME_DEFAULT_INPUT"}
