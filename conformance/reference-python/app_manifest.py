import re
from urllib.parse import unquote, quote

from version_negotiation import negotiate_protocol

VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+$")
APP_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_-]*$")
REL_PATH_PATTERN = re.compile(r"^/(?!/)[^\s\\]*$")
LOGO_REL_PATTERN = re.compile(r"^/(?!/)[^\s\\{}]*$")
LOGO_HTTPS_PATTERN = re.compile(r"^https://[^\s\\]+$")
PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
PARAM_SEG_RE = re.compile(r"^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$")


def is_object(value):
    return isinstance(value, dict)


MANIFEST_MIN_PROTOCOL_VERSION = "2.5"


def version_at_least(version, floor):
    """Manifest fieldset floor is 2.5 (M1). Page meta versions remain decoupled (D1a)."""
    match = re.fullmatch(r"([0-9]+)\.([0-9]+)", version or "")
    if not match:
        return False
    major, minor = int(match.group(1)), int(match.group(2))
    floor_major, floor_minor = (int(part) for part in floor.split("."))
    return major > floor_major or (major == floor_major and minor >= floor_minor)


def join_base_url(base_url, path):
    base = re.sub(r"/+$", "", str(base_url or ""))
    p = path if path.startswith("/") else f"/{path}"
    return f"{base}{p}"


def extract_placeholders(template):
    return PLACEHOLDER_RE.findall(template or "")


def split_path_segments(path):
    if not isinstance(path, str) or not path.startswith("/") or "?" in path or "#" in path:
        return None
    if path == "/":
        return []
    parts = path.split("/")
    if parts[0] != "":
        return None
    segments = parts[1:]
    if any(seg == "" for seg in segments):
        return None
    return segments


def decode_path_segment_strict(segment):
    i = 0
    while i < len(segment):
        if segment[i] == "%":
            hex_part = segment[i + 1 : i + 3]
            if not re.fullmatch(r"[0-9A-Fa-f]{2}", hex_part):
                return None
            i += 3
        else:
            i += 1
    try:
        # + stays literal: protect then unquote
        return unquote(segment.replace("+", "%2B"), errors="strict")
    except Exception:
        return None


def parse_route_template(route):
    segments = split_path_segments(route)
    if segments is None:
        return None
    parsed = []
    names = set()
    for seg in segments:
        param_match = PARAM_SEG_RE.fullmatch(seg)
        if param_match:
            name = param_match.group(1)
            if name in names:
                return None
            names.add(name)
            parsed.append({"type": "param", "name": name})
        elif "{" in seg or "}" in seg:
            return None
        else:
            parsed.append({"type": "literal", "value": seg})
    return {"route": route, "segments": parsed, "names": list(names)}


def match_route(path, pages):
    path_segments = split_path_segments(path)
    if path_segments is None:
        return {"matched": False}

    decoded = []
    for seg in path_segments:
        d = decode_path_segment_strict(seg)
        if d is None or len(d) == 0:
            return {"matched": False}
        decoded.append(d)

    candidates = []
    for index, page in enumerate(pages or []):
        if not isinstance(page, dict):
            continue
        parsed = parse_route_template(page.get("route"))
        if not parsed or len(parsed["segments"]) != len(decoded):
            continue
        params = {}
        literal_count = 0
        ok = True
        for i, tmpl in enumerate(parsed["segments"]):
            actual = decoded[i]
            if tmpl["type"] == "literal":
                if tmpl["value"] != actual:
                    ok = False
                    break
                literal_count += 1
            else:
                params[tmpl["name"]] = actual
        if not ok:
            continue
        candidates.append({
            "page": page,
            "index": index,
            "params": params,
            "literalCount": literal_count,
            "routeLength": len(page.get("route") or ""),
        })

    if not candidates:
        return {"matched": False}

    candidates.sort(key=lambda c: (-c["literalCount"], -c["routeLength"], c["index"]))
    winner = candidates[0]
    return {
        "matched": True,
        "pageId": winner["page"].get("pageId"),
        "route": winner["page"].get("route"),
        "params": winner["params"],
        "index": winner["index"],
    }


def validate_manifest_m1(manifest):
    errors = []
    if not is_object(manifest):
        return {"ok": False, "errors": [{"code": "INVALID_MANIFEST", "path": ""}]}

    pv = manifest.get("protocolVersion")
    if not isinstance(pv, str) or not VERSION_PATTERN.fullmatch(pv):
        if pv is None:
            errors.append({"code": "MISSING_PROTOCOL_VERSION", "path": "protocolVersion"})
        else:
            errors.append({"code": "INVALID_PROTOCOL_VERSION", "path": "protocolVersion"})
    elif not version_at_least(pv, MANIFEST_MIN_PROTOCOL_VERSION):
        # M1 fieldset floor: app manifest is a v2.5+ artifact (V336).
        errors.append({"code": "PROTOCOL_VERSION_TOO_LOW", "path": "protocolVersion"})

    caps = manifest.get("requiredCapabilities") if isinstance(manifest.get("requiredCapabilities"), list) else []
    if "app.manifest" not in caps:
        errors.append({"code": "CAPABILITY_REQUIRED", "path": "requiredCapabilities", "detail": "app.manifest"})
    if "navigation" in manifest and "app.navigation" not in caps:
        errors.append({"code": "CAPABILITY_REQUIRED", "path": "requiredCapabilities", "detail": "app.navigation"})

    allowed_top = {"protocolVersion", "requiredCapabilities", "app", "pages", "navigation"}
    for key in manifest.keys():
        if key not in allowed_top:
            errors.append({"code": "UNKNOWN_MANIFEST_FIELD", "path": key})

    app = manifest.get("app")
    if not is_object(app):
        errors.append({"code": "INVALID_APP", "path": "app"})
        app = None
    else:
        if not isinstance(app.get("appId"), str) or not APP_ID_PATTERN.fullmatch(app["appId"]):
            errors.append({"code": "INVALID_APP_ID", "path": "app.appId"})
        if not app.get("name") and not app.get("nameKey"):
            errors.append({"code": "APP_NAME_REQUIRED", "path": "app"})
        logo = app.get("logo")
        if logo:
            for side in ("light", "dark"):
                if side not in logo:
                    continue
                url = logo[side]
                if not isinstance(url, str) or not (LOGO_REL_PATTERN.fullmatch(url) or LOGO_HTTPS_PATTERN.fullmatch(url)):
                    errors.append({"code": "INVALID_LOGO_URL", "path": f"app.logo.{side}"})

    pages = manifest.get("pages")
    if not isinstance(pages, list):
        errors.append({"code": "INVALID_PAGES", "path": "pages"})
        pages = None
    else:
        page_ids = set()
        routes = set()
        for index, page in enumerate(pages):
            if not is_object(page):
                errors.append({"code": "INVALID_PAGE_ENTRY", "path": f"pages[{index}]"})
                continue
            pid = page.get("pageId")
            if not isinstance(pid, str) or len(pid) == 0:
                errors.append({"code": "INVALID_PAGE_ID", "path": f"pages[{index}].pageId"})
            elif pid in page_ids:
                errors.append({"code": "DUPLICATE_PAGE_ID", "path": f"pages[{index}].pageId"})
            else:
                page_ids.add(pid)
            if not page.get("title") and not page.get("titleKey"):
                errors.append({"code": "PAGE_TITLE_REQUIRED", "path": f"pages[{index}]"})
            route = page.get("route")
            if not isinstance(route, str) or not REL_PATH_PATTERN.fullmatch(route):
                errors.append({"code": "INVALID_ROUTE", "path": f"pages[{index}].route"})
            else:
                parsed = parse_route_template(route)
                if not parsed:
                    errors.append({"code": "INVALID_ROUTE_TEMPLATE", "path": f"pages[{index}].route"})
                elif route in routes:
                    errors.append({"code": "DUPLICATE_ROUTE", "path": f"pages[{index}].route"})
                else:
                    routes.add(route)
            schema_url = page.get("schemaUrl")
            if not isinstance(schema_url, str) or not REL_PATH_PATTERN.fullmatch(schema_url):
                errors.append({"code": "INVALID_SCHEMA_URL", "path": f"pages[{index}].schemaUrl"})
            else:
                route_names = set(extract_placeholders(route or ""))
                for name in extract_placeholders(schema_url):
                    if name not in route_names:
                        errors.append({"code": "SCHEMA_URL_PLACEHOLDER_NOT_IN_ROUTE", "path": f"pages[{index}].schemaUrl"})

        if app is not None and "homePageRef" in app and app.get("homePageRef") is not None:
            if len(pages) == 0:
                errors.append({"code": "MANIFEST_HOME_PAGE_UNKNOWN", "path": "app.homePageRef"})
            else:
                home = next((p for p in pages if isinstance(p, dict) and p.get("pageId") == app.get("homePageRef")), None)
                if home is None:
                    errors.append({"code": "MANIFEST_HOME_PAGE_UNKNOWN", "path": "app.homePageRef"})
                elif len(extract_placeholders(home.get("route") or "")) > 0:
                    errors.append({"code": "MANIFEST_HOME_ROUTE_PARAMETRIC", "path": "app.homePageRef"})
        elif pages is not None and len(pages) > 0:
            errors.append({"code": "HOME_PAGE_REF_REQUIRED", "path": "app.homePageRef"})

        def ban_page_ref(items, path):
            if not isinstance(items, list):
                return
            for i, item in enumerate(items):
                if isinstance(item, dict) and "pageRef" in item:
                    errors.append({"code": "PAGE_REF_WITH_EMPTY_PAGES", "path": f"{path}[{i}].pageRef"})
                if isinstance(item, dict) and isinstance(item.get("items"), list):
                    ban_page_ref(item["items"], f"{path}[{i}].items")

        navigation = manifest.get("navigation")
        if navigation and len(pages) == 0:
            for slot in ("top", "sidebar", "user"):
                if slot in navigation:
                    ban_page_ref(navigation.get(slot), f"navigation.{slot}")

        if navigation:
            allowed_slots = {"top", "sidebar", "user"}
            for key in navigation.keys():
                if key not in allowed_slots:
                    errors.append({"code": "UNKNOWN_NAV_SLOT", "path": f"navigation.{key}"})

            def validate_link(link, path, empty_pages):
                if not is_object(link):
                    return
                has_page_ref = "pageRef" in link
                has_url = "url" in link
                if has_page_ref == has_url:
                    errors.append({"code": "NAV_LINK_MUTEX", "path": path})
                if has_page_ref:
                    if empty_pages or link.get("pageRef") not in page_ids:
                        code = "PAGE_REF_WITH_EMPTY_PAGES" if empty_pages else "NAV_PAGE_REF_UNKNOWN"
                        errors.append({"code": code, "path": f"{path}.pageRef"})
                if has_url and (not isinstance(link.get("url"), str) or not LOGO_REL_PATTERN.fullmatch(link["url"])):
                    errors.append({"code": "INVALID_NAV_URL", "path": f"{path}.url"})
                if has_url and not link.get("label") and not link.get("labelKey"):
                    errors.append({"code": "NAV_LABEL_REQUIRED", "path": path})
                perms = link.get("permissions")
                if perms is not None and (not isinstance(perms, dict) or any(k != "view" for k in perms.keys())):
                    errors.append({"code": "NAV_PERMISSIONS_VIEW_ONLY", "path": f"{path}.permissions"})

            def check_items(items, path):
                if not isinstance(items, list):
                    return
                for i, item in enumerate(items):
                    if not is_object(item):
                        continue
                    item_path = f"{path}[{i}]"
                    if isinstance(item.get("items"), list):
                        if not item.get("label") and not item.get("labelKey"):
                            errors.append({"code": "NAV_LABEL_REQUIRED", "path": item_path})
                        for j, link in enumerate(item["items"]):
                            if isinstance(link, dict) and isinstance(link.get("items"), list):
                                errors.append({"code": "NAV_GROUP_NESTED", "path": f"{item_path}.items[{j}]"})
                            validate_link(link, f"{item_path}.items[{j}]", len(pages) == 0)
                    else:
                        validate_link(item, item_path, len(pages) == 0)

            for slot in ("top", "sidebar", "user"):
                if slot in navigation:
                    check_items(navigation.get(slot), f"navigation.{slot}")

    return {"ok": len(errors) == 0, "errors": errors}


def resolve_logo_url(base_url, logo_url):
    if not isinstance(logo_url, str):
        return {"ok": False, "code": "INVALID_LOGO_URL"}
    if LOGO_HTTPS_PATTERN.fullmatch(logo_url):
        return {"ok": True, "url": logo_url}
    if logo_url.startswith("http:") or logo_url.startswith("data:"):
        return {"ok": False, "code": "INVALID_LOGO_URL"}
    if LOGO_REL_PATTERN.fullmatch(logo_url):
        return {"ok": True, "url": join_base_url(base_url, logo_url)}
    return {"ok": False, "code": "INVALID_LOGO_URL"}


def resolve_schema_url(base_url, schema_url_template, params):
    params = params or {}
    resolved = schema_url_template
    for name in extract_placeholders(schema_url_template):
        if name not in params or params[name] is None:
            return {"ok": False, "code": "MISSING_PATH_BINDING", "path": f"schemaUrl.{{{name}}}"}
        resolved = resolved.replace("{" + name + "}", quote(str(params[name]), safe=""))
    if "{" in resolved:
        return {"ok": False, "code": "MISSING_PATH_BINDING", "path": "schemaUrl"}
    return {"ok": True, "url": join_base_url(base_url, resolved)}


def resolve_home(manifest):
    pages = manifest.get("pages") or []
    ref = (manifest.get("app") or {}).get("homePageRef")
    if not ref:
        return {"ok": False, "code": "HOME_PAGE_REF_REQUIRED"}
    page = next((p for p in pages if isinstance(p, dict) and p.get("pageId") == ref), None)
    if page is None:
        return {"ok": False, "code": "MANIFEST_HOME_PAGE_UNKNOWN"}
    if len(extract_placeholders(page.get("route") or "")) > 0:
        return {"ok": False, "code": "MANIFEST_HOME_ROUTE_PARAMETRIC"}
    return {
        "ok": True,
        "path": page["route"],
        "pageId": page["pageId"],
        "route": {"path": page["route"], "params": {}, "query": {}},
    }


def evaluate_app_manifest(input_data):
    operation = input_data.get("operation") or "validate"

    if operation == "negotiate":
        manifest = input_data.get("manifest") or {}
        return negotiate_protocol(
            {
                "protocolVersion": manifest.get("protocolVersion"),
                "requiredCapabilities": manifest.get("requiredCapabilities"),
            },
            input_data.get("rendererSupport") or {},
        )

    if operation == "load":
        if input_data.get("loadError"):
            return {"ok": False, "code": "MANIFEST_LOAD_FAILED", "renderPages": False}
        return {"ok": True, "code": "OK", "renderPages": True}

    if operation == "validate":
        result = validate_manifest_m1(input_data.get("manifest"))
        if not result["ok"]:
            first = result["errors"][0]
            return {"ok": False, "code": first["code"], "path": first.get("path"), "errors": result["errors"]}
        return {"ok": True}

    if operation == "matchRoute":
        pages = (input_data.get("manifest") or {}).get("pages") if input_data.get("manifest") else input_data.get("pages")
        return match_route(input_data.get("path"), pages or [])

    if operation == "resolveHome":
        if input_data.get("deepLinkPath"):
            match = match_route(input_data["deepLinkPath"], (input_data.get("manifest") or {}).get("pages") or [])
            if match.get("matched"):
                return {
                    "ok": True,
                    "source": "deepLink",
                    "path": input_data["deepLinkPath"],
                    "pageId": match["pageId"],
                    "route": {
                        "path": input_data["deepLinkPath"],
                        "params": match["params"],
                        "query": input_data.get("query") or {},
                    },
                }
        home = resolve_home(input_data.get("manifest") or {})
        if not home.get("ok"):
            return home
        return {**home, "source": "home"}

    if operation == "resolveSchemaUrl":
        return resolve_schema_url(input_data.get("baseURL") or "", input_data.get("schemaUrl"), input_data.get("params") or {})

    if operation == "resolveLogo":
        return resolve_logo_url(input_data.get("baseURL") or "", input_data.get("logoUrl"))

    if operation == "pageIdMatch":
        if input_data.get("registryPageId") != input_data.get("schemaMetaPageId"):
            return {"ok": False, "code": "MANIFEST_PAGE_ID_MISMATCH"}
        return {"ok": True}

    if operation == "navigate":
        app_path = input_data.get("appPath")
        match = match_route(app_path, (input_data.get("manifest") or {}).get("pages") or [])
        if match.get("matched"):
            return {
                "ok": True,
                "navigated": True,
                "registryHit": True,
                "route": {
                    "path": app_path,
                    "params": match["params"],
                    "query": input_data.get("query") or {},
                },
            }
        return {
            "ok": True,
            "navigated": True,
            "registryHit": False,
            "route": {
                "path": app_path,
                "params": {},
                "query": input_data.get("query") or {},
            },
        }

    if operation == "decoupledVersions":
        manifest = input_data.get("manifest") or {}
        manifest_neg = negotiate_protocol(
            {
                "protocolVersion": manifest.get("protocolVersion"),
                "requiredCapabilities": manifest.get("requiredCapabilities") or ["app.manifest"],
            },
            input_data.get("rendererSupport") or {},
        )
        page_neg = negotiate_protocol(
            input_data.get("pageMeta") or {},
            input_data.get("pageRendererSupport") or input_data.get("rendererSupport") or {},
        )
        return {
            "manifest": manifest_neg,
            "page": page_neg,
            "ok": manifest_neg.get("accepted"),
        }

    raise ValueError(f"Unknown app-manifest operation: {operation}")
