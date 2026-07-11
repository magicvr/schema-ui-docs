import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from upload_execution import execute_upload


fixture_path = ROOT / "fixtures" / "uploads" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = execute_upload(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Upload fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python upload conformance: {len(suite['cases'])} fixtures passed.")