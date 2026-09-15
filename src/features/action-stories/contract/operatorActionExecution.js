// The SERVER-SIDE half of the operator-action contract: what a backend must check before it lets an
// action through, what an action does to a Decision Object, and what one row of the proposal queue
// looks like.
//
// WHY THIS MODULE EXISTS. Two things now implement `POST /v1/proposals/:id/actions`: the in-process
// test double (services/mockDecisionApi.js) that runs inside the browser bundle when no API is
// configured, and the standalone HTTP server (mock-server/) that will run on Render. Those are two
// transports for ONE set of rules. Writing the rules twice would be exactly the failure
// mockDecisionApi's own header warns about — "two implementations of one security rule become one
// implementation plus one hole" — so the rules live here, once, and both transports import them.
//
// Everything here is PURE: no store, no network, no clock beyond the timestamp arithmetic the
// contract already specifies. Idempotency and persistence are deliberately NOT here, because they
// are the one part that genuinely differs between an in-memory Map and a real backend.
//
// This is executable specification. A real backend re-implements it in its own stack; until then,
// both of ours read from this file.

import { checkOperatorAction, getOperatorAction } from './actionTypes.js'
import { isLegalTransition } from './statusLifecycle.js'
import { slateItemId } from './slateItem.js'

/**
 * Every check a backend must run before performing an action, in the order the contract requires.
 *
 * THE ORDER IS PART OF THE CONTRACT: authorization first (a caller who may not act must not learn
 * whether the action would have been eligible), then existence of the action, then
 * optimistic-concurrency, then business eligibility, then the status transition.
 *
 * Nothing here trusts the client. The frontend's own eligibility check (checkOperatorAction, run in
 * the action bar and again at the store's dispatch boundary) is a UI affordance; this is the gate.
 * They deliberately call the SAME pure function.
 *
 * @param {object} proposal - the CURRENT stored Decision Object, never one supplied by the caller.
 * @param {string} actionType
 * @param {{reason?: string, selection?: string[], snoozeUntil?: string|null,
 *          expectedUpdatedAt?: string}} [payload]
 * @returns {{ok: true, nextStatus: string} | {ok: false, status: number, message: string, userMessage: string}}
 *   `status` is the HTTP status the failure must produce, so both transports report it identically.
 */
export function authorizeOperatorAction(proposal, actionType, payload = {}) {
  const { reason, selection, snoozeUntil, expectedUpdatedAt } = payload

  // 1. Authorization. A real backend resolves the caller's identity and entitlements from the
  //    session, never from the request body or the Decision Object it is about to return.
  if (proposal.entitlement === 'locked') {
    return reject(403, 'Caller entitlement does not permit actions on this proposal', 'You are not authorized to perform this action.')
  }

  const spec = getOperatorAction(actionType)
  if (!spec) {
    return reject(422, `Unknown action_type "${actionType}"`, 'This action is no longer available for this proposal.')
  }

  // 2. Optimistic concurrency. The client sends the `updated_at` it rendered; if the proposal moved
  //    underneath it, the operator acted on a stale view and must see the current one first.
  if (expectedUpdatedAt && expectedUpdatedAt !== proposal.updated_at) {
    return reject(409, 'Proposal changed since it was read', 'This proposal changed before your action was completed. Refresh and try again.')
  }

  // 3. Business eligibility — re-derived server-side, never taken from the client.
  const verdict = checkOperatorAction(actionType, proposal, { reason, selection, snooze_until: snoozeUntil })
  if (!verdict.allowed) {
    return reject(422, `Action "${actionType}" rejected: ${verdict.reason}`, verdict.reason)
  }

  // 4. Status transition. REDUNDANT DEFENCE IN DEPTH, deliberately kept: `checkOperatorAction`
  //    above already runs `isLegalTransition` as its own fail-closed rule before consulting the
  //    eligibility map, so in practice step 3 catches an illegal move first (with 422, not 409 —
  //    see mock-server/app.test.js, which pins that). This stays because the cost is one comparison
  //    and the failure it guards against — a future change to the eligibility check that drops the
  //    terminal-status rule — is a silent one.
  const nextStatus = spec.resultingStatus
  if (!isLegalTransition(proposal.status, nextStatus)) {
    return reject(409, `Illegal transition ${proposal.status} -> ${nextStatus}`, 'This proposal changed before your action was completed. Refresh and try again.')
  }

  return { ok: true, nextStatus }
}

function reject(status, message, userMessage) {
  return { ok: false, status, message, userMessage }
}

/**
 * Produces the NEW Decision Object an action results in. This is what the endpoint returns, and it
 * is why the frontend never has to guess what changed — no optimistic patching, no local mirror of
 * server state, no localStorage record of "what was approved".
 *
 * Call only after `authorizeOperatorAction` has returned `ok`.
 *
 * @param {object} proposal
 * @param {string} actionType
 * @param {{reason?: string, selection?: string[], snoozeUntil?: string|null, nextStatus?: string}} [payload]
 *   `nextStatus` may be passed through from the authorize result; it is otherwise re-derived from
 *   the action's own spec, which is where it came from in the first place.
 * @returns {object} a deep copy — the input is never mutated.
 */
export function applyOperatorAction(proposal, actionType, { reason, selection, snoozeUntil, nextStatus } = {}) {
  const next = structuredClone(proposal)
  next.status = nextStatus ?? getOperatorAction(actionType)?.resultingStatus ?? proposal.status
  next.updated_at = new Date(Date.parse(proposal.updated_at) + 1000).toISOString()

  // Once a proposal reaches a terminal status nothing further is eligible. Re-deriving eligibility
  // here (rather than leaving the old values in place) is what makes the returned object
  // self-consistent — the action bar renders straight off it with no extra rules.
  const denyAll = (why) =>
    Object.fromEntries(Object.keys(next.eligibility).map((k) => [k, { allowed: false, blocked_reason: why }]))

  switch (actionType) {
    case 'approve':
      next.eligibility = denyAll('This proposal has already been approved.')
      break
    case 'approve_selected':
      // Partial approval is represented IN the Decision Object: the approved items leave the slate
      // and are recorded, so the returned object is a complete description of the new state.
      next.proposal = { ...next.proposal }
      if (Array.isArray(next.proposal.slate)) {
        const chosen = new Set(selection)
        next.proposal.approved_items = next.proposal.slate.filter((_, i) => chosen.has(slateItemId(next.proposal.slate, i)))
        next.proposal.slate = next.proposal.slate.filter((_, i) => !chosen.has(slateItemId(next.proposal.slate, i)))
      }
      next.eligibility = denyAll('The selected items on this proposal have been approved.')
      break
    case 'modify':
      next.proposal = { ...next.proposal, modification_note: reason }
      break
    case 'send_back':
      next.proposal = { ...next.proposal, send_back_note: reason }
      next.eligibility = { ...next.eligibility, send_back: { allowed: false, blocked_reason: 'Already sent back to its owner.' } }
      break
    case 'dismiss':
      next.eligibility = denyAll('This proposal has been dismissed.')
      break
    case 'snooze':
      next.snoozed_until = snoozeUntil
      break
    default:
      break
  }

  return next
}

/**
 * One row of `GET /v1/proposals` — enough to render the queue without fetching each proposal in
 * full. Shared so the two transports cannot drift into serving different queue shapes; the fields
 * are exactly those `validateDecisionObjectSummary` requires, plus the two it accepts optionally.
 *
 * @param {object} decision
 * @returns {object}
 */
export function toProposalSummary(decision) {
  return {
    proposal_id: decision.proposal_id,
    story_code: decision.story_code,
    title: decision.title,
    impact: decision.impact,
    confidence: decision.confidence,
    stage: decision.stage,
    on_clock: decision.on_clock,
    deadline: decision.deadline ?? null,
    status: decision.status,
  }
}

/**
 * The queue's filtering, ordering and cursor paging — the other half of `GET /v1/proposals` that
 * both transports must agree on. Pure: takes every stored Decision Object, returns one page.
 *
 * @param {object[]} all
 * @param {{stage?: string, persona?: string, storyCode?: string, limit?: number, cursor?: string}} [query]
 * @returns {{items: object[], next_cursor: string|null}}
 */
export function pageProposals(all, { stage, persona, storyCode, limit = 25, cursor } = {}) {
  let rows = [...all]
  if (stage) rows = rows.filter((d) => d.stage === stage)
  if (persona) rows = rows.filter((d) => d.persona === persona)
  // `story_code` filter — the parent Action Story identity. Already on every Decision Object, so
  // this adds a query parameter, not a contract field.
  if (storyCode) rows = rows.filter((d) => d.story_code === storyCode)
  rows.sort((a, b) => a.proposal_id.localeCompare(b.proposal_id))

  const start = cursor ? rows.findIndex((d) => d.proposal_id === cursor) + 1 : 0
  const page = rows.slice(start, start + limit)
  const next = start + limit < rows.length ? page[page.length - 1]?.proposal_id ?? null : null

  return { items: page.map(toProposalSummary), next_cursor: next }
}
