import { describe, it, expect } from 'vitest';
import { apiError, ErrorCode, isApiErrorPayload } from '../../src/lib/errors.js';

describe('apiError', () => {
  it('builds the canonical payload shape', () => {
    const e = apiError(ErrorCode.NOT_FOUND, 'nope', 404);
    expect(e).toEqual({
      status: 404,
      body: { error: 'NOT_FOUND', message: 'nope', status: 404 },
    });
  });

  it('merges extra fields into the body', () => {
    const e = apiError(ErrorCode.NO_CONTENT, 'empty', 422, { skipped: ['x'] });
    expect(e.body.skipped).toEqual(['x']);
  });
});

describe('isApiErrorPayload', () => {
  it('accepts a real payload', () => {
    expect(isApiErrorPayload(apiError(ErrorCode.INTERNAL_ERROR, 'x', 500))).toBe(true);
  });
  it('rejects non-payloads', () => {
    expect(isApiErrorPayload(null)).toBe(false);
    expect(isApiErrorPayload({ foo: 1 })).toBe(false);
  });
});
