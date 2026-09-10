// Safe dot-path binding resolver. A binding is a string like "data.execLabel" or
// "data.rows[2].name" describing a path from the root fixture object ({ code, stageKey, name,
// props, state, data } — see src/features/action-stories/data/raw/<code>/<stageKey>.json)
// down to the value a block actually renders.
//
// Resolution never throws: a missing key, a null/undefined along the way, or an out-of-range
// index all just resolve to `undefined` — never the literal text "undefined", never an error.
// Nothing here parses or reshapes the resolved value; it's returned exactly as stored.

/**
 * @param {string} binding - dot-path, optionally with bracket indices ("rows[0].name").
 * @param {object} data - the object to resolve the path against (usually a whole fixture).
 * @returns {*} the resolved value, or `undefined` if any step of the path is missing.
 */
export function resolveBinding(binding, data) {
  if (typeof binding !== 'string' || binding.length === 0) return data

  const path = binding
    .replace(/\[(\d+)\]/g, '.$1') // "rows[0]" -> "rows.0"
    .split('.')
    .filter((segment) => segment.length > 0)

  let current = data
  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}
