// Generic, data-driven width inference for a block that has no EXPLICIT `layout.span` of its own —
// the "conservative fallback derived from block semantics" the composition model needs so a table,
// an itemQueue, or a chart can participate in a mixed-width row instead of always claiming a full
// row to itself. Pure, deterministic, no React — same testing convention as composeSections.js.
//
// Explicit `layout.span` (when present) always wins over everything here — this module only ever
// runs for the "metadata is missing" case. Never keyed on workflow code, stage name, or slotName;
// every signal here is the block's own classified `blockType` and its own already-resolved `value`
// (row count, column count, item richness) — the same category of signal `isGridEligible` already
// used for the scalar/small-object heuristic, extended to the block types that heuristic never
// covered (table, itemQueue, labelValueList, charts, a large object).
import { isDecorativeKey } from '../blocks/decorativeKeys'

const FULL = 12
const HALF = 6
const WIDE = 8
const THIRD = 4

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Meaningful (non-decorative) column count, unioned across every row — mirrors TableBlock's own column union. */
function meaningfulColumnCount(rows) {
  const keys = new Set()
  for (const row of rows) {
    if (!isPlainObject(row)) continue
    for (const key of Object.keys(row)) {
      if (!isDecorativeKey(key)) keys.add(key)
    }
  }
  return keys.size
}

/** A crude, self-contained "how much text is on this one item" proxy — no flattening/formatting needed for a coarse density signal. */
function itemTextWeight(item) {
  if (item === null || typeof item !== 'object') return String(item ?? '').length
  let total = 0
  for (const [key, value] of Object.entries(item)) {
    if (isDecorativeKey(key) || value === null || value === undefined) continue
    if (typeof value === 'string') total += value.length
    else if (typeof value === 'number' || typeof value === 'boolean') total += 4
    // nested arrays/objects deliberately excluded — a rich sub-list already forces this item to
    // read as substantial without needing to walk it further for a width heuristic.
  }
  return total
}

/**
 * A table's natural width is a function of its own column count — a 2–3 column supporting table
 * reads fine at half width; a 6+ column operational table needs the full row (Table-specific
 * composition, per the task's own worked examples).
 */
function tableSpan(value) {
  if (!Array.isArray(value) || value.length === 0) return FULL
  const columns = meaningfulColumnCount(value)
  if (columns <= 3) return HALF
  if (columns <= 5) return WIDE
  return FULL
}

/**
 * A short list of small, simple cards (an option picker, a small legend-with-metadata list) can
 * share a row two-up; a list of genuinely rich items (a long narrative per row, or many of them)
 * needs the full row to stay readable. Confirmed against real data (S9.9/analyze's `candidates`:
 * 6 option cards, each a short name + a compact nested stats list) — 6 items of real but genuinely
 * compact content still read fine two-up rather than as 6 stacked full-width cards.
 */
function itemQueueSpan(value) {
  if (!Array.isArray(value) || value.length === 0) return FULL
  if (value.length > 6) return FULL
  const avgWeight = value.reduce((sum, item) => sum + itemTextWeight(item), 0) / value.length
  return avgWeight <= 80 ? HALF : FULL
}

/**
 * A short label/value list (a compact metric roundup) is a natural third/half-width companion; a
 * longer one, or one carrying real prose in a secondary field, wants the full row.
 */
function labelValueListSpan(value) {
  if (!Array.isArray(value) || value.length === 0) return FULL
  const hasLongField = value.some((item) => itemTextWeight(item) > 90)
  if (hasLongField) return FULL
  if (value.length <= 3) return THIRD
  if (value.length <= 6) return HALF
  return FULL
}

/**
 * A chart with many plotted points/bars is this stage's own featured analysis and earns the full
 * row; a small chart (a handful of categories) is compact enough to share one with another block —
 * "Analyze screens should be chart-forward" without every chart claiming the whole width regardless
 * of how much it actually has to show.
 */
function chartSpan(value) {
  const n = Array.isArray(value) ? value.length : 0
  return n > 12 ? FULL : HALF
}

/**
 * A lone rich descriptor (never scalar-eligible — >3 keys) is usually a medium card at half
 * width; but a genuinely large/prose-heavy object (e.g. a "selected record" detail panel with
 * dozens of fields, several of them full sentences) reads as a squeezed, illegible column at half
 * width and wants the full row instead — the same size-vs-richness split every other flowable
 * block type here already gets.
 */
function objectSpan(value) {
  if (!isPlainObject(value)) return FULL
  const keys = Object.keys(value).length
  if (keys > 12 || itemTextWeight(value) > 200) return FULL
  return HALF
}

/** A gauge row set reads like a compact metric strip — a handful of rows share a half-width column
 * fine; many rows (a long checklist of thresholds) wants the full row to stay legible. */
function gaugeSpan(value) {
  if (!Array.isArray(value) || value.length === 0) return FULL
  return value.length > 5 ? FULL : HALF
}

const SPAN_BY_BLOCK_TYPE = {
  table: tableSpan,
  itemQueue: itemQueueSpan,
  labelValueList: labelValueListSpan,
  barChart: chartSpan,
  lineChart: chartSpan,
  scatterChart: chartSpan,
  waterfallChart: chartSpan,
  heatmapGrid: chartSpan,
  object: objectSpan,
  gauge: gaugeSpan,
}

/**
 * @param {string} blockType
 * @param {*} value - the block's already-resolved data.
 * @returns {number} a span out of 12 — only ever consulted when the block has no explicit
 *   `layout.span` of its own (see composeSections.js's own priority order).
 */
export function inferSpan(blockType, value) {
  const fn = SPAN_BY_BLOCK_TYPE[blockType]
  return fn ? fn(value) : FULL // slider, unknown types — stay full width, the always-safe default
}
