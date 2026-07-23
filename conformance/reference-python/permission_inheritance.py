CASCADE_TYPES = {"section", "grid", "form", "tabs", "table"}
CASCADE_KEYS = {"edit", "delete"}
EDITABLE_FORM_TYPES = {"input", "inputNumber", "datePicker", "dateRangePicker", "select", "upload"}


def is_object(value):
    return isinstance(value, dict)


def has_own(value, key):
    return is_object(value) and key in value


def version_at_least(version, floor):
    try:
        major, minor = [int(part) for part in version.split(".")]
        floor_major, floor_minor = [int(part) for part in floor.split(".")]
    except (AttributeError, ValueError):
        return False
    return major > floor_major or (major == floor_major and minor >= floor_minor)


def has_inheritance_fields(page):
    found = False

    def scan_node(node):
        nonlocal found
        if not is_object(node):
            return
        if has_own(node, "permissionCascade") or has_own(node, "permissionIntent"):
            found = True
        props = node.get("props") if is_object(node.get("props")) else {}
        if has_own(props, "permissionIntent"):
            found = True
        if node.get("type") == "table":
            for collection in ("columns", "actions", "toolbar"):
                for entry in props.get(collection, []) if isinstance(props.get(collection), list) else []:
                    if has_own(entry, "permissionCascade") or has_own(entry, "permissionIntent"):
                        found = True
        for child in node.get("children", []) if isinstance(node.get("children"), list) else []:
            scan_node(child)
        for item in props.get("items", []) if isinstance(props.get("items"), list) else []:
            scan_node(item.get("content") if is_object(item) else None)

    scan_node(page.get("body") if is_object(page) else None)
    actions = page.get("actions", {}) if is_object(page) and is_object(page.get("actions")) else {}
    for action in actions.values():
        if has_own(action, "permissionCascade") or has_own(action, "permissionIntent"):
            found = True
        if is_object(action) and action.get("type") == "modal":
            scan_node(action.get("content"))
    return found


def validate_permission_inheritance(page):
    errors = []

    def add(code, path):
        errors.append({"code": code, "path": path})

    if has_inheritance_fields(page):
        meta = page.get("meta", {}) if is_object(page) and is_object(page.get("meta")) else {}
        if not version_at_least(meta.get("protocolVersion"), "2.3"):
            add("PROTOCOL_VERSION_TOO_LOW", "meta.protocolVersion")
        if "permissions.inheritance" not in (meta.get("requiredCapabilities") or []):
            add("CAPABILITY_REQUIRED", "meta.requiredCapabilities")

    def validate_intent(entry, path):
        if not has_own(entry, "permissionIntent"):
            return
        if entry["permissionIntent"] not in CASCADE_KEYS:
            add("PERMISSION_INTENT_INVALID", f"{path}.permissionIntent")

    def scan_node(node, node_path):
        if not is_object(node):
            return
        if has_own(node, "permissionCascade"):
            cascade = node["permissionCascade"]
            if node.get("type") not in CASCADE_TYPES:
                add("PERMISSION_CASCADE_TYPE_INVALID", f"{node_path}.permissionCascade")
            valid_keys = is_object(cascade) and isinstance(cascade.get("keys"), list) and cascade["keys"] \
                and len(set(cascade["keys"])) == len(cascade["keys"]) \
                and all(key in CASCADE_KEYS for key in cascade["keys"])
            if not valid_keys:
                add("PERMISSION_CASCADE_KEYS_INVALID", f"{node_path}.permissionCascade.keys")
            else:
                for key in cascade["keys"]:
                    if not has_own(node.get("permissions"), key):
                        add("PERMISSION_CASCADE_SOURCE_MISSING", f"{node_path}.permissions.{key}")
        if has_own(node, "permissionIntent"):
            add("PERMISSION_INTENT_FORBIDDEN", f"{node_path}.permissionIntent")

        props = node.get("props") if is_object(node.get("props")) else {}
        if node.get("type") == "actionButton":
            validate_intent(props, f"{node_path}.props")
        elif has_own(props, "permissionIntent"):
            add("PERMISSION_INTENT_FORBIDDEN", f"{node_path}.props.permissionIntent")

        if node.get("type") == "table":
            for collection, allowed in (("columns", False), ("actions", True), ("toolbar", True)):
                entries = props.get(collection, []) if isinstance(props.get(collection), list) else []
                for index, entry in enumerate(entries):
                    entry_path = f"{node_path}.props.{collection}[{index}]"
                    if has_own(entry, "permissionCascade"):
                        add("PERMISSION_CASCADE_FORBIDDEN", f"{entry_path}.permissionCascade")
                    if allowed:
                        validate_intent(entry, entry_path)
                    elif has_own(entry, "permissionIntent"):
                        add("PERMISSION_INTENT_FORBIDDEN", f"{entry_path}.permissionIntent")

        for index, child in enumerate(node.get("children", []) if isinstance(node.get("children"), list) else []):
            scan_node(child, f"{node_path}.children[{index}]")
        for index, item in enumerate(props.get("items", []) if isinstance(props.get("items"), list) else []):
            scan_node(item.get("content") if is_object(item) else None, f"{node_path}.props.items[{index}].content")

    scan_node(page.get("body") if is_object(page) else None, "body")
    actions = page.get("actions", {}) if is_object(page) and is_object(page.get("actions")) else {}
    for action_id, action in actions.items():
        if has_own(action, "permissionCascade"):
            add("PERMISSION_CASCADE_FORBIDDEN", f"actions.{action_id}.permissionCascade")
        if has_own(action, "permissionIntent"):
            add("PERMISSION_INTENT_FORBIDDEN", f"actions.{action_id}.permissionIntent")
        if is_object(action) and action.get("type") == "modal":
            scan_node(action.get("content"), f"actions.{action_id}.content")
    return errors


def local_permission(value, key):
    if not key or not is_object(value.get("permissions") if is_object(value) else None) or key not in value["permissions"]:
        return True
    return value["permissions"][key] is True


def first_local_permission_key(value):
    permissions = value.get("permissions") if is_object(value) else None
    if not is_object(permissions):
        return None
    return next(iter(permissions), None)


def node_label(node, fallback):
    return node.get("id") if isinstance(node.get("id"), str) and node["id"] else fallback


def evaluate_page(page, navigated_page):
    targets = []

    def add_target(target_id, kind, value, key, cascades, cascade_eligible):
        applied = [entry for entry in cascades if cascade_eligible and key in CASCADE_KEYS and key in entry["keys"]]
        effective_permission = local_permission(value, key) and all(local_permission(entry["node"], key) for entry in applied)
        targets.append({
            "targetId": target_id,
            "kind": kind,
            "key": key,
            "cascadeApplied": len(applied) > 0,
            "cascadedBy": [entry["label"] for entry in applied],
            "effectivePermission": effective_permission,
        })

    def walk(node, node_path, ancestors, form_mode=None):
        if not is_object(node):
            return
        props = node.get("props") if is_object(node.get("props")) else {}
        own_cascades = ancestors + [{"node": node, "keys": node["permissionCascade"].get("keys", []), "label": node_label(node, node_path)}] \
            if has_own(node, "permissionCascade") and is_object(node["permissionCascade"]) and isinstance(node["permissionCascade"].get("keys"), list) \
            else ancestors
        current_form_mode = ("search" if props.get("mode") == "search" else "default") if node.get("type") == "form" else form_mode

        if node.get("type") == "actionButton" and has_own(props, "permissionIntent"):
            add_target(props.get("key") or node_label(node, node_path), "actionButton", node, props["permissionIntent"], ancestors, True)
        if node.get("type") == "form" and current_form_mode == "default" and "submitAction" in props:
            add_target(f"{node_label(node, node_path)}:submit", "formSubmit", node, "edit", own_cascades, True)
        if current_form_mode == "default" and node.get("type") in EDITABLE_FORM_TYPES:
            field = f"{props.get('startField', '')}:{props.get('endField', '')}" if node.get("type") == "dateRangePicker" else props.get("field")
            add_target(field or node_label(node, node_path), "formField", node, "edit", ancestors, True)

        if node.get("type") == "table":
            for index, column in enumerate(props.get("columns", []) if isinstance(props.get("columns"), list) else []):
                add_target(column.get("field") or f"{node_path}.props.columns[{index}]", "column", column, first_local_permission_key(column), [], False)
            for collection, kind in (("actions", "rowAction"), ("toolbar", "toolbarTrigger")):
                for index, entry in enumerate(props.get(collection, []) if isinstance(props.get(collection), list) else []):
                    has_intent = has_own(entry, "permissionIntent")
                    key = entry["permissionIntent"] if has_intent else first_local_permission_key(entry)
                    add_target(entry.get("key") or f"{node_path}.props.{collection}[{index}]", kind, entry, key, own_cascades, has_intent)

        for index, child in enumerate(node.get("children", []) if isinstance(node.get("children"), list) else []):
            walk(child, f"{node_path}.children[{index}]", own_cascades, current_form_mode)
        for index, item in enumerate(props.get("items", []) if isinstance(props.get("items"), list) else []):
            walk(item.get("content") if is_object(item) else None, f"{node_path}.props.items[{index}].content", own_cascades, current_form_mode)

    walk(page.get("body") if is_object(page) else None, "body", [])
    actions = page.get("actions", {}) if is_object(page) and is_object(page.get("actions")) else {}
    for action_id, action in actions.items():
        if is_object(action) and action.get("type") == "modal":
            walk(action.get("content"), f"actions.{action_id}.content", [])
    if is_object(navigated_page) and is_object(navigated_page.get("body")):
        walk(navigated_page["body"], "navigatedPage.body", [])
    return targets


def execute_target(targets, execution):
    if execution is None:
        return None
    target = next((item for item in targets if item["targetId"] == execution.get("targetId")), None)
    if target is None:
        return {"outcome": "TARGET_NOT_FOUND", "events": []}
    if execution.get("visible") is False:
        return {"outcome": "BLOCKED", "reason": "NOT_VISIBLE", "events": []}
    if not target["effectivePermission"]:
        return {"outcome": "BLOCKED", "reason": "PERMISSION_DENIED", "events": []}
    if execution.get("disabled") is True or execution.get("requiresSelection") is True:
        return {"outcome": "BLOCKED", "reason": "DISABLED", "events": []}
    if execution.get("confirm") is True:
        events = [{"type": "confirmShown"}]
        if execution.get("confirmed") is not True:
            return {"outcome": "CONFIRM_CANCELLED", "events": events}
        events.append({"type": "actionExecuted"})
        return {"outcome": "EXECUTED", "events": events}
    return {"outcome": "EXECUTED", "events": [{"type": "actionExecuted"}]}


def evaluate_permission_inheritance(input_value):
    errors = validate_permission_inheritance(input_value["page"])
    result = {"validation": {"valid": len(errors) == 0, "errors": errors}}
    if errors:
        return result
    targets = evaluate_page(input_value["page"], input_value.get("navigatedPage"))
    result["targets"] = targets
    execution = execute_target(targets, input_value.get("execution"))
    if execution is not None:
        result["execution"] = execution
    return result
