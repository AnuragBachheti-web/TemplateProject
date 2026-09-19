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
 * The identity of ONE row, given its own position in the slate.
 *
 * Split out from `slateItemId` because the two callers hold different things: the execution side
 * has the whole slate and an index, the render side has a row and its index but never the array.
 * StagePage bridged that gap with `slateItemId([row], 0)` — a one-element array and a literal 0 —
 * which pinned the positional fallback to `item_0` for EVERY row. On the 16 of 20 slates whose rows
 * carry no business id that made all ids identical: one tick checked the whole table, and an
 * Approve-selected would have sent `["item_0"]` whatever the operator picked.
 *
 * @param {object} row
 * @param {number} index  the row's position in its own slate.
 * @returns {string}
 */
export function slateItemIdOf(row, index) {
  for (const key of ['id', 'item_id', 'sku', 'code']) {
    if (row && typeof row[key] === 'string' && row[key].trim() !== '') return row[key]
  }
  return `item_${index}`
}

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
  return slateItemIdOf(slate[index], index)
}
