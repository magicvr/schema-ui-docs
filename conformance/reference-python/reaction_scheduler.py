import copy
import re


CONDITION = re.compile(
    r"^\$deps\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*"
    r"(==|!=)\s*(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?|'[^']*')$"
)
DEPENDENCY = re.compile(r"\$deps\.([A-Za-z_][A-Za-z0-9_]*)")


def read_path(values, path):
    current = values
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            return None, False
        current = current[segment]
    return current, True


def parse_literal(token):
    if token == "true":
        return True
    if token == "false":
        return False
    if token == "null":
        return None
    if token.startswith("'"):
        return token[1:-1]
    return float(token) if "." in token else int(token)


def evaluate_condition(expression, snapshot):
    match = CONDITION.fullmatch(expression)
    if match is None:
        raise ValueError(f"Unsupported reference expression: {expression}")
    left, found = read_path(snapshot, match.group(1))
    if not found:
        return False
    equal = type(left) is type(parse_literal(match.group(3))) and left == parse_literal(match.group(3))
    return equal if match.group(2) == "==" else not equal


def collect_dependency_fields(input_value):
    expressions = [
        reaction["when"]
        for field in input_value["fields"]
        for reaction in field["reactions"]
    ] + [observer["when"] for observer in input_value["observers"]]
    return {
        match.group(1)
        for expression in expressions
        for match in DEPENDENCY.finditer(expression)
    }


def run_reaction_schedule(input_value):
    values = copy.deepcopy(input_value["initialValues"])
    max_rounds = input_value.get("maxRounds", 10)
    dependency_fields = collect_dependency_fields(input_value)
    warnings = []
    warned_fields = set()
    rounds = []

    for round_number in range(1, max_rounds + 1):
        snapshot = copy.deepcopy(values)
        observations = {
            observer["id"]: evaluate_condition(observer["when"], snapshot)
            for observer in input_value["observers"]
        }
        pending = {}

        for field in input_value["fields"]:
            value_write_count = 0
            for reaction in field["reactions"]:
                branch = reaction.get("fulfill") if evaluate_condition(reaction["when"], snapshot) else reaction.get("otherwise")
                if branch is not None and "value" in branch:
                    pending[field["field"]] = copy.deepcopy(branch["value"])
                    value_write_count += 1
            if value_write_count > 1 and field["field"] not in warned_fields:
                warnings.append({
                    "code": "MULTIPLE_VALUE_WRITES",
                    "field": field["field"],
                    "count": value_write_count,
                })
                warned_fields.add(field["field"])

        commits = []
        for field, value in pending.items():
            if values.get(field) != value or type(values.get(field)) is not type(value):
                values[field] = copy.deepcopy(value)
                commits.append({"field": field, "value": copy.deepcopy(value)})
        rounds.append({
            "round": round_number,
            "snapshot": snapshot,
            "observations": observations,
            "commits": commits,
        })

        if not any(commit["field"] in dependency_fields for commit in commits):
            return {"ok": True, "values": values, "rounds": rounds, "warnings": warnings}

    return {
        "ok": False,
        "code": "REACTION_LOOP_LIMIT",
        "maxRounds": max_rounds,
        "values": values,
        "roundCount": max_rounds,
        "dependencyFields": sorted(dependency_fields),
    }