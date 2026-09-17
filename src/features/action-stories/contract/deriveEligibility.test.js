// Phase 1, T1-T4 and T10: the ONE producer of approve eligibility.
//
// Every test here calls `deriveApproveEligibility` and nothing else. If a second module ever starts
// computing, defaulting or overriding approve eligibility, this file keeps passing and I1 is still
// broken — the invariant that catches that is T10 plus the gate tests in approveGate.test.js, which
// assert the CONSUMERS agree with this function rather than with the payload.

import { describe, it, expect } from 'vitest'

import { deriveApproveEligibility } from './deriveEligibility'
import { GUARDRAIL_VERDICTS } from './decisionObject'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

/**
 * A decide-stage, fully-entitled, pending proposal: every axis EXCEPT the guardrail verdict is
 * deliberately clear, so a test that overrides only `guardrails` isolates that one axis.
 *
 * `eligibility.approve.allowed` is set to `true` throughout — the value the payload CLAIMS. I5
 * makes that claim irrelevant to the derivation; these tests exist to prove it is ignored.
 */
function decision(overrides = {}) {
  return {
    proposal_id: 'prop_derive_test',
    story_code: 'S9.99',
    stage: 'decide',
    status: 'pending',
    entitlement: 'full',
    cardinality: 'many',
    on_clock: false,
    guardrails: { verdict: 'within_limits' },
    eligibility: { approve: { allowed: true } },
    proposal: {},
    ...overrides,
  }
}

/** The exact payload the phase exists to stop: guardrail says beyond limits, payload says allowed. */
function t1Payload() {
  return decision({
    guardrails: { verdict: 'beyond_limits' },
    eligibility: { approve: { allowed: true } },
  })
}

describe('T1 — a beyond_limits verdict blocks approval even when the payload claims allowed', () => {
  it('returns blocked', () => {
    const verdict = deriveApproveEligibility(t1Payload())
    expect(verdict.allowed).toBe(false)
  })

  it('states why, in operator-facing copy', () => {
    const verdict = deriveApproveEligibility(t1Payload())
    expect(typeof verdict.reason).toBe('string')
    expect(verdict.reason.trim()).not.toBe('')
  })

  it('is not swayed by the payload disagreeing in either direction', () => {
    // allowed:true and allowed:false must produce the IDENTICAL derived answer. If the payload were
    // an input, these two would differ.
    const claimsAllowed = deriveApproveEligibility(
      decision({ guardrails: { verdict: 'beyond_limits' }, eligibility: { approve: { allowed: true } } }),
    )
    const claimsBlocked = deriveApproveEligibility(
      decision({ guardrails: { verdict: 'beyond_limits' }, eligibility: { approve: { allowed: false } } }),
    )
    expect(claimsAllowed).toEqual(claimsBlocked)
  })
})

describe('T2 — a missing verdict fails CLOSED with a reason', () => {
  const absent = [
    ['no guardrails object at all', { guardrails: undefined }],
    ['an empty guardrails object', { guardrails: {} }],
    ['a null verdict', { guardrails: { verdict: null } }],
    ['an undefined verdict', { guardrails: { verdict: undefined } }],
    ['guardrails set to null', { guardrails: null }],
  ]

  it.each(absent)('blocks when there is %s', (_label, override) => {
    const verdict = deriveApproveEligibility(decision(override))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason.trim()).not.toBe('')
  })

  it('blocks on a missing Decision Object entirely', () => {
    for (const nothing of [undefined, null, 'a string', 42, []]) {
      const verdict = deriveApproveEligibility(nothing)
      expect(verdict.allowed, `${JSON.stringify(nothing)} must not be approvable`).toBe(false)
      expect(verdict.reason.trim()).not.toBe('')
    }
  })
})

describe('T3 — an unrecognised verdict fails CLOSED', () => {
  const unrecognised = ['sideways', 'WITHIN_LIMITS', 'ok', 'allowed', 'true', '', '  ', 'within limits']

  it.each(unrecognised)('blocks on verdict %o', (value) => {
    const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: value } }))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason.trim()).not.toBe('')
  })

  it.each([true, false, 0, 1, {}, []])('blocks on a non-string verdict %o', (value) => {
    const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: value } }))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason.trim()).not.toBe('')
  })

  it('recognises exactly the four contract verdicts and nothing else', () => {
    // Pinned against the contract's own enum so a fifth verdict added in decisionObject.js without a
    // decision here fails loudly rather than silently falling into the fail-closed branch.
    expect(GUARDRAIL_VERDICTS).toEqual(['within_limits', 'beyond_limits', 'not_applicable', 'undetermined'])
  })
})

describe('T4 — within_limits with no other blocker is allowed', () => {
  it('allows, with no reason', () => {
    const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: 'within_limits' } }))
    expect(verdict.allowed).toBe(true)
    expect(verdict.reason).toBeNull()
  })

  it('allows not_applicable too — no guardrail applies is not the same as a failed guardrail', () => {
    // Ruling (c). 40 of the 105 shipped objects are exactly this case; treating it as a block would
    // fail T10.
    const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: 'not_applicable' } }))
    expect(verdict.allowed).toBe(true)
    expect(verdict.reason).toBeNull()
  })

  it('blocks undetermined — guardrails that have not finished are not guardrails that passed', () => {
    const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: 'undetermined' } }))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason.trim()).not.toBe('')
  })

  it('still blocks a clear verdict when another axis blocks', () => {
    const blockers = [
      ['a stage that does not approve', { stage: 'reason' }],
      ['the analyze stage', { stage: 'analyze' }],
      ['a locked entitlement', { entitlement: 'locked' }],
      ['a limited entitlement', { entitlement: 'limited' }],
      ['an already-approved proposal', { status: 'approved' }],
      ['a dismissed proposal', { status: 'dismissed' }],
    ]
    for (const [label, override] of blockers) {
      const verdict = deriveApproveEligibility(decision({ guardrails: { verdict: 'within_limits' }, ...override }))
      expect(verdict.allowed, `${label} must still block`).toBe(false)
      expect(verdict.reason.trim(), `${label} needs a reason`).not.toBe('')
    }
  })
})

describe('I2 — pure and total', () => {
  it('never mutates its input', () => {
    const input = t1Payload()
    const before = JSON.stringify(input)
    deriveApproveEligibility(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('returns the same answer for the same input, twice', () => {
    const input = t1Payload()
    expect(deriveApproveEligibility(input)).toEqual(deriveApproveEligibility(input))
  })

  it('gives every blocked branch a distinct, non-generic reason', () => {
    // Step 3: "an empty or generic reason is a defect". Collected across every blocking axis, the
    // reasons must be distinguishable — one shared string for six different causes tells an operator
    // nothing about what to do next.
    const cases = [
      decision({ stage: 'reason' }),
      decision({ entitlement: 'locked' }),
      decision({ entitlement: 'limited' }),
      decision({ status: 'approved' }),
      decision({ guardrails: { verdict: 'beyond_limits' } }),
      decision({ guardrails: { verdict: 'undetermined' } }),
      decision({ guardrails: {} }),
    ]
    const reasons = cases.map((d) => deriveApproveEligibility(d).reason)
    expect(reasons.every((r) => typeof r === 'string' && r.trim().length > 0)).toBe(true)
    expect(new Set(reasons).size).toBe(reasons.length)
  })
})

describe('T10 — the regression net for I6: zero diffs across the 105 shipped objects', () => {
  it('derives exactly today\'s eligibility.approve.allowed for every shipped object', () => {
    const diffs = dataset
      .map((d) => ({
        proposal_id: d.proposal_id,
        stage: d.stage,
        verdict: d.guardrails?.verdict ?? null,
        shipped: d.eligibility?.approve?.allowed,
        derived: deriveApproveEligibility(d).allowed,
      }))
      .filter((row) => row.derived !== row.shipped)

    expect(diffs, `derived eligibility diverges from shipped on ${diffs.length} object(s)`).toEqual([])
  })

  it('covers all 105, so an empty dataset can never pass this test vacuously', () => {
    expect(dataset).toHaveLength(105)
    // And the corpus really does exercise both answers — a net that only ever sees `false` would
    // pass against a function hardwired to block.
    // 49 approvable / 56 blocked: 9 within_limits + 14 not_applicable at decide, 26 not_applicable
    // at execute; against 3 beyond_limits, 26 reason, 26 analyze and 1 live.
    const derived = dataset.map((d) => deriveApproveEligibility(d).allowed)
    expect(derived.filter((a) => a === true)).toHaveLength(49)
    expect(derived.filter((a) => a === false)).toHaveLength(56)
  })
})
