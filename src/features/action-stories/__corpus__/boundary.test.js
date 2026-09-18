// Phase 2, T10 and T11: the semantics/presentation boundary, asserted over the whole shipped corpus.
//
// T10 IS A BOUNDARY, NOT A PREFERENCE. A reviewer will eventually want to put a colour in the
// payload — a status tone, a chart hue, "just this once, for the meter". This test is the answer.
// If it fails after an implementation change, the boundary has been crossed: report the key and fix
// the producer. NEVER add an exception here. An exception list on this test is the mechanism by
// which presentation returns, one plausible key at a time.
//
// The semantic replacement for everything banned below already exists: guardrails.checks[].status
// is an enum, and the status -> colour map lives in ONE place in frontend code (I4). That is the
// trade this boundary enforces — the payload says `fail`, the component decides it is rose-700.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import dataset from './normalized/dataset.json'

/** Every (path, key, value) triple in the corpus, so a violation reports WHERE it is. */
function walkEntries(value, path = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkEntries(item, `${path}[${i}]`, out))
    return out
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, sub] of Object.entries(value)) {
      out.push({ path: `${path}.${key}`, key, value: sub })
      walkEntries(sub, `${path}.${key}`, out)
    }
  }
  return out
}

const ENTRIES = dataset.flatMap((d) => walkEntries(d, d.proposal_id))

/**
 * Presentation words, matched as whole camelCase words rather than as substrings — so a real field
 * is never a false positive. Same word-boundary rule extraction/classifyBlocks.js's isDecorativeKey
 * uses, restated here because this test must not depend on the producer it is policing.
 */
const FORBIDDEN_KEY_WORDS = new Set([
  'colour', 'color', 'tone', 'tint', 'hue', 'icon', 'glyph', 'show', 'hidden', 'visible',
  'className', 'classname', 'css', 'style', 'bg', 'fg', 'fill', 'stroke', 'shadow', 'opacity',
  'border', 'radius', 'dot', 'glow',
])
const CAMEL_WORDS = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g

function forbiddenWordsIn(key) {
  const words = String(key).match(CAMEL_WORDS) ?? []
  return words.filter((w) => FORBIDDEN_KEY_WORDS.has(w.toLowerCase()) || FORBIDDEN_KEY_WORDS.has(w))
}

const CSS_VAR = /var\(--/
const HEX_COLOUR = /^#[0-9a-f]{3,8}$/i
const COLOUR_FUNC = /\b(color-mix|rgba?|hsla?|oklab|oklch)\s*\(/i

describe('T10 — zero presentation keys anywhere in the shipped corpus', () => {
  it('walks a non-trivial corpus, so this cannot pass vacuously', () => {
    expect(dataset).toHaveLength(105)
    expect(ENTRIES.length).toBeGreaterThan(5000)
  })

  it('finds no key matching colour/tone/tint/hue/icon/glyph/show/className', () => {
    const offenders = ENTRIES.filter((e) => forbiddenWordsIn(e.key).length > 0).map(
      (e) => `${e.path}  (word: ${forbiddenWordsIn(e.key).join(',')})`,
    )
    expect(offenders, 'presentation key(s) crossed the boundary').toEqual([])
  })

  it('finds no CSS custom-property value', () => {
    const offenders = ENTRIES.filter((e) => typeof e.value === 'string' && CSS_VAR.test(e.value)).map(
      (e) => `${e.path} = ${JSON.stringify(e.value)}`,
    )
    expect(offenders).toEqual([])
  })

  it('finds no hex colour value', () => {
    const offenders = ENTRIES.filter((e) => typeof e.value === 'string' && HEX_COLOUR.test(e.value.trim())).map(
      (e) => `${e.path} = ${JSON.stringify(e.value)}`,
    )
    expect(offenders).toEqual([])
  })

  it('finds no colour-function value (color-mix, rgb, hsl, oklab, oklch)', () => {
    const offenders = ENTRIES.filter((e) => typeof e.value === 'string' && COLOUR_FUNC.test(e.value)).map(
      (e) => `${e.path} = ${JSON.stringify(e.value)}`,
    )
    expect(offenders).toEqual([])
  })

  it('finds no Font Awesome glyph name', () => {
    const offenders = ENTRIES.filter((e) => typeof e.value === 'string' && /\bfa-(solid|regular|brands|light)\b|\bfa-[a-z-]{3,}\b/.test(e.value)).map(
      (e) => `${e.path} = ${JSON.stringify(e.value)}`,
    )
    expect(offenders).toEqual([])
  })

  it('the guardrail status that REPLACES tone/icon is present and semantic', () => {
    // The boundary is only honest if the semantic it demands actually exists. This is the trade:
    // tone and icon were read at extraction time and discarded; `status` crossed instead.
    const rows = dataset.flatMap((d) => d.guardrails?.checks ?? [])
    expect(rows.length).toBe(85)
    for (const row of rows) {
      expect(typeof row.status).toBe('string')
      expect(row).not.toHaveProperty('tone')
      expect(row).not.toHaveProperty('icon')
      expect(row).not.toHaveProperty('bg')
      expect(row).not.toHaveProperty('noteTone')
    }
  })
})

describe('T11 — numeric values lost to the STRIP RULE are restored (R8 scope only)', () => {
  // SCOPE, per R8. Two causes of loss were measured, and they are not the same bug:
  //
  //   (a) the claim ledger — `pick`/`pickByBlockType` only copy a raw key some canonical field's
  //       candidate list names, and there is no passthrough. `limit` x21, `pctFrom` x21,
  //       `targetPct` x10, `mapFloor` x7 and the rest are lost here. That is a DATA-MODELLING
  //       change and it is Phase 3's, alongside the MeterList block that needs those keys. An
  //       inventory of them is a Phase 2 deliverable, not a Phase 2 code change.
  //
  //   (b) the strip rule itself — `widthPct` x7 (isGeometryKey, "width") and `markPct` x4
  //       (isDecorativeKey, "mark"). Eleven numeric values, and the ONLY ones this phase restores.
  //
  // `targetLx` and `targetLy` stay stripped: they are SVG label coordinates, correctly presentation.

  // CORRECTION TO THE STEP-1 MEASUREMENT THAT R8 WAS BUILT ON. R8 scoped this phase to "the 11
  // defensible numeric values lost to the strip rule (widthPct, markPct)". On implementing it, that
  // scope turned out to be EMPTY — not one of the 11 is recoverable by correcting the strip rule:
  //
  //   widthPct x6  data.feed[].__raw.band.widthPct — inside `__raw`, the internal companion
  //                extraction/dcLogicSandbox.js attaches. Stripped by the `__` prefix rule and
  //                correctly so; it was never the geometry rule's doing.
  //   widthPct x1  data.sel.band.widthPct = 62 — a real number, but `sel` appears in no candidate
  //                list, so the CLAIM LEDGER drops it before `clean` runs.
  //   markPct  x4  data.afterRows[].markPct = "60" — a STRING, so not one of the typed numbers R8
  //                meant to restore; and `afterRows` is unclaimed too.
  //
  // The step-1 count was wrong twice: its numeric predicate accepted numeric-looking strings, and
  // it walked raw fixtures without checking whether the parent was claimed or internal. So the
  // honest total lost to the strip rule is ZERO, and every threshold value in the corpus is a
  // claim-ledger matter — which makes R8's Phase 3 hand-off larger than it looked, not smaller.
  //
  // The `NUMERIC_DESPITE_NAME` correction is still in the extractor, guarded to numbers, because a
  // numeric `widthPct` IS data and the rule was genuinely misclassifying it. It becomes observable
  // the moment Phase 3 claims `sel` or `afterRows`. These tests assert the state that is actually
  // true today rather than a state the fix cannot produce.

  it('the raw fixtures really do put widthPct where the strip rule never sees it', () => {
    // The corrected diagnosis, checked rather than asserted in prose: 6 of the 7 are under `__raw`.
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/raw/S9.20/analyze.json'), 'utf8'),
    )
    expect(JSON.stringify(raw.data.feed)).toContain('__raw')
    expect(JSON.stringify(raw.data.feed)).toContain('widthPct')
    expect(raw.data.sel.band.widthPct, 'the one genuine number, under an unclaimed parent').toBe(62)
  })

  it('markPct is a STRING in the reference, so it was never a typed number to restore', () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/raw/S10.2/decide.json'), 'utf8'),
    )
    const withMark = raw.data.afterRows.find((r) => 'markPct' in r)
    expect(typeof withMark.markPct).toBe('string')
  })

  it('keeps targetLx / targetLy stripped — they are SVG coordinates, correctly presentation', () => {
    const offenders = ENTRIES.filter((e) => /^target_?l[xy]$/i.test(e.key)).map((e) => e.path)
    expect(offenders).toEqual([])
  })

  it('PRESERVATION: the numeric threshold values that DO reach the corpus survive as numbers', () => {
    // This is the invariant R8 actually cares about, asserted on specific objects that carry them
    // rather than on a count: a threshold value inside a claimed structure is not stripped for its
    // name, and arrives as a number rather than as display text.
    const s91 = dataset.find((d) => d.proposal_id === 'prop_s9_1_decide')
    const gmroi = s91.guardrails.checks.find((r) => r.label?.startsWith('GMROI target'))
    expect(gmroi.pct, 'the GMROI check % is the canonical surviving threshold value').toBe(96)
    expect(typeof gmroi.pct).toBe('number')

    const capital = s91.guardrails.checks.find((r) => r.label?.startsWith('Capital ceiling'))
    expect(typeof capital.pct).toBe('number')
  })

  it('does not regress the numerics that already survived', () => {
    // Bare `pct` survives because it is nested inside claimed structures. The strip-rule correction
    // must not disturb that, and neither must the new field population.
    //
    // PHASE 5A DELTA: floor 127 -> 120. `pct` is nested inside CLAIMED structures, so the floor
    // moves whenever a claim does, and this phase withdrew six. Arithmetic, not erosion:
    //   out  opportunity 4 rows, sizes 6, detectBars 4, timeline 5 (all carried a `pct`)  = -19
    //   in   owners 4, valueSplit 4, forecast 4 (the better-labelled keys that replaced them) = +12
    // for a net -7, which is exactly 127 -> 120. Not one of the withdrawn `pct` values was a
    // measurement: every one was a bar width, confirmed per key in shapeLedger.js's IGNORE_LIST
    // (`barChart.pct`). The strip rule this test guards is untouched — no `pct` was stripped, six
    // claims stopped being made — and the nested-survival property it asserts still holds for all 120.
    const pct = ENTRIES.filter((e) => e.key === 'pct')
    expect(pct.length).toBeGreaterThanOrEqual(120)
  })

  it('every BARE-NUMERIC pct is typed as a number', () => {
    // A quoted magnitude ("96") is text in a numeric field and is now converted. A FORMATTED one
    // ("0%", "−7.0%", "+12.5%") is deliberately left alone: recovering a number from it means
    // undoing a unit symbol and a sign convention — blocks/formatValue.js's own output as an input,
    // which is precisely what ruling R2 forbids. Those ~45 values need `{value, unit: 'pct'}`, which
    // is a data-SHAPE change and Phase 4's typed-number work, not a coercion.
    const formatted = /[%$+\u2212]/
    const bare = ENTRIES.filter((e) => e.key === 'pct' && !(typeof e.value === 'string' && formatted.test(e.value)))
    expect(bare.length).toBeGreaterThanOrEqual(3)
    for (const e of bare) expect(typeof e.value, `${e.path} is a bare magnitude but not a number`).toBe('number')
  })
})
