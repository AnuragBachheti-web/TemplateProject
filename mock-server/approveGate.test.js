// Phase 1, T6: the SERVER gate is authoritative (I4).
//
// Every test here reaches the server handler with the client gate absent, not merely bypassed:
// a real socket, a real `fetch`, a hand-built request body. Nothing in `src/store`, `src/services`
// or any component participates. If the only thing stopping the T1 payload were the browser-side
// check, every test in this file would fail — which is exactly what it is for.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'

import { createRequestHandler } from './app.js'
import { createStore } from './store.js'
import { authorizeOperatorAction } from '../src/features/action-stories/contract/operatorActionExecution.js'
import { deriveApproveEligibility } from '../src/features/action-stories/contract/deriveEligibility.js'
import { validateDecisionObject } from '../src/features/action-stories/contract/decisionObject.js'
import { loadSeed } from './seed.js'

const seed = loadSeed()

/** The latent-bug payload, built from a real seeded object. Guardrail blocks; eligibility allows. */
function t1Payload(overrides = {}) {
  const base = structuredClone(seed.find((d) => d.proposal_id === 'prop_s9_1_decide'))
  return {
    ...base,
    proposal_id: 'prop_t1_latent',
    guardrails: { ...base.guardrails, verdict: 'beyond_limits' },
    eligibility: { ...base.eligibility, approve: { allowed: true } },
    ...overrides,
  }
}

let server
let baseUrl
let store

beforeEach(async () => {
  // A store holding ONLY the dangerous payload, so nothing else can satisfy the request.
  store = createStore([t1Payload()])
  server = http.createServer(createRequestHandler({ store }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
})

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

describe('T6 — the server rejects the T1 payload with the client gate out of the picture', () => {
  it('the payload really is contract-valid, so the rejection is about the guardrail, not the shape', () => {
    // If this object were malformed the 422 below would prove nothing.
    expect(validateDecisionObject(t1Payload())).toEqual([])
    expect(t1Payload().eligibility.approve.allowed, 'the payload must claim approval is allowed').toBe(true)
    expect(t1Payload().guardrails.verdict).toBe('beyond_limits')
  })

  it('POST /v1/proposals/:id/actions with action_type=approve returns 422', async () => {
    const { status, body } = await post('/v1/proposals/prop_t1_latent/actions', {
      action_type: 'approve',
      idempotency_key: 'key-t6-1',
    })

    expect(status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/approve/i)
  })

  it('leaves the stored proposal untouched — nothing was approved', async () => {
    await post('/v1/proposals/prop_t1_latent/actions', {
      action_type: 'approve',
      idempotency_key: 'key-t6-2',
    })

    expect(store.proposals.get('prop_t1_latent').status).toBe('pending')
  })

  it('rejects even when the caller forges a fresh idempotency key each time', async () => {
    for (const key of ['forge-1', 'forge-2', 'forge-3']) {
      const { status } = await post('/v1/proposals/prop_t1_latent/actions', { action_type: 'approve', idempotency_key: key })
      expect(status).toBe(422)
    }
    expect(store.proposals.get('prop_t1_latent').status).toBe('pending')
  })

  it('rejects when the caller supplies the matching expected_updated_at, so 409 cannot mask it', async () => {
    // A 409 would mean "stale read", which a caller can fix by refreshing. This must be a 422:
    // the action is not eligible, and refreshing will not change that.
    const { status } = await post('/v1/proposals/prop_t1_latent/actions', {
      action_type: 'approve',
      idempotency_key: 'key-t6-3',
      expected_updated_at: t1Payload().updated_at,
    })
    expect(status).toBe(422)
  })

  it('the shared server gate denies it directly, with no transport involved at all', () => {
    const verdict = authorizeOperatorAction(t1Payload(), 'approve', {})
    expect(verdict.ok).toBe(false)
    expect(verdict.status).toBe(422)
    expect(verdict.userMessage.trim()).not.toBe('')
  })

  it('the server gate reaches its answer through the single producer', () => {
    // I1 at the server: the gate must not restate the rule, it must consult the one function.
    const payload = t1Payload()
    expect(authorizeOperatorAction(payload, 'approve', {}).userMessage).toBe(deriveApproveEligibility(payload).reason)
  })

  it('still approves the same proposal once its verdict is within limits', async () => {
    // Proof the 422 tracks the guardrail rather than something incidental about the fixture.
    store.proposals.set('prop_t1_latent', t1Payload({ guardrails: { verdict: 'within_limits' } }))
    const { status } = await post('/v1/proposals/prop_t1_latent/actions', {
      action_type: 'approve',
      idempotency_key: 'key-t6-4',
    })
    expect(status).toBe(200)
    expect(store.proposals.get('prop_t1_latent').status).toBe('approved')
  })

  it('re-derives approve eligibility on the object it returns, rather than hand-writing it', async () => {
    // Ruling (b): applyOperatorAction's denyAll must produce the approve entry from the producer.
    store.proposals.set('prop_t1_latent', t1Payload({ guardrails: { verdict: 'within_limits' } }))
    const { body } = await post('/v1/proposals/prop_t1_latent/actions', {
      action_type: 'approve',
      idempotency_key: 'key-t6-5',
    })

    expect(body.status).toBe('approved')
    expect(body.eligibility.approve.allowed).toBe(false)
    expect(body.eligibility.approve.allowed).toBe(deriveApproveEligibility(body).allowed)
    expect(body.eligibility.approve.blocked_reason).toBe(deriveApproveEligibility(body).reason)
    // And the object it hands back is still contract-valid, so decisionObject.js:218-228 stays happy.
    expect(validateDecisionObject(body)).toEqual([])
  })
})
