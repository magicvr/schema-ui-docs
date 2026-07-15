'use strict';

function behaviorEvent(behavior, context = {}) {
  if (behavior.behavior === 'toast') return { type: 'toast', message: behavior.message };
  if (behavior.behavior === 'navigate') return { type: 'navigate', url: behavior.url };
  if (behavior.behavior === 'reload') {
    return context.tableId
      ? { type: 'reloadTable', tableId: context.tableId }
      : { type: 'reloadCurrentData' };
  }
  if (behavior.behavior === 'closeModal') return { type: 'closeModal' };
  throw new Error(`Unknown OutcomeBehavior: ${behavior.behavior}`);
}

function processHttpError(input) {
  const { status } = input.transport;
  const body = input.transport.body || {};
  const events = [];

  if (status === 401 || status === 403) {
    events.push({ type: 'authFailure', status });
    events.push({ type: 'errorState', display: status === 401 ? null : '无权限访问' });
    return { ok: false, events };
  }

  const fieldErrors = status === 400 && Array.isArray(body.errors) && body.errors.length > 0;
  if (fieldErrors) {
    events.push({ type: 'fieldErrors', errors: body.errors });
    if (input.onError?.behavior === 'toast') {
      events.push(behaviorEvent(input.onError, input.context));
    } else if (body.message) {
      events.push({ type: 'toast', message: body.message });
    }
    return { ok: false, events };
  }

  let display;
  if (status === 404) display = '资源不存在';
  else if (status >= 500) display = '系统异常，请稍后重试';
  else display = body.message || null;
  events.push({ type: 'errorState', display });
  if (input.onError) events.push(behaviorEvent(input.onError, input.context));
  return { ok: false, events };
}

function processActionOutcome(input) {
  const transport = input.transport;
  if (transport.type === 'success') {
    const events = [{ type: 'requestSucceeded', status: transport.status }];
    if (input.onSuccess) events.push(behaviorEvent(input.onSuccess, input.context));
    return { ok: true, events };
  }
  if (transport.type === 'httpError') return processHttpError(input);
  if (transport.type === 'abort') return { ok: false, events: [] };

  const events = [transport.type === 'timeout'
    ? { type: 'errorState', display: '请求超时，请稍后重试', retryable: true, outcome: 'unknown' }
    : { type: 'errorState', display: '网络异常，请检查网络连接', retryable: true, outcome: 'unknown' }];
  if (input.onError) events.push(behaviorEvent(input.onError, input.context));
  return { ok: false, events };
}

module.exports = { processActionOutcome };
