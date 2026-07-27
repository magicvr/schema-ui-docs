import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from table_sort import evaluate_table_sort

fixture_path = ROOT / "fixtures" / "table-sort" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = evaluate_table_sort(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Table sort fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python table sort conformance: {len(suite['cases'])} fixtures passed.")
