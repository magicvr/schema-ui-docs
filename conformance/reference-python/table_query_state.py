from query_serialization import serialize_query


def normalize_selection(selection):
    if not isinstance(selection, dict):
        return {"keys": [], "count": 0}
    keys = list(selection.get("keys") or [])
    return {"keys": keys, "count": len(keys)}


def apply_table_query_event(state, event):
    next_state = {**state, "filters": dict(state["filters"])}
    if event is None:
        return next_state
    if event["type"] == "submitSearch":
        next_state["filters"] = dict(event["filters"])
        next_state["page"] = 1
    elif event["type"] == "clearSearch":
        next_state["filters"] = {}
        next_state["page"] = 1
    elif event["type"] == "changePage":
        next_state["page"] = event["page"]
    elif event["type"] == "changeSort":
        next_state["page"] = 1
        next_state["sort"] = event["sort"]
    elif event["type"] == "changePageSize":
        next_state["page"] = 1
        next_state["pageSize"] = event["pageSize"]
    elif event["type"] == "reloadSuccess":
        pass
    else:
        raise ValueError(f"Unknown table query event: {event['type']}")
    return next_state


def clears_selection(event):
    return event is not None


def apply_selection_event(selection, selection_event):
    next_selection = normalize_selection(selection)
    if selection_event is None:
        return next_selection
    if selection_event["type"] == "setKeys":
        keys = list(selection_event.get("keys") or [])
        return {"keys": keys, "count": len(keys)}
    if selection_event["type"] == "clear":
        return {"keys": [], "count": 0}
    raise ValueError(f"Unknown selection event: {selection_event['type']}")


def build_table_query(input_value):
    state = apply_table_query_event(input_value["state"], input_value.get("event"))
    selection = normalize_selection(input_value.get("selection"))
    if clears_selection(input_value.get("event")):
        selection = {"keys": [], "count": 0}
    if input_value.get("selectionEvent") is not None:
        selection = apply_selection_event(selection, input_value.get("selectionEvent"))
    renderer_state = [
        ["page", state["page"]],
        ["pageSize", state["pageSize"]],
        ["sort", state["sort"]],
    ]
    serialized = serialize_query(
        input_value["baseUrl"],
        [
            [[key, value] for key, value in input_value.get("staticParams", {}).items()],
            [[key, value] for key, value in state["filters"].items()],
            renderer_state,
        ],
    )
    if not serialized["ok"]:
        return serialized
    result = {"state": state, "url": serialized["url"]}
    # Only surface selection when the fixture participates in selection (ADR-0022).
    if "selection" in input_value or "selectionEvent" in input_value:
        result["selection"] = selection
    return result
