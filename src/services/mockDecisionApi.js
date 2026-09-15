// ⚠️  A TEST DOUBLE. NOT A BACKEND. NOT PRODUCTION FUNCTIONALITY.
//
// This repository contains no server: there is no API project, no database, no deployment target,
// and inventing one to satisfy an integration task would be fabricating infrastructure. What exists
// here instead is an in-memory implementation of the SAME contract a real backend must implement,
// so that (a) the frontend integration is real code exercising a real boundary rather than a stub,
// and (b) every API behaviour the contract promises — authorization, idempotency, eligibility
// re-checks, status transitions, conflict detection — is executable and testable today.
//
// The real `POST /v1/proposals/:id/actions` remains an EXTERNAL DEPENDENCY. When it exists, set
// VITE_API_BASE_URL and decisionApi.js routes to it through httpClient instead; nothing else moves.
//
// Everything below the "server-side" comment is what the backend team must re-implement for real,
// in their own stack. It is written here as executable specification, not as a shim to keep.
//
// ITS DATA is `__corpus__/normalized/dataset.json` — the canonical dataset produced by
// `npm run normalize` from the archived corpus. That file is clean business data (no CSS, no
// geometry, no SVG, no mockup metadata) and is the exact payload a real API should serve. The
// archived RAW fixtures next to it are reference evidence and are never loaded at runtime.

import { ActionStoriesError, ERROR_CODES } from './actionStoriesErrors'
import { checkOperatorAction, getOperatorAction } from '@/features/action-stories/contract/actionTypes'
import { isLegalTransition } from '@/features/action-stories/contract/statusLifecycle'
import { slateItemId } from '@/features/action-stories/contract/slateItem'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

const LATENCY_MS = 180 // a real round trip has latency; a mutation that settles in the same microtask hides every loading state

/** proposal_id -> Decision Object. Reset between tests via `__resetMockApi`. */
let store = new Map()
/** idempotency_key -> the response that key already produced. */
let idempotencyLedger = new Map()

function hydrate() {
  store = new Map(seed.map((d) => [d.proposal_id, structuredClone(d)]))
  idempotencyLedger = new Map()
}
hydrate()

/** Test-only. Restores the seed corpus and clears the idempotency ledger. */
export function __resetMockApi() {
  hydrate()
}

/** Test-only. Lets a test place a specific Decision Object under a known id. */
export function __seedProposal(decision) {
  store.set(decision.proposal_id, structuredClone(decision))
}

function delay(signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, LATENCY_MS)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED }))
    })
  })
}

/** Builds the same error shape the real HTTP path produces, so callers cannot tell the two apart. */
function httpError(status, message, userMessage) {
  const code =
    status === 404 ? ERROR_CODES.NOT_FOUND : status >= 500 ? ERROR_CODES.SERVER_ERROR : ERROR_CODES.CLIENT_ERROR
  return new ActionStoriesError(message, { code, status, userMessage, retryable: false })
}

// ---- GET /v1/proposals -------------------------------------------------------------------------

export async function mockListProposals({ stage, persona, storyCode, limit = 25, cursor, signal } = {}) {
  await delay(signal)

  let rows = [...store.values()]
  if (stage) rows = rows.filter((d) => d.stage === stage)
  if (persona) rows = rows.filter((d) => d.persona === persona)
  // `story_code` filter — the parent Action Story identity. Already on every Decision Object, so
  // this adds a query parameter, not a contract field.
  if (storyCode) rows = rows.filter((d) => d.story_code === storyCode)
  rows.sort((a, b) => a.proposal_id.localeCompare(b.proposal_id))

  const start = cursor ? rows.findIndex((d) => d.proposal_id === cursor) + 1 : 0
  const page = rows.slice(start, start + limit)
  const next = start + limit < rows.length ? page[page.length - 1]?.proposal_id ?? null : null

  return {
    items: page.map((d) => ({
      proposal_id: d.proposal_id,
      story_code: d.story_code,
      title: d.title,
      impact: d.impact,
      confidence: d.confidence,
      stage: d.stage,
      on_clock: d.on_clock,
      deadline: d.deadline ?? null,
      status: d.status,
    })),
    next_cursor: next,
  }
}

// ---- GET /v1/proposals/:proposal_id --------------------------------------------------------------

export async function mockGetProposal(proposalId, { signal } = {}) {
  await delay(signal)
  const found = store.get(proposalId)
  if (!found) {
    throw httpError(404, `No proposal "${proposalId}"`, 'This proposal is no longer available.')
  }
  return structuredClone(found)
}

// ---- POST /v1/proposals/:proposal_id/actions -----------------------------------------------------

/**
 * ===== SERVER-SIDE LOGIC — the part a real backend owns =====
 *
 * The order of checks matters and is part of the contract: authentication and authorization first
 * (a caller who may not act must not learn whether the action would have been eligible), then
 * existence, then optimistic-concurrency, then business eligibility.
 *
 * Nothing here trusts the client. The frontend's own eligibility check (checkOperatorAction, run in
 * the action bar AND at the store's dispatch boundary) is a UI affordance; this is the gate. They
 * deliberately call the SAME pure function, because two implementations of one security rule
 * become one implementation plus one hole.
 */
export async function mockRunProposalAction(proposalId, body = {}, { signal, idempotencyKey } = {}) {
  await delay(signal)

  const { action_type: actionType, reason, selection, snooze_until: snoozeUntil, expected_updated_at: expectedUpdatedAt } = body

  // 1. Idempotency. Checked before anything else: a replayed request must return the ORIGINAL
  //    result without re-running the action, which is the entire point of the key.
  if (!idempotencyKey) {
    throw httpError(422, 'idempotency_key is required', 'This action could not be sent. Please try again.')
  }
  const replayed = idempotencyLedger.get(idempotencyKey)
  if (replayed) {
    if (replayed.proposalId !== proposalId || replayed.actionType !== actionType) {
      // Same key, different request — the client has a bug, and honouring it would let one key
      // authorise an unrelated mutation.
      throw httpError(409, 'Idempotency key reused for a different request', 'This action conflicted with another. Refresh and try again.')
    }
    return structuredClone(replayed.result)
  }

  // 2. Authorization. Simulated: a real backend resolves the caller's identity and entitlements from
  //    the session, never from the request body or the Decision Object it is about to return.
  const proposal = store.get(proposalId)
  if (!proposal) {
    throw httpError(404, `No proposal "${proposalId}"`, 'This proposal is no longer available.')
  }
  if (proposal.entitlement === 'locked') {
    throw httpError(403, 'Caller entitlement does not permit actions on this proposal', 'You are not authorized to perform this action.')
  }

  const spec = getOperatorAction(actionType)
  if (!spec) {
    throw httpError(422, `Unknown action_type "${actionType}"`, 'This action is no longer available for this proposal.')
  }

  // 3. Optimistic concurrency. The client sends the `updated_at` it rendered; if the proposal moved
  //    underneath it, the operator acted on a stale view and must see the current one first.
  if (expectedUpdatedAt && expectedUpdatedAt !== proposal.updated_at) {
    throw httpError(409, 'Proposal changed since it was read', 'This proposal changed before your action was completed. Refresh and try again.')
  }

  // 4. Business eligibility — re-derived server-side, never taken from the client.
  const verdict = checkOperatorAction(actionType, proposal, { reason, selection, snooze_until: snoozeUntil })
  if (!verdict.allowed) {
    throw httpError(422, `Action "${actionType}" rejected: ${verdict.reason}`, verdict.reason)
  }

  // 5. Status transition.
  const nextStatus = spec.resultingStatus
  if (!isLegalTransition(proposal.status, nextStatus)) {
    throw httpError(409, `Illegal transition ${proposal.status} -> ${nextStatus}`, 'This proposal changed before your action was completed. Refresh and try again.')
  }

  const updated = applyAction(proposal, actionType, { reason, selection, snoozeUntil, nextStatus })
  store.set(proposalId, updated)
  idempotencyLedger.set(idempotencyKey, { proposalId, actionType, result: updated })

  return structuredClone(updated)
}

/**
 * Produces the NEW Decision Object an action results in. This is what the endpoint returns, and it
 * is why the frontend never has to guess what changed — no optimistic patching, no local mirror of
 * server state, no localStorage record of "what was approved".
 */
function applyAction(proposal, actionType, { reason, selection, snoozeUntil, nextStatus }) {
  const next = structuredClone(proposal)
  next.status = nextStatus
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
