import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from response_mapping import map_response


fixture_path = ROOT / "fixtures" / "response-mapping" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = map_response(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Response mapping fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python response mapping conformance: {len(suite['cases'])} fixtures passed.")