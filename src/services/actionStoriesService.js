// SAMPLE DATA — reads local fixtures; swap the body of these two functions for real API calls
// when GET /v1/action-stories exists, nothing else should need to change.
//
// Both functions are async and return Promises on purpose, matching the shape a real
// `actionStoriesClient.get(...)` call would have — every call site already awaits them, so the
// swap touches only this file.

import { validateManifest } from '@/features/action-stories/manifests/validateManifest';

// Vite's import.meta.glob is how a set of local modules whose exact names aren't known until
// runtime (a workflow `code`, a `stageKey`) gets loaded — a dynamic `import(`...${code}...`)`
// can't be statically analyzed the same way. Not eager: each workflow's manifest and each stage's
// fixture load lazily, on the same cadence a real per-workflow API call would.
const indexLoaders = import.meta.glob('/src/features/action-stories/data/index.json');
const manifestLoaders = import.meta.glob('/src/features/action-stories/manifests/*.json');
const rawFixtureLoaders = import.meta.glob('/src/features/action-stories/data/raw/*/*.json');

const INDEX_PATH = '/src/features/action-stories/data/index.json';

/** @returns {Promise<Array<{code: string, name: string, stages: string[]}>>} every workflow. */
export async function getWorkflowIndex() {
  const load = indexLoaders[INDEX_PATH];
  if (!load) {
    throw new Error('Action Stories workflow index is missing — run `npm run extract` first.');
  }
  const mod = await load();
  return mod.default;
}

/**
 * @param {string} code - workflow code, e.g. "S9.11".
 * @param {string} stageKey - "reason" | "analyze" | "decide" | "execute" | "live".
 * @returns {Promise<{ manifest: object, fixture: object }>} the stage's manifest (blocks list)
 *   and its fixture ({ code, stageKey, name, props, state, data }) for resolveBinding to read.
 */
export async function getStageData(code, stageKey) {
  const manifestPath = `/src/features/action-stories/manifests/${code}.json`;
  const loadManifest = manifestLoaders[manifestPath];
  if (!loadManifest) {
    throw new Error(`No manifest found for workflow "${code}".`);
  }
  const manifestMod = await loadManifest();
  const stageManifests = manifestMod.default;
  const manifest = stageManifests.find((m) => m.stageKey === stageKey);
  if (!manifest) {
    throw new Error(`Workflow "${code}" has no "${stageKey}" stage.`);
  }

  const problems = validateManifest(manifest);
  if (problems.length > 0) {
    console.warn(`[actionStoriesService] manifest problems for ${code}/${stageKey}:`, problems);
  }

  const rawPath = `/src/features/action-stories/data/raw/${code}/${stageKey}.json`;
  const loadFixture = rawFixtureLoaders[rawPath];
  if (!loadFixture) {
    throw new Error(`No fixture data found for "${code}/${stageKey}".`);
  }
  const fixtureMod = await loadFixture();

  return { manifest, fixture: fixtureMod.default };
}
