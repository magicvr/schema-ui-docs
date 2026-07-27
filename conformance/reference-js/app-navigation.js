'use strict';

const { matchRoute } = require('./app-manifest');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
    const result = validateNavigationStructure(navigation);
    if (!result.ok) {
      return { ok: false, code: result.errors[0].code, path: result.errors[0].path, errors: result.errors };
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
};
