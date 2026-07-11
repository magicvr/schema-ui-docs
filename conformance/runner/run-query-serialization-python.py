import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from query_serialization import serialize_query  # noqa: E402


fixture_path = ROOT / "fixtures" / "query-serialization" / "cases.json"
fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))


def decode_fixture_value(value):
    if isinstance(value, dict) and value.get("$undefined") is True:
        return None
    return value


for fixture in fixtures:
    sources = [
        [[key, decode_fixture_value(value)] for key, value in source]
        for source in fixture["input"]["sources"]
    ]
    actual = serialize_query(fixture["input"]["baseUrl"], sources)
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Query serialization fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )


print(f"Python query serialization conformance: {len(fixtures)} fixtures passed.")