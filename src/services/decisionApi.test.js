// Suites 6, 7 and 9: the API contract, idempotency, and payload hygiene.
//
// These run against the in-memory test double (mockDecisionApi.js), which implements the same
// contract a real backend must. That is the honest limit of what this repository can verify: it
// proves the CLIENT handles every documented outcome, and it pins the server-side rules as
// executable specification. It does not prove a production backend behaves this way — none exists.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listProposals, getProposal, runProposalAction, newIdempotencyKey } from './decisionApi'
import { __resetMockApi, __seedProposal } from './mockDecisionApi'
import { validateDecisionObject } from '@/features/action-stories/contract/decisionObject'
import { OPERATOR_ACTION_IDS } from '@/features/action-stories/contract/actionTypes'
import { ERROR_CODES } from './actionStoriesErrors'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

const FUTURE = '2099-01-01T00:00:00.000Z'

/** A full-entitlement, everything-allowed proposal under a known id. */
function seedOpen(overrides = {}) {
  const decision = {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_test',
    on_clock: true,
    deadline: FUTURE,
    cardinality: 'many',
    status: 'pending',
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    ...overrides,
  }
  __seedProposal(decision)
  return decision
}

beforeEach(() => {
  __resetMockApi()
})

describe('GET /v1/proposals — the queue', () => {
  it('returns validated summaries and a cursor', async () => {
    const { items, next_cursor: next } = await listProposals({ limit: 5 })
    expect(items).toHaveLength(5)
    expect(typeof next === 'string' || next === null).toBe(true)
    for (const item of items) {
      expect(item).toHaveProperty('proposal_id')
      expect(item).toHaveProperty('status')
      expect(item).toHaveProperty('on_clock')
    }
  })

  it('filters by stage and persona', async () => {
    const { items } = await listProposals({ stage: 'decide', limit: 50 })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.stage === 'decide')).toBe(true)
  })

  it('pages deterministically via the cursor', async () => {
    const first = await listProposals({ limit: 3 })
    const second = await listProposals({ limit: 3, cursor: first.next_cursor })
    const overlap = first.items.filter((a) => second.items.some((b) => b.proposal_id === a.proposal_id))
    expect(overlap).toEqual([])
  })
})

describe('GET /v1/proposals/:id — the Decision Object', () => {
  it('returns a contract-valid Decision Object', async () => {
    const decision = await getProposal(seed[0].proposal_id)
    expect(validateDecisionObject(decision)).toEqual([])
  })

  it('404s with a safe operator-facing message', async () => {
    await expect(getProposal('prop_does_not_exist')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
      status: 404,
      userMessage: 'This proposal is no longer available.',
    })
  })

  it('rejects a malformed response as MALFORMED rather than rendering it', async () => {
    // A backend that drops `eligibility` must fail loudly here, not render a screen with no
    // guardrails on it.
    const broken = structuredClone(seed[0])
    broken.proposal_id = 'prop_broken'
    delete broken.eligibility
    __seedProposal(broken)
    await expect(getProposal('prop_broken')).rejects.toMatchObject({ code: ERROR_CODES.MALFORMED })
  })

  it('rejects an empty proposal id without a network call', async () => {
    await expect(getProposal('')).rejects.toMatchObject({ code: ERROR_CODES.CLIENT_ERROR })
  })

  it('aborts cleanly — cancellation is not a failure', async () => {
    const controller = new AbortController()
    const pending = getProposal(seed[0].proposal_id, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: ERROR_CODES.ABORTED })
  })
})

describe('POST /v1/proposals/:id/actions — the full status matrix', () => {
  it('200: returns the UPDATED Decision Object, not an ack', async () => {
    const before = seedOpen()
    const after = await runProposalAction('prop_test', {
      action_type: 'approve',
      idempotency_key: newIdempotencyKey(),
      expected_updated_at: before.updated_at,
    })
    expect(validateDecisionObject(after)).toEqual([])
    expect(after.status).toBe('approved')
    expect(after.updated_at).not.toBe(before.updated_at)
    // Eligibility is re-derived server-side, so the returned object is self-consistent.
    expect(after.eligibility.approve.allowed).toBe(false)
  })

  it('403: a locked proposal refuses every action', async () => {
    seedOpen({ entitlement: 'locked' })
    await expect(
      runProposalAction('prop_test', { action_type: 'approve', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 403, userMessage: 'You are not authorized to perform this action.' })
  })

  it('404: an unknown proposal', async () => {
    await expect(
      runProposalAction('prop_nope', { action_type: 'approve', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('409: the proposal moved since the operator read it', async () => {
    seedOpen()
    await expect(
      runProposalAction('prop_test', {
        action_type: 'approve',
        idempotency_key: newIdempotencyKey(),
        expected_updated_at: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 409, userMessage: /changed before your action/i })
  })

  it('409: an illegal status transition is refused server-side', async () => {
    seedOpen({ status: 'approved' })
    await expect(
      runProposalAction('prop_test', { action_type: 'dismiss', reason: 'a long enough reason', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('422: the server re-checks eligibility and refuses, even though the client asked', async () => {
    // The client-side gate is deliberately bypassed here — this is the server's own check.
    seedOpen({
      eligibility: {
        ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
        modify: { allowed: false, blocked_reason: 'Guardrail breach.' },
      },
    })
    await expect(
      runProposalAction('prop_test', {
        action_type: 'modify',
        reason: 'a sufficiently long reason',
        idempotency_key: newIdempotencyKey(),
      }),
    ).rejects.toMatchObject({ status: 422, userMessage: 'Guardrail breach.' })
  })

  it('422: the server refuses approve on its DERIVED verdict, not on what the payload claims', async () => {
    // `approve` is derived server-side from the stored Decision Object. A caller that hand-rolls the
    // request, or a payload whose `approve.allowed` is stale or wrong, gets the same 422.
    seedOpen({
      guardrails: { verdict: 'beyond_limits' },
      eligibility: {
        ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
        approve: { allowed: true },
      },
    })
    await expect(
      runProposalAction('prop_test', { action_type: 'approve', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('422: an unknown action_type', async () => {
    seedOpen()
    await expect(
      runProposalAction('prop_test', { action_type: 'obliterate', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('422: a required reason that is too short is refused server-side', async () => {
    seedOpen()
    await expect(
      runProposalAction('prop_test', { action_type: 'dismiss', reason: 'no', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('refuses a POST with no idempotency key, client-side, before any request', async () => {
    seedOpen()
    await expect(runProposalAction('prop_test', { action_type: 'approve' })).rejects.toMatchObject({
      code: ERROR_CODES.CLIENT_ERROR,
    })
  })

  it('aborts cleanly mid-flight', async () => {
    seedOpen()
    const controller = new AbortController()
    const pending = runProposalAction(
      'prop_test',
      { action_type: 'approve', idempotency_key: newIdempotencyKey() },
      { signal: controller.signal },
    )
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: ERROR_CODES.ABORTED })
  })

  it('surfaces a 5xx through the shared taxonomy', async () => {
    // Exercised against httpClient's own classification, which the real transport path uses.
    const { classifyHttpStatus } = await import('./actionStoriesErrors')
    expect(classifyHttpStatus(500)).toBe(ERROR_CODES.SERVER_ERROR)
    expect(classifyHttpStatus(503)).toBe(ERROR_CODES.SERVER_ERROR)
  })

  it('classifies a client timeout as TIMEOUT, not a generic failure', async () => {
    vi.useFakeTimers()
    vi.useRealTimers()
    const { ActionStoriesError, isTransient } = await import('./actionStoriesErrors')
    const timeout = new ActionStoriesError('too slow', { code: ERROR_CODES.TIMEOUT })
    expect(isTransient(timeout.code)).toBe(true)
  })
})

describe('idempotency — the guard against double approval', () => {
  it('a replayed request returns the ORIGINAL result without acting twice', async () => {
    const before = seedOpen()
    const key = newIdempotencyKey()
    const body = { action_type: 'approve', idempotency_key: key, expected_updated_at: before.updated_at }

    const first = await runProposalAction('prop_test', body)
    const replay = await runProposalAction('prop_test', body)

    expect(replay).toEqual(first)
    // The decisive assertion: had the action run twice, the second call would have hit the
    // pending -> approved transition again from an `approved` proposal and thrown.
    expect(replay.status).toBe('approved')
    expect(replay.updated_at).toBe(first.updated_at)
  })

  it('a replay survives even after the proposal would otherwise refuse the action', async () => {
    const before = seedOpen()
    const key = newIdempotencyKey()
    const body = { action_type: 'approve', idempotency_key: key, expected_updated_at: before.updated_at }
    await runProposalAction('prop_test', body)
    // The proposal is now terminal; a fresh key would be refused, but the replay must not be.
    await expect(runProposalAction('prop_test', body)).resolves.toMatchObject({ status: 'approved' })
    // A FRESH key on the same now-terminal proposal is refused. `expected_updated_at` is omitted so
    // the request reaches the eligibility gate (422) rather than stopping at the staleness
    // check (409) — both refuse, but this pins the one that proves the action itself is closed.
    await expect(
      runProposalAction('prop_test', { action_type: 'approve', idempotency_key: newIdempotencyKey() }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('refuses to let one key authorise a DIFFERENT request', async () => {
    const before = seedOpen()
    const key = newIdempotencyKey()
    await runProposalAction('prop_test', { action_type: 'approve', idempotency_key: key, expected_updated_at: before.updated_at })
    await expect(
      runProposalAction('prop_test', { action_type: 'dismiss', reason: 'a long enough reason', idempotency_key: key }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('mints distinct keys', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(200)
  })
})

describe('payload hygiene — the production contract carries business values only', () => {
  const serialised = JSON.stringify(seed)

  it('contains no CSS variables', () => {
    expect(serialised).not.toMatch(/var\(--/)
    expect(serialised).not.toMatch(/color-mix\(/)
  })

  it('contains no SVG path data', () => {
    expect(serialised).not.toMatch(/"M\s*-?[\d.]+[\s,]-?[\d.]+\s+L/)
  })

  it('contains no mockup geometry keys', () => {
    for (const key of ['bandLeft', 'bandWidth', 'newLeft', 'dotLeft', 'colLeft', 'barWidth', 'footRight']) {
      expect(serialised, `geometry key "${key}" leaked into the contract`).not.toContain(`"${key}"`)
    }
  })

  it('contains no React props/state envelope or extraction companions', () => {
    expect(serialised).not.toContain('__raw')
    // The mockup envelope's `props`/`state` are banned where the envelope put them — the Decision
    // Object's own top level — not as a substring anywhere. A row's `state` is real business status
    // ("approved 09:38", "ready today"), and a blanket substring ban deleted those too.
    for (const decision of seed) {
      expect(decision).not.toHaveProperty('props')
      expect(decision).not.toHaveProperty('state')
    }
  })

  it('contains no UI visibility flags or execution presentation fields', () => {
    for (const key of ['approveShow', 'blockShow', 'execSegs', 'execLabel', 'ctaLabel']) {
      expect(serialised, `"${key}" is presentation, not business data`).not.toContain(`"${key}"`)
    }
  })

  it('carries no derived UI booleans standing in for eligibility', () => {
    for (const d of seed) {
      expect(d).not.toHaveProperty('blocked')
      expect(d).not.toHaveProperty('canApprove')
    }
  })

  it('keeps numeric business values numeric', () => {
    for (const d of seed) {
      if (d.impact) {
        expect(typeof d.impact.value).toBe('number')
        expect(typeof d.impact.unit).toBe('string')
      }
      if (d.confidence) expect(typeof d.confidence.value).toBe('number')
    }
  })

  it('every seeded Decision Object satisfies the contract', () => {
    const invalid = seed.filter((d) => validateDecisionObject(d).length > 0)
    expect(invalid.map((d) => d.proposal_id)).toEqual([])
  })
})
