import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from host_failure import execute


fixture_path = ROOT / "fixtures" / "host-failure" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = execute(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Host failure fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python host failure conformance: {len(suite['cases'])} fixtures passed.")
