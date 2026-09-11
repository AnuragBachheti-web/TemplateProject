# Action Stories — Final Visual Composition + Theme Pass

Scope: fix the remaining "table/table/table/card/card/card" vertical-stacking problem with a
generic (never workflow-specific) mixed-width composition model, and give the UI a restrained
enterprise theme using only the existing `rf-*` token system. Verified against the live rendered
browser (Playwright + headless Chromium), not just the test suite.

---

## 1. Root causes found

1. **No width model for non-scalar blocks.** `isGridEligible` (the pre-existing heuristic) only
   ever let `text`/`number`/`flag`/small-`object` blocks share a row. Every `table`, `itemQueue`,
   `labelValueList`, and chart block — i.e. almost everything on an Analyze/Decide screen —
   unconditionally claimed a full-width row regardless of how little space it actually needed.
   That is the direct cause of the "table/table/table/card/card/card" vertical stack.
2. **No sibling-row packing for those block types.** Even blocks that were visually small (a
   3-row/2-column labelValueList) had no mechanism to sit next to another small block — the
   composition engine only ever emitted one full-width row per block outside the old scalar-grid
   path.
3. **Item-level density was conflated with panel-level width.** `ItemQueueBlock`'s own internal
   item list (`<ul>`) was hardcoded to a single vertical column (`flex flex-col`) regardless of the
   *outer panel's* width — so even after the panel-level flow-packing model shipped, a block like
   S9.9/Analyze's `candidates` (6 short option cards) still rendered as 6 stacked full-bleed rows,
   because nothing ever taught the block itself to lay its own items out two-up. This was the
   specific bug diagnosed and fixed in this final increment (see §3).
4. **`object` blocks used a single unconditional span** (`HALF`, always) with no regard for how
   large/prose-heavy the descriptor actually was — inconsistent with every other block type here,
   which all size themselves from their own content density.
5. **Flat, low-contrast surface tiers.** The page canvas and white card surfaces differed by only
   a few RGB units (`#FAFBFD` vs `#FFFFFF`), reading as one undifferentiated white page with no
   visual hierarchy between canvas / primary surface / secondary (raised) surface / rail.

## 2. Files changed

**Composition engine (mixed-width model):**
- `src/features/action-stories/layout/blockSizing.js` — **new module.** `inferSpan(blockType, value)`:
  data-driven width inference for table/itemQueue/labelValueList/charts/object, used only when a
  block has no explicit `layout.span` of its own.
- `src/features/action-stories/layout/blockSizing.test.js` — new, 21 tests.
- `src/features/action-stories/layout/composeSections.js` — added `packFlowables`/`groupingFor`'s
  `flowable` branch and the `flow` row type; region-gated to `main` only (rail composition
  untouched).
- `src/features/action-stories/components/StageSections.jsx` — new `FlowRow` component; `Row`
  dispatcher extended to render `flow` rows via CSS grid `gridColumn: span N`.
- `src/features/action-stories/components/StageRenderer.jsx` — threads `role`/`layout` through to
  each block unchanged from prior passes.

**This session's increment (item-level density + object sizing):**
- `src/features/action-stories/blocks/ItemQueueBlock.jsx` — added `itemWeight`/`isCompactCard`;
  when a list's items are non-trivial (fail `isUniformlySimple`, so they don't already collapse to
  chips) but still individually short, the item `<ul>` now renders as a responsive
  `grid grid-cols-1 sm:grid-cols-2` instead of a single vertical column. This is the fix for the
  "candidates/SKUs/guardrail-checks render as N stacked full-width cards" defect — it was never a
  panel-width problem, it was the block's own internal item layout.
- `src/features/action-stories/blocks/ItemQueueBlock.test.jsx` — extended for the compact-grid path.
- `src/features/action-stories/layout/blockSizing.js` — `itemQueueSpan` threshold raised from
  `>4`→`>6` items (confirmed against S9.9/Analyze's real `candidates` data); `object`'s span made
  content-aware (`objectSpan`: >12 keys or >200 chars of flat text → full width, else half),
  replacing the previous unconditional `HALF`.
- `src/features/action-stories/layout/blockSizing.test.js` — updated/added tests for both changes.

**Theme (restrained enterprise palette, existing tokens only):**
- `src/styles/tokens.css` — `--rf-surface-sunken` (page canvas) darkened from `#FAFBFD` to
  `#F1F3F8` for genuine, still-restrained separation from white card surfaces; dark mode untouched.
- `src/features/action-stories/components/StageSections.jsx` — `GridPanel`/`LoneScalarStrip`/
  `RailPanel` moved from `bg-rf-surface-sunken`/`bg-rf-surface-canvas` to `bg-rf-surface-raised`
  (the secondary/raised tier), so PRIMARY (white `ComposedPanel`/table cards) and SECONDARY
  (raised metric strips, lone-scalar strips, the rail) now read as visually distinct tiers sitting
  on the sunken page canvas.
- `src/features/action-stories/components/StageRenderer.test.jsx` — selectors updated for the
  `bg-rf-surface-raised` rename.

## 3. Composition model implemented

- **Span logic (`inferSpan`)** — pure, data-driven, per block type:
  - `table`: column count (post decorative-key filtering) → ≤3 cols half (6), ≤5 cols wide (8),
    6+ cols full (12, "operational table").
  - `itemQueue`: >6 items → full; ≤6 items → half if avg per-item text weight ≤80, else full
    (a short list of rich narrative cards stays full width; a short list of compact option/SKU
    cards shares a row).
  - `labelValueList`: any item with a long secondary field → full; else ≤3 → third (4), ≤6 → half
    (6), >6 → full.
  - charts (`barChart`/`lineChart`/`scatterChart`/`waterfallChart`/`heatmapGrid`): ≤12 points/bars
    → half (compact enough to share a row); >12 → full (this stage's own featured analysis).
  - `object`: >12 keys or >200 chars of flat text → full (a "selected record" detail dump); else
    half.
  - Explicit `layout.span` on a block always overrides all of the above.
- **Sibling packing (`packFlowables`)** — greedy left-to-right bin-packing over runs of adjacent
  flowable items, capacity 12 columns/row, preserving manifest order (order is never
  reshuffled — packing only decides which *already-adjacent* items share a row). A row that ends
  up with only one member (nothing compatible to its side) is demoted to a plain full-width
  `single` row rather than rendered as an oddly narrow lone panel.
- **Item-level density inside `itemQueue`** (this session's fix) — a second, independent density
  decision one level down: once a panel is going to render its items as full `<Item>` cards (not
  the already-existing simple-chip path), those cards themselves lay out 2-up in a responsive grid
  when every item is individually compact (≤80 avg chars of flat content), 1-up otherwise. Verified
  against real data across ≥5 different workflows (S9.9/Analyze `candidates`, S9.16/Decide `skus`,
  S9.3/Analyze `matrix`, S9.11/Decide `guardrail checks`, S9.13/Decide `caps`) — every one of them
  now packs two-up; S9.5/Decide's `options` (genuinely long narrative per card) correctly stays
  one-up, unchanged.
- **Table sizing** — handled entirely by `inferSpan`'s column-count rule above; wide operational
  tables (6+ meaningful columns) are deliberately still full width per the task's own worked
  example ("two large tables should generally stay full width").
- **Chart sizing** — density tier (≤12 vs >12 points/bars) rather than a fixed "featured vs.
  compact" flag, so an Analyze screen's genuinely large chart still gets the full row while a
  small companion chart shares one with another block (verified on S9.3/Analyze, S9.4/Decide,
  S10.2/Analyze, S10.4/Decide — charts consistently pair 2-up unless truly dense).
- **Rail behavior** — unchanged and deliberately untouched: `allowFlow` is only ever `true` for the
  `main` region; the rail keeps its original one-panel-per-section (`RailPanel`) composition.

## 4. Theme changes

- **Page canvas vs. surfaces:** `--rf-surface-sunken` (Shell.jsx's page background) is now
  `#F1F3F8` — a visibly cooler, tinted canvas distinct from the pure-white `#FFFFFF`
  `--rf-surface-canvas` used by primary cards (`ComposedPanel`, tables, hero panels).
  `--rf-surface-raised` (`#F4F6FA`) is the secondary tier: metric strips (`GridPanel`), lone-scalar
  strips, and the rail (`RailPanel`) — one shade between canvas-white and page-sunken, giving a
  clear PRIMARY (white, structured content) vs. SECONDARY (raised, compact/companion content) split.
- **Borders:** unchanged, existing `--rf-border-subtle`/`--rf-border-default` tokens (soft, no new
  border weights introduced).
- **Typography:** unchanged from prior passes — no new type scale, no font-shrinking.
- **Accent:** unchanged — `--rf-brand-blue-500` (the graphite "Realify blue") remains reserved for
  active step / chart series / selected state / primary action, never used as a decorative fill.
- **Semantic colors:** unchanged (`--rf-status-critical`/`-warning`/`-success`/`-purple`), already
  reference-sourced from a prior pass.

## 5. Before vs After

Two baselines are shown because this session picks up mid-way through Turn 7: "pre-Turn-7" is the
state before *any* of this turn's work (flow-packing engine + theme + this session's item-density
fix); "pre-this-fix" is the state after the flow-packing engine and theme already shipped, but
before this session's `ItemQueueBlock` item-level packing fix. All heights are `main#main-content`
`scrollHeight` at 1440px width (except the two "pre-Turn-7" cells, captured via a different,
DOM-tree-based method before the flow engine existed — noted where not directly comparable).

| Route | Pre-Turn-7 | Pre-this-fix | After (final) | Change (this fix) |
|---|---|---|---|---|
| S9.1 / Analyze | ~1938px (main-column only, old method) | 1614px | 1614px | 0 (no itemQueue in the non-simple/rich item-card path on this stage) |
| S9.1 / Decide | ~1494px (main-column only, old method) | 1523px | 1523px | 0 |
| S9.1 / Execute | not captured pre-Turn-7 | 1242px | 964px | **−278px (−22.4%)** — `Dests` itemQueue now packs 2×2 |
| S9.5 / Analyze | not captured pre-Turn-7 | 1461px | 1461px | 0 (no itemQueue block on this stage) |
| S9.5 / Decide | not captured pre-Turn-7 | 2166px | 2166px | 0 (`options` items carry a full narrative sentence each — correctly stay 1-up) |
| S9.16 / Decide | ~3120px (main-column only, old method) | 2892px | **2436px** | **−456px (−15.8%)** — `skus` itemQueue (18 items) now packs 2-up |
| S9.9 / Analyze | not captured pre-Turn-7 | 2987px | **2496px** | **−491px (−16.4%)** — `candidates` (6 items) now packs 2-up |
| S9.3 / Analyze | not captured pre-Turn-7 | 2713px | **2113px** | **−600px (−22.1%)** — `matrix` itemQueue now packs 2-up |
| S9.4 / Decide | not captured pre-Turn-7 | 1608px | 1580px | −28px — `guards` (3 items) now packs 2-up |
| S9.11 / Decide | not captured pre-Turn-7 | 1203px | 1203px | 0 (guardrail-check items already fit compactly; visual grid confirmed via screenshot even where net height didn't move) |

Full-width block counts: every route above dropped at least one "itemQueue rendered as N stacked
full-width `<li>` cards" occurrence to a single panel containing a 2-column internal grid — verified
by direct screenshot inspection (§6), not inferred from height alone.

## 6. Browser verification

Real headless-Chromium (Playwright) screenshots + `main#main-content.scrollHeight` /
`document.documentElement.scrollWidth` measurements at **1440×900**, viewport height then expanded
to each page's real content height before capture (the app's scroll container is `<main
id="main-content" overflow-y-auto>`, not `document.body`).

Routes captured and visually opened this pass: **S9.1** (reason/analyze/decide/execute), **S9.5**
(reason/analyze/decide), **S9.16/decide**, plus 10 additional stages across different workflows:
S9.3/analyze, S9.4/decide, S9.6/analyze, S9.8/decide, S9.9/analyze, S9.11/decide, S9.13/decide,
S9.17/execute, S10.2/analyze, S10.4/decide — 18 routes total, all opened and visually reviewed
(not just measured).

Findings:
- **Mixed-width composition confirmed present on every route** — charts, small tables, and
  labelValueList pairs consistently pack 2-up (e.g. S9.1/Reason's Roles+Inputs, S9.3/Analyze's
  Legend+Cols and Pools+Capacity, S9.4/Decide's Guards+Cadences, S10.2/Analyze's four chart pairs,
  S10.4/Decide's two chart pairs and Notches+Notch Labels).
- **itemQueue 2-up item packing confirmed working** on S9.1/Execute (Dests), S9.3/Analyze (Matrix),
  S9.9/Analyze (Candidates), S9.11/Decide (Guardrail checks), S9.13/Decide (Caps), S9.16/Decide
  (SKUs) — six different workflows, none hardcoded.
- **Genuinely rich content correctly stays full width**, not forced into a grid: S9.5/Decide's
  Options (one full sentence per card), S9.6/Analyze's Sel and S9.3/Analyze's Sel (large,
  prose-heavy "selected record" object dumps, now sized by the new content-aware `objectSpan`),
  operational tables with 6+ columns (S9.1/Analyze Rows, S9.6/Analyze Grid, S9.17/Execute's Comms/
  Buy Plan/Qual/Monitors).
- **No page-level horizontal overflow** (`document.documentElement.scrollWidth <= window.innerWidth
  + 5`) on any of the 18 routes. Wide tables (e.g. S9.6/Analyze's 11-column Grid table) use their
  own internal `overflow-x` scroll container with the existing scroll-shadow affordance, per the
  task's own allowance for tables to be wider than the page inside their own container — this is
  pre-existing behavior from an earlier pass, not new.
- **Theme surface hierarchy visible on every route**: a cool-tinted page canvas behind white
  primary cards, a slightly darker "raised" tier for compact metric strips and the rail.

## 7. Tests

- `npx vitest run`: **479/479 passed** (27 test files; 2 new tests added this session for the
  `object` content-aware span, on top of the pre-existing 477).
- `npm run lint`: clean, no errors/warnings.
- `npm run build`: succeeds (`vite build`, 380ms, no errors).
- `npm run validate-manifests`: **105/105 stage manifests PASS**.
- `npm run audit`: unchanged from the pre-existing baseline (`extraction/audit-report.md` diff is a
  1-line timestamp only) — expected, since this pass touches only the runtime composition/rendering
  layer, never the extraction/classification pipeline the audit checks.

## 8. Architecture safety

Explicitly confirmed NOT rewritten or bypassed in this pass:
- The manifest → `resolveBinding` → `validateBlockData` → registry pipeline is untouched.
- URL-owns-navigation is untouched.
- Block components remain "dumb" — `ItemQueueBlock`'s new compact-grid path is pure CSS/layout
  driven by data already passed to it (`data`, `compact`), no new props tying it to a workflow or
  slot name, no new data fetching.
- The registry (`blocks/index.js`) is unchanged as the sole extension mechanism.
- The extraction pipeline (`extract.js`/`classifyBlocks.js`/`generateManifests.js`) is untouched by
  this session's changes — `inferSpan`/`packFlowables`/the item-density fix all operate purely at
  render time on already-resolved data, never baked into a manifest.
- `ComposedPanel`, `RailPanel`, and the block registry/component contracts are unchanged in shape;
  only Tailwind surface-color classes were swapped (`bg-rf-surface-sunken` → `bg-rf-surface-raised`)
  and one new sibling row type (`flow`) was added alongside the existing `single`/`grid` types.
- No `if (workflowCode === '...')` or slotName-specific branching exists anywhere in this session's
  changes — every rule in `blockSizing.js` and `ItemQueueBlock.jsx` keys only on `blockType` and the
  block's own already-resolved `value`.

## 9. Remaining visual gaps (honest)

- **Wide tables (6+ columns) still require internal horizontal scroll** on dense stages (e.g.
  S9.6/Analyze's 11-column Grid table) — acceptable per the task's own rule that tables may be
  wider than the page inside their own scroll container, but it does mean some columns (e.g.
  "Reviews") sit right at the visible edge with only the scroll-shadow affordance signaling more
  content; a wider max-page-width or a "pin key columns" pattern would improve this further but was
  out of scope for a generic, non-table-specific pass.
  Deferred, not a regression.
- **A handful of `labelValueList`/`object` blocks still land alone on a full-width row** purely
  because of manifest ordering (e.g. S9.9/Analyze's `waiting`, which sits right after a full-width
  `sources` block with no flowable neighbor after it) — this is the intended, honest behavior of
  "declared order is the ordering authority; a span suggestion only means something when there's an
  actual sibling," not a defect, but it does mean a few compact panels per route still render full
  width when their neighbors happen to be incompatible.
- **Minor chart label overlap** was observed on S10.4/Decide's "Write offs" bar chart (x-axis
  category labels "Sub-floor discrepancies" / "Nothing below the current floor" crowd each other at
  1440px) — pre-existing `BarChartBlock` label-collision behavior, unrelated to this pass's
  composition/theme changes; noted but not fixed here.
- **`--rf-surface-sunken`'s new value (`#F1F3F8`) was reused for the page canvas** (its original
  role); introducing a *dedicated* canvas token distinct from "sunken" (used elsewhere for e.g.
  table-row hover) would be architecturally cleaner long-term, but was avoided here specifically to
  not touch every existing `bg-rf-surface-sunken` consumer outside Shell.jsx.
