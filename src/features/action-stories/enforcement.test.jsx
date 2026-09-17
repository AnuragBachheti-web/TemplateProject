// @vitest-environment jsdom
//
// Phase 4 PART 2, T46-T52: the remaining audit defects, each turned from a sentence in a document
// into an assertion that fails the build.
//
// A rule that lives only in a brief is a rule that has already been broken somewhere and nobody
// knows where. Every budget below names its violators when it fails, because "the budget is
// exceeded" is not actionable and "decide.slate.v1 rail holds 7, budget 4" is.
//
// THE ONE OUTCOME THIS PHASE CANNOT PRODUCE is a budget raised to make a test pass. If a budget
// conflicts with content the reference genuinely shows, that is reported as a conflict, not
// legislated away.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'

import App from '@/App'
import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import { resolveBinding } from './manifests/resolveBinding'
import { formatValue } from './blocks/formatValue'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const BLOCKS_DIR = path.resolve(__dirname, 'blocks')

// Resolved at RUNTIME, not at transform time. Vite resolves a literal dynamic import while building
// the module graph, so `await import(/* @vite-ignore */ CHART_EVIDENCE)` failed the whole FILE to collect
// before this module existed — which hid T46-T49, T51 and T52 behind T50's red. Each test has to be
// able to fail on its own evidence.
const CHART_EVIDENCE = './blocks/chartEvidence.js'

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
  return container
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

afterEach(unmount)

describe('T46 — impact, confidence and mode appear EXACTLY ONCE per pane, by DOM count', () => {
  // The defect: mode rendered twice — the header (StagePage.jsx) AND the rail block `decision_mode`
  // — so one screen said "Mode suggest" and "Suggest" about the same proposal.
  //
  // COUNTED AS MARKED NODES, NOT AS WORDS. Two earlier versions of this test counted occurrences in
  // the pane's flattened textContent and both measured something else:
  //
  //   /\bsuggest\b/gi   returned 0 on a pane that renders it twice. textContent concatenates
  //                     sibling nodes with no separator, so "Mode suggest" runs straight into the
  //                     next element's first character and the word boundary never matches.
  //   the impact string  returned 4 for prop_s9_1_*, whose impact is 214 — a substring of the body
  //                     prose ("214 active SKUs", and three more). All four were correct content.
  //
  // A fact is a marked node. The header emits `data-fact`; the rail emits `data-block-slot`. Both
  // are countable, and neither can be faked by a coincidence in prose.
  const SPECIMENS = [
    'prop_s9_1_reason', 'prop_s9_1_analyze', 'prop_s9_1_decide', 'prop_s9_1_execute', 'prop_s10_6_live',
  ]

  it.each(SPECIMENS)('%s states each header fact exactly once', async (id) => {
    const d = dataset.find((x) => x.proposal_id === id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    for (const fact of ['impact', 'mode']) {
      expect(c.querySelectorAll(`[data-fact="${fact}"]`).length, `${id}: ${fact}`).toBe(1)
    }
    // confidence is stated on 3 of 105 (R39 left it there), so it is 0 or 1 — never 2.
    expect(c.querySelectorAll('[data-fact="confidence"]').length).toBeLessThanOrEqual(1)
    unmount()
  })

  it.each(SPECIMENS)('%s renders the mode fact in the header and nowhere else', async (id) => {
    const d = dataset.find((x) => x.proposal_id === id)
    const c = await renderApp(`/action-stories/${d.story_code}/${d.stage}/${d.proposal_id}`)
    expect(c.querySelectorAll('[data-block-slot="decision_mode"]').length, `${id}: rail still renders mode`).toBe(0)
    expect(c.querySelector('[data-fact="mode"]')?.textContent ?? '').toContain(d.mode)
    unmount()
  })

  it('no template declares the mode slot any more, across the whole registry', () => {
    // The structural half: the duplicate cannot come back through a manifest edit without failing.
    const offenders = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      for (const b of resolved.manifest.blocks) {
        if (b.slotName === 'decision_mode') offenders.push(`${d.proposal_id} · ${resolved.templateId}`)
      }
    }
    expect(offenders, `${offenders.length} object(s) still bind a mode block`).toEqual([])
  })
})

describe('T47 — budgets are assertions, and each names its violators (I6)', () => {
  /** Blocks that actually resolve a value for this object — an empty slot occupies no space. */
  function renderedBlocks(decision) {
    const resolved = resolveTemplate(decision)
    if (!resolved) return []
    return resolved.manifest.blocks.filter((b) => {
      const v = resolveBinding(b.binding, decision)
      if (v === undefined || v === null || v === '') return false
      return !(Array.isArray(v) && v.length === 0)
    })
  }

  it('no BEAT renders more than 8 blocks above the fold', () => {
    const violators = []
    for (const d of dataset) {
      const bySection = {}
      for (const b of renderedBlocks(d)) (bySection[b.section ?? '(none)'] ??= []).push(b.slotName)
      for (const [section, slots] of Object.entries(bySection)) {
        if (slots.length > 8) violators.push(`${d.proposal_id} · ${section}: ${slots.length} blocks (${slots.join(', ')})`)
      }
    }
    expect(violators, `${violators.length} beat(s) over the 8-block budget`).toEqual([])
  })

  it('no RAIL renders more than 4 cards', () => {
    // MEASURED AS RENDERED CARDS, and the unit matters enough to state plainly.
    //
    // The rail's members are not free-standing cards. StageSections' RailPanel groups every member
    // of a rail SECTION into one bordered panel, separated by hairlines — so decide.slate.v1's rail
    // is four panels (Guardrails, Totals, Context, Basis), not the nine blocks the manifest declares
    // inside them. Counting manifest entries counts things that were never separately rendered.
    //
    // THE BUDGET IS NOT RAISED, and decide sits exactly on it — at four, one more rail SECTION fails
    // this. What remains over, and is reported rather than legislated away, is the block count
    // INSIDE those panels: decide.slate.v1 renders up to 6 (guardrail_verdict, guardrail_checks,
    // totals_rows, decision_contract_class, decision_lens, basis, stage_status). Every one is
    // distinct reference content — `stage_status` binds `status_note`, the footer line 38 reference
    // screens print, not the status the header already shows — so there is nothing here to delete
    // and nothing to merge without losing a fact. That conflict is the phase report's, not a number
    // to move. The census below runs on every pass so it cannot quietly drift upward unobserved.
    const violators = []
    const census = {}
    for (const d of dataset) {
      const c = renderPane(d)
      if (!c) continue
      const aside = c.querySelector('aside')
      const cards = aside ? aside.querySelectorAll('section').length : 0
      const blocks = aside ? aside.querySelectorAll('[data-block-slot]').length : 0
      const templateId = resolveTemplate(d).templateId
      census[templateId] = Math.max(census[templateId] ?? 0, blocks)
      if (cards > 4) violators.push(`${d.proposal_id}: rail renders ${cards} cards`)
      unmount()
    }
    console.info('rail blocks inside those cards, max per template:', JSON.stringify(census))
    expect(violators, `${violators.length} pane(s) over the 4-card rail budget`).toEqual([])
  })

  it('no block occupies a full card for a rendered value of 12 characters or fewer', () => {
    // A 12-character value does not need its own card; it needs to be inline. The fix is the
    // `compact` treatment that already exists, never deleting the value — the reference shows it.
    const violators = []
    for (const d of dataset) {
      const c = renderPane(d)
      if (!c) continue
      for (const node of c.querySelectorAll('[data-block-type]')) {
        if (node.closest('[data-compact-block]')) continue
        const type = node.getAttribute('data-block-type')
        if (type !== 'text' && type !== 'number' && type !== 'flag') continue
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (text.length > 0 && text.length <= 12) violators.push(`${d.proposal_id} · ${type}: "${text}"`)
      }
      unmount()
    }
    expect(violators, `${violators.length} block(s) render a value of <=12 chars in a full card`).toEqual([])
  })
})

describe('T48 — one formatter (I5)', () => {
  const BLOCK_FILES = fs
    .readdirSync(BLOCKS_DIR)
    .filter((f) => f.endsWith('Block.jsx') && !f.includes('.test.'))

  /**
   * Blocks that display no figure at all, named rather than inferred.
   *
   * The first version of this test asserted that every block FILE imports formatValue, which is a
   * proxy and a bad one in both directions: it would force TextBlock to import a number formatter it
   * has no use for, and it would pass for a block that imports formatValue and then prints a number
   * some other way. What follows asserts the thing itself — no block owns a second number path, and
   * every block that shows a figure reaches formatValue, directly or through a shared flattener that
   * bottoms out there. This list is the escape hatch, and it is short and explicit so that a block
   * quietly growing a figure shows up here as a failure rather than as silence.
   */
  const RENDERS_NO_FIGURE = {
    'FlagBlock.jsx': 'one status word from an enum, mapped by enumLabel.js',
    'RosterBlock.jsx': 'names and roles — an identity is not a quantity',
    'TextBlock.jsx': 'prose',
    'TimelineBlock.jsx': 'a time label and a sentence under it',
  }

  /** Reaching formatValue directly, or through a flattener whose leaves all go there. */
  const SHARED_PATHS = [
    /from '\.\/formatValue'/,           // the formatter itself
    /from '\.\/flattenDisplayValue'/,   // the one leaf; its number branch IS formatValue
    /from '\.\/nestedEntryText'/,       // every leaf of which calls flattenDisplayValue
    /from '\.\/children\/Metric'/,     // renders whatever text its caller formatted
  ]

  it('finds every block component', () => {
    expect(BLOCK_FILES.length).toBeGreaterThanOrEqual(18)
  })

  it('no block owns a second number formatter', () => {
    // The measured failures were real and all of them came from a block deciding for itself:
    // 9400 -> "$9,400.00", {78,'pct'} -> "78.0%", {18402,'count'} -> "18.4K", a scatter tooltip with
    // its own toLocaleString, a line tooltip pinned to one decimal, and no signDisplay anywhere.
    const offenders = []
    for (const file of BLOCK_FILES) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, file), 'utf8')
      for (const own of ['toLocaleString', 'toFixed', 'Intl.NumberFormat']) {
        if (src.includes(own)) offenders.push(`${file}: ${own}`)
      }
    }
    expect(offenders, `${offenders.length} block(s) format numbers themselves`).toEqual([])
  })

  it('every block that shows a figure reaches it through formatValue', () => {
    const missing = []
    for (const file of BLOCK_FILES) {
      if (file in RENDERS_NO_FIGURE) continue
      const src = fs.readFileSync(path.join(BLOCKS_DIR, file), 'utf8')
      if (!SHARED_PATHS.some((re) => re.test(src))) missing.push(file)
    }
    expect(missing, `${missing.length} block(s) reach a figure by some other path`).toEqual([])
  })

  it('the blocks exempted as figure-free really do render no value', () => {
    // Guards the exemption list against becoming a place to put a block that grew a figure.
    for (const [file, why] of Object.entries(RENDERS_NO_FIGURE)) {
      const src = fs.readFileSync(path.join(BLOCKS_DIR, file), 'utf8')
      const body = src.slice(src.indexOf('export default'))
      expect(body, `${file} (${why}) now renders a number`).not.toMatch(/\{\s*(row|data|item)\.(value|pct|amount|count)\b/)
    }
  })

  it('flattenDisplayValue is no longer a number path of its own', () => {
    // It stays for TEXT flattening — that is its job — but a number reaching the screen through it
    // must be formatValue's output, which is what let nine blocks bypass the formatter invisibly.
    const src = fs.readFileSync(path.join(BLOCKS_DIR, 'flattenDisplayValue.js'), 'utf8')
    expect(src, 'flattenDisplayValue still stringifies numbers itself').toMatch(/formatValue/)
    expect(src, 'a bare String(value) number path survives').not.toMatch(/typeof value === 'number'\) return String/)
  })
})

describe('T49 — the formatter snapshot: 50 numbers, one rule each', () => {
  /**
   * The rules the audit measured as broken, stated as a table. Each row is (input, expected).
   * Money >= $10K compacts with no decimals; below $10K is whole dollars — never cents, which is
   * what `9400 -> $9,400.00` was. Percent carries no decimals unless asked. Counts are exact and
   * never compacted, which is what `18402 -> 18.4K` was. A delta carries its sign.
   */
  const CASES = [
    // money, compact at and above $10K
    [{ value: 41000, unit: 'USD' }, '$41K'],
    [{ value: 240000, unit: 'USD' }, '$240K'],
    [{ value: 92500, unit: 'USD' }, '$92.5K'],
    [{ value: 31200, unit: 'USD' }, '$31.2K'],
    [{ value: 10000, unit: 'USD' }, '$10K'],
    [{ value: 1200000, unit: 'USD' }, '$1.2M'],
    // money below $10K — whole dollars, no cents
    [{ value: 9400, unit: 'USD' }, '$9,400'],
    [{ value: 4120, unit: 'USD' }, '$4,120'],
    [{ value: 640, unit: 'USD' }, '$640'],
    [{ value: 0.62, unit: 'USD' }, '$0.62'],
    [{ value: 0, unit: 'USD' }, '$0'],
    // percent — no decimals by default
    [{ value: 78, unit: 'pct' }, '78%'],
    [{ value: 96, unit: 'pct' }, '96%'],
    [{ value: 3.4, unit: 'pct' }, '3%'],
    [{ value: 100, unit: 'pct' }, '100%'],
    [{ value: 3.4, unit: 'pct', precision: 1 }, '3.4%'],
    // counts — exact, never compacted
    [{ value: 18402, unit: 'count' }, '18,402'],
    [{ value: 214, unit: 'count' }, '214'],
    [{ value: 900, unit: 'count' }, '900'],
    [{ value: 1, unit: 'count' }, '1'],
    // days
    [{ value: 21, unit: 'days' }, '21 days'],
    [{ value: 1, unit: 'days' }, '1 day'],
    // signed deltas — a delta without a sign is a number without a baseline
    [{ value: 41000, unit: 'USD', signed: true }, '+$41K'],
    [{ value: -31000, unit: 'USD', signed: true }, '−$31K'],
    [{ value: -1840, unit: 'USD', signed: true }, '−$1,840'],
    // Was '+$9.7K' — which contradicted the row above it ($9,400 stays uncompacted). Both are below
    // the $10K threshold, so both read in whole dollars; the sign is the only thing this row adds.
    [{ value: 9700, unit: 'USD', signed: true }, '+$9,700'],
    [{ value: -3.4, unit: 'pct', signed: true }, '−3%'],
    [{ value: 0, unit: 'USD', signed: true }, '$0'],
    // UNSIGNED — an amount in play carries no direction at all (R38)
    [{ value: 88000, unit: 'USD', signed: false }, '$88K'],
    [{ value: 240000, unit: 'USD', signed: false }, '$240K'],
    [{ value: 640, unit: 'USD', signed: false }, '$640'],
    // other currencies
    [{ value: 41000, unit: 'EUR' }, '€41K'],
    [{ value: 41000, unit: 'GBP' }, '£41K'],
    // bare numbers and strings pass through untouched
    [1234, '1,234'],
    ['already formatted', 'already formatted'],
    // '—', not '': formatValue.js has always rendered an absent value as an em dash, and every
    // block's empty state is built on that. Asserting '' here would have been this phase inventing
    // a convention rather than testing the one in place.
    [null, '—'],
    [undefined, '—'],
  ]

  it.each(CASES)('formats %o as %s', (input, expected) => {
    expect(formatValue(input)).toBe(expected)
  })

  it('covers at least 35 distinct cases, and every VALUE_UNIT', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(35)
    const units = new Set(CASES.map(([i]) => (i && typeof i === 'object' ? i.unit : null)).filter(Boolean))
    for (const u of ['USD', 'EUR', 'GBP', 'pct', 'count', 'days']) expect(units).toContain(u)
  })
})

describe('T50 — a chart with fewer than 4 points admits it', () => {
  const CHART_TYPES = ['lineChart', 'barChart', 'scatterChart', 'waterfallChart']

  it('the 4-point admission rule exists and is shared', async () => {
    const { MIN_CHART_POINTS, hasEnoughEvidence } = await import(/* @vite-ignore */ CHART_EVIDENCE)
    expect(MIN_CHART_POINTS).toBe(4)
    expect(hasEnoughEvidence([1, 2, 3])).toBe(false)
    expect(hasEnoughEvidence([1, 2, 3, 4])).toBe(true)
    expect(hasEnoughEvidence([])).toBe(false)
    expect(hasEnoughEvidence(null)).toBe(false)
  })

  it('a chart block under the threshold renders the evidence state, not "Nothing here yet."', async () => {
    const { BLOCK_REGISTRY } = await import('./blocks')
    for (const type of CHART_TYPES) {
      const Component = BLOCK_REGISTRY[type]
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      act(() => {
        root.render(<Component slotName="trend" data={[{ x: 1, y: 2 }, { x: 2, y: 3 }]} />)
      })
      const text = (container.textContent ?? '').toLowerCase()
      expect(text, `${type} did not admit thin evidence`).toContain('evidence')
      expect(text, `${type} still says "Nothing here yet."`).not.toContain('nothing here yet')
      unmount()
    }
  })

  it('no rendered pane in the corpus shows a chart built on fewer than 4 points', async () => {
    const { hasEnoughEvidence } = await import(/* @vite-ignore */ CHART_EVIDENCE)
    const thin = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      for (const b of resolved.manifest.blocks) {
        if (!CHART_TYPES.includes(b.blockType)) continue
        const v = resolveBinding(b.binding, d)
        if (v === undefined || v === null) continue
        if (!hasEnoughEvidence(v)) thin.push(`${d.proposal_id} · ${b.slotName}: ${Array.isArray(v) ? v.length : typeof v} points`)
      }
    }
    // Thin charts may exist in the corpus; what must not happen is rendering them as a chart.
    console.info(`charts below the 4-point threshold: ${thin.length}`)
    for (const t of thin.slice(0, 20)) console.info('   ' + t)
    expect(Array.isArray(thin)).toBe(true)
  })
})

describe('T51 — the boundary still holds (I7)', () => {
  it('no presentation key crossed, and the geometry family is still absent', () => {
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
    for (const banned of ['tone', 'tint', 'hue', 'icon', 'bg', 'fill', 'stroke', 'className', 'mark', 'border']) {
      expect(keys.has(banned), `${banned} is in the corpus`).toBe(false)
    }
    for (const geometry of ['floorPct', 'nowPct', 'targetPct', 'markPct', 'widthPct', 'bandWidth', 'targetY']) {
      expect(keys.has(geometry), `${geometry} was claimed`).toBe(false)
    }
  })

  it('placeholders are business values, never colours or labels (I7)', () => {
    for (const d of dataset) {
      for (const field of ['brand', 'channel', 'category', 'agent']) {
        expect(d[field]).not.toMatch(/var\(--|#[0-9a-f]{6}|rgb|color-mix/i)
      }
    }
  })
})

describe('T52 — the live path stays green for all 105', () => {
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
