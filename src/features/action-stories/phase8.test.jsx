// @vitest-environment jsdom
//
// PHASE 8 — T120, T121, T123, T124, T125, T127. The browser halves (T119's white-on-white nesting,
// T122's rendered tint and T126's clipping) are in scripts/smoke.mjs, because a nested card being
// invisible is a fact about computed backgrounds and jsdom has no renderer.
//
// WHAT THIS PHASE IS. Phase 7 built the token layer correctly — a real surface scale, blue on
// interactive and current, three label levels, a clay chart ramp. What it did not do is make
// components USE those tokens to build structure, so the app still read as boxes with data in them.
// Every fix here is a component asking for a token it already had.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'
import before from '@/features/action-stories/__corpus__/__snapshots__/phase8-before-render.json'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (rel) => fs.readFileSync(path.join(HERE, rel), 'utf8')
const codeLines = (text) =>
  text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*(\/\/|\*|\/\*|\{\/)/.test(l))
const code = (rel) => codeLines(read(rel)).map(([, l]) => l).join('\n')

function renderPane(d) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const resolved = resolveTemplate(d)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(<StageRenderer manifest={resolved.manifest} fixture={d} />))
  return { el, done: () => { act(() => root.unmount()); el.remove() } }
}

describe('T120 — one card header treatment, everywhere (I2)', () => {
  it('the header zone is declared once, in BlockCard, and nowhere else', () => {
    // A card's name and its contents were the same visual object: a bold line at the top of a body
    // with no divider, no ground and no consistent spacing. One treatment now — title, optional
    // right-aligned meta, a rule beneath — and it lives in one component so it cannot vary.
    const card = read('blocks/BlockCard.jsx')
    expect(card, 'BlockCard declares no header zone').toMatch(/data-card-header/)
    const others = ['blocks/CardSetBlock.jsx', 'components/StageSections.jsx', 'blocks/ItemQueueBlock.jsx']
    for (const f of others) {
      expect(code(f), `${f} draws its own card header`).not.toMatch(/data-card-header/)
    }
  })

  it('A HEADER EXISTS OR IT DOES NOT — never a header with nothing in it (R120)', () => {
    // THE GENERAL FORM OF A DEFECT THIS PROJECT KEEPS HITTING: an empty structure rendering as a
    // visible artefact. A card with no title must render no header zone and no divider, or the
    // divider becomes a line under nothing — which is what a reader sees as a stray band.
    const card = read('blocks/BlockCard.jsx')
    expect(card, 'the rule is not stated where the header is built').toMatch(/exists or it does not/i)
    // STRUCTURAL, not a promise in prose: the component returns before it renders anything when
    // there is no title, so there is no path that produces a header zone with nothing in it.
    expect(code('blocks/BlockCard.jsx'), 'nothing stops an empty header rendering')
      .toMatch(/if \(empty\) return null/)
  })
})

describe('T121 — the action bar is one region with a stated grouping (R116)', () => {
  const bar = () => code('components/StageActionBar.jsx')

  it('there are exactly three button treatments in the bar, and destructive is not one', () => {
    // FOUR treatments in one region was the defect: a blue Approve, a white Modify, a red Dismiss
    // and a black Continue, with the two most consequential actions side by side in different
    // colours and nothing saying which was primary. `destructive` stays in Button's palette for
    // ConfirmDialog, where a destructive confirmation is the whole point.
    const used = new Set([...bar().matchAll(/variant=["'{]?\s*['"]?(primary|secondary|ghost|destructive)['"]?/g)]
      .map((m) => m[1]))
    expect([...used].sort()).toEqual(['ghost', 'primary', 'secondary'])
    expect(bar(), 'the bar still renders a destructive button').not.toMatch(/['"]destructive['"]/)
  })

  it('the bar declares its groups, so the order is a rule rather than a layout accident', () => {
    // The reference settles the shape: S10.1-3-decide.dc.html around line 400 is ONE row —
    // {{ footStatus }}, {{ blockReason }}, "Send back to Analyze", {{ ctaLabel }}. State left,
    // actions right, the forward action last.
    for (const marker of ['data-bar-group="state"', 'data-bar-group="secondary"', 'data-bar-group="primary"']) {
      expect(bar(), `the bar does not mark its ${marker} group`).toContain(marker)
    }
  })

  it('and it is ONE row — a wrapped bar is the two-row defect returning', () => {
    expect(bar(), 'the bar still wraps').not.toMatch(/\bflex-wrap\b/)
  })
})

describe('T123 — rail rows share one treatment (I2)', () => {
  it('there is a single row primitive and the rail uses it', () => {
    // Measured before: border-top 0px, border-bottom 0px, padding 7px/7px on one row and 0px/0px on
    // three. Label/value pairs with no row structure at all.
    expect(fs.existsSync(path.join(HERE, 'blocks/children/RailRow.jsx')), 'no rail row primitive').toBe(true)
    const row = read('blocks/children/RailRow.jsx')
    expect(row, 'the row draws no divider').toMatch(/border-b/)
    expect(row, 'the divider does not stop at the last row').toMatch(/last:border-0/)
  })

  it('no block spells its own label/value row', () => {
    const offenders = []
    // THE RAIL'S PAIRS ARE TextBlock'S — `guardrail_verdict` and `decision_persona` both declare
    // blockType `text`, so the rows the survey measured are rendered there and not by a list block.
    // The first draft of this test named ObjectBlock on an assumption and would have passed while
    // the rail still floated; checking which slot renders what is what corrected it.
    for (const f of ['blocks/LabelValueListBlock.jsx', 'blocks/TextBlock.jsx']) {
      if (!fs.existsSync(path.join(HERE, f))) continue
      if (!/RailRow/.test(code(f))) offenders.push(`${f} does not use the row primitive`)
    }
    expect(offenders).toEqual([])
  })
})

describe('T124 — no empty card renders, on any of the 105 (defect 6: NOT REPRODUCED)', () => {
  // RECORDED AS NOT REPRODUCED, with what was measured, at the same standing as Phase 5D's "Value"
  // header (R64). The brief reported a white band above the first block on S9.18 and S9.1 at 1440.
  // Measured: [data-scroll-region="main"] has exactly two children on both — a 668px div carrying
  // five slots and 440 characters, and a 1440px section carrying three — and neither is empty.
  // Rendering all 105 and counting blocks whose text is under two characters gives ZERO.
  //
  // R117 withdrew the defect and kept this as the pin: the most likely thing in the screenshot was
  // the untitled top of the recommendation_identity card, which T120's header rule now removes,
  // because a card with no title renders no header zone at all.
  it('every rendered block says something', () => {
    const empty = []
    for (const d of dataset) {
      const { el, done } = renderPane(d)
      for (const b of el.querySelectorAll('[data-block-slot]')) {
        const t = (b.textContent || '').trim()
        if (t.length < 2) empty.push(`${d.proposal_id}·${b.getAttribute('data-block-slot')}`)
      }
      done()
    }
    expect(empty, 'a block renders as an empty card').toEqual([])
  })
})

describe('T125 — semantic colour reaches what carries meaning, and nothing else (I5/R118)', () => {
  // EVERY FIELD IN THE CORPUS THAT COULD CARRY MEANING, measured, with the verdict on each:
  //
  //   verdict     within_limits x9, beyond_limits x3, not_applicable x93   -> COLOUR
  //   severity    high/medium/critical/blocking/warning/low                -> COLOUR
  //   level       critical/high/medium/low                                 -> COLOUR
  //   status      pass x62, warn x6, blocked x10 (+ lifecycle words)       -> the health words only
  //   flag        "Lowest risk", "buy box lost", "best ratio"              -> NO
  //   lane        "DC-East -> FBA-West"                                    -> NO
  //   state       "in batch", "below", "ready today", "off"                -> NO
  //   kind        operational / legal / listing fix                        -> NO
  //   risk, band  "-$4.8K", "Sep 02 +/- 4 d"                               -> NO (a figure; a date)
  //
  // THE THREE REFUSALS ARE THE POINT. The brief asked for flags, lane markers and row states to
  // carry colour. Each would mean reading prose and deciding it is bad news — a classifier on
  // wording inside a component, which R72 declined and R88 deleted after measuring 30 of 30 wrong.
  // Ruling R118 agreed and named why: the invariant holding against the person who wrote it is the
  // point of having it.
  it('statusTone is still the only module that maps a word to a tone', () => {
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { if (e.name === '__corpus__') continue; walk(full); continue }
        if (!/\.jsx$/.test(e.name) || /\.test\./.test(e.name)) continue
        for (const [n, line] of codeLines(fs.readFileSync(full, 'utf8'))) {
          if (!/[?:]/.test(line)) continue
          const tones = new Set([...line.matchAll(/rf-status-([a-z]+)/g)].map((m) => m[1]))
          if (tones.size > 1) offenders.push(`${path.relative(HERE, full)}:${n}`)
        }
      }
    }
    walk(HERE)
    expect(offenders, 'a component is choosing between tones for itself').toEqual([])
  })

  it('a verdict earns a tone, and prose fields still earn none', () => {
    const { verdictTone } = require('./blocks/statusTone')
    expect(verdictTone('within_limits').text).toMatch(/success/)
    expect(verdictTone('beyond_limits').text).toMatch(/critical/)
    expect(verdictTone('not_applicable'), 'not_applicable is not a verdict about health').toBeNull()
    expect(verdictTone('Scale + transfer'), 'free text is not a verdict').toBeNull()
  })

  it('and nothing maps the refused fields', () => {
    const tone = read('blocks/statusTone.js')
    for (const refused of ['buy box lost', 'Lowest risk', 'in batch', 'ready today', 'DC-East']) {
      expect(tone, `statusTone has started reading ${refused}`).not.toContain(refused)
    }
  })
})

describe('T127 — nothing changed but presentation (I6)', () => {
  it('measures the whole corpus, so this cannot pass vacuously', () => {
    expect(Object.keys(before)).toHaveLength(105)
  })

  it('every object renders the same block set', () => {
    const changed = []
    for (const d of dataset) {
      const { el, done } = renderPane(d)
      const slots = [...el.querySelectorAll('[data-block-slot]')].map((n) => n.getAttribute('data-block-slot'))
      done()
      if (JSON.stringify(slots) !== JSON.stringify(before[d.proposal_id].slots)) {
        changed.push(`${d.proposal_id}: ${before[d.proposal_id].slots.length} -> ${slots.length}`)
      }
    }
    expect(changed).toEqual([])
  })

  it('and the same rendered TEXT, to the character', () => {
    // R111 turns one slot from a table into cards. Every string it moves is accounted for
    // individually in phase8.slate.test.jsx rather than regenerated here — R75's rule.
    const changed = []
    for (const d of dataset) {
      const { el, done } = renderPane(d)
      const strings = []
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let n; while ((n = w.nextNode())) { const t = (n.textContent || '').replace(/\s+/g, ' ').trim(); if (t) strings.push(t) }
      done()
      const was = before[d.proposal_id]
      if (JSON.stringify(strings.sort()) !== JSON.stringify(was.text)) {
        const gone = was.text.filter((s) => !strings.includes(s)).slice(0, 3)
        const added = strings.filter((s) => !was.text.includes(s)).slice(0, 3)
        changed.push(`${d.proposal_id}: -${JSON.stringify(gone)} +${JSON.stringify(added)}`)
      }
    }
    expect(changed, 'a presentation change altered what the page says').toEqual([])
  })
})
