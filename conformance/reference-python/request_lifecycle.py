def apply_request_lifecycle(input_value):
    generation = input_value.get("initialGeneration", 0)
    active = input_value.get("initialActive", True)
    accepting_responses = generation > 0 and active
    state = input_value.get("initialState")
    committed = []

    for event in input_value.get("events", []):
        event_type = event["type"]
        if event_type == "start":
            generation += 1
            active = True
            accepting_responses = True
        elif event_type in ("hide", "unmount"):
            active = False
            accepting_responses = False
        elif event_type == "show":
            active = True
        elif event_type == "response":
            if event["generation"] != generation or not active or not accepting_responses:
                continue
            state = event["state"]
            committed.append({"generation": event["generation"], "state": event["state"]})

    return {"generation": generation, "active": active, "state": state, "committed": committed}
