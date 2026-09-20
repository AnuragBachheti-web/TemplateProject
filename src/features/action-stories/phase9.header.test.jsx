// @vitest-environment jsdom
//
// T132 — THE PINNED STRIP'S RIGHT-HAND BLOCK.
//
// ============================================================================================
// WHAT IS MISSING AND WHERE IT LIVES
// ============================================================================================
//
// Every one of the 106 stage mockups carries two mono lines in the pinned header, right of the
// title and left of the avatar — "41 SKUs · +$9.7K/mo at 82% ± 7" over "Tested headroom ≥$1.10 ·
// <4% volume loss" on S9.11. Ours has never rendered them.
//
// The census found the text is in two different places depending on the mockup:
//
//   29 mockups show `{{ pinnedTop }}` / `{{ pinnedSub }}` unfilled, and their PAYLOAD carries the
//      values — `pinnedTop` on 29 screens, `pinnedSub` on 30. The correspondence is exact.
//   77 mockups show literal text, and it is in the HTML only: of those 77 top lines, ONE appears
//      anywhere in the raw fixtures, and none of the sub lines do.
//
// ============================================================================================
// WHY THE OTHER 76 STAY BLANK (ruling R131)
// ============================================================================================
//
// Recovering them means lifting design copy out of a mockup and into the data layer. This project
// has refused that at every turn — most recently leaving 546 geometry values unclaimed on the same
// principle. Visibly partial and honest beats complete and sourced from the wrong place. The 76 are
// reported in the phase deliverable so Product can decide whether the real engine supplies that
// line; they are not invented here.

import { describe, it, expect } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import App from '@/App'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(HERE, '__corpus__/fixtures/raw')

/** The raw reference payload behind one normalized object. */
function rawOf(id) {
  const m = /^prop_(s\d+)_(\d+)_(\w+)$/.exec(id)
  if (m === null) return {}
  const story = `${m[1].toUpperCase()}.${m[2]}`
  const f = path.join(RAW, story, `${m[3]}.json`)
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).data ?? {}) : {}
}

const WITH_DATA = dataset.filter((d) => {
  const r = rawOf(d.proposal_id)
  return typeof r.pinnedTop === 'string' || typeof r.pinnedSub === 'string'
})

async function renderStage(d) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  window.history.pushState({}, '', `/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
  await act(async () => { root.render(<App />) })
  // The proposal arrives over the mock transport, which has its own latency. Without this settle
  // the page is still in its loading state and EVERY assertion below passes for the wrong reason —
  // which is exactly what the first draft of this test did.
  await act(async () => { await new Promise((r) => setTimeout(r, 400)) })
  return { el, done: () => { act(() => root.unmount()); el.remove() } }
}

describe('T132 — the strip renders where the corpus supplies it, and nowhere else', () => {
  it('measures the real split, so this cannot pass vacuously', () => {
    expect(WITH_DATA.length).toBe(30)
    expect(dataset.length - WITH_DATA.length).toBe(75)
  })

  it('the corpus carries the two lines on exactly those thirty', () => {
    expect(dataset.filter((d) => typeof d.pinned_summary === 'string')).toHaveLength(29)
    expect(dataset.filter((d) => typeof d.pinned_detail === 'string')).toHaveLength(30)
    for (const d of dataset) {
      const has = d.pinned_summary !== undefined || d.pinned_detail !== undefined
      expect(has, `${d.proposal_id}`).toBe(WITH_DATA.includes(d))
    }
  })

  it('and every value is the reference string verbatim — nothing composed (I5)', () => {
    // R1/I5. The header is the one place in this app that states a figure as a sentence, which is
    // exactly where an invented or stitched-together line would be least visible.
    for (const d of WITH_DATA) {
      const r = rawOf(d.proposal_id)
      if (typeof r.pinnedTop === 'string') expect(d.pinned_summary, d.proposal_id).toBe(r.pinnedTop)
      if (typeof r.pinnedSub === 'string') expect(d.pinned_detail, d.proposal_id).toBe(r.pinnedSub)
    }
  })

  it('draws the block, with both lines, on a screen that has it', async () => {
    const d = WITH_DATA[0]
    const { el, done } = await renderStage(d)
    // THE VACUITY GUARD. A page still loading has no strip either, and without this the negative
    // case below would pass on 105 blank screens.
    expect(el.textContent, `${d.proposal_id} never rendered`).toContain(d.title)
    const strip = el.querySelector('[data-fact="pinned-strip"]')
    expect(strip, `${d.proposal_id} renders no pinned strip`).not.toBeNull()
    const txt = strip.textContent.replace(/\s+/g, ' ')
    expect(txt).toContain(d.pinned_summary)
    expect(txt).toContain(d.pinned_detail)
    done()
  })

  it('and draws NOTHING — not an empty box — on a screen that has not', async () => {
    // "A header exists or it doesn't, never a header with nothing in it" (R120), applied to the one
    // element this phase adds. 75 of 105 screens have no strip, so an empty container here would be
    // a stray artefact on most of the app.
    const d = dataset.find((x) => !WITH_DATA.includes(x))
    const { el, done } = await renderStage(d)
    expect(el.textContent, `${d.proposal_id} never rendered`).toContain(d.title)
    expect(el.querySelector('[data-fact="pinned-strip"]'), `${d.proposal_id}`).toBeNull()
    done()
  })

  it('across a sample of both kinds, the strip tracks the data and nothing else', async () => {
    // Ten of each rather than all 105: every render here is a full App mount over the mock
    // transport. The corpus-level split above is what covers all 105; this checks the render
    // follows it.
    const sample = [...WITH_DATA.slice(0, 10), ...dataset.filter((x) => !WITH_DATA.includes(x)).slice(0, 10)]
    const wrong = []
    for (const d of sample) {
      const { el, done } = await renderStage(d)
      if (!el.textContent.includes(d.title)) wrong.push(`${d.proposal_id}: never rendered`)
      else if ((el.querySelector('[data-fact="pinned-strip"]') !== null) !== WITH_DATA.includes(d)) {
        wrong.push(d.proposal_id)
      }
      done()
    }
    expect(wrong).toEqual([])
  }, 60000)  // 20 full App mounts, each waiting out the mock transport's latency
})
