import copy
import re


CONDITION = re.compile(
    r"^\$deps\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*"
    r"(==|!=|>=|<=|>|<|contains)\s*(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|'[^']*'|\"[^\"]*\")$"
)
DEPENDENCY = re.compile(r"\$deps\.([A-Za-z_][A-Za-z0-9_]*)")
MISSING = object()


def read_path(values, path):
    current = values
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            return MISSING, False
        current = current[segment]
    return current, True


def parse_literal(token):
    if token == "true":
        return True
    if token == "false":
        return False
    if token == "null":
        return None
    if token.startswith("'") or token.startswith('"'):
        return token[1:-1]
    return float(token) if "." in token or "e" in token.lower() else int(token)


def json_value_equal(left, right):
    if left is MISSING or right is MISSING:
        return False
    if left is None or right is None:
        return left is right
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left == right
    if isinstance(left, list) or isinstance(right, list):
        return (
            isinstance(left, list)
            and isinstance(right, list)
            and len(left) == len(right)
            and all(json_value_equal(left_item, right_item) for left_item, right_item in zip(left, right))
        )
    if isinstance(left, dict) or isinstance(right, dict):
        return (
            isinstance(left, dict)
            and isinstance(right, dict)
            and left.keys() == right.keys()
            and all(json_value_equal(left[key], right[key]) for key in left)
        )
    return type(left) is type(right) and left == right


def evaluate_condition(expression, snapshot):
    match = CONDITION.fullmatch(expression)
    if match is None:
        raise ValueError(f"Unsupported reference expression: {expression}")
    left, found = read_path(snapshot, match.group(1))
    right = parse_literal(match.group(3))
    if not found:
        return False
    operator = match.group(2)
    if operator == "contains":
        return isinstance(left, list) and any(json_value_equal(item, right) for item in left)
    if operator in (">", ">=", "<", "<="):
        same_type = (
            isinstance(left, (int, float)) and not isinstance(left, bool)
            and isinstance(right, (int, float)) and not isinstance(right, bool)
        ) or (isinstance(left, str) and isinstance(right, str))
        if not same_type:
            return False
        return {">": left > right, ">=": left >= right, "<": left < right, "<=": left <= right}[operator]
    equal = json_value_equal(left, right)
    return equal if operator == "==" else not equal


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
    baselines = copy.deepcopy(input_value.get("baselines", input_value["initialValues"]))
    max_rounds = input_value.get("maxRounds", 10)
    dependency_fields = collect_dependency_fields(input_value)
    warnings = []
    warned_fields = set()
    rounds = []
    previous_conditions = {}

    for round_number in range(1, max_rounds + 1):
        snapshot = copy.deepcopy(values)
        observations = {
            observer["id"]: evaluate_condition(observer["when"], snapshot)
            for observer in input_value["observers"]
        }
        pending = {}

        for field in input_value["fields"]:
            value_write_count = 0
            reset_to_baseline = False
            for reaction_index, reaction in enumerate(field["reactions"]):
                condition = evaluate_condition(reaction["when"], snapshot)
                branch = reaction.get("fulfill") if condition else reaction.get("otherwise")
                condition_key = f"{field['field']}:{reaction_index}"
                was_true = previous_conditions.get(condition_key) is True
                previous_conditions[condition_key] = condition
                if branch is not None and "value" in branch:
                    pending[field["field"]] = copy.deepcopy(branch["value"])
                    value_write_count += 1
                elif not condition and was_true and field["field"] in baselines:
                    reset_to_baseline = True
            if value_write_count == 0 and reset_to_baseline:
                pending[field["field"]] = copy.deepcopy(baselines[field["field"]])
            if value_write_count > 1 and field["field"] not in warned_fields:
                warnings.append({
                    "code": "MULTIPLE_VALUE_WRITES",
                    "field": field["field"],
                    "count": value_write_count,
                })
                warned_fields.add(field["field"])

        commits = []
        for field, value in pending.items():
            current = values[field] if field in values else MISSING
            if not json_value_equal(current, value):
                values[field] = copy.deepcopy(value)
                commits.append({"field": field, "value": copy.deepcopy(value)})
        rounds.append({
            "round": round_number,
            "snapshot": snapshot,
            "observations": observations,
            "commits": commits,
        })

        external_update = next(
            (update for update in input_value.get("externalUpdates", []) if update["afterRound"] == round_number),
            None,
        )
        if external_update:
            values.update(copy.deepcopy(external_update["values"]))
        if external_update or any(commit["field"] in dependency_fields for commit in commits):
            continue
        return {"ok": True, "values": values, "rounds": rounds, "warnings": warnings}

    return {
        "ok": False,
        "code": "REACTION_LOOP_LIMIT",
        "maxRounds": max_rounds,
        "values": values,
        "roundCount": max_rounds,
        "dependencyFields": sorted(dependency_fields),
    }