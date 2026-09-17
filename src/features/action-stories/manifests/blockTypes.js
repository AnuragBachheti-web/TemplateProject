// The block vocabulary: the smallest set of structural shapes that covers every screen across
// all 26 Action Stories workflows (see extraction/classifyBlocks.js for how a raw screen's
// fields get sorted into these at manifest-generation time, and
// src/features/action-stories/manifests/REPORT.md for how this maps onto the app's real
// action_type/lens/severity/... vocabulary).
//
// Each validate<Type>(data) follows the same plain-JS-checks style as validateManifest: no
// schema library, just typeof/Array.isArray/key-presence checks, returning a list of problem
// strings instead of throwing. `data` here is whatever resolveBinding(...) returned for that
// block — so it can be `undefined` (a missing/optional field), which every validator treats as
// "nothing to check" rather than a failure; only a *present but wrong-shaped* value is a problem.

export const BLOCK_TYPES = [
  'text', // a single display string
  'number', // a single finite number
  'flag', // a single boolean
  'labelValueList', // an array of light rows, each at least { label }: checklists, chip rows, metric rows
  'table', // an array of objects that all share the same >=3 scalar columns — real tabular data
  'itemQueue', // an array of richer, variable-shape per-item objects (rows/feed/slate/cards/steps)
  'lineChart', // a trend: a raw SVG path string, or an array of { path } for multiple series
  'barChart', // magnitude rows: an array of { label, value|h|height|pct|amount }, or a bare array of numbers
  'scatterChart', // plotted points: an array of { x|cx, y|cy, r? } (r sizes a bubble)
  'waterfallChart', // a bridge/waterfall: an array of { label, value, top, height, anchor? }
  'heatmapGrid', // a 2D matrix: an array of { label, cells: [{...numeric fields}] } rows
  'object', // a single nested object that isn't any of the above (a lone badge/descriptor)
  'slider', // an interactive { min, max, value } control, optionally with precomputed `steps`
  'gauge', // rows measured against a threshold: an array of { label?, value|pct, threshold|limit|ceiling|floor|target|cap }
  'calendarGantt', // named lanes, each an array of { label, col: "<line> / span <count>" } blocks positioned on a shared column grid
]

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function validateText(data) {
  if (data === undefined) return []
  return typeof data === 'string' ? [] : [`expected a string, got ${typeof data}`]
}

/**
 * A bare number, or a TYPED business number (`{value, unit, precision?}` — see
 * contract/decisionObject.js). The typed form is what a clean API sends; the bare form is what the
 * corpus and every hand-written fixture still carry. Accepting both is what let typed numbers be
 * introduced without a flag day — NumberBlock formats whichever it gets via blocks/formatValue.js.
 */
export function validateNumber(data) {
  if (data === undefined) return []
  if (isPlainObject(data)) {
    if (typeof data.value !== 'number' || !Number.isFinite(data.value)) {
      return ['expected a typed number of shape { value: number, unit: string }']
    }
    return typeof data.unit === 'string' ? [] : ['a typed number must carry a string "unit"']
  }
  if (typeof data !== 'number') return [`expected a number, got ${typeof data}`]
  return Number.isFinite(data) ? [] : ['expected a finite number']
}

export function validateFlag(data) {
  if (data === undefined) return []
  return typeof data === 'boolean' ? [] : [`expected a boolean, got ${typeof data}`]
}

/**
 * The three keys a row may carry its own identity under. The reference uses all three and means the
 * same thing by each: `label` on a metric row, `name` on a rollback target or a supplier, `text` on
 * a policy-check line that is a whole sentence with no separate value. Accepting only `label`
 * rejected 9 of the corpus's 19 real check lists and all 8 of its real rollback lists, which is how
 * `execution.rollback` ended up fabricated on every execute screen.
 */
export const ROW_LABEL_KEYS = ['label', 'name', 'text']

/** @returns {string|undefined} the row's own identity, under whichever key it carries it. */
export function rowLabelOf(item) {
  if (!isPlainObject(item)) return undefined
  for (const key of ROW_LABEL_KEYS) {
    if (typeof item[key] === 'string' && item[key].trim() !== '') return item[key]
  }
  return undefined
}

export function validateLabelValueList(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`item ${i}: expected an object, got ${typeof item}`)
    } else if (rowLabelOf(item) === undefined) {
      problems.push(`item ${i}: missing a row label (one of ${ROW_LABEL_KEYS.join('/')})`)
    }
  })
  return problems
}

export function validateTable(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item)) problems.push(`item ${i}: expected an object, got ${typeof item}`)
  })
  return problems
}

export function validateItemQueue(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  return [] // items may be rich objects or plain values — ItemQueueBlock renders either as a row
}

const CHART_MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount']

function isNumericLike(v) {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v))
  return false
}

/** A typed series point: `{x, y}` with a finite numeric y. This is the shape the contract requires — the
 * backend sends business values and the frontend derives every coordinate and path. */
function isTypedSeriesPoint(item) {
  return isPlainObject(item) && item.x !== undefined && isNumericLike(item.y)
}

/**
 * Three accepted shapes, in order of what the contract prefers:
 *   1. a TYPED series — `[{x, y}, ...]`, or `[{name, points: [{x, y}]}, ...]` for multiple series.
 *   2. an array of `{path}` — legacy raw SVG paths from the mockup corpus.
 *   3. a single SVG path string — the same legacy shape, unwrapped.
 * Shapes 2 and 3 are retained only so archived corpus fixtures keep rendering; a production payload
 * must never carry SVG path data (see contract/decisionObject.js).
 */
export function validateLineChart(data) {
  if (data === undefined) return []
  if (typeof data === 'string') return [] // legacy: a single SVG path
  if (!Array.isArray(data)) return [`expected a typed {x,y} series or an SVG path, got ${typeof data}`]
  if (data.length === 0) return []

  if (data.every(isTypedSeriesPoint)) return []
  if (data.every((s) => isPlainObject(s) && Array.isArray(s.points))) {
    const problems = []
    data.forEach((s, i) => {
      if (!s.points.every(isTypedSeriesPoint)) problems.push(`series ${i}: every point needs an x and a numeric y`)
    })
    return problems
  }

  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item) || typeof item.path !== 'string') {
      problems.push(`item ${i}: expected a typed {x,y} point or an object with a string "path"`)
    }
  })
  return problems
}

export function validateBarChart(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  // A bare array of numbers/numeric strings is unlabeled bar-chart data (BarChartBlock falls back
  // to a bare index per bar) — the classifier's own bare-array branch produces exactly this shape.
  if (data.every((item) => !isPlainObject(item))) {
    const problems = []
    data.forEach((item, i) => {
      if (!isNumericLike(item)) problems.push(`item ${i}: expected a number, got ${typeof item}`)
    })
    return problems
  }
  // A row's "label" is optional — BarChartBlock falls back to a bare index per bar when it's
  // missing (see S9.15/analyze.bars: {x, y, h, op}, a real unlabeled bar chart) — only the
  // magnitude itself is required.
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`item ${i}: expected an object`)
      return
    }
    if (!CHART_MAGNITUDE_KEYS.some((k) => item[k] !== undefined)) {
      problems.push(`item ${i}: missing a magnitude (one of ${CHART_MAGNITUDE_KEYS.join('/')})`)
    }
  })
  return problems
}

export function validateScatterChart(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    const hasX = isPlainObject(item) && (item.x !== undefined || item.cx !== undefined)
    const hasY = isPlainObject(item) && (item.y !== undefined || item.cy !== undefined)
    if (!hasX || !hasY) problems.push(`item ${i}: expected numeric x/cx and y/cy`)
  })
  return problems
}

/**
 * A bridge/waterfall, as BUSINESS rows: `{label, value, anchor?}`. `top`/`height` are deliberately
 * NOT required any more — they were the source mockup's pre-computed pixel offsets, the hygiene
 * pass strips them as the geometry they are, and requiring them made this the one block whose
 * contract was drawing instructions. WaterfallChartBlock derives every coordinate from `value` and
 * `anchor` (see its own `bridgeGeometry`).
 */
export function validateWaterfallChart(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  if (data.length < 2) return ['expected at least 2 rows']
  const problems = []
  let hasAnchor = false
  data.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`item ${i}: expected an object`)
      return
    }
    if (item.value === undefined) problems.push(`item ${i}: missing "value"`)
    else if (!isNumericLike(parseSignedMagnitude(item.value))) problems.push(`item ${i}: "value" is not a number`)
    if (item.anchor === true) hasAnchor = true
  })
  if (!hasAnchor) problems.push('no row marked "anchor": true (no baseline/total bar)')
  return problems
}

/**
 * The magnitude inside a display string ("−$2,210" -> -2210). Mirrors blocks/chartGeometry.js's
 * parseMagnitude, restated here because validation must not depend on the render layer.
 */
function parseSignedMagnitude(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v !== 'string') return NaN
  const negative = /^[−–-]/.test(v.trim()) || /\(.*\)/.test(v)
  const digits = v.replace(/[^\d.]/g, '')
  if (digits === '') return NaN
  const n = Number(digits)
  return Number.isFinite(n) ? (negative ? -n : n) : NaN
}

export function validateHeatmapGrid(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((row, i) => {
    if (!isPlainObject(row) || typeof row.label !== 'string') problems.push(`row ${i}: missing a string "label"`)
    const cells = row?.cells ?? row?.grid
    if (!Array.isArray(cells) || cells.length === 0) problems.push(`row ${i}: missing a non-empty "cells" array`)
  })
  return problems
}

export function validateObject(data) {
  if (data === undefined) return []
  return isPlainObject(data) ? [] : [`expected a plain object, got ${Array.isArray(data) ? 'array' : typeof data}`]
}

/**
 * A slider's data is { min, max, value, ...optional cosmetics, steps? }. `steps`, when present, is
 * an array of `{ at, ...otherSlotName: value }` — precomputed answers for a handful of known
 * positions (exactly what a mockup would have hard-coded), never a live formula or an API call.
 * See blocks/sliderSteps.js's findNearestStep for how a drag turns into those other blocks' new values.
 */
export function validateSlider(data) {
  if (data === undefined) return []
  if (!isPlainObject(data)) return [`expected an object, got ${Array.isArray(data) ? 'array' : typeof data}`]

  const problems = []
  const { min, max, value } = data
  const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v)

  if (!isFiniteNumber(min)) problems.push('"min" must be a finite number')
  if (!isFiniteNumber(max)) problems.push('"max" must be a finite number')
  if (!isFiniteNumber(value)) problems.push('"value" must be a finite number')

  if (isFiniteNumber(min) && isFiniteNumber(max)) {
    if (min >= max) problems.push('"min" must be less than "max"')
    else if (isFiniteNumber(value) && (value < min || value > max)) {
      problems.push('"value" must be between "min" and "max"')
    }
  }

  if (data.steps !== undefined) {
    if (!Array.isArray(data.steps)) {
      problems.push('"steps" must be an array when present')
    } else {
      data.steps.forEach((step, i) => {
        if (!isPlainObject(step) || !isFiniteNumber(step.at)) {
          problems.push(`steps[${i}] must be an object with a numeric "at"`)
        }
      })
    }
  }

  return problems
}

const THRESHOLD_KEYS = ['threshold', 'limit', 'limitPct', 'ceiling', 'floor', 'target', 'cap']

/**
 * A gauge/meter row set — see extraction/classifyBlocks.js's isGaugeShaped for the exact detection
 * rule this mirrors. Every row needs a magnitude (one of barChart's own magnitude keys) AND a
 * sibling threshold-shaped field it's being measured against; `label` is optional (GaugeBlock falls
 * back to a bare index, same convention as barChart).
 */
export function validateGauge(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`item ${i}: expected an object`)
      return
    }
    if (!CHART_MAGNITUDE_KEYS.some((k) => item[k] !== undefined)) {
      problems.push(`item ${i}: missing a magnitude (one of ${CHART_MAGNITUDE_KEYS.join('/')})`)
    }
    if (!THRESHOLD_KEYS.some((k) => item[k] !== undefined)) {
      problems.push(`item ${i}: missing a threshold (one of ${THRESHOLD_KEYS.join('/')})`)
    }
  })
  return problems
}

const GRID_COLUMN_RE = /^\d+\s*\/\s*span\s*\d+$/

/**
 * A calendar/Gantt lane row set — see extraction/classifyBlocks.js's isCalendarGanttShaped for the
 * exact detection rule this mirrors. Every row needs a non-empty `blocks` array, and every block
 * needs a string `label` and a CSS-grid `col` placement in the literal "<line> / span <count>" form.
 */
export function validateCalendarGantt(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((row, i) => {
    if (!isPlainObject(row) || !Array.isArray(row.blocks) || row.blocks.length === 0) {
      problems.push(`row ${i}: missing a non-empty "blocks" array`)
      return
    }
    row.blocks.forEach((block, j) => {
      if (!isPlainObject(block) || typeof block.label !== 'string' || block.label.trim() === '') {
        problems.push(`row ${i} block ${j}: missing a string "label"`)
      }
      if (!isPlainObject(block) || typeof block.col !== 'string' || !GRID_COLUMN_RE.test(block.col.trim())) {
        problems.push(`row ${i} block ${j}: "col" must be a CSS grid placement ("<line> / span <count>")`)
      }
    })
  })
  return problems
}

const VALIDATORS = {
  text: validateText,
  number: validateNumber,
  flag: validateFlag,
  labelValueList: validateLabelValueList,
  table: validateTable,
  itemQueue: validateItemQueue,
  lineChart: validateLineChart,
  barChart: validateBarChart,
  scatterChart: validateScatterChart,
  waterfallChart: validateWaterfallChart,
  heatmapGrid: validateHeatmapGrid,
  object: validateObject,
  slider: validateSlider,
  gauge: validateGauge,
  calendarGantt: validateCalendarGantt,
}

/**
 * Dispatches to the right validate<Type> for a block's declared blockType.
 * @returns {string[]} problems — ["unknown block type ..."] if blockType isn't in BLOCK_TYPES.
 */
export function validateBlockData(blockType, data) {
  const validator = VALIDATORS[blockType]
  if (!validator) return [`unknown block type "${blockType}"`]
  return validator(data)
}
