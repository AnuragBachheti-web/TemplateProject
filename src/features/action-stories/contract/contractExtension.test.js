// Phase 2, T1-T4, T6 and T8: the extended Decision Object contract.
//
// THE RULE THIS FILE ENFORCES is the module's own recorded lesson — "an axis that is allowed to be
// optional degenerates into a constant, and then into decoration". `execLabel` was present on
// 105/105 and carried two values. `on_clock` is present on 105/105 and carries ONE. So presence is
// not the test; presence, type, AND non-degeneracy are the test, and T4 is parameterised so a field
// added later cannot quietly skip it.
//
// Route (i) per ruling R1: the five unpopulatable fields are REQUIRED AND NULLABLE. Present and
// correctly typed on 105/105; `null` is a legal typed value meaning "the reference does not state
// this". Absence, a wrong type, or a non-null value of the wrong shape all remain violations, so I1
// is unweakened — what is relaxed is the claim that the corpus knows the answer, not the contract.

import { describe, it, expect } from 'vitest'

import {
  validateDecisionObject,
  CHANNELS,
  ENTITLEMENTS,
  GUARDRAIL_CHECK_STATUSES,
  VALUE_UNITS,
} from './decisionObject'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'
import provenance from '@/features/action-stories/__corpus__/normalized/provenance.json'

/**
 * MINIMUM NON-NULL POPULATION PER FIELD, measured off the corpus — not chosen (R1).
 * Each number is what the evidence actually supports; the measurement that produced it is named so
 * a future change to the extractor that drops population fails here instead of passing quietly.
 */
const POPULATION_FLOORS = {
  // Sub-brand named EXCLUSIVELY in the object's own payload. "Ridgeline" x204 and "Alder" x84 across
  // the reference; 12 further objects name BOTH and are therefore about neither, so they stay null.
  brand: { min: 13, distinct: 2 },
  // A raw `channel`/`channels` string on the object's own stage file, mapped to the marketplace or
  // transport it names. 7 of 26 stories carry one.
  channel: { min: 14, distinct: 4 },
  // A raw `category` string on the object's own stage file. S9.20/analyze is the ONLY one in the
  // corpus. This floor is 1 because the evidence is 1 — see deliverable F.
  category: { min: 1, distinct: 1 },
  // The lead model credited on the proposal, from `proposal.agents[0]`. Reason stage only, by design.
  agent: { min: 26, distinct: 20 },
  // THESE ARE NOW REFERENCE-DERIVED FLOORS, not population floors. Phase 4 Part 1 fills all five
  // fields on 105/105 with marked placeholders, so counting non-null values would assert 105 five
  // times over and guarantee nothing. Counted through provenance instead — a field counts only where
  // its source is a named reference key rather than '(placeholder)' — these same numbers go on saying
  // exactly what Phase 2 measured, and say it EXACTLY rather than as a lower bound. If a placeholder
  // ever displaced a reference value, this is where it shows up.
  //
  // ZERO, and deliberately. Per R2, impact may only be populated from a value that is ALREADY a
  // number. The corpus has no top-level numeric key on any fixture: every magnitude is either a
  // pre-formatted display string ("+$41K" in `totals.rows`) or a row-level metric inside a table,
  // and neither is this proposal's headline impact. Parsing the former would ship a formatter
  // round-trip as a data source. So no impact is REFERENCE-DERIVED — it stays zero here. Phase 4
  // (R37) derives all 105 from the story's own prose and totals, and every one of them is marked
  // '(placeholder)' in provenance. That is the reversal, kept visible rather than absorbed.
  impact: { min: 0, distinct: 0 },
}

describe('T1 — every one of the 105 objects validates against the EXTENDED contract', () => {
  it('reports zero problems across the corpus', () => {
    const failures = dataset
      .map((d) => ({ proposal_id: d.proposal_id, problems: validateDecisionObject(d) }))
      .filter((r) => r.problems.length > 0)

    expect(failures, `${failures.length} object(s) fail the extended contract`).toEqual([])
  })

  it('covers all 105, so an empty dataset cannot pass this vacuously', () => {
    expect(dataset).toHaveLength(105)
  })
})

describe('T2 — impact is present and typed on 105/105', () => {
  it('is present on every object (null counts as present; absent does not)', () => {
    const missing = dataset.filter((d) => !('impact' in d)).map((d) => d.proposal_id)
    expect(missing, 'impact must be a declared field, never absent').toEqual([])
  })

  it('is either null or a typed number whose unit is a VALUE_UNITS member', () => {
    for (const d of dataset) {
      if (d.impact === null) continue
      expect(d.impact, `${d.proposal_id}.impact`).toHaveProperty('value')
      expect(typeof d.impact.value, `${d.proposal_id}.impact.value`).toBe('number')
      expect(VALUE_UNITS, `${d.proposal_id}.impact.unit`).toContain(d.impact.unit)
    }
  })

  it('is never CLAIMED from a pre-formatted display string (R2 as Phase 4 leaves it)', () => {
    // R2 forbade populating impact from display text. Phase 4 (R37) derives a magnitude from exactly
    // that text — so what R2 protected has to be restated rather than deleted, and the part that
    // still holds is the part that mattered: no display string is ever CLAIMED as a reference source.
    //
    //   the value is a number, never the string it was read out of  — unchanged;
    //   provenance names no raw key for it, only '(placeholder)'    — the claim ledger stays honest,
    //     which is what stopped a formatter round-trip from becoming a data source in the first place.
    for (const d of dataset) {
      if (d.impact === null) continue
      expect(typeof d.impact.value, `${d.proposal_id}.impact.value`).toBe('number')
      expect(provenance[d.proposal_id].impact, `${d.proposal_id} claims a raw key for impact`)
        .toBe('(placeholder)')
    }
    const derived = dataset.filter((d) => provenance[d.proposal_id].impact !== '(placeholder)')
    expect(derived, 'no impact may be reference-derived').toHaveLength(POPULATION_FLOORS.impact.min)
  })

  it('the contract REJECTS an impact that is absent, or present with the wrong shape', () => {
    const base = structuredClone(dataset[0])
    delete base.impact
    expect(validateDecisionObject(base).join(' ')).toContain('"impact"')

    expect(validateDecisionObject({ ...structuredClone(dataset[0]), impact: { value: 1, unit: 'bananas' } }).join(' ')).toContain('impact.unit')
    expect(validateDecisionObject({ ...structuredClone(dataset[0]), impact: { value: '41K', unit: 'USD' } }).join(' ')).toContain('impact.value')
    expect(validateDecisionObject({ ...structuredClone(dataset[0]), impact: 41000 }).join(' ')).toContain('"impact"')
  })
})

describe('T3 — brand, channel, category and agent are present and typed on 105/105', () => {
  const NULLABLE_STRING_FIELDS = ['brand', 'category', 'agent']

  it.each(['brand', 'channel', 'category', 'agent'])('%s is present on every object', (field) => {
    const missing = dataset.filter((d) => !(field in d)).map((d) => d.proposal_id)
    expect(missing, `${field} must be a declared field, never absent`).toEqual([])
  })

  it.each(NULLABLE_STRING_FIELDS)('%s is null or a non-empty string', (field) => {
    for (const d of dataset) {
      if (d[field] === null) continue
      expect(typeof d[field], `${d.proposal_id}.${field}`).toBe('string')
      expect(d[field].trim(), `${d.proposal_id}.${field}`).not.toBe('')
    }
  })

  it('channel is null or a CHANNELS member', () => {
    for (const d of dataset) {
      if (d.channel === null) continue
      expect(CHANNELS, `${d.proposal_id}.channel`).toContain(d.channel)
    }
  })

  it.each(Object.entries(POPULATION_FLOORS))('%s still has exactly its measured reference evidence', (field, { min }) => {
    const derived = dataset.filter((d) => {
      const source = provenance[d.proposal_id][field]
      return source !== null && source !== undefined && source !== '(placeholder)'
    })
    // EXACT, not a floor. A placeholder that displaced a reference value drives this DOWN, and a
    // placeholder mis-recorded as reference-derived drives it UP; a lower bound would catch neither.
    expect(derived.length, `${field}: reference-derived count moved off the Phase 2 measurement`).toBe(min)
  })

  it('the contract REJECTS each field absent, and rejects a wrong-typed non-null value', () => {
    for (const field of ['brand', 'channel', 'category', 'agent']) {
      const absent = structuredClone(dataset[0])
      delete absent[field]
      expect(validateDecisionObject(absent).join(' '), `absent ${field}`).toContain(`"${field}"`)

      const wrongType = { ...structuredClone(dataset[0]), [field]: 42 }
      expect(validateDecisionObject(wrongType).join(' '), `numeric ${field}`).toContain(`"${field}"`)
    }
    expect(validateDecisionObject({ ...structuredClone(dataset[0]), channel: 'carrier-pigeon' }).join(' ')).toContain('"channel"')
  })
})

describe('T4 — NON-DEGENERACY, parameterised so a new field cannot skip it', () => {
  /**
   * Fields whose whole purpose is to distinguish proposals from one another. Each must carry at
   * least two distinct values across the corpus, or it has become the next `execLabel`.
   */
  const MUST_VARY = [
    { field: 'channel', kind: 'enum' },
    { field: 'on_clock', kind: 'boolean' },
    { field: 'cardinality', kind: 'enum' },
    { field: 'mode', kind: 'enum' },
    { field: 'lens', kind: 'enum' },
    { field: 'persona', kind: 'enum' },
    { field: 'stage', kind: 'enum' },
    { field: 'action_type', kind: 'enum' },
  ]

  /**
   * EXEMPT, BY RULING R5 — and named rather than omitted, because an unexplained exemption is how a
   * constant axis survives and a named one is a ticket.
   *
   *   entitlement     ENUM EXTENDED this phase (observe, not_hired added) but population DEFERRED:
   *                   assigning a non-`full` entitlement to a real proposal has no basis in the
   *                   corpus, and R1 refuses invention outright.
   *   contract_class  'standard' x105. PROVISIONAL since Phase 1; no product definition exists.
   *   operator_scope  NOT ADDED (R6). Zero evidence distinguishes a brand-scope viewer from a
   *                   portfolio-scope one; the only honest value is a constant, so adding the field
   *                   would manufacture the very defect this phase exists to stop.
   *
   * Nothing may join this list without a ruling. If a field here becomes populated, delete its entry
   * and move it to MUST_VARY — this test failing for that reason is good news.
   */
  const EXEMPT_BY_RULING_R5 = ['entitlement', 'contract_class', 'operator_scope']

  it.each(MUST_VARY)('$field carries at least two distinct values across the 105', ({ field }) => {
    const values = new Set(dataset.map((d) => d[field]))
    expect(
      values.size,
      `"${field}" has collapsed to the constant ${JSON.stringify([...values][0])} — it is the next execLabel`,
    ).toBeGreaterThanOrEqual(2)
  })

  it('on_clock is true on no fewer than 10 objects', () => {
    const onClock = dataset.filter((d) => d.on_clock === true)
    expect(onClock.length, 'the clock axis is declared but dead').toBeGreaterThanOrEqual(10)
  })

  it('preserves at least one EXPLICIT negative, so the axis is not newly-constant-true (R3)', () => {
    // S9.19/execute ("not booked") and S9.20/execute ("not sent") state in the reference that there
    // is no clock. Those are evidence of `false`, not absence of evidence, and flipping them would
    // trade one degenerate axis for another.
    const negatives = dataset.filter((d) => d.on_clock === false)
    expect(negatives.length).toBeGreaterThanOrEqual(1)
    const explicit = dataset.filter((d) => d.on_clock === false && ['S9.19', 'S9.20'].includes(d.story_code) && d.stage === 'execute')
    expect(explicit.map((d) => d.proposal_id).sort()).toEqual(['prop_s9_19_execute', 'prop_s9_20_execute'])
  })

  it('every on_clock object carries a real ISO deadline, and no other object claims one', () => {
    for (const d of dataset) {
      if (d.on_clock === true) {
        expect(typeof d.deadline, `${d.proposal_id} is on the clock with no deadline`).toBe('string')
        expect(Number.isNaN(Date.parse(d.deadline)), `${d.proposal_id}.deadline`).toBe(false)
      }
    }
  })

  it('the exemption list is exactly the three fields R5 named — no silent additions', () => {
    expect(EXEMPT_BY_RULING_R5).toEqual(['entitlement', 'contract_class', 'operator_scope'])
    // And no exempt field is also in MUST_VARY, which would make the exemption meaningless.
    for (const f of EXEMPT_BY_RULING_R5) {
      expect(MUST_VARY.map((m) => m.field)).not.toContain(f)
    }
  })

  it('operator_scope was NOT added (R6)', () => {
    const present = dataset.filter((d) => 'operator_scope' in d)
    expect(present, 'R6: operator_scope must not exist until Product defines it').toEqual([])
  })
})

describe('T6 — every guardrails.checks row carries a status from the enum', () => {
  const rows = dataset.flatMap((d) =>
    (d.guardrails?.checks ?? []).map((row) => ({ proposal_id: d.proposal_id, row })),
  )

  it('finds the corpus rows, so this is not vacuous', () => {
    expect(rows.length).toBe(85)
    expect(dataset.filter((d) => Array.isArray(d.guardrails?.checks))).toHaveLength(20)
  })

  it.each(GUARDRAIL_CHECK_STATUSES)('%s is a declared status', (status) => {
    expect(GUARDRAIL_CHECK_STATUSES).toContain(status)
  })

  it('every row has a status in the enum', () => {
    const bad = rows.filter(({ row }) => !GUARDRAIL_CHECK_STATUSES.includes(row.status))
    expect(bad.map((b) => `${b.proposal_id}: ${JSON.stringify(b.row.status)}`)).toEqual([])
  })

  it('the statuses actually vary — a per-row pass/fail that is always pass renders nothing useful', () => {
    const seen = new Set(rows.map(({ row }) => row.status))
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })

  it('R11 — guardrails is REQUIRED, not optional-when-present', () => {
    // Phase 2 left this optional and Phase 2.1's ruling R11 closed it. `deriveEligibility` reads
    // `guardrails.verdict` and fails closed without it, so a validator that ACCEPTED an object the
    // producer must then block was the same latent shape as the Phase 1 bug — two layers disagreeing
    // about whether a field matters, invisible until a live API sends the combination.
    const absent = structuredClone(dataset[0])
    delete absent.guardrails
    expect(validateDecisionObject(absent).join(' ')).toContain('"guardrails" is required')

    for (const notAnObject of [null, 'within_limits', 42, []]) {
      const bad = { ...structuredClone(dataset[0]), guardrails: notAnObject }
      expect(validateDecisionObject(bad).join(' '), JSON.stringify(notAnObject)).toContain('"guardrails"')
    }

    // Assertion-only: all 105 already carry it, which is precisely when a hole is safe to close.
    expect(dataset.filter((d) => !d.guardrails)).toEqual([])
  })

  it('the contract REJECTS a row with a missing or unknown status (closing decisionObject.js:254-256)', () => {
    const base = structuredClone(dataset.find((d) => Array.isArray(d.guardrails?.checks)))
    const noStatus = structuredClone(base)
    delete noStatus.guardrails.checks[0].status
    expect(validateDecisionObject(noStatus).join(' ')).toContain('guardrails.checks[0].status')

    const badStatus = structuredClone(base)
    badStatus.guardrails.checks[0].status = 'greenish'
    expect(validateDecisionObject(badStatus).join(' ')).toContain('guardrails.checks[0].status')
  })
})

describe('T8 — observe and not_hired validate as entitlement values', () => {
  it.each(['observe', 'not_hired'])('%s is accepted', (value) => {
    expect(ENTITLEMENTS).toContain(value)
    const d = { ...structuredClone(dataset[0]), entitlement: value }
    expect(validateDecisionObject(d).filter((p) => p.includes('entitlement'))).toEqual([])
  })

  it('keeps the three that already existed', () => {
    expect(ENTITLEMENTS).toEqual(['full', 'limited', 'locked', 'observe', 'not_hired'])
  })

  it('still rejects a value outside the enum', () => {
    const d = { ...structuredClone(dataset[0]), entitlement: 'sort_of' }
    expect(validateDecisionObject(d).join(' ')).toContain('"entitlement"')
  })

  it('does NOT assign a non-full entitlement to any real proposal (R5)', () => {
    // The enum grew; the corpus did not. Deliberate, and asserted so a later change that starts
    // inventing entitlements has to come past this test.
    expect([...new Set(dataset.map((d) => d.entitlement))]).toEqual(['full'])
  })
})
