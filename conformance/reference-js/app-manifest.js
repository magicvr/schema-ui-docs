'use strict';

const { negotiateProtocol } = require('./version-negotiation');

const VERSION_PATTERN = /^[0-9]+\.[0-9]+$/;
const APP_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
const PARAM_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const REL_PATH_PATTERN = /^\/(?!\/)[^\s\\]*$/;
const LOGO_REL_PATTERN = /^\/(?!\/)[^\s\\{}]*$/;
const LOGO_HTTPS_PATTERN = /^https:\/\/[^\s\\]+$/;
const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Manifest fieldset floor is 2.5 (M1). Page meta versions remain decoupled (D1a). */
function versionAtLeast(version, floor) {
  const parsed = /^([0-9]+)\.([0-9]+)$/.exec(version || '');
  if (!parsed) return false;
  const [major, minor] = parsed.slice(1).map(Number);
  const [floorMajor, floorMinor] = floor.split('.').map(Number);
  return major > floorMajor || (major === floorMajor && minor >= floorMinor);
}

const MANIFEST_MIN_PROTOCOL_VERSION = '2.5';
/** returnIntentQueryKeys fieldset floor (ADR-0036 / 10 §3.7 / 09 §6). */
const RETURN_INTENT_MIN_PROTOCOL_VERSION = '2.8';
const RETURN_INTENT_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

function joinBaseUrl(baseURL, path) {
  const base = String(baseURL || '').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function extractPlaceholders(template) {
  const names = [];
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let match;
  while ((match = re.exec(template)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function splitPathSegments(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('?') || path.includes('#')) {
    return null;
  }
  if (path === '/') return [];
  const parts = path.split('/');
  if (parts[0] !== '') return null;
  const segments = parts.slice(1);
  if (segments.some(seg => seg.length === 0)) return null; // empty segment / //
  return segments;
}

function decodePathSegment(segment) {
  // RFC 3986 percent-decode; + stays literal; illegal % fails
  let out = '';
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch === '%') {
      const hex = segment.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return null;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 2;
    } else {
      out += ch;
    }
  }
  try {
    // percent-decode produces raw bytes as latin1 chars above; re-interpret as UTF-8 via decodeURIComponent path
    // Our loop already decoded %HH to char codes; for multi-byte UTF-8 we need decodeURIComponent on the original
    return decodeURIComponent(segment.replace(/\+/g, '%2B'));
  } catch {
    return null;
  }
}

function decodePathSegmentStrict(segment) {
  // Validate % sequences then decode with + literal
  for (let i = 0; i < segment.length; i += 1) {
    if (segment[i] === '%') {
      const hex = segment.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return null;
      i += 2;
    }
  }
  try {
    return decodeURIComponent(segment.replace(/\+/g, '%2B'));
  } catch {
    return null;
  }
}

function parseRouteTemplate(route) {
  const segments = splitPathSegments(route);
  if (segments === null) return null;
  const parsed = [];
  const names = new Set();
  for (const seg of segments) {
    const paramMatch = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/.exec(seg);
    if (paramMatch) {
      if (names.has(paramMatch[1])) return null;
      names.add(paramMatch[1]);
      parsed.push({ type: 'param', name: paramMatch[1] });
    } else if (seg.includes('{') || seg.includes('}')) {
      return null;
    } else {
      parsed.push({ type: 'literal', value: seg });
    }
  }
  return { route, segments: parsed, names: [...names] };
}

/**
 * D4a route match against pages[].route templates.
 */
function matchRoute(path, pages) {
  const pathSegments = splitPathSegments(path);
  if (pathSegments === null) {
    return { matched: false };
  }

  const decodedPathSegs = [];
  for (const seg of pathSegments) {
    const decoded = decodePathSegmentStrict(seg);
    if (decoded === null || decoded.length === 0) {
      return { matched: false };
    }
    decodedPathSegs.push(decoded);
  }

  const candidates = [];
  (Array.isArray(pages) ? pages : []).forEach((page, index) => {
    const parsed = parseRouteTemplate(page.route);
    if (!parsed || parsed.segments.length !== decodedPathSegs.length) return;

    const params = {};
    let literalCount = 0;
    for (let i = 0; i < parsed.segments.length; i += 1) {
      const tmpl = parsed.segments[i];
      const actual = decodedPathSegs[i];
      if (tmpl.type === 'literal') {
        if (tmpl.value !== actual) return;
        literalCount += 1;
      } else {
        params[tmpl.name] = actual;
      }
    }
    candidates.push({
      page,
      index,
      params,
      literalCount,
      routeLength: page.route.length,
    });
  });

  if (candidates.length === 0) return { matched: false };

  candidates.sort((a, b) => {
    if (b.literalCount !== a.literalCount) return b.literalCount - a.literalCount;
    if (b.routeLength !== a.routeLength) return b.routeLength - a.routeLength;
    return a.index - b.index;
  });

  const winner = candidates[0];
  return {
    matched: true,
    pageId: winner.page.pageId,
    route: winner.page.route,
    params: winner.params,
    index: winner.index,
  };
}

function validateManifestM1(manifest) {
  const errors = [];
  if (!isObject(manifest)) {
    return { ok: false, errors: [{ code: 'INVALID_MANIFEST', path: '' }] };
  }

  if (typeof manifest.protocolVersion !== 'string' || !VERSION_PATTERN.test(manifest.protocolVersion)) {
    if (manifest.protocolVersion === undefined || manifest.protocolVersion === null) {
      errors.push({ code: 'MISSING_PROTOCOL_VERSION', path: 'protocolVersion' });
    } else {
      errors.push({ code: 'INVALID_PROTOCOL_VERSION', path: 'protocolVersion' });
    }
  } else if (!versionAtLeast(manifest.protocolVersion, MANIFEST_MIN_PROTOCOL_VERSION)) {
    // M1 fieldset floor: app manifest is a v2.5+ artifact (V336).
    errors.push({ code: 'PROTOCOL_VERSION_TOO_LOW', path: 'protocolVersion' });
  }

  const caps = Array.isArray(manifest.requiredCapabilities) ? manifest.requiredCapabilities : [];
  if (!caps.includes('app.manifest')) {
    errors.push({ code: 'CAPABILITY_REQUIRED', path: 'requiredCapabilities', detail: 'app.manifest' });
  }
  if (Object.prototype.hasOwnProperty.call(manifest, 'navigation') && !caps.includes('app.navigation')) {
    errors.push({ code: 'CAPABILITY_REQUIRED', path: 'requiredCapabilities', detail: 'app.navigation' });
  }

  // unknown top-level keys (M0 / runtime UNKNOWN_MANIFEST_FIELD)
  const allowedTop = new Set(['protocolVersion', 'requiredCapabilities', 'app', 'pages', 'navigation']);
  for (const key of Object.keys(manifest)) {
    if (!allowedTop.has(key)) {
      errors.push({ code: 'UNKNOWN_MANIFEST_FIELD', path: key });
    }
  }

  const app = manifest.app;
  if (!isObject(app)) {
    errors.push({ code: 'INVALID_APP', path: 'app' });
  } else {
    if (typeof app.appId !== 'string' || !APP_ID_PATTERN.test(app.appId)) {
      errors.push({ code: 'INVALID_APP_ID', path: 'app.appId' });
    }
    if (!app.name && !app.nameKey) {
      errors.push({ code: 'APP_NAME_REQUIRED', path: 'app' });
    }
    if (app.logo) {
      for (const side of ['light', 'dark']) {
        if (app.logo[side] === undefined) continue;
        const url = app.logo[side];
        if (typeof url !== 'string'
          || !(LOGO_REL_PATTERN.test(url) || LOGO_HTTPS_PATTERN.test(url))) {
          errors.push({ code: 'INVALID_LOGO_URL', path: `app.logo.${side}` });
        }
      }
    }
  }

  const pages = Array.isArray(manifest.pages) ? manifest.pages : null;
  if (!pages) {
    errors.push({ code: 'INVALID_PAGES', path: 'pages' });
  } else {
    const pageIds = new Set();
    const routes = new Set();
    pages.forEach((page, index) => {
      if (!isObject(page)) {
        errors.push({ code: 'INVALID_PAGE_ENTRY', path: `pages[${index}]` });
        return;
      }
      if (typeof page.pageId !== 'string' || page.pageId.length === 0) {
        errors.push({ code: 'INVALID_PAGE_ID', path: `pages[${index}].pageId` });
      } else if (pageIds.has(page.pageId)) {
        errors.push({ code: 'DUPLICATE_PAGE_ID', path: `pages[${index}].pageId` });
      } else {
        pageIds.add(page.pageId);
      }
      if (!page.title && !page.titleKey) {
        errors.push({ code: 'PAGE_TITLE_REQUIRED', path: `pages[${index}]` });
      }
      if (typeof page.route !== 'string' || !REL_PATH_PATTERN.test(page.route)) {
        errors.push({ code: 'INVALID_ROUTE', path: `pages[${index}].route` });
      } else {
        const parsed = parseRouteTemplate(page.route);
        if (!parsed) {
          errors.push({ code: 'INVALID_ROUTE_TEMPLATE', path: `pages[${index}].route` });
        } else if (routes.has(page.route)) {
          errors.push({ code: 'DUPLICATE_ROUTE', path: `pages[${index}].route` });
        } else {
          routes.add(page.route);
        }
      }
      if (typeof page.schemaUrl !== 'string' || !REL_PATH_PATTERN.test(page.schemaUrl)) {
        errors.push({ code: 'INVALID_SCHEMA_URL', path: `pages[${index}].schemaUrl` });
      } else {
        const routeNames = new Set(extractPlaceholders(page.route || ''));
        const schemaNames = extractPlaceholders(page.schemaUrl);
        for (const name of schemaNames) {
          if (!routeNames.has(name)) {
            errors.push({ code: 'SCHEMA_URL_PLACEHOLDER_NOT_IN_ROUTE', path: `pages[${index}].schemaUrl` });
          }
        }
      }
      // v2.8+ return intent allowlist extension (ADR-0036 / 09 §6 / 10 §3.7):
      // presence ⇒ protocolVersion >= 2.8 AND host.failure-recovery capability.
      if (page.returnIntentQueryKeys !== undefined) {
        const keys = page.returnIntentQueryKeys;
        const keysValid = Array.isArray(keys)
          && keys.length > 0
          && keys.every(key => typeof key === 'string' && RETURN_INTENT_KEY_PATTERN.test(key))
          && new Set(keys).size === keys.length;
        if (!keysValid) {
          errors.push({ code: 'INVALID_RETURN_INTENT_QUERY_KEYS', path: `pages[${index}].returnIntentQueryKeys` });
        }
        const versionComparable = typeof manifest.protocolVersion === 'string'
          && VERSION_PATTERN.test(manifest.protocolVersion);
        if (versionComparable && !versionAtLeast(manifest.protocolVersion, RETURN_INTENT_MIN_PROTOCOL_VERSION)) {
          errors.push({ code: 'PROTOCOL_VERSION_TOO_LOW', path: `pages[${index}].returnIntentQueryKeys` });
        }
        if (versionComparable && versionAtLeast(manifest.protocolVersion, RETURN_INTENT_MIN_PROTOCOL_VERSION)
          && !caps.includes('host.failure-recovery')) {
          errors.push({ code: 'MISSING_REQUIRED_CAPABILITY', path: `pages[${index}].returnIntentQueryKeys`, detail: 'host.failure-recovery' });
        }
      }
    });

    if (app && app.homePageRef !== undefined) {
      if (pages.length === 0) {
        errors.push({ code: 'MANIFEST_HOME_PAGE_UNKNOWN', path: 'app.homePageRef' });
      } else {
        const home = pages.find(p => p && p.pageId === app.homePageRef);
        if (!home) {
          errors.push({ code: 'MANIFEST_HOME_PAGE_UNKNOWN', path: 'app.homePageRef' });
        } else if (extractPlaceholders(home.route || '').length > 0) {
          errors.push({ code: 'MANIFEST_HOME_ROUTE_PARAMETRIC', path: 'app.homePageRef' });
        }
      }
    } else if (pages && pages.length > 0) {
      errors.push({ code: 'HOME_PAGE_REF_REQUIRED', path: 'app.homePageRef' });
    }

    if (manifest.navigation && pages.length === 0) {
      const banPageRef = (items, path) => {
        if (!Array.isArray(items)) return;
        items.forEach((item, i) => {
          if (item && item.pageRef !== undefined) {
            errors.push({ code: 'PAGE_REF_WITH_EMPTY_PAGES', path: `${path}[${i}].pageRef` });
          }
          if (item && Array.isArray(item.items)) {
            banPageRef(item.items, `${path}[${i}].items`);
          }
        });
      };
      for (const slot of ['top', 'sidebar', 'user']) {
        if (manifest.navigation[slot]) banPageRef(manifest.navigation[slot], `navigation.${slot}`);
      }
    }

    if (manifest.navigation) {
      const allowedSlots = new Set(['top', 'sidebar', 'user']);
      for (const key of Object.keys(manifest.navigation)) {
        if (!allowedSlots.has(key)) {
          errors.push({ code: 'UNKNOWN_NAV_SLOT', path: `navigation.${key}` });
        }
      }
      const checkItems = (items, path) => {
        if (!Array.isArray(items)) return;
        items.forEach((item, i) => {
          if (!isObject(item)) return;
          const itemPath = `${path}[${i}]`;
          if (Array.isArray(item.items)) {
            // group
            if (!item.label && !item.labelKey) {
              errors.push({ code: 'NAV_LABEL_REQUIRED', path: itemPath });
            }
            item.items.forEach((link, j) => {
              if (link && Array.isArray(link.items)) {
                errors.push({ code: 'NAV_GROUP_NESTED', path: `${itemPath}.items[${j}]` });
              }
              validateLink(link, `${itemPath}.items[${j}]`, pageIds, pages.length === 0);
            });
          } else {
            validateLink(item, itemPath, pageIds, pages.length === 0);
          }
        });
      };
      const validateLink = (link, path, pageIds, emptyPages) => {
        if (!isObject(link)) return;
        const hasPageRef = link.pageRef !== undefined;
        const hasUrl = link.url !== undefined;
        if (hasPageRef === hasUrl) {
          errors.push({ code: 'NAV_LINK_MUTEX', path });
        }
        if (hasPageRef) {
          if (emptyPages || !pageIds.has(link.pageRef)) {
            errors.push({ code: emptyPages ? 'PAGE_REF_WITH_EMPTY_PAGES' : 'NAV_PAGE_REF_UNKNOWN', path: `${path}.pageRef` });
          }
        }
        if (hasUrl && (typeof link.url !== 'string' || !LOGO_REL_PATTERN.test(link.url))) {
          errors.push({ code: 'INVALID_NAV_URL', path: `${path}.url` });
        }
        if (hasUrl && !link.label && !link.labelKey) {
          errors.push({ code: 'NAV_LABEL_REQUIRED', path });
        }
        if (link.permissions && (typeof link.permissions !== 'object'
          || Array.isArray(link.permissions)
          || Object.keys(link.permissions).some(k => k !== 'view'))) {
          errors.push({ code: 'NAV_PERMISSIONS_VIEW_ONLY', path: `${path}.permissions` });
        }
      };
      for (const slot of ['top', 'sidebar', 'user']) {
        if (manifest.navigation[slot]) checkItems(manifest.navigation[slot], `navigation.${slot}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function resolveLogoUrl(baseURL, logoUrl) {
  if (typeof logoUrl !== 'string') {
    return { ok: false, code: 'INVALID_LOGO_URL' };
  }
  if (LOGO_HTTPS_PATTERN.test(logoUrl)) {
    return { ok: true, url: logoUrl };
  }
  if (logoUrl.startsWith('http:') || logoUrl.startsWith('data:')) {
    return { ok: false, code: 'INVALID_LOGO_URL' };
  }
  if (LOGO_REL_PATTERN.test(logoUrl)) {
    return { ok: true, url: joinBaseUrl(baseURL, logoUrl) };
  }
  return { ok: false, code: 'INVALID_LOGO_URL' };
}

function resolveSchemaUrl(baseURL, schemaUrlTemplate, params) {
  const names = extractPlaceholders(schemaUrlTemplate);
  let resolved = schemaUrlTemplate;
  for (const name of names) {
    if (params[name] === undefined || params[name] === null) {
      return { ok: false, code: 'MISSING_PATH_BINDING', path: `schemaUrl.{${name}}` };
    }
    resolved = resolved.split(`{${name}}`).join(encodeURIComponent(String(params[name])));
  }
  if (resolved.includes('{')) {
    return { ok: false, code: 'MISSING_PATH_BINDING', path: 'schemaUrl' };
  }
  return { ok: true, url: joinBaseUrl(baseURL, resolved) };
}

function resolveHome(manifest) {
  const pages = manifest.pages || [];
  const ref = manifest.app?.homePageRef;
  if (!ref) return { ok: false, code: 'HOME_PAGE_REF_REQUIRED' };
  const page = pages.find(p => p.pageId === ref);
  if (!page) return { ok: false, code: 'MANIFEST_HOME_PAGE_UNKNOWN' };
  if (extractPlaceholders(page.route).length > 0) {
    return { ok: false, code: 'MANIFEST_HOME_ROUTE_PARAMETRIC' };
  }
  return {
    ok: true,
    path: page.route,
    pageId: page.pageId,
    route: {
      path: page.route,
      params: {},
      query: {},
    },
  };
}

/**
 * Unified app-manifest conformance entry.
 * input.operation dispatches algorithms.
 */
function evaluateAppManifest(input) {
  const operation = input.operation || 'validate';

  if (operation === 'negotiate') {
    const result = negotiateProtocol(
      {
        protocolVersion: input.manifest?.protocolVersion,
        requiredCapabilities: input.manifest?.requiredCapabilities,
      },
      input.rendererSupport || {},
    );
    return result;
  }

  if (operation === 'load') {
    if (input.loadError) {
      return { ok: false, code: 'MANIFEST_LOAD_FAILED', renderPages: false };
    }
    return { ok: true, code: 'OK', renderPages: true };
  }

  if (operation === 'validate') {
    const result = validateManifestM1(input.manifest);
    if (!result.ok) {
      return { ok: false, code: result.errors[0].code, path: result.errors[0].path, errors: result.errors };
    }
    return { ok: true };
  }

  if (operation === 'matchRoute') {
    const result = matchRoute(input.path, input.manifest?.pages || input.pages || []);
    return result;
  }

  if (operation === 'resolveHome') {
    // deep link takes priority when provided and matches
    if (input.deepLinkPath) {
      const match = matchRoute(input.deepLinkPath, input.manifest.pages || []);
      if (match.matched) {
        return {
          ok: true,
          source: 'deepLink',
          path: input.deepLinkPath,
          pageId: match.pageId,
          route: {
            path: input.deepLinkPath,
            params: match.params,
            query: input.query || {},
          },
        };
      }
    }
    const home = resolveHome(input.manifest);
    if (!home.ok) return home;
    return { ...home, source: 'home' };
  }

  if (operation === 'resolveSchemaUrl') {
    return resolveSchemaUrl(input.baseURL || '', input.schemaUrl, input.params || {});
  }

  if (operation === 'resolveLogo') {
    return resolveLogoUrl(input.baseURL || '', input.logoUrl);
  }

  if (operation === 'pageIdMatch') {
    const regId = input.registryPageId;
    const metaId = input.schemaMetaPageId;
    if (regId !== metaId) {
      return { ok: false, code: 'MANIFEST_PAGE_ID_MISMATCH' };
    }
    return { ok: true };
  }

  if (operation === 'navigate') {
    const appPath = input.appPath; // path without query
    const match = matchRoute(appPath, input.manifest?.pages || []);
    if (match.matched) {
      return {
        ok: true,
        navigated: true,
        registryHit: true,
        route: {
          path: appPath,
          params: match.params,
          query: input.query || {},
        },
      };
    }
    return {
      ok: true,
      navigated: true,
      registryHit: false,
      route: {
        path: appPath,
        params: {},
        query: input.query || {},
      },
    };
  }

  if (operation === 'decoupledVersions') {
    // Manifest 2.5 accepted; page version negotiated independently
    const manifestNeg = negotiateProtocol(
      {
        protocolVersion: input.manifest?.protocolVersion,
        requiredCapabilities: input.manifest?.requiredCapabilities || ['app.manifest'],
      },
      input.rendererSupport || {},
    );
    const pageNeg = negotiateProtocol(
      input.pageMeta || {},
      input.pageRendererSupport || input.rendererSupport || {},
    );
    return {
      manifest: manifestNeg,
      page: pageNeg,
      ok: manifestNeg.accepted, // page failure does not fail manifest
    };
  }

  throw new Error(`Unknown app-manifest operation: ${operation}`);
}

module.exports = {
  evaluateAppManifest,
  matchRoute,
  validateManifestM1,
  resolveLogoUrl,
  resolveSchemaUrl,
  resolveHome,
  joinBaseUrl,
  decodePathSegmentStrict,
  parseRouteTemplate,
};
