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

// The same 5 steps' resolved hex, kept by hand in lockstep with chart-tokens.css — needed only to
// pick a legible text color per cell (a `var()` reference can't be inspected for luminance without
// a DOM round-trip, and every cell needs its color decided the instant it's rendered).
const SEQUENTIAL_STEP_HEX = ['#b7d3f6', '#6da7ec', '#2a78d6', '#1c5cab', '#104281'];

function bucketIndex(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor(clamped * SEQUENTIAL_STEPS.length));
}

/** `t` is 0..1 (this value's position between the series' own min and max). */
export function sequentialColor(t) {
  return SEQUENTIAL_STEPS[bucketIndex(t)];
}

function relativeLuminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Legible text color (near-black or near-white) for a cell painted with `sequentialColor(t)`. */
export function sequentialTextColor(t) {
  const hex = SEQUENTIAL_STEP_HEX[bucketIndex(t)];
  return relativeLuminance(hex) > 0.45 ? '#0B1117' : '#FFFFFF';
}

// ---- Status (state) — reserved, never reused for plain series identity -------------------------
// A waterfall's positive/negative delta *means* good/bad, so per the dataviz skill's collision
// rule it wears status tokens, not a fresh diverging pair — reusing Realify's own already-shipped,
// already-theme-aware tokens rather than inventing a second red/green.
export const positiveColor = 'var(--rf-status-success)';
export const negativeColor = 'var(--rf-status-critical)';
export const neutralColor = 'var(--rf-chart-neutral)'; // anchor/total bars — neither a delta nor a category
