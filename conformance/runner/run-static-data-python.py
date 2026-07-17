import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))
from static_data import resolve_static_data

suite = json.loads((ROOT / "fixtures" / "static-data" / "cases.json").read_text(encoding="utf-8"))
for fixture in suite["cases"]:
    actual = resolve_static_data(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(f"Static data fixture failed: {fixture['id']}\nexpected={fixture['expected']!r}\nactual={actual!r}")
print(f"Python static data conformance: {len(suite['cases'])} fixtures passed.")
