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
    return {"ok": False, "code": "INVALID_RUNTIME_DEFAULT_INPUT"}
