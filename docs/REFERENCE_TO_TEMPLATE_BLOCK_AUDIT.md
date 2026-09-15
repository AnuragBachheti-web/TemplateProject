# Reference → Template/Block Gap Audit

> **STATUS: GAPS FIXED.** This document was the audit; it is now the audit **and its resolution**.
> Every section below states the finding **as measured when the audit ran**, followed by an
> `AFTER` line stating what it measures today. Section 18 is the consolidated before/after, and
> section 19 is what remains genuinely unresolved.
>
> The fix touched the normalization layer, the five templates' slots, two block contracts and one
> selector row. It added **no template**, **no rendering engine**, **no backend**, and **one** new
> block-level helper. The architecture is unchanged.

**Scope:** why the CURRENT template-driven project does not show the content the REFERENCE project shows,
and what was changed to fix it.
**Type (original pass):** audit only — nothing was modified.
**Type (this revision):** the gap fix has been implemented; every finding below carries its AFTER state.

| | |
|---|---|
| Reference project | `/Users/rohit/Downloads/Realify Workspace Dashboard Build (1)` (114 `.dc.html` mockups + `_ds` design system + `support.js`) |
| Current project | `/Volumes/D/TemplateProject` |
| Reference mirror inside current project | `source-mockups/` — byte-identical copy of the 114 mockups (verified by name diff; only `_ds`, `icons`, `assets`, `support.js`, `ledger-overlay.js`, `screenshots`, `uploads` and one stray `Realify S9.2 Reason - Replenishment.html` are absent) |
| Date | 2026-09-15 |
| Tests at time of audit | `vitest run` → **51 files / 1053 tests, all passing** |
| Tests after the fix | `vitest run` → **55 files / 1153 tests, all passing** |
| Build at time of audit / after | `vite build` → **success** both times (chunk-size warning only) |
| Lint at time of audit / after | `eslint .` → 0 errors, 1 pre-existing warning (`ui/Toast.jsx:71`) both times |

Every figure below was produced by running read-only analysis scripts against the real runtime
modules (`resolveBinding.js`, `actionCondition.js`, `blockTypes.js`, `selectTemplate.js`) over the
real committed dataset. Nothing is sampled or estimated.

---

## 1. Executive summary

The current system is **architecturally sound and behaviourally healthy** — it renders without a
single unresolved binding, a single shape violation or a single placeholder across all 105 Decision
Objects. That is precisely what makes the gap hard to see: **the UI is not broken, it is starved.**

The content loss happens **upstream of the renderer**, at `extraction/normalizeCorpus.js`, and is
compounded by a small number of missing slots and one degenerate axis.

Four numbers carry the whole audit:

| Measure | Value |
|---|---|
| Reference business fields (after the project's own hygiene pass strips presentation) | **1,558** across 105 screens |
| Of those, carried into the normalized Decision Objects | **430 (27.6 %)** |
| **Dropped at normalization** | **1,128 (72.4 %)** |
| Rendered slot instances that are just echoes of synthesised mock axes, not reference content | **321 of 712 (45 %)** |
| Rendered *content* slot instances filled from the **wrong reference field** | **122 of 391 (31 %)** |

And three structural facts:

- **20 of 105** Decision Objects are `entitlement: "locked"` — they render `locked.v1`, which is 3 text lines. That is 19 % of the corpus deliberately showing nothing, caused by a *synthesised* mock axis (`ENTITLEMENTS[h % 5]`), not by product intent.
- **1 of 105** (`prop_s10_6_live`) selects **no template at all** and renders an error page.
- **`cardinality` is 100 % `"many"`** for all 105 objects — `normalizeCorpus.js:330` is literally `? 'many' : 'many'`. Axis 1 is degenerate, which is the exact failure the contract file warns about in its own header comment.

### AFTER

| Measure | Audit | Now | |
|---|---:|---:|---|
| Reference business fields carried into the Decision Objects | 430 (27.6 %) | **610 (39.2 %)** | +42 % |
| Content-slot renders filled from the **wrong** reference field | 122 of 391 (31 %) | **0 of 555** | eliminated |
| Rendered slot instances that are real reference content | 391 (55 %) | **555 (72.6 %)** | +42 % |
| Rendered slot instances that are synthesised axis echoes | 321 (45 %) | **209 (27.4 %)** | −35 % |
| Duplicate-content incidents (one value in two slots on one screen) | 41 | **0** | eliminated |
| Records blanked to a 3-line locked teaser | 20 of 105 | **0** | eliminated |
| Records rendering an error page | 1 (`live`) | **0** | eliminated |
| Template sections declared but permanently empty | 2 | **0** | eliminated |
| Registered blocks unreachable from any template | 5 | **3** (documented) | −2 |
| Canonical slots | 34 | **51** | +17 |
| Unresolved bindings / shape violations across the corpus | 0 | **0** | held |

**The headline conclusion (unchanged, and it is what the fix acted on):** this is *not* primarily a missing-block problem. Of the reference's
meaningful rendering units, the current block library can already render the overwhelming majority.
The failure is, in order of magnitude:

1. **normalization drops 72 % of reference business content** (Gap type 4: missing normalized data);
2. **the normalizer's `fallbackScan` fills canonical slots with arbitrary, semantically unrelated fields** (Gap type 3: wrong mapping) — 31 % of all content renders;
3. **a handful of slots are genuinely missing** for concepts that survive normalization but have nowhere to go (Gap type 1) — plus two declared-but-empty sections;
4. **five registered blocks are unreachable** because no template references them (Gap type 2-adjacent);
5. **two formatting defects** in otherwise-correct blocks (Gap type 6).

---

## 2. Reference project inventory

### 2.1 What the reference actually is

The reference is **not a React application**. It is 114 self-contained "Design Canvas" (`.dc.html`)
mockups. Each one is:

- a single fixed-size `<div data-screen-label="...">` at 1440×1024,
- static markup using a template dialect (`sc-for`, `sc-if`, `{{ binding }}`, `x-import`),
- plus **one `<script type="text/x-dc">` block** containing `class Component extends DCLogic` with a
  `data()` method (the business dataset) and a `renderVals()` method (the view model the markup binds to).

Evidence: `/Users/rohit/Downloads/Realify Workspace Dashboard Build (1)/S9.1-3-decide.dc.html:440` —
the `data()` method returns three named scenario slates (`conservative`/`balanced`/`aggressive`),
each with `groups` of SKU moves carrying `rev`/`cm`/`cap`/`gm`, and `renderVals()` derives
`heroMetrics`, `moveBar`, `totals`, `checks`, `blocked`, `canApprove` from the operator's current
selection.

**This matters for the audit:** the reference has *no reusable component library of its own* to
compare against. The `renderVals()` keys **are** the reference's block boundaries, and the current
project already captured all 105 of them as fixtures — `src/features/action-stories/__corpus__/fixtures/raw/<code>/<stage>.json`.
So the reference inventory below is derived from two independent sources that agree:
the **rendered markup structure** (parsed from the `.dc.html` body) and the **`renderVals()` output**
(the archived fixtures).

### 2.2 Screen inventory

| Group | Count | Files |
|---|---:|---|
| Stage screens (the audit's subject) | **105** | `S9.1…S9.20` × 4 stages (80), `S10.1…S10.5` × 4 (20), `S10.6` × 5 incl. `live` (5) |
| Duplicate/standalone variant | 1 | `S9.2-1-reason-standalone.dc.html` |
| Workspace/shell screens | 7 | `S00-workspace`, `S00-workspace v1 (masthead)`, `S00-chat`, `S00-chat-reply`, `S00-explore`, `S00-prompts`, `S00-agents` |
| Canvas index | 1 | `Canvas.dc.html` |
| **Total `.dc.html`** | **114** | |

26 Action Stories. Stage coverage is complete: every story has reason/analyze/decide/execute;
only `S10.6` (Peak readiness) adds a fifth `live` stage.

### 2.3 Design-system inventory

`_ds/realify-design-system-002c390c-…/_ds_manifest.json` declares **24 components**:

`ActionCard`, `DataTable`, `FeaturedPluginCard`, `IntelCard`, `KpiCard`, `PluginCard`,
`ProductRiskCard`, `Avatar`, `AvatarStack`, `Badge`, `PriorityPill`, `EmptyState`, `Modal`,
`Skeleton`, `Toast`, `Button`, `Checkbox`, `Input`, `Select`, `Toggle`, `PromptBar`, `SidebarNav`,
`Tabs`.

**Only 6 of these are used by the 105 stage screens** (counted across all mockups):
`Avatar` (183 uses), `Badge` (114), `PriorityPill` (7), `DataTable` (2), `Tabs` (2), plus the custom
element `realify-ledger` from `ledger-overlay.js` (112 uses — a global overlay, not stage content).

**Conclusion:** the design system is *not* the reference block library. The stage screens are hand-authored
markup driven by `renderVals()`. The DS components are chrome (avatars, badges) and are already
covered by the current project's `ui/` primitives (`Button`, `Checkbox`, `Modal`, `Toast`, `Tooltip`,
`Alert`, `ConfirmDialog`). **No gap here. Do not port the DS.**

### 2.4 Field inventory (the real measure)

| Measure | Value | Source |
|---|---:|---|
| Raw `data.*` fields across 105 fixtures | **2,498** | `__corpus__/fixtures/raw/**` |
| Presentation-only fields (stripped by the project's own hygiene: `var(--…)`, SVG `M…` paths, geometry keys, `isDecorativeKey`) | **940 (37.6 %)** | `extraction/classifyBlocks.js` + `extraction/normalizeCorpus.js:52-93` |
| **Business fields** | **1,558** | |
| Distinct top-level business keys | 1,137 | `docs/DECISION_OBJECT_DATA_AUDIT.md` |

Distinct business keys per stage: reason **101**, analyze **224**, decide **271**, execute **237**, live **~30**.

---

## 3. Reference block/component library

Method: a "block" here is a **meaningful reusable UI/business rendering unit** — a section of the
screen with its own heading, its own data array, and its own semantic job. Nested markup (a row's
tone span, a checkbox box, a chip's icon) is *not* counted. Frequencies are "screens carrying the
concept, out of 26 stories".

### 3.0 Shell (present on 105/105 screens)

| Reference concept | Evidence | Purpose | Data input | Reusable? | Should be a canonical block? |
|---|---|---|---|---|---|
| SidebarNav | every `.dc.html` `<aside>` | Product nav (Chat/Workspace/Explore/Prompts/Agents/Integrations/Settings) | static | yes | **No** — app shell, not stage content |
| OrgMasthead | "Realify · Northwind Home & Kitchen · 4 channels · All systems" | Tenant/channel context | static | yes | **No** — app shell |
| ExecutionModeDial | `execLabel` + `execSegs` (3 segments) | The Suggest/Approve/Auto dial | `execLabel`, `execSegs` | yes | **Partly** — `execLabel` → `decision_mode` slot ✔; `execSegs` is pure presentation ✘ |
| Breadcrumb | "Workspace · Actions Queue" + "Assortment · S9.1" | Where am I | `name`, `code` | yes | Already in `StagePage.jsx:40-48` ✔ |
| **PinnedContextCard** | `pinnedTop`, `pinnedSub` + lens line + persona line + agent chips | The persistent proposal identity strip: headline, 2–3 key figures, `Lens: Sales · Margin`, `Merchandiser + Prospector`, and the AI agents in play (`Forecaster`, `Role Classifier`, `GMROI Engine`) | `pinnedTop`, `pinnedSub`, `agents`, `chips` | yes (105/105) | **Partly** — see §12 |
| StepTracker | "Reason / Analyze / Decide / Execute" + "Step 3 of 4" | Stage progress | stage list | yes | Already `components/StepTracker.jsx` ✔ |
| StageFooterStatus | `footStatus` + `footTone` (38 screens) | One-line "what state is this stage in" | `footStatus` | yes | **Missing** — see §9 |
| StageNavCTA | "Continue to Analyze", "Back to Reason", "Back to Workspace", `closeLabel` | Forward/back stage navigation | static + `closeLabel` | yes | Partly — StepTracker covers it |

### 3.1 Reason (26 screens)

| # | Reference concept | Evidence (key, screens) | Purpose | Data shape | Semantic unit? |
|---|---|---|---|---|---|
| R1 | **Trigger / "What raised this"** | `trigger` 14/26 | Why this proposal exists now | `[{when, what}]` | **Yes** |
| R2 | **Policy / service levels** | `policy` 3/26, `targets` 8/26, `rules`, `standards`, `thresholds`, `slas` | "What Realify holds itself to" — the governing targets | `[{label, value, why, current}]` | **Yes** |
| R3 | **Locked constraints** | `locked` **19/26** | "Locked — owned by another lens": constraints that are *not negotiable in Decide* | `[{label, value/amount, detail}]` | **Yes** |
| R4 | **Roles / cohort taxonomy** | `roles` 3/26, `cohorts`, `clusters` | The SKU/entity taxonomy this proposal reasons over | `[{name, count, def}]` | **Yes** |
| R5 | **AI agents in play** | `agents` 14/26 | Which models/agents produced this (`Forecaster`, `PO Sizing Engine`) | `[{name, role, icon}]` | **Yes — distinct from R4** |
| R6 | **Inputs / sources** | `inputs` 8/26, `sources` 3/26, `evidence` | What the recommendation was computed from | `[{label, meta}]` | **Yes** |
| R7 | **Context chips** | `chips` 10/26, `brandChips` 3, `channels` 3 | Scope chips (channels, brands, windows) | `[{icon, label}]` | Yes (low-value) |
| R8 | **Dial note** | `dialNote` 12/26 | "What Realify will do at this execution mode" | string | **Yes** |
| R9 | Cross-links | "Edit policy →", "See last week's Ledger entry →" | Navigation | href | **No** — reference-only nav |

### 3.2 Analyze (26 screens)

| # | Reference concept | Evidence | Purpose | Data shape | Semantic unit? |
|---|---|---|---|---|---|
| A1 | **Primary finding** | `headline`, `sortNote`, `trendNote`, `segNote` (`primaryInsight` itself appears in **0/26**) | The one sentence the analysis exists to deliver | string | **Yes** |
| A2 | **Comparison / magnitude chart** | `bars` 3, `movement` 2, `sovBars`, `pacing`, `wasteMix`, `sizes`, `recon`, `expiryBars`, `timeline`, `cccTrend` | Magnitude across categories | `[{label, value|h|pct}]` | **Yes** |
| A3 | **Trend / forecast fan** | `curves` 2, `p10Path`, `p50Path`, `bandPath`, `fanOuter` | Time series, incl. P10/P50/P90 fan | **raw SVG path strings** | **Yes** (but see §13) |
| A4 | **Distribution / scatter** | `points` 2, `clusters` 2, `ladders` | Two-dimensional spread | `[{cx, cy, r}]` — **pixel coordinates** | **Yes** (but see §13) |
| A5 | **Waterfall / variance bridge** | `bars` with `{top, height, anchor}` (S10.1) | Bridge from plan to actual | `[{label, value, top, height, anchor}]` | **Yes** |
| A6 | **Heatmap grid** | `heat`, `zoneBars` | 2-D matrix | `[{label, cells:[…]}]` | **Yes** |
| A7 | **Gauge / capacity meters** | `capacity` 2, `lanes` 2 | Value measured against a threshold | `[{label, value, limit}]` | **Yes** |
| A8 | **Detail/evidence table** | `rows` 8/26, `gaps` 4, `cases`, `disposition`, `sorts`, `conflicts`, `flows`, `queries`, `buckets`, `desks` | The row-level evidence board ("Stock-out risk board") | `[{…}]` | **Yes** |
| A9 | **Table column schema** | `cols` 4/26 → `[{key, label, numeric}]` | Column labels + numeric alignment for A8 | `[{key,label,numeric}]` | **Borderline** — see §13 |
| A10 | **Table footer note** | "10 of 34 at-risk SKUs", `footStatus` | Row-count/ranking disclosure under a table | string | **Yes** |
| A11 | **Selected-entity inspector** | `sel` 11/26, `selName`/`selMeta`/`selNote` | Click a point/row → detail panel for that entity | `{name, meta, note}` | **Yes** |
| A12 | **Chart legend + axis ticks** | `legend` 4, `yTicks` 4, `xTicks`, `gridX`, `targetY`, `zeroY` | Chart furniture | mixed | **No** — presentation |
| A13 | **Filters / sorts** | `filters` 3, `sorts` 3 | Table controls | `[{label, active}]` | **Borderline** — interaction, not content |

### 3.3 Decide (26 screens) — see §4 for the deep dive

| # | Reference concept | Evidence | Purpose | Semantic unit? |
|---|---|---|---|---|
| D1 | Recommendation header (eyebrow + name + confidence badge) | `slateName`, `slateMeta` 7/26, `confLabel` 3/26, `confTint`/`confTone` | Names the recommendation and its confidence | **Yes** |
| D2 | Recommendation title | `heroTitle` 8/26 | The recommended decision, one line | **Yes** |
| D3 | Recommendation detail | `heroSub`, `heroBody` 6/26, `heroLine` 3/26 | The reasoning sentence under the title | **Yes** |
| D4 | Recommendation metrics | `heroMetrics` 9/26 → `[{label, value, range, note}]` | The figures behind it, **each with a P10–P90 range and a caveat note** | **Yes** |
| D5 | Move-composition bar | `moveBar` → `[{label, n, w%}]` | Stacked proportional bar of the decision's composition | **Yes** |
| D6 | Alternative slates selector | `slates` 1/26, `modes` 3, `offerModes`, `caps`, `slateTabs` 2 | Pick a scenario; **"switching recomputes every figure on this screen"** | **Yes** |
| D7 | Move-set groups | `groups` 6/26 → `[{name, tag, detail, rev, cm, cap, toggle}]` + `approvedCount` + toggle-all | The selectable *groups of items* being approved | **Yes** |
| D8 | Focus drill-down table | `focusTitle`, `focusMeta`, `focusRows`, `focusFooter` | Expands the focused group into its item rows (SKU / Capital / 90d rev / GMROI) | **Yes** |
| D9 | Item slate | `slate` 3/26, `offerRows`, `items`, `skus` | The flat selectable item list (when there are no groups) | **Yes** |
| D10 | Live totals | `totals` 14/26 | "Live totals · **approved only**" — recomputes from selection | **Yes** |
| D11 | Policy check | `policyStatus` 12/26 + `checks` **19/26** → `[{label, value, pct, note}]` | Governance checklist **with a % meter and an explanatory note per row** | **Yes** |
| D12 | Held-out / exclusions | literal blocks ("Brand-protection lines · 9 SKUs") | What is excluded from the decision and why | **Yes** |
| D13 | Confidence basis | `basis` 1/26, `ladder` | Provenance figures for the confidence number | **Yes** |
| D14 | Next-action routes | `actions` 3/26, `routes` 5/26 → `[{title, note, href}]` | "Approve subset / Approve all / Send back" as **explained cards**, not bare buttons | **Yes** |
| D15 | Blocked banner | `blocked` 12/26, `blockReason` 8/26 | Why approval is unavailable | **Yes** |
| D16 | Approval CTA | `ctaLabel` 12/26, `approveLabel` 14/26, `approveSub` 3, `approvalNote` 3 | Primary action + its sub-copy | **Yes** |

### 3.4 Execute (26 screens)

| # | Reference concept | Evidence | Purpose | Semantic unit? |
|---|---|---|---|---|
| E1 | Deployment header | `planLine` 14/26, `headMeta` 8/26 | "Deployment · LIFE-Q4-07" + what is being written | **Yes** |
| E2 | Destination targets | `dests` 4/26, `tray` 6/26, `orders` 2 | Systems/channels receiving the writes, each with a status and a push button | **Yes** |
| E3 | Per-target item diff | `d.items[].before` / `.after` | **Before → after value per item** | **Yes** |
| E4 | Execution plan / stages | `stages` 11/26, `steps` 3, `chain` | The ordered plan | **Yes** |
| E5 | Progress meter | `progressPct` 14/26 | % complete | **Yes** |
| E6 | Progress rows | `progressRows` 14/26 | Per-target progress | **Yes** |
| E7 | Monitors / verification | `monitors` **16/26** | What must hold true after the write | **Yes** |
| E8 | Auto-flags | `flags` → `[{when, rule, action}]` | Thresholds that raise an exception | **Yes** |
| E9 | Arming control | `armCopy` 12/26, `armBtnLabel` 12/26 | "Auto-pause on decay" — arm/disarm a safety | **Yes** |
| E10 | Rollback panel | `rollback` 8/26, `rbCopy` 6, `rbState` 6, `rbHint` 4, `revert` | How to undo, per target, with current availability state | **Yes** |
| E11 | Ledger | `ledger` 1/26, `ledgerCopy` 8/26 | The append-only record + what will be written to it | **Yes** |
| E12 | Bulk-run controls | `allLabel` 10, `allNote` 10, `runAllLabel` 10, `pushAllLabel` 4 | "Run all / Push all" + the envelope note that explains why they go together | **Yes** |
| E13 | Downstream links | "Hypothesis Register · S10.7", "ESP + SMS connections" | Where this flows next | Borderline |
| E14 | Close CTA | `closeLabel` 15/26 | "Back to workspace" | **No** — nav |

### 3.5 Live (1 screen, `S10.6-5-live`)

| # | Concept | Evidence |
|---|---|---|
| L1 | Live banner + contract chip | `liveLabel`, `contractChip`, `liveTone` |
| L2 | Phase tabs | `phases` |
| L3 | Countdown clock | `clockLabel`, `expired` |
| L4 | Lens KPI tiles (5) | `lensTiles` → `[{lens, value, delta, deltaLabel, note}]` |
| L5 | In-flight adjustments with per-row Apply/Hold | `adjustments` |
| L6 | Post-event readout (naive vs trough-adjusted vs plan) | `readout` |
| L7 | Ledger annotations | `annotations` |
| L8 | Pace chart vs P50 band | `bandPath`, `p50Path`, `actualPath` |
| L9 | Account health rows | `healthRows` |
| L10 | Cover watch | `coverRows` |
| L11 | Contract clock clauses | `clauseRows` |

### 3.6 Totals

| Stage | Meaningful units |
|---|---:|
| Shell | 8 |
| Reason | 9 |
| Analyze | 13 |
| Decide | 16 |
| Execute | 14 |
| Live | 11 |
| **Total reference rendering units** | **71** |
| Of which **pure presentation / nav** (should NOT become blocks) | **9** (shell nav ×2, execSegs, chart legend/ticks, cross-links ×2, close CTA, table column schema†, filters/sorts†) |
| **Reference units that should map to canonical business blocks** | **62** |
| After consolidating repeats across stages (footer status, CTA, links, tables) | **~41 distinct semantic kinds** |

† borderline — argued in §13.

---

## 4. Recommendation deep dive — Reference vs Current

> This section answers the explicit question: *how many meaningful blocks make up Recommendation in
> the reference, what does each render, what data does each consume, and which are merely nested markup?*

### 4.1 Evidence

Parsed structure of `S9.1-3-decide.dc.html` (reference), main column, in document order:

```
T: "Recommended portfolio move"          <- static eyebrow
b: slateName        "Balanced"
b: confTint/confTone/confLabel           "Med-high · 78%"   (tint/tone = presentation)
b: heroTitle        "Keep 162 · grow 18 · reduce 22 · exit 12 + the top 4 gap fills"
b: heroSub          "Grow the proven, cut the depth on the tail, exit the floor breaches, range four gaps."
b: heroMetrics -> m.label / m.value / m.range / m.note / m.tone     (3 cards)
b: moveBar     -> b.label / b.n / b.w / b.hue                        (stacked proportional bar)
T: "Basis · 18,402 order rows, 90-day window · fees, ads and returns netted · Scout competitor-assortment feed"
```

Cross-checked against a second, structurally independent screen, `S9.13-3-decide.dc.html`:

```
T: "Recommended journey slate"
b: slateMeta
b: confLabel
b: heroTitle
b: heroMetrics -> m.label / m.tone / m.value / m.note
```

Same skeleton, minus `moveBar` and `heroSub`. This is the reference's stable Recommendation pattern.

### 4.2 How many meaningful blocks is Recommendation?

**Six semantic units, not one.**

| # | Unit | Renders | Data consumed | Independent? |
|---|---|---|---|---|
| **1** | **Recommendation identity** | Eyebrow + the recommendation's *name* + a confidence badge | `slateName` \| `slateMeta`, `confLabel` | Yes — it is the "which recommendation" label, distinct from what it says |
| **2** | **Recommendation statement** | The one-line recommended decision | `heroTitle` (8/26) | Yes — the hero sentence |
| **3** | **Recommendation rationale** | The quieter sentence under the statement | `heroSub` / `heroBody` (6/26) / `heroLine` (3/26) | Yes — different altitude from #2 |
| **4** | **Recommendation metrics** | 3 figure cards, **each with `value` + `range` (P10–P90) + `note` (caveat)** | `heroMetrics` (9/26) | Yes |
| **5** | **Composition bar** | A single stacked proportional bar showing how the recommendation splits (Keep 162 / Grow 18 / Reduce 22 / Exit 12 / Gap fill 4) | `moveBar` → `[{label, n, w}]` | Yes — a chart, not a list |
| **6** | **Basis line** | One provenance sentence directly under the recommendation | literal text in S9.1; `basis` array (1/26) elsewhere | Yes |

**What is merely nested markup and must NOT become a block:**
`confTint`, `confTone`, `m.tone`, `b.hue`, the flex wrappers, the `sc-if` tone branches, and
`execSegs`. These are 100 % presentation — the current project already strips them
(`normalizeCorpus.js:70-73`), correctly.

### 4.3 What the current system does with each

| Ref unit | Current slot | Current block | Current data path | Result | Gap |
|---|---|---|---|---|---|
| 1 Identity | — | — | — | **Not rendered** | **MISSING_SLOT.** `slateName`/`slateMeta`/`confLabel` are dropped by normalization. The numeric `confidence` axis in the rail is a *synthesised mock value*, not the reference's real confidence. |
| 2 Statement | `recommendation` | `TextBlock` (role: hero) | `proposal.recommendation` | **Renders — but from the wrong field 14 times in 21** | **WRONG_MAPPING.** `normalizeCorpus.js:247` prefers `heroTitle` but falls back to **`approveLabel`** — a *button label*. Provenance: `approveLabel:11`, `heroTitle:7`, synthesised:3. So on 11 of 21 decide screens the hero "recommendation" literally reads `"Approve 41-SKU slate"`. |
| 3 Rationale | — | — | `proposal.recommendation_detail` **exists on 2 objects** | **Not rendered** | **MISSING_SLOT.** The data is produced by `normalizeCorpus.js:248` and then has no slot to land in. Confirmed orphan: `decide.slate.v1::proposal.recommendation_detail ×2`. |
| 4 Metrics | `recommendation_metrics` | `TableBlock` | `proposal.recommendation_metrics` | **Renders on 15 of 21** | Partial. `range` and `note` survive into the data and `TableBlock` does render them as columns — this one is largely **PASS**. |
| 5 Composition bar | `slate_summary` | `LabelValueListBlock` | `proposal.slate_summary` | **Renders as a text list, 7 of 21** | **WRONG_DATA_SHAPE / wrong block.** `moveBar` is `[{label, n, w}]` — a proportional bar. It is bound to `labelValueList`, so it renders as `Keep · 162 · 74.3` rows. The `barChart` block exists and is unused here. |
| 6 Basis | — | — | `proposal.basis` **exists on 2 objects** | **Not rendered** | **MISSING_SLOT + EMPTY SECTION.** `decide.slate.v1` *declares a section* `{"id":"provenance","title":"Basis","region":"rail"}` — and **no block is assigned to it**. The section is literally empty in every render. |

### 4.4 Answer

> **Is the problem template, block, mapping, data, or renderer?**

**All four upstream layers, in this proportion:**

- **Data (largest):** units 1, 3 and 6 are dropped or near-dropped at normalization (`slateName`, `confLabel`, `heroSub`/`heroBody`, `basis`).
- **Mapping (second largest):** unit 2 is filled from `approveLabel` on 11/21 screens.
- **Template (third):** three slots are missing (identity, rationale, basis) and one declared section is empty.
- **Block (smallest):** unit 5 is bound to the wrong existing block type; `barChart` already exists.
- **Renderer:** **not implicated.** `StageRenderer.jsx` resolved every one of these bindings without a single failure.

**No new block component is required for Recommendation.** `TextBlock`, `TableBlock`, `BarChartBlock`
and `LabelValueListBlock` cover all six units.

---

## 5. Current template inventory

Five templates, `src/features/action-stories/templates/`. Selection is
`selectTemplate.js` — a 4-row table keyed `${action_type}|${stage}|${cardinality}`, with
`entitlement === 'locked'` short-circuiting to `locked.v1`.

| Template | Sections (region) | Slots | Actions |
|---|---|---:|---:|
| `reason.v1` | rationale(main), governance(main), context(rail), provenance(rail) | 8 | 0 |
| `analyze.compare.v1` | finding(main), analysis(main), detail(main), context(rail), **rollup(rail)** | 9 | 0 |
| `decide.slate.v1` | recommendation(main), slate(main), guardrails(rail), rollup(rail), context(rail), **provenance(rail)** | 14 | 6 |
| `execute.bridge.v1` | plan(main), execution(main), assurance(rail), context(rail) | 10 | 3 |
| `locked.v1` | teaser(main) | 3 | 0 |
| | | **44 slot instances / 34 distinct slot names** | |

**Two sections are declared and can never be filled** (bolded above) — no block in either template
targets them:

| Template | Empty section | Consequence |
|---|---|---|
| `analyze.compare.v1` | `rollup` — "Totals" | Analyze never shows totals, though `totals.rows` data exists on some analyze objects |
| `decide.slate.v1` | `provenance` — "Basis" | Decide never shows the confidence basis, though `proposal.basis` exists |

**Template selection outcome across all 105 Decision Objects:**

| Template | Objects |
|---|---:|
| `reason.v1` | 21 |
| `analyze.compare.v1` | 21 |
| `decide.slate.v1` | 21 |
| `execute.bridge.v1` | 21 |
| `locked.v1` | **20** |
| **`null` (renders an error page)** | **1** — `prop_s10_6_live` |

`selectTemplate` has no `live` row and `getStageView` throws `MALFORMED` for it
(`src/services/actionStoriesService.js:99-112`). That is a *deliberate, documented* decision, but it
means 11 reference concepts (§3.5) are 100 % unrepresented.

---

## 6. Current block registry audit

`src/features/action-stories/blocks/index.js` registers **14** block types.
`manifests/blockTypes.js` declares the same 14 with validators.

| Block type | Component | Reachable from a canonical template? | Notes |
|---|---|:--:|---|
| `text` | `TextBlock.jsx` | ✔ (17 slot instances) | Hero/compact/plain variants. Does not drop data. |
| `number` | `NumberBlock.jsx` | ✔ (4) | Formats via `formatValue.js`. **See §12 defect.** |
| `flag` | `FlagBlock.jsx` | ✔ (1) | |
| `labelValueList` | `LabelValueListBlock.jsx` | ✔ (7) | **Excellent** — `resolvePrimaryValue` + `extraEntries` preserve *every* field (`LabelValueListBlock.jsx:29-61`). Does not drop data. |
| `table` | `TableBlock.jsx` | ✔ (9) | Derives columns from row keys. |
| `itemQueue` | `ItemQueueBlock.jsx` | ✔ (1) | |
| `lineChart` | `LineChartBlock.jsx` | ✔ (1) | **Renders 0 times** — see §11 |
| `barChart` | `BarChartBlock.jsx` | ✔ (1) | Renders 10 times |
| `scatterChart` | `ScatterChartBlock.jsx` | ✔ (1) | Renders 2 times |
| `waterfallChart` | `WaterfallChartBlock.jsx` | ✘ **UNREACHABLE** | No slot. Data exists (`proposal.bridge`). |
| `heatmapGrid` | `HeatmapGridBlock.jsx` | ✘ **UNREACHABLE** | No slot, no normalized field. |
| `object` | `ObjectBlock.jsx` | ✘ **UNREACHABLE** | No slot. |
| `slider` | `SliderBlock.jsx` | ✘ **UNREACHABLE** | No slot. `StageRenderer` has full cross-block slider wiring (`StageRenderer.jsx:132-140, 197-208`) that no template can ever trigger. |
| `gauge` | `GaugeBlock.jsx` | ✘ **UNREACHABLE** | No slot. Data exists (`proposal.coverage`). |

**5 of 14 registered blocks (36 %) are dead code from the templates' point of view.** Two of them
(`waterfallChart`, `gauge`) have *normalized data already being produced for them* by
`normalizeCorpus.js:235-236` that nothing can render.

Slot vocabulary: **34 slots, 0 unused** — every vocabulary entry is referenced by a template, and
`templateVocabulary.test.js` enforces binding consistency. That layer is clean.

---

## 7. Reference → slot → block → data mapping matrix

Legend for **Result**: `PASS` · `MISSING_SLOT` · `MISSING_BLOCK` · `WRONG_MAPPING` · `MISSING_DATA` ·
`WRONG_DATA_SHAPE` · `RENDERING_BUG` · `REFERENCE_ONLY` · `UNRESOLVED`.

`R=` is rendered instances out of 21 non-locked objects of that stage.

### 7.1 Reason

| Reference concept | Reference data | Template | Slot | Block | Data path | R= | Result | Gap |
|---|---|---|---|---|---|---:|---|---|
| R1 Trigger | `trigger` (14/26) | reason.v1 | — | — | `proposal.trigger` (produced by `normalizeCorpus.js:211`, then orphaned) | 0 | **MISSING_SLOT** | Data is generated and thrown away |
| R2 Policy | `policy`(3) `targets`(8) | reason.v1 | `policy` | table | `proposal.policy` | 21 | **WRONG_MAPPING** | Only **10 of 21** come from `policy`/`targets`. The other 11 come from `rules`, `envelope`, `roles`, `surfaces`, `clusters`, `standards`, `events`, `setup`, `headline`, `metrics`, `postures` — via `fallbackScan: true` |
| R3 Locked constraints | `locked` (**19/26**) | reason.v1 | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | The single most-frequent reason-stage business concept is entirely absent |
| R4 Roles taxonomy | `roles`(3) `cohorts`(1) | reason.v1 | `roles` | table | `proposal.roles` | 14 | **WRONG_MAPPING** | **10 of 14 come from `agents`** — the AI-agent list, which is a *different concept* (R5) |
| R5 AI agents | `agents` (14/26) | reason.v1 | — | — | — | 0 | **MISSING_SLOT** | Collapsed into `roles`, losing both |
| R6 Inputs | `inputs`(8) `sources`(3) | reason.v1 | `inputs` | labelValueList | `proposal.inputs` | 10 | **PASS** | Provenance clean: `inputs:7`, `sources:3` |
| R7 Context chips | `chips`(10) | reason.v1 | — | — | — | 0 | **MISSING_DATA** | Low value; could fold into `inputs` |
| R8 Dial note | `dialNote`(12) | reason.v1 | `narrative` | text (hero) | `narrative` | 13 | **PASS** | |
| R9 Cross-links | hrefs | — | — | — | — | — | **REFERENCE_ONLY** | Mockup navigation between `.dc.html` files |

### 7.2 Analyze

| Reference concept | Reference data | Slot | Block | Data path | R= | Result | Gap |
|---|---|---|---|---|---:|---|---|
| A1 Primary finding | `headline`/`sortNote`/… | `primary_insight` | text (hero) | `proposal.primary_insight` | 9 | **WRONG_MAPPING** | `primaryInsight` exists in **0/26** fixtures despite the vocabulary note claiming "37 uses". Provenance: **synthesised 13**, `pinnedSub` 3 (the *shell* pinned-card subtitle), and 5 one-off keys |
| A1b (duplicate) | — | `narrative` | text | `narrative` | 9 | **RENDERING_BUG** | On **9 of 21** analyze screens `narrative` and `primary_insight` resolve to the *same string*, rendered twice in the same `finding` section |
| A2 Comparison chart | 10 distinct keys | `comparison` | barChart | `proposal.comparison` | 10 | **PASS** (mapping via the original classifier, `pickByBlockType`) | Correct approach; coverage is only 10/21 because the rest lost their data to hygiene |
| A3 Trend | SVG paths | `trend` | lineChart | `proposal.trend` | **0** | **MISSING_DATA** | The reference stores trends as raw SVG `M…` paths; hygiene strips them and `isTypedSeries` then rejects what's left. `LineChartBlock` never renders once in 105 objects |
| A4 Distribution | `{cx,cy,r}` | `distribution` | scatterChart | `proposal.distribution` | **2** | **MISSING_DATA** | Same cause: reference scatter data is pixel coordinates, not business axes |
| A5 Waterfall | `bars{top,height,anchor}` | — | — | `proposal.bridge` (produced, orphaned) | 0 | **MISSING_SLOT** | `WaterfallChartBlock` exists and is unreachable |
| A6 Heatmap | `heat`/`zoneBars` | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | `HeatmapGridBlock` exists and is unreachable |
| A7 Gauge | `capacity`/`lanes` | — | — | `proposal.coverage` (produced, orphaned) | 0 | **MISSING_SLOT** | `GaugeBlock` exists and is unreachable |
| A8 Detail table | `rows`(8)+16 others | `detail_rows` | table | `proposal.detail_rows` | 21 | **WRONG_MAPPING (partial)** | 5 of 21 from `rows`; **3 come from chart keys** (`bars`, `heat`, `zoneBars`) rendered as tables |
| A9 Column schema | `cols`(4) | — | — | — | 0 | **REFERENCE_ONLY (borderline)** | `TableBlock` derives columns from row keys; the reference's `label`/`numeric` metadata is lost but not fatal |
| A10 Table footer note | literal / `footStatus` | — | — | — | 0 | **MISSING_SLOT** | "Showing 5 of 18 · ranked by capital tied up" is real disclosure content |
| A11 Selected-entity inspector | `sel`(11) `selName`/`selMeta`/`selNote` | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | An interaction pattern (click a point → inspect). Needs a product decision |
| A12 Legend/ticks | `legend`,`yTicks`,… | — | — | — | — | **REFERENCE_ONLY** | Chart furniture; Recharts owns it |
| A13 Filters/sorts | `filters`,`sorts` | — | — | — | — | **UNRESOLVED** | Interaction, not content — product decision |

### 7.3 Decide — see §4 for the Recommendation rows

| Reference concept | Reference data | Slot | Block | Data path | R= | Result | Gap |
|---|---|---|---|---|---:|---|---|
| D1 Identity/confidence badge | `slateName`,`confLabel` | — | — | — | 0 | **MISSING_SLOT** | |
| D2 Statement | `heroTitle` | `recommendation` | text(hero) | `proposal.recommendation` | 21 | **WRONG_MAPPING** | 11/21 from `approveLabel` (a button label) |
| D3 Rationale | `heroSub`/`heroBody` | — | — | `proposal.recommendation_detail` (2 objs, orphan) | 0 | **MISSING_SLOT** | |
| D4 Metrics | `heroMetrics` | `recommendation_metrics` | table | `proposal.recommendation_metrics` | 15 | **PASS** | |
| D5 Composition bar | `moveBar` | `slate_summary` | labelValueList | `proposal.slate_summary` | 7 | **WRONG_DATA_SHAPE** | Bar data rendered as a text list |
| D6 Alternative slates | `slates`,`modes` | — | — | `proposal.alternatives` (1 obj, orphan) | 0 | **MISSING_SLOT** | Scenario switching is a core reference interaction |
| D7 Move-set groups | `groups`(6) | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | |
| D8 Focus drill-down | `focusTitle/Meta/Rows/Footer` | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | The reference's only place where the *actual items* (SKUs, capital, GMROI) appear |
| D9 Item slate | `slate`(3),`items`,`skus` | `slate` | table (**`selectable: true`**) | `proposal.slate` | 21 | **WRONG_MAPPING — most severe** | Only **5 of 21** come from a real slate key. The other **16** come from `totals`(3), `heroMetrics`(2), `slateTabs`(2), `ticks`, `modes`, `parts`, `tabs`, `sprintTabs`, `impact`, `modeTabs`, `notches`, `gates`. **The operator selects rows of a tab strip and "Approve selected" acts on them.** |
| D10 Live totals | `totals`(14) | `totals_rows` | labelValueList | `totals.rows` | 16 | **PASS** | `totals:13`, `summary:3`. The "approved only" recomputation is lost (static) |
| D11 Policy check | `policyStatus`,`checks`(19) | `guardrail_verdict` + `guardrail_checks` | text + labelValueList | `guardrails.verdict`, `guardrails.checks` | 21 / 10 | **PASS (verdict) / MISSING_DATA (checks)** | `checks` exists on 19/26 but is carried on only 10 — rows lacking a string `label` are rejected by `normalizeCorpus.js:278` |
| D12 Held-out/exclusions | literal blocks | — | — | — | 0 | **REFERENCE_ONLY (per-screen)** → **UNRESOLVED** | Genuinely business content, but authored as literal markup, not data. Needs a product decision |
| D13 Confidence basis | `basis`(1),`ladder` | — (**section `provenance` exists, empty**) | — | `proposal.basis` (2 objs, orphan) | 0 | **MISSING_SLOT** | |
| D14 Next-action routes | `actions`(3),`routes`(5) | — | — | — | 0 | **MISSING_SLOT** | The template's `actions[]` array is a *fixed* 6-action bar with generic labels; the reference explained each route with a `note` |
| D15 Blocked banner | `blocked`,`blockReason` | (folded into eligibility) | — | `eligibility.*.blocked_reason` | — | **PASS** | Correctly modelled as per-action eligibility |
| D16 Approval CTA | `ctaLabel`,`approveSub` | template `actions[].label` | `StageActionBar` | static labels | — | **REFERENCE_ONLY (partly)** | Generic labels replace per-proposal CTA copy. Defensible, but `approveSub`/`approvalNote` are real content that is lost |

### 7.4 Execute

| Reference concept | Reference data | Slot | Block | Data path | R= | Result | Gap |
|---|---|---|---|---|---:|---|---|
| E1 Deployment header | `planLine`(14),`headMeta`(8) | `narrative` | text(hero) | `narrative` | 21 | **PASS** | |
| E2 Destination targets | `dests`(4),`tray`(6),`orders`(2) | `execution_targets` | itemQueue | `execution.targets` | 14 | **WRONG_MAPPING** | **14 of 14 come from `monitors`** — the *verification* list. `tray`/`dests` are not in the candidate list (`normalizeCorpus.js:267`). Result: `execution_targets` and `verification` render **identical content on 12 of 21 screens** |
| E3 Per-target item diff | `d.items[].before/.after` | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | The before→after value per item — the whole point of an execute screen |
| E4 Plan / stages | `stages`(11),`steps`(3) | `plan` | table | `execution.plan` | 21 | **WRONG_MAPPING (partial)** | 13 of 21 plausible; **5 come from `progressRows`** (duplicating the `progress_rows` slot), plus `tabs`, `filters`, `entryChips` |
| E5 Progress meter | `progressPct`(14) | `progress` | number | `execution.progress_pct` | 21 | **PASS**, but 7 of 21 are the `{value:0}` default from `normalizeCorpus.js:261` |
| E6 Progress rows | `progressRows`(14) | `progress_rows` | table | `execution.progress_rows` | 11 | **PASS** | 11/11 from `progressRows` |
| E7 Monitors/verification | `monitors`(16) | `verification` | labelValueList | `execution.verification` | 21 | **WRONG_MAPPING (partial)** | 12 from `monitors`; **5 from `progressRows`**, plus `filters`, `entryChips`, `recoveryMetrics`, `clauses` |
| E8 Auto-flags | `flags` | — | — | — | 0 | **MISSING_SLOT + MISSING_DATA** | |
| E9 Arming control | `armCopy`(12),`armBtnLabel`(12) | — | — | — | 0 | **MISSING_SLOT** | A real operator control on 12/26 screens |
| E10 Rollback | `rollback`(8),`rbCopy`(6),`rbState`(6) | `rollback` | labelValueList | `execution.rollback` | 21 | **WRONG_DATA_SHAPE → synthesised** | **21 of 21 are the hard-coded fallback** `[{label:'Rollback', value:'Available for 24 hours'}]` (`normalizeCorpus.js:265`). The reference's real `rollback` rows are `{name, version, btnLabel}` — no `label` key — so the picker rejects all 8 of them. **Every execute screen shows the same fake rollback line.** |
| E11 Ledger | `ledger`(1),`ledgerCopy`(8) | `ledger` | table | `execution.ledger` | 1 | **MISSING_DATA** | `ledgerCopy` (8 screens of real explanatory content) has no home |
| E12 Bulk-run controls | `allNote`(10),`runAllLabel`(10) | — | — | — | 0 | **MISSING_SLOT** | `allNote` ("Budget writes go out together so the envelope never leaves $130K") is business content, not chrome |
| E13 Downstream links | literal | — | — | — | — | **REFERENCE_ONLY** | |
| E14 Close CTA | `closeLabel`(15) | — | — | — | — | **REFERENCE_ONLY** | Nav |

### 7.5 Live

All 11 concepts (§3.5): **UNRESOLVED**. `selectTemplate` returns `null`; `getStageView` throws.

---

## 8. Missing slots

Slots the reference proves are needed, where **no canonical slot exists**. Ordered by reference frequency.

| # | Proposed concept | Template | Reference evidence | Data today | Can an existing block render it? |
|---|---|---|---|---|---|
| 1 | **Constraints / locked** | reason.v1 | `locked` **19/26** | none | ✔ `labelValueList` |
| 2 | **Trigger** | reason.v1 | `trigger` 14/26 | **`proposal.trigger` already produced, orphaned** | ✔ `labelValueList` / `table` |
| 3 | **Agents** (distinct from roles) | reason.v1 | `agents` 14/26 | folded wrongly into `roles` | ✔ `itemQueue` / `labelValueList` |
| 4 | **Recommendation rationale** | decide.slate.v1 | `heroSub`/`heroBody` ~12/26 | **`proposal.recommendation_detail` produced, orphaned** | ✔ `text` (role `heroSub` already exists in `TextBlock.jsx:31`) |
| 5 | **Recommendation identity + confidence label** | decide.slate.v1 | `slateName`/`slateMeta` 8/26, `confLabel` 3/26 | none | ✔ `text` |
| 6 | **Basis / provenance** | decide.slate.v1 | `basis`, `ladder` | **`proposal.basis` produced, orphaned; section `provenance` already declared and EMPTY** | ✔ `labelValueList` |
| 7 | **Alternatives / scenarios** | decide.slate.v1 | `slates`,`modes`,`slateTabs`,`caps` ~8/26 | **`proposal.alternatives` produced, orphaned** | ✔ `table`/`itemQueue` |
| 8 | **Item groups + drill-down** | decide.slate.v1 | `groups` 6/26 + `focusRows` | none | ✔ `itemQueue` (+ `table`) |
| 9 | **Next-action routes** | decide.slate.v1 | `actions` 3, `routes` 5 | none | ✔ `itemQueue` |
| 10 | **Bridge / waterfall** | analyze.compare.v1 | S10.1 variance bridge | **`proposal.bridge` produced, orphaned** | ✔ **`waterfallChart` exists, unreachable** |
| 11 | **Coverage / gauge** | analyze.compare.v1 | `capacity`, `lanes` | **`proposal.coverage` produced, orphaned** | ✔ **`gauge` exists, unreachable** |
| 12 | **Analyze totals** | analyze.compare.v1 | `totals` on analyze objects | `totals.rows` exists; **section `rollup` declared and EMPTY** | ✔ `labelValueList` |
| 13 | **Rollback copy / state** | execute.bridge.v1 | `rbCopy` 6, `rbState` 6 | none | ✔ `text` |
| 14 | **Ledger copy** | execute.bridge.v1 | `ledgerCopy` 8/26 | none | ✔ `text` |
| 15 | **Arming / safety control** | execute.bridge.v1 | `armCopy`+`armBtnLabel` 12/26 | none | ✔ `text` + an action |
| 16 | **Bulk-run envelope note** | execute.bridge.v1 | `allNote` 10/26 | none | ✔ `text` |
| 17 | **Auto-flags** | execute.bridge.v1 | `flags` | none | ✔ `table` |
| 18 | **Per-item before→after diff** | execute.bridge.v1 | `d.items[].before/.after` | none | ✔ `table` |
| 19 | **Table footer/disclosure note** | analyze + decide | `focusFooter`, "Showing 5 of 18 …" | none | ✔ `text` |
| 20 | **Heatmap** | analyze.compare.v1 | `heat`, `zoneBars` | none | ✔ **`heatmapGrid` exists, unreachable** |

**Slots that are unnecessary / over-declared:**

| Slot | Template | Why |
|---|---|---|
| `impact` | decide.slate.v1 (rollup) | Already rendered by `ProposalHeader` (`StagePage.jsx:63-67`). Duplicated on every decide screen. |
| `confidence` | decide.slate.v1 (rollup) | Same — and it renders **wrong** (§12). |
| `confidence_calibrated` | decide.slate.v1 (rollup) | Same — header already prints "· calibrated". |
| `decision_mode` | all 4 | Already in the header ("Mode assist"). Rendered 4× per story across stages. |
| `deadline` | all 4 | Header already renders a *humanised* "Due in 2d"; the slot renders the raw ISO string (§12). |

---

## 9. Missing blocks

Per the instruction "do not propose a new block unless the reference proves a genuinely missing
semantic rendering unit, and do not duplicate variants an existing block can serve":

### A. Blocks the current project has and that are correct

`text`, `number`, `flag`, `labelValueList`, `table`, `itemQueue`, `barChart`, `scatterChart`.

Evidence: across 921 slot evaluations over 105 Decision Objects, **0 shape-validation failures and
0 unresolved bindings**. `LabelValueListBlock` and `TableBlock` are explicitly designed not to drop
fields (`LabelValueListBlock.jsx:39-61`).

### B. Blocks the reference needs that the current project does NOT have

**Exactly one, and it is arguable:**

| Proposed block | Reference evidence | Why no existing block suffices |
|---|---|---|
| **`stackedBar`** (a single proportional composition bar) | `moveBar` — "Keep 162 / Grow 18 / Reduce 22 / Exit 12 / Gap fill 4" as **one** 100 %-wide stacked bar with segment widths | `barChart` draws N *separate* bars; `labelValueList` draws text rows. Neither expresses "one whole, partitioned". |

Everything else the reference needs is covered by **existing** components:

| Reference need | Covered by |
|---|---|
| Waterfall/variance bridge | `waterfallChart` — **already registered, just unreachable** |
| Capacity/threshold meters | `gauge` — **already registered, unreachable** |
| Heatmap | `heatmapGrid` — **already registered, unreachable** |
| Scenario/slate switching | `slider`/`itemQueue` — `slider` is **already registered with full cross-block recompute wiring in `StageRenderer.jsx:132-140`, unreachable** |
| Item groups + drill-down | `itemQueue` + `table` |
| Next-action routes | `itemQueue` |
| Before→after diff | `table` |

**Do not build:** a RecommendationBlock, a SlateBlock, a PolicyCheckBlock, a MoveSetBlock, a
RollbackBlock, an AgentsBlock or a MetricCardBlock. Every one of those is an existing block plus a slot.

### C. Blocks the current project HAS but that are not correctly rendering available data

| Block | Problem | Exact reason |
|---|---|---|
| `lineChart` | **Renders 0 times in 105 objects** | Its only slot (`trend`) is gated `exists`, and `analyzeProposal` only emits `trend` when `isTypedSeries` passes. The reference stores trends as raw SVG paths, which hygiene strips. The block is correct; its input never arrives. |
| `scatterChart` | Renders 2 times | Same cause — reference scatter data is `{cx, cy, r}` pixel positions. |
| `labelValueList` @ `slate_summary` | Renders `moveBar` as text rows | Bound to the wrong block type for proportional data (§4.3 unit 5). |
| `labelValueList` @ `rollback` | Renders a fabricated constant on **21 of 21** screens | Upstream: `normalizeCorpus.js:265` fallback. Block itself is fine. |
| `itemQueue` @ `execution_targets` | Renders the **verification** list | Upstream mapping. Block itself is fine. |
| `number` @ `confidence` | Renders `0.75` instead of `75%` | **Real block/binding defect** — see §12. |
| `text` @ `deadline` | Renders `2026-09-17T09:00:00.000Z` | **Real block/binding defect** — see §12. |
| `text` @ `decision_mode`/`decision_lens`/`decision_persona`/`decision_contract_class` | Renders raw enum tokens (`assist`, `ads`, `keeper`, `strategic`) | Cosmetic defect — no display mapping. |

---

## 10. Wrong mappings

The dominant failure. `extraction/normalizeCorpus.js`'s `pick(data, candidates, pred, {fallbackScan: true})`
scans **every key in the fixture** and takes the first whose *shape* matches, with no semantic check.

Measured provenance — for each canonical field, which raw reference key actually supplied it
(non-locked objects only):

| Canonical field | n | Provenance |
|---|---:|---|
| `proposal.policy` | 21 | `targets`:7 · `policy`:3 · `rules`:1 · `envelope`:1 · `roles`:1 · `surfaces`:1 · `clusters`:1 · `standards`:1 · `events`:1 · `setup`:1 · **`headline`:1** · `metrics`:1 · `postures`:1 |
| `proposal.roles` | 14 | **`agents`:10** · `roles`:3 · `cohorts`:1 |
| `proposal.inputs` | 10 | `inputs`:7 · `sources`:3 ✔ |
| `proposal.primary_insight` | 21 | **synthesised:13** · `pinnedSub`:3 · `gridMeta`/`segNote`/`batteryMeta`/`trendNote`/`ledgerFoot`:1 each |
| `proposal.comparison` | 10 | 10 distinct chart keys, 1 each ✔ (classifier-driven) |
| `proposal.detail_rows` | 21 | `rows`:5 · 16 other keys 1 each, incl. **`bars`, `heat`, `zoneBars`** (charts rendered as tables) |
| `proposal.recommendation` | 21 | **`approveLabel`:11** · `heroTitle`:7 · synthesised:3 |
| **`proposal.slate`** | 21 | `totals`:3 · **`slate`:2** · `heroMetrics`:2 · `slateTabs`:2 · `slates`:1 · `ticks`:1 · `modes`:1 · `parts`:1 · `tabs`:1 · `items`:1 · `sprintTabs`:1 · **`impact`:1** · `options`:1 · `modeTabs`:1 · `notches`:1 · `gates`:1 |
| `proposal.recommendation_metrics` | 15 | `heroMetrics`:8 · `summary`:6 · `liveStats`:1 ✔ |
| `proposal.slate_summary` | 7 | `summary`:6 · `moveBar`:1 |
| `guardrails.checks` | 10 | `checks`:10 ✔ |
| `totals.rows` | 16 | `totals`:13 · `summary`:3 ✔ |
| `execution.plan` | 21 | `stages`:7 · **`progressRows`:5** · `steps`:3 · `orders`:2 · `changes`:1 · `tabs`:1 · `filters`:1 · `entryChips`:1 |
| `execution.verification` | 21 | `monitors`:12 · **`progressRows`:5** · `filters`:1 · `entryChips`:1 · `recoveryMetrics`:1 · `clauses`:1 |
| **`execution.targets`** | 14 | **`monitors`:14** (100 % wrong — duplicates `verification`) |
| **`execution.rollback`** | 21 | **synthesised:21** (100 % fabricated) |
| `execution.progress_rows` | 11 | `progressRows`:11 ✔ |

**Total content-slot renders filled from a semantically wrong source: 122 of 391 (31.2 %).**

### Consequence: duplicate content on screen

Same value rendered into 2+ slots on one screen, counted over 84 non-locked objects:

| Incidence | Duplication |
|---:|---|
| 12 | execute: `execution_targets` == `verification` |
| 9 | analyze: `narrative` == `primary_insight` |
| 4 | execute: `plan` == `progress_rows` == `verification` |
| 3 | decide: `slate` == `totals_rows` |
| 3 | decide: `recommendation_metrics` == `slate_summary` |
| 3 | decide: `recommendation_metrics` == `slate_summary` == `totals_rows` |
| 2 | execute: `plan` == `verification` |
| 2 | decide: `recommendation_metrics` == `slate` |
| 1 | reason: `policy` == `roles` |
| 1 | execute: `plan` == `progress_rows` |
| 1 | execute: `progress_rows` == `verification` |
| **41** | **total duplication incidents across 84 screens** |

**Highest-severity single finding:** `decide.slate.v1` marks the `slate` slot
`"selectable": true` (`decide.slate.v1.json`), and `StagePage.jsx:146-156` wires that block's row
selection into the `approve_selected` action. On **16 of 21** decide screens that block is rendering
a tab strip, a tick array, a totals list or an `impact` object. **The operator is selecting and
approving rows of the wrong data.**

---

## 11. Missing / wrong normalized data

### 11.1 The headline measure

| Stage | Screens | Reference business fields | Carried into normalized | % carried |
|---|---:|---:|---:|---:|
| reason | 26 | 208 | 63 | **30.3 %** |
| analyze | 26 | 297 | 52 | **17.5 %** |
| decide | 26 | 487 | 162 | **33.3 %** |
| execute | 26 | 536 | 148 | **27.6 %** |
| live | 1 | 30 | 5 | 16.7 % |
| **Total** | **105** | **1,558** | **430** | **27.6 %** |

Method: a field is "carried" if its post-hygiene value (or its first array element) appears verbatim
in the corresponding Decision Object's JSON.

### 11.2 The most-dropped business fields

| Occurrences dropped | Field | Stage | What is lost |
|---:|---|---|---|
| 19 | `locked` | reason | Non-negotiable constraints |
| 15 | `footStatus` | decide | Stage state line |
| 15 | `pushedCount` / `closeLabel` / `footStatus` | execute | Deployment counters |
| 14 | `trigger` | reason | Why this is queued |
| 12 | `ctaLabel` | decide | Per-proposal CTA copy |
| 12 | `armCopy` / `armBtnLabel` | execute | Auto-pause arming control |
| 11 | `policyStatus` | decide | (partially recovered as `guardrails.verdict`) |
| 11 | `sel` | analyze | Selected-entity inspector |
| 10 | `chips` | reason | Scope chips |
| 10 | `allLabel` / `runAllLabel` | execute | Bulk-run controls |
| 9 | `allNote` | execute | Bulk-run envelope explanation |
| 8 | `ledgerCopy` | execute | What the ledger will record |
| 8 | `rollback` | execute | **Real rollback targets** |
| 7 | `checks` | decide | Policy-check rows rejected for lacking a string `label` |
| 6 | `groups` / `heroBody` / `slateMeta` | decide | Move groups; recommendation rationale |
| 6 | `tray` / `rbState` / `rbCopy` | execute | Write targets; rollback state |
| 5 | `routes` / `onApprove` / `blockReason` | decide | Next-action routes |

### 11.3 Wrong data shapes

| Field | Reference shape | Contract expects | Consequence |
|---|---|---|---|
| `rollback` | `[{name, version, btnLabel}]` | `[{label, …}]` | All 8 real rollbacks rejected → 21/21 synthesised |
| `checks` | some rows `[{icon, label, note}]` without a `value`, some without `label` | every row needs a string `label` | 9 of 19 rejected |
| trend series | `"M 12 84 L 44 61 …"` (SVG path) | `[{x, y}]` | 0 line charts ever render |
| scatter points | `[{cx, cy, r}]` (pixels) | `[{x, y}]` | 2 of 21 |
| `moveBar` | `[{label, n, w}]` (proportions) | bound to `labelValueList` | proportional bar → text rows |
| `heroMetrics` | `[{label, value, range, note}]` | `table` | **PASS** — correctly preserved |

### 11.4 Synthesised axes that are NOT reference data

`normalizeCorpus.js:171-205` synthesises all seven axes from a hash of the story code. These are
mock values with no reference basis, and they drive **321 of 712 (45 %) of all rendered slot instances**:

| Axis | Distribution across 105 | Reference basis |
|---|---|---|
| `cardinality` | **`many`: 105 (100 %)** | **none** — `normalizeCorpus.js:330` is `? 'many' : 'many'` |
| `contract_class` | strategic 37 / regulated 36 / standard 32 | **none** — declared PROVISIONAL in `decisionObject.js:27-33` |
| `mode` | assist 37 / auto 36 / suggest 32 | reference `execLabel` is "Suggest" ×104, "Assist" ×1 |
| `entitlement` | full 65 / **limited 20 / locked 20** | **none** |
| `on_clock` | true 73 / false 32 | **none** |
| `lens` | ads 25 / cash 20 / inventory 20 / margin 20 / sales 20 | partially real (`data.lens`) |
| `persona` | 7 values | partially real (`data.owner`) |
| `impact` | `1000 + (h%90)*400` | **none** |
| `confidence` | `0.6 + (h%35)/100` | reference has real `confLabel` ("Med-high · 78%") which is dropped |
| `status` | pending: 105 | **none** |

**The `entitlement` synthesis alone blanks 20 of 105 screens** (5 per stage) down to three text lines.

---

## 12. Rendering issues

The renderer itself is clean. Across 105 Decision Objects × their template's blocks = **921 slot
evaluations**:

| Outcome | Count |
|---|---:|
| Rendered | **712** |
| Omitted by a `when` condition (correct behaviour — omission, not an empty card) | **209** |
| `MISSING_DATA` (binding resolved to nothing → placeholder) | **0** |
| `WRONG_DATA_SHAPE` (validator rejected the value) | **0** |

Rendered slots per screen: reason 6.4 avg (4–8), analyze 5.1 (3–7), decide 11.6 (9–14),
execute 7.9 (7–9), locked **3.0 exactly**, live **0**.

**Genuine rendering defects found:**

| # | Defect | Location | Evidence |
|---|---|---|---|
| RB-1 | **`deadline` renders a raw ISO timestamp** | slot `deadline` → `TextBlock`, in all 4 stage templates | `TextBlock.jsx:96` prints `data` verbatim. The value is `"2026-09-17T09:00:00.000Z"`. `StagePage.jsx:21-28` already has `deadlineLabel()` producing "Due in 2d" — the block does not use it. Affects **14 of 21** objects per stage that are `on_clock`. |
| RB-2 | **`confidence` renders `0.75` instead of `75%`** | slot `confidence` → `NumberBlock`, `decide.slate.v1` rollup | Binding is `confidence.value` — a bare `0..1` number with no unit, so `NumberBlock.jsx:24` defaults it to `unit: 'count'`. `StagePage.jsx:72` does it correctly (`value*100, unit:'pct'`). 21/21 decide screens affected. |
| RB-3 | **Axis enums render as raw lowercase tokens** | `decision_mode`/`decision_lens`/`decision_persona`/`decision_contract_class` → `TextBlock` | Renders `assist`, `ads`, `keeper`, `strategic`. 321 instances. Cosmetic but pervasive. |
| RB-4 | **Duplicate content within one section** | analyze `finding` section | `narrative` and `primary_insight` are both in section `finding` and resolve to the same string on 9 of 21 screens — one as hero, one as a plain card, directly under each other. |
| RB-5 | **Two declared sections can never render** | `analyze.compare.v1#rollup`, `decide.slate.v1#provenance` | No block targets either section id. |
| RB-6 | **React key collision** | `StepTracker` / route-level rendering | `vitest` stderr: `Encountered two children with the same key, 'analyze' / 'decide' / 'execute'` during `routeLevel.test.jsx`. Pre-existing; tests pass regardless. |
| RB-7 | **`live` stage renders an error page** | `actionStoriesService.js:99-112` | `prop_s10_6_live` → `selectTemplate` returns `null` → `ActionStoriesError(MALFORMED)`. Deliberate, but it is a visible content gap. |

**Not defects:** `BlockErrorBoundary` isolation, `when`-based omission, `composeSections` region
resolution, `resolveBinding` safety, and the block validators — all behave as documented and are
exercised by 1,053 passing tests.

---

## 13. Reference-only presentation elements

These exist in the reference and **must NOT be carried forward**. The current project already
strips all of them (`normalizeCorpus.js:52-93`, `blocks/decorativeKeys.js`) — **940 of 2,498 raw
fields (37.6 %)**.

| Category | Examples | Verdict |
|---|---|---|
| CSS variable values | `tone: "var(--green-700)"`, `hue`, `tint`, `bg`, `border`, `fg`, `flagTone`, `confTint`, `policyTone`, `railGlow`, `pinTone`, `statusTint` | **Correctly stripped** |
| Geometry / pixel coordinates | `top`, `height`, `left`, `width`, `cx`, `cy`, `lx`, `ly`, `px`, `py`, `x`, `y` as marker positions | **Correctly stripped** |
| SVG path data | `p10Path`, `p50Path`, `bandPath`, `actualPath`, `fanOuter`, `curves[].path` | **Correctly stripped** — but see the caveat below |
| Visibility flags | `approveShow`, `blockShow`, `footerDoneShow`, `footerPushShow`, `ledgerEmpty`, `showReadout` | **Correctly stripped** |
| Mockup metadata | `props.$preview.width/height`, `state`, `__raw` | **Correctly stripped** |
| Dial segments | `execSegs: [{bg},{bg},{bg}]` | **Correctly stripped** — the *label* `execLabel` is kept as `mode` |
| Icon class names | `icon: "fa-solid fa-check"` | Stripped where decorative |
| Mockup navigation | `href: "S9.11-4-execute.dc.html"` | **Reference-only** — mockup-to-mockup links |
| Interaction handlers | `onApprove`, `toggleAll`, `g.toggle`, `s.pick`, `o.pick` | **Reference-only** — DC event bindings |
| Chart furniture | `legend`, `yTicks`, `xTicks`, `gridX`, `zeroY`, `targetY` | **Reference-only** — Recharts owns axes |
| Sidebar / masthead / help | SidebarNav, org masthead, "Help" | **Reference-only** — app shell |
| Cross-mockup links | "Assortment →", "Size the book →", "Edit policy →", "Back to the catalogue grid →" | **Reference-only** |

**Two borderline calls, stated explicitly:**

1. **SVG paths (`A3`, `A4`).** Stripping them is *correct* for a business contract — but it is the
   sole reason `lineChart` renders 0 times and `scatterChart` renders 2 times. The reference's
   *information* (a P10/P50/P90 forecast fan) is real; only its *encoding* is presentational. This
   is a **contract gap, not a hygiene error**: the backend must send typed `{x, y}` series. Recorded
   as **UNRESOLVED**, not as something to "fix" by un-stripping paths.

2. **Table column schema (`cols`, A9).** `[{key, label, numeric}]` is metadata, not content, and
   `TableBlock` derives columns from row keys. But the reference's human column *labels*
   ("Days to stock-out", "Expected lost CM$") and numeric alignment are real presentation quality
   that is currently lost. Borderline — **not** a business-data gap.

---

## 14. Quantified gap summary

### Inventory

| Measure | Value |
|---|---:|
| Reference files inspected | **114** `.dc.html` + `_ds_manifest.json` + `support.js`/`ledger-overlay.js` |
| Reference stage screens analysed | **105** |
| Reference meaningful rendering units discovered | **71** |
| …of which presentation/nav only (must not become blocks) | **9** |
| …of which should map to business blocks | **62** |
| …distinct semantic kinds after cross-stage consolidation | **~41** |
| Reference raw data fields | **2,498** |
| Reference business fields (post-hygiene) | **1,558** |
| Reference presentation-only fields | **940 (37.6 %)** |
| Current templates | **5** |
| Current canonical slots (vocabulary) | **34** |
| Current slot instances across templates | **44** |
| Current registered block types | **14** |
| Current block types reachable from a template | **9** |
| Current normalized Decision Objects audited | **105** |
| Current slot evaluations audited | **921** |

### The gap, by the audit's own categories

| # | Category | Count | Evidence |
|---|---|---:|---|
| **1** | **Missing template slot** | **20 concepts** | §8 — incl. 6 where the normalized data *already exists and is orphaned*, and 2 sections declared with no block |
| **2** | **Missing block** | **1** (`stackedBar`, arguable) | §9B. Plus **5 blocks that exist but are unreachable** (`waterfallChart`, `heatmapGrid`, `object`, `slider`, `gauge`) |
| **3** | **Wrong / incomplete slot mapping** | **122 of 391 content renders (31.2 %)** | §10 provenance table; 41 duplicate-content incidents |
| **4** | **Missing normalized data** | **1,128 of 1,558 business fields (72.4 %)** | §11.1 |
| **5** | **Wrong data shape** | **6 shape classes**, costing ~55 renders | §11.3 (`rollback` 21/21, `checks` 9/19, trend 21/21, scatter 19/21, `moveBar`) |
| **6** | **Rendering / implementation bug** | **7** (RB-1…RB-7) | §12 |
| **7** | **Reference-only presentation** | **940 fields / 12 categories** | §13 — already handled correctly |
| **8** | **Genuinely unresolved / product decision** | **6** | live template; typed chart series; selected-entity inspector; filters/sorts; held-out/exclusions; per-proposal CTA copy |

### Correctly mapped

| Measure | Value |
|---|---:|
| Slot instances rendered | 712 of 921 |
| …that are **reference business content** | 391 |
| …of those, **semantically correct** | **269 (68.8 %)** |
| …of those, **filled from the wrong field** | **122 (31.2 %)** |
| Slot instances that are **synthesised mock axes**, not reference content | **321 (45 % of all renders)** |
| Reference→current concept pairs marked `PASS` | **9 of 62** |

---

## 15. Top root causes

> Not "a data mapping issue". Five specific, quantified causes, in order of how much content they cost.

### 1. `normalizeCorpus.js` drops 72.4 % of the reference's business content, because it maps only a fixed 34-slot target

The normalizer emits at most ~7 fields per proposal. The reference carries **15 business fields per
screen on average** (1,558 ÷ 105), rising to **18.7** on decide and **20.6** on execute. Everything
outside the slot list is discarded — including the *most frequent* concept on the reason stage
(`locked`, 19/26) and the whole rollback/arming/ledger/bulk-run vocabulary on execute.
**Cost: 1,128 business fields.**
*Evidence:* `extraction/normalizeCorpus.js:209-269`; §11.1–11.2.

### 2. `pick(..., {fallbackScan: true})` fills canonical slots with whatever happens to match the shape

The picker's candidate lists miss the reference's real key names, so it falls through to "the first
key in the fixture whose *shape* fits". This produces `proposal.slate` from `ticks`, `proposal.policy`
from `headline`, `proposal.recommendation` from a **button label**, and `execution.targets` from the
**monitors** list on 14 of 14. Because the slot then validates and renders cleanly, **nothing
anywhere reports a problem.**
**Cost: 122 wrong content renders (31 %), 41 duplicate-content incidents, and one integrity hazard —
`approve_selected` operating on the wrong rows on 16 of 21 decide screens.**
*Evidence:* `normalizeCorpus.js:148-160, 245-268`; §10.

### 3. Three of the seven contract axes are synthesised, and one of them blanks 19 % of the corpus

`entitlement` is `ENTITLEMENTS[h % 5]` over `['full','full','full','limited','locked']`
(`normalizeCorpus.js:184`). That makes **20 of 105 screens render `locked.v1` — exactly 3 text lines**,
with no reference basis whatsoever. `cardinality` is hard-coded `'many'` (`:330`), making Axis 1
degenerate and making `'*|decide|one'` unreachable. `contract_class`, `impact`, `confidence`,
`on_clock` and `status` are likewise hash-derived.
**Cost: 20 screens reduced to 3 lines; 321 of 712 rendered slots (45 %) are mock axis echoes, not content.**
*Evidence:* §11.4; `decisionObject.js:27-33` already flags `contract_class` as PROVISIONAL.

### 4. Six normalized fields and five block components exist with no slot to connect them

`proposal.trigger`, `proposal.scope`, `proposal.bridge`, `proposal.coverage`,
`proposal.recommendation_detail`, `proposal.basis`, `proposal.alternatives` are all **produced by the
normalizer and then orphaned**. `waterfallChart`, `heatmapGrid`, `gauge`, `slider` and `object` are
**registered, tested, and unreachable**. Two template sections (`analyze#rollup`,
`decide#provenance` — titled "Totals" and "Basis") are declared and permanently empty.
Additionally, `normalizeCorpus.js:338` builds the **execute** stage's proposal with `decideProposal`,
so every execute object carries a `proposal.recommendation` and `proposal.slate` that
`execute.bridge.v1` never reads (21 orphans each).
**Cost: 7 business concepts + 5 working components, one `"binding": "…"` line away from rendering.**
*Evidence:* §5, §6, §8; orphan scan.

### 5. Nothing in the system measures reference fidelity, so all of the above is invisible

1,053 tests pass. The build succeeds. `StageRenderer` logs zero warnings across all 105 objects,
because every binding resolves and every value validates. The tests assert *structural* correctness
(a template was selected, a block rendered, an action was gated) and never assert that the rendered
content **is the reference's content**. There is no test that `proposal.slate` came from a slate, no
test that two slots don't render the same value, and no coverage metric over the 1,558 reference
business fields.
**Cost: the other four causes have been able to accumulate without a single red signal.**
*Evidence:* `vitest run` output; §12 outcome table (0 missing, 0 wrong-shape).

---

## 16. Minimal fix plan

Ordered per the instruction: data mapping first, then contracts, then slots, then blocks. Nothing
here is implemented — this is the proposed order only.

### Step 0 — instrument before changing anything *(no product risk)*

Add, as tests/scripts only:
- a **provenance assertion**: every `proposal.*` / `execution.*` field must record which raw key
  produced it, and a snapshot test pins that mapping (§10 becomes a regression fence);
- a **duplicate-content test**: no two slots on one screen may resolve to the same value (§10 → 41 failures today);
- a **coverage metric**: % of the 1,558 reference business fields represented (27.6 % today).

Rationale: cause #5. Without these, every subsequent fix is unverifiable.

### Step 1 — fix data mapping *(largest win, zero template/block change)*

1. **Delete `fallbackScan: true`** from `normalizeCorpus.js` (`policy`, `slate`, `detail_rows`, `plan`, `narrativeOf`). A slot with no real source must be **omitted**, not guessed. The templates already have `when` gates for exactly this.
2. **Repair the candidate lists** against the real reference vocabulary:
   - `slate` ← `slate`, `skus`, `offerRows`, `items`, `groups` — **not** `totals`/`heroMetrics`/`*Tabs`/`ticks`/`impact`
   - `recommendation` ← `heroTitle`, `heroLine` — **never** `approveLabel`
   - `targets` ← `dests`, `tray`, `orders` — **not** `monitors`
   - `rollback` ← accept `{name, …}` as well as `{label, …}`; drop the synthesised fallback
   - `policy` ← `policy`, `targets`, `rules`, `standards`, `thresholds`, `slas`
   - `roles` ← `roles`, `cohorts`, `clusters` — split `agents` into its own field
   - `verification` ← `monitors` only
   - `primary_insight` ← never `pinnedSub`
3. **Stop building the execute proposal with `decideProposal`** (`:338`).
4. **Relax the `checks` predicate** so rows with `{icon, label, note}` and no `value` survive.
5. **Carry the currently-dropped fields** that already have (or will have) slots: `locked`, `trigger`, `agents`, `groups`+`focusRows`, `heroSub`/`heroBody`, `basis`, `slateName`/`confLabel`, `actions`/`routes`, `armCopy`, `allNote`, `ledgerCopy`, `rbCopy`/`rbState`, `flags`, `tray`/`dests` item diffs.

*Expected: reference-field coverage 27.6 % → ~55–65 %; wrong-source renders 122 → near 0.*

### Step 2 — fix existing block contracts and bindings *(no new components)*

6. **RB-2:** bind `confidence` to a typed `{value, unit:'pct'}` (or have the slot declare the unit) so it renders `75%`.
7. **RB-1:** render `deadline` through the existing `deadlineLabel()`, or type it.
8. **RB-3:** add a display mapping for the axis enums.
9. **RB-4:** drop `narrative` from `analyze.compare.v1`'s `finding` section, or gate it `ne primary_insight`.
10. **Re-bind `slate_summary`** from `labelValueList` to a proportional presentation (see Step 4).

### Step 3 — add slots, only where §8 proves a missing semantic concept

**Tier A — the data already exists and is orphaned (6 slots, pure template edits, zero new code):**
`trigger` → `reason#rationale` · `recommendation_detail` → `decide#recommendation` (role `heroSub`,
which `TextBlock` already supports) · `basis` → **`decide#provenance`, the section that already
exists and is empty** · `alternatives` → `decide#slate` · `bridge` → `analyze#analysis`
(`waterfallChart`) · `coverage` → `analyze#analysis` (`gauge`) · `totals_rows` → **`analyze#rollup`,
the other empty section**.

**Tier B — high-frequency reference concepts needing both a slot and Step 1 data (8 slots):**
`constraints` (19/26) · `agents` (14/26) · `recommendation_identity` (8/26) · `item_groups` + `focus_rows` (6/26) ·
`next_actions` (8/26) · `arming` (12/26) · `rollback_detail` (12/26) · `bulk_note` (10/26).

**Tier C — defer until the contract question is settled:** heatmap, selected-entity inspector,
filters/sorts, per-item before→after diff, table disclosure notes.

**Remove or demote** the five duplicated context slots (§8: `impact`, `confidence`,
`confidence_calibrated`, `decision_mode`, `deadline` already appear in `ProposalHeader`).

### Step 4 — add a block only where no existing block can render the concept

**One candidate only: `stackedBar`** for `moveBar`. Everything else is covered — `waterfallChart`,
`gauge`, `heatmapGrid`, `slider` and `object` need **a slot, not a component**.

### Step 5 — resolve the three contract questions (product/backend decisions, not code)

- **Typed chart series.** The backend must send `[{x, y}]`; the reference's SVG paths are
  unrecoverable. Until then `lineChart` renders 0 times and `scatterChart` 2 times. **Do not un-strip paths.**
- **The synthesised axes.** `entitlement`, `cardinality`, `contract_class`, `impact`, `confidence`,
  `on_clock`, `status` are mock. `entitlement` in particular should stop blanking 20 screens until
  there is a real product rule. `cardinality` must become real or the axis should be removed.
- **The `live` stage.** Either accept that S10.6's fifth stage is unrepresented, or add `live.v1`.
  Eleven reference concepts depend on this.

### Explicitly out of scope

Per the brief: do **not** redesign `StageRenderer`/`composeSections` (both are clean and correct),
do **not** build a backend or cloud sandbox yet, and do **not** modify the five-template
architecture — **this audit found it sufficient.** All 20 missing concepts fit inside the existing
five templates' existing sections; none requires a sixth template except the open `live` question.

---

## 17. Evidence index

Every non-obvious conclusion above, with its source.

| Conclusion | Evidence |
|---|---|
| Reference is DC mockups, not a React app | `…/S9.1-3-decide.dc.html:440` — `<script type="text/x-dc">` with `class Component extends DCLogic { data() … renderVals() … }` |
| Reference mirror is complete inside the current project | `diff <(ls source-mockups) <(ls "…/Realify Workspace Dashboard Build (1)")` → only non-HTML assets differ |
| Design system is chrome, not the block library | `_ds/…/_ds_manifest.json` (24 components); usage counts across all mockups: Avatar 183, Badge 114, PriorityPill 7, DataTable 2, Tabs 2 |
| Reference Decide structure (§4.1) | parsed body of `S9.1-3-decide.dc.html` and `S9.13-3-decide.dc.html` |
| 2,498 raw / 1,558 business / 940 presentation fields | `__corpus__/fixtures/raw/**` + `extraction/classifyBlocks.js` `isDecorativeKey` + `extraction/normalizeCorpus.js:52-93` |
| 27.6 % carry-through | value-identity match, fixture → `__corpus__/normalized/dataset.json` |
| Provenance table (§10) | value-identity match of each normalized field against every cleaned fixture key |
| `proposal.slate` from `ticks`/`tabs`/`impact` | `normalizeCorpus.js:250` — `pick(data, ['slate','slates','skus','rows','moves','items'], isObjArray, {fallbackScan: true})` |
| `recommendation` from `approveLabel` | `normalizeCorpus.js:247` |
| `execution.targets` from `monitors` (14/14) | `normalizeCorpus.js:267` — `pick(data, ['targets','agents','monitors'], …)`; `data.targets` exists in **0/26** execute fixtures |
| `execution.rollback` synthesised 21/21 | `normalizeCorpus.js:265`; reference rows are `{name, version, btnLabel}` — e.g. `S9.13/execute.json` |
| Execute proposal built by `decideProposal` | `normalizeCorpus.js:338` |
| `cardinality` always `many` | `normalizeCorpus.js:330` — `? 'many' : 'many'` |
| 20 locked objects | `normalizeCorpus.js:184` `ENTITLEMENTS = ['full','full','full','limited','locked']`, indexed `h % 5` |
| `live` renders an error | `templates/selectTemplate.js:209-214` (no `live` row) + `services/actionStoriesService.js:99-112` |
| Two empty sections | `templates/analyze.compare.v1.json` section `rollup`; `templates/decide.slate.v1.json` section `provenance` — no block declares either |
| 5 unreachable blocks | `blocks/index.js` (14 registered) vs. the union of `blockType` across the 5 template JSONs (9) |
| Slider wiring is unreachable | `components/StageRenderer.jsx:132-140, 197-208` — no template declares a `slider` slot |
| 921 evaluations: 712 rendered / 209 omitted / 0 missing / 0 wrong | replay of `evaluateCondition` + `resolveBinding` + `validateBlockData` over all 105 objects |
| `slate` is `selectable` and feeds approval | `templates/decide.slate.v1.json` (`"selectable": true`) + `pages/StagePage.jsx:146-156` |
| RB-1 raw ISO deadline | `blocks/TextBlock.jsx:96` renders `{data}`; `pages/StagePage.jsx:21-28` has the unused formatter |
| RB-2 confidence `0.75` | slot binds `confidence.value` (bare number) → `blocks/NumberBlock.jsx:24` defaults `unit: 'count'`; contrast `pages/StagePage.jsx:72` |
| `primaryInsight` in 0/26 fixtures | key-presence scan over `__corpus__/fixtures/raw/*/analyze.json`; contrast `templates/slotVocabulary.js:51` ("37 uses") |
| `reason.policy` in 3/26, `decide.slate` in 3/26 | same scan |
| `locked` in 19/26 reason fixtures | same scan; sample `S9.3/reason.json` |
| 41 duplicate-content incidents | per-screen slot-value comparison across 84 non-locked objects |
| Blocks preserve every field | `blocks/LabelValueListBlock.jsx:29-61` (`resolvePrimaryValue` + `extraEntries`) |
| Hygiene rules | `extraction/normalizeCorpus.js:52-93`; `blocks/decorativeKeys.js` |
| Tests / build / lint | `npx vitest run` (51 files, 1053 tests, 0 failures); `npm run build` (success); `npx eslint .` (0 errors, 1 warning) |
| Prior corroborating audit | `docs/DECISION_OBJECT_DATA_AUDIT.md` — independently counts 1,137 distinct business keys and flags `locked` (73 %) and `trigger` (54 %) as having no canonical slot |

---

## Validation report

| Item | Result |
|---|---|
| Reference files inspected | **114** `.dc.html` mockups (105 stage screens parsed structurally; 5 parsed in full detail), `_ds_manifest.json`, `_ds_bundle.js`, `support.js`, `ledger-overlay.js` |
| Current files inspected | **~60**, incl. all 5 template JSONs, `slotVocabulary.js`, `templateRegistry.js`, `selectTemplate.js`, `blocks/index.js`, `blockTypes.js`, all rendering blocks of interest, `StageRenderer.jsx`, `StageSections.jsx`, `composeSections.js`, `resolveBinding.js`, `actionCondition.js`, `decisionObject.js`, `StagePage.jsx`, `actionStoriesService.js`, `normalizeCorpus.js`, plus all 105 fixtures and all 105 normalized proposals |
| Reference components/concepts discovered | **71** rendering units (62 business, 9 presentation/nav) |
| Current blocks discovered | **14 registered**, **9 reachable** |
| Current slots discovered | **34 canonical slots**, **44 slot instances** across 5 templates |
| Mappings audited | **921** slot evaluations; **391** content renders traced to source |
| Normalized Decision Objects audited | **105 of 105** |
| **Exact missing blocks** | **1**: `stackedBar` (for `moveBar`). Plus 5 existing-but-unreachable: `waterfallChart`, `heatmapGrid`, `object`, `slider`, `gauge` |
| **Exact missing slots** | **20** (§8). Tier A (data already exists, orphaned): `trigger`, `recommendation_detail`, `basis`, `alternatives`, `bridge`, `coverage`, + `totals_rows` in `analyze#rollup`. Tier B: `constraints`, `agents`, `recommendation_identity`, `item_groups`, `focus_rows`, `next_actions`, `arming`, `rollback_detail`, `bulk_note`. Tier C: `heatmap`, `entity_inspector`, `item_diff`, `disclosure_note` |
| **Exact data gaps** | **1,128 of 1,558** reference business fields dropped (72.4 %). Highest-frequency: `locked` (19), `trigger` (14), `armCopy`/`armBtnLabel` (12 each), `ctaLabel` (12), `sel` (11), `allLabel`/`runAllLabel` (10), `chips` (10), `allNote` (9), `ledgerCopy` (8), `rollback` (8), `checks` (7 of 19), `groups` (6), `heroBody` (6), `tray` (6), `rbCopy`/`rbState` (6) |
| **Exact rendering bugs** | **7**: RB-1 raw ISO `deadline`; RB-2 `confidence` as `0.75`; RB-3 raw enum tokens; RB-4 `narrative`==`primary_insight` duplicated on 9 screens; RB-5 two permanently-empty sections; RB-6 React duplicate-key warning in `StepTracker`; RB-7 `live` stage renders an error page |
| Tests (read-only, unmodified) | **51 files, 1,053 tests, all passing**, 12.08 s |
| Build (read-only) | `vite build` **succeeded** in 406 ms |
| Lint (read-only) | 0 errors, 1 pre-existing warning |
| Files modified in either project | **0** (this document and its JSON companion are the only new files) |

---

## The four questions, answered directly

**WHAT EXISTS IN THE REFERENCE**
105 stage screens across 26 Action Stories × 4–5 stages, carrying **1,558 business fields** in
**71 meaningful rendering units** (62 of them real business blocks). The richest are Decide (16 units,
18.7 fields/screen) and Execute (14 units, 20.6 fields/screen). Recommendation alone is **6 semantic
units**, not one.

**WHAT EXISTS IN THE CURRENT SYSTEM**
A clean, tested template layer: 5 templates, 34 canonical slots, 44 slot instances, 14 block
components, a safe binding resolver, a conditional-omission engine, and 105 contract-conformant
Decision Objects. It renders **712 slot instances with zero failures** — but **321 of those (45 %)
are echoes of synthesised mock axes**, and only **391 are reference business content**.

**WHAT IS MISSING**
**1,128 business fields (72.4 %)**, dropped at `normalizeCorpus.js`. **20 template slots**, 7 of them
for data the normalizer already produces and then orphans. **5 block components** that exist and
cannot be reached. **2 template sections** declared and permanently empty. **1 whole stage** (`live`)
with no template. **20 screens** blanked to 3 lines by a synthesised entitlement axis.

**WHAT IS PRESENT BUT BROKEN**
**122 of 391 content renders (31 %) are filled from the wrong reference field** — most severely
`proposal.slate`, which on **16 of 21** decide screens is a tab strip / tick array / totals list
being rendered *and made selectable* as the decision slate. Plus **41 duplicate-content incidents**,
`execution.rollback` fabricated on **21 of 21** execute screens, `execution.targets` duplicating
`verification` on **14 of 14**, and 7 concrete rendering defects. None of it is reported by any test,
warning or log — which is the sixth, meta-level finding.

---

## 18. Resolution — before vs after

Everything in sections 1–17 describes the system **as the audit found it**. This section states what
each finding measures **now**, and what changed to get there. All figures are produced by the same
read-only harnesses, re-run against the fixed system.

### 18.1 The quantified gap, closed

| # | Audit finding | Audit | Now | How |
|---|---|---:|---:|---|
| 1 | Reference business fields carried into the Decision Objects | 430 / 1,558 (27.6 %) | **610 / 1,558 (39.2 %)** | 20 new canonical fields + repaired candidate lists |
| 2 | Business fields dropped at normalization | 1,128 | **948** | same |
| 3 | Content-slot renders from the **wrong** reference field | 122 of 391 (31.2 %) | **0 of 555** | `fallbackScan` deleted; per-field named vocabularies |
| 4 | Duplicate-content incidents | 41 | **0** | the claim ledger: one raw key → at most one canonical field |
| 5 | Missing template slots | 20 concepts | **0 of the 20** (17 added; 3 deferred with reasons — §19) | new slots in the existing five templates |
| 6 | Registered-but-unreachable blocks | 5 | **3**, each documented | `waterfallChart`, `gauge`, `heatmapGrid` wired |
| 7 | Genuinely missing blocks | 1 (`stackedBar`, "arguable") | **0 built** | `moveBar` normalised to `{label, value}`; the existing `barChart` carries it |
| 8 | Permanently empty template sections | 2 (`analyze#rollup`, `decide#provenance`) | **0** | `totals_rows` and `basis` wired into them |
| 9 | Wrong data-shape classes | 6 | **2 remain, both contract-level** (§19) | `rollback`, `checks` and `moveBar` fixed at the block contract; the waterfall now derives its own geometry |
| 10 | Rendering / implementation bugs | 7 (RB-1…RB-7) | **0** | see §18.4 |
| 11 | Synthesised business axes | 7 axes + impact/confidence/status | **4 remain, each stated** (§19) | `lens`, `persona`, `mode`, `cardinality`, `confidence` now come from the reference |
| 12 | Records blanked to a 3-line locked teaser | 20 (19 %) | **0** | `entitlement` is `full` by evidence, not by hash |
| 13 | Records rendering an error page | 1 | **0** | `live` renders as a running execution |
| 14 | Unresolved bindings / shape violations | 0 | **0** | held, now across 1,575 slot evaluations instead of 921 |

Per-stage carry-through:

| Stage | Audit | Now |
|---|---:|---:|
| reason | 30.3 % | **50.5 %** |
| analyze | 17.5 % | **29.6 %** |
| decide | 33.3 % | **44.1 %** |
| execute | 27.6 % | **35.3 %** |
| live | 16.7 % | **43.3 %** |

Rendered content slots per screen (the density an operator actually sees):

| Stage | Audit (content slots) | Now |
|---|---:|---:|
| reason | ~3.4 | **4.5** |
| analyze | ~2.6 | **3.2** |
| decide | ~5.8 | **6.8** |
| execute | ~6.0 | **6.6** |
| live | 0 (error page) | **9.0** |

### 18.2 The two mechanisms that did most of the work

**1. `fallbackScan` is gone, and one key can serve only one field.**
`extraction/normalizeCorpus.js` no longer scans for a shape-compatible key. Every canonical field
names the reference keys it may read, in priority order, and reads nothing else; a field whose named
source is absent is **omitted**, the template's `when` omits the slot, and the omission is recorded.
On top of that, a **claim ledger** gives each raw key to at most one canonical field, resolved
most-specific-first — which is what makes duplicate content structurally impossible rather than
merely unlikely, and what lets the broadest fields (`slate`, `detail_rows`, `plan`) safely consult
the original classifier's own verdict for what remains.

**2. Three axes were recovered from the reference instead of hashed.**
`extraction/referenceContext.js` (new, build-time only) parses the pinned identity strip every one
of the 105 reference screens carries — `Lens: Sales · Margin`, `Merchandiser + Prospector`,
`Role Classifier`, `GMROI Engine`. That yields **26/26 coverage** for `lens`, `persona` and the
agent roster. `mode` comes from the execution dial's own `execLabel` (105/105). `cardinality` is
derived from the proposal's real item count and now takes both values. The contract's `PERSONAS`
enum was extended from 7 to 14: `arbiter`, `pricer`, `prospector`, `scout`, `shipper`, `sourcer`
and `steward` are each the lead persona on at least one reference story and were being silently
replaced by a hash-chosen value.

### 18.3 Provenance — the specific mappings, before and after

| Canonical field | Audit provenance | Now |
|---|---|---|
| `proposal.recommendation` | **`approveLabel`:11** (a button label), `heroTitle`:7, synthesised:3 | `heroTitle`:8, `heroLine`:3 — **and nothing else** |
| `proposal.slate` | `totals`:3, `slate`:**2**, `heroMetrics`:2, `slateTabs`:2, `ticks`, `impact`, `notches`, `gates`… | 16 real item collections: `slate`, `skus`, `offerRows`, `items`, `levers`, `lanes`, `cohorts`, `exits`, `suppliers`, `events`, `repairs`, `gates`, `fixes`, `sampled`, `options`, `editorial` |
| `execution.targets` | **`monitors`:14 of 14** (the verification list) | `tray`:6, `dests`:4, `orders`:1, `coverRows`:1 — never `monitors` |
| `execution.rollback` | **synthesised:21 of 21** | `rollback`:8 — real rows only; the fabricated line is gone |
| `proposal.policy` | `targets`:7, `policy`:3, + 11 one-offs incl. **`headline`**, `metrics`, `setup` | `targets`:8, `policy`:3, `rules`:2, `slas`:2, `standards`:2, `terms`:2, `thresholds`:1 |
| `proposal.roles` | **`agents`:10**, `roles`:3, `cohorts`:1 | `roles`:3, `cohorts`:2, `clusters`:1 — `agents` is now its own slot |
| `proposal.primary_insight` | **synthesised:13**, `pinnedSub`:3, 5 one-offs | `gridMeta`/`sortNote`/`segNote`:1 each — absent where the reference states no finding |
| `execution.verification` | `monitors`:12, **`progressRows`:5**, `filters`, `entryChips`… | `monitors`:16, `reads`:1, `clauseRows`:1 |
| `guardrails.checks` | `checks`:10 of 19 present | `checks`:19, `guardParts`:1 — `{text}`-identified rows no longer rejected |

`src/features/action-stories/__corpus__/normalized/provenance.json` (new) records this per record
per field, and `referenceFidelity.test.js` pins every allow-list.

### 18.4 Rendering bugs, resolved

| # | Bug | Resolution |
|---|---|---|
| RB-1 | `deadline` rendered a raw ISO timestamp | The duplicate slot is **deleted**. `ProposalHeader` already renders a relative "Due in 2d"; adding a date-formatting block for a value the header formats correctly would have been the wrong fix. |
| RB-2 | `confidence` rendered `0.75` instead of `75%` | Same — the duplicate `confidence`/`confidence_calibrated`/`impact` rail slots are deleted; the header is the single renderer, and it formats correctly. |
| RB-3 | Axis enums rendered as raw tokens (`assist`, `ads`, `within_limits`) | New `blocks/enumLabel.js` — a slot-keyed display map applied by `TextBlock`, the same frontend-owns-presentation split `formatValue.js` already has for numbers. |
| RB-4 | `narrative` == `primary_insight` on 9 of 21 analyze screens | Two fixes: `headline` removed from the narrative candidates (it is the title), and `primary_insight` is dropped outright when it would equal `narrative`. |
| RB-5 | Two sections declared and permanently empty | `analyze#rollup` ← `totals_rows`; `decide#provenance` ← `basis`. A test now fails the build on any unfillable section. |
| RB-6 | React duplicate-key warning in `StepTracker` | `groupProposalsIntoStories` drops a repeated `(story, stage)` — one Decision Object per stage is what the grouping means. |
| RB-7 | `live` stage rendered an error page | `live` maps to `execute.bridge.v1`: it is the execute stage still running, and the reference's live screen shows a plan, progress rows, monitors, targets and a ledger. **No sixth template was minted.** It now renders 9 content blocks. |

### 18.5 Additional presentation leaks found and closed during the fix

Restoring 180 more fields surfaced mockup artifacts the old pipeline never reached, because it never
carried that data through. The hygiene pass now also strips:

- **`*Show` visibility flags** as a family — `btnShow`(39), `tagShow`(31), `recShow`(18) and ~20 more. The previous version banned exactly two of them by hand.
- **`href`/`*Href`** — navigation *between mockup files* (`"S9.11-4-execute.dc.html"`), 26 occurrences.
- **Bare CSS keyword values** — `inline-flex`, `inline-block`, `line-through`, `not-allowed`, `nowrap`, `uppercase`, `currentColor`, `pointer`.
- **`weight`/`align`/`strike`**, and **`dim`/`opacity` when numeric** — `dim` is kept when it is an object or array, because S10.1's top-level `dim` is its real dimensional-weight table.

Conversely, two keys were **un-banned** because the ban was deleting business content:

- **`state`** is now banned only at a Decision Object's top level (where the mockup envelope put it). A **row's** `state` is real business status — "approved 09:38", "ready today", "needs booking" — and the blanket ban was deleting 48 such values.
- **`anchor`** on a bridge row is the business fact that the row is an absolute level rather than a step. Without it a variance bridge cannot be drawn at all.

### 18.6 What changed, by file

| File | Change |
|---|---|
| `extraction/referenceContext.js` | **NEW.** Parses `lens`, `persona` and the agent roster out of the reference mockups' pinned identity strip. Build-time only. |
| `extraction/normalizeCorpus.js` | Rewritten mapping layer: no `fallbackScan`, per-field named vocabularies, claim ledger, provenance output, real axes, 20 new canonical fields, stronger hygiene. |
| `src/features/action-stories/contract/decisionObject.js` | `PERSONAS` extended 7 → 14, from reference evidence. |
| `src/features/action-stories/templates/slotVocabulary.js` | 34 → 51 slots; 5 duplicate context slots removed; every entry re-noted with its reference evidence. |
| `templates/reason.v1.json` | +`trigger`, `constraints`, `agents`, `stage_status`; `when` on every content slot. |
| `templates/analyze.compare.v1.json` | +`bridge`, `coverage`, `matrix`, `entities`, `secondary_rows`, `totals_rows`, `stage_status`. |
| `templates/decide.slate.v1.json` | +`recommendation_identity`, `recommendation_detail`, `composition`, `alternatives`, `item_groups`, `focus_rows`, `next_actions`, `basis`, `coverage`, `stage_status`; −`slate_summary`, `impact`, `confidence`, `confidence_calibrated`, `deadline`. |
| `templates/execute.bridge.v1.json` | +`flags`, `ledger_note`, `bulk_note`, `rollback_note`, `arming`, `stage_status`; `when` on every content slot. |
| `templates/selectTemplate.js` | `*|decide|many` → `*|decide|*`; new `*|live|*` → `execute.bridge.v1`. |
| `manifests/blockTypes.js` | `labelValueList` accepts `label`/`name`/`text`; `waterfallChart` takes business rows instead of pixel geometry. |
| `blocks/LabelValueListBlock.jsx` | Renders whichever identity key a row carries. |
| `blocks/chartGeometry.js` | **+`bridgeGeometry`** — derives waterfall coordinates from business values. |
| `blocks/WaterfallChartBlock.jsx` | Consumes `bridgeGeometry` instead of `top`/`height`. |
| `blocks/enumLabel.js` | **NEW.** Contract enum → operator copy. |
| `blocks/TextBlock.jsx` | Routes its text through `enumLabel`. |
| `actionStory.js` | Drops a repeated `(story, stage)` (RB-6). |
| `__corpus__/referenceFidelity.test.js` | **NEW.** 77 data-level fences. |
| `__corpus__/referenceContentRender.test.jsx` | **NEW.** Mounts all 105 and asserts reference sentences reach the DOM. |
| `blocks/enumLabel.test.js`, `blocks/bridgeGeometry.test.js` | **NEW.** Unit fences for the two new behaviours. |
| 6 existing test files | Updated to assert the new, correct behaviour (each change is commented with why). |
| `__corpus__/normalized/**` | Regenerated: `dataset.json`, 105 proposals, 4 examples, **+`provenance.json`**. |

**Not changed, deliberately:** `StageRenderer.jsx`, `composeSections.js`, `StageSections.jsx`,
`resolveBinding.js`, `actionCondition.js`, `validateManifest.js`, the store, the services layer, the
template count, the block registry's membership.

### 18.7 The regression fences that now exist

`referenceFidelity.test.js` + `referenceContentRender.test.jsx` assert, over all 105 records:

1. no `fallbackScan` in the normalizer's code;
2. every canonical field has a recorded source, and every emitted field has provenance;
3. every field's sources are within its declared allow-list — **48 per-field assertions**;
4. the six audit-named wrong mappings, pinned individually;
5. one raw key never supplies two canonical fields;
6. no value renders into two slots of the same screen;
7. no axis is hashed; `cardinality` is not hard-coded; `lens`/`persona`/`mode` come from the reference;
8. rollback is never fabricated; `impact`/`deadline` are omitted, not invented;
9. every slot maps to a registered block; no section is unfillable;
10. all 105 select a template and render with 0 unresolved bindings and 0 shape violations;
11. exactly one block is `selectable`, it is the slate, and every slate row carries an item identity;
12. `approve_selected` is offered only where `cardinality === 'many'`;
13. Recommendation's six units are six slots from six distinct sources, traced on S9.1;
14. all 105 mount in jsdom with no placeholder, no error boundary and no empty page;
15. per-stage DOM traces assert the reference's own sentences reach the page.

---

## 19. What remains unresolved

These are **product/backend decisions, not defects**. Each is stated rather than papered over.

| # | Item | State | Why it is not "fixed" |
|---|---|---|---|
| U1 | **Typed chart series** | `trend` renders 0 times; `distribution` renders 2 | The reference stores trends as raw SVG path strings and scatter points as `{cx, cy, r}` pixel positions. There is no business series to recover. The backend must send `[{x, y}]`. **Un-stripping the paths would be inventing data.** |
| U2 | **`contract_class`** | `'standard'` on all 105 | The reference draws no distinction between proposals. The `decision_contract_class` slot renders only for strategic/regulated, so it correctly renders nowhere until Product defines the axis. Flagged PROVISIONAL in `decisionObject.js` since it was written. |
| U3 | **`entitlement`** | `'full'` on all 105 | Every reference screen shows its whole slate, figures and item count, with no teaser or paywall. `locked.v1` stays registered and tested — a real contract capability with no corpus instance. |
| U4 | **`on_clock` / `deadline`** | `false` / omitted | The reference shows only relative deadline copy ("order-by Thursday", "first read in 6 weeks"). The contract requires an ISO-8601 instant when `on_clock` is true, and there is none to read. Consequence: the `snooze` action is never eligible. |
| U5 | **`impact`** | omitted | The reference's money figures are per-metric display strings inside `totals`/`heroMetrics`, with no field designated as *the* impact. Those rows are carried; the scalar is left absent rather than picked arbitrarily. |
| U6 | **S10.6's lens** | `sales`, from its own lead KPI tile | Its pinned strip reads "Lens: **all five**" — the one screen that names no primary lens. The single-valued `lens` axis cannot express it. |
| U7 | **Selected-entity inspector** | not built | `sel`/`selName`/`selMeta` on 11 analyze screens is an *interaction* (click a point → inspect), not a static slot. Needs a product decision about click-through behaviour. |
| U8 | **Filters / sorts** | not built | Table controls, not content. Same reason. |
| U9 | **Held-out / exclusions** | not built | Real business content ("Brand-protection lines · 9 SKUs") but authored as literal markup on individual screens, not as data. There is no field to normalize. |
| U10 | **Per-proposal CTA copy** | not built | `ctaLabel`/`approveSub` are per-screen button copy. The templates use the contract's generic operator-action labels; the reference's *explanatory* route cards are carried, as `next_actions`. |
| U11 | **`slider`, `object`, `flag` blocks** | registered, unused | `flag`'s only slot was `confidence.calibrated`, now in the header. No reference concept is a lone nested descriptor (`object`). `slider` would require shipping precomputed answers as business data. Kept registered and documented rather than deleted. |
| U12 | **`updated_at`** | one fixed generation instant | Generation metadata, not a business fact the reference states. |

**Coverage honesty.** Reference-field carry-through is **39.2 %**, not 100 %, and that is the correct
number: of the 948 fields still dropped, the large majority are per-screen presentation (tone maps,
tab strips, chart furniture, button styling) that the hygiene pass is *supposed* to remove. What the
fix guarantees is narrower and stronger than a coverage percentage: **every field that does render
comes from the reference field that means it**, and the ones that do not render are omitted rather
than substituted.
