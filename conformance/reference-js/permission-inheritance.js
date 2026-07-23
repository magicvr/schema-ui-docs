'use strict';

const CASCADE_TYPES = new Set(['section', 'grid', 'form', 'tabs', 'table']);
const CASCADE_KEYS = new Set(['edit', 'delete']);
const EDITABLE_FORM_TYPES = new Set(['input', 'inputNumber', 'datePicker', 'dateRangePicker', 'select', 'upload']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function versionAtLeast(version, floor) {
  const parsed = /^([0-9]+)\.([0-9]+)$/.exec(version || '');
  if (!parsed) return false;
  const [major, minor] = parsed.slice(1).map(Number);
  const [floorMajor, floorMinor] = floor.split('.').map(Number);
  return major > floorMajor || (major === floorMajor && minor >= floorMinor);
}

function hasInheritanceFields(page) {
  let found = false;
  const scanNode = node => {
    if (!isObject(node)) return;
    if (hasOwn(node, 'permissionCascade') || hasOwn(node, 'permissionIntent')) found = true;
    const props = isObject(node.props) ? node.props : {};
    if (hasOwn(props, 'permissionIntent')) found = true;
    if (node.type === 'table') {
      for (const collection of ['columns', 'actions', 'toolbar']) {
        for (const entry of Array.isArray(props[collection]) ? props[collection] : []) {
          if (hasOwn(entry, 'permissionCascade') || hasOwn(entry, 'permissionIntent')) found = true;
        }
      }
    }
    for (const child of Array.isArray(node.children) ? node.children : []) scanNode(child);
    for (const item of Array.isArray(props.items) ? props.items : []) scanNode(item?.content);
  };

  scanNode(page?.body);
  for (const action of Object.values(isObject(page?.actions) ? page.actions : {})) {
    if (hasOwn(action, 'permissionCascade') || hasOwn(action, 'permissionIntent')) found = true;
    if (action?.type === 'modal') scanNode(action.content);
  }
  return found;
}

function validatePermissionInheritance(page) {
  const errors = [];
  const add = (code, path) => errors.push({ code, path });

  if (hasInheritanceFields(page)) {
    if (!versionAtLeast(page?.meta?.protocolVersion, '2.3')) add('PROTOCOL_VERSION_TOO_LOW', 'meta.protocolVersion');
    if (!Array.isArray(page?.meta?.requiredCapabilities)
      || !page.meta.requiredCapabilities.includes('permissions.inheritance')) {
      add('CAPABILITY_REQUIRED', 'meta.requiredCapabilities');
    }
  }

  const validateIntent = (entry, path) => {
    if (!hasOwn(entry, 'permissionIntent')) return;
    if (!CASCADE_KEYS.has(entry.permissionIntent)) add('PERMISSION_INTENT_INVALID', `${path}.permissionIntent`);
  };

  const scanNode = (node, nodePath) => {
    if (!isObject(node)) return;
    if (hasOwn(node, 'permissionCascade')) {
      const cascade = node.permissionCascade;
      if (!CASCADE_TYPES.has(node.type)) add('PERMISSION_CASCADE_TYPE_INVALID', `${nodePath}.permissionCascade`);
      if (!isObject(cascade) || !Array.isArray(cascade.keys) || cascade.keys.length === 0
        || new Set(cascade.keys).size !== cascade.keys.length
        || cascade.keys.some(key => !CASCADE_KEYS.has(key))) {
        add('PERMISSION_CASCADE_KEYS_INVALID', `${nodePath}.permissionCascade.keys`);
      } else {
        for (const key of cascade.keys) {
          if (!hasOwn(node.permissions, key)) add('PERMISSION_CASCADE_SOURCE_MISSING', `${nodePath}.permissions.${key}`);
        }
      }
    }
    if (hasOwn(node, 'permissionIntent')) add('PERMISSION_INTENT_FORBIDDEN', `${nodePath}.permissionIntent`);

    const props = isObject(node.props) ? node.props : {};
    if (node.type === 'actionButton') {
      validateIntent(props, `${nodePath}.props`);
    } else if (hasOwn(props, 'permissionIntent')) {
      add('PERMISSION_INTENT_FORBIDDEN', `${nodePath}.props.permissionIntent`);
    }

    if (node.type === 'table') {
      for (const [collection, allowed] of [
        ['columns', false],
        ['actions', true],
        ['toolbar', true],
      ]) {
        for (const [index, entry] of (Array.isArray(props[collection]) ? props[collection] : []).entries()) {
          const entryPath = `${nodePath}.props.${collection}[${index}]`;
          if (hasOwn(entry, 'permissionCascade')) add('PERMISSION_CASCADE_FORBIDDEN', `${entryPath}.permissionCascade`);
          if (allowed) validateIntent(entry, entryPath);
          else if (hasOwn(entry, 'permissionIntent')) add('PERMISSION_INTENT_FORBIDDEN', `${entryPath}.permissionIntent`);
        }
      }
    }

    for (const [index, child] of (Array.isArray(node.children) ? node.children : []).entries()) {
      scanNode(child, `${nodePath}.children[${index}]`);
    }
    for (const [index, item] of (Array.isArray(props.items) ? props.items : []).entries()) {
      scanNode(item?.content, `${nodePath}.props.items[${index}].content`);
    }
  };

  scanNode(page?.body, 'body');
  for (const [actionId, action] of Object.entries(isObject(page?.actions) ? page.actions : {})) {
    if (hasOwn(action, 'permissionCascade')) add('PERMISSION_CASCADE_FORBIDDEN', `actions.${actionId}.permissionCascade`);
    if (hasOwn(action, 'permissionIntent')) add('PERMISSION_INTENT_FORBIDDEN', `actions.${actionId}.permissionIntent`);
    if (action?.type === 'modal') scanNode(action.content, `actions.${actionId}.content`);
  }
  return errors;
}

function localPermission(value, key) {
  if (!key || !isObject(value?.permissions) || !hasOwn(value.permissions, key)) return true;
  return value.permissions[key] === true;
}

function firstLocalPermissionKey(value) {
  if (!isObject(value?.permissions)) return null;
  return Object.keys(value.permissions)[0] || null;
}

function nodeLabel(node, fallback) {
  return typeof node?.id === 'string' && node.id.length > 0 ? node.id : fallback;
}

function evaluatePage(page, navigatedPage) {
  const targets = [];

  const addTarget = ({ targetId, kind, value, key, cascades, cascadeEligible }) => {
    const applied = cascadeEligible && CASCADE_KEYS.has(key)
      ? cascades.filter(entry => entry.keys.includes(key))
      : [];
    const effectivePermission = localPermission(value, key)
      && applied.every(entry => localPermission(entry.node, key));
    targets.push({
      targetId,
      kind,
      key,
      cascadeApplied: applied.length > 0,
      cascadedBy: applied.map(entry => entry.label),
      effectivePermission,
    });
  };

  const walk = (node, nodePath, ancestors, formMode = null) => {
    if (!isObject(node)) return;
    const props = isObject(node.props) ? node.props : {};
    const ownCascades = hasOwn(node, 'permissionCascade') && Array.isArray(node.permissionCascade?.keys)
      ? ancestors.concat([{ node, keys: node.permissionCascade.keys, label: nodeLabel(node, nodePath) }])
      : ancestors;
    const currentFormMode = node.type === 'form' ? (props.mode === 'search' ? 'search' : 'default') : formMode;

    if (node.type === 'actionButton' && hasOwn(props, 'permissionIntent')) {
      addTarget({
        targetId: props.key || nodeLabel(node, nodePath),
        kind: 'actionButton',
        value: node,
        key: props.permissionIntent,
        cascades: ancestors,
        cascadeEligible: true,
      });
    }

    if (node.type === 'form' && currentFormMode === 'default' && props.submitAction !== undefined) {
      addTarget({
        targetId: `${nodeLabel(node, nodePath)}:submit`,
        kind: 'formSubmit',
        value: node,
        key: 'edit',
        cascades: ownCascades,
        cascadeEligible: true,
      });
    }

    if (currentFormMode === 'default' && EDITABLE_FORM_TYPES.has(node.type)) {
      const field = node.type === 'dateRangePicker'
        ? `${props.startField || ''}:${props.endField || ''}`
        : props.field;
      addTarget({
        targetId: field || nodeLabel(node, nodePath),
        kind: 'formField',
        value: node,
        key: 'edit',
        cascades: ancestors,
        cascadeEligible: true,
      });
    }

    if (node.type === 'table') {
      for (const [index, column] of (Array.isArray(props.columns) ? props.columns : []).entries()) {
        const key = firstLocalPermissionKey(column);
        addTarget({
          targetId: column?.field || `${nodePath}.props.columns[${index}]`,
          kind: 'column',
          value: column,
          key,
          cascades: [],
          cascadeEligible: false,
        });
      }
      for (const [collection, kind] of [['actions', 'rowAction'], ['toolbar', 'toolbarTrigger']]) {
        for (const [index, entry] of (Array.isArray(props[collection]) ? props[collection] : []).entries()) {
          const hasIntent = hasOwn(entry, 'permissionIntent');
          addTarget({
            targetId: entry?.key || `${nodePath}.props.${collection}[${index}]`,
            kind,
            value: entry,
            key: hasIntent ? entry.permissionIntent : firstLocalPermissionKey(entry),
            cascades: ownCascades,
            cascadeEligible: hasIntent,
          });
        }
      }
    }

    for (const [index, child] of (Array.isArray(node.children) ? node.children : []).entries()) {
      walk(child, `${nodePath}.children[${index}]`, ownCascades, currentFormMode);
    }
    for (const [index, item] of (Array.isArray(props.items) ? props.items : []).entries()) {
      walk(item?.content, `${nodePath}.props.items[${index}].content`, ownCascades, currentFormMode);
    }
  };

  walk(page?.body, 'body', []);
  for (const [actionId, action] of Object.entries(isObject(page?.actions) ? page.actions : {})) {
    if (action?.type === 'modal') walk(action.content, `actions.${actionId}.content`, []);
  }
  if (navigatedPage?.body) walk(navigatedPage.body, 'navigatedPage.body', []);
  return targets;
}

function executeTarget(targets, execution) {
  if (!execution) return undefined;
  const target = targets.find(item => item.targetId === execution.targetId);
  if (!target) return { outcome: 'TARGET_NOT_FOUND', events: [] };
  if (execution.visible === false) return { outcome: 'BLOCKED', reason: 'NOT_VISIBLE', events: [] };
  if (!target.effectivePermission) return { outcome: 'BLOCKED', reason: 'PERMISSION_DENIED', events: [] };
  if (execution.disabled === true || execution.requiresSelection === true) {
    return { outcome: 'BLOCKED', reason: 'DISABLED', events: [] };
  }
  if (execution.confirm === true) {
    const events = [{ type: 'confirmShown' }];
    if (execution.confirmed !== true) return { outcome: 'CONFIRM_CANCELLED', events };
    events.push({ type: 'actionExecuted' });
    return { outcome: 'EXECUTED', events };
  }
  return { outcome: 'EXECUTED', events: [{ type: 'actionExecuted' }] };
}

function evaluatePermissionInheritance(input) {
  const errors = validatePermissionInheritance(input.page);
  const result = { validation: { valid: errors.length === 0, errors } };
  if (errors.length > 0) return result;
  const targets = evaluatePage(input.page, input.navigatedPage);
  result.targets = targets;
  const execution = executeTarget(targets, input.execution);
  if (execution !== undefined) result.execution = execution;
  return result;
}

module.exports = { evaluatePermissionInheritance };
