import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from request_construction import build_request


fixture_path = ROOT / "fixtures" / "request-construction" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = build_request(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Request construction fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python request construction conformance: {len(suite['cases'])} fixtures passed.")