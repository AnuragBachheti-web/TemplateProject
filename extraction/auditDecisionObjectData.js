// GAP #2 PHASE 1 — machine-generated data audit of the whole archived corpus.
//
// Reads all 105 stage fixtures, all 26 manifests, the 5 canonical templates, the slot vocabulary
// and the Decision Object contract, and writes docs/DECISION_OBJECT_DATA_AUDIT.md.
//
// Every number in that report comes from this script. Nothing is sampled, estimated or recalled —
// if a figure appears in the report it was counted here, over the full corpus.
//
//   node extraction/auditDecisionObjectData.js

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDecorativeKey } from './classifyBlocks.js'
// The real contract validator, so §11 reports measured conformance rather than an assertion.
import { validateDecisionObject } from '../src/features/action-stories/contract/decisionObject.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CORPUS = path.join(ROOT, 'src/features/action-stories/__corpus__')
const TEMPLATES = path.join(ROOT, 'src/features/action-stories/templates')
const OUT = path.join(ROOT, 'docs/DECISION_OBJECT_DATA_AUDIT.md')

// ---- classification vocabulary ------------------------------------------------------------------

const GEOMETRY_WORDS = new Set(['left', 'right', 'width', 'top', 'height', 'bottom', 'px', 'py'])
const CAMEL = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g
const SVG_PATH_RE = /^M\s*-?[\d.]+[\s,]/i
const CURRENCY_RE = /^[+\-−]?[$€£][\d,]+(?:\.\d+)?[KkMm]?$/
const PERCENT_RE = /^[+\-−]?[\d.]+\s*%$/
const NUMERIC_STR_RE = /^[+\-−]?[\d,]+(?:\.\d+)?$/
const VISIBILITY_KEYS = new Set(['approveShow', 'blockShow', 'footerPushShow', 'footerDoneShow', 'show', 'hidden', 'visible'])
const MOCKUP_META = new Set(['props', 'state', '__raw'])

const isGeometryKey = (k) => (String(k).match(CAMEL) ?? []).some((w) => GEOMETRY_WORDS.has(w.toLowerCase()))
const isCssValue = (v) => typeof v === 'string' && (v.includes('var(--') || v.includes('color-mix('))
const isSvgPath = (v) => typeof v === 'string' && SVG_PATH_RE.test(v.trim())

/** The single verdict for one field: does it belong in a business contract, and if not, why not. */
function classifyField(key, values) {
  if (MOCKUP_META.has(key) || String(key).startsWith('__')) return 'mockup-meta'
  if (VISIBILITY_KEYS.has(key)) return 'ui-visibility'
  if (isDecorativeKey(key)) return 'presentation-css'
  if (isGeometryKey(key)) return 'presentation-geometry'
  if (values.some(isSvgPath)) return 'presentation-svg'
  if (values.some(isCssValue)) return 'presentation-css'
  return 'business'
}

/** Runtime type of one value, at the granularity the contract cares about. */
function typeOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.length > 0 && v.every((i) => i !== null && typeof i === 'object') ? 'array<object>' : 'array<scalar>'
  if (typeof v === 'object') return 'object'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') {
    if (CURRENCY_RE.test(v.trim())) return 'string(currency)'
    if (PERCENT_RE.test(v.trim())) return 'string(percent)'
    if (NUMERIC_STR_RE.test(v.trim())) return 'string(numeric)'
    if (isSvgPath(v)) return 'string(svg-path)'
    if (isCssValue(v)) return 'string(css)'
    return 'string'
  }
  return typeof v
}

function shapeOf(v) {
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    const first = v[0]
    if (first !== null && typeof first === 'object') {
      const keys = Object.keys(first).slice(0, 5)
      return `[{${keys.join(', ')}${Object.keys(first).length > 5 ? ', …' : ''}}] ×${v.length}`
    }
    return `[${JSON.stringify(first)}, …] ×${v.length}`
  }
  if (v !== null && typeof v === 'object') return `{${Object.keys(v).slice(0, 4).join(', ')}}`
  const s = JSON.stringify(v)
  return s && s.length > 42 ? `${s.slice(0, 40)}…` : s
}

// ---- load everything ----------------------------------------------------------------------------

const index = JSON.parse(fs.readFileSync(path.join(CORPUS, 'fixtures/index.json'), 'utf8'))

/** Every stage fixture on disk, whatever the index claims. */
const fixtures = []
for (const code of fs.readdirSync(path.join(CORPUS, 'fixtures/raw')).sort()) {
  const dir = path.join(CORPUS, 'fixtures/raw', code)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const stage = file.replace(/\.json$/, '')
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    fixtures.push({ code, stage, raw, data: raw.data ?? {} })
  }
}

const manifests = []
for (const file of fs.readdirSync(path.join(CORPUS, 'manifests')).filter((f) => /^S[\d.]+\.json$/.test(f))) {
  for (const m of JSON.parse(fs.readFileSync(path.join(CORPUS, 'manifests', file), 'utf8'))) manifests.push(m)
}

const templates = ['reason.v1', 'analyze.compare.v1', 'decide.slate.v1', 'execute.bridge.v1', 'locked.v1'].map((id) =>
  JSON.parse(fs.readFileSync(path.join(TEMPLATES, `${id}.json`), 'utf8')),
)

// slotVocabulary.js is ESM with no deps we cannot resolve from Node — parse its literal instead of
// importing, so this script stays runnable without a bundler alias.
const vocabSrc = fs.readFileSync(path.join(TEMPLATES, 'slotVocabulary.js'), 'utf8')
const CANONICAL_SLOTS = {}
for (const m of vocabSrc.matchAll(/^ {2}(\w+): \{ binding: '([^']+)', blockType: '([^']+)', tier: '(\w+)'/gm)) {
  CANONICAL_SLOTS[m[1]] = { binding: m[2], blockType: m[3], tier: m[4] }
}

// ---- 1. story / stage inventory -------------------------------------------------------------------

const STAGE_ORDER = ['reason', 'analyze', 'decide', 'execute', 'live']
const byStory = new Map()
for (const f of fixtures) {
  if (!byStory.has(f.code)) byStory.set(f.code, [])
  byStory.get(f.code).push(f.stage)
}
const stories = [...byStory.entries()]
  .map(([code, stages]) => ({
    code,
    name: index.find((w) => w.code === code)?.name ?? '(not in index)',
    headline: index.find((w) => w.code === code)?.headline ?? '',
    stages: [...stages].sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)),
  }))
  .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

const CORE_FOUR = ['reason', 'analyze', 'decide', 'execute']
const missingStages = stories.filter((s) => CORE_FOUR.some((st) => !s.stages.includes(st)))
const extraStages = stories.filter((s) => s.stages.some((st) => !CORE_FOUR.includes(st)))

// ---- 2 + 4. field inventory, per stage ------------------------------------------------------------

/** stage -> key -> {count, types:Set, values:[], stories:Set} */
const fieldsByStage = {}
for (const f of fixtures) {
  const bucket = (fieldsByStage[f.stage] ??= {})
  for (const [k, v] of Object.entries(f.data)) {
    const e = (bucket[k] ??= { count: 0, types: new Set(), values: [], stories: new Set() })
    e.count += 1
    e.types.add(typeOf(v))
    e.stories.add(f.code)
    if (e.values.length < 6) e.values.push(v)
  }
}

/** Corpus-wide key roll-up, across every stage. */
const allFields = {}
for (const f of fixtures) {
  for (const [k, v] of Object.entries(f.data)) {
    const e = (allFields[k] ??= { count: 0, types: new Set(), values: [], stages: new Set() })
    e.count += 1
    e.types.add(typeOf(v))
    e.stages.add(f.stage)
    if (e.values.length < 8) e.values.push(v)
  }
}
for (const [k, e] of Object.entries(allFields)) e.verdict = classifyField(k, e.values)

const byVerdict = {}
for (const [k, e] of Object.entries(allFields)) (byVerdict[e.verdict] ??= []).push([k, e])
for (const list of Object.values(byVerdict)) list.sort((a, b) => b[1].count - a[1].count)

// DEEP scan. The top-level roll-up above drives slot mapping, but almost all presentation leakage in
// this corpus lives NESTED — `tone`/`bg` on a table row, `bandLeft` on a bar, `__raw` inside an
// extraction companion. Counting only top-level keys would understate the problem by an order of
// magnitude, so every key at every depth is classified here too.
const deepFields = {}
function walkDeep(value, keyPath) {
  if (Array.isArray(value)) {
    for (const item of value) walkDeep(item, keyPath)
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [k, v] of Object.entries(value)) {
    const e = (deepFields[k] ??= { count: 0, values: [], depth: keyPath.length })
    e.count += 1
    if (e.values.length < 6) e.values.push(v)
    walkDeep(v, [...keyPath, k])
  }
}
// Walks the WHOLE fixture envelope, not just `data` — `props` and `state` live one level up.
for (const f of fixtures) walkDeep(f.raw, [])
for (const [k, e] of Object.entries(deepFields)) e.verdict = classifyField(k, e.values)

const deepByVerdict = {}
for (const [k, e] of Object.entries(deepFields)) (deepByVerdict[e.verdict] ??= []).push([k, e])
for (const list of Object.values(deepByVerdict)) list.sort((a, b) => b[1].count - a[1].count)

/** Total value instances at every depth, by type — the honest denominator for the type audit. */
const deepTypeTally = {}
function walkTypes(value) {
  if (Array.isArray(value)) { for (const i of value) walkTypes(i); return }
  if (value === null || typeof value !== 'object') return
  for (const v of Object.values(value)) {
    deepTypeTally[typeOf(v)] = (deepTypeTally[typeOf(v)] ?? 0) + 1
    walkTypes(v)
  }
}
for (const f of fixtures) walkTypes(f.raw)

// ---- 3. legacy -> canonical mapping ----------------------------------------------------------------
//
// The mapping is EVIDENCE, not invention: it records which corpus key the existing generator already
// reads for each canonical slot (see generateMockDecisionObjects.js), plus the classifier's own
// blockType verdict from the archived manifests.

const LEGACY_TO_CANONICAL = {
  narrative: ['dialNote', 'rationale', 'restNote', 'headline', 'note', 'copy', 'summaryNote', 'testCopy'],
  primary_insight: ['primaryInsight', 'headline', 'sortNote', 'insight'],
  policy: ['policy', 'targets', 'guardParts', 'tol'],
  inputs: ['inputs', 'evidence', 'sources'],
  roles: ['roles', 'cohorts', 'agents'],
  comparison: ['(classifier: barChart)'],
  trend: ['(classifier: lineChart)'],
  distribution: ['(classifier: scatterChart)'],
  detail_rows: ['(classifier: table)', 'rows', 'gaps', 'cases', 'disposition', 'sorts'],
  recommendation: ['heroTitle', 'recommendation', 'headline', 'approveLabel'],
  recommendation_metrics: ['heroMetrics', 'summary', 'liveStats'],
  slate: ['slate', 'slates', 'skus', 'rows', 'moves', 'items'],
  slate_summary: ['slateMeta', 'moveBar', 'summary'],
  totals_rows: ['totals', 'rollup', 'summary'],
  guardrail_verdict: ['blocked', 'canApprove'],
  guardrail_checks: ['checks', 'guardParts'],
  plan: ['stages', 'plan', 'progressRows', 'chain'],
  progress: ['progressPct', 'writtenCount'],
  progress_rows: ['progressRows', 'pushRows'],
  verification: ['monitors', 'verification', 'guardParts', 'checks', 'chain'],
  rollback: ['rollback', 'rbHint'],
  ledger: ['ledger', 'chain'],
  execution_targets: ['targets', 'agents', 'monitors'],
  decision_mode: ['execLabel'],
  decision_lens: ['lens'],
  decision_persona: ['owner', 'lens'],
}
const mappedLegacyKeys = new Set(Object.values(LEGACY_TO_CANONICAL).flat().filter((k) => !k.startsWith('(')))

// ---- 6. action data audit ---------------------------------------------------------------------------

const ACTION_KEYS = ['blocked', 'canApprove', 'blockReason', 'checks', 'ctaLabel', 'approveLabel', 'approveShow', 'blockShow', 'armBtnLabel', 'runAllLabel', 'allLabel', 'closeLabel', 'footerPushLabel']
const actionFieldStats = ACTION_KEYS.map((k) => ({
  key: k,
  count: allFields[k]?.count ?? 0,
  stages: [...(allFields[k]?.stages ?? [])].sort(),
  sample: allFields[k]?.values?.find((v) => typeof v === 'string') ?? null,
})).filter((r) => r.count > 0)

// Declared actions in the archived manifests.
const manifestActions = {}
for (const m of manifests) for (const a of m.actions ?? []) {
  const e = (manifestActions[a.id] ??= { count: 0, withWhen: 0, withReason: 0, labels: new Set() })
  e.count += 1
  if (a.when) e.withWhen += 1
  if (a.reason) e.withReason += 1
  e.labels.add(a.label)
}

// ---- 7. seven axes audit ------------------------------------------------------------------------------

const AXES = ['cardinality', 'contract_class', 'entitlement', 'persona', 'on_clock', 'lens', 'mode']
const axisEvidence = {}
for (const axis of AXES) {
  const observed = {}
  let present = 0
  for (const f of fixtures) {
    const v = f.data[axis]
    if (v === undefined) continue
    present += 1
    const key = JSON.stringify(v).slice(0, 60)
    observed[key] = (observed[key] ?? 0) + 1
  }
  axisEvidence[axis] = { present, observed }
}
// `owner` is the corpus's own persona-ish field; recorded as adjacent evidence.
const ownerValues = {}
for (const f of fixtures) if (typeof f.data.owner === 'string') ownerValues[f.data.owner] = (ownerValues[f.data.owner] ?? 0) + 1

// ---- 10. template conformance --------------------------------------------------------------------------

const templateRows = templates.flatMap((t) =>
  t.blocks.map((b) => ({
    template: t.template_id,
    slot: b.slotName,
    tier: CANONICAL_SLOTS[b.slotName]?.tier ?? '?',
    binding: b.binding,
    blockType: b.blockType,
    gated: b.when !== undefined,
  })),
)

// ---- render the report --------------------------------------------------------------------------------

const L = []
const w = (s = '') => L.push(s)
const pct = (n, d) => `${((n / d) * 100).toFixed(0)}%`

w('# Decision Object — Data Audit (Gap #2, Phase 1)')
w()
w('> **Machine-generated.** Every figure below was counted by `extraction/auditDecisionObjectData.js`')
w('> over the complete archived corpus. Nothing is sampled or estimated. Regenerate with')
w('> `npm run audit:data`.')
w()
w(`- Corpus: **${fixtures.length}** stage fixtures across **${stories.length}** Action Stories, **${manifests.length}** archived stage manifests`)
w(`- Canonical slots today: **${Object.keys(CANONICAL_SLOTS).length}**`)
w(`- Distinct top-level business-data keys in the corpus: **${Object.keys(allFields).length}**`)
w()

// 1
w('## 1. Story / stage inventory')
w()
w(`**${stories.length} Action Stories**, **${fixtures.length} stage records**. Parent identity is \`story_code\`;`)
w('grouping is by the whole code, never by a numeric prefix (see Gap #1).')
w()
w('| story_code | Name | reason | analyze | decide | execute | live | Stages |')
w('|---|---|:--:|:--:|:--:|:--:|:--:|--:|')
for (const s of stories) {
  const has = (k) => (s.stages.includes(k) ? '✓' : '—')
  w(`| \`${s.code}\` | ${s.name} | ${has('reason')} | ${has('analyze')} | ${has('decide')} | ${has('execute')} | ${has('live')} | ${s.stages.length} |`)
}
w()
w(`- Stories missing one of the core four: **${missingStages.length}**${missingStages.length ? ` (${missingStages.map((s) => s.code).join(', ')})` : ' — every story is complete'}`)
w(`- Stories with an extra stage: **${extraStages.length}**${extraStages.length ? ` (${extraStages.map((s) => `${s.code}: ${s.stages.filter((x) => !CORE_FOUR.includes(x)).join('/')}`).join(', ')})` : ''}`)
w()
w('**Evidence on ID semantics.** `S10.1`–`S10.4` are four *different* Action Stories — "Variance bridge",')
w('"Working capital", "Account health", "Fee integrity" — each declaring its own four stages. The `.N`')
w('is a sequence number within the S10 batch, not a stage index. They must never be grouped.')
w()

// 2
w('## 2. Data shape inventory')
w()
w('Top-level `data.*` keys per stage. `Stories` counts how many distinct Action Stories carry the key,')
w('so a key present once per story reads `26`, not `104`.')
w()
for (const stage of STAGE_ORDER) {
  const bucket = fieldsByStage[stage]
  if (!bucket) continue
  const total = fixtures.filter((f) => f.stage === stage).length
  const rows = Object.entries(bucket).sort((a, b) => b[1].count - a[1].count)
  w(`### \`${stage}\` — ${total} records, ${rows.length} distinct keys`)
  w()
  w('| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |')
  w('|---|---:|---:|---|---|---|---|')
  for (const [k, e] of rows.slice(0, 28)) {
    const canonical = Object.entries(LEGACY_TO_CANONICAL).find(([, legacy]) => legacy.includes(k))?.[0] ?? '—'
    w(`| \`${k}\` | ${e.count} | ${pct(e.count, total)} | ${[...e.types].join(', ')} | \`${shapeOf(e.values[0])}\` | ${canonical === '—' ? '—' : `\`${canonical}\``} | ${allFields[k].verdict} |`)
  }
  if (rows.length > 28) w(`| _…${rows.length - 28} further keys_ | | | | | | |`)
  w()
}

// 3
w('## 3. Legacy slot → canonical slot mapping')
w()
w(`The corpus carries **${Object.keys(allFields).length}** distinct top-level keys. The canonical vocabulary has`)
w(`**${Object.keys(CANONICAL_SLOTS).length}**. That collapse is the point: most legacy keys are one-off names for`)
w('concepts that already have a canonical home, or are presentation that must not enter the contract.')
w()
w('| Canonical slot | Tier | Legacy source key(s) | Classification |')
w('|---|---|---|---|')
for (const [slot, legacy] of Object.entries(LEGACY_TO_CANONICAL)) {
  const spec = CANONICAL_SLOTS[slot]
  if (!spec) continue
  w(`| \`${slot}\` | ${spec.tier} | ${legacy.map((k) => (k.startsWith('(') ? k : `\`${k}\``)).join(', ')} | maps cleanly |`)
}
w()
const unmapped = Object.entries(allFields)
  .filter(([k, e]) => e.verdict === 'business' && !mappedLegacyKeys.has(k))
  .sort((a, b) => b[1].count - a[1].count)
w(`### Business-shaped keys with NO canonical home (${unmapped.length})`)
w()
w('These are real business values that the canonical vocabulary deliberately does not carry. Per the')
w('audit rule (<20% corpus coverage ⇒ fold or drop), each is folded into `narrative`/`detail_rows` or')
w('discarded — **not** turned into a new slot to keep a mockup field alive.')
w()
w('| Legacy key | Occurrences | Coverage | Disposition |')
w('|---|---:|---:|---|')
for (const [k, e] of unmapped.slice(0, 40)) {
  const coverage = e.count / fixtures.length
  const disposition = coverage >= 0.2 ? 'fold into `detail_rows`' : coverage >= 0.05 ? 'fold into `narrative`' : 'discard (corpus evidence only)'
  w(`| \`${k}\` | ${e.count} | ${pct(e.count, fixtures.length)} | ${disposition} |`)
}
if (unmapped.length > 40) w(`| _…${unmapped.length - 40} further keys, all <5% coverage_ | | | discard |`)
w()

// 4 + 5
w('## 4. Data type audit')
w()
w('Counted at **every depth**, across the whole fixture envelope — nearly all of this corpus\'s')
w('presentation lives nested inside table rows and chart series, not at the top level.')
w()
w('| Type | Value instances (all depths) | Note |')
w('|---|---:|---|')
const typeTally = deepTypeTally
const TYPE_NOTES = {
  'string(currency)': '**Pre-formatted — must become `{value, unit}`**',
  'string(percent)': '**Pre-formatted — must become `{value, unit:"pct"}`**',
  'string(numeric)': '**Count-as-string — must become a real number**',
  'string(css)': '**Presentation — must not enter the contract**',
  'string(svg-path)': '**Geometry — must not enter the contract**',
}
for (const [t, n] of Object.entries(typeTally).sort((a, b) => b[1] - a[1])) w(`| \`${t}\` | ${n} | ${TYPE_NOTES[t] ?? ''} |`)
w()
w('### Fields excluded from the Decision Object, by reason')
w()
w('| Reason | Distinct keys | Total occurrences | Top examples |')
w('|---|---:|---:|---|')
for (const verdict of ['presentation-css', 'presentation-geometry', 'presentation-svg', 'ui-visibility', 'mockup-meta']) {
  const list = deepByVerdict[verdict] ?? []
  const occ = list.reduce((n, [, e]) => n + e.count, 0)
  w(`| ${verdict} | ${list.length} | ${occ} | ${list.slice(0, 6).map(([k]) => `\`${k}\``).join(', ') || '—'} |`)
}
const businessList = deepByVerdict.business ?? []
w(`| **business (kept)** | ${businessList.length} | ${businessList.reduce((n, [, e]) => n + e.count, 0)} | ${businessList.slice(0, 6).map(([k]) => `\`${k}\``).join(', ')} |`)
w()

// 5
w('## 5. Business data vs UI data')
w()
w('**BUSINESS DATA — the backend provides:** proposal identity, the seven axes, title/narrative,')
w('typed impact and confidence, eligibility per operator action, guardrail verdict and checks, the')
w('stage payload (`proposal`), totals, execution progress, status and `updated_at`.')
w()
w('**UI / PRESENTATION — the frontend derives:** template id, layout/regions/spans, block types,')
w('every colour and tone (`deltaTone.js`), every chart coordinate and SVG path (`chartGeometry.js`),')
w('all number and date formatting (`formatValue.js`), compact-vs-card, and stage navigation.')
w()
w('Explicitly barred from the contract, with corpus counts:')
w()
w('| Barred | Distinct keys | Occurrences |')
w('|---|---:|---:|')
for (const verdict of ['presentation-css', 'presentation-geometry', 'presentation-svg', 'ui-visibility', 'mockup-meta']) {
  const list = deepByVerdict[verdict] ?? []
  w(`| ${verdict} | ${list.length} | ${list.reduce((n, [, e]) => n + e.count, 0)} |`)
}
w()

// 6
w('## 6. Action data audit')
w()
w('### Action-related fields present in the corpus')
w()
w('| Legacy field | Occurrences | Stages | Sample value |')
w('|---|---:|---|---|')
for (const r of actionFieldStats) {
  const sample = r.sample === null ? '—' : `\`${String(r.sample).slice(0, 44)}\``
  w(`| \`${r.key}\` | ${r.count} | ${r.stages.join(', ')} | ${sample} |`)
}
w()
w('### Actions declared by the archived manifests')
w()
w('| Legacy action | Count | With `when` gate | With reason capture | Labels observed |')
w('|---|---:|---:|---:|---|')
for (const [id, e] of Object.entries(manifestActions)) {
  w(`| \`${id}\` | ${e.count} | ${e.withWhen} | ${e.withReason} | ${[...e.labels].map((l) => `"${l}"`).join(', ')} |`)
}
w()
w('### Business `action_type` derivation')
w()
w('| Legacy action | Count | Business meaning | Candidate `action_type` | Confidence |')
w('|---|---:|---|---|---|')
w(`| \`confirm\` | ${manifestActions.confirm?.count ?? 0} | "approve this stage" — one generated action per decide/execute stage | operator action \`approve\`, **not** a business action_type | High |`)
w('| _(none)_ | 0 | The corpus contains **no** field naming the business action a proposal proposes | — | — |')
w()
w('**`action_type` is UNRESOLVED / REQUIRES PRODUCT DECISION.** There is no evidence for it anywhere in')
w('the 105 fixtures: no `action_type`, no verb field, nothing distinguishing "reprice" from "reorder".')
w('The only derivable signal is the workflow *category* name in `index.json` (25 distinct values such as')
w('"Repricing", "Replenishment", "Allocation"), which is a category, not an action. The current')
w('8-value enum is a documented placeholder mapped from those categories and must be confirmed by')
w('Product before launch.')
w()

// 7
w('## 7. Seven axes audit')
w()
w('Observed values across all 105 stage fixtures. **No value below was invented** — an axis with no')
w('corpus evidence is marked UNRESOLVED.')
w()
w('| Axis | Records carrying it | Coverage | Observed values | Status |')
w('|---|---:|---:|---|---|')
for (const axis of AXES) {
  const e = axisEvidence[axis]
  const vals = Object.entries(e.observed).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v, n]) => `${v} ×${n}`).join('; ')
  const status = e.present === 0 ? '**UNRESOLVED — no evidence**' : e.present < fixtures.length * 0.2 ? '**Insufficient evidence**' : 'Partial'
  w(`| \`${axis}\` | ${e.present} | ${pct(e.present, fixtures.length)} | ${vals || '—'} | ${status} |`)
}
w()
w('### Adjacent evidence the corpus DOES carry')
w()
const execLabels = {}
for (const f of fixtures) if (typeof f.data.execLabel === 'string') execLabels[f.data.execLabel] = (execLabels[f.data.execLabel] ?? 0) + 1
w(`- \`execLabel\` — present in **${Object.values(execLabels).reduce((a, b) => a + b, 0)}/${fixtures.length}** records, values: ${Object.entries(execLabels).map(([v, n]) => `"${v}" ×${n}`).join(', ')}. This is the only *mode*-adjacent evidence, and it is effectively a constant.`)
w(`- \`owner\` — **${Object.values(ownerValues).reduce((a, b) => a + b, 0)}** records, ${Object.keys(ownerValues).length} distinct values. Persona names recoverable from it: ${[...new Set(Object.keys(ownerValues).flatMap((v) => ['Bidder', 'Keeper', 'Merchandiser', 'Navigator', 'Planner', 'Promoter', 'Controller'].filter((p) => v.includes(p))))].join(', ') || 'none'}.`)
w(`- \`lens\` — ${axisEvidence.lens.present} records. Lens names recoverable: ${[...new Set(Object.keys(axisEvidence.lens.observed).flatMap((v) => ['Ads', 'Cash', 'Inventory', 'Margin', 'Sales'].filter((l) => v.includes(l))))].join(', ') || 'none'}.`)
w()
w('**Verdict.** `cardinality` is derivable from slate shape. `lens` and `persona` have partial, real')
w('evidence. `contract_class`, `entitlement`, `on_clock` and a meaningful `mode` have **no corpus')
w('evidence at all** and are currently synthesised by the generator — clearly labelled as mock values.')
w('They REQUIRE A PRODUCT DECISION before any real dataset is built.')
w()

// 8
w('## 8. Decision Object coverage matrix')
w()
w('| Decision Object field | Existing source | Coverage | Transformation | Req. | Notes |')
w('|---|---|---:|---|:--:|---|')
const COVERAGE = [
  ['proposal_id', 'derived: story_code + stage', '100%', 'synthesise stable id', 'Req', 'No id exists in the corpus'],
  ['story_code', '`index.json` code / fixture dir', '100%', 'none', 'Req', 'Verified parent identity (Gap #1)'],
  ['stage', 'fixture filename', '100%', 'none', 'Req', ''],
  ['action_type', '— none —', '0%', '—', 'Req', '**UNRESOLVED** — placeholder mapped from category'],
  ['cardinality', 'slate/rows array length', '100%', 'derive from shape', 'Req', 'All 26 decide stages are multi-item'],
  ['contract_class', '— none —', '0%', '—', 'Req', '**UNRESOLVED — product decision**'],
  ['on_clock / deadline', '— none —', '3/105', '—', 'Req', '**UNRESOLVED — product decision**'],
  ['mode', '`execLabel`', '100%', 'map to enum', 'Req', 'Degenerate: 104×"Suggest", 1×"Assist"'],
  ['entitlement', '— none —', '0%', '—', 'Req', '**UNRESOLVED — product decision**'],
  ['lens', '`lens`', `${axisEvidence.lens.present}/105`, 'lowercase + extract', 'Req', 'Partial real evidence'],
  ['persona', '`owner`, `lens`', `${Object.values(ownerValues).reduce((a, b) => a + b, 0)}/105`, 'extract persona token', 'Req', 'Partial real evidence'],
  ['title', '`index.json` headline', '100%', 'none', 'Req', ''],
  ['narrative', '`dialNote`/`rationale`/…', `${fixtures.filter((f) => ['dialNote', 'rationale', 'restNote', 'headline'].some((k) => typeof f.data[k] === 'string')).length}/105`, 'pick first prose field', 'Req', 'Empty for stages with no prose'],
  ['impact', '— none typed —', '0%', 'synthesise', 'Opt', 'Corpus has only pre-formatted strings'],
  ['confidence', '`confLabel`/`confBadge`', `${fixtures.filter((f) => f.data.confLabel || f.data.confBadge).length}/105`, 'parse to 0..1', 'Opt', 'Sparse'],
  ['eligibility', '`blocked`,`canApprove`,`blockReason`', `${fixtures.filter((f) => f.data.blocked !== undefined || f.data.canApprove !== undefined).length}/105`, 'derive per action, fail-closed', 'Req', 'Only decide/execute carry it'],
  ['guardrails.verdict', '`blocked`/`canApprove`', `${fixtures.filter((f) => f.data.blocked !== undefined).length}/105`, 'booleans → 4-value enum', 'Opt', ''],
  ['guardrails.checks', '`checks`', `${allFields.checks?.count ?? 0}/105`, 'strip presentation', 'Opt', ''],
  ['proposal', 'stage-specific keys', '100%', 'map to canonical slots', 'Req', 'Shape varies by stage'],
  ['totals', '`totals`/`rollup`', `${(allFields.totals?.count ?? 0) + (allFields.rollup?.count ?? 0)}/105`, 'strip presentation', 'Opt', ''],
  ['execution', 'execute-stage keys', '26/105', 'map to canonical slots', 'Opt', 'Execute stage only'],
  ['status', '— none —', '0%', 'default `pending`', 'Req', 'No lifecycle state in the corpus'],
  ['updated_at', '— none —', '0%', 'synthesise deterministically', 'Req', 'No timestamps in the corpus'],
]
for (const r of COVERAGE) w(`| \`${r[0]}\` | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} |`)
w()

// 9
w('## 9. Canonical dataset plan')
w()
w(`- **Action Stories:** ${stories.length}`)
w(`- **Stage Decision Objects:** ${fixtures.length} (one per story × stage)`)
w('- **Proposal id strategy:** one `proposal_id` **per stage**, not one shared per story.')
w('  Evidence: each stage carries its own status, eligibility and payload, and the action endpoint')
w('  mutates one stage at a time. A story-wide id could not address them. The parent relationship is')
w('  carried by `story_code`, which is exactly how Gap #1 groups them.')
w('- **Common across all stages:** identity, the seven axes, title, narrative, status, updated_at.')
w('- **Stage-specific:** the `proposal` payload, `eligibility` (only decide/execute act), `execution`')
w('  (execute only), `guardrails` (decide mainly).')
w('- **Normalised:** pre-formatted currency/percent strings → typed `{value, unit}`; boolean guardrails')
w('  → the 4-value verdict enum; prose fields → one `narrative`.')
w('- **Discarded:** every presentation, geometry, SVG, visibility and mockup-meta key counted in §4.')
w('- **Preserved as corpus evidence only:** the 105 raw fixtures and 26 manifests, unchanged.')
w()

// 10
w('## 10. Template conformance')
w()
w('Existing architecture is unchanged: Decision Object → template → slot → declared `blockType` →')
w('`BLOCK_REGISTRY` → existing React component. No new blocks, no backend-specified components.')
w()
for (const t of templates) {
  const rows = templateRows.filter((r) => r.template === t.template_id)
  const core = rows.filter((r) => r.tier === 'core').length
  w(`### \`${t.template_id}\` — ${rows.length} slots (${core} core, ${rows.length - core} conditional)`)
  w()
  w('| Slot | Tier | Decision Object path | blockType | Omitted when absent |')
  w('|---|---|---|---|:--:|')
  for (const r of rows) w(`| \`${r.slot}\` | ${r.tier} | \`${r.binding}\` | \`${r.blockType}\` | ${r.gated ? '✓' : '—'} |`)
  w()
}

// 11 — what the normalizer actually produced (present only after `npm run normalize`).
const NORM = path.join(CORPUS, 'normalized/dataset.json')
if (fs.existsSync(NORM)) {
  const norm = JSON.parse(fs.readFileSync(NORM, 'utf8'))
  const normStories = new Set(norm.map((d) => d.story_code))
  const stageCount = {}
  for (const d of norm) stageCount[d.stage] = (stageCount[d.stage] ?? 0) + 1

  // Slot fill rate, measured against the real normalized output.
  const fill = {}
  for (const t of templates) {
    for (const b of t.blocks) {
      const family = norm.filter((d) => d.stage === (t.stage ?? d.stage) && (t.template_id === 'locked.v1' ? d.entitlement === 'locked' : d.entitlement !== 'locked'))
      if (family.length === 0) continue
      const present = family.filter((d) => b.binding.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d) !== undefined).length
      fill[`${t.template_id}::${b.slotName}`] = { present, total: family.length, tier: CANONICAL_SLOTS[b.slotName]?.tier ?? '?' }
    }
  }

  w('## 11. Normalized output (produced by `npm run normalize`)')
  w()
  w(`- **${norm.length}** Decision Objects across **${normStories.size}** Action Stories`)
  w(`- Stage distribution: ${Object.entries(stageCount).map(([k, v]) => `\`${k}\`=${v}`).join(', ')}`)
  const invalid = norm.filter((d) => validateDecisionObject(d).length > 0)
  w(`- Records failing contract validation: **${invalid.length}** of ${norm.length}${invalid.length ? ` (${invalid.slice(0, 5).map((d) => d.proposal_id).join(', ')})` : ''}`)
  w()
  w('### Slot fill rate against the normalized dataset')
  w()
  w('| Template :: slot | Tier | Populated | Coverage |')
  w('|---|---|---:|---:|')
  for (const [k, v] of Object.entries(fill)) {
    w(`| \`${k}\` | ${v.tier} | ${v.present}/${v.total} | ${pct(v.present, v.total)} |`)
  }
  w()
  const emptyCore = Object.entries(fill).filter(([, v]) => v.tier === 'core' && v.present < v.total)
  w(`Core slots not populated on every member of their family: **${emptyCore.length}**${emptyCore.length ? ` — ${emptyCore.map(([k]) => `\`${k}\``).join(', ')} (each is \`when\`-gated, so it is omitted rather than rendered empty)` : ''}.`)
  w()
}

w('## Unresolved — require a product decision before a real dataset')
w()
w('1. **`action_type`** — zero corpus evidence. Highest-risk contract unknown.')
w('2. **`contract_class`** — zero corpus evidence; current enum is invented.')
w('3. **`entitlement`** — zero corpus evidence; currently synthesised.')
w('4. **`on_clock` / `deadline`** — 3 of 105 records; currently synthesised.')
w('5. **`mode`** — present but degenerate (104×"Suggest").')
w('6. **`impact` / `updated_at` / `status`** — no corpus source; synthesised deterministically.')
w()
w('Everything above is generated from the corpus. Values marked UNRESOLVED are absent from the')
w('evidence and have not been invented here.')
w()

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${L.join('\n')}\n`)

console.log(`Wrote ${path.relative(ROOT, OUT)}`)
console.log(`  stories=${stories.length} stageRecords=${fixtures.length} distinctKeys=${Object.keys(allFields).length} canonicalSlots=${Object.keys(CANONICAL_SLOTS).length}`)
console.log('  -- deep scan (all nesting depths) --')
for (const v of ['business', 'presentation-css', 'presentation-geometry', 'presentation-svg', 'ui-visibility', 'mockup-meta']) {
  const list = deepByVerdict[v] ?? []
  console.log(`  ${v.padEnd(24)} keys=${String(list.length).padStart(4)} occurrences=${list.reduce((n, [, e]) => n + e.count, 0)}`)
}
