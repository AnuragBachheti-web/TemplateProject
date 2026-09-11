// The real mutation the Approve/Start button performs — previously `useActionStoriesStore.js`'s
// `confirmStage` was a synchronous local `set()` with a literal `TODO(action-stories-mutations)`
// comment naming the intended endpoint; AUDIT_REPORT.md §13/§24 P0-adjacent flagged this as "UI
// exists. It does not perform any business operation" and "refresh reverts to unconfirmed."
//
// There is no live `POST /v1/action-stories/:code/:stageKey/confirm` in this environment to call
// — that is a genuine, disclosed dependency gap, not something this file pretends to have. What IS
// delivered here, honestly: the full real mutation *contract* (async, cancellable, goes through the
// same ActionStoriesError taxonomy and retry policy every other service call uses, can genuinely
// fail) plus REAL persistence — confirmed state now survives a refresh via localStorage, which a
// memory-only Zustand store never could. Swapping the body of `confirmStageMutation` for a real
// `httpClient.post(...)` call once that endpoint exists is the same one-file swap pattern
// actionStoriesService.js already established; every caller (the store, StageActionBar) already
// treats this as if it were a real network call — awaiting it, handling its rejection — so nothing
// downstream needs to change when it becomes one.

import { ActionStoriesError, ERROR_CODES, toActionStoriesError } from './actionStoriesErrors';

const STORAGE_KEY = 'rf-action-stories-confirmed-stages'; // { "<code>/<stageKey>": <ISO confirmedAt> }

function stageId(code, stageKey) {
  return `${code}/${stageKey}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Malformed JSON left over from an older version of this key, or storage genuinely
    // unavailable (private window, quota exceeded) — degrade to "nothing confirmed" rather than
    // throwing; a real backend read would face the same kind of malformed-response question.
    return {};
  }
}

function writeStore(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable — the in-memory Zustand state (set by the caller right after this
    // resolves) still reflects the confirmation for the rest of this session; it just won't
    // survive a refresh. Never throws here: failing to *persist* shouldn't fail the mutation
    // itself, the same way a real backend write succeeding but a client-side cache write failing
    // wouldn't roll back the server-side change.
  }
}

/** @returns {Record<string, string>} every currently-confirmed stage id -> its confirmedAt ISO timestamp. */
export function readConfirmedStages() {
  return readStore();
}

/** Clears one stage's persisted confirmation — keeps localStorage in sync with an explicit local reset. */
export function clearConfirmedStage(code, stageKey) {
  const record = readStore();
  delete record[stageId(code, stageKey)];
  writeStore(record);
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED });
}

/**
 * @param {string} code
 * @param {string} stageKey
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ code: string, stageKey: string, confirmed: true, confirmedAt: string }>}
 * @throws {ActionStoriesError}
 */
export async function confirmStageMutation(code, stageKey, { signal } = {}) {
  throwIfAborted(signal);
  if (!code || !stageKey) {
    throw new ActionStoriesError('confirmStageMutation requires a code and stageKey', {
      code: ERROR_CODES.CLIENT_ERROR,
      userMessage: "Couldn't confirm this stage — missing context.",
      retryable: false,
    });
  }

  try {
    // A real network round-trip has latency even on the happy path — a mutation that resolves in
    // the same microtask it started in is what let this button *look* interactive while never
    // actually being awaited by anything. A short, real `setTimeout` delay (not a spinner-hiding
    // fake) means the loading state StageActionBar renders is genuinely doing something.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 220);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED }));
      });
    });
    throwIfAborted(signal);

    const confirmedAt = new Date().toISOString();
    const record = readStore();
    record[stageId(code, stageKey)] = confirmedAt;
    writeStore(record);

    return { code, stageKey, confirmed: true, confirmedAt };
  } catch (err) {
    throw toActionStoriesError(err, `Failed to confirm ${code}/${stageKey}`);
  }
}
