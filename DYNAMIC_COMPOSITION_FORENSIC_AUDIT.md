# Action Stories — Reference-to-Dynamic-Rendering Forensic Audit

**Scope:** Why the dynamic Action Stories renderer cannot reproduce the reference screens in `Realify Workspace Dashboard Build 2.zip` (228 `.dc.html` reference screens; current app has 26 workflows × 4-5 stages = 105 real fixtures/manifests).

**Status:** Audit only. No code, manifest, CSS, or classification rule was modified to produce this report.

**Method:** Four parallel forensic passes, synthesized below:
- **[PIPE]** Full pipeline architecture trace (extraction → classification → manifest → binding → composition → layout → registry → render), cross-checked against 11 pre-existing audit reports already in this repo.
- **[S9.11]** Canonical deep dive: `S9.11-3-decide.dc.html` vs. current `S9.11` decide fixture/manifest/renderer.
- **[PATTERN]** Reference pattern inventory across 34 reference screens (7 full workflows × 4 stages + extras), covering all of S9.x/S10.x/S00.x.
- **[CROSS]** Spot-check comparison across 22 additional stage screens (9 workflows) + a project-wide table-detection and slider-coverage audit.

---

## 1. Executive Summary

The renderer is not failing to be "dynamic" — it is dynamic in exactly one dimension (block-type selection from value shape) and static in every other dimension a real information architecture needs. Three independent, compounding failures explain essentially every gap observed across all four passes:

1. **Extraction destroys the raw data model before classification ever runs.** Fixtures are built by executing the reference's `renderVals()` once and snapshotting its *already-formatted display output* (`"$68.00 → $71.99"`, `"+$1,240"`, `tol: 4`), not the underlying raw record (`{sku, old, nu, loss, p10, p90, cm, conf, pref}`) or control bounds (`min`/`max`/`step` live only as literal HTML attributes on the reference's `<input>`, never in `renderVals()`'s return value, so no extraction of that function's output can ever recover them). **[PIPE §1, S9.11 §2/§7]** This alone makes several reference structures (any real slider; any table whose columns were pre-joined into one display string) structurally unrecoverable no matter how good classification/composition become later.

2. **Classification decides block type from a narrow, brittle shape heuristic with no visual-form signal.** The `label`-key gate that would promote a rich record array to `table` fires only when a row literally has a field named `label` — `name`/`sku`/other identity keys don't count — so real per-SKU tables fall through to whatever generic shape-match comes next (often a false-positive `barChart` via a stray percent-like field). **[PIPE §2, S9.11 §4]** Conversely, `hasEnoughColumns >= 3` uniform-scalar-column detection *over*-fires on card grids, radio-pickers, and rail lists that happen to have 3+ scalar fields, misclassifying them as `table` — measured at **10/17 (~59%) true-positive table detection with 18 confirmed over-classifications running the other way** in the sampled screens. **[CROSS §2]**

3. **There is no composition/dependency model above individual blocks.** The manifest schema and composition engine treat every block as an independent `{slotName, blockType, binding, section, role, layout}` entry; the only real cross-block relationship is one hardcoded 4-slot-name vocabulary (`heroTitle`/`heroSub`/`heroMetrics`/`moveBar`). **[PIPE §5]** Nothing expresses "this slider governs that table," "this chart's legend belongs to that chart," or "this table has an attached row-tag/action." Even where the right block types get classified correctly, the reference's *grouped* screens (control+table+ladder+summary as one interactive unit) collapse to a flat stack of unrelated cards. Section/region granularity is also frequently too coarse — many stages have only 2 sections (`summary`/`details`) covering what the reference renders as 6-9 distinct panels, and rail-only content is routinely mis-tagged into the main region and vice versa. **[CROSS §1, across nearly every row]**

The dynamic engine's actual, working capability — mapping raw values to one of 13 block components and packing them into a 12-column grid — is real and mostly sound (fixed shell, 13-block registry, span/grid heuristics all function as designed). The gap is entirely upstream and around that capability: **what raw data reaches the classifier, what shape-signals the classifier is allowed to use, and what relationship model sits above individual blocks.** None of this requires per-workflow hardcoding to fix — the fixes are new *generic* rules (a metadata-preserving extraction step, a broader table-promotion signal, an explicit group/dependency field in the schema) — but they do require re-running extraction and adding schema capability, not just tuning existing heuristics.

---

## 2. Exact Root Cause

Stated as a single causal chain, using S9.11/Decide as the concrete proof case:

```
Reference: <input type="range" min="1" max="8" step="0.5" value="{{tol}}" onChange="{{onTol}}">
           + SLATE() raw records {sku, name, old, nu, loss, p10, p90, cm, conf, pref}
           + renderVals() — ONE function that derives hero/table/ladder/stats/gate from `tol`
                │
                ▼ EXTRACTION (extract.js + parseMockup.js + dcLogicSandbox.js)
                │   captures only renderVals()'s RETURN VALUE at one instant (tol=4),
                │   never the <input> element's min/max/step attributes (they live in
                │   markup, not in any value renderVals() returns), never SLATE()'s
                │   raw numeric fields (only their formatted-string projections survive)
                ▼
decide.json:  "tol": 4                              (bare number, no bounds)
              "slate": [{sku,name,prices,pct,vol,cm,conf,tag,modes:[...]}, ...]
                        (pre-formatted display strings, not raw old/nu/loss/p10/p90)
                │
                ▼ CLASSIFICATION (classifyBlocks.js:302-426)
                │   tol: typeof number → 'number' (isSliderShaped never runs on scalars)
                │   slate: no item has a literal `label` key (has `name` instead) →
                │          every label-gated branch (incl. the table-promotion rule at
                │          L347-352) is skipped → falls to the unlabeled-bar-shape
                │          check (L363-368) → `pct` field ("+5.9%") passes
                │          looksLikeMagnitude + hasConsistentMagnitudeUnits → 'barChart'
                ▼
S9.11.json:   {slotName:"tol", blockType:"number", section:"summary"}
              {slotName:"slate", blockType:"barChart", section:"analysis"}
              (no layout.group linking them; no dependency field exists in the schema)
                │
                ▼ COMPOSITION / LAYOUT (composeSections.js, StageSections.jsx)
                │   two unrelated blocks, independently sized and placed
                ▼
                ▼ RENDERING
NumberBlock:  static "4"  (no <input>, no drag handler, no bounds, no scale labels)
BarChartBlock: 9 bars, x-labels "1".."9" (positional index — `item.label` fallback),
               each bar height = the price-increase %, SKU/name/price/loss/P10-P90/
               CM/confidence/tag/Roll-Test-toggle all silently discarded
```

**Root cause layer(s), precisely:**
- **Extraction (primary, unrecoverable downstream):** the fixture pipeline snapshots derived/formatted output instead of the raw record + control metadata. No classifier or composition fix can reconstruct `min=1/max=8/step=0.5` or the raw numeric `old/nu/loss/p10/p90/cm` fields from strings that were already joined into `"$68.00 → $71.99"` and `"−3.4% · −1.8–5.1"`.
- **Classification (secondary, fixable without extraction changes for *this* specific miss):** the table/list-vs-chart decision gates on a literal `label` key rather than accepting any identity-like string field (`name`, `sku`, `title`, `id`) as an equivalent signal, and has no "does this array have ≥4 differently-typed columns including one that looks like a row identity" rule independent of the `label` name.
- **Manifest schema / composition (tertiary, architectural):** even a correctly classified `table` (rows) + `slider` (tol) pair has no way to be declared as related; the schema has no dependency/group field for "this control's value scopes/filters/recolors that other block."

---

## 3. S9.11 Decide Deep Dive

*(Full detail in the standalone research pass; summarized and cited here.)*

**Reference structural signature** (`S9.11-3-decide.dc.html`): 2-column shell (`1fr 340px`) → hero+slider card (giant recommended-savings value, tradeoff copy, a `min=1/max=8/step=0.5` range input two-way-bound to `state.tol`, live-recomputed stats) → "Price slate" 8-column table (checkbox · SKU+name+tag · old→new price · Δ% · volume-Δ with P10-P90 band · CM/mo · confidence · per-row Roll/Test segmented toggle) → 4-card approval zone → 340px rail (As-selected summary, rule-check list, a 5-rung "tolerance ladder" highlighting the rung nearest the current slider value, "tests routed" chip) → footer bar gated on `confidence >= 70`. The entire screen is one reactive unit: `renderVals()` derives *every* one of these regions from `this.state.tol`.

**Current data shape** (`decide.json:34-379`): `data.tol: 4` (bare number, no bounds) and `data.slate[]` — 9 objects with pre-formatted display strings (`prices`, `pct`, `vol`, `cm`, `conf` all already-joined strings) plus inline style-token fields (`bg`, `boxBg`, `checkOpacity`) and a nested `modes: [{label:"Roll",...},{label:"Test",...}]` per-row control pair.

**Current manifest treatment** (`S9.11.json`): `slate` → `{blockType:"barChart", binding:"data.slate", section:"analysis"}`; `tol`/`tolLabel` → `{blockType:"number"}` / `{blockType:"text"}` in `section:"summary"` — three unrelated blocks, no `layout.group`, no declared relationship.

**Classification trace:** `classifyBlockType` walks the array through `isMultiSeriesLineShaped` → `isWaterfallShaped` → `isHeatmapGridShaped` → `isBarChartShaped` (labeled) → `isLabeledScatterShaped` → the rich-record **table promotion at `classifyBlocks.js:347-352`** — every one of these branches requires `item.label` to be a string, and slate rows carry `name`, not `label`, so **all of them are skipped**, including the one branch that could have produced `table`. Execution falls to the unlabeled bar-shape check (`L363-368`): `CHART_MAGNITUDE_KEYS = ['value','h','height','pct','amount']` and every row's `pct` (`"+5.9%"`) passes `looksLikeMagnitude` + `hasConsistentMagnitudeUnits` → **`'barChart'`**. `tol`'s bare-number type short-circuits to `'number'` at `classifyBlocks.js:308` before `isSliderShaped` (which only ever runs on `isPlainObject` inputs, `L415-424`) is reachable at all.

**Component render trace:** `BarChartBlock.jsx:42-48` computes `label: item?.label ?? String(i+1)` — bars end up labeled "1".."9" — and plots only the first present magnitude key (`pct`), discarding `sku`, `name`, `prices`, `vol`/P10-P90, `cm`, `conf`, `tag`, and the entire `modes` Roll/Test toggle array. `NumberBlock.jsx:19-24` renders `tol` as a static, non-interactive "4" — no `<input>`, no handler, no bounds, no scale labels.

**Divergence point:** three layers simultaneously — (1) extraction snapshots `renderVals()`'s formatted output and never captures the reference `<input>`'s `min`/`max`/`step` attributes (they exist only in markup, not in any JS return value), so no slider can ever be reconstructed from this fixture; (2) classification's label-gated branch order means an identity field named anything other than `label` disqualifies an array from every rich-record path, including table promotion, landing it instead on a coincidental single-field chart match; (3) even with (1) and (2) fixed, nothing in the manifest schema or composition engine can express "the slider (`tol`) scopes/recolors the table (`slate`) and the ladder (`ladder`)" — that whole reactive relationship, which is the entire point of the reference screen, has no schema representation at all.

**Slider/control fate:** confirmed dropped at extraction, not merely misclassified — `decide.json` has no `{min,max,value}`-shaped object anywhere in its 533 lines, and the `slider` blockType/validator/component are fully built and unit-tested (`SliderBlock.jsx`, `blockTypes.js` `validateSlider`) but are used by **0 of 105 real manifests project-wide** (confirmed independently by `[CROSS §3]` and `[PIPE §2]`).

---

## 4. Reference Screen Pattern Inventory

Sourced from `[PATTERN]` (34 screens read in depth across 7 full workflows + S00/S10 extras) and `[CROSS]` (22 more spot-checked). The 228 reference screens reduce to one universal shell plus roughly ten recurring content patterns, strongly clustered by **stage**, not by workflow:

| Pattern | Example screens | Structural signature |
|---|---|---|
| **Shell chrome (universal)** | every screen | icon rail → header → breadcrumb/hero strip → lens chips → 4-step tab tracker → 2-col body (`1fr` main + 300-340px rail) → sticky footer action bar |
| **Narrative hero + policy/guardrail table + role/category grid** (dominant *Reason* shape) | S9.1-1, S9.2-1, S9.5-1, S9.7-1, S9.9-1, S9.16-1, S9.19-1-reason | eyebrow + `<h2>` narrative + explanatory `<p>` → policy/threshold card (label/value/status rows) → locked/protected chips → 2-col role definition grid |
| **Intel-card hero + chart + drillable table** (dominant *Analyze* shape) | S9.1-2, S9.2-2, S9.7-2, S9.9-2, S10.1-2-analyze | bold-number finding banner → one primary chart (scatter/fan/waterfall/matrix) with inline legend → full-width homogeneous-row table below |
| **Control + recomputed metrics + itemized row-groups** (dominant *Decide* shape) | S9.2-3, S9.11-3, S9.12-3, S10.4-3-decide | slider/notch/stepper control → live metric-tile strip recomputed from it → grouped row cards (often with a per-row sub-picker) → guardrail-gated footer CTA |
| **Lane/option cards with embedded radio sub-panel** | S9.3-3, S9.5-3-decide | each candidate = card with stat cluster + embedded 2-3-option radio/stepper sub-choice, recomputing CM per option |
| **Push/rollout tray: destination cards + before→after diff + progress rail** (dominant *Execute* shape) | S9.1-4, S9.2-4, S9.3-4, S9.5-4, S9.7-4, S9.9-4, S9.16-4, S9.19-4-execute | repeated destination/stage cards, each with a nested before→after diff list; rail = push-progress bar + auto-toggle + rollback card |
| **Event feed + master/detail panel** | S9.5 (event feed), S10.3-2-analyze | narrow scrollable card list (severity pill, SLA chip) + wide detail pane (stats, decomposition bars, evidence) |
| **Waterfall/bridge chart + reconciliation strip + classifier/timeline rail** | S9.9-2, S10.1-2-analyze | SVG waterfall with connector lines → reconciliation metric tiles → rail: anomaly classifier + vertical timeline |
| **Gauge/sparkline health-dashboard grid** | S10.3-2-analyze, S10.6-5-live | repeat(5-6) small tiles: label, big number, delta, inline sparkline, colored top border by state |
| **Empty-state / landing hub** | S00-workspace, S00-chat, S00-explore, S00-agents, S00-prompts | dashed-border centered panel, icon, `<h3>`, short copy, optional mini step-diagram |

**Per-stage tendency, confirmed across both passes:** Reason = narrative + governance (no charts); Analyze = chart + drillable table (rail = secondary lists, not controls); Decide = the *only* stage with live-recomputed controls, and the only stage with a guardrail-gated footer CTA and a "policy check" progress-bar rail; Execute = destination/diff cards, narrative nearly disappears.

**Common table record shape, recurring regardless of workflow domain:** identity cell (bold name + mono secondary ID) + 1-2 role/category badge cells + 2-4 numeric metric columns (often color-coded against a floor/ceiling) + trailing status/verdict chip — whether the row represents a SKU, a search term, a claim, a lane, or a campaign. **[PATTERN §4]** This single recurring shape is the strongest evidence that a generic, workflow-agnostic table/record detector is the right lever, not per-workflow logic.

---

## 5. Current Renderer Capability Matrix

| Capability | Exists? | Where | Real-world usage |
|---|---|---|---|
| Value→blockType classification (13 types) | Yes | `extraction/classifyBlocks.js:302-426` | Used for every block in every fixture |
| Homogeneous-record → table detection | Yes, but label-gated and shape-blind to visual form | `classifyBlocks.js:347-352` (labeled path), `L382-392` (unlabeled path) | 59% true-positive, 18 confirmed over-classifications in the 22-screen sample **[CROSS §2]** |
| Slider/control detection | Yes, but only for a `{min,max,value}` object shape | `classifyBlocks.js:249-253` (`isSliderShaped`) | 0 of 105 real manifests use it **[PIPE §2, CROSS §3]** |
| Metadata-descriptor suppression (column-header array attached to a table) | Yes, one narrow 80%-key-overlap rule | `classifyBlocks.js:560-584` (`findMetadataDescriptorSlots`) | Suppresses, never attaches as caption |
| Hero/subtitle composition | Yes, one hardcoded 4-name vocabulary | `classifyBlocks.js` `HERO_SLOT_NAMES`/`HERO_COMPANION_KEYS` | ~20/26 workflows get a `recommendation` section; still vocabulary-keyed, not general |
| Section/region assignment | Yes, vocabulary + shape heuristic | `classifyBlocks.js:683-763` (`planSections`) | Frequently too coarse — many stages get only 2 sections for 6-9 reference panels **[CROSS §1]** |
| Manifest-declared span/grouping | Schema exists (`layout.group`, `layout.span`) | `validateManifest.js:83-103` | Populated only for the hero-panel 4-slot case; 0/1,760 blocks elsewhere **[PIPE §4]** |
| Heuristic span inference | Yes | `layout/blockSizing.js:54-135` (`inferSpan`) | Runs for everything else; shape-driven, not authored |
| 12-column grid + rail (300px fixed) | Yes | `layout/composeSections.js`, `StageSections.jsx:205` | Works, but only one rail-panel shape regardless of stage |
| Block registry (13 components) | Yes | `blocks/index.js:19-33` | Solid; error-boundary-wrapped per block |
| Cross-block data dependency (control → dependent content) | **No** | — | The `StageRenderer.jsx` `overrides` mechanism exists in code but requires the unused `slider` shape + a `steps` array; unexercised by any real fixture |
| Row-level actions/tags on tables | **No** | `TableBlock.jsx` | No schema field for it |
| Rich/authored block title-description | **No** | — | Always derived from `slotName` via `humanizeSlotName` |
| Chart click-to-drill / cross-filter | **No** | 5 chart components | Recharts default hover tooltip only |

---

## 6. Fixed vs Dynamic Responsibility Matrix

| Property | Classification | Evidence |
|---|---|---|
| Application shell, icon rail, header, step tracker | **A. FIXED SYSTEM PRIMITIVE** | Universal across all 228 reference screens **[PATTERN §7]**; matched by `Shell.jsx`/`StepTracker.jsx` in current app |
| Typography, spacing, color tokens | **A. FIXED SYSTEM PRIMITIVE** | Design-system layer; out of this audit's rendering-pipeline scope but confirmed stable across screens |
| Card/BlockCard primitive, section container | **A. FIXED SYSTEM PRIMITIVE** | `BlockCard.jsx` single shared wrapper **[PIPE §6]** |
| Block values (numbers, strings, booleans) | **B. DATA-DRIVEN** | Direct scalar rendering, works today |
| Table column set / row count | **B. DATA-DRIVEN** | Computed from resolved array's own keys at render time, `TableBlock.jsx:94-103` |
| Table vs. card vs. list decision for a homogeneous record array | **C. SEMANTICALLY INFERABLE** | The rule exists (`hasEnoughColumns>=3`) but needs a *visual-form* signal (row count, presence of an identity-like field, absence of a natural "card" narrative field) to stop over/under-firing — inferable generically, not workflow-specific |
| Slider/control existence + bounds (min/max/step) | **E. REQUIRES EXPLICIT BACKEND/EXTRACTION SIGNAL** | Bounds live only in the reference's HTML markup, never in any value a data-only classifier could see; must be captured at extraction time, not inferred |
| Which block is the "hero" | **C. SEMANTICALLY INFERABLE**, currently narrowed to **D. MANIFEST-CONFIGURABLE fallback** | `role:"hero"` bypass + 60-char heuristic fallback, `heroSlot.js:19-21` |
| 2-column main/rail split, which blocks go where | **C. SEMANTICALLY INFERABLE via section metadata**, but currently under-expressed | `planSections`'s vocabulary table is a start; needs richer per-block "region" signal or explicit generation-time authoring |
| Relationship between a control and the content it governs | **E. REQUIRES EXPLICIT SIGNAL (extraction or manifest)** | No data-only signal distinguishes "this table happens to sit near this slider" from "this slider recomputes this table" — the reference's own `renderVals()` closure is the only source of truth, and it must be captured, not re-derived |
| Row-level tags/actions on a table | **D. MANIFEST-CONFIGURABLE** | Could be expressed as a per-column role annotation (`role:"tag"` / `role:"action"`) once the raw record retains its native keys |
| Business action semantics (Approve/Push/Send-back) | **E. EXPLICIT BACKEND/ACTION CONFIG** | Already effectively fixed per-stage in `StageActionBar.jsx`; appropriately not something to infer from data |
| Exact pixel-perfect reproduction of one screen's spacing quirks | **F. CURRENTLY IMPOSSIBLE TO INFER SAFELY / NOT A GOAL** | The brief explicitly rejects this — composition, not pixel-matching, is the target |

---

## 7. Data → UI Inference Matrix

Using the S9.11 slate shape (`{sku, name, old, nu, loss, p10, p90, cm, conf, tag, pref}`) as the running example:

| Question | Answer | Generic rule / minimum metadata |
|---|---|---|
| Can `{sku,name,...9 more scalar keys}[]` become a table automatically? | **YES, WITH SEMANTIC RULES** | Generalize the existing rich-record rule (`classifyBlocks.js:347-352`) to accept *any* string-typed "identity-like" field (first string-typed key, or a key matching `/id$|code$|name$|sku$|title$/i`) as equivalent to `label`, not only a literal `label` key. This is a shape rule, not a workflow rule — it would fire identically for SKUs, claims, campaigns, or lanes. |
| Can the P10/P90 uncertainty band be recognized as one composite "range" column rather than two scalars? | **YES, WITH SEMANTIC RULES** | Generic rule: any two sibling numeric keys matching `/^p(\d+)$/i` with p<50 and p>50 pairs (or explicit `lo`/`hi`, `min`/`max` siblings) → render as one uncertainty-band cell, not two columns. |
| Can the per-row `modes: [{label:"Roll"},{label:"Test"}]` become a segmented-toggle cell? | **YES, WITH SEMANTIC RULES, conditional on extraction preserving it** | Generic rule: a nested array of ≤4 items each shaped `{label, ...style tokens}` inside a table row → render as an inline segmented-control cell bound to a `mode`/`selected` sibling field. Requires extraction to not strip nested arrays from table-classified data (currently `BarChartBlock`/whatever wins the parent classification never even looks at nested arrays). |
| Can the slider's min/max/step be inferred from `tol: 4` alone? | **NO** | Requires explicit backend/extraction signal — the bounds exist only in reference markup. Minimum metadata: extraction must independently record `<input>` attributes (`min`,`max`,`step`) alongside the state value it currently captures. |
| Can "this slider governs this table" be inferred from co-location in one manifest section? | **NO, not safely** | Co-location is necessary but not sufficient (two unrelated blocks can share a section). Minimum metadata: an explicit `dependsOn`/`controls` field naming the slotName(s) a control affects, populated at manifest-generation time by tracing which fixture keys change when `renderVals()` is called with different `tol` values (extraction-time analysis of the reference's reactive function, not a runtime inference). |
| Can a 2-column role/definition grid (S9.1 `roles`) be distinguished from a genuine data table using only value shape? | **YES, WITH SEMANTIC RULES** | Rows whose scalar columns are dominated by long free-text (`definition`, `detail`, `note` fields averaging >40 chars) vs. rows dominated by short numeric/categorical fields → the former should bias toward card-grid, the latter toward table. This is exactly the signal `blockSizing.js`'s prose-length heuristics already compute for span — it is not yet fed back into the *type* decision, only the *size* decision. |
| Can gauge/meter data (`{label,value,pct,limitPct}`) be told apart from a plain metric list? | **YES, WITH SEMANTIC RULES** | Presence of a `limitPct`/`ceiling`/`floor`/`threshold`-named sibling key alongside a `pct`/`value` key is a generic, workflow-agnostic gauge signal — currently absent from the classifier entirely (`bars`-type arrays fall through to `table` today, `[CROSS §1]` S9.19/decide). |

**Explicitly rejected as a valid rule per the brief's constraint:** any `if (workflow === "S9.11")` conditional. None of the rules above reference a workflow code; all are keyed to generic shape/key-name/statistical signals.

---

## 8. Table Detection Audit

**Method [CROSS §2]:** every array-of-objects across 22 spot-checked stage screens was judged as genuine-reference-table vs. not, then checked against its actual manifest classification.

- **True positives (correctly `table`): 10** — e.g. S9.1/analyze `rows`, S9.1/decide `focusRows`, S9.11/reason `cohorts`, S9.11/analyze `rows`, S9.16/reason `criteria`, S9.16/execute `checklist`/`tracking`, S9.19/analyze `library`, S9.20/execute `watchlist`, S10.6/live `readout`.
- **False negatives (genuine table, NOT classified `table`): 7** — S9.11/execute `stages[].diff` (no block at all — nested inside a parent `itemQueue`), S9.16/analyze `unit`/`plRows`/`plCols` (→ `labelValueList`/`itemQueue`), S9.16/decide `skus` (→ `itemQueue`, while its sibling `modes` card-grid got `table` — a literal inversion), S9.5/analyze `sel.ladder` (buried inside a generic `object`), S9.20/execute `pipeline` (→ `itemQueue`, borderline).
- **False positives (NOT a genuine table, classified `table` anyway): 18** — S9.1 `policy`/`roles`/`gaps`/`slates`/`groups`/`watches`; S9.11 `agents`; S9.16 `existing`/`modes`/`gate`; S9.19 `conflicts`/`bars`; S9.20 `parked`/`drafts`/`rollback`; S9.3 `after`; S9.5 `feed`; S10.6 `lensTiles`.

**TABLE DETECTION COVERAGE = 10/17 ≈ 59%** (true-positive rate on genuine reference tables), with an even larger volume of false positives running the other direction — 18 non-table structures rendered as `table`.

**Why:** the promotion rule at `classifyBlocks.js:347-352` requires (a) a literal `label` key and (b) ≥4 uniform meaningful columns; rule (a) blocks correct detection whenever the identity field is named `name`/`sku`/anything else (all 7 false negatives trace to this), while the *plain* table rule at `L382-392` (≥3 uniform scalar columns, no `label` requirement) has no negative signal for "this is actually a card grid / radio-picker / meter list that happens to have 3 scalar fields" (all 18 false positives trace to this). Neither rule considers prose length, nested sub-structures (radio pickers, sparkline configs), or the presence of gauge-like threshold fields — exactly the signals identified as available and generic in §7.

This is corroborated project-wide by the repo's own `extraction/audit-report.md`, independently found by `[PIPE]`, which documents the identical `{label,value}`-family shape landing on both `barChart` and `labelValueList` across dozens of workflows with no consistent rule **[CROSS §4]**.

---

## 9. Slider / Control Audit

1. **Is the control represented in the current data?** Only as a bare current-value scalar (`tol: 4`, `notchVal: 2`, `rlThreshold: 14`), never as `{min,max,value}`. **[S9.11 §7, CROSS §3]**
2. **Is it classified?** No — a bare number short-circuits to `'number'` before the object-shaped `isSliderShaped` check is ever reachable. **[PIPE §2]**
3. **Is its configuration (min/max/step/unit/scale-labels) preserved?** No — these exist only as literal HTML attributes on the reference's `<input>` element and were never part of any value the extraction step captured.
4. **Is its state preserved?** Yes, trivially — a single snapshot value, but with no notion that it is a *live, user-adjustable* state.
5. **Is its relationship to nearby blocks preserved?** No — no schema field expresses "governs" or "affects."
6. **Can it dynamically affect adjacent content?** Architecturally, partially — `StageRenderer.jsx`'s `overrides` mechanism (keyed off a `steps` array on a `slider` block) is real, working code, but depends on a data shape (`{min,max,value,steps:[{at,...overrides}]}`) that **0 of 105 real fixtures produce**. **[PIPE §5]**
7. **Is the current renderer capable of representing a control generically?** Yes for the "draw a range input" part (`SliderBlock.jsx` is fully built, styled, and unit-tested) — the gap is entirely upstream (extraction never captures bounds) and in the dependency model (nothing wires the control to dependent blocks).

**Project-wide coverage:** 0 of 105 real manifests use `blockType:"slider"` (confirmed by both `[PIPE]` and `[CROSS]` independently, including a direct grep across all 26 workflow manifest files). At least 3 reference screens beyond S9.11 (`S9.2-3-decide.dc.html`, `S9.12-3-decide.dc.html`) contain a literal `<input type="range">` with the identical "value captured, bounds dropped" pattern — this is systemic, not an S9.11-specific accident.

**Verdict:** the current architecture has **zero** generic "control + dependent composition" concept in practice — the code exists for the *rendering* half, but the *data capture* and *dependency wiring* halves are both entirely absent, so the capability is inert.

---

## 10. Layout Audit

| Layout capability | Reference needs | Current capability | Gap |
|---|---|---|---|
| 1-column stack | Yes (rare — mobile/empty states only) | Yes, default fallback | None |
| 2-column (main + fixed rail) | Universal — every workflow screen | Yes — `1fr` + hardcoded 300px rail | Matches shape, but rail is a single generic panel per section vs. reference's often-distinct rail cards |
| 3-column | S00-workspace only (launcher, not a workflow stage) | No | Not needed for in-scope workflow screens |
| Full-width table/chart section | Universal in Analyze/Execute | Yes — heuristic span up to 12 | Works when block *is* classified as table/chart |
| 2-up / 3-up card grids | Common in Reason (role grid) and Execute (destination cards) | Partial — `ItemQueueBlock`'s compact-card packing exists | Works for uniformly-simple items; large records still stack 1-per-row |
| Chart beside supporting list | Common in Analyze (S9.3, S9.9) | Partial | Achievable via `layout.group`, but not authored/inferred generically — only the hero 4-slot case is populated |
| Control beside table/metrics | Universal in Decide | **No** | No composition primitive expresses this relationship at all (see §9, §11) |
| Rail cardinality varying by stage (1 shared panel vs. 4 independent cards) | Reference varies this per stage | **No** — exactly one `RailPanel` shape always | Confirmed unresolved gap, carried forward from `FORENSIC_AUDIT_S9.1.md` **[PIPE §7]** |
| Header/footer as distinct physical regions | S10.1-decide reference has 4 physical regions (header/main/rail/footer) | Only main/rail modeled | 2-region model can't express footer-bound content, which gets force-placed into rail sections **[CROSS §1, S10.1 row]** |
| Section count per stage matching reference panel count | Reference commonly has 6-9 distinct titled panels per stage | Frequently only 2 sections (`summary`/`details`) | Confirmed repeatedly: S9.1-execute, S9.16-execute, S9.19-execute, S9.20-execute all collapse 6-9 reference panels into 2 buckets **[CROSS §1]** |

Layout is **heuristic + partially manifest-driven** (span/grouping schema exists but is populated for one vocabulary case only), never truly **semantic** in the sense of inferring "this control and this table are one interactive unit and must be laid out adjacently." The 12-column grid + fixed rail mechanics themselves are sound; what's missing is the *input* to those mechanics — declared or inferred region/grouping information at the granularity the reference actually uses.

---

## 11. Composition Audit

**Verdict: a flat list of independently-rendered blocks, with exactly two narrow, hardcoded exceptions — not a true composition tree.** **[PIPE §5]**

- The only real cross-blockType fusion mechanism (`layout.group` + the `recommendation` section) is exercised for one fixed 4-slot-name vocabulary (`heroTitle`/`heroSub`/`heroMetrics`/`moveBar`), confirmed populated in ~20/26 workflows for *that one pattern only* — not a general "author declares N related blocks" capability in practice.
- `findMetadataDescriptorSlots` is the one place a genuine structural relationship between two blocks is detected (a column-descriptor array vs. its sibling table, via ≥80% key overlap) — but it is a **suppression** rule (the descriptor is deleted), never an **attachment** rule (it's never rendered as the table's caption/legend).
- No concept exists anywhere in the schema for: control→dependent-block, table→row-action, table→row-tag, chart→legend-as-separate-block, or hero→rationale-paragraph beyond the one hardcoded 4-name case.
- Direct evidence: S9.11/decide's `slate[].modes` (a real, per-row Roll/Test control pair) is architecturally unreachable by whatever block ends up rendering `slate`, because no block type reads nested arrays inside table/chart rows, and no composition layer would know to treat it as "this row's own mini control" even if it could.
- This conclusion is independently reached by three of the pre-existing audit reports already in the repo (`FORENSIC_AUDIT_S9.1.md`, `AUDIT_REPORT.md`), both stating some version of "the renderer has no path for 'these two blocks are related' beyond accidental scalar adjacency," and confirmed still true against the current code by this pass. **[PIPE §5, §7]**

---

## 12. Same Data → Different UI Cases

Confirmed systemic, not isolated, by both `[CROSS]`'s direct sampling and the repo's own `extraction/audit-report.md` (independently discovered by `[PIPE]`):

| Shape | Rendered as `barChart` in... | Rendered as `labelValueList`/`table` in... |
|---|---|---|
| `n=4, keys={label,value}` | S9.1/analyze `movement` | S9.11/analyze `excluded` |
| `n=4, keys={label,pct,value}` | S9.11/analyze `concentration`, S9.20/decide `spend` | (elsewhere `labelValueList`) |
| `n=5, keys={label,value}` | S9.7/decide `summary`, S9.17/decide `summary` | S9.3/reason `rules`, S9.3/execute `tray`, S9.5/reason `posture`, S9.11/analyze `rollup`, S9.16/analyze `lift`, S9.16/decide `summary`, S9.19/execute `progressRows`, S9.20/execute `progressRows`, S10.1/decide `summary`, S10.1/execute `recorded`, S10.6/reason `summary`, S10.6/decide `outcome`, S10.6/execute `progressRows` |
| `n=4, keys={label,note,value}` | S9.16/analyze `launchCosts` | S9.11/execute `guardParts`, S9.16/analyze `caseMetrics` **— same workflow, same stage, opposite classification** |
| Bordered card family (rank/id/rationale/plan) | — | S9.20/decide `sampled`→`itemQueue` vs. `parked`→`table` (visually identical card family, different blockType) |
| Radio-picker cards vs. literal checklist table (same stage) | S9.16/decide `modes` (3 picker cards)→`table` | S9.16/decide `skus` (real 7-col table)→`itemQueue` — **inverted** |

**Root cause for all of these:** `classifyBlockType`'s dispatch order and thresholds (`hasEnoughColumns >= 3`, unit-consistency-only checks, the `label`-key gate) are evaluated per-array with no cross-workflow or cross-stage consistency guarantee — two structurally near-identical arrays land on opposite branches whenever a coincidental field (a `note` vs. no `note`, a stray magnitude-shaped key) tips a threshold differently. This is a classifier-determinism gap, not a composition or layout gap.

---

## 13. Dynamicness L1–L10 Score

| Level | Current | Target (production-appropriate) | Gap |
|---|---:|---:|---:|
| L1 — dynamic values | 5/5 | 5 | 0 |
| L2 — dynamic block types | 3/5 (13-type registry, but classification accuracy ~59% on tables, non-deterministic on shared shapes) | 4-5 | 1-2 |
| L3 — dynamic block ordering | 3/5 (order follows manifest array order + section bucket; no reference-informed re-ordering) | 4 | 1 |
| L4 — dynamic layout | 3/5 (12-col grid + heuristic span works; section granularity too coarse; rail cardinality fixed) | 4 | 1 |
| L5 — dynamic styling | 4/5 (tokens/severity-tone system solid, per prior audits) | 4 | 0 |
| L6 — dynamic controls/actions | 1/5 (slider exists but 0/105 real usage; no row-actions; one hardcoded action bar) | 3 | 2 |
| L7 — dynamic visibility | 2/5 (binding either resolves or the block is dropped; no conditional/`visibleIf` field) | 3 | 1 |
| L8 — dynamic interaction relationships (control→dependent content) | **0/5** (architecturally present in code, never populated by real data) | 3 | 3 |
| L9 — dynamic workflow/stage configuration | 4/5 (manifest generation is per-workflow-data-driven already; stage set is fixed vocabulary — reason/analyze/decide/execute/live) | 4 | 0 |
| L10 — fully dynamic screen composition | 2/5 (one hardcoded hero-group exception; otherwise flat block list) | 3-4 (not 5 — see below) | 1-2 |

**What level is actually appropriate:** L10 should **not** mean "arbitrary, unconstrained composition" — the brief itself rejects per-screen hardcoding in either direction (neither "every screen bespoke" nor "every screen algorithmically free-form with no guardrails"). The right target is **L8-L9 in practice, treating L10 as "the small number of generic composition patterns identified in §4 are selectable and parameterizable from data + a modest manifest vocabulary," not "anything can be composed."** The biggest, most consequential gaps are **L8 (interaction relationships, currently 0)** and **L6 (controls/actions, currently 1)** — both are the direct mechanism behind the S9.11 Decide failure and recur across every Decide-stage reference screen sampled.

---

## 14. Manifest/Data Contract Gap Analysis

Target schema fields under discussion in the brief: `{type, data, title, description, layout, span, group, variant, role, control, columns, actions, dependencies}`. Current state (`validateManifest.js`, `blockTypes.js`) already has: `blockType`(type)/`binding`(data)/`section`/`role`/`region`/`layout.span`/`layout.group`. Missing, evaluated individually:

| Field | Should it exist? | Source | Why |
|---|---|---|---|
| `title`/`description` | **Not needed as authored fields** | Inferred (`humanizeSlotName`) | Current auto-humanization is adequate; adding authored titles would be manifest-generation-time metadata derivable from the reference's own copy, not something to backend-author per block |
| `variant`/`density` | **Not needed** | Inferred | Deliberately rejected already per `S9.1_DENSITY_COMPOSITION_REPORT.md`; density is correctly a render-time function of resolved shape |
| `columns` | **Not needed as a separate field** | Inferred from resolved array's own keys | Already works (`TableBlock.jsx:94-103`); an authored `columns` field would risk drifting from the actual data |
| `actions` | **Should exist, minimal form** | Manifest-configurable (generation-time, from reference structural signal) | Needed to represent per-row actions (Revert, Send-back) seen in reference Execute-stage diff tables; should be a small enum-tagged column role (`role:"action"`), not a full command schema |
| `dependencies`/`control` | **Should exist — this is the highest-leverage missing field** | Requires explicit extraction-time signal | This is the field that would let a `slider`-classified block declare `{controls: ["slate","ladder","liveStats"]}`, populated at manifest-generation time by tracing which fixture keys change when the reference's own `renderVals()` is invoked at different control values. Cannot be inferred from a single static snapshot — must come from extraction re-running the reference logic at multiple control positions, or from the reference's own script being analyzed for which state keys `renderVals()` reads. |
| `group` | **Exists, underused** | Manifest-configurable | Schema is fine; needs generalizing beyond the one hero vocabulary — e.g., generation-time rule: any control-classified block found adjacent (in raw fixture key order or DOM proximity) to blocks whose values changed across the extraction's multi-snapshot pass gets auto-grouped |
| `span`/`layout` | **Exists, underused** | Works, populated by heuristic mostly | No new field needed; existing `inferSpan` heuristics are sound, just rarely overridden by authored `layout.span` |
| Row-level metadata (tags on table rows preserved as structured data, not baked into a display string) | **Should exist at the raw-data level, not the manifest level** | Extraction-time fix | The extraction step should preserve `{sku, name, old, nu, ...}` as *raw* fields alongside (or instead of) the formatted display strings, so any block downstream (table, card, list) can choose its own formatting rather than inheriting a pre-baked string |

**Target: the smallest clean schema addition is one new field — `dependencies` (or `controls`) — plus an extraction-time change (capture raw values + control bounds, not just formatted display strings) — rather than the full 13-field list in the brief.** Most of the brief's candidate fields are already present or deliberately, correctly rejected.

---

## 15. Cross-Screen Generalization Analysis

Generic rules **present** today (workflow-agnostic, shape-driven):
- Uniform ≥3-scalar-column record → `table` candidate (`classifyBlocks.js:382-392`)
- `{min,max,value}` object → `slider` candidate (`isSliderShaped`)
- ≥80% column-key overlap with a sibling table → suppress as descriptor (`findMetadataDescriptorSlots`)
- Vocabulary-keyed hero/section assignment (a generic mechanism, even though its vocabulary list is narrow)

Generic rules **missing**, all statable without any workflow-code branch (per §7):
- Identity-field generalization: accept any string-typed, near-unique-per-row key as equivalent to `label` for table/chart promotion purposes, not only a key literally named `label`.
- Uncertainty-band pairing: two sibling numeric keys matching a `p<50`/`p>50` or `lo`/`hi`/`min`/`max` naming pattern → one composite range cell.
- Gauge/threshold detection: a `value`/`pct` key with a sibling `limit`/`ceiling`/`floor`/`threshold`-named key → gauge, not plain metric or table.
- Prose-density bias: rows dominated by long free-text fields bias toward card/list; rows dominated by short numeric/categorical fields bias toward table — reusing `blockSizing.js`'s existing prose-length computation, currently only wired to *span*, not *type*.
- Nested-control-in-row detection: a nested array of ≤4 `{label, ...}`-shaped items inside a table row → inline segmented control cell.
- Control-dependency detection: (extraction-time, not classification-time) trace which sibling data keys change when a reference's own interactive function is invoked at different input values, and record that as a `dependencies` manifest field.

None of these require `if (workflow === "X")` — all operate purely on shape/key-name/statistical signals, matching the brief's explicit requirement.

---

## 16. False Fixes / Anti-Patterns

Explicitly rejected, with why each would damage scalability:

- **Workflow-specific conditionals (`if (code === "S9.11")`)** — defeats the entire premise of a shared rendering engine; every new workflow would need bespoke code, and the 26-workflow (and growing) fixture set would become an ever-larger pile of special cases.
- **S9.11-specific renderer/component** — duplicates the block registry per screen; any generic classifier/composition improvement would then need to be re-applied to every bespoke component individually.
- **Hardcoded SKU names or column lists per workflow** — breaks the moment the underlying data changes shape even slightly (a new column, a renamed field); the entire value of shape-driven classification is lost.
- **Arbitrary CSS overrides per screen** — the fixed shell/token system is intentionally universal; per-screen CSS overrides would fragment the design system exactly as `AUDIT_REPORT.md`'s prior findings on token/card-shape duplication already warned against.
- **Manually positioned blocks (pixel/absolute placement)** — breaks whenever fixture data changes row/item count; the whole point of `composeSections.js`'s heuristic span/grid system is to avoid this.
- **Screenshot-specific pixel matching** — explicitly out of scope per the brief; the reference screens are compositional exemplars, not pixel targets.
- **Duplicating reference HTML into React 1:1** — reintroduces exactly the static-mockup problem the dynamic engine was built to replace; 228 bespoke components instead of 13 generic ones.
- **One component per screen** — same failure mode as the above two, at the component-tree level instead of the markup level.
- **Forcing all arrays into tables** — would fix the 7 false negatives in §8 by creating far more false positives (the existing 18 over-classifications would balloon); the fix must be a better *discriminating* rule, not removal of discrimination.
- **Forcing all `{label,value}` into cards** — symmetric anti-pattern; would break the 10 confirmed correct table classifications.
- **Hardcoding layout based on workflow code** — same failure mode as the first item, at the layout layer.

---

## 17. Target Production Architecture

```
BACKEND / FIXTURE DATA
        │  (extraction MUST capture raw record fields + control bounds,
        │   not only a snapshot of already-formatted display output)
        ▼
DATA NORMALIZATION
        │  preserve raw numeric/string fields per row; detect uncertainty-band
        │  pairs, identity fields, nested sub-controls; do NOT pre-join into
        │  display strings before classification runs
        ▼
SEMANTIC CLASSIFIER
        │  generalized identity-field rule (not literal `label` only);
        │  gauge/threshold detection; prose-density bias feeding block TYPE
        │  (not just span); nested-control detection inside table rows;
        │  deterministic tie-breaking so identical shapes classify identically
        │  across workflows
        ▼
   SCREEN MANIFEST
        │  adds ONE new field: `dependencies`/`controls` (which slotNames a
        │  control-classified block affects) — populated at generation time
        │  by tracing the reference's own reactive function, or by re-running
        │  extraction at multiple control positions and diffing outputs
        │
   ┌────┴────┐
   ▼         ▼
COMPOSITION   VALIDATION
MODEL         (existing validateManifest.js, extended for the new field)
   │
   ▼
LAYOUT ENGINE
        │  existing 12-col/span/rail mechanics are sound; feed them richer,
        │  less-coarse section assignments (more than 2 buckets/stage where
        │  the reference has 6-9 panels); make rail cardinality vary by stage
        ▼
BLOCK REGISTRY
        │  existing 13-type registry is sound; add: inline segmented-control
        │  cell (for nested row-level toggles), gauge/meter primitive (or
        │  reuse an extended labelValueList variant), composite range cell
        ▼
UI PRIMITIVES → FINAL SCREEN
```

**What remains fixed:** shell, typography, tokens, card primitive, section container, 12-column grid mechanics, block registry's *rendering* logic for existing 13 types.
**What becomes more dynamic:** classification accuracy/determinism (§8, §12), section granularity (§10), control-dependency wiring (§9, §11) — via one new schema field, not new fixed logic per workflow.
**What's inferred:** table-vs-card-vs-list decision (richer generic rules, §7/§15), hero/rationale grouping (generalize beyond the 4-name vocabulary), gauge/uncertainty-band/nested-control detection.
**What requires manifest metadata:** the new `dependencies` field; per-column `role` tags (`"tag"`, `"action"`) for table columns once raw records survive extraction.
**What requires backend/extraction-level metadata:** control bounds (min/max/step/unit) — genuinely unrecoverable from a single data snapshot; must be captured directly from the reference's own control markup or from re-running its logic at multiple input positions.

---

## 18. Architecture Diagram

```
REFERENCE HTML (S9.11-3-decide.dc.html)
     │
     ├── Fixed Shell ─────────────── (matched 1:1 by current Shell.jsx/StepTracker.jsx — NOT where the gap is)
     │      ├── Header
     │      ├── Sidebar
     │      ├── Typography
     │      └── Tokens
     │
     └── Semantic Content (renderVals() closure — ONE reactive function)
            │
            ├── Hero + Slider ──────────────┐
            ├── Table (Price slate) ────────┤  <── all derived from `this.state.tol`
            ├── Ladder (rail) ───────────────┤      in the reference; NO equivalent
            ├── Live stats ──────────────────┤      relationship exists anywhere in
            └── Approval gate ───────────────┘      the current pipeline
                    │
                    ▼  ***** EXTRACTION *****  ← DIVERGENCE POINT #1
                    │  captures renderVals()'s formatted OUTPUT only;
                    │  never the <input min/max/step> attributes;
                    │  never SLATE()'s raw numeric fields
                    ▼
             decide.json: { tol: 4, slate: [{...pre-formatted strings...}] }
                    │
                    ▼  ***** CLASSIFICATION *****  ← DIVERGENCE POINT #2
                    │  tol → 'number' (bare scalar, isSliderShaped unreachable)
                    │  slate → label-gated branches all skipped (no `label` key,
                    │           has `name` instead) → false-positive 'barChart'
                    │           via the `pct` field
                    ▼
             S9.11.json: { tol:number, slate:barChart }  (2 unrelated blocks)
                    │
                    ▼  ***** COMPOSITION MODEL *****  ← DIVERGENCE POINT #3
                    │  no `dependencies` field exists; nothing could express
                    │  "tol controls slate" even if classification were fixed
                    ▼
              LAYOUT ENGINE  (sound, but has nothing useful to lay out together)
                    │
                    ▼
               UI RENDERER
                    │
                    ▼
        Static "4" number card  +  bare 9-bar chart, x-labels "1".."9",
        SKU/price/loss/P10-P90/CM/confidence/tag/Roll-Test-toggle ALL LOST
```

---

## 19. P0/P1/P2/P3 Gap Table

| # | Gap | Priority | Category |
|---|---|---|---|
| 1 | Extraction snapshots formatted display output, not raw records/control bounds | **P0** | DATA |
| 2 | Slider bounds (min/max/step) never captured from reference markup | **P0** | DATA / BACKEND CONTRACT |
| 3 | Table-promotion classification gated on literal `label` key, missing `name`/`sku`/identity-field equivalents | **P0** | CLASSIFICATION |
| 4 | 18 confirmed false-positive `table` classifications (card grids, radio-pickers, meter lists) | **P1** | CLASSIFICATION |
| 5 | No manifest field expresses control→dependent-block relationships | **P1** | MANIFEST / ARCHITECTURE |
| 6 | Composition is a flat block list except one hardcoded 4-slot hero vocabulary | **P1** | COMPOSITION |
| 7 | Section/region granularity frequently collapses 6-9 reference panels into 2 buckets | **P1** | COMPOSITION / LAYOUT |
| 8 | Identical data shapes classify inconsistently across workflows (non-deterministic) | **P1** | CLASSIFICATION |
| 9 | Rail cardinality fixed at one panel shape regardless of stage's actual panel count | **P2** | LAYOUT |
| 10 | No row-level actions/tags concept for tables | **P2** | MANIFEST / RENDERING |
| 11 | No nested-control-in-row detection (per-row Roll/Test-style toggles) | **P2** | CLASSIFICATION / RENDERING |
| 12 | No gauge/threshold detection (limit/ceiling/floor-adjacent value fields) | **P2** | CLASSIFICATION |
| 13 | `extraction/audit.js` tooling doesn't understand newer suppression rules, producing stale false-positive counts | **P3** | TESTING |
| 14 | Charts have no authored interactivity (click-to-drill, cross-filter) beyond hover tooltip | **P3** | RENDERING / INTERACTION |
| 15 | Wide operational tables (6+ columns) still width-constrained in the main column | **P3** | LAYOUT / DESIGN SYSTEM |

---

## 20. Exact Files / Modules Responsible for Each Gap

| Gap # | File(s) : responsibility |
|---|---|
| 1, 2 | `extraction/extract.js` (`extractOne`, orchestration), `extraction/parseMockup.js` (`extractDcScriptTag`, `parseDataProps`), `extraction/dcLogicSandbox.js` (`runScreenScript` — executes `renderVals()` once; would need to also read control markup / re-invoke at multiple states) |
| 3, 4, 8 | `extraction/classifyBlocks.js:207-426` (`classifyBlockType` and its shape-predicate helpers `isBarChartShaped`, `isLabeledScatterShaped`, the L347-352 promotion rule, L382-392 plain-table rule, `hasConsistentMagnitudeUnits`) |
| 5, 6 | `src/features/action-stories/manifests/validateManifest.js` (schema), `extraction/generateManifests.js:41-117` (`buildStageManifest` — where a new `dependencies` field would be populated), `src/features/action-stories/components/StageRenderer.jsx:74-106` (the existing but unexercised `overrides` mechanism) |
| 7 | `extraction/classifyBlocks.js:683-763` (`planSections`, `SECTION_ORDER`, vocabulary tables `HERO_SLOT_NAMES`/`ROLLUP_KEYS`/`PROVENANCE_KEYS`) |
| 9 | `src/features/action-stories/components/StageSections.jsx:168-188` (`RailPanel` — single shape for all rail content) |
| 10, 11 | `src/features/action-stories/blocks/TableBlock.jsx`, `src/features/action-stories/blocks/index.js` (registry — would need a new inline-control cell type) |
| 12 | `extraction/classifyBlocks.js` (no current gauge predicate exists; would sit alongside `isBarChartShaped` et al.) |
| 13 | `extraction/audit.js` |
| 14 | `src/features/action-stories/blocks/BarChartBlock.jsx`, `LineChartBlock.jsx`, `ScatterChartBlock.jsx`, `WaterfallChartBlock.jsx`, `HeatmapGridBlock.jsx` |
| 15 | `src/features/action-stories/blocks/TableBlock.jsx` (scroll-shadow exists, width tension not resolved), design-system token layer |

---

## 21. Recommended Fix Sequence

*(Sequencing only — no implementation performed in this audit.)*

1. **Extraction rework (P0, unblocks everything else):** capture raw record fields alongside (or instead of) formatted display strings; capture interactive-control attributes (`min`/`max`/`step`/`unit`) directly from reference markup; where feasible, re-invoke the reference's reactive function at 2-3 representative control positions to diff which output keys change (this diff becomes the `dependencies` data).
2. **Classifier generalization (P0/P1):** broaden the identity-field gate beyond literal `label`; add gauge/threshold and nested-control-in-row predicates; add a prose-density bias to the type decision (not just span); add cross-workflow determinism for identical shapes.
3. **Schema addition (P1):** add `dependencies`/`controls` field to the manifest block schema and `validateManifest.js`; extend `generateManifests.js` to populate it from step 1's diff output.
4. **Composition/section granularity (P1):** revisit `planSections`'s vocabulary/shape rules to produce more than 2 buckets per stage where the reference structurally has more; generalize the hero-group mechanism beyond its 4-name vocabulary into a rule keyed on the new `dependencies`/grouping signal.
5. **Rendering additions (P2):** new inline segmented-control cell type for nested per-row toggles; gauge/meter primitive; row-level action/tag column role.
6. **Layout refinement (P2/P3):** allow rail cardinality to vary by stage; revisit wide-table width handling.
7. **Tooling catch-up (P3):** update `extraction/audit.js` to understand current suppression rules and the new fields, so its reports stop showing stale false positives.

Re-validate against the full 228-screen reference set (not just the 34+22 sampled here) after steps 1-4, since those are the steps most likely to change classification outcomes broadly.

---

## 22. Definition of Done

- **Table coverage:** ≥90% true-positive rate on genuine reference tables (from 59%), with false-positive rate on non-table structures reduced to near zero, measured against a re-run of the same 22+34-screen sample used in this audit.
- **Slider/control:** at least the 3 known reference sliders (S9.11, S9.2, S9.12 decide stages) produce a real `{min,max,value}` shape in their fixtures and render as an interactive `SliderBlock`.
- **Dependency wiring:** at least one end-to-end case (S9.11/decide) demonstrates a control-classified block's `dependencies` field correctly identifying its affected sibling blocks, with the composition layer visually/structurally grouping them.
- **Section granularity:** no stage manifest collapses more than ~2:1 reference-panels-to-manifest-sections without a documented reason (currently several stages are 6-9:2).
- **Determinism:** the same `{label,value}`-family shape classifies identically regardless of which workflow/stage it appears in, verified by re-running `extraction/audit-report.md`'s own consistency check with zero remaining cross-workflow splits for identical signatures.
- **No workflow-specific conditionals** introduced anywhere in `classifyBlocks.js`, `generateManifests.js`, `composeSections.js`, or any block component, verified by code review against the anti-pattern list in §16.
- **Full-corpus re-audit:** this report's methodology re-run against all 228 reference screens (not the ~56 sampled here) shows the same or better numbers, confirming the fixes generalize rather than having been tuned to the sample.

---

## 23. Most Important Final Question

**"Why can the current template render dynamic data but still fail to reproduce the reference screen's layout and information architecture?"**

Because the system's dynamism is real but narrow: it correctly maps a resolved JSON value to one of 13 block components and packs that block into a 12-column grid. But the reference screens' actual information architecture lives in three places this system doesn't reach: (1) the *raw, unformatted* data model and interactive-control bounds, which the extraction step discards in favor of a single formatted-output snapshot; (2) the *classification signal set*, which is narrower than the real variety of record shapes in the reference (gated on a literal `label` key, blind to gauges/nested controls/prose density); and (3) the *relationship* between blocks, which has no schema representation beyond one hardcoded 4-slot hero exception. A renderer can be arbitrarily good at "value → block type → grid cell" and still fail to reproduce a reference screen whose actual design intent is "this control scopes that table" — because that intent was never data that reached the renderer in the first place.

**"What is the minimum architectural capability so a NEW workflow with NEW data can automatically choose an appropriate composition without workflow-specific code?"**

Three generic capabilities, in priority order: (a) an extraction step that preserves raw record fields and control bounds rather than only formatted display output; (b) a classifier whose table/chart/list/gauge/control decision rules key on general shape/naming signals (identity-like fields, uncertainty-band pairs, threshold-adjacent fields, nested control arrays) rather than one literal key name; (c) one new manifest field (`dependencies`) that lets a control-classified block declare which sibling blocks it affects, populated automatically at generation time by diffing the reference's own reactive output across a few sampled control positions — not authored per workflow.

**"Which parts of the reference are genuinely fixed template design, and which parts must become dynamically composable?"**

Genuinely fixed: the shell (icon rail, header, breadcrumb/step-tracker), typography/spacing/color tokens, the card/section primitives, and the 12-column grid mechanics themselves. Genuinely and necessarily dynamic: block-type selection (already present, needs broader signals), section/region assignment at finer granularity than today's 2-bucket collapse, span/grouping (schema exists, needs generalizing beyond one vocabulary case), and — the single biggest missing capability — the control-to-dependent-content relationship, which is not optional polish but the literal subject of every reference Decide screen sampled in this audit.

---

## 24. Audit-Only Confirmation

No source file, manifest, CSS rule, or classification rule was modified during this investigation. All findings above are sourced from direct reads of the reference `.dc.html` files (extracted from `Realify Workspace Dashboard Build 2.zip`) and the current repository's `extraction/`, `src/features/action-stories/`, and pre-existing root-level `.md` audit reports, as cited throughout. This document is the complete deliverable of the audit phase; implementation is out of scope for this pass.
