// Suites 3, 4 and 8: the Decision Object contract, the seven axes, fail-closed eligibility, and the
// status lifecycle. These are the rules everything else in the architecture leans on, so they are
// tested against the contract functions directly rather than through a component.
import { describe, it, expect, vi } from 'vitest'
import {
  validateDecisionObject,
  validateTypedNumber,
  CARDINALITIES,
  CONTRACT_CLASSES,
  MODES,
  ENTITLEMENTS,
  LENSES,
  PERSONAS,
} from './decisionObject'
import { checkOperatorAction, OPERATOR_ACTION_IDS, isFutureTimestamp } from './actionTypes'
import { isLegalTransition, isTerminal, STATUSES } from './statusLifecycle'
import { selectTemplate } from '../templates/selectTemplate'

const FUTURE = '2099-01-01T00:00:00.000Z'

function allowAll() {
  return Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }]))
}

function decision(overrides = {}) {
  return {
    proposal_id: 'prop_1',
    story_code: 'S9.1',
    stage: 'decide',
    action_type: 'reprice',
    cardinality: 'many',
    contract_class: 'standard',
    on_clock: true,
    deadline: FUTURE,
    mode: 'suggest',
    entitlement: 'full',
    lens: 'margin',
    persona: 'merchandiser',
    title: 'Reprice selected products',
    narrative: 'Recommended price changes improve margin within policy limits.',
    eligibility: allowAll(),
    // A real guardrail verdict. `approve` is no longer read from `eligibility` at all — it is
    // derived from the Decision Object (contract/deriveEligibility.js) — so a fixture without this
    // field would make every approve assertion below pass for the wrong reason.
    guardrails: { verdict: 'within_limits' },
    proposal: {},
    status: 'pending',
    updated_at: '2026-09-15T10:00:00.000Z',
    ...overrides,
  }
}

// ---- the seven axes ----------------------------------------------------------------------------

describe('Decision Object — the seven axes are required, never defaulted', () => {
  const AXES = ['cardinality', 'contract_class', 'on_clock', 'mode', 'entitlement', 'lens', 'persona']

  it.each(AXES)('rejects a Decision Object with no %s', (axis) => {
    const d = decision()
    delete d[axis]
    const problems = validateDecisionObject(d)
    expect(problems.join(' ')).toContain(`"${axis}"`)
  })

  it.each([
    ['cardinality', CARDINALITIES],
    ['contract_class', CONTRACT_CLASSES],
    ['mode', MODES],
    ['entitlement', ENTITLEMENTS],
    ['lens', LENSES],
    ['persona', PERSONAS],
  ])('accepts every declared %s value and nothing else', (axis, allowed) => {
    for (const value of allowed) {
      expect(validateDecisionObject(decision({ [axis]: value }))).toEqual([])
    }
    expect(validateDecisionObject(decision({ [axis]: 'not-a-real-value' })).join(' ')).toContain(`"${axis}"`)
  })

  it('requires a deadline when on_clock is true, and only then', () => {
    expect(validateDecisionObject(decision({ on_clock: true, deadline: undefined })).join(' ')).toContain('deadline')
    expect(validateDecisionObject(decision({ on_clock: false, deadline: undefined }))).toEqual([])
  })

  it('rejects a deadline that merely looks like a date', () => {
    expect(validateDecisionObject(decision({ deadline: '2026-13-45T99:00:00Z' })).length).toBeGreaterThan(0)
    expect(validateDecisionObject(decision({ deadline: 'next tuesday' })).length).toBeGreaterThan(0)
  })

  it('accepts a fully valid Decision Object', () => {
    expect(validateDecisionObject(decision())).toEqual([])
  })
})

describe('the seven axes change slots/behaviour without creating a new page', () => {
  it('only cardinality and entitlement=locked reach template SELECTION', () => {
    // The other five must never change which template renders — that is what stops an axis from
    // silently becoming a page factory.
    const base = { action_type: 'reprice', stage: 'decide', cardinality: 'many', entitlement: 'full' }
    for (const contract_class of CONTRACT_CLASSES) {
      for (const mode of MODES) {
        for (const lens of LENSES) {
          for (const persona of PERSONAS) {
            expect(selectTemplate({ ...base, contract_class, mode, lens, persona })).toBe('decide.slate.v1')
          }
        }
      }
    }
  })

  it('stage picks the template, and entitlement=locked overrides everything', () => {
    // Cardinality is a real derived axis again (see selectTemplate.test.js) and it gates
    // `approve_selected` — the assertion directly below this one — but it no longer decides whether
    // a decide-stage proposal renders at all.
    const base = { action_type: 'reprice', stage: 'decide', entitlement: 'full' }
    expect(selectTemplate({ ...base, cardinality: 'many' })).toBe('decide.slate.v1')
    expect(selectTemplate({ ...base, cardinality: 'one' })).toBe('decide.slate.v1')
    expect(selectTemplate({ ...base, cardinality: 'many', entitlement: 'locked' })).toBe('locked.v1')
  })

  it('cardinality gates Approve-selected via the shared eligibility function', () => {
    const many = checkOperatorAction('approve_selected', decision({ cardinality: 'many' }), { selection: ['a'] })
    const one = checkOperatorAction('approve_selected', decision({ cardinality: 'one' }), { selection: ['a'] })
    expect(many.allowed).toBe(true)
    expect(one.allowed).toBe(false)
    expect(one.reason).toMatch(/multi-item/i)
  })

  it('on_clock gates Snooze', () => {
    expect(checkOperatorAction('snooze', decision({ on_clock: true }), { snooze_until: FUTURE }).allowed).toBe(true)
    const off = checkOperatorAction('snooze', decision({ on_clock: false, deadline: undefined }), { snooze_until: FUTURE })
    expect(off.allowed).toBe(false)
    expect(off.reason).toMatch(/deadline/i)
  })
})

// ---- fail-closed eligibility ---------------------------------------------------------------------

describe('eligibility fails CLOSED', () => {
  // `approve` is DERIVED and is deliberately absent from these three. Its eligibility is not data
  // the payload asserts, so "absence is not permission" no longer describes it — the equivalent
  // rules (absent/null/unrecognised guardrail verdict all block) are pinned in
  // contract/deriveEligibility.test.js's T2 and T3, against the function that actually decides.
  // Deriving the other five is Phase 2's call, not something to do halfway.
  const PAYLOAD_DRIVEN_ACTION_IDS = OPERATOR_ACTION_IDS.filter((id) => id !== 'approve')

  it.each(PAYLOAD_DRIVEN_ACTION_IDS)('denies %s when its eligibility entry is missing entirely', (actionId) => {
    const eligibility = allowAll()
    delete eligibility[actionId]
    const verdict = checkOperatorAction(actionId, decision({ eligibility }), {
      selection: ['a'],
      reason: 'a sufficiently long reason',
      snooze_until: FUTURE,
    })
    expect(verdict.allowed, `${actionId} was allowed with NO eligibility entry`).toBe(false)
  })

  it.each(PAYLOAD_DRIVEN_ACTION_IDS)('denies %s when allowed is false', (actionId) => {
    const eligibility = { ...allowAll(), [actionId]: { allowed: false, blocked_reason: 'Nope.' } }
    const verdict = checkOperatorAction(actionId, decision({ eligibility }), {
      selection: ['a'],
      reason: 'a sufficiently long reason',
      snooze_until: FUTURE,
    })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toBe('Nope.')
  })

  it.each([undefined, null, 'true', 1, {}, []])('denies when allowed is %s rather than the boolean true', (value) => {
    const eligibility = { ...allowAll(), modify: { allowed: value } }
    expect(checkOperatorAction('modify', decision({ eligibility }), { reason: 'a sufficiently long reason' }).allowed).toBe(false)
  })

  it('denies every payload-driven action when the whole eligibility object is missing', () => {
    for (const id of PAYLOAD_DRIVEN_ACTION_IDS) {
      expect(checkOperatorAction(id, decision({ eligibility: undefined }), {}).allowed).toBe(false)
    }
  })

  it('IGNORES the payload for approve, in both directions, and says so out loud', () => {
    // I5. The derived value wins whichever way the payload disagrees, and the disagreement is logged
    // rather than thrown — a backend's contract bug must not take the operator's screen away.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Claims blocked, derivation allows: the operator can still approve.
    const claimsBlocked = decision({ eligibility: { ...allowAll(), approve: { allowed: false, blocked_reason: 'Nope.' } } })
    expect(checkOperatorAction('approve', claimsBlocked, {}).allowed).toBe(true)

    // Claims allowed, guardrail says otherwise: the operator cannot. This is the latent bug.
    const claimsAllowed = decision({
      guardrails: { verdict: 'beyond_limits' },
      eligibility: { ...allowAll(), approve: { allowed: true } },
    })
    expect(checkOperatorAction('approve', claimsAllowed, {}).allowed).toBe(false)

    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('denies an unknown action id', () => {
    expect(checkOperatorAction('delete_everything', decision(), {}).allowed).toBe(false)
  })

  it('denies when there is no Decision Object at all', () => {
    expect(checkOperatorAction('approve', null, {}).allowed).toBe(false)
    expect(checkOperatorAction('approve', undefined, {}).allowed).toBe(false)
  })

  it('requires eligibility to be present in the contract, not merely honoured at runtime', () => {
    const eligibility = allowAll()
    delete eligibility.dismiss
    expect(validateDecisionObject(decision({ eligibility })).join(' ')).toContain('eligibility.dismiss')
  })

  it('requires a blocked_reason whenever an action is disallowed', () => {
    const eligibility = { ...allowAll(), modify: { allowed: false } }
    expect(validateDecisionObject(decision({ eligibility })).join(' ')).toContain('blocked_reason')
  })
})

describe('payload rules are enforced by the same function the UI and server use', () => {
  it('requires a non-empty selection for approve_selected', () => {
    expect(checkOperatorAction('approve_selected', decision(), { selection: [] }).allowed).toBe(false)
    expect(checkOperatorAction('approve_selected', decision(), { selection: undefined }).allowed).toBe(false)
    expect(checkOperatorAction('approve_selected', decision(), { selection: ['item_1'] }).allowed).toBe(true)
  })

  it.each(['modify', 'send_back', 'dismiss'])('requires a 10-character reason for %s', (actionId) => {
    expect(checkOperatorAction(actionId, decision(), { reason: '' }).allowed).toBe(false)
    expect(checkOperatorAction(actionId, decision(), { reason: 'too short' }).allowed).toBe(false)
    expect(checkOperatorAction(actionId, decision(), { reason: '   padded out with spaces only   ' }).allowed).toBe(true)
  })

  it('requires a FUTURE snooze time', () => {
    expect(checkOperatorAction('snooze', decision(), { snooze_until: '2000-01-01T00:00:00Z' }).allowed).toBe(false)
    expect(checkOperatorAction('snooze', decision(), { snooze_until: 'tomorrow' }).allowed).toBe(false)
    expect(checkOperatorAction('snooze', decision(), { snooze_until: FUTURE }).allowed).toBe(true)
  })

  it('isFutureTimestamp takes an injectable now, so tests never depend on the wall clock', () => {
    const t = '2026-09-15T12:00:00.000Z'
    expect(isFutureTimestamp(t, Date.parse('2026-09-15T11:00:00Z'))).toBe(true)
    expect(isFutureTimestamp(t, Date.parse('2026-09-15T13:00:00Z'))).toBe(false)
  })
})

// ---- status lifecycle ----------------------------------------------------------------------------

describe('status lifecycle — every legal transition, every illegal one rejected', () => {
  const LEGAL = [
    ['pending', 'pending'],
    ['pending', 'approved'],
    ['pending', 'modified'],
    ['pending', 'dismissed'],
    ['modified', 'pending'],
  ]

  it.each(LEGAL)('permits %s -> %s', (from, to) => {
    expect(isLegalTransition(from, to)).toBe(true)
  })

  it('rejects every transition not explicitly permitted', () => {
    const legal = new Set(LEGAL.map(([f, t]) => `${f}->${t}`))
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (legal.has(`${from}->${to}`)) continue
        expect(isLegalTransition(from, to), `${from} -> ${to} should be illegal`).toBe(false)
      }
    }
  })

  it('rejects unknown statuses on either side (a gate fails closed)', () => {
    expect(isLegalTransition('pending', 'exploded')).toBe(false)
    expect(isLegalTransition('exploded', 'pending')).toBe(false)
    expect(isLegalTransition(undefined, 'approved')).toBe(false)
  })

  it('treats approved and dismissed as terminal', () => {
    expect(isTerminal('approved')).toBe(true)
    expect(isTerminal('dismissed')).toBe(true)
    expect(isTerminal('pending')).toBe(false)
    expect(isTerminal('modified')).toBe(false)
  })

  it('refuses every action on a terminal proposal, even with eligibility still claiming allowed', () => {
    // A stale payload must never resurrect a decided proposal.
    for (const status of ['approved', 'dismissed']) {
      for (const id of OPERATOR_ACTION_IDS) {
        const verdict = checkOperatorAction(id, decision({ status, eligibility: allowAll() }), {
          selection: ['a'],
          reason: 'a sufficiently long reason',
          snooze_until: FUTURE,
        })
        expect(verdict.allowed, `${id} allowed on a ${status} proposal`).toBe(false)
      }
    }
  })
})

// ---- typed numbers --------------------------------------------------------------------------------

describe('typed numbers — the contract never carries a pre-formatted display string', () => {
  it('accepts a well-formed typed number', () => {
    expect(validateTypedNumber({ value: 18400, unit: 'USD' }, 'impact')).toEqual([])
    expect(validateTypedNumber({ value: 12.5, unit: 'pct', precision: 1 }, 'impact')).toEqual([])
  })

  it.each(['$18,400', '18.4K', '12.5%', 18400, null])('rejects %s as a business value', (bad) => {
    expect(validateTypedNumber(bad, 'impact').length).toBeGreaterThan(0)
  })

  it('rejects an unknown unit and a non-finite value', () => {
    expect(validateTypedNumber({ value: 1, unit: 'bananas' }, 'impact').length).toBeGreaterThan(0)
    expect(validateTypedNumber({ value: Number.NaN, unit: 'USD' }, 'impact').length).toBeGreaterThan(0)
  })

  it('rejects a pre-formatted impact on the Decision Object itself', () => {
    expect(validateDecisionObject(decision({ impact: '$18,400' })).length).toBeGreaterThan(0)
  })

  it('constrains confidence to 0..1 with an explicit calibrated flag', () => {
    expect(validateDecisionObject(decision({ confidence: { value: 0.88, calibrated: true } }))).toEqual([])
    expect(validateDecisionObject(decision({ confidence: { value: 88, calibrated: true } })).length).toBeGreaterThan(0)
    expect(validateDecisionObject(decision({ confidence: { value: 0.88 } })).length).toBeGreaterThan(0)
  })
})

describe('guardrails use the 4-value enum, never a boolean', () => {
  it('accepts the real verdicts', () => {
    for (const verdict of ['within_limits', 'beyond_limits', 'not_applicable', 'undetermined']) {
      expect(validateDecisionObject(decision({ guardrails: { verdict } }))).toEqual([])
    }
  })

  it('rejects a boolean standing in for a verdict', () => {
    expect(validateDecisionObject(decision({ guardrails: { verdict: true } })).length).toBeGreaterThan(0)
    expect(validateDecisionObject(decision({ guardrails: { blocked: true } })).length).toBeGreaterThan(0)
  })
})
