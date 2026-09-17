// A REAL, session-scoped record of an operator action that actually ran through
// useActionStoriesStore.runAction() — never a fabricated historical log.
//
// Deliberately SMALLER than the reference's own Ledger entry shape (a tamper-evident hash/prev
// chain, a rollback/rollbackState pair). Both presuppose things this repository does not have: a
// backend-issued, cryptographically-chained audit log, and at least one reversible operator action
// (see actionTypes.js — none of the six is). Rendering a hash chain with nothing signing it, or a
// "Rollback" control wired to nothing, would be exactly the fabricated-capability problem
// Shell.jsx's own TopBar comment already refuses to do for operator identity — so this contract
// only carries fields this app can back with something real.
//
// `who` is always the literal "You": there is no auth/session in this app (same reasoning, same
// file), so every entry in a browser's own ledger was necessarily made by whoever is looking at it.

let counter = 0

/**
 * @param {object} params
 * @param {string} params.actionId - one of actionTypes.js's OPERATOR_ACTION_IDS.
 * @param {string} params.label - the operator-facing action label (e.g. "Approve").
 * @param {string} params.storyCode
 * @param {string} params.stage
 * @param {string} params.proposalId
 * @param {'success'|'error'} params.outcome
 * @param {string} [params.detail] - the resulting status on success, or the operator-facing error
 *   message on failure.
 */
export function createLedgerEntry({ actionId, label, storyCode, stage, proposalId, outcome, detail = null }) {
  counter += 1
  return {
    id: `${Date.now()}_${counter}`,
    when: new Date().toISOString(),
    who: 'You',
    actionId,
    label,
    storyCode,
    stage,
    proposalId,
    outcome,
    detail,
  }
}
