// REFERENCE FIDELITY — the regression fences for docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md.
//
// The rest of the suite already proves the system RENDERS. This file proves it renders the
// REFERENCE'S OWN BUSINESS CONTENT, which is a different claim and the one the audit found failing.
//
// When the audit ran, every test passed, the build succeeded and the renderer logged zero warnings —
// while 31% of content slots were filled from the wrong reference field, `execution.rollback` was
// fabricated on 21 of 21 execute screens, and the `selectable` slate was a tab strip on 16 of 21.
// Nothing measured any of that, which is why none of it was visible. These are the measurements.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dataset from './normalized/dataset.json'
import provenance from './normalized/provenance.json'
import { selectTemplate } from '../templates/selectTemplate'
import { resolveTemplate } from '../templates/templateRegistry'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { resolveBinding } from '../manifests/resolveBinding'
import { evaluateCondition } from '../manifests/actionCondition'
import { validateBlockData } from '../manifests/blockTypes'
import { BLOCK_REGISTRY } from '../blocks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const NORMALIZER_SOURCE = fs.readFileSync(path.join(REPO_ROOT, 'extraction/normalizeCorpus.js'), 'utf8')

/**
 * The normalizer's CODE, with its comments removed. The assertions below check that a mechanism is
 * gone, and the file documents at length what each removed mechanism did and what it cost — naming
 * `fallbackScan` in a comment explaining why there is no longer a `fallbackScan` must not read as
 * the defect itself.
 */
const NORMALIZER = NORMALIZER_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Every field's observed source key, across the whole corpus. */
function sourcesFor(field) {
  const seen = new Set()
  for (const record of Object.values(provenance)) {
    const key = record[field]
    if (key !== undefined && key !== null) seen.add(key)
  }
  return seen
}

// ---- 1. no shape-based guessing ------------------------------------------------------------------

describe('1. the normalizer never guesses a field from a matching shape', () => {
  it('contains no fallbackScan, in any form', () => {
    // The single mechanism the audit traced 122 of 391 wrong content renders to: "no named source
    // matched, so take the first key in the fixture whose SHAPE fits".
    expect(NORMALIZER).not.toContain('fallbackScan')
  })

  it('records a provenance entry for every canonical field it decides about', () => {
    // A field that resolved without recording where from is a field nothing can audit.
    expect(Object.keys(provenance)).toHaveLength(dataset.length)
    for (const d of dataset) {
      expect(provenance[d.proposal_id], `${d.proposal_id} has no provenance`).toBeTruthy()
    }
  })

  it('emits no canonical business field without a recorded source', () => {
    const CONTAINERS = ['proposal', 'execution', 'totals', 'guardrails']
    const orphans = []
    for (const d of dataset) {
      const record = provenance[d.proposal_id] ?? {}
      for (const container of CONTAINERS) {
        for (const key of Object.keys(d[container] ?? {})) {
          const field = `${container}.${key}`
          if (record[field] === undefined) orphans.push(`${d.proposal_id}: ${field}`)
        }
      }
    }
    expect(orphans).toEqual([])
  })
})

// ---- 2. the specific wrong mappings the audit found ----------------------------------------------

describe('2. every canonical field resolves from a real reference source for that concept', () => {
  // The allow-list is the CONTRACT. A source appearing here is a claim that the reference uses that
  // key to mean this field; widening it is a deliberate, reviewed edit, which is exactly what the
  // shape scan removed the need for — and therefore the discipline it destroyed.
  const ALLOWED = {
    narrative: ['adjustSummary', 'approvalNote', 'dialNote', 'headMeta', 'ledgerCopy', 'planLine', 'restNote', 'summaryNote', 'trendNote'],
    status_note: ['footStatus', 'footerStatus'],
    confidence: ['confLabel'],
    mode: ['execLabel'],

    'proposal.trigger': ['opportunity', 'trigger'],
    // Phase 3A folded four more names for the SAME concept into this path (ruling R14): `limits`
    // (S10.6/decide), `capa` (S9.12/decide), `capEffects` (S9.13/decide) and `capacity`
    // (S9.3/analyze). The slot's own note already described them — "the governing targets/limits" —
    // and `policy` was previously picked in reasonProposal only, so decide/analyze screens carrying
    // the concept under a different name lost the rows entirely.
    'proposal.policy': [
      'policy', 'rules', 'slas', 'standards', 'targets', 'terms', 'thresholds',
      'limits', 'capa', 'capEffects', 'capacity', 'floors', 'offerLimits',
    ],
    'proposal.constraints': ['locked', 'protected'],
    'proposal.inputs': ['evidence', 'inputs', 'sources'],
    'proposal.roles': ['clusters', 'cohorts', 'roles'],
    'proposal.agents': ['agents', '(reference pinned strip)'],

    'proposal.primary_insight': ['gridMeta', 'segNote', 'sortNote'],
    'proposal.comparison': ['bars', 'cccTrend', 'concentration', 'detectBars', 'expiryBars', 'launchCosts', 'movement', 'pacing', 'recon', 'sizes', 'sovBars', 'timeline', 'wasteMix'],
    'proposal.distribution': ['ladders', 'points'],
    'proposal.bridge': ['bars'],
    'proposal.coverage': ['bars'],
    // `heatRows` joined in Phase 3A: the classifier never typed it as a heatmapGrid, so the one
    // object in the corpus with a heat grid resolved this path to null.
    'proposal.matrix': ['rfmGrid', 'heatRows'],
    'proposal.detail_rows': ['classifier', 'conflicts', 'desks', 'disposition', 'feed', 'fit', 'flows', 'gaps', 'lanes', 'list', 'queries', 'rows', 'sorts', 'splits', 'weeks'],
    // The second evidence board and the entity list: one-off key names on every screen (the 835-name
    // sprawl), resolved from the ORIGINAL classifier's own table/itemQueue verdict on whatever the
    // claim ledger leaves. Pinned here so the set can only widen by review.
    'proposal.secondary_rows': ['audit', 'basket', 'buckets', 'cannibal', 'capacity', 'ccc', 'clusters', 'conflicts', 'dim', 'gaps', 'library', 'mismatches', 'pools', 'selRows', 'stranded', 'suppression', 'waste'],
    'proposal.entities': ['analogs', 'attribution', 'candidates', 'cards', 'carriers', 'dedupe', 'dims', 'lanes', 'matrix', 'moments', 'roles', 'timeline'],

    'proposal.recommendation_identity': ['slateMeta', 'slateName'],
    'proposal.recommendation': ['heroLine', 'heroTitle'],
    'proposal.recommendation_detail': ['heroBody', 'heroSub', 'tradeoff'],
    'proposal.recommendation_metrics': ['heroMetrics'],
    'proposal.composition': ['moveBar'],
    'proposal.alternatives': ['caps', 'modes', 'offerModes', 'slateTabs', 'slates'],
    'proposal.basis': ['basis', 'ladder'],
    'proposal.next_actions': ['actions', 'routes'],
    'proposal.item_groups': ['groups'],
    'proposal.focus_rows': ['focusRows'],
    'proposal.slate': ['cohorts', 'editorial', 'events', 'exits', 'fixes', 'gates', 'items', 'lanes', 'levers', 'offerRows', 'options', 'repairs', 'sampled', 'skus', 'slate', 'suppliers'],

    'guardrails.checks': ['checks', 'guardParts'],
    'guardrails.verdict': ['blocked', 'canApprove'],
    'totals.rows': ['liveStats', 'rollup', 'summary', 'totals'],

    'execution.plan': ['phases', 'stages', 'steps', 'chain', 'changes', 'comms', 'orders', 'pushes', 'spawned'],
    'execution.progress_pct': ['progressPct'],
    'execution.progress_rows': ['healthRows', 'progressRows', 'pushRows'],
    'execution.verification': ['clauseRows', 'monitors', 'reads'],
    'execution.targets': ['coverRows', 'dests', 'orders', 'tray'],
    'execution.rollback': ['rollback', 'revertTargets'],
    'execution.rollback_note': ['rbCopy', 'rbHint'],
    'execution.ledger': ['annotations', 'ledger'],
    'execution.ledger_note': ['expiryCopy', 'ledgerCopy'],
    'execution.flags': ['flags'],
    'execution.arming': ['adjustFoot', 'armCopy'],
    'execution.bulk_note': ['allNote'],
  }

  it.each(Object.entries(ALLOWED))('%s resolves only from its declared reference sources', (field, allowed) => {
    const unexpected = [...sourcesFor(field)].filter((k) => !allowed.includes(k))
    expect(unexpected, `${field} was sourced from ${unexpected.join(', ')}`).toEqual([])
  })

  // The audit's headline findings, pinned individually so a regression names itself.
  it('never sources the recommendation from a button label', () => {
    // `approveLabel` is the CTA's own text ("Approve 41-SKU slate"). It supplied the hero
    // recommendation on 11 of 21 decide screens.
    expect(sourcesFor('proposal.recommendation').has('approveLabel')).toBe(false)
  })

  it('never sources the decision slate from a tab strip, a totals list or a metric row', () => {
    // 16 of 21 slates came from one of these — on the slot `approve_selected` acts on.
    const forbidden = ['totals', 'heroMetrics', 'slateTabs', 'modeTabs', 'sprintTabs', 'tabs', 'ticks', 'notches', 'impact', 'parts', 'gates?', 'checks']
    const used = sourcesFor('proposal.slate')
    for (const key of forbidden) expect(used.has(key), `slate sourced from "${key}"`).toBe(false)
  })

  it('never sources the execution targets from the verification monitors', () => {
    // 14 of 14 target lists were the monitors list, so both slots rendered the same content.
    expect(sourcesFor('execution.targets').has('monitors')).toBe(false)
  })

  it('never sources the reason-stage roles taxonomy from the agent roster', () => {
    // A persona/role is a cohort of entities; an agent is a model. 10 of 14 `roles` were `agents`.
    expect(sourcesFor('proposal.roles').has('agents')).toBe(false)
  })

  it('never sources the analysis finding from the shell identity strip', () => {
    expect(sourcesFor('proposal.primary_insight').has('pinnedSub')).toBe(false)
  })

  it('never sources the governing policy from a headline or a metrics strip', () => {
    for (const key of ['headline', 'metrics', 'setup', 'surfaces', 'events', 'postures']) {
      expect(sourcesFor('proposal.policy').has(key), `policy sourced from "${key}"`).toBe(false)
    }
  })
})

// ---- 3. no duplicate content ---------------------------------------------------------------------

describe('3. no two slots on one screen render the same value', () => {
  it('assigns each raw reference key to at most one canonical field, per record', () => {
    const collisions = []
    for (const [id, record] of Object.entries(provenance)) {
      const byKey = new Map()
      for (const [field, key] of Object.entries(record)) {
        if (key === null || key.startsWith('(')) continue // derived/reference-context sources
        if (byKey.has(key)) collisions.push(`${id}: "${key}" supplies both ${byKey.get(key)} and ${field}`)
        byKey.set(key, field)
      }
    }
    expect(collisions).toEqual([])
  })

  it('renders no value into two slots of the same screen', () => {
    // The audit counted 41 such incidents — `execution_targets` == `verification` on 12 screens,
    // `narrative` == `primary_insight` on 9, `recommendation_metrics` == `slate_summary` on 3.
    const duplicates = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) continue
      const seen = new Map()
      for (const block of resolved.manifest.blocks) {
        if (block.when !== undefined && !evaluateCondition(block.when, d)) continue
        const value = resolveBinding(block.binding, d)
        if (value === undefined) continue
        // Short scalars (an enum token, a mode) legitimately repeat; real content must not.
        if (typeof value === 'string' && value.length < 12) continue
        const key = JSON.stringify(value)
        if (seen.has(key)) duplicates.push(`${d.proposal_id}: ${seen.get(key)} == ${block.slotName}`)
        else seen.set(key, block.slotName)
      }
    }
    expect(duplicates).toEqual([])
  })
})

// ---- 4. no synthesised business values ------------------------------------------------------------

describe('4. no synthesised axis silently overrides reference evidence', () => {
  it('derives no axis from a hash of the story code', () => {
    expect(NORMALIZER).not.toMatch(/hashOf|hash\s*%/)
    expect(NORMALIZER).not.toMatch(/LENSES\[|PERSONAS\[|ENTITLEMENTS\[|MODES\[|CONTRACT_CLASSES\[/)
  })

  it('does not hard-code cardinality', () => {
    // The literal defect: `isObjArray(...) ? 'many' : 'many'`.
    expect(NORMALIZER).not.toMatch(/\?\s*'many'\s*:\s*'many'/)
  })

  it('reads lens, persona and mode from the reference itself, on every record', () => {
    for (const d of dataset) {
      const record = provenance[d.proposal_id]
      expect(record.lens, `${d.proposal_id}.lens`).toMatch(/^\(reference/)
      expect(record.persona, `${d.proposal_id}.persona`).toMatch(/^\(reference/)
      expect(record.mode, `${d.proposal_id}.mode`).toBe('execLabel')
    }
  })

  it('derives cardinality from the proposal, and both values actually occur', () => {
    const values = new Set(dataset.map((d) => d.cardinality))
    expect([...values].sort()).toEqual(['many', 'one'])
    for (const d of dataset) {
      expect(provenance[d.proposal_id].cardinality).toMatch(/^\(derived/)
    }
  })

  it('never fabricates a rollback', () => {
    // 21 of 21 execute screens previously carried a hard-coded
    // `[{label: 'Rollback', value: 'Available for 24 hours'}]` while all 8 real ones were rejected.
    expect(NORMALIZER).not.toContain('Available for 24 hours')
    for (const d of dataset) {
      const rollback = d.execution?.rollback
      if (rollback === undefined) continue
      expect(provenance[d.proposal_id]['execution.rollback'], `${d.proposal_id}`).toBe('rollback')
    }
    expect(dataset.filter((d) => d.execution?.rollback).length).toBeGreaterThan(0)
  })

  it('states impact as null and derives deadline from the reference, inventing neither', () => {
    // WAS "omits impact and deadline rather than inventing them", and its last line asserted
    // `on_clock === false` on all 105 — which pinned the degenerate clock axis in place. That
    // assertion was the defect, not the guard: a declared axis that is constant is the `execLabel`
    // failure the contract's own header warns about. Phase 2 (ruling R3) derives the clock from the
    // reference's own `due`/`deadline` strings, so what this now protects is the honest version of
    // the same rule — nothing is invented, and nothing is flattened to a constant either.
    for (const d of dataset) {
      // Phase 2 made `impact` required-and-nullable and left it `null` on 105/105, which said "the
      // reference states no figure" out loud instead of by omission. Phase 4 Part 1 (R37) fills all
      // 105 on the product owner's decision, so nullness can no longer carry the guarantee — and the
      // guarantee itself is unchanged, because it was never about the value. It was about the CLAIM.
      // The marker carries it now: this file's subject is fidelity, and a field whose provenance says
      // '(placeholder)' overrides no reference evidence, because it claims none.
      expect(d, `${d.proposal_id}.impact`).toHaveProperty('impact')
      expect(provenance[d.proposal_id].impact, `${d.proposal_id}.impact provenance`).toBe('(placeholder)')
      // Phase 2 populates `deadline` from the reference's own `due`/`deadline` strings (ruling R3),
      // so "never invented" no longer means "never present". The rule that still holds, and is
      // asserted instead: a deadline exists if and only if the story states one, and it is an ISO
      // instant rather than the reference's relative copy.
      if (d.on_clock === true) {
        expect(typeof d.deadline, `${d.proposal_id}.deadline`).toBe('string')
        expect(Number.isNaN(Date.parse(d.deadline)), `${d.proposal_id}.deadline`).toBe(false)
      } else {
        expect(d.deadline, `${d.proposal_id}.deadline`).toBeUndefined()
      }
    }

    // The axis is real in both directions: 28 objects on a clock, and the two that state "not
    // booked" / "not sent" still say so.
    expect(dataset.filter((d) => d.on_clock === true).length).toBeGreaterThanOrEqual(10)
    expect(dataset.filter((d) => d.on_clock === false).length).toBeGreaterThanOrEqual(1)
  })
})

// ---- 5. slot/block/data integrity -----------------------------------------------------------------

describe('5. every canonical slot has a real block and real data', () => {
  it('maps every template slot to a registered block component', () => {
    for (const [id, spec] of Object.entries(SLOT_VOCABULARY)) {
      expect(BLOCK_REGISTRY[spec.blockType], `slot "${id}" -> "${spec.blockType}"`).toBeTruthy()
    }
  })

  it('leaves no template section declared but permanently unfillable', () => {
    const empty = []
    for (const [id, template] of Object.entries(
      Object.fromEntries(['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1'].map((t) => [
        t,
        JSON.parse(fs.readFileSync(path.join(REPO_ROOT, `src/features/action-stories/templates/${t}.json`), 'utf8')),
      ])),
    )) {
      const targeted = new Set(template.blocks.map((b) => b.section))
      for (const section of template.sections) {
        if (!targeted.has(section.id)) empty.push(`${id}#${section.id}`)
      }
    }
    expect(empty).toEqual([])
  })

  it('renders every record with no unresolved binding and no shape violation', () => {
    const failures = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      expect(resolved, `${d.proposal_id} selects no template`).toBeTruthy()
      for (const block of resolved.manifest.blocks) {
        if (block.when !== undefined && !evaluateCondition(block.when, d)) continue
        const value = resolveBinding(block.binding, d)
        if (value === undefined) {
          failures.push(`${d.proposal_id}: "${block.slotName}" resolved to nothing`)
          continue
        }
        const problems = validateBlockData(block.blockType, value)
        if (problems.length) failures.push(`${d.proposal_id}: "${block.slotName}" ${problems[0]}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('selects a canonical template for all 105 records', () => {
    expect(dataset.filter((d) => selectTemplate(d) === null)).toEqual([])
  })
})

// ---- 6. action safety ------------------------------------------------------------------------------

describe('6. only real decision items are selectable', () => {
  const decideTemplate = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/templates/decide.slate.v1.json'), 'utf8'),
  )

  it('marks exactly one block selectable, and it is the slate', () => {
    const selectable = decideTemplate.blocks.filter((b) => b.selectable === true)
    expect(selectable.map((b) => b.slotName)).toEqual(['slate'])
  })

  it('never offers a slate that is not a real item collection', () => {
    // This is the integrity hazard, not a cosmetic one: `approve_selected` writes whatever rows the
    // operator ticked, and 16 of 21 slates were tab strips, tick arrays or totals lists.
    for (const d of dataset.filter((x) => x.stage === 'decide')) {
      const slate = d.proposal?.slate
      if (slate === undefined) continue
      expect(Array.isArray(slate), `${d.proposal_id}`).toBe(true)
      // Every row must identify an item, not a label on a chart axis.
      for (const row of slate) {
        const hasIdentity = ['name', 'label', 'title', 'sku', 'id', 'segment'].some((k) => typeof row?.[k] === 'string')
        expect(hasIdentity, `${d.proposal_id}: slate row without an item identity: ${JSON.stringify(row).slice(0, 90)}`).toBe(true)
      }
    }
  })

  it('offers approve_selected only where the proposal really has many items', () => {
    for (const d of dataset) {
      if (d.eligibility.approve_selected.allowed) expect(d.cardinality, d.proposal_id).toBe('many')
    }
  })
})

// ---- 7. the Recommendation section ----------------------------------------------------------------

describe('7. Recommendation renders as six semantic slots from six distinct sources', () => {
  const UNITS = [
    ['recommendation_identity', 'proposal.recommendation_identity'],
    ['recommendation', 'proposal.recommendation'],
    ['recommendation_detail', 'proposal.recommendation_detail'],
    ['recommendation_metrics', 'proposal.recommendation_metrics'],
    ['composition', 'proposal.composition'],
    ['basis', 'proposal.basis'],
  ]

  const decideTemplate = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/templates/decide.slate.v1.json'), 'utf8'),
  )

  it.each(UNITS)('declares "%s" as its own canonical slot bound to %s', (slot, binding) => {
    const block = decideTemplate.blocks.find((b) => b.slotName === slot)
    expect(block, `decide.slate.v1 has no "${slot}" slot`).toBeTruthy()
    expect(block.binding).toBe(binding)
    expect(SLOT_VOCABULARY[slot].binding).toBe(binding)
  })

  it('renders all six on the reference screen the audit traced (S9.1 decide)', () => {
    const s91 = dataset.find((d) => d.proposal_id === 'prop_s9_1_decide')
    expect(s91.proposal.recommendation_identity).toBe('Balanced')
    expect(s91.proposal.recommendation).toContain('Keep 162')
    expect(s91.proposal.recommendation_detail).toContain('Grow the proven')
    // The metrics keep their P10-P90 range and their caveat note — the fields most easily lost.
    expect(s91.proposal.recommendation_metrics[0]).toMatchObject({ label: '90-day revenue', range: '+$17K to +$66K' })
    expect(s91.proposal.recommendation_metrics[0].note).toBeTruthy()
    // The composition bar, normalised so the EXISTING barChart block carries it.
    expect(s91.proposal.composition).toEqual([
      { label: 'Keep', value: 162 },
      { label: 'Grow', value: 18 },
      { label: 'Reduce', value: 22 },
      { label: 'Exit', value: 12 },
      { label: 'Gap fill', value: 4 },
    ])
    expect(s91.proposal.basis).toHaveLength(4)
    // …and the confidence is the reference's own 78%, not a hash.
    expect(s91.confidence.value).toBe(0.78)
  })

  it('renders the reference item groups and their drill-down, not a stand-in', () => {
    const s91 = dataset.find((d) => d.proposal_id === 'prop_s9_1_decide')
    expect(s91.proposal.item_groups.map((g) => g.tag)).toEqual(['grow', 'reduce', 'exit', 'gap fill'])
    expect(s91.proposal.focus_rows[0].name).toBe('Bamboo canister 1.2L')
  })
})

// ---- 8. previously-unreachable blocks --------------------------------------------------------------

describe('8. registered blocks are either reachable or documented as unused', () => {
  const templates = ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1'].map((t) =>
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, `src/features/action-stories/templates/${t}.json`), 'utf8')),
  )
  const reachable = new Set(templates.flatMap((t) => t.blocks.map((b) => b.blockType)))

  it('wires the four blocks the audit found registered but unreachable', () => {
    for (const blockType of ['waterfallChart', 'gauge', 'heatmapGrid', 'itemQueue']) {
      expect(reachable.has(blockType), `"${blockType}" is still unreachable`).toBe(true)
    }
  })

  it('leaves exactly the documented unused blocks unused', () => {
    // `flag`  — the only boolean slot was `confidence.calibrated`, now rendered by ProposalHeader.
    // `object`— no reference concept is a lone nested descriptor; every one is a list or a scalar.
    // `slider`— the reference's interactive controls recompute figures the backend owns; wiring one
    //           would mean shipping precomputed answers as business data. Documented, not deleted.
    const unused = Object.keys(BLOCK_REGISTRY).filter((b) => !reachable.has(b)).sort()
    expect(unused).toEqual(['flag', 'object', 'slider'])
  })
})
