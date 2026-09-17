// @vitest-environment jsdom
//
// The listing screen, where the parent/child bug was visible: one Action Story used to render as
// four independent cards because the queue returns one row per stage.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

import ActionStoriesHome from './ActionStoriesHome'
import { __resetMockApi } from '@/services/mockDecisionApi'
import decisions from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

async function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ActionStoriesHome />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

const storyCards = () => [...container.querySelectorAll('li')].filter((li) => li.querySelector('h2'))

beforeEach(() => __resetMockApi())
afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('A + I. one card per Action Story, never one per stage', () => {
  it('renders 26 cards for 105 stage-level Decision Objects', async () => {
    await render()
    expect(decisions).toHaveLength(105)
    expect(storyCards()).toHaveLength(26)
  })

  it('renders each story title exactly once', async () => {
    await render()
    const titles = storyCards().map((li) => li.querySelector('h2').textContent.trim())
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('states the parent/child counts honestly', async () => {
    await render()
    expect(container.textContent).toContain('26 stories')
    expect(container.textContent).toContain('105 stages')
  })
})

describe('B + C. each card exposes its stages as links into the SAME story', () => {
  it('shows reason, analyze, decide and execute on a four-stage story', async () => {
    await render()
    const card = storyCards().find((li) => li.textContent.includes('S10.1'))
    const labels = [...card.querySelectorAll('a')].map((a) => a.textContent.trim())
    for (const stage of ['Reason', 'Analyze', 'Decide', 'Execute']) {
      expect(labels.some((l) => l.startsWith(stage)), `missing ${stage}`).toBe(true)
    }
  })

  it('links every stage chip to the same story_code at a different stage', async () => {
    await render()
    const card = storyCards().find((li) => li.textContent.includes('S10.1'))
    const hrefs = [...card.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    // Proposal-addressed since Phase 2 — the listing already has each stage's id in hand, so it
    // links straight to it rather than through StageRedirect.
    expect(hrefs).toEqual([
      '/action-stories/S10.1/reason/prop_s10_1_reason',
      '/action-stories/S10.1/analyze/prop_s10_1_analyze',
      '/action-stories/S10.1/decide/prop_s10_1_decide',
      '/action-stories/S10.1/execute/prop_s10_1_execute',
    ])
  })

  it('shows the five-stage story with its live stage too', async () => {
    await render()
    const card = storyCards().find((li) => li.textContent.includes('S10.6'))
    expect(card.querySelectorAll('a')).toHaveLength(5)
  })
})

describe('G. S10.1–S10.4 remain four DIFFERENT Action Stories', () => {
  it('renders them as four separate cards with four different titles', async () => {
    await render()
    const codes = ['S10.1', 'S10.2', 'S10.3', 'S10.4']
    const cards = codes.map((c) => storyCards().find((li) => li.textContent.includes(c)))
    expect(cards.every(Boolean)).toBe(true)

    const titles = cards.map((li) => li.querySelector('h2').textContent.trim())
    expect(new Set(titles).size).toBe(4)
    // Each is a whole story in its own right, with its own four stages — not a stage of a "Story 10".
    for (const card of cards) expect(card.querySelectorAll('a')).toHaveLength(4)
  })
})
