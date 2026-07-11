import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from version_negotiation import negotiate_protocol


fixture_path = ROOT / "fixtures" / "version-negotiation" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = negotiate_protocol(
        fixture["input"]["pageMeta"],
        fixture["input"]["rendererSupport"],
    )
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Version negotiation fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python version negotiation conformance: {len(suite['cases'])} fixtures passed.")