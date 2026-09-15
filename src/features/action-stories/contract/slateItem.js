// Slate row identity — the id an Approve-selected `selection[]` entry refers to.
//
// This module is the SHARED definition, for the same reason statusLifecycle.js is: the identity the
// client puts in `selection` and the identity the server matches it against must be derived by ONE
// rule. Two implementations of "which row is item_3" are two chances to approve the wrong row.
//
// It lives in contract/ rather than beside the API test double because both sides of the boundary
// need it: the page supplies `rowIdOf` to the selectable block from here, and any implementation of
// `POST /v1/proposals/:id/actions` — the in-process double today, a real backend later — resolves
// `selection` with the same function.

/**
 * The item identity Approve-selected sends back. Uses the row's own business id where it has one and
 * falls back to a positional id, which is all a mockup-derived slate can offer. A real backend sends
 * a stable item id on every slate row and this heuristic disappears.
 *
 * @param {object[]} slate
 * @param {number} index
 * @returns {string}
 */
export function slateItemId(slate, index) {
  const row = slate[index]
  for (const key of ['id', 'item_id', 'sku', 'code']) {
    if (row && typeof row[key] === 'string' && row[key].trim() !== '') return row[key]
  }
  return `item_${index}`
}
