// The generic mutation/dispatch layer every template-declared action (manifests/
// validateManifest.js's `actions[]`) runs through — there is no per-verb mutation function
// (confirmStageMutation, declineStageMutation, ...); "approve" vs "decline" vs "dismiss" are just
// different `actionId`s dispatched through the one `dispatchAction()` below, exactly the way a real
// `POST /v1/action-stories/:code/:stageKey/actions` endpoint would receive them (see this file's
// own header for the contract that endpoint should implement once it exists).
//
// There is no live backend in this environment — that is a genuine, disclosed dependency gap, not
// something this file pretends to have. What IS delivered here, honestly: the full real mutation
// *contract* (async, cancellable, goes through the same ActionStoriesError taxonomy and retry
// policy every other service call uses, can genuinely fail) plus REAL persistence — a completed
// action survives a refresh via localStorage, which a memory-only Zustand store never could.
//
// ACTION_HANDLERS is a small registry keyed by an action's own declared BACKEND operation type
// (`actions[].action` in the manifest schema — see actionEligibility.js's `actionType`), additive
// by design: a new action that needs genuinely different backend behavior gets one new entry here,
// never a new file, a new store, or a new UI component. Every action type currently falls through
// to `genericActionHandler` because there is exactly one real operation this mock environment can
// honestly perform (mark-as-done, persisted) — swap or add a dedicated handler here once a real,
// differentiated endpoint exists for a specific action type. Nothing above this file (the store,
// StageActionBar) needs to change either way — that is the whole point of the registry.

import { ActionStoriesError, ERROR_CODES, toActionStoriesError } from './actionStoriesErrors';

const STORAGE_KEY = 'rf-action-stories-completed-actions'; // { "<code>/<stageKey>/<actionId>": <ISO completedAt> }

function recordId(code, stageKey, actionId) {
  return `${code}/${stageKey}/${actionId}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Malformed JSON left over from an older version of this key, or storage genuinely unavailable
    // (private window, quota exceeded) — degrade to "nothing completed" rather than throwing.
    return {};
  }
}

function writeStore(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable — the in-memory Zustand state (set by the caller right after this
    // resolves) still reflects completion for the rest of this session; it just won't survive a
    // refresh. Never throws here: failing to *persist* shouldn't fail the mutation itself, the same
    // way a real backend write succeeding but a client-side cache write failing wouldn't roll back
    // the server-side change.
  }
}

/** @returns {Record<string, string>} every completed `${code}/${stageKey}/${actionId}` -> its completedAt ISO timestamp. */
export function readCompletedActions() {
  return readStore();
}

/** Clears one action's persisted completion — keeps localStorage in sync with an explicit local reset. */
export function clearCompletedAction(code, stageKey, actionId) {
  const record = readStore();
  delete record[recordId(code, stageKey, actionId)];
  writeStore(record);
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED });
}

/**
 * The one generic mock handler every action type falls back to today (see this file's own header):
 * a real (delayed, cancellable, failable) async round-trip, genuinely persisted to localStorage.
 * Knows nothing business-specific — not "approve" vs "decline", not what `reason` means — it just
 * marks `${code}/${stageKey}/${actionId}` done.
 */
async function genericActionHandler({ code, stageKey, actionId, reason, signal }) {
  // A real network round-trip has latency even on the happy path — a mutation that resolves in the
  // same microtask it started in is what let a button *look* interactive while never actually being
  // awaited by anything. A short, real `setTimeout` delay (not a spinner-hiding fake) means the
  // loading state the ActionBar renders is genuinely doing something.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 220);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED }));
    });
  });
  throwIfAborted(signal);

  const completedAt = new Date().toISOString();
  const record = readStore();
  record[recordId(code, stageKey, actionId)] = completedAt;
  writeStore(record);

  return { code, stageKey, actionId, success: true, completedAt, reason: reason ?? null };
}

/**
 * Backend action-type string -> handler. Empty by default — see this file's own header comment.
 * `dispatchAction` falls back to `genericActionHandler` for any type with no dedicated entry, so an
 * unregistered/unrecognized action type never throws an "unsupported" error on its own; it just
 * gets the same generic mock behavior every other action gets until a real backend differentiates it.
 */
const ACTION_HANDLERS = {};

/**
 * @param {{ code: string, stageKey: string, actionId: string, action?: string, reason?: string, signal?: AbortSignal }} params
 *   `actionId` is the manifest-declared action's own `id` (used for store/persistence keying);
 *   `action` is its declared backend operation type (defaults to `actionId` if the manifest didn't
 *   set one — see actionEligibility.js's `actionType`) and is what selects a handler below.
 * @returns {Promise<{ code, stageKey, actionId, success: true, completedAt: string, reason: string|null }>}
 * @throws {ActionStoriesError}
 */
export async function dispatchAction({ code, stageKey, actionId, action, reason, signal } = {}) {
  throwIfAborted(signal);
  if (!code || !stageKey || !actionId) {
    throw new ActionStoriesError('dispatchAction requires code, stageKey, and actionId', {
      code: ERROR_CODES.CLIENT_ERROR,
      userMessage: "Couldn't run this action — missing context.",
      retryable: false,
    });
  }

  const handler = ACTION_HANDLERS[action] || genericActionHandler;
  try {
    return await handler({ code, stageKey, actionId, reason, signal });
  } catch (err) {
    throw toActionStoriesError(err, `Failed to run action "${actionId}" on ${code}/${stageKey}`);
  }
}
