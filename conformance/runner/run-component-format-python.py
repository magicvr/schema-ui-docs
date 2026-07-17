import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))
from component_format import validate_component_format

suite = json.loads((ROOT / "fixtures" / "component-format" / "cases.json").read_text(encoding="utf-8"))
for fixture in suite["cases"]:
    actual = validate_component_format(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(f"Component format fixture failed: {fixture['id']}\nexpected={fixture['expected']!r}\nactual={actual!r}")
print(f"Python component format conformance: {len(suite['cases'])} fixtures passed.")
