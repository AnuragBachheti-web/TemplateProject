// The HTTP layer: four routes over `node:http`, and nothing underneath them but two Maps.
//
// WHY NO FRAMEWORK. Four routes, one dynamic segment, JSON in and out, and CORS. Express would add
// a dependency, a middleware stack and a version to keep current in exchange for about forty lines
// this file already has. The brief asked for no unnecessary infrastructure, and a framework for
// four routes is the smallest version of that mistake.
//
// WHAT THIS SERVER IS. A transport in front of contract/operatorActionExecution.js. Every rule it
// enforces — entitlement, optimistic concurrency, eligibility, legal status transitions, what an
// action does to a Decision Object — is imported from there, the same module the in-process test
// double (src/services/mockDecisionApi.js) imports. Only idempotency and storage are owned here,
// because those are the two things that genuinely differ between an in-memory double and a server.
//
// WHAT IT IS NOT. A backend. There is no authentication, no database, no multi-tenancy, and the
// caller's identity is not resolved from anything. A real service re-implements the same contract
// in its own stack; this one exists so the frontend can be developed against real HTTP today.

import { createStore } from './store.js'
import {
  authorizeOperatorAction,
  applyOperatorAction,
  pageProposals,
} from '../src/features/action-stories/contract/operatorActionExecution.js'

/** A request body larger than this is refused unread — no route here has a legitimate use for one. */
const MAX_BODY_BYTES = 1_000_000

/**
 * CORS. Wide open on purpose: this serves a fixed, public, synthetic corpus with no credentials and
 * no user data, and the frontend will be hosted on a different origin (a Render static site, a
 * preview URL, or localhost). `Idempotency-Key` MUST be in the allowed request headers or the
 * browser's preflight rejects every POST the action bar makes.
 *
 * A real backend replaces this with an origin allow-list and credentialed CORS.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
  'Access-Control-Max-Age': '86400',
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
  })
  res.end(payload)
}

/**
 * The error envelope. The frontend's httpClient classifies on STATUS, not on this body, so the body
 * exists for operators reading logs and curl output — but the status codes are contract, and they
 * match the in-process double's exactly (403/404/409/422).
 */
function sendError(res, status, message) {
  send(res, status, { error: { status, message } })
}

/** Reads a JSON request body. Resolves `{}` for an empty body; rejects on oversize or bad JSON. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw === '') return resolve({})
      try {
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(Object.assign(new Error('Request body must be a JSON object'), { status: 422 }))
        }
        resolve(parsed)
      } catch {
        reject(Object.assign(new Error('Request body is not valid JSON'), { status: 422 }))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Builds the request handler. Takes its store as an argument so a test can hand in a store built
 * from a fixture corpus, and so each test file gets an isolated one.
 *
 * @param {object} [options]
 * @param {ReturnType<typeof createStore>} [options.store]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRequestHandler({ store = createStore() } = {}) {
  return async function handle(req, res) {
    try {
      // Preflight. Answered before routing: the browser sends OPTIONS to paths it is about to POST
      // to, and a 404 here would fail every action in the UI.
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      const url = new URL(req.url, 'http://localhost')
      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

      // GET /health
      if (req.method === 'GET' && segments.length === 1 && segments[0] === 'health') {
        return send(res, 200, {
          status: 'ok',
          service: 'action-stories-mock-api',
          proposals: store.proposals.size,
          uptime_seconds: Math.round(process.uptime()),
        })
      }

      if (segments[0] === 'v1' && segments[1] === 'proposals') {
        // GET /v1/proposals
        if (req.method === 'GET' && segments.length === 2) {
          const limit = Number(url.searchParams.get('limit') ?? 25)
          if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
            return sendError(res, 422, '"limit" must be a number between 1 and 500')
          }
          return send(
            res,
            200,
            pageProposals([...store.proposals.values()], {
              stage: url.searchParams.get('stage') ?? undefined,
              persona: url.searchParams.get('persona') ?? undefined,
              storyCode: url.searchParams.get('story_code') ?? undefined,
              limit,
              cursor: url.searchParams.get('cursor') ?? undefined,
            }),
          )
        }

        // ONE dynamic route serves all 105 proposal ids — there is no per-id route anywhere.
        const proposalId = segments[2]

        // GET /v1/proposals/:proposal_id
        if (req.method === 'GET' && segments.length === 3) {
          const found = store.proposals.get(proposalId)
          if (!found) return sendError(res, 404, `No proposal "${proposalId}"`)
          return send(res, 200, found)
        }

        // POST /v1/proposals/:proposal_id/actions
        if (req.method === 'POST' && segments.length === 4 && segments[3] === 'actions') {
          const body = await readJsonBody(req)
          return runAction(res, store, proposalId, body, req.headers['idempotency-key'])
        }
      }

      sendError(res, 404, `No route for ${req.method} ${url.pathname}`)
    } catch (err) {
      if (err?.status) return sendError(res, err.status, err.message)
      // An unexpected throw is this server's bug, not the caller's. Log it and say so honestly.
      console.error('[mock-server] unhandled error:', err)
      sendError(res, 500, 'Internal server error')
    }
  }
}

/**
 * POST /v1/proposals/:proposal_id/actions
 *
 * Mirrors mockDecisionApi.mockRunProposalAction step for step, including the order of checks — the
 * two call the same `authorizeOperatorAction`/`applyOperatorAction`, so only idempotency and
 * storage are written out here.
 */
function runAction(res, store, proposalId, body, headerKey) {
  const {
    action_type: actionType,
    reason,
    reason_code: reasonCode,
    selection,
    snooze_until: snoozeUntil,
    expected_updated_at: expectedUpdatedAt,
  } = body

  // The key travels in the `Idempotency-Key` header (what services/httpClient.js sends); the body
  // field is accepted as a fallback so the endpoint is usable from curl without a custom header.
  const idempotencyKey = headerKey ?? body.idempotency_key

  // 1. Idempotency. Checked before anything else: a replayed request must return the ORIGINAL
  //    result without re-running the action, which is the entire point of the key.
  if (!idempotencyKey) {
    return sendError(res, 422, 'idempotency_key is required')
  }
  const replayed = store.idempotencyLedger.get(idempotencyKey)
  if (replayed) {
    if (replayed.proposalId !== proposalId || replayed.actionType !== actionType) {
      // Same key, different request — the client has a bug, and honouring it would let one key
      // authorise an unrelated mutation.
      return sendError(res, 409, 'Idempotency key reused for a different request')
    }
    return send(res, 200, replayed.result)
  }

  // 2. Existence.
  const proposal = store.proposals.get(proposalId)
  if (!proposal) {
    return sendError(res, 404, `No proposal "${proposalId}"`)
  }

  // 3-6. Entitlement, action validity, optimistic concurrency, business eligibility and the legal
  //      status transition — all from the shared contract module.
  const verdict = authorizeOperatorAction(proposal, actionType, { reason, reasonCode, selection, snoozeUntil, expectedUpdatedAt })
  if (!verdict.ok) {
    return sendError(res, verdict.status, verdict.message)
  }

  const updated = applyOperatorAction(proposal, actionType, { reason, reasonCode, selection, snoozeUntil, nextStatus: verdict.nextStatus })
  store.proposals.set(proposalId, updated)
  store.idempotencyLedger.set(idempotencyKey, { proposalId, actionType, result: updated })

  // The UPDATED Decision Object, never an ack — the client then has no stale-read window and no
  // reason to optimistically patch anything.
  return send(res, 200, updated)
}
