import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from action_outcome import process_action_outcome


fixture_path = ROOT / "fixtures" / "actions" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = process_action_outcome(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Action fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python action conformance: {len(suite['cases'])} fixtures passed.")