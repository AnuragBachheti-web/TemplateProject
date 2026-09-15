// @vitest-environment jsdom
//
// Suite 5, at the component level: the action bar must stay GENERIC. It renders whatever the
// template declares, gates on the Decision Object, and contains no knowledge of what any action id
// means — this file's job is to keep that true as the six real actions were added.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import StageActionBar from './StageActionBar'
import { ToastProvider } from '../ui/Toast'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
import { OPERATOR_ACTION_IDS } from '../contract/actionTypes'
import decideTemplate from '../templates/decide.slate.v1.json'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const FUTURE = '2099-01-01T00:00:00.000Z'

function proposal(overrides = {}) {
  return {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_bar_test',
    cardinality: 'many',
    on_clock: true,
    deadline: FUTURE,
    status: 'pending',
    entitlement: 'full',
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    ...overrides,
  }
}

let container
let root

function render(actions = decideTemplate.actions) {
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

const labels = () => [...container.querySelectorAll('button')].map((b) => b.textContent.trim())

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('StageActionBar — driven entirely by template data', () => {
  it('renders nothing when the template declares no actions', () => {
    useActionStoriesStore.getState().setDecision(proposal())
    render([])
    expect(container.textContent).toBe('')
  })

  it('renders nothing when there is no Decision Object', () => {
    render()
    expect(container.textContent).toBe('')
  })

  it('renders nothing for a TERMINAL proposal, whatever eligibility still claims', () => {
    useActionStoriesStore.getState().setDecision(proposal({ status: 'approved' }))
    render()
    expect(container.textContent).toBe('')
  })

  it('renders every action the template declares, in declared order', () => {
    useActionStoriesStore.getState().setDecision(proposal())
    render()
    expect(labels()).toEqual(['Approve', 'Approve selected', 'Modify', 'Send back', 'Snooze', 'Dismiss'])
  })

  it('renders an arbitrary, never-before-seen action definition without special-casing', () => {
    // The generic-ness proof: a template action this component has no knowledge of still renders,
    // because every property it needs comes from the definition and the Decision Object.
    useActionStoriesStore.getState().setDecision(
      proposal({ eligibility: { ...proposal().eligibility, dismiss: { allowed: true } } }),
    )
    render([
      {
        id: 'dismiss',
        label: 'Bin it',
        kind: 'destructive',
        action: 'dismiss',
        when: {
          all: [
            { path: 'eligibility.dismiss.allowed', op: 'exists' },
            { path: 'eligibility.dismiss.allowed', op: 'eq', value: true },
          ],
        },
      },
    ])
    expect(labels()).toEqual(['Bin it'])
  })
})

describe('eligibility drives what an operator can reach', () => {
  it('shows "Unavailable" plus the backend reason for a disallowed action', () => {
    useActionStoriesStore.getState().setDecision(
      proposal({
        eligibility: {
          ...proposal().eligibility,
          approve: { allowed: false, blocked_reason: 'Capital ceiling exceeded.' },
        },
      }),
    )
    render()
    expect(container.textContent).toContain('Capital ceiling exceeded.')
    expect(labels()).not.toContain('Approve')
    expect(labels()).toContain('Unavailable')
  })

  it('disables an action whose eligibility entry is MISSING (fail-closed at the UI too)', () => {
    const eligibility = { ...proposal().eligibility }
    delete eligibility.approve
    useActionStoriesStore.getState().setDecision(proposal({ eligibility }))
    render()
    expect(labels()).not.toContain('Approve')
  })

  it('hides Approve-selected entirely for a single-item proposal', () => {
    useActionStoriesStore.getState().setDecision(proposal({ cardinality: 'one' }))
    render()
    expect(labels()).not.toContain('Approve selected')
  })

  it('hides Snooze when the proposal is not on the clock', () => {
    useActionStoriesStore.getState().setDecision(proposal({ on_clock: false, deadline: undefined }))
    render()
    expect(labels()).not.toContain('Snooze')
  })
})

describe('payload collection', () => {
  it('shows a live selection count for Approve-selected', () => {
    useActionStoriesStore.getState().setDecision(proposal())
    render()
    expect(container.textContent).toContain('0 selected')

    act(() => useActionStoriesStore.getState().setSelection(['A-1', 'A-2']))
    expect(container.textContent).toContain('2 selected')
  })

  it('opens a reason dialog for an action that requires one, and blocks confirm until it is long enough', async () => {
    __seedProposal(proposal())
    useActionStoriesStore.getState().setDecision(proposal())
    render()

    const dismiss = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Dismiss')
    await act(async () => {
      dismiss.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(document.body.textContent).toContain('Why are you dismissing this?')
    const confirm = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Dismiss').pop()
    expect(confirm.disabled, 'confirm must be blocked with an empty reason').toBe(true)
  })

  it('opens a snooze datetime field for Snooze', async () => {
    __seedProposal(proposal())
    useActionStoriesStore.getState().setDecision(proposal())
    render()

    const snooze = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Snooze')
    await act(async () => {
      snooze.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(document.querySelector('input[type="datetime-local"]')).toBeTruthy()
    expect(document.body.textContent).toContain('Snooze until')
  })
})
