// HTTP tests for the standalone mock API.
//
// These drive a REAL server over a REAL socket — `http.createServer` bound to port 0, `fetch`
// against the port the OS hands back. Nothing here talks to Render, to any deployed URL, or to the
// network beyond loopback: the suite must stay runnable offline and in CI, and a test that depends
// on a live deployment tests the deployment, not the code.
//
// Each test gets its OWN server and store, so mutating tests cannot leak into each other and the
// order they run in does not matter.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'

import { createRequestHandler } from './app.js'
import { createStore } from './store.js'
import { loadSeed } from './seed.js'
import { validateDecisionObject, validateDecisionObjectSummary } from '../src/features/action-stories/contract/decisionObject.js'

const seed = loadSeed()

let server
let baseUrl
let store

beforeEach(async () => {
  store = createStore(seed)
  server = http.createServer(createRequestHandler({ store }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
})

/** @returns {Promise<{status: number, body: any, headers: Headers}>} */
async function call(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text === '' ? null : JSON.parse(text),
  }
}

const post = (path, body, headers = {}) =>
  call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

/** A proposal that can actually be approved — decide/execute stages with approve allowed. */
function approvableId() {
  const found = seed.find((d) => d.eligibility?.approve?.allowed === true)
  expect(found, 'the corpus has no approvable proposal').toBeTruthy()
  return found.proposal_id
}

// ---- seed ----------------------------------------------------------------------------------------

describe('seed', () => {
  it('loads all 105 normalized Decision Objects from the corpus directory', () => {
    expect(seed).toHaveLength(105)
    expect(new Set(seed.map((d) => d.proposal_id)).size).toBe(105)
  })

  it('serves contract-valid objects — the boot-time validation is real', () => {
    const invalid = seed.map((d) => ({ id: d.proposal_id, problems: validateDecisionObject(d) })).filter((r) => r.problems.length)
    expect(invalid).toEqual([])
  })

  it('rejects a missing seed directory rather than starting empty', () => {
    expect(() => loadSeed('/nonexistent/seed/dir')).toThrow(/seed directory not found/)
  })
})

// ---- GET /health ---------------------------------------------------------------------------------

describe('GET /health', () => {
  it('reports ok and how many proposals are loaded', async () => {
    const { status, body } = await call('/health')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.proposals).toBe(105)
  })
})

// ---- GET /v1/proposals ---------------------------------------------------------------------------

describe('GET /v1/proposals', () => {
  it('returns a page of summaries that pass the contract validator', async () => {
    const { status, body } = await call('/v1/proposals')
    expect(status).toBe(200)
    expect(body.items).toHaveLength(25) // the contract's default limit
    const problems = body.items.flatMap((item, i) => validateDecisionObjectSummary(item).map((p) => `items[${i}]: ${p}`))
    expect(problems).toEqual([])
  })

  it('returns summaries, not whole Decision Objects', async () => {
    const { body } = await call('/v1/proposals?limit=1')
    // The queue row must not carry the payload — that is the point of having two endpoints.
    expect(body.items[0]).not.toHaveProperty('proposal')
    expect(body.items[0]).not.toHaveProperty('eligibility')
  })

  it('filters by stage, persona and story_code', async () => {
    const byStage = await call('/v1/proposals?stage=decide&limit=200')
    expect(byStage.body.items).toHaveLength(26)
    expect(byStage.body.items.every((i) => i.stage === 'decide')).toBe(true)

    const byStory = await call('/v1/proposals?story_code=S9.1&limit=200')
    expect(byStory.body.items.map((i) => i.proposal_id).sort()).toEqual([
      'prop_s9_1_analyze',
      'prop_s9_1_decide',
      'prop_s9_1_execute',
      'prop_s9_1_reason',
    ])

    const byPersona = await call('/v1/proposals?persona=arbiter&limit=200')
    expect(byPersona.body.items.length).toBeGreaterThan(0)
  })

  it('pages with a cursor, covering the whole corpus without repeats', async () => {
    const seen = []
    let cursor = null
    for (let i = 0; i < 20; i++) {
      const query = `limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const { body } = await call(`/v1/proposals?${query}`)
      seen.push(...body.items.map((it) => it.proposal_id))
      cursor = body.next_cursor
      if (!cursor) break
    }
    expect(seen).toHaveLength(105)
    expect(new Set(seen).size).toBe(105)
  })

  it('refuses a nonsensical limit rather than guessing one', async () => {
    expect((await call('/v1/proposals?limit=0')).status).toBe(422)
    expect((await call('/v1/proposals?limit=abc')).status).toBe(422)
  })
})

// ---- GET /v1/proposals/:proposal_id ----------------------------------------------------------------

describe('GET /v1/proposals/:proposal_id', () => {
  it('serves every one of the 105 ids through the ONE dynamic route', async () => {
    const failures = []
    for (const decision of seed) {
      const { status, body } = await call(`/v1/proposals/${encodeURIComponent(decision.proposal_id)}`)
      if (status !== 200) failures.push(`${decision.proposal_id}: HTTP ${status}`)
      else {
        const problems = validateDecisionObject(body)
        if (problems.length) failures.push(`${decision.proposal_id}: ${problems[0]}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('preserves the Decision Object shape byte for byte', async () => {
    const expected = seed.find((d) => d.proposal_id === 'prop_s9_1_decide')
    const { body } = await call('/v1/proposals/prop_s9_1_decide')
    expect(body).toEqual(expected)
  })

  it('404s an unknown id', async () => {
    const { status, body } = await call('/v1/proposals/prop_does_not_exist')
    expect(status).toBe(404)
    expect(body.error.message).toMatch(/No proposal/)
  })
})

// ---- POST /v1/proposals/:proposal_id/actions -------------------------------------------------------

describe('POST /v1/proposals/:proposal_id/actions', () => {
  it('approves, returning the UPDATED Decision Object rather than an ack', async () => {
    const id = approvableId()
    const before = (await call(`/v1/proposals/${id}`)).body

    const { status, body } = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-approve-1' })

    expect(status).toBe(200)
    expect(validateDecisionObject(body)).toEqual([])
    expect(body.status).toBe('approved')
    expect(Date.parse(body.updated_at)).toBeGreaterThan(Date.parse(before.updated_at))
    // Every action is denied afterwards, so the action bar renders straight off the response.
    expect(Object.values(body.eligibility).every((e) => e.allowed === false)).toBe(true)
  })

  it('persists the mutation — a subsequent GET returns the new state', async () => {
    const id = approvableId()
    await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-persist' })
    const { body } = await call(`/v1/proposals/${id}`)
    expect(body.status).toBe('approved')
  })

  it('is idempotent — a replayed key returns the original result without re-running the action', async () => {
    const id = approvableId()
    const first = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-replay' })
    const second = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-replay' })

    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    // Without the ledger the second call would fail the pending->approved transition check; that it
    // succeeds AND matches byte for byte is what proves the replay short-circuited.
    expect(second.body.updated_at).toBe(first.body.updated_at)
  })

  it('409s a key reused for a different request', async () => {
    const id = approvableId()
    await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-crossed' })
    const { status } = await post(
      `/v1/proposals/${id}/actions`,
      { action_type: 'dismiss', reason: 'a different action entirely' },
      { 'Idempotency-Key': 'k-crossed' },
    )
    expect(status).toBe(409)
  })

  it('422s a request with no idempotency key at all', async () => {
    const id = approvableId()
    const { status, body } = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' })
    expect(status).toBe(422)
    expect(body.error.message).toMatch(/idempotency_key is required/)
  })

  it('accepts the key in the body as well as the header, for curl', async () => {
    const id = approvableId()
    const { status } = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve', idempotency_key: 'k-body' })
    expect(status).toBe(200)
  })

  it('409s a stale expected_updated_at (optimistic concurrency)', async () => {
    const id = approvableId()
    const { status, body } = await post(
      `/v1/proposals/${id}/actions`,
      { action_type: 'approve', expected_updated_at: '2000-01-01T00:00:00.000Z' },
      { 'Idempotency-Key': 'k-stale' },
    )
    expect(status).toBe(409)
    expect(body.error.message).toMatch(/changed since it was read/)
  })

  it('accepts a matching expected_updated_at', async () => {
    const id = approvableId()
    const current = (await call(`/v1/proposals/${id}`)).body
    const { status } = await post(
      `/v1/proposals/${id}/actions`,
      { action_type: 'approve', expected_updated_at: current.updated_at },
      { 'Idempotency-Key': 'k-fresh' },
    )
    expect(status).toBe(200)
  })

  it('403s an action on a locked proposal, whatever its eligibility says', async () => {
    // The corpus carries no locked record (every reference screen shows its full content), so the
    // entitlement gate is exercised by placing one directly in this test's own store.
    const locked = { ...structuredClone(seed[0]), proposal_id: 'prop_locked_probe', entitlement: 'locked' }
    store.proposals.set(locked.proposal_id, locked)

    const { status, body } = await post(
      '/v1/proposals/prop_locked_probe/actions',
      { action_type: 'dismiss', reason: 'should never get through' },
      { 'Idempotency-Key': 'k-locked' },
    )
    expect(status).toBe(403)
    expect(body.error.message).toMatch(/entitlement/)
  })

  it('422s an action the proposal is not eligible for', async () => {
    // `approve` on a reason-stage proposal: eligibility says no, and the server re-derives it rather
    // than trusting the caller.
    const reasonStage = seed.find((d) => d.stage === 'reason')
    const { status, body } = await post(
      `/v1/proposals/${reasonStage.proposal_id}/actions`,
      { action_type: 'approve' },
      { 'Idempotency-Key': 'k-ineligible' },
    )
    expect(status).toBe(422)
    expect(body.error.message).toMatch(/rejected/)
  })

  it('422s an unknown action_type', async () => {
    const id = approvableId()
    const { status } = await post(`/v1/proposals/${id}/actions`, { action_type: 'detonate' }, { 'Idempotency-Key': 'k-unknown' })
    expect(status).toBe(422)
  })

  it('refuses a second approve — under a NEW key, so the ledger cannot mask it', async () => {
    const id = approvableId()
    await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-first' })
    const { status, body } = await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-second' })

    // 422, not 409: the approve left every action denied, so the ELIGIBILITY gate catches this one
    // first. That ordering is the contract's (eligibility before transition), and the status code
    // matches what the in-process double returns for the same request.
    expect(status).toBe(422)
    expect(body.error.message).toMatch(/rejected/)
  })

  it('refuses an illegal status transition even when eligibility still claims the action', async () => {
    // A stored object that is already terminal but still advertises `approve.allowed` — a stale
    // payload, or a bug upstream. It must not resurrect an approved proposal.
    //
    // The refusal arrives as 422, not 409, and that is worth pinning: `checkOperatorAction` runs
    // `isLegalTransition` as its OWN fail-closed rule before it ever consults the eligibility map
    // (contract/actionTypes.js), so the eligibility gate always catches this first. The explicit
    // transition check in `authorizeOperatorAction` sits behind it as redundant defence in depth.
    const inconsistent = structuredClone(seed.find((d) => d.eligibility.approve.allowed === true))
    inconsistent.proposal_id = 'prop_inconsistent_probe'
    inconsistent.status = 'approved'
    store.proposals.set(inconsistent.proposal_id, inconsistent)

    const { status, body } = await post(
      '/v1/proposals/prop_inconsistent_probe/actions',
      { action_type: 'approve' },
      { 'Idempotency-Key': 'k-illegal-transition' },
    )
    expect(status).toBe(422)
    expect(body.error.message).toMatch(/is approved and can no longer be changed/)
  })

  it('404s an action on an unknown proposal', async () => {
    const { status } = await post('/v1/proposals/prop_nope/actions', { action_type: 'approve' }, { 'Idempotency-Key': 'k-404' })
    expect(status).toBe(404)
  })

  it('records the operator note on send_back, and blocks a second one', async () => {
    const decidable = seed.find((d) => d.eligibility?.send_back?.allowed === true)
    const { status, body } = await post(
      `/v1/proposals/${decidable.proposal_id}/actions`,
      { action_type: 'send_back', reason: 'The exit set needs splitting across two quarters.' },
      { 'Idempotency-Key': 'k-sendback' },
    )
    expect(status).toBe(200)
    expect(body.proposal.send_back_note).toBe('The exit set needs splitting across two quarters.')
    expect(body.eligibility.send_back.allowed).toBe(false)
  })

  it('moves the chosen rows off the slate on approve_selected', async () => {
    const withSlate = seed.find(
      (d) => d.eligibility?.approve_selected?.allowed === true && Array.isArray(d.proposal?.slate) && d.proposal.slate.length > 1,
    )
    expect(withSlate, 'the corpus has no approvable multi-item slate').toBeTruthy()

    const before = withSlate.proposal.slate.length
    const { slateItemId } = await import('../src/features/action-stories/contract/slateItem.js')
    const chosen = slateItemId(withSlate.proposal.slate, 0)

    const { status, body } = await post(
      `/v1/proposals/${withSlate.proposal_id}/actions`,
      { action_type: 'approve_selected', selection: [chosen] },
      { 'Idempotency-Key': 'k-partial' },
    )
    expect(status).toBe(200)
    expect(body.proposal.approved_items).toHaveLength(1)
    expect(body.proposal.slate).toHaveLength(before - 1)
  })

  it('422s a malformed JSON body instead of crashing', async () => {
    const response = await fetch(`${baseUrl}/v1/proposals/prop_s9_1_decide/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'k-bad-json' },
      body: '{not json',
    })
    expect(response.status).toBe(422)
  })
})

// ---- CORS and routing ------------------------------------------------------------------------------

describe('CORS and routing', () => {
  it('answers the preflight and allows the Idempotency-Key request header', async () => {
    const response = await fetch(`${baseUrl}/v1/proposals/prop_s9_1_decide/actions`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    // Without this the browser rejects every action the UI sends.
    expect(response.headers.get('access-control-allow-headers')).toMatch(/Idempotency-Key/i)
  })

  it('sets CORS headers on real responses too, not only on the preflight', async () => {
    const { headers } = await call('/v1/proposals?limit=1')
    expect(headers.get('access-control-allow-origin')).toBe('*')
  })

  it('404s an unknown route with JSON, never HTML', async () => {
    const { status, body, headers } = await call('/v1/nope')
    expect(status).toBe(404)
    expect(headers.get('content-type')).toMatch(/application\/json/)
    expect(body.error.status).toBe(404)
  })

  it('404s a method the route does not serve', async () => {
    expect((await post('/v1/proposals', {}, { 'Idempotency-Key': 'k-wrong-method' })).status).toBe(404)
  })
})

// ---- state isolation -------------------------------------------------------------------------------

describe('state', () => {
  it('starts each process from the canonical seed — a fresh store is unmutated', async () => {
    const id = approvableId()
    await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-isolate' })
    expect((await call(`/v1/proposals/${id}`)).body.status).toBe('approved')

    // A new store is what a restart produces.
    const fresh = createStore(seed)
    expect(fresh.proposals.get(id).status).toBe('pending')
    expect(fresh.idempotencyLedger.size).toBe(0)
  })

  it('never lets a mutation write back through to the parsed seed', async () => {
    const id = approvableId()
    await post(`/v1/proposals/${id}/actions`, { action_type: 'approve' }, { 'Idempotency-Key': 'k-noleak' })
    expect(seed.find((d) => d.proposal_id === id).status).toBe('pending')
  })
})
