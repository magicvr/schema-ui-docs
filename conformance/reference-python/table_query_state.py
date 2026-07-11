from query_serialization import serialize_query


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
    else:
        raise ValueError(f"Unknown table query event: {event['type']}")
    return next_state


def build_table_query(input_value):
    state = apply_table_query_event(input_value["state"], input_value.get("event"))
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
    return {"state": state, "url": serialized["url"]}