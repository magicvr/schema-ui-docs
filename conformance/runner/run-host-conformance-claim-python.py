import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from host_conformance_claim import execute


fixture_path = ROOT / "fixtures" / "host-conformance-claim" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = execute(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Host conformance claim fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python host conformance claim conformance: {len(suite['cases'])} fixtures passed.")
