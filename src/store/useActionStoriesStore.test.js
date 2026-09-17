// Suite 4 (dispatch boundary) and 5 (the six actions, end to end through the API).
//
// The single most important test in this file is "a direct dispatch of an ineligible action is
// rejected": the previous architecture checked eligibility only inside StageActionBar.handleClick,
// so anything that called the store directly bypassed it entirely.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useActionStoriesStore } from './useActionStoriesStore'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
import { OPERATOR_ACTION_IDS } from '@/features/action-stories/contract/actionTypes'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

const FUTURE = '2099-01-01T00:00:00.000Z'
const LONG_REASON = 'a sufficiently long reason'

function openProposal(overrides = {}) {
  return {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_store_test',
    cardinality: 'many',
    on_clock: true,
    deadline: FUTURE,
    status: 'pending',
    entitlement: 'full',
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    proposal: {
      recommendation: 'Do the thing',
      slate: [{ sku: 'A-1', name: 'One' }, { sku: 'A-2', name: 'Two' }, { sku: 'A-3', name: 'Three' }],
    },
    ...overrides,
  }
}

function load(decision) {
  __seedProposal(decision)
  useActionStoriesStore.getState().setDecision(decision)
  return decision
}

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
})

describe('dispatch boundary — eligibility is enforced where the request happens', () => {
  it('rejects an action whose eligibility entry is MISSING, without any network call', async () => {
    const eligibility = Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }]))
    delete eligibility.modify
    load(openProposal({ eligibility }))

    await useActionStoriesStore.getState().runAction('modify', { reason: LONG_REASON })

    const state = useActionStoriesStore.getState()
    expect(state.decision.status).toBe('pending') // nothing happened
    expect(state.getActionError('modify')).toBeTruthy()
  })

  it('rejects an action whose eligibility is false', async () => {
    load(openProposal({
      eligibility: {
        ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
        modify: { allowed: false, blocked_reason: 'Guardrail breach.' },
      },
    }))

    await useActionStoriesStore.getState().runAction('modify', { reason: LONG_REASON })
    expect(useActionStoriesStore.getState().getActionError('modify').userMessage).toBe('Guardrail breach.')
    expect(useActionStoriesStore.getState().decision.status).toBe('pending')
  })

  it('rejects approve from the DERIVED verdict, even though the payload claims it is allowed', async () => {
    // The dispatch boundary must reach the same answer as the single producer. `approve.allowed` is
    // `true` here and the guardrail verdict is `beyond_limits`; before this phase, the request went.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    load(openProposal({
      guardrails: { verdict: 'beyond_limits' },
      eligibility: {
        ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
        approve: { allowed: true },
      },
    }))

    await useActionStoriesStore.getState().runAction('approve')

    const state = useActionStoriesStore.getState()
    expect(state.decision.status).toBe('pending') // no request was sent
    expect(state.getActionError('approve')).toBeTruthy()
    expect(state.getActionError('approve').code).toBe('CLIENT_ERROR')
    warn.mockRestore()
  })

  it('rejects a UI bypass — calling runAction directly, exactly as a console or a stale closure would', async () => {
    load(openProposal({ status: 'approved' })) // terminal: nothing is eligible any more
    for (const id of OPERATOR_ACTION_IDS) {
      await useActionStoriesStore.getState().runAction(id, { reason: LONG_REASON, snoozeUntil: FUTURE, selection: ['A-1'] })
      expect(useActionStoriesStore.getState().getActionError(id), `${id} was not rejected`).toBeTruthy()
    }
  })

  it('rejects everything when there is no Decision Object loaded at all', async () => {
    await useActionStoriesStore.getState().runAction('approve')
    expect(useActionStoriesStore.getState().getActionError('approve')).toBeTruthy()
  })

  it('rejects approve_selected with an empty selection', async () => {
    load(openProposal())
    await useActionStoriesStore.getState().runAction('approve_selected', { selection: [] })
    expect(useActionStoriesStore.getState().getActionError('approve_selected')).toBeTruthy()
    expect(useActionStoriesStore.getState().decision.status).toBe('pending')
  })

  it.each(['modify', 'send_back', 'dismiss'])('rejects %s with a too-short reason', async (id) => {
    load(openProposal())
    await useActionStoriesStore.getState().runAction(id, { reason: 'no' })
    expect(useActionStoriesStore.getState().getActionError(id)).toBeTruthy()
  })

  it('rejects snooze with a past time', async () => {
    load(openProposal())
    await useActionStoriesStore.getState().runAction('snooze', { snoozeUntil: '2000-01-01T00:00:00Z' })
    expect(useActionStoriesStore.getState().getActionError('snooze')).toBeTruthy()
  })
})

describe('the six operator actions — dispatch, transition, updated Decision Object', () => {
  it('approve: pending -> approved, and the store re-renders from the RESPONSE', async () => {
    const before = load(openProposal())
    const result = await useActionStoriesStore.getState().runAction('approve')

    expect(result.status).toBe('approved')
    // The store holds exactly what the API returned — not a locally patched copy.
    expect(useActionStoriesStore.getState().decision).toEqual(result)
    expect(useActionStoriesStore.getState().decision.updated_at).not.toBe(before.updated_at)
  })

  it('approve_selected: only the selected items leave the slate', async () => {
    load(openProposal())
    useActionStoriesStore.getState().setSelection(['A-1', 'A-3'])

    const result = await useActionStoriesStore.getState().runAction('approve_selected')

    expect(result.status).toBe('approved')
    expect(result.proposal.approved_items.map((r) => r.sku)).toEqual(['A-1', 'A-3'])
    expect(result.proposal.slate.map((r) => r.sku)).toEqual(['A-2'])
    // Selection is cleared once it has been acted on.
    expect(useActionStoriesStore.getState().selection).toEqual([])
  })

  it('modify: pending -> modified, carrying the reason', async () => {
    load(openProposal())
    const result = await useActionStoriesStore.getState().runAction('modify', { reason: 'Price floor is wrong here' })
    expect(result.status).toBe('modified')
    expect(result.proposal.modification_note).toBe('Price floor is wrong here')
  })

  it('send_back: status stays pending, ownership note recorded, and it cannot be sent back twice', async () => {
    load(openProposal())
    const result = await useActionStoriesStore.getState().runAction('send_back', { reason: 'Needs supplier confirmation' })
    expect(result.status).toBe('pending')
    expect(result.proposal.send_back_note).toBe('Needs supplier confirmation')
    expect(result.eligibility.send_back.allowed).toBe(false)
  })

  it('dismiss: pending -> dismissed, terminal', async () => {
    load(openProposal())
    const result = await useActionStoriesStore.getState().runAction('dismiss', { reason: 'Superseded by S9.9', reasonCode: 'not_actionable' })
    expect(result.status).toBe('dismissed')
    expect(Object.values(result.eligibility).every((e) => e.allowed === false)).toBe(true)
  })

  it('snooze: status stays pending, snooze recorded', async () => {
    load(openProposal())
    const result = await useActionStoriesStore.getState().runAction('snooze', { snoozeUntil: FUTURE })
    expect(result.status).toBe('pending')
    expect(result.snoozed_until).toBe(FUTURE)
  })
})

describe('store behaviour', () => {
  it('guards against a duplicate click while an action is in flight', async () => {
    load(openProposal())
    const first = useActionStoriesStore.getState().runAction('approve')
    const second = useActionStoriesStore.getState().runAction('approve')
    const [a, b] = await Promise.all([first, second])
    expect(a).toBeTruthy()
    expect(b).toBeUndefined() // the second call returned immediately without dispatching
  })

  it('reuses the SAME idempotency key when an action is retried after a failure', async () => {
    // Force a failure with a proposal the store knows about but the API does not — `setDecision`
    // without `__seedProposal`, so the POST 404s and the action fails for a real transport reason.
    useActionStoriesStore.getState().setDecision({ ...openProposal(), proposal_id: 'prop_not_in_api' })
    await useActionStoriesStore.getState().runAction('approve')
    const keyAfterFailure = useActionStoriesStore.getState().idempotencyKeys.approve
    expect(keyAfterFailure).toBeTruthy()

    await useActionStoriesStore.getState().runAction('approve')
    expect(useActionStoriesStore.getState().idempotencyKeys.approve).toBe(keyAfterFailure)
  })

  it('clears the idempotency key once an action settles successfully', async () => {
    load(openProposal())
    await useActionStoriesStore.getState().runAction('approve')
    expect(useActionStoriesStore.getState().idempotencyKeys.approve).toBeUndefined()
  })

  it('drops selection and errors when a DIFFERENT proposal is loaded', async () => {
    load(openProposal())
    useActionStoriesStore.getState().setSelection(['A-1'])
    await useActionStoriesStore.getState().runAction('approve_selected', { selection: [] }) // records an error
    expect(useActionStoriesStore.getState().getActionError('approve_selected')).toBeTruthy()

    useActionStoriesStore.getState().setDecision(openProposal({ proposal_id: 'prop_other' }))
    expect(useActionStoriesStore.getState().selection).toEqual([])
    expect(useActionStoriesStore.getState().getActionError('approve_selected')).toBeNull()
  })

  it('toggles selection', () => {
    load(openProposal())
    const { toggleSelection } = useActionStoriesStore.getState()
    toggleSelection('A-1')
    toggleSelection('A-2')
    expect(useActionStoriesStore.getState().selection).toEqual(['A-1', 'A-2'])
    toggleSelection('A-1')
    expect(useActionStoriesStore.getState().selection).toEqual(['A-2'])
  })

  it('never writes proposal state to localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    load(openProposal())
    await useActionStoriesStore.getState().runAction('approve')
    const businessWrites = setItem.mock.calls.filter(([key]) => !String(key).includes('theme'))
    expect(businessWrites, 'proposal truth must never be persisted client-side').toEqual([])
    setItem.mockRestore()
  })
})
