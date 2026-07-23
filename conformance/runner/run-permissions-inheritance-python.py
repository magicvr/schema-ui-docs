import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from permission_inheritance import evaluate_permission_inheritance


fixture_path = ROOT / "fixtures" / "permissions-inheritance" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = evaluate_permission_inheritance(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Permission inheritance fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python permission inheritance conformance: {len(suite['cases'])} fixtures passed.")
