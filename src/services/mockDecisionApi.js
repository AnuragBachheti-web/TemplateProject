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
import {
  authorizeOperatorAction,
  applyOperatorAction,
  pageProposals,
} from '@/features/action-stories/contract/operatorActionExecution'
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

function aborted() {
  return new ActionStoriesError('Request aborted', { code: ERROR_CODES.ABORTED })
}

function delay(signal) {
  // An ALREADY-aborted signal must reject immediately. Listening for the `abort` event alone misses
  // it, because the event has already fired and will not fire again — the caller would then wait out
  // the full latency and succeed on a request it had cancelled.
  //
  // This used to be masked: decisionApi.js imported this module statically, so `delay` was reached
  // in the same microtask as the call and always beat a synchronous `controller.abort()`. The module
  // is now loaded through a dynamic `import()` (so the production HTTP build can drop it), which
  // interposes a tick and exposed the gap. axios, on the HTTP path, has always handled this
  // correctly; now both transports do.
  if (signal?.aborted) return Promise.reject(aborted())

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, LATENCY_MS)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(aborted())
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
  // Filtering, ordering, projection and cursor paging all live in the contract module, so this
  // double and the standalone HTTP server cannot drift into serving different queue shapes.
  return pageProposals([...store.values()], { stage, persona, storyCode, limit, cursor })
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
 * The checks themselves, their ORDER, and what an action does to a Decision Object all live in
 * contract/operatorActionExecution.js, because mock-server/ implements this same endpoint over real
 * HTTP and the two must be one set of rules, not two. What stays here is the only part that
 * genuinely differs between an in-memory double and a deployed server: idempotency and storage.
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

  // 2. Existence. Storage is this module's own concern, so the lookup stays here.
  const proposal = store.get(proposalId)
  if (!proposal) {
    throw httpError(404, `No proposal "${proposalId}"`, 'This proposal is no longer available.')
  }

  // 3-6. Entitlement, action validity, optimistic concurrency, business eligibility and the status
  //      transition — the shared gate.
  const verdict = authorizeOperatorAction(proposal, actionType, { reason, selection, snoozeUntil, expectedUpdatedAt })
  if (!verdict.ok) {
    throw httpError(verdict.status, verdict.message, verdict.userMessage)
  }

  const updated = applyOperatorAction(proposal, actionType, { reason, selection, snoozeUntil, nextStatus: verdict.nextStatus })
  store.set(proposalId, updated)
  idempotencyLedger.set(idempotencyKey, { proposalId, actionType, result: updated })

  return structuredClone(updated)
}
