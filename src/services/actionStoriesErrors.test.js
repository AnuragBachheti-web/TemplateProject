import { describe, it, expect } from 'vitest';
import { ActionStoriesError, ERROR_CODES, classifyHttpStatus, isTransient, toActionStoriesError } from './actionStoriesErrors';

describe('ActionStoriesError', () => {
  it('always has a safe, non-empty userMessage even when none is given', () => {
    const err = new ActionStoriesError('some internal detail: stack trace, file path, etc.');
    expect(err.userMessage).toBeTruthy();
    expect(err.userMessage).not.toContain('stack trace');
    expect(err.userMessage).not.toContain('file path');
  });

  it('lets a caller override the default userMessage per-error', () => {
    const err = new ActionStoriesError('x', { code: ERROR_CODES.NOT_FOUND, userMessage: 'Custom message' });
    expect(err.userMessage).toBe('Custom message');
  });

  it('marks network/timeout/server errors retryable by default, others not', () => {
    expect(new ActionStoriesError('x', { code: ERROR_CODES.NETWORK }).retryable).toBe(true);
    expect(new ActionStoriesError('x', { code: ERROR_CODES.TIMEOUT }).retryable).toBe(true);
    expect(new ActionStoriesError('x', { code: ERROR_CODES.SERVER_ERROR }).retryable).toBe(true);
    expect(new ActionStoriesError('x', { code: ERROR_CODES.NOT_FOUND }).retryable).toBe(false);
    expect(new ActionStoriesError('x', { code: ERROR_CODES.MALFORMED }).retryable).toBe(false);
    expect(new ActionStoriesError('x', { code: ERROR_CODES.CLIENT_ERROR }).retryable).toBe(false);
  });

  it('keeps the original cause for developer diagnostics without exposing it via userMessage', () => {
    const original = new Error('raw internal error');
    const err = new ActionStoriesError('wrapped', { cause: original });
    expect(err.cause).toBe(original);
    expect(err.userMessage).not.toContain('raw internal error');
  });
});

describe('classifyHttpStatus', () => {
  it('maps 404 to NOT_FOUND', () => {
    expect(classifyHttpStatus(404)).toBe(ERROR_CODES.NOT_FOUND);
  });
  it('maps every other 4xx to CLIENT_ERROR', () => {
    expect(classifyHttpStatus(400)).toBe(ERROR_CODES.CLIENT_ERROR);
    expect(classifyHttpStatus(401)).toBe(ERROR_CODES.CLIENT_ERROR);
    expect(classifyHttpStatus(403)).toBe(ERROR_CODES.CLIENT_ERROR);
    expect(classifyHttpStatus(429)).toBe(ERROR_CODES.CLIENT_ERROR);
  });
  it('maps every 5xx to SERVER_ERROR', () => {
    expect(classifyHttpStatus(500)).toBe(ERROR_CODES.SERVER_ERROR);
    expect(classifyHttpStatus(502)).toBe(ERROR_CODES.SERVER_ERROR);
    expect(classifyHttpStatus(503)).toBe(ERROR_CODES.SERVER_ERROR);
  });
  it('maps anything else to UNKNOWN', () => {
    expect(classifyHttpStatus(200)).toBe(ERROR_CODES.UNKNOWN);
    expect(classifyHttpStatus(301)).toBe(ERROR_CODES.UNKNOWN);
  });
});

describe('isTransient', () => {
  it('is true only for network/timeout/server failures', () => {
    expect(isTransient(ERROR_CODES.NETWORK)).toBe(true);
    expect(isTransient(ERROR_CODES.TIMEOUT)).toBe(true);
    expect(isTransient(ERROR_CODES.SERVER_ERROR)).toBe(true);
    expect(isTransient(ERROR_CODES.NOT_FOUND)).toBe(false);
    expect(isTransient(ERROR_CODES.CLIENT_ERROR)).toBe(false);
    expect(isTransient(ERROR_CODES.MALFORMED)).toBe(false);
    expect(isTransient(ERROR_CODES.ABORTED)).toBe(false);
  });
});

describe('toActionStoriesError', () => {
  it('passes an existing ActionStoriesError through unchanged (idempotent wrapping)', () => {
    const original = new ActionStoriesError('x', { code: ERROR_CODES.NOT_FOUND });
    expect(toActionStoriesError(original)).toBe(original);
  });

  it('classifies a DOMException-style AbortError as ABORTED', () => {
    const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const wrapped = toActionStoriesError(abortErr);
    expect(wrapped.code).toBe(ERROR_CODES.ABORTED);
  });

  it('classifies any other thrown value as UNKNOWN without leaking it as the userMessage', () => {
    const wrapped = toActionStoriesError(new TypeError('Cannot read properties of undefined (reading \'foo\')'));
    expect(wrapped.code).toBe(ERROR_CODES.UNKNOWN);
    expect(wrapped.userMessage).not.toContain('Cannot read properties');
  });

  it('never throws, even given a non-Error thrown value (a string, null, a plain object)', () => {
    expect(() => toActionStoriesError('a bare string throw')).not.toThrow();
    expect(() => toActionStoriesError(null)).not.toThrow();
    expect(() => toActionStoriesError({ weird: 'shape' })).not.toThrow();
  });
});
