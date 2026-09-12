function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Finds the step in `steps` whose `at` is closest to `value`.
 *
 * This is the whole "how does the slider move other blocks' data" mechanism — deliberately not a
 * formula engine and not a live API call. There is no real `/simulate`-style endpoint yet (see
 * INTEGRATION.md), so calling one would just be a different kind of fake. Instead, a slider's own
 * data can carry a `steps` array — precomputed answers for a handful of known positions. These are
 * no longer hand-authored: extraction/dcLogicSandbox.js's computeControlPayload generates them for
 * any real reference control by actually re-invoking the mockup's own logic at several positions
 * across its declared range and recording exactly which other fields changed (each step entry is
 * `{at, ...rawFixtureKey: itsValueAtThatPosition}`, keyed by raw fixture key — see
 * StageRenderer.jsx's own doc comment on why). Dragging just looks up the nearest one.
 *
 * Plain data-in, data-out logic, kept in its own file (not SliderBlock.jsx) so that file exports
 * only its component — Vite's fast-refresh only reloads cleanly when a component file exports
 * nothing else.
 */
export function findNearestStep(steps, value) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps.reduce((closest, step) => {
    if (!isPlainObject(step) || typeof step.at !== 'number') return closest;
    if (!closest) return step;
    return Math.abs(step.at - value) < Math.abs(closest.at - value) ? step : closest;
  }, null);
}
