'use strict';

const { isDeepStrictEqual } = require('node:util');

const CONDITION = /^\$deps\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*(==|!=|>=|<=|>|<|contains)\s*(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|'[^']*'|"[^"]*")$/;
const DEPENDENCY = /\$deps\.([A-Za-z_][A-Za-z0-9_]*)/g;
const MISSING = Symbol('missing');

function readPath(values, path) {
  let current = values;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)) return MISSING;
    current = current[segment];
  }
  return current;
}

function parseLiteral(token) {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  if (token.startsWith("'") || token.startsWith('"')) return token.slice(1, -1);
  return Number(token);
}

function jsonValueEqual(left, right) {
  if (left === MISSING || right === MISSING) return false;
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  return Object.is(left, right) || (typeof left === 'number' && left === right)
    || isDeepStrictEqual(left, right);
}

function compareStringsByCodePoint(left, right) {
  const leftPoints = Array.from(left, char => char.codePointAt(0));
  const rightPoints = Array.from(right, char => char.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] < rightPoints[index] ? -1 : 1;
  }
  return Math.sign(leftPoints.length - rightPoints.length);
}

function evaluateCondition(expression, snapshot) {
  const match = CONDITION.exec(expression);
  if (!match) throw new Error(`Unsupported reference expression: ${expression}`);
  const left = readPath(snapshot, match[1]);
  const right = parseLiteral(match[3]);
  if (left === MISSING) return false;
  if (match[2] === 'contains') {
    return Array.isArray(left) && left.some(item => jsonValueEqual(item, right));
  }
  if (['>', '>=', '<', '<='].includes(match[2])) {
    const sameComparableType = (typeof left === 'number' && typeof right === 'number')
      || (typeof left === 'string' && typeof right === 'string');
    if (!sameComparableType) return false;
    const comparison = typeof left === 'string' ? compareStringsByCodePoint(left, right) : left - right;
    if (match[2] === '>') return comparison > 0;
    if (match[2] === '>=') return comparison >= 0;
    if (match[2] === '<') return comparison < 0;
    return comparison <= 0;
  }
  const equal = jsonValueEqual(left, right);
  return match[2] === '==' ? equal : !equal;
}

function collectDependencyFields(input) {
  const fields = new Set();
  const expressions = [
    ...input.fields.flatMap(field => field.reactions.map(reaction => reaction.when)),
    ...input.observers.map(observer => observer.when),
  ];
  for (const expression of expressions) {
    for (const match of expression.matchAll(DEPENDENCY)) fields.add(match[1]);
  }
  return fields;
}

function runReactionSchedule(input) {
  let values = structuredClone(input.initialValues);
  const baselines = structuredClone(input.baselines || input.initialValues || {});
  const maxRounds = input.maxRounds || 10;
  const dependencyFields = collectDependencyFields(input);
  const warnings = [];
  const warnedFields = new Set();
  const rounds = [];
  const previousConditions = new Map();

  for (let round = 1; round <= maxRounds; round += 1) {
    const snapshot = structuredClone(values);
    const observations = Object.fromEntries(
      input.observers.map(observer => [observer.id, evaluateCondition(observer.when, snapshot)]),
    );
    const pending = new Map();

    for (const field of input.fields) {
      let valueWriteCount = 0;
      let resetToBaseline = false;
      for (const [reactionIndex, reaction] of field.reactions.entries()) {
        const condition = evaluateCondition(reaction.when, snapshot);
        const branch = condition ? reaction.fulfill : reaction.otherwise;
        const conditionKey = `${field.field}:${reactionIndex}`;
        const wasTrue = previousConditions.get(conditionKey) === true;
        previousConditions.set(conditionKey, condition);
        if (branch && Object.hasOwn(branch, 'value')) {
          pending.set(field.field, structuredClone(branch.value));
          valueWriteCount += 1;
        } else if (!condition && wasTrue && Object.hasOwn(baselines, field.field)) {
          resetToBaseline = true;
        }
      }
      if (valueWriteCount === 0 && resetToBaseline) {
        pending.set(field.field, structuredClone(baselines[field.field]));
      }
      if (valueWriteCount > 1 && !warnedFields.has(field.field)) {
        warnings.push({ code: 'MULTIPLE_VALUE_WRITES', field: field.field, count: valueWriteCount });
        warnedFields.add(field.field);
      }
    }

    const commits = [];
    for (const [field, value] of pending) {
      if (!isDeepStrictEqual(values[field], value)) {
        values[field] = structuredClone(value);
        commits.push({ field, value: structuredClone(value) });
      }
    }
    rounds.push({ round, snapshot, observations, commits });

    const externalUpdate = (input.externalUpdates || []).find(update => update.afterRound === round);
    if (externalUpdate) {
      Object.assign(values, structuredClone(externalUpdate.values));
    }
    const schedulesNextRound = Boolean(externalUpdate)
      || commits.some(commit => dependencyFields.has(commit.field));
    if (!schedulesNextRound) return { ok: true, values, rounds, warnings };
  }

  return {
    ok: false,
    code: 'REACTION_LOOP_LIMIT',
    maxRounds,
    values,
    roundCount: maxRounds,
    dependencyFields: [...dependencyFields].sort(),
  };
}

module.exports = { runReactionSchedule };