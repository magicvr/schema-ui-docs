import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from request_lifecycle import apply_request_lifecycle


fixture_path = ROOT / "fixtures" / "request-lifecycle" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = apply_request_lifecycle(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Request lifecycle fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python request lifecycle conformance: {len(suite['cases'])} fixtures passed.")
