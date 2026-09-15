// The Decision Object API boundary — the only module that talks to a server, and the only place a
// response is validated before the rest of the app is allowed to see it.
//
// Three endpoints, exactly as the shared contract names them:
//   GET  /v1/proposals
//   GET  /v1/proposals/:proposal_id
//   POST /v1/proposals/:proposal_id/actions
//
// TRANSPORT. When `VITE_API_BASE_URL` is configured these go over HTTP through the existing
// httpClient (axios, 10s timeout, retry classification, abort support, normalised errors) — there
// is deliberately no second HTTP client. When it is NOT configured, they route to
// mockDecisionApi.js, which is a test double implementing the same contract, not a backend. Which
// transport is active is reported by `isUsingMockTransport()` and surfaced in the UI, because a
// mock that cannot be distinguished from a real backend is how a demo gets mistaken for a product.
//
// VALIDATION. Every response is run through validateDecisionObject before it is returned. A backend
// that silently drops `eligibility`, or sends an axis this contract does not know, fails loudly
// here as MALFORMED rather than rendering a plausible-looking screen with no guardrails on it.

import httpClient from './httpClient'
import { ActionStoriesError, ERROR_CODES, toActionStoriesError } from './actionStoriesErrors'
import { validateDecisionObject, validateDecisionObjectSummary } from '@/features/action-stories/contract/decisionObject'

/**
 * Vite statically replaces `import.meta.env.VITE_API_BASE_URL` with a string literal at build time.
 * That is the whole mechanism behind the two constants below: they are not runtime lookups in a
 * production build, they are folded to `"https://…"` and `false`, which is what lets the bundler
 * prove the mock branch in every function below is unreachable and drop `./mockDecisionApi` — and
 * the 627 KB of Decision Objects it imports — out of the build entirely.
 *
 * Read once, at module scope, for exactly that reason. Reading it inside each function would leave
 * the branch condition opaque to the bundler and ship the corpus to every user.
 *
 * `globalThis.import_meta_env`-style guards are deliberately absent: `import.meta.env` is defined by
 * Vite in dev, in the production build and under Vitest (which reads this same config), so there is
 * no environment this module runs in where it is missing.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const USE_MOCK_TRANSPORT = API_BASE_URL === ''

/**
 * The test double, loaded on demand.
 *
 * Dynamic, not static, so that the import lives INSIDE the dead branch a production HTTP build
 * eliminates. The promise is cached so concurrent callers share one module instance — the double
 * holds mutable state (its store and idempotency ledger), and two instances would be two stores.
 */
let mockTransport
function loadMockTransport() {
  mockTransport ??= import('./mockDecisionApi')
  return mockTransport
}

/** True when no real API is configured and the in-memory test double is serving requests. */
export function isUsingMockTransport() {
  return USE_MOCK_TRANSPORT
}

/**
 * Per-status operator-facing copy. Reuses the existing 8-code taxonomy — this only supplies the
 * `userMessage` for the statuses whose taxonomy code (CLIENT_ERROR) is too coarse to say anything
 * useful on its own. No second error model.
 */
const USER_MESSAGE_BY_STATUS = {
  403: 'You are not authorized to perform this action.',
  404: 'This proposal is no longer available.',
  409: 'This proposal changed before your action was completed. Refresh and try again.',
  422: 'This action is no longer available for this proposal.',
}

/** Normalises any failure into the shared taxonomy, attaching the right operator-facing message. */
function normalise(err, fallback) {
  const error = toActionStoriesError(err, fallback)
  const better = USER_MESSAGE_BY_STATUS[error.status]
  if (better && !err?.userMessage) error.userMessage = better
  return error
}

function malformed(problems, what) {
  console.warn(`[decisionApi] ${what} failed contract validation:`, problems)
  return new ActionStoriesError(`${what} failed validation: ${problems.join('; ')}`, {
    code: ERROR_CODES.MALFORMED,
  })
}

// ---- GET /v1/proposals ---------------------------------------------------------------------------

/**
 * @param {{stage?: string, persona?: string, storyCode?: string, limit?: number, cursor?: string,
 *          signal?: AbortSignal}} [params] - `storyCode` filters to one Action Story's stages.
 * @returns {Promise<{items: object[], next_cursor: string|null}>}
 */
export async function listProposals({ stage, persona, storyCode, limit = 25, cursor, signal } = {}) {
  let body
  try {
    if (USE_MOCK_TRANSPORT) {
      const { mockListProposals } = await loadMockTransport()
      body = await mockListProposals({ stage, persona, storyCode, limit, cursor, signal })
    } else {
      const query = new URLSearchParams()
      if (stage) query.set('stage', stage)
      if (persona) query.set('persona', persona)
      if (storyCode) query.set('story_code', storyCode)
      query.set('limit', String(limit))
      if (cursor) query.set('cursor', cursor)
      const response = await httpClient.get(`${API_BASE_URL}/v1/proposals?${query}`, { signal })
      body = response.data
    }
  } catch (err) {
    throw normalise(err, 'Failed to load the proposal queue')
  }

  if (!body || !Array.isArray(body.items)) {
    throw malformed(['"items" must be an array'], 'Proposal queue response')
  }
  const problems = body.items.flatMap((item, i) => validateDecisionObjectSummary(item).map((p) => `items[${i}]: ${p}`))
  if (problems.length > 0) throw malformed(problems, 'Proposal queue response')

  return { items: body.items, next_cursor: body.next_cursor ?? null }
}

// ---- GET /v1/proposals/:proposal_id ---------------------------------------------------------------

/**
 * @param {string} proposalId
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<object>} a validated Decision Object.
 */
export async function getProposal(proposalId, { signal } = {}) {
  if (typeof proposalId !== 'string' || proposalId.trim() === '') {
    throw new ActionStoriesError('getProposal requires a proposal_id', {
      code: ERROR_CODES.CLIENT_ERROR,
      userMessage: 'This proposal is no longer available.',
      retryable: false,
    })
  }

  let body
  try {
    if (USE_MOCK_TRANSPORT) {
      const { mockGetProposal } = await loadMockTransport()
      body = await mockGetProposal(proposalId, { signal })
    } else {
      body = (await httpClient.get(`${API_BASE_URL}/v1/proposals/${encodeURIComponent(proposalId)}`, { signal })).data
    }
  } catch (err) {
    throw normalise(err, `Failed to load proposal "${proposalId}"`)
  }

  const problems = validateDecisionObject(body)
  if (problems.length > 0) throw malformed(problems, `Decision Object for "${proposalId}"`)
  return body
}

// ---- POST /v1/proposals/:proposal_id/actions -------------------------------------------------------

/**
 * Runs one operator action and returns the UPDATED Decision Object — never an ack. That choice
 * removes a round trip and, more importantly, a stale-read window: there is no moment where the
 * client has applied an action but does not yet know what the proposal now looks like.
 *
 * @param {string} proposalId
 * @param {{action_type: string, reason?: string, selection?: string[], snooze_until?: string|null,
 *          idempotency_key: string, expected_updated_at?: string}} payload
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<object>} the validated, updated Decision Object.
 */
export async function runProposalAction(proposalId, payload, { signal } = {}) {
  const idempotencyKey = payload?.idempotency_key
  if (!idempotencyKey) {
    // Refused client-side as well as server-side. A POST that can be retried without a key is how
    // one lost response becomes two approvals.
    throw new ActionStoriesError('runProposalAction requires an idempotency_key', {
      code: ERROR_CODES.CLIENT_ERROR,
      userMessage: 'This action could not be sent. Please try again.',
      retryable: false,
    })
  }

  let body
  try {
    if (USE_MOCK_TRANSPORT) {
      const { mockRunProposalAction } = await loadMockTransport()
      body = await mockRunProposalAction(proposalId, payload, { signal, idempotencyKey })
    } else {
      body = (
        await httpClient.post(
          `${API_BASE_URL}/v1/proposals/${encodeURIComponent(proposalId)}/actions`,
          payload,
          { signal, idempotencyKey },
        )
      ).data
    }
  } catch (err) {
    throw normalise(err, `Failed to run "${payload?.action_type}" on "${proposalId}"`)
  }

  const problems = validateDecisionObject(body)
  if (problems.length > 0) throw malformed(problems, `Action response for "${proposalId}"`)
  return body
}

/**
 * A fresh idempotency key. `crypto.randomUUID` is available in every browser this app targets and
 * in Node 19+; the fallback exists only for older test environments.
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
