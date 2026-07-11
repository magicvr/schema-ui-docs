'use strict';

function failure(code, fileIndex, requests = []) {
  return { ok: false, code, fileIndex, requests, fieldValue: null };
}

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

function requestFor(action, file) {
  return {
    method: action.method || 'POST',
    url: action.url,
    part: {
      name: action.fieldName || 'file',
      fileName: file.name,
      contentId: file.contentId,
    },
  };
}

function responseValue(response) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) return null;
  if (typeof response.url === 'string' && response.url.length > 0) return response.url;
  if (typeof response.id === 'string' && response.id.length > 0) return response.id;
  return null;
}

function executeUpload(input) {
  const { action, files } = input;
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
    requests.push(requestFor(action, files[index]));
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