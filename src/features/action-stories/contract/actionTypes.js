// The six OPERATOR actions — what an operator does TO a proposal.
//
// Deliberately distinct from the business `action_type` (what the proposal itself proposes:
// reprice, reorder, ...; see decisionObject.js's ACTION_TYPES). The two were conflated in the
// original brief's field list and they are not the same axis: a `reprice` proposal and a
// `file_claim` proposal are both approved, dismissed and snoozed by the identical six controls.
//
// This module is pure contract data — no React, no store, no network. It is the single place that
// knows what each operator action REQUIRES of its payload, so the template JSON, the action bar,
// the dispatch guard and the API layer all agree without any of them restating the rules.

import { isLegalTransition } from './statusLifecycle.js'
import { deriveApproveEligibility, warnOnApproveEligibilityDrift } from './deriveEligibility.js'

/**
 * @typedef {object} OperatorAction
 * @property {string} id                  - stable contract id; also the eligibility key and the API `action_type`.
 * @property {string} label               - default button text. A template may override it.
 * @property {'primary'|'secondary'|'destructive'} kind
 * @property {boolean} reasonRequired     - whether free-text justification is mandatory.
 * @property {number} reasonMinLength     - enforced client-side AND re-checked at dispatch.
 * @property {boolean} requiresSelection  - whether a non-empty `selection[]` is mandatory.
 * @property {boolean} requiresSnoozeUntil- whether a future `snooze_until` is mandatory.
 * @property {'many'|null} requiresCardinality - the cardinality this action only exists for.
 * @property {boolean} requiresOnClock    - whether the proposal must be on the clock.
 * @property {string} resultingStatus     - the status the backend moves the proposal to.
 */

/** @type {OperatorAction[]} */
export const OPERATOR_ACTIONS = [
  {
    id: 'approve',
    label: 'Approve',
    kind: 'primary',
    reasonRequired: false,
    reasonMinLength: 0,
    requiresSelection: false,
    requiresSnoozeUntil: false,
    requiresCardinality: null,
    requiresOnClock: false,
    resultingStatus: 'approved',
  },
  {
    id: 'approve_selected',
    label: 'Approve selected',
    kind: 'primary',
    reasonRequired: false,
    reasonMinLength: 0,
    // The two rules that make this action different from plain Approve, both enforced at dispatch
    // and both re-enforced server-side: there must be something selected, and a one-item decision
    // has nothing to select FROM.
    requiresSelection: true,
    requiresSnoozeUntil: false,
    requiresCardinality: 'many',
    requiresOnClock: false,
    resultingStatus: 'approved',
  },
  {
    id: 'modify',
    label: 'Modify',
    kind: 'secondary',
    reasonRequired: true,
    reasonMinLength: 10,
    requiresSelection: false,
    requiresSnoozeUntil: false,
    requiresCardinality: null,
    requiresOnClock: false,
    // Modify is a round trip, not a terminal edit: the backend re-derives eligibility against the
    // new values and returns the proposal to `pending`. `modified` is the intermediate the
    // transition table records.
    resultingStatus: 'modified',
  },
  {
    id: 'send_back',
    label: 'Send back',
    kind: 'secondary',
    reasonRequired: true,
    reasonMinLength: 10,
    requiresSelection: false,
    requiresSnoozeUntil: false,
    requiresCardinality: null,
    requiresOnClock: false,
    // Reassignment changes ownership, not status — see statusLifecycle.js on why pending -> pending
    // is a legal, meaningful transition rather than a modelling smell.
    resultingStatus: 'pending',
  },
  {
    id: 'dismiss',
    label: 'Dismiss',
    kind: 'destructive',
    reasonRequired: true,
    reasonMinLength: 10,
    requiresSelection: false,
    requiresSnoozeUntil: false,
    requiresCardinality: null,
    requiresOnClock: false,
    resultingStatus: 'dismissed',
  },
  {
    id: 'snooze',
    label: 'Snooze',
    kind: 'secondary',
    reasonRequired: false,
    reasonMinLength: 0,
    requiresSelection: false,
    requiresSnoozeUntil: true,
    requiresCardinality: null,
    // Snoozing something that was never on a clock is meaningless — there is nothing to defer.
    requiresOnClock: true,
    resultingStatus: 'pending',
  },
]

/** Every operator action id, in display order. */
export const OPERATOR_ACTION_IDS = OPERATOR_ACTIONS.map((a) => a.id)

const BY_ID = Object.fromEntries(OPERATOR_ACTIONS.map((a) => [a.id, a]))

/** @returns {OperatorAction|null} */
export function getOperatorAction(id) {
  return BY_ID[id] ?? null
}

/**
 * The single authoritative check that one operator action may run against one Decision Object with
 * one payload. Pure, synchronous, no React, no store.
 *
 * Called from BOTH the action bar (to render the button state) and the store's dispatch boundary
 * (to reject a bypass) — deliberately the same function in both places, because two copies of a
 * security rule become one copy plus one hole. It is NOT a security boundary on its own: the
 * backend must run its own equivalent, since anything running in a browser can be edited.
 *
 * FAIL-CLOSED throughout: an unknown action, a missing Decision Object, a missing `eligibility`
 * entry, or an `allowed` that is anything other than the boolean `true` all deny.
 *
 * APPROVE IS THE ONE EXCEPTION, and deliberately so. Its eligibility is not read from the payload
 * at all — it is DERIVED by contract/deriveEligibility.js, the single producer, because
 * `guardrails.verdict` and `eligibility.approve.allowed` are independent fields and nothing at
 * runtime used to couple them. The other five actions still read their payload entry; deriving them
 * is Phase 2's decision, not something to do halfway.
 *
 * @param {string} actionId
 * @param {object} decision - the current Decision Object.
 * @param {{ reason?: string, selection?: string[], snooze_until?: string }} [payload]
 * @returns {{ allowed: boolean, reason: string|null }} `reason` is operator-facing when denied.
 */
export function checkOperatorAction(actionId, decision, payload = {}) {
  const spec = getOperatorAction(actionId)
  if (!spec) return deny(`"${actionId}" is not a known operator action.`)
  if (decision === null || typeof decision !== 'object') return deny('This proposal is unavailable.')

  // Approve, derived. FIRST, before the transition check below, so that every approve answer — the
  // lifecycle one included — comes from the one producer and any payload disagreement is reported
  // once, here, with this module named. The derivation runs its own lifecycle check, so nothing is
  // skipped by taking this branch early.
  if (actionId === 'approve') {
    const derived = deriveApproveEligibility(decision)
    warnOnApproveEligibilityDrift(decision, derived, 'actionTypes')
    if (!derived.allowed) return deny(derived.reason)
  }

  // Terminal proposals accept nothing further, regardless of what eligibility says — a stale
  // payload that still claims `approve.allowed` must not resurrect an already-dismissed proposal.
  if (!isLegalTransition(decision.status, spec.resultingStatus)) {
    return deny(`This proposal is ${decision.status} and can no longer be changed.`)
  }

  if (actionId !== 'approve') {
    const entry = decision.eligibility?.[actionId]
    if (entry === undefined || entry === null) {
      // The fail-closed rule, stated once: absence is not permission.
      return deny('This action is not available for this proposal.')
    }
    if (entry.allowed !== true) {
      return deny(entry.blocked_reason || 'This action is not available for this proposal.')
    }
  }

  if (spec.requiresCardinality !== null && decision.cardinality !== spec.requiresCardinality) {
    return deny(`${spec.label} applies only to multi-item proposals.`)
  }
  if (spec.requiresOnClock && decision.on_clock !== true) {
    return deny(`${spec.label} applies only to proposals with a deadline.`)
  }
  if (spec.requiresSelection && !(Array.isArray(payload.selection) && payload.selection.length > 0)) {
    return deny('Select at least one item first.')
  }
  if (spec.reasonRequired) {
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
    if (reason.length < spec.reasonMinLength) {
      return deny(`A reason of at least ${spec.reasonMinLength} characters is required.`)
    }
  }
  if (spec.requiresSnoozeUntil && !isFutureTimestamp(payload.snooze_until)) {
    return deny('Choose a snooze time in the future.')
  }

  return { allowed: true, reason: null }
}

function deny(reason) {
  return { allowed: false, reason }
}

/** A real ISO instant strictly in the future. `now` is injectable so tests never depend on wall clock. */
export function isFutureTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string' || value.trim() === '') return false
  const parsed = Date.parse(value)
  return !Number.isNaN(parsed) && parsed > now
}
