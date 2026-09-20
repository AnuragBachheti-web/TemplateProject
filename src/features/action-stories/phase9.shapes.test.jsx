// @vitest-environment jsdom
//
// T128-T131 — PHASE 9: ONE SLOT PER SHAPE, NEVER PER NAME.
//
// ============================================================================================
// THE FINDING, IN ONE LINE
// ============================================================================================
//
// S9.11/reason `targets`, S10.3/reason `exposure` and S10.1/reason `bandRows` carry the IDENTICAL
// content field set — `label`, `value`, `note`. Only `targets` is claimed, and only because it
// happens to be one of the seven names `policy`'s candidate list already spells out. The other two
// render nothing. That is not a shape the vocabulary is missing; it is a shape the vocabulary has
// and cannot reach, because slotVocabulary matches by NAME.
//
// `policy` is the one place this project already grouped by shape — policy, targets, rules,
// standards, thresholds, slas, terms: seven names, one slot, one component. It was never
// generalised. These slots generalise it.
//
// ============================================================================================
// WHY ONLY TWO FAMILIES (rulings R126-R129)
// ============================================================================================
//
// The census grouped all 354 content-carrying unclaimed structured keys by shape. Seven families
// had an existing component. Only two are claimed here, and the metric that decided it is NOT
// keys-per-slot — it is IGNORE-LIST ENTRIES (R127). A slot is one reviewed line; an ignore entry is
// a hand-written permission for data nobody has seen, and shapeLedger.js's own comment says exactly
// that. Keys bought per entry written:
//
//   metricList     81 keys / 14 entries = 5.8     CLAIMED — 61 land, after R130, the decorative
//                                                 honesty check, and the density ratchet
//   labelledProse  24 keys / 12 entries = 2.0     CLAIMED — 17 land, after the honesty check
//   heterogeneous  47 keys / 43 entries = 1.1     refused
//   objectValue    27 keys / 51 entries = 0.53    refused (R129) — and it would light up a block
//                                                 no slot has ever pointed at
//   statefulRow    30 keys / 82 entries = 0.37    refused (R127)
//   timeline        5 keys / 27 entries = 0.19    refused (R127)
//   namedRich      77 keys /  1 entry            refused (R128) — 77 objects across 74 names with a
//                                                 top field set of 3 is a catch-all, not a shape. It
//                                                 clears every floor only because cardSet renders
//                                                 anything, and the variant that would carry it
//                                                 generically is slateCard, parked on the R111
//                                                 branch. Largest deferred group; unblocks if R111
//                                                 lands.

import { describe, it, expect } from 'vitest'
import { SLOT_VOCABULARY } from './templates/slotVocabulary'
import { BLOCK_TYPES } from './manifests/blockTypes'
import { BLOCK_VARIANTS, MAX_VARIANTS_PER_BLOCK } from './blocks/variants'
import { IGNORE_LIST, buildLedger } from './__corpus__/shapeLedger'
import { SHAPE_SLOT_CANDIDATES, SHAPE_SLOT_MAX_PER_PANE } from './templates/shapeSlots'
import { resolveTemplate } from './templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'
import provenance from '@/features/action-stories/__corpus__/normalized/provenance.json'
import before from '@/features/action-stories/__corpus__/__snapshots__/phase9-before-corpus.json'

/**
 * The six slots this phase adds — two shapes across two namespaces, plus a `secondary_*` only where
 * the corpus actually carries two of that shape on one pane.
 *
 * NOT SYMMETRIC, AND DELIBERATELY SO. No reason/analyze/decide pane holds two note lists, and no
 * execute pane holds two metric lists. Declaring those two slots anyway would add a permanent block
 * to each template and push three of the four past the density ratchet in templateVocabulary.test.js
 * — a test whose whole purpose is stopping a phase like this one widening the templates by habit.
 * An unexercised slot is the same bargain as an unexercised ignore entry, and R127 priced it.
 */
const NEW_SLOTS = [
  'measures', 'secondary_measures', 'notes',
  'execution_measures', 'execution_notes', 'execution_secondary_notes',
]

describe('T128 — every new slot is a SHAPE slot, never a name slot (I1)', () => {
  it('adds exactly the six slots that carry data', () => {
    for (const s of NEW_SLOTS) expect(SLOT_VOCABULARY[s], `${s} is missing`).toBeDefined()
    const added = Object.keys(SLOT_VOCABULARY).filter((s) => NEW_SLOTS.includes(s))
    expect(added.sort()).toEqual([...NEW_SLOTS].sort())
  })

  it('every new slot draws from a candidate list of 2 or more names', () => {
    // I1 STATED AS AN ASSERTION. A one-entry candidate list is a name slot wearing a shape slot's
    // clothes — it closes one key and costs a permanent line in the vocabulary. The census found
    // 237 singletons; this is what keeps them out.
    const thin = []
    for (const s of NEW_SLOTS) {
      const c = SHAPE_SLOT_CANDIDATES[s]
      expect(c, `${s} has no candidate list`).toBeDefined()
      if (c.length < 2) thin.push(`${s}: ${c.length}`)
    }
    expect(thin, 'a new slot has a single-name candidate list').toEqual([])
  })

  it('and the lists are substantial, not two names scraped together', () => {
    expect(SHAPE_SLOT_CANDIDATES.measures.length).toBeGreaterThanOrEqual(40)
    expect(SHAPE_SLOT_CANDIDATES.notes.length).toBeGreaterThanOrEqual(15)
  })

  it('the two shapes share one candidate list per family, across both namespaces', () => {
    // The whole premise: the SHAPE decides the slot, so the proposal-stage slot and the
    // execution-stage slot for one shape read the same names. If these ever diverge, the grouping
    // has quietly become per-stage naming again.
    expect(SHAPE_SLOT_CANDIDATES.execution_measures).toEqual(SHAPE_SLOT_CANDIDATES.measures)
    expect(SHAPE_SLOT_CANDIDATES.secondary_measures).toEqual(SHAPE_SLOT_CANDIDATES.measures)
    expect(SHAPE_SLOT_CANDIDATES.execution_notes).toEqual(SHAPE_SLOT_CANDIDATES.notes)
    expect(SHAPE_SLOT_CANDIDATES.execution_secondary_notes).toEqual(SHAPE_SLOT_CANDIDATES.notes)
  })
})

describe('T129 — the claim gate still holds, and the ignore list stays bounded (I3, R127)', () => {
  it('reports zero MISROUTED claims across all 105 objects', () => {
    const unaccounted = []
    for (const entry of buildLedger(dataset, provenance, resolveTemplate)) {
      for (const drop of entry.dropped) {
        if (drop.outcome === 'IGNORED' || drop.outcome === 'DEFERRED') continue
        unaccounted.push(`${entry.proposalId}: ${entry.slotName}[${entry.blockType}].${drop.field}`)
      }
    }
    expect(unaccounted).toEqual([])
  })

  it('keeps the ignore list under the 40-entry cap R127 set — and in fact adds nothing', () => {
    // R127 MADE THIS THE DECIDING METRIC and capped it at 40. The census projected 22 new entries
    // and the real number is ZERO, for a reason worth recording: `clean()` strips decorative keys
    // upstream of the corpus, so the ledger — which reads the NORMALIZED objects — never sees them
    // dropped. The projection was measured against the raw fixtures and was counting work the
    // pipeline had already done.
    //
    // That same fact is why shapeSlots.js checks decorative honesty against the RAW value. A field
    // clean() has already removed cannot be reported by a ledger that runs after it.
    expect(Object.keys(IGNORE_LIST).length).toBe(7)
    expect(Object.keys(IGNORE_LIST).length).toBeLessThanOrEqual(40)
  })

  it('and every entry it added names one of the three existing categories', () => {
    const CATEGORIES = new Set(['extraction residue', 'derived geometry', 'rendered elsewhere'])
    const bad = Object.entries(IGNORE_LIST)
      .filter(([, e]) => !CATEGORIES.has(e.category))
      .map(([k, e]) => `${k}: ${e.category}`)
    expect(bad, 'an ignore entry invented a category').toEqual([])
  })

  it('and no entry is unexercised — a permission for data nobody has seen', () => {
    const used = new Set()
    for (const entry of buildLedger(dataset, provenance, resolveTemplate)) {
      for (const drop of entry.dropped) used.add(`${entry.blockType}.${drop.field}`)
    }
    const unused = Object.keys(IGNORE_LIST).filter((k) => !used.has(k))
    expect(unused, 'an ignore-list entry no claim exercises').toEqual([])
  })
})

describe('T130 — no new block type and no new variant (I2)', () => {
  it('the block vocabulary is the same nineteen', () => {
    expect(BLOCK_TYPES).toHaveLength(19)
  })

  it('every new slot points at a block that already existed', () => {
    const known = new Set(BLOCK_TYPES)
    for (const s of NEW_SLOTS) expect(known.has(SLOT_VOCABULARY[s].blockType), `${s}`).toBe(true)
  })

  it('and declares no variant at all', () => {
    // These slots render the plain block. A variant would be a new rendering rule for a shape that
    // by definition already has one — which is the thing I2 forbids.
    for (const s of NEW_SLOTS) expect(SLOT_VOCABULARY[s].variant, `${s}`).toBeUndefined()
  })

  it('the variant cap and register are untouched', () => {
    expect(MAX_VARIANTS_PER_BLOCK).toBe(3)
    expect([...BLOCK_VARIANTS.cardSet].sort()).toEqual(['groupCard', 'routeCard', 'scenarioCard'])
    expect([...BLOCK_VARIANTS.statList].sort()).toEqual(['metricGrid', 'reconStrip'])
  })
})

describe('T131 — the corpus grows and nothing in it moves (I6)', () => {
  const byId = new Map(before.map((d) => [d.proposal_id, d]))

  it('still 105 objects, same ids', () => {
    expect(dataset).toHaveLength(105)
    expect(dataset.map((d) => d.proposal_id).sort()).toEqual(before.map((d) => d.proposal_id).sort())
  })

  // COMPARED LEAF BY LEAF, not object by object. `proposal` is an object, so a wholesale compare
  // reports every pane that GAINED a shape slot as "changed" and would make this assertion useless
  // in exactly the direction that matters — it would be red whether or not anything moved.
  const walk = (before_, after, path, id, moved, added) => {
    for (const k of Object.keys(before_)) {
      const p = path ? `${path}.${k}` : k
      const a = before_[k], b = after[k]
      if (b === undefined) { moved.push(`${id}: ${p} REMOVED`); continue }
      const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
      if (plain(a) && plain(b)) walk(a, b, p, id, moved, added)
      else if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(`${id}: ${p}`)
    }
    for (const k of Object.keys(after)) if (before_[k] === undefined) added.add(path ? `${path}.${k}` : k)
  }

  it('every value that existed before is byte-identical after (additive only)', () => {
    // THE WHOLE RISK OF THIS PHASE IN ONE ASSERTION. These slots add 58 candidate names, and three
    // of them — `sources`, `evidence`, `thresholds` — are already on `inputs` and `policy`.
    // `rec.claimed` is first-come, so a shape pick evaluated too early would silently re-point a
    // slot that has rendered since Phase 3. Nothing may change; things may only appear.
    const moved = [], added = new Set()
    for (const now of dataset) walk(byId.get(now.proposal_id), now, '', now.proposal_id, moved, added)
    expect(moved, 'an existing value moved').toEqual([])
  })

  it('and the only new paths are the eight shape bindings', () => {
    const moved = [], added = new Set()
    for (const now of dataset) walk(byId.get(now.proposal_id), now, '', now.proposal_id, moved, added)
    expect([...added].sort()).toEqual([
      'execution.measures', 'execution.notes', 'execution.secondary_notes',
      'proposal.measures', 'proposal.notes', 'proposal.secondary_measures',
    ])
  })

  it('claims 78 keys — 61 metric lists and 17 note lists', () => {
    let n = 0
    for (const d of dataset) {
      for (const ns of ['proposal', 'execution']) {
        for (const k of ['measures', 'secondary_measures', 'notes', 'secondary_notes']) {
          if ((d[ns] ?? {})[k] !== undefined) n++
        }
      }
    }
    expect(n).toBe(78)
  })

  it('R130 — no pane renders three or more blocks of one shape', () => {
    // A generic label is readable once or twice on a pane. Four is noise, and shipping content an
    // operator cannot name is not an improvement. Where the reference put three or more of one
    // shape on a screen, they stay unclaimed and are reported rather than rendered.
    expect(SHAPE_SLOT_MAX_PER_PANE).toBe(2)
    const over = []
    for (const d of dataset) {
      for (const ns of ['proposal', 'execution']) {
        const m = ['measures', 'secondary_measures'].filter((k) => (d[ns] ?? {})[k] !== undefined).length
        const t = ['notes', 'secondary_notes'].filter((k) => (d[ns] ?? {})[k] !== undefined).length
        if (m > 2 || t > 2) over.push(d.proposal_id)
      }
    }
    expect(over).toEqual([])
  })
})
