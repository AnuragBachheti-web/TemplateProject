// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ERROR_CODES } from './actionStoriesErrors';

// This jsdom setup doesn't provide window.localStorage out of the box (see
// store/useThemeStore.test.js's own note) — same minimal polyfill.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const { confirmStageMutation, readConfirmedStages, clearConfirmedStage } = await import('./actionStoriesMutations.js');

describe('confirmStageMutation — real persistence (regression: refresh used to revert every stage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists a confirmation that survives being re-read (simulating a refresh)', async () => {
    expect(readConfirmedStages()['S9.1/decide']).toBeUndefined();
    await confirmStageMutation('S9.1', 'decide');
    expect(readConfirmedStages()['S9.1/decide']).toBeTruthy();
  });

  it('resolves with a real ISO confirmedAt timestamp', async () => {
    const result = await confirmStageMutation('S9.1', 'decide');
    expect(result.confirmed).toBe(true);
    expect(() => new Date(result.confirmedAt).toISOString()).not.toThrow();
  });

  it('rejects with an ActionStoriesError, not a bare Error, when required args are missing', async () => {
    await expect(confirmStageMutation(null, 'decide')).rejects.toMatchObject({
      code: ERROR_CODES.CLIENT_ERROR,
      retryable: false,
    });
  });

  it('rejects with ABORTED and does not persist anything when cancelled before completing', async () => {
    const controller = new AbortController();
    const promise = confirmStageMutation('S9.1', 'decide', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: ERROR_CODES.ABORTED });
    expect(readConfirmedStages()['S9.1/decide']).toBeUndefined();
  });

  it('clearConfirmedStage removes a persisted confirmation', async () => {
    await confirmStageMutation('S9.1', 'decide');
    expect(readConfirmedStages()['S9.1/decide']).toBeTruthy();
    clearConfirmedStage('S9.1', 'decide');
    expect(readConfirmedStages()['S9.1/decide']).toBeUndefined();
  });

  it('keeps confirmations for different stages independent', async () => {
    await confirmStageMutation('S9.1', 'decide');
    await confirmStageMutation('S9.2', 'execute');
    const all = readConfirmedStages();
    expect(all['S9.1/decide']).toBeTruthy();
    expect(all['S9.2/execute']).toBeTruthy();
    expect(all['S9.1/execute']).toBeUndefined();
  });

  it('readConfirmedStages degrades to empty (not a throw) for malformed stored JSON', () => {
    window.localStorage.setItem('rf-action-stories-confirmed-stages', 'not valid json{{{');
    expect(() => readConfirmedStages()).not.toThrow();
    expect(readConfirmedStages()).toEqual({});
  });
});
