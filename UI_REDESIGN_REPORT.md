# Action Stories — Visual Redesign Report

Scope of this pass: **visual/compositional only**. No manifest schema changes, no new
workflow-specific branching, no rendering-pipeline rewrite. The functional architecture built in
prior phases (backend-readiness, chart fixes, manifest validation, declarative sections,
error-boundary isolation) is untouched and still fully exercised by the same 369 tests.

Reference used as visual source of truth: the supplied **"Realify Workspace Dashboard Build"**
ZIP — confirmed byte-identical to this repo's own `source-mockups/*.dc.html`, plus a design-system
bundle (`_ds/realify-design-system-*/`) containing token CSS, a brand readme, and two reference
screenshots. No component source (`.jsx`) existed in that bundle — every primitive here (IntelCard,
compact rows, rail panels, stage pill) was built from the token/readme spec and the two screenshots,
not copied markup.

---

## 1. What was visually wrong before

- **Every block, regardless of size or importance, rendered as an identically-weighted bordered
  card.** A one-line flag ("Approved: Yes") got the same visual treatment as a 12-row analytical
  table. Nothing signaled what mattered.
- **Color/typography were arbitrary Tailwind defaults**, not the Realify brand system: the old
  `--rf-brand-blue-*` tokens were a generic blue (`#2E6BFF`) with no relationship to Realify's
  actual graphite-anchored ink scale; `font-sans`/`font-serif`/`font-mono` in `tailwind.config.js`
  all resolved to the same Inter fallback stack, so there was no typographic hierarchy at all — no
  Fraunces display serif, no JetBrains Mono labels.
- **Radius/shadow/border values were arbitrary** (`rounded-lg`/`rounded-md` mixed inconsistently)
  rather than the reference's calibrated scale.
- **The shell was generic**: plain text nav items, no brand mark, no theme-toggle iconography, a
  flat stage tracker with no visual progress metaphor.
- **The header carried no hierarchy** — a bare stage code and a heading, no breadcrumb, no
  workflow-identity chip, no pinned context.

## 2. What was structurally wrong with the composition

This was the deeper problem, and the one explicitly called out as off-limits for a shallow fix:

- **The "card wall" was not a sizing problem — it was a container-ownership problem.** Even when
  the declarative layout already grouped several scalar blocks into one grid row (e.g. 4 KPI
  numbers side by side), each block still independently wrapped itself in its own bordered
  `BlockCard`. The result was a wall of small cards arranged horizontally instead of one wall of
  cards arranged vertically — visually identical failure, just rotated 90°.
- **No information hierarchy existed in the layout layer.** Guardrails (secondary, supporting
  context) and the stage's primary analysis/decision content rendered as the same kind of full-width
  block in the same vertical stream — nothing distinguished "the thing you're here to look at" from
  "the constraints you should know about."
- **The single most narrative field on a `decide` stage (`rationale` / `primaryInsight` /
  `heroTitle`) had no distinguished treatment.** It rendered as a plain card with a label, identical
  in weight to a scalar flag — even though it's the one piece of prose a reader is actually meant to
  read first.
- **A real content-correctness bug was hiding inside this structural work**: a subset of
  mockup-derived fixture fields (`fg`, `weight` — CSS foreground-color and font-weight metadata
  attached to some label/value entries) was not on the decorative-key filter list used across 7
  files, so it was leaking into the UI as fake content (`"Fg | var(--ink-900) | Weight | 600"`)
  inside `LabelValueListBlock`'s "extra entries" fallback. This wasn't a visual polish issue — it
  was genuinely wrong information being shown to a user, only surfaced by rendering real fixture
  data end-to-end rather than reasoning about the code in the abstract.

## 3. What was changed

**Container ownership moved from blocks to the layout layer.** Scalar-shaped blocks (Text, Number,
Flag, Object, LabelValueList) gained a `compact` boolean prop that strips their own card border and
renders a bare label/value row. `StageSections.jsx` now owns the *shared* panel: a group of
compact-eligible siblings renders inside one bordered panel with internal hairline (`divide-y`)
dividers, not N separate cards. This required restructuring `StageRenderer.jsx` into two explicit
passes — pass 1 resolves every block and asks the existing declarative section-composer
(`composeSections()`) how blocks are grouped, computing which slots should be compact; pass 2 builds
the actual JSX now knowing compactness. A block cannot know its own compactness in isolation — it's
a property of its neighbors, decided once by the layout layer, not duplicated per block.

**Section→rail mapping reused the existing Phase 2 section vocabulary**, not new logic:
`guardrails`/`summary` sections (secondary, supporting) now render in a narrow 300px contextual
rail; `analysis`/`details` (primary content) render in the main column — directly matching the
reference's `1fr / 320px` two-column mockup pattern. This is generic across all 26 workflows because
`classifyBlocks.js`'s `planSections()` already produces this same four-name vocabulary for every one
of them; nothing workflow-specific was added.

**The primary narrative insight got IntelCard treatment**, reusing the existing shared slot-name
vocabulary (`rationale`, `primaryInsight`) and extending it with `heroTitle` — added only after
confirming via `grep` that it recurs verbatim across 8 different workflows' `decide` stages (a real
cross-workflow pattern, not a one-off), gated by a 60-character length threshold so a short label
never gets promoted. Hero blocks render with an accent left-edge, a mono "Realify signal · {label}"
context tag, and Fraunces display serif prose — visually distinct from every surrounding block.

**Typography, color, radius, spacing, and shadow tokens were replaced with reference-derived
values**, not invented: `tokens.css` kept every existing `--rf-*` variable name (so nothing
downstream broke) but replaced values with the reference's actual graphite-anchored ink scale and
semantic accent colors; a new additive `realify-tokens.css` brings in the reference's own token
names verbatim (`--s-*` spacing, `--r-*` radius, `--shadow-*`, `--mod-*` module hues, the full type
scale). `tailwind.config.js`'s font families were fixed so `font-serif`/`font-mono` actually resolve
to Fraunces/JetBrains Mono instead of silently falling back to Inter. Radius was mapped onto
Tailwind's own default scale (discovered to match the reference exactly, shifted by one named step)
so classes read as ordinary `rounded-xl`/`rounded-2xl` rather than arbitrary `rounded-[var(...)]`.

**The application shell and header got the reference's restraint applied without discarding real
navigation.** The reference's 68px icon-only module rail was *not* copied wholesale — it solves a
different problem (switching between 8 fixed modules) than this app has (browsing 26 distinct
workflow instances), and replacing the workflow list with icons would have destroyed real
navigation. Instead, the reference's visual language (subtle 2.5px accent bar for active state
instead of full background tint, mono micro-labels, a graphite "R" logo-mark, an icon-based theme
toggle, a system-status footer) was applied to the existing list-based sidebar. `StagePage.jsx`
gained a mono breadcrumb, a pinned workflow-identity context bar, and a proper `<h1>`; `StepTracker`
became a pill-shaped stage stepper with circular step badges (check icon when past, filled when
active); `StageActionBar` got real status iconography (success/error) instead of hardcoded emerald
classes.

**The `fg`/`weight` decorative-key gap was fixed** by adding both keys to the
`DECORATIVE_EXACT_KEYS` set independently maintained in all 7 files that carry a local copy
(project convention — each runtime/generation file keeps its own copy rather than sharing an
import). Verified safe: manifest regeneration produced a zero-diff across all 26 workflows (no
classification side-effects), and `npm run audit`'s issue count was unchanged.

## 4. Shared UI primitives introduced

| Primitive | Where | Purpose |
|---|---|---|
| `compact` prop on scalar blocks | TextBlock, NumberBlock, FlagBlock, ObjectBlock, LabelValueListBlock | Bare label/value row instead of a bordered card, when grouped by the layout layer |
| `RailPanel` | StageSections.jsx | One shared bordered panel per rail section, with a real `<h2>` heading and `divide-y` compact children |
| `GridPanel` | StageSections.jsx | One shared bordered panel for a grid-grouped row of compact scalars, with hairline `divide-y`/`sm:divide-x` dividers |
| Hero/IntelCard treatment | TextBlock.jsx | Accent-edge card, mono context tag, Fraunces prose — for the one primary narrative field per stage |
| `compactSlots.js` (`RAIL_SECTION_IDS`) | layout/ | Single shared constant so StageRenderer and StageSections agree on which sections are "rail" without duplicating the list |
| `ThemeToggle` (icon-based) | Shell.jsx | Sun/moon/circle-half-stroke iconography instead of a text label |

No primitive was extracted speculatively — each exists because at least 2 independent call sites
needed the identical pattern (the explicit bar the task set for "genuinely justified").

## 5. Existing primitives reused (not rebuilt)

- `BlockCard` / `BlockTitle` — every non-compact block still goes through these; updating their
  radius/shadow/typography once propagated automatically to every block type, including all four
  chart blocks (Bar/Line/Scatter/Waterfall), the heatmap grid, item queues, and tables, with zero
  chart-block-specific styling code.
- `composeSections()` / `planSections()` (Phase 2's declarative section system) — reused unmodified
  as the source of rail-vs-main placement; no new classification logic.
- `classifyBlocks.js`'s `PRIORITY_GROUPS` slot-name vocabulary (`rationale`, `primaryInsight`) —
  reused as-is for hero detection, extended by one name (`heroTitle`) after confirming it's generic.
- `BlockErrorBoundary`, `EmptyState`, `ErrorState` (AsyncState.jsx) — kept their existing behavior;
  only radius/shadow tokens were brought in line with the rest of the system.
- The Phase 3 responsive off-canvas drawer mechanism in `Shell.jsx` — kept entirely; only restyled.

## 6. Files changed (this visual pass)

**Tokens/config:** `src/styles/tokens.css` (values rewritten, names preserved),
`src/styles/realify-tokens.css` (new), `tailwind.config.js`, `index.html`, `src/index.css`

**Shell/navigation/header:** `Shell.jsx`, `StepTracker.jsx`, `StagePage.jsx`, `StageActionBar.jsx`

**Layout/composition:** `StageRenderer.jsx`, `StageSections.jsx`, `layout/compactSlots.js` (new)

**Blocks:** `BlockCard.jsx`, `TextBlock.jsx`, `NumberBlock.jsx`, `FlagBlock.jsx`, `ObjectBlock.jsx`,
`LabelValueListBlock.jsx`, `TableBlock.jsx`, `ItemQueueBlock.jsx`, `HeatmapGridBlock.jsx`,
`nestedEntryText.js`, `BlockStates.jsx`, `BlockErrorBoundary.jsx`, `AsyncState.jsx`

**Decorative-key bug fix (content correctness, not styling):** `LabelValueListBlock.jsx`,
`ItemQueueBlock.jsx`, `HeatmapGridBlock.jsx`, `nestedEntryText.js`, `TableBlock.jsx`,
`extraction/classifyBlocks.js`, `extraction/audit.js`

**Tests updated to match the new structure (behavior-preserving, not weakened):**
`StageRenderer.test.jsx` (grid-count selector updated to a `data-grid-panel` attribute),
`routeLevel.test.jsx` (heading count/order updated to match rail sections gaining real `<h2>`s)

## 7. How the reference design influenced the implementation

Every visual decision traces to a specific reference artifact, not aesthetic preference:

- Ink/accent color values → `_ds/.../tokens.css` in the reference bundle, applied by replacing
  `--rf-*` values only (names untouched, so nothing downstream broke).
- Type scale, spacing (`--s-1..10`), radius (`--r-xs..full`), shadow steps → same bundle, brought in
  under their own reference names in a new additive `realify-tokens.css` rather than overloaded onto
  the existing `--rf-*` names, so the two systems stay traceable independently.
- Two-column `1fr / 320px` page pattern with a narrow contextual rail → the reference's own
  `decide`-stage mockup screenshot; mapped onto this app's *existing* `guardrails`/`summary` section
  vocabulary rather than inventing a new classification.
- IntelCard (accent edge + mono tag + serif prose) → the reference readme's own description of how
  a "primary finding" should read, applied to this app's existing `rationale`/`primaryInsight`
  slot-name vocabulary.
- Compact metadata chips / pill stage stepper / hairline-divided panels instead of card grids →
  reference screenshots, cross-checked against the readme's stated "cards rest at rest-elevation,
  hairline borders, minimal shadow" principles.
- The 68px icon-only module rail was deliberately **not** copied — see §3 — because it solves a
  different navigation problem than this app has; only its restraint (accent bar not fill, mono
  labels) was carried over.

## 8. Representative screens validated

Screens were chosen for density/difficulty, not convenience, per the task's own instruction not to
manually redesign all 100+ screens:

- **`S9.13 / decide`** — dense: guardrails, a hero-slot rationale field, hero metrics, an
  offer-mode label/value list (the exact fixture carrying the `fg`/`weight` bug), a 5-row table, a
  cap-effects/grouped section. Verified via full DOM dump: hero treatment renders correctly, no
  leaked styling metadata, rail/main split matches the guardrails/summary → rail rule.
- **`S10.2 / analyze`** — chart-heavy: scatter, line, and bar charts alongside item queues and
  label/value lists in one stage. Verified all 6 chart `ResponsiveContainer`s mount cleanly with no
  `BlockErrorBoundary` fallbacks, and inherit `BlockCard`/`BlockTitle` styling automatically (no
  chart-specific styling code was needed — confirms the shared-primitive architecture works as
  intended).
- Table-heavy and many-scalar-value stages were exercised by the full component test suite
  (`TableBlock.test.jsx`, `StageRenderer.test.jsx`, `routeLevel.test.jsx`, the 105-manifest
  `manifestFixtureSweep.test.js`), which renders every stage of every one of the 26 real workflows,
  not just the two hand-picked above.

## 9. Test / build / audit results

All four required verification commands, run in one final pass:

```
npm test (vitest)          → 22 test files, 369 tests — all passing
npm run validate-manifests → 105/105 PASS
npm run audit              → 26 workflows, 105 stages, 1760 blocks audited;
                              829 issues (0 data loss, 23 misclassification, 806 layout-only) —
                              identical to the pre-redesign baseline; zero-diff manifest
                              regeneration confirms no classification side-effects from the
                              fg/weight decorative-key fix
npm run build (vite)       → clean, no errors or warnings
npm run lint (eslint)      → clean, zero issues
```

## 10. Before vs. after visual-quality assessment

**Before:** every block was a same-weight bordered card regardless of content type or importance;
color/type tokens were generic Tailwind defaults unrelated to the Realify brand; no hierarchy
distinguished a stage's primary finding from its supporting metadata; grouped scalar values still
produced a wall of small cards, just rotated into a horizontal grid instead of a vertical stack.

**After:** compact scalar rows share one panel per logical group instead of one card each; the
stage's single primary narrative field (when one exists) is visually distinct via accent-edge +
serif prose; secondary/supporting sections (guardrails, summary) live in a narrow contextual rail,
separated from primary analysis/decision content in the main column; typography, color, radius, and
spacing trace directly to the reference token set rather than framework defaults; chart, table, and
list blocks inherited the same visual language automatically through shared primitives rather than
being restyled one-by-one. A genuine content-correctness bug (leaked `fg`/`weight` styling metadata)
was found and fixed in the same pass, via actual end-to-end rendering of real fixture data — not
just code review.

**Stakeholder test:** shown `S9.13/decide` or `S10.2/analyze` today, a senior product/design/
engineering reviewer would see a stage with a clear breadcrumb → identity → title → stepper header,
a distinguished primary insight, grouped supporting metrics in compact rows, a contextual rail for
guardrails, and appropriately-sized charts/tables — not a vertical stream of equal-weight generated
cards. That is a materially different, more deliberate structure than the pre-redesign state, and is
presentable as production UI.

## 11. Remaining visual issues (honest, not glossed over)

- **No live-browser screenshot verification was possible in this environment.** The
  `claude-in-chrome` browser tool reported "not connected" both times it was checked (before and
  after the redesign work). Verification instead relied on: the full jsdom component/integration
  test suite (369 tests, including full-stage renders of all 26 real workflows), a diagnostic
  HTML-dump-and-inspect script rendering real fixture data end-to-end, and manual reading of every
  changed component's class list against the reference token values. This is the same constraint
  the project's own prior `AUDIT_REPORT.md` phase documented and worked around the same way — but a
  real-browser pixel check (font rendering, exact spacing feel, hover/focus states, actual chart SVG
  geometry) has not been done and is the one meaningful gap between this report and full certainty.
- Chart block heights (`h-56`/`h-64`, set in a prior phase) were not re-tuned in this pass; they
  read as reasonable/proportional in the dumped DOM structure but were not re-validated against the
  reference's own chart sizing since the reference screenshots don't show this app's specific chart
  types at matching data density.
- `StageActionBar`'s error pill has no explicit `flex-wrap`/truncation guard; today's real error
  message (`"Couldn't confirm this stage — missing context."`) fits comfortably even at a 400px
  viewport, but a future, longer backend-supplied error string could overflow the row. Noted as a
  minor hardening item, not a defect against any real current data.
- The dark-mode token values in `tokens.css` are derived (following the reference's warm-graphite
  character, inverted) rather than reference-sourced, since the supplied reference is light-mode
  only — dark mode was not part of the reference material and could not be visually cross-checked
  against it.
