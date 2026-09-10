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
  'series', // chart/sparkline data: an array of points/numbers, or a raw SVG path string
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

export function validateSeries(data) {
  if (data === undefined) return []
  if (typeof data === 'string') return [] // an SVG path
  if (Array.isArray(data)) return []
  return [`expected an array or an SVG path string, got ${typeof data}`]
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
  series: validateSeries,
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
