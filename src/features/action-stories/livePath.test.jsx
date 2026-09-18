// @vitest-environment jsdom
//
// Phase 2.1, T16: THE TEST GAP, closed.
//
// The app was broken while 1386 tests were green, and that is the defect this file exists for. The
// suite had three kinds of coverage and a hole exactly between them:
//
//   contractExtension.test.js  fed the 105 objects to the VALIDATOR directly
//   renderRegression.test.js   fed 4 objects to the RENDERER directly
//   routeLevel.test.jsx        drove the real App through the real router — with ONE synthetic
//                              proposal (`prop_route_test`) that it seeded itself
//
// So nothing ever took a SHIPPED object through the whole chain. A corpus that the validator
// accepts in isolation, and a renderer that renders a fixture in isolation, can still fail together
// the moment the transport is in the middle — because the transport re-validates every response
// (decisionApi.js:82), and a summary row is a DIFFERENT shape from the object it came from
// (toProposalSummary + validateDecisionObjectSummary). Either of those rejecting is a MALFORMED,
// and MALFORMED is the operator copy "We got an unexpected response. Please try again."
//
// WHAT THIS TEST REFUSES TO DO: build its own fixtures. Every object here is one the app actually
// ships, fetched the way the app fetches it. A sweep that seeds its own proposals would have passed
// yesterday too.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import App from '@/App'
import StageRenderer from './components/StageRenderer'
import StageActionBar from './components/StageActionBar'
import { ToastProvider } from './ui/Toast'
import { getStageView, getProposalQueue } from '@/services/actionStoriesService'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi } from '@/services/mockDecisionApi'
import { __resetEligibilityDriftLog } from './contract/deriveEligibility'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

/** The copy an operator sees when any layer of the response path gives up. */
const ERROR_COPY = /We got an unexpected response|Something went wrong|couldn't find that Action Story|can't be displayed yet|Try again/i

let container
let root
let consoleErrors

beforeEach(() => {
  __resetMockApi()
  __resetEligibilityDriftLog()
  useActionStoriesStore.getState().clearDecision()
  consoleErrors = []
  vi.spyOn(console, 'error').mockImplementation((...args) => consoleErrors.push(args.map(String).join(' ')))
  vi.spyOn(console, 'warn').mockImplementation((...args) => consoleErrors.push(args.map(String).join(' ')))
})

afterEach(() => {
  vi.restoreAllMocks()
  act(() => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

describe('T16 — all 105 shipped objects survive the FULL live path, transport included', () => {
  it('the queue endpoint serves and re-validates every row', async () => {
    // `GET /v1/proposals` returns SUMMARIES, not objects, and decisionApi validates each row against
    // validateDecisionObjectSummary. That is a second shape with a second validator, and it is the
    // shape a required-and-nullable field is most likely to break — which is exactly what happened
    // in Phase 2 (impact: null tripped the summary validator's typed-number check).
    const { items } = await getProposalQueue({ limit: 200 })
    expect(items).toHaveLength(105)
    expect(consoleErrors, 'the transport logged a validation problem').toEqual([])
  })

  it('getStageView resolves every one of the 105 by its own story/stage/proposal id', async () => {
    // The transport is genuinely in the middle: getStageView -> getProposal -> decisionApi ->
    // validateDecisionObject -> the mock API, plus listProposals for the story outline. Nothing here
    // is handed a fixture.
    const results = await Promise.all(
      dataset.map((d) =>
        getStageView(d.story_code, d.stage, d.proposal_id)
          .then((view) => ({ id: d.proposal_id, ok: true, view }))
          .catch((error) => ({ id: d.proposal_id, ok: false, code: error?.code, message: error?.message })),
      ),
    )

    const failures = results.filter((r) => !r.ok).map((r) => `${r.id}: [${r.code}] ${r.message}`)
    expect(failures, `${failures.length} of 105 failed the live path`).toEqual([])

    // And every one produced something renderable, so "resolved" cannot mean "resolved to nothing".
    for (const r of results) {
      expect(r.view.decision.proposal_id, r.id).toBe(r.id)
      expect(r.view.manifest.blocks.length, `${r.id} resolved an empty manifest`).toBeGreaterThan(0)
      expect(r.view.templateId, r.id).toBeTruthy()
    }
    expect(results).toHaveLength(105)
  })

  it('every one of the 105 renders a non-trivial pane with no error state', async () => {
    // Rendered from what the TRANSPORT returned, not from the dataset import — so a field the
    // transport strips, rejects or reshapes shows up here.
    const views = await Promise.all(dataset.map((d) => getStageView(d.story_code, d.stage, d.proposal_id)))

    const broken = []
    for (const view of views) {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      act(() => {
        root.render(
          <ToastProvider>
            <StageRenderer manifest={view.manifest} fixture={view.decision} />
            <StageActionBar actions={view.manifest.actions} />
          </ToastProvider>,
        )
      })
      const text = container.textContent ?? ''
      if (ERROR_COPY.test(text)) broken.push(`${view.decision.proposal_id}: error copy rendered`)
      if (text.replace(/\s+/g, ' ').trim().length < 50) broken.push(`${view.decision.proposal_id}: rendered almost nothing`)
      act(() => root.unmount())
      container.remove()
      root = undefined
      container = undefined
    }

    expect(broken, `${broken.length} of 105 rendered badly`).toEqual([])
  })

  it('the whole sweep is silent — no validation warning, no drift warning, no tracker error', async () => {
    // A green sweep that screams into the console is not green. This catches the I5 drift warning
    // firing on a shipped object (it must not — payload and derived agree on all 105) and the
    // ambiguous-story console.error from actionStoriesService.
    await Promise.all(dataset.map((d) => getStageView(d.story_code, d.stage, d.proposal_id)))
    expect(consoleErrors.slice(0, 5)).toEqual([])
  })
})

describe('T16 — the real App, at real URLs, for one object per template and every stage of S10.2', () => {
  /** Mounts the real App at a real URL and lets the transport settle. */
  async function renderAt(pathname) {
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
    return container.textContent ?? ''
  }

  const SPECIMENS = [
    ...dataset.filter((d) => d.story_code === 'S10.2'),
    ...['prop_s9_1_reason', 'prop_s9_1_analyze', 'prop_s9_1_decide', 'prop_s9_1_execute', 'prop_s10_6_live'].map((id) =>
      dataset.find((d) => d.proposal_id === id),
    ),
  ].filter(Boolean)

  it('covers the four templates, the live stage, and all four S10.2 stages', () => {
    expect(SPECIMENS.length).toBeGreaterThanOrEqual(9)
    expect(SPECIMENS.filter((d) => d.story_code === 'S10.2')).toHaveLength(4)
  })

  it.each(SPECIMENS.map((d) => [`${d.story_code}/${d.stage}/${d.proposal_id}`, d]))(
    '%s renders through the router with no error copy',
    async (_label, d) => {
      // THE EXACT SHAPE OF THE REPORTED FAILURE: a three-segment URL that routes fine and then dies
      // in the response path. Asserted on the page, not on a service return value.
      const text = await renderAt(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)

      expect(ERROR_COPY.test(text), `${d.proposal_id} rendered operator error copy`).toBe(false)
      expect(container.querySelector('[data-shell-part="header"]'), `${d.proposal_id} rendered no page header`).toBeTruthy()
      expect(text, `${d.proposal_id} did not render its own title`).toContain(d.title)
      expect(useActionStoriesStore.getState().decision?.proposal_id, d.proposal_id).toBe(d.proposal_id)
    },
  )

  it('the legacy two-segment URL for S10.2 still redirects and renders (C4)', async () => {
    const text = await renderAt('/action-stories/S10.2/reason')
    expect(ERROR_COPY.test(text)).toBe(false)
    expect(window.location.pathname).toBe('/action-stories/S10.2/reason/prop_s10_2_reason')
  })
})
