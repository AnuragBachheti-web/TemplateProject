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

const { dispatchAction, readCompletedActions, clearCompletedAction } = await import('./actionStoriesMutations.js');

describe('dispatchAction — generic mutation lifecycle, real persistence, keyed by actionId', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists completion keyed by code/stageKey/actionId, surviving being re-read (simulating a refresh)', async () => {
    expect(readCompletedActions()['S9.1/decide/approve']).toBeUndefined();
    await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve', action: 'confirm' });
    expect(readCompletedActions()['S9.1/decide/approve']).toBeTruthy();
  });

  it('resolves with a real ISO completedAt timestamp and echoes the actionId', async () => {
    const result = await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve' });
    expect(result.success).toBe(true);
    expect(result.actionId).toBe('approve');
    expect(() => new Date(result.completedAt).toISOString()).not.toThrow();
  });

  it('carries an optional reason through to the result', async () => {
    const result = await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'decline', reason: 'Budget exceeded' });
    expect(result.reason).toBe('Budget exceeded');
  });

  it('rejects with an ActionStoriesError, not a bare Error, when required args are missing', async () => {
    await expect(dispatchAction({ stageKey: 'decide', actionId: 'approve' })).rejects.toMatchObject({
      code: ERROR_CODES.CLIENT_ERROR,
      retryable: false,
    });
  });

  it('rejects with ABORTED and does not persist anything when cancelled before completing', async () => {
    const controller = new AbortController();
    const promise = dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve', signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: ERROR_CODES.ABORTED });
    expect(readCompletedActions()['S9.1/decide/approve']).toBeUndefined();
  });

  it('clearCompletedAction removes a persisted completion', async () => {
    await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve' });
    expect(readCompletedActions()['S9.1/decide/approve']).toBeTruthy();
    clearCompletedAction('S9.1', 'decide', 'approve');
    expect(readCompletedActions()['S9.1/decide/approve']).toBeUndefined();
  });

  it('keeps different actions on the same stage fully independent (multi-action support)', async () => {
    await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve' });
    await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'decline' });
    const all = readCompletedActions();
    expect(all['S9.1/decide/approve']).toBeTruthy();
    expect(all['S9.1/decide/decline']).toBeTruthy();
  });

  it('keeps completions for different stages/workflows independent', async () => {
    await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'approve' });
    await dispatchAction({ code: 'S9.2', stageKey: 'execute', actionId: 'approve' });
    const all = readCompletedActions();
    expect(all['S9.1/decide/approve']).toBeTruthy();
    expect(all['S9.2/execute/approve']).toBeTruthy();
    expect(all['S9.1/execute/approve']).toBeUndefined();
  });

  it('readCompletedActions degrades to empty (not a throw) for malformed stored JSON', () => {
    window.localStorage.setItem('rf-action-stories-completed-actions', 'not valid json{{{');
    expect(() => readCompletedActions()).not.toThrow();
    expect(readCompletedActions()).toEqual({});
  });

  it('an unrecognized backend "action" type still runs (via the generic default handler), never throws "unsupported"', async () => {
    const result = await dispatchAction({ code: 'S9.1', stageKey: 'decide', actionId: 'escalate', action: 'some_future_backend_action' });
    expect(result.success).toBe(true);
  });
});
