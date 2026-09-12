# Action Stories — Dynamic Composition Implementation Report

Implementation pass following `DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md`. Every fix below is a generic,
shape/signal-driven rule in the shared pipeline — **zero workflow-specific conditionals were added**
anywhere (`if (workflow === "S9.11")` and equivalents do not exist in this diff; see §10 for the
regression test that checks this directly).

---

## 1. Files Changed

**Extraction pipeline:**
- `extraction/parseMockup.js` — new `extractControlElements()`
- `extraction/dcLogicSandbox.js` — raw-record reflection, multi-snapshot control sampling, `attachRawRecords()`, `computeControlPayload()`
- `extraction/extract.js` — wires the above into the fixture-build step
- `extraction/classifyBlocks.js` — identity-key generalization, nested-control detection, gauge detection, reordered table-vs-chart precedence, control-dependency section/grouping
- `extraction/generateManifests.js` — `block.dependencies` generation
- `extraction/audit.js` — updated to understand `__raw` and `gauge` (no more stale false positives from the new schema)

**Manifest schema / runtime:**
- `src/features/action-stories/manifests/blockTypes.js` — new `gauge` blockType + validator
- `src/features/action-stories/manifests/validateManifest.js` — new `block.dependencies` field validation
- `src/features/action-stories/components/StageRenderer.jsx` — override matching keyed by raw fixture key, not slotName
- `src/features/action-stories/layout/composeSections.js` — explicit `layout.group` members no longer need to be adjacent in raw order
- `src/features/action-stories/layout/blockSizing.js` — span heuristic for `gauge`
- `src/features/action-stories/blocks/TableBlock.jsx` — hides internal `__raw`, renders nested-control columns as a real inline control
- `src/features/action-stories/blocks/GaugeBlock.jsx` — new (generic meter/threshold primitive)
- `src/features/action-stories/blocks/index.js` — registers `gauge`
- `src/features/action-stories/blocks/sliderSteps.js` — doc update only (key-convention note)

**Tests (new/updated):**
- `extraction/parseMockup.test.js` (new), `extraction/dcLogicSandbox.test.js` (new)
- `extraction/classifyBlocks.test.js` — +14 tests
- `src/features/action-stories/manifests/blockTypes.test.js`, `validateManifest.test.js` — gauge/dependencies cases
- `src/features/action-stories/layout/composeSections.test.js` — non-adjacent grouping cases
- `src/features/action-stories/manifests/manifestFixtureSweep.test.js` — allowlisted the new `decision` section id
- `src/features/action-stories/s911Decide.e2e.test.jsx` (new) — the canonical 10-point regression test

**Regenerated data (all 105 stage fixtures + all 26 manifests):**
- `src/features/action-stories/data/raw/**/*.json`, `src/features/action-stories/manifests/*.json`, `manifests/REPORT.md`

111 files changed in total (`git diff --stat`).

---

## 2. Extraction Improvements

Root cause (audit §2/§3): extraction snapshotted `renderVals()`'s *formatted output* only, never the reference's raw record model or a control's declared bounds.

- **`extractControlElements(html)`** (`parseMockup.js`) scans the whole mockup file (not just the `<script data-dc-script>` block — the template markup lives elsewhere in the file) for `<input type="range" min=... max=... step=... value="{{ key }}">`, and returns real, un-guessed `{stateKey, min, max, step}`. Never fabricates a bound that isn't literally present.
- **Raw-record reflection** (`dcLogicSandbox.js`): the sandbox now reflects over every zero-arg instance method (e.g. a reference's own `SLATE()`/`SUP()`), calls it safely, and keeps any that returns an array of plain objects. `attachRawRecords()` then matches each such raw array back onto whichever `renderVals()` output array it produced (by name match, then by unique length match) and attaches it as a non-destructive `__raw` companion on each row — the formatted display fields are never touched or removed.
- **Multi-snapshot control sampling**: for every control whose bound state key is confirmed live (direct match, or empirically discovered when the templated value is a *derived* display field — e.g. S9.2's `notchVal` is driven by `state.notch`, not a field literally named `notchVal`), the sandbox re-invokes the reference's own `renderVals()` at several positions across its declared range and records the full output each time.
- **`computeControlPayload()`** diffs those samples (function-values always compare equal — recreated closures are never a real difference) into `{min, max, step, value, dependencies, steps}` — real, measured dependency data, attached directly onto the fixture's own control field so `classifyBlocks.js`'s **already-existing, unmodified** `isSliderShaped()` check picks it up with zero classifier changes.

**Verified, corpus-wide:** all 114 source mockups re-extracted with zero failures. Exactly 3 controls found project-wide (S9.11, S9.2, S9.12 decide) — matching the reference corpus's actual slider count exactly, with 0 false positives. 73 arrays across the corpus received `__raw` attachment.

---

## 3. Classification Improvements

- **Identity-key generalization**: `findIdentityKey()` replaces every hardcoded `.label` check with a small, ordered candidate list (`label, name, title, sku, id, code, product, item, entity, category, role`), falling back to any fully-unique string field when none of those match (≥2 rows only — never invents an identity from one row). This directly fixes the canonical root cause: S9.11's `slate` rows use `name`, not `label`, and previously fell through every `label`-gated branch.
- **Table-vs-chart precedence fixed**: the rich-record/table-promotion check now runs *before* the bar/scatter checks (previously a row with an incidental magnitude-looking field, like slate's `pct`, would win the whole record a bar chart before the table check ever ran). A narrow, explicit exclusion (`x/y/cx/cy/r` — true plot-position fields only, never generic names like `value`/`pct` that are common real business columns) keeps genuine scatter/bar shapes from being swallowed by this reordering.
- **Nested row-level control detection**: a 2–6-item array of `{label, ...}` options nested in an otherwise-scalar row (S9.11's own `slate[].modes`) is recognized structurally and excluded from the scalar-uniformity check — it no longer disqualifies the whole row set from becoming a table.
- **Gauge/threshold detection**: a magnitude field + a sibling threshold/limit/ceiling/floor/target/cap field promotes to a new `gauge` blockType, checked before the generic bar-chart rule.
- **Deferred (documented, not attempted)**: a prose-density negative signal was investigated but **not implemented** — it would have required flipping an existing, deliberately-reviewed test (`S9.1/reason.policy` → `table`) with no reliable, non-fragile threshold to separate it from other shapes (e.g. `notChecks`) with similarly-short note fields. Left as a documented residual (§15) rather than risk a fragile rule with unclear blast radius across 105 fixtures.

**Measured corpus-wide effect** (before → after, via the previously-committed manifests vs. the regenerated ones):

| blockType | Before | After |
|---|---:|---:|
| `table` | 172 | **247** (+75) |
| `slider` | 0 | **3** |
| `gauge` | 0 | **6** |

Specific, previously-flagged cases re-verified directly:

| Case | Before | After |
|---|---|---|
| S9.11/decide `slate` (canonical case) | `barChart` | **`table`** ✅ |
| S9.19/decide `bars` (gauge false-positive) | `table` | **`gauge`** ✅ |
| S9.16/decide `skus` (identity false-negative) | `itemQueue` | still `itemQueue` — **root cause found and is different from expected**: `assets: "none"` collides with `STYLE_KEYWORD_VALUES`'s CSS-keyword `"none"`, stripping that column from only one row and breaking uniformity. Pre-existing classifier limitation, not something this pass introduced or fixed — see §15. |
| S9.1/reason `policy`, `roles` (prose-heavy false positives) | `table` | still `table` — deliberately not touched, see above |
| S9.3/decide `after` | `table` | still `table` — re-investigated: this row set genuinely has a `label` + 6 real business columns (route, before/after cover-weeks, two percentages, a note); the original audit's "just a progress bar" framing described the reference's *visual choice*, not an absence of tabular data. Defensible as-is; not a regression. |

---

## 4. Manifest / Schema Changes

Minimal, as instructed — one new field, not the brief's full 13-field wishlist (most of which were either already present or deliberately not worth adding, per the forensic audit's own §14 analysis):

- **`block.dependencies`** (optional `string[]`): the one new field. Populated only for `slider` blocks with a measured, non-empty dependency set; validated by `validateManifest.js` to reference real slotNames in the same manifest (an invalid reference fails loudly, not silently).
- **`gauge`** added to `BLOCK_TYPES` with its own `validateGauge`.
- Everything else (`slotName`, `binding`, `section`, `role`, `region`, `layout.group`/`span`) is unchanged.

---

## 5. Dependency Model

`computeControlPayload()` (extraction) measures dependencies by literally re-running the reference's own logic at multiple positions and diffing outputs — never inferred from proximity or naming. `generateManifests.js` translates the raw-key dependency list into this manifest's own slotNames and sets `block.dependencies` on the control block. Verified end-to-end for S9.11 (`tol` → 15 real dependent slotNames including `slate`, `liveStats`, `ladder`, `summary`, ...), S9.2 (`notchVal` → 27 dependents), S9.12 (`rlThreshold` → 12 dependents).

---

## 6. Composition Model

- `classifyBlocks.js`'s `planSections()` now also computes control→dependent groups generically (reading a slider block's own resolved `dependencies`, resolved via each block's `binding`) and routes every one of them into a new **`decision`** section (region: main), sharing one `layout.group` — reusing the *existing* explicit-group panel mechanism (previously exercised only by the hero/`recommendation` vocabulary).
- **`composeSections.js` fix**: explicit `layout.group` members previously had to already be *adjacent* in manifest order to fuse into one panel. Since a control's dependents are essentially never adjacent to it in raw fixture-key order, `pullExplicitGroupsAdjacent()` now stably reorders only same-group items to sit together (at the position of the group's first member), leaving every ungrouped item's relative position untouched. This is what makes "shares a `layout.group`" — regardless of manifest order — sufficient for composition, a fully generic mechanism with no workflow awareness.

Verified: S9.11/decide's manifest now has exactly 2 sections — `decision` (tol + 14 real dependents, one shared panel) and `summary` (the 2 unrelated scalars) — instead of the flat, ungrouped list of independent blocks the audit found.

---

## 7. Renderer Additions

- **Real slider interactivity** required no new component — `SliderBlock.jsx` and `StageRenderer.jsx`'s `sliderPositions`/`overrides`/`findNearestStep` mechanism were already fully built and unit-tested, just never exercised by real data. The one change: override lookup is now keyed by the block's own raw fixture key (derived from `binding`) instead of `slotName`, since a `steps` entry (generated at extraction time, before any slotName renaming) is naturally keyed by raw fixture field name.
- **Table row controls**: `TableBlock.jsx` detects a nested `{label,...}`-shaped option array per row (the same structural check as the classifier) and renders it as a real, data-driven segmented control (`RowControl`) — labels come entirely from the row's own data (works identically for "Roll/Test", "Include/Exclude", "Approve/Review", or any other 2–6-option set). Initial selection is seeded from whichever option has the highest `weight` (a convention already present in this reference corpus to mark the active choice), defaulting to the first option otherwise. Selection state is local UI state — clicking changes what's displayed, not a write to the fixture (this pipeline has no live backend to write to; see the audit's own note on this).
- **`__raw` is hidden** from the visible table column list (it's the row's own internal raw-record companion, not a display column).
- **`GaugeBlock.jsx`** (new): a horizontal meter per row with a fill bar and a threshold tick, generic across whatever domain the data represents.

**Not implemented (deferred, documented)**: a compact P10/P90-style "range cell" renderer. Investigated, but every concrete case found (S9.11's own `slate` rows) already has a pre-formatted `vol` display string doing this job; no clean, currently-classified `table` column pair (`p10`/`p90` etc. as *top-level* row fields, not buried in `__raw`) was found in the corpus to justify the added surface area within this pass's time budget.

---

## 8. Layout Improvements

- `composeSections.js`'s adjacency fix (§6) is the substantive layout change this pass made.
- `blockSizing.js` gained a `gaugeSpan` heuristic (half-width for ≤5 rows, full width beyond that), matching the existing pattern for every other block type.
- **Not broadly addressed**: the audit's finding that non-control Execute/Analyze stages often collapse 6–9 reference panels into only 2 generic sections (`summary`/`details`) is **only fixed for control-bearing Decide stages** (which now get a 3rd, `decision` section). Generalizing section granularity for stages with no control (e.g., splitting `details` into narrower semantic buckets for destination-diff cards, event feeds, etc.) was out of this pass's scope — see §15.

---

## 9. Test Results

| | Before this pass | After this pass |
|---|---:|---:|
| Test files | 27 | **30** |
| Tests | 479 | **528** |
| Failures | 0 | **0** |

New test files: `extraction/parseMockup.test.js` (9 tests), `extraction/dcLogicSandbox.test.js` (9 tests), `src/features/action-stories/s911Decide.e2e.test.jsx` (10 tests, the canonical end-to-end regression). Extended: `classifyBlocks.test.js` (+14), `blockTypes.test.js`/`validateManifest.test.js` (gauge + dependencies cases), `composeSections.test.js` (+2 non-adjacency cases). One existing test (`manifestFixtureSweep.test.js`'s section-id allowlist) was updated to include the new `decision` section id — a deliberate, documented schema addition, not a silently-broken assumption.

---

## 10. Build / Lint / Typecheck Results

- `npm run lint` — clean, zero issues.
- `npm run build` — succeeds (Vite production build, all per-stage chunks generated normally).
- No TypeScript in this project (plain JS/JSX) — no typecheck step exists to run.

---

## 11. 105-Fixture Validation Result

`npm run validate-manifests` (re-resolves and re-validates every block in every real manifest against its real fixture): **105 passed, 0 failed, 105 total.**
`npm run generate-manifests`: **0 slot-name collisions, 0 self-check problems, 0 manifest validation problems** across all 1,719 generated blocks.

---

## 12. 228-Reference-Screen Validation Result

**Not exhaustively re-run** — this is an honest limitation, not a claim of completion. What was actually verified:

- Extraction re-ran cleanly against all 114 files in `source-mockups/` (105 real stage files + 9 correctly-skipped shells/duplicates), zero failures.
- The control/slider detection was checked against its true positive rate across the **whole** corpus (3 found, matching the 3 known real reference sliders exactly — S9.11, S9.2, S9.12 decide — with 0 false positives), not just the S9.11 sample.
- A dozen specific cases the original forensic audit's four research passes had individually flagged (across S9.11, S9.16, S9.19, S9.3, S9.20, S9.1) were individually re-checked against the regenerated manifests (§3's table).
- The full, systematic 228-screen-by-screen pattern-inventory methodology the original audit used (sampling ~56 screens in depth via four parallel research agents) was **not re-run** in this implementation pass. Re-running it against the regenerated corpus is the natural next validation step and is called out explicitly in §15.

---

## 13. Before/After Dynamicness Score (L1–L10)

| Level | Before | After | Change |
|---|---:|---:|---|
| L1 — dynamic values | 5 | 5 | — |
| L2 — dynamic block types | 3 | **4** | Table detection materially broadened (identity generalization, nested-control handling, precedence fix); gauge added as a new type |
| L3 — dynamic block ordering | 3 | 3 | Unchanged this pass |
| L4 — dynamic layout | 3 | **3.5** | Non-adjacent explicit grouping now works generically; broad section-granularity gap for non-control stages remains |
| L5 — dynamic styling | 4 | 4 | Unchanged |
| L6 — dynamic controls/actions | 1 | **4** | Real sliders now extracted end-to-end for every real reference control (3/3), with genuine measured dependencies and a working `steps`-driven recompute |
| L7 — dynamic visibility | 2 | 2 | Deliberately not over-built, per the brief's own instruction (§13) |
| L8 — dynamic interaction relationships | 0 | **4** | The audit's single biggest gap — control→dependent-content — now works end-to-end (verified: dragging the slider changes the rendered table) |
| L9 — dynamic workflow/stage configuration | 4 | 4 | Unchanged |
| L10 — fully dynamic screen composition | 2 | **3** | Control+dependents now compose as one real panel generically; broader multi-pattern composition (chart+metrics, narrative+policy, etc. as first-class composition primitives) remains future work |

The two levels the forensic audit called out as the direct mechanism behind the canonical failure — **L6 and L8** — moved the most, from architecturally-present-but-inert to fully working end to end.

---

## 14. Regression Safety

Baseline recorded before any change: 27 test files / 479 tests, clean lint, clean build, 105 committed fixtures/manifests. Checkpoints run after each phase (extraction → classifier → composition/dependency → renderer/layout) per the requested sequence; the classifier-precedence bug (rich-record check swallowing labeled scatter/bar points) was caught and fixed at its own checkpoint, before touching composition. Final state: 30/528 passing, clean lint, clean build, 105/105 fixture validation — zero regressions, only additions.

---

## 15. Remaining Known Limitations

1. **`S9.16/decide.skus` still classifies as `itemQueue`, not `table`.**
   File: `extraction/classifyBlocks.js` (`STYLE_KEYWORD_VALUES` constant, includes bare `"none"`).
   Why: one row's real business value (`assets: "none"`, meaning "no assets planned") collides with the same literal string used elsewhere in this corpus as a CSS `display: none` toggle, so `isPureStyleValue` strips that field from only that one row, breaking cross-row uniformity.
   Architectural or cosmetic: **architectural** — a purely value-based heuristic can't distinguish these two meanings of `"none"` without a key-name signal, which the codebase deliberately avoids for this exact check (to prevent over-fitting to one field name). Recommended next step: a narrower, opt-in heuristic — treat `"none"` as a style value only when the key itself matches a `Show`/`Visible`/`Display`-suffixed vocabulary (a small, generic, key-name-assisted refinement, not a workflow-specific one).

2. **Prose-density card-vs-table discrimination was not implemented** (S9.1/reason's `policy`/`roles`, and similar shapes, still classify as `table` even though the reference renders them as a definition list / card grid).
   File: `extraction/classifyBlocks.js` (the identity-keyed rich-record promotion block).
   Why: a reliable, non-fragile length/prose threshold that separates these from structurally-identical, currently-correct table cases (e.g. `notChecks`) was not found within this pass's budget; flipping the existing, previously-reviewed `policy` test on a shaky threshold risked collateral damage across the corpus.
   Cosmetic (a visual-fidelity gap, not a data-loss or crash risk) — recommended next step: source a genuine visual-form signal (e.g., cross-referencing the actual reference screen's own DOM shape at generation time, when available) rather than trying to infer "prose-heavy" from string length alone.

3. **Range/uncertainty-pair compact cell rendering (P10–P90 style) was not implemented.**
   File: would live in `src/features/action-stories/blocks/TableBlock.jsx`.
   Why: no concrete corpus case needing it was found beyond S9.11's `slate`, which already has this pre-formatted into a display string (`vol`). Cosmetic — recommended next step: implement if/when a table with raw, unformatted `p10`/`p90`-style sibling columns is found in a future workflow.

4. **Row-level control interactivity is local-only, not persisted.**
   File: `src/features/action-stories/blocks/TableBlock.jsx` (`RowControl`).
   Why: there is no live backend to write a selection to (matches the rest of this app's own documented state — see `StageActionBar`'s own real-but-`localStorage`-backed mutation). Architectural, by design, not a gap this pass could or should have closed alone.

5. **Section granularity is only improved for control-bearing (Decide) stages.** Non-control stages (many Execute/Analyze stages) still often collapse into 2 generic sections where the reference shows more.
   File: `extraction/classifyBlocks.js` (`SECTION_ORDER`/`sectionIdFor`).
   Why: out of this pass's scope, given the size of the remaining work already completed; the audit's own §21 sequencing places this after the dependency/composition work done here.
   Cosmetic/architectural mix — recommended next step: add 1–2 more generic section buckets keyed on blockType/shape combinations already used for `analysis`/`rollup` (e.g., a `execution` bucket for itemQueue blocks shaped like nested destination/diff cards).

6. **The full 228-reference-screen forensic methodology was not re-run** (see §12) — recommended as the next validation step before considering this work "done" in the sense the original audit's Definition of Done describes.

None of these limitations involve a workflow-specific conditional, a hardcoded SKU/column list, or any of the explicitly forbidden anti-patterns — each is a genuine, generic-rule gap, documented so the next pass can address it deliberately rather than rediscover it.
