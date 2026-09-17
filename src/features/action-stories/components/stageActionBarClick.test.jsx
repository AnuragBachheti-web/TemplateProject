// @vitest-environment jsdom
//
// Phase 1, T11 (ruling (g)): StageActionBar's click path must honour the verdict on EVERY branch.
//
// The defect: handleClick computed `!state.enabled || !verdict.allowed || anyPending`, then re-tested
// only the narrower `!state.enabled || anyPending` inside — so `!verdict.allowed` alone fell straight
// through to dispatch. A disabled button hides that today, but "the button was disabled" is a
// rendering accident, not a gate. This file pins the decision itself, as a pure function, so the
// click path can be tested without relying on whether the DOM happened to disable anything.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import StageActionBar from './StageActionBar'
import { resolveActionState, resolveClickIntent } from './actionEligibility'
import { ToastProvider } from '../ui/Toast'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi } from '@/services/mockDecisionApi'
import { getOperatorAction, checkOperatorAction, OPERATOR_ACTION_IDS } from '../contract/actionTypes'
import decideTemplate from '../templates/decide.slate.v1.json'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const FUTURE = '2099-01-01T00:00:00.000Z'

function proposal(overrides = {}) {
  return {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_click_test',
    stage: 'decide',
    cardinality: 'many',
    on_clock: true,
    deadline: FUTURE,
    status: 'pending',
    entitlement: 'full',
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    ...overrides,
  }
}

/** The T1 payload again: guardrail beyond limits, payload claiming approval is allowed. */
function t1Payload() {
  return proposal({
    guardrails: { verdict: 'beyond_limits' },
    eligibility: {
      ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
      approve: { allowed: true },
    },
  })
}

const approveDef = decideTemplate.actions.find((a) => a.id === 'approve')

let container
let root
let realRunAction

function render(decision, actions = decideTemplate.actions) {
  useActionStoriesStore.getState().setDecision(decision)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <ToastProvider>
        <StageActionBar actions={actions} />
      </ToastProvider>,
    )
  })
}

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
  realRunAction = useActionStoriesStore.getState().runAction
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  useActionStoriesStore.setState({ runAction: realRunAction })
})

describe('T11 — a blocked verdict must not dispatch, on any click path', () => {
  it('resolveClickIntent ignores a blocked verdict even when the rendered state says enabled', () => {
    // The exact hole: `state.enabled` true (the template no longer carries an eligibility `when`),
    // verdict denied, and no unsupplied payload to collect. Today this dispatches.
    const decision = t1Payload()
    const state = resolveActionState(approveDef, decision)
    const verdict = checkOperatorAction('approve', decision)

    expect(state.enabled, 'the template must no longer be the thing gating approve').toBe(true)
    expect(verdict.allowed).toBe(false)

    expect(
      resolveClickIntent({ state, verdict, spec: getOperatorAction('approve'), anyPending: false }),
    ).toBe('ignore')
  })

  it('ignores a click while the rendered state itself is disabled', () => {
    const state = { ...resolveActionState(approveDef, t1Payload()), enabled: false }
    const verdict = { allowed: false, reason: 'nope' }
    expect(resolveClickIntent({ state, verdict, spec: getOperatorAction('approve'), anyPending: false })).toBe('ignore')
  })

  it('ignores a click while any action is already in flight', () => {
    const decision = proposal({ guardrails: { verdict: 'within_limits' } })
    const state = resolveActionState(approveDef, decision)
    const verdict = checkOperatorAction('approve', decision)
    expect(verdict.allowed).toBe(true)
    expect(resolveClickIntent({ state, verdict, spec: getOperatorAction('approve'), anyPending: true })).toBe('ignore')
  })

  it('does NOT reach runAction when the approve click path is exercised on a blocked payload', async () => {
    const spy = vi.fn()
    render(t1Payload())
    useActionStoriesStore.setState({ runAction: spy })

    const approve = [...container.querySelectorAll('button')].find((b) => /Approve|Unavailable/.test(b.textContent))
    expect(approve, 'the approve control must render in some form').toBeTruthy()
    await act(async () => {
      approve.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('T11 — the branches that must KEEP working', () => {
  it('opens the dialog for an action whose only obstacle is unsupplied payload', () => {
    // Deliberate existing behaviour: a required reason or a selection is something the operator is
    // about to provide, and a disabled button gives them no way to. Collapsing the dead `if` must
    // not collapse this.
    const decision = proposal({ guardrails: { verdict: 'within_limits' } })
    const modifyDef = decideTemplate.actions.find((a) => a.id === 'modify')
    const state = resolveActionState(modifyDef, decision)
    const verdict = checkOperatorAction('modify', decision, { reason: '' })

    expect(state.enabled).toBe(true)
    expect(verdict.allowed, 'modify needs a 10-character reason').toBe(false)
    expect(resolveClickIntent({ state, verdict, spec: getOperatorAction('modify'), anyPending: false })).toBe('dialog')
  })

  it('opens the dialog for an allowed action that requires confirmation', () => {
    const decision = proposal({ guardrails: { verdict: 'within_limits' } })
    const state = resolveActionState(approveDef, decision)
    const verdict = checkOperatorAction('approve', decision)

    expect(verdict.allowed).toBe(true)
    expect(state.confirmRequired).toBe(true)
    expect(resolveClickIntent({ state, verdict, spec: getOperatorAction('approve'), anyPending: false })).toBe('dialog')
  })

  it('dispatches immediately for an allowed action that needs nothing collected', () => {
    const decision = proposal({ guardrails: { verdict: 'within_limits' } })
    const bare = { id: 'approve', label: 'Approve', kind: 'primary', action: 'approve' }
    const state = resolveActionState(bare, decision)
    const verdict = checkOperatorAction('approve', decision)

    expect(verdict.allowed).toBe(true)
    expect(state.confirmRequired).toBe(false)
    expect(resolveClickIntent({ state, verdict, spec: getOperatorAction('approve'), anyPending: false })).toBe('dispatch')
  })

  it('still reaches runAction for an allowed approve', async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    render(proposal({ guardrails: { verdict: 'within_limits' } }))
    useActionStoriesStore.setState({ runAction: spy })

    const approve = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Approve')
    expect(approve, 'approve must be live for a within_limits proposal').toBeTruthy()
    await act(async () => {
      approve.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    // It opens the confirm dialog rather than dispatching straight away — that is what this action
    // declares. The dialog's own confirm is what calls runAction, and routeLevel.test.jsx covers it.
    expect(document.body.textContent).toContain('Approve this proposal?')
  })
})

describe('I6 — the operator-facing copy on the 3 shipped beyond_limits objects survives', () => {
  // These three carry real business explanations in `eligibility.approve.blocked_reason`. The
  // DECISION must come from the producer (I5), but the MESSAGE is display copy, and replacing
  // "Full-launch exposure of $92.5K breaks the $75K appetite set in Reason" with generic derived
  // prose would be a visible regression on shipped behaviour. I6 covers both.
  const blocked = seed.filter((d) => d.guardrails?.verdict === 'beyond_limits')

  it('finds exactly the three', () => {
    expect(blocked).toHaveLength(3)
  })

  it.each(blocked.map((d) => [d.proposal_id, d]))('%s still shows its own blocked_reason', (_id, decision) => {
    render(structuredClone(decision))
    expect(container.textContent).toContain(decision.eligibility.approve.blocked_reason)
  })

  it.each(blocked.map((d) => [d.proposal_id, d]))('%s renders no live Approve button', (_id, decision) => {
    render(structuredClone(decision))
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(labels).not.toContain('Approve')
  })
})
