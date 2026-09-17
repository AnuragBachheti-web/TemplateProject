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

  it('decide.slate.v1 changed by EXACTLY the guardrail statuses, and nothing else', () => {
    // THE ONE REVIEWED RENDER DIFF IN THIS PHASE, recorded rather than absorbed.
    //
    // Ruling R4 put `status` on every guardrails.checks row. LabelValueListBlock renders a row's
    // keys generically, so the new key renders — the pane gains "· warn" / "· pass" on S9.1's three
    // check rows. That is a change below the header, which I6 forbids, and the conflict is real:
    // R4 is the later and more specific instruction, and the alternatives were worse. Hiding the
    // field in the shared decorative-key list would mean the pass/fail still could not render and
    // would mislabel a semantic field as presentation; not populating it would leave R4's contract
    // field empty. Neither is better than one reviewed line of new, correct information.
    //
    // So the Phase 1 render is kept alongside the new one, and this test pins the delta: every
    // difference must be an inserted status token. If anything ELSE moves, the two files stop
    // differing by only that and this fails — which is the guarantee I6 was actually asking for.
    const decision = dataset.find((d) => d.proposal_id === 'prop_s9_1_decide')
    const { text } = renderPane(decision)
    const now = normalise(text)
    const before = fs.readFileSync(path.join(SNAPSHOT_DIR, 'decide.slate.v1.phase1.txt'), 'utf8')

    const statuses = decision.guardrails.checks.map((r) => r.status)
    expect(statuses).toEqual(['warn', 'pass', 'pass'])

    // Removing the inserted tokens must reproduce the Phase 1 render byte for byte.
    let stripped = now
    for (const status of statuses) stripped = stripped.replace(`· ${status}`, '')
    expect(stripped, 'decide.slate.v1 changed by more than the guardrail statuses').toBe(before)
  })

  it('the panes are substantial, so an empty render cannot pass as "unchanged"', () => {
    for (const [, proposalId] of SPECIMENS) {
      const { text } = renderPane(dataset.find((d) => d.proposal_id === proposalId))
      expect(normalise(text).length, `${proposalId} rendered almost nothing`).toBeGreaterThan(200)
      act(() => root.unmount())
      container.remove()
    }
  })

  it('no block component, registry entry or template slot changed this phase (C1/I6)', async () => {
    // Asserted structurally rather than by render: the slot vocabulary and the block registry are
    // Phase 3's, and a snapshot alone would not catch a slot ADDED to a template that happens to
    // resolve to nothing on these four specimens.
    const { BLOCK_REGISTRY } = await import('./blocks/index.js')
    const { SLOT_VOCABULARY } = await import('./templates/slotVocabulary.js')

    // The 14 registered block types, pinned by name. Phase 3 adds to this list; Phase 2 must not.
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual([
      'barChart', 'flag', 'gauge', 'heatmapGrid', 'itemQueue', 'labelValueList', 'lineChart',
      'number', 'object', 'scatterChart', 'slider', 'table', 'text', 'waterfallChart',
    ])
    expect(Object.keys(SLOT_VOCABULARY)).toHaveLength(51)
  })

  it('no template gained or lost a block slot this phase', async () => {
    // The `actions[]` arrays DO change (approve_selected loses its `when`, per I7), so this counts
    // `blocks[]` only — the thing C1 puts out of bounds.
    const counts = {}
    for (const id of ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1']) {
      const template = (await import(`./templates/${id}.json`)).default
      counts[id] = template.blocks.length
    }
    expect(counts).toEqual({
      'reason.v1': 11,
      'analyze.compare.v1': 15,
      'decide.slate.v1': 19,
      'execute.bridge.v1': 15,
      'locked.v1': 3,
    })
  })
})
