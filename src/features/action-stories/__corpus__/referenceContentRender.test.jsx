// @vitest-environment jsdom
//
// PHASE 11 of the gap fix: content fidelity verified in the DOM, not only in the data.
//
// referenceFidelity.test.js proves the normalized data comes from the right reference fields.
// This file proves the operator actually SEES it: every one of the 105 Decision Objects mounted
// through the real StageRenderer against its real canonical template, plus per-stage traces that
// assert specific reference sentences reach the rendered page.
//
// The distinction matters because the audit's failure mode was invisible at every other layer — a
// slot that resolves, validates and renders can still be showing the wrong business content.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import dataset from './normalized/dataset.json'
import StageRenderer from '../components/StageRenderer'
import { resolveTemplate } from '../templates/templateRegistry'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Recharts' ResponsiveContainer observes its parent box; jsdom ships no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let warnSpy
let errorSpy

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverStub
  // StageRenderer logs a warning for every placeholder; BlockErrorBoundary logs an error for every
  // crash. Both are captured rather than silenced, and asserted on below.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  warnSpy.mockRestore()
  errorSpy.mockRestore()
})

/** Mounts one Decision Object through its canonical template and returns the rendered text. */
function renderDecision(decision) {
  const resolved = resolveTemplate(decision)
  if (!resolved) return { text: '', resolved: null }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<StageRenderer manifest={resolved.manifest} fixture={decision} />)
  })
  const text = host.textContent ?? ''
  act(() => root.unmount())
  host.remove()
  return { text, resolved }
}

describe('every Decision Object renders through its canonical template', () => {
  it('mounts all 105 with no placeholder, no error boundary and no empty page', () => {
    const problems = []
    for (const decision of dataset) {
      warnSpy.mockClear()
      errorSpy.mockClear()
      const { text, resolved } = renderDecision(decision)
      if (!resolved) {
        problems.push(`${decision.proposal_id}: no template selected`)
        continue
      }
      const placeholders = warnSpy.mock.calls.filter(([msg]) => String(msg).includes('[StageRenderer]'))
      if (placeholders.length > 0) problems.push(`${decision.proposal_id}: ${placeholders[0][0]}`)
      const crashes = errorSpy.mock.calls.filter(([msg]) => String(msg).includes('[BlockErrorBoundary]'))
      if (crashes.length > 0) problems.push(`${decision.proposal_id}: block crashed — ${crashes[0][0]}`)
      if (text.trim() === '') problems.push(`${decision.proposal_id}: rendered nothing`)
    }
    expect(problems).toEqual([])
  })

  it('renders real business content on every record, not just chrome', () => {
    // Every stage must put something beyond its own context rail on the page. The floor is
    // deliberately low — it is a guard against a screen collapsing to axis echoes, which is what
    // 20 locked records and the live-stage error page used to be.
    const thin = []
    for (const decision of dataset) {
      const { text } = renderDecision(decision)
      if (text.length < 150) thin.push(`${decision.proposal_id}: ${text.length} chars`)
    }
    expect(thin).toEqual([])
  })
})

describe('representative screens show the reference\'s own business content', () => {
  const by = (id) => dataset.find((d) => d.proposal_id === id)

  it('reason — S9.2 shows the dial note, the service levels, the suppliers, the inputs and the agents', () => {
    const { text } = renderDecision(by('prop_s9_2_reason'))
    expect(text).toContain('No PO leaves the building without your approval.') // narrative <- dialNote
    expect(text).toContain('Never let a Hero go out of stock') // policy <- policy
    expect(text).toContain('Supplier K · stoneware') // roles <- roles
    expect(text).toContain('18,402 rows') // inputs <- inputs
    expect(text).toContain('Probabilistic Forecast Engine') // agents <- the reference's pinned strip
    expect(text).toContain('Inventory') // lens, through the frontend's enum label
    expect(text).not.toContain('inventory') // …never the raw contract token
  })

  it('reason — S9.3 shows the locked constraints the old pipeline dropped entirely', () => {
    const { text } = renderDecision(by('prop_s9_3_reason'))
    expect(text).toContain('FBA inbound window')
    expect(text).toContain('Min-stock commitments')
  })

  it('analyze — S10.1 shows the variance drivers and the evidence table', () => {
    // Chart INTERIORS are not asserted here: Recharts measures a parent box jsdom has no layout
    // engine to give it, so a chart's own labels never reach textContent. The bridge's business
    // rows are asserted at the data layer instead (referenceFidelity + WaterfallChartBlock's own
    // bridgeGeometry test); what belongs here is the content jsdom can actually show.
    const s101 = by('prop_s10_1_analyze')
    expect(s101.proposal.bridge[0]).toMatchObject({ label: 'Baseline', anchor: true })
    const { text } = renderDecision(s101)
    expect(text).toContain('FBA fee') // detail_rows <- classifier
    expect(text).toContain('−$2,210')
  })

  it('decide — S9.1 shows all six Recommendation units and the real item groups', () => {
    const s91 = by('prop_s9_1_decide')
    const { text } = renderDecision(s91)
    expect(text).toContain('Balanced') // 1. identity
    expect(text).toContain('Keep 162 · grow 18 · reduce 22 · exit 12') // 2. statement
    expect(text).toContain('Grow the proven, cut the depth on the tail') // 3. rationale
    expect(text).toContain('+$17K to +$66K') // 4. metrics keep their P10–P90 range
    expect(text).toContain('P10–P90 on the full slate') // …and their caveat note
    expect(text).toContain('Order rows behind the role classification') // 6. basis, in the Basis section
    // 5. the composition bar is a chart, so its own labels are asserted on the data it receives —
    // jsdom gives Recharts no layout box to render into.
    expect(s91.proposal.composition.map((r) => r.label)).toEqual(['Keep', 'Grow', 'Reduce', 'Exit', 'Gap fill'])

    // …and the decision content the old pipeline never reached.
    expect(text).toContain('Exit 12 Exit-Candidate SKUs') // item_groups
    expect(text).toContain('Bamboo canister 1.2L') // focus_rows drill-down
    expect(text).toContain('Conservative') // alternatives
    expect(text).toContain('GMROI target ≥ 2.4') // guardrail checks
    expect(text).toContain('Decide · 56 SKUs across 4 moves') // stage status
    expect(text).toContain('Within limits') // verdict, through the enum label
  })

  it('decide — the recommendation is never the Approve button\'s own label', () => {
    // S9.11's reference `approveLabel` is "Approve 41-SKU slate". It used to render as the hero
    // recommendation on 11 of 21 decide screens. `approveLabel` is not a recommendation source at
    // all now, so on this screen the recommendation is legitimately absent and the slot omits.
    const s911 = by('prop_s9_11_decide')
    expect(s911.proposal.recommendation).toBeUndefined()
    // The phrase still appears on the page, and correctly so — as the title of one of the
    // reference's own next-action route cards, with its own explanation beneath it. What must never
    // happen is a CTA's label standing in for the proposal's recommendation.
    expect(s911.proposal.next_actions.map((a) => a.title)).toContain('Approve 41-SKU slate')
    const { text } = renderDecision(s911)
    expect(text).toContain('Writes all selected prices in parity-safe order')
    // Mockup-only navigation never reaches the page.
    expect(text).not.toContain('.dc.html')
  })

  it('execute — S9.13 shows the destinations, the real rollback targets and the arming copy', () => {
    const { text } = renderDecision(by('prop_s9_13_execute'))
    expect(text).toContain('Klaviyo · email journeys') // targets <- dests, NOT the monitors list
    expect(text).toContain('Consumable replenishment') // rollback <- the reference's own rows
    expect(text).toContain('not live') // …including their live state
    expect(text).toContain('Lift decays more than 30%') // flags
    expect(text).toContain('At Suggest, decay raises a flag') // arming
  })

  it('execute — no screen shows the fabricated rollback line', () => {
    for (const d of dataset.filter((x) => x.stage === 'execute')) {
      const { text } = renderDecision(d)
      expect(text, d.proposal_id).not.toContain('Available for 24 hours')
    }
  })

  it('live — S10.6 renders as a running execution instead of an error page', () => {
    const { text } = renderDecision(by('prop_s10_6_live'))
    expect(text).toContain('Late shipment rate') // progress_rows <- healthRows
    expect(text).toContain('Dutch Oven 5qt') // targets <- coverRows
    expect(text).toContain('Spend caps +180%') // verification <- clauseRows
    expect(text).toContain('Ad budgets never went dark') // ledger <- annotations
    expect(text).toContain('Live · hour 38 of 96') // stage status
  })
})
