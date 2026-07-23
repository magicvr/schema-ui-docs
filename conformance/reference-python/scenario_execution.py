import re
from pathlib import Path

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


# Keep in sync with scripts/official-scenarios.js CONFORMANCE_SCENARIO_PATHS
CONFORMANCE_SCENARIO_PATHS = {
    "docs/05-scenarios/data-table.md",
    "docs/05-scenarios/form-with-reactions.md",
    "docs/05-scenarios/grid-dashboard.md",
    "docs/05-scenarios/row-backend-actions.md",
    "docs/05-scenarios/search-form-table.md",
    "docs/05-scenarios/form-with-upload.md",
    "docs/05-scenarios/admin-list-edit-lifecycle.md",
}


def _extract_yaml_fences(markdown):
    return re.findall(r"```yaml\r?\n([\s\S]*?)\r?\n```", markdown)


def _page_meta_from_yaml(yaml_text):
    page_id = re.search(r"^\s+pageId:\s*([^\n#]+)", yaml_text, re.MULTILINE)
    protocol_version = re.search(r"^\s+protocolVersion:\s*[\"']?([^\"'\s#]+)", yaml_text, re.MULTILINE)
    if page_id is None or protocol_version is None:
        return None
    return {
        "pageId": page_id.group(1).strip().strip("\"'"),
        "protocolVersion": protocol_version.group(1).strip(),
    }


def read_scenario_metadata(protocol_root, relative_path, page_id=None):
    if relative_path not in CONFORMANCE_SCENARIO_PATHS:
        raise ValueError(f"UNKNOWN_SCENARIO_PATH: {relative_path}")
    scenario_path = Path(protocol_root) / relative_path
    markdown = scenario_path.read_text(encoding="utf-8")
    fences = _extract_yaml_fences(markdown)
    if not fences:
        raise ValueError(f"No yaml fence found in {relative_path}")

    if page_id is None or page_id == "":
        meta = _page_meta_from_yaml(fences[0])
        if meta is None:
            raise ValueError(f"Scenario metadata missing in {relative_path}")
        return meta

    for fence in fences:
        meta = _page_meta_from_yaml(fence)
        if meta is not None and meta["pageId"] == page_id:
            return meta
    raise ValueError(f"SCENARIO_METADATA_MISMATCH: {relative_path}")


def execute_scenario(input_value, protocol_root):
    official_meta = read_scenario_metadata(
        protocol_root,
        input_value["scenarioPath"],
        input_value.get("scenarioMeta", {}).get("pageId"),
    )
    if official_meta != input_value["scenarioMeta"]:
        raise ValueError(f"SCENARIO_METADATA_MISMATCH: {input_value['scenarioPath']}")
    return {
        "pageId": official_meta["pageId"],
        "protocolVersion": official_meta["protocolVersion"],
        "steps": [execute_step(step) for step in input_value["steps"]],
    }
