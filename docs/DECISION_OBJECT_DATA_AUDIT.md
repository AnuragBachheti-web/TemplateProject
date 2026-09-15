# Decision Object — Data Audit (Gap #2, Phase 1)

> **Machine-generated.** Every figure below was counted by `extraction/auditDecisionObjectData.js`
> over the complete archived corpus. Nothing is sampled or estimated. Regenerate with
> `npm run audit:data`.

- Corpus: **105** stage fixtures across **26** Action Stories, **105** archived stage manifests
- Canonical slots today: **34**
- Distinct top-level business-data keys in the corpus: **1137**

## 1. Story / stage inventory

**26 Action Stories**, **105 stage records**. Parent identity is `story_code`;
grouping is by the whole code, never by a numeric prefix (see Gap #1).

| story_code | Name | reason | analyze | decide | execute | live | Stages |
|---|---|:--:|:--:|:--:|:--:|:--:|--:|
| `S9.1` | Assortment | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.2` | Replenishment | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.3` | Allocation | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.4` | Allocation | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.5` | Competitive | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.6` | Listings | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.7` | Advertising | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.8` | Launch | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.9` | Markdown | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.10` | Exit | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.11` | Repricing | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.12` | Returns | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.13` | Lifecycle | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.14` | Agentic commerce | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.15` | Search visibility | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.16` | Channel launch | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.17` | Supplier performance | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.18` | Fulfilment cost | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.19` | Promo calendar | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S9.20` | Item research | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.1` | Variance bridge | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.2` | Working capital | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.3` | Account health | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.4` | Fee integrity | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.5` | Catalog integrity | ✓ | ✓ | ✓ | ✓ | — | 4 |
| `S10.6` | Peak readiness | ✓ | ✓ | ✓ | ✓ | ✓ | 5 |

- Stories missing one of the core four: **0** — every story is complete
- Stories with an extra stage: **1** (S10.6: live)

**Evidence on ID semantics.** `S10.1`–`S10.4` are four *different* Action Stories — "Variance bridge",
"Working capital", "Account health", "Fee integrity" — each declaring its own four stages. The `.N`
is a sequence number within the S10 batch, not a stage index. They must never be grouped.

## 2. Data shape inventory

Top-level `data.*` keys per stage. `Stories` counts how many distinct Action Stories carry the key,
so a key present once per story reads `26`, not `104`.

### `reason` — 26 records, 112 distinct keys

| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |
|---|---:|---:|---|---|---|---|
| `execLabel` | 26 | 100% | string | `"Suggest"` | `decision_mode` | business |
| `execSegs` | 26 | 100% | array<object> | `[{bg}] ×3` | — | business |
| `locked` | 19 | 73% | array<object> | `[{label, amount, detail}] ×4` | — | business |
| `trigger` | 14 | 54% | array<object> | `[{when, what}] ×3` | — | business |
| `agents` | 14 | 54% | array<object> | `[{name, role, icon, hue, tint}] ×4` | `roles` | business |
| `dialNote` | 12 | 46% | string | `"Realify will propose the move set and w…` | `narrative` | business |
| `chips` | 10 | 38% | array<object> | `[{icon, label}] ×6` | — | business |
| `inputs` | 8 | 31% | array<object> | `[{label, meta}] ×5` | `inputs` | business |
| `targets` | 8 | 31% | array<object> | `[{label, value, meta, tone}] ×4` | `policy` | business |
| `footStatus` | 4 | 15% | string | `"Reason · 11 claims above floor · $890 e…` | — | business |
| `railDot` | 3 | 12% | string(css) | `"var(--amber-500)"` | — | presentation-css |
| `railGlow` | 3 | 12% | string(css) | `"var(--amber-50)"` | — | presentation-css |
| `railLabel` | 3 | 12% | string | `"$890\nexpiring"` | — | business |
| `pinMark` | 3 | 12% | string(css) | `"var(--mod-cash)"` | — | presentation-css |
| `pinTone` | 3 | 12% | string(css) | `"var(--mod-cash)"` | — | presentation-css |
| `pinnedTop` | 3 | 12% | string | `"$4,120 recoverable"` | — | presentation-geometry |
| `pinnedSub` | 3 | 12% | string | `"11 claims · 3 expire inside 21 days"` | — | business |
| `policy` | 3 | 12% | array<object> | `[{rule, setting, tone, why}] ×5` | `policy` | business |
| `channels` | 3 | 12% | array<object> | `[{name, detail, forecast, ready, readyTone, …}] ×4` | — | business |
| `roles` | 3 | 12% | array<object> | `[{name, count, hue, tint, def}] ×6` | `roles` | business |
| `brandChips` | 3 | 12% | array<object> | `[{icon, label}] ×6` | — | business |
| `sources` | 3 | 12% | array<object> | `[{label, value, tone}] ×4` | `inputs` | business |
| `terms` | 2 | 8% | array<object> | `[{term, definition}] ×6` | — | business |
| `headline` | 2 | 8% | array<object> | `[{label, value, tone, note}] ×4` | `narrative` | business |
| `capital` | 2 | 8% | array<object> | `[{label, when, value, tone}] ×4` | — | business |
| `slas` | 2 | 8% | array<object> | `[{level, label, sla, detail, pillBg, …}] ×4` | — | business |
| `deadlines` | 2 | 8% | array<object> | `[{name, left, detail, tone, bg}] ×3` | — | business |
| `cohorts` | 2 | 8% | array<object> | `[{name, skus, evidence, maxLoss, pref, …}] ×4` | `roles` | business |
| _…84 further keys_ | | | | | | |

### `analyze` — 26 records, 290 distinct keys

| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |
|---|---:|---:|---|---|---|---|
| `execLabel` | 26 | 100% | string | `"Suggest"` | `decision_mode` | business |
| `execSegs` | 26 | 100% | array<object> | `[{bg}] ×3` | — | business |
| `sel` | 11 | 42% | object | `{name, state, tint, tone}` | — | business |
| `pinnedSub` | 8 | 31% | string | `"CM $10,640 vs $12,480 · residual +$130 …` | — | business |
| `rows` | 8 | 31% | array<object> | `[{name, sub, value, typeShort, typeTint, …}] ×11` | `detail_rows` | business |
| `pinnedTop` | 7 | 27% | string | `"Drilling FBA fee · −$2,210"` | — | presentation-geometry |
| `yTicks` | 4 | 15% | array<scalar>, array<object> | `["$13,200", …] ×5` | — | business |
| `footStatus` | 4 | 15% | string | `"Analyze · 11 claims shown · $4,120 iden…` | — | business |
| `cols` | 4 | 15% | array<object> | `[{key, label}] ×7` | — | business |
| `gaps` | 4 | 15% | array<object> | `[{name, cover, demand, status, tint, …}] ×4` | `detail_rows` | business |
| `legend` | 4 | 15% | array<object> | `[{label, fill, border}] ×4` | — | business |
| `bars` | 3 | 12% | array<object> | `[{key, label, sublabel, value, top, …}] ×8` | — | business |
| `roles` | 3 | 12% | array<object> | `[{label, value, turns, pct, hue, …}] ×6` | `roles` | business |
| `filters` | 3 | 12% | array<object> | `[{label, bg, fg, weight}] ×2` | — | business |
| `feed` | 3 | 12% | array<object> | `[{severity, market, title, summary, caseId, …}] ×5` | — | business |
| `railDot` | 3 | 12% | string(css) | `"var(--amber-500)"` | — | presentation-css |
| `railGlow` | 3 | 12% | string(css) | `"var(--amber-50)"` | — | presentation-css |
| `railLabel` | 3 | 12% | string | `"$890\nexpiring"` | — | business |
| `pinMark` | 3 | 12% | string(css) | `"var(--mod-cash)"` | — | presentation-css |
| `pinTone` | 3 | 12% | string(css) | `"var(--mod-cash)"` | — | presentation-css |
| `sorts` | 3 | 12% | array<object> | `[{label, bg, fg, weight}] ×3` | `detail_rows` | business |
| `selName` | 3 | 12% | string | `"Refund without return · 2 orders"` | — | business |
| `selMeta` | 3 | 12% | string | `"FEE-2207 · orders 114-8827301 and 114-8…` | — | business |
| `selIcon` | 3 | 12% | string | `"fa-solid fa-rotate-left"` | — | presentation-css |
| `selTint` | 3 | 12% | string(css) | `"var(--rose-50)"` | — | presentation-css |
| `selNote` | 3 | 12% | string | `"Both customers were refunded and neithe…` | — | business |
| `timeline` | 2 | 8% | array<object> | `[{time, source, srcIcon, srcTint, srcTone, …}] ×5` | — | business |
| `weeks` | 2 | 8% | array<object> | `[{label, date, inH, outH, opacity, …}] ×13` | — | business |
| _…262 further keys_ | | | | | | |

### `decide` — 26 records, 386 distinct keys

| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |
|---|---:|---:|---|---|---|---|
| `execLabel` | 26 | 100% | string | `"Suggest"` | `decision_mode` | business |
| `execSegs` | 26 | 100% | array<object> | `[{bg}] ×3` | — | business |
| `checks` | 19 | 73% | array<object> | `[{label, icon, tone, noteTone, note}] ×4` | `guardrail_checks` | business |
| `footStatus` | 15 | 58% | string | `"Decide · 2 actions · 2 card spawning · …` | — | business |
| `pinnedTop` | 14 | 54% | string | `"2 actions selected"` | — | presentation-geometry |
| `pinnedSub` | 14 | 54% | string | `"2 cards · annotating"` | — | business |
| `totals` | 14 | 54% | array<object> | `[{label, value, tone}] ×6` | `totals_rows` | business |
| `approveLabel` | 14 | 54% | string | `"Approve the batch · 9 claims"` | `recommendation` | business |
| `footTone` | 13 | 50% | string(css) | `"var(--ink-500)"` | — | presentation-css |
| `policyStatus` | 12 | 46% | string | `"clean"` | — | business |
| `policyTone` | 12 | 46% | string(css) | `"var(--green-700)"` | — | presentation-css |
| `blocked` | 12 | 46% | boolean | `false` | `guardrail_verdict` | business |
| `canApprove` | 12 | 46% | boolean | `true` | `guardrail_verdict` | business |
| `ctaLabel` | 12 | 46% | string | `"Record triage & continue"` | — | business |
| `footerStatus` | 11 | 42% | string | `"Decide · 6 SKUs · $31.2K capital · 2 ex…` | — | business |
| `summary` | 9 | 35% | array<object> | `[{label, value, tone}] ×5` | `recommendation_metrics` | business |
| `heroMetrics` | 9 | 35% | array<object> | `[{label, value, tone, note}] ×5` | `recommendation_metrics` | business |
| `blockReason` | 8 | 31% | string | `"Annotate at least, or the day gets inve…` | — | business |
| `heroTitle` | 8 | 31% | string | `"The plan clears the buffer in both the …` | `recommendation` | business |
| `approveShow` | 8 | 31% | string | `"none"` | — | ui-visibility |
| `blockShow` | 8 | 31% | string | `"inline-flex"` | — | ui-visibility |
| `slateMeta` | 7 | 27% | string | `"6 selected · $31.2K capital · +$3.8K/mo"` | `slate_summary` | business |
| `heroBody` | 6 | 23% | string | `"Four levers, ranked by cost per dollar …` | — | business |
| `groups` | 6 | 23% | array<object> | `[{label, badge, icon, tone, tint, …}] ×2` | — | business |
| `routes` | 5 | 19% | array<object> | `[{label, note, icon, hue, bg, …}] ×4` | — | business |
| `heroValue` | 5 | 19% | string(currency), string | `"$3,480"` | — | business |
| `onApprove` | 5 | 19% | array<object> | `[{label, icon}] ×6` | — | business |
| `railDot` | 4 | 15% | string(css) | `"var(--amber-500)"` | — | presentation-css |
| _…358 further keys_ | | | | | | |

### `execute` — 26 records, 406 distinct keys

| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |
|---|---:|---:|---|---|---|---|
| `execLabel` | 26 | 100% | string | `"Suggest"` | `decision_mode` | business |
| `execSegs` | 26 | 100% | array<object> | `[{bg}] ×3` | — | business |
| `pushedCount` | 16 | 62% | string | `"0 / 4"` | — | business |
| `monitors` | 16 | 62% | array<object> | `[{label, note, plan, tol, actual, …}] ×5` | `verification` | business |
| `done` | 15 | 58% | boolean | `false` | — | business |
| `closeLabel` | 15 | 58% | string | `"Back to workspace"` | — | business |
| `footStatus` | 15 | 58% | string | `"Execute · annotation drafted · 2 cards …` | — | business |
| `footTone` | 15 | 58% | string(css) | `"var(--ink-500)"` | — | presentation-css |
| `planLine` | 14 | 54% | string | `"The PO delay is a request, not a fact, …` | — | business |
| `monTone` | 14 | 54% | string(css) | `"var(--ink-400)"` | — | presentation-css |
| `progressPct` | 14 | 54% | string(numeric) | `"0"` | `progress` | business |
| `progressRows` | 14 | 54% | array<object> | `[{label, value, tone}] ×5` | `plan` | business |
| `armBorder` | 12 | 46% | string(css) | `"var(--ink-100)"` | — | presentation-css |
| `armCopy` | 12 | 46% | string | `"Available from the Approve dial upward.…` | — | business |
| `armBtnLabel` | 12 | 46% | string | `"Locked at Suggest"` | — | business |
| `armBtnBg` | 12 | 46% | string(css) | `"var(--ink-50)"` | — | presentation-css |
| `armBtnBorder` | 12 | 46% | string(css) | `"var(--ink-200)"` | — | presentation-css |
| `armCursor` | 12 | 46% | string | `"not-allowed"` | — | presentation-css |
| `stages` | 11 | 42% | array<object> | `[{name, meta, icon, hue, doorHref, …}] ×4` | `plan` | business |
| `armIconTone` | 11 | 42% | string(css) | `"var(--ink-400)"` | — | presentation-css |
| `armBtnIcon` | 11 | 42% | string | `"fa-solid fa-lock"` | — | presentation-css |
| `armBtnFg` | 11 | 42% | string(css) | `"var(--ink-400)"` | — | presentation-css |
| `monState` | 11 | 42% | string | `"starts with clearance"` | — | business |
| `footerStatus` | 11 | 42% | string | `"Execute · 0 of 6 steps · reinstatement …` | — | business |
| `footerDoneShow` | 11 | 42% | string | `"none"` | — | ui-visibility |
| `runAllLabel` | 10 | 38% | string | `"Dispatch the plan"` | — | business |
| `runAllIcon` | 10 | 38% | string | `"fa-solid fa-play"` | — | presentation-css |
| `runAllBg` | 10 | 38% | string(css) | `"var(--ink-900)"` | — | presentation-css |
| _…378 further keys_ | | | | | | |

### `live` — 1 records, 57 distinct keys

| Field | Occurrences | Coverage | Type(s) | Example shape | Canonical slot candidate | Verdict |
|---|---:|---:|---|---|---|---|
| `execLabel` | 1 | 100% | string | `"Assist"` | `decision_mode` | business |
| `execSegs` | 1 | 100% | array<object> | `[{bg}] ×3` | — | business |
| `railDot` | 1 | 100% | string(css) | `"var(--mod-actions)"` | — | presentation-css |
| `railGlow` | 1 | 100% | string(css) | `"color-mix(in oklab, var(--mod-actions) …` | — | presentation-css |
| `railLabel` | 1 | 100% | string | `"hour 38\nof 96"` | — | business |
| `pinMark` | 1 | 100% | string(css) | `"var(--mod-actions)"` | — | presentation-css |
| `pinTone` | 1 | 100% | string(css) | `"var(--mod-actions)"` | — | presentation-css |
| `pinnedHeadline` | 1 | 100% | string | `"Prime Fall LIVE — hour 38 of 96 · pacin…` | — | business |
| `pinnedTop` | 1 | 100% | string | `"Hour 38 · pacing 108% of P50"` | — | presentation-geometry |
| `pinnedSub` | 1 | 100% | string | `"2 adjustments need a call"` | — | business |
| `liveLabel` | 1 | 100% | string | `"Live · hour 38 of 96"` | — | business |
| `liveDot` | 1 | 100% | string(css) | `"var(--rose-500)"` | — | presentation-css |
| `liveGlow` | 1 | 100% | string(css) | `"var(--rose-50)"` | — | presentation-css |
| `liveTone` | 1 | 100% | string(css) | `"var(--rose-700)"` | — | presentation-css |
| `liveBannerBg` | 1 | 100% | string(css) | `"var(--rose-50)"` | — | presentation-css |
| `liveBannerBorder` | 1 | 100% | string(css) | `"color-mix(in oklab, var(--rose-500) 26%…` | — | presentation-css |
| `contractChip` | 1 | 100% | string | `"Contract live · expires Aug 27 · 06:00"` | — | business |
| `contractTone` | 1 | 100% | string(css) | `"var(--mod-actions)"` | — | presentation-css |
| `phases` | 1 | 100% | array<object> | `[{label, bg, fg, weight}] ×3` | — | business |
| `clockLabel` | 1 | 100% | string | `"refreshed 40 seconds ago"` | — | business |
| `expired` | 1 | 100% | boolean | `false` | — | business |
| `lensTiles` | 1 | 100% | array<object> | `[{lens, icon, hue, value, delta, …}] ×5` | — | business |
| `adjustMeta` | 1 | 100% | string | `"3 taken at Assist · 2 escalated for a c…` | — | business |
| `adjustSummary` | 1 | 100% | string | `"2 waiting on you"` | — | business |
| `adjustTone` | 1 | 100% | string(css) | `"var(--amber-700)"` | — | presentation-css |
| `adjustments` | 1 | 100% | array<object> | `[{name, detail, bound, when, icon, …}] ×5` | — | business |
| `adjustFoot` | 1 | 100% | string | `"3 actions taken without asking, every o…` | — | business |
| `paceBg` | 1 | 100% | string(css) | `"color-mix(in oklab, var(--mod-actions) …` | — | presentation-css |
| _…29 further keys_ | | | | | | |

## 3. Legacy slot → canonical slot mapping

The corpus carries **1137** distinct top-level keys. The canonical vocabulary has
**34**. That collapse is the point: most legacy keys are one-off names for
concepts that already have a canonical home, or are presentation that must not enter the contract.

| Canonical slot | Tier | Legacy source key(s) | Classification |
|---|---|---|---|
| `narrative` | core | `dialNote`, `rationale`, `restNote`, `headline`, `note`, `copy`, `summaryNote`, `testCopy` | maps cleanly |
| `primary_insight` | core | `primaryInsight`, `headline`, `sortNote`, `insight` | maps cleanly |
| `policy` | core | `policy`, `targets`, `guardParts`, `tol` | maps cleanly |
| `inputs` | conditional | `inputs`, `evidence`, `sources` | maps cleanly |
| `roles` | conditional | `roles`, `cohorts`, `agents` | maps cleanly |
| `comparison` | conditional | (classifier: barChart) | maps cleanly |
| `trend` | conditional | (classifier: lineChart) | maps cleanly |
| `distribution` | conditional | (classifier: scatterChart) | maps cleanly |
| `detail_rows` | core | (classifier: table), `rows`, `gaps`, `cases`, `disposition`, `sorts` | maps cleanly |
| `recommendation` | core | `heroTitle`, `recommendation`, `headline`, `approveLabel` | maps cleanly |
| `recommendation_metrics` | conditional | `heroMetrics`, `summary`, `liveStats` | maps cleanly |
| `slate` | core | `slate`, `slates`, `skus`, `rows`, `moves`, `items` | maps cleanly |
| `slate_summary` | conditional | `slateMeta`, `moveBar`, `summary` | maps cleanly |
| `totals_rows` | conditional | `totals`, `rollup`, `summary` | maps cleanly |
| `guardrail_verdict` | core | `blocked`, `canApprove` | maps cleanly |
| `guardrail_checks` | conditional | `checks`, `guardParts` | maps cleanly |
| `plan` | core | `stages`, `plan`, `progressRows`, `chain` | maps cleanly |
| `progress` | core | `progressPct`, `writtenCount` | maps cleanly |
| `progress_rows` | conditional | `progressRows`, `pushRows` | maps cleanly |
| `verification` | core | `monitors`, `verification`, `guardParts`, `checks`, `chain` | maps cleanly |
| `rollback` | core | `rollback`, `rbHint` | maps cleanly |
| `ledger` | conditional | `ledger`, `chain` | maps cleanly |
| `execution_targets` | conditional | `targets`, `agents`, `monitors` | maps cleanly |
| `decision_mode` | core | `execLabel` | maps cleanly |
| `decision_lens` | core | `lens` | maps cleanly |
| `decision_persona` | core | `owner`, `lens` | maps cleanly |

### Business-shaped keys with NO canonical home (765)

These are real business values that the canonical vocabulary deliberately does not carry. Per the
audit rule (<20% corpus coverage ⇒ fold or drop), each is folded into `narrative`/`detail_rows` or
discarded — **not** turned into a new slot to keep a mockup field alive.

| Legacy key | Occurrences | Coverage | Disposition |
|---|---:|---:|---|
| `execSegs` | 105 | 100% | fold into `detail_rows` |
| `footStatus` | 39 | 37% | fold into `detail_rows` |
| `pinnedSub` | 30 | 29% | fold into `detail_rows` |
| `footerStatus` | 22 | 21% | fold into `detail_rows` |
| `locked` | 19 | 18% | fold into `narrative` |
| `pushedCount` | 16 | 15% | fold into `narrative` |
| `done` | 15 | 14% | fold into `narrative` |
| `closeLabel` | 15 | 14% | fold into `narrative` |
| `railLabel` | 15 | 14% | fold into `narrative` |
| `trigger` | 14 | 13% | fold into `narrative` |
| `planLine` | 14 | 13% | fold into `narrative` |
| `sel` | 13 | 12% | fold into `narrative` |
| `policyStatus` | 12 | 11% | fold into `narrative` |
| `ctaLabel` | 12 | 11% | fold into `narrative` |
| `armCopy` | 12 | 11% | fold into `narrative` |
| `armBtnLabel` | 12 | 11% | fold into `narrative` |
| `monState` | 11 | 10% | fold into `narrative` |
| `runAllLabel` | 10 | 10% | fold into `narrative` |
| `chips` | 10 | 10% | fold into `narrative` |
| `allLabel` | 10 | 10% | fold into `narrative` |
| `allNote` | 10 | 10% | fold into `narrative` |
| `blockReason` | 8 | 8% | fold into `narrative` |
| `headMeta` | 8 | 8% | fold into `narrative` |
| `ledgerCopy` | 8 | 8% | fold into `narrative` |
| `yTicks` | 7 | 7% | fold into `narrative` |
| `bars` | 6 | 6% | fold into `narrative` |
| `heroBody` | 6 | 6% | fold into `narrative` |
| `groups` | 6 | 6% | fold into `narrative` |
| `rbState` | 6 | 6% | fold into `narrative` |
| `rbCopy` | 6 | 6% | fold into `narrative` |
| `tray` | 6 | 6% | fold into `narrative` |
| `routes` | 5 | 5% | discard (corpus evidence only) |
| `heroValue` | 5 | 5% | discard (corpus evidence only) |
| `watchStatus` | 5 | 5% | discard (corpus evidence only) |
| `onApprove` | 5 | 5% | discard (corpus evidence only) |
| `footerPushLabel` | 5 | 5% | discard (corpus evidence only) |
| `contract` | 4 | 4% | discard (corpus evidence only) |
| `filters` | 4 | 4% | discard (corpus evidence only) |
| `xTicks` | 4 | 4% | discard (corpus evidence only) |
| `tChip` | 4 | 4% | discard (corpus evidence only) |
| _…725 further keys, all <5% coverage_ | | | discard |

## 4. Data type audit

Counted at **every depth**, across the whole fixture envelope — nearly all of this corpus's
presentation lives nested inside table rows and chart series, not at the top level.

| Type | Value instances (all depths) | Note |
|---|---:|---|
| `string` | 23727 |  |
| `string(css)` | 16071 | **Presentation — must not enter the contract** |
| `number` | 3366 |  |
| `string(numeric)` | 2774 | **Count-as-string — must become a real number** |
| `string(currency)` | 2011 | **Pre-formatted — must become `{value, unit}`** |
| `array<object>` | 1847 |  |
| `string(percent)` | 1694 | **Pre-formatted — must become `{value, unit:"pct"}`** |
| `object` | 1233 |  |
| `boolean` | 671 |  |
| `null` | 430 |  |
| `array<scalar>` | 118 |  |
| `string(svg-path)` | 64 | **Geometry — must not enter the contract** |

### Fields excluded from the Decision Object, by reason

| Reason | Distinct keys | Total occurrences | Top examples |
|---|---:|---:|---|
| presentation-css | 573 | 19573 | `tone`, `bg`, `border`, `hue`, `icon`, `weight` |
| presentation-geometry | 21 | 586 | `left`, `width`, `height`, `right`, `pinnedTop`, `footRight` |
| presentation-svg | 30 | 43 | `linePath`, `actualPath`, `p10Path`, `doNothingPath`, `projPath`, `bandPath` |
| ui-visibility | 4 | 49 | `blockShow`, `approveShow`, `footerDoneShow`, `footerPushShow` |
| mockup-meta | 3 | 1035 | `__raw`, `state`, `props` |
| **business (kept)** | 1631 | 32720 | `label`, `value`, `name`, `note`, `detail`, `meta` |

## 5. Business data vs UI data

**BUSINESS DATA — the backend provides:** proposal identity, the seven axes, title/narrative,
typed impact and confidence, eligibility per operator action, guardrail verdict and checks, the
stage payload (`proposal`), totals, execution progress, status and `updated_at`.

**UI / PRESENTATION — the frontend derives:** template id, layout/regions/spans, block types,
every colour and tone (`deltaTone.js`), every chart coordinate and SVG path (`chartGeometry.js`),
all number and date formatting (`formatValue.js`), compact-vs-card, and stage navigation.

Explicitly barred from the contract, with corpus counts:

| Barred | Distinct keys | Occurrences |
|---|---:|---:|
| presentation-css | 573 | 19573 |
| presentation-geometry | 21 | 586 |
| presentation-svg | 30 | 43 |
| ui-visibility | 4 | 49 |
| mockup-meta | 3 | 1035 |

## 6. Action data audit

### Action-related fields present in the corpus

| Legacy field | Occurrences | Stages | Sample value |
|---|---:|---|---|
| `blocked` | 12 | decide | — |
| `canApprove` | 12 | decide | — |
| `blockReason` | 8 | decide | `Annotate at least, or the day gets investiga` |
| `checks` | 19 | decide | — |
| `ctaLabel` | 12 | decide | `Record triage & continue` |
| `approveLabel` | 14 | decide | `Approve the batch · 9 claims` |
| `approveShow` | 8 | decide | `none` |
| `blockShow` | 8 | decide | `inline-flex` |
| `armBtnLabel` | 12 | execute | `Locked at Suggest` |
| `runAllLabel` | 10 | execute | `Dispatch the plan` |
| `allLabel` | 10 | execute | `Run all 6 steps` |
| `closeLabel` | 15 | execute | `Back to workspace` |
| `footerPushLabel` | 5 | execute | `Push stage 1 · DTC` |

### Actions declared by the archived manifests

| Legacy action | Count | With `when` gate | With reason capture | Labels observed |
|---|---:|---:|---:|---|
| `confirm` | 52 | 12 | 0 | "Approve", "Start" |

### Business `action_type` derivation

| Legacy action | Count | Business meaning | Candidate `action_type` | Confidence |
|---|---:|---|---|---|
| `confirm` | 52 | "approve this stage" — one generated action per decide/execute stage | operator action `approve`, **not** a business action_type | High |
| _(none)_ | 0 | The corpus contains **no** field naming the business action a proposal proposes | — | — |

**`action_type` is UNRESOLVED / REQUIRES PRODUCT DECISION.** There is no evidence for it anywhere in
the 105 fixtures: no `action_type`, no verb field, nothing distinguishing "reprice" from "reorder".
The only derivable signal is the workflow *category* name in `index.json` (25 distinct values such as
"Repricing", "Replenishment", "Allocation"), which is a category, not an action. The current
8-value enum is a documented placeholder mapped from those categories and must be confirmed by
Product before launch.

## 7. Seven axes audit

Observed values across all 105 stage fixtures. **No value below was invented** — an axis with no
corpus evidence is marked UNRESOLVED.

| Axis | Records carrying it | Coverage | Observed values | Status |
|---|---:|---:|---|---|
| `cardinality` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `contract_class` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `entitlement` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `persona` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `on_clock` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `lens` | 0 | 0% | — | **UNRESOLVED — no evidence** |
| `mode` | 0 | 0% | — | **UNRESOLVED — no evidence** |

### Adjacent evidence the corpus DOES carry

- `execLabel` — present in **105/105** records, values: "Suggest" ×104, "Assist" ×1. This is the only *mode*-adjacent evidence, and it is effectively a constant.
- `owner` — **0** records, 0 distinct values. Persona names recoverable from it: none.
- `lens` — 0 records. Lens names recoverable: none.

**Verdict.** `cardinality` is derivable from slate shape. `lens` and `persona` have partial, real
evidence. `contract_class`, `entitlement`, `on_clock` and a meaningful `mode` have **no corpus
evidence at all** and are currently synthesised by the generator — clearly labelled as mock values.
They REQUIRE A PRODUCT DECISION before any real dataset is built.

## 8. Decision Object coverage matrix

| Decision Object field | Existing source | Coverage | Transformation | Req. | Notes |
|---|---|---:|---|:--:|---|
| `proposal_id` | derived: story_code + stage | 100% | synthesise stable id | Req | No id exists in the corpus |
| `story_code` | `index.json` code / fixture dir | 100% | none | Req | Verified parent identity (Gap #1) |
| `stage` | fixture filename | 100% | none | Req |  |
| `action_type` | — none — | 0% | — | Req | **UNRESOLVED** — placeholder mapped from category |
| `cardinality` | slate/rows array length | 100% | derive from shape | Req | All 26 decide stages are multi-item |
| `contract_class` | — none — | 0% | — | Req | **UNRESOLVED — product decision** |
| `on_clock / deadline` | — none — | 3/105 | — | Req | **UNRESOLVED — product decision** |
| `mode` | `execLabel` | 100% | map to enum | Req | Degenerate: 104×"Suggest", 1×"Assist" |
| `entitlement` | — none — | 0% | — | Req | **UNRESOLVED — product decision** |
| `lens` | `lens` | 0/105 | lowercase + extract | Req | Partial real evidence |
| `persona` | `owner`, `lens` | 0/105 | extract persona token | Req | Partial real evidence |
| `title` | `index.json` headline | 100% | none | Req |  |
| `narrative` | `dialNote`/`rationale`/… | 19/105 | pick first prose field | Req | Empty for stages with no prose |
| `impact` | — none typed — | 0% | synthesise | Opt | Corpus has only pre-formatted strings |
| `confidence` | `confLabel`/`confBadge` | 5/105 | parse to 0..1 | Opt | Sparse |
| `eligibility` | `blocked`,`canApprove`,`blockReason` | 12/105 | derive per action, fail-closed | Req | Only decide/execute carry it |
| `guardrails.verdict` | `blocked`/`canApprove` | 12/105 | booleans → 4-value enum | Opt |  |
| `guardrails.checks` | `checks` | 19/105 | strip presentation | Opt |  |
| `proposal` | stage-specific keys | 100% | map to canonical slots | Req | Shape varies by stage |
| `totals` | `totals`/`rollup` | 15/105 | strip presentation | Opt |  |
| `execution` | execute-stage keys | 26/105 | map to canonical slots | Opt | Execute stage only |
| `status` | — none — | 0% | default `pending` | Req | No lifecycle state in the corpus |
| `updated_at` | — none — | 0% | synthesise deterministically | Req | No timestamps in the corpus |

## 9. Canonical dataset plan

- **Action Stories:** 26
- **Stage Decision Objects:** 105 (one per story × stage)
- **Proposal id strategy:** one `proposal_id` **per stage**, not one shared per story.
  Evidence: each stage carries its own status, eligibility and payload, and the action endpoint
  mutates one stage at a time. A story-wide id could not address them. The parent relationship is
  carried by `story_code`, which is exactly how Gap #1 groups them.
- **Common across all stages:** identity, the seven axes, title, narrative, status, updated_at.
- **Stage-specific:** the `proposal` payload, `eligibility` (only decide/execute act), `execution`
  (execute only), `guardrails` (decide mainly).
- **Normalised:** pre-formatted currency/percent strings → typed `{value, unit}`; boolean guardrails
  → the 4-value verdict enum; prose fields → one `narrative`.
- **Discarded:** every presentation, geometry, SVG, visibility and mockup-meta key counted in §4.
- **Preserved as corpus evidence only:** the 105 raw fixtures and 26 manifests, unchanged.

## 10. Template conformance

Existing architecture is unchanged: Decision Object → template → slot → declared `blockType` →
`BLOCK_REGISTRY` → existing React component. No new blocks, no backend-specified components.

### `reason.v1` — 8 slots (5 core, 3 conditional)

| Slot | Tier | Decision Object path | blockType | Omitted when absent |
|---|---|---|---|:--:|
| `narrative` | core | `narrative` | `text` | ✓ |
| `policy` | core | `proposal.policy` | `table` | — |
| `roles` | conditional | `proposal.roles` | `table` | ✓ |
| `decision_mode` | core | `mode` | `text` | — |
| `decision_lens` | core | `lens` | `text` | ✓ |
| `decision_persona` | core | `persona` | `text` | ✓ |
| `deadline` | conditional | `deadline` | `text` | ✓ |
| `inputs` | conditional | `proposal.inputs` | `labelValueList` | ✓ |

### `analyze.compare.v1` — 9 slots (5 core, 4 conditional)

| Slot | Tier | Decision Object path | blockType | Omitted when absent |
|---|---|---|---|:--:|
| `primary_insight` | core | `proposal.primary_insight` | `text` | ✓ |
| `narrative` | core | `narrative` | `text` | ✓ |
| `comparison` | conditional | `proposal.comparison` | `barChart` | ✓ |
| `trend` | conditional | `proposal.trend` | `lineChart` | ✓ |
| `distribution` | conditional | `proposal.distribution` | `scatterChart` | ✓ |
| `detail_rows` | core | `proposal.detail_rows` | `table` | — |
| `decision_mode` | core | `mode` | `text` | — |
| `decision_lens` | core | `lens` | `text` | ✓ |
| `deadline` | conditional | `deadline` | `text` | ✓ |

### `decide.slate.v1` — 14 slots (9 core, 5 conditional)

| Slot | Tier | Decision Object path | blockType | Omitted when absent |
|---|---|---|---|:--:|
| `recommendation` | core | `proposal.recommendation` | `text` | — |
| `recommendation_metrics` | conditional | `proposal.recommendation_metrics` | `table` | ✓ |
| `slate` | core | `proposal.slate` | `table` | — |
| `slate_summary` | conditional | `proposal.slate_summary` | `labelValueList` | ✓ |
| `guardrail_verdict` | core | `guardrails.verdict` | `text` | — |
| `guardrail_checks` | conditional | `guardrails.checks` | `labelValueList` | ✓ |
| `totals_rows` | conditional | `totals.rows` | `labelValueList` | ✓ |
| `impact` | core | `impact` | `number` | ✓ |
| `confidence` | core | `confidence.value` | `number` | ✓ |
| `confidence_calibrated` | core | `confidence.calibrated` | `flag` | ✓ |
| `decision_mode` | core | `mode` | `text` | — |
| `decision_contract_class` | core | `contract_class` | `text` | ✓ |
| `decision_lens` | core | `lens` | `text` | ✓ |
| `deadline` | conditional | `deadline` | `text` | ✓ |

### `execute.bridge.v1` — 10 slots (6 core, 4 conditional)

| Slot | Tier | Decision Object path | blockType | Omitted when absent |
|---|---|---|---|:--:|
| `narrative` | core | `narrative` | `text` | ✓ |
| `plan` | core | `execution.plan` | `table` | — |
| `progress` | core | `execution.progress_pct` | `number` | — |
| `progress_rows` | conditional | `execution.progress_rows` | `table` | ✓ |
| `execution_targets` | conditional | `execution.targets` | `itemQueue` | ✓ |
| `ledger` | conditional | `execution.ledger` | `table` | ✓ |
| `verification` | core | `execution.verification` | `labelValueList` | — |
| `rollback` | core | `execution.rollback` | `labelValueList` | — |
| `decision_mode` | core | `mode` | `text` | — |
| `deadline` | conditional | `deadline` | `text` | ✓ |

### `locked.v1` — 3 slots (3 core, 0 conditional)

| Slot | Tier | Decision Object path | blockType | Omitted when absent |
|---|---|---|---|:--:|
| `locked_title` | core | `title` | `text` | — |
| `teaser_summary` | core | `proposal.teaser_summary` | `text` | — |
| `upgrade_cta` | core | `proposal.upgrade_cta` | `text` | — |

## 11. Normalized output (produced by `npm run normalize`)

- **105** Decision Objects across **26** Action Stories
- Stage distribution: `reason`=26, `analyze`=26, `decide`=26, `execute`=26, `live`=1
- Records failing contract validation: **0** of 105

### Slot fill rate against the normalized dataset

| Template :: slot | Tier | Populated | Coverage |
|---|---|---:|---:|
| `reason.v1::narrative` | core | 21/21 | 100% |
| `reason.v1::policy` | core | 21/21 | 100% |
| `reason.v1::roles` | conditional | 14/21 | 67% |
| `reason.v1::decision_mode` | core | 21/21 | 100% |
| `reason.v1::decision_lens` | core | 21/21 | 100% |
| `reason.v1::decision_persona` | core | 21/21 | 100% |
| `reason.v1::deadline` | conditional | 14/21 | 67% |
| `reason.v1::inputs` | conditional | 10/21 | 48% |
| `analyze.compare.v1::primary_insight` | core | 21/21 | 100% |
| `analyze.compare.v1::narrative` | core | 21/21 | 100% |
| `analyze.compare.v1::comparison` | conditional | 10/21 | 48% |
| `analyze.compare.v1::trend` | conditional | 0/21 | 0% |
| `analyze.compare.v1::distribution` | conditional | 2/21 | 10% |
| `analyze.compare.v1::detail_rows` | core | 21/21 | 100% |
| `analyze.compare.v1::decision_mode` | core | 21/21 | 100% |
| `analyze.compare.v1::decision_lens` | core | 21/21 | 100% |
| `analyze.compare.v1::deadline` | conditional | 14/21 | 67% |
| `decide.slate.v1::recommendation` | core | 21/21 | 100% |
| `decide.slate.v1::recommendation_metrics` | conditional | 15/21 | 71% |
| `decide.slate.v1::slate` | core | 21/21 | 100% |
| `decide.slate.v1::slate_summary` | conditional | 7/21 | 33% |
| `decide.slate.v1::guardrail_verdict` | core | 21/21 | 100% |
| `decide.slate.v1::guardrail_checks` | conditional | 10/21 | 48% |
| `decide.slate.v1::totals_rows` | conditional | 16/21 | 76% |
| `decide.slate.v1::impact` | core | 21/21 | 100% |
| `decide.slate.v1::confidence` | core | 21/21 | 100% |
| `decide.slate.v1::confidence_calibrated` | core | 21/21 | 100% |
| `decide.slate.v1::decision_mode` | core | 21/21 | 100% |
| `decide.slate.v1::decision_contract_class` | core | 21/21 | 100% |
| `decide.slate.v1::decision_lens` | core | 21/21 | 100% |
| `decide.slate.v1::deadline` | conditional | 14/21 | 67% |
| `execute.bridge.v1::narrative` | core | 21/21 | 100% |
| `execute.bridge.v1::plan` | core | 21/21 | 100% |
| `execute.bridge.v1::progress` | core | 21/21 | 100% |
| `execute.bridge.v1::progress_rows` | conditional | 11/21 | 52% |
| `execute.bridge.v1::execution_targets` | conditional | 14/21 | 67% |
| `execute.bridge.v1::ledger` | conditional | 1/21 | 5% |
| `execute.bridge.v1::verification` | core | 21/21 | 100% |
| `execute.bridge.v1::rollback` | core | 21/21 | 100% |
| `execute.bridge.v1::decision_mode` | core | 21/21 | 100% |
| `execute.bridge.v1::deadline` | conditional | 14/21 | 67% |
| `locked.v1::locked_title` | core | 20/20 | 100% |
| `locked.v1::teaser_summary` | core | 20/20 | 100% |
| `locked.v1::upgrade_cta` | core | 20/20 | 100% |

Core slots not populated on every member of their family: **0**.

## Unresolved — require a product decision before a real dataset

1. **`action_type`** — zero corpus evidence. Highest-risk contract unknown.
2. **`contract_class`** — zero corpus evidence; current enum is invented.
3. **`entitlement`** — zero corpus evidence; currently synthesised.
4. **`on_clock` / `deadline`** — 3 of 105 records; currently synthesised.
5. **`mode`** — present but degenerate (104×"Suggest").
6. **`impact` / `updated_at` / `status`** — no corpus source; synthesised deterministically.

Everything above is generated from the corpus. Values marked UNRESOLVED are absent from the
evidence and have not been invented here.

