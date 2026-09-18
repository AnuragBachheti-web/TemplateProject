// The corpus normalization layer.
//
// Transforms the 105 archived stage fixtures into clean, contract-conformant Decision Objects and
// writes them to `__corpus__/normalized/`. That directory is the CANONICAL DATASET: the thing a
// mock or cloud API will serve, and the only business data the runtime ever sees.
//
// Deterministic: same corpus in, byte-identical output. Re-run with `npm run normalize`.
//
// WHY THIS IS A BUILD-TIME SCRIPT AND NOT RUNTIME CODE. The runtime must contain zero
// `import.meta.glob` calls over story manifests or story fixtures — that coupling is precisely what
// the template layer removes. So the corpus is read HERE, in Node, at generation time, and the
// result is committed as one static JSON artifact the mock API imports directly.
//
// ============================================================================================
// THE TWO RULES THIS FILE NOW ENFORCES (docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md)
// ============================================================================================
//
// 1. NO SHAPE-BASED GUESSING. There is no `fallbackScan` any more. A canonical field is filled
//    ONLY from a named source the reference actually uses for that concept. The audit measured
//    what the old fallback produced: `proposal.slate` came from a real slate on 5 of 21 decide
//    objects and from `ticks`/`tabs`/`impact`/`totals` on the other 16 — and because the slate slot
//    is `selectable: true`, operators were selecting and approving rows of a tab strip. A field
//    whose named source is absent is now OMITTED, the template's `when` omits the slot, and the
//    omission is recorded in `normalized/provenance.json` instead of being papered over.
//
// 2. NO SYNTHESISED BUSINESS VALUES. The old generator invented all seven contract axes from
//    `hash(story_code)`. Three of them are real and are now read from the reference itself
//    (see extraction/referenceContext.js): `lens` and `persona` from the pinned identity strip
//    every screen carries, `mode` from the execution dial's own label. `cardinality` is derived
//    from the proposal's real item count. The rest carry no reference evidence and are handled
//    explicitly below under "unresolved axes" — never by a hash, and never silently.
//
// WHAT IS REAL. The business content — narratives, policy rows, slates, checks, totals — is the
// corpus's own, passed through the same hygiene pass the real backend must implement: CSS
// variables, mockup geometry, SVG path data, visibility flags and extraction companions are all
// stripped, and the surviving values are what a clean API response would carry.
//
//   node extraction/normalizeCorpus.js

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDecorativeKey } from './classifyBlocks.js'
import { referenceContextFor } from './referenceContext.js'
import { deriveApproveEligibility, deriveApproveSelectedEligibility } from '../src/features/action-stories/contract/deriveEligibility.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const CORPUS = path.join(REPO_ROOT, 'src/features/action-stories/__corpus__')
const NORMALIZED = path.join(CORPUS, 'normalized')
const OUT_DATASET = path.join(NORMALIZED, 'dataset.json')
const OUT_PROPOSALS = path.join(NORMALIZED, 'proposals')
const OUT_EXAMPLES = path.join(NORMALIZED, 'examples')
const OUT_PROVENANCE = path.join(NORMALIZED, 'provenance.json')

// ---- hygiene ---------------------------------------------------------------------------------

// The runtime's decorativeKeys.js covers these too; extraction never imports runtime code (and vice
// versa), so the geometry words it gained are repeated here rather than shared across that boundary.
// Bare `x`/`y` are deliberately NOT here: the contract's typed chart series is `{x, y}`, and
// stripping them would destroy the one shape charts are supposed to receive.
const GEOMETRY_WORDS = new Set([
  'left', 'right', 'width', 'top', 'height', 'bottom',
  'px', 'py', 'cx', 'cy', 'lx', 'ly', 'nx', 'tx', 'ty', 'vy', 'linky',
])
const CAMEL = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g
const SVG_PATH = /^M\s*-?[\d.]+[\s,]/i
// Visibility flags a business payload must never carry. `state` is deliberately NOT here any more:
// the mockup-envelope `state` object never reaches this function (fixtures are read as `.data`),
// while a ROW's own `state` ("live", "armed") is real business status — banning the word outright,
// which the previous version did, silently deleted `clauseRows[].state`, `rbState` and every other
// per-row lifecycle field.
const BANNED_KEYS = new Set(['execSegs', 'execLabel', 'strike', 'weight', 'align'])

/**
 * Keys that carry an OPACITY when their value is a bare number, and business content otherwise.
 * `dim` is both in this corpus: `{dim: 0.45}` fades a de-emphasised row, while S9.18/analyze's
 * top-level `dim` is its dimensional-weight table (sku / box / ratio / newBox / save). Banning the
 * name outright would delete the table; keeping it outright leaked "Dim 0.45" into a slate row.
 */
const OPACITY_KEYS = new Set(['dim', 'opacity', 'fade', 'alpha'])

/**
 * Whole FAMILIES of mockup-only keys, matched by name rather than enumerated one at a time.
 *   *Show  - a CSS visibility flag ("inline-flex"/"none"). 39 `btnShow`, 31 `tagShow`, 18 `recShow`
 *            and two dozen more; the previous version banned exactly two of them by hand.
 *   href   - navigation BETWEEN MOCKUP FILES ("S9.11-4-execute.dc.html"). A real proposal's next
 *            action is named by its own operator action id, never by a path to an HTML file.
 */
const BANNED_KEY_PATTERNS = [/Show$/, /^href$/, /Href$/]

/** Bare CSS keywords that are never a business value, whatever key they arrive under. */
const CSS_KEYWORD = /^(inline-flex|inline-block|line-through|not-allowed|nowrap|uppercase|currentColor|transparent|pointer)$/

function isGeometryKey(key) {
  return (String(key).match(CAMEL) ?? []).some((w) => GEOMETRY_WORDS.has(w.toLowerCase()))
}

// WHY THERE IS NO "NUMERIC DESPITE ITS NAME" EXEMPTION HERE.
//
// Phase 2 added one, for `widthPct` and `markPct`, on the argument that a numeric percentage IS the
// measurement a bar depicts rather than its layout. Phase 3A disproved that and ruling R15 removed
// it. The disproof is arithmetic, not opinion:
//
//   metrics[0]   limit "4.0%" floor "3.0%" today "3.4%"  ->  pct 68, floorPct 60, limitPct 80
//                today 3.4 / 5.0 * 100 = 68        the axis maximum, 5.0%, is a design choice
//   surfaceProj  now "19%" proj "26%"               ->  nowPct 42, projPct 58, targetPct 78
//                now 19 / 45 * 100 = 42            `now` is 19 and `nowPct` is 42
//   sel.band     low "$44" high "$92" our "$68"     ->  lowPct 18, widthPct 62, ourPct 52
//                reconstructs on an axis window of roughly $30-$107
//
// `now` cannot be both 19 and 42, so these are `value / chosenAxisMax * 100` — a layout decision
// wearing a number's clothes. 546 occurrences of the family are geometry and stay stripped; the
// semantic values they were computed from exist only as formatted display strings, which R2 forbids
// recovering by parsing. __corpus__/claimedThresholds.test.js's T20 asserts their absence so the
// exemption cannot return without a ruling.
function isBannedKey(key) {
  return (
    BANNED_KEYS.has(key)
    || String(key).startsWith('__')
    || BANNED_KEY_PATTERNS.some((p) => p.test(String(key)))
    || isDecorativeKey(key)
    || isGeometryKey(key)
  )
}

/** True for a value that is presentation, not business content. */
function isPresentationValue(v) {
  if (typeof v !== 'string') return false
  return v.includes('var(--') || v.includes('color-mix(') || SVG_PATH.test(v.trim()) || CSS_KEYWORD.test(v.trim())
}

/** Recursively strips every presentation field. This is the pass the real serializer must implement. */
function clean(value) {
  if (Array.isArray(value)) {
    const out = value.map(clean).filter((v) => v !== undefined)
    return out.length > 0 ? out : undefined
  }
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (isBannedKey(k)) continue
      if (OPACITY_KEYS.has(k) && typeof v === 'number') continue
      // A `pct` is always a percentage MAGNITUDE, and the reference quotes several of them ("96").
      // Typed here so no consumer has to decide whether this particular percentage arrived as text
      // — see bareNumber for why this is not the display-string parsing ruling R2 forbids.
      if (k === 'pct') {
        const asNumber = bareNumber(v)
        if (asNumber !== undefined) {
          out[k] = asNumber
          continue
        }
      }
      const cleaned = clean(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  if (isPresentationValue(value)) return undefined
  if (value === null || value === '') return undefined
  return value
}

// ---- provenance --------------------------------------------------------------------------------

/**
 * Every canonical field records WHICH raw reference key produced it, or why it is absent. This is
 * the regression fence for rule 1: `normalizedProvenance.test.js` asserts that no canonical field
 * is ever sourced from a key outside its own declared candidate list, which is the specific defect
 * the audit found (a button label rendering as the recommendation, a tab strip as the slate).
 */
function makeRecorder() {
  const sources = {}
  // ONE RAW KEY SUPPLIES AT MOST ONE CANONICAL FIELD. This ledger is what makes duplicate content
  // structurally impossible rather than merely unlikely: the audit counted 41 incidents of the same
  // value rendering into two slots on one screen (`execution_targets` == `verification` on 12
  // screens, `recommendation_metrics` == `slate_summary` == `totals_rows` on 3). A key claimed by
  // an earlier, more specific field is invisible to every later one, so the second slot omits
  // instead of echoing the first.
  const claimed = new Set()
  return {
    sources,
    claimed,
    record(field, key) {
      sources[field] = key ?? null // null = no semantic source on this screen; the field is omitted
      if (key !== null && key !== undefined) claimed.add(key)
    },
  }
}

/**
 * First candidate whose CLEANED value satisfies `pred`. Candidates are tried in declared order and
 * NOTHING ELSE IS EVER TRIED — this function is deliberately the opposite of the `fallbackScan`
 * it replaces.
 */
function pick(data, candidates, pred, rec, field) {
  for (const key of candidates) {
    if (rec.claimed.has(key) || isBannedKey(key)) continue
    const v = clean(data[key])
    if (v !== undefined && pred(v)) {
      rec.record(field, key)
      return v
    }
  }
  rec.record(field, null)
  return undefined
}

/**
 * Turns a screen's raw-key -> heading map (extraction/parseMockup.js's extractSlotHeadings, carried
 * on the fixture as `data.headings`) into a field-path -> heading map, using `rec.sources` (built by
 * the `pick`/`record` calls above) to learn which raw key actually filled each field on THIS object.
 *
 * Keyed by field path (e.g. `"proposal.trigger"`, identical to a template block's own `binding`),
 * never by canonical slot name — this map is looked up directly by StageRenderer.jsx against a
 * block's `binding`, so the vocabulary layer (templates/slotVocabulary.js) never needs to know a
 * per-story caption exists. A field with no raw key (`null`/absent in `rec.sources`), or a raw key
 * the mockup gave no heading to, is simply omitted — never fabricated.
 */
function titlesFrom(headings, sources) {
  const titles = {}
  if (!headings) return titles
  for (const [field, rawKey] of Object.entries(sources)) {
    if (!rawKey || typeof rawKey !== 'string') continue
    // Every real block binding is `<namespace>.<name>` (`proposal.trigger`, `execution.plan`,
    // `totals.rows`, `guardrails.verdict`, ...) — a bare field like `mode`/`lens`/`cardinality` is
    // one of the axis facts the page header renders directly, never a block, so it has no `binding`
    // for StageRenderer to look this map up by. Skipping it isn't a data loss; the heading (if any)
    // just never denotes anything a block could show.
    if (!field.includes('.')) continue
    const heading = headings[rawKey]
    if (isStr(heading)) titles[field] = heading
  }
  return titles
}

// ---- shape predicates --------------------------------------------------------------------------

const isObjArray = (v) => Array.isArray(v) && v.length > 0 && v.every((i) => i !== null && typeof i === 'object')
const isStr = (v) => typeof v === 'string' && v.trim() !== ''
/**
 * A row set every row of which carries a textual identity — what LabelValueListBlock renders.
 * The reference names that identity three ways and all three are legitimate: `label` (a metric
 * row), `name` (a rollback target, a supplier), `text` (a policy-check line, which is the whole
 * sentence and has no separate value). Requiring `label` alone discarded 9 of 19 real check lists
 * and every one of the 8 real rollback lists.
 */
const isLabelled = (v) => isObjArray(v) && v.every((i) => isStr(i.label) || isStr(i.name) || isStr(i.text))
/** Genuinely tabular: every row carries at least one non-numeric text field to identify it. */
const isTabular = (v) =>
  isObjArray(v) && v.every((r) => Object.values(r).some((c) => typeof c === 'string' && c.trim() !== '' && !Number.isFinite(Number(c))))
/** A real typed {x,y} series — what the contract requires a trend/distribution to be. */
const isTypedSeries = (v) =>
  isObjArray(v) && v.every((p) => p.x !== undefined && p.y !== undefined && Number.isFinite(Number(p.y)))

// ---- manifest-informed shape lookup ------------------------------------------------------------

/**
 * The archived manifests record, per corpus key, which BLOCK TYPE that key's data actually rendered
 * as — the output of extraction/classifyBlocks.js run over the real fixtures. That is a SEMANTIC
 * signal, not a shape one: it is the same classifier that decided how these screens rendered. It is
 * used only for the chart slots (and, guarded, for `detail_rows`), because the corpus names its
 * charts forty different ways (`curves`, `bars`, `ladder`, `concentration`, `movement`, ...) and no
 * candidate list could enumerate them honestly.
 */
function blockTypeIndex() {
  const index = new Map() // `${code}/${stage}` -> Map<rawKey, blockType>
  const dir = path.join(CORPUS, 'manifests')
  for (const file of fs.readdirSync(dir).filter((f) => /^S[\d.]+\.json$/.test(f))) {
    for (const manifest of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      const byKey = new Map()
      for (const block of manifest.blocks) {
        const rawKey = typeof block.binding === 'string' && block.binding.startsWith('data.')
          ? block.binding.slice('data.'.length)
          : block.binding
        byKey.set(rawKey, block.blockType)
      }
      index.set(`${manifest.code}/${manifest.stageKey}`, byKey)
    }
  }
  return index
}

const BLOCK_TYPES_BY_STAGE = blockTypeIndex()

/**
 * Keys whose NAME says "this is a drawing", so they can never stand in for tabular evidence or for
 * a decision slate. `notch` is here because S10.4's `notches` is a slider's tick marks — after
 * hygiene strips its coordinates and colours it leaves `{size, title}`, which passes every shape
 * test and is not business data.
 */
const CHART_NAMED = /bar|chart|heat|spark|curve|path|point|tick|notch|grid|gauge|donut|fan|band/i

/**
 * Keys whose NAME says "this is a control or a chart's furniture" — a legend, a column header set, a
 * tab strip, a filter row. Real on the screen, but not business content: the frontend owns its own
 * column headers, tabs and legends.
 */
const FURNITURE_NAMED = /legend|^cols?$|Cols$|tab|filter|sort|crumb|label(s)?$|axis|scale/i

function pickByBlockType(data, stageId, blockType, extraPredicate, rec, field, { excludeChartNamed = false, excludeFurniture = false } = {}) {
  const byKey = BLOCK_TYPES_BY_STAGE.get(stageId)
  if (byKey) {
    for (const [rawKey, type] of byKey) {
      if (type !== blockType) continue
      if (rec.claimed.has(rawKey) || isBannedKey(rawKey)) continue
      if (excludeChartNamed && CHART_NAMED.test(rawKey)) continue
      if (excludeFurniture && FURNITURE_NAMED.test(rawKey)) continue
      const v = clean(data[rawKey])
      if (v !== undefined && extraPredicate(v)) {
        rec.record(field, rawKey)
        return v
      }
    }
  }
  rec.record(field, null)
  return undefined
}

/** Runs `pick` first, then the classifier fallback, keeping whichever produced a value. */
function pickThenClassify(data, candidates, pred, stageId, blockType, rec, field, options) {
  const named = pick(data, candidates, pred, rec, field)
  if (named !== undefined) return named
  return pickByBlockType(data, stageId, blockType, pred, rec, field, options)
}

// ---- value parsing -----------------------------------------------------------------------------

/** "Med-high · 78%" -> 0.78. Returns undefined when the reference states no figure. */
function confidenceFrom(data) {
  const label = clean(data.confLabel) ?? clean(data.conf)
  if (!isStr(label)) return undefined
  const pct = /(\d{1,3})\s*%/.exec(label)
  if (!pct) return undefined
  const value = Number(pct[1]) / 100
  if (!(value >= 0 && value <= 1)) return undefined
  // `calibrated` states whether the figure is a CALIBRATED probability. No reference screen makes
  // that claim, so it is false — the absence of a calibration claim, not an invented one.
  return { value: Number(value.toFixed(2)), calibrated: false }
}

/** The execution dial's own label is the reference's `mode`: "Suggest" x104, "Assist" x1. */
function modeFrom(data) {
  const raw = typeof data.execLabel === 'string' ? data.execLabel.toLowerCase().trim() : ''
  return ['suggest', 'assist', 'auto'].includes(raw) ? raw : 'suggest'
}

// ---- per-stage proposal payloads ---------------------------------------------------------------
//
// Every candidate list below names keys the REFERENCE actually uses for that concept. Adding a key
// here is a claim that the reference uses it to mean this, and `normalizedProvenance.test.js`
// pins the resulting mapping so a future edit cannot quietly widen it back into a shape scan.

const NARRATIVE_KEYS = {
  // `headline` is deliberately absent: it is the proposal's TITLE (see `title` below), and having it
  // double as the narrative is what made `narrative` and `primary_insight` render the same sentence
  // twice on 9 of 21 analyze screens (audit RB-4).
  reason: ['dialNote', 'rationale', 'restNote', 'summaryNote', 'note', 'copy'],
  analyze: ['summaryNote', 'trendNote', 'restNote', 'note', 'copy'],
  decide: ['dialNote', 'restNote', 'approvalNote', 'note'],
  execute: ['planLine', 'headMeta', 'ledgerCopy', 'note'],
  live: ['adjustSummary', 'paceCopy', 'pinnedSub'],
}

function narrativeOf(data, stage, rec) {
  return pick(data, NARRATIVE_KEYS[stage] ?? [], isStr, rec, 'narrative') ?? ''
}

function reasonProposal(data, ctx, rec) {
  return dropUndefined({
    // "What raised this" — the reference's own trigger list, 14 of 26 screens.
    trigger: pick(data, ['trigger', 'opportunity'], isObjArray, rec, 'proposal.trigger'),
    // "What Realify holds itself to". NEVER `headline`/`metrics`/`setup`, which the old shape scan
    // reached for on 11 of 21 screens.
    policy: pick(data, CONSTRAINT_KEYS, isObjArray, rec, 'proposal.policy'),
    // "Locked — owned by another lens": constraints that are not negotiable in Decide. The single
    // most frequent reason-stage concept in the reference (19 of 26) and previously dropped whole.
    constraints: pick(data, ['locked', 'protected', 'exceptions'], isLabelled, rec, 'proposal.constraints'),
    inputs: pick(data, ['inputs', 'sources', 'evidence'], isLabelled, rec, 'proposal.inputs'),
    // The entity TAXONOMY this proposal reasons over. `agents` is NOT a candidate: an agent is a
    // model, a role is a cohort of SKUs, and collapsing them lost both (audit §7.1 R4/R5).
    roles: pick(data, ['roles', 'cohorts', 'clusters'], isObjArray, rec, 'proposal.roles'),
    agents: agentsOf(data, ctx, rec),
  })
}

/**
 * The named models credited on this proposal. Prefers the fixture's own richer `agents` rows
 * ({name, role}); falls back to the reference's pinned agent pills, which name all 26 stories'
 * models even where the fixture does not (see extraction/referenceContext.js).
 */
function agentsOf(data, ctx, rec) {
  const fromFixture = clean(data.agents)
  if (isObjArray(fromFixture)) {
    rec.record('proposal.agents', 'agents')
    return fromFixture
  }
  if (ctx.agents.length > 0) {
    rec.record('proposal.agents', '(reference pinned strip)')
    return ctx.agents.map((name) => ({ name }))
  }
  rec.record('proposal.agents', null)
  return undefined
}

function analyzeProposal(data, stageId, narrative, rec) {
  // The finding the analysis exists to deliver. `pinnedSub` is NOT a candidate — it is the shell's
  // pinned identity strip, not a finding, and the old picker used it on 3 screens.
  let primaryInsight = pick(data, ['primaryInsight', 'insight', 'finding', 'sortNote', 'segNote', 'gridMeta'], isStr, rec, 'proposal.primary_insight')
  // Two slots in the same section must never render the same sentence (audit RB-4).
  if (primaryInsight !== undefined && primaryInsight === narrative) {
    rec.record('proposal.primary_insight', null)
    primaryInsight = undefined
  }

  return dropUndefined({
    primary_insight: primaryInsight,
    comparison: pickByBlockType(data, stageId, 'barChart', isObjArray, rec, 'proposal.comparison'),
    // A lineChart key whose SVG path the hygiene pass stripped leaves behind only marker geometry,
    // which is not a trend. Emitting a slot the cleaned value cannot fill would push the failure
    // downstream into the renderer; the generator refuses it here instead. The contract's answer is
    // a typed {x,y} series from the backend — never a resurrected drawing instruction.
    trend: pickByBlockType(data, stageId, 'lineChart', isTypedSeries, rec, 'proposal.trend'),
    distribution: pickByBlockType(data, stageId, 'scatterChart', isTypedSeries, rec, 'proposal.distribution'),
    bridge: bridgeOf(data, stageId, rec),
    coverage: pickByBlockType(data, stageId, 'gauge', isObjArray, rec, 'proposal.coverage'),
    matrix: matrixOf(data, stageId, rec),
    // Row-level evidence. Named sources first; the classifier's own table verdict second, guarded
    // so a chart-named key (`bars`, `heat`, `zoneBars`) can never become "the evidence table".
    detail_rows: pickThenClassify(
      data,
      ['rows', 'cases', 'gaps', 'disposition', 'sorts', 'conflicts', 'flows', 'queries', 'buckets', 'desks', 'feed'],
      isTabular, stageId, 'table', rec, 'proposal.detail_rows', { excludeChartNamed: true },
    ),
    // The SECOND board. A reference analyze screen routinely carries more than one — S9.2 shows a
    // "Stock-out risk board", an "Overstock board" and "Open POs · in transit"; 23 of 26 screens
    // carry a second tabular board that the single `detail_rows` slot had nowhere to put. Its key
    // name is different on every screen (the 835-name sprawl), so it is resolved from the ORIGINAL
    // classifier's own `table` verdict on whatever key survives the claim ledger — never from a
    // shape test, and never from a key a named concept already owns.
    secondary_rows: pickByBlockType(data, stageId, 'table', isTabular, rec, 'proposal.secondary_rows', { excludeChartNamed: true }),
    // The entities the analysis is ABOUT — supplier scorecards, carrier lanes, candidate SKUs,
    // role cohorts. 15 of 26 reference analyze screens carry one, and like `secondary_rows` its key
    // name differs on every screen, so it comes from the original classifier's `itemQueue` verdict
    // (its own name for "richer, variable-shape per-item objects") on what the claim ledger leaves.
    entities: pickByBlockType(data, stageId, 'itemQueue', isObjArray, rec, 'proposal.entities', { excludeChartNamed: true, excludeFurniture: true }),
    // The governing constraints, resolved LAST on purpose. `secondary_rows` above is a broad
    // classifier fallback that already owns `capacity` on S9.9/analyze, and taking it would move
    // rendered content off a slot that displays it — additive only, so policy sees what is left.
    policy: pick(data, CONSTRAINT_KEYS, isObjArray, rec, 'proposal.policy'),
  })
}

/**
 * THE GOVERNING CONSTRAINTS a proposal operates under, by every name the reference gives them.
 *
 * `proposal.policy`'s own slot note already described this concept — "The governing targets/limits.
 * Reference `policy`/`targets`/`rules`/`standards`/`thresholds`/`slas`" — but it was only ever
 * picked in `reasonProposal`, so the decide- and analyze-stage screens carrying the same concept
 * under a different name had nowhere to put it and the rows vanished entirely.
 *
 * Folded here rather than given a field each (I6): `limits` (S10.6/decide), `capa` (S9.12/decide),
 * `capEffects` (S9.13/decide) and `capacity` (S9.3/analyze) are four names for one idea — a labelled
 * constraint the decision is measured against. A canonical path per raw key is the 835-slotName
 * accident returning through the data door.
 *
 * `caps` is deliberately NOT here: `{n: "3", tag: "tighter", bg, border, fg}` has no label and is a
 * styled chip set, not a constraint row. `proposal.alternatives` already claims it where it means a
 * scenario switcher.
 */
// Picked with `isObjArray`, deliberately NOT `isLabelled`: three reason screens state their
// constraints with a domain-specific identity key rather than `label` — S9.5 `{sev, sla, def}`,
// S10.1 `{term, definition}`, S10.4 `{rule, setting, why}`. Requiring `label`/`name`/`text` dropped
// all three, which would have been a content regression on a slot that renders.
const CONSTRAINT_KEYS = [
  'policy', 'targets', 'rules', 'standards', 'thresholds', 'slas', 'terms',
  'limits', 'capa', 'capEffects', 'capacity', 'floors', 'offerLimits',
]

/**
 * The names the reference gives its DECISION ITEM COLLECTION, one per screen. Every entry here was
 * read off the screen that uses it: `levers` (S10.2 working capital), `lanes` (S9.3 allocation),
 * `cohorts` (S9.9 markdown), `exits` (S9.10), `suppliers` (S9.2/S9.17), `events` (S9.19),
 * `repairs`/`blocks` (S10.5), `gates` (S10.6), `fixes` (S9.6/S9.10), `sampled`/`parked` (S9.20),
 * `options` (S9.5/S10.1). This is a vocabulary, not a shape test: each name is a claim about what
 * that key MEANS on the screen that carries it, and normalizedProvenance.test.js pins the result.
 */
const SLATE_KEYS = [
  'slate', 'skus', 'offerRows', 'items', 'moves',
  'levers', 'lanes', 'cohorts', 'exits', 'suppliers', 'events', 'repairs', 'blocks',
  'gates', 'fixes', 'sampled', 'parked', 'claims', 'cases', 'options',
]

/**
 * The slate, from the reference's own item vocabulary first and the ORIGINAL CLASSIFIER's
 * `itemQueue` verdict second. `itemQueue` is that classifier's name for "richer, variable-shape
 * per-item objects" — which is exactly what a decision's item list is — so it is a semantic signal,
 * not a shape one. It is safe as a fallback only because of the claim ledger: `checks`, `totals`
 * and `heroMetrics` have already been taken by the fields that actually mean them, so the only
 * itemQueue left is the real one.
 */
function slateOf(data, stageId, rec) {
  return pickThenClassify(data, SLATE_KEYS, isTabular, stageId, 'itemQueue', rec, 'proposal.slate', { excludeChartNamed: true })
}

/**
 * The variance bridge, as BUSINESS rows rather than drawing instructions. The reference's own
 * `bars` carry both: `{label, sublabel, value: "−$2,210", tag, anchor}` is the business content,
 * `{top, height, fill}` is the mockup's pre-computed pixel geometry. Hygiene correctly strips the
 * geometry — which is why the slot could never render — so `anchor` is carried across explicitly
 * here. It is not decoration: it marks the rows that are absolute LEVELS (the opening baseline, the
 * closing actual) rather than deltas, which is the one fact a bridge cannot be drawn without.
 * WaterfallChartBlock derives every coordinate from these values.
 */
function bridgeOf(data, stageId, rec) {
  const raw = pickByBlockType(data, stageId, 'waterfallChart', isObjArray, rec, 'proposal.bridge')
  if (raw === undefined) return undefined
  const sourceKey = rec.sources['proposal.bridge']
  const anchors = (data[sourceKey] ?? []).map((row) => row?.anchor === true)
  const rows = raw.map((row, i) => (anchors[i] ? { ...row, anchor: true } : row))
  // A bridge needs a baseline to bridge FROM. Without one there is no business model left, only the
  // stripped drawing, so the slot is omitted rather than half-emitted.
  if (!rows.some((r) => r.anchor === true)) {
    rec.record('proposal.bridge', null)
    return undefined
  }
  return rows
}

function decideProposal(data, stageId, rec) {
  return dropUndefined({
    // The recommendation's own NAME plus the reference's confidence wording ("Balanced",
    // "Recommended journey slate"). Distinct from the statement below.
    recommendation_identity: pick(data, ['slateName', 'slateMeta'], isStr, rec, 'proposal.recommendation_identity'),
    // The recommended decision, stated once. NEVER `approveLabel` — that is the CTA's button text,
    // and the old picker used it as the hero recommendation on 11 of 21 screens.
    recommendation: pick(data, ['heroTitle', 'heroLine', 'recommendation'], isStr, rec, 'proposal.recommendation'),
    recommendation_detail: pick(data, ['heroSub', 'heroBody', 'tradeoff'], isStr, rec, 'proposal.recommendation_detail'),
    // The figures behind it, each with its P10-P90 `range` and its caveat `note`.
    recommendation_metrics: pick(data, ['heroMetrics'], isObjArray, rec, 'proposal.recommendation_metrics'),
    // The stacked composition bar: how the recommendation splits across its categories. Normalised
    // to {label, value} so the EXISTING BarChartBlock can plot it — see compositionOf.
    composition: compositionOf(data, rec),
    // The scenarios the operator may switch between ("Conservative / Balanced / Aggressive").
    // `options` is deliberately NOT a candidate: on the screens that carry it (S9.5, S10.1) it is
    // the decision's own item list, not a scenario switcher, so it belongs to `slate` below.
    alternatives: pick(data, ['slates', 'modes', 'offerModes', 'slateTabs', 'caps'], isObjArray, rec, 'proposal.alternatives'),
    // Values measured against their own cap/limit — "spend against the +180% ceiling". The original
    // classifier's `gauge` verdict is what identifies them; on the decide stage they are a
    // guardrail, which is where the slot renders.
    coverage: pickByBlockType(data, stageId, 'gauge', isObjArray, rec, 'proposal.coverage'),
    // Provenance for the confidence figure. Fills decide.slate.v1's `provenance` section, which the
    // audit found declared and permanently empty.
    basis: pick(data, ['basis', 'ladder', 'provenance'], isLabelled, rec, 'proposal.basis'),
    // "Approve subset / Approve all / Send back", each with the reference's own explanation.
    // Resolved BEFORE the slate so a routes list can never be mistaken for the item list.
    next_actions: pick(data, ['actions', 'routes'], isObjArray, rec, 'proposal.next_actions'),
    // The selectable groups of items, and the drill-down of whichever is focused.
    item_groups: pick(data, ['groups'], isObjArray, rec, 'proposal.item_groups'),
    focus_rows: pick(data, ['focusRows'], isTabular, rec, 'proposal.focus_rows'),
    // The governing constraints this decision is measured against — `limits` (S10.6),
    // `capa` (S9.12), `capEffects` (S9.13). Same canonical path the reason stage has always used.
    policy: pick(data, CONSTRAINT_KEYS, isObjArray, rec, 'proposal.policy'),
    // The one place the reference states a threshold as NUMBERS rather than a formatted string.
    threshold_control: thresholdControlOf(data, rec),
    // THE DECISION SLATE, resolved last so every more specific concept has already claimed its key.
    slate: slateOf(data, stageId, rec),
  })
}

/**
 * `moveBar` is `[{label, n, w}]` — a count and a percentage width per category. The width is
 * presentation (it is derived from the counts), so only the count survives, renamed to the
 * magnitude key BarChartBlock already reads. No new block type is required: a bar per category IS
 * the composition, and the audit's own rule is to reuse an existing block wherever it can carry the
 * semantics.
 */
/**
 * The heat grid. `eastPct`/`westPct` are a two-way split of the same orders — they sum to 100 on
 * every row — so unlike the rest of the `*Pct` family they ARE a measurement rather than a bar
 * width, and they are the one numeric claim this phase makes.
 *
 * `heatRows` is added as a NAMED candidate because the classifier never typed it as a heatmapGrid,
 * which is why `proposal.matrix` resolved to null on the only object in the corpus with a heat grid.
 * The classifier fallback is kept behind it, unchanged.
 *
 * WHY THE SHARES BECOME CELLS RATHER THAN TWO ROW-LEVEL FIELDS. `proposal.matrix` is bound to the
 * heatmapGrid block, whose row contract is `{label, cells[]}` — and the other object that already
 * has a matrix (`prop_s9_13_analyze`, from `rfmGrid`) is exactly that shape. Emitting flat
 * `east_share`/`west_share` keys would render a placeholder on a live slot AND make one canonical
 * path mean two different shapes on two objects, which is the drift I6 exists to prevent. A
 * per-zone split across two directions IS a two-column grid, so that is what it becomes.
 *
 * `direction` is the raw key name (`eastPct` -> east), not a business term invented here.
 */
function matrixOf(data, stageId, rec) {
  const rows = pickThenClassify(data, ['heatRows'], isObjArray, stageId, 'heatmapGrid', rec, 'proposal.matrix')
  if (!isObjArray(rows)) return undefined
  return rows.map((row) => {
    const { eastPct, westPct, ...rest } = row
    const split = [
      typeof eastPct === 'number' ? { direction: 'east', share: eastPct } : undefined,
      typeof westPct === 'number' ? { direction: 'west', share: westPct } : undefined,
    ].filter((c) => c !== undefined)
    if (split.length === 0) return row
    return dropUndefined({ ...rest, cells: split })
  })
}

/**
 * A threshold stated as NUMBERS — the only instance in the corpus (`rlThreshold` on S9.12/decide,
 * `{min: 6, max: 24, step: 1, value: 14}`).
 *
 * Read straight off the raw object rather than through `clean`, because `rlThreshold` also carries a
 * `steps` array of whole pre-computed screen states and a `dependencies` list of key names; neither
 * is a threshold, and neither belongs in a payload. Only the four numbers cross.
 *
 * All four are required together: a control with a bound missing is not a narrower control, it is an
 * unusable one, so a partial `rlThreshold` yields nothing rather than a half-specified range.
 */
function thresholdControlOf(data, rec) {
  const raw = data.rlThreshold
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    rec.record('proposal.threshold_control', null)
    return undefined
  }
  const { min, max, step, value } = raw
  const allNumbers = [min, max, step, value].every((n) => typeof n === 'number' && Number.isFinite(n))
  if (!allNumbers || !(max > min) || !(step > 0) || value < min || value > max) {
    rec.record('proposal.threshold_control', null)
    return undefined
  }
  rec.record('proposal.threshold_control', 'rlThreshold')
  return { min, max, step, value }
}

function compositionOf(data, rec) {
  const rows = clean(data.moveBar)
  if (!isObjArray(rows) || !rows.every((r) => isStr(r.label) && Number.isFinite(Number(r.n)))) {
    rec.record('proposal.composition', null)
    return undefined
  }
  rec.record('proposal.composition', 'moveBar')
  return rows.map((r) => ({ label: r.label, value: Number(r.n) }))
}

function executeExecution(data, stageId, rec) {
  const pct = clean(data.progressPct)
  const pctNumber = typeof pct === 'number' ? pct : (isStr(pct) ? Number(String(pct).replace('%', '')) : NaN)
  rec.record('execution.progress_pct', Number.isFinite(pctNumber) ? 'progressPct' : null)

  // Resolved in specificity order, exactly like decideProposal: every narrowly-named concept claims
  // its key first, and `plan` — the broadest — is resolved LAST, so its classifier fallback only
  // ever sees what no named concept wanted.
  const specific = dropUndefined({
    progress_pct: Number.isFinite(pctNumber) ? { value: pctNumber, unit: 'pct' } : undefined,
    progress_rows: pick(data, ['progressRows', 'pushRows'], isObjArray, rec, 'execution.progress_rows'),
    // What must hold true for the execution to be correct. `monitors` ONLY — the old list reached
    // into `progressRows`/`filters`/`entryChips` on 9 of 21 screens.
    verification: pick(data, ['monitors', 'verification', 'reads'], isLabelled, rec, 'execution.verification'),
    // The systems being WRITTEN TO. Never `monitors`: the old candidate list sourced 14 of 14
    // target lists from the verification monitors, so both slots rendered the same content.
    targets: pick(data, ['dests', 'tray', 'orders', 'targets'], isObjArray, rec, 'execution.targets'),
    // Real rollback rows only. The previous version emitted a hard-coded
    // `[{label: 'Rollback', value: 'Available for 24 hours'}]` on 21 of 21 execute screens while
    // rejecting all 8 real ones, because the reference identifies a rollback row by `name`.
    rollback: pick(data, ['rollback', 'revertTargets'], isLabelled, rec, 'execution.rollback'),
    rollback_note: pick(data, ['rbCopy', 'rbHint'], isStr, rec, 'execution.rollback_note'),
    ledger: pick(data, ['ledger'], isObjArray, rec, 'execution.ledger'),
    ledger_note: pick(data, ['ledgerCopy'], isStr, rec, 'execution.ledger_note'),
    // Thresholds that raise an exception on this execution.
    flags: pick(data, ['flags'], isObjArray, rec, 'execution.flags'),
    // The armed safety ("Auto-pause on decay") and the envelope note that explains why the bulk
    // writes go out together.
    arming: pick(data, ['armCopy'], isStr, rec, 'execution.arming'),
    bulk_note: pick(data, ['allNote'], isStr, rec, 'execution.bulk_note'),
  })

  return dropUndefined({
    ...specific,
    // What will be executed, step by step. Named sources first; the original classifier's own
    // `table` verdict second, because the reference names this list `orders`, `changes`,
    // `transfers`, `pushes`, `tasks`, `handoffs` and `checkpoints` across different screens.
    plan: pickThenClassify(data, ['stages', 'plan', 'steps', 'chain'], isTabular, stageId, 'table', rec, 'execution.plan', { excludeChartNamed: true }),
  })
}

/**
 * The `live` stage. S10.6 is the corpus's only one, and it is not a sixth business stage: it is the
 * execute stage still running, which is exactly what `execute.bridge.v1` renders (a plan, progress,
 * monitors, targets and a ledger). Mapping it here rather than minting a `live.v1` is the audit's
 * RB-7 resolution — no new template, and the 11 reference concepts on that screen stop rendering
 * as an error page.
 */
function liveExecution(data, rec) {
  return dropUndefined({
    plan: pick(data, ['phases'], isTabular, rec, 'execution.plan'),
    progress_rows: pick(data, ['healthRows', 'lensTiles'], isObjArray, rec, 'execution.progress_rows'),
    verification: pick(data, ['clauseRows', 'healthRows'], isLabelled, rec, 'execution.verification'),
    targets: pick(data, ['coverRows'], isObjArray, rec, 'execution.targets'),
    ledger: pick(data, ['annotations'], isObjArray, rec, 'execution.ledger'),
    ledger_note: pick(data, ['expiryCopy', 'paceCopy'], isStr, rec, 'execution.ledger_note'),
    arming: pick(data, ['adjustFoot'], isStr, rec, 'execution.arming'),
  })
}

function dropUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ---- eligibility + guardrails ------------------------------------------------------------------

/**
 * The PER-ROW guardrail status, read from the three signals the reference carries and emitted as the
 * contract's semantic enum (decisionObject.js's GUARDRAIL_CHECK_STATUSES).
 *
 * `ok` FIRST, always — 18 of the 85 rows carry it (12 true, 6 false) and it is the reference stating
 * the answer rather than implying it through styling. Only when it is absent do the icon and the
 * tone decide, and they are read HERE, at generation time, and then discarded: the icon and the tone
 * never reach a payload, and __corpus__/boundary.test.js fails if they ever do. What crosses the
 * boundary is the word `pass`, and the component owns what colour that is (I4).
 *
 * `blocked` is separate from `fail` because the reference itself separates them: fa-lock (x9) and
 * fa-circle-stop (x3) mark a check that CANNOT proceed — a legal hold, a contract lock — where
 * fa-circle-xmark (x4) marks one that ran and did not pass. The operator's next step differs, so
 * collapsing them would lose a real distinction.
 */
function checkStatusOf(row) {
  if (row.ok === true) return 'pass'
  if (row.ok === false) return 'fail'

  const icon = typeof row.icon === 'string' ? row.icon : ''
  if (/fa-circle-check/.test(icon)) return 'pass'
  if (/fa-lock|fa-circle-stop/.test(icon)) return 'blocked'
  if (/fa-triangle-exclamation|fa-circle-exclamation/.test(icon)) return 'warn'
  if (/fa-circle-xmark/.test(icon)) return 'fail'
  if (/fa-clock|fa-eye|fa-bolt|fa-rotate-left|fa-circle-info/.test(icon)) return 'info'

  const tone = typeof row.tone === 'string' ? row.tone : ''
  if (/green/.test(tone)) return 'pass'
  if (/rose|red/.test(tone)) return 'fail'
  if (/amber|yellow/.test(tone)) return 'warn'

  // Fail-closed in spirit: a row whose status the reference does not state is reported as `info`,
  // never as `pass`. Claiming a check passed on no evidence is the one wrong answer here.
  return 'info'
}

/**
 * A bare numeric literal that the mockup happens to quote — `"96"`, `"2.31"` — as a number.
 *
 * This is NOT the display-string parsing ruling R2 forbids. R2 is about recovering `41000` from
 * `"+$41K"`, which means undoing a currency symbol, a sign convention and a compaction, i.e. making
 * blocks/formatValue.js's own OUTPUT an input. `"96"` is a magnitude with quotes around it: nothing
 * has been formatted, nothing is being reversed, and no information is recovered that was not
 * already there. Leaving it a string would put a display string in a typed field, which is the very
 * thing the contract's typed numbers exist to end.
 */
function bareNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v !== 'string' || !/^-?\d+(\.\d+)?$/.test(v.trim())) return undefined
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : undefined
}

/** The check rows, each carrying its derived status. Presentation is read and left behind. */
function checksWithStatus(rawChecks, cleanedChecks) {
  if (!Array.isArray(cleanedChecks)) return undefined
  return cleanedChecks.map((row, i) => {
    const withStatus = {
      status: checkStatusOf(Array.isArray(rawChecks) ? rawChecks[i] ?? {} : {}),
      ...row,
    }
    // `pct` is the one numeric field on a check row, and the reference quotes it. Typed, not text.
    if ('pct' in withStatus) {
      const n = bareNumber(withStatus.pct)
      if (n === undefined) delete withStatus.pct
      else withStatus.pct = n
    }
    return withStatus
  })
}

function guardrailsOf(data, rec) {
  // A check row needs only its own identity; `value` is optional, because the reference writes many
  // of them as `{icon, label, note}` — 9 of 19 were being discarded for lacking a `value`.
  const checks = pick(data, ['checks', 'guardParts'], isLabelled, rec, 'guardrails.checks')
  // The RAW rows, for their status signals only. `clean` has already stripped `ok`, `icon` and
  // `tone` off the rows above — correctly, for the last two — so the status is read here from the
  // pre-clean source and the presentation is left behind. `ok` is a real boolean the corpus carries
  // on 18 rows and is the only one of the three that would have been worth keeping; it is now
  // represented by `status`, which says the same thing without a second vocabulary.
  const rawChecks = Array.isArray(data.checks) ? data.checks : Array.isArray(data.guardParts) ? data.guardParts : undefined
  const blocked = data.blocked === true
  const canApprove = data.canApprove !== false
  let verdict = 'undetermined'
  if (data.blocked === undefined && data.canApprove === undefined) verdict = 'not_applicable'
  else if (blocked || !canApprove) verdict = 'beyond_limits'
  else verdict = 'within_limits'
  rec.record('guardrails.verdict', data.blocked !== undefined ? 'blocked' : data.canApprove !== undefined ? 'canApprove' : null)
  return dropUndefined({ verdict, checks: checksWithStatus(rawChecks, checks) })
}

/**
 * Eligibility is EXPLICIT for every one of the six operator actions — the contract has no notion of
 * an omitted entry meaning "probably allowed". Where the corpus carried a real block signal
 * (`blocked`/`canApprove`/`blockReason`), it is honoured; otherwise the mock allows the action.
 *
 * `approve` AND `approve_selected` ARE NOT HERE. They used to be, and this was the only place in the
 * system where `guardrails.verdict` and `eligibility.*.allowed` were coupled — offline, at
 * generation time, while nothing at runtime coupled them at all. That coupling is now
 * contract/deriveEligibility.js's, evaluated at request time against whatever the API actually
 * serves, so computing it here as well would be a second producer of the one value that must have
 * exactly one. See the stamp at this function's call site.
 */
function eligibilityOf(data, { stage, onClock, entitlement }) {
  // `blocked` / `blockReason` / `cardinality` left with the two approve entries: they were the raw
  // guardrail signals, and reading them here is now the single-producer violation this phase closed.
  const entry = (allowed, why) => (allowed ? { allowed: true } : { allowed: false, blocked_reason: why })

  const locked = entitlement === 'locked'
  const limited = entitlement === 'limited'
  const decidable = (stage === 'decide' || stage === 'execute') && !locked

  return {
    modify: entry(decidable && !limited && !locked, limited || locked ? 'Your plan does not include modifying proposals.' : 'Modification is not available at this stage.'),
    send_back: entry(decidable && !locked, 'Sending back is not available at this stage.'),
    dismiss: entry(!locked, 'Your plan does not include dismissing proposals.'),
    snooze: entry(onClock && !locked, onClock ? 'Your plan does not include snoozing proposals.' : 'This proposal has no deadline to defer.'),
  }
}

// ---- the required-and-nullable business fields (ruling R1) -------------------------------------
//
// Each of these is REQUIRED on every object and may be `null`, which states "the reference does not
// state this". That is deliberately not the same as optional: an optional field is one a producer
// may forget, a required nullable field is one a producer must decide about. Every population count
// below is what the corpus actually supports — none is padded, and none is invented.

/**
 * The sub-brands the reference names: "Ridgeline" (x204) and "Alder" (x84), both used as ranges
 * ("Brand story · Ridgeline range", SKUs "NW-CER-1120 Ridgeline stoneware bowl").
 *
 * "Northwind" is the TENANT, not a brand choice — every SKU in the corpus is NW-prefixed — so it is
 * not a value here; a field that is the same on all 105 objects is decoration.
 *
 * Assigned only when the object's own payload names EXACTLY ONE of them. 12 objects name both and
 * are therefore about neither, and get `null`: picking the first would be a coin toss dressed as
 * data. Populates 13 of 105.
 */
const SUB_BRANDS = ['Ridgeline', 'Alder']

function brandOf(decision) {
  const text = JSON.stringify(decision)
  const named = SUB_BRANDS.filter((b) => new RegExp(b, 'i').test(text))
  return named.length === 1 ? named[0].toLowerCase() : null
}

/**
 * The channel, mapped from the reference's own `channel`/`channels` strings to the contract enum.
 *
 * Present on 7 of 26 stories. Deliberately unmapped: "all four" (x7) and "mixed" (x3) describe a
 * SPAN across channels rather than one, and "Crawl re-read window" (x2) is a crawler window that
 * happens to be filed under the same key. All three yield `null` — the honest answer for a field
 * that names one channel. Populates 14 of 105.
 */
const CHANNEL_PATTERNS = [
  [/amazon/i, 'amazon'],
  [/walmart/i, 'walmart'],
  [/shopify/i, 'shopify'],
  [/\bdtc\b|northwind\.com/i, 'dtc'],
  [/google/i, 'google'],
  [/faire/i, 'faire'],
  [/\bedi\b|email|portal/i, 'wholesale'],
]

function firstRawString(data, keyTest) {
  let found = null
  const visit = (v) => {
    if (found !== null) return
    if (Array.isArray(v)) return v.forEach(visit)
    if (v !== null && typeof v === 'object') {
      for (const [k, sub] of Object.entries(v)) {
        if (found === null && keyTest(k) && typeof sub === 'string' && sub.trim() !== '') {
          found = sub
          return
        }
        visit(sub)
      }
    }
  }
  visit(data)
  return found
}

function channelOf(data) {
  const raw = firstRawString(data, (k) => /^channels?$/.test(k))
  if (raw === null) return null
  return CHANNEL_PATTERNS.find(([re]) => re.test(raw))?.[1] ?? null
}

/**
 * The merchandising category. The reference names one on exactly ONE stage screen
 * (S9.20/analyze, as row-level candidate categories: "Cookware · pan adjacency", "Bakeware ·
 * enamel adjacency", ...), so this populates 1 of 105 and is `null` everywhere else.
 *
 * NOT propagated to S9.20's sibling stages the way a deadline is, and not inferred from a story
 * title. Those 12 occurrences describe the CANDIDATES the proposal evaluates, across four different
 * categories — so "the proposal's category" is a question the reference does not answer, and a
 * category assigned from a title would be a guess wearing a field name. See deliverable F.
 */
function categoryOf(data) {
  const raw = firstRawString(data, (k) => k === 'category')
  if (raw === null) return null
  const head = raw.split('·')[0].trim().toLowerCase()
  return head === '' ? null : head
}

/**
 * The LEAD model credited on the proposal — `proposal.agents[0].name`, which the reference prints in
 * its pinned identity strip on every reason-stage screen. Populates 26 of 105 (one per story),
 * because that is where the reference states it; a persona is a human and lives on `persona`.
 */
function agentOf(proposal) {
  const first = Array.isArray(proposal?.agents) ? proposal.agents[0] : null
  return typeof first?.name === 'string' && first.name.trim() !== '' ? first.name : null
}


// ---- PROTOTYPE PLACEHOLDERS (Phase 4, Part 1) --------------------------------------------------
//
// WHAT THIS IS, AND WHAT IT IS NOT. Phase 2 (R1/R2) made the five header fields required-but-nullable
// and refused invention outright. That was right for a corpus claiming to be reference-derived, and
// it is reversed here for one bounded purpose on the product owner's decision: this repository is a
// prototype with no backend, the 105 Decision Objects were themselves authored from design mockups,
// and the header is the one surface where emptiness misrepresents the design. `impact` was 0 of 105
// — the number an operator looks for first rendered nowhere.
//
// THE CONDITION THAT MAKES IT ACCEPTABLE: every value below is marked `(placeholder)` in
// provenance.json, so it is distinguishable from reference-derived data BY MACHINE, forever. Mixing
// the two without a marker is how a prototype's scaffolding becomes an undocumented production
// assumption. A future real API deletes these five functions and their `rec.record` calls; the
// fields revert to null and nothing else changes, because nothing at runtime reads the marker.
//
// THE DISCIPLINE: no NAME and no MAGNITUDE is minted. brand, category and channel reuse vocabularies
// the corpus already evidences; agent propagates a real name from the story's own reason stage;
// impact reads a real number out of the story's own prose. The only invention is the assignment.
// `confidence` is deliberately NOT here (R39) — it is the one field that would mint a number with no
// textual basis, and a fabricated 0.74 reads as measured where a missing one honestly reads as absent.

const PLACEHOLDER = '(placeholder)'

/**
 * A stable, dependency-free hash. Deterministic by construction: the same story code yields the same
 * index on every run and on every machine, which is what keeps `npm run normalize` idempotent.
 * (Math.random and Date.now are unavailable to this file for exactly that reason.)
 */
function stableIndex(seed, modulo) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % modulo
}

/** The two sub-brands the corpus names ("Ridgeline" x204, "Alder" x84). No new names. */
const PLACEHOLDER_BRANDS = ['ridgeline', 'alder']
/** The four categories S9.20 names ("Cookware · pan adjacency", "Bakeware · …"). No new names. */
const PLACEHOLDER_CATEGORIES = ['cookware', 'bakeware', 'kitchen tools', 'storage']
/** Drawn from the contract's own CHANNELS enum, as I4 requires. No new names. */
const PLACEHOLDER_CHANNELS = ['amazon', 'walmart', 'shopify', 'dtc', 'google', 'faire', 'wholesale']

/** Assigned per STORY so a story never shows two brands, two categories or two channels (I4). */
function placeholderBrandFor(storyCode) {
  return PLACEHOLDER_BRANDS[stableIndex(`brand:${storyCode}`, PLACEHOLDER_BRANDS.length)]
}
function placeholderCategoryFor(storyCode) {
  return PLACEHOLDER_CATEGORIES[stableIndex(`category:${storyCode}`, PLACEHOLDER_CATEGORIES.length)]
}
function placeholderChannelFor(storyCode) {
  return PLACEHOLDER_CHANNELS[stableIndex(`channel:${storyCode}`, PLACEHOLDER_CHANNELS.length)]
}

// ---- impact ------------------------------------------------------------------------------------
//
// Magnitude and unit are READ from the story's own words — title first, then narrative and status
// note, then its `totals.rows` values. A story's title is identical across its stages, so all its
// objects agree, which is right: they are one proposal seen at four moments.
//
// SIGN, in precedence order (R37):
//   1. an explicit + or − on the figure itself always wins;
//   2. else a gain verb in the title makes it positive;
//   3. else a loss verb makes it negative;
//   4. else it is UNSIGNED — an amount in play, not a gain or a loss (R38).
//
// The fourth case is a first-class state, not a default plus. Seven stories are amounts under
// management ("12 POs · $88K · cash check"), and forcing a direction onto them asserts something
// the story does not claim. S10.5 is the proof: a brand-integrity incident rendered as +$640 tells
// the operator the opposite of the truth.

const IMPACT_MONEY = /([−–+-])?\$\s?([\d.,]+)\s*([KMB])?/
const IMPACT_PCT = /([−–+-])?([\d.]+)\s*(?:pp|%)/
/** A count needs its own noun, and "21 days"/"41h" is a duration rather than a quantity. */
const IMPACT_COUNT = /\b([\d,]{2,})\s+(?!days?\b|h\b|hours?\b)([A-Za-z-]+)\b/
/** "Sep 12" is a date. A date is never a magnitude. */
const IMPACT_DATE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\b/g
const IMPACT_MULTIPLIER = { K: 1e3, M: 1e6, B: 1e9 }
const IMPACT_GAIN = /recover|uplift|opportunity|freed|saving|upside|headroom|gain|protect|improve|clears/i
const IMPACT_LOSS = /below|short|breach|loss|waste|undercut|drift|late|defect|stock-?out|trough|exceed|surcharge|leak|decay|drop|blocked|exposure|negative|cross(es)?\b/i

/**
 * @param {string} title  the story's own title — the sign verbs are read from this alone.
 * @param {string[]} prose  every distinct title/narrative/status_note across the story's stages.
 * @param {string[]} totalsValues  the story's `totals.rows` values, the fallback when prose has none.
 * @returns {{value: number, unit: string, signed?: false}|undefined}
 */
function placeholderImpactFor(title, prose, totalsValues) {
  const search = [prose.join(' · '), totalsValues.join(' · ')]
  for (const raw of search) {
    const text = raw.replace(IMPACT_DATE, ' ')
    const money = IMPACT_MONEY.exec(text)
    const pct = IMPACT_PCT.exec(text)
    const count = IMPACT_COUNT.exec(text)

    let magnitude
    let unit
    let lead
    if (money) {
      magnitude = Number(money[2].replace(/,/g, '')) * (IMPACT_MULTIPLIER[money[3]] ?? 1)
      unit = 'USD'
      lead = money[1]
    } else if (pct) {
      magnitude = Number(pct[2])
      unit = 'pct'
      lead = pct[1]
    } else if (count) {
      magnitude = Number(count[1].replace(/,/g, ''))
      unit = 'count'
    } else {
      continue
    }
    if (!Number.isFinite(magnitude)) continue

    if (lead === '-' || lead === '−' || lead === '–') return { value: -magnitude, unit, signed: true }
    if (lead === '+') return { value: magnitude, unit, signed: true }
    if (unit === 'count') return { value: magnitude, unit, signed: false }
    if (IMPACT_GAIN.test(title)) return { value: magnitude, unit, signed: true }
    if (IMPACT_LOSS.test(title)) return { value: -magnitude, unit, signed: true }
    return { value: magnitude, unit, signed: false }
  }
  return undefined
}

// ---- the unresolved axes -----------------------------------------------------------------------
//
// These four the reference states nowhere. They are NOT synthesised from a hash any more; each
// carries the one value that asserts the least, and each is listed as an open contract item in
// docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md.
//
//   contract_class  'standard'  - the reference draws no distinction between proposals. The
//                                 `decision_contract_class` slot renders only for strategic/
//                                 regulated, so it correctly renders nowhere until Product defines it.
//   entitlement     'full'      - every one of the 105 reference screens shows its whole slate,
//                                 figures and item count with no teaser or paywall. "Full" is what
//                                 the reference actually depicts; the previous hash blanked 20 of
//                                 105 screens to a three-line locked teaser that no screen shows.
//   on_clock        false       - the reference shows relative deadline copy ("order-by Thursday",
//                                 "first read in 6 weeks") and no absolute instant anywhere. The
//                                 contract requires an ISO-8601 deadline when on_clock is true, and
//                                 inventing one is exactly what this rewrite exists to stop.
//   impact          omitted     - the reference's money figures are per-metric display strings
//                                 ("+$41K", "$28K") inside `totals`/`heroMetrics`, with no single
//                                 field designated as THE impact. It is carried as those rows, and
//                                 the scalar is left absent rather than picked arbitrarily.
const UNRESOLVED_CONTRACT_CLASS = 'standard'
const UNRESOLVED_ENTITLEMENT = 'full'
// `on_clock` is NO LONGER unresolved. It was `false` on 105 of 105 — the exact shape of the
// `execLabel` defect the contract's own header warns about — which made Snooze dead on every object
// and the deadline chip unreachable. It is now derived from the reference's own `due`/`deadline`
// strings; see clockForStory below.

/**
 * The reference's own deadline strings, per story. A deadline is a STORY-level business fact — a
 * proposal does not acquire and lose a clock as an operator walks its stages, and S9.19's title
 * literally is "Q4 calendar build — Prime Fall deadline Aug 21" — so a deadline found on any one of
 * a story's stage screens applies to all of them.
 *
 * `eta` is DELIBERATELY NOT a clock signal. "Receiving today", "arrives Sep 02" are arrival
 * estimates, not operator deadlines; treating them as the same thing would put a false clock on four
 * proposals and is exactly the kind of plausible-looking invention this pipeline must not make.
 *
 * The explicit NEGATIVES are preserved and matter: S9.19/execute says "not booked" and
 * S9.20/execute says "not sent". Those are the reference stating there is no clock, which is what
 * keeps this axis genuinely non-degenerate rather than newly-constant-true.
 */
const NO_CLOCK_PHRASES = /not booked|not sent|\bnone\b|n\/a/i

/** A relative ("9 days") or absolute ("Aug 22", "Aug 21 · 18:00") reference deadline -> an instant. */
function deadlineInstant(text, anchorIso) {
  const anchor = Date.parse(anchorIso)
  const relative = /^(\d+)\s*days?\b/i.exec(text)
  if (relative) return new Date(anchor + Number(relative[1]) * 86_400_000).toISOString()

  const absolute = /\b([A-Z][a-z]{2})\s+(\d{1,2})\b/.exec(text)
  if (absolute) {
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(absolute[1])
    if (month >= 0) {
      const hhmm = /(\d{1,2}):(\d{2})/.exec(text)
      const year = new Date(anchor).getUTCFullYear()
      const at = Date.UTC(year, month, Number(absolute[2]), hhmm ? Number(hhmm[1]) : 17, hhmm ? Number(hhmm[2]) : 0)
      // A month earlier than the anchor's belongs to the next year, not the past.
      return new Date(at >= anchor ? at : Date.UTC(year + 1, month, Number(absolute[2]), 17, 0)).toISOString()
    }
  }
  return undefined
}

const CATEGORY_TO_ACTION_TYPE = {
  Repricing: 'reprice', Markdown: 'reprice', Competitive: 'reprice',
  Replenishment: 'reorder', 'Working capital': 'reorder',
  Allocation: 'reallocate', 'Peak readiness': 'reallocate',
  Assortment: 'adjust_assortment', Exit: 'adjust_assortment', Lifecycle: 'adjust_assortment', Launch: 'adjust_assortment',
  Advertising: 'adjust_spend', 'Promo calendar': 'adjust_spend',
  Listings: 'fix_listing', 'Catalog integrity': 'fix_listing', 'Search visibility': 'fix_listing',
  Returns: 'file_claim', 'Fee integrity': 'file_claim',
}

/**
 * Axis 1, derived from the proposal's real item count rather than hard-coded. The item set lives on
 * the DECIDE stage — it is the same proposal at every stage, so one derivation serves all of them.
 * `many` gates `approve_selected`; `one` is a real outcome and the template table covers both.
 */
function cardinalityFor(code, decideData) {
  if (!decideData) return 'one'
  const rec = makeRecorder()
  const items =
    pick(decideData, ['groups'], isObjArray, rec, 'x') ??
    slateOf(decideData, `${code}/decide`, makeRecorder()) ??
    pick(decideData, ['focusRows'], isTabular, rec, 'x')
  return Array.isArray(items) && items.length > 1 ? 'many' : 'one'
}

// ---- main --------------------------------------------------------------------------------------

function readFixture(code, stage) {
  const file = path.join(CORPUS, 'fixtures/raw', code, `${stage}.json`)
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).data ?? {}) : null
}

/** Sibling of readFixture that reads the SAME file's `headings` (raw key -> reference caption,
 * extraction/parseMockup.js's extractSlotHeadings) instead of `data` — kept separate rather than
 * folded into readFixture's return shape, which every existing call site already treats as the data
 * object itself. */
function readFixtureHeadings(code, stage) {
  const file = path.join(CORPUS, 'fixtures/raw', code, `${stage}.json`)
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).headings ?? {}) : {}
}

function main() {
  const index = JSON.parse(fs.readFileSync(path.join(CORPUS, 'fixtures/index.json'), 'utf8'))
  const out = []
  const provenance = {}
  // A fixed instant: regeneration must produce a byte-identical file, and `updated_at` is
  // generation metadata, not a business fact the reference states.
  const GENERATED_AT = new Date(Date.parse('2026-09-15T09:00:00Z')).toISOString()

  for (const wf of index) {
    const ctx = referenceContextFor(wf.code)
    const cardinality = cardinalityFor(wf.code, readFixture(wf.code, 'decide'))

    // The story's clock, resolved ONCE across its stages (see NO_CLOCK_PHRASES above for why this is
    // story-level and why `eta` is excluded). A stage that states an explicit negative — "not
    // booked", "not sent" — is honoured as a negative for ITSELF even when the story has a deadline.
    const storyDeadlineText = wf.stages
      .map((s) => firstRawString(readFixture(wf.code, s) ?? {}, (k) => k === 'due' || k === 'deadline'))
      .find((t) => typeof t === 'string' && !NO_CLOCK_PHRASES.test(t))
    const storyDeadline = storyDeadlineText ? deadlineInstant(storyDeadlineText, GENERATED_AT) : undefined

    // ---- PROTOTYPE PLACEHOLDERS, resolved per STORY so its stages can never disagree (I4) -------
    // Every one of these is marked `(placeholder)` in provenance below. See the generator's own
    // header for why this reverses R1/R2 and what a real API deletes to undo it.
    // WHERE THE REFERENCE NAMES ONE, THAT IS THE STORY'S VALUE — for all three of the fields that
    // I4 requires to be stable per story. Hash-assigning independently satisfies I3 (never overwrite)
    // and breaks I4: S9.5's reference names `alder` on two of its four stages, so the other two would
    // carry `ridgeline` and one story would show two brands. Seeding the story from its OWN reference
    // value satisfies both — the named objects keep theirs, and their siblings inherit it.
    //
    // `channelOf`/`categoryOf` read the raw fixture, which is available here, so they resolve now.
    // `brandOf` reads the ASSEMBLED decision, which does not exist yet, so brand is reconciled in a
    // second pass below — against the same function on the same input the per-object path uses,
    // rather than an approximation of it that would silently disagree.
    const storyRef = (pick) => wf.stages
      .map((stage) => { const d = readFixture(wf.code, stage); return d ? pick(d) : null })
      .find((v) => v !== null && v !== undefined)
    const storyCategory = storyRef(categoryOf) ?? placeholderCategoryFor(wf.code)
    const storyChannel = storyRef(channelOf) ?? placeholderChannelFor(wf.code)
    /** The story's objects, for the brand reconciliation that can only run once all four are built. */
    const storyObjects = []
    // The story's own lead agent, propagated to the stages the reference does not credit. No name is
    // minted: this is the value the reason stage already carries.
    const storyAgentRows = wf.stages
      .map((stage) => clean(readFixture(wf.code, stage)?.agents))
      .find((rows) => isObjArray(rows) && isStr(rows[0]?.name))
    const storyAgent = storyAgentRows?.[0]?.name ?? ctx.agents[0]
    // The story's impact, read from its own words. `title` alone decides the sign verbs; the prose
    // and then the totals supply the magnitude.
    const storyProse = [...new Set(wf.stages.flatMap((stage) => {
      const d = readFixture(wf.code, stage) ?? {}
      return [wf.headline ?? wf.name, narrativeOf(d, stage, makeRecorder()), d.footStatus, d.footerStatus]
    }).filter(isStr))]
    const storyTotals = wf.stages.flatMap((stage) => {
      const rows = pick(readFixture(wf.code, stage) ?? {}, ['totals', 'rollup', 'summary', 'liveStats'], isLabelled, makeRecorder(), 'x')
      return isObjArray(rows) ? rows.map((r) => `${r.label ?? ''} ${r.value ?? ''}`) : []
    })
    const storyImpact = placeholderImpactFor(wf.headline ?? wf.name, storyProse, storyTotals)
    // The reference orders its lens line primary-first ("Sales · Margin"). S10.6 declares
    // "all five" and names no primary, so its own lead KPI tile supplies one; that single case is
    // recorded as an open contract item rather than hidden.
    const lens = ctx.lenses[0] ?? leadLensFromLiveTiles(wf.code) ?? 'sales'
    const persona = ctx.persona ?? 'merchandiser'

    for (const stage of wf.stages) {
      const data = readFixture(wf.code, stage)
      if (data === null) continue
      const stageId = `${wf.code}/${stage}`
      const rec = makeRecorder()
      const proposalId = `prop_${wf.code.replace('.', '_').toLowerCase()}_${stage}`

      // RESOLUTION ORDER IS THE CONTRACT. The claim ledger gives each raw key to exactly one
      // canonical field, so the most specifically-named concepts resolve first and the broadest
      // ones (the slate, the evidence table) last, seeing only what is genuinely left over.
      const narrative = narrativeOf(data, stage, rec)
      // The stage's own one-line state, which every reference screen prints in its footer
      // ("Decide · 56 SKUs across 4 moves · balanced slate"). Real business content on 38 screens,
      // previously dropped in full.
      const statusNote = pick(data, ['footStatus', 'footerStatus'], isStr, rec, 'status_note')
      const guardrails = guardrailsOf(data, rec)
      // R16. `dropUndefined({rows: undefined})` returns `{}`, which is not `undefined`, so the outer
      // dropUndefined kept it and `totals` was an empty object on 82 of 105 — a key that made a
      // 105/105 population claim technically true and substantively false. Emitted only when it has
      // content; absent otherwise, which is what the other 82 objects actually mean.
      const totalsRows = pick(data, ['totals', 'rollup', 'summary', 'liveStats'], isLabelled, rec, 'totals.rows')
      const totals = totalsRows === undefined ? undefined : { rows: totalsRows }

      const proposal =
        stage === 'reason' ? reasonProposal(data, ctx, rec)
        : stage === 'analyze' ? analyzeProposal(data, stageId, narrative, rec)
        : stage === 'decide' ? decideProposal(data, stageId, rec)
        : {}

      const execution =
        stage === 'execute' ? executeExecution(data, stageId, rec)
        : stage === 'live' ? liveExecution(data, rec)
        : undefined

      const confidence = confidenceFrom(data)
      rec.record('confidence', confidence === undefined ? null : 'confLabel')

      // This stage's own clock. The story's deadline applies unless THIS screen states an explicit
      // negative ("not booked", "not sent"), which is the reference saying there is nothing booked
      // to be late for. Those two survive as `false` and are what keep the axis honest.
      const ownDeadlineText = firstRawString(data, (k) => k === 'due' || k === 'deadline')
      const statesNoClock = typeof ownDeadlineText === 'string' && NO_CLOCK_PHRASES.test(ownDeadlineText)
      const onClock = Boolean(storyDeadline) && !statesNoClock
      // `deadline` CLAIMS the raw key; `on_clock` is derived from whether that produced a value, so
      // its provenance must not name the key a second time — one raw key, one canonical field.
      rec.record('deadline', onClock ? 'due/deadline' : null)
      rec.record('on_clock', onClock ? '(derived from deadline)' : null)

      const decision = dropUndefined({
        proposal_id: proposalId,
        story_code: wf.code,
        stage,
        action_type: CATEGORY_TO_ACTION_TYPE[wf.name] ?? 'review',

        cardinality,
        contract_class: UNRESOLVED_CONTRACT_CLASS,
        on_clock: onClock,
        mode: modeFrom(data),
        entitlement: UNRESOLVED_ENTITLEMENT,
        lens,
        persona,

        deadline: onClock ? storyDeadline : undefined,

        title: wf.headline ?? wf.name,
        narrative,
        status_note: statusNote,

        confidence,

        eligibility: eligibilityOf(data, { stage, onClock, entitlement: UNRESOLVED_ENTITLEMENT }),
        guardrails,

        proposal,
        totals,
        execution,

        status: 'pending',
        updated_at: GENERATED_AT,
      })

      // ---- the required-and-nullable fields (R1) --------------------------------------------------
      //
      // Assigned AFTER `dropUndefined`, because `null` here is a real value the contract requires to
      // be present and dropUndefined would not distinguish it from an omission. Each is `null`
      // wherever the reference does not state it; none is inferred from a title or a hash.
      //
      // REFERENCE VALUE WINS, ALWAYS (I3). The placeholder fills the gap and never overwrites — the
      // 54 reference-derived values are asserted byte-identical before and after by
      // __corpus__/placeholders.test.js's T42, against a committed pre-phase snapshot.
      const refBrand = brandOf(decision)
      const refChannel = channelOf(data)
      const refCategory = categoryOf(data)
      const refAgent = agentOf(proposal)

      decision.impact = storyImpact ?? null
      decision.brand = refBrand // reconciled across the story below
      decision.channel = refChannel ?? storyChannel
      decision.category = refCategory ?? storyCategory
      decision.agent = refAgent ?? storyAgent

      // THE MARKER (R35). provenance.json already answers "where did this field come from", per
      // object per field, with null meaning the reference is silent. A placeholder is a third answer
      // to that same question, so it is a third value — not a flag inside the Decision Object, which
      // would ship prototype scaffolding in a payload a real API would never send.
      rec.record('impact', decision.impact === null ? null : PLACEHOLDER)
      rec.record('brand', refBrand ? '(reference sub-brand)' : null) // rewritten by the reconciliation
      rec.record('channel', refChannel ? 'channel' : PLACEHOLDER)
      rec.record('category', refCategory ? 'category' : PLACEHOLDER)
      // NOT `'agents'` for the reference case: that raw key is already claimed by `proposal.agents`,
      // and naming it twice would be the exact double-claim referenceFidelity.test.js exists to
      // catch. `agent` is derived FROM the canonical field, so its provenance says so.
      rec.record('agent', refAgent ? '(proposal.agents lead)' : PLACEHOLDER)

      // `approve` is stamped from the SINGLE PRODUCER, not generated here. The field has to be
      // present because the Decision Object contract requires it, but the value is
      // contract/deriveEligibility.js's answer about the object as assembled above — so this
      // pipeline can no longer imply a guarantee it does not make.
      //
      // `blocked_reason` still prefers the reference corpus's own `blockReason` when the derivation
      // has already decided to block. That string is extracted CONTENT, not a rule: "Full-launch
      // exposure of $92.5K breaks the $75K appetite set in Reason" is business prose off the
      // mockup, and it never influences whether approval is blocked — only how that is explained.
      const derivedApprove = deriveApproveEligibility(decision)
      const derivedApproveSelected = deriveApproveSelectedEligibility(decision)
      const copy = (derived) =>
        derived.allowed
          ? { allowed: true }
          : { allowed: false, blocked_reason: isStr(data.blockReason) ? data.blockReason : derived.reason }
      decision.eligibility = {
        approve: copy(derivedApprove),
        approve_selected: copy(derivedApproveSelected),
        ...decision.eligibility,
      }

      rec.record('lens', ctx.lenses.length > 0 ? '(reference pinned strip)' : '(reference live KPI tiles)')
      rec.record('persona', ctx.persona ? '(reference pinned strip)' : null)
      rec.record('mode', typeof data.execLabel === 'string' ? 'execLabel' : null)
      rec.record('cardinality', '(derived from the decide-stage item count)')

      // The reference's own caption for each field this object actually populated — see
      // titlesFrom's own doc comment for why this has to be resolved per OBJECT (from rec.sources,
      // which raw key each field claimed on THIS screen) rather than once per canonical slot: the
      // same slot can be fed by different raw keys on different screens (S9.11's `trigger` comes
      // from `opportunity`, captioned "The opportunity"; S10.1's own `trigger` is captioned "What
      // raised this"), each with its own bespoke heading.
      const titles = titlesFrom(readFixtureHeadings(wf.code, stage), rec.sources)
      if (Object.keys(titles).length > 0) decision.titles = titles

      provenance[proposalId] = rec.sources
      storyObjects.push({ decision, rec })
      out.push(decision)
    }

    // THE BRAND RECONCILIATION (I3 + I4). One value for the whole story: the one its own reference
    // names if any stage names one, else the hash-assigned placeholder. Objects whose reference named
    // it keep it byte-identical — this only fills the nulls left above, and re-records their
    // provenance as a placeholder so the marker stays exact per object rather than per story.
    const storyBrand = storyObjects.map(({ decision }) => decision.brand).find(Boolean)
      ?? placeholderBrandFor(wf.code)
    for (const { decision, rec } of storyObjects) {
      if (decision.brand === null || decision.brand === undefined) {
        decision.brand = storyBrand
        rec.record('brand', PLACEHOLDER)
      }
    }
  }

  fs.mkdirSync(NORMALIZED, { recursive: true })
  // 1. The BUNDLE. One file, imported directly by the mock API — deliberately not a directory glob,
  //    because `import.meta.glob` over story data is exactly the runtime coupling this removes.
  fs.writeFileSync(OUT_DATASET, `${JSON.stringify(out, null, 2)}\n`)

  // 2. One file per Decision Object. Not loaded by anything — this is readable evidence, and the
  //    natural upload unit when a real API is provisioned.
  fs.rmSync(OUT_PROPOSALS, { recursive: true, force: true })
  fs.mkdirSync(OUT_PROPOSALS, { recursive: true })
  for (const d of out) {
    fs.writeFileSync(path.join(OUT_PROPOSALS, `${d.proposal_id}.json`), `${JSON.stringify(d, null, 2)}\n`)
  }

  // 3. The PROVENANCE map: for every canonical field, the raw reference key that produced it, or
  //    null where the reference offers no semantic source and the field is therefore absent. This
  //    is the artifact normalizedProvenance.test.js asserts against.
  fs.writeFileSync(OUT_PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`)

  // 4. One representative per template family, for contract review without reading 105 files.
  fs.rmSync(OUT_EXAMPLES, { recursive: true, force: true })
  fs.mkdirSync(OUT_EXAMPLES, { recursive: true })
  const families = [
    ['reason.v1', (d) => d.stage === 'reason'],
    ['analyze.compare.v1', (d) => d.stage === 'analyze'],
    ['decide.slate.v1', (d) => d.stage === 'decide'],
    ['execute.bridge.v1', (d) => d.stage === 'execute'],
  ]
  for (const [id, match] of families) {
    const example = out.find(match)
    if (example) fs.writeFileSync(path.join(OUT_EXAMPLES, `${id}.json`), `${JSON.stringify(example, null, 2)}\n`)
  }

  report(out, provenance)
}

/** S10.6 declares "Lens: all five"; its own live screen leads with one KPI tile, which names it. */
function leadLensFromLiveTiles(code) {
  const live = readFixture(code, 'live')
  const lead = live?.lensTiles?.[0]?.lens
  return typeof lead === 'string' ? lead.toLowerCase() : undefined
}

function report(out, provenance) {
  const byStage = {}
  for (const d of out) byStage[d.stage] = (byStage[d.stage] ?? 0) + 1
  const fields = Object.values(provenance).flatMap((s) => Object.entries(s))
  const filled = fields.filter(([, v]) => v !== null).length

  console.log(`Normalized ${out.length} Decision Objects across ${new Set(out.map((d) => d.story_code)).size} Action Stories`)
  console.log(`  stages: ${Object.entries(byStage).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  console.log(`  canonical fields filled from a named reference source: ${filled} of ${fields.length}`)
  console.log(`  cardinality: ${JSON.stringify(tally(out, 'cardinality'))}`)
  console.log(`  mode:        ${JSON.stringify(tally(out, 'mode'))}`)
  console.log(`  lens:        ${JSON.stringify(tally(out, 'lens'))}`)
  console.log(`  -> ${path.relative(REPO_ROOT, OUT_DATASET)} (bundle, imported by the mock API)`)
  console.log(`  -> ${path.relative(REPO_ROOT, OUT_PROPOSALS)}/ (${out.length} files, evidence)`)
  console.log(`  -> ${path.relative(REPO_ROOT, OUT_PROVENANCE)} (field -> reference source)`)
}

function tally(out, key) {
  const t = {}
  for (const d of out) t[d[key]] = (t[d[key]] ?? 0) + 1
  return t
}

main()
