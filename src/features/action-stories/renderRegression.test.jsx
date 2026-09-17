// @vitest-environment jsdom
//
// Phase 2, T13: the regression net for I6 — no block component, no template slot and no registry
// entry changes this phase, so one object per template must render exactly as it does today, plus
// the newly populated header fields and nothing else.
//
// HOW THIS IS ASSERTED. A committed text snapshot per template, taken from the rendered pane BELOW
// the header. The header is excluded on purpose: it is the one region this phase is allowed to
// change (impact, brand, channel, category, agent, the deadline chip), and asserting it here would
// make the net useless the moment a header field lands. What must not move is everything the
// templates and blocks produce — and that is exactly what a below-the-header snapshot covers.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'

import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// PHASE 4 PART 2 — WHY ALL FOUR BASELINES MOVED (C3).
//
// "Snapshot updated" is not an explanation. Every baseline below was regenerated, and the complete
// set of differences from the Phase 3C renders is TWO changes, each traced to the defect it closes.
// Nothing else in any of the four panes moved by a character.
//
//   reason.v1            "Decision Mode / Suggest" deleted from the rail.
//   analyze.compare.v1   "Decision Mode / Suggest" deleted from the rail.
//   decide.slate.v1      "Decision Mode / Suggest" deleted from the rail.
//   execute.bridge.v1    "Decision Mode / Suggest" deleted from the rail, AND
//                        "Progress 0.0%" -> "Progress 0%".
//
// 1. THE MODE BLOCK (defect a). Mode rendered twice on every pane — the header's fact row and the
//    rail's `decision_mode` block — so one screen said "Mode suggest" and "Suggest" about the same
//    proposal. The header keeps it; the block is gone from all four manifests and the now-orphaned
//    slot is gone from slotVocabulary.js. This is a DELETION from the pane with no compensating
//    addition, which is the shape a duplicate-removal should have: the fact still renders, once.
//
// 2. "0.0%" -> "0%" (defect c). formatValue defaulted percent to one decimal place, so every
//    percentage in the app claimed a tenth of a point of precision the reference never stated. The
//    default is now zero and a caller that genuinely has tenths asks for them. Only execute.bridge
//    shows it here because it is the only specimen rendering a bare percentage below the header;
//    the same change is asserted directly, thirty-seven ways, by T49.
//
// WHAT DID NOT MOVE, and was expected to. Routing nine blocks onto formatValue (defect c) changed
// no character of any baseline. The corpus's row-level figures are still pre-formatted display
// STRINGS, which formatValue passes through untouched by design — so the unification is proved by
// T48 and T49 rather than by these panes. One regression was caught here and nowhere else: rows
// with no value began rendering a bare "—", because formatValue's absent-value em dash is right for
// a NumberBlock showing you a missing figure and wrong for a StatList row that omits the line. Four
// call sites now check for absence before formatting. That defect reached the baseline diff and was
// fixed before these files were written, which is the entire reason this net exists.

/** One representative object per canonical template, pinned by id so the sample cannot drift. */
const SPECIMENS = [
  ['reason.v1', 'prop_s9_1_reason'],
  ['analyze.compare.v1', 'prop_s9_1_analyze'],
  ['decide.slate.v1', 'prop_s9_1_decide'],
  ['execute.bridge.v1', 'prop_s9_1_execute'],
]

const SNAPSHOT_DIR = path.resolve(__dirname, '__corpus__/__snapshots__')

let container
let root

function renderPane(decision) {
  const resolved = resolveTemplate(decision)
  expect(resolved, `${decision.proposal_id} resolves no template`).toBeTruthy()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<StageRenderer manifest={resolved.manifest} fixture={decision} />)
  })
  return { templateId: resolved.templateId, text: container.textContent }
}

/**
 * Normalises whitespace only. Everything else — every label, every formatted figure, every row — is
 * compared verbatim, because a changed figure is exactly the regression this is looking for.
 */
function normalise(text) {
  return text.replace(/\s+/g, ' ').trim()
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

beforeEach(() => {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
})

describe('T13 — one object per template renders unchanged below the header', () => {
  it.each(SPECIMENS)('%s renders identically to its committed snapshot', (templateId, proposalId) => {
    const decision = dataset.find((d) => d.proposal_id === proposalId)
    expect(decision, `${proposalId} is not in the corpus`).toBeTruthy()

    const { templateId: resolvedId, text } = renderPane(decision)
    expect(resolvedId).toBe(templateId)

    const file = path.join(SNAPSHOT_DIR, `${templateId}.txt`)
    const actual = normalise(text)

    if (!fs.existsSync(file)) {
      // First run writes the baseline. It is committed, so a later run compares against the
      // PRE-CHANGE render rather than against itself — the baseline must be generated before the
      // contract is extended, which is why this test is written in step 3 and not step 4.
      fs.writeFileSync(file, actual)
      throw new Error(
        `Baseline written for ${templateId} (${actual.length} chars). Commit it, then re-run — ` +
          'a snapshot test that creates its own baseline during the change it is policing proves nothing.',
      )
    }

    expect(actual, `${templateId} render changed`).toBe(fs.readFileSync(file, 'utf8'))
  })

  it('decide.slate.v1 vs the PHASE 1 render: content preserved, the enum token gone', () => {
    // WHAT THIS ASSERTION USED TO BE, and why it changed.
    //
    // Phase 2 put a `status` enum on every guardrails.checks row, and LabelValueListBlock rendered a
    // row's keys generically — so the pane gained "· warn". There was no block that could render a
    // status, so Phase 2 pinned that one-line delta rather than fix it, and this test asserted the
    // ONLY difference from Phase 1 was the inserted status tokens.
    //
    // Phase 3B built the block. The tokens are gone, replaced by a StatusBadge carrying the semantic
    // word, so "exactly the inserted tokens" is no longer a true description of the delta and
    // keeping it would mean asserting a state the phase deliberately ended.
    //
    // What replaces it is the guarantee that actually matters across both phases: every piece of
    // CONTENT the Phase 1 pane showed is still shown, and the raw enum never renders as text. The
    // Phase 1 render stays committed as the reference for that comparison — the delta is still
    // pinned, just against a richer end state.
    const decision = dataset.find((d) => d.proposal_id === 'prop_s9_1_decide')
    const { text } = renderPane(decision)
    const now = normalise(text)
    const phase1 = fs.readFileSync(path.join(SNAPSHOT_DIR, 'decide.slate.v1.phase1.txt'), 'utf8')

    // Every check's identity and note survived the move from labelValueList to checklist.
    for (const row of decision.guardrails.checks) {
      if (row.label) expect(now, `lost check label: ${row.label}`).toContain(row.label)
      if (row.note) expect(now, `lost check note`).toContain(row.note)
    }

    // The figures the Phase 1 pane showed are all still present.
    for (const figure of ['+$41K', '+$25K', '$28K', '2.31', '$440K', '5.6%', '18,402', '187 of 214']) {
      expect(now, `lost figure ${figure}`).toContain(figure)
      expect(phase1).toContain(figure)
    }

    // The Phase 1 reference PREDATES the status field — Phase 2 is what added it — so it never
    // contained the token either. What it does contain is the bare `· 96` percentage, which is the
    // same check row rendered before any status existed. Phase 3B keeps that number and adds the
    // badge, so all three states are accounted for:
    //
    //   Phase 1   "GMROI target ≥ 2.42.31· 96Note…"        no status at all
    //   Phase 2   "GMROI target ≥ 2.42.31· warn· 96Note…"  status leaked as a text token
    //   Phase 3B  "Warning GMROI target ≥ 2.42.3196% …"    status is a badge, pct is a percentage
    expect(phase1, 'the Phase 1 reference predates the status field').not.toContain('· warn')
    expect(phase1, 'the Phase 1 reference should carry the bare pct').toContain('· 96')
    expect(now, 'the raw enum is still rendering as text').not.toContain('· warn')
    expect(now, 'the badge should carry the human label').toContain('Warning')
    expect(now, 'the pct should render as a percentage').toContain('96%')
  })

  it('the panes are substantial, so an empty render cannot pass as "unchanged"', () => {
    for (const [, proposalId] of SPECIMENS) {
      const { text } = renderPane(dataset.find((d) => d.proposal_id === proposalId))
      expect(normalise(text).length, `${proposalId} rendered almost nothing`).toBeGreaterThan(200)
      act(() => root.unmount())
      container.remove()
    }
  })

  it('the block registry is exactly the 14 pre-3B types plus the five 3B/3C concepts', async () => {
    // Was "no registry entry changed this phase" — true of Phase 2, and the thing Phase 3B exists to
    // change. Pinned by NAME rather than by count so a sixth block cannot arrive unnoticed: I6's
    // whole point is that 51 slots are served by adding the few missing concepts, not by approaching
    // parity. Four arrived in 3B — checklist, statList, cardSet, roster — and `timeline` in 3C, for
    // the chronology a two-column table was asserting wrongly.
    const { BLOCK_REGISTRY } = await import('./blocks/index.js')
    const { SLOT_VOCABULARY } = await import('./templates/slotVocabulary.js')

    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual([
      'barChart', 'cardSet', 'checklist', 'flag', 'gauge', 'heatmapGrid', 'itemQueue',
      'labelValueList', 'lineChart', 'number', 'object', 'roster', 'scatterChart', 'slider',
      'statList', 'table', 'text', 'timeline', 'waterfallChart',
    ])
    // 51 in Phase 3C, 50 now. Phase 4 Part 2 REMOVED `decision_mode`: the header states the mode,
    // and the slot existed only so a rail block could state it a second time. The registry itself is
    // untouched — no block type was added or dropped to achieve that, which is the thing this test
    // is really guarding. A slot leaving is a vocabulary shrinking; a block type arriving unnoticed
    // is the failure.
    expect(Object.keys(SLOT_VOCABULARY)).toHaveLength(50)
    expect(Object.keys(SLOT_VOCABULARY)).not.toContain('decision_mode')
  })

  it('every template lost EXACTLY the mode block, and nothing else', async () => {
    // WAS "no template gained or lost a block slot this phase", which was Phase 2's constraint and
    // is not Phase 4 Part 2's: defect (a) is a block removal. Restated as the tighter claim — each
    // of the four stage templates is down exactly one, locked.v1 is untouched, and the count is
    // pinned so a second removal cannot ride along behind the first.
    const counts = {}
    for (const id of ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1']) {
      const template = (await import(`./templates/${id}.json`)).default
      counts[id] = template.blocks.length
    }
    expect(counts).toEqual({
      'reason.v1': 10,            // was 11
      'analyze.compare.v1': 14,   // was 15
      'decide.slate.v1': 18,      // was 19
      'execute.bridge.v1': 14,    // was 15
      'locked.v1': 3,             // unchanged — it declares no rail at all
    })
    for (const id of ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1']) {
      const template = (await import(`./templates/${id}.json`)).default
      expect(template.blocks.map((b) => b.slotName), id).not.toContain('decision_mode')
    }
  })
})
