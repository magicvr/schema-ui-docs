'use strict';

const { isDeepStrictEqual } = require('node:util');

const CONDITION = /^\$deps\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*(==|!=)\s*(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?|'[^']*')$/;
const DEPENDENCY = /\$deps\.([A-Za-z_][A-Za-z0-9_]*)/g;

function readPath(values, path) {
  let current = values;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function parseLiteral(token) {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  if (token.startsWith("'")) return token.slice(1, -1);
  return Number(token);
}

function evaluateCondition(expression, snapshot) {
  const match = CONDITION.exec(expression);
  if (!match) throw new Error(`Unsupported reference expression: ${expression}`);
  const left = readPath(snapshot, match[1]);
  if (left === undefined) return false;
  const equal = left === parseLiteral(match[3]);
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
  const maxRounds = input.maxRounds || 10;
  const dependencyFields = collectDependencyFields(input);
  const warnings = [];
  const warnedFields = new Set();
  const rounds = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const snapshot = structuredClone(values);
    const observations = Object.fromEntries(
      input.observers.map(observer => [observer.id, evaluateCondition(observer.when, snapshot)]),
    );
    const pending = new Map();

    for (const field of input.fields) {
      let valueWriteCount = 0;
      for (const reaction of field.reactions) {
        const branch = evaluateCondition(reaction.when, snapshot) ? reaction.fulfill : reaction.otherwise;
        if (branch && Object.hasOwn(branch, 'value')) {
          pending.set(field.field, structuredClone(branch.value));
          valueWriteCount += 1;
        }
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

    const schedulesNextRound = commits.some(commit => dependencyFields.has(commit.field));
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