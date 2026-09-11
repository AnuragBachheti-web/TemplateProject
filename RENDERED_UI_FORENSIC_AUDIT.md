# RENDERED UI FORENSIC AUDIT

**Diagnosis only. No file was modified to produce this audit.**

## 1. Environment

- **browser available:** YES — the Claude-in-Chrome extension was NOT connected (checked at the start of this task), but a headless Chromium (Playwright, already cached on this machine at `~/Library/Caches/ms-playwright/chromium-1243`, invoked via `npx playwright` against the already-running `npm run dev` server) was used instead. This is a REAL browser rendering the REAL app — not a DOM/jsdom test, not a code-only inference.
- **screenshot available:** YES — full-page and above-the-fold screenshots were captured for all 8 requested routes, saved outside the project (session scratchpad), never committed to the repo.
- **viewport:** 1440×900 for the "fold" screenshots (exact request). Full-content screenshots additionally resized the viewport height per-route (width held at 1440) so the entire scrollable content is visible in one image — the app's real scroll container is an inner `<main id="main-content" class="overflow-y-auto">`, not the document body, so a literal Playwright `fullPage` capture would have silently clipped at 900px; this was caught and corrected before trusting any measurement.
- **routes tested:** `/action-stories/S9.1/{reason,analyze,decide,execute}`, plus `/action-stories/S9.4/decide`, `/action-stories/S9.6/analyze`, `/action-stories/S9.16/decide`, `/action-stories/S9.10/execute` — all 8 requested routes, all successfully rendered.
- Real DOM measurements (`getBoundingClientRect`) were captured alongside the screenshots for header/title/stepper/panels/sections/tables/charts/rail on every route — the density numbers below are measured, not estimated.

---

## 2. Executive Finding

The rendered UI is **denser and more structurally correct than before the last two passes, but it is still visibly too tall in specific, precisely-locatable places** — and the cause is **not** the region/grouping/span architecture (that part visibly works: the Decide hero panel *does* read as one story, Policy and Roles *are* real tables, role chips *are* compact). The remaining height comes from four **narrower, previously-unexamined defects**, each confirmed on multiple different workflows, not just S9.1: (1) `LabelValueListBlock`'s hardcoded primary-value key list (`value/note/detail/amount/pct`) doesn't recognize extremely common real field names (`meta`, `n`, `w`, `key`, `numeric`), so those rows silently fall back to a 2–3-line "extra field" layout instead of one compact line — inflating `cols`, `moveBar`, `inputs`, and several rail "Summary" blocks by 2–3× their necessary height; (2) a scalar text field with no sibling to share a row with (`Display Mode` on Analyze) still renders as its own full-width bordered panel; (3) pure chart/table *metadata* (`cols`) is rendered as its own large content block, duplicating the table's own headers, at real cost (≈559px on S9.1/Analyze — measured, not estimated); and (4) the compact rail row (`TextBlock`'s `flex ... shrink-0 truncate` combination) has a genuine CSS bug — `shrink-0` prevents the `truncate` from ever triggering, so long rail values and even long rail *labels* visibly overflow the 300px rail column on **every workflow with a busy rail** that was checked (S9.1, S9.4, S9.10, S9.16). None of this requires touching the region/grouping/span system that the last two passes built — it requires fixing specific block-level rendering rules and one specific classifier gap.

---

## 3. Biggest Remaining Problems (ranked)

1. **`cols`-style chart/table metadata renders as its own large content block** (S9.1/Analyze: measured ≈559px, more than double the scatter chart's own 224px, for 7 column-descriptor rows that are pure metadata already fully re-expressed as the `rows` table's own column headers 350px below it). Root cause: **classifier** (this shape should never become a standalone visible block) + **composition** (no concept of "metadata for another block" to suppress it).
2. **`LabelValueListBlock`'s primary-value fallback list is too narrow.** Real fixture keys `meta`, `n`, `w`, `key`, `numeric` are not in `value ?? note ?? detail ?? amount ?? pct`, so the actual value is silently demoted to a small "extra field" line under a blank primary row. Confirmed inflating: `S9.1/Analyze.cols` (every row), `S9.1/Decide.moveBar` (every row, ~330px measured for 5 rows that should be ~120px), `S9.1/Execute`'s `dests` item metadata, `S9.10/Execute`'s `guard rows`. Root cause: **component** (`LabelValueListBlock.jsx`).
3. **Rail text overflow — a real CSS bug, not a design choice.** `TextBlock`'s compact row uses `shrink-0 truncate` together on the value span; `shrink-0` stops the flex item from ever shrinking, which is the precondition `truncate` needs to fire. Confirmed visibly overflowing the 300px rail column on **S9.1/Decide, S9.1/Execute, S9.4/Decide, S9.16/Decide** — i.e. every single rail-bearing route checked. Root cause: **component/CSS** (`TextBlock.jsx`'s compact branch).
4. **Rail LABELS also truncate mid-word** ("Guardrail Ct...", "Slate ...", "Re...", "Footer Sta...") on S9.1/Decide and S9.4/Decide — the label side of the same compact row is too aggressively truncated for a 300px column once the field's humanized name is more than ~2 words. Root cause: **layout** (rail column width vs. label length was never checked against real vocabulary).
5. **Decorative-key filtering has real, generic gaps.** Confirmed LEAKING raw internal values as visible user-facing text: `Dot Inner: transparent` (S9.1/Decide slates), `Divider: 1px solid var(--ink-200)` (S9.4/Decide modes), `Res Icon: fa-solid fa-scale-balanced`, `Push All Icon: fa-solid fa-paper-plane`, `Arm Btn Icon: fa-solid fa-lock` (S9.1/Execute, S9.4/Decide summary rail). Root cause: **classifier/component** — the decorative-key suffix list doesn't cover `Inner`/`Divider`, and **top-level scalar fields are never checked against the decorative-key list at all** (only per-item array fields are — a top-level `resIcon: "fa-solid fa-scale-balanced"` string sails straight through `isPureStyleValue`, which only pattern-matches CSS-*value*-shaped strings, never icon-glyph-shaped ones, and never looks at the *key name* for a top-level field).
6. **Wide tables overflow/clip their container instead of scrolling visibly.** Confirmed on 3 different workflows: `S9.16/Decide` "Modes" (7 columns, last column `B Label` clipped at the viewport edge), `S9.4/Decide` "Slate" (6 columns, `Pair Label` clipped), `S9.6/Analyze` "Grid" (8 columns, `Content...` clipped). Root cause: **layout** (main column width, ~836–900px measured, is narrower than several real tables' natural width) + **component** (no visible scroll affordance is obvious to a user at a glance — the cursor has to already know to scroll right).
7. **A lone scalar with no row-mate still renders as a full-width bordered panel.** `Display Mode` on `S9.1/Analyze` (no other scalar exists on that stage to group with it) — measured 59px of near-empty full-width panel for one word ("Suggest"). Root cause: **composition** (the grouping heuristic has no fallback for "this is the only eligible item, so don't bother drawing a whole-row card for it").
8. **Hero-treatment eligibility is gated by an arbitrary, inconsistent 60-character threshold.** `S9.16/Decide`'s `Rationale`/`Primary Insight` (~40 chars each) and `S9.6/Analyze`'s equivalent field render as plain scalar text — no visual distinction from `Display Mode` right next to them — even though they are very likely the single most important sentence on those screens. Root cause: **classifier** (`HERO_MIN_LENGTH = 60` is a length heuristic standing in for a semantic judgment).
9. **Chart magnitude-scale mismatch makes most of a bar chart invisible.** `S9.1/Analyze`'s `movement` chart plots `+3, −7, +5, 199` on one linear scale — the three meaningful small deltas are visually imperceptible slivers next to the 199 bar. Root cause: **classifier's unit-consistency check verifies unit (all "number"), never magnitude scale** — a real, if narrower, gap in the same check that already exists.
10. **Some stages (S9.16/Decide especially, measured 3,382px total content height — 3.76 viewports) still stack many full-width single blocks vertically with no row-sharing for non-scalar content** (tables/itemQueues never share a row with each other, ever, regardless of width). Root cause: **composition** (the grouping heuristic only ever merges *scalar* blocks; two medium-width tables/lists that could sit side by side never do).

---

## 4. S9.1 Reason

**Reference:** instance identity + rationale + policy (as a table) + roles (as a table) + supporting inputs, in a dense, no-nonsense top-to-bottom read, everything readable without excessive scrolling.

**Current (measured, 1440×900):** total content height **1,118px** (≈1.24 viewports). `h1`+subtitle+stepper occupy 0–249px. Then: one GridPanel (rationale + Display Mode sharing a row) at 265px, height **109px**; `Policy · 3` — now a genuine table, height **170px** (3 rows); `Roles · 6` — now a genuine table, height **275px** (6 rows); `Inputs` (not captured by table selector — still a `labelValueList`) below the fold.

**What's actually good here (confirmed by screenshot, not assumed):** Policy and Roles are real, dense tables with headers — this is a direct, working improvement from the prior passes. Rationale and Display Mode correctly share one row instead of stacking. No nested "card in a card" is visible for the hero text.

**What's still wrong:**
- `Inputs` (5 rows, `{label, meta}`) falls into the same `LabelValueListBlock` primary-value gap as `cols`/`moveBar` elsewhere: `meta` isn't a recognized value key, so every row shows the label alone, then a *second*, smaller "Meta: 18,402 rows" line underneath — roughly double the height 5 compact rows would need. This wasn't visible in the "fold" screenshot but is visible in the full-page capture.
- Minor: the rationale+Display Mode GridPanel is one shared, internally-divided panel — visually reasonable, but it is a real, acknowledged simplification versus the reference's fully-independent side-by-side cards (already flagged honestly in the prior report; repeating here because it is still visibly true).

| SCREEN | S9.1 Reason |
|---|---|
| REFERENCE | Dense rationale + policy table + roles table + inputs, compact top-to-bottom |
| CURRENT | Matches structurally; Inputs section ~2× taller than necessary |
| DIFFERENCE | `Inputs`'s `meta` field never recognized as the row's real value |
| SEVERITY | P2 |
| ROOT CAUSE | component (`LabelValueListBlock.jsx`'s value-key fallback list) |
| RECOMMENDED FIX | Broaden the fallback key list (or make it data-driven: "the one remaining meaningful key if exactly one remains") so `meta`/`n`/`w`/similar common keys are recognized as the primary value, not an "extra field" |

---

## 5. S9.1 Analyze

**Reference:** roles as a compact legend, one prominent scatter/analytical chart, supporting tables — a chart-forward, analytical screen.

**Current (measured):** total content height **2,131px (≈2.37 viewports)** — the tallest of the four S9.1 stages by a wide margin. Breakdown (measured): Display Mode alone-row 265→324 (**59px**, full-width, one word); Roles rendered as compact chips (confirmed working, not separately measured but visually ~70–90px including its card, a real win); scatter chart 465→689 (**224px** chart + legend); **the `Cols` block, 689→1248 (≈559px)** — this single block is larger than the scatter chart above it; `Rows · 10` table 1248→1663 (**415px**); `Gaps · 4` table 1677→1882 (**205px**); `Movement` bar chart 1932→2131+ (**224px** + legend).

**What's actually good:** the scatter/`points` chart itself is well-proportioned (224px, legend directly attached below it, matches the reference's chart-forward intent). `Roles` correctly renders as chips now, not six stacked pills — a real, visible, working fix from the last pass. `Rows`/`Gaps` are real, dense tables.

**What's badly wrong:**
- **`Cols` (≈559px) is the single largest content block on this entire screen**, larger than the actual scatter chart, and it is **pure metadata** — 7 rows of `{key, label, numeric}` column descriptors for the `Rows` table immediately below it, which already shows its own real column headers (Product/Role/Vel/Cm/Turns/Gmroi/Cpw). This is duplicated, low-value information given more visual weight than the analysis it's describing.
- `Display Mode` (59px, one word, full-width) — a lone scalar with nothing to group with still draws a full-width bordered panel.
- `Movement`'s bar chart plots `+3/−7/+5/199` on one axis; only the `199` bar ("Held their role") is visible, the other three categories the screen presumably wants to call out are effectively invisible slivers.

| SCREEN | S9.1 Analyze |
|---|---|
| REFERENCE | Roles legend → analytical chart → supporting tables, chart-forward |
| CURRENT | Roles legend ✓, chart ✓, but `Cols` metadata block (≈559px) dominates the page more than the chart does |
| DIFFERENCE | A metadata-only block outweighs the actual analysis visually and in height |
| SEVERITY | **P0** |
| ROOT CAUSE | classifier (this shape should never become a top-level visible block) + composition (no "attach to the table it describes" concept) |
| RECOMMENDED FIX | Either suppress a `{key,label,numeric?}`-shaped array from becoming its own block when a sibling `table`/`labelValueList` block's own column set matches it, or fold it into the table it describes (e.g., a table caption/footnote) rather than rendering it as an equal, standalone content block |

---

## 6. S9.1 Decide

**Reference:** one coherent recommendation story in main, genuinely independent guardrail/context cards in rail.

**Current (measured):** total content height **1,756px (≈1.95 viewports)**. Composed hero panel: 265→922 (**657px**), containing the headline, subtitle, a **128px** compact metrics chart (the compact-tier fix from the prior pass is confirmed working here), and the move-mix data. Rail: Guardrails 277px, Summary 389px, Totals 209px, Basis 265px (**1,140px of rail content in a 1,175px rail column** — the rail is *busy*, using nearly all of its own height). Main "Details": Groups table 205px, Focus Rows table 240px, plus the Slates itemQueue (unmeasured directly, visually ~300px).

**What's actually good:** the composed panel genuinely reads as ONE story — headline → subtitle → metrics chart → move mix, one border, no nested cards. This is a real, confirmed, working fix. Groups/Focus Rows are dense real tables.

**What's badly wrong:**
- **`moveBar` inside the hero panel is a disaster, measured.** It's a `labelValueList` of `{label, n, hue, w}` — the SAME primary-value-key gap as `cols`: `n`/`w` aren't recognized, so every one of the 5 move categories (Keep/Grow/Reduce/Exit/Gap fill) renders as: bold label alone, then "N: 162", then "W: 74.3" — **three lines per category**. This single block is a large fraction of the 657px hero panel and directly undercuts the "one coherent story" goal the composed panel was built for — the *inside* of that one good panel still has the exact same bloat problem as everywhere else.
- **`slates`' itemQueue items leak `Dot Inner: transparent` as visible text** — a raw CSS fill value shown to the user as if it were a business fact, on every one of the 3 slate cards.
- **The rail visibly overflows its own column.** `Summary`'s `Guardrail Cta Label` truncates to `"Guardrail Ct..."`; longer values (`"Showing 5 of 12 · ranked by capital tied up"`, `"Decide · 56 SKUs across 4 moves · balanced slate"`) visibly extend past the rail's right edge into open space — confirmed in the screenshot, not inferred.

| SCREEN | S9.1 Decide |
|---|---|
| REFERENCE | One coherent recommendation story; independent rail cards |
| CURRENT | The composed panel structure IS correct, but `moveBar` inside it (three lines per category) undermines the "coherent story" feel from within; rail text visibly overflows |
| DIFFERENCE | Internal block-level bloat + rail overflow, not a structural/grouping problem |
| SEVERITY | **P0** (moveBar bloat + rail overflow both directly visible, high-traffic screen) |
| ROOT CAUSE | component (`LabelValueListBlock`'s value-key list; `TextBlock`'s compact `shrink-0`+`truncate`) |
| RECOMMENDED FIX | Same `LabelValueListBlock` fix as §5; fix `TextBlock`'s compact row to actually allow the value span to shrink (drop `shrink-0` or give the row a `min-w-0` ancestor) so `truncate` can do its job instead of overflowing |

---

## 7. S9.1 Execute

**Reference:** an operational workspace — destinations, status, actions, progress.

**Current (measured):** total content height **1,355px (≈1.5 viewports)** — the shortest of the four S9.1 stages, and the one that reads best structurally. `Details` section 1,063px (4 destination cards + Watches table), rail `Summary` 523px.

**What's actually good:** this screen is the closest to "operational workspace" already — destination cards are reasonably dense with real nested item lists, `Watches · 3` is a proper table.

**What's wrong:**
- Every destination card's second line shows `Meta: ...` (same value-key gap) alongside `Status Label: staged` and `Btn Label: Push` — these last two are UI-control labels (a status pill's own text, a button's own label), not business facts, yet they render as plain "extra field" text on every card.
- **`Push All Icon: fa-solid fa-paper-plane` and `Arm Btn Icon: fa-solid fa-lock` render as literal, readable text in the rail** — raw FontAwesome class names shown to the user. This is the clearest, most unambiguous instance of the decorative-key-gap finding (§3.5): these are pure icon-name strings for buttons this UI itself renders, leaking through because top-level scalar fields are never checked against a decorative-key-by-name list at all (only per-item array fields are).

| SCREEN | S9.1 Execute |
|---|---|
| REFERENCE | Operational workspace: destinations, status, actions, progress |
| CURRENT | Structurally closest to reference of the 4 stages; two literal icon-class strings render as visible text |
| DIFFERENCE | `pushAllIcon`/`armBtnIcon` (and `statusLabel`/`btnLabel` on destination cards) are UI chrome, not content, but are rendered as content |
| SEVERITY | P1 |
| ROOT CAUSE | classifier/component (no decorative-key check on top-level scalar fields) |
| RECOMMENDED FIX | Extend `isPureStyleValue`-style filtering (or an explicit key-name check) to top-level scalar fields too, not only per-item array fields — an icon-glyph-shaped string (`fa-(solid|regular)-fa-...`) is as recognizable a pattern as a CSS color value |

---

## 8. Cross-Screen Problems

**Card-wall forensic table** (evaluated against real rendered output, not assumed):

| Element | Current treatment | Necessary? | Reference treatment | Action |
|---|---|---|---|---|
| Display Mode (no siblings) | Full-width bordered panel, 1 word | No | Small inline chip/metadata, not its own panel | Suppress the whole-row panel for a lone ungrouped scalar |
| Policy | Real table, 3 rows | Yes | Table | None — already correct |
| Roles (Reason) | Real table, 6 rows | Yes | Table | None — already correct |
| Roles (Analyze, legend-only) | Compact chip row | Yes | Compact legend | None — already correct (prior pass's fix confirmed working) |
| `Cols` (chart/table column metadata) | Standalone large block, ≈559px | **No** | Not a visible block at all (already expressed as the table's own headers) | Suppress or fold into the table it describes |
| `moveBar` | LabelValueList, 3 lines/row | Partially | One compact line per category (label + N + %) | Fix the value-key fallback |
| Destinations (`dests`) | Rich itemQueue card, reasonably dense | Yes | Operational card | Minor: strip `Status Label`/`Btn Label` (UI chrome) from visible "extra fields" |
| Guardrails (rail) | One shared compact panel | Yes | Compact checklist | None — already correct |
| Summary (rail, catch-all scalars) | One shared panel, but can grow very tall (791px on S9.16/Decide) and overflows | Yes as a concept, but overloaded | Compact metadata list | The "everything scalar that isn't guardrails/hero" catch-all bucket needs its own internal density discipline, not just compactness |
| Hero content | One composed panel | Yes | One composed panel | None — already correct |

**Whitespace/overflow sources found, classified per the requested taxonomy:**
- **Rail text overflow**: (M) other / component bug — `shrink-0` blocking `truncate`, not a padding/margin/gap issue at all.
- **`Cols` block height**: (L) max-width/composition issue — the block itself isn't over-padded, it simply shouldn't exist as a large standalone block.
- **`moveBar`/`cols`/`inputs`/destination "Meta" bloat**: (J) empty content, functionally — the *intended* single value line is empty/blank because the real value landed in an "extra field" row instead; the visual result is indistinguishable from wasted whitespace even though technically every pixel has a label in it.
- **Wide-table clipping** (S9.16 Modes, S9.4 Slate, S9.6 Grid): (K) max-width/composition issue — main column width (~836–900px measured) is narrower than several real tables' natural content width.

**Horizontal space utilization:** viewport 1440px; sidebar 240px; main column ≈836–900px (measured, varies slightly by route); rail 300px (measured, constant); gap ≈16–20px. On decide-shaped screens with a rail, main:rail ≈ 2.8:1 — reasonable and close to the reference. On screens with NO rail (Reason, Analyze, S9.6/Analyze — confirmed `railColumn: null` in the measurements), the main column still stays at the same ~836–900px width rather than expanding to use the freed-up rail space — a real, measured instance of "unused right-side space" the audit was asked to look for. Confirmed via `mainColumn`/mainColumn width staying constant regardless of whether a rail is present.

---

## 9. Density Measurements

| Screen | Panel/section count (measured) | Chart height(s) | Main width | Rail width | Largest single unnecessary block | Total content height |
|---|---|---|---|---|---|---|
| S9.1 Reason | 1 GridPanel + 2 tables + 1 list | — (no chart) | 836px | none | Inputs (~2× taller than needed) | **1,118px** |
| S9.1 Analyze | 1 lone-scalar panel + chips + 2 charts + 2 tables + 1 metadata block | 224px ×2 | 836px | none | **`Cols`, ≈559px** | **2,131px** |
| S9.1 Decide | 1 composed panel + 2 tables + 1 itemQueue + 4 rail cards | 128px (compact tier) | 836px | 300px | `moveBar` inside the composed panel (≈250–300px of its 657px) | **1,756px** |
| S9.1 Execute | 4 destination cards + 1 table + 1 rail card | — (no chart) | 836px | 300px | none dominant; distributed "Meta"/icon-string bloat | **1,355px** |
| S9.4 Decide | 3 tables + 2 rail cards | — | 836px | 300px | `Slate` table clipped at 6th column | **1,909px** |
| S9.6 Analyze | 1 lone-scalar-row panel + 1 wide table | — | 836px | none | `Grid` table clipped at 8th column | **1,435px** |
| S9.16 Decide | 1 composed panel + 2 rail cards (Summary alone: **791px**) + chart + 2 tables + large itemQueue-heavy Details (2,648px) | 224px | 836px | 300px | **`Details` section, 2,648px** | **3,382px** |
| S9.10 Execute | 1 composed panel + 2 tables + 1 rail card | — | 836px | 300px | Rail text overflow (5+ lines visibly clipped past the rail edge) | **1,867px** |

---

## 10. Reference-vs-Current Differences (prioritized)

| # | Difference | Severity | Screens affected |
|---|---|---|---|
| 1 | Chart/table metadata (`cols`) rendered as a large standalone block | P0 | S9.1/Analyze (confirmed); likely any workflow with a `cols`-shaped field |
| 2 | `moveBar`/similar multi-key-per-row data renders 3 lines/row instead of 1 | P0 | S9.1/Decide (confirmed); any workflow using `n`/`w`-style row keys |
| 3 | Rail value AND label text overflows the 300px column | P0 | S9.1/Decide, S9.1/Execute, S9.4/Decide, S9.16/Decide (confirmed on every rail-bearing route checked) |
| 4 | Decorative/icon values leak as visible text | P1 | S9.1/Decide, S9.1/Execute, S9.4/Decide (confirmed) |
| 5 | Wide tables clip instead of scrolling visibly | P1 | S9.16/Decide, S9.4/Decide, S9.6/Analyze (confirmed) |
| 6 | Lone scalar still draws a full-width panel | P2 | S9.1/Analyze (confirmed) |
| 7 | Hero-treatment threshold (60 chars) is arbitrary/inconsistent | P2 | S9.16/Decide, S9.6/Analyze (confirmed) |
| 8 | Chart magnitude-scale mismatch hides most bars | P2 | S9.1/Analyze `movement` chart (confirmed) |
| 9 | Main column doesn't reclaim rail width when no rail is present | P3 | S9.1/Reason, S9.1/Analyze, S9.6/Analyze (confirmed via measurement) |
| 10 | Reference's fully-independent side-by-side card row (Reason) approximated as one shared panel | P3 | S9.1/Reason (already disclosed in the prior report) |

---

## 11. Root Cause Ranking

1. **Component-level rendering gaps** (`LabelValueListBlock`'s value-key list; `TextBlock`'s compact overflow bug) — highest impact, touches the most screens, most visibly wrong in screenshots.
2. **Classifier gaps** (`cols`-shaped metadata becoming a real block; decorative-key filtering not applied to top-level scalars; hero-eligibility as a raw length check) — second highest, root of several of the above.
3. **Composition gaps** (no row-sharing for a lone scalar; no row-sharing for non-scalar/medium-width content; no "attach to the table it describes" relationship) — real, but narrower in observed impact than #1/#2.
4. **Layout** (rail width vs. real label/value lengths; main column width vs. real wide-table widths) — a real, measured contributor (the clipped tables, the rail overflow's *container*, if not its cause), but secondary to the component bug that makes the overflow happen instead of gracefully truncating.
5. **CSS** — narrowly, only as the *mechanism* of #3 in §3 (`shrink-0` vs `truncate`), not as an independent root cause on its own.
6. **Data availability** — genuinely not a factor for anything found in this pass; every issue above involves data that already exists and is already bound correctly, just rendered poorly.

---

## 12. Exact Files Responsible

| Root cause | File | Function/Component | Responsibility | Problem |
|---|---|---|---|---|
| #2 (moveBar/cols/inputs bloat) | `src/features/action-stories/blocks/LabelValueListBlock.jsx` | the inline `flattenNestedEntry(item?.value ?? item?.note ?? item?.detail ?? item?.amount ?? item?.pct)` primary-value pick | Choosing which field is "the" value for a label/value row | Real fixture keys (`meta`, `n`, `w`) aren't in this list, so they're demoted to an "extra field" line instead of the primary value |
| #3 (rail overflow) | `src/features/action-stories/blocks/TextBlock.jsx` | the `compact` branch's value `<span>` | Rendering one bare label/value row inside a shared panel | `shrink-0 truncate` together is self-defeating — `shrink-0` prevents the shrink `truncate` needs |
| #1 (`cols` as a large block) | `extraction/classifyBlocks.js` | `classifyBlockType` (the plain-array/`*Ticks`/`*Cols`-style dispatch) + `planSlotNames` | Deciding whether a shape becomes a visible block at all | No rule recognizes "this array only describes another block's own columns" as a signal to suppress or subordinate it |
| #4 (icon/CSS leaks) | `extraction/classifyBlocks.js` (`isPureStyleValue`, `planSlotNames`) and `src/features/action-stories/blocks/{ItemQueueBlock,LabelValueListBlock,TableBlock}.jsx` (`isDecorativeKey`/`DECORATIVE_*` lists) | Filtering non-content values/keys | `isPureStyleValue` only pattern-matches CSS-value-shaped strings (never icon-glyph-shaped ones) and is only ever applied to TOP-LEVEL fields via value, never key name; the three components' own decorative-key lists don't include `Inner`/`Divider` |
| #6 (lone scalar full-width panel) | `src/features/action-stories/layout/composeSections.js` / `src/features/action-stories/components/StageSections.jsx` | `groupIntoRows` / `GridPanel` | Deciding row-sharing | A 1-item "grid" row still renders through `GridPanel`'s full bordered-card treatment; no smaller/bare treatment exists for "eligible but alone" |
| #7 (hero threshold) | `src/features/action-stories/layout/heroSlot.js` | `HERO_MIN_LENGTH` / `isHeroEligible` | Deciding hero-worthiness | A single hardcoded character count stands in for a judgment about narrative importance |
| #5 (wide table clipping) | `src/features/action-stories/pages/StagePage.jsx` (`max-w-page`), `src/features/action-stories/components/StageSections.jsx` (`lg:grid-cols-[minmax(0,1fr)_300px]`) | page/column width | Constraining main column width | Several real tables have more natural width than the ~836–900px main column provides, and the resulting horizontal scroll isn't visually obvious |

---

## 13. Required Fix Plan (dependency order — NOT implemented here)

1. **Fix `LabelValueListBlock`'s primary-value selection** to be data-driven rather than a fixed key list (e.g., "the first non-decorative key that isn't `label`" when exactly one remains, falling back to the existing fixed list when more than one candidate remains) — this alone measurably shrinks `cols`, `moveBar`, `inputs`, and several rail blocks across every workflow that shares this shape, with no manifest/classifier change required.
2. **Fix `TextBlock`'s compact-row overflow** (remove `shrink-0` from the value span, or give the row a `min-w-0` container) — a pure, contained CSS/JSX fix, zero manifest impact, fixes the single most visually alarming defect (text bleeding past its own container) everywhere it occurs.
3. **Extend decorative-key filtering to cover `Inner`/`Divider`-style suffixes and to apply to top-level scalar fields, not only per-item array fields** — closes the icon/CSS-string leaks.
4. **Add a "this array is metadata for a sibling block" suppression rule to the classifier** (the `cols` case) — the highest-measured single win (≈559px on one screen alone), but the most design work: needs a clear, generic rule (e.g., "an array of `{key,label,...}` descriptors whose `key` values are a subset of a sibling table block's own resolved column keys is metadata, not content").
5. **Give a lone, ungrouped, grid-eligible scalar a lighter/bare treatment** instead of `GridPanel`'s full card.
6. **Reconsider `HERO_MIN_LENGTH` as a pure length gate** — either lower it, or pair it with a stronger signal (the block's own vocabulary slot name already carries most of this signal; length was only ever a safety filter against a one-word value).
7. **Give wide tables a visible "scroll for more" affordance** (a shadow/fade at the clipped edge, or a visible column count indicator) rather than a silent clip — lowest-risk, purely presentational.
8. **(Optional, lower priority) magnitude-scale-aware chart guard** — extend the existing unit-consistency check to also flag/handle a >10× magnitude spread within one otherwise-consistent-unit series.

None of the above requires touching `composeSections.js`'s region-resolution order, the `role`/`layout.group`/`layout.span` schema, or the `ComposedPanel`/`GridPanel`/`RailPanel` split — that architecture is confirmed working by this audit and should not be re-litigated.

---

## 14. What Must NOT Be Changed

- The region-resolution priority order in `composeSections.js` (block override → section → legacy → main) — confirmed correct by this audit (Decide's hero content is genuinely in main, genuinely fused into one panel).
- The `ComposedPanel` / `GridPanel` / `RailPanel` three-way split in `StageSections.jsx` — each is doing its intended job where exercised.
- The manifest schema additions (`role`, `region`, `layout.group`, `layout.span`, `headline`) — none of the problems found in this pass trace back to this schema; it is sound.
- The table-promotion classifier rule from the prior pass (`policy`→table) — confirmed working and correctly scoped (the `checks` exemption is intact and correct).
- The `ItemQueueBlock` simple-chip-list logic — confirmed working (Analyze's `roles` legend).
- The extraction pipeline's identity/headline capture — confirmed correct and unrelated to any finding here.

---

## 15. Final Scores

- **Engineering composition correctness: 8/10** — region/grouping/span/hero-panel-fusion is real, tested, and now visually confirmed to work as designed. The remaining 2 points are for the lone-scalar and metadata-block gaps in the composition layer itself (§3.1, §3.7).
- **Actual reference visual fidelity: 5/10** — a real user scanning these screens today would still see oversized single-field panels, three-line rows for what should be one line, text bleeding out of its container, and literal CSS/icon strings as content, on the majority of screens checked. These are not subtle.
- **Viewport efficiency: 5/10** — S9.1/Analyze needs 2.4 viewports, S9.16/Decide needs 3.8; a meaningful fraction of that height (measured, not estimated) is the metadata-block and multi-line-row problems above, not information.
- **Information hierarchy: 5/10** — a lone "Suggest" value and a full analytical scatter chart currently receive comparable visual treatment on Analyze; a 40-character "primary insight" gets no visual distinction at all on two of the four cross-checked workflows.
- **Visual polish: 4/10** — text visibly overflowing its container and raw icon-class strings rendered as sentences are the kind of defect that reads as unfinished, not merely "dense."

---

## 16. Definition of Done (for the next implementation pass)

- [ ] No rendered screen shows a value/label pair split across 2+ lines when the underlying data is a simple `{label, value}`-equivalent pair, regardless of the value's actual key name.
- [ ] No rendered text overflows its containing card/column at 1440px viewport width, on any of the 8 routes audited here.
- [ ] No raw CSS value (`var(--...)`, `1px solid ...`) or icon-class string (`fa-solid fa-...`) appears as visible text on any of the 8 routes audited here.
- [ ] `S9.1/Analyze`'s `Cols` block either no longer renders as a standalone panel, or is measurably smaller than the scatter chart it currently exceeds.
- [ ] No lone, ungrouped scalar block (no eligible sibling) renders a full-width bordered panel taller than its own text.
- [ ] Every wide table (Modes/Slate/Grid, confirmed 6–8 columns) has a visibly obvious way to see it's scrollable, not a silent clip at the container edge.
- [ ] Re-run this same Playwright capture script against the same 8 routes; total content height for `S9.1/Analyze` and `S9.16/Decide` should measurably drop (target: `Cols` block removed/folded saves ≈500px+ on Analyze; `moveBar`/`Details` row-bloat fixes save a measurable, reportable amount on Decide) — report the new numbers next to these ones, not just a claim of improvement.
- [ ] All existing tests continue to pass; no manifest/composeSections/StageSections architectural change is required to satisfy the items above.
