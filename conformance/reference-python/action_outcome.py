def behavior_event(behavior, context=None):
    context = context or {}
    if behavior["behavior"] == "toast":
        return {"type": "toast", "message": behavior["message"]}
    if behavior["behavior"] == "navigate":
        return {"type": "navigate", "url": behavior["url"]}
    if behavior["behavior"] == "reload":
        if context.get("tableId"):
            return {"type": "reloadTable", "tableId": context["tableId"]}
        return {"type": "reloadCurrentData"}
    if behavior["behavior"] == "closeModal":
        return {"type": "closeModal"}
    raise ValueError(f"Unknown OutcomeBehavior: {behavior['behavior']}")


def process_http_error(input_value):
    status = input_value["transport"]["status"]
    body = input_value["transport"].get("body") or {}
    events = []

    if status in (401, 403):
        events.append({"type": "authFailure", "status": status})
        events.append({"type": "errorState", "display": None if status == 401 else "无权限访问"})
        return {"ok": False, "events": events}

    field_errors = status == 400 and isinstance(body.get("errors"), list) and len(body["errors"]) > 0
    if field_errors:
        events.append({"type": "fieldErrors", "errors": body["errors"]})
        if (input_value.get("onError") or {}).get("behavior") == "toast":
            events.append(behavior_event(input_value["onError"], input_value.get("context")))
        elif body.get("message"):
            events.append({"type": "toast", "message": body["message"]})
        return {"ok": False, "events": events}

    if status == 404:
        display = "资源不存在"
    elif status >= 500:
        display = "系统异常，请稍后重试"
    else:
        display = body.get("message")
    events.append({"type": "errorState", "display": display})
    if input_value.get("onError"):
        events.append(behavior_event(input_value["onError"], input_value.get("context")))
    return {"ok": False, "events": events}


def process_action_outcome(input_value):
    transport = input_value["transport"]
    if transport["type"] == "success":
        events = [{"type": "requestSucceeded", "status": transport["status"]}]
        if input_value.get("onSuccess"):
            events.append(behavior_event(input_value["onSuccess"], input_value.get("context")))
        return {"ok": True, "events": events}
    if transport["type"] == "httpError":
        return process_http_error(input_value)
    if transport["type"] == "abort":
        return {"ok": False, "events": []}

    events = [{
        "type": "errorState",
        "display": "请求超时，请稍后重试" if transport["type"] == "timeout" else "网络异常，请检查网络连接",
        "retryable": True,
        "outcome": "unknown",
    }]
    if input_value.get("onError"):
        events.append(behavior_event(input_value["onError"], input_value.get("context")))
    return {"ok": False, "events": events}
