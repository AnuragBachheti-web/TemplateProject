/**
 * Chart color system — single source of truth for every chart block, replacing each component's
 * own hardcoded hex (e.g. the old `SeriesBlock`'s `BRAND_BLUE = '#2E6BFF'`, which never adapted to
 * dark mode). See src/styles/chart-tokens.css for the underlying values and how they were
 * validated (the `dataviz` skill's color-formula method + `validate_palette.js`) — this module
 * only exposes them by role.
 *
 * Every export below is a CSS var reference string (e.g. `"var(--rf-chart-cat-1)"`), not a
 * resolved hex. Recharts accepts a literal `var(--token)` string directly as a `fill`/`stroke`
 * value, so every chart stays theme-reactive (light/dark) for free — no getComputedStyle, no
 * re-render on theme change.
 */

// ---- Categorical (identity) — fixed order, never cycled ----------------------------------------
// Adjacent-pairs chart forms (bar, line, stacked segments) may use all 8 slots. All-pairs forms
// (scatter, bubble, small multiples — where any two marks can sit side by side) cannot safely
// carry more than the first 3: see the dataviz skill's color-formula.md check 4. None of today's 5
// chart blocks render 2+ categorical series yet (every current fixture is single-series), so only
// slot 1 is actually exercised right now — the rest exist for the day a chart needs more.
export const CATEGORICAL = [
  'var(--rf-chart-cat-1)',
  'var(--rf-chart-cat-2)',
  'var(--rf-chart-cat-3)',
  'var(--rf-chart-cat-4)',
  'var(--rf-chart-cat-5)',
  'var(--rf-chart-cat-6)',
  'var(--rf-chart-cat-7)',
  'var(--rf-chart-cat-8)',
];

export const CATEGORICAL_ALL_PAIRS_SAFE = CATEGORICAL.slice(0, 3);

/** Assigns a categorical color by position, in the fixed order above — never by value/rank. */
export function categoricalColor(index) {
  return CATEGORICAL[index % CATEGORICAL.length];
}

// ---- Sequential (magnitude) — one hue, light -> dark --------------------------------------------
const SEQUENTIAL_STEPS = [
  'var(--rf-chart-seq-1)',
  'var(--rf-chart-seq-2)',
  'var(--rf-chart-seq-3)',
  'var(--rf-chart-seq-4)',
  'var(--rf-chart-seq-5)',
];

// PHASE 6. This used to be the same 5 steps' resolved hex, "kept by hand in lockstep with
// chart-tokens.css", so that a cell's text colour could be chosen by luminance at render time. Two
// things were wrong with that. It duplicated the scale in a module that had to mirror it, which is
// the sort of copy that drifts — and it HAD drifted out of contrast: Phase 5E's T100 measured 60
// elements below AA, every one a white figure on a middle heat step, worst 2.50:1.
//
// The choice now lives beside the scale it depends on, as a `-on` token per step, measured and
// documented there. Nothing here computes a luminance and nothing here holds a colour.
const SEQUENTIAL_STEP_ON = [
  'var(--rf-chart-seq-1-on)',
  'var(--rf-chart-seq-2-on)',
  'var(--rf-chart-seq-3-on)',
  'var(--rf-chart-seq-4-on)',
  'var(--rf-chart-seq-5-on)',
];

function bucketIndex(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor(clamped * SEQUENTIAL_STEPS.length));
}

/** `t` is 0..1 (this value's position between the series' own min and max). */
export function sequentialColor(t) {
  return SEQUENTIAL_STEPS[bucketIndex(t)];
}

// `relativeLuminance` WAS HERE. It existed only to pick a cell's text colour from the duplicated
// hex above, and both went together when that decision moved into chart-tokens.css beside the scale
// it depends on. Nothing in this module computes a colour any more; it names them.

/** Legible text color (near-black or near-white) for a cell painted with `sequentialColor(t)`. */
export function sequentialTextColor(t) {
  return SEQUENTIAL_STEP_ON[bucketIndex(t)];
}

// ---- Status (state) — reserved, never reused for plain series identity -------------------------
// A waterfall's positive/negative delta *means* good/bad, so per the dataviz skill's collision
// rule it wears status tokens, not a fresh diverging pair — reusing Realify's own already-shipped,
// already-theme-aware tokens rather than inventing a second red/green.
export const positiveColor = 'var(--rf-status-success)';
export const negativeColor = 'var(--rf-status-critical)';
export const neutralColor = 'var(--rf-chart-neutral)'; // anchor/total bars — neither a delta nor a category
