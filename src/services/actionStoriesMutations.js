// Operator action dispatch.
//
// BEFORE: a `setTimeout` plus a `localStorage` write, with an `ACTION_HANDLERS` registry that was
// permanently empty, so every action fell through to one generic mock that marked a key "done".
// Completion was client-side truth: clearing browser storage un-approved a proposal.
//
// AFTER: one POST to the action endpoint, returning the updated Decision Object. There is no
// per-verb handler registry any more — six operator actions differ only in their payload and the
// status they produce, both of which are contract data (contract/actionTypes.js), so a registry of
// functions keyed by verb had nothing left to hold.
//
// localStorage is gone from this file entirely. Backend status is the only truth.

import { runProposalAction, newIdempotencyKey } from './decisionApi'
import { ActionStoriesError, ERROR_CODES } from './actionStoriesErrors'
import { checkOperatorAction } from '@/features/action-stories/contract/actionTypes'

/**
 * @param {object} params
 * @param {string} params.proposalId
 * @param {object} params.decision   - the Decision Object currently rendered; the eligibility gate
 *   and the optimistic-concurrency token both come from it.
 * @param {string} params.actionType - one of the six operator actions.
 * @param {string} [params.reason]
 * @param {string[]} [params.selection]
 * @param {string} [params.snoozeUntil]
 * @param {string} [params.idempotencyKey] - supplied by the caller so a RETRY reuses the SAME key
 *   (that is what makes a retry safe); generated here only for a first attempt.
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<object>} the updated Decision Object.
 * @throws {ActionStoriesError}
 */
export async function dispatchAction({
  proposalId,
  decision,
  actionType,
  reason,
  selection,
  snoozeUntil,
  idempotencyKey,
  signal,
} = {}) {
  if (!proposalId || !actionType) {
    throw new ActionStoriesError('dispatchAction requires proposalId and actionType', {
      code: ERROR_CODES.CLIENT_ERROR,
      userMessage: "Couldn't run this action — missing context.",
      retryable: false,
    })
  }

  // The dispatch-boundary eligibility gate. The action bar has already checked this to decide how to
  // render the button, but a check that lives only in a click handler is not a check: anything that
  // can call this function — a stale closure, a future call site, a console — would otherwise get
  // through. Fails closed on a missing Decision Object or a missing eligibility entry.
  //
  // This is NOT the security boundary. The server runs the same rules against its own state; a
  // browser-side check can always be edited out by whoever is running the browser.
  const verdict = checkOperatorAction(actionType, decision, { reason, selection, snooze_until: snoozeUntil })
  if (!verdict.allowed) {
    throw new ActionStoriesError(`Action "${actionType}" is not eligible: ${verdict.reason}`, {
      code: ERROR_CODES.CLIENT_ERROR,
      status: 422,
      userMessage: verdict.reason,
      retryable: false,
    })
  }

  return runProposalAction(
    proposalId,
    {
      action_type: actionType,
      reason: reason ?? null,
      selection: selection ?? null,
      snooze_until: snoozeUntil ?? null,
      idempotency_key: idempotencyKey ?? newIdempotencyKey(),
      // Optimistic concurrency: the server rejects with 409 if the proposal moved since this view
      // was rendered, so an operator can never act on a screen that is quietly out of date.
      expected_updated_at: decision?.updated_at,
    },
    { signal },
  )
}

export { newIdempotencyKey }
