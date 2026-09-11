// SAMPLE DATA — reads local fixtures; swap the body of these two functions for real API calls
// when GET /v1/action-stories exists (see INTEGRATION.md §3 — `httpClient.js` is already built and
// waiting), nothing else should need to change.
//
// Both functions are async and return Promises on purpose, matching the shape a real
// `httpClient.get(...)` call would have — every call site already awaits them, so the swap touches
// only this file. Both now also accept an optional `{ signal }` in their last argument (an
// AbortSignal) — every current call site can ignore it and keep working exactly as before; a
// caller that wants real cancellation (not just "ignore a stale response after the fact," which
// pages/*.jsx already did correctly) can pass one through. See actionStoriesErrors.js for the
// taxonomy every failure below is normalized into, and httpClient.js's own withRetryOnce for the
// retry policy this file mirrors for its own async module loads.

import { validateManifest } from '@/features/action-stories/manifests/validateManifest';
import { ActionStoriesError, ERROR_CODES, isTransient, toActionStoriesError } from './actionStoriesErrors';

// Vite's import.meta.glob is how a set of local modules whose exact names aren't known until
// runtime (a workflow `code`, a `stageKey`) gets loaded — a dynamic `import(`...${code}...`)`
// can't be statically analyzed the same way. Not eager: each workflow's manifest and each stage's
// fixture load lazily, on the same cadence a real per-workflow API call would.
const indexLoaders = import.meta.glob('/src/features/action-stories/data/index.json');
const manifestLoaders = import.meta.glob('/src/features/action-stories/manifests/*.json');
const rawFixtureLoaders = import.meta.glob('/src/features/action-stories/data/raw/*/*.json');

const INDEX_PATH = '/src/features/action-stories/data/index.json';

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED });
  }
}

/**
 * A single retry, only for a failure this taxonomy considers transient (a chunk load failing to
 * fetch over a flaky connection is the real-world analog here — Vite serves each glob entry as its
 * own dynamically-imported module, which is itself a network request in a deployed app). Never
 * retries a NOT_FOUND/MALFORMED failure — that would just fail the same way again.
 */
async function withRetryOnce(load, { signal } = {}) {
  throwIfAborted(signal);
  try {
    return await load();
  } catch (err) {
    const classified = toActionStoriesError(err);
    if (!isTransient(classified.code)) throw classified;
    await new Promise((resolve) => setTimeout(resolve, 200));
    throwIfAborted(signal);
    try {
      return await load();
    } catch (retryErr) {
      throw toActionStoriesError(retryErr);
    }
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @returns {Promise<Array<{code: string, name: string, stages: string[]}>>} every workflow. */
export async function getWorkflowIndex({ signal } = {}) {
  throwIfAborted(signal);
  const load = indexLoaders[INDEX_PATH];
  if (!load) {
    throw new ActionStoriesError('Action Stories workflow index is missing — run `npm run extract` first.', {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "We couldn't find any workflows right now.",
    });
  }

  let mod;
  try {
    mod = await withRetryOnce(load, { signal });
  } catch (err) {
    throw toActionStoriesError(err, 'Failed to load workflow index');
  }
  throwIfAborted(signal);

  const index = mod?.default;
  if (!Array.isArray(index) || index.some((wf) => !isPlainObject(wf) || typeof wf.code !== 'string' || !Array.isArray(wf.stages))) {
    throw new ActionStoriesError('Workflow index response is not a valid array of {code, name, stages}', {
      code: ERROR_CODES.MALFORMED,
    });
  }
  return index;
}

/**
 * @param {string} code - workflow code, e.g. "S9.11".
 * @param {string} stageKey - "reason" | "analyze" | "decide" | "execute" | "live".
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ manifest: object, fixture: object }>} the stage's manifest (blocks list)
 *   and its fixture ({ code, stageKey, name, props, state, data }) for resolveBinding to read.
 */
export async function getStageData(code, stageKey, { signal } = {}) {
  throwIfAborted(signal);

  const manifestPath = `/src/features/action-stories/manifests/${code}.json`;
  const loadManifest = manifestLoaders[manifestPath];
  if (!loadManifest) {
    throw new ActionStoriesError(`No manifest found for workflow "${code}".`, {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "We couldn't find that workflow.",
    });
  }

  let manifestMod;
  try {
    manifestMod = await withRetryOnce(loadManifest, { signal });
  } catch (err) {
    throw toActionStoriesError(err, `Failed to load manifest for "${code}"`);
  }
  throwIfAborted(signal);

  const stageManifests = manifestMod?.default;
  if (!Array.isArray(stageManifests)) {
    throw new ActionStoriesError(`Manifest for "${code}" is not a valid array of stage manifests.`, {
      code: ERROR_CODES.MALFORMED,
    });
  }
  const manifest = stageManifests.find((m) => m.stageKey === stageKey);
  if (!manifest) {
    throw new ActionStoriesError(`Workflow "${code}" has no "${stageKey}" stage.`, {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "We couldn't find that stage.",
    });
  }

  const problems = validateManifest(manifest);
  if (problems.length > 0) {
    // Still surfaced to the UI — not just console.warn'd — as a MALFORMED failure: a
    // structurally-invalid manifest rendering "whatever that produces" was exactly
    // AUDIT_REPORT.md §12's callout ("the malformed manifest still renders"). The full problem
    // list stays in the console for a developer; the user gets the safe, generic message.
    console.warn(`[actionStoriesService] manifest problems for ${code}/${stageKey}:`, problems);
    throw new ActionStoriesError(`Manifest for "${code}/${stageKey}" failed validation: ${problems.join('; ')}`, {
      code: ERROR_CODES.MALFORMED,
    });
  }

  const rawPath = `/src/features/action-stories/data/raw/${code}/${stageKey}.json`;
  const loadFixture = rawFixtureLoaders[rawPath];
  if (!loadFixture) {
    throw new ActionStoriesError(`No fixture data found for "${code}/${stageKey}".`, {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "We couldn't find that stage's data.",
    });
  }

  let fixtureMod;
  try {
    fixtureMod = await withRetryOnce(loadFixture, { signal });
  } catch (err) {
    throw toActionStoriesError(err, `Failed to load fixture for "${code}/${stageKey}"`);
  }
  throwIfAborted(signal);

  const fixture = fixtureMod?.default;
  if (!isPlainObject(fixture)) {
    throw new ActionStoriesError(`Fixture for "${code}/${stageKey}" is not a valid object.`, {
      code: ERROR_CODES.MALFORMED,
    });
  }

  return { manifest, fixture };
}
