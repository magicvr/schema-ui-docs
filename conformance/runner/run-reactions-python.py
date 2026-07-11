import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference-python"))

from reaction_scheduler import run_reaction_schedule


fixture_path = ROOT / "fixtures" / "reactions" / "cases.json"
suite = json.loads(fixture_path.read_text(encoding="utf-8"))

for fixture in suite["cases"]:
    actual = run_reaction_schedule(fixture["input"])
    if actual != fixture["expected"]:
        raise AssertionError(
            f"Reaction fixture failed: {fixture['id']}\n"
            f"expected={fixture['expected']!r}\nactual={actual!r}"
        )

print(f"Python reaction conformance: {len(suite['cases'])} fixtures passed.")