// @vitest-environment jsdom
//
// Phase 5C, T62-T72: the pane as a fixed-height, independently scrolling, action-terminated shell,
// and a block's width as a DECLARATION rather than an inference.
//
// WHAT THE SURVEY FOUND, and it reframes the phase. A span mechanism already existed:
// layout/blockSizing.js's `inferSpan(blockType, value)` branched on blockType and then MEASURED the
// content — column counts, average text weight, plotted-point counts, key counts — to choose a
// width. That is the shape-guessing defect this project removed from the renderer in Phase 3B and
// from the claim ledger in Phase 5A, alive in the layout layer and unnamed until now. It reached
// 9 rows out of 338, so it was never load-bearing; it was a latent third instance of one mistake.
// Ruling R58 deletes it. A declared span is now the ONLY source of width, which is invariant I1
// stated as code rather than as a rule.
//
// WHAT jsdom CAN AND CANNOT ASSERT, stated once here rather than implied per test. jsdom has no
// layout engine: every offsetHeight, scrollHeight and getBoundingClientRect is 0. So no test below
// claims to measure a pixel. T62, T63 and T70 assert the STRUCTURAL CONTRACT that produces the
// behaviour — which element owns `overflow-y-auto`, which elements sit outside every scroll
// container, that the scrollable region is a `min-h-0` grid child — because that contract is
// checkable here and a pixel is not. Where a test would be vacuous it says so and asserts the
// reachable thing instead, rather than passing on a measurement jsdom cannot make.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import App from '@/App'
import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import { resolveBinding } from './manifests/resolveBinding'
import { evaluateCondition } from './manifests/actionCondition'
import { SLOT_VOCABULARY } from './templates/slotVocabulary'
import { composeSections } from './layout/composeSections'
import { packRow, SPANS, spanOf } from './layout/packRows'
import { STAGE_ORDER } from './actionStory'
import dataset from './__corpus__/normalized/dataset.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

let container
let root

/**
 * Renders one pane into its OWN root, isolated from the module-level one `renderApp` uses.
 *
 * They shared a root at first, and the suite failed in ways that vanished when a test was run
 * alone: mounting the whole App (async, routed, with timers) and then a bare StageRenderer through
 * the same `root`/`container` pair leaks a half-settled tree into the next test, which React
 * reports as "overlapping act() calls" and which surfaces as an empty container three tests later.
 * A synchronous render needs no shared state, so it does not get any.
 *
 * @returns {{container: HTMLElement, done: () => void}}
 */
function renderPaneIsolated(decision) {
  const resolved = resolveTemplate(decision)
  if (!resolved) return null
  const own = document.createElement('div')
  document.body.appendChild(own)
  const ownRoot = createRoot(own)
  act(() => {
    ownRoot.render(<StageRenderer manifest={resolved.manifest} fixture={decision} />)
  })
  return {
    container: own,
    done: () => {
      act(() => ownRoot.unmount())
      own.remove()
    },
  }
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
  return container
}

function unmount() {
  if (root) act(() => root.unmount())
  container?.remove()
  root = undefined
  container = undefined
}

// ASYNC, and it flushes. `renderApp` mounts the whole routed App with real timers; without a
// settle step after unmounting it, React's act environment is still mid-flight when the next test
// starts, and the symptom is not an error — it is a LATER test rendering into an empty container
// and reporting that every block disappeared. Three tests failed that way and passed in isolation
// before this was added, which is the signature worth recording: a green-alone/red-together suite
// is an act-cleanup problem, not a product one.
afterEach(async () => {
  unmount()
  await act(async () => {})
  document.body.replaceChildren()
})

/** The five objects every prior phase used as its cross-template specimens. */
const SPECIMENS = ['prop_s9_1_reason', 'prop_s9_1_analyze', 'prop_s9_1_decide', 'prop_s9_1_execute', 'prop_s10_6_live']
const byId = (id) => dataset.find((d) => d.proposal_id === id)

/** The main-region blocks of one object, per section, in declared order — what the packer sees. */
function mainSectionsOf(decision) {
  const resolved = resolveTemplate(decision)
  if (!resolved) return []
  const { manifest } = resolved
  const railSections = new Set((manifest.sections ?? []).filter((s) => s.region === 'rail').map((s) => s.id))
  const bySection = new Map()
  for (const block of manifest.blocks) {
    if (block.when !== undefined && !evaluateCondition(block.when, decision)) continue
    if (resolveBinding(block.binding, decision) === undefined) continue
    if (railSections.has(block.section)) continue
    if (!bySection.has(block.section)) bySection.set(block.section, [])
    bySection.get(block.section).push(block.slotName)
  }
  return [...bySection.values()]
}

// ---- T62 -----------------------------------------------------------------------------------------

describe('T62 — the document body does not scroll; each region owns its own overflow (I6)', () => {
  it.each(SPECIMENS)('%s: the pane declares exactly two independent scroll regions', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const scrollers = [...c.querySelectorAll('[data-scroll-region]')]
    // Main always; rail only when the object has rail content. Never zero, never the whole page.
    expect(scrollers.length, `${id}: scroll regions`).toBeGreaterThanOrEqual(1)
    expect(scrollers.map((n) => n.getAttribute('data-scroll-region')).sort()).toEqual(
      c.querySelector('aside') ? ['main', 'rail'] : ['main'],
    )
    for (const node of scrollers) {
      expect(node.className, `${id}: a scroll region without its own overflow`).toContain('overflow-y-auto')
      // A grid/flex child only scrolls if it is allowed to be shorter than its content.
      expect(node.className, `${id}: a scroll region that cannot shrink`).toMatch(/min-h-0/)
    }
    unmount()
  })

  it.each(SPECIMENS)('%s: nothing between the body and the regions scrolls', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const region = c.querySelector('[data-scroll-region="main"]')
    expect(region, `${id}: no main scroll region`).toBeTruthy()
    // Walk from the region up to the document. The ONLY `overflow-y-auto` on that path is the
    // region itself — an ancestor that also scrolls is the single-document-scroll defect returning,
    // and it is exactly what `main` in Shell.jsx used to do around the whole page.
    const offenders = []
    for (let n = region.parentElement; n && n !== document.body; n = n.parentElement) {
      if (/overflow-y-auto|overflow-auto/.test(n.className ?? '')) {
        offenders.push(n.getAttribute('data-shell-part') ?? n.tagName.toLowerCase())
      }
    }
    expect(offenders, `${id}: scrolling ancestor(s) above the region`).toEqual([])
    unmount()
  })

  it('the shell frame is fixed-height and the document body is never the scroller', async () => {
    const d = byId('prop_s9_1_decide')
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const frame = c.querySelector('[data-shell-part="frame"]')
    expect(frame, 'no shell frame').toBeTruthy()
    expect(frame.className).toMatch(/h-screen/)
    expect(document.body.className ?? '').not.toMatch(/overflow-y-auto|overflow-auto/)
    unmount()
  })
})

// ---- T63 -----------------------------------------------------------------------------------------

describe('T63 — header, stage tracker and action bar stay in the viewport at 1440 and 1280', () => {
  // jsdom cannot scroll and cannot measure, so this asserts the structural fact that MAKES them
  // stay: each of the three sits OUTSIDE every scroll region, as a non-shrinking child of the
  // fixed-height frame. The reference builds it the same way (S10.1-1-reason.dc.html:196 puts the
  // regions in a `flex:1;min-height:0` grid, with the footer at `flex:0 0 auto` beside it).
  const PINNED = ['header', 'tracker', 'actionbar']

  it.each(SPECIMENS)('%s: every pinned part is outside every scroll region', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    for (const part of PINNED) {
      const node = c.querySelector(`[data-shell-part="${part}"]`)
      expect(node, `${id}: no ${part}`).toBeTruthy()
      let inside = false
      for (let n = node.parentElement; n && n !== document.body; n = n.parentElement) {
        if (n.hasAttribute?.('data-scroll-region')) inside = true
      }
      expect(inside, `${id}: ${part} is inside a scroll region and will scroll away`).toBe(false)
    }
    unmount()
  })

  it.each([1440, 1280])('at %ipx the regions still split and the pinned parts still sit outside them', async (width) => {
    // The two supported widths (C4). Below 1280 every span collapses to full, which T68 covers.
    window.innerWidth = width
    const d = byId('prop_s9_1_decide')
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    expect(c.querySelector('[data-scroll-region="main"]')).toBeTruthy()
    expect(c.querySelector('[data-shell-part="actionbar"]')).toBeTruthy()
    unmount()
  })
})

// ---- T64 -----------------------------------------------------------------------------------------

describe('T64 — the action bar states the stage and offers the forward action', () => {
  /** The next stage of this story, or null on the last one. */
  function nextStageOf(decision) {
    const i = STAGE_ORDER.indexOf(decision.stage)
    const story = dataset.filter((x) => x.story_code === decision.story_code).map((x) => x.stage)
    for (let k = i + 1; k < STAGE_ORDER.length; k += 1) {
      if (story.includes(STAGE_ORDER[k])) return STAGE_ORDER[k]
    }
    return null
  }

  it.each(SPECIMENS)('%s: the bar renders on every stage, with a state line', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const bar = c.querySelector('[data-shell-part="actionbar"]')
    expect(bar, `${id}: no action bar`).toBeTruthy()
    const state = bar.querySelector('[data-stage-state]')
    expect(state, `${id}: no stage-state line`).toBeTruthy()
    expect((state.textContent ?? '').trim().length, `${id}: empty stage-state line`).toBeGreaterThan(0)
    unmount()
  })

  it.each(SPECIMENS)('%s: a forward action where a next stage exists, none where it does not', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const forward = c.querySelector('[data-stage-forward]')
    const next = nextStageOf(d)
    if (next === null) {
      expect(forward, `${id}: last stage still offers a forward action`).toBeNull()
    } else {
      expect(forward, `${id}: no forward action, next stage is ${next}`).toBeTruthy()
      expect(forward.textContent.toLowerCase()).toContain(next)
      expect(forward.getAttribute('href')).toContain(`/${next}/`)
    }
    unmount()
  })

  // 20s: this mounts the whole routed App once per specimen, five times. At the default 5s it timed
  // out MID-act, and the failure that surfaced was not a timeout — it was every later test in the
  // file rendering into an empty container, because an act() batch left open never closes.
  it('R60 — status_note renders exactly once per pane, and no template declares stage_status', async () => {
    // The Phase 4 T46 shape, applied to the fact this phase moves. The reference prints the stage's
    // own state ONCE, in the footer; the rail carried a second copy through the `stage_status` slot.
    // Phase 4 Part 2 deleted `decision_mode` for exactly this, and the same argument holds here.
    for (const id of SPECIMENS) {
      const d = byId(id)
      const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
      expect(c.querySelectorAll('[data-block-slot="stage_status"]').length, `${id}: rail still renders it`).toBe(0)
      expect(c.querySelectorAll('[data-stage-state]').length, `${id}: stage state rendered twice`).toBe(1)
      unmount()
    }
    const offenders = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      for (const b of resolved.manifest.blocks) {
        if (b.slotName === 'stage_status') offenders.push(`${d.proposal_id} · ${resolved.templateId}`)
      }
    }
    expect(offenders, `${offenders.length} object(s) still bind a stage_status block`).toEqual([])
  }, 20_000)
})

// ---- T65 -----------------------------------------------------------------------------------------

describe('T65 — the packer is pure and total (II2)', () => {
  it('declares exactly two spans', () => {
    // R59 and the survey: `blockSizing.js` had four (12/8/6/4) and the 8 and 4 were inference
    // artefacts with no reference basis. Two is the whole vocabulary.
    expect(Object.keys(SPANS).sort()).toEqual(['full', 'half'])
  })

  it('returns identical rows for the same input, every time', () => {
    const input = ['policy', 'constraints', 'roles', 'narrative']
    const first = packRow(input)
    for (let i = 0; i < 20; i += 1) {
      expect(packRow(input), `call ${i} differed`).toEqual(first)
    }
    // …and is not perturbed by a caller mutating what it got back.
    const returned = packRow(input)
    returned.push({ slots: ['tampered'] })
    expect(packRow(input)).toEqual(first)
  })

  it('rejects an unknown span instead of silently defaulting to full width', () => {
    expect(() => packRow(['policy'], { policy: 'two-thirds' })).toThrow(/span/i)
    expect(() => packRow(['policy'], { policy: 6 })).toThrow(/span/i)
    expect(() => packRow(['policy'], { policy: null })).toThrow(/span/i)
  })

  it('never drops or reorders a block', () => {
    const input = ['narrative', 'policy', 'constraints', 'trigger', 'roles', 'secondary_rows']
    const flat = packRow(input).flatMap((r) => r.slots)
    expect(flat).toEqual(input)
  })

  it('is total over every slot in the vocabulary', () => {
    const all = Object.keys(SLOT_VOCABULARY)
    expect(() => packRow(all)).not.toThrow()
    expect(packRow(all).flatMap((r) => r.slots)).toEqual(all)
  })
})

// ---- T66 -----------------------------------------------------------------------------------------

describe('T66 — packing changes rows, never the block set (II2)', () => {
  it('renders exactly the same slots per object as Phase 5A did, on all 105', () => {
    const differences = []
    for (const d of dataset) {
      const pane = renderPaneIsolated(d)
      if (!pane) continue
      const rendered = [...pane.container.querySelectorAll('[data-block-slot]')].map((n) => n.getAttribute('data-block-slot'))
      // The expected set is derived the same way Phase 5A's own tests derive it: every block whose
      // `when` passes and whose binding resolves. `stage_status` is the one deliberate removal
      // (R60) and is excluded from the expectation rather than silently tolerated in the diff.
      const resolved = resolveTemplate(d)
      const expected = resolved.manifest.blocks
        .filter((b) => b.when === undefined || evaluateCondition(b.when, d))
        .filter((b) => resolveBinding(b.binding, d) !== undefined)
        .map((b) => b.slotName)
      const missing = expected.filter((s) => !rendered.includes(s))
      const extra = rendered.filter((s) => !expected.includes(s))
      if (missing.length || extra.length) {
        differences.push(`${d.proposal_id}: missing ${missing.join(',') || '-'} extra ${extra.join(',') || '-'}`)
      }
      pane.done()
    }
    expect(differences, 'packing changed which blocks render').toEqual([])
  })

  it('R58 — blockSizing.js and its test are gone, and nothing imports them', () => {
    // The deletion is the assertion. A width inferred from content is the defect I1 names, and
    // leaving the module in place "unused" is how it comes back.
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/features/action-stories/layout/blockSizing.js'))).toBe(false)
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/features/action-stories/layout/blockSizing.test.js'))).toBe(false)
    // Checked against CODE, with comments stripped first — the same technique
    // referenceFidelity.test.js uses to assert `fallbackScan` is gone from the normalizer. Four
    // modules name `blockSizing.js` in prose, deliberately: a tombstone recording why a module was
    // deleted is this project's convention (see slotVocabulary.js's `decision_mode` and
    // `stage_status` entries), and a test that forced those comments to be deleted would be
    // destroying the record of the fix to assert the fix.
    const offenders = []
    ;(function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full) }
        else if (/\.(js|jsx)$/.test(entry.name) && full !== fileURLToPath(import.meta.url)) {
          const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
          if (/blockSizing|inferSpan/.test(code)) offenders.push(path.relative(REPO_ROOT, full))
        }
      }
    })(path.join(REPO_ROOT, 'src'))
    expect(offenders, 'blockSizing is deleted but still referenced in code').toEqual([])
  })
})

// ---- T67 -----------------------------------------------------------------------------------------

describe('T67 — a span comes only from the slot declaration (I1)', () => {
  it('every declared span is a member of the vocabulary', () => {
    const bad = Object.entries(SLOT_VOCABULARY)
      .filter(([, spec]) => spec.span !== undefined && SPANS[spec.span] === undefined)
      .map(([name, spec]) => `${name}: ${JSON.stringify(spec.span)}`)
    expect(bad, 'a slot declares a span outside the vocabulary').toEqual([])
  })

  it('spanOf reads the declaration and nothing else — same answer whatever the data is', () => {
    // The structural half of I1: the function that answers "how wide" takes a SLOT NAME, and has no
    // parameter for a value, a row count or a blockType. A signature that cannot see the data
    // cannot branch on it.
    expect(spanOf.length, 'spanOf takes more than a slot name').toBe(1)
    for (const name of Object.keys(SLOT_VOCABULARY)) {
      expect(SPANS[spanOf(name)], `${name} resolves to no known span`).toBeDefined()
    }
  })

  it('no layout module measures content to choose a width', () => {
    // The textual half. These are the exact signals blockSizing.js used — column counts, text
    // weight, item counts, key counts. None may reappear in the layout layer under another name.
    const dir = path.join(REPO_ROOT, 'src/features/action-stories/layout')
    const offenders = []
    for (const file of fs.readdirSync(dir).filter((f) => /\.jsx?$/.test(f) && !f.includes('.test.'))) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const signal of ['itemTextWeight', 'meaningfulColumnCount', 'inferSpan', '.length > 6', '.length > 12']) {
        if (src.includes(signal)) offenders.push(`${file}: ${signal}`)
      }
    }
    expect(offenders, 'a layout module is measuring content again').toEqual([])
  })

  it('composeSections never receives a width it did not get from the vocabulary', () => {
    // An authored `layout.span` on a manifest block is the ONE other source, and it is declared
    // data, not an inference — it stays, and it is bounded by the same vocabulary.
    const spans = new Set()
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      for (const b of resolved.manifest.blocks) if (b.layout?.span !== undefined) spans.add(b.layout.span)
    }
    for (const s of spans) expect(Number.isInteger(s) && s >= 1 && s <= 12, `authored span ${s}`).toBe(true)
  })
})

// ---- T68 -----------------------------------------------------------------------------------------

describe('T68 — no half ever renders as a lone narrow cell (the rule from 1d)', () => {
  it('holds on all 105, including where a half\'s neighbour is filtered out', () => {
    // ASSERTED ON THE COMPOSED OUTPUT, not on packRow's return value, and the distinction is the
    // rule itself. `packRow` legitimately returns a row of ONE containing a half-declared slot —
    // that is how it reports "this half found no partner". What must never happen is that row
    // rendering AS a half, and the widening happens one layer up, where composeSections turns a
    // one-slot row into a `single` (full-width) row. A first draft of this test asserted against
    // packRow and failed on 61 legitimate lone halves, which was the test misreading the contract,
    // not the packer breaking it.
    const offenders = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      const items = resolved.manifest.blocks
        .filter((b) => b.when === undefined || evaluateCondition(b.when, d))
        .map((b) => ({
          slotName: b.slotName, blockType: b.blockType, layout: b.layout,
          section: b.section, region: b.region, value: resolveBinding(b.binding, d),
        }))
        .filter((i) => i.value !== undefined)
      for (const section of composeSections(items, resolved.manifest.sections).main) {
        for (const row of section.rows) {
          if (row.type !== 'flow') continue
          if (row.items.length !== 2) {
            offenders.push(`${d.proposal_id}: a flow row of ${row.items.length} — an empty cell beside it`)
          }
          for (const item of row.items) {
            if (item.span !== SPANS.half) offenders.push(`${d.proposal_id}: "${item.slotName}" spans ${item.span} in a pair`)
          }
        }
      }
    }
    expect(offenders, 'a half-width block with empty space beside it').toEqual([])
  })

  it('packRow itself never returns a row of more than two', () => {
    for (const d of dataset) {
      for (const slots of mainSectionsOf(d)) {
        for (const row of packRow(slots)) {
          expect(row.slots.length, `${d.proposal_id}: a row of ${row.slots.length}`).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  it('the filtered-neighbour case is real in this corpus, so the rule is exercised', () => {
    // `when` filtering runs in StageRenderer BEFORE composition, so the packer only ever sees
    // survivors — a half whose declared neighbour was filtered simply finds a different follower or
    // widens. This asserts the case actually occurs, so the guarantee above is not vacuous.
    let lonelyHalves = 0
    for (const d of dataset) {
      for (const slots of mainSectionsOf(d)) {
        for (const row of packRow(slots)) {
          if (row.slots.length === 1 && SLOT_VOCABULARY[row.slots[0]]?.span === 'half') lonelyHalves += 1
        }
      }
    }
    expect(lonelyHalves, 'no object exercises the odd-half rule').toBeGreaterThan(0)
  })

  it('every rendered row cell is either the whole row or one of exactly two halves', () => {
    for (const id of SPECIMENS) {
      const pane = renderPaneIsolated(byId(id))
      if (!pane) continue
      for (const row of pane.container.querySelectorAll('[data-pack-row]')) {
        const cells = row.querySelectorAll(':scope > [data-block-slot]')
        expect(cells.length, `${id}: a packed row of ${cells.length}`).toBe(2)
      }
      pane.done()
    }
  })
})

// ---- T69 -----------------------------------------------------------------------------------------

describe('T69 — Phase 4 budgets re-derived against the packed layout (I5)', () => {
  it('no BEAT renders more than 8 blocks — unchanged, because packing moves rows not blocks', () => {
    const violators = []
    for (const d of dataset) {
      for (const slots of mainSectionsOf(d)) {
        if (slots.length > 8) violators.push(`${d.proposal_id}: ${slots.length} blocks`)
      }
    }
    expect(violators, `${violators.length} beat(s) over the 8-block budget`).toEqual([])
  })

  it('no RAIL renders more than 4 cards, and R60 lowers decide from 4 to 3', () => {
    // THE UNIT IS UNCHANGED — rail CARDS, meaning StageSections' RailPanel `<section>` elements,
    // exactly as Phase 4 measured it. Packing cannot move this number: it runs on the main region
    // only. What moves it is R60, which deletes the `stage_status` slot. On decide.slate.v1 that
    // slot shared the `context` panel with `decision_lens`, so the panel survives and the CARD
    // count is unchanged there; on templates where it was the only member of its panel the panel
    // goes. The census below is the number that actually moves, and it is reported, not budgeted.
    const violators = []
    const cards = {}
    const blocks = {}
    for (const d of dataset) {
      const pane = renderPaneIsolated(d)
      if (!pane) continue
      const aside = pane.container.querySelector('aside')
      const n = aside ? aside.querySelectorAll('section').length : 0
      const b = aside ? aside.querySelectorAll('[data-block-slot]').length : 0
      const templateId = resolveTemplate(d).templateId
      cards[templateId] = Math.max(cards[templateId] ?? 0, n)
      blocks[templateId] = Math.max(blocks[templateId] ?? 0, b)
      if (n > 4) violators.push(`${d.proposal_id}: rail renders ${n} cards`)
      pane.done()
    }
    expect(violators, `${violators.length} pane(s) over the 4-card rail budget`).toEqual([])
    // Stated in the test so a drift is visible as a diff, per I5.
    expect(blocks['decide.slate.v1'], 'decide rail blocks after R60').toBe(5)
    expect(cards['decide.slate.v1'], 'decide rail cards after R60').toBe(4)
  })

  it('main-region ROW counts fall by the measured amount, and only where evidence put a half', () => {
    // The packing budget, stated as the number this phase actually delivers (R62): 338 -> 320.
    // decide and execute are unchanged, and that is reported rather than improved by guessing.
    const rowsPer = {}
    for (const d of dataset) {
      const templateId = resolveTemplate(d)?.templateId
      if (!templateId) continue
      const n = mainSectionsOf(d).reduce((sum, slots) => sum + packRow(slots).length, 0)
      rowsPer[templateId] = (rowsPer[templateId] ?? 0) + n
    }
    expect(rowsPer['reason.v1'], 'reason main rows').toBe(55)
    expect(rowsPer['analyze.compare.v1'], 'analyze main rows').toBe(77)
    expect(rowsPer['decide.slate.v1'], 'decide main rows').toBe(81)
    expect(rowsPer['execute.bridge.v1'], 'execute main rows').toBe(107)
    expect(Object.values(rowsPer).reduce((a, b) => a + b, 0), 'total main rows').toBe(320)
  })
})

// ---- T70 -----------------------------------------------------------------------------------------

describe('T70 — the last block of a region clears the pinned bar (I7)', () => {
  it.each(SPECIMENS)('%s: the action bar is a sibling of the regions, not an overlay on them', async (id) => {
    // jsdom cannot measure, so this asserts the layout contract that makes the overlap impossible:
    // the bar is a NON-OVERLAPPING flex/grid sibling (it occupies its own track), not a
    // `position: fixed`/`absolute` element floating above a region. A sibling cannot cover content
    // by construction, which is a stronger guarantee than any padding-bottom would be.
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const bar = c.querySelector('[data-shell-part="actionbar"]')
    expect(bar).toBeTruthy()
    expect(bar.className, `${id}: the bar floats above content`).not.toMatch(/\bfixed\b|\babsolute\b/)
    expect(bar.className, `${id}: the bar can be squeezed by a long region`).toMatch(/shrink-0|flex-shrink-0/)
    // Same parent as the region wrapper — they share the frame's vertical space rather than stack.
    const regions = c.querySelector('[data-shell-part="regions"]')
    expect(regions, `${id}: no regions wrapper`).toBeTruthy()
    expect(bar.parentElement).toBe(regions.parentElement)
    unmount()
  })

  it.each(SPECIMENS)('%s: every region scrolls to its own end independently', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    for (const region of c.querySelectorAll('[data-scroll-region]')) {
      // The last child of a scroll region is content, never a pinned element that would sit on top
      // of it — the reference ends each region with a spacer for the same reason
      // (S10.1-1-reason.dc.html:330, a 4px `flex-shrink:0` tail).
      expect(region.querySelector('[data-shell-part]'), `${id}: a pinned part inside a region`).toBeNull()
    }
    unmount()
  })
})

// ---- T71 -----------------------------------------------------------------------------------------

describe('T71 — no data changed (I4) and no block changed (C1)', () => {
  const changed = (paths) => execSync(`git diff --name-only HEAD -- ${paths}`, { encoding: 'utf8' }).trim()

  it('the normalized corpus is byte-identical', () => {
    const diff = changed('src/features/action-stories/__corpus__/normalized/')
    expect(diff, `corpus changed: ${diff}`).toBe('')
  })

  it('the generator, the contract validator and the shape ledger are untouched', () => {
    const diff = changed(
      'extraction/normalizeCorpus.js'
      + ' src/features/action-stories/contract/decisionObject.js'
      + ' src/features/action-stories/blocks/consumedFields.js'
      + ' src/features/action-stories/__corpus__/shapeLedger.js',
    )
    expect(diff, `frozen files changed: ${diff}`).toBe('')
  })

  it('no block component changed — a block does not know its own width (I3/C1)', () => {
    // COMPONENTS, not the whole directory: `blocks/` also holds this phase's re-baselined test
    // files (slotCorrections.test.jsx, blockVocabulary.test.jsx), whose slot counts moved when R60
    // removed `stage_status`. C1 is about a block learning its own width, and a test file updating
    // a count is not that. The first draft of this assertion diffed the directory and failed on
    // exactly those two files.
    const diff = changed('src/features/action-stories/blocks/')
      .split('\n')
      .filter((f) => f !== '' && !f.includes('.test.'))
    expect(diff, `block component(s) changed: ${diff.join(', ')}`).toEqual([])
  })
})

// ---- T72 -----------------------------------------------------------------------------------------

describe('T72 — the live path stays green across all 105', () => {
  it('every object renders through the transport with no error copy and real content', async () => {
    const { getStageView } = await import('@/services/actionStoriesService')
    const { __resetMockApi } = await import('@/services/mockDecisionApi')
    __resetMockApi()

    const views = await Promise.all(dataset.map((d) => getStageView(d.story_code, d.stage, d.proposal_id)))
    expect(views).toHaveLength(105)

    const broken = []
    for (const view of views) {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      act(() => {
        root.render(<StageRenderer manifest={view.manifest} fixture={view.decision} />)
      })
      const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (/can't be displayed yet|unexpected response|Something went wrong/i.test(text)) {
        broken.push(`${view.decision.proposal_id}: error copy`)
      }
      if (text.length < 50) broken.push(`${view.decision.proposal_id}: rendered almost nothing`)
      unmount()
    }
    expect(broken, `${broken.length} of 105 broke`).toEqual([])
  })

  it('composeSections still returns both regions for every object', () => {
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      const items = resolved.manifest.blocks
        .filter((b) => b.when === undefined || evaluateCondition(b.when, d))
        .map((b) => ({
          slotName: b.slotName, blockType: b.blockType, layout: b.layout,
          section: b.section, region: b.region, value: resolveBinding(b.binding, d),
        }))
        .filter((i) => i.value !== undefined)
      const sections = composeSections(items, resolved.manifest.sections)
      expect(Array.isArray(sections.main), d.proposal_id).toBe(true)
      expect(Array.isArray(sections.rail), d.proposal_id).toBe(true)
    }
  })
})
