from table_query_state import build_table_query, normalize_selection, apply_selection_event

RESERVED = {"page", "pageSize", "sort"}
TABLE_SORT_CAPABILITY = "table.sort"


def version_at_least(version, floor):
    import re
    match = re.fullmatch(r"([0-9]+)\.([0-9]+)", version or "")
    if not match:
        return False
    major, minor = map(int, match.groups())
    floor_major, floor_minor = map(int, floor.split("."))
    return major > floor_major or (major == floor_major and minor >= floor_minor)


def sortable_columns(table):
    columns = table.get("columns") if isinstance(table, dict) else None
    if not isinstance(columns, list):
        return []
    return [col for col in columns if isinstance(col, dict) and col.get("sortable") is True]


def sort_key_of(col):
    sort_field = col.get("sortField")
    if isinstance(sort_field, str) and len(sort_field) > 0:
        return sort_field
    return col.get("field")


def uses_sort_fields(table):
    if not isinstance(table, dict):
        return False
    if "defaultSort" in table and table.get("defaultSort") is not None:
        return True
    columns = table.get("columns")
    if not isinstance(columns, list):
        return False
    for col in columns:
        if isinstance(col, dict) and ("sortable" in col or "sortField" in col):
            return True
    return False


def validate_table_sort(meta, table):
    errors = []
    if not uses_sort_fields(table):
        return {"ok": True, "errors": errors}

    if not version_at_least((meta or {}).get("protocolVersion"), "2.5"):
        errors.append({"code": "PROTOCOL_VERSION_TOO_LOW", "path": "meta.protocolVersion"})
    caps = (meta or {}).get("requiredCapabilities") or []
    if not isinstance(caps, list) or TABLE_SORT_CAPABILITY not in caps:
        errors.append({"code": "CAPABILITY_REQUIRED", "path": "meta.requiredCapabilities"})

    columns = table.get("columns") if isinstance(table.get("columns"), list) else []
    sort_keys = {}

    for index, col in enumerate(columns):
        if not isinstance(col, dict):
            continue
        if "sortField" in col and col.get("sortable") is not True:
            errors.append({"code": "SORT_FIELD_WITHOUT_SORTABLE", "path": f"columns[{index}].sortField"})
        if col.get("sortable") is True:
            key = sort_key_of(col)
            if not isinstance(key, str) or len(key) == 0:
                errors.append({"code": "SORT_KEY_INVALID", "path": f"columns[{index}]"})
                continue
            if key in RESERVED or col.get("field") in RESERVED:
                errors.append({"code": "SORT_KEY_RESERVED", "path": f"columns[{index}]"})
            if key in sort_keys:
                errors.append({"code": "SORT_KEY_DUPLICATE", "path": f"columns[{index}]"})
            else:
                sort_keys[key] = index

    mode = (table.get("pagination") or {}).get("mode")
    has_sortable = len(sortable_columns(table)) > 0
    if (has_sortable or table.get("defaultSort") is not None) and mode != "server":
        errors.append({"code": "SORT_REQUIRES_SERVER_PAGINATION", "path": "pagination.mode"})

    if table.get("defaultSort") is not None:
        ds = table.get("defaultSort")
        if not isinstance(ds, dict) or ds.get("order") not in ("asc", "desc"):
            errors.append({"code": "DEFAULT_SORT_INVALID", "path": "defaultSort"})
        elif not isinstance(ds.get("field"), str) or ds.get("field") not in sort_keys:
            errors.append({"code": "DEFAULT_SORT_FIELD_UNKNOWN", "path": "defaultSort.field"})

    return {"ok": len(errors) == 0, "errors": errors}


def allowed_sort_keys(table):
    return {sort_key_of(col) for col in sortable_columns(table)}


def initial_sort(table):
    ds = (table or {}).get("defaultSort")
    if isinstance(ds, dict) and isinstance(ds.get("field"), str) and ds.get("order") in ("asc", "desc"):
        return f"{ds['field']}:{ds['order']}"
    return None


def next_sort_after_click(current_sort, sort_key):
    if current_sort is None:
        return f"{sort_key}:asc"
    import re
    match = re.fullmatch(r"([^:]+):(asc|desc)", str(current_sort))
    if not match or match.group(1) != sort_key:
        return f"{sort_key}:asc"
    if match.group(2) == "asc":
        return f"{sort_key}:desc"
    return None


def resolve_click_sort_key(table, field):
    columns = (table or {}).get("columns") if isinstance((table or {}).get("columns"), list) else []
    for col in columns:
        if isinstance(col, dict) and col.get("field") == field and col.get("sortable") is True:
            return sort_key_of(col)
    return None


def parse_sort_key(sort):
    if sort is None:
        return None
    import re
    match = re.fullmatch(r"([^:]+):(asc|desc)", str(sort))
    return match.group(1) if match else None


def evaluate_table_sort(input_data):
    meta = input_data.get("meta") or {}
    table = input_data.get("table") or {}
    operation = input_data.get("operation") or "runtime"

    validation = validate_table_sort(meta, table)
    if operation == "validate":
        if validation["ok"]:
            return {"ok": True}
        first = validation["errors"][0]
        return {
            "ok": False,
            "code": first["code"],
            "path": first["path"],
            "errors": validation["errors"],
        }

    if not uses_sort_fields(table):
        event = input_data.get("event")
        if event and event.get("type") == "clickSort":
            state = {
                "filters": dict((input_data.get("state") or {}).get("filters") or {}),
                "page": (input_data.get("state") or {}).get("page", 1),
                "pageSize": (input_data.get("state") or {}).get("pageSize", 20),
                "sort": (input_data.get("state") or {}).get("sort"),
            }
            built = build_table_query({
                "baseUrl": input_data.get("baseUrl") or "/orders",
                "staticParams": input_data.get("staticParams") or {},
                "state": state,
                "event": None,
                "selection": input_data.get("selection"),
            })
            result = {
                "ok": True,
                "protocolSortInteraction": False,
                "state": built["state"],
                "url": built["url"],
            }
            if "selection" in input_data:
                result["selection"] = normalize_selection(input_data.get("selection"))
            return result
        built = build_table_query({
            "baseUrl": input_data.get("baseUrl") or "/orders",
            "staticParams": input_data.get("staticParams") or {},
            "state": input_data.get("state") or {"filters": {}, "page": 1, "pageSize": 20, "sort": None},
            "event": input_data.get("event"),
            "selection": input_data.get("selection"),
            "selectionEvent": input_data.get("selectionEvent"),
        })
        return {"ok": True, "protocolSortInteraction": False, **built}

    if not validation["ok"]:
        first = validation["errors"][0]
        return {
            "ok": False,
            "code": first["code"],
            "path": first["path"],
            "errors": validation["errors"],
            "requestEmitted": False,
        }

    state_in = input_data.get("state") or {}
    state = {
        "filters": dict(state_in.get("filters") or {}),
        "page": state_in.get("page", 1),
        "pageSize": state_in.get("pageSize", (table.get("pagination") or {}).get("pageSize", 20)),
        "sort": state_in["sort"] if "sort" in state_in else None,
    }

    event = input_data.get("event")
    transition = False

    if event is None or event.get("type") == "init":
        if "sort" not in state_in:
            state["sort"] = initial_sort(table)
    elif event.get("type") == "clickSort":
        sort_key = resolve_click_sort_key(table, event.get("field"))
        if sort_key is not None:
            state["sort"] = next_sort_after_click(state["sort"], sort_key)
            state["page"] = 1
            transition = True
    elif event.get("type") == "submitSearch":
        state["filters"] = dict(event.get("filters") or {})
        state["page"] = 1
        transition = True
    elif event.get("type") == "clearSearch":
        state["filters"] = {}
        state["page"] = 1
        transition = True
    elif event.get("type") == "changePage":
        state["page"] = event["page"]
        transition = True
    elif event.get("type") == "changeSort":
        state["sort"] = event.get("sort")
        state["page"] = 1
        transition = True

    key = parse_sort_key(state["sort"])
    allowed = allowed_sort_keys(table)
    if key is not None and key not in allowed:
        return {
            "ok": False,
            "code": "TABLE_SORT_FIELD_UNKNOWN",
            "requestEmitted": False,
            "state": state,
        }

    built = build_table_query({
        "baseUrl": input_data.get("baseUrl") or "/orders",
        "staticParams": input_data.get("staticParams") or {},
        "state": state,
        "event": None,
    })

    result = {
        "ok": True,
        "requestEmitted": True,
        "state": built["state"],
        "url": built["url"],
    }

    if "selection" in input_data or "selectionEvent" in input_data:
        selection = normalize_selection(input_data.get("selection"))
        if transition:
            selection = {"keys": [], "count": 0}
        if input_data.get("selectionEvent"):
            selection = apply_selection_event(selection, input_data["selectionEvent"])
        result["selection"] = selection

    return result
