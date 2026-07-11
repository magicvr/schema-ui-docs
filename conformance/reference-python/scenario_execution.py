from action_outcome import process_action_outcome
from request_construction import build_request
from response_mapping import map_response
from table_query_state import build_table_query
from upload_execution import execute_upload


def execute_step(step):
    if step["kind"] == "request":
        return build_request(step["input"])
    if step["kind"] == "responseMapping":
        return map_response(step["input"])
    if step["kind"] == "searchTable":
        return build_table_query(step["input"])
    if step["kind"] == "action":
        return process_action_outcome(step["input"])
    if step["kind"] == "upload":
        return execute_upload(step["input"])
    raise ValueError(f"Unknown scenario step: {step['kind']}")


def execute_scenario(input_value):
    return {
        "pageId": input_value["scenarioMeta"]["pageId"],
        "protocolVersion": input_value["scenarioMeta"]["protocolVersion"],
        "steps": [execute_step(step) for step in input_value["steps"]],
    }