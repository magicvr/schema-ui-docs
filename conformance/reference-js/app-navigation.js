'use strict';

const { matchRoute } = require('./app-manifest');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const VAR_RE = /\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
const ALLOWED_NAV_CONTEXT_ROOTS = new Set(['user', 'features']);

/**
 * Minimal expression eval for navigation filter fixtures.
 * Supports:
 *   - boolean literals / pre-evaluated booleans in input.permissionsValues / visibleWhenValues
 *   - "$context.user.roles contains \"admin\"" style via precomputed maps
 *
 * Fixtures supply resolved booleans under:
 *   input.permissionResults: { "path.to.item": true/false } optional
 * Or inline evaluated flags on items: _view / _when (test harness style)
 *
 * Production path: fixtures pass `context` and simple expression subset.
 */

function evalSimpleWhen(when, context) {
  if (when === undefined || when === null) return true;
  if (typeof when === 'boolean') return when;
  if (typeof when !== 'string') return false;

  // $context.user.roles contains "X"
  const containsMatch = /^\$context\.user\.roles\s+contains\s+"([^"]+)"$/.exec(when.trim());
  if (containsMatch) {
    const roles = context?.user?.roles;
    return Array.isArray(roles) && roles.includes(containsMatch[1]);
  }

  // $context.features.X == true|false
  const featureMatch = /^\$context\.features\.([a-zA-Z0-9_]+)\s*==\s*(true|false)$/.exec(when.trim());
  if (featureMatch) {
    const actual = context?.features?.[featureMatch[1]];
    const expected = featureMatch[2] === 'true';
    return actual === expected;
  }

  // $context.user.id == "..."
  const idMatch = /^\$context\.user\.id\s*==\s*"([^"]*)"$/.exec(when.trim());
  if (idMatch) {
    return context?.user?.id === idMatch[1];
  }

  // Unknown expression → fail-closed hide (M3a runtime stand-in)
  return false;
}

/**
 * M3a static check for navigation visibleWhen / permissions (non-form L3a rules).
 * Only $context.user.* / $context.features.* are allowed; illegal expressions are reported
 * as structured errors and must not be silently treated as "permission denied".
 */
function validateNavExpression(expr, path) {
  if (expr === undefined || expr === null) return null;
  if (typeof expr === 'boolean') return null;
  if (typeof expr !== 'string') {
    return { code: 'SYNTAX', path };
  }
  const trimmed = expr.trim();
  if (!trimmed) {
    return { code: 'SYNTAX', path };
  }

  // Basic syntax: unbalanced quotes / parens, dangling operators.
  if (((trimmed.match(/"/g) || []).length % 2) !== 0) {
    return { code: 'SYNTAX', path };
  }
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) return { code: 'SYNTAX', path };
  }
  if (depth !== 0) return { code: 'SYNTAX', path };
  if (/(?:==|!=|<=|>=|<|>|&&|\|\||\bcontains\b)\s*$/.test(trimmed)) {
    return { code: 'SYNTAX', path };
  }
  if (/^\s*(?:==|!=|<=|>=|<|>|&&|\|\||\bcontains\b)/.test(trimmed)) {
    return { code: 'SYNTAX', path };
  }
  // Bare `$` or incomplete `$` tokens that are not full variables.
  if (/\$(?![A-Za-z_])/.test(trimmed)) {
    return { code: 'SYNTAX', path };
  }

  const vars = trimmed.match(VAR_RE) || [];
  for (const variableName of vars) {
    if (
      variableName === '$self'
      || variableName.startsWith('$self.')
      || variableName === '$deps'
      || variableName.startsWith('$deps.')
      || variableName === '$row'
      || variableName.startsWith('$row.')
      || variableName === '$parentRow'
      || variableName.startsWith('$parentRow.')
    ) {
      return { code: 'FORBIDDEN_VARIABLE', path };
    }
    if (variableName.startsWith('$context.')) {
      const root = variableName.slice('$context.'.length).split('.')[0];
      if (!ALLOWED_NAV_CONTEXT_ROOTS.has(root)) {
        return { code: 'FORBIDDEN_CONTEXT_NAMESPACE', path };
      }
      continue;
    }
    return { code: 'UNKNOWN_VARIABLE', path };
  }

  return null;
}

function collectNavExpressionErrors(items, pathPrefix, errors) {
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    if (!isObject(item)) return;
    const itemPath = `${pathPrefix}[${index}]`;
    if (item.visibleWhen !== undefined && item.visibleWhen !== null) {
      const when = isObject(item.visibleWhen) ? item.visibleWhen.when : item.visibleWhen;
      const err = validateNavExpression(when, `${itemPath}.visibleWhen.when`);
      if (err) errors.push(err);
    }
    if (item.permissions !== undefined && item.permissions !== null) {
      if (isObject(item.permissions) && Object.prototype.hasOwnProperty.call(item.permissions, 'view')) {
        const err = validateNavExpression(item.permissions.view, `${itemPath}.permissions.view`);
        if (err) errors.push(err);
      }
    }
    if (Array.isArray(item.items)) {
      collectNavExpressionErrors(item.items, `${itemPath}.items`, errors);
    }
  });
}

function evalPermissionsView(permissions, context) {
  if (!permissions || permissions.view === undefined) return true;
  if (typeof permissions.view === 'boolean') return permissions.view;
  return evalSimpleWhen(permissions.view, context);
}

function evalVisibleWhen(visibleWhen, context) {
  if (!visibleWhen) return true;
  const when = typeof visibleWhen === 'object' ? visibleWhen.when : visibleWhen;
  return evalSimpleWhen(when, context);
}

function isVisible(item, context) {
  return evalPermissionsView(item.permissions, context) && evalVisibleWhen(item.visibleWhen, context);
}

function isLink(item) {
  return isObject(item) && !Array.isArray(item.items);
}

function isGroup(item) {
  return isObject(item) && Array.isArray(item.items);
}

function filterItems(items, context) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (isGroup(item)) {
      if (!isVisible(item, context)) continue;
      const children = filterItems(item.items, context).filter(isLink);
      // groups only contain links after filter; empty group pruned
      if (children.length === 0) continue;
      const group = {
        type: 'group',
        items: children.map(link => projectLink(link)),
      };
      if (item.label !== undefined) group.label = item.label;
      if (item.labelKey !== undefined) group.labelKey = item.labelKey;
      if (item.icon !== undefined) {
        group.icon = item.icon;
        group.iconRendered = true; // icon presence; host may still omit graphic
      }
      out.push(group);
    } else if (isLink(item)) {
      if (!isVisible(item, context)) continue;
      out.push(projectLink(item));
    }
  }
  return out;
}

function projectLink(link) {
  const projected = {
    type: 'link',
  };
  if (link.pageRef !== undefined) projected.pageRef = link.pageRef;
  if (link.url !== undefined) projected.url = link.url;
  if (link.label !== undefined) projected.label = link.label;
  if (link.labelKey !== undefined) projected.labelKey = link.labelKey;
  if (link.icon !== undefined) {
    projected.icon = link.icon;
    // icon degradation is host-side; protocol: omit graphic still render text
    projected.iconOptional = true;
  }
  return projected;
}

function highlightLink(link, path, pages) {
  if (link.pageRef !== undefined) {
    const page = (pages || []).find(p => p.pageId === link.pageRef);
    if (!page) return false;
    // Single-template D4a match
    const result = matchRoute(path, [page]);
    return result.matched === true;
  }
  if (link.url !== undefined) {
    return link.url === path;
  }
  return false;
}

function applyHighlight(items, path, pages) {
  return items.map(item => {
    if (item.type === 'group') {
      return {
        ...item,
        items: item.items.map(link => ({
          ...link,
          active: highlightLink(link, path, pages),
        })),
      };
    }
    return {
      ...item,
      active: highlightLink(item, path, pages),
    };
  });
}

function validateNavigationStructure(navigation) {
  const errors = [];
  if (!isObject(navigation)) {
    return { ok: false, errors: [{ code: 'INVALID_NAVIGATION' }] };
  }
  const allowed = new Set(['top', 'sidebar', 'user']);
  for (const key of Object.keys(navigation)) {
    if (!allowed.has(key)) {
      errors.push({ code: 'UNKNOWN_NAV_SLOT', path: `navigation.${key}` });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** M3a static expression layer (parallel to structure checks; not mixed into runtime filter). */
function validateNavigationM3a(navigation) {
  const errors = [];
  if (!isObject(navigation)) {
    return { ok: false, errors: [{ code: 'INVALID_NAVIGATION' }] };
  }
  for (const slot of ['top', 'sidebar', 'user']) {
    if (!Object.prototype.hasOwnProperty.call(navigation, slot)) continue;
    collectNavExpressionErrors(navigation[slot], `navigation.${slot}`, errors);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * input:
 *   operation: "filter" | "highlight" | "validate" | "project" (filter+highlight)
 *   navigation, pages, context, path
 *   iconRegistry?: string[] — if provided, icons not in registry get iconRendered:false
 */
function evaluateAppNavigation(input) {
  const operation = input.operation || 'project';
  const navigation = input.navigation || {};
  const context = input.context || {};
  const pages = input.pages || input.manifest?.pages || [];
  const path = input.path || '/';

  if (operation === 'validate') {
    const struct = validateNavigationStructure(navigation);
    if (!struct.ok) {
      return { ok: false, code: struct.errors[0].code, path: struct.errors[0].path, errors: struct.errors };
    }
    const m3a = validateNavigationM3a(navigation);
    if (!m3a.ok) {
      return { ok: false, code: m3a.errors[0].code, path: m3a.errors[0].path, errors: m3a.errors };
    }
    return { ok: true };
  }

  const struct = validateNavigationStructure(navigation);
  if (!struct.ok) {
    return { ok: false, code: struct.errors[0].code, path: struct.errors[0].path, errors: struct.errors };
  }

  const slots = {};
  for (const slot of ['top', 'sidebar', 'user']) {
    if (!Object.prototype.hasOwnProperty.call(navigation, slot)) continue;
    let items = filterItems(navigation[slot], context);
    if (operation === 'highlight' || operation === 'project') {
      items = applyHighlight(items, path, pages);
    }
    // icon registry degradation
    if (Array.isArray(input.iconRegistry)) {
      const registry = new Set(input.iconRegistry);
      const degrade = list => list.map(item => {
        if (item.type === 'group') {
          const group = { ...item, items: degrade(item.items) };
          if (group.icon !== undefined && !registry.has(group.icon)) {
            group.iconRendered = false;
          }
          return group;
        }
        if (item.icon !== undefined && !registry.has(item.icon)) {
          return { ...item, iconRendered: false };
        }
        if (item.icon !== undefined) {
          return { ...item, iconRendered: true };
        }
        return item;
      });
      items = degrade(items);
    }
    slots[slot] = items;
  }

  return { ok: true, slots };
}

module.exports = {
  evaluateAppNavigation,
  filterItems,
  highlightLink,
  evalSimpleWhen,
  validateNavExpression,
};
