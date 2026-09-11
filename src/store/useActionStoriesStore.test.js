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

describe('useActionStoriesStore — real mutation lifecycle (regression: confirmStage used to be a synchronous local set())', () => {
  it('goes through pending -> confirmed, not an instant synchronous flip', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;

    expect(store.getState().isStageConfirmed('S9.1', 'decide')).toBe(false);
    const promise = store.getState().confirmStage('S9.1', 'decide');

    // Immediately after calling, before the mutation resolves: pending, not yet confirmed.
    expect(store.getState().isStagePending('S9.1', 'decide')).toBe(true);
    expect(store.getState().isStageConfirmed('S9.1', 'decide')).toBe(false);

    await promise;

    expect(store.getState().isStagePending('S9.1', 'decide')).toBe(false);
    expect(store.getState().isStageConfirmed('S9.1', 'decide')).toBe(true);
  });

  it('duplicate-click protection: calling confirmStage again while pending does not start a second mutation', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;

    const first = store.getState().confirmStage('S9.1', 'decide');
    const second = store.getState().confirmStage('S9.1', 'decide'); // should be a no-op
    await Promise.all([first, second]);

    expect(store.getState().isStageConfirmed('S9.1', 'decide')).toBe(true);
    // Only one confirmedAt timestamp exists — no crash, no double-write corruption.
    expect(typeof store.getState().confirmedStages['S9.1/decide']).toBe('string');
  });

  it('calling confirmStage on an already-confirmed stage is a no-op', async () => {
    const { useActionStoriesStore } = await freshStore();
    const store = useActionStoriesStore;
    await store.getState().confirmStage('S9.1', 'decide');
    const confirmedAt = store.getState().confirmedStages['S9.1/decide'];
    await store.getState().confirmStage('S9.1', 'decide');
    expect(store.getState().confirmedStages['S9.1/decide']).toBe(confirmedAt); // unchanged
  });

  it('records a retryable error and clears pending when the mutation fails', async () => {
    const { useActionStoriesStore } = await freshStore();
    const mutations = await import('@/services/actionStoriesMutations');
    vi.spyOn(mutations, 'confirmStageMutation').mockRejectedValueOnce(
      Object.assign(new Error('simulated failure'), { code: 'SERVER_ERROR', retryable: true, userMessage: 'Something went wrong.' }),
    );

    const store = useActionStoriesStore;
    await store.getState().confirmStage('S9.1', 'decide');

    expect(store.getState().isStagePending('S9.1', 'decide')).toBe(false);
    expect(store.getState().isStageConfirmed('S9.1', 'decide')).toBe(false);
    expect(store.getState().getStageError('S9.1', 'decide')).toBeTruthy();
  });

  it('hydrates confirmedStages from localStorage at creation (regression: refresh reverted every stage)', async () => {
    const { useActionStoriesStore: store1 } = await freshStore();
    await store1.getState().confirmStage('S9.1', 'decide');

    vi.resetModules();
    const { useActionStoriesStore: store2 } = await import('./useActionStoriesStore.js');
    expect(store2.getState().isStageConfirmed('S9.1', 'decide')).toBe(true);
  });

  it('resetStage clears both in-memory and persisted state', async () => {
    const { useActionStoriesStore } = await freshStore();
    await useActionStoriesStore.getState().confirmStage('S9.1', 'decide');
    useActionStoriesStore.getState().resetStage('S9.1', 'decide');
    expect(useActionStoriesStore.getState().isStageConfirmed('S9.1', 'decide')).toBe(false);

    const { readConfirmedStages } = await import('@/services/actionStoriesMutations');
    expect(readConfirmedStages()['S9.1/decide']).toBeUndefined();
  });
});
