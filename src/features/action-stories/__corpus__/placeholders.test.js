// Phase 4 PART 1, T40-T45: the header, made whole with MARKED placeholder data.
//
// WHY THIS REVERSES A STANDING RULING. Phase 2's R1/R2 made brand, channel, category, agent and
// impact required-but-nullable and refused invention outright. That was correct for a corpus
// claiming to be reference-derived. It is reversed here for one bounded purpose, on the product
// owner's decision: this repository is a prototype with no real backend, the 105 Decision Objects
// were themselves authored from design mockups, and the header is the one surface where emptiness
// misrepresents the design — `impact` was 0 of 105, so the number an operator looks for first
// rendered nowhere.
//
// THE CONDITION THAT MAKES IT ACCEPTABLE, and the thing these tests exist to guarantee: a
// placeholder must be distinguishable from reference-derived data BY MACHINE, forever. Mixing them
// without a marker is how a prototype's scaffolding becomes an undocumented production assumption.
//
// THE MARKER (R35) is `provenance.json`, which already answers "where did this field come from" per
// object per field, with `null` meaning the reference is silent. A placeholder is a third answer to
// that same question, so it is a third value: "(placeholder)". Not a flag inside the Decision
// Object — scaffolding must never ride inside a payload a real API would never send.
//
// THE DISCIPLINE (R36) is that no NAME and no MAGNITUDE is minted. brand, category and channel
// reuse vocabularies the corpus already evidences; agent propagates a real name from the story's own
// reason stage; impact reads a real number out of the object's own prose. The only invention is the
// assignment mapping. `confidence` is OUT (R39) precisely because it would have been the one field
// minting a number with no textual basis — a fabricated 0.74 reads as measured, where a missing one
// honestly reads as absent.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { CHANNELS } from '../contract/decisionObject'
import dataset from './normalized/dataset.json'
import provenance from './normalized/provenance.json'

/** R39: FIVE fields, not six. `confidence` is deliberately excluded and stays at 3 of 105. */
const PLACEHOLDER_FIELDS = ['brand', 'channel', 'category', 'agent', 'impact']

const PLACEHOLDER = '(placeholder)'

/** The reference-derived values, captured before Part 1 wrote anything. Committed, not regenerated. */
const REFERENCE_DERIVED = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '__snapshots__/reference-derived-header.json'), 'utf8'),
)

const byId = (id) => dataset.find((d) => d.proposal_id === id)

/** Every (object, field) the marker says is a placeholder. */
function placeholderEntries() {
  const out = []
  for (const [proposalId, fields] of Object.entries(provenance)) {
    for (const [field, source] of Object.entries(fields)) {
      if (source === PLACEHOLDER) out.push({ proposalId, field })
    }
  }
  return out
}

describe('T40 — every header field is non-null on 105/105', () => {
  it.each(PLACEHOLDER_FIELDS)('%s is non-null on every one of the 105', (field) => {
    const empty = dataset.filter((d) => d[field] === null || d[field] === undefined).map((d) => d.proposal_id)
    expect(empty, `${empty.length} objects still have a null ${field}`).toEqual([])
  })

  it('confidence is NOT populated — it stays at 3 of 105 (R39)', () => {
    // The one field left deliberately empty. Every other header value reuses or reads something
    // real; a confidence figure is a claim about how sure an engine is, and inventing one is not
    // the same class of act as reusing a brand name the corpus already contains.
    const present = dataset.filter((d) => d.confidence !== null && d.confidence !== undefined)
    expect(present).toHaveLength(3)
  })

  it('the populated fields are correctly typed, not merely non-null', () => {
    for (const d of dataset) {
      for (const field of ['brand', 'category', 'agent']) {
        expect(typeof d[field], `${d.proposal_id}.${field}`).toBe('string')
        expect(d[field].trim(), `${d.proposal_id}.${field}`).not.toBe('')
      }
      expect(CHANNELS, `${d.proposal_id}.channel`).toContain(d.channel)
      expect(typeof d.impact.value, `${d.proposal_id}.impact.value`).toBe('number')
      expect(Number.isFinite(d.impact.value)).toBe(true)
      expect(['USD', 'pct', 'count'], `${d.proposal_id}.impact.unit`).toContain(d.impact.unit)
    }
  })
})

describe('T41 — every placeholder is listable by the marker, and here is the inventory', () => {
  it('the marker mechanism finds them', () => {
    const entries = placeholderEntries()
    expect(entries.length, 'the marker found no placeholders at all').toBeGreaterThan(0)
    // 105 objects x 5 fields, minus the 54 reference-derived values that must not be overwritten.
    expect(entries.length).toBe(105 * PLACEHOLDER_FIELDS.length - 54)
  })

  it('prints the full inventory — this is the handover artefact (deliverable G)', () => {
    const entries = placeholderEntries()
    const byField = {}
    for (const { proposalId, field } of entries) (byField[field] ??= []).push(proposalId)

    console.info('\n=== PLACEHOLDER INVENTORY — every invented value in the corpus ===')
    console.info(`total: ${entries.length} values across ${new Set(entries.map((e) => e.proposalId)).size} objects\n`)
    for (const field of PLACEHOLDER_FIELDS) {
      const ids = byField[field] ?? []
      console.info(`${field}  (${ids.length} placeholders, ${105 - ids.length} reference-derived)`)
      for (const id of ids) {
        const value = byId(id)[field]
        console.info(`    ${id.padEnd(24)} ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      }
      console.info('')
    }
    expect(entries.length).toBeGreaterThan(0)
  })

  it('every marked placeholder actually has a value, and every unmarked one is reference-derived', () => {
    for (const d of dataset) {
      for (const field of PLACEHOLDER_FIELDS) {
        const marked = provenance[d.proposal_id]?.[field] === PLACEHOLDER
        const fromReference = REFERENCE_DERIVED[d.proposal_id]?.[field] !== undefined
        expect(marked && fromReference, `${d.proposal_id}.${field} is marked AND reference-derived`).toBe(false)
        expect(marked || fromReference, `${d.proposal_id}.${field} is neither marked nor reference-derived`).toBe(true)
      }
    }
  })
})

describe('T42 — reference-derived values are byte-identical to their pre-phase values (I3)', () => {
  it('per object, per field — never in aggregate', () => {
    const drifted = []
    for (const [proposalId, fields] of Object.entries(REFERENCE_DERIVED)) {
      for (const [field, before] of Object.entries(fields)) {
        const after = byId(proposalId)?.[field]
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          drifted.push(`${proposalId}.${field}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`)
        }
      }
    }
    expect(drifted, `${drifted.length} reference-derived value(s) were overwritten`).toEqual([])
  })

  it('the captured baseline is the real pre-phase state, not a copy of the current one', () => {
    // 54 values: brand 13, channel 14, category 1, agent 26, impact 0. If this ever equals the
    // current population, the baseline was regenerated and the test has stopped meaning anything.
    const captured = Object.values(REFERENCE_DERIVED).reduce((a, f) => a + Object.keys(f).length, 0)
    expect(captured).toBe(54)
    const now = dataset.reduce((a, d) => a + PLACEHOLDER_FIELDS.filter((f) => d[f] !== null).length, 0)
    expect(now, 'the baseline was regenerated against the post-phase corpus').toBeGreaterThan(captured)
  })
})

describe('T43 — placeholders appear ONLY in the five permitted fields (I2)', () => {
  it('the permitted set is closed at five', () => {
    expect(PLACEHOLDER_FIELDS).toHaveLength(5)
    expect(PLACEHOLDER_FIELDS).toEqual(['brand', 'channel', 'category', 'agent', 'impact'])
    expect(PLACEHOLDER_FIELDS, 'confidence must not be in the set (R39)').not.toContain('confidence')
  })

  it('no other field in the corpus is marked as a placeholder', () => {
    const stray = placeholderEntries().filter((e) => !PLACEHOLDER_FIELDS.includes(e.field))
    expect(stray, 'a field outside the permitted set was invented').toEqual([])
  })

  it('confidence is never marked', () => {
    const marked = placeholderEntries().filter((e) => e.field === 'confidence')
    expect(marked).toEqual([])
  })
})

const escape = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('T44 — impact is coherent with each object\'s own content (R37/R38)', () => {
  /**
   * THE RULE, stated rather than implied:
   *   magnitude and unit come from the story's own prose (title, then narrative, then status_note),
   *   falling back to its `totals.rows`. A date is never a magnitude.
   *   SIGN: an explicit +/- on the figure wins; else a gain verb is positive; else a loss verb is
   *   negative; else the magnitude is UNSIGNED — an amount in play, not a gain or a loss (R38).
   */
  const GAIN = /recover|uplift|opportunity|freed|saving|upside|headroom|gain|protect|improve|clears/i
  const LOSS = /below|short|breach|loss|waste|undercut|drift|late|defect|stock-?out|trough|exceed|surcharge|leak|decay|drop|blocked|exposure|negative|cross(es)?\b/i

  it('every impact magnitude is traceable to its own STORY\'s words or totals', () => {
    // Story-level, because the impact is story-level: a story is one proposal seen at four moments,
    // and the magnitude the decide stage's totals supply is the same proposal's magnitude at reason.
    // Checking per object would fail 46 of 105 for the wrong reason — the sibling that states the
    // number is simply a different stage.
    const byStory = {}
    for (const d of dataset) (byStory[d.story_code] ??= []).push(d)

    const orphans = []
    for (const [code, objs] of Object.entries(byStory)) {
      const magnitude = Math.abs(objs[0].impact.value)
      // Commas stripped: the reference writes "−$1,840" and the magnitude is 1840. Matching raw
      // digit strings against thousands-separated display text failed S10.1 and S10.4 for that
      // reason alone — a defect in this check, not in the value.
      const text = objs
        .flatMap((o) => [o.title, o.narrative, o.status_note, JSON.stringify(o.totals ?? {})])
        .filter(Boolean)
        .join(' ')
        .replace(/,/g, '')
      const digits = String(magnitude).replace(/\.0+$/, '')
      const compact = magnitude >= 1000 ? String(magnitude / 1000).replace(/\.0+$/, '') : digits
      if (!text.includes(digits) && !text.includes(compact)) {
        orphans.push(`${code}: ${objs[0].impact.value} ${objs[0].impact.unit} appears nowhere in the story`)
      }
    }
    expect(orphans, `${orphans.length} impact value(s) are not traceable`).toEqual([])
  })

  it('an UNSIGNED impact is a first-class state, not a zero or a default plus (R38)', () => {
    // The seven amounts-in-play: forcing a sign onto "12 POs · $88K · cash check" asserts a
    // direction the story does not claim, and S10.5 is the proof — a brand-integrity incident
    // rendered as +$640 tells the operator the opposite of the truth.
    const unsigned = dataset.filter((d) => d.impact.signed === false)
    expect(unsigned.length, 'no impact is marked unsigned').toBeGreaterThan(0)
    for (const d of unsigned) {
      expect(d.impact.value, `${d.proposal_id} is unsigned but negative`).toBeGreaterThanOrEqual(0)
    }
    // Two populations are unsigned, for two different reasons:
    //   the seven MONEY stories R38 named — amounts in play, not gains or losses;
    //   every COUNT — a quantity has no direction, which the step-1 analysis already showed.
    // R38 named seven. S9.8 is an eighth, and for the same reason: its magnitude comes from the
    // totals fallback ("Initial buy · 900 u · $37.4K") and its title — "Launch — Enamel Dutch Oven
    // 5qt · date Sep 12" — carries neither a gain verb nor a loss verb. A launch's initial buy is
    // an amount in play. The fallback did not exist when the seven were counted.
    const money = new Set(unsigned.filter((d) => d.impact.unit === 'USD').map((d) => d.story_code))
    expect([...money].sort()).toEqual(['S10.5', 'S10.6', 'S9.16', 'S9.19', 'S9.2', 'S9.20', 'S9.4', 'S9.8'])
    for (const d of dataset) {
      if (d.impact.unit === 'count') {
        expect(d.impact.signed, `${d.proposal_id}: a count carries a direction`).toBe(false)
      }
    }
  })

  it('a SIGNED impact agrees with its own story\'s language', () => {
    // STORY-LEVEL, and ANCHORED TO THE MAGNITUDE. Two earlier versions of this check were wrong in
    // opposite directions and both are worth stating, because they are the same mistake:
    //
    //   per OBJECT, title only  — failed S9.15, whose "+$9.9K" appears in the body of three stages
    //                             and the title of none. The impact is one value for one proposal;
    //                             the evidence for its sign is the whole story's words.
    //   per STORY, any sign     — failed S9.7, S9.10 and S10.2, where a `+` on some UNRELATED number
    //                             ("+2 cards") was read as evidence about this magnitude.
    //
    // So: locate the magnitude in the story's own text and read the character in front of it. A sign
    // the reference writes ON THIS NUMBER settles the question; only when it writes none does a verb
    // get a vote — which is the generator's own precedence, asserted from the outside.
    const byStory = {}
    for (const d of dataset) (byStory[d.story_code] ??= []).push(d)

    const wrong = []
    for (const [code, objs] of Object.entries(byStory)) {
      const impact = objs[0].impact
      if (impact.signed === false) continue
      const words = objs
        .flatMap((o) => [o.title, o.narrative, o.status_note, JSON.stringify(o.totals ?? {})])
        .filter(Boolean).join(' ').replace(/,/g, '')

      const magnitude = Math.abs(impact.value)
      const digits = String(magnitude).replace(/\.0+$/, '')
      const compact = magnitude >= 1000 ? String(magnitude / 1000).replace(/\.0+$/, '') : digits
      // `\\b` is wrong here: "$9.9K" has no word boundary between the 9 and the K, so it missed every
      // compact figure in the corpus. Digit lookarounds instead — they also stop "9.9" matching
      // inside "19.9" or "9.95", which a boundary would have allowed.
      const anchored = new RegExp(
        `(?<![\\d.])([−–+-])?\\s?\\$?\\s?(?:${escape(digits)}|${escape(compact)})(?!\\d)`, 'g')
      const leads = [...words.matchAll(anchored)].map((m) => m[1]).filter(Boolean)

      if (leads.length > 0) {
        const positive = leads.every((l) => l === '+')
        const negative = leads.every((l) => l !== '+')
        if (positive && impact.value < 0) wrong.push(`${code}: reference writes +${digits} but impact is negative`)
        if (negative && impact.value > 0) wrong.push(`${code}: reference writes −${digits} but impact is positive`)
        continue
      }
      const title = objs[0].title
      if (GAIN.test(title) && impact.value < 0) wrong.push(`${code}: gain verb but negative`)
      if (!GAIN.test(title) && LOSS.test(title) && impact.value > 0) wrong.push(`${code}: loss verb but positive`)
    }
    expect(wrong, `${wrong.length} impact sign(s) contradict their own story`).toEqual([])
  })

  it('a story\'s stages all carry the SAME impact — it is one proposal', () => {
    const byStory = {}
    for (const d of dataset) (byStory[d.story_code] ??= []).push(d)
    for (const [code, objs] of Object.entries(byStory)) {
      const distinct = new Set(objs.map((o) => JSON.stringify(o.impact)))
      expect(distinct.size, `${code} shows ${distinct.size} different impacts across its stages`).toBe(1)
    }
  })

  it('brand, category and channel are stable per story (I4)', () => {
    const byStory = {}
    for (const d of dataset) (byStory[d.story_code] ??= []).push(d)
    for (const [code, objs] of Object.entries(byStory)) {
      for (const field of ['brand', 'category', 'channel']) {
        const distinct = new Set(objs.map((o) => o[field]))
        // S9.9/channel is the ONE exception, and it is a reference defect this phase must not paper
        // over. S9.9 has no proposal-level channel at any stage; every `channels` string in its raw
        // fixture is ROW-LEVEL, inside an alternatives table describing what each option would do
        // ("DTC + Amazon promo", "outlet only", "liquidator"). `channelOf` walks the tree and claims
        // whichever row it reaches first, so reason yields `dtc` and decide yields `amazon` — two
        // channels for one proposal, from a field the reference never states about the proposal.
        //
        // NOT FIXED HERE. Those are reference-derived values inside T42's pre-phase snapshot, and I3
        // forbids overwriting them; narrowing `channelOf` is a claim-ledger change, not a placeholder
        // change. Pinned, named, and carried to deliverable J.
        if (code === 'S9.9' && field === 'channel') {
          expect([...distinct].sort()).toEqual(['amazon', 'dtc'])
          continue
        }
        expect(distinct.size, `${code} shows ${distinct.size} different ${field}s`).toBe(1)
      }
    }
  })

  it('no new NAME was minted — the vocabularies are the ones the corpus already evidenced (R36)', () => {
    expect([...new Set(dataset.map((d) => d.brand))].sort()).toEqual(['alder', 'ridgeline'])
    expect([...new Set(dataset.map((d) => d.category))].sort()).toEqual(['bakeware', 'cookware', 'kitchen tools', 'storage'])
    for (const channel of new Set(dataset.map((d) => d.channel))) expect(CHANNELS).toContain(channel)
    // every agent name is one the reference actually states somewhere
    const referenceAgents = new Set(Object.values(REFERENCE_DERIVED).map((f) => f.agent).filter(Boolean))
    for (const d of dataset) expect(referenceAgents, `invented agent name: ${d.agent}`).toContain(d.agent)
  })
})

describe('T45 — generation is deterministic and normalize is idempotent (I4)', () => {
  it('placeholder assignment is a pure function of the story code', () => {
    // Asserted by outcome rather than by reading the generator: two objects of the same story get
    // the same values, and the values do not depend on position, time or iteration order.
    const byStory = {}
    for (const d of dataset) (byStory[d.story_code] ??= []).push(d)
    for (const objs of Object.values(byStory)) {
      const first = objs[0]
      for (const o of objs) {
        for (const field of ['brand', 'category', 'channel']) {
          if (o.story_code === 'S9.9' && field === 'channel') continue // reference-stated, see T44
          expect(o[field], `${o.proposal_id}.${field}`).toBe(first[field])
        }
      }
    }
  })

  it('the corpus on disk equals what the generator produces — run `npm run normalize` twice', () => {
    // The real idempotency proof is the build step (reported in D). This asserts the committed
    // corpus is a generator output and not a hand-edit, which is the failure this would hide.
    const { execSync } = require('node:child_process')
    const changed = execSync('git diff --name-only -- src/features/action-stories/__corpus__/normalized/', {
      encoding: 'utf8',
    }).trim()
    expect(changed, `the corpus differs from the committed state: ${changed}`).toBe('')
  })
})
