// The proposal status lifecycle — four statuses and an explicit transition table.
//
// Deliberately four, not seven. `TEMPLATE_ARCHITECTURE_AUDIT.md` sketched a wider set including
// executing/completed/failed/rolled_back, but nothing in this repository drives those: the corpus's
// execute stage carries progress data, not a distinct server-side execution status, and inventing
// statuses the domain does not yet require is exactly the speculative modelling this work is meant
// to avoid. Adding one later is one entry here plus one row in the transition table.
//
// This module is the SHARED definition. The frontend uses it to reason about what a returned
// Decision Object means; a backend implementing this contract must enforce the same table
// server-side. The frontend never performs a transition itself — it reads `status` off whatever the
// action endpoint returned.

/** Every status a proposal may be in. */
export const STATUSES = ['pending', 'approved', 'modified', 'dismissed']

/** Statuses from which no further operator action is possible. */
export const TERMINAL_STATUSES = ['approved', 'dismissed']

/**
 * from -> the statuses it may legally move to.
 *
 * `modified -> pending` is what makes Modify a round trip rather than a terminal edit: an operator
 * changes the proposal, the backend re-derives eligibility and guardrails against the new values,
 * and the proposal comes back for a decision. `pending -> pending` is legal and meaningful — Send
 * back (reassignment) and Snooze both leave the status alone while changing other Decision Object
 * fields, and a transition table that forbade it would force those two actions to lie about what
 * they did.
 */
export const LEGAL_TRANSITIONS = Object.freeze({
  pending: ['pending', 'approved', 'modified', 'dismissed'],
  modified: ['pending'],
  approved: [],
  dismissed: [],
})

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean} whether this transition is permitted. An unknown status on either side is
 *   never permitted — this is a gate, so an unrecognised input fails closed like every other.
 */
export function isLegalTransition(from, to) {
  if (!STATUSES.includes(from) || !STATUSES.includes(to)) return false
  return LEGAL_TRANSITIONS[from].includes(to)
}

/** True once no operator action can apply — the action bar renders nothing further. */
export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status)
}
