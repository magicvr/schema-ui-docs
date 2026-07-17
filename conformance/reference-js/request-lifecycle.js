'use strict';

function applyRequestLifecycle(input) {
  let generation = input.initialGeneration ?? 0;
  let active = input.initialActive !== false;
  let acceptingResponses = generation > 0 && active;
  let state = input.initialState === undefined ? null : structuredClone(input.initialState);
  const committed = [];

  for (const event of input.events || []) {
    if (event.type === 'start') {
      generation += 1;
      active = true;
      acceptingResponses = true;
      continue;
    }
    if (event.type === 'hide' || event.type === 'unmount') {
      active = false;
      acceptingResponses = false;
      continue;
    }
    if (event.type === 'show') {
      active = true;
      continue;
    }
    if (event.type === 'response') {
      if (event.generation !== generation || !active || !acceptingResponses) continue;
      state = structuredClone(event.state);
      committed.push({ generation: event.generation, state: structuredClone(event.state) });
    }
  }

  return { generation, active, state, committed };
}

module.exports = { applyRequestLifecycle };
