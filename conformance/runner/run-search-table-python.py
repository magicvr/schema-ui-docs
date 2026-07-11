import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from table_query_state import build_table_query


fixture_path = ROOT / "fixtures" / "search-table" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = build_table_query(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Search table fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python search table conformance: {len(suite['cases'])} fixtures passed.")