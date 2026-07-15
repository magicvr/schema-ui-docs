'use strict';

function failure(code, fileIndex, requests = []) {
  return { ok: false, code, fileIndex, requests, fieldValue: null };
}

const PROTOCOL_RELATIVE_URL = /^\/(?!\/)[^\s\\]*$/;
const INVOCATION_ID = /^[\x21-\x7e]{1,200}$/;

function matchesAccept(file, accept) {
  if (accept === undefined) return true;
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return accept.split(',').some(rawToken => {
    const token = rawToken.trim().toLowerCase();
    if (token === '') return false;
    if (token.startsWith('.')) return fileName.endsWith(token);
    if (token.endsWith('/*')) return mime.startsWith(`${token.slice(0, -1)}`);
    return mime === token;
  });
}

function requestFor(action, file, fileIndex, invocationId) {
  const request = {
    method: action.method === undefined ? 'POST' : action.method,
    url: action.url,
    part: {
      name: action.fieldName === undefined ? 'file' : action.fieldName,
      fileName: file.name,
      contentId: file.contentId,
    },
  };
  const retryPolicy = action.retryPolicy === undefined ? 'never' : action.retryPolicy;
  if (!['never', 'idempotent'].includes(retryPolicy)) return failure('INVALID_RETRY_POLICY', fileIndex);
  if (retryPolicy === 'idempotent') {
    if (typeof invocationId !== 'string' || !INVOCATION_ID.test(invocationId)) {
      return failure('MISSING_INVOCATION_ID', fileIndex);
    }
    request.headers = { 'Idempotency-Key': `${invocationId}:${fileIndex}` };
  }
  return request;
}

function responseValue(response) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) return null;
  if (typeof response.url === 'string' && response.url.length > 0) return response.url;
  if (typeof response.id === 'string' && response.id.length > 0) return response.id;
  return null;
}

function executeUpload(input) {
  const { action, files } = input;
  if (typeof action.url !== 'string' || !PROTOCOL_RELATIVE_URL.test(action.url)) {
    return failure('INVALID_PROTOCOL_URL', 0);
  }
  if (!action.multiple && files.length > 1) return failure('MULTIPLE_FILES_NOT_ALLOWED', 1);
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (action.maxSize !== undefined && file.size > action.maxSize) {
      return failure('FILE_TOO_LARGE', index);
    }
    if (!matchesAccept(file, action.accept)) return failure('UNSUPPORTED_FILE_TYPE', index);
  }

  const requests = [];
  const values = [];
  for (let index = 0; index < files.length; index += 1) {
    const request = requestFor(action, files[index], index, input.invocationId);
    if (request.ok === false) return failure(request.code, index, requests);
    requests.push(request);
    const result = input.results[index];
    if (!result || result.type !== 'success') return failure('UPLOAD_REQUEST_FAILED', index, requests);
    const value = responseValue(result.response);
    if (value === null) return failure('INVALID_UPLOAD_RESPONSE', index, requests);
    values.push(value);
  }

  return {
    ok: true,
    requests,
    fieldValue: action.multiple ? values : values[0],
  };
}

module.exports = { executeUpload };
