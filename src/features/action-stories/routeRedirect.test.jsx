// @vitest-environment jsdom
//
// Phase 1, T9: the route carries the proposal id, and the old two-segment route keeps working
// through a redirect (C4).
//
// Mounted through the real App router at a real URL, nothing mocked — the same harness
// routeLevel.test.jsx uses, because a redirect that only works in a unit test is not a redirect.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import App from '@/App'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
import { actionStoryPath } from '@/constants/actionStoriesRoutes'
import { OPERATOR_ACTION_IDS } from './contract/actionTypes'
import seed from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const FUTURE = '2099-01-01T00:00:00.000Z'
const STORY = 'S9.97'

function proposal(overrides = {}) {
  return {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_redirect_decide',
    story_code: STORY,
    stage: 'decide',
    title: 'Reprice the autumn range',
    narrative: 'Twelve SKUs sit below the margin floor.',
    status: 'pending',
    entitlement: 'full',
    on_clock: true,
    deadline: FUTURE,
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    ...overrides,
  }
}

let container
let root

function seedStory(decision, stages = ['reason', 'analyze', 'decide', 'execute']) {
  for (const stage of stages) {
    const sibling = structuredClone(decision)
    sibling.stage = stage
    sibling.proposal_id = `${STORY}_${stage}`
    if (stage === decision.stage) sibling.proposal_id = decision.proposal_id
    __seedProposal(sibling)
  }
}

async function renderAt(path, decision) {
  seedStory(decision)
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<App />)
  })
  // Two settles: one for the redirect's own lookup, one for the destination's fetch.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 500))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 500))
  })
}

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('T9 — an old-format route redirects to the proposalId route and renders', () => {
  it('lands on the three-segment URL', async () => {
    await renderAt(`/action-stories/${STORY}/decide`, proposal())
    expect(window.location.pathname).toBe(`/action-stories/${STORY}/decide/prop_redirect_decide`)
  })

  it('renders the proposal once it gets there', async () => {
    await renderAt(`/action-stories/${STORY}/decide`, proposal())
    // The header's own identity strip, and the proposal the store ended up holding. Both come from
    // the proposal fetched by the id the redirect resolved, not from the queue row it matched.
    expect(container.querySelector('header.sticky').textContent).toContain('Reprice the autumn range')
    expect(useActionStoriesStore.getState().decision.proposal_id).toBe('prop_redirect_decide')
    expect(container.querySelector('div.sticky.bottom-0'), 'the action bar must render').toBeTruthy()
  })

  it('replaces rather than pushes, so the redirect does not sit in history', async () => {
    // Asserted on history LENGTH rather than by driving Back: jsdom delivers popstate
    // asynchronously, and a test that races that is testing jsdom. If the redirect pushed, the
    // length would grow by one and Back off the destination would bounce straight forward again.
    seedStory(proposal())
    window.history.pushState({}, '', `/action-stories/${STORY}/decide`)
    const lengthBeforeRedirect = window.history.length

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<App />)
    })
    for (let hop = 0; hop < 2; hop += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500))
      })
    }

    expect(window.location.pathname).toBe(`/action-stories/${STORY}/decide/prop_redirect_decide`)
    expect(window.history.length).toBe(lengthBeforeRedirect)
  })

  it('renders directly at the three-segment URL with no redirect at all', async () => {
    await renderAt(`/action-stories/${STORY}/decide/prop_redirect_decide`, proposal())
    expect(window.location.pathname).toBe(`/action-stories/${STORY}/decide/prop_redirect_decide`)
    expect(container.textContent).toContain('Reprice the autumn range')
  })

  it('addresses a sibling stage of the same story by its own proposal id', async () => {
    await renderAt(`/action-stories/${STORY}/analyze/${STORY}_analyze`, proposal())
    expect(useActionStoriesStore.getState().decision.proposal_id).toBe(`${STORY}_analyze`)
    expect(useActionStoriesStore.getState().decision.story_code).toBe(STORY)
  })

  it('still surfaces an unknown Action Story through the redirect as safe operator copy', async () => {
    window.history.pushState({}, '', '/action-stories/S0.0/decide')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<App />))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500))
    })
    expect(container.textContent).toContain("We couldn't find that Action Story.")
  })
})

describe('T9 — the path builder carries the proposal id', () => {
  it('builds the three-segment path when given one', () => {
    expect(actionStoryPath('S10.1', 'decide', 'prop_s10_1_decide')).toBe('/action-stories/S10.1/decide/prop_s10_1_decide')
  })

  it('still builds the old two-segment path when the id is not in hand', () => {
    // C4: the old shape must remain constructible, because it is what the redirect accepts.
    expect(actionStoryPath('S10.1', 'decide')).toBe('/action-stories/S10.1/decide')
  })
})
