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

/**
 * THE SHAPE LEDGER'S RULES, PINNED BY CONTENT — what T71 and T81 froze it by FILE for.
 *
 * A byte-freeze on shapeLedger.js said "this phase did not relax an audit rule", which was the real
 * claim, but it also forbade fixing the auditor itself. It had to be: `SLOT_BY_BINDING` was a
 * one-to-one Map, so the moment two slots shared a binding it silently attributed every object on
 * that path to whichever slot was declared last — the 9 barChart objects on `proposal.comparison`
 * were audited as a statList, and `barChart.pct` stopped being exercised at all. That is the
 * auditor going quiet, which is the failure mode R54 names and the same one this file's own comment
 * records about `git diff` freezes passing on a committed tree.
 *
 * So the freeze moves from the file to the rules. The three admissible ignore categories, the
 * MISROUTED gate, and the ledger's actual verdicts are all still asserted — by
 * shapeLedger.test.js's 50 tests, by blockVariants.test.js's R68 guard, and by the two checks
 * below. What is no longer frozen is HOW a claim finds its slot.
 */
const assertLedgerRulesUnchanged = () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/__corpus__/shapeLedger.js'), 'utf8')
  expect(src, 'the three admissible ignore categories changed')
    .toContain("'extraction residue', 'derived geometry', 'rendered elsewhere'")
  expect(src, 'the MISROUTED gate changed').toMatch(/MISROUTED\s+anything else/)
}

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

describe('T79 — REPLACES T62, which passed while scrolling did not work', () => {
  // ============================================================================================
  // THE SIXTH TIME A GREEN TEST HAS COVERED A REAL GAP. Ruling R67 asked this comment to name the
  // first three; R77 added the fourth, which changed what the list means; R80 added the fifth,
  // which says who this happens to; R89 added the sixth, which is about how a gate is BUILT.
  //
  //   heroMetrics.range (Phase 5A)  referenceFidelity.test.js asserted the P10-P90 interval was
  //                                 present in the DATA. It was. StatListBlock never rendered it,
  //                                 on any of the objects that carry it. The test guarded a field
  //                                 no operator could see, and had done since Phase 2.
  //
  //   T31 / T37 (Phases 3B, 3C)     `git diff --name-only` assertions that the corpus was
  //                                 untouched. True — and unfalsifiable after the commit landed,
  //                                 because a committed tree has no diff. They went quiet at
  //                                 exactly the moment they were supposed to start guarding.
  //
  //   T62 (Phase 5C, this one)      asserted each region's className CONTAINS `overflow-y-auto`
  //                                 and matches `min-h-0`. Both were true. Scrolling was broken:
  //                                 `lg:items-start` on the parent grid made the region size to its
  //                                 own content, and `overflow-y: auto` on an element with an
  //                                 unconstrained height never scrolls — it grows. Measured in
  //                                 Chrome at 1440x700: clientHeight 500, scrollHeight 500,
  //                                 nothing to scroll, 155px overflowing the track and clipped by
  //                                 `main`'s `overflow:hidden`. 86px of content unreachable.
  //
  //   T75+T78 (Phases 5D, 5E)      THE FOURTH, AND THE FIRST WHERE TWO GATES WERE BLIND TO ONE
  //                                 CAUSE. Say it plainly: PHASE 5D TRADED A CLIPPED TABLE FOR A
  //                                 RIBBONED ONE. Before 5D, S10.1/decide's slate ran `max-w-xs
  //                                 truncate` — a 320px body column, two lines, most of a
  //                                 213-character paragraph CUT OFF. 5D replaced that with the
  //                                 `prose` rule, the clipping stopped, and the same cell became
  //                                 106px wide wrapping over FORTY-FOUR lines: a vertical ribbon.
  //                                 Both states were green. T75 asks "is any text cut off?" and a
  //                                 ribbon cuts off nothing. T78 asks "are these heights equal, are
  //                                 these widths declared?" and a wrong SHAPE is in tolerance on
  //                                 both. Neither gate was wrong about its own question. The
  //                                 constant neither one asked about was the real cause — FIFTEEN
  //                                 COLUMNS IN 834px, unioned from four records carrying 4-7 fields
  //                                 each — and 5D could not have seen it, because 5D was permitted
  //                                 to change text rules and nothing else, so the only lever it had
  //                                 moved the defect sideways.
  //
  //   T101 (Phase 5E, R89)         THE SIXTH: A TOFU BOX. The type sweep put `typeRole('micro')` on
  //                                 Font Awesome chevrons, `font-mono` beat the icon font, and the
  //                                 glyph rendered as .notdef — a missing-character box, 478 of
  //                                 them. Every gate in this project passed it, and they were all
  //                                 right to: it is not clipped, it does not overflow its track,
  //                                 its contrast ratio is fine, it is exactly the size the layout
  //                                 expects, and its column is properly filled. The only thing
  //                                 wrong with a tofu box is what it LOOKS like.
  //
  //                                 WHAT MAKES THIS ONE DIFFERENT IS THE GATE I THEN WROTE. The
  //                                 first T101 compared the glyph against the same character drawn
  //                                 in a missing FONT FAMILY and passed with 478 boxes on screen,
  //                                 because the control drew at 16px while the glyph was 10px. The
  //                                 second matched the size and still passed, because the two fell
  //                                 back down different chains — "JetBrains Mono", Menlo, monospace
  //                                 lands on a monospace tofu and an unknown family on a
  //                                 proportional one. Two green gates, one real defect, and the
  //                                 only reason I know is that I reintroduced the bug on purpose
  //                                 and watched the run stay green.
  //
  //                                 SO: A NEW GATE IS NOT EVIDENCE UNTIL IT HAS FAILED. Writing the
  //                                 check is the easy half; proving it can see the thing is the
  //                                 half that was skipped in five of the six cases above. The
  //                                 working version holds the font fixed and varies the CHARACTER —
  //                                 U+FFFF is a permanent noncharacter, so whatever this font draws
  //                                 for it IS this font's .notdef — and it was verified in both
  //                                 directions: the broken chevron matches, a working icon on the
  //                                 same page does not.
  //
  // THE RULE THEY SHARE: a test must assert what the OPERATOR EXPERIENCES, not what the code
  // declares. A CSS property is a declaration. A committed file is a declaration. A field on a
  // JSON object is a declaration. Each of those three tests asserted something ADJACENT to the
  // thing that mattered, and adjacency is invisible in a green run.
  //
  //   T93 (Phase 5E, R80)          THE FIFTH, AND I WROTE IT. Phase 5E existed to fix a table whose
  //                                 two gates had both been blind to it, and this comment is where
  //                                 that lesson is kept. The first version of 5E's own column rule
  //                                 asked THE DATA whether a field had a value — undefined, null,
  //                                 empty string, empty array — and ten unit tests agreed it was
  //                                 right. Then the rule ran in a browser and 22 tables were still
  //                                 spending a column on a field that sat on every single row and
  //                                 drew "—" in every single cell, because its value was an array
  //                                 of objects the renderer cannot display. "Has a value" and
  //                                 "shows a value" are different questions. I asked the adjacent
  //                                 one, in the phase whose entire subject is asking the adjacent
  //                                 one, with this comment open in front of me.
  //
  //                                 So: THIS IS NOT A LAPSE, IT IS THE DEFAULT. The data is what
  //                                 you have in your hand when you write the rule; the render is
  //                                 downstream and out of sight. Every instance above was written
  //                                 by someone who had just been thinking hard about the thing they
  //                                 then failed to assert. Knowing the pattern does not protect you
  //                                 from it — only running the thing in front of the instrument
  //                                 that can see it does. That is the whole argument for R65's
  //                                 browser gate, and it is why the fix here was not "be more
  //                                 careful" but moving the predicate into the rule so the two
  //                                 CANNOT be asked separately (tableColumns.js's rendersValue is
  //                                 TableBlock's own isMissing test, inverted).
  //
  // WHAT THE FOURTH ONE ADDS. The first three are each a single test that measured the wrong thing.
  // The fourth is two tests that each measured the RIGHT thing and still left a screen broken,
  // because a defect does not have to sit inside any one gate's question. A gate suite is not a
  // coverage sum: green on every question you thought to ask is silent about the one you did not.
  // The only instrument that found it was LOOKING AT THE SCREEN — which is why every phase since 5B
  // has carried a screenshot pass, and why 5E's own geometric gate (T93, in scripts/smoke.mjs)
  // asserts the CAUSE, a mostly-empty column, rather than either symptom.
  //
  // WHERE THAT LEAVES THIS FILE. jsdom has no layout engine, so the behavioural half of scrolling
  // CANNOT be asserted here — every clientHeight is 0. It lives in scripts/smoke.mjs (T73), in real
  // Chrome, and `npm run smoke` fails the build on a regression. What stays here is the STRUCTURAL
  // PRECONDITION (T74): the height chain that makes scrolling possible. Structure here, behaviour
  // there, and neither pretending to be the other.
  // ============================================================================================

  it('records that the behavioural assertion lives in the smoke run, and that it can fail', () => {
    const smoke = fs.readFileSync(path.join(REPO_ROOT, 'scripts/smoke.mjs'), 'utf8')
    for (const t of ['T73', 'T75', 'T76', 'T93', 'T100', 'T101']) {
      expect(smoke, `${t} is not in the smoke run`).toContain(t)
    }
    // R65: a browser check that reports without failing is the vacuous pass in a new costume.
    // The gate's findings must reach `fail()`, which is what sets a non-zero exit code.
    expect(smoke, 'the layout gate does not fail the run').toMatch(/failures\.length > 0[\s\S]{0,200}fail\(/)
  })

  it('no test in this file asserts a scroll behaviour it cannot observe', () => {
    // The specific trap T62 fell into: asserting a CSS property as though it were the behaviour.
    // A className check is legitimate ONLY as a named precondition (T74), never as the scroll test.
    const self = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(self, 'this file claims to measure scrolling, which jsdom cannot do')
      // Matched as a PROPERTY ACCESS (`.scrollHeight`), not as a bare word — the first draft used
      // the bare word and matched its own regex literal, which is a small, funny instance of the
      // exact thing this file is about: asserting on something adjacent to the target.
      .not.toMatch(/\.(scrollHeight|scrollTop|clientHeight)\b/)
  })
})

describe('T74 — the height chain from the viewport to each region is unbroken (II2)', () => {
  // Every ancestor between the viewport and a scroll region must constrain height. One link with
  // an implicit `min-height: auto` is where the next regression hides — and Shell.jsx's own
  // `flex-1 flex-col` column was exactly that when this phase started: it measured correctly and
  // constrained nothing.
  const CHAIN = [
    ['frame', /h-screen/, 'the fixed viewport-height frame'],
    ['column', /min-h-0/, 'the column between the frame and main'],
    ['main', /min-h-0/, 'the non-scrolling page frame'],
    ['regions', /min-h-0/, 'the band the two regions share'],
  ]

  it.each(SPECIMENS)('%s: every named link constrains height', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    for (const [part, rule, what] of CHAIN) {
      const node = c.querySelector(`[data-shell-part="${part}"]`)
      expect(node, `${id}: no [data-shell-part="${part}"] — ${what}`).toBeTruthy()
      expect(node.className, `${id}: ${part} does not constrain height`).toMatch(rule)
    }
    unmount()
  })

  it.each(SPECIMENS)('%s: nothing between a region and the frame sizes to its content', async (id) => {
    const d = byId(id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const region = c.querySelector('[data-scroll-region="main"]')
    expect(region).toBeTruthy()
    // `items-start` / `items-center` on an ancestor grid or flex makes the region size to content
    // rather than to its track, which is the precise 5C defect. It must appear nowhere on the path.
    const offenders = []
    for (let n = region.parentElement; n && n !== document.body; n = n.parentElement) {
      const cls = (n.className ?? '').toString()
      if (/\bitems-start\b|\bitems-center\b|\bitems-baseline\b/.test(cls)) {
        offenders.push(`${n.getAttribute('data-shell-part') ?? n.tagName.toLowerCase()}: ${cls.match(/\bitems-\w+/)[0]}`)
      }
    }
    expect(offenders, `${id}: an ancestor lets the region size to its own content`).toEqual([])
    unmount()
  })
})

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

  // THE GUARANTEE ABOVE IS NOW VACUOUS, AND THAT IS SAID HERE RATHER THAN LEFT TO BE NOTICED.
  //
  // This slot used to hold an anti-vacuous guard: it counted lone halves in the corpus and required
  // at least one, so "no half renders narrow" could not pass by there being no halves. There are now
  // no halves — every main-region block takes the full column (slotVocabulary.js) — so that count is
  // zero by design and the old assertion would fail for the right reason in the wrong place.
  //
  // Replacing it with nothing would leave a silence: a reader could not tell whether no pair renders
  // because the vocabulary declares none or because the packer stopped working. So it is asserted
  // both ways — the vocabulary fact, and the mechanism still doing its job when something does opt
  // in, through packRow's own override seam.
  it('no pair renders because NO SLOT DECLARES ONE — the vocabulary fact, stated', () => {
    const halves = Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.span === 'half').map(([n]) => n)
    expect(halves, 'a slot declares half again — T68\'s guarantee above is live once more').toEqual([])

    let flowRows = 0
    for (const d of dataset) {
      for (const slots of mainSectionsOf(d)) {
        for (const row of packRow(slots)) if (row.slots.length === 2) flowRows += 1
      }
    }
    expect(flowRows, 'a row paired with no half declared anywhere').toBe(0)
  })

  it('and the packer still pairs, and still widens a lone half, when a span says so', () => {
    // The rule outliving its last caller is the point: re-enabling a half is a two-word edit to the
    // vocabulary, and this is what proves the machinery it switches on is still there and correct.
    const halves = { a: 'half', b: 'half', c: 'half' }
    expect(packRow(['a', 'b'], halves)).toEqual([{ slots: ['a', 'b'] }])
    expect(packRow(['a', 'b', 'c'], halves)).toEqual([{ slots: ['a', 'b'] }, { slots: ['c'] }])
    expect(packRow(['a', 'x'], halves)).toEqual([{ slots: ['a'] }, { slots: ['x'] }])
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
    // PHASE 5E PART 2 (R91): 5 -> 4. `decision_lens` leaves decide's context section, which still
    // carries `decision_persona` and `decision_contract_class` and so survives; analyze's context
    // section did NOT survive, because the lens was its only member.
    expect(blocks['decide.slate.v1'], 'decide rail blocks after R60, then R91').toBe(4)
    // AND THE CARD COUNT FALLS WITH IT: 4 -> 3. Decide's `context` section is left holding only
    // `decision_contract_class`, which is `when`-gated to strategic/regulated objects — so the
    // "Context" card, which used to appear on every decide pane because the lens always exists,
    // now appears only where there is a contract class to state. The section is still fillable
    // (referenceContentRender.test.jsx §5 checks that), it is simply no longer unconditional.
    expect(cards['decide.slate.v1'], 'decide rail cards after R60, then R91').toBe(3)
  })

  it('main-region ROW counts fall by the measured amount, and only where evidence put a half', () => {
    // The packing budget, stated as the number this phase actually delivers (R62): 338 -> 320.
    // decide and execute are unchanged, and that is reported rather than improved by guessing.
    //
    // REASON THEN WENT 55 -> 73, AND THE BUDGET MOVING THE WRONG WAY IS THE POINT. Every main-region
    // block takes the full column now (slotVocabulary.js), so reason's 18 packed pairs became 36
    // singles. Rows were never the goal: the goal was the 16 horizontal scroll bars a 410px cell
    // forced on tables needing up to 759px, and those are gone — corpus-wide, horizontally-scrolling
    // blocks go 40 -> 28, and all 28 left overflow at full width too. A budget kept by leaving the
    // defect in is a budget measuring the wrong thing, so the number is restated rather than defended.
    //
    // 5C's own comparison still holds: the pre-packing layout produced 338 and this is 338 as well,
    // because packing is what took it to 320 and nothing now opts into packing. The rows came back;
    // the reason they were removed — space — was never worth what it cost these screens.
    const rowsPer = {}
    for (const d of dataset) {
      const templateId = resolveTemplate(d)?.templateId
      if (!templateId) continue
      const n = mainSectionsOf(d).reduce((sum, slots) => sum + packRow(slots).length, 0)
      rowsPer[templateId] = (rowsPer[templateId] ?? 0) + n
    }
    // PHASE 9: 338 -> 416, and unlike every delta above it this one is CONTENT, not packing.
    // 78 raw keys that the reference supplied and nothing rendered now reach a block, on 59 of the
    // 105 panes. Row for row that is one new row per claimed key, which is what a row count should
    // do when a pane gains a block — the earlier movements in this comment were the same content
    // being repacked, and this is not.
    //
    // The shape blocks sit in MAIN on every template and that placement is deliberate: the rail is
    // capped at 4 cards (R60, asserted above) and these are supporting figures, not rail facts.
    // It is also where the reference draws them — an eyebrow, a paragraph, and the metric cards
    // directly beneath, in the main column.
    expect(rowsPer['reason.v1'], 'reason main rows').toBe(97)        // 73 -> 97
    expect(rowsPer['analyze.compare.v1'], 'analyze main rows').toBe(93)  // 77 -> 93
    expect(rowsPer['decide.slate.v1'], 'decide main rows').toBe(104)     // 81 -> 104
    expect(rowsPer['execute.bridge.v1'], 'execute main rows').toBe(122)  // 107 -> 122
    expect(Object.values(rowsPer).reduce((a, b) => a + b, 0), 'total main rows').toBe(416)
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

  it('the generator, the contract validator and the consumed-fields map are untouched', () => {
    const diff = changed(
      'extraction/normalizeCorpus.js'
      + ' src/features/action-stories/contract/decisionObject.js'
      + ' src/features/action-stories/blocks/consumedFields.js',
    )
    expect(diff, `frozen files changed: ${diff}`).toBe('')
  })

  it('and the shape ledger still states the same RULES — see assertLedgerRulesUnchanged', () => {
    assertLedgerRulesUnchanged()
  })

  it('no block component learns its own WIDTH — the part of C1 that still stands', () => {
    // NARROWED IN PHASE 5D, not deleted. 5C's version asserted that no block component changed at
    // all. Ruling R63 lifted that for TEXT ONLY, on measured evidence: 1001 clipped elements across
    // 87 of 105 objects, four of the five owners offering no affordance, and every one of them
    // produced by a `truncate` written inside a block. The file boundary was drawn before that
    // measurement existed.
    //
    // What C1 was protecting is unchanged and is asserted here: a block still does not know how
    // WIDE it is or that it shares a row. Width comes from the slot (packRows.js), the packed cell
    // stretches its child from the layout side, and no block mentions either. The text half of the
    // scope line is T81's `every changed block file changed ONLY its text behaviour`.
    // NOT `\bspan\b` — that matches the `<span>` tag and flagged eight blocks that merely render
    // one. The concepts a block must stay ignorant of are the WIDTH ones, named exactly.
    const GEOMETRY = /packRow|spanOf|CELL_SPAN|data-pack-row|col-span|grid-cols-12|layout\.span|['"](half|full)['"]/
    const offenders = []
    for (const file of changed('src/features/action-stories/blocks/').split('\n')) {
      if (file === '' || file.includes('.test.')) continue
      const code = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (GEOMETRY.test(code)) offenders.push(file)
    }
    expect(offenders, 'a block component now knows its own width').toEqual([])
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

// ---- Phase 5D -------------------------------------------------------------------------------

describe('T77 — text behaviour is declared once, per column role, never per block (I3)', () => {
  // THE DEFECT THIS CLOSES. Phase 5D measured 1001 clipped text elements across 87 of the 105
  // objects, at 1440 and at 1280. Every one of them came from a `truncate` written inside a block
  // component — nine files, each having independently decided how its own text behaves. Four of
  // the five owners offered no affordance at all, so a cut value was simply gone.
  //
  // Ruling R63 lifted I5 for text only, on the condition that the rules live in ONE module. That
  // condition is what makes it a lift rather than a retreat: without it, nine files would still
  // each be deciding, and the per-screen accident this project has removed three times would just
  // have been renamed.
  const BLOCKS_DIR = path.join(REPO_ROOT, 'src/features/action-stories/blocks')
  const blockFiles = []
  ;(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.jsx?$/.test(e.name) && !e.name.includes('.test.')) blockFiles.push(full)
    }
  })(BLOCKS_DIR)

  /** Utility classes that DECIDE how text behaves. Only cellText.js may name them. */
  const TEXT_BEHAVIOUR = /\btruncate\b|\bline-clamp-\d\b|\bwhitespace-(nowrap|normal|pre)\b|\bbreak-words\b|\bmax-w-xs\b|overflow-wrap/

  it('finds the block files it is policing', () => {
    expect(blockFiles.length).toBeGreaterThan(15)
  })

  it('exactly one module declares text behaviour, and it is the shared one', () => {
    const offenders = []
    for (const file of blockFiles) {
      if (path.basename(file) === 'cellText.js') continue
      const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const hits = [...new Set((code.match(TEXT_BEHAVIOUR) ?? []))]
      if (hits.length) offenders.push(`${path.relative(REPO_ROOT, file)}: ${hits.join(', ')}`)
    }
    expect(offenders, 'a block still decides its own text behaviour').toEqual([])
  })

  it('the shared module declares exactly three roles, each with a stated rule', async () => {
    const { CELL_ROLES, cellText } = await import('./blocks/cellText.js')
    expect(Object.keys(CELL_ROLES).sort()).toEqual(['figure', 'identifier', 'prose'])
    for (const [role, spec] of Object.entries(CELL_ROLES)) {
      expect(typeof spec.className, `${role} has no class`).toBe('string')
      expect(spec.className.length, `${role} class is empty`).toBeGreaterThan(0)
      expect(spec.rule?.length ?? 0, `${role} states no rule`).toBeGreaterThan(30)
      expect(typeof spec.truncates, `${role} does not say whether it truncates`).toBe('boolean')
    }
    // I4: the only role permitted to cut text must say so, and must carry an affordance.
    expect(CELL_ROLES.figure.truncates, 'a figure may never be cut — a cut number is a wrong number').toBe(false)
    expect(CELL_ROLES.prose.truncates, 'prose wraps rather than truncating').toBe(false)
    expect(typeof cellText, 'cellText is not callable').toBe('function')
  })

  it('every block that renders text imports the shared module', () => {
    // A block with no text utility class could be passing vacuously — by rendering no text at all,
    // or by having had its class silently deleted. The ones that render cells must USE the module.
    const MUST_USE = [
      'TableBlock.jsx', 'LabelValueListBlock.jsx', 'RosterBlock.jsx', 'GaugeBlock.jsx',
      'ObjectBlock.jsx', 'TextBlock.jsx', 'ItemQueueBlock.jsx',
      path.join('children', 'Metric.jsx'), path.join('children', 'SubRowList.jsx'),
    ]
    const missing = MUST_USE.filter((rel) => !fs.readFileSync(path.join(BLOCKS_DIR, rel), 'utf8').includes('cellText'))
    expect(missing, 'block(s) rendering cells without the shared text contract').toEqual([])
  })
})

describe('T78 — a packed row obeys the ruled vertical contract', () => {
  // THE CONTRACT (R66): paired cells stretch to equal height and the block's card FILLS its cell;
  // the shorter cell's content stays top-aligned and the difference becomes card padding rather
  // than a gap between cards. Justified against the reference, whose own `1fr 1fr` row
  // (S10.1-1-reason.dc.html:248) uses default stretch with equal-height cards.
  //
  // MEASURED IN THE SMOKE RUN, not here. Before the fix, Chrome reported the cells already equal
  // (277/277 on S10.2 reason) while the CARDS inside them were 277 and 235 — 42px of dead space
  // that no className reveals and that jsdom, with every height at 0, cannot see. Asserting it
  // here would be T62's mistake with different words.
  it('the measurement lives in the smoke run, where heights are real', () => {
    const smoke = fs.readFileSync(path.join(REPO_ROOT, 'scripts/smoke.mjs'), 'utf8')
    expect(smoke, 'T78 is not in the smoke run').toContain('T78')
  })

  it('the layout layer, not a block, is what makes the card fill its cell', () => {
    // I5 still holds for geometry: a block does not know it is in a packed row. The cell makes its
    // child fill it, from the layout side, which is the same place the span is declared.
    const sections = fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/components/StageSections.jsx'), 'utf8')
    expect(sections, 'the packed cell does not stretch its child').toMatch(/data-pack-row[\s\S]{0,600}h-full/)
  })
})

describe('T80 — everything Phase 5C established still holds (I7)', () => {
  it('the declared spans are unchanged', async () => {
    const { SLOT_VOCABULARY } = await import('./templates/slotVocabulary.js')
    const halves = Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.span === 'half').map(([n]) => n).sort()
    // THE LIST IS EMPTY NOW, DELIBERATELY, and it is asserted as `[]` rather than deleted — an
    // assertion that no longer exists cannot tell the next reader that a half coming back is a
    // decision someone has to make on purpose.
    //
    // All six halves went, in one rule rather than as three exemptions: `policy` overflowed a 410px
    // cell on 12 screens and `roles` on 4, both measured in Chrome at 1440, and the other three
    // (`entities`, `secondary_rows`, `plan`) never had an adjacent half to pair with, so their
    // declaration had been inert since it was written. A block in the main region now gets the full
    // column. See slotVocabulary.js's `span` note for the measurement and for why the mechanism in
    // packRows.js is kept standing with nothing opted in.
    expect(halves).toEqual([])
  })

  it('the packer is still pure and still never reorders', () => {
    const input = ['policy', 'constraints', 'roles', 'narrative']
    const first = packRow(input)
    for (let i = 0; i < 10; i += 1) expect(packRow(input)).toEqual(first)
    expect(packRow(input).flatMap((r) => r.slots)).toEqual(input)
  })

  it('the pinned action bar is still a non-overlapping sibling', async () => {
    const d = byId('prop_s9_1_decide')
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    const bar = c.querySelector('[data-shell-part="actionbar"]')
    expect(bar).toBeTruthy()
    expect(bar.className).not.toMatch(/\bfixed\b|\babsolute\b/)
    expect(bar.parentElement).toBe(c.querySelector('[data-shell-part="regions"]').parentElement)
    unmount()
  })

  it('the block set per object is identical, and the rail budget is unchanged', () => {
    const differences = []
    const cards = {}
    for (const d of dataset) {
      const pane = renderPaneIsolated(d)
      if (!pane) continue
      const rendered = [...pane.container.querySelectorAll('[data-block-slot]')].map((n) => n.getAttribute('data-block-slot'))
      const resolved = resolveTemplate(d)
      const expected = resolved.manifest.blocks
        .filter((b) => b.when === undefined || evaluateCondition(b.when, d))
        .filter((b) => resolveBinding(b.binding, d) !== undefined)
        .map((b) => b.slotName)
      if (rendered.length !== expected.length || expected.some((s) => !rendered.includes(s))) {
        differences.push(`${d.proposal_id}: ${rendered.length} rendered vs ${expected.length} expected`)
      }
      const aside = pane.container.querySelector('aside')
      cards[resolved.templateId] = Math.max(cards[resolved.templateId] ?? 0, aside ? aside.querySelectorAll('section').length : 0)
      pane.done()
    }
    expect(differences, 'the text fix changed which blocks render').toEqual([])
    expect(Math.max(...Object.values(cards)), 'the 4-card rail budget moved').toBeLessThanOrEqual(4)
  })
})

describe('T81 — no data changed, and no block changed beyond the lifted text scope', () => {
  const changed = (paths) => execSync(`git diff --name-only HEAD -- ${paths}`, { encoding: 'utf8' }).trim()

  it('the normalized corpus is byte-identical (I6)', () => {
    const diff = changed('src/features/action-stories/__corpus__/normalized/')
    expect(diff, `corpus changed: ${diff}`).toBe('')
  })

  it('the generator, the contract validator and the consumed-fields map are untouched', () => {
    const diff = changed(
      'extraction/normalizeCorpus.js'
      + ' src/features/action-stories/contract/decisionObject.js'
      + ' src/features/action-stories/blocks/consumedFields.js',
    )
    expect(diff, `frozen files changed: ${diff}`).toBe('')
  })

  it('and the shape ledger still states the same RULES — see assertLedgerRulesUnchanged', () => {
    assertLedgerRulesUnchanged()
  })

  it('every block that renders cells still takes its text behaviour from the shared module', () => {
    // RETIRED AND REPLACED IN PHASE 5B, not deleted — the same treatment 5C's T71 got here, and for
    // the same reason. This assertion compared the JSX TAG SKELETON of each changed block file
    // before and after, because Phase 5D's lift (R63) permitted text edits and nothing else, and a
    // text edit rewrites attributes without adding or removing an element.
    //
    // Phase 5B's lift is a different one. R68 authorises consumedFields.js to follow the components,
    // R73 moves GaugeBlock's inline status decision into statusTone, and the five variants add real
    // elements — a nested rules list, a footer line, an inline histogram. The skeleton comparison
    // cannot survive that and should not: it was pinning 5D's scope line, and 5D is over.
    //
    // What survives is the guarantee underneath it, which no later phase may undo: a block does not
    // decide how its text behaves. That is asserted structurally by T77 (only cellText.js names a
    // text-behaviour utility) and by usage here.
    const MUST_USE = [
      'TableBlock.jsx', 'LabelValueListBlock.jsx', 'RosterBlock.jsx', 'GaugeBlock.jsx',
      'ObjectBlock.jsx', 'TextBlock.jsx', 'ItemQueueBlock.jsx',
      path.join('children', 'Metric.jsx'), path.join('children', 'SubRowList.jsx'),
    ]
    const blocksDir = path.join(REPO_ROOT, 'src/features/action-stories/blocks')
    const missing = MUST_USE.filter((rel) => !fs.readFileSync(path.join(blocksDir, rel), 'utf8').includes('cellText'))
    expect(missing, 'a block rendering cells stopped using the shared text contract').toEqual([])
  })
})

describe('T82 — the live path stays green across all 105', () => {
  it('every object still renders with no error copy and real content', async () => {
    const { getStageView } = await import('@/services/actionStoriesService')
    const { __resetMockApi } = await import('@/services/mockDecisionApi')
    __resetMockApi()
    const views = await Promise.all(dataset.map((d) => getStageView(d.story_code, d.stage, d.proposal_id)))
    expect(views).toHaveLength(105)

    const broken = []
    for (const view of views) {
      const own = document.createElement('div')
      document.body.appendChild(own)
      const ownRoot = createRoot(own)
      act(() => { ownRoot.render(<StageRenderer manifest={view.manifest} fixture={view.decision} />) })
      const text = (own.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (/can't be displayed yet|unexpected response|Something went wrong/i.test(text)) {
        broken.push(`${view.decision.proposal_id}: error copy`)
      }
      if (text.length < 50) broken.push(`${view.decision.proposal_id}: rendered almost nothing`)
      act(() => ownRoot.unmount())
      own.remove()
    }
    expect(broken, `${broken.length} of 105 broke`).toEqual([])
  })
})
