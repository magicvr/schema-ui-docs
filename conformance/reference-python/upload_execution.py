import re


PROTOCOL_RELATIVE_URL = re.compile(r"^/(?!/)[^\s\\]*$")
INVOCATION_ID = re.compile(r"^[\x21-\x7e]{1,200}$")


def failure(code, file_index, requests=None):
    return {
        "ok": False,
        "code": code,
        "fileIndex": file_index,
        "requests": requests or [],
        "fieldValue": None,
    }


def matches_accept(file_value, accept):
    if accept is None:
        return True
    file_name = file_value["name"].lower()
    mime = file_value["type"].lower()
    for raw_token in accept.split(","):
        token = raw_token.strip().lower()
        if token == "":
            continue
        if token.startswith(".") and file_name.endswith(token):
            return True
        if token.endswith("/*") and mime.startswith(token[:-1]):
            return True
        if mime == token:
            return True
    return False


def request_for(action, file_value, file_index, invocation_id):
    request = {
        "method": action.get("method", "POST"),
        "url": action["url"],
        "part": {
            "name": action.get("fieldName", "file"),
            "fileName": file_value["name"],
            "contentId": file_value["contentId"],
        },
    }
    retry_policy = action.get("retryPolicy", "never")
    if retry_policy not in ("never", "idempotent"):
        return failure("INVALID_RETRY_POLICY", file_index)
    if retry_policy == "idempotent":
        if not isinstance(invocation_id, str) or INVOCATION_ID.fullmatch(invocation_id) is None:
            return failure("MISSING_INVOCATION_ID", file_index)
        request["headers"] = {"Idempotency-Key": f"{invocation_id}:{file_index}"}
    return request


def response_value(response):
    if not isinstance(response, dict):
        return None
    if isinstance(response.get("url"), str) and len(response["url"]) > 0:
        return response["url"]
    if isinstance(response.get("id"), str) and len(response["id"]) > 0:
        return response["id"]
    return None


def execute_upload(input_value):
    action = input_value["action"]
    files = input_value["files"]
    if not isinstance(action.get("url"), str) or PROTOCOL_RELATIVE_URL.fullmatch(action["url"]) is None:
        return failure("INVALID_PROTOCOL_URL", 0)
    if not action.get("multiple", False) and len(files) > 1:
        return failure("MULTIPLE_FILES_NOT_ALLOWED", 1)
    for index, file_value in enumerate(files):
        if "maxSize" in action and file_value["size"] > action["maxSize"]:
            return failure("FILE_TOO_LARGE", index)
        if not matches_accept(file_value, action.get("accept")):
            return failure("UNSUPPORTED_FILE_TYPE", index)

    requests = []
    values = []
    for index, file_value in enumerate(files):
        request = request_for(action, file_value, index, input_value.get("invocationId"))
        if request.get("ok") is False:
            return failure(request["code"], index, requests)
        requests.append(request)
        result = input_value["results"][index] if index < len(input_value["results"]) else None
        if result is None or result.get("type") != "success":
            return failure("UPLOAD_REQUEST_FAILED", index, requests)
        value = response_value(result.get("response"))
        if value is None:
            return failure("INVALID_UPLOAD_RESPONSE", index, requests)
        values.append(value)

    return {
        "ok": True,
        "requests": requests,
        "fieldValue": values if action.get("multiple", False) else values[0],
    }
