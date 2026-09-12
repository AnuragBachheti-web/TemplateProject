# Dynamic UI Polish — Implementation Report

Follow-on to `DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md` → `DYNAMIC_COMPOSITION_IMPLEMENTATION_REPORT.md` →
`DYNAMIC_COMPOSITION_PHASE2_REPORT.md`. Scoped, per explicit user confirmation, as a **targeted
punch-list against the project's own already-documented open gaps** rather than a from-scratch
re-attempt of the full brief — most of the brief's 31 sections describe a dynamic-composition
architecture (semantic classification, content-aware sizing, CSS-grid main/rail layout, no
workflow-specific hardcoding) that Phase 1/Phase 2 already built and unit-tested (553 tests). This
pass fixes concrete, evidence-based remaining issues and is honest, per the brief's own §31/§30
instruction, about what could and could not be validated in the time available.

**Headline finding this pass, stated up front because it changes how the rest of this report reads:**
the project's own diagnostic tooling (`extraction/audit.js`) was itself buggy and had been
over-reporting problems. After fixing it, real "data loss" in the app is **0**, not the 42 the last
report cited — and a new structural measurement (not previously run) shows the "card wall" problem
is already ~71% solved in the current architecture, not the wall-to-wall problem the (also stale)
`audit-report.md` B.1/B.2 metrics implied. See §1 and §3.

---

## 0. What was NOT done, and why (stated up front, not buried)

**Live visual/pixel QA was not performed.** The `claude-in-chrome` browser extension was not
connected for the duration of this session (the same blocker `DYNAMIC_COMPOSITION_PHASE2_REPORT.md`
§G.7 hit) — the user opted to try connecting it, but it never came online during the session. A dev
server was started and left running at `http://localhost:5184/` for direct inspection. Every finding
in this report is **structural** (manifest JSON + `composeSections.js`'s real output, computed
programmatically — not a visual guess) or **static-analysis-based** (grep, the test suite, the
audit tool), never a pixel measurement. This is the single largest gap in this pass's own validation
— see §7.

Not attempted, matching decisions already made and documented by the two prior sessions (repeating
this work without new information to justify revisiting it would have been speculative, not
evidence-based):
- Re-attempting chart+table pairing composition (built, measured 1/5 correct, reverted — Phase 2 §B.3).
- Building a prose-density/visual-form signal to further tighten table-vs-card classification (Phase 1
  explicitly declined this for fragility; Phase 2 confirmed the decision still holds).
- Lowering `MIN_BLOCKS_TO_SECTION` (9) to shrink the 20/105 zero-section stages — both prior sessions
  declined this as too risky to re-validate in the time available; this pass had even less time
  after the audit-tool investigation and made the same call.

---

## 1. Root-cause finding: the audit tool itself was the bug

Re-ran `npm run audit` at the start of this pass (before any code changes) to get current ground
truth: it reported **830 issues, including 42 "data loss" (orphaned raw key) findings**. Traced
every one of the 42: **all 42 were false positives**, caused by two stale, drifted local copies of
logic inside `extraction/audit.js` that no longer matched the real generation pipeline
(`extraction/classifyBlocks.js`):

1. `audit.js`'s own `isPureStyleValue` was missing the FontAwesome-glyph-name and border-shorthand
   regex patterns that `classifyBlocks.js`'s real (already-fixed, per
   `RENDERED_UI_FORENSIC_AUDIT.md` §3.5/§8) version has carried for a prior session already — so a
   field like `data.pushAllIcon: "fa-solid fa-paper-plane"` was correctly excluded by the real
   pipeline, but the audit tool didn't know that and flagged it as an "orphaned" field the real
   pipeline was silently dropping. Responsible for ~39 of the 42 findings (every `*Icon` key).
2. `audit.js`'s A.3 orphaned-key check had no knowledge at all of `findMetadataDescriptorSlots` — the
   real pipeline's deliberate suppression of a `cols`-style column-descriptor array that duplicates a
   sibling table's own headers (`RENDERED_UI_FORENSIC_AUDIT.md` §3.1/§5's fix). Responsible for the
   remaining 3 (`cols`, ×3 workflows).

**Fix:** `extraction/audit.js` now imports `isPureStyleValue`, `isDecorativeKey`,
`planSlotNames`, and `findMetadataDescriptorSlots` directly from `classifyBlocks.js` instead of
maintaining separate, drifting copies — and its A.3 check now replicates the real
`planSlotNames → classifyBlockType → findMetadataDescriptorSlots` pipeline exactly before deciding
whether a key is a genuine orphan. Also exported `isDecorativeKey` from `classifyBlocks.js` (it was
previously module-private) so `audit.js` could stop carrying its own second copy of that function too
— that copy still had the old trailing-suffix-only regex the real one was fixed to replace (a
different, already-documented bug: `dotInner` doesn't match a suffix-only pattern for "dot").

**Result:** `npm run audit` now reports **0 data-loss findings** (down from 42), confirmed by
re-running after the fix. Total issue count: 787 (down from 830), all remaining issues either
misclassification (22, see §4) or the B.1/B.2 layout-density metric, which §3 below shows is itself
measuring something disconnected from the real, composed layout.

Files: `extraction/audit.js`, `extraction/classifyBlocks.js` (one `export` keyword added).

---

## 2. What this means for the brief's data-richness requirements (§4/§5/§25/§26)

The brief asks to audit fixture richness and recover any structure the raw source has that the
current pipeline loses. With data loss now measured at 0 (not a guess — every one of the 105
fixtures × every raw key was checked against what the real pipeline actually binds), there is no
currently-known content being silently dropped between the raw `.dc.html` reference and the rendered
manifest. The architecture-mapping investigation this pass ran independently confirmed the fixtures
are already rich (median 21 top-level `data` keys per stage, max 60; real structured arrays of
records, not placeholders) — the three structural handicaps that remain (numbers arrive as
pre-formatted display strings; styling is interleaved as first-class fields, filtered at
classification time; chart data is SVG pixel geometry re-derived into Cartesian values) are
unchanged from the prior session's own findings and are extraction-format limitations, not a
regression this pass could or should "fix" by inventing filler data (the brief's own §25 explicitly
forbids that).

---

## 3. Card-wall / layout-density: real measurement, not the stale audit metric

`extraction/audit.js`'s B.1/B.2 checks (scalar-block density, full-width waste) operate on the flat
`manifest.blocks` list — they have **no knowledge of `composeSections.js`'s actual grouping logic**
(GridPanel metric-strips, ComposedPanel, FlowRow mixed-width packing) at all. So a stage where 12 of
15 blocks are classified as scalar `text`/`flag` still gets flagged as "62 stages over 40% scalar
density" by that check, even when the real, composed layout has already grouped 10 of those 12 into
two 4-wide metric-strip rows. That check was measuring the *input* to the layout system, not the
*output* — the same category of staleness as §1's bug, just in the layout-density check instead of
the data-loss check.

To get an honest, current number, this pass wrote a one-off script (not committed — see §6) that
runs the real `composeSections()` function against all 105 manifests + their raw fixtures (the exact
same function `StageRenderer.jsx` calls at runtime) and measures what actually happens to every
block:

| Metric | Value |
|---|---:|
| Total blocks (105 stages) | 1,719 |
| Rendered as an isolated full-width `single` row | 495 (28.8%) |
| Rendered sharing a row (GridPanel / ComposedPanel / FlowRow) | 1,224 (71.2%) |
| Stages with ≥6 blocks and **zero** grouping (worst-case card-wall) | **0** |

**Conclusion: the "wall of full-width cards" problem the brief describes is already resolved for
~71% of all content, and there is no stage anywhere in the 105-screen corpus that is an unmitigated
card wall today.** This directly contradicts what the stale `audit-report.md` B.1 section still says
("62 stages... group consecutive blocks into a grid row in `StageRenderer.jsx`") — that advice
describes an architecture (`StageRenderer.jsx` doing layout) that was replaced by
`composeSections.js`/`StageSections.jsx` in a prior session; the audit tool's B.1/B.2 checks and their
prose were never updated to know that. **This is flagged, not fixed** — re-deriving B.1/B.2 to run
against real composed output (instead of raw block count) is a reasonable follow-up but is a second,
separate change to the audit tool, not attempted this pass given the time already spent on §1.

A second measurement from the same script: also checked whether any `role: "hero"` block (a stage's
own promoted headline/rationale) ever lands inside a multi-item heuristic GridPanel row — a genuine
plausible risk (`isGridEligible('text', …)` has no length check, so nothing in the composition logic
*inherently* prevents a full sentence from being squeezed into a narrow metric-strip column next to a
short flag value). **Result: 0 of 105 stages hit this.** In practice, hero-eligible blocks never end
up adjacent to a run of other grid-eligible scalars in the real fixture data. Investigated and ruled
out, not assumed — `TextBlock.jsx` does have deliberate, documented handling for this case
(`compact` hero rendering, no nested card) if it ever does occur with different data.

A third measurement: table column counts (after the same decorative-key filtering `TableBlock.jsx`
itself applies at render time — an earlier, uncorrected pass of this same script over-counted by
including decorative fields like `tone`/`icon` as "columns," the same class of mistake as §1).
**30 of 175 table blocks have 8+ real columns** (max 15, `S9.4/decide.slate`). `TableBlock.jsx`
already has horizontal-scroll + scroll-shadow-affordance handling for this (confirmed in code, not
assumed — `overflow-x-auto`, edge-fade indicators). Whether a 15-column table reads well inside that
scroll region at real screen widths is a **visual** question this pass could not confirm without the
browser — flagged as the top follow-up item in §7, not claimed as either fixed or broken.

Files: no production files changed for this section — it's a measurement, reported honestly rather
than acted on blindly, per the brief's own §29/§30 ("do not claim perfection without validation").

---

## 4. Typography consistency (brief §20/§21): eyebrow-label consolidation

The architecture-mapping investigation found the color token layer (`tokens.css`) is consumed
consistently everywhere, but five block components — `GaugeBlock.jsx`, `BarChartBlock.jsx`,
`LabelValueListBlock.jsx`, `ItemQueueBlock.jsx`, `ObjectBlock.jsx` — each carried their own,
near-identical copy of the same "compact-mode slot-name eyebrow" markup
(`font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary`), two of them (`GaugeBlock`,
`ObjectBlock`) with a stray `mb-1.5` where the other three used `mb-1` — a small, real inconsistency,
not a stylistic choice.

**Fix:** extracted one shared `CompactEyebrow` component into `BlockCard.jsx` (alongside the existing
`BlockTitle`), and updated all five call sites to use it. Normalizes the `mb-1`/`mb-1.5` inconsistency
to `mb-1` (the majority value) and gives this pattern one place to change in the future instead of
five. Deliberately kept as its own primitive rather than merged into `BlockTitle` — it's a real,
documented, different variant (tertiary vs. secondary text color, 0.1em vs. 0.14em tracking, a `<p>`
labeling a block's own compact content vs. an `<h3>` heading a whole card).

This is a small, mechanical, value-preserving change (verified: identical computed styles for 3 of 5
call sites, a 0.5px-margin normalization for the other 2) — not a visible redesign. The larger
typography/spacing token-consumption gap the architecture map found (blocks hardcode Tailwind
arbitrary values like `text-[12.5px]` rather than referencing `realify-tokens.css`'s `--text-*` CSS
custom properties) was investigated but **not** further touched this pass: the reference mockups'
real type scale (independently extracted this pass — see §5) uses half-pixel granularity
(9.5/10.5/11.5/12.5/13.5px) the existing token scale doesn't define at all, so wiring the *existing*
tokens through would either be a no-op (values already match) or require first deciding a new,
extended token scale — a design-system decision worth a deliberate follow-up, not a same-pass
mechanical edit under time pressure.

Files: `src/features/action-stories/blocks/BlockCard.jsx`,
`GaugeBlock.jsx`, `BarChartBlock.jsx`, `LabelValueListBlock.jsx`, `ItemQueueBlock.jsx`, `ObjectBlock.jsx`.

---

## 5. Reference design-language spec (recovered, not yet applied)

Independently extracted a concrete, values-based design-language spec from the reference
`source-mockups/*.dc.html` corpus (7 files read structurally + corpus-wide `grep` frequency counts
across all 114) — colors with usage-frequency ranking, the real typography scale (10px is the single
most common size; half-pixel sizes are pervasive and deliberate), the real spacing rhythm (14px
section gaps, not a clean 4/8/16 scale), and — most actionable — a precise **"five container idioms"
rule** for when the reference gives something a full bordered card vs. a borderless block vs. an
inset panel ("borders separate *kinds* of content, not *instances* of content"), plus the exact CSS
recipe for its signature anti-card-wall pattern (the 1px-gap "hairline-mullion" KPI strip). This is
now available for the next pass to calibrate against; it was not applied to component code this pass
(no time remaining after §1–§4, and applying it safely needs the visual QA §7 flags as missing, to
confirm each change actually moves the render toward the reference instead of just matching numbers
on paper).

---

## 6. 105-screen structural validation

Ran, this pass: `npm run validate-manifests` (105/105 PASS — unchanged), `npm run audit` (see §1),
and a new one-off structural script (not committed — see below) that runs `composeSections()` against
every one of the 105 manifests × their real fixture data and inspects the actual output (§3's
numbers). This covers all 105 screens **structurally** — every stage's row/section composition was
inspected — but is not a substitute for the visual review §7 flags as not done.

The structural script itself was **not committed** — it was a diagnostic tool for this report, not a
piece of the tested pipeline, and duplicating `composeSections.js`'s test coverage in a second
untested script would itself be a small instance of the "two copies drift" bug this whole report
opens with. If a future pass wants this measurement to stay available, the right home for it is a
real test file (e.g. `layout/composedLayoutDensity.test.js`) with assertions, not a scratch script —
flagged as a possible follow-up, not done here.

---

## 7. Remaining limitations (stated plainly, per the brief's own §30/§31 instruction)

1. **No live visual/pixel QA was performed anywhere in this pass.** The browser extension never
   connected during the session despite the user attempting to enable it. Every finding above is
   structural or static. **This is the most important gap in this report's own validation** — the
   brief's §29 explicitly asks for exactly this, and it's the one thing this pass could not do.
   **Recommended next step:** re-run with the extension connected, spot-checking the representative
   screens this session had already selected (Reason/Analyze/Decide/Execute mix, varying density) —
   in particular the 30 wide-table stages flagged in §3 and a couple of the 20 zero-section stages —
   against the reference mockups.
2. **The B.1/B.2 audit-tool metrics are still measuring the wrong thing** (raw block count, not
   composed layout — see §3). Not fixed this pass; a real fix would re-derive those two checks to run
   against `composeSections()`'s actual output the way this pass's one-off script did, then delete
   the misleading prose in `audit-report.md`'s B.1 section that still recommends changes to
   `StageRenderer.jsx` (a file that no longer does layout at all).
3. **20 of 105 screens still generate zero manifest sections** (`MIN_BLOCKS_TO_SECTION = 9`,
   unchanged — third session in a row to leave this specific constant alone, each for the same
   reason: re-validating its effect on the ~85 already-sectioned stages doesn't fit in the time
   available once discovered). Not a rendering bug — an unsectioned stage still renders correctly
   (one implicit main-region bucket) — but coarser than the reference's 6-9 panel granularity.
4. **The pre-existing chart/table type-inversions** (`S10.4/execute.cases`, `S9.12/analyze.disposition`
   typed `lineChart` when they're genuine tables; `S9.17/analyze.heat`, `S9.18/analyze.zoneBars` typed
   `table` when they're genuine charts) that Phase 2 §G.6 catalogued are unchanged — not attempted
   this pass, consistent with both prior sessions' judgment that a safe, generalizable fix needs a
   real visual-form signal neither session was willing to build under time pressure.
5. **Typography/spacing token consumption** (§4) is diagnosed and partially addressed (one
   consolidation) but not comprehensively wired through — extending `realify-tokens.css`'s type scale
   to match the reference's real half-pixel granularity (§5), then wiring block components to
   reference it via `tailwind.config.js`'s `fontSize` extension (following the existing
   `maxWidth.page` precedent), is a real, scoped follow-up this pass identified but did not execute.
6. **The reference design-language spec (§5) is recovered but not yet compared against the running
   app's actual rendered output** — that comparison is exactly what item 1's visual QA would do.

---

## 8. Test / build / lint status

| | Before this pass | After this pass |
|---|---:|---:|
| Test files | 31 | 31 |
| Tests | 553 | **553 passed** |
| Lint | clean | **clean** |
| Build | succeeds | **succeeds** |
| `validate-manifests` | 105/105 | **105/105** |
| `npm run audit` — data loss | 42 (false positives) | **0** |
| `npm run audit` — misclassification | 22-23 | 22 (unchanged, see §7.4) |
| `npm run audit` — layout-only | 765 | 765 (metric itself flagged as stale, §3) |

No test was added or modified this pass (the audit-tool fix and the eyebrow consolidation are both
covered by existing behavior the test suite already exercises — `manifestFixtureSweep.test.js` for
every real manifest, `composeSections.test.js`/`s91CompositionTree.test.js` for the real composed
layout, block-level `.test.jsx` files for rendered output shape) — no regression, and no new
behavior that specifically needed its own new test.

---

## 9. Exact files changed

- `extraction/audit.js` — A.3 orphaned-key check now replicates the real
  `planSlotNames → classifyBlockType → findMetadataDescriptorSlots` pipeline; imports
  `isPureStyleValue`/`isDecorativeKey`/`planSlotNames`/`findMetadataDescriptorSlots` from
  `classifyBlocks.js` instead of maintaining stale local duplicates.
- `extraction/classifyBlocks.js` — `isDecorativeKey` changed from module-private to `export`ed (one
  keyword; no behavior change).
- `src/features/action-stories/blocks/BlockCard.jsx` — added `CompactEyebrow`.
- `src/features/action-stories/blocks/{GaugeBlock,BarChartBlock,LabelValueListBlock,ItemQueueBlock,ObjectBlock}.jsx`
  — use `CompactEyebrow` instead of five duplicated literal copies.
- `extraction/audit-report.md` — regenerated (`npm run audit`), now reflects the 0-data-loss result.

No manifest, fixture, or block-rendering-logic file was regenerated or changed — `npm run
generate-manifests` was not run this pass (no classification-affecting change was made; the one
`classifyBlocks.js` edit is a visibility change, not a logic change).
