import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))
from runtime_defaults import validate_runtime_defaults

suite = json.loads((ROOT / "fixtures" / "runtime-defaults" / "cases.json").read_text(encoding="utf-8"))
for fixture in suite["cases"]:
    actual = validate_runtime_defaults(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(f"Runtime defaults fixture failed: {fixture['id']}\nexpected={fixture['expected']!r}\nactual={actual!r}")
print(f"Python runtime defaults conformance: {len(suite['cases'])} fixtures passed.")
