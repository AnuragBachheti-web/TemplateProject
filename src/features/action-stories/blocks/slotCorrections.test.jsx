// @vitest-environment jsdom
//
// Phase 3C, T33-T39: slot-to-block corrections found by comparing the rendered app against the
// reference build, and the last correction of this kind.
//
// WHAT THE SURVEY FOUND. Fourteen slots remained on `table` or `labelValueList`. Read against the
// reference source — `<sc-for list="{{ key }}">` plus its template body — eight of them are genuinely
// columnar or genuinely mixed and STAY (see deliverable G). Three are not:
//
//   trigger                 S10.1-1-reason:338-343   mono uppercase {{ t.when }} then prose {{ t.what }}
//   flags                   S9.13-4-execute          the same shape over {when, rule, action}
//   recommendation_metrics  S10.2-3-decide:209-213   eyebrow {{ m.label }}, 20px {{ m.value }}, prose {{ m.note }}
//
// AND TWO PREMISES THAT DID NOT SURVIVE THE SURVEY. `classifier` and `recon` are raw reference keys,
// not slots. `classifier` lands in `proposal.detail_rows` (15 raw sources, 25 objects, dominant
// source `rows` a 5-column grid) and `recon` in `proposal.comparison` (13 sources, 13 objects, one
// each, twelve genuinely chart-shaped). Re-pointing either would break 24 and 12 correctly-typed
// objects to fix one. They are unreachable at slot granularity — the deliberate cost of 51 canonical
// slots replacing 835 names — so they stay, and the counts are asserted below so the decision is
// retrievable rather than remembered.
//
// The consolation is real: `recon`'s markup is the same pattern as `heroMetrics`, so re-pointing
// `recommendation_metrics` delivers the metric grid on 9 objects instead of 1.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

import StageRenderer from '../components/StageRenderer'
import { resolveTemplate } from '../templates/templateRegistry'
import { resolveBinding } from '../manifests/resolveBinding'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { BLOCK_REGISTRY } from './index'
import { BLOCK_TYPES } from '../manifests/blockTypes'
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

/** The three approved re-points (R28/R29), with the object count each renders on. */
const REPOINTS = [
  { slot: 'trigger', from: 'table', to: 'timeline', renders: 15 },
  { slot: 'flags', from: 'table', to: 'timeline', renders: 2 },
  { slot: 'recommendation_metrics', from: 'table', to: 'statList', renders: 9 },
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

/** Objects where a slot has data AND its own template declares it — what actually renders. */
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

describe('T33 — each re-pointed slot renders as its new block, on real shipped data', () => {
  it.each(REPOINTS)('$slot moves $from -> $to in the vocabulary', ({ slot, to }) => {
    expect(SLOT_VOCABULARY[slot], `slot ${slot} does not exist`).toBeTruthy()
    expect(SLOT_VOCABULARY[slot].blockType, `${slot} was not re-pointed`).toBe(to)
  })

  it.each(REPOINTS)('$slot renders on exactly $renders objects', ({ slot, renders }) => {
    expect(objectsRendering([slot]).length, `${slot} render count`).toBe(renders)
  })

  it.each(REPOINTS)('$slot produces non-trivial DOM as $to on every one of those objects', ({ slot, to }) => {
    const broken = []
    for (const d of objectsRendering([slot])) {
      const out = renderPane(d)
      const nodes = out.container.querySelectorAll(`[data-block-type="${to}"]`)
      if (nodes.length === 0) broken.push(`${d.proposal_id}: no ${to} node`)
      if (out.container.querySelector(`[data-block-type="${to}"] [data-block-state]`)) {
        broken.push(`${d.proposal_id}: ${to} fell back to a placeholder`)
      }
      unmount()
    }
    expect(broken, `${broken.length} object(s) failed`).toEqual([])
  })

  it('timeline serves BOTH its slots — 17 objects, and the two sets are disjoint', () => {
    // 15 + 2. I6's test: a blockType earning its place serves a concept, not a slot.
    expect(objectsRendering(['trigger', 'flags'])).toHaveLength(17)
    const trig = new Set(objectsRendering(['trigger']).map((d) => d.proposal_id))
    const flag = objectsRendering(['flags']).map((d) => d.proposal_id)
    expect(flag.filter((id) => trig.has(id)), 'the counts double-count an object').toEqual([])
  })

  it('statList gains a FIFTH slot but no new objects — stated, not implied', () => {
    // All 9 recommendation_metrics objects are decide-stage and already rendered a statList via
    // totals_rows or basis. The block's reach is unchanged at 50; what changes is that one more
    // slot now renders as the concept it is. Asserting this stops the change being reported as
    // growth it is not.
    const slots = Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.blockType === 'statList').map(([n]) => n)
    expect(slots.sort()).toEqual(['basis', 'inputs', 'progress_rows', 'recommendation_metrics', 'totals_rows'])
    expect(objectsRendering(slots)).toHaveLength(50)
  })

  it('R30 — statList renders the `note` every heroMetrics row carries', () => {
    // All 39 recommendation_metrics rows carry `note`, and Metric's chain was meta ?? detail ?? pct,
    // so it would have been dropped. Added as an additive link: no other statList slot carries note.
    const d = dataset.find((x) => x.proposal_id === 'prop_s9_1_decide')
    const rows = d.proposal.recommendation_metrics
    expect(rows.every((r) => typeof r.note === 'string')).toBe(true)
    const out = renderPane(d)
    const text = out.container.textContent ?? ''
    for (const row of rows) expect(text, `lost note: ${row.note}`).toContain(row.note)
    unmount()
  })

  it('CONTEXT withdrawn: detail_rows and comparison are NOT re-pointed', () => {
    // `classifier` lands in detail_rows and `recon` in comparison. Both renderings the reference
    // shows are correct; neither is reachable without breaking the other objects on the same slot.
    expect(SLOT_VOCABULARY.detail_rows.blockType).toBe('table')
    expect(SLOT_VOCABULARY.comparison.blockType).toBe('barChart')
    expect(objectsRendering(['detail_rows'])).toHaveLength(25)
    expect(objectsRendering(['comparison'])).toHaveLength(13)
  })
})

describe('T34 — trigger and flags render as timestamp-labelled descriptions', () => {
  const triggerObjects = objectsRendering(['trigger'])
  const flagObjects = objectsRendering(['flags'])

  it('covers 15 trigger objects and 2 flags objects', () => {
    expect(triggerObjects).toHaveLength(15)
    expect(flagObjects).toHaveLength(2)
  })

  it('every trigger row with a `when` renders it as an eyebrow, with its prose below', () => {
    for (const d of triggerObjects) {
      const rows = d.proposal.trigger
      const withWhen = rows.filter((r) => typeof r.when === 'string' && r.when.trim() !== '')
      if (withWhen.length === 0) continue
      const out = renderPane(d)
      const block = out.container.querySelector('[data-block-type="timeline"]')
      expect(block, `${d.proposal_id}: no timeline block`).toBeTruthy()
      const eyebrows = [...block.querySelectorAll('[data-timeline-when]')].map((n) => n.textContent)
      expect(eyebrows, `${d.proposal_id} eyebrows`).toEqual(withWhen.map((r) => r.when))
      for (const row of withWhen) {
        expect(block.textContent, `${d.proposal_id}: lost "${row.what}"`).toContain(row.what)
      }
      unmount()
    }
  })

  it('flags renders its cadence as the eyebrow and its rule and action as the description', () => {
    for (const d of flagObjects) {
      const out = renderPane(d)
      const block = out.container.querySelector('[data-block-type="timeline"]')
      expect(block, `${d.proposal_id}: no timeline block`).toBeTruthy()
      for (const row of d.execution.flags) {
        expect(block.textContent, `lost when: ${row.when}`).toContain(row.when)
        expect(block.textContent, `lost rule: ${row.rule}`).toContain(row.rule)
        expect(block.textContent, `lost action: ${row.action}`).toContain(row.action)
      }
      unmount()
    }
  })

  it('the "When | What" column headers appear nowhere in any rendered pane', () => {
    // A table's headers assert that the two fields are parallel columns. `when` is a label FOR
    // `what`, not a peer of it, and that assertion is what this phase removes.
    const offenders = []
    for (const d of dataset) {
      const out = renderPane(d)
      if (!out) continue
      const text = (out.container.textContent ?? '').replace(/\s+/g, ' ')
      if (/When\s*What/.test(text)) offenders.push(`${d.proposal_id}: "When What"`)
      if (/When\s*Rule\s*Action/.test(text)) offenders.push(`${d.proposal_id}: "When Rule Action"`)
      unmount()
    }
    expect(offenders, 'a timestamp is still rendering as a table column').toEqual([])
  })

  it('R31 — prop_s9_11_reason renders by LABEL with no eyebrow, and the defect is pinned', () => {
    // This object's `trigger` rows come from `opportunity` and carry {label, value, pct, meta} —
    // a metric shape claimed into a chronology slot. It is a claim-ledger misclassification and
    // I7 freezes the corpus, so the block does NOT special-case it: a block that branched on row
    // shape to cope with bad data would be I2's violation arriving through the back door.
    //
    // What the block does is read its declared identity fields in a fixed order, exactly as
    // CardSetBlock reads HEADLINE_KEYS. So these rows render by label, with no eyebrow, and this
    // assertion is what keeps the defect visible instead of silently absorbed.
    const d = dataset.find((x) => x.proposal_id === 'prop_s9_11_reason')
    const rows = d.proposal.trigger
    expect(rows.every((r) => r.when === undefined), 'the fixture changed shape').toBe(true)
    expect(rows.every((r) => typeof r.label === 'string')).toBe(true)

    const out = renderPane(d)
    const block = out.container.querySelector('[data-block-type="timeline"]')
    expect(block).toBeTruthy()
    expect(block.querySelectorAll('[data-timeline-when]'), 'rendered an eyebrow with no `when`').toHaveLength(0)
    for (const row of rows) expect(block.textContent, `lost label: ${row.label}`).toContain(row.label)
    unmount()
  })
})

describe('T35 — no data-shape branch was introduced (I2, extends T28)', () => {
  const NEW_SOURCES = ['TimelineBlock.jsx']

  it('the timeline block exists as its own module', () => {
    for (const f of NEW_SOURCES) expect(fs.existsSync(path.join(BLOCKS_DIR, f)), `${f} missing`).toBe(true)
  })

  it('it does not import the registry or re-enter the slot pipeline (I4)', () => {
    for (const f of NEW_SOURCES) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, f), 'utf8')
      expect(src, `${f} imports the registry`).not.toMatch(/BLOCK_REGISTRY/)
      expect(src, `${f} re-enters the slot pipeline`).not.toMatch(/SLOT_VOCABULARY|resolveBinding|composeSections/)
    }
  })

  it('it selects no component or variant from the shape of its data', () => {
    for (const f of NEW_SOURCES) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, f), 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, `${f} picks a component dynamically`).not.toMatch(/const\s+[A-Z]\w*\s*=\s*.*\?\s*[A-Z]\w*\s*:/)
      expect(code, `${f} indexes a component map`).not.toMatch(/COMPONENTS\s*\[|REGISTRY\s*\[/)
      expect(code, `${f} branches on key count`).not.toMatch(/Object\.keys\([^)]*\)\.length\s*[><=]/)
    }
  })
})

describe('T36 — the boundary still holds (I3)', () => {
  it('no presentation key crossed from the reference into the corpus', () => {
    // The reference's classifier/rollback rows carry c.tone, c.border, c.bg, c.mark, c.tagTint,
    // r.btnBg and more. They are stripped and stay stripped; nothing in this phase reads them.
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
    for (const banned of ['tone', 'tint', 'bg', 'border', 'mark', 'icon', 'tagTint', 'tagTone', 'btnBg', 'nameTone', 'noteTone']) {
      expect(keys.has(banned), `${banned} is in the corpus`).toBe(false)
    }
  })

  it('the timeline block contains no palette literal and no colour decision of its own', () => {
    const PALETTE = /\b(?:bg|text|border|ring|accent|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
    const src = fs.readFileSync(path.join(BLOCKS_DIR, 'TimelineBlock.jsx'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(PALETTE.test(code), 'a palette literal is in TimelineBlock').toBe(false)
    expect(/#[0-9a-fA-F]{6}\b/.test(code)).toBe(false)
  })

  it('no rendered pane emits a CSS variable or colour-mix from data', () => {
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

describe('T37 — zero corpus diff (I7)', () => {
  const git = (args) => execSync(`git diff --name-only -- ${args}`, { encoding: 'utf8' }).trim()

  it('the normalized corpus is untouched', () => {
    const changed = git('src/features/action-stories/__corpus__/normalized/')
    expect(changed, `corpus files changed: ${changed}`).toBe('')
  })

  it('normalizeCorpus.js and the contract validator are untouched', () => {
    const changed = git('extraction/normalizeCorpus.js src/features/action-stories/contract/decisionObject.js')
    expect(changed, `frozen files changed: ${changed}`).toBe('')
  })
})

describe('T38 — the live path stays green for all 105', () => {
  it('every object resolves through the transport and renders without an error state', async () => {
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

describe('T39 — the registry is pinned by name, so a sixth block cannot arrive unnoticed', () => {
  it('BLOCK_TYPES is exactly the 14 pre-3B types plus the five 3B/3C concepts', () => {
    expect(BLOCK_TYPES.slice().sort()).toEqual([
      'barChart', 'cardSet', 'checklist', 'flag', 'gauge', 'heatmapGrid', 'itemQueue',
      'labelValueList', 'lineChart', 'number', 'object', 'roster', 'scatterChart', 'slider',
      'statList', 'table', 'text', 'timeline', 'waterfallChart',
    ])
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual(BLOCK_TYPES.slice().sort())
  })

  it('the five block components added across 3B and 3C are exactly these', () => {
    for (const f of ['ChecklistBlock.jsx', 'StatListBlock.jsx', 'CardSetBlock.jsx', 'RosterBlock.jsx', 'TimelineBlock.jsx']) {
      expect(fs.existsSync(path.join(BLOCKS_DIR, f)), `${f} missing`).toBe(true)
    }
  })

  it('the CHILDREN set is unchanged by this phase, and none is registered (I4)', () => {
    // timeline composes no children — an eyebrow and prose are text, not components — so it is a
    // depth-3 leaf and the child set stays at five.
    const childDir = path.join(BLOCKS_DIR, 'children')
    const children = fs.readdirSync(childDir).filter((f) => f.endsWith('.jsx')).map((f) => f.replace('.jsx', '')).sort()
    expect(children).toEqual(['ChipRow', 'Initials', 'Metric', 'StatusBadge', 'SubRowList'])
    for (const name of children) {
      const key = name.charAt(0).toLowerCase() + name.slice(1)
      expect(BLOCK_TYPES, `${name} is declared as a blockType`).not.toContain(key)
      expect(BLOCK_REGISTRY[key], `${name} is registered`).toBeUndefined()
    }
  })

  it('the slot vocabulary has 50 slots — 3C re-pointed, Phase 4 removed one (C3)', () => {
    // 51 through Phase 3C. Phase 4 Part 2 removed `decision_mode` when the duplicate rail render of
    // the mode axis was deleted; the slot had no other consumer. Still nothing ADDED, which is what
    // this guard is for — the vocabulary may shrink when a concept turns out to be redundant, and
    // must not grow quietly.
    expect(Object.keys(SLOT_VOCABULARY)).toHaveLength(50)
    const slotTargeted = new Set(Object.values(SLOT_VOCABULARY).map((s) => s.blockType))
    expect(slotTargeted.size, 'slot-targeted blockTypes').toBe(16)
  })

  it('table and labelValueList keep exactly the slots the survey said STAY (G)', () => {
    // Deliverable G as an assertion: eight slots stay, with the reference evidence recorded there.
    // Two are UNRESOLVED-BY-EVIDENCE rather than confirmed columnar (roles, secondary_rows) — R34.
    const on = (type) => Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.blockType === type).map(([n]) => n).sort()
    expect(on('table')).toEqual([
      'detail_rows', 'focus_rows', 'ledger', 'plan', 'policy', 'roles', 'secondary_rows', 'slate',
    ])
    expect(on('labelValueList')).toEqual(['constraints', 'rollback', 'verification'])
    expect(on('timeline')).toEqual(['flags', 'trigger'])
  })
})
