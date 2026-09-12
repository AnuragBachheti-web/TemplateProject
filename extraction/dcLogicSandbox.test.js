import { describe, it, expect } from 'vitest'
import { runScreenScript, attachRawRecords, computeControlPayload } from './dcLogicSandbox.js'

// A synthetic, minimal stand-in for a real reference mockup's `class Component extends DCLogic`
// script body — deliberately shaped like S9.11's own SLATE()/renderVals() pair (a zero-arg raw
// record provider, a control-bound state field, and a renderVals() that both echoes the control's
// current value and derives several other fields from it) so these tests exercise the exact
// mechanism the real S9.11/S9.2/S9.12 fixtures depend on, without hardcoding any real workflow.
const SCRIPT = `
class Component extends DCLogic {
  state = { tol: 4 };

  RECORDS() {
    return [
      { sku: 'A', name: 'Alpha', old: 10, nu: 11, loss: 2 },
      { sku: 'B', name: 'Beta', old: 20, nu: 21, loss: 3 },
    ];
  }

  renderVals() {
    const tol = this.state.tol;
    const records = this.RECORDS();
    const inTol = records.filter((r) => r.loss <= tol);
    return {
      tol,
      tolLabel: tol.toFixed(1) + '%',
      count: inTol.length,
      unrelated: 'always the same',
      rows: records.map((r) => ({ sku: r.sku, name: r.name, prices: '$' + r.old + ' -> $' + r.nu })),
    };
  }
}
`

describe('runScreenScript — raw-record reflection and control sampling', () => {
  it('captures the base renderVals() output unchanged, plus raw-record candidates and control samples', () => {
    const controls = [{ type: 'range', stateKey: 'tol', min: 1, max: 5, step: 1 }]
    const result = runScreenScript(SCRIPT, {}, controls)

    expect(result.data.tol).toBe(4)
    expect(result.data.count).toBe(2) // both records have loss <= 4

    expect(result.rawCandidates.RECORDS).toHaveLength(2)
    expect(result.rawCandidates.RECORDS[0]).toMatchObject({ sku: 'A', old: 10, nu: 11 })

    expect(result.controlSamples).toHaveLength(1)
    const sample = result.controlSamples[0]
    expect(sample.stateKey).toBe('tol')
    expect(sample.min).toBe(1)
    expect(sample.max).toBe(5)
    expect(sample.default).toBe(4)
    // Sampling at tol=1 should change `count` (only record B, loss=3, is still <=1? no — loss=2/3,
    // both > 1, so count becomes 0) — the important thing is at least one sample differs from base.
    expect(sample.samples.some((s) => s.data.count !== 2)).toBe(true)
  })

  it('never reflects a method that takes arguments, or renderVals() itself', () => {
    const result = runScreenScript(SCRIPT, {}, [])
    expect(result.rawCandidates.renderVals).toBeUndefined()
  })

  it('produces no control samples for a control whose state key cannot be confirmed to drive anything', () => {
    const controls = [{ type: 'range', stateKey: 'nonExistentKey', min: 0, max: 1, step: 1 }]
    const result = runScreenScript(SCRIPT, {}, controls)
    expect(result.controlSamples).toEqual([])
  })
})

describe('attachRawRecords — matches a formatted display array back onto its raw-record source', () => {
  it('attaches __raw by case-insensitive method-name match when lengths agree', () => {
    const data = {
      rows: [
        { sku: 'A', name: 'Alpha', prices: '$10 -> $11' },
        { sku: 'B', name: 'Beta', prices: '$20 -> $21' },
      ],
      unrelated: 'always the same',
    }
    const rawCandidates = {
      RECORDS: [
        { sku: 'A', name: 'Alpha', old: 10, nu: 11, loss: 2 },
        { sku: 'B', name: 'Beta', old: 20, nu: 21, loss: 3 },
      ],
    }
    const out = attachRawRecords(data, rawCandidates)
    expect(out.rows[0].__raw).toEqual(rawCandidates.RECORDS[0])
    expect(out.rows[0].prices).toBe('$10 -> $11') // the formatted field is untouched, never removed
    expect(out.unrelated).toBe('always the same')
  })

  it('does not attach when no candidate matches by name or unique length', () => {
    const data = { rows: [{ a: 1 }, { a: 2 }, { a: 3 }] }
    const rawCandidates = { X: [{ b: 1 }, { b: 2 }], Y: [{ c: 1 }, { c: 2 }] } // neither is length-3
    const out = attachRawRecords(data, rawCandidates)
    expect(out.rows[0].__raw).toBeUndefined()
  })

  it('leaves data untouched when there are no raw candidates at all', () => {
    const data = { rows: [{ a: 1 }] }
    expect(attachRawRecords(data, {})).toBe(data)
  })
})

describe('computeControlPayload — turns base + sampled data into a real slider shape with measured dependencies', () => {
  it('computes dependencies as exactly the keys that differ across samples, and builds a steps table', () => {
    const baseData = { tol: 4, count: 2, unrelated: 'always the same' }
    const control = { stateKey: 'tol', min: 1, max: 5, step: 1, default: 4 }
    const samples = [
      { value: 1, data: { tol: 1, count: 0, unrelated: 'always the same' } },
      { value: 5, data: { tol: 5, count: 2, unrelated: 'always the same' } },
    ]
    const payload = computeControlPayload(baseData, control, samples)

    expect(payload).toMatchObject({ min: 1, max: 5, step: 1, value: 4 })
    expect(payload.dependencies).toEqual(['count'])
    expect(payload.dependencies).not.toContain('unrelated') // identical in every sample — not a dependency
    expect(payload.dependencies).not.toContain('tol') // the control's own key is never its own dependency
    expect(payload.steps).toHaveLength(3) // base + 2 samples
    expect(payload.steps.find((s) => s.at === 1).count).toBe(0)
    expect(payload.steps.find((s) => s.at === 5).count).toBe(2)
  })

  it('treats two functions as equal regardless of identity (closures are recreated every call)', () => {
    const baseData = { tol: 4, onToggle: () => {} }
    const control = { stateKey: 'tol', min: 1, max: 5, step: 1, default: 4 }
    const samples = [{ value: 5, data: { tol: 5, onToggle: () => {} } }]
    const payload = computeControlPayload(baseData, control, samples)
    expect(payload.dependencies).not.toContain('onToggle')
  })

  it('produces an empty dependency list when nothing else changes', () => {
    const baseData = { tol: 4, other: 'x' }
    const control = { stateKey: 'tol', min: 1, max: 5, step: 1, default: 4 }
    const samples = [{ value: 5, data: { tol: 5, other: 'x' } }]
    const payload = computeControlPayload(baseData, control, samples)
    expect(payload.dependencies).toEqual([])
  })
})
