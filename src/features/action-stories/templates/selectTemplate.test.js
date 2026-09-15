// Suite 1: the selector. The whole template layer's correctness reduces to this function being
// total, deterministic and refusing to guess.
import { describe, it, expect } from 'vitest'
import { selectTemplate, SELECTABLE_TEMPLATE_IDS } from './selectTemplate'
import { TEMPLATE_REGISTRY } from './templateRegistry'
import { ACTION_TYPES, STAGES, CARDINALITIES, ENTITLEMENTS } from '../contract/decisionObject'

const base = { action_type: 'reprice', stage: 'decide', cardinality: 'many', entitlement: 'full' }

describe('selectTemplate — stage + cardinality resolution', () => {
  it('resolves each of the four stage templates', () => {
    expect(selectTemplate({ ...base, stage: 'reason' })).toBe('reason.v1')
    expect(selectTemplate({ ...base, stage: 'analyze' })).toBe('analyze.compare.v1')
    expect(selectTemplate({ ...base, stage: 'decide' })).toBe('decide.slate.v1')
    expect(selectTemplate({ ...base, stage: 'execute' })).toBe('execute.bridge.v1')
  })

  it('falls back from the stage+cardinality tier to the stage tier', () => {
    // reason/analyze/execute are declared at the `*|stage|*` tier, so any cardinality reaches them.
    expect(selectTemplate({ ...base, stage: 'reason', cardinality: 'one' })).toBe('reason.v1')
    expect(selectTemplate({ ...base, stage: 'analyze', cardinality: 'one' })).toBe('analyze.compare.v1')
  })

  it('renders a single-item decide through the same Decide template', () => {
    // Cardinality is now DERIVED from the proposal's real item count rather than hard-coded to
    // "many" (extraction/normalizeCorpus.js's cardinalityFor), so `one` is a real, reachable value.
    // It keeps doing real work — `approve_selected` gates on it — but it must not decide whether a
    // decide-stage proposal renders at all: a single-item decision is still a decision, and failing
    // it to an unsupported-decision page would be a coverage regression dressed up as strictness.
    expect(selectTemplate({ ...base, stage: 'decide', cardinality: 'one' })).toBe('decide.slate.v1')
  })

  it('renders the live stage as a running execution, not a sixth template', () => {
    // The reference's one live screen (S10.6) shows a plan, progress rows, monitors, the systems
    // being written to and a ledger — exactly execute.bridge.v1's own content. Minting a
    // speculative `live.v1` for one screen would be the new template this architecture exists to
    // avoid; the stage is a state of execute, so it renders as one.
    expect(selectTemplate({ ...base, stage: 'live' })).toBe('execute.bridge.v1')
  })

  it('returns null for an unsupported stage rather than guessing', () => {
    expect(selectTemplate({ ...base, stage: 'archive' })).toBeNull()
    expect(selectTemplate({ ...base, stage: '' })).toBeNull()
  })
})

describe('selectTemplate — entitlement short-circuit', () => {
  it('resolves locked.v1 for every stage, before the table is consulted', () => {
    for (const stage of STAGES) {
      expect(selectTemplate({ ...base, stage, entitlement: 'locked' })).toBe('locked.v1')
    }
  })

  it('leaves full and limited to the normal table', () => {
    expect(selectTemplate({ ...base, entitlement: 'full' })).toBe('decide.slate.v1')
    expect(selectTemplate({ ...base, entitlement: 'limited' })).toBe('decide.slate.v1')
  })
})

describe('selectTemplate — totality and determinism', () => {
  it('never throws and never returns undefined for any contract-legal input', () => {
    for (const action_type of ACTION_TYPES) {
      for (const stage of STAGES) {
        for (const cardinality of CARDINALITIES) {
          for (const entitlement of ENTITLEMENTS) {
            const result = selectTemplate({ action_type, stage, cardinality, entitlement })
            expect(result === null || typeof result === 'string').toBe(true)
            if (result !== null) expect(TEMPLATE_REGISTRY[result]).toBeTruthy()
          }
        }
      }
    }
  })

  it('is deterministic — the same input always produces the same answer', () => {
    const input = { ...base }
    const first = selectTemplate(input)
    for (let i = 0; i < 50; i += 1) expect(selectTemplate({ ...input })).toBe(first)
  })

  it('returns null, never a default template, for junk input', () => {
    expect(selectTemplate(null)).toBeNull()
    expect(selectTemplate(undefined)).toBeNull()
    expect(selectTemplate({})).toBeNull()
    expect(selectTemplate({ stage: '' })).toBeNull()
    expect(selectTemplate({ stage: 42 })).toBeNull()
  })

  it('returns null when the stage axis is missing entirely', () => {
    expect(selectTemplate({ action_type: 'reprice', cardinality: 'many', entitlement: 'full' })).toBeNull()
  })

  it('every id the selector can produce has a registered template', () => {
    for (const id of SELECTABLE_TEMPLATE_IDS) expect(TEMPLATE_REGISTRY[id]).toBeTruthy()
  })

  it('registers exactly the five Phase-1 canonical templates — no more', () => {
    expect(Object.keys(TEMPLATE_REGISTRY).sort()).toEqual(
      ['analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1', 'reason.v1'],
    )
  })
})
