import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from scenario_execution import execute_scenario


fixture_path = ROOT / "fixtures" / "scenarios" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = execute_scenario(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Scenario fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python official scenario execution conformance: {len(suite['cases'])} fixtures passed.")