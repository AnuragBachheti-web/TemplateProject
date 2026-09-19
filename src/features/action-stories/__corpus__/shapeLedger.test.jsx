// @vitest-environment jsdom
//
// Phase 5A, T53-T61: CLAIM ROUTING, measured by shape rather than by name.
//
// Every prior phase asked whether a canonical field was filled from the right-NAMED reference key.
// referenceFidelity.test.js pins 60 of those mappings and they are all correct. None of them asks
// the next question: does the slot that field lands on actually RENDER what the value carries?
//
// It does not, on 30 of 105 objects. S9.11's `opportunity` — `{label, value, pct, meta}` — was
// claimed into `proposal.trigger`, whose block reads `{when, what}`, and rendered as four bare
// labels. `heroMetrics.range`, the P10-P90 interval, is asserted byte-for-byte by a passing test in
// referenceFidelity.test.js and has never reached a pixel. That is the failure mode this file
// exists for: a green test standing guard over a field no operator can see (ruling R54).
//
// The rulings these tests encode:
//   R48  a wrong rendering that passes a shape test is worse than an unrendered one. Five claims
//        are WITHDRAWN rather than re-pointed at a block that would mark them resolved.
//   R51  a dropped field is IGNORED (with one of three stated reasons), DEFERRED (with the shape it
//        needs), or it is a defect. There is no fourth answer.
//   R53  `heroMetrics.range` is DEFERRED, NOT CLOSED — re-pointing its slot at labelValueList to
//        render one field would undo Phase 3B's flatten fix and Phase 3C's metric grid.
//   R55  a claim that renders rows with no identity at all is misrouted however little it drops.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import dataset from './normalized/dataset.json'
import provenance from './normalized/provenance.json'
import {
  buildLedger, classifyDroppedField, claimedRawKeys, deferredUnroutedKeys,
  IGNORE_LIST, IGNORE_CATEGORIES, DEFERRED_SHAPES, DATA_TEST_ASSERTED_FIELDS,
  PHASE_5A_ROUTING_CHANGES,
} from './shapeLedger'
import { CONSUMED_FIELDS, consumedFieldsOf, droppedFieldsOfValue } from '../blocks/consumedFields'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { resolveTemplate } from '../templates/templateRegistry'
import { resolveBinding } from '../manifests/resolveBinding'
import { evaluateCondition } from '../manifests/actionCondition'
import { validateBlockData } from '../manifests/blockTypes'
import { BLOCK_REGISTRY } from '../blocks'
import StageRenderer from '../components/StageRenderer'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const byId = (id) => dataset.find((d) => d.proposal_id === id)
const LEDGER = buildLedger(dataset, provenance, resolveTemplate)

// The same real-render harness blocks/slotCorrections.test.jsx uses — createRoot + act, not a
// testing-library import this project does not carry. Several assertions below are about PIXELS
// ("is this value on the page"), which is the whole point: a data assertion is what missed
// `recommendation_metrics.range` for three phases.
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
  return { container, templateId: resolved.templateId }
}

function unmount() {
  if (root) act(() => root.unmount())
  container?.remove()
  root = undefined
  container = undefined
}

afterEach(unmount)

// ---- T53 -----------------------------------------------------------------------------------------

describe('T53 — the shape ledger runs over all 105 and reports zero MISROUTED claims', () => {
  it('measures a non-trivial ledger, so this cannot pass vacuously', () => {
    expect(dataset).toHaveLength(105)
    expect(LEDGER.length).toBeGreaterThan(500)
    // Every one of the five block render modes is exercised, so "zero misrouted" is not an artefact
    // of only open blocks being reached.
    const closed = LEDGER.filter((e) => e.renderMode === 'closed')
    expect(closed.length, 'no claim lands on a closed block — the ledger is not measuring').toBeGreaterThan(80)
  })

  it('reports zero MISROUTED claims across all 105 objects', () => {
    const misrouted = LEDGER.filter((e) => e.outcome === 'MISROUTED').map((e) => {
      const unaccounted = e.dropped.filter((d) => d.outcome === 'MISROUTED').map((d) => d.field)
      const why = [
        unaccounted.length > 0 ? `drops ${unaccounted.join('/')}` : null,
        e.anonymousRows > 0 ? `${e.anonymousRows} row(s) render with no identity` : null,
      ].filter(Boolean).join('; ')
      return `${e.proposalId}: "${e.rawKey}" -> ${e.canonicalPath} [${e.slotName}/${e.blockType}] ${why}`
    })
    expect(misrouted, 'a claimed value carries fields its destination block never renders').toEqual([])
  })

  it('still reports DEFERRED claims — a zero here would mean G had been quietly emptied', () => {
    // R53. `heroMetrics.range` and its kin are deferred, not closed. If this ever reaches zero
    // without DEFERRED_SHAPES shrinking for a stated reason, something absorbed the loss silently.
    expect(LEDGER.filter((e) => e.outcome === 'DEFERRED').length).toBeGreaterThan(0)
  })
})

// ---- T54 -----------------------------------------------------------------------------------------

describe('T54 — no block silently drops a field', () => {
  it('lists every field dropped at render, per slot, across all 105, and accounts for each', () => {
    const unaccounted = []
    for (const entry of LEDGER) {
      for (const drop of entry.dropped) {
        if (drop.outcome === 'IGNORED' || drop.outcome === 'DEFERRED') continue
        unaccounted.push(
          `${entry.proposalId}: ${entry.slotName}[${entry.blockType}] drops "${drop.field}" `
          + `(claimed from "${entry.rawKey}") with no ignore-list entry and no deferred shape`,
        )
      }
    }
    expect(unaccounted, 'a dropped field belongs on the ignore-list with a reason, or in G with a shape').toEqual([])
  })

  it('every ignore-list entry states one of the three admissible categories and a real reason', () => {
    expect(Object.keys(IGNORE_LIST).length).toBeGreaterThan(0)
    for (const [key, entry] of Object.entries(IGNORE_LIST)) {
      expect(IGNORE_CATEGORIES, `${key} category`).toContain(entry.category)
      expect(entry.reason?.length ?? 0, `${key} has no stated reason`).toBeGreaterThan(40)
      const [blockType] = key.split('.')
      expect(CONSUMED_FIELDS[blockType], `${key} names an unknown blockType`).toBeTruthy()
    }
  })

  it('carries no ignore-list entry that nothing actually drops', () => {
    // An ignore-list is a record of decisions taken about real data. An entry no claim exercises is
    // a permission granted in advance, which is how the list stops being reviewable.
    const exercised = new Set(
      LEDGER.flatMap((e) => e.dropped.filter((d) => d.outcome === 'IGNORED').map((d) => `${e.blockType}.${d.field}`)),
    )
    const unused = Object.keys(IGNORE_LIST).filter((k) => !exercised.has(k))
    expect(unused, 'ignore-list entries that no claim in the corpus exercises').toEqual([])
  })

  it('every deferred shape names its fields, its object count and whether it is a variant', () => {
    expect(DEFERRED_SHAPES.length).toBeGreaterThan(0)
    for (const shape of DEFERRED_SHAPES) {
      expect(shape.id, 'a deferred shape with no id').toBeTruthy()
      expect(shape.shape?.length ?? 0, `${shape.id} states no required shape`).toBeGreaterThan(30)
      expect(shape.evidence?.length ?? 0, `${shape.id} cites no evidence`).toBeGreaterThan(40)
      // R57: whether 5B is building a variant or a new block is the fact it is scoped from.
      expect(typeof shape.kind, `${shape.id} does not say variant or new block`).toBe('string')
      expect(shape.objects, `${shape.id} object count`).toBeGreaterThan(0)
      const deferring = shape.fields.length + shape.unroutedKeys.length + (shape.anonymousClaims?.length ?? 0)
      expect(deferring, `${shape.id} defers nothing`).toBeGreaterThan(0)
    }
  })

  it('every anonymous-row deferral is exercised by a real claim', () => {
    // The same guard as the unused-ignore-entry test above, for the second escape hatch: an
    // `anonymousClaims` entry nobody hits is permission granted in advance.
    const exercised = new Set(
      LEDGER.filter((e) => e.anonymityDeferred).map((e) => `${e.rawKey}@${e.proposalId}`),
    )
    const declared = DEFERRED_SHAPES.flatMap((s) => s.anonymousClaims ?? [])
    expect(declared.filter((c) => !exercised.has(c)), 'anonymous-row deferrals no claim exercises').toEqual([])
  })
})

// ---- T55 -----------------------------------------------------------------------------------------

describe('T55 — opportunity is CORRECTLY DEFERRED, not rendered (R48)', () => {
  // AMENDED FROM THE ORIGINAL BRIEF, on ruling R48. The brief asked this test to assert that
  // `opportunity` renders its value, pct and meta. It cannot, and landing it somewhere it would was
  // the wrong fix: StatListBlock renders `meta ?? detail ?? note ?? pct` — exactly one — so every
  // statList destination drops `pct`, and the only lossless existing block is `table`, which would
  // render a table where the reference renders a metric list with a progress bar and mark the
  // misrouting resolved. So the assertion is that it is deferred honestly: claimed by nothing,
  // rendered nowhere, and present in G with the shape it needs.

  it('is claimed by no canonical field, on any object', () => {
    const offenders = []
    for (const [id, record] of Object.entries(provenance)) {
      for (const [field, key] of Object.entries(record)) {
        if (key === 'opportunity') offenders.push(`${id}: ${field} <- opportunity`)
      }
    }
    expect(offenders, 'opportunity is still claimed — R48 withdraws it').toEqual([])
  })

  it('renders nowhere: prop_s9_11_reason has no trigger, and no block shows its rows', () => {
    const d = byId('prop_s9_11_reason')
    expect(d.proposal.trigger, 'proposal.trigger is still populated on S9.11 reason').toBeUndefined()
    const out = renderPane(d)
    expect(out.container.querySelector('[data-block-type="timeline"]')).toBeNull()
    expect(out.container.textContent).not.toContain('Safe CM opportunity')
  })

  it('appears in G with a stated required shape covering value, pct and meta together', () => {
    const shape = DEFERRED_SHAPES.find((s) => s.unroutedKeys.includes('opportunity'))
    expect(shape, 'opportunity is not in G — deferred means recorded, not forgotten').toBeTruthy()
    for (const field of ['value', 'pct', 'meta']) {
      expect(shape.shape + shape.evidence, `G does not say opportunity needs ${field}`).toContain(field)
    }
    expect(shape.kind).toBe('variant')
    expect(shape.of).toBe('statList')
  })
})

// ---- T56 -----------------------------------------------------------------------------------------

describe('T56 — cohorts renders on the objects that carry it', () => {
  // This was GREEN on arrival and is kept as a regression fence, not as a fix. The brief listed
  // `cohorts` as claimed by nothing; the Phase 5A survey found Phase 3A's ruling R14 had already
  // closed it — `proposal.roles`'s candidate list is ['roles', 'cohorts', 'clusters'] and reason.v1
  // renders that slot as a `table`, which is an OPEN block and therefore drops nothing. What this
  // pins is that a future re-route cannot move it onto a closed block and lose five of its six
  // fields without failing here.
  const carriers = dataset.filter((d) => provenance[d.proposal_id]?.['proposal.roles'] === 'cohorts')

  it('finds the objects the reference supplies cohorts on', () => {
    expect(carriers.length, 'no object claims roles from cohorts').toBeGreaterThan(0)
  })

  it.each(carriers.map((d) => [d.proposal_id]))('%s renders every cohort field', (id) => {
    const d = byId(id)
    const out = renderPane(d)
    const text = out.container.textContent
    for (const row of d.proposal.roles) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value !== 'string') continue
        expect(text, `${id}: cohort field "${key}" = "${value}" is not on the page`).toContain(value)
      }
    }
  })
})

// ---- T57 -----------------------------------------------------------------------------------------

describe('T57 — no newly claimed or newly rendered key carries a presentation field (I4)', () => {
  // The boundary is Phase 2's T10 and it holds corpus-wide. What this asserts is the specific risk
  // THIS phase introduces: a slot that now renders for the first time, or a claim the gate moved,
  // bringing a presentation sibling across with it. `cohorts` names the exact hazard the brief
  // called out — evTint, evTone, prefTint, prefTone, prefIcon on every one of its four rows.
  const NEWLY_RENDERED_PATHS = ['proposal.threshold_control', 'proposal.roles']
  const FORBIDDEN_KEY = /^(tone|tint|hue|bg|fg|fill|stroke|icon|glyph|border|shadow|opacity|colou?r|className|ev[A-Z]|pref(Tint|Tone|Icon))/
  const FORBIDDEN_VALUE = /var\(--|color-mix\(|^#[0-9a-f]{3,8}$|\bfa-[a-z-]{3,}\b/i

  const rows = []
  for (const d of dataset) {
    for (const path of NEWLY_RENDERED_PATHS) {
      const value = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d)
      if (value === undefined) continue
      for (const row of Array.isArray(value) ? value : [value]) {
        if (row !== null && typeof row === 'object') rows.push({ id: d.proposal_id, path, row })
      }
    }
  }

  it('finds rows to check', () => {
    expect(rows.length, 'nothing newly rendered — T57 would pass vacuously').toBeGreaterThan(0)
  })

  it('carries no presentation key', () => {
    const offenders = rows.flatMap(({ id, path, row }) =>
      Object.keys(row).filter((k) => FORBIDDEN_KEY.test(k)).map((k) => `${id}.${path}: ${k}`))
    expect(offenders).toEqual([])
  })

  it('carries no presentation value', () => {
    const offenders = rows.flatMap(({ id, path, row }) =>
      Object.entries(row)
        .filter(([, v]) => typeof v === 'string' && FORBIDDEN_VALUE.test(v))
        .map(([k, v]) => `${id}.${path}: ${k}=${JSON.stringify(v)}`))
    expect(offenders).toEqual([])
  })
})

// ---- T58 -----------------------------------------------------------------------------------------

describe('T58 — R31 is REPLACED, not deleted: the defect it pinned is fixed', () => {
  // WHAT R31 WAS. In Phase 3C I found that prop_s9_11_reason's `proposal.trigger` was sourced from
  // `opportunity` and carried {label, value, pct, meta} — a metric shape in a chronology slot — and
  // ruled "render 15, report 1": TimelineBlock would not branch on row shape to cope with it, and
  // slotCorrections.test.jsx's T34 pinned the resulting render (rows by label, no eyebrow) so the
  // claim-ledger defect stayed visible instead of being absorbed by the renderer.
  //
  // That pin was correct for a phase that froze the corpus, and it is wrong now: the claim ledger
  // is exactly what Phase 5A fixes. R48 withdraws the claim rather than re-pointing it, so the
  // assertion inverts — the block does not render those rows because the slot is no longer filled,
  // and `opportunity` is accounted for in G instead of being rendered wrongly.

  it('no longer sources proposal.trigger from opportunity, on any object', () => {
    const sources = new Set(Object.values(provenance).map((r) => r['proposal.trigger']).filter(Boolean))
    expect([...sources], 'trigger still claims opportunity').toEqual(['trigger'])
  })

  it('prop_s9_11_reason renders no timeline block at all, where R31 pinned four bare labels', () => {
    const d = byId('prop_s9_11_reason')
    const out = renderPane(d)
    expect(out.container.querySelector('[data-block-type="timeline"]')).toBeNull()
  })

  it('every object that still declares a trigger carries a real chronology', () => {
    // The other side of "render 15, report 1": the 14 genuine triggers are untouched.
    const withTrigger = dataset.filter((d) => d.proposal?.trigger !== undefined)
    expect(withTrigger.length).toBe(14)
    for (const d of withTrigger) {
      for (const row of d.proposal.trigger) {
        const hasBody = ['what', 'rule', 'label', 'name', 'text'].some((k) => typeof row[k] === 'string')
        expect(hasBody, `${d.proposal_id}: a trigger row with no description`).toBe(true)
        expect(droppedFieldsOfValue('timeline', [row]).filter(
          (f) => classifyDroppedField('timeline', f, [row]).outcome === 'MISROUTED',
        ), `${d.proposal_id}: trigger row loses a field`).toEqual([])
      }
    }
  })
})

// ---- the corpus diff, pinned by content ------------------------------------------------------------

describe('the routing changes are exactly the seven declared, and no others', () => {
  // REPLACES the `git diff --name-only` freeze pins Phase 3B (T31) and Phase 3C (T37) carried. Those
  // asserted "this phase changes no corpus file" — true of them, false of this one by design, and in
  // any case they could only fail on an uncommitted tree, so they went quiet the moment a phase
  // landed. This pins the same thing by CONTENT, which survives the commit.

  it.each(PHASE_5A_ROUTING_CHANGES.map((c) => [`${c.proposalId} ${c.path}`, c]))(
    '%s moved off its old key exactly as declared',
    (label, change) => {
      expect(provenance[change.proposalId]?.[change.path], `${label} provenance`).toBe(change.to)
      expect(change.why.length, `${label} states no reason`).toBeGreaterThan(40)
    },
  )

  it('withdraws six claims and lets four fall through to the next candidate', () => {
    const withdrawn = PHASE_5A_ROUTING_CHANGES.filter((c) => c.to === null)
    const fellThrough = PHASE_5A_ROUTING_CHANGES.filter((c) => c.to !== null)
    // Six claims withdrawn: three leave their slot empty, and four of the barChart rejections find a
    // better-named candidate further down the SAME list — no key was re-pointed by hand.
    expect(withdrawn).toHaveLength(3)
    expect(fellThrough).toHaveLength(4)
    for (const c of fellThrough) {
      expect(claimedRawKeys(provenance).has(c.to), `${c.to} is not claimed anywhere`).toBe(true)
    }
  })

  it('leaves every withdrawn key claimed by nothing, at the scope G declares', () => {
    const claimed = claimedRawKeys(provenance)
    const all = DEFERRED_SHAPES.flatMap((s) => s.unroutedKeys)
    expect(all.length, 'G lists no unrouted key').toBeGreaterThan(0)

    // An UNQUALIFIED entry claims the key is dead corpus-wide.
    const wholesale = all.filter((k) => !k.includes('@'))
    expect(wholesale.filter((k) => claimed.has(k)), 'a key G calls unrouted is still claimed').toEqual([])

    // An @object-QUALIFIED entry claims it only on that object, because the same raw key name means
    // different things on different screens — `bars` is a bridge on S10.1 and a pixel strip on
    // S9.15, `timeline` is an entity list on S10.1 and a date axis on S10.6. Asserting the
    // unqualified form for those would be asserting something false.
    const qualified = all.filter((k) => k.includes('@')).map((k) => k.split('@'))
    const stillClaimed = qualified.filter(([key, id]) => Object.values(provenance[id] ?? {}).includes(key))
    expect(stillClaimed.map((p) => p.join('@')), 'an object-scoped withdrawal did not take').toEqual([])
    expect(deferredUnroutedKeys().length).toBe(all.length)
  })
})

// ---- T59 -----------------------------------------------------------------------------------------

describe('T59 — Phase 2 T10, Phase 3A T20/T21 and Phase 4 boundary checks still hold', () => {
  // Those files run over the same dataset and this does not restate them. What it asserts is that
  // THIS phase's edits did not reopen what they closed — the gate changes which keys are claimed,
  // and a newly admitted key is exactly how geometry or a placeholder marker would re-enter.
  const KEYS_IN_CORPUS = new Set()
  ;(function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v !== null && typeof v === 'object') for (const [k, sub] of Object.entries(v)) { KEYS_IN_CORPUS.add(k); walk(sub) }
  })(dataset)

  it('T20 — no geometry key re-entered the corpus through a re-routed claim', () => {
    const GEOMETRY = ['floorPct', 'nowPct', 'targetPct', 'markPct', 'lowPct', 'widthPct', 'ourPct',
      'bandWidth', 'barWidth', 'pctFrom', 'pctTo', 'fromPct', 'toPct', 'targetY', 'targetX', 'width']
    expect(GEOMETRY.filter((k) => KEYS_IN_CORPUS.has(k))).toEqual([])
  })

  it('T10/T21 — no presentation key or CSS value anywhere in the shipped corpus', () => {
    const FORBIDDEN = /^(colou?r|tone|tint|hue|icon|glyph|show|hidden|visible|className|css|style|bg|fg|fill|stroke|shadow|opacity|border|radius|dot|glow)$/i
    expect([...KEYS_IN_CORPUS].filter((k) => FORBIDDEN.test(k))).toEqual([])
    const cssValues = []
    ;(function walk(v, path) {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`))
      if (v !== null && typeof v === 'object') return Object.entries(v).forEach(([k, s]) => walk(s, `${path}.${k}`))
      if (typeof v === 'string' && /var\(--|color-mix\(/.test(v)) cssValues.push(path)
    })(dataset, '')
    expect(cssValues).toEqual([])
  })

  it('Phase 4 — all 105 still carry the five header fields, and their placeholder markers', () => {
    for (const d of dataset) {
      for (const field of ['impact', 'brand', 'channel', 'category', 'agent']) {
        expect(d, `${d.proposal_id}.${field}`).toHaveProperty(field)
      }
      expect(provenance[d.proposal_id].impact, `${d.proposal_id}.impact provenance`).toBeTruthy()
    }
  })

  it('every canonical field still records where it came from (no claim escapes provenance)', () => {
    const CONTAINERS = ['proposal', 'execution', 'totals', 'guardrails']
    const orphans = []
    for (const d of dataset) {
      const record = provenance[d.proposal_id] ?? {}
      for (const container of CONTAINERS) {
        for (const key of Object.keys(d[container] ?? {})) {
          if (record[`${container}.${key}`] === undefined) orphans.push(`${d.proposal_id}: ${container}.${key}`)
        }
      }
    }
    expect(orphans).toEqual([])
  })
})

// ---- T60 -----------------------------------------------------------------------------------------

describe('T60 — the live path stays green for all 105', () => {
  it('resolves a template, a binding and a valid shape for every rendered block on every object', () => {
    const failures = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      if (!resolved) { failures.push(`${d.proposal_id}: no template`); continue }
      for (const block of resolved.manifest.blocks) {
        if (block.when !== undefined && !evaluateCondition(block.when, d)) continue
        const value = resolveBinding(block.binding, d)
        if (value === undefined) { failures.push(`${d.proposal_id}: "${block.slotName}" resolved to nothing`); continue }
        const problems = validateBlockData(block.blockType, value)
        if (problems.length) failures.push(`${d.proposal_id}: "${block.slotName}" ${problems[0]}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('renders the new threshold_control slot on the one object the reference supplies it', () => {
    // R50. `rlThreshold` was claimed in Phase 3A under R14, is contract-validated by
    // claimedThresholds.test.js T17/T19, and until this phase was rendered by nothing at all —
    // with `slider` registered and unreachable. Leaving it unrendered made that phase's work a lie.
    expect(SLOT_VOCABULARY.threshold_control?.binding).toBe('proposal.threshold_control')
    expect(SLOT_VOCABULARY.threshold_control?.blockType).toBe('slider')
    const d = byId('prop_s9_12_decide')
    const out = renderPane(d)
    const slider = out.container.querySelector('input[type="range"]')
    expect(slider, 'the threshold control renders no slider').toBeTruthy()
    expect(slider.min).toBe('6')
    expect(slider.max).toBe('24')
    expect(slider.value).toBe('14')
  })

  it('leaves exactly the documented unused blocks unused', () => {
    // WAS ['flag', 'object', 'slider'] — `slider` leaves this list because R50 wires it.
    const templates = ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1']
    const reachable = new Set(Object.values(SLOT_VOCABULARY).map((s) => s.blockType))
    expect(templates.length).toBe(5)
    expect(Object.keys(BLOCK_REGISTRY).filter((b) => !reachable.has(b)).sort()).toEqual(['flag', 'object'])
  })
})

// ---- T61 -----------------------------------------------------------------------------------------

describe('T61 — no data test asserts a field that nothing renders (R54)', () => {
  // THE FAILURE MODE THIS PHASE WAS BUILT ON. referenceFidelity.test.js asserts
  // `recommendation_metrics[0]` carries `range: '+$17K to +$66K'`. It has passed since Phase 2.
  // StatListBlock reads `meta ?? detail ?? note ?? pct` and has never rendered `range` on any of the
  // 9 objects that carry it. The test was green, the data was right, and the operator saw a point
  // estimate where the reference shows an interval — and "+$41K" and "+$41K, P10-P90 +$17K to +$66K"
  // support different decisions.
  //
  // A test asserting about an invisible field is worse than no test: it grows confidence while the
  // gap grows with it. So every field a data test claims is present must be either CONSUMED by its
  // slot's block, or DEFERRED in G with the shape it needs. Those are the only two honest states.

  it('checks a real registry', () => {
    expect(DATA_TEST_ASSERTED_FIELDS.length).toBeGreaterThan(5)
    for (const entry of DATA_TEST_ASSERTED_FIELDS) {
      expect(SLOT_VOCABULARY[entry.slot], `registry names unknown slot "${entry.slot}"`).toBeTruthy()
      expect(entry.assertedBy?.length ?? 0, `${entry.slot}.${entry.field} cites no test`).toBeGreaterThan(10)
    }
  })

  it.each(DATA_TEST_ASSERTED_FIELDS.map((e) => [`${e.slot}.${e.field}`, e]))(
    '%s is rendered, or deferred in G with a required shape',
    (label, entry) => {
      const spec = SLOT_VOCABULARY[entry.slot]
      const { blockType } = spec

      // Does the block read it? Probed against every real row in the corpus that carries the field,
      // not against a synthetic one — an alternate-chain field like `note` is only genuinely
      // consumed on the rows where it wins.
      const rows = dataset.flatMap((d) => {
        const value = spec.binding.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d)
        const list = Array.isArray(value) ? value : value !== undefined ? [value] : []
        return list.filter((r) => r !== null && typeof r === 'object' && r[entry.field] !== undefined)
      })
      expect(rows.length, `${label}: no object carries this field — the registry is stale`).toBeGreaterThan(0)

      const consumedSomewhere = rows.some((row) => consumedFieldsOf(blockType, row).includes(entry.field))
      if (consumedSomewhere) return

      const deferred = DEFERRED_SHAPES.find((s) => s.fields.includes(`${blockType}.${entry.field}`))
      expect(
        deferred,
        `${label} is asserted by ${entry.assertedBy} and is rendered by nothing. `
        + `Either ${blockType} must consume it, or it belongs in G with the shape it needs.`,
      ).toBeTruthy()
      expect(deferred.shape.length).toBeGreaterThan(30)
    },
  )
})
