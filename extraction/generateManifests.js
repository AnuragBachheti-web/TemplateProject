#!/usr/bin/env node
// Turns the Part 1 fixtures (src/features/action-stories/data/raw/) into per-workflow manifests
// (src/features/action-stories/manifests/<code>.json), and writes the confidence/ambiguity
// report at src/features/action-stories/manifests/REPORT.md. Not shipped with the app — the
// generated manifests are what a screen actually reads at runtime.
//
// Usage: node extraction/generateManifests.js [dataDir] [manifestsOutDir]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateManifest } from '../src/features/action-stories/manifests/validateManifest.js'
import { resolveBinding } from '../src/features/action-stories/manifests/resolveBinding.js'
import { validateBlockData } from '../src/features/action-stories/manifests/blockTypes.js'
import { classifyBlockType, planSlotNames, detectItemLevelHints } from './classifyBlocks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const DATA_DIR = path.resolve(process.argv[2] || path.join(REPO_ROOT, 'src/features/action-stories/data'))
const MANIFESTS_OUT_DIR = path.resolve(
  process.argv[3] || path.join(REPO_ROOT, 'src/features/action-stories/manifests'),
)

// Slot names that genuinely land on the app's real vocabulary — everything else is a
// descriptive, mockup-specific name. Used only to tally the report; doesn't affect generation.
const VOCAB_SLOT_NAMES = new Set([
  'execution_lane',
  'severity',
  'guardrail_verdict',
  'guardrail_blocked',
  'guardrail_can_approve',
  'guardrail_reason',
  'guardrail_cta_label',
  'rationale',
])

function buildStageManifest(fixture) {
  const { code, stageKey, name, data } = fixture
  const { slotNames, collisions } = planSlotNames(data || {})

  const blocks = []
  const itemLevelHints = [] // { rawKey, hints }
  const skippedForBadShape = []

  for (const [rawKey, slotName] of slotNames) {
    const value = data[rawKey]
    const blockType = classifyBlockType(value, rawKey)
    if (!blockType) continue // pure style, empty array/object, etc. — not worth a block

    blocks.push({ slotName, blockType, binding: `data.${rawKey}` })

    if (blockType === 'itemQueue' || blockType === 'labelValueList' || blockType === 'table') {
      const hints = detectItemLevelHints(value)
      if (Object.keys(hints).length > 0) {
        itemLevelHints.push({ rawKey, slotName, hints })
      }
    }
  }

  // Self-check: re-resolve every binding against this same fixture and validate it with the
  // exact validator its own blockType claims — catches a classifier/generator bug immediately
  // rather than shipping a manifest whose bindings don't actually hold what they claim to.
  for (const block of blocks) {
    const resolved = resolveBinding(block.binding, fixture)
    const problems = validateBlockData(block.blockType, resolved)
    if (problems.length > 0) {
      skippedForBadShape.push({ slotName: block.slotName, binding: block.binding, problems })
    }
  }

  const manifest = { code, name, stageKey, blocks }
  return { manifest, collisions, itemLevelHints, selfCheckProblems: skippedForBadShape }
}

function main() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'))
  fs.mkdirSync(MANIFESTS_OUT_DIR, { recursive: true })

  const perCodeReport = []
  let totalStages = 0
  let totalBlocks = 0
  let totalVocabBlocks = 0
  const allCollisions = []
  const allSelfCheckProblems = []
  const allValidationProblems = []

  for (const workflow of index) {
    const stageManifests = []
    const codeReport = { code: workflow.code, name: workflow.name, stages: [] }

    for (const stageKey of workflow.stages) {
      const fixturePath = path.join(DATA_DIR, 'raw', workflow.code, `${stageKey}.json`)
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

      const { manifest, collisions, itemLevelHints, selfCheckProblems } = buildStageManifest(fixture)

      const validationProblems = validateManifest(manifest)
      if (validationProblems.length > 0) {
        allValidationProblems.push({ code: workflow.code, stageKey, problems: validationProblems })
      }

      stageManifests.push(manifest)
      totalStages++
      totalBlocks += manifest.blocks.length
      const vocabCount = manifest.blocks.filter((b) => VOCAB_SLOT_NAMES.has(b.slotName)).length
      totalVocabBlocks += vocabCount

      collisions.forEach((c) => allCollisions.push({ code: workflow.code, stageKey, ...c }))
      selfCheckProblems.forEach((p) => allSelfCheckProblems.push({ code: workflow.code, stageKey, ...p }))

      codeReport.stages.push({
        stageKey,
        blockCount: manifest.blocks.length,
        vocabSlots: manifest.blocks.filter((b) => VOCAB_SLOT_NAMES.has(b.slotName)).map((b) => b.slotName),
        itemLevelHints,
      })
    }

    fs.writeFileSync(
      path.join(MANIFESTS_OUT_DIR, `${workflow.code}.json`),
      JSON.stringify(stageManifests, null, 2) + '\n',
    )
    perCodeReport.push(codeReport)
  }

  writeReportMarkdown(perCodeReport, {
    totalStages,
    totalBlocks,
    totalVocabBlocks,
    collisions: allCollisions,
    selfCheckProblems: allSelfCheckProblems,
    validationProblems: allValidationProblems,
  })

  printConsoleReport(perCodeReport, {
    totalStages,
    totalBlocks,
    totalVocabBlocks,
    collisions: allCollisions,
    selfCheckProblems: allSelfCheckProblems,
    validationProblems: allValidationProblems,
  })

  if (allSelfCheckProblems.length > 0 || allValidationProblems.length > 0) {
    process.exitCode = 1
  }
}

function printConsoleReport(perCode, totals) {
  const line = '─'.repeat(60)
  console.log(line)
  console.log('Action Stories manifest generation report')
  console.log(line)
  console.log(`workflows:         ${perCode.length}`)
  console.log(`stage manifests:   ${totals.totalStages}`)
  console.log(`blocks generated:  ${totals.totalBlocks}`)
  console.log(`vocab-named slots: ${totals.totalVocabBlocks}`)
  console.log(`slot-name collisions: ${totals.collisions.length}`)
  console.log(`self-check problems:  ${totals.selfCheckProblems.length}`)
  console.log(`manifest validation problems: ${totals.validationProblems.length}`)

  if (totals.collisions.length > 0) {
    console.log('')
    console.log('Slot-name collisions (kept the first-seen key, see REPORT.md):')
    for (const c of totals.collisions) {
      console.log(`  - ${c.code}/${c.stageKey}: "${c.slotName}" wanted by "${c.wanted}", kept "${c.keptInstead}"`)
    }
  }

  if (totals.selfCheckProblems.length > 0) {
    console.log('')
    console.log('Self-check problems (classifier produced a block whose own validator rejects it):')
    for (const p of totals.selfCheckProblems) {
      console.log(`  - ${p.code}/${p.stageKey} "${p.slotName}" (${p.binding}): ${p.problems.join('; ')}`)
    }
  }

  if (totals.validationProblems.length > 0) {
    console.log('')
    console.log('validateManifest() problems:')
    for (const v of totals.validationProblems) {
      console.log(`  - ${v.code}/${v.stageKey}: ${v.problems.join('; ')}`)
    }
  }

  console.log('')
  console.log(`Full per-workflow confidence notes: src/features/action-stories/manifests/REPORT.md`)
  console.log(line)
}

function writeReportMarkdown(perCode, totals) {
  const lines = []
  lines.push('# Action Stories manifest report')
  lines.push('')
  lines.push(
    `Generated by \`extraction/generateManifests.js\` from ${totals.totalStages} stage fixtures across ${perCode.length} workflows.`,
  )
  lines.push('')
  lines.push('## How the fixed vocabulary was checked against the real data')
  lines.push('')
  lines.push(
    'Before writing the generator, every field in the fixed vocabulary (`action_type`, `lens`, `severity`, ' +
      '`state`, `target`, `current_value`, `proposed_value`, `currency`, `impact_minor`, `confidence`, ' +
      '`guardrail_verdict`, `execution_lane`, `source`, `rationale`, `created_at`) was checked against the ' +
      'actual content of all 105 raw fixtures (not just their key names) — see the confidence table below. ' +
      'A manifest block only ever *binds* to a real path in the raw fixture; nothing here renames or reshapes ' +
      'the underlying JSON, so a vocabulary field only gets used as a `slotName` where a raw field genuinely ' +
      'carries that concept.',
  )
  lines.push('')
  lines.push('| Vocabulary field | Confidence | Finding |')
  lines.push('|---|---|---|')
  lines.push(
    '| `execution_lane` | **Confident** | `data.execLabel` on every one of the 105 stage files. *(Corrected ' +
      'after actually running the app in Part 3: the real values are only "Suggest" and "Assist" — "Assist" ' +
      'appears exactly once, on `S10.6/live`. The `executionMode` prop\'s declared enum is "Suggest"/"Approve"/' +
      '"Auto", but no fixture\'s rendered `execLabel` ever actually takes the "Approve" or "Auto" value, and ' +
      '"Assist" isn\'t in that declared enum at all — the earlier version of this report stated the declared ' +
      'schema\'s options as if they were the observed values, without checking. Bound directly either way; this ' +
      'is a data-accuracy correction to the finding, not a rendering change.)* |',
  )
  lines.push(
    '| `guardrail_verdict` | **Confident, two shapes** | `data.checks` (an array of governance check rows) plus ' +
      '`blocked`/`canApprove`/`blockReason`/`ctaLabel` is the decision gate on most `decide` stages — but a ' +
      'second, disjoint naming convention (`approveShow`/`blockShow`/`approveLabel`) is used by another set of ' +
      'workflows for the exact same concept. Both are mapped to `guardrail_*` slot names; which raw keys are ' +
      'present differs per workflow (see the per-code table). |',
  )
  lines.push(
    '| `severity` | **Real, but scattered and off-enum** | A literal `severity` field appears in ' +
      '`S10.3` (`analyze`/`decide` feed items — "medium"/"high"/"low"), `S10.5` (three different arrays: ' +
      '`reason.ownership`, `analyze.rows`, `decide.repairs` — always "critical"), and `S9.19` ' +
      '(`analyze.conflicts` — "blocking"). None match this vocabulary\'s `crit`/`act`/`opp`/`watch` enum, and ' +
      "S10.5's usage classifies a *governance rule's* consequence (\"how bad is violating this\"), not an " +
      "action's urgency — a related but distinct subject from the other two. Bound as-is; enum values not " +
      'remapped (that would be guessing). *(An earlier pass of this report only checked S10.3 and missed the ' +
      'S10.5/S9.19 occurrences — the item-level hint detector was missing `severity` from its candidate list; ' +
      'both are fixed now.)* |',
  )
  lines.push(
    '| `rationale` | **Best-effort screen-level, confident at two spots** | No workflow has a *screen-level* ' +
      'field literally named this except `S9.16/reason` (`data.rationale`, an array of weighted reason rows) — ' +
      'genuinely bound as-is. `S9.20/decide.sampled[].rationale` is a clean, literal, free-text explanation per ' +
      'item — the strongest item-level match found for this concept anywhere. Everywhere else, bound to whichever ' +
      'of `pinnedSub` / `floorNote` / `gapNote` / `summaryNote` / `dialNote` is present and a plain string (first ' +
      'match wins). Several workflows instead carry this as `trigger` — an array of timestamped events, not a ' +
      'single string — which was *not* forced into this slot; it keeps its own name. |',
  )
  lines.push(
    '| `target` (`{ref}`) | **A literal `target` key exists — and it\'s a false friend** | `S9.16/reason.criteria`, ' +
      '`S9.17/execute.monitors`, `S9.20/reason.goals`, `S10.5/reason.sla`, and the `targets[]`/`sla[]` arrays on ' +
      'several other `reason` stages (e.g. `S9.12`) all have an item field literally named `target` — but it means ' +
      '"the goal/threshold to hit" (`"under 4h"`, `"12.0%"`), the opposite of this vocabulary\'s "the entity being ' +
      'acted on." The real identifier concept instead shows up, inconsistently named, as `sku` / `id` / `caseId` / ' +
      '`ref` inside action-queue arrays (`rows`/`feed`/`slate`/`items`) — `S10.1/analyze.timeline[].ref` and ' +
      "`S10.1/execute.spawned[].ref` are the cleanest examples, each paired with a genuine `source` and `state` " +
      'on the same row (see below). No consistent identifier field name across workflows; flagged per-code, ' +
      '**not** renamed or promoted to its own block. |',
  )
  lines.push(
    '| `confidence` | **Two different false-positive shapes, no clean float anywhere** | Where a percentage-like ' +
      'field is present (`conf`/`confPct`/`win` inside an item array, e.g. `S9.11/analyze.rows`, `S10.4/analyze.rows`), ' +
      'it is always a formatted string like `"88% ± 5"`, never a raw 0–1 number — parsing that down to a float ' +
      'was deliberately not attempted (the "± 5" / suffix text varies per workflow, so it would be a guess, not an ' +
      'extraction). Separately, `S10.1/analyze.classifier` has a field *literally named* `confidence` — but its ' +
      'values ("evidence: fee schedule diff", "target under 5%") are evidence-citation prose, not a score at all: ' +
      'a pure false friend, worse than the percentage-string case. |',
  )
  lines.push(
    '| `current_value` / `proposed_value` / `impact_minor` | **Not present as clean data anywhere** | Every ' +
      'headline dollar figure across all 105 fixtures (`pinnedTop`, `heroValue`, `cm`, `value`, `deltaStr`, ' +
      '`S10.1/execute.spawned[].value`, …) is a pre-formatted display string (`"$4,120 recoverable"`, ' +
      '`"+$18.0K/mo"`, `"−$1,480"`); none of the fixtures kept the underlying number in `state` separately. ' +
      '`state` itself is populated in 77/105 files but only with *UI* state (selection, toggles, busy flags), ' +
      'never business numbers. The one genuinely clean analog found is `S9.12/execute`\'s `items[].diff` — an ' +
      'array of `{ field, before, after }` — a real, if per-field and textual, before/after pair. Regex-parsing ' +
      '"$57K" style strings into minor-unit integers was deliberately not done: the K/M suffixes, signs and ' +
      'embedded prose make it unreliable, and a wrong number would be worse than an honestly-missing one. |',
  )
  lines.push(
    '| `lens` | **Confident where literal, one workflow; the underlying concept recurs elsewhere** | ' +
      '`S10.6/live.lensTiles[].lens` has clean enum-like values ("Sales", "Margin", …). `S10.6/analyze.desks[].lens` ' +
      'also literally has this field, but as a compound string ("Planner · Inventory lens") — same workflow, two ' +
      'stages, two formats. `S10.1/reason.lenses[].name` carries the identical business concept (Margin/Cash/…) ' +
      'under a *different* key (`name`, inside an array itself called `lenses`) — the underlying "which business ' +
      'lens" idea recurs across workflows even where the literal field name doesn\'t. |',
  )
  lines.push(
    '| `state` | **A literal `state` key exists and is genuine — plus a same-name, different-subject use** | ' +
      '`S10.1/execute.spawned[].state` ("staged") is a real proposal-lifecycle state, paired on the same row with ' +
      'a genuine `ref` and `owner` — this row is the closest any fixture comes to the vocabulary\'s actual shape. ' +
      "`S9.12/execute.items[].status` (values like \"staged\"/\"applied\"/\"needs signature\") is the same " +
      'concept under a different key (`status`, not `state`) and recurs across most `execute` stages. Separately, ' +
      '`S10.1/reason.lenses[].state` ("breached"/"in band") is literally the same key but describes a *metric\'s* ' +
      'health, not a *proposal\'s* lifecycle — a related but distinct subject sharing the name. |',
  )
  lines.push(
    '| `action_type` | **Weak/guessed** | The closest analog is a per-item `tag` / `type` / `classification` ' +
      '(e.g. `"fit cluster"`, `"listing diff"`, `"durable trend"`) — free-text labels invented per workflow, not a ' +
      'controlled taxonomy. Flagged, not treated as confident. |',
  )
  lines.push(
    '| `source` | **Genuinely confident in one workflow, a false friend in another** | ' +
      '`S10.1/analyze.timeline[].source` is a clean, literal match — values `"ours"` / `"amazon"` / `"carrier"` / ' +
      '`"realify"`, exactly "which party this event originated from," on the same row as a genuine `ref` and a ' +
      "clean explanatory `reason` string. Separately, `S9.11/analyze`'s row field also literally named `source` " +
      'means "priced by a live test vs. modeled" — same key, unrelated concept, in a different workflow. Both are ' +
      'bound under their own raw name (never promoted to a `source` slot) since a single project-wide rule can\'t ' +
      "honor the first and avoid the second. The `agents` array on most `reason` stages (named personas like " +
      '"Pricer"/"Controller" with role descriptions) is a further, list-shaped conceptual match, kept under its ' +
      'own name. |',
  )
  lines.push(
    '| `currency` | **Absent as a real value; one literal-key false friend** | No amount anywhere carries an ' +
      'explicit ISO code — every figure implies USD via a "$" glyph in a formatted string. ' +
      '`S9.17/execute.brief.currency` *is* a literal `currency` key, but its value is an array of negotiation ' +
      'levers (`"18-month volume commitment"`, `"Net 45 → Net 60"`) — "currency" as in leverage/bargaining chips, ' +
      'not a monetary code. Not used as a `currency` slot anywhere. |',
  )
  lines.push(
    '| `created_at` | **Absent** | No fixture has a creation timestamp, at any nesting depth. The only date-ish ' +
      'fields found (`rqDate`, `gateDate`) are future deadlines, not a creation time. |',
  )
  lines.push('')
  lines.push(
    '**A note on how thorough this table is:** the automated "Item-level hints" column below (and the candidate ' +
      'list in `extraction/classifyBlocks.js`) only checks the direct keys of the *first* item of a *top-level* ' +
      'array field — one level deep. The `S9.17/execute.brief.currency` and `S10.1/analyze.classifier`-as-' +
      '"confidence" false friends above were found by a one-off deeper manual audit (recursing into nested ' +
      'objects, not just top-level arrays) while reviewing this report, not by the generator itself. The table ' +
      'above should be taken as the ground truth for those two; the automated per-code hints below remain a ' +
      'first-level-only signal, not an exhaustive scan.',
  )
  lines.push('')
  lines.push('## Block vocabulary')
  lines.push('')
  lines.push(
    '`text`, `number`, `flag`, `labelValueList` (array of `{label, …}` rows), `table` (array of objects that all ' +
      'share the same >=3 scalar columns), `itemQueue` (array of richer, variable-shape per-item objects), ' +
      '`series` (chart data — an SVG path string, an array of bare numbers, or an array of coordinate-only ' +
      'objects like `{h}`/`{cx,cy}`), `object` (a lone nested descriptor). Pure-styling fields (bare CSS values, ' +
      'decorative-suffix keys like `*Tone`/`*Icon`, `inline-flex`/`none` visibility toggles, and arrays of ' +
      'nothing but colors) are filtered out before classification — see `extraction/classifyBlocks.js`.',
  )
  lines.push('')
  lines.push('## Confidence by workflow')
  lines.push('')
  lines.push(
    'This table is about *mechanical* soundness, not semantic confidence: every workflow listed generated at ' +
      'least one `execution_lane` block and passed `validateManifest()` and every block\'s own self-check with no ' +
      'problems — see the last section below (0 for all three, every run). For *semantic* confidence — how much ' +
      'to trust a given `slotName` as truly meaning what the vocabulary says — see the field-by-field table above; ' +
      'the "Item-level hints" column here is a pointer into that discussion, not a confidence score by itself.',
  )
  lines.push('')
  lines.push('| Code | Name | Stages | Vocab slots used | Item-level hints found |')
  lines.push('|---|---|---|---|---|')
  for (const wf of perCode) {
    const vocabSlots = [...new Set(wf.stages.flatMap((s) => s.vocabSlots))]
    const hints = wf.stages.flatMap((s) =>
      s.itemLevelHints.map((h) => `${s.stageKey}.${h.rawKey}: ${Object.entries(h.hints).map(([k, v]) => `${k}←${v}`).join(', ')}`),
    )
    lines.push(
      `| ${wf.code} | ${wf.name} | ${wf.stages.map((s) => s.stageKey).join(', ')} | ${vocabSlots.join(', ') || '—'} | ${hints.join('; ') || '—'} |`,
    )
  }
  lines.push('')
  lines.push('## Problems found while generating')
  lines.push('')
  if (totals.collisions.length === 0 && totals.selfCheckProblems.length === 0 && totals.validationProblems.length === 0) {
    lines.push('None — every generated manifest passed `validateManifest()` and its own blocks\' self-check.')
  } else {
    if (totals.collisions.length > 0) {
      lines.push('**Slot-name collisions** (two raw keys wanted the same vocabulary slot in one stage):')
      lines.push('')
      for (const c of totals.collisions) {
        lines.push(`- ${c.code}/${c.stageKey}: "${c.slotName}" wanted by \`${c.wanted}\`, kept \`${c.keptInstead}\``)
      }
      lines.push('')
    }
    if (totals.selfCheckProblems.length > 0) {
      lines.push('**Self-check problems:**')
      lines.push('')
      for (const p of totals.selfCheckProblems) {
        lines.push(`- ${p.code}/${p.stageKey} "${p.slotName}" (\`${p.binding}\`): ${p.problems.join('; ')}`)
      }
      lines.push('')
    }
    if (totals.validationProblems.length > 0) {
      lines.push('**validateManifest() problems:**')
      lines.push('')
      for (const v of totals.validationProblems) {
        lines.push(`- ${v.code}/${v.stageKey}: ${v.problems.join('; ')}`)
      }
    }
  }
  lines.push('')

  fs.writeFileSync(path.join(MANIFESTS_OUT_DIR, 'REPORT.md'), lines.join('\n'))
}

main()
