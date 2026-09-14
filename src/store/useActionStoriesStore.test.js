// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

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

function freshStore() {
  vi.resetModules();
  window.localStorage.clear();
  return import('./useActionStoriesStore.js');
}

describe('useActionStoriesStore — generic action lifecycle, keyed by actionId', () => {
  it('goes through pending -> done, not an instant synchronous flip', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;

    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(false);
    const promise = store.getState().runAction('S9.1', 'decide', 'approve', { action: 'confirm' });

    // Immediately after calling, before the mutation resolves: pending, not yet done.
    expect(store.getState().isActionPending('S9.1', 'decide', 'approve')).toBe(true);
    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(false);

    await promise;

    expect(store.getState().isActionPending('S9.1', 'decide', 'approve')).toBe(false);
    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(true);
  });

  it('duplicate-click protection: calling runAction again while pending does not start a second mutation', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;

    const first = store.getState().runAction('S9.1', 'decide', 'approve');
    const second = store.getState().runAction('S9.1', 'decide', 'approve'); // should be a no-op
    await Promise.all([first, second]);

    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(true);
    expect(typeof store.getState().completedActions['S9.1/decide/approve']).toBe('string');
  });

  it('calling runAction on an already-done action is a no-op', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;
    await store.getState().runAction('S9.1', 'decide', 'approve');
    const completedAt = store.getState().completedActions['S9.1/decide/approve'];
    await store.getState().runAction('S9.1', 'decide', 'approve');
    expect(store.getState().completedActions['S9.1/decide/approve']).toBe(completedAt); // unchanged
  });

  it('two different actions on the SAME stage run fully independently (multi-action support)', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;

    const approve = store.getState().runAction('S9.1', 'decide', 'approve');
    const decline = store.getState().runAction('S9.1', 'decide', 'decline');
    // Both pending simultaneously — one action being in flight never blocks a sibling from starting.
    expect(store.getState().isActionPending('S9.1', 'decide', 'approve')).toBe(true);
    expect(store.getState().isActionPending('S9.1', 'decide', 'decline')).toBe(true);
    await Promise.all([approve, decline]);

    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(true);
    expect(store.getState().isActionDone('S9.1', 'decide', 'decline')).toBe(true);
  });

  it('records a retryable error and clears pending when the mutation fails', async () => {
    const { useActionStoriesStore } = await freshStore();
    const mutations = await import('@/services/actionStoriesMutations');
    vi.spyOn(mutations, 'dispatchAction').mockRejectedValueOnce(
      Object.assign(new Error('simulated failure'), { code: 'SERVER_ERROR', retryable: true, userMessage: 'Something went wrong.' }),
    );

    const store = useActionStoriesStore;
    await store.getState().runAction('S9.1', 'decide', 'approve');

    expect(store.getState().isActionPending('S9.1', 'decide', 'approve')).toBe(false);
    expect(store.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(false);
    expect(store.getState().getActionError('S9.1', 'decide', 'approve')).toBeTruthy();
  });

  it('hydrates completedActions from localStorage at creation (a refresh keeps a completed action completed)', async () => {
    const { useActionStoriesStore: store1 } = await freshStore();
    await store1.getState().runAction('S9.1', 'decide', 'approve');

    vi.resetModules();
    const { useActionStoriesStore: store2 } = await import('./useActionStoriesStore.js');
    expect(store2.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(true);
  });

  it('resetAction clears both in-memory and persisted state', async () => {
    const { useActionStoriesStore } = await freshStore();
    await useActionStoriesStore.getState().runAction('S9.1', 'decide', 'approve');
    useActionStoriesStore.getState().resetAction('S9.1', 'decide', 'approve');
    expect(useActionStoriesStore.getState().isActionDone('S9.1', 'decide', 'approve')).toBe(false);

    const { readCompletedActions } = await import('@/services/actionStoriesMutations');
    expect(readCompletedActions()['S9.1/decide/approve']).toBeUndefined();
  });
});
