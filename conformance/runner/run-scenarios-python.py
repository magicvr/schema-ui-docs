import json
import sys
from pathlib import Path


PROTOCOL_ROOT = Path(__file__).resolve().parents[2]
CONFORMANCE_ROOT = PROTOCOL_ROOT / "conformance"
sys.path.insert(0, str(CONFORMANCE_ROOT / "reference-python"))

from scenario_execution import execute_scenario


fixture_path = CONFORMANCE_ROOT / "fixtures" / "scenarios" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    try:
        actual = execute_scenario(fixture["input"], PROTOCOL_ROOT)
    except (OSError, ValueError) as error:
        actual = {"error": str(error).split(":", 1)[0]}
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Scenario fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python official scenario execution conformance: {len(suite['cases'])} fixtures passed.")