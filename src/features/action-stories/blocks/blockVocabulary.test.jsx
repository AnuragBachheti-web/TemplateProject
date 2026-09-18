// @vitest-environment jsdom
//
// Phase 3B, T24-T32: the widened block vocabulary and row-level nesting.
//
// THE DEFECT THIS PHASE CLOSES. 51 slots mapped onto 11 blockTypes, so slots with different operator
// meaning rendered identically because no other block existed to route them to. `table` carried 13
// slots; `labelValueList` carried 7. And blocks were leaves — a row could not host a badge, a chip
// or a metric, so anything structured inside a row was flattened to text by `flattenNestedEntry`
// BEFORE any block got a chance to render it richly.
//
// The clearest case, and the one Phase 2 already paid for: `guardrails.checks` carries a 5-value
// status enum on 85 rows across 20 objects, and it rendered as the literal text token "· warn"
// inside a labelValueList. The data shipped in Phase 2; the block did not. T25 is that test.
//
// FOUR blockTypes are added, not eleven more (I6). Every count below is measured, not chosen, and
// every one of them is the number of objects on which the block ACTUALLY RENDERS — data present AND
// the slot declared by that object's resolved template. A count of "objects with data" would be the
// thinner claim, and I1 exists to stop exactly that.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'

import StageRenderer from '../components/StageRenderer'
import { resolveTemplate } from '../templates/templateRegistry'
import { resolveBinding } from '../manifests/resolveBinding'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { BLOCK_REGISTRY } from './index'
import { BLOCK_TYPES } from '../manifests/blockTypes'
import { MAX_BLOCK_DEPTH } from './renderDepth'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const BLOCKS_DIR = path.resolve(__dirname)

/**
 * THE FOUR NEW BLOCKS, with the slots they own and the object count each must render on.
 * `renders` is measured: data present AND the slot declared by the object's own template.
 */
const NEW_BLOCKS = [
  {
    blockType: 'checklist',
    slots: ['guardrail_checks'],
    renders: 19,
    // 20 objects carry `guardrails.checks`; the 21st is prop_s10_6_live, whose template
    // (execute.bridge.v1) does not declare the slot. 19 is the honest number.
    hasData: 20,
  },
  {
    blockType: 'statList',
    slots: ['totals_rows', 'progress_rows', 'inputs', 'basis'],
    // 51 objects carried data for one of the four slots; prop_s10_6_reason has `totals.rows` but
    // reason.v1 declares no `totals_rows` slot, so the render count was always one lower than the
    // data count. The distinction matters: a count of "objects with data" would overstate the
    // block's reach, which is exactly the thinner claim I1 exists to reject.
    //
    // PHASE 5A DELTA: 50 -> 49 renders, 51 -> 50 with data. One object, prop_s9_2_decide, loses
    // `proposal.basis`. Its source was `ladder` — five named service-level scenarios each carrying
    // four money figures (svc / outlay / lost / head) — and statList renders a label and ONE figure,
    // so the pane showed five bare words: "Lean", "Trim", "Policy", "Guarded", "Max". The claim is
    // withdrawn rather than re-pointed (R48), and `ladder` is carried in shapeLedger.js's
    // DEFERRED_SHAPES as `scenario-ladder` with the shape it needs. The block lost an object and the
    // screen lost five words that were never the data.
    renders: 49,
    hasData: 50,
  },
  { blockType: 'cardSet', slots: ['alternatives', 'next_actions', 'item_groups'], renders: 17, hasData: 17 },
  { blockType: 'roster', slots: ['agents'], renders: 26, hasData: 26 },
]

let container
let root

function renderPane(decision) {
  const resolved = resolveTemplate(decision)
  if (!resolved) return null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<StageRenderer manifest={resolved.manifest} fixture={decision} />)
  })
  return { container, templateId: resolved.templateId }
}

function unmount() {
  if (root) act(() => root.unmount())
  container?.remove()
  root = undefined
  container = undefined
}

/** Objects on which a blockType actually renders: data present AND slot declared by its template. */
function objectsRendering(slots) {
  return dataset.filter((d) => {
    const resolved = resolveTemplate(d)
    if (!resolved) return false
    return resolved.manifest.blocks.some((b) => {
      if (!slots.includes(b.slotName)) return false
      const v = resolveBinding(b.binding, d)
      return Array.isArray(v) && v.length > 0
    })
  })
}

afterEach(unmount)

describe('T24 — each new blockType renders real shipped data on the counts F states', () => {
  it.each(NEW_BLOCKS)('$blockType is a registered blockType owning its slots', ({ blockType, slots }) => {
    expect(BLOCK_TYPES, `${blockType} is not declared`).toContain(blockType)
    expect(BLOCK_REGISTRY[blockType], `${blockType} has no component`).toBeTruthy()
    for (const slot of slots) {
      expect(SLOT_VOCABULARY[slot], `slot ${slot} does not exist`).toBeTruthy()
      expect(SLOT_VOCABULARY[slot].blockType, `slot ${slot} was not re-pointed`).toBe(blockType)
    }
  })

  it.each(NEW_BLOCKS)('$blockType renders on exactly $renders objects', ({ blockType, slots, renders, hasData }) => {
    const objs = objectsRendering(slots)
    expect(objs.length, `${blockType} render count`).toBe(renders)
    // The count must come from real data, not from the slot merely being declared.
    const withData = dataset.filter((d) => slots.some((s) => {
      const v = resolveBinding(SLOT_VOCABULARY[s].binding, d)
      return Array.isArray(v) && v.length > 0
    }))
    expect(withData.length, `${blockType} data count`).toBe(hasData)
  })

  it.each(NEW_BLOCKS)('$blockType produces non-trivial DOM on every one of those objects', ({ blockType, slots }) => {
    const broken = []
    for (const d of objectsRendering(slots)) {
      const out = renderPane(d)
      const nodes = out.container.querySelectorAll(`[data-block-type="${blockType}"]`)
      if (nodes.length === 0) broken.push(`${d.proposal_id}: no ${blockType} node rendered`)
      else {
        const text = [...nodes].map((n) => n.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim()
        if (text.length < 10) broken.push(`${d.proposal_id}: ${blockType} rendered almost nothing`)
      }
      // No block may render an error or empty state on an object F says has data (I1).
      if (out.container.querySelector(`[data-block-type="${blockType}"] [data-block-state]`)) {
        broken.push(`${d.proposal_id}: ${blockType} fell back to a placeholder state`)
      }
      unmount()
    }
    expect(broken, `${broken.length} object(s) failed`).toEqual([])
  })

  it('the vocabulary grew by concepts, not toward parity (I6)', () => {
    // 14 were declared before Phase 3B, 11 of them slot-targeted. 3B added four concepts and 3C
    // added `timeline`, so 19 declared — against 51 slots. The gap is the point: slots share blocks
    // when they share a concept.
    //
    // PHASE 5A DELTA: slot-targeted 16 -> 17. `slider` joins, and NOT because a block was added —
    // BLOCK_TYPES is still 19. Ruling R50 gave `proposal.threshold_control` the slot it never had,
    // and that path binds the slider block which has been registered and unreachable since the
    // vocabulary was written. The count moving without BLOCK_TYPES moving is exactly what I6 wants:
    // a concept found a home in a block that already existed.
    expect(BLOCK_TYPES).toHaveLength(19)
    const slotTargeted = new Set(Object.values(SLOT_VOCABULARY).map((s) => s.blockType))
    expect(slotTargeted.size, 'slot-targeted blockTypes').toBe(17)
  })
})

describe('T25 — guardrails.checks renders as a checklist, and the "· warn" token is gone', () => {
  const withChecks = objectsRendering(['guardrail_checks'])

  it('covers the 19 objects that render it', () => {
    expect(withChecks).toHaveLength(19)
  })

  it('renders a per-row status affordance for every check row', () => {
    for (const d of withChecks) {
      const out = renderPane(d)
      const rows = d.guardrails.checks
      const badges = out.container.querySelectorAll('[data-check-status]')
      expect(badges.length, `${d.proposal_id}: ${rows.length} rows but ${badges.length} status badges`).toBe(rows.length)
      // The badge carries the SEMANTIC status, and the component decides how it looks.
      const rendered = [...badges].map((b) => b.getAttribute('data-check-status'))
      expect(rendered).toEqual(rows.map((r) => r.status))
      unmount()
    }
  })

  it('the raw enum word never renders as TEXT inside a checklist', () => {
    // The T13 delta Phase 2 pinned: a status enum leaking as text because labelValueList renders
    // every key of a row generically, producing "GMROI target ≥ 2.4  2.31 · warn · 96".
    //
    // Scoped to the checklist's own DOM, not the whole pane, and this is a correction rather than a
    // convenience: an unscoped search flagged prop_s9_7_decide for "· blocked", which turned out to
    // be `item_groups[3].rows[1].value === "blocked"` — a real business value in a nested row that
    // SubRowList joins with " · ". Banning a word everywhere would have made a legitimate value
    // unrenderable. What must not appear is the lowercase enum token inside a check row; the badge
    // renders statusTone's human label ("Warning") instead.
    const offenders = []
    for (const d of dataset) {
      const out = renderPane(d)
      if (!out) continue
      for (const node of out.container.querySelectorAll('[data-block-type="checklist"]')) {
        const text = (node.textContent ?? '').replace(/\s+/g, ' ')
        for (const status of ['pass', 'warn', 'fail', 'blocked', 'info']) {
          if (new RegExp(`(^|[^a-z])${status}([^a-z]|$)`).test(text)) {
            offenders.push(`${d.proposal_id}: checklist renders the raw token "${status}"`)
          }
        }
      }
      unmount()
    }
    expect(offenders, 'a status enum is still rendering as a text token').toEqual([])
  })

  it('the checklist renders the human label, not the enum', () => {
    const d = dataset.find((x) => x.proposal_id === 'prop_s9_1_decide')
    const out = renderPane(d)
    const text = out.container.querySelector('[data-block-type="checklist"]').textContent ?? ''
    // S9.1's three checks are warn, pass, pass.
    expect(text).toContain('Warning')
    expect(text).toContain('Pass')
    unmount()
  })

  it('still shows the human-readable parts of each check', () => {
    // Removing the token must not remove the content. The label/text and the note still render.
    const d = dataset.find((x) => x.proposal_id === 'prop_s9_1_decide')
    const out = renderPane(d)
    const text = out.container.textContent ?? ''
    expect(text).toContain('GMROI target ≥ 2.4')
    expect(text).toContain('Short by 0.09')
    unmount()
  })
})

describe('T26 — the render tree reaches depth 4, and never exceeds it', () => {
  function depthsIn(el) {
    return [...el.querySelectorAll('[data-block-depth]')].map((n) => Number(n.getAttribute('data-block-depth')))
  }

  it('MAX_BLOCK_DEPTH is 4 (Pane > Section > Block > child)', () => {
    expect(MAX_BLOCK_DEPTH).toBe(4)
  })

  it('reaches depth 4 on at least one decide object — real data, not a synthetic row', () => {
    const reached = []
    for (const d of dataset.filter((x) => x.stage === 'decide')) {
      const out = renderPane(d)
      if (out && Math.max(0, ...depthsIn(out.container)) >= MAX_BLOCK_DEPTH) reached.push(d.proposal_id)
      unmount()
    }
    expect(reached.length, 'no decide object exercises row-level nesting').toBeGreaterThan(0)
  })

  it('never exceeds depth 4 on any of the 105', () => {
    const over = []
    for (const d of dataset) {
      const out = renderPane(d)
      if (!out) continue
      const max = Math.max(0, ...depthsIn(out.container))
      if (max > MAX_BLOCK_DEPTH) over.push(`${d.proposal_id}: depth ${max}`)
      unmount()
    }
    expect(over, 'the depth cap was exceeded').toEqual([])
  })

  it('reports the depth actually reached per template', () => {
    // Required evidence: a cap that holds because nothing reaches it proves nothing.
    const perTemplate = {}
    for (const d of dataset) {
      const out = renderPane(d)
      if (!out) continue
      const max = Math.max(0, ...depthsIn(out.container))
      perTemplate[out.templateId] = Math.max(perTemplate[out.templateId] ?? 0, max)
      unmount()
    }
    console.info('render-tree depth reached per template:', JSON.stringify(perTemplate))
    // Every template that renders any block must reach at least Block level.
    for (const [tpl, depth] of Object.entries(perTemplate)) {
      expect(depth, `${tpl} reached only depth ${depth}`).toBeGreaterThanOrEqual(3)
    }
    // And the row-level mechanism must be live on more than one template.
    expect(Object.values(perTemplate).filter((v) => v >= 4).length).toBeGreaterThanOrEqual(2)
  })
})

describe('T27 — flattenNestedEntry is a fallback, not the first path (I5)', () => {
  it('is called zero times on the decide stage', async () => {
    // Measured at 499 calls across 5 slots before this phase: item_groups 153,
    // guardrail_checks 141, totals_rows 128, next_actions 53, basis 24. All five re-point onto a
    // block that renders their structure natively, so decide reaches zero.
    const nested = await import('./nestedEntryText')
    const original = nested.flattenNestedEntry
    let calls = 0
    const spy = vi.spyOn(nested, 'flattenNestedEntry').mockImplementation((...args) => {
      calls += 1
      return original(...args)
    })

    for (const d of dataset.filter((x) => x.stage === 'decide')) {
      renderPane(d)
      unmount()
    }
    spy.mockRestore()
    expect(calls, `flattenNestedEntry ran ${calls} times on decide`).toBe(0)
  })

  it('is still REACHABLE — it is a fallback, not dead code (R27)', async () => {
    // Analyze and execute keep it on purpose: `entities`, `verification`, `rollback` and `plan` have
    // no semantic reason to move, and re-pointing them to hit a number would invert I1.
    const nested = await import('./nestedEntryText')
    expect(typeof nested.flattenNestedEntry).toBe('function')
    expect(nested.flattenNestedEntry({ label: 'a', value: 'b' })).toContain('a')
  })
})

describe('T28 — no component or variant is chosen by sniffing data shape (I2)', () => {
  const NEW_SOURCES = ['ChecklistBlock.jsx', 'StatListBlock.jsx', 'CardSetBlock.jsx', 'RosterBlock.jsx']

  it('the four new blocks exist as their own modules', () => {
    for (const f of NEW_SOURCES) {
      expect(fs.existsSync(path.join(BLOCKS_DIR, f)), `${f} is missing`).toBe(true)
    }
  })

  it('no new block imports the registry or resolves a slot — a child is a component, not a re-entry (I4)', () => {
    for (const f of NEW_SOURCES) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, f), 'utf8')
      expect(src, `${f} imports the block registry`).not.toMatch(/BLOCK_REGISTRY/)
      expect(src, `${f} re-enters the slot pipeline`).not.toMatch(/SLOT_VOCABULARY|resolveBinding|composeSections/)
    }
  })

  it('the child components are NOT registered, so no slot can ever target one (I4)', () => {
    const childDir = path.join(BLOCKS_DIR, 'children')
    expect(fs.existsSync(childDir), 'blocks/children is missing').toBe(true)
    const children = fs.readdirSync(childDir).filter((f) => f.endsWith('.jsx')).map((f) => f.replace('.jsx', ''))
    expect(children.length, 'no child components were built').toBeGreaterThanOrEqual(3)
    for (const name of children) {
      const key = name.charAt(0).toLowerCase() + name.slice(1)
      expect(BLOCK_REGISTRY[key], `${name} is registered as a blockType`).toBeUndefined()
      expect(BLOCK_TYPES, `${name} is declared as a blockType`).not.toContain(key)
    }
  })

  it('no new block selects a component or variant from the shape of its data', () => {
    // Structural, not prose: a variant may be chosen by an explicit slot property or a template
    // flag, never by counting keys or testing Array.isArray to decide WHICH component to render.
    for (const f of NEW_SOURCES) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, f), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      // A component held in a variable and chosen conditionally is the pattern being banned.
      expect(code, `${f} picks a component dynamically`).not.toMatch(/const\s+[A-Z]\w*\s*=\s*.*\?\s*[A-Z]\w*\s*:/)
      expect(code, `${f} indexes a component map`).not.toMatch(/COMPONENTS\s*\[|REGISTRY\s*\[/)
      expect(code, `${f} branches on key count`).not.toMatch(/Object\.keys\([^)]*\)\.length\s*[><=]/)
    }
  })
})

describe('T29 — the Phase 2 and 3A boundaries still hold', () => {
  it('T10/T20/T21 run against the unchanged corpus', async () => {
    // Re-asserted here rather than trusted: these suites read the corpus, and this phase must not
    // touch it. The specific guards are the presentation-key walk and the geometry-absence list.
    const keys = new Set()
    ;(function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk)
      if (v !== null && typeof v === 'object') {
        for (const [k, sub] of Object.entries(v)) {
          keys.add(k)
          walk(sub)
        }
      }
    })(dataset)

    for (const banned of ['tone', 'tint', 'hue', 'icon', 'bg', 'fill', 'stroke', 'className']) {
      expect([...keys].includes(banned), `${banned} is in the corpus`).toBe(false)
    }
    for (const geometry of ['floorPct', 'nowPct', 'targetPct', 'markPct', 'widthPct', 'bandWidth', 'targetY']) {
      expect([...keys].includes(geometry), `${geometry} was claimed`).toBe(false)
    }
  })

  it('no rendered pane emits a CSS variable or a hex colour from data', () => {
    const offenders = []
    for (const d of dataset.slice(0, 30)) {
      const out = renderPane(d)
      if (!out) continue
      const html = out.container.innerHTML
      if (html.includes('var(--mod-') || html.includes('color-mix(')) offenders.push(d.proposal_id)
      unmount()
    }
    expect(offenders).toEqual([])
  })
})

describe('T30 — the live path stays green for all 105 with the new blocks in place', () => {
  it('every object resolves through the transport and renders without an error state', async () => {
    // T16's guarantee, re-run against the widened vocabulary: a new block that throws or falls back
    // to a placeholder on a shipped object would show up here as operator error copy.
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
})

describe('T31 — Phase 3B widened the BLOCK vocabulary and claimed no new data (C1)', () => {
  // RETIRED AND REPLACED in Phase 5A, for the reasons set out at slotCorrections.test.jsx's T37 —
  // in short, a `git diff` freeze forbids every later phase from touching the corpus, and it goes
  // silent the moment its own phase is committed.
  //
  // What C1 actually guaranteed is that the four new blocks rendered data that was ALREADY in the
  // corpus: 3B added a way to show things, not things to show. That is pinned by content here.

  it('every slot the four 3B blocks own reads a canonical path that predates them', () => {
    // If 3B had claimed new data, one of these paths would have appeared with it. Each is bound by a
    // slot whose binding is unchanged since Phase 2's contract, and the provenance map still sources
    // every one of them from the reference's own key for that concept.
    const OWNED = {
      checklist: ['guardrails.checks'],
      statList: ['totals.rows', 'execution.progress_rows', 'proposal.inputs', 'proposal.basis', 'proposal.recommendation_metrics'],
      cardSet: ['proposal.alternatives', 'proposal.next_actions', 'proposal.item_groups'],
      roster: ['proposal.agents'],
    }
    for (const [blockType, paths] of Object.entries(OWNED)) {
      for (const path of paths) {
        const slot = Object.values(SLOT_VOCABULARY).find((s) => s.binding === path)
        expect(slot, `no slot binds ${path}`).toBeTruthy()
        expect(slot.blockType, `${path} is no longer a ${blockType}`).toBe(blockType)
      }
    }
  })

  it('adds no canonical field of its own — the four blocks render paths the contract already had', () => {
    // A 3B-introduced field would have to be sourced from somewhere; nothing in the provenance map
    // names a source for a path outside the declared vocabulary, which referenceFidelity.test.js
    // already asserts field by field. What this adds is the count: 3B's blocks serve 10 slots.
    const served = Object.values(SLOT_VOCABULARY).filter((s) =>
      ['checklist', 'statList', 'cardSet', 'roster'].includes(s.blockType))
    expect(served).toHaveLength(10)
  })
})

describe('T32 — one status-to-tone module, and no palette literal in a block component (I3)', () => {
  /**
   * PRE-EXISTING palette literals, named by ruling R25 rather than cleaned. None is in the re-point
   * set, and none is data-driven:
   *
   *   BlockStates.jsx        the shared empty/error state — `rose-*` is that state's own identity
   *   BlockErrorBoundary.jsx the shared error boundary, same reason
   *   SliderBlock.jsx        an UNUSED blockType; no canonical slot targets it
   *
   * Cleaning them would mix unrelated churn into a phase whose acceptance criteria are a zero corpus
   * diff and explainable render deltas. THE LIST MAY NOT GROW WITHOUT A RULING — its length is
   * asserted, so a fourth file cannot be added quietly.
   */
  const PRE_EXISTING_PALETTE_R25 = ['BlockStates.jsx', 'BlockErrorBoundary.jsx', 'SliderBlock.jsx']

  /** A raw Tailwind palette literal. Design tokens (`rf-*`) are explicitly NOT this (R25). */
  const PALETTE = /\b(?:bg|text|border|ring|accent|from|to|via|fill|stroke|decoration|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
  const HEX = /#[0-9a-fA-F]{6}\b/

  it('the exemption list is exactly the three files R25 named', () => {
    expect(PRE_EXISTING_PALETTE_R25).toHaveLength(3)
    expect(PRE_EXISTING_PALETTE_R25).toEqual(['BlockStates.jsx', 'BlockErrorBoundary.jsx', 'SliderBlock.jsx'])
  })

  it('no block component outside that list contains a raw palette literal', () => {
    const offenders = []
    for (const file of fs.readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))) {
      if (PRE_EXISTING_PALETTE_R25.includes(file)) continue
      const src = fs.readFileSync(path.join(BLOCKS_DIR, file), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (PALETTE.test(code)) offenders.push(`${file}: ${PALETTE.exec(code)[0]}`)
      if (HEX.test(code)) offenders.push(`${file}: ${HEX.exec(code)[0]}`)
    }
    expect(offenders, 'a palette literal is in a block component').toEqual([])
  })

  it('no CHILD component contains a raw palette literal either', () => {
    const childDir = path.join(BLOCKS_DIR, 'children')
    expect(fs.existsSync(childDir)).toBe(true)
    const offenders = []
    for (const file of fs.readdirSync(childDir).filter((f) => f.endsWith('.jsx'))) {
      const src = fs.readFileSync(path.join(childDir, file), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (PALETTE.test(code)) offenders.push(`children/${file}: ${PALETTE.exec(code)[0]}`)
      if (HEX.test(code)) offenders.push(`children/${file}: ${HEX.exec(code)[0]}`)
    }
    expect(offenders).toEqual([])
  })

  it('exactly ONE module maps a semantic word to a tone (R26)', () => {
    // severityTone.js is renamed to statusTone.js and gains the check-status map. Two modules for
    // one concept, split by which enum arrived first, is how a duplicate map starts.
    expect(fs.existsSync(path.join(BLOCKS_DIR, 'statusTone.js')), 'statusTone.js is missing').toBe(true)
    expect(fs.existsSync(path.join(BLOCKS_DIR, 'severityTone.js')), 'severityTone.js was not renamed').toBe(false)

    // Scoped to modules that map a status WORD to a tone. deltaTone.js maps a value's own SIGN and
    // chartPalette.js maps chart series — both use the same `rf-status-*` tokens, correctly, and
    // neither is a second copy of this concept. The thing that must not be duplicated is a map
    // KEYED BY THE STATUS VOCABULARY.
    const STATUS_WORD_KEY = /\b(pass|warn|fail|blocked|info|crit|critical|blocking|high|medium|low|act|opp|watch)\s*:/
    const mapModules = fs.readdirSync(BLOCKS_DIR).filter((f) => {
      if (!f.endsWith('.js') || f.includes('.test.')) return false
      const src = fs.readFileSync(path.join(BLOCKS_DIR, f), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      return /rf-status-(critical|warning|success)/.test(code) && STATUS_WORD_KEY.test(code)
    })
    expect(mapModules, 'more than one module maps a status word to a tone').toEqual(['statusTone.js'])
  })

  it('statusTone exports a tone for every guardrail check status', async () => {
    const { checkStatusTone } = await import('./statusTone')
    for (const status of ['pass', 'warn', 'fail', 'blocked', 'info']) {
      const tone = checkStatusTone(status)
      expect(tone, `no tone for ${status}`).toBeTruthy()
      expect(typeof tone.dot).toBe('string')
      expect(tone.dot, `${status} tone is a palette literal`).not.toMatch(PALETTE)
    }
    // An unknown status must not throw and must not silently read as a pass.
    expect(checkStatusTone('nonsense')).toEqual(checkStatusTone('info'))
  })

  it('the checklist component does not carry its own colour decisions', () => {
    const src = fs.readFileSync(path.join(BLOCKS_DIR, 'ChecklistBlock.jsx'), 'utf8')
    expect(src, 'ChecklistBlock maps status to colour itself').toMatch(/statusTone|checkStatusTone|StatusBadge/)
  })
})
