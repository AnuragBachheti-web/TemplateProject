# Forensic Audit — Why Action Stories Cannot Currently Reproduce the Reference

**Scope:** diagnosis only. No code, manifest, CSS, or component was modified to produce this report.
**Representative trace:** S9.1 "Assortment" (reason → analyze → decide → execute), cross-checked against all 26 workflows / 105 stage manifests where a claim is generic.
**Sources inspected directly:** `source-mockups/S9.1-{1..4}-*.dc.html` (reference, byte-identical to the user-supplied `Realify Workspace Dashboard Build.zip`, verified via `diff`), `src/features/action-stories/data/raw/S9.1/*.json`, `src/features/action-stories/manifests/S9.1.json`, `extraction/{extract,parseMockup,dcLogicSandbox,generateManifests,classifyBlocks}.js`, `src/features/action-stories/manifests/{resolveBinding,blockTypes,validateManifest}.js`, `src/features/action-stories/components/{StageRenderer,StageSections,Shell,StagePage,StageActionBar}.jsx`, `src/features/action-stories/layout/{composeSections,heroSlot,gridEligibility,compactSlots}.js`, `src/features/action-stories/blocks/{BlockCard,TableBlock,LabelValueListBlock}.jsx`, `tailwind.config.js`, `src/styles/realify-tokens.css`. Prior in-repo audits (`AUDIT_REPORT.md`, `UI_QUALITY_AUDIT.md`, `UI_REDESIGN_REPORT.md`, `PROJECT_GUIDE.md`, `INTEGRATION.md`, `manifests/REPORT.md`, `extraction/audit-report.md`) were read and cross-checked, not trusted blindly — divergences are called out explicitly below.

No user-supplied "current app screenshot" image was attached to this conversation to inspect directly; the Chrome extension needed to capture a live screenshot was not connected in this environment either. Every finding below is instead proven from the source code that produces the rendering (manifest → classifier → renderer → CSS), which is a stronger form of evidence for a "why" question than a screenshot would be, but is disclosed as a gap against the brief's request for direct current-screenshot inspection.

---

## 1. Executive summary

The reference cannot currently be reproduced by a **combination of causes (answer L)**, but they are not evenly weighted. In order of how much of the gap each one explains for S9.1:

1. **Manifest structure + block classification (C/F) is the dominant cause.** The manifest's `sectionIdFor` rule (`extraction/classifyBlocks.js:544-550`) assigns a block to `summary`/`analysis`/`details`/`guardrails` purely by its **classified blockType shape** (scalar → `summary`, chart → `analysis`, else → `details`), with zero awareness of what the field actually means. This single rule is provably responsible for the single worst fidelity gap found: the Decide stage's **hero recommendation headline** (`heroTitle`/`heroSub` — the reference's actual primary content, occupying a large main-column panel in the mockup) is classified `blockType: "text"` → routed to section `summary` → hardcoded into the **300px rail** (`RAIL_SECTION_IDS`, `compactSlots.js:9`) alongside Guardrails, because `summary` is treated as inherently secondary content for every workflow, unconditionally.
2. **Data extraction (D) permanently discarded one real reference field.** The reference's per-instance headline ("Quarterly assortment review — 214 active SKUs" — present, unchanged, in all 4 stages) is a literal string in the mockup's static markup, not inside its `renderVals()` script. The extraction tool's only markup-scraping function, `extractBreadcrumbName` (`extraction/parseMockup.js:135-140`), regexes for the *adjacent but different* `>NAME · CODE<` badge and never touches this sibling element. The instance headline exists **nowhere** in raw JSON, the manifest, or the app — confirmed absent by direct grep.
3. **Renderer/layout composition (G/H) is real but narrow.** A genuine composition layer exists (`composeSections.js` + `StageSections.jsx`: sections, grid-rows, a main/rail split matching the reference's `1fr 320px` proportion almost exactly) — this is **not** "render a flat array of blocks." But the only signal that ever triggers grouping in production is a blunt type/size heuristic (`isGridEligible`: text/number/flag/small-object only); the declarative escape hatch for richer authored grouping (`block.layout.group`) exists in code but is used by **0 of 1,760 blocks** across all 26 workflows.
4. **The manifest is not incapable of description — it is capable of correctly reproducing the reference's actual data**, just not its actual layout, because block granularity is atomized down to individual UI microcopy strings (button labels, icons) as first-class content blocks, with no field expressing "these N fields are one panel."
5. Pure CSS/visual issues (D-level typography/token application) are a small, secondary contributor, not the driver of the gap — several are already correct or already a deliberate, documented divergence (see §22).

**None of this is a missing-data problem in the sense of "the backend doesn't have it."** Every number, table, chart point and guardrail rule the reference shows for S9.1 (except the one headline literal above) is present, unmangled, in `data/raw/S9.1/*.json` today. The failure is entirely in what the pipeline does with that data on the way to the screen.

---

## 2. Current UI failure summary (code-derived, no live screenshot available — see caveat above)

Symptoms provable directly from the render code, without needing a screenshot:

- The Decide stage's headline recommendation (`heroTitle`) renders as a plain rail row, not a page-dominant hero panel — proven via the classification chain in §1.1 and confirmed against the actual reference layout in §5.
- Every `table`/`itemQueue`/`labelValueList`/chart/slider block not caught by the narrow scalar-adjacency heuristic renders as its own full-width bordered `BlockCard`, stacked vertically — proven mechanically in §11.
- Page content is capped at `max-w-[1280px]` (`StagePage.jsx:65`, duplicated in `StageActionBar.jsx:30`) — **narrower than the reference's own native 1440px canvas** — inside a viewport that already lost 240px to the sidebar, producing growing dead margins at ≥1536px viewports. Proven in §12.
- The page `<h1>` shows only the workflow/category name ("Assortment"), identically in the sidebar, the chip above it, and the heading itself — three renderings of one field, never the reference's distinct per-instance headline, which was never extracted. Proven in §6.

---

## 3. Data availability verdict

**PARTIALLY — the underlying data is materially sufficient for S9.1, with one proven, isolated extraction gap and one proven, isolated data-model-scope gap.** See Question 1 for the full evidence-backed answer.

---

## 4. Complete S9.1 end-to-end trace

### Pipeline mechanics (how a raw fixture is produced at all)

```
source-mockups/S9.1-{1,2,3,4}-*.dc.html   (reference; identical to Realify Workspace Dashboard Build.zip)
   │  extractDcScriptTag() / parseDataProps()          (extraction/parseMockup.js:65-110)
   │  runScreenScript(scriptBody, propsDefaults)         (extraction/dcLogicSandbox.js:97-121)
   │    → runs the mockup's own `class Component extends DCLogic` in a Node vm sandbox
   │    → captures { state: instance.state, data: instance.renderVals() }
   │    → deepFlattenJsxNodes() flattens any JSX-stub badge node to plain text first
   ▼
data/raw/S9.1/{reason,analyze,decide,execute}.json    ({ code, stageKey, name, props, state, data })
   │  buildStageManifest() destructures ONLY { code, stageKey, name, data }  (generateManifests.js:42)
   │    → props and state are structurally never read — see §17, Example 2
   │  planSlotNames() + classifyBlockType() per data.<key>   (classifyBlocks.js)
   │  planSections() groups slots into {guardrails,summary,analysis,details} IF ≥9 blocks & ≥2 buckets used
   ▼
manifests/S9.1.json   ([{ code, name, stageKey, sections?, blocks:[{slotName,blockType,binding,section?}] }])
   │  resolveBinding(block.binding, fixture)   (manifests/resolveBinding.js:15-30 — no defaults, no formatting)
   │  validateBlockData(blockType, value)      (manifests/blockTypes.js — optional-field-shaped checks only)
   ▼
StageRenderer.jsx: resolve/validate every block (pass 1) → composeSections() groups into sections/rows (pass 2 metadata)
   → StageSections.jsx: renders rail (guardrails/summary, hardcoded ids) vs main (analysis/details/unsectioned)
   → each block component (TextBlock, TableBlock, …) wraps itself in BlockCard unless `compact`
   ▼
Rendered stage page
```

### Stage-by-stage: what exists, what survives, what is displayed

**REASON** (`data/raw/S9.1/reason.json`, `manifests/S9.1.json` lines 1-33 — no `sections`, 5 blocks, below the 9-block threshold):

| Raw field | Manifest block | Verdict |
|---|---|---|
| `data.dialNote` (rationale narrative) | `rationale` / `text` | unchanged, renamed via `PRIORITY_GROUPS` priority match |
| `data.policy[]` (3 guardrail rules incl. `why` explanation) | `policy` / `labelValueList` | unchanged, full array bound incl. `why` |
| `data.roles[]` (6-role legend: name/count/hue/tint/def) | `roles` / **table** | unchanged values; `hue`/`tint` stripped as decorative before classification |
| `data.inputs[]` (5 data sources) | `inputs` / `labelValueList` | unchanged |
| `data.execSegs` (pure `{bg:"var(--ink-400)"}` style array) | *(no block)* | correctly dropped — `isPureStyleValue` |
| `props.executionMode`, `state` (`{}`) | *(no block, ever)* | out of scope by construction — `generateManifests.js:42` never reads `props`/`state` |
| **Reference's instance headline** "Quarterly assortment review — 214 active SKUs" (mockup line 134, static markup) | **absent from raw JSON entirely** | never extracted — `extractBreadcrumbName` only captures the sibling `>NAME · CODE<` badge (line 131), a different DOM node |

**ANALYZE** (manifests/S9.1.json lines 34-75 — no `sections`, 7 blocks):

| Raw field | Manifest block | Verdict |
|---|---|---|
| `data.rows[]` (10-SKU performance table, 7 cols) | `rows` / `table` | unchanged |
| `data.points[]` (117 scatter points) | `points` / `scatterChart` | unchanged |
| `data.roles` (SAME slotName as Reason, shape now `{name,hue}` only) | `roles` / **itemQueue** | different blockType than Reason's `roles`, purely because the raw shape differs stage-to-stage (proof in §8) |
| `data.movement[]` (4 role-migration deltas) | `movement` / `barChart` | classified as chart via unit-consistency rule |
| `data.cols[]` (7 column-header descriptors, metadata *for* `rows`) | `cols` / `labelValueList` | rendered as an independent content block, disconnected from the `rows` table it labels |
| Guardrail/policy content | *(never existed in this stage's raw data at all)* | not a rendering gap — this stage's reference screen also carries none |

**DECIDE** (manifests/S9.1.json lines 76-238 — **`sections` present**: guardrails/summary/analysis/details, 23 blocks):

| Raw field | Manifest block + section | Verdict |
|---|---|---|
| `data.heroTitle` ("Keep 162 · grow 18 · reduce 22 · exit 12…") | `heroTitle` / `text` / **section: summary → rail** | **content preserved, position wrong** — reference renders this as the dominant main-column hero headline; current app renders it as one line inside the 300px rail |
| `data.heroSub` | `heroSub` / `text` / section: summary → rail | same misplacement |
| `data.heroMetrics[]` (3 metrics, all currency unit) | `heroMetrics` / `barChart` / section: analysis → main | correctly grouped as one chart block, correctly placed in main column |
| `data.checks[]` (3 guardrail rules, mixed units: ratio/currency/percent) | `guardrail_checks` / `labelValueList` / guardrails → rail | correctly NOT classified as a chart (unit-consistency guard fires correctly here) |
| `data.groups[]` (4 decision cohorts w/ full narrative `detail` + $ deltas) | `groups` / `table` / details → main | unchanged values; a decision-narrative field and numeric columns are structurally indistinguishable to the table classifier |
| `state.slate`, `state.focus` (which scenario/row is selected) | *(no block, ever — `state` is out of scope by construction)* | UI-selection state permanently invisible to the manifest layer |
| `confTint`, `confTone`, `footTone` | *(dropped)* | correctly filtered as pure CSS-var style strings |

**EXECUTE** (manifests/S9.1.json lines 239-357 — `sections` present: summary/details, 17 blocks):

| Raw field | Manifest block + section | Verdict |
|---|---|---|
| `data.dests[]` (4 destination push cards, each with before/after diffs) | `dests` / `itemQueue` / details → main | unchanged |
| `data.watches[]` (guardrail monitoring rules w/ full narrative `action` text) | `watches` / `table` / details → main | same table/itemQueue narrative-vs-numeric collision as Decide's `groups` |
| `data.progressRows[]` | `progressRows` / `labelValueList` / summary → rail | plausible placement (this content genuinely is a progress summary) |
| `state.pushed/busy/armed/restored` (live push/arm/rollback UI state) | *(no block, ever)* | out of scope by construction |

---

## 5. Reference → current data comparison (Decide stage — the highest-signal example)

**Reference `S9.1-3-decide.dc.html` (verified directly, lines 202-243):**
The main column's *first and dominant* element is one large bordered/shadowed panel (`box-shadow:var(--shadow-sm)`) that fuses, in a single visual unit: an eyebrow ("Recommended portfolio move"), the slate name + confidence chip, `heroTitle` (15px+ bold headline), `heroSub`, a 3-column metrics grid (`heroMetrics`), a proportional move-mix bar (`moveBar`), a legend row, and a basis footnote — **one composed hero card**, not eight separate facts. The rail, by contrast, holds four genuinely separate bordered cards (Live totals / Policy check / Held-out-of-exit-pool / Confidence basis).

**Current app, same stage, same data:**
`heroTitle`, `heroSub` → classified `text` → section `summary` → `RAIL_SECTION_IDS` sends the whole `summary` section to the **300px rail**, rendered as bare label/value rows inside one shared `RailPanel` alongside guardrail-adjacent scalars (`slateName`, `confLabel`, `approvedCount`, `toggleAllLabel`, `focusTitle`, `focusMeta`, `focusFooter`, `policyStatus`, `footStatus` — 12 scalar text blocks in total land in this one section). `heroMetrics` (classified `barChart`, section `analysis`) and `moveBar` (classified `labelValueList`, section `details`) end up in **different sections of the main column, in different visual containers**, not fused with `heroTitle` at all. The reference's single hero panel is thus split, by the pipeline, into: a rail row (headline), a separate main-column chart card (metrics), and a separate main-column list card (move bar) — three disconnected fragments instead of one composed panel, and the two most textually important fragments (the actual headline and subhead) end up in the narrowest, most visually secondary part of the page.

1. **Reference title:** small badge "Assortment · S9.1" + separate 15px/700-weight instance line "Quarterly assortment review — 214 active SKUs" (constant across all 4 stages).
2. **Reference summary/insight:** Decide-stage `heroTitle`/`heroSub`, main-column hero card.
3. **Reference supporting information:** the hero card's basis footnote; the rail's "Confidence basis" list.
4. **Reference metrics:** `heroMetrics` (3-up grid), inside the same hero card.
5. **Reference tables/lists:** move-set groups, focus SKU table, alternative-slates picker.
6. **Reference charts:** the proportional move-mix bar, inside the hero card (not a separate panel).
7. **Reference guardrails:** "Policy check" rail panel with 3 progress-bar rows + a conditional blocked-banner.
8. **Reference decision/action information:** approve/reject toggles per group, slate picker, `ctaLabel` CTA, blocked state.

Then, what the current pipeline actually produces:
1. **Data that currently exists:** all of the above except item 1's instance headline (§4).
2. **What the manifest contains:** all of items 2–8 as individual `{slotName,blockType,binding,section}` entries — correct values, wrong grouping/placement for items 2 and 6.
3. **What the renderer receives:** per-block resolved values plus a `section` string; no concept that items 2, 4, 6, and the basis footnote were ever one authored unit.
4. **What is actually displayed:** item 2 as bare rail text; item 4 as a separate main-column chart card; item 6 as a separate main-column list card; items 3/5/7/8 roughly matching reference intent.

---

## 6. Action Story identity/title analysis

**Data model (`data/index.json`, every one of 26 entries, e.g. lines 2-11):**
```json
{ "code": "S9.1", "name": "Assortment", "stages": ["reason","analyze","decide","execute"] }
```
One string field, `name`. `manifests/S9.1.json` repeats the identical value at every stage (lines 4, 36, 78, 240). `validateManifest.js:31-33` enforces `name` as a required non-empty string; there is no `title`/`headline` key in the schema, checked or unchecked.

**Sidebar** — `Shell.jsx:138`: `<span className="truncate">{wf.name}</span>`, `wf` sourced from `getWorkflowIndex()` ← `data/index.json`.

**Page `<h1>`** — `StagePage.jsx:91-96`: `{workflow?.name || manifest.name}` — the *same* `name` string, and the *same* expression is used one block above it for the chip (`StagePage.jsx:82`). Sidebar, chip, and `<h1>` are three renderings of the identical field.

**Breadcrumb** — `StagePage.jsx:66-75`: `Action Stories → {code} → {stageLabel}` (e.g. `S9.1 → Reason`) — never shows `name` at all.

**The one place a per-instance string does appear:** `heroSlot.js` (`pickHeroBlock`, lines 34-43) scans the manifest's blocks for the first slot named `rationale`/`primaryInsight`/`heroTitle` whose resolved value is a string ≥60 characters, and `StagePage.jsx:97` renders it as a subtitle under the `<h1>`. This is genuinely per-instance and dynamic — but it is fixture *content* picked by an opportunistic heuristic, not a schema field, and it is not guaranteed to exist or to match the reference's actual instance headline. **Concrete proof it does not, for S9.1/reason:** the reference shows "Quarterly assortment review — 214 active SKUs" in this position; the current app's `heroSlot` mechanism instead resolves `rationale` → `data.dialNote` → **"Realify will propose the move set and wait for you. Nothing reaches a channel without your approval."** — a real, correctly-sourced sentence, but not the reference's headline, because the reference's headline was never captured by extraction (§4, §17).

**Root cause chain for identity, file-by-file:**
`extraction/parseMockup.js:135-140` (`extractBreadcrumbName`) captures only the badge → `extraction/extract.js:82` writes it as the fixture's sole `name` → `extraction/generateManifests.js:87` copies it unchanged to the manifest → `Shell.jsx:138` / `StagePage.jsx:82,95` render the identical string three times. A second, distinct field for "per-instance headline" was never part of the schema at any stage of this chain — not because the reference lacks one, but because the extraction tool only ever looked at one markup element.

**Answer to the identity question:** the current app displays **(a) a workflow/category name** in the `<h1>`, sidebar, and chip — proven by three identical-expression citations above — with an ad hoc, non-guaranteed narrative sentence standing in for a subtitle. It is architecturally incapable of holding a second field for a genuine per-instance Action Story headline today (§6 of the identity trace: `data/index.json`, the manifest schema, and `validateManifest.js` all have room for exactly one identity string per code). **This is not a mixed/incorrect combination (d) — it is a real, provable single-field limitation (a), with the reference's actual second field never captured.**

The in-code comment at `StagePage.jsx:86-90` — *"The reference's own giant display-face title names the workflow… a fixed identity, verified against the reference source"* — is **contradicted by direct inspection of the reference**: there is no giant display-face title in the reference at all. The reference's only title-like text at that position is a 9px mono badge ("Assortment · S9.1") and a 15px/700-weight instance line — both far smaller than the app's invented 34px serif `<h1>`, and neither is "the workflow name alone, at giant size." This claim should be treated as unverified/incorrect, not as evidence the current implementation is intentionally faithful.

---

## 7. Manifest capability analysis

The manifest schema (enforced fields, `validateManifest.js:21-72`): `code`, `name`, `stageKey`, `blocks[]` (each `slotName`/`blockType`/`binding`, required). Optional, **unvalidated** fields: top-level `sections[{id,title}]`, per-block `section` (string), per-block `layout{group,span}`.

- **Layout declarative?** Partially. `layout.group`/`layout.span` exist as an escape hatch in `composeSections.js:31-33,54-56` but are used by **0 of 1,760 blocks** across all 26 workflows/105 stage manifests (confirmed by scan). All real grouping today runs through the generic `isGridEligible` heuristic.
- **Semantic sections?** No — `sectionIdFor` (`classifyBlocks.js:544-550`) assigns sections purely from `blockType`/slotName-prefix, never from what a field means. The same four section ids (`guardrails`/`summary`/`analysis`/`details`) are applied identically to every one of 26 workflows.
- **Block grouping?** Only the scalar/small-object adjacency heuristic; no mechanism groups a chart with its legend, or a headline with its supporting metrics, unless they happen to be adjacent scalars.
- **Primary/secondary content represented?** No — only the binary `RAIL_SECTION_IDS.has(section.id)` check, itself keyed to the same shape-driven section ids above.
- **Story identity/headline?** No — `name` is the only identity field, and it is workflow-level, not story-instance-level (§6).
- **Action metadata?** Partially — CTA label/guardrail blocked/canApprove flags exist as ordinary blocks (`guardrail_cta_label`, `guardrail_blocked`, `guardrail_can_approve`), correctly bound, but with no schema concept marking them as "the decision action" distinct from any other block.
- **Contextual rail content?** Only via the two hardcoded section ids, and only present at all when a stage has ≥9 blocks landing in ≥2 distinct shape-buckets (`MIN_BLOCKS_TO_SECTION = 9`, `classifyBlocks.js:536`) — Reason (5 blocks) and Analyze (7 blocks) get **no** section/rail structure at all, purely due to being "too small," regardless of whether their content has an obvious primary/secondary split.

**Is the manifest currently capable of describing the reference screen? Proven answer: NO, not as authored today** — not because a field is missing from the schema (`section`, `layout.group` already exist), but because **nothing in the generation pipeline ever populates them with real semantic intent** (0/1760 blocks use `layout.group`; `sectionIdFor` never reasons about meaning). The schema has the shape to hold more of the reference's composition; the generator that fills it in does not use that shape's full capability.

---

## 8. Classifier analysis

`classifyBlockType` (`classifyBlocks.js:282-386`) dispatches on the **runtime shape** of the raw value (array-of-paths → lineChart; anchor+height+value rows → waterfallChart; label+cells → heatmapGrid; label+consistent-unit-magnitude → barChart; label+x/y → scatterChart; plain label → labelValueList; ≥3 uniform scalar columns → table; else → itemQueue), plus exactly one field-name-based mechanism: a small `EXACT_KEY_OVERRIDES`/`PRIORITY_GROUPS` table that **renames slots**, never changes blockType.

**Proof of pure shape-driven, non-semantic classification (3 examples, S9.1's own data):**

| Raw data | Classified as | Why |
|---|---|---|
| `reason.data.roles` — `{name,count,hue,tint,def}` | `table` | after `hue`/`tint` stripped as decorative, 3 uniform scalar cols remain (name/count/def) → table rule fires |
| `analyze.data.roles` — **same slotName**, shape `{name,hue}` | `itemQueue` | only 1 meaningful column after stripping `hue` → fails the "≥3 columns" table rule → falls to itemQueue |
| `analyze.data.movement` — `{label,value,tone}`, all-currency-unit magnitudes | `barChart` | passes the label+consistent-magnitude-unit rule |

**Proof two semantically different concepts collapse into the identical blockType:**
`decide.data.groups` (decision/action cohorts, each with a full narrative `detail` sentence plus $ deltas) and `execute.data.watches` (guardrail monitoring rules, each with a full narrative `action` sentence) are **both** classified `table`, because the table rule's `allScalar` check (`classifyBlocks.js:349-351`) only asks `typeof item[k]` — a long policy sentence and a `"$5K"` number are structurally identical to it.

**Proof classification can hinge on incidental content, not deliberate shape:** `decide.data.slates` (3 scenario cards) and `decide.data.groups` (4 decision cohorts) are near-identical in intent, yet classify as `itemQueue` vs `table` respectively — traced to one slate row's `dotInner: "transparent"` not matching the decorative-value regex (kept as a "meaningful" column) while a sibling row's `dotInner: "var(--mod-discover)"` does match it (dropped) — making the rows' column-signatures non-uniform, which fails the `table` rule by accident.

**One place the classifier IS genuinely smart:** `hasConsistentMagnitudeUnits` (`classifyBlocks.js:157-168`) explicitly prevents `decide.data.checks` (mixed ratio/currency/percent units) from being misclassified as a bar chart, with the code's own comment naming exactly this risk ("a $440K capital-ceiling figure dwarfing a 2.31 GMROI ratio… is not 'bigger', it's a different unit entirely"). This is evidence the classifier's authors *did* reason about one specific semantic risk — just not about "does this represent a headline vs. microcopy vs. a policy rule."

`RAW → CLASSIFIED → EXPECTED REFERENCE PRESENTATION` (representative):
- `decide.data.heroTitle` → `text` → **expected: page-dominant hero headline**; actual: one rail row.
- `reason.data.roles` → `table` → **expected: a 2-column colored legend/framework card**; actual: a sortable, paginated generic data grid, with the role's color-hue meaning discarded.
- `decide.data.groups` → `table` → **expected: an approvable decision list with per-row toggle controls**; actual: a generic read-only data table (no toggle affordance is even representable — the toggle is UI-state the manifest layer can't see, see §17).

---

## 9. Renderer analysis

`StageRenderer.jsx` does **not** merely "iterate an array of blocks and render each" — it runs two real passes: resolve+validate every block, then delegate to `composeSections()` for section/row structure, then build JSX with correct `compact` awareness (lines 87-168). Real composition exists.

What it does **not** know, anywhere in `StageRenderer.jsx`/`composeSections.js`/`StageSections.jsx`:
- **Semantic importance** — no field ranks a block as more/less important than its neighbors; only `blockType` shape and section-id membership.
- **Primary vs. supporting content, as a concept independent of section id** — `RAIL_SECTION_IDS = new Set(['guardrails','summary'])` (`compactSlots.js:9`) is the entire model, applied identically to all 26 workflows regardless of what actually landed in "summary" for a given stage.
- **Story narrative** — the one exception is `heroSlot.js`, a separate, narrower mechanism that runs in `StagePage.jsx` *before* `StageRenderer` even executes, recognizing exactly three slot names.
- **Chart relationships** — nothing associates a chart with a caption/legend/related metric beyond manifest-declared adjacency.

`BlockCard` is applied independently by **13 separate block components**, not by a single central wrapper — every one of Text/Number/Flag/LabelValueList/ItemQueue/Object/Slider/Table/LineChart/BarChart/ScatterChart/WaterfallChart/HeatmapGrid renders its own `<BlockCard>` in its default branch. The only way multiple blocks ever end up in one shared visual container is the `compact` prop, itself gated on the same two narrow signals (grid-row adjacency, rail-section membership). Charts, tables, and sliders never implement a `compact` branch at all — they are **always** their own full card, unconditionally, regardless of what else is on the row.

`composeSections.js` computes a `span` value per grid item (`sanitizeSpan`, lines 24-28) that **`StageSections.jsx` never reads** — confirmed by inspection: only `row.items.length` drives column count (`WIDE_COLS_CLASS`, `StageSections.jsx:33,37`). This is dead code inside the one part of the system that does compute a semantic-ish weighting signal.

**Explicit root-architectural-limitation statement (as requested):** the renderer's only path to "multiple related facts, one shared panel" is a content-blind type/size heuristic plus a hardcoded two-string rail allowlist. It has no path at all for "these two charts are related," "this metric belongs with that headline," or "this content is more important than that content" — those relationships, when they matter (as they clearly do for the Decide-stage hero card), are not expressible in the current manifest→renderer contract, only accidentally reproducible when scalar-adjacency happens to coincide with authorial intent.

---

## 10. Layout engine analysis

Full trace: `manifest.blocks[]` order (preserved verbatim, `StageRenderer.jsx:102-103`) → tagged with `section`/`layout`/`forceFullWidth` (`StageRenderer.jsx:128-135`) → `composeSections()` buckets by `section`, then folds **adjacent same-key** items into `grid` rows within each bucket (`composeSections.js:70-90,108-130`) → `StageSections.jsx` renders: rail sections (`RAIL_SECTION_IDS`) as one shared bordered panel each (`RailPanel`, always single-column, `compactSlots` forced), main sections as a `flex flex-col gap-3` stack of either bare `single` divs or `GridPanel`s (`grid-cols-1…lg:grid-cols-{2,3,4}` based only on sibling count) → top-level `grid-cols-[minmax(0,1fr)_300px]` at `lg:` (`StageSections.jsx:98`).

- **Width** controlled by, in order: `StagePage.jsx:65` `max-w-[1280px]` (page), `StageSections.jsx:98` fixed `300px` rail column (section), `WIDE_COLS_CLASS` (`StageSections.jsx:33`, grid-row column count, capped at 4).
- **Height** controlled per-block-type: charts fix `h-56`/`h-64` (224/256px) regardless of data (`BarChartBlock.jsx:70`, `ScatterChartBlock.jsx:65`, `WaterfallChartBlock.jsx:50`, `LineChartBlock.jsx:64`); tables are unbounded below 12 rows, `max-h-[420px]` + pagination above it (`TableBlock.jsx:49,131`); `HeatmapGridBlock` scales column width, not Recharts-based, with actual data (`gridTemplateColumns: auto repeat(colCount, minmax(52px,1fr))`).
- **Ordering** is manifest-array order, full stop — no reordering logic beyond the fixed rail/main split.
- **Grouping** is `isGridEligible` (scalar/small-object types) plus the never-used `layout.group` escape hatch.
- **Main/rail composition** is the single binary `RAIL_SECTION_IDS` check, described above (§9).
- **Sections** exist mechanically (`sectionIdFor`), generically, identically for all 26 workflows.

**Can the current layout engine reproduce the supplied reference composition without workflow-specific hacks? Answer: NO.** Two independent, proven reasons:
1. The reference's Decide-stage main-column hero card fuses a headline, a metrics grid, and a proportional bar into one visual unit; the current pipeline's only grouping signal (scalar-adjacency) cannot span across a `text`+`barChart`+`labelValueList` triplet, and the declared-grouping escape hatch that could (`layout.group`) is populated nowhere in the data — reproducing this exact panel today requires either a manifest-authoring change (using the unused `layout.group` field, which is a data change, not a code change) or an engine change (teaching `sectionIdFor`/rail assignment to reason about content, not just shape) — the current engine cannot do it from its existing generic rules alone.
2. The reference's rail composition genuinely differs by stage (Reason/Analyze: one shared panel with dashed dividers; Decide/Execute: four separate bordered cards) — the current `StageSections.jsx` renders **exactly one** rail treatment (one shared panel per section id) for every workflow and stage, because the model only recognizes two rail-eligible section ids total. Reproducing four independent rail cards for Decide without a per-workflow special case requires a genuinely different section vocabulary/cardinality than exists today, not just a CSS tweak.

---

## 11. Card-wall root cause

Ranked by leverage, all four verified:

1. **BlockCard wrapping (mechanical, primary):** every block component (`TextBlock.jsx:51`, `TableBlock.jsx:130`, `BarChartBlock.jsx:68`, and 10 others) renders its own `<BlockCard>` unless `compact`; charts/tables/sliders have no `compact` branch at all — they are unconditionally a full card, forever, regardless of neighbors.
2. **Manifest granularity:** the Decide stage's `summary` section alone contains 12 separate scalar blocks, several of which are pure UI microcopy (`toggleAllLabel`, `pushAllIcon`, `armBtnIcon`, `restoreLabel`) modeled as first-class content blocks rather than component chrome — there is no authoring concept that groups "the button's label and the button's icon" as one non-content unit, let alone "this headline and its supporting metrics" as one content unit.
3. **The section/grouping model exists but its only real-world grouping signal is the scalar/small-object heuristic** — `layout.group`, the mechanism specifically built to let an author declare richer groupings, is present in code (`composeSections.js:31-33`) and used by zero of 1,760 real blocks. A hypothetical bug-free version of today's rules still produces one card per table/itemQueue/chart/labelValueList/object(>3 keys), because nothing ever instructs it otherwise.
4. **Rail compaction is gated on exact section-id string match** (`compactSlots.js:9`) — 20 of 105 stage manifests have no `sections` at all (below the 9-block threshold), so they get zero card-wall mitigation regardless of how many small scalar facts they contain, purely from stage size, not content.

**Concrete code path (S9.1 Decide's main column):** `groups`(table)/`focusRows`(table) each land as their own `single` row in the `details` section (no adjacent grid-eligible sibling of the same shape) → `MainRows` (`StageSections.jsx:56-57`) renders each as `<div>{nodesBySlot[...]}</div>` → each node is `TableBlock`'s own unconditional `<BlockCard padding="none">` → two consecutive full-bordered cards, the observed pattern.

---

## 12. Whitespace root cause

- **Page cap:** `StagePage.jsx:65` and `StageActionBar.jsx:30` both hardcode `max-w-[1280px]`, independently (duplicated magic number), while `realify-tokens.css:61` defines `--page-max: 1280px` **and that token is consumed nowhere in `src/`** (confirmed by repo-wide grep) — a dead token, duplicated as a literal instead.
- **Reference comparison:** the reference mockup's own canvas is a fixed `width:1440px` (`S9.1-3-decide.dc.html:29`), not a max-width-centered responsive layout — the current app's 1280px cap is narrower than the reference's own native width, not a faithful reproduction of it, before any sidebar is even subtracted.
- **Compounding factor (deliberate, documented, not a bug):** `Shell.jsx` uses a 240px full-text sidebar (`w-60`, line 195) vs. the reference's 68px icon-only rail (mockup line 31) — the code's own comment (`Shell.jsx:154-160`) explains this is intentional, since the app must list 26 workflow *instances* by name, a different navigational job than the reference's icon rail (which only switches product modules). This is a reasoned trade-off, not an oversight, but it does subtract real width before content starts.
- **Net effect:** at a 1920px monitor, 1920 − 240 (sidebar) − 1280 (page cap) = 400px of dead symmetric margin: growing, unbounded, and worsening at any wider display, because the cap is a fixed pixel value with no upper-viewport scaling rule.
- **Within the 1280px column itself:** the fixed `300px` rail (`StageSections.jsx:98`) plus `gap-5`/`px-6` shrinks the main column to ≈912px regardless of how much total width is actually available — a second, independent source of "the content area looks narrower than it should" that is not about the outer page cap at all.

---

## 13. Alignment root cause

No systemic alignment bug was found in the layout code read (grid/flex containers use standard Tailwind alignment utilities correctly; `lg:items-start` on the top-level grid, `items-center`/`items-baseline` used appropriately in individual block rows). The visible "poor alignment" impression a viewer might report is more likely a **density/whitespace consequence** (§12/§14) than a distinct alignment bug — small scalar values inside a narrow, over-subdivided grid column can look misaligned relative to the wide empty margins around the whole page without any single rule being wrong in isolation.

---

## 14. Spacing root cause

| Category | Exact source |
|---|---|
| Page spacing | `StagePage.jsx:66` header `px-6 pt-5`; `StageSections.jsx:98` body `px-6 py-5`; `StageActionBar.jsx:30` `px-6 py-3.5` |
| Section spacing | Main sections: `gap-5` (`StageSections.jsx:112`); rail panels: `gap-3` (`StageSections.jsx:105`); heading-to-rows: `gap-2.5` (`StageSections.jsx:115`) |
| Component/card padding | `BlockCard.jsx:17`: `compact`→`px-4 py-3`, `none`→`0` (Table manages its own), default→`p-3.5`; grid-panel cell padding `sm:px-4 sm:py-3` (`StageSections.jsx:44`); rail panel `p-4` (`StageSections.jsx:70`) |
| Row spacing | `MainRows`: `gap-3` between rows (`StageSections.jsx:52-64`); within a `GridPanel`/`RailPanel`, siblings use `divide-y`/`divide-x` hairlines, not gap spacing |

All of the above read as deliberate design-system tokens (consistent Tailwind scale steps, not arbitrary pixel values), **except** the duplicated `max-w-[1280px]` magic number vs. the unused `--page-max` token (§12), which looks accidental — two independently hand-typed literals instead of one referenced token.

---

## 15. Content-density analysis

At `lg:` breakpoint: main column ≈ 912px wide (1280 total − 300 rail − 20 gap − 48 page padding), further subdivided into up to 4 equal grid columns for scalar runs (≈ 208px each net of grid-panel padding) — small values render in a narrow slice of an already-capped page, while the page itself sits inside 400px+ of unused monitor margin at common wide-viewport sizes (§12). **Verdict: not "too dense" in the sense of overcrowded — the opposite: individual content units are under-sized relative to the large amount of unused space around the whole composition,** because the space lost to the outer cap is not being redistributed to the content that does render. Simultaneously, the Decide-stage rail is genuinely crowded (12 scalar rows sharing one 300px panel, §5), so density is unevenly distributed rather than uniformly wrong.

---

## 16. Chart/table composition analysis

- Charts (Line/Bar/Scatter/Waterfall) all use `ResponsiveContainer width="100%" height="100%"` inside a fixed-height wrapper (`h-56`/`h-64`) — horizontally correct (fills whatever column it lands in), vertically fixed regardless of data volume or viewport.
- `HeatmapGridBlock` is the one chart-adjacent block that is not Recharts-based and scales its own column template to data (`minmax(52px,1fr)` × `colCount`).
- Table sizing is adaptive and reasonably composed: unbounded height below 12 rows, `max-h-[420px]` + sticky header + client pagination above it (`TableBlock.jsx:49,131,146`), `w-full` always, per-cell truncation only on non-numeric text.
- **Placement correctness, not sizing, is the real composition problem:** as shown in §5/§10, a chart (`heroMetrics`) and its conceptually-related headline (`heroTitle`) and proportional bar (`moveBar`) are placed in three different sections/columns because nothing in the manifest declares the relationship — this is a section/grouping-model gap, not a chart-sizing gap.

---

## 17. Data-loss analysis

Concrete, verified examples:

1. **Reference instance headline, permanently unextracted.** "Quarterly assortment review — 214 active SKUs" exists in the reference markup (all 4 stages, unchanged) and nowhere else. `extractBreadcrumbName` (`parseMockup.js:135-140`) is the only markup-text extraction function and it targets a different, sibling DOM element. **Confirmed absent** by grep across every S9.1 raw JSON and the manifest.
2. **`props`/`state` are a whole category dropped by construction, not by classification.** `generateManifests.js:42` destructures only `{ code, stageKey, name, data }` from the fixture — `decide.json`'s `state.slate`/`state.focus` (which scenario/row the user has selected) and `execute.json`'s `state.pushed/busy/armed/restored` (live push/arm/rollback progress) can never produce a manifest block, regardless of what shape they are. This is architecturally impossible today, not merely unclassified.
3. **Color/status-coding metadata is intentionally stripped as "decorative," which is defensible per-field but forecloses reproducing the reference's visual language.** `hue`/`tint`/`tone` on `reason.data.roles` (the 6-role legend) are filtered out by both `classifyBlocks.js`'s generation-time filter and `TableBlock.jsx`/`LabelValueListBlock.jsx`'s runtime decorative-key filters (`DECORATIVE_EXACT_KEYS`/`DECORATIVE_KEY_SUFFIX_RE`, present independently in 3 files). The values are never corrupted or lost from the underlying data — but the *rendered* role table can never show the reference's color-coded role badges, because the very fields that would drive that color-coding are treated as pure CSS noise by design.
4. **Column-header metadata rendered disconnected from its table.** `analyze.data.cols[]` (7 column descriptors for the `rows` table) becomes its own independent `labelValueList` block, with no link back to `rows` — a composition loss (the two are clearly one unit in the reference: a labeled data table) even though no literal value is dropped.
5. **Narrative content and numeric content are classified identically.** `decide.data.groups[].detail` (a full policy/decision sentence) and `execute.data.watches[].action` (a full guardrail-rule sentence) both sit inside `table`-classified blocks next to ordinary numeric columns — the values are preserved, but the *type* of information (an explanatory sentence vs. a metric) is now indistinguishable to any downstream consumer of the manifest.

---

## 18. Reference vs. current capability matrix

| Reference capability | Exists in data? | Exists in manifest? | Renderer supports? | UI shows correctly? | Root cause |
|---|---|---|---|---|---|
| Action Story title (per-instance headline) | **No** (never extracted) | No | No (schema has no field) | No | Extraction gap (D) — `parseMockup.js:135-140` scopes to the wrong DOM node |
| Story summary / hero narrative | Yes (`heroTitle`/`heroSub`) | Yes (as plain `text` blocks) | Partially (`heroSlot.js` promotes *a* narrative, not necessarily this one) | No (misplaced to rail) | Classifier + section model (C/F) |
| Primary insight | Yes | Yes | Partially | Misplaced (rail, not main hero) | Section-id shape rule (C) |
| Metrics | Yes | Yes (`barChart`/scalar) | Yes | Mostly, but disconnected from its headline | Composition/grouping gap (H) |
| Policy / guardrails | Yes | Yes (`guardrail_*` slots) | Yes | Yes — this is a genuine strength (§22) | — |
| Evidence / basis footnotes | Yes | Yes (`basis`, `labelValueList`) | Yes | Present, but detached from the hero card it belongs to in the reference | Composition/grouping gap (H) |
| Tables | Yes | Yes | Yes (sort/paginate) | Yes, though a legend-shaped table (`roles`) renders as a generic sortable grid | Classifier (F) — one blockType for two different table *kinds* |
| Charts | Yes | Yes | Yes | Yes (fixed height, correct width) | — |
| Guardrail blocking/CTA state | Yes | Yes | Yes | Yes | — |
| Contextual rail | Yes | Yes (2 hardcoded ids) | Yes, single pattern only | Partially — reference varies rail shape by stage, current app can't | Layout model (H) — rail cardinality fixed at "one panel per id" |
| Sections | Yes (reference has implicit visual sections) | Yes, but only for stages ≥9 blocks | Yes | Partially — Reason/Analyze get none regardless of content | Manifest generation threshold (C) |
| Grouping (multi-field panels) | Yes (reference fuses many facts per panel) | No (`layout.group` unused everywhere) | Yes (mechanism exists, unused) | No — every ungrouped block is its own card | Manifest authoring gap (C), not a renderer gap |
| Layout (overall width/composition) | Reference = fixed 1440px canvas | N/A | Partial (main/rail ratio matches reference) | No — capped narrower than reference, sidebar wider than reference | Layout (H) + a deliberate, documented divergence |
| Stage identity (reason/analyze/decide/execute) | Yes | Yes | Yes | Yes | — |
| Workflow identity (category name) | Yes | Yes | Yes | Yes (correctly, if narrowly, reproduced) | — |

---

## 19. Root-cause tree

```
CURRENT UI DOES NOT MATCH REFERENCE
│
├── Data problem?
│   ├── Missing per-instance story headline — genuinely absent from raw data (extraction gap, not
│   │   a "the backend doesn't have it" problem — the reference source has it in static markup)
│   ├── props/state (selection/progress UI state) never reach the manifest layer by construction
│   └── Everything else needed for S9.1's actual content (metrics, tables, charts, guardrails,
│       decision data) is present and unmangled in raw JSON — NOT a general data-missing problem
│
├── Manifest problem? (the dominant cause)
│   ├── sectionIdFor is shape-driven, not semantic — routes "summary"-shaped content to the rail
│   │   unconditionally, regardless of whether that content is the page's actual headline
│   ├── layout.group/span exist in schema but are populated in 0 of 1,760 real blocks
│   ├── sections only generated when a stage has ≥9 blocks in ≥2 buckets — Reason/Analyze get none
│   ├── No field distinguishes microcopy (button labels/icons) from real content
│   └── No field links a chart to its caption/legend/related headline
│
├── Classifier problem?
│   ├── Purely shape-driven blockType assignment (one legitimate exception: unit-consistency guard)
│   ├── Identical slotName across stages classifies differently purely by shape (roles: table vs itemQueue)
│   ├── Narrative-text rows and numeric-metric rows both collapse into `table`
│   └── Classification can hinge on incidental CSS-value content (slates vs groups)
│
├── Renderer problem?
│   ├── Real composition exists (sections, rows, main/rail) — NOT "just an array, render each"
│   ├── But the only grouping signal in production is a blunt scalar/small-object heuristic
│   ├── BlockCard applied independently by 13 components; charts/tables/sliders never go compact
│   ├── composeSections' own `span` output is dead code (StageSections never reads it)
│   └── "Primary vs. supporting" = exactly two hardcoded section-id strings, no richer concept
│
├── Layout problem?
│   ├── Page width capped at 1280px — narrower than the reference's own native 1440px canvas
│   ├── Duplicated hardcoded 1280 magic number; the matching --page-max token is defined, unused
│   ├── Rail cardinality fixed at "one panel per rail-eligible section id" — reference varies this
│   │   by stage (1 panel w/ dividers vs. 4 separate cards) and current engine cannot flex to match
│   └── Sidebar is 240px vs. reference's 68px — deliberate, documented, justified trade-off, but a
│       real contributor to total content width lost before the page cap is even applied
│
└── Styling problem?
    ├── Chart height is fixed (h-56/h-64) regardless of viewport/data — a minor, isolated case
    ├── Spacing scale itself (page/section/component/row gaps) reads as consistent design tokens,
    │   not accidental — the one clear accidental artifact is the duplicated 1280px literal
    └── No systemic alignment bug found; apparent misalignment is a density/whitespace symptom (§13)
```

---

## 20. Exact files responsible

- `extraction/parseMockup.js` (`extractBreadcrumbName`, lines 135-140) — identity/title extraction scope
- `extraction/generateManifests.js` (line 42: `props`/`state` never destructured; `sectionIdFor` invocation)
- `extraction/classifyBlocks.js` (`classifyBlockType` lines 282-386; `sectionIdFor` lines 544-550; `MIN_BLOCKS_TO_SECTION` line 536; decorative-key filtering lines 12-74)
- `src/features/action-stories/manifests/S9.1.json` (the concrete manifest this trace is based on)
- `src/features/action-stories/manifests/resolveBinding.js` (no defaults/formatting, by design)
- `src/features/action-stories/manifests/blockTypes.js`, `validateManifest.js` (schema/vocabulary — no title/section/layout validation)
- `src/features/action-stories/layout/composeSections.js` (grouping logic, dead `span`, stale doc comment)
- `src/features/action-stories/layout/compactSlots.js` (`RAIL_SECTION_IDS` hardcoded pair)
- `src/features/action-stories/layout/gridEligibility.js` (`isGridEligible` — the sole grouping heuristic)
- `src/features/action-stories/layout/heroSlot.js` (opportunistic subtitle promotion)
- `src/features/action-stories/components/StageRenderer.jsx`, `StageSections.jsx` (composition + rendering)
- `src/features/action-stories/components/Shell.jsx` (sidebar width/identity source, lines 138, 154-160, 195)
- `src/features/action-stories/pages/StagePage.jsx` (page title/chip/breadcrumb, lines 65-97; the unverified reference-fidelity claim at 86-90)
- `src/features/action-stories/components/StageActionBar.jsx` (duplicated `max-w-[1280px]`, line 30)
- `src/features/action-stories/blocks/BlockCard.jsx`, `TableBlock.jsx`, `LabelValueListBlock.jsx` (card wrapping, decorative-key filtering)
- `src/styles/realify-tokens.css` (line 61: unused `--page-max` token)

---

## 21. Exact functions/components responsible

`extractBreadcrumbName`, `buildStageManifest`, `classifyBlockType`, `sectionIdFor`, `planSections`, `planSlotNames`, `resolveBinding`, `validateBlockData`/`validateManifest`, `composeSections`, `groupIntoRows`, `groupingFor`, `isGridEligible`, `pickHeroBlock`/`isHeroEligible`, `StageRenderer` (both passes + `computeCompactSlots`), `StageSections`/`MainRows`/`GridPanel`/`RailPanel`, `BlockCard`, `TableBlock`'s column/decorative filtering, `LabelValueListBlock`'s `extraEntries`.

---

## 22. What is already correct

To keep this report honest rather than one-sided — several things a naive audit would flag as broken are, on direct inspection, deliberate and reasonably well-executed:

- The two-column `1fr`/rail split in `StageSections.jsx:98` matches the reference's own `1fr 320px` proportion almost exactly (300px vs. 320px — a 20px, not structural, discrepancy).
- `compact` mode + `GridPanel`/`RailPanel` genuinely do fuse multiple scalar facts into one shared panel with dividers — a real, working anti-card-wall mechanism, just narrow in scope (§9/§11).
- The unit-consistency guard in the classifier (`hasConsistentMagnitudeUnits`) correctly prevents at least one real semantic-collision bug (mixing ratio/currency/percent into one bar chart).
- Decorative-key filtering (`hue`/`tint`/`tone`/etc.) is applied consistently in three independent places and correctly prevents raw CSS values from leaking into rendered text as fake content.
- `TableBlock` has real sort/pagination/sticky-header behavior for large tables, and correctly leaves small tables (the overwhelming majority of current fixtures) unconstrained.
- The 240px sidebar vs. the reference's 68px icon rail is a reasoned, explicitly-documented trade-off (listing 26 workflow instances vs. switching product modules) — not an oversight.
- Error isolation (`BlockErrorBoundary` per block) and async loading/retry/abort handling (`StagePage.jsx`, `Shell.jsx`) are real, working, and already address several items the project's own prior `AUDIT_REPORT.md` had flagged.
- `resolveBinding`'s "never throw, resolve to undefined" contract combined with `validateBlockData` treating `undefined` as "nothing to check" is a coherent, if permissive, design — it fails safe (a placeholder, not a crash) even though it can also mask a binding typo (§17 caveat).

---

## 23. What is missing

- A schema field for a per-instance Action Story title/headline, distinct from the workflow/category `name`.
- Any manifest-generation logic that actually populates `layout.group`/`layout.span` from real authored intent.
- Any mechanism for `props`/`state` (selection state, live progress) to ever reach the manifest/render layer.
- A rail model that can express more than exactly two hardcoded section ids, or more than one panel-per-section-id.
- A way to mark a field as pure UI microcopy (button label/icon) versus real content, upstream of rendering.
- A link between a table's own column-header metadata (`cols`) and the table it describes.

---

## 24. What is incorrectly implemented

- `sectionIdFor`'s shape-only rule misroutes the Decide stage's actual headline into the rail (§1, §5, §8) — the single highest-impact concrete bug/gap found.
- The `StagePage.jsx:86-90` code comment asserting the reference "verified" a giant workflow-name-only display title — contradicted by direct inspection of the reference source (§6).
- `composeSections.js`'s own doc comment claiming "none of the 105 real manifests declare sections" is factually false against the manifests in this same repo (85 of 105 do) — stale documentation, not merely a cosmetic nit, since it misdescribes the system's actual behavior to the next engineer who reads it.
- The duplicated, hardcoded `max-w-[1280px]` in two files, ignoring the already-defined `--page-max` token.
- `composeSections.js`'s computed `span` value is silently unused by `StageSections.jsx`.

---

## 25. What must eventually be changed

In leverage order (highest fidelity gain per change, independent of implementation difficulty — this is diagnosis, not a prescribed fix):

1. Make section/rail assignment reason about content meaning (or, at minimum, stop assuming every `summary`-shaped field is secondary) — this alone fixes the Decide-stage hero-card misplacement, the single largest fidelity gap found.
2. Give the manifest generator a real mechanism (or a manually-authored override) for expressing "these N fields are one panel," and actually use `layout.group` for at least the reference's known multi-fact hero-card pattern.
3. Extend extraction to capture the reference's per-instance headline text (a second markup-scraping rule alongside `extractBreadcrumbName`), and add a schema field to carry it distinctly from `name`.
4. Reconcile the page-width cap with the reference's actual 1440px canvas and the unused `--page-max` token, and reconsider whether a hardcoded two-rail-id model can represent the reference's per-stage-varying rail cardinality.
5. Correct the two stale/inaccurate code comments identified (§24) so future engineering decisions aren't made against a false premise.

---

## 26. Recommended fix order

1. Section/rail semantic misclassification (Decide-stage hero misplacement) — highest visible impact, most concretely proven, isolated to `classifyBlocks.js`/`compactSlots.js`.
2. Per-instance title extraction + schema field — second-highest identity-fidelity impact, isolated to `parseMockup.js` + schema + `StagePage.jsx`.
3. Authored/declared grouping for multi-fact panels (`layout.group` actually populated) — addresses the card-wall's non-mechanical root cause, not just its BlockCard symptom.
4. Page-width/rail-cardinality reconciliation against the reference's real canvas and per-stage rail pattern.
5. Documentation/comment corrections (§24) — low effort, prevents future decisions being built on the two disproven claims found in this audit.

---

## Most important final questions

**Q1 — Does the current application actually have enough data to render a reference-quality S9.1 Action Story? Answer: PARTIALLY.**
Evidence: every number, table row, chart point, and guardrail rule the reference shows for S9.1 is present, unaltered, in `data/raw/S9.1/*.json` (§4) — this is not a "the backend is missing fields" problem for the vast majority of the screen. The two proven exceptions are narrow and specific: (a) the reference's per-instance headline text was never extracted at all (§4, §17 #1), and (b) `props`/`state` (selection/progress UI state) are structurally excluded from ever reaching the manifest (§17 #2). Everything else the reference composes visually (the Decide hero card, the color-coded role legend) **is present as data** — the fidelity gap for those is proven to be a classification/composition failure, not an absent-data failure (§1, §5, §8).

**Q2 — If the data already exists, why is the current UI not showing a reference-quality Action Story? Exact pipeline failure:**
`extraction/classifyBlocks.js:544-550` (`sectionIdFor`) assigns a block's section by its classified `blockType` shape alone → `layout/compactSlots.js:9` (`RAIL_SECTION_IDS`) treats the resulting `summary` section as inherently secondary for every workflow → `components/StageSections.jsx:94-110` renders that section in a 300px rail. This chain misroutes the Decide stage's actual headline (`heroTitle`/`heroSub`) — proven, with citations, in §1 and §5. A second, independent failure: no manifest block anywhere declares `layout.group`, so the renderer's only path to "these related facts share one panel" (the scalar-adjacency heuristic) cannot fuse a headline with its metrics chart and its proportional bar, even though the reference clearly composes them as one unit.

**Q3 — If data does NOT exist, exactly what fields are missing?**
- A schema field for "Action Story instance title/headline," distinct from workflow `name` (currently: no such field exists anywhere in `data/index.json` or the manifest schema).
- The raw extracted value of the reference's static-markup instance-headline text itself (never captured by any extraction function).
- A representable channel for `props`/`state` (e.g., which slate is selected, which destination has been pushed) to become manifest content, should that ever need to be reflected in a rendered Action Story.

**Q4 — Can the existing renderer/layout system reproduce the reference UI? Answer: PARTIALLY.**
It correctly reproduces: the reference's main/rail column ratio, guardrail-panel composition, chart rendering, table sort/pagination, and the workflow/category identity chip. It cannot reproduce, from its current generic rules alone: content-aware section placement (proven misrouting a headline to the rail), the reference's per-stage-varying rail cardinality (1 panel vs. 4 cards), or any multi-block-type fused panel (a reference pattern seen in the Decide hero card), because no manifest anywhere populates the one mechanism (`layout.group`) that could express it.

**Q5 — What is the smallest architectural change required to make it capable?**
Two changes, independent of each other, together closing the largest gaps found: (a) stop conflating "classified blockType is scalar" with "belongs in the rail" in `sectionIdFor`/`RAIL_SECTION_IDS` — even a manual, per-known-slot-name override list (`heroTitle`/`heroSub` → main, not rail) would fix the single worst case found without a new schema field; (b) actually populate `layout.group` for the known multi-fact panels the reference composes as one unit, since the mechanism to consume it already exists and is unit-tested (`composeSections.test.js`) but starved of real input.

**Q6 — Which problems are DATA problems?** The per-instance headline extraction gap; `props`/`state` being out of scope for manifest content (§4, §17).

**Q7 — Which problems are MANIFEST problems?** Shape-only `sectionIdFor`; `layout.group`/`span` unused everywhere; the 9-block section threshold leaving small stages ungrouped; no field distinguishing microcopy from content; no link between `cols` and the table it describes (§7, §11, §17, §19).

**Q8 — Which problems are RENDERER problems?** `RAIL_SECTION_IDS`'s two-string hardcode; `compact` never implemented for charts/table/slider; `composeSections`'s dead `span` output; the narrow, type-only `isGridEligible` heuristic being the sole real grouping signal (§9, §11).

**Q9 — Which problems are LAYOUT problems?** The duplicated `max-w-[1280px]` cap (narrower than the reference's own 1440px canvas) ignoring the unused `--page-max` token; fixed single-panel-per-rail-id cardinality unable to match the reference's per-stage-varying rail pattern (§12, §19).

**Q10 — Which problems are purely VISUAL/CSS problems?** Fixed chart height (`h-56`/`h-64`) regardless of data/viewport is the one clearly isolated, purely-visual item found. Nothing else audited rises to a pure-CSS-only cause — every other symptom traces back through manifest/classifier/renderer logic, not a stylesheet rule in isolation.

---

## Final verdict

| Dimension | Score | Basis |
|---|---|---|
| Data readiness | 8/10 | Materially complete for S9.1 (§4); two proven, narrow gaps (instance headline, props/state) keep it off a 9-10 |
| Manifest readiness | 4/10 | Schema has the right shape (`sections`, `layout.group`) but generation never populates the parts needed for reference-fidelity composition (§7) |
| Composition readiness | 4/10 | Real composition exists (not "flat array"), but its only production grouping signal is a blunt scalar heuristic; the one declarative escape hatch is unused everywhere (§9, §11) |
| Layout readiness | 5/10 | Main/rail ratio genuinely matches the reference; page-width cap and rail-cardinality rigidity are real, proven gaps (§10, §12) |
| Visual readiness | 7/10 | Spacing/typography read as a coherent, deliberate system; only isolated issues found (fixed chart height, duplicated magic-number width) (§14, §16) |
| Reference fidelity (net, S9.1 specifically) | 4/10 | The single highest-visibility element of the Decide stage (the hero recommendation) is provably misplaced; the identity model cannot show the reference's actual per-instance headline at all (§5, §6) |

**OVERALL CURRENT UI READINESS: 5/10** — not because tests fail or data is broadly absent (they don't, and it isn't), but because the specific chain of shape-driven classification decisions this audit traced (classifier → section assignment → hardcoded rail ids → renderer) provably and mechanically relocates the reference's most important content to its least prominent position, and no manifest today uses the one mechanism that already exists to prevent that.
