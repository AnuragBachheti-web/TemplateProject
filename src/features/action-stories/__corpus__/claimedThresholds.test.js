// Phase 3A, T17-T23: the threshold/constraint data Phase 3B needs, and the far larger set that is
// deliberately NOT claimed.
//
// THE FINDING THIS PHASE RESTS ON. The reference's numeric `*Pct` values are BAR POSITIONS, not
// measurements, and the arithmetic settles it rather than an argument:
//
//   metrics[0]  limit "4.0%"  floor "3.0%"  today "3.4%"   pct 68  floorPct 60  limitPct 80
//               today 3.4 / 5.0 * 100 = 68        <- the axis maximum is 5.0%, a design choice
//   surfaceProj now "19%"  proj "26%"   nowPct 42  projPct 58  targetPct 78
//               now 19 / 45 * 100 = 42            <- axis maximum ~45%, also a design choice
//
// `now` is 19% and `nowPct` is 42. They cannot both be the same measurement. So 546 occurrences of
// the family are `value / chosenAxisMax * 100` — layout wearing a number's clothes — and they stay
// unclaimed permanently (T20). The semantic values they were computed FROM exist only as formatted
// display strings ("4.0%", "$21.80", "target 95%"), which R2 forbids recovering by parsing (T23).
//
// What is left is small and real: 3 canonical claims across 6 objects. T17-T19 pin them, T20-T23 pin
// everything that must NOT appear.

import { describe, it, expect } from 'vitest'

import { validateDecisionObject } from '../contract/decisionObject'
import dataset from './normalized/dataset.json'

const byId = (id) => dataset.find((d) => d.proposal_id === id)

/**
 * THE THREE APPROVED CLAIMS (ruling R14), with the objects the reference supplies them on.
 * Two of the three add no new canonical field — they fix an existing path that was null on the very
 * objects carrying the data, which is why I6's "consolidate" rule barely had to be applied by hand.
 */
const CLAIMS = {
  // #1 — the slot's own note already named these concepts ("The governing targets/limits… Reference
  // policy/targets/rules/standards/thresholds/slas"). It was only ever picked in reasonProposal, so
  // decide- and analyze-stage objects carrying the same concept had no home.
  'proposal.policy': {
    newObjects: ['prop_s10_6_decide', 'prop_s9_12_decide', 'prop_s9_13_decide', 'prop_s9_3_analyze'],
    folds: ['limits', 'capa', 'capEffects', 'capacity'],
  },
  // #2 — `proposal.matrix` is a heatmapGrid pick that resolved to null on the one object with a
  // heat grid. The shares are genuine unitless numbers and genuinely vary.
  'proposal.matrix': {
    newObjects: ['prop_s9_18_analyze'],
    // `prop_s9_13_analyze` already had a matrix (from `rfmGrid`, a nested cell grid). The claim is
    // additive: S9.18 joins it, and asserting the total guards against stealing S9.13's.
    preExisting: ['prop_s9_13_analyze'],
    folds: ['heatRows.eastPct -> cells[].share', 'heatRows.westPct -> cells[].share'],
  },
  // #3 — the ONLY place in the whole corpus where a threshold is stated as numbers rather than as a
  // formatted string. One object, and added rather than deferred (R14): deferring the single honest
  // instance of a concept because it is rare is how a capability becomes an edge case and then dies.
  'proposal.threshold_control': {
    newObjects: ['prop_s9_12_decide'],
    folds: ['rlThreshold'],
  },
}

describe('T17 — every claimed field is present and typed where the reference supplies it', () => {
  it('proposal.policy reaches the decide and analyze objects that carry constraint rows', () => {
    for (const id of CLAIMS['proposal.policy'].newObjects) {
      const rows = byId(id)?.proposal?.policy
      expect(Array.isArray(rows), `${id}.proposal.policy`).toBe(true)
      expect(rows.length, `${id}.proposal.policy is empty`).toBeGreaterThan(0)
      // Every row identifies itself. A row set with no identity is a styled chip set, which is why
      // `caps` ({n, tag, bg, border, fg}) is excluded from the fold.
      for (const row of rows) {
        expect(
          Boolean(row.label || row.name || row.text),
          `${id}.proposal.policy row has no label/name/text: ${JSON.stringify(row)}`,
        ).toBe(true)
      }
    }
  })

  it('proposal.policy keeps the 20 reason-stage objects it already had', () => {
    // The extension must be additive. Picking a constraint key that another field already claimed
    // would move content off a rendered slot, which I5 forbids.
    const onReason = dataset.filter((d) => d.stage === 'reason' && d.proposal?.policy)
    expect(onReason.length).toBe(20)
  })

  it('proposal.matrix keeps the grid it already had on prop_s9_13_analyze', () => {
    const rows = byId('prop_s9_13_analyze')?.proposal?.matrix
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('proposal.matrix carries the heat grid as a two-column grid (I6)', () => {
    // `proposal.matrix` is bound to the heatmapGrid block, whose row contract is {label, cells[]},
    // and the sibling object that already has a matrix uses exactly that. Emitting flat
    // `east_share`/`west_share` keys instead would render a placeholder on a live slot and make one
    // canonical path mean two shapes — so a per-zone split across two directions becomes what it is.
    const rows = byId('prop_s9_18_analyze')?.proposal?.matrix
    expect(Array.isArray(rows), 'prop_s9_18_analyze.proposal.matrix').toBe(true)
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row, 'a matrix row lost its label').toHaveProperty('label')
      expect(Array.isArray(row.cells), `cells on ${row.label}`).toBe(true)
      expect(row.cells.map((c) => c.direction)).toEqual(['east', 'west'])
      for (const cell of row.cells) expect(typeof cell.share, `share on ${row.label}`).toBe('number')
      // The raw key names must NOT survive — a canonical path named after the raw key it came from
      // is the 835-slotName accident returning through the data door.
      expect(row).not.toHaveProperty('eastPct')
      expect(row).not.toHaveProperty('westPct')
    }
  })

  it('both matrix objects share ONE shape, so the canonical path means one thing', () => {
    for (const id of ['prop_s9_13_analyze', 'prop_s9_18_analyze']) {
      for (const row of byId(id).proposal.matrix) {
        expect(Array.isArray(row.cells), `${id} row has no cells`).toBe(true)
        expect(row.cells.length, `${id} row has empty cells`).toBeGreaterThan(0)
      }
    }
  })

  it('proposal.threshold_control carries a real numeric range', () => {
    const c = byId('prop_s9_12_decide')?.proposal?.threshold_control
    expect(c, 'prop_s9_12_decide.proposal.threshold_control').toBeTruthy()
    expect(c).toEqual({ min: 6, max: 24, step: 1, value: 14 })
  })

  it('each claimed field is ABSENT on every object the reference does not supply it for', () => {
    // The established convention for `proposal.*` is omit-when-absent (dropUndefined), not
    // null-present: `proposal.policy` is already absent on 85 objects. A field that is null here and
    // omitted there would be two conventions for one idea.
    for (const [path, { newObjects }] of Object.entries(CLAIMS)) {
      const key = path.replace('proposal.', '')
      const expected = new Set([
        ...newObjects,
        ...(CLAIMS[path].preExisting ?? []),
        // `policy` already served the 20 reason-stage objects before this phase; they must survive.
        ...(path === 'proposal.policy'
          ? dataset.filter((d) => d.stage === 'reason' && d.proposal?.policy).map((d) => d.proposal_id)
          : []),
      ])
      const actual = dataset.filter((d) => d.proposal?.[key] !== undefined).map((d) => d.proposal_id)
      for (const id of actual) {
        expect(expected.has(id), `${path} appeared on ${id}, which the reference does not supply`).toBe(true)
      }
      expect(actual.length, `${path} population`).toBe(expected.size)
    }
  })

  it('the contract validates the claimed shapes, and rejects malformed ones', () => {
    const base = byId('prop_s9_12_decide')
    expect(validateDecisionObject(base)).toEqual([])

    const badControl = structuredClone(base)
    badControl.proposal.threshold_control = { min: 6, max: 24, step: 1, value: '14' }
    expect(validateDecisionObject(badControl).join(' ')).toContain('threshold_control.value')

    const invertedRange = structuredClone(base)
    invertedRange.proposal.threshold_control = { min: 24, max: 6, step: 1, value: 14 }
    expect(validateDecisionObject(invertedRange).join(' ')).toContain('threshold_control')

    const badMatrix = structuredClone(byId('prop_s9_18_analyze'))
    badMatrix.proposal.matrix[0].cells[0].share = '96'
    expect(validateDecisionObject(badMatrix).join(' ')).toContain('share')

    // The policy row rule is deliberately "a non-empty object", NOT "carries a label": three reason
    // screens state their constraints as {sev, sla, def}, {term, definition} and {rule, setting,
    // why}, and requiring `label` would silently drop all three. So an EMPTY row is the violation.
    const emptyRow = structuredClone(byId('prop_s10_6_decide'))
    emptyRow.proposal.policy = [{}]
    expect(validateDecisionObject(emptyRow).join(' ')).toContain('proposal.policy[0]')

    const notAnArray = structuredClone(byId('prop_s10_6_decide'))
    notAnArray.proposal.policy = { label: 'not a row set' }
    expect(validateDecisionObject(notAnArray).join(' ')).toContain('proposal.policy')

    const lopsidedShares = structuredClone(byId('prop_s9_18_analyze'))
    lopsidedShares.proposal.matrix[0].cells[1].share = 7
    expect(validateDecisionObject(lopsidedShares).join(' ')).toContain('two-way split')
  })
})

describe('T18 — every claimed value is a NUMBER, never a numeric-looking string', () => {
  const NUMERIC_PATHS = [
    ['proposal.matrix[].cells[].share', (d) =>
      (d.proposal?.matrix ?? []).flatMap((r) => (r.cells ?? []).map((c) => c.share)).filter((v) => v !== undefined)],
    ['proposal.threshold_control.min', (d) => (d.proposal?.threshold_control ? [d.proposal.threshold_control.min] : [])],
    ['proposal.threshold_control.max', (d) => (d.proposal?.threshold_control ? [d.proposal.threshold_control.max] : [])],
    ['proposal.threshold_control.step', (d) => (d.proposal?.threshold_control ? [d.proposal.threshold_control.step] : [])],
    ['proposal.threshold_control.value', (d) => (d.proposal?.threshold_control ? [d.proposal.threshold_control.value] : [])],
  ]

  it.each(NUMERIC_PATHS)('%s is a finite number on every object that has it', (label, extract) => {
    const values = dataset.flatMap(extract).filter((v) => v !== undefined)
    expect(values.length, `${label} found nothing to check`).toBeGreaterThan(0)
    for (const v of values) {
      expect(typeof v, `${label} carried ${JSON.stringify(v)}`).toBe('number')
      expect(Number.isFinite(v), `${label} carried ${JSON.stringify(v)}`).toBe(true)
    }
  })

  it('the shares are a two-way split that sums to 100', () => {
    // Evidence that these are a real measurement rather than two independent bar widths.
    for (const row of byId('prop_s9_18_analyze').proposal.matrix) {
      const total = row.cells.reduce((a, c) => a + c.share, 0)
      expect(total, `${row.label} shares do not sum to 100`).toBe(100)
    }
  })
})

describe('T19 — non-degeneracy, with no new exemptions', () => {
  it('the east shares vary across the grid', () => {
    const shares = new Set(byId('prop_s9_18_analyze').proposal.matrix.map((r) => r.cells[0].share))
    expect(shares.size).toBeGreaterThanOrEqual(2)
  })

  it('proposal.policy row sets vary across the objects that carry them', () => {
    const shapes = new Set(dataset.filter((d) => d.proposal?.policy).map((d) => JSON.stringify(d.proposal.policy)))
    expect(shapes.size).toBeGreaterThanOrEqual(2)
  })

  it('threshold_control describes a real RANGE, not a degenerate point', () => {
    // The honest non-degeneracy test for a single-instance range field, stated rather than exempted:
    // a control whose min equals its max, or whose value sits outside its own bounds, is decoration.
    const c = byId('prop_s9_12_decide').proposal.threshold_control
    expect(c.max).toBeGreaterThan(c.min)
    expect(c.step).toBeGreaterThan(0)
    expect(c.value).toBeGreaterThanOrEqual(c.min)
    expect(c.value).toBeLessThanOrEqual(c.max)
    expect(new Set([c.min, c.max, c.step, c.value]).size).toBeGreaterThanOrEqual(2)
  })

  it('the R5 exemption list has NOT grown', async () => {
    // Phase 2 named exactly three knowingly-degenerate axes. Phase 3A adds no field that needs an
    // exemption, and this asserts the list itself rather than trusting a comment.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../contract/contractExtension.test.js', import.meta.url), 'utf8'),
    )
    const match = /const EXEMPT_BY_RULING_R5 = \[([^\]]*)\]/.exec(src)
    expect(match, 'the exemption list was renamed or removed').toBeTruthy()
    const names = match[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
    expect(names).toEqual(['entitlement', 'contract_class', 'operator_scope'])
  })
})

describe('T20 — the geometry and ambiguous keys stay unclaimed, permanently', () => {
  const KEYS_IN_NORMALIZED = new Set()
  ;(function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v !== null && typeof v === 'object') {
      for (const [k, sub] of Object.entries(v)) {
        KEYS_IN_NORMALIZED.add(k)
        walk(sub)
      }
    }
  })(dataset)

  /**
   * (d) BAR GEOMETRY — `value / chosenAxisMax * 100`. Proven, not assumed: see this file's header.
   * `widthPct` and `markPct` are in this list because of ruling R15, which reverses the
   * `NUMERIC_DESPITE_NAME` exemption I added in Phase 2 on the argument that a numeric `widthPct`
   * "IS data". `sel.band` — {low:"$44", high:"$92", our:"$68", lowPct:18, widthPct:62, ourPct:52},
   * reconstructing on an axis window of roughly $30–$107 — disproves that, so the exemption goes.
   */
  const GEOMETRY = [
    'floorPct', 'nowPct', 'targetPct', 'markPct', 'lowPct', 'widthPct', 'ourPct',
    'bandWidth', 'barWidth', 'pctFrom', 'pctTo', 'fromPct', 'toPct',
    'targetY', 'targetX', 'targetLx', 'targetLy', 'width',
  ]

  /** (e) AMBIGUOUS — the reference does not say what these measure, so nothing claims them. */
  const AMBIGUOUS = [
    'closedPct', 'needPct', 'detectPct', 'weeksPct', 'expPct', 'budgetPct', 'scorePct',
    'expectedPct', 'caps', 'capaCopy', 'floorNote', 'recoveredValue',
  ]

  it.each(GEOMETRY)('geometry key %s is absent from the corpus', (key) => {
    expect(KEYS_IN_NORMALIZED.has(key), `${key} was claimed — geometry crossed the boundary`).toBe(false)
  })

  it.each(AMBIGUOUS)('ambiguous key %s is absent from the corpus', (key) => {
    expect(KEYS_IN_NORMALIZED.has(key), `${key} was claimed without a ruling on what it measures`).toBe(false)
  })

  it('R15 — the NUMERIC_DESPITE_NAME exemption is gone from the extractor', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../../../../extraction/normalizeCorpus.js', import.meta.url), 'utf8')
    expect(src, 'the reversed exemption is still in the extractor').not.toContain('NUMERIC_DESPITE_NAME')
  })
})

describe('T21 — the boundary still holds on the new corpus', () => {
  // T10's own walk lives in boundary.test.js and runs over the same dataset, so this asserts the
  // specific risk THIS phase introduces: a newly claimed row bringing a presentation sibling with it.
  const rows = [
    ...dataset.flatMap((d) => d.proposal?.policy ?? []),
    ...dataset.flatMap((d) => d.proposal?.matrix ?? []),
  ]

  it('finds newly claimed rows to check', () => {
    expect(rows.length).toBeGreaterThanOrEqual(100)
  })

  it('no newly claimed row carries a presentation sibling', () => {
    const FORBIDDEN = /^(tone|tint|hue|bg|fg|fill|stroke|icon|glyph|border|shadow|opacity|colou?r|className)/i
    const offenders = []
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (FORBIDDEN.test(key)) offenders.push(`${key} on ${JSON.stringify(row).slice(0, 80)}`)
      }
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && (value.includes('var(--') || value.includes('color-mix(') || /^#[0-9a-f]{3,8}$/i.test(value.trim()) || /\bfa-[a-z-]{3,}\b/.test(value))) {
          offenders.push(`${key}=${JSON.stringify(value)}`)
        }
      }
    }
    expect(offenders, 'presentation crossed the boundary on a newly claimed row').toEqual([])
  })
})

describe('T22/R16 — totals is never a hollow empty object', () => {
  it('is absent or has rows, never {}', () => {
    // `dropUndefined({rows: undefined})` returns `{}`, which is not `undefined`, so the outer
    // dropUndefined kept it — and a key that makes a 105/105 population claim technically true and
    // substantively false is worse than an absent one.
    const hollow = dataset.filter((d) => d.totals !== undefined && !Array.isArray(d.totals?.rows))
    expect(hollow.map((d) => d.proposal_id), `${hollow.length} objects carry a hollow totals`).toEqual([])
  })

  it('still carries the 23 real rollups it always had', () => {
    const withRows = dataset.filter((d) => Array.isArray(d.totals?.rows))
    expect(withRows).toHaveLength(23)
  })
})

describe('T23 — a value that exists ONLY as a formatted display string is not present as a number', () => {
  /**
   * The anti-parsing assertion, naming the specific values identified in step 1. R2 forbids
   * recovering a number from a formatted string, because that makes blocks/formatValue.js's own
   * output an input. These are the semantic threshold values the geometry above was computed from,
   * and they stay strings — 201 occurrences, addressed to Phase 4's typed-number lane.
   */
  const FORMATTED_ONLY = [
    ['limit', '4.0%', 4.0],
    ['floor', '3.0%', 3.0],
    ['today', '3.4%', 3.4],
    ['mapFloor', '$21.80', 21.8],
    ['bbTarget', 'target 95%', 95],
    ['cvrTarget', 'target 13%', 13],
    ['low', '$44', 44],
    ['our', '$68', 68],
  ]

  const SCALARS = []
  ;(function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v !== null && typeof v === 'object') {
      for (const [k, sub] of Object.entries(v)) {
        if (sub === null || typeof sub !== 'object') SCALARS.push([k, sub])
        else walk(sub)
      }
    }
  })(dataset)

  it.each(FORMATTED_ONLY)('%s stays the string %s and never becomes a number', (key, _raw, parsed) => {
    const asNumber = SCALARS.filter(([k, v]) => k === key && typeof v === 'number' && v === parsed)
    expect(asNumber, `${key} appears as the number ${parsed} — a display string was parsed`).toEqual([])
  })

  it('the formatted values that DO reach the corpus stay strings', () => {
    // Where a formatted threshold value survives — inside a claimed row set such as
    // `proposal.policy` or `guardrails.checks` — it stays exactly the string the reference wrote.
    // It is neither parsed into a number nor deleted.
    const formatted = []
    for (const d of dataset) {
      for (const row of d.proposal?.policy ?? []) {
        for (const v of Object.values(row)) if (typeof v === 'string' && /^[$≥≤<>]|%$/.test(v.trim())) formatted.push(v)
      }
    }
    expect(formatted.length, 'no formatted constraint values reach the corpus at all').toBeGreaterThan(0)
    for (const v of formatted) expect(typeof v).toBe('string')
  })

  it('records that `metrics` — the richest threshold structure — reaches nothing', () => {
    // S10.3/reason's `metrics` rows are {label, market, limit "4.0%", floor "3.0%", today "3.4%",
    // risk, buffer}: the single most complete threshold statement in the reference. No canonical
    // field claims them, so they do not render at all. Asserted rather than merely noted, so the
    // day someone claims them this test is the reminder to update deliverable F.
    const anyLimitRow = dataset.some((d) =>
      Object.values(d.proposal ?? {}).some((v) => Array.isArray(v) && v.some((r) => r && typeof r.limit === 'string')),
    )
    expect(anyLimitRow, '`metrics` became claimed — update deliverable F and re-rule the fold list').toBe(false)
  })
})
