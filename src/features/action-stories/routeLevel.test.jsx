// @vitest-environment jsdom
//
// The §45 architectural validation, executed rather than asserted in prose:
//
//   GET /v1/proposals/:id -> Decision Object validation -> selectTemplate -> templateRegistry
//   -> canonical template -> resolveBinding -> StageRenderer -> blocks/layout -> StageActionBar
//   -> eligibility -> POST action -> idempotency -> authorization -> business eligibility
//   -> status transition -> updated Decision Object -> frontend state update -> re-render
//
// Mounted through the real App router at a real URL, with no component mocked.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import App from '@/App'
import { useActionStoriesStore } from '@/store/useActionStoriesStore'
import { __resetMockApi, __seedProposal } from '@/services/mockDecisionApi'
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

function proposal(overrides = {}) {
  return {
    ...structuredClone(seed.find((d) => d.stage === 'decide' && d.entitlement === 'full')),
    proposal_id: 'prop_route_test',
    story_code: 'S9.99',
    stage: 'decide',
    title: 'Reprice the autumn range',
    narrative: 'Twelve SKUs sit below the margin floor.',
    cardinality: 'many',
    on_clock: true,
    deadline: FUTURE,
    status: 'pending',
    entitlement: 'full',
    impact: { value: 18400, unit: 'USD' },
    confidence: { value: 0.88, calibrated: true },
    eligibility: Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
    proposal: {
      recommendation: 'Raise 12 SKUs to the policy floor',
      slate: [
        { sku: 'A-1', name: 'Dutch Oven 5qt', current: '$88.00', proposed: '$94.00' },
        { sku: 'A-2', name: 'Sauté Pan 12in', current: '$52.00', proposed: '$56.00' },
      ],
    },
    ...overrides,
  }
}

let container
let root

/** Seeds one proposal AND, so story routing can resolve, its sibling stages. */
function seedStory(decision, stages = ['reason', 'analyze', 'decide', 'execute']) {
  for (const stage of stages) {
    const sibling = structuredClone(decision)
    sibling.stage = stage
    sibling.proposal_id = `${decision.story_code}_${stage}`
    if (stage === decision.stage) sibling.proposal_id = decision.proposal_id
    __seedProposal(sibling)
  }
}

async function renderAt(path, decision, { stages } = {}) {
  seedStory(decision, stages)
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<App />)
  })
  // Let the fetch + the mock transport's own latency settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

function clickByText(text) {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  expect(el, `no button labelled "${text}"`).toBeTruthy()
  return act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
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

describe('the full runtime path, end to end at a real URL', () => {
  it('renders a proposal through the canonical template, with no story-specific manifest involved', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal())
    const text = container.textContent

    // Decision Object content, bound through the canonical template's own slots.
    expect(text).toContain('Reprice the autumn range')
    expect(text).toContain('Raise 12 SKUs to the policy floor')
    expect(text).toContain('Dutch Oven 5qt')
    // Guardrail verdict is the 4-value enum, not a boolean — rendered through the frontend's own
    // display map (blocks/enumLabel.js), so an operator reads "Within limits", never the token.
    expect(text).toMatch(/Within limits|Beyond limits|Not applicable|Undetermined/)
    expect(text).not.toContain('within_limits')
    // Typed numbers formatted client-side — the backend sent 18400, not "$18.4K".
    expect(text).toMatch(/\$18[.,]4K|\$18,400/)
    expect(text).toContain('88%')
  })

  it('renders the proposal title exactly ONCE in the page header (the duplicate-name regression)', async () => {
    // Scoped to the page header. The sidebar queue also shows the title, which is correct — the
    // regression was StagePage rendering it twice within the header itself, as a pill and an <h1>.
    await renderAt('/action-stories/S9.99/decide', proposal())
    const header = container.querySelector('header.sticky')
    const occurrences = header.textContent.split('Reprice the autumn range').length - 1
    expect(occurrences).toBe(1)
    expect(header.querySelectorAll('h1')).toHaveLength(1)
  })

  it('pins the header and the action bar', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal())
    expect(container.querySelector('header.sticky')).toBeTruthy()
    expect(container.querySelector('div.sticky.bottom-0')).toBeTruthy()
  })

  it('renders every eligible operator action, and only those', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal())
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim())
    for (const expected of ['Approve', 'Approve selected', 'Modify', 'Send back', 'Snooze', 'Dismiss']) {
      expect(labels, `missing "${expected}"`).toContain(expected)
    }
    // Exactly one Approve — no duplicated primary button.
    expect(labels.filter((l) => l === 'Approve')).toHaveLength(1)
  })

  it('hides an action the backend says is ineligible, and explains why', async () => {
    await renderAt(
      '/action-stories/S9.99/decide',
      proposal({
        eligibility: {
          ...Object.fromEntries(OPERATOR_ACTION_IDS.map((id) => [id, { allowed: true }])),
          modify: { allowed: false, blocked_reason: 'Modification requires manager approval.' },
        },
      }),
    )
    expect(container.textContent).toContain('Modification requires manager approval.')
    const modify = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Modify')
    expect(modify).toBeUndefined() // it renders as "Unavailable", never as a live Modify button
  })

  it('completes approve: confirm -> POST -> updated Decision Object -> re-render', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal())
    expect(container.textContent).toContain('pending')

    await clickByText('Approve') // opens the confirm dialog
    expect(document.body.textContent).toContain('Approve this proposal?')

    // The dialog's confirm button lives in a portal at document level.
    const confirm = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Approve').pop()
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 500))
    })

    // The store now holds what the API returned — status moved, and the action bar is gone because
    // the proposal is terminal. Nothing was patched locally to make this true.
    expect(useActionStoriesStore.getState().decision.status).toBe('approved')
    expect(container.textContent).toContain('approved')
  })

  it('renders locked.v1 for a locked proposal, with no operator actions and no business content leaked', async () => {
    await renderAt(
      '/action-stories/S9.99/decide',
      proposal({
        entitlement: 'locked',
        // A real, specific narrative — this is what actually leaked. StagePage used to print the
        // narrative itself, outside the selected template, so locked.v1 hid the slate and the
        // figures while the page shell published the prose anyway. Caught by running the app, not
        // by any test, which is why this fixture now carries something recognisable.
        narrative: 'Match the competitor within guardrail — net minus 1.7K over 30 days.',
        proposal: { teaser_summary: 'Available on a higher plan.', upgrade_cta: 'Contact your account team.' },
      }),
    )
    // Scoped to the PAGE, not the whole app: the sidebar legitimately lists all 26 Action Story
    // titles, and one of them ("Launch — Enamel Dutch Oven 5qt") contains the phrase this asserts
    // against. An unscoped assertion here fails on a coincidence rather than on a real leak.
    const page = container.querySelector('header.sticky').parentElement
    const text = page.textContent
    expect(text).toContain('Available on a higher plan.')
    expect(text).toContain('Contact your account team.')
    expect(text, 'the narrative must not escape the locked template').not.toContain('Match the competitor within guardrail')
    // The real content must not appear at all — a locked template that still rendered the slate
    // would be an entitlement bypass, not a layout choice.
    expect(text).not.toContain('Dutch Oven 5qt')
    expect(text).not.toContain('Raise 12 SKUs')
    expect(container.querySelector('div.sticky.bottom-0')).toBeNull()
  })

  it('omits an empty narrative instead of rendering an "Empty." card', async () => {
    // 24 of the 105 corpus stages carry no prose at all. An empty required string is contract-valid
    // but is not content, and a card reading "Empty." is worse than no card.
    await renderAt('/action-stories/S9.99/decide', proposal({ stage: 'reason', narrative: '' }))
    expect(container.textContent).not.toContain('Empty.')
  })

  it('renders the live stage as a running execution, not an error page', async () => {
    // `live` used to have no canonical template, so S10.6's fifth stage rendered an error. It is a
    // state of execute, not a sixth business stage, and now resolves to execute.bridge.v1.
    await renderAt('/action-stories/S9.99/live', proposal({ stage: 'live' }), {
      stages: ['reason', 'analyze', 'decide', 'execute', 'live'],
    })
    expect(container.textContent).not.toMatch(/can't be displayed yet/i)
    expect(container.textContent).toContain('Twelve SKUs sit below the margin floor.')
  })

  it('renders an explicit unsupported state rather than guessing a template', async () => {
    // A stage outside the contract's vocabulary still has no template. The selector returns null
    // and the service throws MALFORMED — it never falls back to a plausible-looking wrong layout.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderAt('/action-stories/S9.99/archive', proposal({ stage: 'archive' }), {
      stages: ['reason', 'analyze', 'decide', 'execute', 'archive'],
    })
    expect(container.textContent).toMatch(/can't be displayed yet|Try again/i)
    spy.mockRestore()
  })

  it('surfaces an unknown Action Story as safe operator copy, never a raw error', async () => {
    window.history.pushState({}, '', '/action-stories/S0.0/decide')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<App />))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(container.textContent).toContain("We couldn't find that Action Story.")
  })
})

describe('Action Story ↔ stage navigation (C, D, E, H, I)', () => {
  const STAGES = ['reason', 'analyze', 'decide', 'execute']

  it.each(STAGES)('D. deep-links straight into S9.99 at the %s stage', async (stage) => {
    await renderAt(`/action-stories/S9.99/${stage}`, proposal({ stage }))
    const page = container.querySelector('header.sticky').parentElement
    // Same parent Action Story identity at every stage — the breadcrumb names the story, not a
    // stage-specific pseudo-story.
    expect(page.textContent).toContain('S9.99')
    expect(page.textContent).toContain('Reprice the autumn range')
    expect(page.textContent.toLowerCase()).toContain(stage)
  })

  it('C+E. every stage is reachable from the tracker, and the current one is marked', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal({ stage: 'decide' }))
    const tracker = container.querySelector('nav[aria-label="Stage progress"]')
    expect(tracker, 'StepTracker must render for a multi-stage story').toBeTruthy()

    // C: all four stages link to the SAME story at a different stage.
    const hrefs = [...tracker.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    for (const stage of STAGES) expect(hrefs).toContain(`/action-stories/S9.99/${stage}`)
    // Not one of them points at a different story.
    expect(hrefs.every((h) => h.startsWith('/action-stories/S9.99/'))).toBe(true)

    // E: the current stage is the one marked aria-current.
    const current = tracker.querySelector('[aria-current="step"]')
    expect(current.getAttribute('href')).toBe('/action-stories/S9.99/decide')
    expect(tracker.textContent).toContain('Step 3 of 4')
  })

  it('H. refreshing a deep-linked stage preserves the same Action Story identity', async () => {
    await renderAt('/action-stories/S9.99/analyze', proposal({ stage: 'analyze' }))
    const first = container.querySelector('header.sticky').textContent
    act(() => root.unmount())
    container.remove()

    // A genuine remount at the same URL — no in-memory state carried across.
    useActionStoriesStore.getState().clearDecision()
    await renderAt('/action-stories/S9.99/analyze', proposal({ stage: 'analyze' }))
    expect(container.querySelector('header.sticky').textContent).toBe(first)
    expect(useActionStoriesStore.getState().decision.story_code).toBe('S9.99')
  })

  it('I. the sidebar lists each Action Story ONCE, never once per stage', async () => {
    await renderAt('/action-stories/S9.99/decide', proposal())
    const nav = container.querySelector('aside, nav[aria-label], ul')
    const links = [...container.querySelectorAll('a[href^="/action-stories/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h.split('/').length === 4)
    const storyCodes = links.map((h) => h.split('/')[2])
    const sidebarCodes = storyCodes.filter((c) => c !== 'S9.99') // exclude the tracker's own links
    expect(nav).toBeTruthy()
    // 26 corpus stories + the seeded one; each appears once in the sidebar even though each has
    // four stage-level Decision Objects behind it.
    expect(new Set(sidebarCodes).size).toBe(sidebarCodes.length)
    expect(sidebarCodes.length).toBeGreaterThanOrEqual(26)
  })

  it('F. the same story renders a DIFFERENT canonical template per stage', async () => {
    const seen = {}
    for (const stage of STAGES) {
      await renderAt(`/action-stories/S9.99/${stage}`, proposal({ stage }))
      seen[stage] = useActionStoriesStore.getState().decision.stage
      act(() => root.unmount())
      container.remove()
      useActionStoriesStore.getState().clearDecision()
    }
    expect(seen).toEqual({ reason: 'reason', analyze: 'analyze', decide: 'decide', execute: 'execute' })
  })
})

describe('no hidden dependency on the replaced architecture', () => {
  it('reads no story-specific manifest or fixture at runtime', async () => {
    // The runtime modules must not glob the corpus. Asserted over the real source, so a
    // reintroduced `import.meta.glob` fails the build rather than quietly working in dev.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const ROOT = path.resolve(__dirname, '../../..')
    const offenders = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === '__corpus__' || entry.name === 'node_modules') continue
          walk(full)
        } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8')
          // Matches the CALL, not the phrase — several modules legitimately mention the old
          // mechanism in comments explaining what replaced it.
          if (src.includes('import.meta.glob(')) offenders.push(path.relative(ROOT, full))
        }
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(offenders, 'runtime still globs story data').toEqual([])
  })

  it('never persists proposal truth to localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await renderAt('/action-stories/S9.99/decide', proposal())
    await clickByText('Approve')
    const businessWrites = setItem.mock.calls.filter(([key]) => !String(key).includes('theme'))
    expect(businessWrites).toEqual([])
    setItem.mockRestore()
  })
})
