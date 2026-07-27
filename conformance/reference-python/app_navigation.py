from app_manifest import match_route


def is_object(value):
    return isinstance(value, dict)


def eval_simple_when(when, context):
    if when is None:
        return True
    if isinstance(when, bool):
        return when
    if not isinstance(when, str):
        return False

    import re
    contains = re.fullmatch(r'\$context\.user\.roles\s+contains\s+"([^"]+)"', when.strip())
    if contains:
        roles = ((context or {}).get("user") or {}).get("roles")
        return isinstance(roles, list) and contains.group(1) in roles

    feature = re.fullmatch(r"\$context\.features\.([a-zA-Z0-9_]+)\s*==\s*(true|false)", when.strip())
    if feature:
        actual = ((context or {}).get("features") or {}).get(feature.group(1))
        expected = feature.group(2) == "true"
        return actual is expected

    id_match = re.fullmatch(r'\$context\.user\.id\s*==\s*"([^"]*)"', when.strip())
    if id_match:
        return ((context or {}).get("user") or {}).get("id") == id_match.group(1)

    return False


def eval_permissions_view(permissions, context):
    if not permissions or "view" not in permissions:
        return True
    view = permissions.get("view")
    if isinstance(view, bool):
        return view
    return eval_simple_when(view, context)


def eval_visible_when(visible_when, context):
    if not visible_when:
        return True
    when = visible_when.get("when") if isinstance(visible_when, dict) else visible_when
    return eval_simple_when(when, context)


def is_visible(item, context):
    return eval_permissions_view(item.get("permissions"), context) and eval_visible_when(item.get("visibleWhen"), context)


def is_link(item):
    return is_object(item) and not isinstance(item.get("items"), list)


def is_group(item):
    return is_object(item) and isinstance(item.get("items"), list)


def project_link(link):
    projected = {"type": "link"}
    if "pageRef" in link:
        projected["pageRef"] = link["pageRef"]
    if "url" in link:
        projected["url"] = link["url"]
    if "label" in link:
        projected["label"] = link["label"]
    if "labelKey" in link:
        projected["labelKey"] = link["labelKey"]
    if "icon" in link:
        projected["icon"] = link["icon"]
        projected["iconOptional"] = True
    return projected


def filter_items(items, context):
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if is_group(item):
            if not is_visible(item, context):
                continue
            children = [c for c in filter_items(item.get("items"), context) if c.get("type") == "link" or is_link(c)]
            # filter_items already projects links
            children = [c for c in children if c.get("type") == "link"]
            if len(children) == 0:
                continue
            group = {"type": "group", "items": children}
            if "label" in item:
                group["label"] = item["label"]
            if "labelKey" in item:
                group["labelKey"] = item["labelKey"]
            if "icon" in item:
                group["icon"] = item["icon"]
                group["iconRendered"] = True
            out.append(group)
        elif is_link(item):
            if not is_visible(item, context):
                continue
            out.append(project_link(item))
    return out


def highlight_link(link, path, pages):
    if "pageRef" in link:
        page = next((p for p in (pages or []) if isinstance(p, dict) and p.get("pageId") == link.get("pageRef")), None)
        if page is None:
            return False
        result = match_route(path, [page])
        return result.get("matched") is True
    if "url" in link:
        return link.get("url") == path
    return False


def apply_highlight(items, path, pages):
    result = []
    for item in items:
        if item.get("type") == "group":
            result.append({
                **item,
                "items": [{**link, "active": highlight_link(link, path, pages)} for link in item.get("items") or []],
            })
        else:
            result.append({**item, "active": highlight_link(item, path, pages)})
    return result


def validate_navigation_structure(navigation):
    errors = []
    if not is_object(navigation):
        return {"ok": False, "errors": [{"code": "INVALID_NAVIGATION"}]}
    allowed = {"top", "sidebar", "user"}
    for key in navigation.keys():
        if key not in allowed:
            errors.append({"code": "UNKNOWN_NAV_SLOT", "path": f"navigation.{key}"})
    return {"ok": len(errors) == 0, "errors": errors}


def evaluate_app_navigation(input_data):
    operation = input_data.get("operation") or "project"
    navigation = input_data.get("navigation") or {}
    context = input_data.get("context") or {}
    pages = input_data.get("pages") or (input_data.get("manifest") or {}).get("pages") or []
    path = input_data.get("path") or "/"

    if operation == "validate":
        result = validate_navigation_structure(navigation)
        if not result["ok"]:
            first = result["errors"][0]
            return {"ok": False, "code": first["code"], "path": first.get("path"), "errors": result["errors"]}
        return {"ok": True}

    struct = validate_navigation_structure(navigation)
    if not struct["ok"]:
        first = struct["errors"][0]
        return {"ok": False, "code": first["code"], "path": first.get("path"), "errors": struct["errors"]}

    slots = {}
    for slot in ("top", "sidebar", "user"):
        if slot not in navigation:
            continue
        items = filter_items(navigation.get(slot), context)
        if operation in ("highlight", "project"):
            items = apply_highlight(items, path, pages)
        if isinstance(input_data.get("iconRegistry"), list):
            registry = set(input_data["iconRegistry"])

            def degrade(list_items):
                out = []
                for item in list_items:
                    if item.get("type") == "group":
                        group = {**item, "items": degrade(item.get("items") or [])}
                        if "icon" in group and group["icon"] not in registry:
                            group["iconRendered"] = False
                        out.append(group)
                    else:
                        if "icon" in item and item["icon"] not in registry:
                            out.append({**item, "iconRendered": False})
                        elif "icon" in item:
                            out.append({**item, "iconRendered": True})
                        else:
                            out.append(item)
                return out

            items = degrade(items)
        slots[slot] = items

    return {"ok": True, "slots": slots}
