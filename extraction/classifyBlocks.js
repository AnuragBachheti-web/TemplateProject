// Generation-time-only helpers for turning one stage fixture's `data` object into a manifest's
// block list. Not shipped with the app — src/features/action-stories/manifests/blockTypes.js and
// resolveBinding.js (the runtime pieces) don't depend on any of this.
//
// See src/features/action-stories/manifests/REPORT.md for the reasoning behind the semantic
// overrides below and their confidence levels.

// ---- filtering out pure presentation values ------------------------------------------------
//
// RENDERED_UI_FORENSIC_AUDIT.md §3.5/§8: confirmed leaking raw internal values as visible content
// — a FontAwesome glyph string (`fa-solid fa-paper-plane`) and a CSS border shorthand
// (`1px solid var(--ink-200)`) neither matched any pattern here, and both are TOP-LEVEL scalar
// fields (`pushAllIcon`, `divider`), so — unlike a nested item field — no key-name-based decorative
// check ever ran on them either (`planSlotNames` below only ever filtered top-level fields by
// VALUE). Both new patterns are still purely VALUE-shaped checks, same as every existing one here —
// never a key-name guess for a top-level field, which is what keeps this from ever risking a real
// business field (an "iconCount" a real number, an "iconLabel" a real sentence — neither matches
// either pattern below).
const STYLE_VALUE_PATTERNS = [
  /^var\(--/,
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(/i,
  /^color-mix\(/i,
  /^linear-gradient\(/i,
  /^fa[srlbd]?-(solid|regular|light|duotone|brands)\b/i, // an icon glyph name, e.g. "fa-solid fa-lock"
  /^\d+(\.\d+)?(px|em|rem)\s+(solid|dashed|dotted|double|groove|ridge|none)\b/i, // a border/divider shorthand
]

// Bare CSS keywords ("none", "center", "pointer", ...) are AMBIGUOUS in a way STYLE_VALUE_PATTERNS
// above never is — "none" is also a completely ordinary business answer ("Buy Box target: none",
// "risk: none"), so unlike the unambiguous var(--...)/hex/rgba/icon-glyph/border-shorthand patterns
// (which no real business field would ever coincidentally equal), matching these by VALUE alone is
// unsafe. Confirmed: `S9.6/reason.roles`' `bb: "none"` (one role genuinely has no Buy Box target)
// and `S10.3/execute.cases`' `risk: "none"` (one case genuinely carries no risk) were both silently
// excluded from `meaningfulKeys` on just that one row, breaking that row's shape-uniformity with its
// siblings and disqualifying the whole array from `table` promotion — both should be tables, both
// rendered as the generic `itemQueue` card list instead. Every *correct* use of these bare keywords
// in the real corpus (`*Cursor`, `*Shadow`, `*Show`, `align`) has a key name that itself reads as
// presentational — so these keywords now only count as styling when the KEY also hints at it,
// checked the same word-boundary way DECORATIVE_WORDS already is (never a raw substring test, so a
// real field like "showcase" or "rowCount" is never a false positive).
const STYLE_KEYWORD_VALUES = new Set([
  'inline-flex',
  'flex',
  'flex-start',
  'flex-end',
  'none',
  'block',
  'inline',
  'inline-block',
  'grid',
  'center',
  'pointer',
  'default',
  'not-allowed',
  'wait',
  'row',
  'column',
  'transparent',
])
const STYLE_KEY_HINT_WORDS = new Set(['cursor', 'shadow', 'show', 'align', 'display', 'justify', 'direction'])
const CAMEL_WORD_RE_LOCAL = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g

function isStyleKeyHint(key) {
  if (key === undefined) return true // no key context to check against (e.g. an array-of-objects scan) — preserve prior behavior
  const words = String(key).match(CAMEL_WORD_RE_LOCAL) ?? []
  return words.some((w) => STYLE_KEY_HINT_WORDS.has(w.toLowerCase()))
}

function isStyleString(v, key, forceKeyword) {
  if (typeof v !== 'string') return false
  if (STYLE_VALUE_PATTERNS.some((re) => re.test(v))) return true
  return STYLE_KEYWORD_VALUES.has(v) && (forceKeyword || isStyleKeyHint(key))
}

/**
 * True for a value that carries no information beyond CSS styling/visibility.
 * @param {string} [key] - the field's own key, when known — see STYLE_KEY_HINT_WORDS above for why
 *   a bare CSS keyword (unlike var(--...)/hex/rgba/icon-glyph/border-shorthand) needs this to decide
 *   ambiguous cases safely. The unambiguous STYLE_VALUE_PATTERNS checks are unaffected either way.
 * @param {boolean} [forceKeyword] - true when this same key was already OBSERVED holding an
 *   unambiguous style value (var(--...)/hex/rgba/...) somewhere else in the same row set — see
 *   computeStyleGovernedKeys below. A field like `rule`/`bg` that's `var(--ink-50)` on most rows and
 *   bare `"transparent"` on one emphasized row is established as decorative by its OWN sibling
 *   values, data-driven, never a second hardcoded key-name guess alongside STYLE_KEY_HINT_WORDS.
 */
export function isPureStyleValue(v, key, forceKeyword) {
  if (isStyleString(v, key, forceKeyword)) return true
  if (Array.isArray(v) && v.length > 0) {
    return v.every((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
      return Object.entries(item).every(([k, sub]) => isStyleString(sub, k))
    })
  }
  return false
}

// ---- structural block-type classification ---------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// A field can be decorative by NAME even when its value isn't a recognizable CSS/style string —
// an icon glyph name (e.g. "fa-solid fa-truck-fast") is a plain string, but it's still styling,
// not content, and neither a table column nor a chart axis should be built from one.
//
// RENDERED_UI_FORENSIC_AUDIT.md §3.5/§8: a plain trailing-suffix regex missed a compound key like
// `dotInner` ("dot" isn't the LAST word) — confirmed leaking "Dot Inner: transparent" as visible
// text on S9.1/Decide's `slates`. Checked word-by-word (splitting on camelCase boundaries) instead,
// so the decorative word can appear anywhere in the key, not only at the end. Never matches a key
// merely for CONTAINING a decorative-looking substring — "dot" is only a match as a whole
// camelCase word ("dotInner" → ["dot","Inner"]), so a real field like "dotation" or "iconography"
// (neither of which occurs in this dataset, but the rule is deliberately word-bounded, not a raw
// substring test) is never a false positive.
// `dash` (an SVG stroke-dasharray, e.g. S9.9/analyze.cliffs' `dash: "none"|"4 3"`) and `anchor` (an
// SVG text-anchor, "start"/"middle"/"end") joined this list for the same reason `stroke` already
// was: both are exclusively chart/SVG presentation properties in this corpus (checked corpus-wide —
// every occurrence of either is a coordinate-line/marker's own drawing instruction, never a business
// field) — see PLOT_POSITION_KEYS below for the coordinate keys (tx/ty/lx/ly/nx) that came with them.
const DECORATIVE_WORDS = new Set([
  'bg', 'fg', 'tone', 'tint', 'border', 'cursor', 'icon', 'glow', 'edge', 'dot', 'shadow',
  'opacity', 'mark', 'hue', 'fill', 'stroke', 'weight', 'divider', 'radius', 'dash', 'anchor',
])
const CAMEL_WORD_RE = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g

// Exported (not just used locally) so extraction/audit.js can check top-level raw keys against the
// exact same word-boundary rule the real pipeline uses, instead of maintaining its own drifting
// copy — a stale local copy of this exact function (a trailing-suffix-only regex, the same bug
// this word-boundary version was written to fix) previously caused audit.js to under-filter.
export function isDecorativeKey(key) {
  const words = String(key).match(CAMEL_WORD_RE) ?? []
  return words.some((w) => DECORATIVE_WORDS.has(w.toLowerCase()))
}

// extraction/dcLogicSandbox.js's attachRawRecords attaches this internal companion onto a row
// whenever a matching raw-record provider was found — never a real content column, so classifier
// decisions (table promotion, column uniformity, ...) must never see it, exactly like TableBlock.jsx's
// own HIDDEN_COLUMN_KEYS at render time.
const HIDDEN_KEYS = new Set(['__raw'])

/** An item's own keys, minus anything decorative by name, by (CSS-style) value, or an internal
 * extraction companion field.
 * @param {Set<string>} [styleGovernedKeys] - see computeStyleGovernedKeys below; keys already
 *   established as decorative by a sibling row's own unambiguous style value, for a bare-keyword
 *   value on THIS row to inherit the same treatment. */
function meaningfulKeys(item, styleGovernedKeys) {
  return Object.keys(item).filter(
    (k) => !HIDDEN_KEYS.has(k) && !isDecorativeKey(k) && !isPureStyleValue(item[k], k, styleGovernedKeys?.has(k)),
  )
}

/**
 * Scans every item in a row set once and returns the keys that hold an UNAMBIGUOUS style value
 * (var(--...)/hex/rgba/color-mix/linear-gradient — never a bare keyword, which is exactly the
 * ambiguous case this exists to resolve) on at least one row. A key established this way is
 * decorative for every row in the set, including a row where it happens to hold a bare CSS keyword
 * instead (`rule: "var(--ink-50)"` on three rows, `rule: "transparent"` on the emphasized fourth —
 * without this, that fourth row gains a business-looking `rule` column its siblings don't have,
 * breaking the row-shape uniformity table promotion requires). Purely structural — this is why
 * `bb: "none"` (S9.6/reason.roles) and `risk: "none"` (S10.3/execute.cases) are correctly left
 * alone: neither key ever holds a var(--...)/hex/rgba value anywhere in their own row sets, so
 * there's nothing here to govern them — they stay real content.
 */
function computeStyleGovernedKeys(items) {
  const governed = new Set()
  for (const item of items) {
    if (!isPlainObject(item)) continue
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string' && STYLE_VALUE_PATTERNS.some((re) => re.test(v))) governed.add(k)
    }
  }
  return governed
}

// Coordinate-only field names — an item that boils down to nothing but these once decoration is
// stripped is a plotted point, not a "thing" worth its own card or table row. `r` (a point's
// radius, e.g. a bubble-chart dot sized by volume) was missing here — a {hue, r, cx, cy} bubble
// point failed this check, fell through to the table check instead, and rendered as a raw R/CX/CY
// data table (214 rows) instead of a scatter/bubble chart. See extraction/audit.js's A.2 check.
// This check is scatterChart-only — a bar-shaped row that also happens to carry a `label` is
// caught by isBarChartShaped (below) *before* this one ever runs, so this set staying broad
// (h/value included, not just x/y/cx/cy/r) is safe: it only ever fires on label-less rows.
const CHART_COORD_KEYS = new Set(['h', 'value', 'x', 'y', 'cx', 'cy', 'r'])

// A row's magnitude can live under any of these names — the same alias list
// LabelValueListBlock.jsx already picks its displayed value from (`value ?? note ?? detail ??
// amount ?? pct`), narrowed to the ones that are actually numeric magnitudes rather than free text.
// Deliberately does NOT include a generic 1-2 letter key like `n` — that name is just as often a
// step/sequence number (S9.6/decide.sequence, S9.11/execute.stages, S10.1/reason.order all use
// `n: "1"/"2"/"3"` as an ordinal, not a magnitude) as it is a count, and a false-positive bar chart
// (plotting step numbers as bar heights) is worse than leaving a real count-shaped row
// (S9.1/decide.moveBar) in labelValueList, where it still renders correctly, just not as a chart.
const CHART_MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount']

function isNumericLike(v) {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v))
  return false
}

// A rich, uniform, >=4-column labeled row set normally promotes from labelValueList to table (see
// classifyBlockType's own comment on why) — this is the narrow, explicit exemption list for raw
// keys that should keep the compact checklist treatment regardless of column count. Raw-key-keyed,
// same style as EXACT_KEY_OVERRIDES/PRIORITY_GROUPS below — never a workflow code.
const CHECKLIST_RAW_KEYS = new Set(['checks'])

// A coordinate/pixel-position value (x/y/cx/cy/top/height) is always a plain float in this
// dataset, so isNumericLike's strict `Number(v)` is the right test for those. A *magnitude*
// (a bar's value, a heatmap cell's count/LTV) is usually pre-formatted for display instead
// ("$26.3K", "1,940", "74px", "5.9%") — isNumericLike rejects every one of those (Number("$26.3K")
// is NaN), which is what originally hid S9.2/decide.weeks and S9.13/analyze.rfmGrid from their
// real chart classification. This tolerates that formatting; used only where a value's job is
// "is this a plottable magnitude", never for coordinates.
const FORMATTED_MAGNITUDE_RE = /^[+\-−]?[$€£]?[\d,]+(?:\.\d+)?\s*(?:px|%|[KkMm])?$/
function looksLikeMagnitude(v) {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v !== 'string' || v.trim() === '') return false
  return FORMATTED_MAGNITUDE_RE.test(v.trim())
}

// ---- unit-compatibility check (confirmed bug fix: S9.1/decide.checks plots a ratio, a dollar
// figure and a percent on one shared linear bar scale — see extraction/audit-report.md §A.4 and
// AUDIT_REPORT.md §7.1/§7.2) ---------------------------------------------------------------------
//
// A bar chart's y-axis is one shared linear scale — every bar on it must be the same *kind* of
// number, or the comparison it invites ("this bar is taller than that one") is meaningless or
// actively misleading (a $440K capital-ceiling figure dwarfing a 2.31 GMROI ratio and a 5.6% exit
// rate is not "bigger", it's a different unit entirely). This infers a coarse unit from the
// formatted string's own symbol — currency glyph, trailing "%", trailing "px" — deliberately
// ignoring the K/M magnitude suffix (parseMagnitude already expands "$18.0K" to a real number of
// the *same* currency unit as "$4,120", so two currency figures at different scales are still
// legitimately comparable; only a genuinely different unit is not).
function magnitudeUnit(v) {
  if (typeof v === 'number') return 'number'
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (s === '') return null
  if (/[$€£]/.test(s)) return 'currency'
  if (/%\s*$/.test(s)) return 'percent'
  if (/px\s*$/i.test(s)) return 'px'
  return 'number'
}

/**
 * True when the array's *dominant* magnitude key — whichever CHART_MAGNITUDE_KEYS name at least one
 * row actually populates with a real magnitude — reports one consistent unit among the rows that
 * populate it. Deliberately does NOT compare a row that falls back to a *different* key (its own
 * dominant-key field is blank/absent) against that dominant unit: a blank `value` with an `h: "2px"`
 * fallback (S9.2/decide.weeks' zero-revenue weeks, drawn as a 2px sliver in the original mockup) is
 * a rendering-fallback gap, not a competing semantic unit — that row simply has no opinion on the
 * dominant metric's unit, so it doesn't count against consistency.
 */
function hasConsistentMagnitudeUnits(value) {
  const dominantKey = CHART_MAGNITUDE_KEYS.find((k) => value.some((item) => looksLikeMagnitude(item?.[k])))
  if (!dominantKey) return true
  const units = new Set(
    value
      .map((item) => item?.[dominantKey])
      .filter((v) => looksLikeMagnitude(v))
      .map(magnitudeUnit)
      .filter((u) => u !== null),
  )
  return units.size <= 1
}

/** Same idea as hasConsistentMagnitudeUnits, for a bare array of magnitudes (no per-item key to pick). */
function hasConsistentBareUnits(value) {
  const units = new Set(value.map(magnitudeUnit).filter((u) => u !== null))
  return units.size <= 1
}

/**
 * Bar-shaped: every row has a string `label` *and* a numeric-looking magnitude, *and* the array's
 * dominant magnitude key shares one coarse unit across the rows that populate it (see
 * hasConsistentMagnitudeUnits above) — the exact shape that used to hide inside `labelValueList`
 * (S9.2/decide.weeks, S9.9/decide.cash, S9.10/reason.stack: `{label, value, h}`), because the plain
 * "every item has a label" check ran first and never looked any further. Checked before that plain
 * check for exactly this reason. The unit guard keeps a same-shape-but-different-meaning row group
 * (a governance checklist mixing a ratio/dollar-figure/percent, a totals row mixing dollars with a
 * bare SKU count) out of barChart — it falls through to the shape checks below and lands in
 * labelValueList instead, the same place every other heterogeneous-unit row group already renders.
 */
function isBarChartShaped(value, identityKey) {
  return (
    identityKey !== null &&
    value.every((item) => CHART_MAGNITUDE_KEYS.some((k) => looksLikeMagnitude(item[k]))) &&
    hasConsistentMagnitudeUnits(value)
  )
}

/**
 * Waterfall/bridge-shaped: every row has a numeric `top` (its running cumulative position) *and*
 * `height` (its own segment size) *and* a `value` (the signed delta/total to display), with at
 * least one row marked `anchor: true` (a baseline/total bar, as opposed to a floating delta) — the
 * shape found in S10.1/analyze.bars (the "Variance bridge" workflow). Deliberately narrow: `top` +
 * `height` together are a specific enough combination that nothing else in these fixtures carries
 * both under those exact names.
 */
function isWaterfallShaped(value) {
  let hasAnchor = false
  const allMatch = value.every((item) => {
    if (item.anchor === true) hasAnchor = true
    return isNumericLike(item.top) && isNumericLike(item.height) && item.value !== undefined
  })
  return allMatch && hasAnchor
}

/**
 * Heatmap/matrix-grid-shaped: every row has a string `label` (the row identity) *and* a `cells` (or
 * `grid`) array of ≥1 plain objects, where every cell carries at least one numeric-looking field
 * and — unlike a real itemQueue sub-list — no `label`/`title`/`name` of its own (a cell is a
 * positionally-indexed matrix entry, not a "thing"). The shape found in S9.13/analyze.rfmGrid.
 */
function isHeatmapGridShaped(value) {
  return value.every((row) => {
    const cells = row.cells ?? row.grid
    if (typeof row.label !== 'string' || !Array.isArray(cells) || cells.length === 0) return false
    return cells.every((cell) => {
      if (!isPlainObject(cell)) return false
      if ('label' in cell || 'title' in cell || 'name' in cell) return false
      return Object.values(cell).some((v) => looksLikeMagnitude(v))
    })
  })
}

// ---- identity-field generalization (P0 fix: DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §3/§7/§8) ------
//
// Every bar/scatter/table-promotion rule below used to gate on a literal `label` key. The S9.11
// Decide canonical case's own `slate` rows use `name`, not `label`, and fell through EVERY one of
// these branches as a result — the exact root cause the forensic audit traced. Broadened to accept
// any of a small, ordered set of identity-like field names, checked in priority order (never by
// value content alone at this stage — a name match still has to hold on EVERY row as a real string).
const IDENTITY_KEY_CANDIDATES = [
  'label', 'name', 'title', 'sku', 'id', 'code', 'product', 'item', 'entity', 'category', 'role',
]

/**
 * @param {Array<object>} value
 * @returns {string|null} the field every row uses as its own identity, or null if none qualifies.
 * Tries the fixed candidate list first, in order (a real business field literally named one of
 * these, present as a non-empty string on every row). Failing that — and only when there are at
 * least 2 rows, so a lone item never "invents" an identity out of one incidental value — falls back
 * to any OTHER string field that is fully UNIQUE across every row: a near-certain identity signal
 * even under a naming convention this list doesn't anticipate, still never based on the key's name
 * alone.
 */
function findIdentityKey(value) {
  for (const candidate of IDENTITY_KEY_CANDIDATES) {
    if (value.every((item) => isPlainObject(item) && typeof item[candidate] === 'string' && item[candidate].trim() !== '')) {
      return candidate
    }
  }
  if (value.length < 2) return null
  const firstKeys = Object.keys(value[0] ?? {})
  for (const key of firstKeys) {
    if (IDENTITY_KEY_CANDIDATES.includes(key)) continue
    if (!value.every((item) => isPlainObject(item) && typeof item[key] === 'string' && item[key].trim() !== '')) continue
    const distinct = new Set(value.map((item) => item[key]))
    if (distinct.size === value.length) return key
  }
  return null
}

// ---- nested row-level control detection (P1/P2 fix: DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §9/§11)
//
// A small (2-6 item) array of `{label, ...}` options nested inside an otherwise-scalar table row is
// a genuine row-level segmented control (S9.11 Decide's own `slate[].modes`: `[{label:"Roll"},
// {label:"Test"}]`) — NOT a disqualifying "this row has a nested object, so it can't be a table row"
// signal the way an arbitrary rich sub-list would be. Recognized structurally (shape only, never a
// hardcoded field name like "modes") and excluded from the scalar-column uniformity check below, so
// a table whose only non-scalar field is a real inline control still promotes correctly instead of
// silently losing that control (extraction) or failing to promote (classification) the way it used
// to.
function isNestedControlColumn(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 6 &&
    value.every((opt) => isPlainObject(opt) && typeof opt.label === 'string' && opt.label.trim() !== '')
  )
}

/** Splits one row's meaningful (non-decorative) keys into plain scalar columns, nested-control
 * columns (see isNestedControlColumn above), and everything else — a genuinely rich nested
 * object/array that ISN'T control-shaped (a destination card's own `items: [...]` line-item list,
 * S9.1/execute.dests's own shape) goes in `orphaned`: real content a flat table CELL would silently
 * render blank (TableBlock.jsx's flattenDisplayValue has no way to show a list of objects), so its
 * presence disqualifies the whole row set from table promotion below rather than being silently
 * uncounted — the exact gap that let `dests` (identity="name" + 4 short scalar columns, but ALSO a
 * rich embedded diff list) wrongly promote to `table` before this fix. */
function splitScalarAndControlKeys(item, keys) {
  const scalar = []
  const control = []
  const orphaned = []
  for (const key of keys) {
    const v = item[key]
    if (['string', 'number', 'boolean'].includes(typeof v)) scalar.push(key)
    else if (isNestedControlColumn(v)) control.push(key)
    else if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) orphaned.push(key)
  }
  return { scalar, control, orphaned }
}

/** @returns {string[]} every raw key across `value` that isNestedControlColumn-shaped, uniformly
 * present (same key, same shape) on every row — used by generateManifests.js to record which
 * columns of a `table` block are inline controls, so the renderer can surface them (never inferred
 * again at render time from scratch). */
export function findNestedControlColumns(value) {
  if (!Array.isArray(value) || value.length === 0) return []
  const first = value[0]
  if (!isPlainObject(first)) return []
  return Object.keys(first).filter((key) => value.every((item) => isPlainObject(item) && isNestedControlColumn(item[key])))
}

// ---- gauge / threshold detection (P0/P1 fix: DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §4/§9) --------
//
// A row carrying both a magnitude (`value`/`pct`/...) AND a sibling THRESHOLD-shaped field (a
// ceiling/floor/target/cap it's being measured against) is a gauge/meter reading, not a plain metric
// or a spreadsheet column — S9.19/decide's own `bars` ({label, value, pct, limitPct}) is exactly
// this shape. Checked before the plain bar-chart rule so a gauge row (which also incidentally
// satisfies "has a label and a magnitude") isn't swallowed by the more generic chart type first.
const THRESHOLD_SIBLING_KEYS = ['threshold', 'limit', 'limitPct', 'ceiling', 'floor', 'target', 'cap']

function isGaugeShaped(value) {
  return value.every((item) => {
    if (!isPlainObject(item)) return false
    const hasMagnitude = CHART_MAGNITUDE_KEYS.some((k) => looksLikeMagnitude(item[k]))
    const hasThreshold = THRESHOLD_SIBLING_KEYS.some((k) => looksLikeMagnitude(item[k]))
    return hasMagnitude && hasThreshold
  })
}

function isSliderShaped(value) {
  const { min, max, value: current } = value
  if (![min, max, current].every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  return min < max && current >= min && current <= max
}

// A raw SVG line path ("M44.0 230.0 L74.1 228.4 L104.3 226.6 ..."), same as SeriesBlock/
// LineChartBlock parses — classifyBlockType's plain top-level string branch always returned
// 'text' unconditionally, so every one of these (47 across 15 workflows: `data.p50`, `data.actual`,
// `data.priorPath`, `data.cvrPath`, ...) rendered as raw, unreadable path-string text instead of a
// chart. Checked before the plain-string 'text' fallback for exactly that reason.
const SVG_LINE_PATH_RE = /^M\s*-?[\d.]+\s+-?[\d.]+(?:\s+L\s*-?[\d.]+\s+-?[\d.]+)+$/i

/**
 * Multi-series lineChart-shaped: every row is a plain object carrying its own raw SVG path string
 * under `path` — LineChartBlock.jsx already renders an array of `{path, name?, tone?}` as one line
 * per entry (see its own doc comment), but classifyBlockType never produced that shape: a curve row
 * almost always also carries a descriptive `label` ("DTC · $18.40"), so it was caught by the plain
 * "every item has a string label" rule below before this ever ran (confirmed:
 * S9.3/analyze.curves — 4 real trend lines, rendered as an unreadable raw-path text list). Checked
 * before every other array-of-objects rule: a `path` string is unambiguous — nothing else in this
 * vocabulary uses that key for anything but a real SVG path.
 */
function isMultiSeriesLineShaped(value) {
  return value.every((item) => typeof item.path === 'string' && item.path.trim().length > 0)
}

/**
 * Labeled-scatter-shaped: every row has numeric `x`/`cx` and `y`/`cy` (optionally `r`, sizing a
 * bubble) *and* a string `label` naming the point — the same coordinate shape `isScatterShaped`
 * (below) already recognizes, except every one of these rows also carries a text annotation
 * (S9.4/analyze.points: `"Amazon Ads · $52K · 0.95"`; S9.9/analyze.ladders: a markdown-ladder
 * scenario name + its own dollar/point figures), which used to make it lose to the plain "every
 * item has a label" catch-all before ever reaching the label-less-only scatter check further down.
 * Checked after bar/waterfall/heatmap (a labeled row with a real magnitude key still prefers those,
 * unchanged) but before the plain label catch-all, so a labeled point plots as a point instead of
 * flattening into a text list with no chart at all.
 */
function isLabeledScatterShaped(value, identityKey) {
  if (identityKey === null) return false
  return value.every((item) => {
    const hasX = item.x !== undefined ? isNumericLike(item.x) : isNumericLike(item.cx)
    const hasY = item.y !== undefined ? isNumericLike(item.y) : isNumericLike(item.cy)
    return hasX && hasY && (item.x !== undefined || item.cx !== undefined) && (item.y !== undefined || item.cy !== undefined)
  })
}

/**
 * @param {*} value
 * @param {string} [rawKey] - the field's own raw key name, when known. Only used for the
 *   axis-label-array override below; every other rule classifies on shape alone.
 * @returns {string|null} one of blockTypes.js's BLOCK_TYPES, or null if this value isn't worth a block.
 */
export function classifyBlockType(value, rawKey) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    if (value.length === 0) return null
    return SVG_LINE_PATH_RE.test(value.trim()) ? 'lineChart' : 'text'
  }
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'flag'
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (value.every((item) => isPlainObject(item))) {
      // Computed once per array, up front — see findIdentityKey's own comment. Every check below
      // that used to hardcode `.label` now takes this instead, so a row set identified by `name`/
      // `sku`/`id`/... (or any other genuinely unique string field) is treated exactly the same way
      // a `label`-keyed one always was; nothing here reads a workflow code or a raw key name to
      // decide this.
      const identityKey = findIdentityKey(value)

      // A `path`-per-row array is an unambiguous multi-series trend line (see
      // isMultiSeriesLineShaped's own comment) — checked first, before anything that keys off an
      // identity field, since a curve row almost always carries one too.
      if (isMultiSeriesLineShaped(value)) return 'lineChart'

      // A gauge/meter row (a magnitude measured against a threshold/ceiling/floor/target sibling —
      // see isGaugeShaped's own comment) is checked before the bar-chart rule below: it also
      // incidentally satisfies "has an identity and a magnitude," so without this it would always
      // lose to the more generic chart type first.
      if (isGaugeShaped(value)) return 'gauge'

      // These three chart signatures all overlap with "every item has an identity field"
      // (waterfall and bar rows carry one too; a heatmap's outer rows do as well) — checked in
      // most-specific-first order, and all three *before* the identity-keyed record checks below,
      // or those would win first and hide every one of them inside labelValueList/table (exactly
      // what happened to S9.2/decide.weeks and friends before this was added).
      if (isWaterfallShaped(value)) return 'waterfallChart'
      if (isHeatmapGridShaped(value)) return 'heatmapGrid'

      // An identity-keyed row set that's actually a RICH, uniform, multi-column record (e.g.
      // {label, value, current, why} — S9.1/reason.policy; or {sku, name, prices, cm, conf, tag,
      // modes} — S9.11/decide.slate) reads better as a real table than as a single-magnitude bar
      // chart or a stacked label/value list, where each record's extra fields each take their own
      // line, roughly tripling the vertical height for the same information (FORENSIC_AUDIT_S9.1.md's
      // density findings, confirmed against the reference's own tables). Checked BEFORE the
      // bar/scatter identity-keyed checks below — a rich multi-column record often ALSO has one
      // field that happens to look like a plottable magnitude (S9.11/decide.slate's own `pct`), and
      // without this ordering that one coincidental field would keep winning the whole record a bar
      // chart, discarding every other column (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §3/§8's exact
      // root-cause finding for the S9.11 canonical case). A nested inline control column (see
      // isNestedControlColumn/splitScalarAndControlKeys above) never disqualifies this — it's
      // excluded from the scalar-uniformity check, not treated as a stray rich object.
      if (identityKey !== null) {
        const styleGovernedKeys = computeStyleGovernedKeys(value)
        const splits = value.map((item) => splitScalarAndControlKeys(item, meaningfulKeys(item, styleGovernedKeys)))
        const scalarSignatures = splits.map((s) => [...s.scalar].sort().join('|'))
        const isUniform = scalarSignatures.every((sig) => sig === scalarSignatures[0])
        const controlColumnsConsistent = splits.every((s) => s.control.length === splits[0].control.length)
        const hasNoOrphanedRichField = splits.every((s) => s.orphaned.length === 0)
        // A row's own PURE PLOT-POSITION fields (x/y/cx/cy/r — a scatter/bubble point's own
        // coordinates, never a business figure under any of these exact names in this dataset)
        // exist to place a point, not to describe a business column — a labeled scatter/bubble
        // point ({x, y, r, label}) technically satisfies "identity + >=3-4 scalar columns" without
        // this exclusion, which would wrongly promote it to `table` before the more specific scatter
        // check below ever runs. Deliberately narrower than CHART_MAGNITUDE_KEYS/CHART_COORD_KEYS
        // (which also list generic names like `value`/`h`/`pct` — real business columns use those
        // names constantly, e.g. notChecks'/policy's own `value`/`pct` fields, so excluding THOSE
        // here would wrongly reverse the fix) — only x/y/cx/cy/r (plus the label/node-position
        // companions below) are unambiguous enough to exclude by name alone.
        //
        // `tx`/`ty` (a text label's own offset position, alongside the marker's own `x`), `lx`/`ly`
        // (a label anchor point), `nx` (a node's own x) joined this set for the same reason: checked
        // corpus-wide, every occurrence of any of them is a numeric SVG pixel coordinate, never a
        // business figure — confirmed the exact gap that let S9.9/analyze.cliffs (a chart's own
        // "SEP 13 · 271 D" cliff-marker annotations: `{x, tx, ty, label, w, dash, anchor}`, pure
        // drawing instructions for a vertical marker line + its text label) wrongly promote to
        // `table` once `dash`/`anchor` were separately fixed to stop leaking as decorative-by-name
        // (see DECORATIVE_WORDS above) — `tx`/`ty` alone still cleared the >=4 threshold without
        // this addition.
        const PLOT_POSITION_KEYS = new Set(['x', 'y', 'cx', 'cy', 'r', 'tx', 'ty', 'lx', 'ly', 'nx'])
        const businessScalarCount = splits[0].scalar.filter((k) => !PLOT_POSITION_KEYS.has(k)).length

        if (identityKey === 'label') {
          // Gated at >=4 meaningful columns (stricter than the generalized-identity case below)
          // specifically because a plain 2-3-column labeled checklist (a simple "name: value" list)
          // reads FINE as labelValueList/a chart and shouldn't be force-fit into a table just for
          // having a label — this only promotes the genuinely record-shaped case.
          // `CHECKLIST_RAW_KEYS` is a narrow, explicit exemption for the one confirmed case where a
          // rich, uniform, labeled row set is still better as a compact rail checklist than a
          // table — a guardrail policy-check row (`checks`) reads as a live pass/fail gate, one
          // glance per row, not tabular data a reader compares column-to-column; kept in the same
          // vocabulary-keyed-table style as EXACT_KEY_OVERRIDES/PRIORITY_GROUPS above (a raw key
          // name, never a workflow code).
          if (isUniform && controlColumnsConsistent && hasNoOrphanedRichField && businessScalarCount >= 4 && !CHECKLIST_RAW_KEYS.has(rawKey)) {
            return 'table'
          }
        } else if (isUniform && controlColumnsConsistent && hasNoOrphanedRichField && businessScalarCount >= 4) {
          // A generalized identity field (sku/name/id/...) has no labelValueList fallback available
          // — that block type's own validator requires a literal "label" (see blockTypes.js) — so a
          // rich-enough record here goes straight to table.
          //
          // Gated at the SAME >=4 threshold as the label-keyed branch above (raised from an earlier
          // >=3, which this repo's own full 105-screen reference validation found over-promoted a
          // large share of the corpus's icon+name+role bordered CARDS — e.g. `agents`, `monitors`,
          // `rollback`, `flags` — to `table` purely for having identity + 2 more short scalar
          // fields; ~40% of every `table`-typed block in the corpus turned out to be card/list
          // content at the looser threshold, not real column-aligned data (see
          // DYNAMIC_COMPOSITION_PHASE2_REPORT.md). A genuinely rich record (S9.11/decide.slate,
          // S9.16/decide.skus, both 6+ real columns) clears this bar easily; a short bordered card
          // with just an identity + 2 short fields correctly no longer does.
          return 'table'
        }
      }

      if (isBarChartShaped(value, identityKey)) return 'barChart'

      // An identified point (real x/y coordinates plus a text annotation) is a scatter/bubble
      // chart, not a plain list — see isLabeledScatterShaped's own comment. Checked before the
      // identity-keyed labelValueList/itemQueue fallback below for the same reason as the chart
      // shapes above.
      if (isLabeledScatterShaped(value, identityKey)) return 'scatterChart'

      // A labeled row set that wasn't rich enough (or was, but is CHECKLIST_RAW_KEYS-exempted) for
      // a table falls back to the compact labelValueList — a literal "label" identity is the only
      // one with that fallback available (see blockTypes.js's validateLabelValueList).
      if (identityKey === 'label') return 'labelValueList'

      // Bar-shaped but with no usable identity field: every item carries a numeric magnitude
      // sharing one unit, even if it also carries raw x/y pixel-position fields left over from the
      // mockup's own hand-drawn layout (e.g. S9.15/analyze.bars: {x, y, h, op} — no identity, but a
      // real height). Checked before the scatter check below for exactly that reason: a magnitude
      // reading wins over treating the same row as a bare coordinate. Same unit-compatibility guard
      // as isBarChartShaped, for the same reason (§ above).
      if (
        value.every((item) => CHART_MAGNITUDE_KEYS.some((k) => looksLikeMagnitude(item[k]))) &&
        hasConsistentMagnitudeUnits(value)
      ) {
        return 'barChart'
      }

      const perItemKeys = value.map((item) => meaningfulKeys(item))

      // Scatter-shaped: every item is nothing but numeric coordinate fields once decoration is
      // stripped (e.g. a scatter dot's {cx, cy} or a bubble's {cx, cy, r}) — plot data, not a list.
      // Every row reaching this point has already failed the identity-keyed checks above, so this
      // only ever matches identity-less rows — unaffected by the new bar/waterfall/heatmap checks.
      const isScatterShaped = value.every((item, i) => {
        const keys = perItemKeys[i]
        return keys.length > 0 && keys.every((k) => CHART_COORD_KEYS.has(k) && isNumericLike(item[k]))
      })
      if (isScatterShaped) return 'scatterChart'

      // Anything else object-shaped, with no identity field to key a record/table reading off of,
      // is a richer, variable-shape per-item queue (rows/feed/cards).
      return 'itemQueue'
    }
    // A bare array named like an axis's own tick/column labels (e.g. `yTicks`, `flowTicks`,
    // `pipeCols`) is metadata *for* some other chart, not plottable data itself — even when every
    // label happens to be a numeric-looking string (`["116","110","104","98"]`). Without this,
    // that one workflow's `yTicks` classified as `'series'` while every sibling workflow's
    // same-purpose `*Ticks`/`*Cols` array (formatted with a "$" or a unit, so not numeric-like)
    // classified as `'itemQueue'` — the same concept, classified inconsistently purely because of
    // whether its labels happened to parse as numbers. See extraction/audit.js's A.4 check.
    if (typeof rawKey === 'string' && /(Ticks|Cols)$/.test(rawKey)) return 'itemQueue'
    // An array of genuinely numeric bare values (numbers, or numeric strings) is a bar chart's
    // magnitudes (unlabeled — BarChartBlock falls back to a bare index per bar), *provided* they
    // all share one unit (same guard as isBarChartShaped, § above — a bare array mixing "$5" and
    // "10%" is exactly as misleading on one linear scale as a labeled row group would be). Anything
    // else non-object — plain labels, mixed types (e.g. `["M1","M3","Yr 1"]`, month-column headers,
    // not values), or a mixed-unit numeric set — isn't plottable as-is; ItemQueueBlock already
    // renders a bare non-object item as its own simple row, so that's a far better fit than forcing
    // it through a chart renderer that has no consistent numbers to draw.
    return value.every(looksLikeMagnitude) && hasConsistentBareUnits(value) ? 'barChart' : 'itemQueue'
  }
  if (isPlainObject(value)) {
    if (Object.keys(value).length === 0) return null
    // Narrow, deliberate signature — {min, max, value} with min < max and value inside that range
    // — chosen specifically so it can't accidentally catch an existing real "object" block: no
    // screen in the current 105 fixtures has all three of these together (verified when this was
    // added). No workflow uses this yet; it's here for the day a Decide-stage "simulate" slider
    // (see manifests/REPORT.md) has real data to bind to.
    if (isSliderShaped(value)) return 'slider'
    return 'object'
  }
  return null
}

// ---- semantic slot-name overrides -----------------------------------------------------------

// Exact-key overrides applied when the value's own type matches what's expected. This is the
// project's real, shipping vocabulary (see the task's field list) mapped onto whichever raw
// mockup key we found actually carries that concept — see REPORT.md for the confidence behind
// each of these.
//
// `execLabel` and `checks` are DELIBERATELY NOT bound to the `execution_lane`/`guardrail_verdict`
// slot names, even though Part 2's original REPORT.md proposed exactly that — INTEGRATION.md's own
// later cross-check against the real `/v1/proposals` API (`proposalVocabulary.js`,
// `fromProposal.js`) found both are genuine name collisions, not matches:
//   - the real `execution_lane` is server-derived from `guardrail_verdict` ("agent" only when the
//     verdict is `within_limits`) and means "who/what executes"; `execLabel` here is an editable
//     mockup prop ("Suggest"/"Assist") controlling how the SCREEN displays itself — an unrelated
//     concept that happens to share a name.
//   - the real `guardrail_verdict` is a 4-value enum (`within_limits`/`beyond_limits`/
//     `not_applicable`/`undetermined`); `checks` here is a governance CHECKLIST (an array of rows)
//     — a different shape entirely, not just different values.
// Binding either real API field into these slots unchanged would silently show the wrong thing to
// a real user the moment a backend replaces these fixtures (exactly the risk INTEGRATION.md flags
// loudly). `display_mode`/`guardrail_checks` name what this data actually IS instead of borrowing
// a real vocabulary name it isn't; see services/proposalFieldMapping.js for the actual real-field
// contract (documented, not guessed) and the derivation this UI would need once the real
// `execution_lane`/`guardrail_verdict` fields exist.
const EXACT_KEY_OVERRIDES = [
  { key: 'execLabel', slotName: 'display_mode', when: (v) => typeof v === 'string' },
  { key: 'severity', slotName: 'severity', when: (v) => typeof v === 'string' },
  { key: 'checks', slotName: 'guardrail_checks', when: (v) => Array.isArray(v) },
  { key: 'blocked', slotName: 'guardrail_blocked', when: (v) => typeof v === 'boolean' },
  { key: 'blockShow', slotName: 'guardrail_blocked', when: (v) => typeof v === 'string' },
  { key: 'canApprove', slotName: 'guardrail_can_approve', when: (v) => typeof v === 'boolean' },
  { key: 'approveShow', slotName: 'guardrail_can_approve', when: (v) => typeof v === 'string' },
  { key: 'blockReason', slotName: 'guardrail_reason', when: (v) => typeof v === 'string' },
  { key: 'ctaLabel', slotName: 'guardrail_cta_label', when: (v) => typeof v === 'string' },
  { key: 'approveLabel', slotName: 'guardrail_cta_label', when: (v) => typeof v === 'string' },
]

// Groups where several raw keys could all plausibly carry one vocabulary concept, but only one
// slot may use that name per manifest — the first present (in priority order) wins; the rest
// keep their own raw key as the slot name.
const PRIORITY_GROUPS = [
  {
    slotName: 'rationale',
    candidates: ['pinnedSub', 'floorNote', 'gapNote', 'summaryNote', 'dialNote'],
    when: (v) => typeof v === 'string',
  },
  {
    slotName: 'primaryInsight',
    candidates: ['pinnedTop', 'heroValue', 'headline', 'railLabel'],
    when: (v) => typeof v === 'string' || typeof v === 'number',
  },
]

/**
 * Decides the manifest slotName for every key of a stage's `data` object in one pass, so
 * priority-group winners (see above) are picked before individual keys are named, and any name
 * collision falls back to the raw key rather than silently dropping a block.
 *
 * @returns {Map<string, string>} rawKey -> slotName, for every key that should become a block.
 */
export function planSlotNames(dataObject) {
  const keys = Object.keys(dataObject).filter((k) => !isPureStyleValue(dataObject[k], k))

  const winners = new Map() // slotName -> rawKey
  const collisions = []

  for (const group of PRIORITY_GROUPS) {
    const winner = group.candidates.find((k) => keys.includes(k) && group.when(dataObject[k]))
    if (winner) winners.set(group.slotName, winner)
  }

  for (const { key, slotName, when } of EXACT_KEY_OVERRIDES) {
    if (!keys.includes(key) || !when(dataObject[key])) continue
    if (winners.has(slotName) && winners.get(slotName) !== key) {
      collisions.push({ slotName, wanted: key, keptInstead: winners.get(slotName) })
      continue
    }
    winners.set(slotName, key)
  }

  const rawKeyToSlotName = new Map()
  for (const [slotName, rawKey] of winners) {
    rawKeyToSlotName.set(rawKey, slotName)
  }
  for (const key of keys) {
    if (!rawKeyToSlotName.has(key)) rawKeyToSlotName.set(key, key)
  }

  return { slotNames: rawKeyToSlotName, collisions }
}

// ---- table/column metadata suppression --------------------------------------------------------
//
// RENDERED_UI_FORENSIC_AUDIT.md §3.1/§5: a field shaped like `[{key, label, numeric?}, ...]` (e.g.
// S9.1/analyze.cols) isn't content — it's the column *description* for a sibling table, which
// already shows the exact same information as its own real column headers. Confirmed rendering
// almost 2.5x taller than the analytical chart on the same screen for zero net new information.
//
// The relationship is structural, not name-based: a descriptor array is suppressed only when every
// one of its own items unambiguously carries a `key`+`label` pair (never true of ordinary business
// data by coincidence) AND a real sibling `table` block's own resolved rows share almost all of
// those same `key` values as their own column keys — i.e. the descriptor is provably *describing*
// that exact table, not merely resembling one. Never keyed on a raw field name or workflow code;
// a workflow with no such relationship is completely unaffected.
function isColumnDescriptorArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isPlainObject(item) && typeof item.key === 'string' && typeof item.label === 'string')
  )
}

function tableColumnKeySet(value) {
  const keys = new Set()
  if (!Array.isArray(value)) return keys
  for (const row of value) {
    if (!isPlainObject(row)) continue
    for (const key of Object.keys(row)) keys.add(key)
  }
  return keys
}

// How much of a descriptor array's own `key` values must appear as real columns on a sibling table
// before it's confidently "describing" that table rather than merely overlapping it by coincidence.
const METADATA_MATCH_THRESHOLD = 0.8

/**
 * @param {Array<{slotName, blockType, binding}>} blocks - a stage's already-classified block list.
 * @param {object} dataObject - the fixture's own `data` object (bindings are always `data.<key>`).
 * @returns {Set<string>} slotNames to drop entirely — each one is column/row metadata for a real
 *   sibling `table` block already in this same list, confirmed structurally, not guessed.
 */
export function findMetadataDescriptorSlots(blocks, dataObject) {
  const suppressed = new Set()
  const rawKeyOf = (block) => (block.binding.startsWith('data.') ? block.binding.slice('data.'.length) : block.binding)

  for (const block of blocks) {
    if (block.blockType !== 'labelValueList' && block.blockType !== 'itemQueue') continue
    const value = dataObject?.[rawKeyOf(block)]
    if (!isColumnDescriptorArray(value)) continue

    const descriptorKeys = new Set(value.map((item) => item.key))
    if (descriptorKeys.size === 0) continue

    const hasMatchingSiblingTable = blocks.some((other) => {
      if (other === block || other.blockType !== 'table') return false
      const columnKeys = tableColumnKeySet(dataObject?.[rawKeyOf(other)])
      if (columnKeys.size === 0) return false
      const overlap = [...descriptorKeys].filter((k) => columnKeys.has(k)).length
      return overlap / descriptorKeys.size >= METADATA_MATCH_THRESHOLD
    })

    if (hasMatchingSiblingTable) suppressed.add(block.slotName)
  }

  return suppressed
}

// ---- item-level hints (report-only; never renames anything) ---------------------------------

const ITEM_LEVEL_CANDIDATES = {
  target: ['target', 'sku', 'id', 'caseId', 'ref'],
  confidence: ['conf', 'confPct', 'confidence', 'win'],
  state: ['status', 'state'],
  lens: ['lens'],
  action_type: ['tag', 'type', 'typeShort', 'classification'],
  source: ['source'],
  severity: ['severity'],
  rationale: ['rationale'],
  currency: ['currency'],
}

/**
 * For an itemQueue/labelValueList-classified array, checks its first item's own keys against
 * candidate names for each vocabulary concept — used only to populate REPORT.md, never to
 * rename anything in the generated manifest (bindings always point at the real raw key).
 */
export function detectItemLevelHints(arrayValue) {
  const first = Array.isArray(arrayValue) ? arrayValue.find((item) => isPlainObject(item)) : null
  if (!first) return {}
  const itemKeys = Object.keys(first)
  const hints = {}
  for (const [concept, candidates] of Object.entries(ITEM_LEVEL_CANDIDATES)) {
    const match = candidates.find((c) => itemKeys.includes(c))
    if (match) hints[concept] = match
  }
  return hints
}

// ---- section planning (Phase 2 — declarative screen composition) ----------------------------
//
// A generic, vocabulary/shape-driven rule for grouping a stage's blocks into sections — never a
// per-workflow special case (AUDIT_REPORT.md §11/§25's explicit constraint: "no code change to the
// engine" for a new screen design, and no hand-authored layout per workflow either). Every input
// this reasons about is either the project's own real, shipping slot-name vocabulary
// (`guardrail_*`, the hero vocabulary below) or a block's own declared shape (blockType, and — for
// `object` only — its key count) — nothing here reads a workflow's `code` or reasons about what a
// specific screen "means."
//
// FORENSIC_AUDIT_S9.1.md §1/§5/§8/§19 traced the dominant cause of the reference-fidelity gap to
// exactly this function: it used to derive a block's *section* purely from its *blockType shape*
// (a scalar string was *always* "summary", full stop), and every consumer downstream then treated
// "summary" as inherently secondary/rail content for every workflow — so a stage's own headline
// (`heroTitle`), classified `text` like any other one-line string, silently ended up in the
// narrowest, least prominent part of the page. `sectionIdFor` now checks a small, explicit,
// vocabulary-keyed table of known SEMANTIC concepts first — never `if (workflowCode === "S9.1")`,
// only "does this raw key/slotName match a known concept name" — and only falls back to the old
// shape-only rule when nothing more specific matches. This is strictly additive: a stage whose
// data doesn't use any of this vocabulary sections exactly as it did before.
const CHART_BLOCK_TYPES = new Set(['lineChart', 'barChart', 'scatterChart', 'waterfallChart', 'heatmapGrid'])
const SUMMARY_SCALAR_TYPES = new Set(['text', 'number', 'flag'])

// The generic "this scalar text IS the stage's own headline, not a footnote" vocabulary — the
// exact same slot names layout/heroSlot.js already establishes, at runtime, as recurring verbatim
// across every workflow that has one (`heroTitle` alone appears in 8 of the 26 workflows' `decide`
// stages; `rationale`/`primaryInsight` are this generator's own cross-workflow priority-group
// winners, see PRIORITY_GROUPS above) — promoted here into a real, generation-time semantic
// signal instead of only ever being a renderer-side, after-the-fact heuristic. `heroSub` joins the
// same vocabulary as heroTitle's paired subheadline (confirmed alongside it wherever `heroTitle`
// is present with a matching `heroSub`).
const HERO_SLOT_NAMES = new Set(['rationale', 'primaryInsight', 'heroTitle', 'heroSub'])

// `heroSub` gets a distinct role from `heroTitle`/`rationale`/`primaryInsight`: it's always a
// companion to a headline, never a headline on its own, so the runtime block treats it as a
// quieter subheadline — no repeated "Realify signal" eyebrow stacked directly under the one the
// title already showed (see TextBlock.jsx's own `role === 'heroSub'` branch).
const HERO_SUB_SLOT_NAMES = new Set(['heroSub'])

// Blocks that are not themselves a hero headline, but that the reference composes together WITH
// one as a single recommendation panel (a headline, its supporting metrics, and a proportional
// mix bar) — keyed by raw fixture key, exactly like EXACT_KEY_OVERRIDES/PRIORITY_GROUPS above.
// Confirmed narrow today (currently only S9.1's `decide` stage has both `heroMetrics`/`moveBar`
// alongside a `heroTitle`), but declared by VOCABULARY, not by workflow code — a future workflow
// using these same raw key names alongside its own `heroTitle` benefits automatically, with zero
// code change here. Only takes effect when the stage actually has a hero slot present (guarded in
// `sectionIdFor` below) — a workflow using `moveBar` for something unrelated, with no hero slot at
// all, is completely unaffected.
const HERO_COMPANION_KEYS = new Set(['heroMetrics', 'moveBar'])

// Generalized hero-companion matching (P2 fix — this pass's own "hero composition" requirement,
// §13): a scalar/metric-shaped block whose OWN raw key contains "hero" or "metric" (case-
// insensitive, matched as a whole camelCase word — the same word-boundary convention
// isDecorativeKey already uses, so "heroic"/"symmetric" never false-positive) joins the
// recommendation panel alongside a hero slot, in addition to the fixed HERO_COMPANION_KEYS
// allowlist above. Still purely name-pattern + shape driven, never a workflow code, and — like
// HERO_COMPANION_KEYS — only takes effect when a hero slot already exists in this same stage.
const HERO_COMPANION_TYPES = new Set(['text', 'number', 'flag', 'labelValueList', 'gauge'])
function isGeneralizedHeroCompanion(rawKey, blockType) {
  if (!HERO_COMPANION_TYPES.has(blockType)) return false
  const words = (String(rawKey).match(CAMEL_WORD_RE) ?? []).map((w) => w.toLowerCase())
  return words.includes('hero') || words.includes('metric') || words.includes('metrics')
}

// ---- execution / diff detection (P2 fix — DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §16/§19,
// this pass's "Pattern E: execution destination + diff" requirement) ----------------------------
//
// The same `{field, before, after}` diff-row shape already recognized at render time
// (blocks/nestedEntryText.js) and in generation-time tooling (extraction/audit.js's
// flattenNestedEntryPreview) — reused here as a structural signal that an itemQueue block is a
// "destination pushed a change" card set, not generic supporting content. Never keyed on a raw key
// name, a workflow code, or a stage name — purely "does this item (or one of its own nested
// arrays) contain a before/after pair."
function isDiffRow(item) {
  return isPlainObject(item) && 'before' in item && 'after' in item
}

function isExecutionShaped(value) {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.some((item) => {
    if (!isPlainObject(item)) return false
    if (isDiffRow(item)) return true
    return Object.values(item).some((v) => Array.isArray(v) && v.length > 0 && v.some(isDiffRow))
  })
}

// A small rollup of headline metrics (a workflow's own "totals"/"live totals" concept, `totals` —
// confirmed present, by this exact raw key, in 14 of the 26 workflows) and a confidence/provenance
// footnote list (`basis`) are both genuinely secondary/contextual — real rail content — but neither
// is "just a scalar," so the old shape-only rule had no way to route them there deliberately; they
// fell into "details" (main) purely because they're arrays, not because anyone decided that's where
// they belong. Keyed by raw fixture key, same pattern as every other override table in this file.
const ROLLUP_KEYS = new Set(['totals'])
const PROVENANCE_KEYS = new Set(['basis'])

// `region` is the declarative placement signal FORENSIC_AUDIT_S9.1.md §19/§25 calls for: "scalar/
// text" no longer implies "rail" — a section now says where it belongs, and a block only ever
// falls back to this table's default when it doesn't carry its own `role`/section override (see
// composeSections.js's region-resolution order). `recommendation` has no visible title — the
// reference's own hero panel has no separate section header above it either (TextBlock's existing
// hero treatment already renders its own in-panel eyebrow); everything else keeps its existing,
// reviewed title text unchanged.
const SECTION_ORDER = [
  { id: 'guardrails', title: 'Guardrails', region: 'rail' },
  { id: 'recommendation', title: null, region: 'main' },
  // `decision` (P1 fix — DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §7/§11's "control + dependent
  // content" pattern): a control block (blockType 'slider') and every OTHER block its own,
  // measured `dependencies` names, fused into one composed panel — see the control-dependency pass
  // in planSections below. No visible title, same reasoning as `recommendation`: this is one
  // continuous interactive unit, not a titled sub-section of something else.
  { id: 'decision', title: null, region: 'main' },
  { id: 'summary', title: 'Summary', region: 'rail' },
  { id: 'rollup', title: 'Totals', region: 'rail' },
  { id: 'provenance', title: 'Basis', region: 'rail' },
  { id: 'analysis', title: 'Analysis', region: 'main' },
  // `execution` (P2 fix — DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §16/§19's Execute-stage gap, and
  // this pass's own "destination + before/after diff" composition pattern): an `itemQueue` block
  // whose own items contain a recognizable before/after diff sub-structure (the SAME
  // `{field, before, after}` shape extraction/audit.js's flattenNestedEntryPreview and
  // blocks/nestedEntryText.js already recognize as a diff row) — never a workflow/stage-name check,
  // purely a structural signature every "destination pushed a change" screen shares regardless of
  // which workflow it belongs to.
  { id: 'execution', title: 'Execution', region: 'main' },
  { id: 'details', title: 'Details', region: 'main' },
]

// Only worth sectioning once a stage is genuinely crowded — a 5-block stage gains nothing from 4+
// section headers and would just add visual noise for no benefit (matches the spirit of
// StageRenderer's own historical grid-eligibility threshold, extended to "is this stage big enough
// that grouping helps at all").
const MIN_BLOCKS_TO_SECTION = 9

/**
 * @param {string} rawKey - the block's own raw fixture key (e.g. `binding` minus its `data.` prefix).
 * @param {string} slotName
 * @param {string} blockType
 * @param {*} value - the block's resolved value (only consulted for `object`'s own size check).
 * @param {boolean} hasHeroSlot - true when this same stage has at least one HERO_SLOT_NAMES block.
 * @returns {string} one of SECTION_ORDER's ids.
 */
function sectionIdFor(rawKey, slotName, blockType, value, hasHeroSlot) {
  if (HERO_SLOT_NAMES.has(slotName)) return 'recommendation'
  if (hasHeroSlot && (HERO_COMPANION_KEYS.has(rawKey) || isGeneralizedHeroCompanion(rawKey, blockType))) return 'recommendation'
  if (slotName.startsWith('guardrail_')) return 'guardrails'
  if (ROLLUP_KEYS.has(rawKey)) return 'rollup'
  if (PROVENANCE_KEYS.has(rawKey)) return 'provenance'
  if (CHART_BLOCK_TYPES.has(blockType)) return 'analysis'
  if (blockType === 'itemQueue' && isExecutionShaped(value)) return 'execution'
  if (SUMMARY_SCALAR_TYPES.has(blockType)) return 'summary'
  if (blockType === 'object' && isPlainObject(value) && Object.keys(value).length <= 3) return 'summary'
  return 'details'
}

/**
 * @param {Array<{slotName, blockType, binding}>} blocks - a stage's already-built block list.
 * @param {object} dataObject - the fixture's own `data` object (bindings are always `data.<key>`).
 * @returns {{
 *   sections: Array<{id, title, region}>|undefined,
 *   sectionBySlot: Map<string,string>,
 *   roleBySlot: Map<string,string>,
 *   layoutBySlot: Map<string,{group:string, span:number}>,
 * }}
 *   `sections` is `undefined` when the stage is too small to benefit (see MIN_BLOCKS_TO_SECTION) —
 *   the manifest simply omits the field, and every consumer already treats that as "unsectioned"
 *   (which resolves to the "main" region — see composeSections.js).
 */
function rawKeyOfBinding(binding) {
  return binding.startsWith('data.') ? binding.slice('data.'.length) : binding
}

/**
 * Finds every block that's a real, measured DEPENDENT of some control block in this same stage
 * (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §7/§9/§11) — never guessed from adjacency, only ever from
 * a slider's own `dependencies` (raw fixture keys, computed by actually re-running the reference's
 * logic at multiple control positions — see extraction/dcLogicSandbox.js's computeControlPayload).
 * @returns {{ controlSlots: Set<string>, dependentGroupBySlot: Map<string,string> }} every control's
 *   own slotName, and every dependent block's slotName mapped to the CONTROL slotName that governs
 *   it (the shared `layout.group` key both ends of the relationship will use).
 */
function findControlDependencyGroups(blocks, dataObject) {
  const rawKeyToSlotName = new Map(blocks.map((b) => [rawKeyOfBinding(b.binding), b.slotName]))
  const controlSlots = new Set()
  const dependentGroupBySlot = new Map()

  for (const block of blocks) {
    if (block.blockType !== 'slider') continue
    const rawKey = rawKeyOfBinding(block.binding)
    const sliderValue = dataObject?.[rawKey]
    const deps = Array.isArray(sliderValue?.dependencies) ? sliderValue.dependencies : []
    if (deps.length === 0) continue
    controlSlots.add(block.slotName)
    for (const depRawKey of deps) {
      const depSlotName = rawKeyToSlotName.get(depRawKey)
      if (depSlotName && depSlotName !== block.slotName && !dependentGroupBySlot.has(depSlotName)) {
        dependentGroupBySlot.set(depSlotName, block.slotName)
      }
    }
  }
  return { controlSlots, dependentGroupBySlot }
}

// Pattern B/G ("chart + supporting detail", "master/detail") was ATTEMPTED here as a structural
// heuristic — pair a chart with a table whenever a stage has exactly one of each — and then
// REMOVED after a full 105-screen validation against the reference corpus found it fabricated a
// relationship in 4 of 5 real occurrences (only S9.7/decide's chart+table pairing was confirmed
// genuine; S9.10, S9.20, and S10.1's "chart" partners turned out to be plain label/value summary
// lists with no chart geometry in the reference at all — a pre-existing "phantom bar chart"
// classifier ambiguity this pairing rule COMPOUNDED into a forced, visibly wrong fusion instead of
// two separately-imperfect-but-independent blocks). Unlike the control-dependency grouping just
// above (findControlDependencyGroups) — which only ever fuses blocks whose relationship was
// EMPIRICALLY MEASURED by re-running the reference's own logic — "exactly one chart + one table
// exist in this stage" is a coincidence, not a measured relationship, and this corpus is not
// reliable enough for that coincidence to be trustworthy. Deliberately left out rather than
// patched further: a documented, validated NON-fix, not a silently-abandoned idea — see
// DYNAMIC_COMPOSITION_PHASE2_REPORT.md.

export function planSections(blocks, dataObject) {
  const empty = { sections: undefined, sectionBySlot: new Map(), roleBySlot: new Map(), layoutBySlot: new Map() }
  if (blocks.length < MIN_BLOCKS_TO_SECTION) return empty

  const hasHeroSlot = blocks.some((b) => HERO_SLOT_NAMES.has(b.slotName))
  const { controlSlots, dependentGroupBySlot } = findControlDependencyGroups(blocks, dataObject)

  const sectionBySlot = new Map()
  const roleBySlot = new Map()
  const layoutBySlot = new Map()
  const usedIds = new Set()
  for (const block of blocks) {
    const rawKey = rawKeyOfBinding(block.binding)
    const isControl = controlSlots.has(block.slotName)
    const isDependent = dependentGroupBySlot.has(block.slotName)
    const id = isControl || isDependent
      ? 'decision'
      : sectionIdFor(rawKey, block.slotName, block.blockType, dataObject?.[rawKey], hasHeroSlot)
    sectionBySlot.set(block.slotName, id)
    usedIds.add(id)

    if (HERO_SUB_SLOT_NAMES.has(block.slotName)) roleBySlot.set(block.slotName, 'heroSub')
    else if (HERO_SLOT_NAMES.has(block.slotName)) roleBySlot.set(block.slotName, 'hero')
    // Every member of the composed recommendation panel — the hero text itself and its companion
    // metrics/mix-bar — shares one explicit group and a full-width span, so composeSections.js
    // fuses them into one panel regardless of blockType (see its own doc comment on `layout.group`
    // overriding the scalar-only heuristic). Never emitted for any other section.
    if (id === 'recommendation') layoutBySlot.set(block.slotName, { group: 'recommendation', span: 12 })
    // Same fusing mechanism, generalized to any control + whatever it measurably affects: the
    // control's own slotName is the shared group key (stable, and unique per control within a stage).
    else if (isControl) layoutBySlot.set(block.slotName, { group: `control:${block.slotName}`, span: 12 })
    else if (isDependent) layoutBySlot.set(block.slotName, { group: `control:${dependentGroupBySlot.get(block.slotName)}`, span: 12 })
  }

  // Sectioning a stage where every block landed in the same single bucket doesn't help either —
  // one section with no siblings is just a redundant header.
  if (usedIds.size < 2) return empty

  const sections = SECTION_ORDER.filter((s) => usedIds.has(s.id))
  return { sections, sectionBySlot, roleBySlot, layoutBySlot }
}

// ---- semantic block ordering (P2 fix — DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md's L3 gap; this
// pass's §5 requirement) --------------------------------------------------------------------------
//
// A MANIFEST-GENERATION-time concern, deliberately NOT implemented inside composeSections.js: that
// module's own "backward compatibility is the central constraint" guarantee (a legacy manifest with
// no sections/layout/role renders through the exact same order it always has) is load-bearing for a
// large, precise existing test suite that asserts EXACT row order for hand-built item lists. Since
// composeSections.js already faithfully preserves whatever order manifest.blocks[] is in, the
// correct place to make that order semantically meaningful is here, once, at generation time —
// composeSections.js and its own tests need no changes at all.
//
// A small, fixed set of TIERS (lower sorts first), assigned purely from already-computed generic
// signals (hero role, control/dependency membership, blockType) — never a slotName, raw key, or
// workflow code. `Array.prototype.sort` is stable (ES2019+), so two blocks in the same tier keep
// their original relative order — this only ever reorders blocks the signals actually distinguish,
// never shuffles two otherwise-equivalent blocks arbitrarily.
//
// Deliberately COARSE beyond hero/control/dependents: an earlier version of this function also
// split "everything else" into finer tiers (chart/table ahead of plain scalars, guardrails last),
// but that risked separating two same-tier scalars that used to sit adjacently in the fixture's own
// order purely because an unrelated table happened to land between their new tiers — breaking the
// existing heuristic scalar-adjacency grouping (composeSections.js's own GridPanel) for no real
// semantic gain. Reordering is highest-value, and safest, for the control-dependency relationship
// specifically (a REAL, measured relationship — see findControlDependencyGroups) and for hero
// identity; everything else keeps its original, already-reasonable fixture order untouched.
const METRIC_LIKE_TYPES = new Set(['text', 'number', 'flag', 'labelValueList', 'gauge'])

function semanticTier(block, ctx) {
  const { hasHeroSlot, controlSlots, dependentGroupBySlot } = ctx
  const rawKey = rawKeyOfBinding(block.binding)
  if (HERO_SLOT_NAMES.has(block.slotName)) return 0 // identity/headline
  if (hasHeroSlot && (HERO_COMPANION_KEYS.has(rawKey) || isGeneralizedHeroCompanion(rawKey, block.blockType))) return 0
  if (controlSlots.has(block.slotName)) return 1 // primary control
  if (dependentGroupBySlot.has(block.slotName)) {
    return METRIC_LIKE_TYPES.has(block.blockType) ? 2 : 3 // dependent metrics, then the dependent table/chart
  }
  return 4 // everything else — original relative order preserved
}

/**
 * Reorders a stage's block list by generic semantic priority — a stable sort, so equal-tier
 * blocks keep their original (fixture/manifest) order. Called unconditionally for every generated
 * manifest (small and large stages alike — this does not depend on `planSections`'s
 * MIN_BLOCKS_TO_SECTION threshold, so even a simple stage below that gets its hero/control content
 * ordered first).
 * @param {Array<{slotName, blockType, binding}>} blocks
 * @param {object} dataObject
 * @returns {Array} a new array in semantic order — never mutates `blocks`.
 */
export function orderBlocksSemantically(blocks, dataObject) {
  const hasHeroSlot = blocks.some((b) => HERO_SLOT_NAMES.has(b.slotName))
  const { controlSlots, dependentGroupBySlot } = findControlDependencyGroups(blocks, dataObject)
  const ctx = { hasHeroSlot, controlSlots, dependentGroupBySlot }

  return blocks
    .map((block, index) => ({ block, index, tier: semanticTier(block, ctx) }))
    .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.index - b.index))
    .map((entry) => entry.block)
}
