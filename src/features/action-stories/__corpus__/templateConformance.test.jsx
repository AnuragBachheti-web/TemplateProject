// @vitest-environment jsdom
//
// Suite 2: CONFORMANCE. Five canonical templates must cover the whole corpus.
//
// What "the corpus" means here needs stating precisely, because the naive reading of "render all
// 105 corpus cases against the canonical templates" is not achievable and would not mean anything
// if it were. A corpus fixture is a MOCKUP EXPORT — 835 one-off slot names, CSS variables, pixel
// geometry — and a canonical template binds to Decision Object paths. The two are different
// documents. Rendering a raw fixture through a canonical template would produce 105 stages of
// placeholders and prove only that the two shapes differ, which is already known.
//
// So conformance is measured over the corpus TRANSLATED: every one of the 105 corpus stages was put
// through extraction/generateMockDecisionObjects.js, which applies the hygiene pass the real
// backend must implement and maps each stage's business content onto canonical slots. Those 105
// Decision Objects are what this suite renders. That is the meaningful claim — five templates
// cover the business content of all 26 workflows across all four stages — and it is the claim the
// architecture actually makes.
//
// The bar: every CORE slot resolves for every proposal in its family, and no stage crashes a block
// into its error boundary. Conditional slots may legitimately be absent; that is what their `when`
// is for, and an omitted conditional slot is a correct outcome, not a gap.
import { describe, it, expect, afterAll, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import StageRenderer from '../components/StageRenderer'
import { resolveTemplate } from '../templates/templateRegistry'
import { selectTemplate } from '../templates/selectTemplate'
import { resolveBinding } from '../manifests/resolveBinding'
import { evaluateCondition } from '../manifests/actionCondition'
import { validateBlockData } from '../manifests/blockTypes'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { validateDecisionObject } from '../contract/decisionObject'
import decisions from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Recharts measures its parent box; jsdom has no layout engine, so without a stub every chart block
// would crash into its own error boundary and this sweep would report false failures.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function mount(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return { container, unmount: () => act(() => root.unmount()) }
}

const covered = decisions.filter((d) => selectTemplate(d) !== null)
const uncovered = decisions.filter((d) => selectTemplate(d) === null)

describe('template conformance — five templates cover the corpus', () => {
  it('translates all 105 corpus stages into contract-valid Decision Objects', () => {
    expect(decisions).toHaveLength(105)
    const invalid = decisions.filter((d) => validateDecisionObject(d).length > 0)
    expect(invalid.map((d) => d.proposal_id)).toEqual([])
  })

  it('covers every corpus record, with no uncovered stage left', () => {
    // The `live` gap is closed: S10.6's live screen shows a plan, progress rows, monitors, targets
    // and a ledger — execute.bridge.v1's own content — so it renders as a running execution rather
    // than through a speculative sixth template. This assertion now pins FULL coverage, so a new
    // uncovered stage fails the build instead of quietly reopening the gap.
    expect(uncovered.map((d) => `${d.story_code}/${d.stage}`)).toEqual([])
    expect(covered).toHaveLength(105)
  })

  it('selects only canonical templates across the whole corpus', () => {
    const used = new Set(covered.map((d) => selectTemplate(d)))
    // `locked.v1` is absent BY EVIDENCE, not by omission: all 105 reference screens show their whole
    // slate, figures and item count, with no teaser or paywall anywhere, so every normalized record
    // carries `entitlement: "full"`. The template stays registered and tested (it is a real contract
    // capability) — it simply has no corpus instance to select. The previous 20 locked records came
    // from `ENTITLEMENTS[hash % 5]`, which blanked 19% of the corpus to a three-line teaser.
    expect([...used].sort()).toEqual(
      ['analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'reason.v1'],
    )
  })

  it('collapses 105 story-specific manifests to a handful of reusable templates', () => {
    // The whole point, stated as a number: ~96% of the old layouts were unique.
    const templateCount = new Set(covered.map((d) => selectTemplate(d))).size
    expect(templateCount).toBeLessThanOrEqual(5)
    expect(covered.length / templateCount).toBeGreaterThan(20)
  })
})

describe('core slots resolve for every proposal in their family', () => {
  const failures = []

  for (const decision of covered) {
    const { manifest } = resolveTemplate(decision)
    for (const block of manifest.blocks) {
      const spec = SLOT_VOCABULARY[block.slotName]
      if (spec.tier !== 'core') continue
      // A core slot may still carry a `when` (e.g. `deadline` is conditional); those are skipped
      // when their condition is false, which is the omission the template asked for.
      if (block.when !== undefined && !evaluateCondition(block.when, decision)) continue
      const value = resolveBinding(block.binding, decision)
      if (value === undefined) {
        failures.push(`${decision.proposal_id}: core slot "${block.slotName}" (${block.binding}) resolved to nothing`)
      } else {
        const problems = validateBlockData(block.blockType, value)
        if (problems.length > 0) failures.push(`${decision.proposal_id}: "${block.slotName}" ${problems.join('; ')}`)
      }
    }
  }

  it('resolves every core slot, with valid data, across all covered stages', () => {
    expect(failures).toEqual([])
  })
})

describe('every covered stage renders without crashing a block', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const crashed = []
  const placeheld = []

  for (const decision of covered) {
    const { manifest } = resolveTemplate(decision)
    warn.mockClear()
    error.mockClear()

    const { unmount } = mount(<StageRenderer manifest={manifest} fixture={decision} />)

    // Both signals are read from the console lines StageRenderer and BlockErrorBoundary already
    // emit for exactly this purpose, rather than from markup — no source change needed, and a
    // class-name refactor cannot silently blind the sweep.
    const lines = [...warn.mock.calls, ...error.mock.calls].map((c) => String(c[0]))
    for (const line of lines) {
      if (line.includes('[BlockErrorBoundary]')) crashed.push(`${decision.proposal_id}: ${line}`)
      else if (line.includes('[StageRenderer]')) placeheld.push(`${decision.proposal_id}: ${line}`)
    }
    unmount()
  }

  afterAll(() => {
    warn.mockRestore()
    error.mockRestore()
  })

  it('crashes no block into its error boundary', () => {
    expect(crashed).toEqual([])
  })

  it('leaves no block as an unresolved placeholder', () => {
    // Conditional slots are omitted by their `when` rather than placeheld, so a placeholder here
    // always means a real binding gap.
    expect(placeheld).toEqual([])
  })
})

describe('no story-specific layout dependency remains', () => {
  it('renders every proposal in a family through the IDENTICAL template object', () => {
    // Reference equality, not deep equality: one template instance serves the whole family. If a
    // per-story variant ever crept back in, this is what would catch it.
    const byTemplate = new Map()
    for (const decision of covered) {
      const id = selectTemplate(decision)
      const { manifest } = resolveTemplate(decision)
      const blocksRef = manifest.blocks
      if (!byTemplate.has(id)) byTemplate.set(id, blocksRef)
      expect(byTemplate.get(id), `${decision.proposal_id} got a different blocks array`).toBe(blocksRef)
    }
  })

  it('never reads the story code to decide layout', () => {
    // Two proposals with different story codes but identical axes must select the same template.
    const a = { action_type: 'reprice', stage: 'decide', cardinality: 'many', entitlement: 'full', story_code: 'S9.1' }
    const b = { ...a, story_code: 'S10.6' }
    expect(selectTemplate(a)).toBe(selectTemplate(b))
  })
})
