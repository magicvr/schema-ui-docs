import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from app_manifest import evaluate_app_manifest

fixture_path = ROOT / "fixtures" / "app-manifest" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = evaluate_app_manifest(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"App manifest fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python app manifest conformance: {len(suite['cases'])} fixtures passed.")
