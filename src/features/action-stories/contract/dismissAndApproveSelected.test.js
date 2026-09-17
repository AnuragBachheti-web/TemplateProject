// Phase 2, T7 and T12.
//
// T7 — the dismiss reason gains a vocabulary AND a place to live. Per ruling R7: an enum that is
// never stored cannot filter a queue, and `operatorActionExecution.js` validated the reason then
// discarded it while `modify` and `send_back` persisted their notes. So this phase does both.
//
// T12 — `approve_selected` joins `approve` under the Phase 1 rule: one producer, derived, never read
// from the payload (I7). This is the same test Phase 1 wrote for `approve`, repeated.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { checkOperatorAction, OPERATOR_ACTION_IDS } from './actionTypes'
import { DISMISS_REASONS } from './decisionObject'
import { deriveApproveSelectedEligibility, __resetEligibilityDriftLog } from './deriveEligibility'
import { authorizeOperatorAction, applyOperatorAction } from './operatorActionExecution'
import { slateItemId } from './slateItem'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

const LONG_REASON = 'a sufficiently long reason'

/** A decide-stage, many-item, within-limits, fully-entitled proposal — everything clear but payload. */
function decision(overrides = {}) {
  const base = structuredClone(dataset.find((d) => d.proposal_id === 'prop_s9_1_decide'))
  return {
    ...base,
    proposal_id: 'prop_phase2_test',
    cardinality: 'many',
    status: 'pending',
    entitlement: 'full',
    guardrails: { ...base.guardrails, verdict: 'within_limits' },
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    proposal: {
      ...base.proposal,
      slate: [{ sku: 'A-1', name: 'One' }, { sku: 'A-2', name: 'Two' }, { sku: 'A-3', name: 'Three' }],
    },
    ...overrides,
  }
}

const someSelection = (d) => [slateItemId(d.proposal.slate, 0)]

let warnSpy

beforeEach(() => {
  __resetEligibilityDriftLog()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warnSpy.mockRestore()
})

describe('T7 — dismiss rejects a reason outside the enum and accepts one inside it', () => {
  it('the enum exists and is small', () => {
    expect(Array.isArray(DISMISS_REASONS)).toBe(true)
    expect(DISMISS_REASONS.length).toBeGreaterThanOrEqual(2)
    expect(DISMISS_REASONS.length, 'a vocabulary this large is a free string with extra steps').toBeLessThanOrEqual(6)
  })

  it.each(DISMISS_REASONS)('accepts reason_code %s', (code) => {
    const verdict = checkOperatorAction('dismiss', decision(), { reason: LONG_REASON, reason_code: code })
    expect(verdict.allowed, verdict.reason ?? '').toBe(true)
  })

  it('rejects a reason_code outside the enum', () => {
    for (const bad of ['because', 'NOT_ACTIONABLE', '', null, 42, {}]) {
      const verdict = checkOperatorAction('dismiss', decision(), { reason: LONG_REASON, reason_code: bad })
      expect(verdict.allowed, `dismiss accepted reason_code ${JSON.stringify(bad)}`).toBe(false)
      expect(verdict.reason.trim()).not.toBe('')
    }
  })

  it('rejects a MISSING reason_code — fail-closed, like every other required payload field', () => {
    const verdict = checkOperatorAction('dismiss', decision(), { reason: LONG_REASON })
    expect(verdict.allowed).toBe(false)
  })

  it('still requires the free-text reason as well — the enum does not replace the explanation', () => {
    const verdict = checkOperatorAction('dismiss', decision(), { reason: 'short', reason_code: DISMISS_REASONS[0] })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/10 characters/)
  })

  it('does NOT require a reason_code for any other action', () => {
    expect(checkOperatorAction('modify', decision(), { reason: LONG_REASON }).allowed).toBe(true)
    expect(checkOperatorAction('send_back', decision(), { reason: LONG_REASON }).allowed).toBe(true)
  })

  it('the server gate rejects the same payloads', () => {
    expect(authorizeOperatorAction(decision(), 'dismiss', { reason: LONG_REASON }).ok).toBe(false)
    expect(authorizeOperatorAction(decision(), 'dismiss', { reason: LONG_REASON, reasonCode: 'nonsense' }).ok).toBe(false)
    expect(authorizeOperatorAction(decision(), 'dismiss', { reason: LONG_REASON, reasonCode: DISMISS_REASONS[0] }).ok).toBe(true)
  })

  it('R7 — the dismissal is PERSISTED, alongside modification_note / send_back_note', () => {
    // The finding that made this part of the phase: dismiss validated the reason and then dropped
    // it on the floor, so no queue could ever filter on it.
    const next = applyOperatorAction(decision(), 'dismiss', {
      reason: 'Superseded by the Q4 calendar build',
      reasonCode: DISMISS_REASONS[0],
      nextStatus: 'dismissed',
    })
    expect(next.proposal.dismissal_reason).toBe(DISMISS_REASONS[0])
    expect(next.proposal.dismissal_note).toBe('Superseded by the Q4 calendar build')
    expect(next.status).toBe('dismissed')
  })

  it('still records the other two notes exactly as before', () => {
    const modified = applyOperatorAction(decision(), 'modify', { reason: LONG_REASON })
    expect(modified.proposal.modification_note).toBe(LONG_REASON)
    const sentBack = applyOperatorAction(decision(), 'send_back', { reason: LONG_REASON })
    expect(sentBack.proposal.send_back_note).toBe(LONG_REASON)
  })
})

describe('T12 — approve_selected is DERIVED, never read from the payload (I7)', () => {
  it('has a single producer', () => {
    expect(typeof deriveApproveSelectedEligibility).toBe('function')
  })

  it('blocks on a beyond_limits verdict even when the payload claims allowed', () => {
    const d = decision({
      guardrails: { verdict: 'beyond_limits' },
      eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    })
    expect(deriveApproveSelectedEligibility(d).allowed).toBe(false)
    expect(checkOperatorAction('approve_selected', d, { selection: someSelection(d) }).allowed).toBe(false)
  })

  it('blocks when the verdict is missing or unrecognised', () => {
    for (const guardrails of [undefined, {}, { verdict: null }, { verdict: 'sideways' }]) {
      const d = decision({ guardrails })
      expect(deriveApproveSelectedEligibility(d).allowed, JSON.stringify(guardrails)).toBe(false)
      expect(deriveApproveSelectedEligibility(d).reason.trim()).not.toBe('')
    }
  })

  it('blocks a one-item proposal — the rule that makes it different from plain Approve', () => {
    const d = decision({ cardinality: 'one' })
    expect(deriveApproveSelectedEligibility(d).allowed).toBe(false)
    expect(deriveApproveSelectedEligibility(d).reason).toMatch(/multi-item|single/i)
  })

  it('allows a within_limits, many-item proposal', () => {
    expect(deriveApproveSelectedEligibility(decision()).allowed).toBe(true)
    expect(deriveApproveSelectedEligibility(decision()).reason).toBeNull()
  })

  it('ignores the payload in both directions, and logs the disagreement once', () => {
    const claimsBlocked = decision({
      eligibility: {
        ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
        approve_selected: { allowed: false, blocked_reason: 'stale' },
      },
    })
    expect(checkOperatorAction('approve_selected', claimsBlocked, { selection: someSelection(claimsBlocked) }).allowed).toBe(true)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/approve_selected/)
  })

  it('the server gate reaches the same answer through the same producer', () => {
    const d = decision({ guardrails: { verdict: 'beyond_limits' } })
    const verdict = authorizeOperatorAction(d, 'approve_selected', { selection: someSelection(d) })
    expect(verdict.ok).toBe(false)
    expect(verdict.status).toBe(422)
    expect(verdict.userMessage).toBe(deriveApproveSelectedEligibility(d).reason)
  })

  it('no template reads eligibility.approve_selected.allowed any more', async () => {
    const decide = (await import('../templates/decide.slate.v1.json')).default
    const action = decide.actions.find((a) => a.id === 'approve_selected')
    expect(action.when, 'a template condition would be a second producer').toBeUndefined()
    expect(JSON.stringify(decide)).not.toContain('eligibility.approve_selected.allowed')
  })

  it('T10 for the shipped corpus: derived == shipped for approve_selected on all 105', () => {
    const diffs = dataset
      .map((d) => ({
        proposal_id: d.proposal_id,
        shipped: d.eligibility.approve_selected.allowed,
        derived: deriveApproveSelectedEligibility(d).allowed,
      }))
      .filter((r) => r.derived !== r.shipped)
    expect(diffs, 'deriving approve_selected changed shipped behaviour').toEqual([])
  })
})
