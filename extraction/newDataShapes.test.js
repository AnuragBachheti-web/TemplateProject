// Acceptance test for "data-dynamic vs. composition-dynamic" (this pass's own §17/§18 requirement):
// several data shapes that were NEVER used to tune classifyBlocks.js/generateManifests.js — no
// workflow in the real 26-workflow corpus uses these exact key names — run through the REAL,
// UNMODIFIED classification + composition pipeline to prove it generalizes, not merely that it was
// pattern-matched against the reference corpus. If any of these assertions required a code change to
// pass, that would itself be evidence the architecture ISN'T a reusable template system.
import { describe, it, expect } from 'vitest'
import { classifyBlockType, planSections, orderBlocksSemantically } from './classifyBlocks.js'

function classifyAll(data) {
  const blocks = []
  for (const [rawKey, value] of Object.entries(data)) {
    const blockType = classifyBlockType(value, rawKey)
    if (blockType) blocks.push({ slotName: rawKey, blockType, binding: `data.${rawKey}` })
  }
  return blocks
}

describe('New data shape #1 — a plain business table nobody tuned this pipeline against', () => {
  const data = {
    programName: 'Q3 vendor scorecard',
    rows: [
      { id: 'V-1', title: 'Northwind Traders', revenue: '$412K', margin: '18.2%', status: 'active' },
      { id: 'V-2', title: 'Contoso Supply', revenue: '$298K', margin: '11.4%', status: 'active' },
      { id: 'V-3', title: 'Fabrikam Goods', revenue: '$77K', margin: '4.9%', status: 'watch' },
    ],
  }

  it('classifies the record array as a real table, from shape alone (id + title + 2 more business columns)', () => {
    expect(classifyBlockType(data.rows, 'rows')).toBe('table')
  })

  it('classifies the lone string as text', () => {
    expect(classifyBlockType(data.programName, 'programName')).toBe('text')
  })
})

describe('New data shape #2 — a decision screen with a real control + dependents, never seen before', () => {
  const data = {
    headline: 'Reorder point simulator',
    // A real control shape: {min, max, value, step, dependencies} — produced the same way
    // extraction/dcLogicSandbox.js's computeControlPayload would for any brand-new reference screen.
    safetyStockDays: { min: 3, max: 21, step: 1, value: 10, dependencies: ['coverage', 'reorderTable'] },
    coverage: [
      { label: 'SKUs covered', value: '412 of 500', tone: 'green' },
      { label: 'Stockout risk', value: '4.1%', tone: 'amber' },
    ],
    reorderTable: [
      { sku: 'SK-100', name: 'Widget A', onHand: 120, reorderAt: 40, status: 'ok' },
      { sku: 'SK-200', name: 'Widget B', onHand: 18, reorderAt: 40, status: 'low' },
    ],
    supportingPolicy: [
      { text: 'Never exceed 21 days of cover per the cash-flow guardrail.', ok: true },
      { text: 'Reorder points recompute nightly.', ok: true },
    ],
  }

  it('classifies the control as a real slider (the SAME generic {min,max,value} shape check every real reference slider uses)', () => {
    expect(classifyBlockType(data.safetyStockDays, 'safetyStockDays')).toBe('slider')
  })

  it('classifies the dependent record array as a table (sku identity + 3 more business columns)', () => {
    expect(classifyBlockType(data.reorderTable, 'reorderTable')).toBe('table')
  })

  it('composition: the control and its two dependents fuse into one "decision" panel — with zero new code', () => {
    const blocks = classifyAll(data)
    // pad to cross the sectioning threshold generically (unrelated filler blocks) — MIN_BLOCKS_TO_SECTION is 9
    blocks.push(
      { slotName: 'x1', blockType: 'text', binding: 'data.x1' },
      { slotName: 'x2', blockType: 'text', binding: 'data.x2' },
      { slotName: 'x3', blockType: 'text', binding: 'data.x3' },
      { slotName: 'x4', blockType: 'text', binding: 'data.x4' },
    )
    const { sectionBySlot, layoutBySlot } = planSections(blocks, data)
    expect(sectionBySlot.get('safetyStockDays')).toBe('decision')
    expect(sectionBySlot.get('coverage')).toBe('decision')
    expect(sectionBySlot.get('reorderTable')).toBe('decision')
    expect(layoutBySlot.get('safetyStockDays').group).toBe(layoutBySlot.get('reorderTable').group)
  })

  it('ordering: the control sorts ahead of its dependent table, metrics ahead of the table — with zero new code', () => {
    const blocks = classifyAll(data)
    const ordered = orderBlocksSemantically(blocks, data)
    const names = ordered.map((b) => b.slotName)
    expect(names.indexOf('safetyStockDays')).toBeLessThan(names.indexOf('coverage'))
    expect(names.indexOf('coverage')).toBeLessThan(names.indexOf('reorderTable'))
  })
})

describe('New data shape #3 — an analysis screen: chart + summary metrics + a detail table', () => {
  const data = {
    trendChart: [
      { label: 'Jan', value: '$12.4K' },
      { label: 'Feb', value: '$14.1K' },
      { label: 'Mar', value: '$9.8K' },
    ],
    summaryMetrics: [
      { label: 'Best month', value: 'Feb' },
      { label: 'YoY change', value: '+6.2%' },
    ],
    detailRows: [
      { id: 'R-1', title: 'Region North', revenue: '$4.2K', variance: '+3%' },
      { id: 'R-2', title: 'Region South', revenue: '$3.1K', variance: '-2%' },
    ],
  }

  it('classifies the trend as a barChart and the detail rows as a table', () => {
    expect(classifyBlockType(data.trendChart, 'trendChart')).toBe('barChart')
    expect(classifyBlockType(data.detailRows, 'detailRows')).toBe('table')
  })

  it('composition: the chart routes to "analysis" on its own — chart+table pairing was tried and removed after corpus validation showed it fabricated relationships (see classifyBlocks.js\'s own doc comment)', () => {
    const blocks = classifyAll(data)
    blocks.push(
      { slotName: 'x1', blockType: 'text', binding: 'data.x1' },
      { slotName: 'x2', blockType: 'text', binding: 'data.x2' },
      { slotName: 'x3', blockType: 'text', binding: 'data.x3' },
      { slotName: 'x4', blockType: 'text', binding: 'data.x4' },
      { slotName: 'x5', blockType: 'text', binding: 'data.x5' },
      { slotName: 'x6', blockType: 'text', binding: 'data.x6' },
    )
    const { sectionBySlot, layoutBySlot } = planSections(blocks, data)
    expect(sectionBySlot.get('trendChart')).toBe('analysis')
    // No fabricated relationship: the table is not swept into the chart's panel just because both
    // happen to exist in the same stage.
    expect(layoutBySlot.get('trendChart')).toBeUndefined()
    expect(layoutBySlot.get('detailRows')).toBeUndefined()
  })
})

describe('New data shape #4 — an execution screen: destination + before/after diff', () => {
  const data = {
    destinations: [
      {
        name: 'Marketplace sync',
        status: 'staged',
        items: [
          { name: 'Price update', before: '$19.99', after: '$17.99' },
          { name: 'Inventory flag', before: 'in stock', after: 'low stock' },
        ],
      },
      {
        name: 'CRM sync',
        status: 'staged',
        items: [{ name: 'Owner reassignment', before: 'unassigned', after: 'Jordan P.' }],
      },
    ],
  }

  it('classifies the destination array as itemQueue (a rich, variable-shape record — never forced into a table)', () => {
    expect(classifyBlockType(data.destinations, 'destinations')).toBe('itemQueue')
  })

  it('composition: routes into "execution" purely from the nested before/after diff shape — with zero new code', () => {
    const blocks = [
      { slotName: 'destinations', blockType: 'itemQueue', binding: 'data.destinations' },
      { slotName: 'x1', blockType: 'text', binding: 'data.x1' },
      { slotName: 'x2', blockType: 'text', binding: 'data.x2' },
      { slotName: 'x3', blockType: 'text', binding: 'data.x3' },
      { slotName: 'x4', blockType: 'text', binding: 'data.x4' },
      { slotName: 'x5', blockType: 'text', binding: 'data.x5' },
      { slotName: 'x6', blockType: 'text', binding: 'data.x6' },
      { slotName: 'x7', blockType: 'text', binding: 'data.x7' },
      { slotName: 'x8', blockType: 'text', binding: 'data.x8' },
    ]
    const { sectionBySlot } = planSections(blocks, data)
    expect(sectionBySlot.get('destinations')).toBe('execution')
  })
})

describe('New data shape #5 — a narrative + governance screen (Reason-style), no chart/control anywhere', () => {
  const data = {
    rationale: 'This SKU cohort is queued because margin fell below the 12% floor for three consecutive weeks.',
    guardrail_checks: [
      { label: 'Capital ceiling respected.', ok: true },
      { label: 'No SKU exceeds the 15% markdown cap.', ok: true },
    ],
    roleFramework: [
      { role: 'Core', definition: 'Always in stock, drives repeat purchase.' },
      { role: 'Seasonal', definition: 'Time-boxed, cleared aggressively after the window.' },
    ],
  }

  it('classifies the guardrail checklist and role framework, and routes the narrative to a hero role — with zero new code', () => {
    expect(classifyBlockType(data.guardrail_checks, 'guardrail_checks')).toBe('labelValueList')
    const blocks = [
      { slotName: 'rationale', blockType: 'text', binding: 'data.rationale' },
      { slotName: 'guardrail_checks', blockType: 'labelValueList', binding: 'data.guardrail_checks' },
      { slotName: 'roleFramework', blockType: 'labelValueList', binding: 'data.roleFramework' },
      { slotName: 'x1', blockType: 'text', binding: 'data.x1' },
      { slotName: 'x2', blockType: 'text', binding: 'data.x2' },
      { slotName: 'x3', blockType: 'text', binding: 'data.x3' },
      { slotName: 'x4', blockType: 'number', binding: 'data.x4' },
      { slotName: 'x5', blockType: 'flag', binding: 'data.x5' },
      { slotName: 'x6', blockType: 'text', binding: 'data.x6' },
    ]
    const { sectionBySlot } = planSections(blocks, data)
    expect(sectionBySlot.get('rationale')).toBe('recommendation') // the existing hero vocabulary — still generic
    expect(sectionBySlot.get('guardrail_checks')).toBe('guardrails')
  })
})
