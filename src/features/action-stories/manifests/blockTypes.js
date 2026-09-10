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
]

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function validateText(data) {
  if (data === undefined) return []
  return typeof data === 'string' ? [] : [`expected a string, got ${typeof data}`]
}

export function validateNumber(data) {
  if (data === undefined) return []
  if (typeof data !== 'number') return [`expected a number, got ${typeof data}`]
  return Number.isFinite(data) ? [] : ['expected a finite number']
}

export function validateFlag(data) {
  if (data === undefined) return []
  return typeof data === 'boolean' ? [] : [`expected a boolean, got ${typeof data}`]
}

export function validateLabelValueList(data) {
  if (data === undefined) return []
  if (!Array.isArray(data)) return [`expected an array, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`item ${i}: expected an object, got ${typeof item}`)
    } else if (typeof item.label !== 'string') {
      problems.push(`item ${i}: missing a string "label"`)
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

export function validateLineChart(data) {
  if (data === undefined) return []
  if (typeof data === 'string') return [] // a single SVG path
  if (!Array.isArray(data)) return [`expected an SVG path string or an array of {path}, got ${typeof data}`]
  const problems = []
  data.forEach((item, i) => {
    if (!isPlainObject(item) || typeof item.path !== 'string') {
      problems.push(`item ${i}: expected an object with a string "path"`)
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
    if (!isNumericLike(item.top) || !isNumericLike(item.height)) problems.push(`item ${i}: missing numeric "top"/"height"`)
    if (item.value === undefined) problems.push(`item ${i}: missing "value"`)
    if (item.anchor === true) hasAnchor = true
  })
  if (!hasAnchor) problems.push('no row marked "anchor": true (no baseline/total bar)')
  return problems
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
