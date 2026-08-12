import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from host_bootstrap import evaluate_bootstrap


fixture_path = ROOT / "fixtures" / "host-bootstrap" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = evaluate_bootstrap(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Host bootstrap fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python host bootstrap conformance: {len(suite['cases'])} fixtures passed.")
