// @vitest-environment jsdom
//
// Phase 2, T5, T14 and T15 — the render-layer consequences of the extended contract.
//
// T5  the clock axis becomes live: Snooze resolves enabled and the deadline chip renders. Both have
//     been unreachable on every shipped object since the axis was introduced, because
//     actionTypes.js gates Snooze on `on_clock === true` and StagePage renders the chip on
//     `on_clock && deadline`.
// T14 the three link builders carry the proposal id, so in-app navigation stops routing through
//     StageRedirect. The redirect stays for external links and bookmarks (C4), but a click inside
//     the app must not pay for a resolve hop.
// T15 an ambiguous story surfaces a VISIBLE error state. Phase 1 logged it to the console and
//     dropped the StepTracker silently — the one place that phase chose degrade-over-throw, and
//     flagged as its weakest seam.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import App from '@/App'
import StageActionBar from './components/StageActionBar'
import { ToastProvider } from './ui/Toast'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
import { checkOperatorAction, OPERATOR_ACTION_IDS } from './contract/actionTypes'
import { actionStoryPath } from '@/constants/actionStoriesRoutes'
import decideTemplate from './templates/decide.slate.v1.json'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const FUTURE = '2099-06-01T12:00:00.000Z'

function onClockProposal(overrides = {}) {
  const base = structuredClone(dataset.find((d) => d.proposal_id === 'prop_s9_1_decide'))
  return {
    ...base,
    proposal_id: 'prop_clock_test',
    story_code: 'S9.96',
    on_clock: true,
    deadline: FUTURE,
    status: 'pending',
    entitlement: 'full',
    guardrails: { ...base.guardrails, verdict: 'within_limits' },
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    ...overrides,
  }
}

let container
let root

function renderBar(decision) {
  useActionStoriesStore.getState().setDecision(decision)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <ToastProvider>
        <StageActionBar actions={decideTemplate.actions} />
      </ToastProvider>,
    )
  })
}

async function renderApp(pathname) {
  window.history.pushState({}, '', pathname)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<App />)
  })
  for (let hop = 0; hop < 3; hop += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
  }
}

beforeEach(() => {
  __resetMockApi()
  useActionStoriesStore.getState().clearDecision()
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('T5 — with on_clock true, Snooze is reachable and the deadline chip renders', () => {
  it('the contract gate allows snooze', () => {
    const verdict = checkOperatorAction('snooze', onClockProposal(), { snooze_until: FUTURE })
    expect(verdict.allowed, verdict.reason ?? '').toBe(true)
  })

  it('the action bar renders a live Snooze button', () => {
    renderBar(onClockProposal())
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(labels).toContain('Snooze')
  })

  it('still blocks Snooze when the proposal is NOT on the clock — the axis must cut both ways', () => {
    const off = onClockProposal({ on_clock: false, deadline: null })
    const verdict = checkOperatorAction('snooze', off, { snooze_until: FUTURE })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/deadline/i)
  })

  it('the deadline chip renders in the page header', async () => {
    const decision = onClockProposal()
    for (const stage of ['reason', 'analyze', 'decide', 'execute']) {
      const sibling = structuredClone(decision)
      sibling.stage = stage
      sibling.proposal_id = stage === 'decide' ? decision.proposal_id : `S9.96_${stage}`
      __seedProposal(sibling)
    }
    await renderApp('/action-stories/S9.96/decide/prop_clock_test')

    const header = container.querySelector('[data-shell-part="header"]')
    expect(header, 'the page must have rendered').toBeTruthy()
    expect(header.textContent, 'the deadline chip has never rendered on a shipped object').toMatch(/Due in \d+[hd]|Overdue/)
  })

  it('at least one SHIPPED object now reaches the chip and the Snooze button', () => {
    const shipped = dataset.filter((d) => d.on_clock === true && d.stage === 'decide')
    expect(shipped.length, 'no shipped decide-stage object is on the clock').toBeGreaterThanOrEqual(1)
    const verdict = checkOperatorAction('snooze', shipped[0], { snooze_until: FUTURE })
    expect(verdict.allowed, verdict.reason ?? '').toBe(true)
  })
})

describe('T14 — the three link builders emit the three-segment path', () => {
  it('actionStoryPath builds it when given an id', () => {
    expect(actionStoryPath('S10.1', 'decide', 'prop_s10_1_decide')).toBe('/action-stories/S10.1/decide/prop_s10_1_decide')
  })

  it('the home listing links straight to the proposal', async () => {
    await renderApp('/action-stories')
    const hrefs = [...container.querySelectorAll('a[href^="/action-stories/"]')].map((a) => a.getAttribute('href'))
    const stageLinks = hrefs.filter((h) => h.split('/').length >= 4)
    expect(stageLinks.length).toBeGreaterThan(0)
    const twoSegment = stageLinks.filter((h) => h.split('/').length === 4)
    expect(twoSegment, 'the home listing still emits redirect-bound links').toEqual([])
  })

  it('the sidebar and the step tracker both link straight to the proposal', async () => {
    await renderApp('/action-stories/S9.1/decide/prop_s9_1_decide')
    const hrefs = [...container.querySelectorAll('a[href^="/action-stories/"]')].map((a) => a.getAttribute('href'))
    const twoSegment = hrefs.filter((h) => h.split('/').length === 4)
    expect(twoSegment, 'an in-app link still routes through StageRedirect').toEqual([])

    const tracker = container.querySelector('nav[aria-label="Stage progress"]')
    expect(tracker).toBeTruthy()
    const trackerHrefs = [...tracker.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(trackerHrefs.length).toBeGreaterThanOrEqual(4)
    for (const h of trackerHrefs) {
      expect(h.split('/'), `tracker link ${h} is not proposal-addressed`).toHaveLength(5)
      expect(h.startsWith('/action-stories/S9.1/')).toBe(true)
    }

    // Each STEP names a different proposal — a tracker that linked four stages to one proposal id
    // would be five-segment-shaped and still wrong. Scoped to the step list rather than every anchor
    // in the nav, because the "Next" button legitimately duplicates the following step's target.
    const stepHrefs = [...tracker.querySelectorAll('ol a')].map((a) => a.getAttribute('href'))
    expect(stepHrefs).toHaveLength(4)
    expect(new Set(stepHrefs.map((h) => h.split('/')[4])).size).toBe(4)
  })

  it('the legacy two-segment route still works for a bookmark (C4)', async () => {
    await renderApp('/action-stories/S9.1/decide')
    expect(window.location.pathname).toBe('/action-stories/S9.1/decide/prop_s9_1_decide')
  })
})

describe('T15 — an ambiguous story surfaces a VISIBLE error, not a silently missing tracker', () => {
  const STORY = 'S9.95'

  function twin(id, title) {
    return { ...onClockProposal(), proposal_id: id, story_code: STORY, stage: 'decide', title }
  }

  it('renders the addressed proposal AND a visible notice about the ambiguity', async () => {
    __seedProposal(twin('prop_amb_a', 'Option A'))
    __seedProposal(twin('prop_amb_b', 'Option B'))
    await renderApp(`/action-stories/${STORY}/decide/prop_amb_a`)

    // The proposal still renders — it was addressed by id and never depended on the outline.
    expect(useActionStoriesStore.getState().decision.proposal_id).toBe('prop_amb_a')
    expect(container.querySelector('[data-shell-part="header"]').textContent).toContain('Option A')

    // ...and the operator is TOLD the tracker is missing, rather than left to notice.
    const page = container.querySelector('[data-shell-part="header"]').parentElement
    expect(page.textContent, 'the ambiguity must be visible on the page').toMatch(/more than one proposal|stage progress unavailable/i)
  })

  it('does not leak the other proposal id into the operator-facing copy', async () => {
    __seedProposal(twin('prop_amb_a', 'Option A'))
    __seedProposal(twin('prop_amb_b', 'Option B'))
    await renderApp(`/action-stories/${STORY}/decide/prop_amb_a`)
    const page = container.querySelector('[data-shell-part="header"]').parentElement
    expect(page.textContent).not.toContain('prop_amb_b')
  })

  it('an unambiguous story shows the tracker and NO notice', async () => {
    await renderApp('/action-stories/S9.1/decide/prop_s9_1_decide')
    const page = container.querySelector('[data-shell-part="header"]').parentElement
    expect(container.querySelector('nav[aria-label="Stage progress"]')).toBeTruthy()
    expect(page.textContent).not.toMatch(/more than one proposal|stage progress unavailable/i)
  })
})
