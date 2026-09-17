// Phase 1, T5 and T7: the CLIENT-side consumers of the single producer.
//
// T5 proves the client gate rejects the latent-bug payload. It is deliberately NOT the security
// boundary (I4) — mock-server/approveGate.test.js proves the server rejects the same payload with
// the client removed from the picture entirely.
//
// T7 proves I5's logging contract: when the payload's own `eligibility.approve.allowed` disagrees
// with the derived value, the derived value wins, a contract-violation warning is emitted ONCE per
// gate call naming the module, the proposal and both values, and nothing throws.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { checkOperatorAction } from './actionTypes'
import { deriveApproveEligibility } from './deriveEligibility'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { dispatchAction } from '@/services/actionStoriesMutations'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

/**
 * THE T1 PAYLOAD, built from a real shipped object so nothing about it is synthetic except the one
 * combination that makes it dangerous: guardrails say beyond_limits, eligibility says allowed.
 * No shipped fixture carries this pair today; a live API can produce it tomorrow.
 */
function t1Payload(overrides = {}) {
  const base = structuredClone(dataset.find((d) => d.proposal_id === 'prop_s9_1_decide'))
  return {
    ...base,
    proposal_id: 'prop_t1_latent',
    guardrails: { ...base.guardrails, verdict: 'beyond_limits' },
    eligibility: { ...base.eligibility, approve: { allowed: true } },
    ...overrides,
  }
}

let warnSpy

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('T5 — the client gate rejects the T1 payload', () => {
  it('checkOperatorAction denies approve', () => {
    const verdict = checkOperatorAction('approve', t1Payload())
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason.trim()).not.toBe('')
  })

  it('agrees with the single producer rather than with the payload', () => {
    // The point of I1: the gate must not have its own opinion. Whatever derive says, the gate says.
    const payload = t1Payload()
    expect(checkOperatorAction('approve', payload).reason).toBe(deriveApproveEligibility(payload).reason)
  })

  it('the store dispatch boundary refuses without a network call', async () => {
    const payload = t1Payload()
    useActionStoriesStore.getState().setDecision(payload)

    const result = await useActionStoriesStore.getState().runAction('approve')

    expect(result).toBeUndefined()
    const error = useActionStoriesStore.getState().getActionError('approve')
    expect(error).toBeTruthy()
    expect(error.code).toBe('CLIENT_ERROR')
    // The proposal is untouched: no request went out, so nothing came back to replace it.
    expect(useActionStoriesStore.getState().decision.status).toBe('pending')
  })

  it('the mutations layer refuses even when called directly, bypassing the store', async () => {
    const payload = t1Payload()
    await expect(
      dispatchAction({ proposalId: payload.proposal_id, decision: payload, actionType: 'approve' }),
    ).rejects.toMatchObject({ code: 'CLIENT_ERROR' })
  })

  it('still allows approve on the same object once the verdict is within limits', () => {
    // The gate must be a gate, not a wall: flip only the verdict and approval comes back.
    const clear = t1Payload({ guardrails: { verdict: 'within_limits' } })
    expect(checkOperatorAction('approve', clear).allowed).toBe(true)
  })
})

describe('T7 — exactly one contract-violation warning per gate call', () => {
  it('logs once, naming the module, the proposal and BOTH values', () => {
    checkOperatorAction('approve', t1Payload())

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const logged = warnSpy.mock.calls[0].map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    expect(logged).toMatch(/contract violation/i)
    expect(logged, 'must name the module').toMatch(/actionTypes/)
    expect(logged, 'must name the proposal').toContain('prop_t1_latent')
    expect(logged, 'must record the payload value').toMatch(/payload[\s\S]*?true/i)
    expect(logged, 'must record the derived value').toMatch(/derived[\s\S]*?false/i)
  })

  it('never throws — it logs and proceeds with the safe value', () => {
    expect(() => checkOperatorAction('approve', t1Payload())).not.toThrow()
    expect(checkOperatorAction('approve', t1Payload()).allowed).toBe(false)
  })

  it('stays silent when the payload agrees with the derived value', () => {
    // Every one of the 105 shipped objects is in this state (T10), so a warning here would mean the
    // console screams on every render of every proposal that is behaving correctly.
    for (const shipped of dataset) checkOperatorAction('approve', shipped)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('also warns on the opposite disagreement — payload blocks, derivation allows', () => {
    // I5 is symmetric: any disagreement is a contract violation, not just the dangerous direction.
    const base = structuredClone(dataset.find((d) => d.proposal_id === 'prop_s9_1_decide'))
    const inverted = { ...base, proposal_id: 'prop_t7_inverted', eligibility: { ...base.eligibility, approve: { allowed: false, blocked_reason: 'stale' } } }
    const verdict = checkOperatorAction('approve', inverted)

    expect(verdict.allowed, 'the derived value wins').toBe(true)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('does not warn for the other five operator actions, which Phase 1 does not derive', () => {
    __seedProposal(t1Payload())
    for (const id of ['approve_selected', 'modify', 'send_back', 'dismiss', 'snooze']) {
      checkOperatorAction(id, t1Payload(), { reason: 'a sufficiently long reason' })
    }
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
