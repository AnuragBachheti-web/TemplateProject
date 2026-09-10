// Generation-time-only helpers for turning one stage fixture's `data` object into a manifest's
// block list. Not shipped with the app — src/features/action-stories/manifests/blockTypes.js and
// resolveBinding.js (the runtime pieces) don't depend on any of this.
//
// See src/features/action-stories/manifests/REPORT.md for the reasoning behind the semantic
// overrides below and their confidence levels.

// ---- filtering out pure presentation values ------------------------------------------------

const STYLE_VALUE_PATTERNS = [/^var\(--/, /^#[0-9a-f]{3,8}$/i, /^rgba?\(/i, /^color-mix\(/i, /^linear-gradient\(/i]

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
])

function isStyleString(v) {
  return typeof v === 'string' && (STYLE_KEYWORD_VALUES.has(v) || STYLE_VALUE_PATTERNS.some((re) => re.test(v)))
}

/** True for a value that carries no information beyond CSS styling/visibility. */
export function isPureStyleValue(v) {
  if (isStyleString(v)) return true
  if (Array.isArray(v) && v.length > 0) {
    return v.every((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
      return Object.values(item).every((sub) => isStyleString(sub))
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
const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/
const DECORATIVE_EXACT_KEYS = new Set([
  'icon',
  'tone',
  'tint',
  'bg',
  'border',
  'mark',
  'hue',
  'fill',
  'stroke',
  'cursor',
  'shadow',
  'opacity',
  'edge',
  'glow',
])

function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key)
}

/** An item's own keys, minus anything decorative by name or by (CSS-style) value. */
function meaningfulKeys(item) {
  return Object.keys(item).filter((k) => !isDecorativeKey(k) && !isPureStyleValue(item[k]))
}

// Coordinate-only field names — an item that boils down to nothing but these once decoration is
// stripped is a plotted point, not a "thing" worth its own card or table row. `r` (a point's
// radius, e.g. a bubble-chart dot sized by volume) was missing here — a {hue, r, cx, cy} bubble
// point failed this check, fell through to the table check instead, and rendered as a raw R/CX/CY
// data table (214 rows) instead of a scatter/bubble chart. See extraction/audit.js's A.2 check.
const CHART_COORD_KEYS = new Set(['h', 'value', 'x', 'y', 'cx', 'cy', 'r'])

function isNumericLike(v) {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v))
  return false
}

function isSliderShaped(value) {
  const { min, max, value: current } = value
  if (![min, max, current].every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  return min < max && current >= min && current <= max
}

/**
 * @param {*} value
 * @param {string} [rawKey] - the field's own raw key name, when known. Only used for the
 *   axis-label-array override below; every other rule classifies on shape alone.
 * @returns {string|null} one of blockTypes.js's BLOCK_TYPES, or null if this value isn't worth a block.
 */
export function classifyBlockType(value, rawKey) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value.length > 0 ? 'text' : null
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'flag'
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (value.every((item) => isPlainObject(item))) {
      // An array of plain objects that all have a string "label" reads as a checklist/metric/chip
      // row list.
      if (value.every((item) => typeof item.label === 'string')) return 'labelValueList'

      const perItemKeys = value.map((item) => meaningfulKeys(item))

      // Chart-shaped: every item is nothing but numeric coordinate fields once decoration is
      // stripped (e.g. a bar's {h, fill} or a scatter dot's {cx, cy}) — plot data, not a list.
      const isChartShaped = value.every((item, i) => {
        const keys = perItemKeys[i]
        return keys.length > 0 && keys.every((k) => CHART_COORD_KEYS.has(k) && isNumericLike(item[k]))
      })
      if (isChartShaped) return 'series'

      // Table-shaped: every row shares the exact same set of >=3 meaningful, scalar-valued
      // fields — real columns, not just a headline-and-detail card. Skip anything where a
      // meaningful field is itself an array/object (a nested list renders far better as one of
      // ItemQueueBlock's own sub-lists than squeezed into a table cell).
      const signatures = perItemKeys.map((keys) => [...keys].sort().join('|'))
      const isUniform = signatures.every((sig) => sig === signatures[0])
      const hasEnoughColumns = perItemKeys[0].length >= 3
      const allScalar = value.every((item, i) =>
        perItemKeys[i].every((k) => ['string', 'number', 'boolean'].includes(typeof item[k])),
      )
      if (isUniform && hasEnoughColumns && allScalar) return 'table'

      // Anything else object-shaped is a richer, variable-shape per-item queue (rows/feed/cards).
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
    // An array of genuinely numeric bare values (numbers, or numeric strings) is chart/sparkline
    // data. Anything else non-object — plain labels, mixed types (e.g. `["M1","M3","Yr 1"]`,
    // month-column headers, not values) — isn't plottable; ItemQueueBlock already renders a bare
    // non-object item as its own simple row, so that's a far better fit than forcing it through a
    // chart renderer that has no numbers to draw.
    return value.every(isNumericLike) ? 'series' : 'itemQueue'
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
const EXACT_KEY_OVERRIDES = [
  { key: 'execLabel', slotName: 'execution_lane', when: (v) => typeof v === 'string' },
  { key: 'severity', slotName: 'severity', when: (v) => typeof v === 'string' },
  { key: 'checks', slotName: 'guardrail_verdict', when: (v) => Array.isArray(v) },
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
  const keys = Object.keys(dataObject).filter((k) => !isPureStyleValue(dataObject[k]))

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
